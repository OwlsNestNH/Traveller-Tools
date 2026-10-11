// Bounded Stage 2 SALE COMMIT gate. Production app/controller/rules/Store run
// unchanged with the discovered version-tagged Store and native Web Locks.
// Test-owned wrappers hold provider invocation separately from completion and
// inject named one-shot DOM/publication faults; no app function is substituted.
// Synthetic campaigns and deterministic Map responses only. Run in exact-head CI:
// node verification/sale-completion-browser.test.mjs [playwright-module]
// --fixtures-only checks oracle/wiring WITHOUT launching Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url), 'utf8'));
const mp = JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json', import.meta.url), 'utf8'));
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const dual = new Set(['success', 'prewrite', 'validation', 'queued-pending', 'queued-settled', 'unknown-before', 'contradictory', 'foreign-same', 'new-dialog', 'render', 'clear-error', 'controls', 'huge-credits']);
const modes = ['success', 'prewrite', 'validation', 'queued-pending', 'queued-settled', 'reentrant', 'unknown-before', 'unknown-after', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token', 'wrong-revision', 'foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog', 'render', 'selection', 'report', 'close', 'clear-error', 'controls', 'huge-credits'];
const scenarios = modes.map(mode => ({id: mode, mode}));
const cases = scenarios.flatMap(scenario => sizes.filter(size => size.width === 1440 || dual.has(scenario.mode)).map(viewport => ({scenario, viewport})));
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 65, caret: 'initial'});
const successPattern = /Sale to Synthetic buyer saved\./;
const reason = 'Synthetic manual sale values';
const report = {suite: 'Sale commit save completion', startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null, node: process.version, declaredCases: cases.length, cases: [], errors: [], scope: 'Actual production sale DOM callbacks, version-tagged Store, native Web Locks and deterministic Map fixtures. Deferred native write versus completion, exact economics, stale/foreign/editor ownership, no-reroll retry, DOM faults, reload/History Undo, bounded desktop/mobile screenshots. SALE COMMIT only; no Stage 3 preview redesign, live campaign or deployment.'};
let browser;
const errorText = error => error?.stack || String(error);
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const tab = (page, name) => page.locator('#tabs [data-action="tab"][data-arg="' + name + '"]').click();
const action = (page, name) => page.locator('[data-action="' + name + '"]').filter({visible: true}).first();
const closed = page => page.locator('#modal').waitFor({state: 'hidden'});
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const gate = page => page.evaluate(() => saleGate.snapshot());
const release = (page, kind = 'native') => page.evaluate(kind => saleGate.release(kind), kind);
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'jumpAttempts'].includes(key)));
const hash = value => createHash('sha256').update(value).digest('hex');
// Normalize only generated UUIDs, including references in actual inverse data.
// Lot/policy IDs and every economic/audit value remain exact.
function uuidNormal(value) {
 const ids = new Map();
 return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, id => {if (!ids.has(id)) ids.set(id, 'generated-' + ids.size); return ids.get(id);}));
}
function fixture(scenario = {mode: 'success'}) {
 const s = S.initial();
 const origin = {id: '1,1', x: 1, y: 1, name: 'Sale Origin', sector: 'Synthetic', hex: '0202', uwp: 'A788879-C', zone: 'Safe'};
 const destination = {...origin, id: '2,1', x: 2, name: 'Sale Destination', hex: '0302'};
 Object.assign(s, {initialized: true, name: 'Disposable sale completion campaign', actual: origin.id, worlds: {[origin.id]: origin, [destination.id]: destination}, route: [origin.id, destination.id], bank: '9007199254740993123', hours: 31});
 Object.assign(s.ship, {name: 'Sale Trader', capacity: '100', staterooms: 2, fuel: configureFuel(200, 40, 40, 0, 2), lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}}, accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}});
 Object.assign(s.settings, {profit: 75, tax: scenario.mode !== 'queued-settled', insurance: true, creditStep: scenario.mode === 'prewrite' ? 100 : 1});
 s.lots = [
  {id: 'sale-partial', commodity: '11', description: 'Partial electronics', quantity: '5', basis: '10007', goodsValue: '9001'},
  {id: 'sale-full', commodity: '12', description: 'Full machine parts', quantity: '3', basis: '7777', goodsValue: '7001'},
  {id: 'sale-fraction', commodity: '15', description: 'Exact fractional remainder', quantity: '1.25', basis: '1234', goodsValue: '1201'}
 ];
 s.contracts = [{id: 'sale-mail', kind: 'mail', status: 'accepted', firstDeparture: null, origin: origin.id, destination: destination.id, quantity: '5', payment: '1000', dueHours: null}];
 s.policies = s.lots.map(lot => ({id: 'policy-' + lot.id, lotId: lot.id, claims: [], status: 'active', initialQuantity: lot.quantity, remainingQuantity: lot.quantity, insuredValue: lot.goodsValue, remainingValue: lot.goodsValue, coverage: 70, route: [origin.id, destination.id], routeProgress: 0, destination: destination.id}));
 s.snapshots = [{id: 'sale-buyer', kind: 'buyer', worldId: origin.id, world: R.context(origin, core), party: 'synthetic|buyer', partyName: 'Synthetic buyer', hours: s.hours, startedHours: s.hours, criminal: scenario.mode === 'prewrite', success: true, options: {side: 'sell', skill: 12, counterparty: 1, creditStep: s.settings.creditStep}, offers: []}];
 s.ledger = [{id: 'sale-opening', type: 'Opening bank', amount: s.bank, hours: 0, world: origin.id}];
 s.dashboardBaseline = createDashboardBaseline(s); return S.validate(s);
}
function specification(before, scenario) {
 const buyer = before.snapshots[0], world = R.context(before.worlds[before.actual], core);
 const fields = {};
 const rounding = [], lines = before.lots.map(lot => {
  const good = core.commodities.find(g => g.id === lot.commodity);
  const priceOptions = {...R.priceLimits(before.settings), maxBaseRetailEnabled: false, maxBaseRetail: before.settings.maxBaseRetail, useRawIllegalPrices: false, illegalGood: false};
  const options = {...buyer.options, creditStep: before.settings.creditStep, side: 'sell', ...priceOptions};
  const original = R.quote(good, world, options, core, () => 3);
  const ban = scenario.mode === 'prewrite' ? 0 : null;
  const priced = ban === null ? original : R.repriceQuote(good, world, {...options, banThreshold: ban, illegalGood: true}, core, original);
  let price = priced.unitPrice;
  if (scenario.mode === 'prewrite' && lot.id === 'sale-partial') {price = '50100'; rounding.push({label: 'Sale price / ton · Cr', before: '50000.1', after: price});}
  if (scenario.mode === 'huge-credits' && lot.id === 'sale-partial') price = '9007199254740993';
  if (scenario.mode === 'validation' && lot.id === 'sale-partial') price = String(BigInt(price) + 123n);
  const overrideReason = ['prewrite', 'validation', 'huge-credits'].includes(scenario.mode) ? reason : '';
  const quantity = lot.id === 'sale-partial' ? '2' : lot.quantity;
  fields['qty_' + lot.id] = quantity;
  fields['price_' + lot.id] = scenario.mode === 'prewrite' && lot.id === 'sale-partial' ? '50000.1' : (ban !== null && lot.id !== 'sale-partial' ? original.unitPrice : price);
  fields['ban_' + lot.id] = ban === null ? '' : '0';
  return {lotId: lot.id, quantity, unitPrice: price, benchmarkPrice: String(good.baseCreditsPerTon), audit: {...priced.audit, effectiveIllegal: ban !== null, locallyBanned: ban !== null, manualPrice: price !== priced.unitPrice ? price : null, overrideReason, banThreshold: ban === null ? null : '0'}};
 });
 fields.fee = '7'; fields.reason = ['prewrite', 'validation', 'huge-credits'].includes(scenario.mode) ? reason : '';
 if (before.settings.tax) fields.taxRate = scenario.mode === 'validation' ? '17' : '';
 const preview = R.salePreview(before.lots, lines, {creditStep: before.settings.creditStep, percent: before.settings.profit, feePercent: 7, government: '7', criminal: buyer.criminal, taxEnabled: before.settings.tax, manualTaxRate: scenario.mode === 'validation' ? 17 : null}, core, mp, () => 3);
 return {buyer, fields, preview, rounding, diceCalls: before.lots.length * 3 + (preview.tax.dice?.dice.length || 0)};
}
function expected(before, scenario) {
 const spec = specification(before, scenario);
 return S.transition(before, 'Sale to ' + spec.buyer.partyName, next => {
  S.sell(next, spec.preview, spec.buyer.worldId, spec.buyer.party);
  if (spec.rounding.length) next.events.push({id: S.uid(), label: 'Rounding applied [R]', hours: next.hours, roundingStep: before.settings.creditStep, roundingChanges: spec.rounding});
 });
}
function assertSale(saved, before, scenario) {
 assert.deepEqual(uuidNormal(saved), uuidNormal(expected(before, scenario)), 'Entire durable campaign equals one unchanged production sale transition, including audit and inverse Undo');
 assert.equal(saved.revision, before.revision + 1); assert.equal(saved.undo.length, before.undo.length + 1);
 for (const key of ['ship', 'contracts', 'snapshots', 'hours', 'actual', 'route', 'routeIndex', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key], key + ' is unchanged by sale');
 assert.deepEqual(saved.lots.map(l => [l.id, l.quantity]), [['sale-partial', '3']]);
 assert.equal(saved.bank, String(BigInt(before.bank) + BigInt(specification(before, scenario).preview.bankDelta)));
 assert.deepEqual(material(S.undo(saved)), material(before), 'Exact remaining basis, goods value, policies, bank, ledger and Undo stack are reversible');
}
function safeReport(snapshot) {const {candidates, ...rest} = snapshot; return {...rest, candidateSHA256: candidates.map(hash)};}
async function contextFor(result, scenario) {
 const context = await browser.newContext({viewport: result.viewport, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(errorText(error)));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
 });
 await context.exposeBinding('__saleUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__saleUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.saleStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   saleStorage.attempts++; saleStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (saleStorage.failNext) {saleStorage.failNext = false; throw Error('Synthetic known sale prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); saleStorage.writes++; return result;
  };
  globalThis.saleDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {saleDiceCalls++; array[0] = 2; return array;} return random(array);};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/sale-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable sale native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) return route.fulfill({json: {Worlds: []}, headers});
   if (url.pathname.endsWith('/universe')) return route.fulfill({json: {Sectors: []}, headers});
   if (url.pathname.endsWith('/metadata')) return route.fulfill({json: {Subsectors: []}, headers});
   if (url.pathname.endsWith('/sec')) return route.fulfill({json: 'Hex\tName\tUWP\n', headers});
  }
  result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
 }); return context;
}
async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(script => script.type === 'module' && /\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if (!appURL) throw Error('Actual app module unavailable');
  const response = await fetch(appURL); if (!response.ok) throw Error('Cannot inspect runtime app');
  const source = await response.text(), specifier = source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing');
  const storeURL = new URL(specifier, appURL).href; if (!new URL(storeURL).search) throw Error('Actual Store must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save;
  const g = globalThis.saleGate = {armed: false, pending: null, store: null, args: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null, roleFault: false, roleThrows: 0};
  const semantic = () => ({selected: [...document.querySelectorAll('#main [data-lot]:checked')].map(el => el.dataset.lot), selectedText: document.querySelector('.selected-preview span')?.textContent || '', cargo: document.querySelector('.cargo-table tbody')?.textContent || '', title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, dice: saleDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.at(-1)?.kind === 'native-fulfilled';
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic sale completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^Sale to .* saved\.$/s.test(value)) fault('report');
   return Reflect.apply(text.set, this, [value]);
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render'); return Reflect.apply(html.set, this, [value]);}});
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {if (settled() && g.cleanupFault === 'close' && this.id === 'modal') fault('close'); return Reflect.apply(close, this, args);};
  const clear = Set.prototype.clear;
  Set.prototype.clear = function(...args) {if (settled() && g.cleanupFault === 'selection' && this.has('sale-partial')) fault('selection'); return Reflect.apply(clear, this, args);};
  // Successful owned close need not restore detached controls. This setter
  // fault targets real terminal cleanup after a committed notification fault.
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {if ((settled() || g.settlements.at(-1)?.committed === true) && g.cleanupFault === 'controls' && this.id === 'modal-cancel' && value === false) fault('controls'); return Reflect.apply(disabled.set, this, [value]);}});
  // Real document dispatch, not an application hook. Extra ephemeral controls
  // carry the same action names as the actual preparation toolbar.
  g.dispatch = name => {const existing = document.querySelector('[data-action="' + name + '"]'); if (existing) {existing.click(); return;} const button = document.createElement('button'); button.type = 'button'; button.dataset.action = name; document.body.append(button); button.click(); button.remove();};
  g.replay = () => {
   const before = semantic(), open = document.querySelector('#modal').open;
   for (const name of ['sale-edit', 'buyer-search', 'search', 'sale-clear', 'sale', 'sale-all', 'service-back']) g.dispatch(name);
   document.querySelector('#modal-form').requestSubmit();
   if (g.oldSubmit) void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
   document.querySelector('#notes').click();
   g.reentrantChecks.push({sameTitle: semantic().title === before.title, sameOpen: document.querySelector('#modal').open === open});
  };
  function observeStore(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const change = store.onChange, role = store.onRole;
   store.onChange = function(...args) {
    const record = {revision: args[0].revision, tokenPresent: args[1]?.saveToken != null, tokenMatches: args[1]?.saveToken === g.args?.[2], snapshotMatches: JSON.stringify(args[0]) === JSON.stringify(g.args?.[0]), actualCallback: false};
    g.publications.push(record); g.observations.push(observation('before-native-publication'));
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before sale publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2]; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true;
    if (g.reentrant) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after sale publication');}
    return result;
   };
   store.onRole = function(...args) {const result = Reflect.apply(role, this, args); if (g.roleFault) {g.roleFault = false; g.roleThrows++; throw Error('Synthetic sale terminal role callback fault');} return result;};
  }
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.totalCalls++;
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) return Reflect.apply(nativeSave, this, args);
   if (g.pending) throw Error('Application called Store.save twice during pending sale'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native sale write must execute exactly once'); p.executed = true; g.executions++; try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending sale completion');
   if (kind === 'unknown-before') {g.pending = null; g.settlements.push({kind, executed: false}); p.reject(Error('Synthetic unknown sale outcome before write')); return;}
   if (!p.executed) g.write(); g.pending = null;
   if (kind === 'unknown-after' || kind === 'contradictory') {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory sale not-committed after observed publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable sale'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild;};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...saleStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, roleThrows: g.roleThrows, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL, storeURL};
 });
}
async function capture(page, result, label) {
 await frames(page); const name = 'sale-completion-' + result.id + '-' + label + '.jpg';
 await page.screenshot({path: join(artifacts, name), ...screenshotOptions}); result.screenshots.push(name);
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Sale dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Sale table scroll stays inside dialog');}
}
async function pointer(page, selector, clickCount = 1) {
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function fill(page, name, value) {
 const locator = page.locator('#modal [name="' + name + '"]');
 await locator.locator('xpath=ancestor::details').evaluateAll(nodes => nodes.forEach(el => {el.open = true;}));
 await locator.fill(value); await locator.blur();
}
async function prepare(page, scenario, before, {select = true, loops = false} = {}) {
 if (select) {await tab(page, 'Cargo'); await action(page, 'sale-all').click();}
 await action(page, 'sale').click(); await page.locator('#modal-title').filter({hasText: 'Prepare sale · Synthetic buyer'}).waitFor();
 const spec = specification(before, scenario);
 assert.equal(await page.evaluate(() => saleDiceCalls), 9, 'Three natural price dice per selected lot, once');
 for (const [name, value] of Object.entries(spec.fields)) await fill(page, name, value);
 if (scenario.mode === 'validation') {
  await fill(page, 'reason', ''); await pointer(page, '#modal-submit');
  await page.locator('#modal-error').filter({hasText: 'Add a reason'}).waitFor();
  assert.equal((await gate(page)).totalCalls, 0); assert.deepEqual(await read(page), before);
  await fill(page, 'reason', reason);
 }
 await pointer(page, '#modal-submit'); await page.locator('#modal-title').filter({hasText: /^Confirm sale$/}).waitFor(); await frames(page);
 assert.equal(await page.locator('#modal-error').textContent(), ''); assert.equal(await page.evaluate(() => saleDiceCalls), spec.diceCalls);
 if (loops) {
  const review = await page.locator('#modal-body').textContent();
  await action(page, 'sale-edit').click(); await page.locator('#modal-title').filter({hasText: /^Prepare sale/}).waitFor();
  for (const [name, value] of Object.entries(spec.fields)) assert.equal(await page.locator('#modal [name="' + name + '"]').inputValue(), value, 'Edit retains ' + name);
  await pointer(page, '#modal-submit'); await page.locator('#modal-title').filter({hasText: /^Confirm sale$/}).waitFor();
  assert.equal(await page.locator('#modal-body').textContent(), review, 'Edit reuses original tax dice, prices and totals');
  await pointer(page, '#modal-cancel'); await closed(page);
  await action(page, 'sale').click(); await page.locator('#modal-title').filter({hasText: /^Prepare sale/}).waitFor();
  for (const [name, value] of Object.entries(spec.fields)) await fill(page, name, value);
  await pointer(page, '#modal-submit'); await page.locator('#modal-title').filter({hasText: /^Confirm sale$/}).waitFor();
  assert.equal(await page.locator('#modal-body').textContent(), review, 'Cancel/reopen reuses eligible quote and tax caches');
  assert.equal(await page.evaluate(() => saleDiceCalls), spec.diceCalls); assert.deepEqual(await read(page), before);
 }
 await page.evaluate(() => saleGate.remember());
}
async function replay(page, {physical = true, navigation = true} = {}) {
 if (physical) {
  for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) await pointer(page, '#' + id, 2);
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await pointer(page, '[data-action="sale-edit"]', 2);
 }
 await page.evaluate(navigation => {
  const form = document.querySelector('#modal-form');
  if (saleGate.oldSubmit) void saleGate.oldSubmit({preventDefault() {}, currentTarget: form});
  form.requestSubmit();
  if (navigation) saleGate.replay();
 }, navigation); await frames(page);
}
async function assertPending(page, result, scenario, bytes) {
 if (scenario.mode === 'queued-pending') {
  await page.evaluate(() => {
   for (const name of ['sale-edit', 'buyer-search', 'search']) saleGate.dispatch(name);
   // These real async document click handlers have already reached the
   // services.action await. Claim ownership before their continuation runs.
   void saleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
  });
 } else if (scenario.mode === 'success') {await page.locator('#modal-submit').focus(); await page.keyboard.press('Enter');}
 else await pointer(page, '#modal-submit', 2);
 await page.waitForFunction(() => !!saleGate.pending); await frames(page);
 assert.equal(await raw(page), bytes, 'Held native write leaves exact durable bytes alone');
 let snapshot = await gate(page); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Pending review, selection, prices and tax dice retain exact pre-submit semantics');
 assert.equal(snapshot.reviewNodeRetained, true);
 for (const selector of ['#modal-submit', '#modal-cancel', '#modal-close', '[data-action="sale-edit"]']) assert.equal(await page.locator(selector).isDisabled(), true, selector + ' frozen synchronously');
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 await replay(page); snapshot = await gate(page);
 assert.equal(snapshot.totalCalls, 1); assert.equal(snapshot.calls, 1); assert.equal(await raw(page), bytes);
 assert.deepEqual(snapshot.semantic, snapshot.baseline); assert.equal(await page.locator('#modal').evaluate(el => el.open), true);
 for (const forwarded of snapshot.forwarded) {assert.ok(forwarded.argumentCount >= 3); assert.equal(forwarded.tokenPresent, true); assert.equal(forwarded.candidateRevision, forwarded.expectedRevision + 1);}
 if (scenario.mode === 'success') await capture(page, result, 'pending-before-write');
 result.checks.push('One write; synchronous freeze survives pointer double click, Enter, detached submit, Edit, cancel/X/Escape, application Back, selection, buyer/search and new-modal attempts');
}
async function reloadUndo(page, result, before, scenario, {committed = true} = {}) {
 const bytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await raw(page), bytes, 'Reload never replays sale'); assert.equal(await page.evaluate(() => saleStorage.writes), 0);
 if (!committed) {assert.deepEqual(await read(page), before); return;}
 assertSale(await read(page), before, scenario);
 await tab(page, 'History'); assert.ok((await page.locator('#main').textContent()).includes('Sale to Synthetic buyer'));
 await action(page, 'undo').click(); await closed(page); await frames(page);
 assert.deepEqual(material(await read(page)), material(before), 'Actual History Undo restores every economic field and original policy balances');
 assert.equal((await read(page)).revision, before.revision + 2); assert.equal(await page.evaluate(() => saleStorage.writes), 1);
 if (scenario.mode === 'success') {
  // A fresh session after reload and real Undo negotiates exactly once;
  // opening and cancelling the form never writes another campaign change.
  await tab(page, 'Cargo'); await action(page, 'sale-all').click(); await action(page, 'sale').click();
  await page.locator('#modal-title').filter({hasText: /^Prepare sale/}).waitFor(); assert.equal(await page.evaluate(() => saleDiceCalls), 9);
  await pointer(page, '#modal-cancel'); await closed(page);
 }
 result.checks.push('Authoritative reload retains exact sale bytes; actual History Undo restores bank, partial basis/goods, policies and ledger');
}
async function successful(page, result, before, scenario) {
 await closed(page); await frames(page); assertSale(await read(page), before, scenario);
 assert.equal(await page.locator('#modal-error').textContent(), '', 'Successful fresh, retry or validation-corrected save leaves no stale modal warning');
 const snapshot = await gate(page); result.gate = safeReport(snapshot);
 assert.equal(await raw(page), snapshot.candidates.at(-1), 'Durable bytes are exactly the isolated controller snapshot');
 assert.equal(snapshot.storage.writes, 1); assert.equal(snapshot.durableToken, false); assert.match(await page.locator('#message').textContent(), successPattern);
 assert.equal(snapshot.semantic.selectedText, '0 selected'); assert.deepEqual(snapshot.semantic.selected, []); assert.equal(snapshot.semantic.dice, specification(before, scenario).diceCalls);
 for (const item of [...snapshot.observations, ...snapshot.storage.observations]) assert.doesNotMatch(item.message, successPattern, 'Success never precedes provider completion');
 assert.equal(snapshot.publications.filter(p => p.tokenMatches && p.snapshotMatches && p.actualCallback).length, 1);
 const bytes = await raw(page), totalCalls = snapshot.totalCalls;
 await page.evaluate(() => {void saleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, totalCalls); assert.equal(await page.locator('#modal-error').textContent(), '');
 await capture(page, result, 'saved'); await reloadUndo(page, result, before, scenario);
}
async function terminal(page, result, before, scenario, {committed, unknown = false} = {}) {
 await page.waitForFunction(() => /Reload/.test(document.querySelector('#save-status').textContent)); await frames(page);
 const snapshot = await gate(page), guidance = unknown ? /outcome could not be confirmed[\s\S]*Reload/i : /Sale saved[\s\S]*Reload/i;
 for (const id of ['save-status', 'message']) assert.match(await page.locator('#' + id).textContent(), guidance);
 assert.equal(snapshot.editable, false); assert.equal(snapshot.reloadRequired, true); assert.equal(await page.locator('#takeover').isDisabled(), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (committed) assertSale(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 await capture(page, result, 'terminal-warning'); const bytes = await raw(page);
 await replay(page, {physical: false, navigation: false}); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true, 'Terminal outcome releases native writer lock');
 // Later role callbacks cannot revive terminal editing or detach its warning.
 await page.evaluate(() => {saleGate.store.yield(); saleGate.store.onChange(saleGate.store.read());}); await frames(page);
 assert.equal((await gate(page)).reloadRequired, true); assert.equal((await gate(page)).editable, false); assert.match(await page.locator('#save-status').textContent(), guidance);
 result.gate = safeReport(await gate(page)); assert.equal(result.gate.storage.writes, committed ? 1 : 0);
 await reloadUndo(page, result, before, scenario, {committed});
 result.checks.push('Saved/unknown terminal warning, native writer-lock release, later role/publication guards, detached no-replay and authoritative reload');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/sale-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.salePeer = {state: null, editable: false}; salePeer.store = new Store(next => {salePeer.state = next;}, editable => {salePeer.editable = editable;}); await salePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => salePeer.editable); await page.waitForFunction(() => saleGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(salePeer.state, 'Foreign native deposit during sale save', s => S.deposit(s, 7, 'Synthetic peer')); salePeer.store.save(next, salePeer.state.revision); return salePeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {salePeer.store.yield(); salePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => saleGate.store.acquire(true)); await page.waitForFunction(() => saleGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes real Web Lock' + (write ? ' and publishes newer authoritative revision' : '') + (regain ? '; editing returns without reviving sale owner' : ''));
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
 const authoritative = await raw(page), newer = mode === 'new-dialog' ? await page.locator('#modal-body').textContent() : null;
 await release(page); await frames(page);
 if (mode === 'foreign-new') {
  assert.equal(await raw(page), authoritative); assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n)); assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');
 } else assertSale(await read(page), before, scenario);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {
  assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');
  await pointer(page, '#modal-cancel'); await closed(page); await action(page, 'sale-all').click();
  const selected = await page.locator('#main [data-lot]:checked').evaluateAll(nodes => nodes.map(el => el.dataset.lot)); assert.deepEqual(selected, ['sale-partial']);
  await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor();
  await page.evaluate(() => {void saleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
  assert.deepEqual(await page.locator('#main [data-lot]:checked').evaluateAll(nodes => nodes.map(el => el.dataset.lot)), selected, 'Old callback cannot clear newer selection');
  assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-error').textContent(), '');
 }
 const bytes = await raw(page); await page.evaluate(() => {void saleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await capture(page, result, 'retired-owner'); result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign publication/editor loss/native close permanently retires old UI authority; no overwrite, success banner, newer-dialog closure or newer-selection cleanup');
}
async function runBody(page, result, scenario, context) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await page.evaluate(() => saleStorage.writes), 0, 'Complete seed needs no startup migration write');
 await installGate(page, result); const before = await read(page), bytes = await raw(page);
 await prepare(page, scenario, before, {loops: scenario.mode === 'success'});
 if (['queued-settled', 'reentrant', 'validation'].includes(scenario.mode)) {
  if (scenario.mode === 'queued-settled') {
   const immediate = await page.evaluate(() => {
    for (const name of ['sale-edit', 'buyer-search', 'search']) saleGate.dispatch(name);
    // Native async services.action has yielded; the actual synchronous Store
    // and owner finish now complete before those queued actions resume.
    void saleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
    return {writes: saleStorage.writes, open: document.querySelector('#modal').open};
   });
   assert.deepEqual(immediate, {writes: 1, open: false});
  } else {await page.evaluate(mode => {saleGate.reentrant = mode === 'reentrant';}, scenario.mode); await pointer(page, '#modal-submit');}
  await frames(page); assert.equal((await gate(page)).totalCalls, 1); assert.equal(await page.locator('#modal').evaluate(el => el.open), false, 'Queued old edit/buyer/search cannot reopen after synchronous settlement');
  if (scenario.mode === 'reentrant') {assert.equal((await gate(page)).reentrantChecks.length, 2); assert.ok((await gate(page)).reentrantChecks.every(item => item.sameTitle && item.sameOpen));}
  result.checks.push('Synchronous production Store returns directly; earlier preyield actions and reentrant callbacks cannot cross completed sale generation');
  await successful(page, result, before, scenario); return;
 }
 await page.evaluate(mode => {saleGate.armed = true; saleGate.notifyFault = mode === 'notification-before' ? 'before' : ['notification-after', 'controls'].includes(mode) ? 'after' : ['missing', 'missing-token', 'wrong-token', 'wrong-revision'].includes(mode) ? mode : null; saleGate.roleFault = mode === 'notification-after'; saleStorage.failNext = mode === 'prewrite';}, scenario.mode);
 await assertPending(page, result, scenario, bytes);
 if (['foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog'].includes(scenario.mode)) {await retired(page, result, before, scenario, context); return;}
 if (scenario.mode === 'prewrite') {
  await release(page); await page.locator('#modal-error').filter({hasText: 'Synthetic known sale prewrite'}).waitFor();
  let snapshot = await gate(page); assert.equal(await raw(page), bytes); assert.equal(snapshot.reloadRequired, false); assert.equal(snapshot.editable, true); assert.deepEqual(snapshot.semantic, snapshot.baseline); assert.equal(snapshot.reviewNodeRetained, true);
  for (const selector of ['#modal-submit', '#modal-cancel', '#modal-close', '[data-action="sale-edit"]']) assert.equal(await page.locator(selector).isEnabled(), true);
  await capture(page, result, 'known-unsaved-retained'); const candidate = uuidNormal(JSON.parse(snapshot.candidates[0]));
  await pointer(page, '#modal-submit'); await page.waitForFunction(() => !!saleGate.pending);
  snapshot = await gate(page); assert.equal(snapshot.calls, 2); assert.deepEqual(uuidNormal(JSON.parse(snapshot.candidates[1])), candidate, 'Retry retains the exact p, fee/tax/price dice, selection and rounding audit'); assert.deepEqual(snapshot.semantic, snapshot.baseline);
  await release(page); await successful(page, result, before, scenario); return;
 }
 if (['success', 'queued-pending', 'huge-credits'].includes(scenario.mode)) {
  await page.evaluate(() => saleGate.write()); await frames(page); assertSale(await read(page), before, scenario);
  const snapshot = await gate(page); assert.equal(await raw(page), snapshot.candidates[0]); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Full-lot removal publication must not reconcile selection or change review before settlement'); assert.equal(snapshot.reviewNodeRetained, true); assert.equal(snapshot.pending, true);
  assert.equal(await page.locator('#modal').evaluate(el => el.open), true); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await replay(page); assert.deepEqual((await gate(page)).semantic, snapshot.baseline); assert.equal((await gate(page)).totalCalls, 1);
  if (scenario.mode === 'success') await capture(page, result, 'durable-publication-held');
  await release(page); await successful(page, result, before, scenario); return;
 }
 const cleanup = ['render', 'selection', 'report', 'close', 'clear-error', 'controls'].includes(scenario.mode);
 if (cleanup) await page.evaluate(mode => {saleGate.cleanupFault = mode;}, scenario.mode);
 await release(page, ['unknown-before', 'unknown-after', 'contradictory'].includes(scenario.mode) ? scenario.mode : 'native');
 await terminal(page, result, before, scenario, {committed: scenario.mode !== 'unknown-before', unknown: ['unknown-before', 'missing', 'missing-token', 'wrong-token', 'wrong-revision'].includes(scenario.mode)});
 if (cleanup) assert.deepEqual(result.gate.faults, [scenario.mode]);
 if (scenario.mode === 'controls') result.checks.push('Control setter fails during genuine terminal cleanup after a committed publication callback fault; saved terminal state remains latched');
 if (scenario.mode === 'notification-after') assert.equal(result.gate.roleThrows, 1);
 if (scenario.mode === 'contradictory') assert.equal(result.gate.settlements.at(-1).kind, 'contradictory');
}
async function writeReport() {await writeFile(join(artifacts, 'sale-completion-report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, mode: scenario.mode, viewport, status: 'running', checks: [], screenshots: [], layouts: [], pageErrors: [], unhandledRejections: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], errors: []};
 report.cases.push(result); let context;
 try {
  context = await contextFor(result, scenario); const page = await context.newPage(); await runBody(page, result, scenario, context); await frames(page);
  for (const key of ['pageErrors', 'unhandledRejections', 'consoleErrors', 'networkErrors', 'unexpectedRequests']) assert.deepEqual(result[key], [], key);
  result.status = 'passed';
 } catch (error) {result.status = 'failed'; result.errors.push(errorText(error)); const page = context?.pages()[0]; if (page) {await capture(page, result, 'failure').catch(() => {}); result.failedGate = await gate(page).then(safeReport).catch(() => null);}}
 finally {await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id); for (const error of result.errors) console.error(error);
}
if (process.argv.includes('--fixtures-only')) {
 for (const scenario of scenarios) {const before = fixture(scenario), next = expected(before, scenario); assertSale(next, before, scenario); assert.equal(specification(before, scenario).preview.lines.length, 3);}
 const normal = specification(fixture(), {mode: 'success'}); assert.ok(normal.preview.tax.dice.dice.length > 0, 'Ordinary fixture actually exercises random tax');
 assert.equal(specification(fixture({mode: 'prewrite'}), {mode: 'prewrite'}).preview.tax.amount, '0');
 assert.equal(specification(fixture({mode: 'queued-settled'}), {mode: 'queued-settled'}).preview.tax.reason, 'Disabled');
 assert.equal(specification(fixture({mode: 'validation'}), {mode: 'validation'}).preview.tax.rate, 17);
 assert.ok(BigInt(specification(fixture({mode: 'huge-credits'}), {mode: 'huge-credits'}).preview.gross) > BigInt(Number.MAX_SAFE_INTEGER));
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), app = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/); assert.match(app, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 for (const name of ['createSaleWriteOwner', 'completeSaleWrite', 'finishSaleWrite', 'saleWriteFailure']) assert.match(app, new RegExp('function ' + name + '\\('));
 assert.match(app, /saveContext:'sale-save'/); assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length); assert.equal(screenshotOptions.caret, 'initial'); assert.equal(report.declaredCases, 40);
 console.log(`PASS: sale fixture/oracle, partial/full/fractional exact accounting, policies/Undo, tax on/off/manual/criminal, retained rounding, huge credits and version-tagged runtime wiring; ${scenarios.length} scenarios, ${report.declaredCases} browser cases declared (27 desktop, 13 mobile). Chromium was NOT launched.`);
} else {
 await mkdir(artifacts, {recursive: true});
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT to the exact requested test commit'); assert.equal(report.testedCommit, report.requestedCommit, 'CI must test exact requested commit');
  report.workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim(); assert.equal(report.workingTree, '', 'Exact-head evidence requires clean tracked/untracked checkout; generated artifacts are gitignored');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright'); browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})}); report.browser = {name: 'Chromium', version: browser.version()};
  for (const {scenario, viewport} of cases) await runCase(scenario, viewport);
  const files = (await readdir(artifacts)).filter(name => name.startsWith('sale-completion-')); report.screenshotCount = files.filter(name => name.endsWith('.jpg')).length;
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((a, b) => a + b, 0);
  assert.ok(report.artifactBytes < 24 * 1024 * 1024 - 262144, 'Combined sale native/browser evidence stays below 24 MiB');
 } catch (error) {report.errors.push(errorText(error));}
 finally {await browser?.close(); report.finishedAt = new Date().toISOString(); report.passed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'passed'); await writeReport();}
 if (!report.passed) throw Error('Sale completion Chromium checks failed; see verification-artifacts/sale-completion-report.json');
 console.log(`PASS: ${report.declaredCases} production sale completion cases, native locks, exact economics, held completion, reload/Undo and bounded desktop/mobile evidence.`);
}
