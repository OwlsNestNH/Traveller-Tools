// Bounded Stage 2 campaign-day / Campaign time completion gate.
// Uses the production app/controller/state, discovered version-tagged Store,
// real Web Locks and disposable deterministic Map fixtures. Native save and
// publication can finish while the returned Promise is still held by this test.
// No app source, controller, state transition, storage body or lock is replaced.
// DOM wrappers below inject named one-shot UI failures, never emulate success.
// Run in exact-head CI: node verification/time-completion-browser.test.mjs [playwright-module]
// --fixtures-only validates fixtures/source wiring WITHOUT launching Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {displayDate} from '../js/calendar.mjs';
import {supportStock} from '../js/life-support.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const paired = ['success', 'prewrite', 'unknown-before', 'unknown-after', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token'];
const scenarios = [
 ...['forward', 'back', 'form'].flatMap(path => paired.map(mode => ({id: path + '-' + mode, path, mode}))),
 ...['forward', 'form'].flatMap(path => ['foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog', 'render', 'report', 'close', 'clear-error'].map(mode => ({id: path + '-' + mode, path, mode}))),
 ...['forward', 'back', 'form'].flatMap(path => ['sync', 'reentrant'].map(mode => ({id: path + '-' + mode, path, mode}))),
 ...['title-before', 'title-after', 'body-before', 'body-after'].map(fault => ({id: 'pending-ui-' + fault, path: 'forward', mode: 'pending-ui', fault})),
 ...[
  ['legacy-forward-undo', 'forward', 'legacy'], ['legacy-date-only-undo', 'form', 'legacy-date'],
  ['same-hours-normal-event', 'form', 'same-hours'], ['date-only-normal-event', 'form', 'date-only'],
  ['rewind-never-refills', 'form', 'rewind'], ['untracked-day-remainder', 'forward', 'untracked'],
  ['year-rollover-seven-hours', 'forward', 'rollover'], ['campaign-start-boundary', 'back', 'start-boundary'],
  ['maximum-safe-hours-boundary', 'forward', 'max-boundary'], ['later-time-closes-jump-mulligan', 'form', 'jump'],
  ['dirty-inline-settings-retained', 'form', 'dirty-settings'], ['invalid-time-form', 'form', 'validation'],
  ['idle-foreign-review', 'form', 'idle-stale']
 ].map(([id, path, mode]) => ({id, path, mode}))
];
const successPattern = /Time (?:advanced \+1 day:|correction(?: -1 day)?:)[\s\S]* saved\./;
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 65, caret: 'initial'});
const report = {
 suite: 'Campaign time and day save completion', startedAt: new Date().toISOString(),
 requestedCommit: process.env.TRAVELLER_COMMIT || null, node: process.version,
 declaredCases: scenarios.length * sizes.length, cases: [], errors: [],
 scope: 'Production +1 day, -1 day and Campaign time DOM gestures; one-use token/revision/snapshot publication; held native save versus held Promise settlement; real Web Locks; retry, unknown outcome, callback/UI failure, stale owners, exact accounting, reload/Undo and desktop/mobile evidence. Synthetic campaigns only. No live campaign, unrelated async action family, deployment or strict unrelated SVG identity claim.'
};
let browser;
const errorText = error => error?.stack || String(error);
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const tab = (page, name) => page.locator('#tabs [data-action="tab"][data-arg="' + name + '"]').click();
const action = (page, name) => page.locator('[data-action="' + name + '"]').filter({visible: true}).first();
const closed = page => page.locator('#modal').waitFor({state: 'hidden'});
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const gate = page => page.evaluate(() => timeGate.snapshot());
const release = (page, kind = 'native') => page.evaluate(kind => timeGate.release(kind), kind);
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'jumpAttempts'].includes(key)));
const hash = value => createHash('sha256').update(value).digest('hex');

function fixture() {
 const s = S.initial();
 const origin = {id: '1,1', x: 1, y: 1, name: 'Time Origin', sector: 'Synthetic', hex: '0202', uwp: 'A788899-C', zone: 'Safe'};
 const destination = {...origin, id: '2,1', x: 2, name: 'Time Destination', hex: '0302'};
 Object.assign(s, {initialized: true, name: 'Disposable time completion campaign', actual: origin.id, worlds: {[origin.id]: origin, [destination.id]: destination}, route: [origin.id, destination.id], bank: '100000', hours: 31, dateLabel: '365-1105'});
 Object.assign(s.ship, {
  name: 'Time Trader', capacity: '100', staterooms: 3, fuel: configureFuel(200, 40, 40, 0, 2),
  lifeSupport: {capacityHours: 672, stockUnits: {numerator: '400', denominator: '3'}},
  accommodation: {rooms: {low: 2, middle: 3, high: 0}, occupiedLowBerths: 2, passengers: {low: 0, middle: 1, high: 0}, crew: {low: 0, middle: 2, high: 0}}
 });
 s.lots = [{id: 'time-cargo', commodity: '11', description: 'Retained cargo and saved price roll', quantity: '5', basis: '1000', goodsValue: '1000', priceDice: {dice: [2, 3, 4], total: 9}}];
 s.contracts = [{id: 'time-mail', kind: 'mail', status: 'accepted', firstDeparture: null, origin: origin.id, destination: destination.id, quantity: '5', payment: '1000', dueHours: null}];
 s.policies = [{id: 'time-policy', lotId: 'time-cargo', claims: [], status: 'active', initialQuantity: '5', remainingQuantity: '5', insuredValue: '1000', remainingValue: '1000', coverage: 70, route: [origin.id, destination.id], routeProgress: 0, destination: destination.id}];
 s.snapshots = [{id: 'time-supplier', kind: 'supplier', worldId: origin.id, hours: 0, startedHours: 0, party: 'Retained supplier', offers: [{id: 'time-stock', commodity: '11', description: 'Saved offer', expired: false, remaining: '2', unitPrice: '100', priceDice: {dice: [3, 3, 4], total: 10}}]}];
 s.ledger = [{id: 'time-opening', type: 'Opening bank', amount: '100000', hours: 0, world: origin.id}];
 s.dashboardBaseline = createDashboardBaseline(s);
 return S.validate(s);
}
function seed(scenario) {
 let s = fixture();
 if (['legacy', 'legacy-date'].includes(scenario.mode)) s.ship.lifeSupport = {capacityHours: 672, remainingHours: 672, elapsedHours: 6};
 if (scenario.mode === 'untracked') delete s.ship.lifeSupport;
 if (['rollover', 'start-boundary'].includes(scenario.mode)) s.hours = 7;
 if (scenario.path === 'back' && ['sync', 'reentrant'].includes(scenario.mode)) s.hours = 55;
 if (scenario.mode === 'max-boundary') s.hours = Number.MAX_SAFE_INTEGER - 23;
 if (scenario.mode === 'jump') {
  const p = S.prepareJump(s, () => ({dice: [3, 3, 3, 3, 3, 3], total: 18}));
  s = S.transition(p.state, 'Jump: Time Origin → Time Destination', next => S.commitJump(next, {attemptId: p.attempt.id, elapsed: 160}));
 }
 return S.validate(s);
}
function specification(before, scenario) {
 const hours = scenario.path === 'forward' ? before.hours + 24 : scenario.path === 'back' ? before.hours - 24 : ['same-hours', 'date-only', 'legacy-date'].includes(scenario.mode) ? before.hours : scenario.mode === 'rewind' ? 7 : before.hours + 5;
 const date = ['date-only', 'legacy-date'].includes(scenario.mode) ? '001-1200' : before.dateLabel;
 const reason = 'Synthetic time completion ' + scenario.mode;
 const label = scenario.path === 'form' ? 'Time correction: ' + reason : (scenario.path === 'forward' ? 'Time advanced +1 day: ' : 'Time correction -1 day: ') + displayDate(before.dateLabel, before.hours) + ' to ' + displayDate(before.dateLabel, hours) + (scenario.path === 'back' ? ' (supplies and transactions unchanged)' : '');
 return {hours, date, reason, label};
}
function expected(before, scenario) {
 const spec = specification(before, scenario);
 return S.transition(before, spec.label, next => {next.hours = spec.hours; if (scenario.path === 'form') next.dateLabel = spec.date;});
}
function assertTime(saved, before, scenario) {
 const want = expected(before, scenario);
 want.undo.at(-1).id = saved.undo.at(-1).id;
 want.events.at(-1).id = saved.events.at(-1).id;
 assert.deepEqual(saved, want, 'Full saved state equals exactly one normal time transition');
 assert.equal(saved.revision, before.revision + 1);
 assert.equal(saved.undo.length, before.undo.length + 1);
 assert.equal(saved.events.length, before.events.length + 1);
 for (const key of ['bank', 'ledger', 'lots', 'contracts', 'policies', 'snapshots', 'dashboardBaseline', 'actual', 'route', 'routeIndex']) assert.deepEqual(saved[key], before[key], key + ' cannot change with time');
 assert.deepEqual({...saved.ship, lifeSupport: null}, {...before.ship, lifeSupport: null});
 if (before.ship.lifeSupport?.stockUnits && saved.hours <= before.hours) assert.deepEqual(saved.ship.lifeSupport, before.ship.lifeSupport, 'Rewind, same-hours and date-only cannot refill or consume physical LSS');
}
function safeReport(snapshot) {
 const {candidates, ...rest} = snapshot;
 return {...rest, candidateSHA256: candidates.map(hash)};
}
async function contextFor(result, scenario) {
 const context = await browser.newContext({viewport: result.viewport, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(errorText(error)));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
 });
 await context.exposeBinding('__timeUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  // Observe without preventDefault or a rejection handler on the held Promise.
  addEventListener('unhandledrejection', event => {void globalThis.__timeUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.timeStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   timeStorage.attempts++;
   timeStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, time: document.querySelector('.campaign-time .value')?.textContent || null, support: document.querySelector('.life-support-counter')?.textContent || null});
   if (timeStorage.failNext) {timeStorage.failNext = false; throw Error('Synthetic known time prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); timeStorage.writes++; return result;
  };
 }, {key: KEY, bytes: JSON.stringify(seed(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/time-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable time native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105', 'Time/date changes cannot switch map era');
   const headers = {'Access-Control-Allow-Origin': '*'};
   // Saved synthetic worlds supply the useful map. Empty API datasets are
   // deterministic real responses, not a replacement map/controller function.
   if (url.pathname.endsWith('/jumpworlds')) return route.fulfill({json: {Worlds: []}, headers});
   if (url.pathname.endsWith('/universe')) return route.fulfill({json: {Sectors: []}, headers});
   if (url.pathname.endsWith('/metadata')) return route.fulfill({json: {Subsectors: []}, headers});
   if (url.pathname.endsWith('/sec')) return route.fulfill({json: 'Hex\tName\tUWP\n', headers});
  }
  result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
 });
 return context;
}

async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(script => script.type === 'module' && /\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if (!appURL) throw Error('Actual app module unavailable');
  const response = await fetch(appURL); if (!response.ok) throw Error('Cannot inspect runtime app');
  const source = await response.text();
  const specifier = source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing');
  const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Unversioned Store is not the actual application Store');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save;
  const g = globalThis.timeGate = {armed: false, pending: null, store: null, args: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, pendingUI: null, faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, oldButton: null, baseline: null, roleFault: false, roleThrows: 0, nativeWriteBaselines: []};
  const semantic = () => ({time: document.querySelector('.campaign-time .value')?.textContent || null, support: document.querySelector('.life-support-counter')?.textContent || null, settingsDate: [...document.querySelectorAll('.settings-aux-row')].find(el => el.textContent.includes('Advance / correct time'))?.querySelector('.help')?.textContent || null, status: document.querySelector('#save-status')?.textContent || ''});
  const displayDOM = () => ({time: document.querySelector('.campaign-time')?.outerHTML || null, support: document.querySelector('.life-support-counter')?.outerHTML || null, settingsTime: [...document.querySelectorAll('.settings-aux-row')].find(el => el.textContent.includes('Advance / correct time'))?.outerHTML || null});
  const observation = point => ({point, ...semantic(), message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, title: document.querySelector('#modal-title')?.textContent || '', revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (g.pendingUI?.startsWith('title-') && this.id === 'modal-title' && value === 'Saving campaign day') {const fault = g.pendingUI; g.pendingUI = null; g.faults.push(fault); throw Error('Synthetic time pending title construction fault');}
   if (g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '' && g.settlements.at(-1)?.kind === 'native-fulfilled') {g.cleanupFault = null; g.faults.push('clear-error'); throw Error('Synthetic owned time success error-clear fault');}
   if (g.cleanupFault === 'report' && this.id === 'message' && /^Time (advanced|correction).* saved\.$/s.test(value)) {g.cleanupFault = null; g.faults.push('report'); throw Error('Synthetic time success reporting fault');}
   return Reflect.apply(text.set, this, [value]);
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {
   if (g.pendingUI?.startsWith('body-') && this.id === 'modal-body' && String(value).includes('Saving the campaign day')) {const fault = g.pendingUI; g.pendingUI = null; g.faults.push(fault); throw Error('Synthetic time partial pending body construction fault');}
   if (g.cleanupFault === 'render' && this.id === 'main' && g.settlements.at(-1)?.kind === 'native-fulfilled') {g.cleanupFault = null; g.faults.push('render'); throw Error('Synthetic time completion render fault');}
   return Reflect.apply(html.set, this, [value]);
  }});
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {
   if (g.cleanupFault === 'close' && this.id === 'modal' && g.settlements.at(-1)?.kind === 'native-fulfilled') {g.cleanupFault = null; g.faults.push('close'); throw Error('Synthetic time native close fault');}
   return Reflect.apply(close, this, args);
  };
  const replay = () => {
   const title = document.querySelector('#modal-title').textContent, open = document.querySelector('#modal').open;
   // These run synchronously INSIDE native save/publication, before any service
   // Promise continuation. The real document event route must block them now.
   g.oldButton?.click(); document.querySelector('[data-action="day-back"]')?.click(); document.querySelector('[data-action="day-forward"]')?.click();
   document.querySelector('#modal-form').requestSubmit();
   if (g.oldSubmit) void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
   document.querySelector('#notes').click();
   g.reentrantChecks.push({sameTitle: document.querySelector('#modal-title').textContent === title, sameOpen: document.querySelector('#modal').open === open});
  };
  function observeStore(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const change = store.onChange, role = store.onRole;
   store.onChange = function(...args) {
    const entry = {revision: args[0].revision, tokenPresent: args[1]?.saveToken != null, tokenMatches: args[1]?.saveToken === g.args?.[2], snapshotMatches: JSON.stringify(args[0]) === JSON.stringify(g.args?.[0]), actualCallback: false};
    g.publications.push(entry); g.observations.push(observation('before-native-publication'));
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before time publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    entry.deliveredTokenPresent = args[1]?.saveToken != null; entry.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2];
    const result = Reflect.apply(change, this, args); entry.actualCallback = true;
    if (g.reentrant) replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after time publication');}
    return result;
   };
   store.onRole = function(...args) {
    const result = Reflect.apply(role, this, args);
    if (g.roleFault) {g.roleFault = false; g.roleThrows++; throw Error('Synthetic role callback after time failure');}
    return result;
   };
  }
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.totalCalls++;
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision});
   g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) replay();
   if (!g.armed) {g.nativeWriteBaselines.push({semantic: semantic(), dom: displayDOM()}); return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending time completion');
   g.calls++;
   const promise = new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
   if (g.pendingUI?.endsWith('-after')) g.write();
   return promise;
  };
  g.write = () => {
   const p = g.pending; if (!p || p.executed) throw Error('Native time write must execute exactly once');
   p.executed = true; g.executions++;
   // Exact displayed counters immediately before native durable write, after
   // pending-screen construction and any real queued map/ResizeObserver work.
   g.nativeWriteBaselines.push({semantic: semantic(), dom: displayDOM()});
   try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}
  };
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending time completion');
   if (kind === 'unknown-before') {g.pending = null; g.settlements.push({kind, executed: false}); p.reject(Error('Synthetic unknown time outcome before write')); return;}
   if (!p.executed) g.write(); g.pending = null;
   if (kind === 'unknown-after' || kind === 'contradictory') {
    g.settlements.push({kind, executed: true});
    p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory time not-committed result after observed publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic response lost after durable time save'));
   } else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = path => {
   g.oldSubmit = path === 'form' ? document.querySelector('#modal-form').onsubmit : null;
   g.oldButton = path === 'form' ? null : document.querySelector('[data-action="day-' + path + '"]');
   g.baseline = semantic();
   g.fieldNodes = path === 'form' ? [...document.querySelectorAll('#modal [name]')] : null;
   g.fields = g.fieldNodes?.map(el => [el.name, el.value]) || null;
  };
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...timeStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, semantic: semantic(), fields: [...document.querySelectorAll('#modal [name]')].map(el => [el.name, el.value]), submittedFields: g.fields, retainedFieldNodes: g.fieldNodes?.every((el, i) => document.querySelectorAll('#modal [name]')[i] === el) ?? null, frozenFields: g.fieldNodes?.every(el => el.disabled) ?? null, dirtyDraft: globalThis.timeDirtyForm ? {connected: timeDirtyForm.isConnected, name: timeDirtyForm.elements.namedItem('name').value} : null, nativeWriteBaselines: g.nativeWriteBaselines, displayDOM: displayDOM(), roleThrows: g.roleThrows, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL, storeURL};
 });
}

async function capture(page, result, label) {
 await frames(page);
 const name = 'time-completion-' + result.id + '-' + label + '.jpg';
 // .47 regression: default Playwright caret hiding adds empty inline styles.
 await page.screenshot({path: join(artifacts, name), ...screenshotOptions}); result.screenshots.push(name);
 const geometry = await page.evaluate(() => {
  const dialog = document.querySelector('#modal[open]'), rect = dialog?.getBoundingClientRect();
  return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: dialog.scrollWidth - dialog.clientWidth} : null};
 });
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Time dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'No time dialog horizontal clipping');}
}
async function pointer(page, selector, clickCount = 1) {
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box, 'Physical pointer target exists');
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function prepare(page, scenario, before) {
 if (scenario.path !== 'form') return;
 await tab(page, 'Settings');
 if (scenario.mode === 'dirty-settings') {
  const input = page.locator('#settings-form [name="name"]');
  await input.locator('xpath=ancestor::details').evaluateAll(nodes => nodes.forEach(el => {el.open = true;}));
  await input.fill('Unrelated dirty inline time draft');
  await page.evaluate(() => {globalThis.timeDirtyForm = document.querySelector('#settings-form');});
 }
 await action(page, 'time').click(); await page.locator('#modal-title').filter({hasText: 'Campaign time'}).waitFor();
 const spec = specification(before, scenario);
 for (const [name, value] of Object.entries({date: spec.date, hours: spec.hours, reason: spec.reason})) await page.locator('#modal [name="' + name + '"]').fill(String(value));
}
async function start(page, scenario, {keyboard = false} = {}) {
 await page.evaluate(path => timeGate.remember(path), scenario.path);
 if (scenario.path === 'form') {
  if (keyboard) {await page.locator('#modal [name="reason"]').focus(); await page.keyboard.press('Enter');}
  else await pointer(page, '#modal-submit');
 } else if (keyboard) {await action(page, 'day-' + scenario.path).focus(); await page.keyboard.press('Enter');}
 else await pointer(page, '[data-action="day-' + scenario.path + '"]');
}
async function replay(page, scenario, {physical = true, navigation = true} = {}) {
 if (physical) {
  for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) await pointer(page, '#' + id, 2);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
 }
 await page.evaluate(navigation => {
  const g = timeGate, form = document.querySelector('#modal-form');
  if (g.oldSubmit) void g.oldSubmit({preventDefault() {}, currentTarget: form});
  form.requestSubmit(); g.oldButton?.click();
  document.querySelector('[data-action="day-forward"]')?.click(); document.querySelector('[data-action="day-back"]')?.click();
  if (navigation) {document.querySelector('[data-action="time"]')?.click(); document.querySelector('#notes').click();}
 }, navigation);
 await frames(page);
}
async function assertPending(page, result, scenario, bytes) {
 await start(page, scenario, {keyboard: scenario.path === 'form'});
 await page.waitForFunction(() => !!timeGate.pending); await frames(page);
 assert.equal(await raw(page), bytes, 'Held provider has not touched durable campaign bytes');
 let snapshot = await gate(page);
 assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Explicit pre-click semantic date/LSS/status baseline is still displayed');
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 assert.equal(await page.locator('#modal').evaluate(el => el.open), true);
 assert.equal(await page.locator('#modal-submit').isHidden(), scenario.path !== 'form');
 if (scenario.path === 'form') assert.equal(await page.locator('#modal-submit').isDisabled(), true);
 for (const id of ['modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true);
 const fields = snapshot.fields;
 if (scenario.path === 'form') {assert.deepEqual(fields, snapshot.submittedFields, 'Captured form values remain exact'); assert.equal(snapshot.retainedFieldNodes, true, 'Actual submitted inputs are retained'); assert.equal(snapshot.frozenFields, true, 'Actual date/hours/reason inputs are disabled while saving');}
 if (scenario.mode === 'dirty-settings') assert.deepEqual(snapshot.dirtyDraft, {connected: false, name: 'Unrelated dirty inline time draft'});
 // Pending day has a non-submitting status form; retain its real callback too.
 if (scenario.path !== 'form') await page.evaluate(() => {timeGate.oldSubmit = document.querySelector('#modal-form').onsubmit;});
 await replay(page, scenario);
 snapshot = await gate(page); assert.equal(snapshot.calls, 1); assert.equal(snapshot.totalCalls, 1);
 assert.equal(await raw(page), bytes); assert.deepEqual(snapshot.fields, fields);
 assert.deepEqual(snapshot.semantic, snapshot.baseline);
 assert.equal(await page.locator('#modal').evaluate(el => el.open), true);
 for (const forwarded of snapshot.forwarded) {assert.ok(forwarded.argumentCount >= 3); assert.equal(forwarded.tokenPresent, true); assert.equal(forwarded.candidateRevision, forwarded.expectedRevision + 1);}
 if (scenario.mode === 'success') await capture(page, result, 'pending-before-write');
 result.checks.push('Pre-write date/LSS/status frozen; pointer double-click, Enter, requestSubmit, detached callbacks and navigation cannot duplicate or dismiss pending save');
}
async function reloadUndo(page, result, before, scenario, {committed = true, captureResult = false} = {}) {
 const bytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await raw(page), bytes, 'Reload never repeats time or consumes supplies'); assert.equal(await page.evaluate(() => timeStorage.writes), 0);
 if (committed) {
  assertTime(await read(page), before, scenario);
  await tab(page, 'History'); await action(page, 'undo').click(); await closed(page); await frames(page);
  const undone = await read(page);
  assert.deepEqual(material(undone), material(before), 'Real History Undo restores exact economics, hours/date, physical or legacy LSS representation and inverse stack');
  assert.equal(undone.revision, before.revision + 2); assert.equal(await page.evaluate(() => timeStorage.writes), 1);
  if (scenario.mode === 'jump') {
   assert.equal(S.jumpUndoEligibility(undone).allowed, false, 'Undo of later time action must not reopen prior jump mulligan');
   assert.deepEqual(undone.jumpAttempts.map(a => a.rolls), before.jumpAttempts.map(a => a.rolls));
   assert.equal(undone.jumpAttempts.at(-1).closed, true);
   const protectedBytes = await raw(page); await action(page, 'undo').click(); assert.equal(await raw(page), protectedBytes);
   assert.match(await page.locator('#message').textContent(), /Cannot undo this protected jump/);
  } else assert.deepEqual(undone.jumpAttempts, before.jumpAttempts);
 } else assert.deepEqual(await read(page), before);
 if (captureResult) await capture(page, result, committed ? 'authoritative-reload-undo' : 'authoritative-reload-no-write');
 result.checks.push(committed ? 'Exact durable bytes survive reload; actual History Undo restores prior date and exact LSS representation without reopening a spent jump window' : 'Authoritative reload confirms no write and no retry');
}
async function successful(page, result, before, scenario, {fresh = false} = {}) {
 await closed(page); await frames(page); assertTime(await read(page), before, scenario);
 assert.equal(await page.locator('#modal-error').textContent(), '', 'Successful time completion leaves no stale modal warning');
 const snapshot = await gate(page); result.gate = safeReport(snapshot);
 assert.equal(await raw(page), snapshot.candidates.at(-1), 'Stored bytes exactly match controller-owned snapshot');
 assert.equal(snapshot.storage.writes, 1); assert.equal(snapshot.durableToken, false); assert.match(await page.locator('#message').textContent(), successPattern);
 const saved = await read(page), date = displayDate(saved.dateLabel, saved.hours), stock = supportStock(saved.ship);
 assert.equal(scenario.path === 'form' ? snapshot.semantic.settingsDate : snapshot.semantic.time, date, 'Settled UI displays the committed date');
 if (stock.tracked) {assert.ok(snapshot.semantic.support.includes(String(Number(Number(stock.remainingUnits).toFixed(2))) + ' LSS aboard')); assert.ok(snapshot.semantic.support.includes(String(Number(Number(stock.remainingDays).toFixed(2))) + ' days'));}
 for (const item of [...snapshot.observations, ...snapshot.storage.observations]) assert.doesNotMatch(item.message, successPattern, 'No success announcement before settlement');
 assert.equal(snapshot.publications.filter(p => p.tokenMatches && p.snapshotMatches && p.actualCallback).length, 1);
 const bytes = await raw(page), total = snapshot.totalCalls;
 await page.evaluate(() => {if (timeGate.oldSubmit) void timeGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); timeGate.oldButton?.click();});
 await frames(page); assert.equal(await raw(page), bytes, 'Detached prior callbacks cannot replay completion'); assert.equal((await gate(page)).totalCalls, total);
 assert.equal(await page.locator('#modal-error').textContent(), '', 'Detached callbacks cannot create a warning after successful completion');
 if (scenario.mode === 'dirty-settings') {
  assert.equal(await page.locator('#settings-form [name="name"]').inputValue(), 'Unrelated dirty inline time draft');
  const beforeAttempt = await raw(page); await page.locator('#settings-save').click(); await frames(page);
  assert.equal(await raw(page), beforeAttempt, 'Dirty Settings cannot silently overwrite changed time');
  assert.match(await page.locator('#settings-error').textContent(), /changed|Revert/i);
  await capture(page, result, 'dirty-draft-preserved-stale');
 }
 if (fresh) {
  // A deliberate new pointer/keyboard gesture after completion remains legal.
  await page.evaluate(() => {timeGate.armed = false; timeGate.reentrant = false;});
  const first = await read(page); await prepare(page, scenario, first); await start(page, scenario, {keyboard: scenario.path !== 'form'}); await closed(page); await frames(page);
  assertTime(await read(page), first, scenario); assert.equal((await gate(page)).storage.writes, 2);
  assert.equal(await page.locator('#modal-error').textContent(), '', 'Fresh successful time action leaves no modal warning');
  await tab(page, 'History'); await action(page, 'undo').click(); await closed(page);
  const restoredFirst = await read(page); assert.equal(restoredFirst.hours, first.hours); assert.deepEqual(restoredFirst.ship, first.ship);
  // Fresh operation and its Undo add audit entries; test the original Undo
  // separately from its clean first-commit bytes below.
  await action(page, 'undo').click(); await closed(page);
  assert.deepEqual(material(await read(page)), material(before));
  await capture(page, result, 'fresh-gesture-and-two-undos');
  const finalBytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), finalBytes);
  result.checks.push('Fresh deliberate post-completion click/keyboard action saves once; two real Undos restore exact starting time/LSS');
 } else await reloadUndo(page, result, before, scenario, {captureResult: ['success', 'legacy', 'legacy-date', 'jump', 'date-only'].includes(scenario.mode)});
}
async function terminal(page, result, before, scenario, {committed, unknown = false} = {}) {
 await page.waitForFunction(() => /Reload/.test(document.querySelector('#save-status').textContent)); await frames(page);
 const snapshot = await gate(page), guidance = unknown ? /outcome could not be confirmed[\s\S]*Reload/i : /saved[\s\S]*Reload/i;
 assert.match(await page.locator('#save-status').textContent(), guidance); assert.match(await page.locator('#message').textContent(), guidance);
 assert.equal(snapshot.editable, false); assert.equal(snapshot.reloadRequired, true); assert.equal(await page.locator('#takeover').isDisabled(), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (committed) assertTime(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 // Capture the original warning before replay or later actions can erase it.
 await capture(page, result, 'terminal-warning');
 const bytes = await raw(page), navigation = [];
 const listener = frame => {if (frame === page.mainFrame()) navigation.push(frame.url());}; page.on('framenavigated', listener);
 try {await replay(page, scenario, {physical: false, navigation: false}); assert.deepEqual(navigation, [], 'Partial/terminal modal requestSubmit cannot navigate'); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);} finally {page.off('framenavigated', listener);}
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true, 'Terminal outcome releases native writer lock');
 result.gate = safeReport(await gate(page));
 assert.equal(result.gate.storage.writes, committed ? 1 : 0);
 await reloadUndo(page, result, before, scenario, {committed, captureResult: scenario.path === 'forward'});
 result.checks.push('Terminal unknown/committed failure observes Promise, releases real lock and blocks replay; warning captured before authoritative recovery');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/time-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {
  const {Store} = await import(storeURL); globalThis.timePeer = {state: null, editable: false};
  timePeer.store = new Store(next => {timePeer.state = next;}, editable => {timePeer.editable = editable;}); await timePeer.store.acquire(true);
 }, result.runtime);
 await peer.waitForFunction(() => timePeer.editable); await page.waitForFunction(() => timeGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {
   const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href);
   const next = S.transition(timePeer.state, 'Foreign native deposit during time save', s => S.deposit(s, 7, 'Synthetic other lock owner'));
   timePeer.store.save(next, timePeer.state.revision); return timePeer.state.revision;
  }, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {timePeer.store.yield(); timePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => timeGate.store.acquire(true)); await page.waitForFunction(() => timeGate.store.editable);}
 result.checks.push('Real second version-tagged Store acquired and released native Web Lock' + (write ? ' and saved a newer authoritative campaign' : '') + (regain ? '; original editor reacquired without reviving stale time owner' : ''));
}
async function retired(page, result, before, scenario, context) {
 const mode = scenario.mode;
 if (mode === 'foreign-same') await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY);
 if (mode === 'foreign-new') await peerTakeover(page, result, context, {write: true});
 if (mode === 'editor-regain') await peerTakeover(page, result, context, {regain: true});
 if (mode === 'native-close' || mode === 'new-dialog') {
  await page.evaluate(() => {document.querySelector('#modal').close(); document.querySelector('#modal').dispatchEvent(new Event('close'));}); await frames(page);
  if (mode === 'new-dialog') {await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor();}
 }
 await frames(page); const authoritative = await raw(page);
 const newer = mode === 'new-dialog' ? await page.locator('#modal-body').textContent() : null;
 await release(page); await frames(page);
 if (mode === 'foreign-new') {
  assert.equal(await raw(page), authoritative, 'Old time write cannot overwrite a newer native owner');
  assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n));
  assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');
 } else assertTime(await read(page), before, scenario);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {if (timeGate.oldSubmit) void timeGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await capture(page, result, 'retired-owner'); result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);}
 else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign publication, native close or editor loss permanently retires old UI authority; later settlement cannot announce, close newer dialog, overwrite peer state or replay');
}

async function runBody(page, result, scenario, context) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await page.evaluate(() => timeStorage.writes), 0, 'Seed includes baseline metadata, so startup never writes');
 await installGate(page, result); const before = await read(page), bytes = await raw(page);
 if (['start-boundary', 'max-boundary'].includes(scenario.mode)) {
  assert.equal(await action(page, 'day-' + scenario.path).isDisabled(), true);
  await pointer(page, '[data-action="day-' + scenario.path + '"]', 2); await action(page, 'day-' + scenario.path).evaluate(el => el.click());
  assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 0);
  await capture(page, result, 'disabled-boundary'); result.checks.push('Campaign start / maximum safe integer boundary rejects day gesture without write'); return;
 }
 await prepare(page, scenario, before);
 if (scenario.mode === 'validation') {
  const valid = specification(before, scenario);
  for (const [name, value] of [['reason', '   '], ['date', '366-1105'], ['hours', '-1'], ['hours', '1.5'], ['hours', '9007199254740992']]) {
   await page.locator('#modal [name="' + name + '"]').fill(value);
   await pointer(page, '#modal-submit'); await page.locator('#modal-form').evaluate(form => form.requestSubmit()); await frames(page);
   assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 0); assert.equal(await page.locator('#modal').evaluate(el => el.open), true);
   await page.locator('#modal [name="' + name + '"]').fill(String(name === 'reason' ? valid.reason : name === 'date' ? valid.date : valid.hours));
  }
  await capture(page, result, 'validation-no-write'); result.checks.push('Reason, Imperial date, whole hours, nonnegative and safe integer validation preserve form and durable bytes');
  await start(page, scenario); await closed(page); await frames(page);
  assert.equal(await page.locator('#modal-error').textContent(), '', 'Corrected valid submission clears earlier validation errors only after successful completion');
  await capture(page, result, 'validation-corrected-success');
  await successful(page, result, before, scenario); return;
 }
 if (scenario.mode === 'idle-stale') {
  await page.evaluate(() => {timeGate.remember('form');});
  // Store's production storage-event listener publishes same-revision data.
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await page.locator('#modal-form').evaluate(form => form.requestSubmit());
  await page.evaluate(() => {void timeGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});});
  assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 0); assert.equal(await page.locator('#modal-submit').isDisabled(), true);
  assert.match(await page.locator('#modal-error').textContent(), /changed|review|reopen/i); await capture(page, result, 'idle-review-retired');
  await page.locator('#modal-cancel').click(); await closed(page); await prepare(page, scenario, before); await start(page, scenario); await successful(page, result, before, scenario); return;
 }
 if (scenario.mode === 'sync' || scenario.mode === 'reentrant') {
  await page.evaluate(mode => {timeGate.reentrant = mode === 'reentrant';}, scenario.mode);
  await page.evaluate(path => timeGate.remember(path), scenario.path);
  if (scenario.path !== 'form') {
   const immediate = await page.evaluate(path => {document.querySelector('[data-action="day-' + path + '"]').click(); return {writes: timeStorage.writes, pending: !!timeGate.pending, open: document.querySelector('#modal').open, modalError: document.querySelector('#modal-error').textContent};}, scenario.path);
   assert.deepEqual(immediate, {writes: 1, pending: false, open: false, modalError: ''}, 'Synchronous day write executes before service-await/event microtask window and adds no confirmation');
  } else await start(page, scenario);
  await frames(page); assertTime(await read(page), before, scenario);
  const snapshot = await gate(page); assert.equal(snapshot.totalCalls, 1);
  if (scenario.mode === 'reentrant') {assert.equal(snapshot.reentrantChecks.length, 2); assert.ok(snapshot.reentrantChecks.every(item => item.sameTitle && item.sameOpen)); await frames(page); assert.equal((await gate(page)).totalCalls, 1, 'No reentrant day event queued behind service await');}
  await capture(page, result, 'synchronous-one-write'); await successful(page, result, before, scenario, {fresh: true}); return;
 }
 const semantic = ['legacy', 'legacy-date', 'same-hours', 'date-only', 'rewind', 'untracked', 'rollover', 'jump', 'dirty-settings'].includes(scenario.mode);
 await page.evaluate(({mode, fault}) => {
  timeGate.armed = true; timeGate.notifyFault = mode === 'notification-before' ? 'before' : mode === 'notification-after' ? 'after' : mode === 'missing' ? 'missing' : mode === 'missing-token' ? 'missing-token' : mode === 'wrong-token' ? 'wrong-token' : null;
  timeGate.roleFault = mode === 'notification-after'; timeStorage.failNext = mode === 'prewrite';
  if (mode === 'pending-ui') timeGate.pendingUI = fault;
 }, scenario);
 if (scenario.mode === 'pending-ui') {
  await start(page, scenario); await page.waitForFunction(() => timeGate.faults.length === 1 && timeGate.store.reloadRequired && !!timeGate.pending);
  const committed = scenario.fault.endsWith('-after'), durable = await raw(page);
  if (committed) assertTime(await read(page), before, scenario); else assert.equal(durable, bytes);
  await release(page); await frames(page); assert.equal(await raw(page), durable, 'Pending-screen failure cannot abandon original Promise or permit later write');
  await terminal(page, result, before, scenario, {committed, unknown: !committed}); assert.deepEqual(result.gate.faults, [scenario.fault]); return;
 }
 await assertPending(page, result, scenario, bytes);
 if (['foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog'].includes(scenario.mode)) {await retired(page, result, before, scenario, context); return;}
 if (scenario.mode === 'prewrite') {
  await release(page); await page.locator('#modal-error').filter({hasText: 'Synthetic known time prewrite'}).waitFor();
  assert.equal(await raw(page), bytes); assert.equal((await gate(page)).reloadRequired, false); assert.equal((await gate(page)).editable, true);
  assert.equal(await page.locator('#modal-cancel').isEnabled(), true); await capture(page, result, 'known-prewrite-retryable');
  if (scenario.path !== 'form') {assert.equal(await page.locator('#modal-submit').isHidden(), true); await page.locator('#modal-cancel').click(); await closed(page); await start(page, scenario);}
  else {assert.equal(await page.locator('#modal-submit').isEnabled(), true); await start(page, scenario);}
  await page.waitForFunction(() => !!timeGate.pending); assert.equal((await gate(page)).calls, 2); await release(page); await closed(page);
  assert.equal((await gate(page)).storage.attempts, 2); assert.equal((await gate(page)).storage.writes, 1);
  // Exactly one publication despite two safe attempts.
  await successful(page, result, before, scenario); return;
 }
 if (scenario.mode === 'success' || semantic) {
  const beforeWrite = await gate(page); await page.evaluate(() => timeGate.write()); await frames(page);
  assertTime(await read(page), before, scenario); assert.equal(await raw(page), beforeWrite.candidates.at(-1));
  const snapshot = await gate(page); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Owned native publication must retain pre-click date/LSS/status until Promise settlement');
  assert.deepEqual(snapshot.semantic, snapshot.nativeWriteBaselines.at(-1).semantic, 'Immediate pre-native-write semantic baseline survives actual publication');
  assert.deepEqual(snapshot.displayDOM, snapshot.nativeWriteBaselines.at(-1).dom, 'Exact pre-native-write date/LSS counter DOM survives actual publication; unrelated SVG identity is not asserted');
  if (scenario.path === 'form') {assert.equal(snapshot.retainedFieldNodes, true); assert.equal(snapshot.frozenFields, true); assert.deepEqual(snapshot.fields, snapshot.submittedFields);}
  if (scenario.mode === 'dirty-settings') assert.deepEqual(snapshot.dirtyDraft, {connected: false, name: 'Unrelated dirty inline time draft'});
  assert.equal(snapshot.pending, true); assert.equal(snapshot.publications.at(-1).tokenMatches, true); assert.equal(snapshot.publications.at(-1).snapshotMatches, true);
  assert.equal(await page.locator('#modal').evaluate(el => el.open), true); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  if (scenario.mode === 'success') await capture(page, result, 'durable-publication-held');
  await release(page); await successful(page, result, before, scenario); return;
 }
 if (['render', 'report', 'close', 'clear-error'].includes(scenario.mode)) await page.evaluate(mode => {timeGate.cleanupFault = mode;}, scenario.mode);
 const kind = ['unknown-before', 'unknown-after', 'contradictory'].includes(scenario.mode) ? scenario.mode : 'native';
 await release(page, kind);
 await terminal(page, result, before, scenario, {committed: scenario.mode !== 'unknown-before', unknown: ['unknown-before', 'missing', 'missing-token', 'wrong-token'].includes(scenario.mode)});
 if (['render', 'report', 'close', 'clear-error'].includes(scenario.mode)) assert.deepEqual(result.gate.faults, [scenario.mode]);
 if (scenario.mode === 'notification-after') assert.equal(result.gate.roleThrows, 1);
 if (scenario.mode === 'contradictory') assert.equal(result.gate.settlements.at(-1).kind, 'contradictory');
 if (['missing-token', 'wrong-token'].includes(scenario.mode)) {const publication = result.gate.publications.find(item => item.actualCallback); assert.ok(publication); assert.equal(publication.deliveredTokenMatches, false); assert.equal(publication.deliveredTokenPresent, scenario.mode === 'wrong-token');}
}
async function writeReport() {await writeFile(join(artifacts, 'time-completion-report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, path: scenario.path, mode: scenario.mode, viewport, status: 'running', checks: [], screenshots: [], layouts: [], pageErrors: [], unhandledRejections: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], errors: []};
 report.cases.push(result); let context;
 try {
  context = await contextFor(result, scenario); const page = await context.newPage(); await runBody(page, result, scenario, context); await frames(page);
  for (const key of ['pageErrors', 'unhandledRejections', 'consoleErrors', 'networkErrors', 'unexpectedRequests']) assert.deepEqual(result[key], [], key);
  result.status = 'passed';
 } catch (error) {
  result.status = 'failed'; result.errors.push(errorText(error)); const page = context?.pages()[0];
  if (page) {await capture(page, result, 'failure').catch(() => {}); result.failedGate = await gate(page).then(safeReport).catch(() => null);}
 } finally {await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id); for (const error of result.errors) console.error(error);
}

if (process.argv.includes('--fixtures-only')) {
 for (const scenario of scenarios) {
  const before = seed(scenario); assert.equal(supportStock(fixture().ship).dailyUnits, '3.2');
  if (['start-boundary', 'max-boundary'].includes(scenario.mode)) {assert.ok(!Number.isSafeInteger(specification(before, scenario).hours) || specification(before, scenario).hours < 0); continue;}
  const next = expected(before, scenario); assertTime(next, before, scenario);
  const undone = S.undo(next); assert.deepEqual(material(undone), material(before));
  if (scenario.mode === 'jump') {assert.equal(S.jumpUndoEligibility(before).allowed, true); assert.equal(S.jumpUndoEligibility(undone).allowed, false); assert.equal(undone.jumpAttempts.at(-1).closed, true);}
 }
 const forward = expected(fixture(), {path: 'forward', mode: 'success'});
 assert.deepEqual(forward.ship.lifeSupport.stockUnits, {numerator: '1952', denominator: '15'}, '3 awake + 2 low berths consume exactly 16/5 LSS in 24 hours');
 const correction = expected(fixture(), {path: 'form', mode: 'success'});
 assert.deepEqual(correction.ship.lifeSupport.stockUnits, {numerator: '398', denominator: '3'}, 'Only five positive elapsed hours consume exactly 2/3 LSS');
 assert.equal(displayDate('365-1105', 31), '001-1106 · 07:00');
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
 const app = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/);
 assert.match(app, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 for (const name of ['createTimeWriteOwner', 'completeTimeWrite', 'awaitCampaignDay', 'finishTimeWrite']) assert.match(app, new RegExp('function ' + name + '\\('));
 assert.match(app, /saveContext:'time-save'/); assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length);
 assert.equal(screenshotOptions.caret, 'initial');
 console.log(`PASS: time fixtures, exact rational awake/low-berth stock, legacy Undo, rollover/boundaries, jump closure and version-tagged runtime wiring; ${scenarios.length} scenarios x ${sizes.length} widths = ${report.declaredCases} browser cases declared. Chromium was NOT launched.`);
} else {
 await mkdir(artifacts, {recursive: true});
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT to the exact requested test commit');
  assert.equal(report.testedCommit, report.requestedCommit, 'CI must test the exact requested commit');
  report.workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim();
  assert.equal(report.workingTree, '', 'Exact-head evidence requires a clean tracked and untracked checkout; only gitignored generated artifacts are excluded');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
  browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})});
  report.browser = {name: 'Chromium', version: browser.version()};
  for (const viewport of sizes) for (const scenario of scenarios) await runCase(scenario, viewport);
  const files = (await readdir(artifacts)).filter(name => name.startsWith('time-completion-'));
  report.screenshotCount = files.filter(name => name.endsWith('.jpg')).length;
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((a, b) => a + b, 0);
  // Include the native report under the same prefix. Reserve room for the final
  // browser report rewrite and keep the combined downloadable evidence bounded.
  assert.ok(report.artifactBytes < 24 * 1024 * 1024 - 262144, 'Combined time completion evidence must stay below 24 MiB');
 } catch (error) {report.errors.push(errorText(error));}
 finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  report.passed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'passed');
  await writeReport();
 }
 if (!report.passed) throw Error('Time completion Chromium checks failed; see verification-artifacts/time-completion-report.json');
 console.log(`PASS: ${report.declaredCases} production time/day browser cases with native locks, held completion, exact economics, reload/Undo and bounded desktop/mobile warning/recovery evidence.`);
}
