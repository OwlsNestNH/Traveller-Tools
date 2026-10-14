// Bounded Stage 2 PURCHASE-ONLY completion gate, including atomic optional insurance.
// Production app/controller/S.buy/rules/native Store and Web Locks are unchanged.
// Only named provider/publication/DOM boundaries are wrapped; application bodies
// are never substituted. Synthetic campaigns and deterministic Map responses only.
// Run in exact-head CI: node verification/purchase-completion-browser.test.mjs [playwright-module]
// --fixtures-only validates economic oracles and source wiring WITHOUT a browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
import * as A from '../js/amounts.mjs';
import {up} from '../js/rounding.mjs';
import {distance} from '../js/map.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url), 'utf8'));
const mp = JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json', import.meta.url), 'utf8'));
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer', prefix = 'purchase-completion-';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const scenarios = [
 {id: 'native-uninsured', mode: 'native', insured: false, fee: 0, dual: true},
 {id: 'native-insured', mode: 'native', insured: true, dual: true},
 {id: 'deferred-uninsured', mode: 'deferred', insured: false, fee: 0, dual: true},
 {id: 'deferred-insured', mode: 'deferred', insured: true, dual: true},
 {id: 'retry-rounded-insured', mode: 'retry', insured: true, rounded: true, dual: true},
 {id: 'full-legal-default', mode: 'native', insured: true, full: true, fee: 10},
 {id: 'illegal-default', mode: 'native', insured: false, illegal: true, fee: 20},
 {id: 'huge-credits', mode: 'deferred', insured: false, huge: true, dual: true}
];
for (const mode of ['entry-controls', 'freeze-controls', 'restore-controls', 'recovery-reentry', 'disk-same', 'disk-unreadable', 'queued-pending', 'queued-settled', 'reentrant', 'unknown-before', 'unknown-after', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token', 'wrong-revision', 'consumed-token', 'fulfilled-no-publication', 'foreign-same', 'foreign-new', 'editor-regain', 'offer-change', 'world-change', 'native-close', 'new-dialog', 'render', 'report', 'terminal-report', 'close-before', 'close-after', 'clear-error', 'controls', 'reentrant-close']) scenarios.push({id: mode, mode, insured: mode !== 'offer-change', rounded: mode === 'recovery-reentry', dual: ['entry-controls', 'disk-same', 'unknown-before', 'contradictory', 'foreign-same', 'render'].includes(mode)});
scenarios.push({id: 'map-owned', mode: 'map-owned', insured: true, map: true, dual: true}, {id: 'map-foreign', mode: 'map-foreign', insured: true, map: true}, {id: 'separate-later-lot', mode: 'chain', insured: true});
const cases = scenarios.flatMap(scenario => sizes.filter(size => size.width === 1440 || scenario.dual).map(viewport => ({scenario, viewport})));
function expectedFrames(scenario) {
 if (scenario.mode === 'native') return scenario.id === 'native-insured' ? 2 : 1;
 if (scenario.mode === 'deferred') return 3;
 if (['retry', 'recovery-reentry'].includes(scenario.mode)) return 4;
 if (['entry-controls', 'freeze-controls'].includes(scenario.mode)) return 3;
 if (scenario.map || scenario.mode === 'queued-pending') return 2;
 if (['offer-change', 'world-change', 'disk-same', 'disk-unreadable', 'chain', 'queued-settled', 'reentrant', 'reentrant-close', 'foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog', 'consumed-token', 'render', 'report', 'close-after'].includes(scenario.mode)) return 1;
 return 2;
}
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 65, caret: 'initial'});
const successPattern = /^Purchase: Synthetic purchased cargo saved\.$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closed = page => page.locator('#modal').waitFor({state: 'hidden'});
const action = (page, name, arg) => page.locator('[data-action="' + name + '"]' + (arg === undefined ? '' : '[data-arg="' + arg + '"]')).filter({visible: true}).first();
const tab = (page, name) => action(page, 'tab', name).click();
const gate = page => page.evaluate(() => purchaseGate.snapshot());
const release = (page, kind = 'native') => page.evaluate(kind => purchaseGate.release(kind), kind);
const errorText = error => error?.stack || String(error);
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'jumpAttempts'].includes(key)));
const report = {suite: 'Purchase commit save completion', startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null, node: process.version, declaredCases: cases.length, declaredDesktopCases: scenarios.length, declaredMobileCases: cases.length - scenarios.length, declaredScreenshots: cases.reduce((sum, {scenario}) => sum + expectedFrames(scenario), 0), gateSHA256: hash(await readFile(fileURLToPath(import.meta.url))), scenarios, cases: [], errors: [], limits: {durationMs: 14 * 60 * 1000, artifactBytes: 24 * 1024 * 1024, imageBytes: 20 * 1024 * 1024}, scope: 'Actual production purchase preparation/review and atomic optional insurance; version-tagged Store/native locks; native and held write/publication/settlement; exact accounting, no-reroll retry, ownership/provenance and transient DOM faults; reload/History Undo; bounded desktop/mobile target-framed evidence. This representative browser matrix is not the exhaustive native ownership/economics/fault cross-product. Held-cargo insurance, claims, amendments, arbitrary persistent DOM failures and Stage 3 caches are out of scope; existing Sale, Expense, shared-modal and insurance suites remain required.'};
let browser, imageBytes = 0;
// Only generated UUIDs are normalized, preserving every reference in inverse data.
function normalize(value) {
 const ids = new Map();
 return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, id => {if (!ids.has(id)) ids.set(id, 'generated-' + ids.size); return ids.get(id);}));
}
function fixture(scenario = scenarios[0]) {
 const s = S.initial(), origin = {id: '1,1', x: 1, y: 1, name: 'Purchase Origin', sector: 'Synthetic', hex: '0202', uwp: 'A788879-C', zone: 'Amber'};
 const destination = {...origin, id: '2,1', x: 2, name: 'Purchase Destination', hex: '0302'};
 const extension = {...origin, id: '3,1', x: 3, name: 'Excluded Red Extension', hex: '0402', zone: 'Red'};
 Object.assign(s, {initialized: true, name: 'Disposable purchase completion campaign', actual: origin.id, worlds: {[origin.id]: origin, [destination.id]: destination, [extension.id]: extension}, route: [origin.id, destination.id, extension.id], bank: '90071992547409931234567', hours: 31});
 Object.assign(s.ship, {name: 'Purchase Trader', capacity: '100', staterooms: 2, fuel: configureFuel(200, 40, 40, 0, 2), lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}}, accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}});
 Object.assign(s.settings, {insurance: true, creditStep: scenario.rounded ? 100 : 1});
 s.lots = [{id: 'existing-lot', commodity: '12', description: 'Unrelated selected cargo', quantity: '3', basis: '10007', goodsValue: '9001'}];
 const world = R.context(origin, core), options = {side: 'buy', skill: 1, counterparty: 2, local: scenario.fee !== 0, creditStep: s.settings.creditStep};
 const quoted = R.quote(core.commodities.find(g => g.id === '11'), world, {...options, illegalGood: !!scenario.illegal}, core, () => 3);
 const unitPrice = scenario.huge ? '9007199254740993' : scenario.mode === 'offer-change' ? '1000' : '10003';
 const offer = {...quoted, id: 'purchase-offer', commodity: '11', description: 'Saved supplier electronics', remaining: '5', illegal: !!scenario.illegal, expired: false, unitPrice, overrides: [{hours: 30, reason: 'Saved referee purchase price', before: {remaining: '5', unitPrice: quoted.unitPrice}, after: {remaining: '5', unitPrice}}]};
 s.snapshots = [{id: 'purchase-supplier', kind: 'supplier', worldId: origin.id, world, party: 'synthetic|supplier', partyName: 'Synthetic supplier', hours: s.hours, startedHours: s.hours, criminal: !!scenario.illegal, success: true, options, offers: [offer]}];
 s.ledger = [{id: 'purchase-opening', type: 'Opening bank', amount: s.bank, hours: 0, world: origin.id}];
 s.dashboardBaseline = createDashboardBaseline(s); return S.validate(s);
}
function specification(before, scenario) {
 const snap = before.snapshots[0], offer = snap.offers[0], quantity = scenario.full ? '5' : scenario.mode === 'offer-change' ? '1' : '2', feePercent = scenario.mode === 'offer-change' ? 5 : scenario.fee ?? 7.5;
 const cost = up(A.mul(quantity, offer.unitPrice), before.settings.creditStep), fee = up(A.mul(cost, A.div(feePercent, 100)), before.settings.creditStep);
 const rounding = scenario.rounded ? [{label: 'Tons to buy', before: '1.2', after: '2'}, {label: 'Referee premium · Cr (required beyond 6 pc; blank uses table)', before: '100.1', after: '200'}] : [];
 const route = before.route.slice(before.routeIndex, before.routeIndex + 2), plannedDistance = distance(before.worlds[route[0]], before.worlds[route[1]]), insuredDistance = scenario.rounded ? 7 : plannedDistance;
 const insurance = scenario.insured ? {...R.insuranceQuote(cost, 70, insuredDistance, route.map(id => before.worlds[id].zone), mp, scenario.rounded ? '200' : null, before.settings.creditStep), route, destination: route.at(-1), routeProgress: 0, plannedDistance, distanceOverrideReason: scenario.rounded ? 'Synthetic approved distance' : null} : null;
 return {snap, offer, quantity, cost: String(cost), fee: String(fee), debit: String(cost + fee + BigInt(insurance?.premium || 0)), rounding, args: {snapshotId: snap.id, offerId: offer.id, quantity, feePercent, description: 'Synthetic purchased cargo', insurance}};
}
function expected(before, scenario) {
 const spec = specification(before, scenario);
 return S.transition(before, 'Purchase: ' + spec.args.description, next => {
  S.buy(next, spec.args);
  if (spec.rounding.length) next.events.push({id: S.uid(), label: 'Rounding applied [R]', hours: next.hours, roundingStep: before.settings.creditStep, roundingChanges: spec.rounding});
 });
}
function assertPurchase(saved, before, scenario) {
 const spec = specification(before, scenario), lot = saved.lots.at(-1);
 assert.deepEqual(normalize(saved), normalize(expected(before, scenario)), 'Entire campaign equals one unchanged S.buy transition including policy, ledger, immutable saved audit and inverse Undo');
 assert.equal(saved.revision, before.revision + 1); assert.equal(saved.undo.length, before.undo.length + 1);
 assert.equal(saved.bank, String(BigInt(before.bank) - BigInt(spec.debit))); assert.equal(lot.basis, spec.debit); assert.equal(lot.goodsValue, spec.cost); assert.equal(lot.quantity, spec.quantity);
 assert.deepEqual(lot.audit.price, before.snapshots[0].offers[0], 'New lot retains the original offer before depletion');
 assert.deepEqual(saved.lots[0], before.lots[0]); assert.equal(saved.lots.length, before.lots.length + 1);
 assert.equal(saved.snapshots[0].offers[0].remaining, String(BigInt(spec.offer.remaining) - BigInt(spec.quantity)));
 assert.deepEqual(saved.ledger.slice(before.ledger.length).map(entry => entry.type), ['Purchase', ...(spec.fee === '0' ? [] : ['Broker fee']), ...(scenario.insured ? ['Insurance premium'] : [])]);
 for (const key of ['ship', 'contracts', 'hours', 'actual', 'route', 'routeIndex', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key], key + ' unchanged');
 assert.deepEqual(material(S.undo(saved)), material(before), 'Exact original offer, bank, lot, policy, ledger and Undo stack are restored');
}
function safeReport(snapshot) {
 const compact = value => value && {...value, main: {sha256: hash(value.main), bytes: value.main.length}, summary: {sha256: hash(value.summary), bytes: value.summary.length}};
 const regionHash = value => value && {...value, regions: value.regions.map(({html, ...region}) => ({...region, sha256: html == null ? null : hash(html), bytes: html?.length ?? null}))};
 return {...snapshot, candidates: snapshot.candidates.map(hash), baseline: compact(snapshot.baseline), semantic: compact(snapshot.semantic), mapBaseline: regionHash(snapshot.mapBaseline), paintEdges: snapshot.paintEdges.map(regionHash)};
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
 await context.exposeBinding('__purchaseUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__purchaseUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.purchaseStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   purchaseStorage.attempts++; purchaseStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (purchaseStorage.failNext) {purchaseStorage.failNext = false; throw Error('Synthetic known purchase prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); purchaseStorage.writes++; return result;
  };
  globalThis.purchaseDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {purchaseDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.purchaseMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.purchaseMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); purchaseMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    purchaseMapCallbacks.executed++; if (cache) purchaseMapCallbacks.cacheExecuted++;
    globalThis.purchaseGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.purchaseGate?.paintEdge('after', cache);
    purchaseMapCallbacks.completed++; if (cache) purchaseMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.purchaseGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {purchaseMapCallbacks.loadingCacheCompleted++; purchaseMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.purchaseMapLoadingStatusNode = statusNode;}
    globalThis.purchaseGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.purchaseGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.purchaseGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) purchaseMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 let held, releaseHold, heldOnce = false;
 context.purchaseNetwork = {async waitHeld() {const end = Date.now() + 10000; while (!held && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25)); assert.ok(held, 'Real MapAreaCache tile reached network fixture'); return {...held};}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/purchase-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable purchase native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if (scenario.map && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {heldOnce = true; held = {url: url.href, heldAt: Date.now(), released: false}; result.mapResponse = held; await new Promise(resolve => {releaseHold = resolve;}); held.released = true; held.releasedAt = Date.now();}
    return route.fulfill({json: {Worlds: []}, headers});
   }
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
  const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Actual Store must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save, nativeRead = Store.prototype.read;
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const storeResponse = await fetch(storeURL); if (!storeResponse.ok) throw Error('Cannot inspect runtime Store');
  const storeSource = await storeResponse.text();
  const g = globalThis.purchaseGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
  Object.assign(g, {timeline: [], timelineDropped: 0});
  g.trace = (event, detail = {}) => {const entry = {order: g.timeline.length + 1, at: performance.now(), event, ...detail}; if (g.timeline.length < 120) g.timeline.push(entry); else g.timelineDropped++; return entry;};
  Object.assign(g, {strict: false, paintEdges: [], paintEdgesDropped: 0, mutationCount: 0, phase: 'review', nextNodeId: 0, nodeIds: new WeakMap()});
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextNodeId), g.nextNodeId)) : null;
  g.mapNodeId = nodeId;
  g.mapCapture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, regions: ['.world-map', '#map-load-status', '.planned-route', '#modal-body', '#summary', '#message', '#save-status'].map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.mapCapture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const observer = new MutationObserver(records => {if (g.strict) g.mutationCount += records.length;});
  g.beginStrict = () => {g.strict = true; g.mapBaseline = g.mapCapture('strict-baseline'); for (const selector of ['#main', '#summary', '#message', '#save-status']) observer.observe(document.querySelector(selector), {subtree: true, childList: true, attributes: true, characterData: true});};
  g.endStrict = () => {g.strict = false; observer.disconnect();};
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, dice: purchaseDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic purchase completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^Purchase: .* saved\.$/s.test(value)) fault('report');
   if (settled() && g.cleanupFault === 'terminal-report' && this.id === 'message' && /Reload/.test(value)) fault('terminal-report');
   return Reflect.apply(text.set, this, [value]);
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render'); return Reflect.apply(html.set, this, [value]);}});
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {
   if (settled() && g.cleanupFault === 'close-before' && this.id === 'modal') fault('close-before');
   const result = Reflect.apply(close, this, args);
   if (settled() && g.cleanupFault === 'close-after' && this.id === 'modal') fault('close-after');
   if (settled() && g.cleanupFault === 'reentrant-close' && this.id === 'modal') {
    g.cleanupFault = null; g.faults.push('reentrant-close'); document.querySelector('#notes').click();
    g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent};
   }
   return result;
  };
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic purchase entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: purchaseStorage.writes});
   }
   if (settled() && ['restore-controls', 'controls'].includes(g.cleanupFault) && this.id === 'modal-cancel' && value === false) fault(g.cleanupFault);
   return Reflect.apply(disabled.set, this, [value]);
  }});
  g.dispatch = (name, arg = '') => {const button = document.createElement('button'); button.type = 'button'; button.dataset.action = name; button.dataset.arg = arg; document.body.append(button); button.click(); button.remove();};
  g.replay = () => {
   const before = semantic(), open = document.querySelector('#modal').open;
   for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', ''], ['buy', 'purchase-offer'], ['offer-edit', 'purchase-offer'], ['sale-clear', ''], ['search', '']]) g.dispatch(name, arg);
   document.querySelector('#modal-form').requestSubmit();
   if (g.oldSubmit) void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
   document.querySelector('#notes').click();
   g.reentrantChecks.push({sameTitle: semantic().title === before.title, sameOpen: document.querySelector('#modal').open === open});
  };
  function observeStore(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const change = store.onChange;
   store.onChange = function(...args) {
    g.lastState = args[0];
    const record = {revision: args[0].revision, tokenPresent: args[1]?.saveToken != null, tokenMatches: args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null, snapshotMatches: JSON.stringify(args[0]) === JSON.stringify(g.args?.[0]), actualCallback: false};
    g.publications.push(record); g.observations.push(observation('before-native-publication'));
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before purchase publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after purchase publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this); if (g.readFault) throw Error('Synthetic unreadable durable purchase baseline'); return Reflect.apply(nativeRead, this, args);};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending purchase'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native purchase write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending purchase completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known purchase prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown purchase outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory purchase not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable purchase'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: purchaseMapCallbacks.cacheCompleted, loadingCacheCompleted: purchaseMapCallbacks.loadingCacheCompleted});};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...purchaseStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, mainNodeRetained: !!g.mainNode?.isConnected, newer: g.newer, recoveryChecks: g.recoveryChecks, callbacks: {...purchaseMapCallbacks}, bootstrap: g.bootstrap, mapReadiness: g.mapReadiness, retainedBaselineOrder: g.retainedBaselineOrder, timeline: g.timeline, timelineDropped: g.timelineDropped, mapBaseline: g.mapBaseline, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, mutationCount: g.mutationCount, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = purchaseStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || purchaseStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
  g.bootstrap = {storeDiscovered: true, dispatches: 2, observedPublications: g.publications.length - discoveredPublications, appCallbackCompleted: g.publications.at(-1).actualCallback, deliveredRevision: g.lastState.revision, exactDurableBytes: true, writes: 0};
  g.trace('observation-bootstrap-complete', g.bootstrap);
  // Later in-place fixture drift changes only this actual delivered test object.
  return {appURL, storeURL, appSHA256: await digest(source), storeSHA256: await digest(storeSource), nativeLocks: !!navigator.locks};
 });
 assert.equal(result.runtime.nativeLocks, true);
 assert.equal(result.runtime.appSHA256, hash(await readFile(new URL('../js/app.mjs', import.meta.url))));
 assert.equal(result.runtime.storeSHA256, hash(await readFile(new URL('../js/persistence.mjs', import.meta.url))));
}
async function capture(page, result, label) {
 await frames(page); const name = prefix + result.id + '-' + label + '.jpg';
 const bytes = await page.screenshot({path: join(artifacts, name), ...screenshotOptions});
 imageBytes += bytes.length; assert.ok(imageBytes < report.limits.imageBytes, 'Bounded screenshot bytes'); result.screenshots.push(name);
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Purchase dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Purchase content stays inside dialog');}
}
async function detail(page, result, label, selectors, pattern) {
 const saved = await page.evaluate(() => ({x: scrollX, y: scrollY, dialog: document.querySelector('#modal').scrollTop}));
 try {
  await page.locator(selectors[0]).scrollIntoViewIfNeeded(); await frames(page);
  const targets = await page.evaluate(selectors => selectors.map(selector => {const el = document.querySelector(selector), r = el.getBoundingClientRect(), style = getComputedStyle(el); return {selector, text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, visible: style.display !== 'none' && style.visibility !== 'hidden', viewport: {width: innerWidth, height: innerHeight}};}), selectors);
  for (const target of targets) {
   assert.ok(target.visible && target.width > 0 && target.height > 0, label + ' target rendered');
   assert.ok(target.left >= -1 && target.right <= target.viewport.width + 1 && target.top >= -1 && target.bottom <= target.viewport.height + 1, label + ': ' + target.selector + ' fully in screenshot');
  }
  if (pattern) assert.match(targets.map(target => target.text).join('\n'), pattern);
  await capture(page, result, label); (result.details ??= []).push({label, targets});
 } finally {await page.evaluate(saved => {document.querySelector('#modal').scrollTop = saved.dialog; scrollTo(saved.x, saved.y);}, saved);}
}
async function pointer(page, selector, clickCount = 1) {
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function fill(page, name, value) {const input = page.locator('#modal [name="' + name + '"]'); await input.fill(String(value)); await input.blur();}
async function prepare(page, scenario, before, {loops = false, select = true, network = null} = {}) {
 if (select) {await tab(page, 'Cargo'); await action(page, 'sale-all').click(); await tab(page, scenario.map ? 'Overview' : 'Trade');}
 const initialCalls = (await gate(page)).totalCalls;
 const spec = specification(before, scenario);
 const enter = async () => {
  if (scenario.map) await page.evaluate(() => purchaseGate.dispatch('buy', 'purchase-offer')); else await action(page, 'buy', 'purchase-offer').click(); await page.locator('#modal-title').filter({hasText: /^Review purchase ·/}).waitFor();
  assert.equal(await page.locator('#modal [name="fee"]').inputValue(), String(before.snapshots[0].options.local ? (scenario.illegal ? 20 : 10) : 0), 'Saved local-broker legality sets default fee');
  await fill(page, 'quantity', scenario.rounded ? '1.2' : spec.quantity); await fill(page, 'fee', spec.args.feePercent); await fill(page, 'description', spec.args.description);
  if (scenario.insured) {
   await page.locator('#modal [name="insure"]').check(); await page.locator('#modal [name="coverage"]').selectOption('70'); await page.locator('#modal [name="insuranceLegs"]').selectOption('1');
   await fill(page, 'insuranceDistance', spec.args.insurance.distance);
   if (scenario.rounded) {await fill(page, 'distanceReason', spec.args.insurance.distanceOverrideReason); await fill(page, 'manualPremium', '100.1');}
   await page.waitForFunction(expected => {
    const target = document.querySelector('#insurance-estimate');
    const label = [...(target?.querySelectorAll('dt') || [])].find(dt => dt.textContent === 'Projected insurance premium');
    return label?.nextElementSibling?.textContent.replace(/\D/g, '') === expected;
   }, spec.args.insurance.premium);
   assert.deepEqual(await read(page), before, 'Live purchase premium estimate never saves');
  }
  // Real input blur/normalization precedes both preview and the no-entry baseline.
  await page.locator('#modal-submit').focus();
  await page.locator('#purchase-totals').waitFor(); await frames(page);
  assert.equal(await page.locator('#modal-error').textContent(), '');
  assert.equal(await page.evaluate(() => purchaseDiceCalls), 0, 'Preparation uses saved original price dice without rerolling');
  assert.equal((await gate(page)).totalCalls, initialCalls); assert.deepEqual(await read(page), before, 'Preparation and preview write nothing');
  assert.match(await page.locator('#modal-body').textContent(), /SEVERE COMPLICATION/);
  if (scenario.rounded) {assert.match(await page.locator('#rounding-input-note').textContent(), /1\.2 → 2/); assert.match(await page.locator('#rounding-input-note').textContent(), /100\.1 → 200/);}
 };
 await enter();
 if (loops) {const review = await page.locator('#modal-body').textContent(); await pointer(page, '#modal-cancel'); await closed(page); assert.deepEqual(await read(page), before); await enter(); assert.equal(await page.locator('#modal-body').textContent(), review, 'Cancel and reopen reproduce the same accepted terms without writes or dice');}
 await page.evaluate(() => document.activeElement?.blur()); await frames(page);
 if (scenario.map) {
  assert.ok(network, 'Map setup requires the actual held network fixture');
  const held = await network.waitHeld(); assert.equal(held.released, false, 'Keep cache response held before retained baseline');
  // Wait for observed completion, not a delay: the 250 ms production request
  // debounce may paint its first loading state after ordinary form preparation.
  await page.waitForFunction(() => purchaseMapCallbacks.loadingCacheCompleted > 0 && purchaseMapLoadingStatusNode === document.querySelector('#map-load-status') && /Loading map data/.test(document.querySelector('#map-load-status')?.textContent || ''));
  await page.evaluate(held => {
   if (purchaseGate.totalCalls || purchaseGate.pending || purchaseStorage.writes) throw Error('Map readiness must precede all provider work');
   purchaseGate.mapReadiness = purchaseGate.trace('initial-cache-ready', {heldURL: held.url, heldResponseReleased: held.released, callbacks: {...purchaseMapCallbacks}, status: document.querySelector('#map-load-status').textContent, statusNodeId: purchaseGate.mapNodeId(purchaseMapLoadingStatusNode)});
  }, held);
 }
 await page.evaluate(() => purchaseGate.remember());
}
async function replay(page, {physical = true, navigation = true} = {}) {
 if (physical) {for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) await pointer(page, '#' + id, 2); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');}
 await page.evaluate(navigation => {const form = document.querySelector('#modal-form'); if (purchaseGate.oldSubmit) void purchaseGate.oldSubmit({preventDefault() {}, currentTarget: form}); form.requestSubmit(); if (navigation) purchaseGate.replay();}, navigation); await frames(page);
}
async function assertPending(page, result, scenario, bytes) {
 if (scenario.mode === 'queued-pending') await page.evaluate(() => {for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', '']]) purchaseGate.dispatch(name, arg); void purchaseGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});});
 else if (scenario.mode === 'deferred') {await page.locator('#modal-submit').focus(); await page.keyboard.press('Enter');}
 else await pointer(page, '#modal-submit', 2);
 await page.waitForFunction(() => !!purchaseGate.pending); await frames(page);
 assert.equal(await raw(page), bytes, 'Held provider leaves exact durable bytes alone');
 let snapshot = await gate(page); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Pending purchase preserves exact review, main, summary and saved dice');
 assert.equal(snapshot.reviewNodeRetained, true); assert.equal(snapshot.mainNodeRetained, true);
 for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true, id + ' frozen synchronously');
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 await replay(page); snapshot = await gate(page); assert.equal(snapshot.totalCalls, 1); assert.equal(snapshot.calls, 1); assert.equal(await raw(page), bytes); assert.deepEqual(snapshot.semantic, snapshot.baseline);
 for (const forwarded of snapshot.forwarded) {assert.ok(forwarded.argumentCount >= 3); assert.equal(forwarded.tokenPresent, true); assert.equal(forwarded.candidateRevision, forwarded.expectedRevision + 1);}
 if (scenario.mode === 'deferred' && !scenario.huge) await detail(page, result, 'pending-before-write-footer', ['#modal-cancel', '#modal-submit']);
 result.checks.push('One provider call; frozen Close/X/Escape, Enter, detached/duplicate callbacks, queued tab/world/deposit, unrelated selection and replacement actions');
}
async function reloadUndo(page, result, before, scenario, {committed = true} = {}) {
 const bytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await raw(page), bytes, 'Authoritative reload never replays purchase'); assert.equal(await page.evaluate(() => purchaseStorage.writes), 0);
 if (!committed) {assert.deepEqual(await read(page), before); return;}
 assertPurchase(await read(page), before, scenario);
 await tab(page, 'History'); assert.match(await page.locator('#main').textContent(), /Purchase: Synthetic purchased cargo/);
 await action(page, 'undo').click(); await closed(page); await frames(page);
 assert.deepEqual(material(await read(page)), material(before), 'Actual History Undo restores exact original offer, bank, lot, policy and ledger');
 assert.equal((await read(page)).revision, before.revision + 2); assert.equal(await page.evaluate(() => purchaseStorage.writes), 1);
 result.checks.push('Authoritative reload retains exact saved bytes; actual History Undo restores every economic field and original supplier audit');
}
async function accountingDetail(page, result, before, scenario) {
 const saved = await read(page), spec = specification(before, scenario), entry = saved.ledger.find(item => item.type === 'Purchase');
 await tab(page, 'Accounts'); await action(page, 'ledger-audit', entry.id).click();
 await page.locator('#modal-title').filter({hasText: /^Purchase details$/}).waitFor();
 assert.match(await page.locator('#modal-body').textContent(), /Purchase insurance premium/);
 const rows = await page.locator('#modal-body dt').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.textContent, node.nextElementSibling?.textContent])));
 const digits = text => text.replace(/[^0-9]/g, '');
 assert.equal(digits(rows['Goods cost']), spec.cost); assert.equal(digits(rows['Purchase broker fee']), spec.fee); assert.equal(digits(rows['Purchase insurance premium']), spec.args.insurance?.premium || '0');
 const list = page.locator('#modal-body dl').filter({has: page.locator('dt', {hasText: /^Tons purchased$/})});
 await list.evaluate(node => {node.dataset.purchaseDetail = 'true';});
 await detail(page, result, 'saved-accounting-detail', ['#modal-body [data-purchase-detail]'], /Purchase price per ton[\s\S]*Goods cost[\s\S]*Purchase broker fee[\s\S]*Purchase insurance premium/);
 await pointer(page, '#modal-cancel'); await closed(page);
}
async function successful(page, result, before, scenario) {
 await closed(page); await frames(page); assertPurchase(await read(page), before, scenario);
 assert.equal(await page.locator('#modal-error').textContent(), '');
 const snapshot = await gate(page); assert.equal(await raw(page), snapshot.candidates.at(-1)); assert.equal(snapshot.storage.writes, 1); assert.equal(snapshot.durableToken, false); assert.equal(snapshot.reloadRequired, false);
 assert.match(await page.locator('#message').textContent(), successPattern); assert.equal(snapshot.semantic.dice, 0);
 for (const item of [...snapshot.observations, ...snapshot.storage.observations]) assert.doesNotMatch(item.message, successPattern, 'Success never precedes completion');
 assert.equal(snapshot.publications.filter(item => item.tokenMatches && item.snapshotMatches && item.actualCallback).length, 1);
 const bytes = await raw(page), calls = snapshot.totalCalls;
 await page.evaluate(() => {void purchaseGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, calls);
 await detail(page, result, 'saved-success', ['#message'], successPattern);
 if (scenario.huge) {
  const credits = page.locator('#summary > .stat').filter({has: page.locator('.label', {hasText: /^Credits$/})});
  assert.equal((await credits.locator('.value').textContent()).replace(/[^0-9]/g, ''), (await read(page)).bank);
  await credits.evaluate(node => {node.dataset.purchaseCredits = 'true';});
  await detail(page, result, 'saved-exact-credits', ['#summary [data-purchase-credits]']);
 }
 await tab(page, 'Cargo'); assert.deepEqual(await page.locator('#main [data-lot]:checked').evaluateAll(nodes => nodes.map(el => el.dataset.lot)), ['existing-lot'], 'Purchase does not clear unrelated selected cargo');
 if (scenario.id === 'native-insured' || scenario.id === 'huge-credits') await accountingDetail(page, result, before, scenario);
 result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
}
async function terminal(page, result, before, scenario, {committed, unknown = false} = {}) {
 await page.waitForFunction(() => /Reload/.test(document.querySelector('#save-status').textContent)); await frames(page);
 const snapshot = await gate(page), guidance = unknown ? /outcome could not be confirmed[\s\S]*Reload/i : /Purchase saved[\s\S]*Reload/i;
 assert.match(await page.locator('#save-status').textContent(), guidance);
 if (scenario.mode !== 'terminal-report') assert.match(await page.locator('#message').textContent(), guidance);
 assert.equal(snapshot.editable, false); assert.equal(snapshot.reloadRequired, true); assert.equal(await page.locator('#takeover').isDisabled(), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (committed) assertPurchase(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 if (await page.locator('#modal').evaluate(el => el.open)) {
  assert.equal(await page.locator('#modal-submit').isDisabled(), true);
  await detail(page, result, 'terminal-warning', ['#modal-error'], guidance);
  await detail(page, result, 'terminal-controls', ['#modal-cancel', '#modal-submit']);
 } else await detail(page, result, 'terminal-banner', ['#save-status'], guidance);
 const bytes = await raw(page); await replay(page, {physical: false, navigation: false}); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true, 'Terminal outcome releases real writer lock');
 await page.evaluate(() => {purchaseGate.store.yield(); purchaseGate.store.onChange(purchaseGate.store.read());}); await frames(page);
 assert.equal((await gate(page)).reloadRequired, true); assert.equal((await gate(page)).editable, false); assert.match(await page.locator('#save-status').textContent(), guidance);
 result.gate = safeReport(await gate(page)); assert.equal(result.gate.storage.writes, committed ? 1 : 0);
 await reloadUndo(page, result, before, scenario, {committed});
 result.checks.push('Terminal saved/unknown state is latched before reporting, releases native lock and rejects replay; reload restores authoritative bytes');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/purchase-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.purchasePeer = {state: null, editable: false}; purchasePeer.store = new Store(next => {purchasePeer.state = next;}, editable => {purchasePeer.editable = editable;}); await purchasePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => purchasePeer.editable); await page.waitForFunction(() => purchaseGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(purchasePeer.state, 'Foreign deposit during purchase save', s => S.deposit(s, 7, 'Synthetic peer')); purchasePeer.store.save(next, purchasePeer.state.revision); return purchasePeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {purchasePeer.store.yield(); purchasePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => purchaseGate.store.acquire(true)); await page.waitForFunction(() => purchaseGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
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
 if (mode === 'foreign-new') {assert.equal(await raw(page), authoritative); assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n)); assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');}
 else assertPurchase(await read(page), before, scenario);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {void purchaseGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 if (mode === 'foreign-same') await detail(page, result, 'stale-owner-warning', ['#modal-error'], /Campaign or editing ownership changed/);
 else await capture(page, result, 'retired-owner');
 result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign/consumed publication, editor tenure and modal replacement retire old success/cleanup authority permanently');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: purchaseGate.mapCapture('before-resize'), callbacks: {...purchaseMapCallbacks}}));
 await page.evaluate(() => {purchaseGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => purchaseMapCallbacks.resizeDelivered > previous.resizeDelivered && purchaseMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => purchaseGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.purchaseNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {purchaseGate.beginStrict(); purchaseGate.write();}); await frames(page); assertPurchase(await read(page), before, scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {purchaseGate.phase = 'cache-response'; purchaseGate.trace('held-cache-release-requested');}); context.purchaseNetwork.release();
 await page.waitForFunction(n => purchaseMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => purchaseGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => purchaseGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page, result, {resume: true}); await release(page); await frames(page); assertPurchase(await read(page), before, scenario); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await detail(page, result, 'foreign-map-warning', ['#modal-error'], /Campaign or editing ownership changed/); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
 } else {await release(page); await closed(page); await frames(page); await resizeProbe(page, result, {resume: true}); await successful(page, result, before, scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function runBody(page, result, scenario, context) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await page.evaluate(() => purchaseStorage.writes), 0, 'Complete seed needs no migration write');
 await installGate(page, result); const before = await read(page), bytes = await raw(page);
 await prepare(page, scenario, before, {loops: scenario.mode === 'deferred' && !scenario.huge, network: context.purchaseNetwork});
 if (scenario.mode === 'chain') {
  await pointer(page, '#modal-submit'); await closed(page); await frames(page); const first = await read(page); assertPurchase(first, before, scenario);
  await prepare(page, scenario, first, {select: false}); await pointer(page, '#modal-submit'); await closed(page); await frames(page); const second = await read(page); assertPurchase(second, first, scenario);
  assert.equal(second.lots.length, 3); assert.notEqual(second.lots[1].id, second.lots[2].id); assert.equal(second.policies.length, 2); assert.equal(second.snapshots[0].offers[0].remaining, '1'); assert.equal((await gate(page)).storage.writes, 2); assert.equal(await page.evaluate(() => purchaseDiceCalls), 0);
  await detail(page, result, 'separate-later-purchase', ['#message'], successPattern); result.gate = safeReport(await gate(page));
  await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.deepEqual(await read(page), second);
  await tab(page, 'History'); await action(page, 'undo').click(); await frames(page); assert.deepEqual(material(await read(page)), material(first)); await action(page, 'undo').click(); await frames(page); assert.deepEqual(material(await read(page)), material(before));
  result.checks.push('Two deliberate purchases consume one saved offer without rerolling, create distinct lots/policies, and reverse independently through actual Undo'); return;
 }
 if (['offer-change', 'world-change'].includes(scenario.mode)) {
  if (scenario.mode === 'offer-change') assert.equal((await page.locator('#purchase-totals dt').filter({hasText:/^Total debit$/}).locator('xpath=following-sibling::dd[1]').textContent()).replace(/[^0-9]/g, ''), '1050', 'Accepted review is exactly Cr1,050 before the same-revision price doubles');
  await page.evaluate(mode => {if (mode === 'offer-change') purchaseGate.lastState.snapshots[0].offers[0].unitPrice = '2000'; else purchaseGate.lastState.actual = '2,1';}, scenario.mode);
  await pointer(page, '#modal-submit'); await frames(page);
  assert.equal((await gate(page)).totalCalls, 0, 'Changed accepted terms cannot reach provider'); assert.equal(await raw(page), bytes);
  assert.match(await page.locator('#modal-error').textContent(), /changed|reopen|review/i); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await detail(page, result, 'accepted-context-drift', ['#modal-error'], /changed|reopen|review/i);
  await replay(page, {physical: false, navigation: false}); assert.equal((await gate(page)).totalCalls, 0); assert.equal(await raw(page), bytes);
  result.gate = safeReport(await gate(page)); result.checks.push('In-place same-revision mutation of actual delivered campaign object rejects obsolete offer/world consent before provider, without changing saved bytes'); return;
 }
 if (['entry-controls', 'freeze-controls'].includes(scenario.mode)) {
  const baseline = (await gate(page)).baseline;
  await page.evaluate(mode => {purchaseGate.entryFault = mode === 'entry-controls' ? 'modal-submit' : 'modal-cancel';}, scenario.mode); await pointer(page, '#modal-submit');
  await page.locator('#modal-error').filter({hasText: 'Synthetic purchase entry control fault'}).waitFor();
  assert.equal((await gate(page)).totalCalls, 0); assert.equal(await raw(page), bytes); assert.deepEqual((await gate(page)).semantic, baseline);
  for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isEnabled(), true);
  await detail(page, result, 'entry-no-provider-warning', ['#modal-error'], /entry control fault/);
  await detail(page, result, 'entry-restored-controls', ['#modal-cancel', '#modal-submit']);
  await pointer(page, '#modal-submit'); await successful(page, result, before, scenario); return;
 }
 if (['native', 'queued-settled', 'reentrant'].includes(scenario.mode)) {
  const immediate = await page.evaluate(mode => {
   purchaseGate.reentrant = mode === 'reentrant';
   if (mode === 'queued-settled') for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', '']]) purchaseGate.dispatch(name, arg);
   void purchaseGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
   return {writes: purchaseStorage.writes, open: document.querySelector('#modal').open};
  }, scenario.mode);
  assert.deepEqual(immediate, {writes: 1, open: false}, 'Native synchronous Store completes without awaiting an extra microtask'); await frames(page);
  assert.equal((await gate(page)).totalCalls, 1);
  if (scenario.mode === 'reentrant') assert.ok((await gate(page)).reentrantChecks.every(item => item.sameTitle && item.sameOpen));
  await successful(page, result, before, scenario); return;
 }
 await page.evaluate(mode => {
  purchaseGate.armed = true;
  purchaseGate.notifyFault = mode === 'notification-before' ? 'before' : ['notification-after', 'controls'].includes(mode) ? 'after' : ['missing', 'missing-token', 'wrong-token', 'wrong-revision', 'consumed-token'].includes(mode) ? mode : null;
  purchaseStorage.failNext = ['retry', 'recovery-reentry', 'restore-controls'].includes(mode); purchaseGate.recoveryReentry = mode === 'recovery-reentry';
 }, scenario.mode);
 await assertPending(page, result, scenario, bytes);
 if (scenario.map) {await mapPublication(page, result, scenario, before, context); return;}
 if (['foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog', 'consumed-token'].includes(scenario.mode)) {await retired(page, result, before, scenario, context); return;}
 if (['disk-same', 'disk-unreadable'].includes(scenario.mode)) {
  if (scenario.mode === 'disk-same') await page.evaluate(key => {const state = JSON.parse(localStorage.getItem(key)); state.bank = String(BigInt(state.bank) + 7n); localStorage.setItem(key, JSON.stringify(state));}, KEY);
  else await page.evaluate(() => {purchaseGate.readFault = true;});
  const current = await raw(page); await release(page, 'known-before'); await frames(page);
  assert.equal(await raw(page), current); assert.equal((await gate(page)).totalCalls, 1);
  assert.equal(await page.locator('#modal-submit').isDisabled(), true); assert.match(await page.locator('#modal-error').textContent(), /not saved[\s\S]*reload/i);
  await detail(page, result, 'durable-baseline-retired', ['#modal-error'], /not saved[\s\S]*reload/i);
  await replay(page, {physical: false, navigation: false}); assert.equal((await gate(page)).totalCalls, 1); assert.equal(await raw(page), current);
  await page.evaluate(() => {purchaseGate.readFault = false;}); result.gate = safeReport(await gate(page));
  await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), current);
  result.checks.push('Typed known-unwritten error cannot retry when exact durable baseline changes at the same revision or cannot be read'); return;
 }
 if (['retry', 'recovery-reentry'].includes(scenario.mode)) {
  await release(page); await page.locator('#modal-error').filter({hasText: 'Synthetic known purchase prewrite'}).waitFor();
  let snapshot = await gate(page); assert.equal(await raw(page), bytes); assert.equal(snapshot.reloadRequired, false); assert.equal(snapshot.editable, true); assert.deepEqual(snapshot.semantic, snapshot.baseline); assert.equal(snapshot.reviewNodeRetained, true);
  for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isEnabled(), true);
  if (scenario.mode === 'recovery-reentry') {assert.deepEqual(snapshot.recoveryChecks, [{before: 1, after: 1, writes: 0}]); assert.equal(snapshot.totalCalls, 1); result.checks.push('Disabled-setter reentrant actual onsubmit/requestSubmit during known-unsaved restoration cannot nest another save; deliberate later retry succeeds');}
  await detail(page, result, 'known-unsaved-warning', ['#modal-error'], /Synthetic known purchase prewrite/);
  await detail(page, result, 'known-unsaved-controls', ['#modal-cancel', '#modal-submit']);
  await detail(page, result, 'retained-rounding', ['#rounding-input-note'], /1\.2 → 2[\s\S]*100\.1 → 200/);
  const candidate = normalize(JSON.parse(snapshot.candidates[0])); await pointer(page, '#modal-submit'); await page.waitForFunction(() => !!purchaseGate.pending);
  snapshot = await gate(page); assert.equal(snapshot.calls, 2); assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])), candidate, 'Deliberate retry keeps original insurance, fee, rounding and immutable audit'); assert.deepEqual(snapshot.semantic, snapshot.baseline);
  await release(page); await successful(page, result, before, scenario); return;
 }
 if (['deferred', 'queued-pending'].includes(scenario.mode)) {
  await page.evaluate(() => purchaseGate.write()); await frames(page); assertPurchase(await read(page), before, scenario);
  const snapshot = await gate(page); assert.equal(await raw(page), snapshot.candidates[0]); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Actual durable publication does not expose changed bank, offer or newly actionable cargo before completion');
  assert.equal(snapshot.reviewNodeRetained, true); assert.equal(snapshot.mainNodeRetained, true); assert.equal(snapshot.pending, true); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await replay(page); assert.deepEqual((await gate(page)).semantic, snapshot.baseline); assert.equal((await gate(page)).totalCalls, 1);
  if (!scenario.huge) await detail(page, result, 'durable-publication-held-footer', ['#modal-cancel', '#modal-submit']);
  await release(page); await successful(page, result, before, scenario); return;
 }
 const cleanup = ['restore-controls', 'render', 'report', 'terminal-report', 'close-before', 'close-after', 'clear-error', 'controls', 'reentrant-close'].includes(scenario.mode);
 if (cleanup) await page.evaluate(mode => {purchaseGate.cleanupFault = mode;}, scenario.mode);
 await release(page, ['unknown-before', 'unknown-after', 'contradictory', 'fulfilled-no-publication'].includes(scenario.mode) ? scenario.mode : scenario.mode === 'terminal-report' ? 'unknown-before' : 'native');
 if (scenario.mode === 'reentrant-close') {
  await frames(page); assertPurchase(await read(page), before, scenario); const snapshot = await gate(page);
  assert.deepEqual(snapshot.faults, ['reentrant-close']); assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').innerHTML(), snapshot.newer.body); assert.equal(await page.locator('#modal-error').textContent(), snapshot.newer.error); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await replay(page, {physical: false, navigation: false}); assert.equal((await gate(page)).totalCalls, 1); assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); await capture(page, result, 'reentrant-newer-dialog'); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario); return;
 }
 await terminal(page, result, before, scenario, {committed: !['unknown-before', 'fulfilled-no-publication', 'terminal-report', 'restore-controls'].includes(scenario.mode), unknown: ['unknown-before', 'fulfilled-no-publication', 'terminal-report', 'restore-controls', 'missing', 'missing-token', 'wrong-token', 'wrong-revision'].includes(scenario.mode)});
 if (cleanup) assert.deepEqual(result.gate.faults, [scenario.mode]);
}
async function writeReport() {await writeFile(join(artifacts, prefix + 'report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, mode: scenario.mode, viewport, status: 'running', checks: [], screenshots: [], layouts: [], pageErrors: [], unhandledRejections: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], errors: []};
 report.cases.push(result); let context;
 try {
  context = await contextFor(result, scenario); const page = await context.newPage(); await runBody(page, result, scenario, context); await frames(page);
  for (const key of ['pageErrors', 'unhandledRejections', 'consoleErrors', 'networkErrors', 'unexpectedRequests']) assert.deepEqual(result[key], [], key);
  assert.equal(result.screenshots.length, expectedFrames(scenario), 'Every declared overview/detail frame was captured');
  result.status = 'passed';
 } catch (error) {result.status = 'failed'; result.errors.push(errorText(error)); const page = context?.pages()[0]; if (page) {await capture(page, result, 'failure').catch(() => {}); result.failedGate = await gate(page).then(safeReport).catch(() => null);}}
 finally {context?.purchaseNetwork?.cleanup(); await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id); for (const error of result.errors) console.error(error);
}
if (process.argv.includes('--fixtures-only')) {
 for (const scenario of scenarios) {const before = fixture(scenario), next = expected(before, scenario); assertPurchase(next, before, scenario); assert.deepEqual(before.snapshots[0].offers[0].audit.dice.dice, [3, 3, 3]);}
 const simple = specification(fixture(scenarios[0]), scenarios[0]); assert.equal(simple.cost, '20006'); assert.equal(simple.fee, '0'); assert.equal(simple.args.insurance, null);
 const insured = specification(fixture(scenarios[1]), scenarios[1]); assert.equal(insured.fee, '1501'); assert.equal(insured.args.insurance.rate, 10, '70% coverage table 8% plus Amber 2 points once'); assert.equal(insured.args.insurance.premium, '2001', 'Independent integer ceiling: ceil(20006 × 10 / 100)'); assert.equal(insured.debit, '23508'); assert.deepEqual(insured.args.insurance.zones, ['Amber']); assert.equal(insured.args.insurance.destination, '2,1'); assert.equal(insured.args.insurance.route.includes('3,1'), false);
 const rounded = specification(fixture(scenarios[4]), scenarios[4]); assert.equal(rounded.cost, '20100'); assert.equal(rounded.fee, '1600'); assert.equal(rounded.args.insurance.premium, '200'); assert.equal(rounded.debit, '21900');
 const priceDrift = scenarios.find(scenario => scenario.mode === 'offer-change'); assert.equal(specification(fixture(priceDrift), priceDrift).debit, '1050');
 assert.ok(BigInt(specification(fixture(scenarios[7]), scenarios[7]).cost) > BigInt(Number.MAX_SAFE_INTEGER));
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), app = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/); assert.match(app, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 for (const name of ['createPurchaseWriteOwner', 'completePurchaseWrite']) assert.match(app, new RegExp('function ' + name + '\\('));
 assert.match(app, /saveContext:'purchase-save'/); assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length); assert.equal(screenshotOptions.caret, 'initial');
 console.log(`PASS: purchase economic oracles, immutable saved dice/audit, atomic selected-route insurance, retained Cr100 rounding, huge credits, exact Undo and version-tagged owner wiring; ${scenarios.length} scenarios / ${cases.length} representative browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile), ${report.declaredScreenshots} frames declared. Chromium was NOT launched.`);
} else {
 await mkdir(artifacts, {recursive: true}); const started = Date.now(); let timeout;
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT to exact requested head'); assert.equal(report.testedCommit, report.requestedCommit);
  report.workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim(); assert.equal(report.workingTree, '', 'Exact-head evidence needs clean checkout; generated artifacts are gitignored');
  report.sourceSHA256 = Object.fromEntries(await Promise.all(['app.mjs', 'persistence.mjs', 'campaign-controller.mjs', 'state.mjs', 'rules.mjs'].map(async name => [name, hash(await readFile(new URL('../js/' + name, import.meta.url)))])));
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright'); browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})}); report.browser = {name: 'Chromium', version: browser.version()};
  timeout = setTimeout(() => {report.errors.push('Fourteen-minute browser evidence budget exhausted'); void browser.close();}, report.limits.durationMs);
  for (const {scenario, viewport} of cases) {assert.ok(Date.now() - started < report.limits.durationMs, 'Bounded suite duration'); await runCase(scenario, viewport);}
  const files = (await readdir(artifacts)).filter(name => name.startsWith(prefix)); report.screenshotCount = files.filter(name => name.endsWith('.jpg')).length;
  assert.equal(report.screenshotCount, report.declaredScreenshots, 'Complete declared desktop/mobile frame coverage');
  assert.equal(report.screenshotCount, report.cases.reduce((sum, result) => sum + result.screenshots.length, 0), 'Every recorded screenshot is present exactly once');
  assert.ok(report.cases.every(result => result.screenshots.length > 0), 'Every case has actual browser evidence');
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((a, b) => a + b, 0);
  assert.ok(report.artifactBytes < report.limits.artifactBytes - 262144, 'Combined native/browser evidence stays below 24 MiB');
 } catch (error) {report.errors.push(errorText(error));}
 finally {clearTimeout(timeout); await browser?.close(); report.durationMs = Date.now() - started; report.finishedAt = new Date().toISOString(); report.passed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'passed'); await writeReport();}
 if (!report.passed) throw Error('Purchase completion Chromium checks failed; see verification-artifacts/purchase-completion-report.json');
 console.log(`PASS: ${report.declaredCases} production purchase completion cases; native locks, atomic economics, reload/Undo and bounded desktop/mobile evidence.`);
}
