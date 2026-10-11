// Bounded Stage 2 expense completion gate. Actual expense DOM callbacks,
// discovered version-tagged Store, native Web Locks, unchanged economics.
// Test-owned provider wrappers separate native write/publication from settlement.
// Cache responses are held at the network; RO/rAF callbacks are only observed.
// No local browser is needed for --fixtures-only. Exact-head CI runs Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {expenseQuote} from '../js/expenses.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const prefix = 'expense-completion-', KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const kinds = ['mortgage', 'maintenance', 'salary', 'berthing', 'rate'];
const labels = {mortgage: 'Mortgage', maintenance: 'Monthly maintenance', salary: 'Crew salaries', berthing: 'Port costs', rate: 'Port costs'};
const scenarios = kinds.flatMap(kind => ['native', 'deferred', 'retry'].map(mode => ({id: kind + '-' + mode, kind, mode, dual: mode !== 'retry' || kind === 'rate'})));
for (const mode of ['validation', 'entry-controls', 'unknown-before', 'unknown-after', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token', 'wrong-revision', 'duplicate', 'foreign-same', 'foreign-before', 'foreign-new', 'disk-only', 'editor-regain', 'queued-pending', 'queued-settled', 'reentrant', 'new-surface', 'navigation-reentry', 'render', 'report', 'controls']) scenarios.push({id: 'mortgage-' + mode, kind: 'mortgage', mode, dual: ['unknown-before', 'contradictory', 'foreign-same', 'render', 'entry-controls', 'validation', 'navigation-reentry'].includes(mode)});
scenarios.push({id: 'mortgage-huge', kind: 'mortgage', mode: 'huge', dual: true}, {id: 'maintenance-huge', kind: 'maintenance', mode: 'huge'}, {id: 'berthing-zero', kind: 'berthing', mode: 'zero', dual: true}, {id: 'rate-chain', kind: 'rate', mode: 'chain', dual: true});
const cases = scenarios.flatMap(scenario => sizes.filter(size => size.width === 1440 || scenario.dual).map(viewport => ({scenario, viewport})));
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 65, caret: 'initial'});
const successPattern = /(?:Paid (?:mortgage|monthly maintenance|crew salaries|port costs) saved\.|Payment recorded|Starport berthing rate saved\.)/i;
const terminalModes = new Set(['unknown-before', 'unknown-after', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token', 'wrong-revision', 'render', 'report', 'controls']);
const staleModes = new Set(['duplicate', 'foreign-same', 'foreign-before', 'foreign-new', 'disk-only', 'editor-regain', 'new-surface']);
const hash = value => createHash('sha256').update(value).digest('hex');
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'jumpAttempts'].includes(key)));
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const action = (page, name) => page.locator('[data-action="' + name + '"]:visible').first();
const gate = page => page.evaluate(() => expenseGate.snapshot());
const release = (page, kind = 'native') => page.evaluate(kind => expenseGate.release(kind), kind);
const errorText = error => error?.stack || String(error);
const submitName = scenario => scenario.kind === 'rate' ? 'expense-berthing-rate' : 'expense-pay';
const report = {suite: 'Expense panel save completion', startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null, declaredCases: cases.length, cases: [], errors: [], scope: 'All four expense payments and saved starport rate. Actual production DOM callbacks, versioned Store and native locks; native synchronous and separate write/publication/settlement; typed retry, provenance, ownership, real cache/ResizeObserver paintMap identity, exact economics/reload/History Undo, desktop/mobile overview and visible detail evidence. Synthetic campaigns only; no deployment, no sale-case changes. SVG contains no expense amount/rate: strict map evidence protects presentation ownership, not a demonstrated direct economic SVG leak.', limits: {durationMs: 14 * 60 * 1000, artifactBytes: 24 * 1024 * 1024}};
let browser;
function normalize(value) {
 const ids = new Map();
 return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, id => {if (!ids.has(id)) ids.set(id, 'generated-' + ids.size); return ids.get(id);}));
}
function fixture(scenario) {
 const s = S.initial(), origin = {id: '1,1', x: 1, y: 1, name: 'Expense Origin', sector: 'Synthetic', hex: '0202', uwp: scenario.mode === 'zero' ? 'E788879-C' : 'A788879-C', zone: 'Safe'};
 const destination = {...origin, id: '2,1', x: 2, name: 'Expense Destination', hex: '0302'};
 Object.assign(s, {initialized: true, name: 'Disposable expense completion campaign', bank: '90071992547409931234567890', actual: origin.id, worlds: {[origin.id]: origin, [destination.id]: destination}, route: [origin.id, destination.id], dateLabel: '001-1105', hours: 49});
 Object.assign(s.ship, {name: 'Expense Trader', capacity: '100', staterooms: 2, fuel: configureFuel(200, 40, 40, 0, 2), lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}}, accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}, expenses: {salary: '12001'}, mortgage: {originalAmount: '24000000', payment: scenario.mode === 'huge' ? '9007199254740993' : '100003', remainingPayments: scenario.mode === 'huge' ? 1000000 : 360, totalPaid: '12000000', nextDueDate: '029-1105'}, maintenance: {payment: scenario.mode === 'huge' ? '9007199254740993' : '2003', nextDueDate: '015-1105', paidSinceTracking: '4006'}});
 s.settings.creditStep = 100;
 if (scenario.kind !== 'rate' && scenario.mode !== 'zero') origin.berthingRate = {port: 'A', die: 2};
 s.dashboardBaseline = createDashboardBaseline(s); return S.validate(s);
}
function fields(scenario) {return scenario.kind === 'rate' ? {} : scenario.kind === 'salary' ? {payments: '3', monthly: '12301'} : scenario.kind === 'berthing' ? {weeks: '3'} : {payments: scenario.mode === 'huge' ? '1000000' : '2'};}
function input(scenario) {
 const f = fields(scenario), kind = scenario.kind;
 return {kind, ...(kind === 'mortgage' || kind === 'maintenance' ? {[kind + 'Payments']: f.payments} : kind === 'salary' ? {monthly: f.monthly, months: f.payments} : {weeks: f.weeks})};
}
function expected(before, scenario) {
 return S.transition(before, scenario.kind === 'rate' ? 'Saved starport berthing rate' : 'Paid ' + labels[scenario.kind].toLowerCase(), s => {
  if (scenario.kind === 'rate') S.saveBerthingRate(s, 3);
  else {S.shipExpense(s, input(scenario)); s.ledger.at(-1).paidAt ??= {dateLabel: s.dateLabel, hours: s.hours};}
 });
}
function assertSaved(saved, before, scenario) {
 assert.deepEqual(normalize(saved), normalize(expected(before, scenario)), 'Entire campaign equals unchanged production transition, including receipts/audit/inverse Undo');
 assert.equal(saved.revision, before.revision + 1); assert.equal(saved.undo.length, before.undo.length + 1);
 assert.equal(saved.ledger.length, before.ledger.length + (scenario.kind === 'rate' ? 0 : 1));
 for (const key of ['actual', 'hours', 'dateLabel', 'route', 'lots', 'contracts', 'policies', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key], key);
 assert.deepEqual(material(S.undo(saved)), material(before), 'Every economic field is exactly reversible');
 if (scenario.kind === 'rate') assert.equal(saved.bank, before.bank);
 else {
  const q = expenseQuote(before.worlds[before.actual], {...input(scenario), creditStep: before.settings.creditStep, recurringShip: before.ship});
  assert.equal(saved.bank, String(BigInt(before.bank) - BigInt(q.amount)));
  assert.deepEqual(saved.ledger.at(-1).paidAt, {dateLabel: before.dateLabel, hours: before.hours});
  if (scenario.kind === 'salary') assert.equal(q.amount, '37000');
  if (scenario.mode === 'zero') assert.equal(q.amount, '0');
  if (['mortgage', 'maintenance'].includes(scenario.kind)) assert.equal(q.amount, String(BigInt(before.ship[scenario.kind].payment) * BigInt(fields(scenario).payments)), 'Fixed cost is exempt from Credit rounding');
 }
}
function compactSnapshot(snapshot) {return snapshot && {...snapshot, regions: snapshot.regions.map(({html, ...region}) => ({...region, htmlLength: html?.length ?? null, htmlSHA256: html == null ? null : hash(html)}))};}
function compactGate(g) {return {...g, candidates: g.candidates.map(hash), baseline: compactSnapshot(g.baseline), snapshots: g.snapshots.map(compactSnapshot), paintEdges: g.paintEdges.map(compactSnapshot)};}
function assertFrozen(before, after) {
 assert.equal(after.pending, true); assert.equal(after.settlements, before.settlements);
 assert.deepEqual(after.regions, before.regions, after.label + ': exact SVG, panel, summary, status markup and node identity');
 assert.equal(after.dice, before.dice);
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
 await context.exposeBinding('__expenseUnhandled', (_source, message) => result.unhandledRejections.push(message));
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__expenseUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const nativeSet = Storage.prototype.setItem;
  globalThis.expenseStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this === sessionStorage && name === 'traveller-expense-receipt-route' && globalThis.expenseGate?.navigationReentry) {
    expenseGate.navigationReentry = false; expenseGate.navigationCalls++; document.querySelector('#notes').click(); expenseGate.newerPanel = document.querySelector('#modal-body').innerHTML; expenseGate.newerNode = document.querySelector('#modal-body').firstElementChild; expenseGate.newerMessage = document.querySelector('#message').textContent;
   }
   if (this !== localStorage || name !== key) return Reflect.apply(nativeSet, this, [name, value]);
   expenseStorage.attempts++; expenseStorage.observations.push({message: document.querySelector('#message')?.textContent || '', receipt: !!document.querySelector('.expense-receipt')});
   if (expenseStorage.failNext) {expenseStorage.failNext = false; throw Error('Synthetic known expense prewrite rejection');}
   const result = Reflect.apply(nativeSet, this, [name, value]); expenseStorage.writes++; return result;
  };
  globalThis.expenseDiceCalls = 0; const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {expenseDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.expenseMapCallbacks = {scheduled: 0, executed: 0, cacheScheduled: 0, cacheExecuted: 0, resizeDelivered: 0};
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || '');
   expenseMapCallbacks.scheduled++; if (cache) expenseMapCallbacks.cacheScheduled++;
   return Reflect.apply(raf, this, [function(time) {
    expenseMapCallbacks.executed++; if (cache) expenseMapCallbacks.cacheExecuted++;
    globalThis.expenseGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.expenseGate?.paintEdge('after', cache); return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) expenseMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 let held, releaseHold, heldOnce = false;
 const apiWorlds = Object.values(fixture(scenario).worlds).map(w => ({Name: w.name, Hex: w.hex, UWP: w.uwp, PBG: '703', Zone: '', WorldX: w.x, WorldY: w.y, Sector: w.sector}));
 await context.route('**/*', async route => {
  try {
   const url = new URL(route.request().url());
   if (url.href === new URL('verification/expense-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable native expense peer</title>'});
   if (url.origin === new URL(base).origin) return route.continue();
   const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
    assert.equal(url.searchParams.get('milieu'), 'M1105');
    if (url.pathname.endsWith('/jumpworlds')) {
     if (scenario.mode === 'deferred' && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {heldOnce = true; held = {url: url.href, released: false}; result.mapResponse = held; await new Promise(resolve => {releaseHold = resolve;}); held.released = true;}
     return route.fulfill({json: {Worlds: apiWorlds}, headers});
    }
    if (url.pathname.endsWith('/universe')) return route.fulfill({json: {Sectors: []}, headers});
    if (url.pathname.endsWith('/metadata')) return route.fulfill({json: {Subsectors: []}, headers});
    if (url.pathname.endsWith('/sec')) return route.fulfill({json: '', headers});
   }
   result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
  } catch (error) {result.fixtureErrors.push(errorText(error)); await route.abort('failed').catch(() => {});}
 });
 return {context, network: {async waitHeld() {const end = Date.now() + 10000; while (!held && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25)); assert.ok(held, 'Genuine MapAreaCache 0,0 request reached network fixture');}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}}};
}

async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(s => s.type === 'module' && /\/app\.mjs(?:\?|$)/.test(s.src))?.src;
  if (!appURL) throw Error('Actual app module missing');
  const appSource = await (await fetch(appURL)).text(), specifier = appSource.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing'); const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Production Store must be version-tagged');
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const panelSpecifier = appSource.match(/import\s*\{[^}]*\bcreateExpensePanels\b[^}]*\}\s*from\s*['"]([^'"]*expense-panels\.mjs[^'"]*)['"]/u)?.[1];
  if (!panelSpecifier) throw Error('Actual expense module import missing'); const expenseURL = new URL(panelSpecifier, appURL).href; if (!new URL(expenseURL).search) throw Error('Production expense panel must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save;
  const g = globalThis.expenseGate = {armed: false, pending: null, store: null, args: null, totalCalls: 0, executions: 0, candidates: [], forwarded: [], publications: [], settlements: [], faults: [], fault: null, notifyFault: null, reentrant: false, reentrantChecks: [], baseline: null, snapshots: [], paintEdges: [], paintEdgesDropped: 0, strict: false, phase: 'prepared', nextId: 0, nodeIds: new WeakMap(), savedActions: [], navigationReentry: false, navigationCalls: 0, newerPanel: null, newerMessage: null, newerNode: null, mutationCount: 0, mutations: []};
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextId), g.nextId)) : null;
  const observer = new MutationObserver(records => {if (!g.strict || !g.pending?.executed) return; g.mutationCount += records.length; for (const record of records) if (g.mutations.length < 30) g.mutations.push({phase: g.phase, type: record.type, target: record.target.id || record.target.nodeName, attribute: record.attributeName});});
  const selectors = ['.world-map', '#map-load-status', '.planned-route', '#expense-panel', '#summary', '#message', '#save-status'];
  g.capture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, dice: expenseDiceCalls, regions: selectors.map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict || !g.pending?.executed) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.capture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const fault = name => {g.fault = null; g.faults.push(name); throw Error('Synthetic expense ' + name + ' fault');};
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {if (g.settlements.length && g.fault === 'render' && this.id === 'main') fault('render'); return Reflect.apply(html.set, this, [value]);}});
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (g.settlements.length && g.fault === 'report' && this.id === 'message' && /saved\./i.test(value) && !/Reload/.test(value)) fault('report');
   return Reflect.apply(text.set, this, [value]);
  }});
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (this.dataset?.action?.startsWith('expense-')) {
    if (g.fault === 'entry-controls' && value === true && !g.totalCalls) fault('entry-controls');
    if (g.fault === 'controls' && g.settlements.length && value === true) fault('controls');
   }
   return Reflect.apply(disabled.set, this, [value]);
  }});
  g.dispatch = (name, arg = '') => {const b = document.createElement('button'); b.type = 'button'; b.dataset.action = name; b.dataset.arg = arg; document.body.append(b); b.click(); b.remove();};
  g.remember = () => {g.savedActions = [...document.querySelectorAll('#expense-panel [data-action]')].map(b => ({name: b.dataset.action, arg: b.dataset.arg})); g.form = document.querySelector('#expense-form');};
  g.replay = () => {for (const b of g.savedActions) g.dispatch(b.name, b.arg); if (g.form?.isConnected) g.form.requestSubmit();};
  function observeStore(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const change = store.onChange;
   store.onChange = function(...args) {
    const record = {revision: args[0].revision, tokenPresent: args[1]?.saveToken != null, tokenMatches: args[1]?.saveToken === g.args?.[2], actualCallback: false};
    g.publications.push(record);
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before expense publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2]; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true;
    if (g.reentrant) {g.replay(); g.reentrantChecks.push({point: 'publication', receipt: !!document.querySelector('.expense-receipt'), calls: g.totalCalls});}
    if (g.notifyFault === 'duplicate') {g.notifyFault = null; Reflect.apply(change, this, args); record.duplicate = true;}
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after expense publication');}
    return result;
   };
  }
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.totalCalls++; g.candidates.push(JSON.stringify(args[0]));
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision, tokenDistinct: g.totalCalls < 2 || args[2] !== g.lastToken}); g.lastToken = args[2];
   if (g.reentrant) {g.replay(); g.reentrantChecks.push({point: 'provider', receipt: !!document.querySelector('.expense-receipt'), calls: g.totalCalls});}
   if (!g.armed) return Reflect.apply(nativeSave, this, args);
   if (g.pending) throw Error('Duplicate expense Store call while pending');
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: null, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native expense write executes exactly once'); g.baseline = g.capture('immediately-before-native-write'); if (g.strict) for (const node of document.querySelectorAll('#main,#summary,#message,#save-status')) observer.observe(node, {subtree: true, childList: true, characterData: true, attributes: true}); p.executed = true; g.executions++; try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;} g.snapshots.push(g.capture('synchronously-after-native-publication'));};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending expense provider');
   if (kind === 'unknown-before') {g.pending = null; g.settlements.push({kind, executed: false}); p.reject(Error('Synthetic unknown expense outcome before write')); return;}
   if (!p.executed) g.write(); g.pending = null;
   if (kind === 'unknown-after' || kind === 'contradictory') {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory no-write after owned publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after expense write'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.snapshot = () => ({totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, snapshots: g.snapshots, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, callbacks: {...expenseMapCallbacks}, storage: {...expenseStorage}, dice: expenseDiceCalls, newerPanel: g.newerPanel, newerMessage: g.newerMessage, navigationCalls: g.navigationCalls, newerNodeRetained: !!g.newerNode?.isConnected, mutationCount: g.mutationCount, mutations: g.mutations, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL, storeURL, expenseURL, expensePanelsHash: await digest(await (await fetch(expenseURL)).text()), appHash: await digest(appSource), storeHash: await digest(await (await fetch(storeURL)).text())};
 });
 assert.equal(result.runtime.appHash, report.sourceHashes.app); assert.equal(result.runtime.storeHash, report.sourceHashes.store); assert.equal(result.runtime.expensePanelsHash, report.sourceHashes.expensePanels);
}

const desktopDetailCases = new Set(['mortgage-native', 'mortgage-deferred', 'mortgage-retry', 'mortgage-unknown-before', 'mortgage-contradictory', 'mortgage-foreign-same', 'mortgage-huge', 'rate-native', 'rate-chain']);
function detailTargets(label, scenario, width) {
 if (width === 1440 && !desktopDetailCases.has(scenario.id)) return [];
 if (label === 'pending' || label === 'held') return ['#expense-status', scenario.kind === 'rate' ? '[data-action="expense-berthing-rate"]' : '.expense-actions'];
 if (label === 'retry' || label === 'payment-retry' || label === 'rate-retry') return ['#expense-status', scenario.kind === 'rate' && label !== 'payment-retry' ? '[data-action="expense-berthing-rate"]' : '.expense-actions'];
 if (label === 'terminal') return ['#save-status', '#message'];
 if (label === 'stale') return ['#expense-status'];
 if (label === 'validation') return ['#expense-quote', '.expense-actions'];
 if (label === 'entry') return ['#expense-status', '.expense-actions'];
 if (label === 'saved' && scenario.mode === 'huge') return ['.expense-receipt', '#summary .stat:has(.label:text-is("Credits"))'];
 if (label === 'rate-saved' || label === 'saved' && scenario.kind === 'rate' && scenario.mode !== 'chain') return ['#message', '#expense-panel'];
 if (label === 'new-surface') return ['#modal-title'];
 return ['.expense-receipt'];
}
function captureLabels(scenario) {
 if (scenario.mode === 'navigation-reentry') return ['new-surface'];
 if (scenario.mode === 'deferred') return ['pending', 'held', 'saved'];
 if (scenario.mode === 'retry') return ['retry', 'saved'];
 if (scenario.mode === 'chain') return ['rate-retry', 'rate-saved', 'payment-retry', 'saved'];
 if (scenario.mode === 'validation') return ['validation', 'saved'];
 if (scenario.mode === 'entry-controls') return ['entry', 'saved'];
 if (terminalModes.has(scenario.mode)) return ['terminal'];
 if (staleModes.has(scenario.mode)) return [scenario.mode === 'new-surface' ? 'new-surface' : 'stale'];
 return ['saved'];
}
report.declaredScreenshots = cases.reduce((count, {scenario, viewport}) => count + captureLabels(scenario).reduce((n, label) => n + 1 + detailTargets(label, scenario, viewport.width).length, 0), 0);
async function capture(page, result, scenario, label) {
 const scrolls = await page.evaluate(() => ({x: scrollX, y: scrollY, nodes: [...document.querySelectorAll('#expense-panel,#service-panel,.overview-right,.world-screen')].map(node => ({id: node.id, top: node.scrollTop}))}));
 const shot = async (suffix, selector = null) => {
  await frames(page);
  if (selector) {
   const target = page.locator(selector).first(); await target.scrollIntoViewIfNeeded(); await frames(page);
   const geometry = await target.evaluate(node => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node); let clipTop = 0, clipBottom = innerHeight;
    for (let p = node.parentElement; p; p = p.parentElement) {const s = getComputedStyle(p); if (/auto|scroll|hidden|clip/.test(s.overflowY)) {const box = p.getBoundingClientRect(); clipTop = Math.max(clipTop, box.top); clipBottom = Math.min(clipBottom, box.bottom);}}
    return {text: node.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, clipTop, clipBottom, visible: style.visibility !== 'hidden' && style.display !== 'none'};
   });
   // Whole panels can exceed the viewport. Their narrow visible target is
   // selected explicitly below rather than claiming a scrolled-away receipt.
   assert.ok(geometry.visible && geometry.width > 0 && geometry.height > 0, suffix + ': detail rendered');
   assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1, suffix + ': detail fits horizontally');
   assert.ok(geometry.top >= geometry.clipTop - 1 && geometry.bottom <= geometry.clipBottom + 1, suffix + ': requested detail fully visible, including parent clipping');
   if (selector === '.expense-receipt') {assert.match(geometry.text, /Payment recorded/); assert.match(geometry.text, /003-1105/);}
   if (label === 'terminal') assert.match(geometry.text, /Reload/i);
   if (selector.includes('Credits')) assert.equal(geometry.text.replace(/^Credits\s*/, '').replace(/[^0-9]/g, ''), (await read(page)).bank, 'Complete huge exact saved Credits appears in visible frame');
   result.details.push({label, selector, ...geometry});
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 2, suffix + ': no horizontal page overflow');
  const filename = prefix + result.id + '-' + suffix + '.jpg'; await page.screenshot({path: join(artifacts, filename), ...screenshotOptions}); result.screenshots.push(filename);
 };
 try {
  await page.evaluate(() => window.scrollTo({top: 0, left: 0, behavior: 'instant'})); await shot(label + '-overview');
  let index = 0;
  for (let selector of detailTargets(label, scenario, result.viewport.width)) {
   if (selector === '#expense-panel') selector = '#expense-panel #expense-form';
   if (selector === '#service-panel') selector = '#service-panel h2';
   await shot(label + '-detail-' + ++index, selector);
  }
 } finally {
  await page.evaluate(previous => {for (const item of previous.nodes) if (item.id) {const node = document.getElementById(item.id); if (node) node.scrollTop = item.top;} window.scrollTo({left: previous.x, top: previous.y, behavior: 'instant'});}, scrolls); await frames(page);
 }
}
async function prepare(page, scenario) {
 await page.locator('#ship-actions [data-action="ship-expenses"]').click();
 await page.getByRole('button', {name: labels[scenario.kind] + ' ›', exact: true}).click();
 for (const [name, value] of Object.entries(fields(scenario))) {await page.locator('#expense-form [name="' + name + '"]').fill(value); await page.locator('#expense-form [name="' + name + '"]').dispatchEvent('change');}
 await frames(page); await page.evaluate(() => expenseGate.remember());
}
async function start(page, scenario, {armed = true, queued = false} = {}) {
 const immediate = await page.evaluate(({name, armed, queued}) => {
  expenseGate.armed = armed;
  if (queued) for (const action of ['notes', 'buyer-search', 'search', 'world']) expenseGate.dispatch(action, action === 'world' ? '2,1' : '');
  const b = document.querySelector('#expense-panel [data-action="' + name + '"]'); if (!b) throw Error('Missing actual expense submit');
  b.click(); b.click();
  return {writes: expenseStorage.writes, receipt: !!document.querySelector('.expense-receipt'), rateForm: !!document.querySelector('#expense-form'), message: document.querySelector('#message').textContent, dice: expenseDiceCalls, pending: !!expenseGate.pending};
 }, {name: submitName(scenario), armed, queued});
 if (armed) {assert.equal(immediate.pending, true); await frames(page);}
 return immediate;
}
async function replay(page, {all = true, unrelated = false} = {}) {
 await page.evaluate(({all, unrelated}) => {
  if (all) expenseGate.replay();
  else for (const b of expenseGate.savedActions.filter(b => ['expense-pay', 'expense-berthing-rate'].includes(b.name))) expenseGate.dispatch(b.name, b.arg);
  if (unrelated) for (const name of ['notes', 'refuel', 'refill-support', 'ship-expenses', 'world', 'map-expand']) expenseGate.dispatch(name, name === 'world' ? '2,1' : '');
 }, {all, unrelated}); await frames(page);
}
async function assertHeld(page, result, scenario, bytes) {
 assert.equal(await raw(page), bytes, 'Invocation held separately: durable bytes unchanged');
 assert.equal((await gate(page)).totalCalls, 1); assert.equal(await page.locator('.expense-receipt').count(), 0);
 assert.equal(await action(page, submitName(scenario)).isDisabled(), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 const form = await page.locator('#expense-panel').innerHTML(); await page.keyboard.press('Enter'); await replay(page, {unrelated: true});
 assert.equal(await page.locator('#expense-panel').innerHTML(), form, 'Repeated queued/detached actions retain exact pending panel');
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 for (const call of (await gate(page)).forwarded) {assert.equal(call.tokenPresent, true); assert.ok(call.argumentCount >= 3); assert.equal(call.candidateRevision, call.expectedRevision + 1);}
 result.checks.push('Held invocation leaves bytes unchanged; duplicate actual clicks, detached controls, Enter-equivalent submit, Back/Cancel and unrelated actions do not write/navigate');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: expenseGate.capture('before-resize'), callbacks: {...expenseMapCallbacks}}));
 await page.evaluate(() => {expenseGate.phase = 'resize';});
 await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => expenseMapCallbacks.resizeDelivered > previous.resizeDelivered && expenseMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => expenseGate.capture('after-resize'));
 if (frozen) assertFrozen((await gate(page)).baseline, after);
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual resize paints resume and replace SVG after settlement/invalidation');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Native ResizeObserver → requestAnimationFrame → paintMap executed ' + (frozen ? 'with exact DOM identity freeze' : 'and replaced the map normally'));
}
async function strictPublication(page, result, scenario, before, network) {
 await network.waitHeld();
 await resizeProbe(page, result, {resume: true}); // old-state paints remain allowed before owned publication
 await page.evaluate(() => {expenseGate.strict = true; expenseGate.write();}); await frames(page);
 assertSaved(await read(page), before, scenario);
 let snapshot = await gate(page); for (const region of snapshot.baseline.regions) assert.ok(region.nodeId && region.html, 'Strict mounted region: ' + region.selector); assertFrozen(snapshot.baseline, snapshot.snapshots.at(-1));
 const callbacks = snapshot.callbacks;
 await page.evaluate(() => {expenseGate.phase = 'cache-response';}); network.release();
 await page.waitForFunction(n => expenseMapCallbacks.cacheExecuted > n, callbacks.cacheExecuted); await frames(page);
 snapshot = await gate(page); assert.equal(snapshot.pending, true);
 assertFrozen(snapshot.baseline, await page.evaluate(() => expenseGate.capture('after-real-cache-response')));
 await resizeProbe(page, result, {frozen: true});
 snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real MapAreaCache completion reaches observed paintMap after edge');
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize-scheduled paintMap after edge is present');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient main/SVG/panel/summary/status mutation while settlement is held');
 for (const edge of snapshot.paintEdges) assertFrozen(snapshot.baseline, edge);
 await capture(page, result, scenario, 'held');
 assertFrozen(snapshot.baseline, await page.evaluate(() => expenseGate.capture('after-evidence-capture')));
 result.checks.push('Real held MapAreaCache HTTP response and RO/rAF execute without changing SVG/panel/status markup or nodes until settlement; screenshots use caret:initial');
}
async function reloadUndo(page, result, before, scenario, {committed = true, receiptExpected = true} = {}) {
 const bytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await raw(page), bytes, 'Authoritative reload does not replay expense'); assert.equal(await page.evaluate(() => expenseStorage.writes), 0);
 if (!committed) {assert.deepEqual(await read(page), before); return;}
 assertSaved(await read(page), before, scenario);
 if (scenario.kind !== 'rate' && receiptExpected) {
  await page.locator('.expense-receipt').waitFor();
  assert.match(await page.locator('#expense-panel').textContent(), /Recorded location: Expense Origin/);
  assert.match(await page.locator('.expense-receipt').textContent(), /003-1105/);
  assert.equal(await page.locator('[data-action="expense-pay"]').count(), 0);
  await action(page, 'expense-back').click(); assert.match(await page.locator('#expense-panel').textContent(), /Regular 4-week total/); assert.equal(await raw(page), bytes);
 }
 await page.locator('#tabs [data-arg="History"]').click(); await action(page, 'undo').click(); await frames(page);
 assert.deepEqual(material(await read(page)), material(before), 'Actual History Undo restores exact bank, schedules, salary/rate, ledger and inverse data');
 assert.equal((await read(page)).revision, before.revision + 2); assert.equal(await page.evaluate(() => expenseStorage.writes), 1);
 result.checks.push('Reload keeps exact bytes/recorded date/location without replay; Back is view-only; actual History Undo restores every economic field');
}
async function success(page, result, scenario, before, {captures = true, reload = true} = {}) {
 await frames(page); assertSaved(await read(page), before, scenario);
 const snapshot = await gate(page); assert.equal(snapshot.durableToken, false); assert.equal(snapshot.reloadRequired, false); assert.equal(snapshot.editable, true);
 assert.equal(await raw(page), snapshot.candidates.at(-1)); assert.equal(snapshot.storage.writes, 1);
 assert.equal(snapshot.dice, scenario.kind === 'rate' ? 1 : 0);
 assert.match(await page.locator('#message').textContent(), /saved\.|recorded/i);
 if (scenario.kind === 'rate') {assert.equal(await page.locator('[data-action="expense-berthing-rate"]').count(), 0); await page.locator('#expense-form').waitFor();}
 else {await page.locator('.expense-receipt').waitFor(); assert.equal(await page.locator('[data-action="expense-pay"]').count(), 0);}
 for (const observation of snapshot.storage.observations) {assert.doesNotMatch(observation.message, successPattern); assert.equal(observation.receipt, false);}
 const bytes = await raw(page); await replay(page, {all: false}); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, snapshot.totalCalls); assert.equal((await gate(page)).dice, snapshot.dice, 'Obsolete rate/pay rejects before rolling or calling provider');
 if (scenario.mode === 'deferred') await resizeProbe(page, result, {resume: true});
 if (scenario.mode === 'huge') {
  assert.equal(await page.locator('.covered-payments tbody tr').count(), 0, 'Million-installment receipt remains lazy and bounded');
  assert.match(await page.locator('.covered-payments > summary').textContent(), /1000000 installments/);
 }
 if (captures) await capture(page, result, scenario, 'saved');
 result.gate = compactGate(await gate(page));
 if (reload) await reloadUndo(page, result, before, scenario);
}
async function terminal(page, result, scenario, before) {
 await page.waitForFunction(() => /Reload/i.test(document.querySelector('#save-status').textContent)); await frames(page);
 const g = await gate(page), committed = scenario.mode !== 'unknown-before';
 assert.equal(g.reloadRequired, true); assert.equal(g.editable, false); assert.equal(await page.locator('#takeover').isDisabled(), true);
 for (const selector of ['#message', '#save-status']) assert.match(await page.locator(selector).textContent(), /Reload/i);
 assert.doesNotMatch(await page.locator('#message').textContent(), /Paid mortgage saved\.$/);
 if (committed) assertSaved(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 if (scenario.mode === 'contradictory') assert.match(await page.locator('#message').textContent(), /saved[\s\S]*Reload/i, 'Observed owned publication outranks false no-write rejection');
 await capture(page, result, scenario, 'terminal'); const bytes = await raw(page); await replay(page, {all: false}); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true);
 await page.evaluate(() => {expenseGate.store.yield(); expenseGate.store.onChange(expenseGate.store.read());}); await frames(page);
 assert.equal((await gate(page)).reloadRequired, true); assert.equal((await gate(page)).editable, false); assert.match(await page.locator('#save-status').textContent(), /Reload/i);
 result.gate = compactGate(await gate(page));
 await reloadUndo(page, result, before, scenario, {committed, receiptExpected: false});
 result.checks.push('Terminal reload latch survives callbacks/detached actions, releases native Web Lock, and authoritative reload/Undo preserves durable outcome');
}

async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/expense-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.expensePeer = {state: null, editable: false}; expensePeer.store = new Store(next => {expensePeer.state = next;}, editable => {expensePeer.editable = editable;}); await expensePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => expensePeer.editable); await page.waitForFunction(() => !expenseGate.store.editable);
 if (write) await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(expensePeer.state, 'Foreign native expense-test deposit', s => S.deposit(s, 100, 'Synthetic peer')); expensePeer.store.save(next, expensePeer.state.revision);}, result.runtime);
 await peer.evaluate(() => {expensePeer.store.yield(); expensePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => expenseGate.store.acquire(true)); await page.waitForFunction(() => expenseGate.store.editable);}
 result.checks.push('Second actual version-tagged Store takes native writer Web Lock' + (write ? ' and saves a foreign revision' : '') + (regain ? '; role regain never revives original owner' : ''));
}
async function retired(page, result, scenario, before, context) {
 const {mode} = scenario;
 if (!['foreign-before', 'disk-only'].includes(mode)) {await page.evaluate(() => expenseGate.write()); await frames(page); assertSaved(await read(page), before, scenario);}
 if (mode === 'disk-only') {
  // Same-tab disk replacement intentionally has no storage event. The real
  // provider must detect the new durable revision before its held write.
  const changed = S.transition(before, 'Synthetic disk-only foreign deposit', s => S.deposit(s, 100, 'Disk changed'));
  await page.evaluate(({key, bytes}) => localStorage.setItem(key, bytes), {key: KEY, bytes: JSON.stringify(changed)});
 } else if (mode === 'foreign-new') await peerTakeover(page, result, context, {write: true});
 else if (mode === 'editor-regain') await peerTakeover(page, result, context, {regain: true});
 else if (!['duplicate', 'new-surface'].includes(mode)) await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY);
 await frames(page);
 if (!['foreign-before', 'disk-only', 'new-surface'].includes(mode)) await resizeProbe(page, result, {resume: true});
 let newer;
 if (mode === 'new-surface') {await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor(); newer = await page.locator('#modal-body').innerHTML();}
 const bytes = await raw(page); await release(page); await frames(page);
 if (mode === 'foreign-before') assertSaved(await read(page), before, scenario); else assert.equal(await raw(page), bytes);
 assert.equal(await page.locator('.expense-receipt').count(), 0, 'Retired operation does not claim an old receipt');
 assert.doesNotMatch(await page.locator('#message').textContent(), /^Paid mortgage saved\.$/);
 if (mode === 'new-surface') {assert.equal(await page.locator('#modal-body').innerHTML(), newer, 'Late owner cleanup leaves newer modal DOM exact'); await resizeProbe(page, result, {resume: true});}
 else assert.match(await page.locator('#expense-status').textContent(), /changed|Reload|stale|reopen/i);
 const saved = await raw(page), calls = (await gate(page)).totalCalls; await replay(page, {all: false}); assert.equal(await raw(page), saved); assert.equal((await gate(page)).totalCalls, calls);
 await capture(page, result, scenario, mode === 'new-surface' ? 'new-surface' : 'stale'); result.gate = compactGate(await gate(page));
 if (mode === 'foreign-new') {const paid = expected(before, scenario); assert.equal((await read(page)).bank, String(BigInt(paid.bank) + 100n)); assert.equal((await read(page)).revision, before.revision + 2);}
 if (mode === 'disk-only') {assert.equal((await read(page)).bank, String(BigInt(before.bank) + 100n)); assert.equal(result.gate.settlements.at(-1).code, 'SAVE_NOT_COMMITTED');}
 await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), saved);
 result.checks.push('Foreign publication, same-revision replacement, disk-only revision or editor loss permanently retires operation; map resumes after invalidation and late settlement cannot reclaim newer UI');
}
async function retry(page, result, scenario, before, {label = 'retry'} = {}) {
 await release(page); await page.locator('#expense-status').filter({hasText: 'Synthetic known expense prewrite'}).waitFor();
 const failed = await gate(page); assert.equal(failed.settlements.at(-1).code, 'SAVE_NOT_COMMITTED'); assert.equal(failed.settlements.at(-1).committed, false);
 assert.deepEqual(await read(page), before); assert.equal(failed.reloadRequired, false); assert.equal(failed.editable, true); assert.equal(failed.storage.writes, 0);
 for (const [name, value] of Object.entries(fields(scenario))) assert.equal(await page.locator('#expense-form [name="' + name + '"]').inputValue(), value);
 assert.equal(await action(page, submitName(scenario)).isEnabled(), true);
 await capture(page, result, scenario, label);
 await start(page, scenario); const retried = await gate(page);
 assert.deepEqual(normalize(JSON.parse(retried.candidates.at(-1))), normalize(JSON.parse(failed.candidates.at(-1))), 'Typed unwritten retry retains exact intent, salary/periods or prepared die');
 assert.equal(retried.dice, failed.dice, 'Rate retry never rolls another die');
 await release(page); await frames(page);
 result.checks.push('Typed native no-write failure preserves exact draft/prepared die and retries once without a new roll');
}
async function chain(page, result, scenario, before) {
 await page.evaluate(() => {expenseStorage.failNext = true;}); await start(page, scenario); await retry(page, result, scenario, before, {label: 'rate-retry'});
 const rateState = await read(page); assertSaved(rateState, before, scenario); await capture(page, result, scenario, 'rate-saved');
 const oldCalls = (await gate(page)).totalCalls; await replay(page, {all: false}); assert.equal((await gate(page)).totalCalls, oldCalls); assert.equal((await gate(page)).dice, 1);
 const paymentScenario = {...scenario, kind: 'berthing', mode: 'chain'};
 await page.locator('#expense-form [name="weeks"]').fill('3'); await page.locator('#expense-form [name="weeks"]').dispatchEvent('change');
 await page.evaluate(() => {expenseGate.remember(); expenseStorage.failNext = true;}); await start(page, paymentScenario); await release(page);
 await page.locator('#expense-status').filter({hasText: 'Synthetic known expense prewrite'}).waitFor(); assert.deepEqual(await read(page), rateState); assert.equal((await gate(page)).dice, 1);
 await capture(page, result, scenario, 'payment-retry'); await start(page, paymentScenario); await release(page); await frames(page);
 assertSaved(await read(page), rateState, paymentScenario);
 const g = await gate(page); assert.equal(g.totalCalls, 4); assert.equal(g.storage.writes, 2); assert.equal(g.dice, 1); assert.ok(g.forwarded.every(call => call.tokenDistinct), 'Rate, rate retry, payment and payment retry each get a separate one-use provider token');
 assert.equal((await read(page)).worlds[before.actual].berthingRate.die, 3); assert.equal((await read(page)).bank, String(BigInt(before.bank) - 9000n));
 await capture(page, result, scenario, 'saved'); result.gate = compactGate(g);
 await reloadUndo(page, result, rateState, paymentScenario);
 await action(page, 'undo').click(); await frames(page); assert.deepEqual(material(await read(page)), material(before), 'Second History Undo restores unsaved rate and original bank');
 result.checks.push('Rate failure → exact retained die → rate completion → distinct payment failure/retry; obsolete rate action never rolls and two History Undos restore original campaign');
}
async function runBody(page, result, scenario, context, network) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await page.evaluate(() => expenseStorage.writes), 0, 'Complete fixture requires no migration write');
 await installGate(page, result); const before = await read(page), bytes = await raw(page); await prepare(page, scenario);
 if (scenario.mode === 'chain') return chain(page, result, scenario, before);
 if (scenario.mode === 'navigation-reentry') {
  await page.evaluate(() => {expenseGate.navigationReentry = true;});
  const immediate = await start(page, scenario, {armed: false}); assert.equal(immediate.writes, 1); await frames(page);
  assertSaved(await read(page), before, scenario); const snapshot = await gate(page); assert.equal(snapshot.navigationCalls, 1); assert.equal(snapshot.newerNodeRetained, true);
  assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').innerHTML(), snapshot.newerPanel);
  assert.equal(await page.locator('#message').textContent(), snapshot.newerMessage); assert.doesNotMatch(snapshot.newerMessage, /^Paid mortgage saved\.$/);
  await replay(page, {all: false}); assert.equal((await gate(page)).totalCalls, 1); assert.equal((await gate(page)).newerNodeRetained, true);
  assert.equal(await page.locator('#modal-body').innerHTML(), snapshot.newerPanel); assert.equal(await page.locator('#message').textContent(), snapshot.newerMessage);
  await capture(page, result, scenario, 'new-surface'); result.gate = compactGate(await gate(page)); await reloadUndo(page, result, before, scenario);
  result.checks.push('Actual receipt-route onNavigate callback reenters actual Notes handler; old completion preserves newer modal/body/node/message and reload recovers saved receipt'); return;
 }
 if (scenario.mode === 'validation') {
  await page.locator('#expense-form [name="payments"]').fill('0'); await page.locator('#expense-form [name="payments"]').dispatchEvent('change');
  assert.equal(await action(page, 'expense-pay').isDisabled(), true);
  await page.locator('#expense-form').evaluate(form => form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))); await frames(page);
  assert.equal((await gate(page)).totalCalls, 0); assert.equal(await raw(page), bytes); await capture(page, result, scenario, 'validation');
  await page.locator('#expense-form [name="payments"]').fill('2'); await page.locator('#expense-form [name="payments"]').dispatchEvent('change');
 }
 if (scenario.mode === 'entry-controls') {
  await page.evaluate(() => {expenseGate.fault = 'entry-controls';}); await action(page, 'expense-pay').click(); await frames(page);
  assert.deepEqual((await gate(page)).faults, ['entry-controls']); assert.equal((await gate(page)).totalCalls, 0); assert.equal(await raw(page), bytes);
  assert.equal(await action(page, 'expense-pay').isEnabled(), true); await capture(page, result, scenario, 'entry');
  await action(page, 'expense-back').click(); await page.getByRole('button', {name: 'Mortgage ›', exact: true}).click();
  await page.locator('#expense-form [name="payments"]').fill('2'); await page.locator('#expense-form [name="payments"]').dispatchEvent('change'); await page.evaluate(() => expenseGate.remember());
 }
 if (['native', 'queued-settled', 'reentrant', 'validation', 'entry-controls', 'huge', 'zero'].includes(scenario.mode)) {
  await page.evaluate(mode => {expenseGate.reentrant = mode === 'reentrant';}, scenario.mode);
  const immediate = await start(page, scenario, {armed: false, queued: scenario.mode === 'queued-settled'});
  assert.equal(immediate.writes, 1, 'Native Store writes synchronously in actual production button callback');
  if (scenario.kind === 'rate') {assert.equal(immediate.rateForm, true); assert.match(immediate.message, /Starport berthing rate saved\./);}
  else assert.equal(immediate.receipt, true, 'Native completion presents receipt in same JS task without an unconditional await');
  await frames(page); assert.equal(await page.locator('#modal').evaluate(node => node.open), false, 'Queued earlier unrelated actions cannot reopen a dialog after completion');
  if (scenario.mode === 'reentrant') {assert.equal((await gate(page)).reentrantChecks.length, 2); assert.ok((await gate(page)).reentrantChecks.every(check => check.calls === 1 && !check.receipt));}
  await success(page, result, scenario, before); return;
 }
 await page.evaluate(mode => {
  expenseStorage.failNext = mode === 'retry'; expenseGate.notifyFault = mode === 'notification-before' ? 'before' : ['notification-after', 'controls'].includes(mode) ? 'after' : ['missing', 'missing-token', 'wrong-token', 'wrong-revision', 'duplicate'].includes(mode) ? mode : null;
 }, scenario.mode);
 await start(page, scenario, {queued: scenario.mode === 'queued-pending'}); await assertHeld(page, result, scenario, bytes);
 if (scenario.mode === 'deferred') {
  await capture(page, result, scenario, 'pending'); await strictPublication(page, result, scenario, before, network); await release(page); await success(page, result, scenario, before); return;
 }
 if (scenario.mode === 'retry') {await retry(page, result, scenario, before); await success(page, result, scenario, before); return;}
 if (staleModes.has(scenario.mode)) {await retired(page, result, scenario, before, context); return;}
 if (scenario.mode === 'queued-pending') {await release(page); await success(page, result, scenario, before); return;}
 if (['render', 'report', 'controls'].includes(scenario.mode)) await page.evaluate(mode => {expenseGate.fault = mode;}, scenario.mode);
 await release(page, ['unknown-before', 'unknown-after', 'contradictory'].includes(scenario.mode) ? scenario.mode : 'native');
 await terminal(page, result, scenario, before);
 if (['render', 'report', 'controls'].includes(scenario.mode)) assert.deepEqual(result.gate.faults, [scenario.mode], 'Named actual DOM fault was reached exactly once');
}
async function writeReport() {await writeFile(join(artifacts, prefix + 'report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, kind: scenario.kind, mode: scenario.mode, viewport, status: 'running', checks: [], screenshots: [], details: [], pageErrors: [], unhandledRejections: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], fixtureErrors: [], errors: []};
 report.cases.push(result); let context, network;
 try {
  ({context, network} = await contextFor(result, scenario)); const page = await context.newPage(); await runBody(page, result, scenario, context, network); await frames(page);
  for (const key of ['pageErrors', 'unhandledRejections', 'consoleErrors', 'networkErrors', 'unexpectedRequests', 'fixtureErrors']) assert.deepEqual(result[key], [], key);
  assert.equal(result.screenshots.length, captureLabels(scenario).reduce((n, label) => n + 1 + detailTargets(label, scenario, viewport.width).length, 0), 'Every declared overview and visible detail captured'); result.status = 'passed';
 } catch (error) {
  result.status = 'failed'; result.errors.push(errorText(error)); const page = context?.pages()[0];
  if (page) {const filename = prefix + result.id + '-failure.jpg'; await page.screenshot({path: join(artifacts, filename), ...screenshotOptions}).then(() => result.screenshots.push(filename)).catch(() => {}); result.failedGate = await gate(page).then(compactGate).catch(() => null);}
 } finally {network?.cleanup(); await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id); for (const error of result.errors) console.error(error);
}

const source = async name => readFile(new URL('../js/' + name + '.mjs', import.meta.url), 'utf8');
report.sourceHashes = {app: hash(await source('app')), store: hash(await source('persistence')), expensePanels: hash(await source('expense-panels')), state: hash(await source('state')), controller: hash(await source('campaign-controller')), browserGate: hash(await readFile(fileURLToPath(import.meta.url), 'utf8'))};
if (process.argv.includes('--fixtures-only')) {
 for (const scenario of scenarios) {const before = fixture(scenario); assertSaved(expected(before, scenario), before, scenario);}
 assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length);
 assert.ok(BigInt(expected(fixture(scenarios.find(s => s.mode === 'huge')), scenarios.find(s => s.mode === 'huge')).ledger.at(-1).expense.amount) > BigInt(Number.MAX_SAFE_INTEGER));
 assert.equal(screenshotOptions.caret, 'initial');
 const frozen = {label: 'fixture', pending: true, settlements: 0, dice: 1, regions: [{selector: '.world-map', nodeId: 1, html: '<svg/>'}]};
 assertFrozen(frozen, structuredClone(frozen)); for (const altered of [{...frozen, regions: [{...frozen.regions[0], nodeId: 2}]}, {...frozen, regions: [{...frozen.regions[0], html: '<svg changed/>'}]}, {...frozen, pending: false}]) assert.throws(() => assertFrozen(frozen, altered));
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), app = await source('app');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/);
 assert.match(app, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 for (const hook of ['receiveCampaign', 'invalidate', 'publicationDeferred', 'writeGeneration']) assert.match(app, new RegExp('expenseServices\\.' + hook + '\\('), 'Expense app ownership hook: ' + hook);
 console.log(`PASS: exact expense fixture/oracles, all four payments + rate, fixed rounding exemption/salary rounding/zero berthing, huge Credits/million counts, exact inverse Undo and versioned runtime wiring. ${scenarios.length} scenarios, ${cases.length} browser cases, ${report.declaredScreenshots} declared overview/detail frames. Chromium was NOT launched.`);
} else {
 await mkdir(artifacts, {recursive: true}); const began = Date.now();
 const deadline = setTimeout(() => {console.error('Expense browser gate exceeded bounded 14-minute duration'); void browser?.close();}, report.limits.durationMs); deadline.unref();
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT to exact requested commit'); assert.equal(report.testedCommit, report.requestedCommit);
  report.workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim(); assert.equal(report.workingTree, '', 'Exact-head CI requires clean checkout; artifacts are ignored');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright'); browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})}); report.browser = {name: 'Chromium', version: browser.version()};
  for (const {scenario, viewport} of cases) {assert.ok(Date.now() - began < report.limits.durationMs, 'Bounded test duration'); await runCase(scenario, viewport);}
  const files = (await readdir(artifacts)).filter(name => name.startsWith(prefix)); report.screenshotCount = files.filter(name => name.endsWith('.jpg')).length;
  assert.equal(report.screenshotCount, report.declaredScreenshots);
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((a, b) => a + b, 0);
  assert.ok(report.artifactBytes < report.limits.artifactBytes - 262144, 'Expense evidence remains below 24 MiB including final report growth');
 } catch (error) {report.errors.push(errorText(error));}
 finally {clearTimeout(deadline); await browser?.close(); report.durationMs = Date.now() - began; report.finishedAt = new Date().toISOString(); report.passed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'passed'); await writeReport();}
 if (!report.passed) throw Error('Expense completion Chromium checks failed; inspect verification-artifacts/expense-completion-report.json');
 console.log(`PASS: ${cases.length} actual expense completion cases, ${report.declaredScreenshots} bounded desktop/mobile overview/detail frames, exact economics, native Store/locks, held publication/map identity, retry/terminal/ownership, reload and History Undo.`);
}
