// Bounded shared-modal initial-entry containment gate, executed only in exact-head CI.
// Production app, discovered cache-tagged Store, native Web Locks and callbacks run
// unchanged. Test-owned native DOM wrappers throw at named boundaries; they never
// emulate a successful callback or patch application function bodies.
// node verification/modal-entry-browser.test.mjs [playwright-module]
// --fixtures-only checks deterministic fixtures/source wiring WITHOUT a browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {normalize} from '../js/map.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {recordWorldOverride, revertWorldField, worldFieldRevertEligibility} from '../js/world-change-history.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer', prefix = 'modal-entry-';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 72, caret: 'initial'});
const scenarios = [
 ['deposit-submit-sync', 'deposit', 'submit', 'sync'],
 ['deposit-cancel-delayed', 'deposit', 'cancel', 'delayed'],
 ['deposit-close-delayed', 'deposit', 'close', 'delayed'],
 ['time-close-sync', 'time', 'close', 'sync'],
 ['settings-cancel-delayed', 'settings', 'cancel', 'delayed'],
 ['reset-close-delayed', 'reset', 'close', 'delayed'],
 ['import-submit-sync', 'import', 'submit', 'sync'],
 ['setup-submit-delayed', 'setup', 'submit', 'delayed'],
 ['location-close-delayed', 'location', 'close', 'delayed'],
 ['jump-hours-delayed', 'jump', 'hours', 'delayed'],
 ['jump-cancel-sync', 'jump', 'cancel', 'sync'],
 ['undo-jump-close-delayed', 'undo-jump', 'close', 'delayed'],
 ['world-field-cancel-delayed', 'world-field', 'cancel', 'delayed'],
 ['generic-preview-submit', 'generic', 'submit', 'sync'],
 ['read-only-submit-inert', 'read-only', 'submit', 'readonly'],
 ['deposit-reentrant-submit', 'deposit', 'submit', 'reentrant'],
 ['time-native-close-newer-modal', 'time', 'close', 'newer'],
 ['reset-foreign-publication', 'reset', 'cancel', 'foreign'],
 ['time-editor-loss', 'time', 'submit', 'editor-loss'],
 ['time-normalization-control', 'time', 'normalization', 'sync'],
 ['reset-formdata-control', 'reset', 'formdata', 'delayed'],
 ['deposit-terminal-unknown', 'deposit', 'submit', 'unknown-before'],
 ['deposit-terminal-committed', 'deposit', 'close', 'committed'],
 ['deposit-persistent-cleanup-characterization', 'deposit', 'normalization', 'persistent'],
 ['time-persistent-cleanup-characterization', 'time', 'normalization', 'persistent']
].map(([id, kind, fault, mode]) => ({id, kind, fault, mode}));
function expectedFrames(scenario) {
 if (scenario.mode === 'readonly' || scenario.mode === 'newer') return 1;
 if (['foreign', 'editor-loss', 'persistent'].includes(scenario.mode)) return 2;
 if (scenario.kind === 'generic') return 3;
 return ['sync', 'reentrant'].includes(scenario.mode) ? 4 : 5;
}
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url), 'utf8'));
const apiWorlds = [
 {Name: 'Entry Regina', Hex: '1910', UWP: 'A788899-C', PBG: '703', Zone: '', WorldX: -110, WorldY: -70, Sector: 'Spinward Marches'},
 {Name: 'Entry Jenghe', Hex: '1810', UWP: 'C799663-9', PBG: '323', Zone: '', WorldX: -111, WorldY: -70, Sector: 'Spinward Marches'}
];
const worlds = apiWorlds.map(normalize), [origin, destination] = worlds;
const reason = 'Disposable initial-entry review';
const report = {
 suite: 'Shared modal initial-entry containment', startedAt: new Date().toISOString(),
 requestedCommit: process.env.TRAVELLER_COMMIT || null, node: process.version,
 declaredCases: scenarios.length * sizes.length, declaredScreenshots: scenarios.reduce((sum, scenario) => sum + expectedFrames(scenario), 0) * sizes.length, scenarios, cases: [], errors: [],
 limits: {durationMs: 14 * 60 * 1000, artifactBytes: 24 * 1024 * 1024, imageBytes: 20 * 1024 * 1024},
 scope: 'Representative desktop/mobile transient initial disabled-setter faults, partial synchronization and Jump hours.readOnly; pre-callback normalization/FormData controls; synchronous and deferred explicit retry; actual Store save/replace, Web Locks, deterministic map fixtures, Undo and stale ownership. No generic completion migration, arbitrary persistent-DOM recovery, live campaign or exhaustive caller-by-setter browser cross-product is claimed. Sale and exhaustive completed-caller gates remain separate required suites.'
};
let browser, imageBytes = 0;
const hash = value => createHash('sha256').update(value).digest('hex');
const errorText = error => error?.stack || String(error);
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closed = page => page.locator('#modal').waitFor({state: 'hidden'});
const action = (page, name, arg) => page.locator('[data-action="' + name + '"]' + (arg === undefined ? '' : '[data-arg="' + arg + '"]')).filter({visible: true}).first();
const tab = (page, name) => action(page, 'tab', name).click();
const gate = page => page.evaluate(() => entryGate.snapshot());
const values = page => page.locator('#modal-form [name]').evaluateAll(nodes => nodes.map(node => [node.name, node.type === 'checkbox' ? node.checked : node.value]));
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'undo', 'jumpAttempts'].includes(key)));
const replacement = scenario => scenario.kind === 'reset' ? S.initial() : imported();
function fixture() {
 const s = S.initial();
 Object.assign(s, {initialized: true, name: 'Disposable entry campaign', actual: origin.id, worlds: Object.fromEntries(worlds.map(world => [world.id, world])), route: [origin.id, destination.id], bank: '100000', hours: 24});
 Object.assign(s.ship, {name: 'Entry Trader', capacity: '100', staterooms: 2, fuel: configureFuel(200, 40, 40, 0, 2), lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}}, accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}});
 s.lots = [{id: 'entry-cargo', commodity: '11', description: 'Retained cargo and dice', quantity: '5', basis: '1000', goodsValue: '1000', priceDice: {dice: [2, 3, 4], total: 9}}];
 s.ledger = [{id: 'entry-opening', type: 'Opening bank', amount: '100000', hours: 0, world: origin.id}];
 s.dashboardBaseline = createDashboardBaseline(s);
 return S.validate(s);
}
function imported() {const s = fixture(); s.name = 'Disposable imported entry campaign'; s.bank = '200011'; s.dashboardBaseline = createDashboardBaseline(s); return S.validate(s);}
function seed(scenario) {
 if (scenario.kind === 'setup') return S.initial();
 let s = fixture();
 if (['jump', 'undo-jump'].includes(scenario.kind)) {
  const p = S.prepareJump(s, () => ({dice: [3, 3, 3, 3, 3, 3], total: 18})); s = p.state;
  if (scenario.kind === 'undo-jump') s = S.transition(s, 'Jump: ' + origin.name + ' → ' + destination.name, next => S.commitJump(next, {attemptId: p.attempt.id, elapsed: 160}));
 }
 if (scenario.kind === 'world-field') s = S.transition(s, 'World override', next => recordWorldOverride(next, origin.id, {uwp: 'A788899-D', zone: 'Amber', fuelOverride: true, accessibleWater: true, reason: 'Saved survey'}, core));
 return S.validate(s);
}

async function contextFor(result, scenario) {
 const context = await browser.newContext({viewport: result.viewport, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(errorText(error)));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
 });
 await context.exposeBinding('__entryUnhandled', (_source, message) => result.unhandledRejections.push(message));
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  // Observe only. Never preventDefault or hide a rejection from the real handler.
  addEventListener('unhandledrejection', event => {void globalThis.__entryUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  globalThis.entryStorage = {attempts: 0, writes: 0};
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(set, this, [name, value]);
   entryStorage.attempts++; const returned = Reflect.apply(set, this, [name, value]); entryStorage.writes++; return returned;
  };
  globalThis.entryDice = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {entryDice++; array[0] = 2; return array;} return random(array);};
 }, {key: KEY, bytes: JSON.stringify(seed(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 await context.route('**/*', async route => {
  try {
   const url = new URL(route.request().url());
   if (url.origin === new URL(base).origin) return route.continue();
   if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
    assert.equal(url.searchParams.get('milieu'), 'M1105');
    result.lookups.push({path: url.pathname, search: url.search});
    const headers = {'Access-Control-Allow-Origin': '*'};
    if (url.pathname.endsWith('/universe')) return route.fulfill({headers, json: {Sectors: [{Names: [{Text: 'Spinward Marches'}], Abbreviation: 'Spin', X: -4, Y: -1, Milieu: 'M1105'}]}});
    if (url.pathname.endsWith('/metadata')) return route.fulfill({headers, json: {Subsectors: Array.from({length: 16}, (_, i) => ({Index: String.fromCharCode(65 + i), Name: 'Entry subsector ' + String.fromCharCode(65 + i)}))}});
    if (url.pathname.endsWith('/sec')) return route.fulfill({headers, json: 'Hex\tName\n' + apiWorlds.map(world => world.Hex + '\t' + world.Name).join('\n')});
    if (url.pathname.endsWith('/jumpworlds')) {
     const hex = url.searchParams.get('hex'), zero = url.searchParams.get('jump') === '0';
     return route.fulfill({headers, json: {Worlds: zero ? apiWorlds.filter(world => hex ? world.Hex === hex : world.WorldX === Number(url.searchParams.get('x')) && world.WorldY === Number(url.searchParams.get('y'))) : apiWorlds}});
    }
   }
   result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
  } catch (error) {result.fixtureErrors.push(errorText(error)); await route.abort('failed').catch(() => {});}
 });
 return context;
}

async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(script => script.type === 'module' && /\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if (!appURL) throw Error('Actual app module unavailable');
  const response = await fetch(appURL); if (!response.ok) throw Error('Cannot inspect actual app import');
  const source = await response.text(), specifier = source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing');
  const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Expected production cache-tagged Store');
  const {Store, KEY} = await import(storeURL), nativeRead = Store.prototype.read;
  const g = globalThis.entryGate = {store: null, delayed: false, pending: null, args: null, calls: 0, executions: 0, publications: [], forwarded: [], faults: [], fault: null, normalization: 0, formdata: 0, effect: null, reentrant: [], persistent: false, notifyAfter: false, oldSubmit: null, oldForm: null};
  function observe(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const onChange = store.onChange;
   store.onChange = function(...args) {
    g.publications.push({revision: args[0].revision, tokenMatches: !!args[1] && (args[1].saveToken === g.args?.[2] || args[1].replacementToken === g.args?.[2])});
    const returned = Reflect.apply(onChange, this, args);
    if (g.notifyAfter) {g.notifyAfter = false; throw Error('Synthetic committed entry publication fault');}
    return returned;
   };
  }
  Store.prototype.read = function(...args) {observe(this); return Reflect.apply(nativeRead, this, args);};
  for (const method of ['save', 'replace']) {
   const native = Store.prototype[method];
   Store.prototype[method] = function(...args) {
    observe(this); g.args = args; g.calls++;
    g.forwarded.push({method, argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision});
    if (!g.delayed) {g.executions++; return Reflect.apply(native, this, args);}
    if (g.pending) throw Error('Duplicate Store entry while pending');
    return new Promise((resolve, reject) => {g.pending = {store: this, native, args, resolve, reject};});
   };
  }
  g.release = (mode = 'native') => {
   const pending = g.pending; if (!pending) throw Error('No pending native Store operation'); g.pending = null;
   if (mode === 'unknown-before') {pending.reject(Error('Synthetic unknown entry provider outcome')); return;}
   try {g.executions++; pending.resolve(Reflect.apply(pending.native, pending.store, pending.args));} catch (error) {pending.reject(error);}
  };
  const controls = () => Object.fromEntries(['modal-submit', 'modal-cancel', 'modal-close'].map(id => [id, document.getElementById(id).disabled]));
  function effect() {
   if (g.effect === 'reentrant') {
    const before = g.calls; document.querySelector('#modal-form').requestSubmit();
    void g.oldSubmit({preventDefault() {}, currentTarget: g.oldForm});
    g.reentrant.push({before, after: g.calls});
   } else if (g.effect === 'newer') {
    const dialog = document.querySelector('#modal'); dialog.close();
    // The explicit native close event synchronously retires the old owner before
    // opening another presentation. Chromium's queued close sees it open.
    dialog.dispatchEvent(new Event('close')); document.querySelector('#notes').click();
    g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent, controls: controls()};
   } else if (g.effect === 'foreign') dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: localStorage.getItem(KEY)}));
   else if (g.effect === 'editor-loss') g.store.yield();
  }
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (g.persistent && this.id === 'modal-submit' && value === false) {g.faults.push({target: 'persistent-cleanup', controls: controls()}); throw Error('Synthetic persistent cleanup setter fault');}
   if (g.fault === this.id) {
    g.fault = null; g.faults.push({target: this.id, controls: controls(), value}); effect();
    throw Error('Synthetic initial entry setter fault: ' + this.id);
   }
   return Reflect.apply(disabled.set, this, [value]);
  }});
  const readOnly = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'readOnly');
  Object.defineProperty(HTMLInputElement.prototype, 'readOnly', {...readOnly, set(value) {
   if (g.fault === 'hours' && this.name === 'hours' && this.closest('#modal-form')) {
    g.fault = null; Reflect.apply(readOnly.set, this, [value]);
    g.faults.push({target: 'hours', controls: controls(), value, appliedBeforeThrow: this.readOnly});
    throw Error('Synthetic initial entry setter fault: hours.readOnly');
   }
   return Reflect.apply(readOnly.set, this, [value]);
  }});
  const query = Element.prototype.querySelectorAll;
  Element.prototype.querySelectorAll = function(selector) {
   if (this.id === 'modal-form' && selector === '[data-round]') {
    g.normalization++;
    if (g.fault === 'normalization') {g.fault = null; g.faults.push({target: 'normalization', controls: controls()}); throw Error('Synthetic pre-callback normalization fault');}
   }
   return Reflect.apply(query, this, [selector]);
  };
  const NativeFormData = globalThis.FormData;
  globalThis.FormData = new Proxy(NativeFormData, {construct(target, args, newTarget) {
   if (args[0]?.id === 'modal-form') {
    g.formdata++;
    if (g.fault === 'formdata') {g.fault = null; g.faults.push({target: 'formdata', controls: controls()}); throw Error('Synthetic pre-callback FormData fault');}
   }
   return Reflect.construct(target, args, newTarget);
  }});
  g.snapshot = () => ({calls: g.calls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...entryStorage}, dice: entryDice, normalization: g.normalization, formdata: g.formdata, forwarded: g.forwarded, publications: g.publications, faults: g.faults, reentrant: g.reentrant, controls: controls(), newer: g.newer || null, durableToken: /"(?:saveToken|replacementToken)"\s*:/.test(localStorage.getItem(KEY))});
  // Observe the existing Store before any review, without manufacturing a save.
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: localStorage.getItem(KEY)}));
  return {appURL, storeURL};
 });
 assert.ok(await page.evaluate(async lock => (await navigator.locks.query()).held.some(entry => entry.name === lock), LOCK), 'Actual native writer lock is held');
}

async function fill(page, name, value) {const input = page.locator('#modal [name="' + name + '"]'); await input.fill(String(value)); await input.dispatchEvent('change');}
async function openReview(page, scenario, before) {
 const kind = scenario.kind;
 if (['deposit', 'generic'].includes(kind)) {
  await tab(page, 'Accounts'); await action(page, 'deposit').click();
  await fill(page, 'amount', '10.1'); await fill(page, 'reason', reason);
  if (kind === 'deposit') {await page.locator('#modal-submit').click(); await page.locator('#modal-title').filter({hasText: 'Confirm deposit'}).waitFor(); assert.match(await page.locator('#modal-submit').textContent(), /11/);}
 } else if (['time', 'settings', 'reset', 'import'].includes(kind)) {
  await tab(page, 'Settings');
  if (kind === 'import') {
   const chooser = page.waitForEvent('filechooser'); await action(page, 'import').click();
   await (await chooser).setFiles({name: 'synthetic-entry-import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported()))});
  } else await action(page, kind === 'settings' ? 'settings-edit' : kind).click();
  if (kind === 'time') {await fill(page, 'hours', before.hours + 5); await fill(page, 'reason', reason);}
  if (kind === 'settings') await fill(page, 'name', 'Retained entry settings draft');
  if (['reset', 'import'].includes(kind)) await page.locator('#modal [name="backed"]').check();
 } else if (kind === 'setup') {
  await action(page, 'setup').click(); await page.locator('#setup-world .picker-selection').filter({hasText: 'Hex 1910'}).waitFor();
  for (const [name, value] of Object.entries({name: 'Retained entry setup', ship: 'Entry Trader', bank: '100000.1', capacity: '100.1', jump: '2', date: '001-1105'})) await fill(page, name, value);
 } else if (kind === 'location') {
  await action(page, 'find').click(); const picker = page.locator('#find-world');
  await picker.locator('.picker-selection').filter({hasText: /Hex \d{4}/}).waitFor();
  await picker.getByLabel('Sector', {exact: true}).selectOption('Spinward Marches');
  await picker.getByLabel('Subsector', {exact: true}).selectOption('C');
  await picker.getByLabel('World', {exact: true}).selectOption('1810');
  await picker.locator('.picker-selection').filter({hasText: 'Hex 1810'}).waitFor();
  await page.locator('#choose-starting-world').click(); await page.locator('#modal-title').filter({hasText: 'Set ship location'}).waitFor(); await fill(page, 'reason', reason);
 } else if (kind === 'jump') {
  await action(page, 'jump').click(); await page.locator('#modal-title').filter({hasText: /^Commit jump/}).waitFor(); await fill(page, 'hours', '160');
 } else if (kind === 'undo-jump') {await action(page, 'jump-undo').click(); await page.locator('#modal-title').filter({hasText: 'Undo Jump'}).waitFor();}
 else if (kind === 'world-field') {
  const event = before.events.find(entry => entry.worldChangeAudit);
  await tab(page, 'History'); await action(page, 'history-filter', 'World Changes').click();
  await action(page, 'event-audit', event.id).click(); await action(page, 'world-field-revert', event.id + '|techLevel').click();
  await page.locator('#modal-title').filter({hasText: 'Restore previous tech level'}).waitFor();
 } else if (kind === 'read-only') await page.locator('#notes').click();
 await page.locator('#modal').waitFor({state: 'visible'});
 await page.waitForLoadState('networkidle'); await frames(page);
 await page.evaluate(() => {entryGate.oldForm = document.querySelector('#modal-form'); entryGate.oldSubmit = entryGate.oldForm.onsubmit;});
}

async function capture(page, result, label, selector) {
 const target = page.locator(selector).filter({visible: true}).first();
 await target.scrollIntoViewIfNeeded(); await frames(page);
 const rect = await target.evaluate(node => {
  const r = node.getBoundingClientRect(), dialog = node.closest('dialog'), d = dialog?.getBoundingClientRect();
  return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: d ? {left: d.left, right: d.right, top: d.top, bottom: d.bottom, overflow: dialog.scrollWidth - dialog.clientWidth} : null};
 });
 assert.ok(rect.width > 0 && rect.height > 0 && rect.top >= -1 && rect.bottom <= rect.viewportHeight + 1 && rect.left >= -1 && rect.right <= rect.viewportWidth + 1, label + ' detail is actually in the viewport');
 assert.ok(rect.pageOverflow <= 2, 'No horizontal page overflow');
 if (rect.dialog) {assert.ok(rect.dialog.left >= -1 && rect.dialog.right <= rect.viewportWidth + 1 && rect.dialog.overflow <= 2, 'Dialog has no horizontal clipping'); assert.ok(rect.top >= rect.dialog.top - 1 && rect.bottom <= rect.dialog.bottom + 1, 'Detail is inside visible dialog');}
 const bytes = await page.screenshot(screenshotOptions);
 assert.ok(imageBytes + bytes.length < report.limits.imageBytes, 'JPEG evidence leaves 4 MiB for the JSON report');
 const name = prefix + result.id + '-' + label + '.jpg'; await writeFile(join(artifacts, name), bytes); imageBytes += bytes.length;
 result.screenshots.push({name, label, selector, bytes: bytes.length, sha256: hash(bytes), geometry: rect});
}
async function pointer(page, selector) {
 const button = page.locator(selector); if (!await button.isVisible()) return;
 await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount: 2, delay: 20});
}
async function replay(page) {
 await page.locator('#modal-form').evaluate(form => form.requestSubmit());
 await page.evaluate(() => {void entryGate.oldSubmit({preventDefault() {}, currentTarget: entryGate.oldForm});});
 await frames(page);
}
function assertNoWrite(snapshot, baseline) {
 for (const key of ['calls', 'executions', 'dice']) assert.equal(snapshot[key], baseline[key], 'Initial failure cannot advance ' + key);
 assert.deepEqual(snapshot.storage, baseline.storage, 'No native storage attempt or write');
 assert.equal(snapshot.pending, false); assert.equal(snapshot.durableToken, false);
}
async function recoverable(page, result, scenario, before, baseline, review) {
 const snapshot = await gate(page); assertNoWrite(snapshot, baseline);
 assert.equal(await raw(page), review.bytes, 'Exact durable bytes and all saved history are unchanged');
 assert.equal(snapshot.reloadRequired, false, 'A pre-callback failure is not an unknown provider outcome');
 assert.equal(snapshot.editable, true);
 assert.match(await page.locator('#modal-error').textContent(), /Synthetic (initial entry setter|pre-callback)/);
 assert.doesNotMatch(await page.locator('#modal-error').textContent(), /outcome could not|saved, but|Reload/);
 assert.equal(await page.locator('#modal-title').textContent(), review.title);
 assert.equal(await page.locator('#message').textContent(), review.message, 'No premature success message');
 for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isEnabled(), true, id + ' is usable after transient fault');
 if (!['normalization', 'formdata'].includes(scenario.fault)) {
  assert.equal(snapshot.normalization, baseline.normalization, 'Initial sync fails before normalization');
  assert.equal(snapshot.formdata, baseline.formdata, 'Initial sync fails before FormData and callback entry');
  assert.deepEqual(await values(page), review.fields, 'Retained field values and checkboxes');
  assert.equal(await page.locator('#modal-body').innerHTML(), review.body, 'Retained review and rounding markup');
  assert.equal(result.lookups.length, review.lookups, 'No new picker resolution or nearby request before callback');
 } else {
  assert.equal(snapshot.normalization, baseline.normalization + 1);
  assert.equal(snapshot.formdata, baseline.formdata + (scenario.fault === 'formdata' ? 1 : 0));
 }
 if (scenario.fault === 'cancel') assert.equal(snapshot.faults[0].controls['modal-submit'], true, 'Cancel fault occurs after submit was disabled');
 if (scenario.fault === 'close' && !['time', 'location'].includes(scenario.kind)) assert.equal(snapshot.faults[0].controls['modal-cancel'], true, 'X fault occurs after earlier controls were disabled');
 if (scenario.kind === 'jump') {assert.equal(await page.locator('#modal [name="hours"]').isEditable(), true); assert.equal(await page.locator('#modal [name="hours"]').inputValue(), '160'); assert.deepEqual((await read(page)).jumpAttempts, before.jumpAttempts);}
 if (scenario.fault === 'hours') assert.equal(snapshot.faults[0].appliedBeforeThrow, true, 'Native readOnly setter completed before the one-shot throw');
 if (scenario.mode === 'reentrant') assert.deepEqual(snapshot.reentrant, [{before: baseline.calls, after: baseline.calls}], 'Busy guard blocks nested real and detached submission');
 result.initialFailure = snapshot;
 await capture(page, result, 'retained-error', '#modal-error');
 await capture(page, result, 'retry-controls', '#modal-submit');
 result.checks.push('Actual entry fault is contained before callback; controls recover and original review remains');
}

function assertSaved(saved, before, scenario) {
 assert.equal(saved.revision, before.revision + 1, 'Exactly one intended durable revision');
 const kind = scenario.kind;
 if (['reset', 'import'].includes(kind)) {
  const expected = replacement(scenario); expected.revision = before.revision + 1;
  assert.deepEqual(saved, expected, 'Replacement is exactly the reviewed candidate'); return;
 }
 if (kind === 'undo-jump') {
  const expected = S.undoJump(before); expected.events.at(-1).id = saved.events.at(-1).id;
  assert.deepEqual(saved, expected, 'Exactly one protected jump inverse and one consumed mulligan'); return;
 }
 assert.equal(saved.undo.length, before.undo.length + 1);
 if (kind === 'deposit') {
  assert.equal(saved.bank, String(BigInt(before.bank) + 11n)); assert.equal(saved.ledger.length, before.ledger.length + 1);
  assert.equal(saved.ledger.at(-1).amount, '11'); assert.equal(saved.ledger.at(-1).reason, reason);
  assert.equal(saved.events.filter(entry => entry.label === 'Manual deposit').length, before.events.filter(entry => entry.label === 'Manual deposit').length + 1);
  for (const key of ['ship', 'lots', 'contracts', 'policies', 'snapshots', 'actual', 'route', 'hours', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key]);
  const rounding = saved.events.filter(entry => entry.label === 'Rounding applied [R]').at(-1);
  assert.ok(rounding?.roundingChanges.some(change => change.before === '10.1' && change.after === '11'), 'Original deposit rounding audit retained on retry');
 } else if (kind === 'time') {
  const expected = S.transition(before, 'Time correction: ' + reason, next => {next.hours += 5;});
  expected.events.at(-1).id = saved.events.at(-1).id; expected.undo.at(-1).id = saved.undo.at(-1).id;
  assert.deepEqual(saved, expected, 'Exact Campaign time transition including physical life support');
 } else if (kind === 'settings') {
  assert.equal(saved.name, 'Retained entry settings draft');
  for (const key of ['bank', 'lots', 'contracts', 'policies', 'snapshots', 'ledger', 'hours', 'actual', 'route', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key]);
  assert.equal(saved.events.filter(entry => entry.label === 'Ship / trader settings').length, 1);
 } else if (kind === 'setup') {
  assert.equal(saved.initialized, true); assert.equal(saved.name, 'Retained entry setup'); assert.equal(saved.bank, '100001'); assert.equal(saved.ship.capacity, '101'); assert.equal(saved.actual, origin.id);
  assert.deepEqual(saved.route, [origin.id]); assert.equal(saved.ledger.length, 1); assert.equal(saved.ledger[0].amount, '100001');
  assert.equal(saved.events.filter(entry => entry.label === 'Campaign setup').length, 1); assert.deepEqual(saved.dashboardBaseline, createDashboardBaseline(saved, 'opening'));
 } else if (kind === 'location') {
  assert.equal(saved.actual, destination.id); assert.deepEqual(saved.route, [destination.id]); assert.equal(saved.routeIndex, 0);
  for (const key of ['bank', 'hours', 'ship', 'lots', 'contracts', 'policies', 'snapshots', 'ledger', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key]);
  const correction = saved.events.filter(entry => entry.label === 'Starting-world / location correction'); assert.equal(correction.length, 1); assert.equal(correction[0].reason, reason);
 } else if (kind === 'jump') {
  assert.equal(saved.actual, destination.id); assert.equal(saved.hours, before.hours + 160); assert.equal(saved.ship.fuel.aboardTons, 20); assert.equal(saved.bank, before.bank);
  assert.deepEqual(saved.lots, before.lots); assert.deepEqual(saved.jumpAttempts, before.jumpAttempts); assert.equal(saved.ledger.length, before.ledger.length + 1);
  const audit = saved.events.filter(entry => entry.label === 'Jump audit'); assert.equal(audit.length, 1); assert.equal(audit[0].effectiveHours, 160); assert.deepEqual(audit[0].dice, before.jumpAttempts.at(-1).rolls.at(-1));
 } else if (kind === 'world-field') {
  const source = before.events.find(entry => entry.worldChangeAudit);
  const expected = S.transition(before, 'World field reverted', next => revertWorldField(next, source.id, 'techLevel', core));
  assert.deepEqual(material(saved), material(expected)); assert.equal(saved.events.filter(entry => entry.worldChangeAudit?.kind === 'revert').length, 1);
  assert.equal(saved.events.findLast(entry => entry.worldChangeAudit)?.worldChangeAudit.field, 'techLevel');
 }
}
async function undoAndReload(page, result, scenario, before) {
 const durable = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor();
 assert.equal(await raw(page), durable, 'Reload cannot duplicate the successful retry');
 if (!['reset', 'import', 'undo-jump'].includes(scenario.kind)) {
  if (scenario.kind === 'jump') {await action(page, 'jump-undo').click(); await page.locator('#modal-submit').click(); await closed(page);}
  else {await tab(page, 'History'); await action(page, 'undo').click();}
  await frames(page); const restored = await read(page);
  const expected = scenario.kind === 'jump' ? S.undoJump(JSON.parse(durable)) : S.undo(JSON.parse(durable)); expected.events.at(-1).id = restored.events.at(-1).id;
  assert.deepEqual(restored, expected, 'Actual Undo is exactly the existing inverse, including its preserved opening baseline');
  assert.equal(restored.revision, before.revision + 2);
  if (scenario.kind === 'setup') {
   assert.equal(restored.initialized, false); assert.equal(restored.bank, before.bank); assert.deepEqual(restored.ledger, before.ledger);
   assert.deepEqual(restored.dashboardBaseline, JSON.parse(durable).dashboardBaseline, 'Setup Undo retains the established Dashboard boundary');
  } else assert.deepEqual(material(restored), material(before), 'Actual Undo restores all original economic and campaign fields');
  if (scenario.kind === 'jump') assert.equal(restored.jumpAttempts.at(-1).mulliganUsed, true);
  else assert.deepEqual(restored.undo, before.undo);
  await capture(page, result, 'undo-restored', '#message');
 } else {assertSaved(await read(page), before, scenario); await capture(page, result, 'authoritative-reload', '#save-status');}
 result.checks.push('Reload confirms one durable result; eligible real History/Jump Undo restores original campaign');
}
async function terminal(page, result, scenario, before, baseline) {
 await page.waitForFunction(() => /Reload/.test(document.querySelector('#modal-error').textContent)); await frames(page);
 const pattern = scenario.mode === 'committed' ? /Deposit saved[\s\S]*Reload[\s\S]*do not record/i : /outcome could not be confirmed[\s\S]*Reload[\s\S]*History/i;
 for (const selector of ['#modal-error', '#message', '#save-status']) assert.match(await page.locator(selector).textContent(), pattern);
 const snapshot = await gate(page); assert.equal(snapshot.reloadRequired, true); assert.equal(snapshot.editable, false); assert.equal(snapshot.calls, baseline.calls + 1);
 assert.equal(await page.locator('#modal-submit').isDisabled(), true); assert.equal(await page.locator('#takeover').isDisabled(), true);
 if (scenario.mode === 'committed') assertSaved(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 const bytes = await raw(page); await pointer(page, '#modal-submit'); await page.keyboard.press('Enter'); await replay(page);
 assert.equal((await gate(page)).calls, snapshot.calls); assert.equal(await raw(page), bytes);
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true);
 await page.evaluate(() => entryGate.store.yield());
 assert.match(await page.locator('#save-status').textContent(), pattern); assert.equal(await page.locator('#takeover').isVisible(), false);
 await capture(page, result, 'terminal-warning', '#modal-error'); await capture(page, result, 'terminal-controls', '#modal-submit');
 await page.locator('#modal-cancel').click(); await closed(page); assert.equal(await page.locator('[data-mutate]:enabled').count(), 0);
 result.checks.push('Existing committed/unknown terminal guards remain reload-only and release the native writer lock');
}

async function runBody(page, result, scenario) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor();
 await page.waitForLoadState('networkidle'); await installGate(page, result);
 const before = await read(page); await openReview(page, scenario, before);
 const review = {bytes: await raw(page), title: await page.locator('#modal-title').textContent(), body: await page.locator('#modal-body').innerHTML(), fields: await values(page), message: await page.locator('#message').textContent(), lookups: result.lookups.length};
 const baseline = await gate(page); result.baseline = {revision: before.revision, sha256: hash(review.bytes), title: review.title, fields: review.fields, gate: baseline, lookups: review.lookups};
 await page.evaluate(({fault, mode}) => {entryGate.fault = ['submit', 'cancel', 'close'].includes(fault) ? 'modal-' + fault : fault; entryGate.effect = mode; entryGate.persistent = mode === 'persistent';}, scenario);
 if (scenario.mode === 'readonly') {
  await replay(page); const snapshot = await gate(page); assertNoWrite(snapshot, baseline); assert.equal(snapshot.faults.length, 0, 'Read-only modal has no submission callback or entry synchronization');
  assert.equal(await page.locator('#modal-submit').isHidden(), true); assert.equal(await page.locator('#modal-body').innerHTML(), review.body);
  await page.evaluate(() => entryGate.fault = null); await capture(page, result, 'read-only-close', '#modal-cancel');
  await page.keyboard.press('Escape'); await closed(page); assert.equal(await raw(page), review.bytes); return;
 }
 if (scenario.mode === 'persistent') {
  // Existing cleanup rejections are collected directly and characterized, never
  // globally swallowed or counted as recovered transient entry faults.
  const rejection = await page.evaluate(async () => {try {await entryGate.oldSubmit({preventDefault() {}, currentTarget: entryGate.oldForm}); return null;} catch (error) {return error.message;}});
  await frames(page); const snapshot = await gate(page); assertNoWrite(snapshot, baseline); assert.equal(await raw(page), review.bytes);
  if (scenario.kind === 'deposit') {assert.match(rejection, /persistent cleanup setter/); assert.equal(snapshot.reloadRequired, false); for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true);}
  else {assert.equal(rejection, null); assert.equal(snapshot.reloadRequired, true); assert.equal(snapshot.editable, false); assert.match(await page.locator('#modal-error').textContent(), /outcome could not be confirmed/);}
  result.characterization = {rejection, gate: snapshot, limitation: 'Existing persistent cleanup fault: not repaired or certified retryable by this change.'};
  await capture(page, result, 'persistent-cleanup-warning', '#modal-error'); await capture(page, result, 'persistent-cleanup-controls', '#modal-submit');
  await page.evaluate(() => entryGate.persistent = false); await page.keyboard.press('Escape'); await closed(page);
  assert.equal(await raw(page), review.bytes, 'Busy was cleared even though persistent cleanup left visible controls disabled'); return;
 }
 await page.locator('#modal-submit').click(); await frames(page);
 if (['newer', 'foreign', 'editor-loss'].includes(scenario.mode)) {
  const snapshot = await gate(page); assertNoWrite(snapshot, baseline); assert.equal(await raw(page), review.bytes);
  assert.equal(snapshot.normalization, baseline.normalization); assert.equal(snapshot.formdata, baseline.formdata);
  if (scenario.mode === 'newer') {
   assert.equal(snapshot.newer.title, 'Rules & Notes');
   assert.equal(await page.locator('#modal-title').textContent(), snapshot.newer.title); assert.equal(await page.locator('#modal-body').innerHTML(), snapshot.newer.body);
   assert.equal(await page.locator('#modal-error').textContent(), ''); assert.deepEqual(snapshot.controls, snapshot.newer.controls);
   await replay(page); assert.equal(await page.locator('#modal-body').innerHTML(), snapshot.newer.body); await capture(page, result, 'newer-dialog-preserved', '#modal-cancel');
  } else {
   assert.equal(await page.locator('#modal-submit').isDisabled(), true); await replay(page); assertNoWrite(await gate(page), baseline);
   await capture(page, result, 'retired-error', '#modal-error'); await capture(page, result, 'retired-controls', '#modal-submit');
   if (scenario.mode === 'editor-loss') {await page.evaluate(() => entryGate.store.acquire(true)); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await replay(page); assertNoWrite(await gate(page), baseline); assert.equal(await page.locator('#modal-submit').isDisabled(), true, 'Reacquisition cannot revive the retired review');}
  }
  assert.equal(await raw(page), review.bytes); assert.equal((await gate(page)).calls, baseline.calls);
  await page.locator('#modal-cancel').click(); await closed(page); result.checks.push('Detached/foreign/editor-retired handler remains inert and cannot alter newer presentation'); return;
 }
 await recoverable(page, result, scenario, before, baseline, review);
 if (scenario.kind === 'generic') {
  await page.locator('#modal-submit').click(); await page.locator('#modal-title').filter({hasText: 'Confirm deposit'}).waitFor();
  assert.equal((await gate(page)).calls, baseline.calls); assert.equal(await raw(page), review.bytes); assert.match(await page.locator('#modal-submit').textContent(), /11/);
  await capture(page, result, 'generic-preview-retained', '#modal-submit'); await page.locator('#modal-cancel').click(); await closed(page); return;
 }
 const delayed = !['sync', 'reentrant'].includes(scenario.mode);
 await page.evaluate(delayed => {entryGate.delayed = delayed; entryGate.effect = null;}, delayed);
 await page.locator('#modal-submit').click();
 if (delayed) {
  await page.waitForFunction(() => !!entryGate.pending); await frames(page);
  assert.equal(await raw(page), review.bytes); assert.equal((await gate(page)).calls, baseline.calls + 1);
  for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true, 'Pending save guards ' + id);
  if (scenario.kind === 'jump') {assert.equal(await page.locator('#modal [name="hours"]').isEditable(), false); assert.equal(await page.locator('#modal [name="hours"]').inputValue(), '160');}
  await pointer(page, '#modal-submit'); await page.keyboard.press('Enter'); await replay(page);
  for (const id of ['modal-cancel', 'modal-close']) await pointer(page, '#' + id);
  await page.keyboard.press('Escape'); await frames(page); assert.equal(await page.locator('#modal').evaluate(dialog => dialog.open), true); assert.equal((await gate(page)).calls, baseline.calls + 1); assert.equal(await raw(page), review.bytes);
  await capture(page, result, 'one-retry-pending', '#modal-submit');
  await page.evaluate(mode => {entryGate.notifyAfter = mode === 'committed'; entryGate.release(mode === 'unknown-before' ? mode : 'native');}, scenario.mode);
 }
 if (['unknown-before', 'committed'].includes(scenario.mode)) {await terminal(page, result, scenario, before, baseline); result.gate = await gate(page); return;}
 await closed(page); await frames(page); const saved = await read(page), snapshot = await gate(page);
 assertSaved(saved, before, scenario); assert.equal(snapshot.calls, baseline.calls + 1); assert.equal(snapshot.executions, baseline.executions + 1); assert.equal(snapshot.storage.writes, baseline.storage.writes + 1);
 assert.equal(snapshot.dice, baseline.dice, 'Retry reuses recorded dice, never rerolls'); assert.equal(snapshot.durableToken, false); assert.equal(snapshot.forwarded.at(-1).argumentCount, 3); assert.equal(snapshot.forwarded.at(-1).tokenPresent, true);
 assert.equal(snapshot.reloadRequired, false); assert.match(await page.locator('#message').textContent(), /saved|undone|Campaign replaced/i);
 await capture(page, result, 'retry-success', '#message'); result.gate = snapshot;
 await undoAndReload(page, result, scenario, before);
}

async function writeReport() {await writeFile(join(artifacts, prefix + 'report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, ...scenario, viewport, status: 'running', checks: [], screenshots: [], lookups: [], pageErrors: [], unhandledRejections: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], fixtureErrors: [], errors: []};
 // Keep the viewport in the artifact identity even though scenario includes id.
 result.id = scenario.id + '-' + viewport.width; report.cases.push(result); let context;
 try {
  context = await contextFor(result, scenario); const page = await context.newPage(); await runBody(page, result, scenario); await frames(page);
  for (const key of ['pageErrors', 'unhandledRejections', 'consoleErrors', 'networkErrors', 'unexpectedRequests', 'fixtureErrors']) assert.deepEqual(result[key], [], key);
  assert.equal(result.screenshots.length, expectedFrames(scenario), 'Every declared error, control and success detail frame is present');
  result.status = 'passed';
 } catch (error) {
  result.status = 'failed'; result.errors.push(errorText(error)); const page = context?.pages()[0];
  if (page) {
   const name = prefix + result.id + '-failure.jpg';
   await page.screenshot({path: join(artifacts, name), ...screenshotOptions}).then(() => result.screenshots.push({name, label: 'failure'})).catch(() => {});
   result.failedGate = await gate(page).catch(() => null);
  }
 } finally {await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id); for (const error of result.errors) console.error(error);
}

const source = async name => readFile(new URL('../js/' + name + '.mjs', import.meta.url), 'utf8');
report.sourceHashes = {app: hash(await source('app')), store: hash(await source('persistence')), state: hash(await source('state')), controller: hash(await source('campaign-controller')), browserGate: hash(await readFile(fileURLToPath(import.meta.url), 'utf8'))};
if (process.argv.includes('--fixtures-only')) {
 for (const scenario of scenarios) {
  const before = seed(scenario); S.validate(structuredClone(before));
  if (scenario.kind === 'jump') {const next = S.transition(before, 'Jump: ' + origin.name + ' → ' + destination.name, s => S.commitJump(s, {attemptId: before.jumpAttempts.at(-1).id, elapsed: 160})); assertSaved(next, before, scenario); assert.deepEqual(material(S.undoJump(next)), material(before));}
  if (scenario.kind === 'undo-jump') assertSaved(S.undoJump(before), before, scenario);
  if (scenario.kind === 'time') assertSaved(S.transition(before, 'Time correction: ' + reason, next => {next.hours += 5;}), before, scenario);
  if (scenario.kind === 'world-field') {const event = before.events.find(entry => entry.worldChangeAudit); assert.equal(worldFieldRevertEligibility(before, event.id, 'techLevel', core).allowed, true); assertSaved(S.transition(before, 'World field reverted', next => revertWorldField(next, event.id, 'techLevel', core)), before, scenario);}
  if (['reset', 'import'].includes(scenario.kind)) {const next = replacement(scenario); next.revision = before.revision + 1; assertSaved(next, before, scenario);}
 }
 assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length); assert.equal(screenshotOptions.caret, 'initial');
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), app = await source('app');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/);
 assert.match(app, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 assert.match(app, /if\(session\.saleOwner\)\{try\{syncModalSubmit\(\);\}catch\(error\)\{return saleWriteFailure\(session\.saleOwner,new SaveNotCommittedError\(error\)\);\}\}\s*let submitted=false;\s*try\{\s*if\(!session\.saleOwner\)syncModalSubmit\(\);\s*normaliseFields/);
 assert.match(app, /finally\{if\(activeModal===session\)\{session\.busy=false/);
 console.log(`PASS: deterministic campaign, recorded jump/Undo, time, world-field and replacement oracles; actual version-tagged Store wiring and narrow non-sale try boundary; ${scenarios.length} scenarios × ${sizes.length} widths = ${report.declaredCases} declared browser cases, ${report.declaredScreenshots} JPEG detail frames, caret=initial, <24 MiB / <14 minutes. Chromium was NOT launched.`);
} else {
 await mkdir(artifacts, {recursive: true}); const began = Date.now();
 const deadline = setTimeout(() => {report.errors.push('Modal entry gate exceeded 14-minute bound'); void browser?.close();}, report.limits.durationMs); deadline.unref();
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'TRAVELLER_COMMIT must identify the exact requested head'); assert.equal(report.testedCommit, report.requestedCommit);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim(), '', 'Exact-head Chromium gate requires a clean checkout');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
  browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})}); report.browser = {name: 'Chromium', version: browser.version()};
  for (const viewport of sizes) for (const scenario of scenarios) {assert.ok(Date.now() - began < report.limits.durationMs, 'Bounded duration'); await runCase(scenario, viewport);}
  const files = (await readdir(artifacts)).filter(name => name.startsWith(prefix)); report.screenshotCount = files.filter(name => name.endsWith('.jpg')).length;
  assert.equal(report.screenshotCount, report.declaredScreenshots);
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((sum, bytes) => sum + bytes, 0);
  assert.ok(report.artifactBytes < report.limits.artifactBytes - 262144, 'Complete evidence stays below 24 MiB including final report growth');
 } catch (error) {report.errors.push(errorText(error));}
 finally {clearTimeout(deadline); await browser?.close(); report.durationMs = Date.now() - began; report.finishedAt = new Date().toISOString(); report.passed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'passed'); await writeReport();}
 if (!report.passed) throw Error('Shared modal entry Chromium gate failed; inspect verification-artifacts/modal-entry-report.json');
 console.log(`PASS: ${report.declaredCases} representative actual-DOM modal entry cases, native Store/Web Locks, explicit retry and bounded desktop/mobile detail evidence.`);
}
