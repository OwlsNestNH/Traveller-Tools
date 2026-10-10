// Diagnostic only: a passing job means the probes ran, not that the pending
// presentation boundary held. Read observations in map-publication-audit-report.json.
// Native .46 Store is synchronous. The fixture delays its real write/publication
// and then its returned settlement to test the promised asynchronous boundary.
// No private UI function, campaign state, DOM setter, lock implementation or
// paint body is replaced. Provider/File.text completion is held; RO/rAF wrappers
// only observe unchanged callbacks. File.text reaches a real Overview import review.
// Run: node verification/map-publication-audit-browser.test.mjs [playwright-module]
// --fixtures-only runs native fixture/source checks without starting a browser.
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
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
import {recordWorldOverride, revertWorldField} from '../js/world-change-history.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const prefix = 'map-publication-audit-';
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url)));
const A = '1,1', B = '2,1', C = '1,2';
const scenarios = [
 {id: 'settings-inline', method: 'save', map: false, route: 'Settings tab → inline Save changes'},
 {id: 'settings-legacy-overview', method: 'save', map: true, route: 'Overview → Refuel without configured fuel → legacy Settings Save'},
 {id: 'undo-history-deposit', method: 'save', map: false, route: 'History → Undo latest change (deposit)'},
 {id: 'undo-history-world-revert', method: 'save', map: false, route: 'History → Undo latest change (individual world-field revert)'},
 {id: 'undo-jump-overview', method: 'save', map: true, route: 'Overview → Undo Jump → Use mulligan & return'},
 {id: 'import-overview-delayed-read', method: 'replace', map: true, route: 'Settings → select JSON → Overview while File.text is pending → resolve file → replacement review'},
 {id: 'reset-settings', method: 'replace', map: false, route: 'Settings → Reset campaign → backup acknowledgement → Replace campaign'}
];
const report = {
 suite: 'Pending owned-save map publication diagnostic', diagnosticOnly: true,
 startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null,
 releasedRuntimeTree: '7d0b1b7b557e5943d31e69e1c226520aa955e082', node: process.version,
 declaredCases: scenarios.length * sizes.length, cases: [], errors: [],
 fixtureView: {mapZoomPercent: 100, politicalTerritory: false, reason: 'Supported saved view preference isolates the local-world cache/paint boundary from unrelated sector catalog loading.'},
 scope: 'Synthetic actual-UI cases; discovered versioned native Store, native Web Locks, held write/publication and held settlement. Real cache-response and ResizeObserver/rAF callbacks. DOM equality and candidate-specific map semantics are observations, not product-pass assertions. Production Store is synchronous; this does not establish a naturally slow deployed write or certify completion safety. No runtime fix, live campaign, external map request, fault matrix, or keyboard-focus certification.'
};
let browser, evidenceBytes = 0;
const errorText = error => error?.stack || String(error);
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const tab = (page, name) => page.locator('#tabs [data-action="tab"][data-arg="' + name + '"]').click();
const action = (page, name) => page.locator('[data-action="' + name + '"]').filter({visible: true}).first();
const gate = page => page.evaluate(() => mapAudit.snapshot());
const successPattern = /Ship \/ trader settings saved\.|Jump undone\.|Latest action undone\.|Campaign replaced\./;

function fixture() {
 const s = S.initial();
 const origin = {id: A, x: 1, y: 1, name: 'Audit Origin', sector: 'Synthetic', hex: '0202', uwp: 'A788899-C', zone: 'Safe'};
 const destination = {...origin, id: B, x: 2, name: 'Audit Destination', hex: '0302'};
 const third = {...origin, id: C, y: 2, name: 'Audit Survey', hex: '0203'};
 Object.assign(s, {initialized: true, name: 'Disposable map audit', bank: '100000', actual: A,
  worlds: {[A]: origin, [B]: destination, [C]: third}, route: [A, B]});
 Object.assign(s.ship, {name: 'Audit Trader', capacity: '100', staterooms: 2,
  fuel: configureFuel(200, 40, 40, 0, 2),
  lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}},
  accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}});
 s.dashboardBaseline = createDashboardBaseline(s);
 return S.validate(s);
}
function seed(scenario) {
 let s = fixture();
 if (scenario.id === 'settings-legacy-overview') delete s.ship.fuel;
 if (scenario.id === 'undo-jump-overview') {
  const prepared = S.prepareJump(s, () => ({dice: [3, 3, 3, 3, 3, 3], total: 18}));
  s = S.transition(prepared.state, 'Jump: Audit Origin → Audit Destination', next => S.commitJump(next, {attemptId: prepared.attempt.id, elapsed: 160}));
 }
 if (scenario.id === 'undo-history-deposit') s = S.transition(s, 'Manual deposit', next => S.deposit(next, 125, 'Audit receipt'));
 if (scenario.id === 'undo-history-world-revert') {
  s = S.transition(s, 'World override', next => recordWorldOverride(next, A, {uwp: 'A788899-D', zone: 'Amber', fuelOverride: true, accessibleWater: true, reason: 'Audit survey'}, core));
  const event = s.events.findLast(e => e.worldChangeAudit);
  s = S.transition(s, 'World field reverted', next => revertWorldField(next, event.id, 'techLevel', core));
 }
 return S.validate(s);
}
function imported() {
 const s = fixture();
 s.revision = 91; s.name = 'Imported audit candidate'; s.actual = B; s.route = [B, A, C];
 s.worlds[A].name = 'Imported Origin'; s.worlds[B].name = 'Imported Destination';
 return S.validate(s);
}
function replacementExpected(next, revision) {
 const s = structuredClone(next); s.revision = revision + 1;
 if (s.initialized && !s.dashboardBaseline) s.dashboardBaseline = createDashboardBaseline(s);
 return S.validate(s);
}
function mapCandidate(state) {
 return {actual: state.actual, route: state.route, worlds: Object.fromEntries(Object.entries(state.worlds).map(([id, world]) => [id, {name: world.name, uwp: world.overrideUWP || world.uwp}]))};
}
function assertSaved(saved, before, scenario, submitted) {
 assert.equal(saved.revision, before.revision + 1);
 if (scenario.method === 'replace') {
  assert.deepEqual(saved, replacementExpected(submitted, before.revision));
 } else if (scenario.id.startsWith('undo-')) {
  const expected = scenario.id === 'undo-jump-overview' ? S.undoJump(before) : S.undo(before);
  expected.events.at(-1).id = saved.events.at(-1).id;
  assert.deepEqual(saved, expected, 'Exact real Undo result, normalizing only its generated audit id');
  if (scenario.id === 'undo-history-world-revert') assert.equal(saved.worlds[A].overrideUWP, 'A788899-D');
  if (scenario.id === 'undo-jump-overview') assert.equal(saved.actual, A);
 } else {
  assert.equal(saved.name, 'Settings audit candidate'); assert.equal(saved.ship.name, 'Candidate Trader');
  assert.equal(saved.ship.jump, 3); assert.deepEqual(saved.ship.fuel, configureFuel(200, 60, 45, 0, 3));
  for (const key of ['bank', 'actual', 'worlds', 'route', 'routeIndex', 'hours', 'ledger', 'lots', 'contracts', 'policies', 'dashboardBaseline']) assert.deepEqual(saved[key], before[key], key);
  assert.equal(saved.undo.length, before.undo.length + 1);
  assert.equal(saved.events.at(-1).label, 'Ship / trader settings');
  const undone = S.undo(saved);
  for (const key of ['name', 'ship', 'trader', 'settings']) assert.deepEqual(undone[key], before[key], 'Settings inverse: ' + key);
 }
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
 await context.exposeBinding('__mapAuditUnhandled', (_source, message) => result.unhandledRejections.push(message));
 await context.addInitScript(({key, bytes, origin, territoryKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__mapAuditUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(territoryKey, 'false');
  const nativeSet = Storage.prototype.setItem;
  globalThis.mapAuditStorage = {attempts: 0, writes: 0};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(nativeSet, this, [name, value]);
   mapAuditStorage.attempts++;
   const result = Reflect.apply(nativeSet, this, [name, value]); mapAuditStorage.writes++; return result;
  };
  // Observe real callbacks; never invoke, suppress, delay, or alter their bodies.
  const nativeRAF = window.requestAnimationFrame;
  globalThis.mapAuditCallbacks = {scheduled: 0, executed: 0, cacheScheduled: 0, cacheExecuted: 0, resizeDelivered: 0, resizeTargets: []};
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(nativeRAF, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || '');
   mapAuditCallbacks.scheduled++; if (cache) mapAuditCallbacks.cacheScheduled++;
   return Reflect.apply(nativeRAF, this, [function(time) {
    mapAuditCallbacks.executed++; if (cache) mapAuditCallbacks.cacheExecuted++;
    globalThis.mapAudit?.paintEdge('before', cache);
    const result = Reflect.apply(callback, this, [time]);
    globalThis.mapAudit?.paintEdge('after', cache);
    return result;
   }]);
  };
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends NativeResizeObserver {
   constructor(callback) {
    const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback));
    super(function(entries, observer) {
     if (relevant) {
      mapAuditCallbacks.resizeDelivered++;
      mapAuditCallbacks.resizeTargets = entries.map(entry => entry.target.id || entry.target.className);
     }
     return Reflect.apply(callback, this, [entries, observer]);
    });
   }
  };
  const nativeText = File.prototype.text;
  globalThis.mapAuditFile = {calls: 0, pending: null, releases: 0};
  File.prototype.text = function(...args) {
   if (this.name !== 'map-audit-delayed.json') return Reflect.apply(nativeText, this, args);
   if (mapAuditFile.pending) throw Error('Only one delayed import file is allowed');
   mapAuditFile.calls++;
   const nativeResult = Reflect.apply(nativeText, this, args);
   return new Promise((resolve, reject) => {mapAuditFile.pending = {nativeResult, resolve, reject};});
  };
  mapAuditFile.release = async () => {
   const pending = mapAuditFile.pending; if (!pending) throw Error('Missing actual delayed file read');
   mapAuditFile.pending = null; mapAuditFile.releases++;
   try {pending.resolve(await pending.nativeResult);} catch (error) {pending.reject(error);}
  };
 }, {key: KEY, bytes: JSON.stringify(seed(scenario)), origin: new URL(base).origin, territoryKey: POLITICAL_TERRITORY_KEY});
 let held = null, releaseHold, heldOnce = false;
 const apiWorlds = Object.values(fixture().worlds).map(world => ({Name: world.name, Hex: world.hex, UWP: world.uwp, PBG: '703', Zone: '', WorldX: world.x, WorldY: world.y, Sector: world.sector}));
 await context.route('**/*', async route => {
  try {
   const url = new URL(route.request().url());
   if (url.origin === new URL(base).origin) return await route.continue();
   if (url.origin !== 'https://travellermap.com' || !url.pathname.startsWith('/api/')) {
    result.unexpectedRequests.push(url.href); return await route.abort('blockedbyclient');
   }
   assert.equal(url.searchParams.get('milieu'), 'M1105');
   const endpoint = url.pathname.split('/').at(-1), headers = {'Access-Control-Allow-Origin': '*'};
   if (endpoint === 'jumpworlds') {
    // Boot's direct nearby lookup is at 1,1 or 2,1. 0,0 is a genuine
    // MapAreaCache tile. Hold its response, not application paint machinery.
    if (scenario.map && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {
     heldOnce = true; held = {url: url.href, released: false}; result.mapResponse = held;
     await new Promise(resolve => {releaseHold = resolve;}); held.released = true;
    }
    return await route.fulfill({headers, json: {Worlds: apiWorlds}});
   }
   if (endpoint === 'universe') return await route.fulfill({headers, json: {Sectors: []}});
   if (endpoint === 'metadata') return await route.fulfill({headers, json: {Subsectors: []}});
   if (endpoint === 'sec') return await route.fulfill({headers, json: ''});
   result.unexpectedRequests.push(url.href); return await route.abort('blockedbyclient');
  } catch (error) {result.fixtureErrors.push(errorText(error)); await route.abort('failed').catch(() => {});}
 });
 return {context, network: {
  get held() {return !!held && !held.released;},
  async waitHeld() {
   const end = Date.now() + 10000;
   while (!held && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25));
   assert.ok(held, 'Real 0,0 MapAreaCache request reached the fixture');
  },
  release() {assert.ok(releaseHold, 'A real held map response exists'); const release = releaseHold; releaseHold = null; release();},
  cleanup() {releaseHold?.(); releaseHold = null;}
 }};
}

async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(script => script.type === 'module' && /\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if (!appURL) throw Error('Actual app module unavailable');
  const response = await fetch(appURL); if (!response.ok) throw Error('Cannot inspect actual app import');
  const source = await response.text();
  const specifier = source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing');
  const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Expected production versioned Store');
  const storeResponse = await fetch(storeURL); if (!storeResponse.ok) throw Error('Cannot inspect actual Store');
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const appHash = await digest(source), storeHash = await digest(await storeResponse.text());
  const {Store, KEY} = await import(storeURL);
  const native = {save: Store.prototype.save, replace: Store.prototype.replace};
  const g = globalThis.mapAudit = {armed: false, pending: null, store: null, args: null, calls: 0, executions: 0,
   forwarded: [], publications: [], settlements: [], paintEdges: [], phase: 'prepared',
   baseline: null, snapshots: [], mutations: [], mutationCount: 0, nodeIds: new WeakMap(), nextId: 0};
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextId), g.nextId)) : null;
  const selectors = ['#main', '.world-map', '#map-load-status', '.planned-route', '#world-information-panel', '#summary'];
  const describe = node => node.nodeType === 1 ? node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') : node.nodeName;
  const observer = new MutationObserver(records => {
   g.mutationCount += records.length;
   for (const record of records) {
    if (g.mutations.length >= 60) break;
    g.mutations.push({phase: g.phase, type: record.type, target: describe(record.target), attribute: record.attributeName,
     added: [...record.addedNodes].slice(0, 3).map(describe), removed: [...record.removedNodes].slice(0, 3).map(describe)});
   }
  });
  const mapSemantics = () => {
   const svg = document.querySelector('.world-map'); if (!svg) return null;
   const nodes = [...svg.querySelectorAll('[data-action="map-world"]')];
   const worlds = nodes.map(node => {
    const circle = node.querySelector(':scope > circle');
    return {id: node.dataset.arg, label: node.getAttribute('aria-label'), title: node.querySelector('title')?.textContent,
     name: node.querySelector('.world-name')?.textContent, uwp: node.querySelector('.world-uwp')?.textContent || null,
     selected: node.classList.contains('selected-world'), radius: circle?.getAttribute('r'), fill: circle?.getAttribute('fill'),
     x: Number(circle?.getAttribute('cx')), y: Number(circle?.getAttribute('cy'))};
   });
   const pointList = svg.querySelector('polyline')?.points;
   const points = Array.from({length: pointList?.numberOfItems || 0}, (_, index) => {const point = pointList.getItem(index); return {x: point.x, y: point.y};});
   const routeIds = points.map(point => worlds.find(world => Math.abs(world.x - point.x) < 0.001 && Math.abs(world.y - point.y) < 0.001)?.id || 'unmatched');
   return {actualIds: worlds.filter(world => world.fill === '#62d3dd').map(world => world.id).sort(), routeIds,
    worlds: worlds.map(({x, y, ...world}) => world).sort((a, b) => a.id.localeCompare(b.id)),
    selectedIds: worlds.filter(world => world.selected).map(world => world.id).sort(),
    overviewLocation: svg.querySelector('.overview-location title')?.textContent || null};
  };
  g.capture = label => ({label, phase: g.phase, pending: !!g.pending, executed: !!g.pending?.executed, settlements: g.settlements.length,
   callbacks: {...mapAuditCallbacks}, storage: {...mapAuditStorage}, revision: JSON.parse(localStorage.getItem(KEY)).revision,
   activeTab: document.querySelector('#tabs [aria-current="page"]')?.dataset.arg,
   modal: {open: !!document.querySelector('#modal')?.open, title: document.querySelector('#modal-title')?.textContent,
    submitDisabled: !!document.querySelector('#modal-submit')?.disabled, cancelDisabled: !!document.querySelector('#modal-cancel')?.disabled,
    closeDisabled: !!document.querySelector('#modal-close')?.disabled}, message: document.querySelector('#message')?.textContent,
   regions: selectors.map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML || null};}),
   semantics: mapSemantics()});
  g.paintEdge = (edge, cache) => {
   if (!g.pending?.executed) return;
   if (g.paintEdges.length < 16) g.paintEdges.push({edge, cache, ...g.capture('actual-paintMap-' + edge)});
  };
  const observeStore = store => {
   if (g.store === store) return;
   if (g.store) throw Error('Unexpected second app Store');
   g.store = store; const change = store.onChange;
   store.onChange = function(...args) {
    const metadata = args[1], tokenName = g.pending?.method === 'replace' ? 'replacementToken' : 'saveToken';
    const publication = {revision: args[0].revision, tokenName, tokenPresent: metadata?.[tokenName] != null,
     tokenMatches: metadata?.[tokenName] === g.args?.[2], actualCallback: false,
     before: {message: document.querySelector('#message').textContent, pending: !!g.pending}};
    g.publications.push(publication);
    const value = Reflect.apply(change, this, args); publication.actualCallback = true;
    publication.after = {message: document.querySelector('#message').textContent, pending: !!g.pending};
    return value;
   };
  };
  for (const method of ['save', 'replace']) Store.prototype[method] = function(...args) {
   if (!g.armed) return Reflect.apply(native[method], this, args);
   observeStore(this);
   if (g.pending) throw Error('Duplicate provider call during held completion');
   g.calls++; g.args = args;
   g.forwarded.push({method, argumentCount: args.length, tokenPresent: args[2] != null,
    expectedRevision: args[1], candidateRevision: args[0].revision, candidate: JSON.stringify(args[0])});
   return new Promise((resolve, reject) => {g.pending = {method, store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {
   const pending = g.pending; if (!pending || pending.executed) throw Error('Native write must run exactly once');
   // The baseline is after lookup, native lock acquisition, validation, form
   // suspension and pending-control mutations, immediately before native save.
   observer.disconnect(); g.mutations = []; g.mutationCount = 0;
   g.phase = 'immediately-before-native-write'; g.baseline = g.capture(g.phase);
   observer.observe(document.querySelector('#main'), {subtree: true, childList: true, characterData: true, attributes: true});
   pending.executed = true; g.executions++; g.phase = 'native-publication';
   try {pending.result = Reflect.apply(native[pending.method], pending.store, pending.args);} catch (error) {pending.error = error;}
   g.snapshots.push(g.capture('synchronously-after-native-publication'));
  };
  g.release = () => {
   const pending = g.pending; if (!pending?.executed) throw Error('Cannot settle before the native write');
   g.phase = 'settlement'; g.pending = null;
   if (pending.error) {g.settlements.push({kind: 'native-rejected', message: pending.error.message}); pending.reject(pending.error);}
   else {g.settlements.push({kind: 'native-fulfilled'}); pending.resolve(pending.result);}
  };
  g.snapshot = () => ({calls: g.calls, executions: g.executions, pending: !!g.pending,
   providerError: g.pending?.error?.message || null, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired,
   forwarded: g.forwarded, publications: g.publications, settlements: g.settlements, callbacks: {...mapAuditCallbacks},
   storage: {...mapAuditStorage}, baseline: g.baseline, snapshots: g.snapshots, paintEdges: g.paintEdges,
   mutationCount: g.mutationCount, mutations: g.mutations, file: {calls: mapAuditFile.calls, pending: !!mapAuditFile.pending, releases: mapAuditFile.releases}});
  return {appURL, storeURL, appHash, storeHash};
 });
 assert.equal(result.runtime.appHash, report.sourceHashes.app, 'Served app bytes match exact checked-out app');
 assert.equal(result.runtime.storeHash, report.sourceHashes.store, 'Served versioned Store bytes match exact checkout');
}

async function fill(page, form, name, value) {
 const field = page.locator(form + ' [name="' + name + '"]');
 for (const detail of await field.locator('xpath=ancestor::details').all()) if (!await detail.evaluate(node => node.open)) await detail.locator(':scope > summary').click();
 await field.fill(String(value)); await field.dispatchEvent('change');
}
async function prepare(page, result, scenario) {
 if (scenario.id.startsWith('settings-')) {
  if (scenario.map) await page.locator('#ship-actions [data-action="refuel"]').click();
  else await tab(page, 'Settings');
  const form = scenario.map ? '#modal-form' : '#settings-form';
  if (scenario.map) await page.locator('#modal-title').filter({hasText: 'Ship, trader & options'}).waitFor();
  for (const [name, value] of Object.entries({name: 'Settings audit candidate', ship: 'Candidate Trader', jump: 3, shipTons: 200, fuelCapacity: 60, fuelAboard: 45, bladderTons: 0})) await fill(page, form, name, value);
 } else if (scenario.id.startsWith('undo-history-')) {
  await tab(page, 'History');
 } else if (scenario.id === 'undo-jump-overview') {
  await action(page, 'jump-undo').click();
  await page.locator('#modal-title').filter({hasText: /Undo Jump/}).waitFor();
 } else if (scenario.method === 'replace') {
  await tab(page, 'Settings');
  if (scenario.id.startsWith('import-')) {
   const chooser = page.waitForEvent('filechooser'); await action(page, 'import').click();
   result.submittedReplacement = imported();
   await (await chooser).setFiles({name: 'map-audit-delayed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(result.submittedReplacement))});
   await page.waitForFunction(() => !!mapAuditFile.pending);
   assert.equal(await page.locator('#modal').evaluate(node => node.open), false);
   await tab(page, 'Overview'); await page.locator('.world-map').waitFor();
   await page.evaluate(() => mapAuditFile.release());
   await page.locator('#modal-title').filter({hasText: 'Load campaign (JSON)'}).waitFor();
   assert.equal((await gate(page)).file.releases, 1);
  } else {
   result.submittedReplacement = S.initial(); await action(page, 'reset').click();
   await page.locator('#modal-title').filter({hasText: 'Reset campaign'}).waitFor();
  }
  await page.locator('#modal [name="backed"]').check();
 }
 await frames(page);
 assert.equal(await page.locator('.world-map').count(), scenario.map ? 1 : 0, 'Expected actual UI map reachability');
 result.reachability = {route: scenario.route, mountedMap: scenario.map, forcedNavigation: false};
}
async function start(page, scenario) {
 await page.evaluate(() => {mapAudit.armed = true;});
 if (scenario.id === 'settings-inline') await page.locator('#settings-save').click();
 else if (scenario.id.startsWith('undo-history-')) await action(page, 'undo').click();
 else await page.locator('#modal-submit').click();
 await page.waitForFunction(() => !!mapAudit.pending); await frames(page);
}
function difference(before, after) {
 if (before === after) return null;
 before ||= ''; after ||= ''; let at = 0;
 while (at < Math.min(before.length, after.length) && before[at] === after[at]) at++;
 return {firstChangedOffset: at, beforeLength: before.length, afterLength: after.length,
  before: before.slice(Math.max(0, at - 60), at + 150), after: after.slice(Math.max(0, at - 60), at + 150)};
}
function compare(before, after, candidate) {
 const map = after.semantics, old = before.semantics;
 const changed = (value, previous) => JSON.stringify(value) !== JSON.stringify(previous);
 const actualCandidateExposed = !!map && changed(map.actualIds, old?.actualIds) && JSON.stringify(map.actualIds) === JSON.stringify(candidate.actual ? [candidate.actual] : []);
 const routeCandidateExposed = !!map && changed(map.routeIds, old?.routeIds) && JSON.stringify(map.routeIds) === JSON.stringify(candidate.route);
 const candidateNamesExposed = map?.worlds.filter(world => {
  const previous = old?.worlds.find(item => item.id === world.id), next = candidate.worlds[world.id];
  return previous && next && world.label !== previous.label && world.label === 'Browse ' + next.name;
 }).map(world => world.id) || [];
 return {from: before.label, to: after.label, mountedMap: !!map,
  regions: before.regions.map((region, i) => ({selector: region.selector, sameNode: region.nodeId === after.regions[i].nodeId, html: difference(region.html, after.regions[i].html)})),
  mapSemanticsEqual: !changed(map, old), actualCandidateExposed, routeCandidateExposed, candidateNamesExposed,
  candidateSemanticLeakObserved: actualCandidateExposed || routeCandidateExposed || candidateNamesExposed.length > 0,
  interpretation: !map ? 'No map mounted on this ordinary UI path; not evidence for a map freeze.' :
   actualCandidateExposed || routeCandidateExposed || candidateNamesExposed.length ? 'Candidate-specific map semantics appeared while provider settlement was still held.' :
   changed(map, old) ? 'Map semantics changed; inspect snapshots to attribute the change.' : 'No candidate-specific map semantic change observed; inspect SVG identity/markup separately.'};
}
// Preserve the exact prewrite DOM once. Later snapshots retain semantic values,
// node identity and SHA-256/length plus small diffs, rather than repeating large
// SVG hex grids in every callback and both pending/final provider snapshots.
function compactSnapshot(snapshot) {
 if (!snapshot) return snapshot;
 return {...snapshot, regions: snapshot.regions.map(({html, ...region}) => ({...region, htmlLength: html?.length ?? null, htmlSHA256: html === null ? null : hash(html)}))};
}
function compactGate(g) {
 return {...g, baseline: compactSnapshot(g.baseline), snapshots: g.snapshots.map(compactSnapshot), paintEdges: g.paintEdges.map(compactSnapshot)};
}
async function record(page, result, label) {
 const snapshot = await page.evaluate(label => {mapAudit.phase = label; return mapAudit.capture(label);}, label);
 result.snapshots.push(compactSnapshot(snapshot)); return snapshot;
}
function assertPending(g, before, scenario, {written}) {
 assert.equal(g.calls, 1); assert.equal(g.executions, written ? 1 : 0); assert.equal(g.pending, true);
 assert.equal(g.editable, true); assert.equal(g.reloadRequired, false); assert.equal(g.providerError, null);
 assert.deepEqual(g.settlements, []); assert.equal(g.storage.writes, written ? 1 : 0);
 const call = g.forwarded[0]; assert.equal(call.method, scenario.method); assert.equal(call.argumentCount, 3);
 assert.equal(call.tokenPresent, true); assert.equal(call.expectedRevision, before.revision);
 if (scenario.method === 'save') assert.equal(call.candidateRevision, before.revision + 1);
 assert.equal(g.publications.length, written ? 1 : 0);
 if (written) {
  const publication = g.publications[0];
  assert.equal(publication.revision, before.revision + 1); assert.equal(publication.tokenPresent, true);
  assert.equal(publication.tokenMatches, true); assert.equal(publication.actualCallback, true);
  assert.equal(publication.tokenName, scenario.method === 'replace' ? 'replacementToken' : 'saveToken');
  for (const point of [publication.before, publication.after]) {assert.equal(point.pending, true); assert.doesNotMatch(point.message, successPattern);}
 }
}
async function screenshot(page, result, label) {
 const geometry = await page.evaluate(() => {
  const rect = node => {const r = node?.getBoundingClientRect(); return r ? {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height} : null;};
  const dialog = rect(document.querySelector('#modal[open]'));
  const markers = [...document.querySelectorAll('.world-map [data-action="map-world"]')].map(node => {
   const marker = rect(node.querySelector(':scope > circle'));
   return {id: node.dataset.arg, marker, inViewport: !!marker && marker.left >= 0 && marker.right <= innerWidth && marker.top >= 0 && marker.bottom <= innerHeight,
    outsideDialogRectangle: !!marker && (!dialog || marker.right <= dialog.left || marker.left >= dialog.right || marker.bottom <= dialog.top || marker.top >= dialog.bottom)};
  });
  return {viewport: {width: innerWidth, height: innerHeight}, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog, markers};
 });
 result.screenshots.push({label, geometry, pixelClaim: 'Context image only. DOM candidate findings do not imply a marker was visible through the opaque dialog.'});
 assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow in evidence');
 const bytes = await page.screenshot({type: 'jpeg', quality: 70});
 assert.ok(evidenceBytes + bytes.length < 16 * 1024 * 1024, 'Bound images below 16 MiB');
 const name = prefix + result.id + '-' + label + '.jpg'; await writeFile(join(artifacts, name), bytes);
 evidenceBytes += bytes.length; Object.assign(result.screenshots.at(-1), {name, bytes: bytes.length});
}
async function probe(page, result, scenario, before, candidate, network) {
 let g = await gate(page); assertPending(g, before, scenario, {written: true});
 const baseline = g.baseline; assert.equal(baseline.label, 'immediately-before-native-write');
 result.baseline = baseline; result.afterPublication = compactSnapshot(g.snapshots[0]);
 result.observations.push(compare(baseline, g.snapshots[0], candidate));
 if (scenario.map) {
  assert.ok(network.held, 'MapAreaCache response remains genuinely pending at native publication');
  await frames(page);
  await page.waitForFunction(() => mapAuditCallbacks.scheduled === mapAuditCallbacks.executed);
  const cacheBefore = await record(page, result, 'before-held-map-response');
  network.release();
  await page.waitForFunction(previous => mapAuditCallbacks.cacheExecuted > previous, cacheBefore.callbacks.cacheExecuted);
  await frames(page);
  const cacheAfter = await record(page, result, 'after-held-map-response');
  assert.equal(cacheAfter.pending, true); assert.equal(cacheAfter.settlements, 0);
  assert.ok(cacheAfter.callbacks.cacheExecuted > cacheBefore.callbacks.cacheExecuted, 'Actual map cache finally/onChange scheduled a real paint callback');
  result.observations.push(compare(cacheBefore, cacheAfter, candidate), compare(baseline, cacheAfter, candidate));
  await screenshot(page, result, 'held-cache-response');
 }
 for (const width of [result.viewport.width - 8, result.viewport.width]) {
  const resizeBefore = await record(page, result, 'before-resize-' + width);
  await page.setViewportSize({...result.viewport, width});
  await page.waitForFunction(previous => mapAuditCallbacks.resizeDelivered > previous, resizeBefore.callbacks.resizeDelivered);
  if (scenario.map) await page.waitForFunction(previous => mapAuditCallbacks.executed > previous, resizeBefore.callbacks.executed);
  await frames(page);
  const resizeAfter = await record(page, result, 'after-resize-' + width);
  assert.equal(resizeAfter.pending, true); assert.equal(resizeAfter.settlements, 0);
  assert.ok(resizeAfter.callbacks.resizeDelivered > resizeBefore.callbacks.resizeDelivered, 'Real map ResizeObserver callback delivered');
  if (scenario.map) assert.ok(resizeAfter.callbacks.executed > resizeBefore.callbacks.executed, 'Real scheduled paintMap callback executed');
  else assert.equal(resizeAfter.semantics, null, 'No map is mounted by a synthetic hidden action');
  result.observations.push(compare(resizeBefore, resizeAfter, candidate), compare(baseline, resizeAfter, candidate));
  assertPending(await gate(page), before, scenario, {written: true});
 }
 await screenshot(page, result, 'held-resize-restored');
}
async function runBody(page, result, scenario, network) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor();
 if (scenario.map) await network.waitHeld(); else await page.waitForLoadState('networkidle');
 await frames(page); await installGate(page, result);
 assert.equal(await page.locator('#map-territories').isChecked(), false, 'Supported saved view preference disables only political catalog loading');
 assert.doesNotMatch(await page.locator('#map-load-status').textContent(), /could not load/i, 'Fixture has no unrelated map-data failure');
 assert.equal(await page.evaluate(() => mapAuditStorage.writes), 0, 'Complete fixture needs no boot migration write');
 const before = await read(page), bytes = await raw(page); result.beforeCandidate = mapCandidate(before);
 assert.equal(await page.evaluate(async lock => (await navigator.locks.query()).held.filter(entry => entry.name === lock).length, LOCK), 1, 'Actual native writer lock is held');
 await prepare(page, result, scenario); await start(page, scenario);
 assertPending(await gate(page), before, scenario, {written: false}); assert.equal(await raw(page), bytes);
 for (const id of ['modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true, 'Pending owner freezes ' + id);
 assert.equal(await page.locator('#modal').evaluate(dialog => dialog.open), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 await page.evaluate(() => mapAudit.write());
 let g = await gate(page); assertPending(g, before, scenario, {written: true});
 const saved = await read(page);
 const submitted = scenario.method === 'replace' ? result.submittedReplacement : JSON.parse(g.forwarded[0].candidate);
 assertSaved(saved, before, scenario, submitted);
 if (scenario.method === 'save') assert.equal(await raw(page), g.forwarded[0].candidate, 'The real provider saved exactly the submitted candidate');
 result.expectedCandidate = mapCandidate(saved);
 if (scenario.map) {
  assert.deepEqual(g.baseline.semantics.actualIds, [before.actual], 'Old actual marker exists before write');
  assert.deepEqual(g.baseline.semantics.routeIds, before.route, 'Visible route projection is unambiguous at fixture baseline');
 }
 await probe(page, result, scenario, before, result.expectedCandidate, network);
 const durable = await raw(page); g = await gate(page); result.pendingGate = compactGate(g);
 assert.equal(g.publications.length, 1); assert.equal(g.settlements.length, 0);
 assert.equal(await raw(page), durable); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 await page.evaluate(() => mapAudit.release());
 await page.locator('#modal').waitFor({state: 'hidden'}); await frames(page);
 assert.match(await page.locator('#message').textContent(), successPattern);
 assert.equal(await raw(page), durable, 'Settlement performs no second write');
 assertSaved(await read(page), before, scenario, submitted);
 result.afterSettlement = compactSnapshot(await record(page, result, 'after-settlement'));
 if (scenario.map) {
  assert.deepEqual(result.afterSettlement.semantics.actualIds, [saved.actual], 'True settled actual marker matches saved state');
  assert.deepEqual(result.afterSettlement.semantics.routeIds, saved.route, 'True settled SVG route matches saved state');
  assert.deepEqual(result.afterSettlement.semantics.selectedIds, [saved.actual], 'Settled Overview is centered on the saved actual world');
 }
 if (scenario.id === 'reset-settings') await page.getByText('Bring your campaign aboard.', {exact: true}).waitFor();
 if (scenario.id === 'settings-inline') assert.equal(await page.locator('#settings-form [name="name"]').inputValue(), saved.name);
 result.finalGate = compactGate(await gate(page));
 assert.deepEqual(result.finalGate.settlements, [{kind: 'native-fulfilled'}]);
 assert.equal(result.finalGate.pending, false); assert.equal(result.finalGate.executions, 1); assert.equal(result.finalGate.storage.writes, 1);
 assert.equal(/"(?:saveToken|replacementToken)"\s*:/.test(durable), false);
 await screenshot(page, result, 'settled');
 await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor();
 await page.waitForLoadState('networkidle'); await frames(page);
 assert.equal(await raw(page), durable, 'Reload preserves exact native-save bytes');
 assert.equal(await page.evaluate(() => mapAuditStorage.writes), 0, 'Reload never repeats the save');
 result.reloadVerified = true;
 result.candidateLeakObserved = result.observations.some(item => item.candidateSemanticLeakObserved);
 result.frozenDOMObserved = result.observations.filter(item => item.from === 'immediately-before-native-write').every(item => item.regions.every(region => region.sameNode && !region.html));
 result.interpretation = result.candidateLeakObserved ? 'Candidate-specific DOM map exposure observed while settlement was held; this diagnostic passing is not a product pass.' :
  scenario.map ? 'No candidate-specific map exposure observed in these callbacks; inspect identity/markup and semantic observations separately.' : 'Negative control completed with no mounted map; does not establish map callback safety.';
}
async function writeReport() {await writeFile(join(artifacts, prefix + 'report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(scenario, viewport) {
 const result = {id: scenario.id + '-' + viewport.width, scenario: scenario.id, viewport, status: 'running',
  snapshots: [], observations: [], screenshots: [], pageErrors: [], consoleErrors: [], unhandledRejections: [], networkErrors: [], unexpectedRequests: [], fixtureErrors: [], errors: []};
 report.cases.push(result); let context, network;
 try {
  ({context, network} = await contextFor(result, scenario)); const page = await context.newPage();
  await runBody(page, result, scenario, network);
  for (const key of ['pageErrors', 'consoleErrors', 'unhandledRejections', 'networkErrors', 'unexpectedRequests', 'fixtureErrors']) assert.deepEqual(result[key], [], key);
  assert.equal(network.held, false, 'No abandoned map response'); result.status = 'probes-passed';
 } catch (error) {
  result.status = 'probe-failed'; result.errors.push(errorText(error)); const page = context?.pages()[0];
  if (page) {await screenshot(page, result, 'failure').catch(e => result.errors.push(errorText(e))); result.failedGate = await gate(page).then(compactGate).catch(() => null);}
 } finally {network?.cleanup(); await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': ' + result.id + ' | candidate DOM exposure: ' + (result.candidateLeakObserved ?? 'not established'));
 for (const error of result.errors) console.error(error);
}

const appSource = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
const storeSource = await readFile(new URL('../js/persistence.mjs', import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
report.sourceHashes = {app: hash(appSource), store: hash(storeSource)};
if (process.argv.includes('--fixtures-only')) {
 assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length);
 for (const scenario of scenarios) {
  const s = seed(scenario); S.validate(structuredClone(s)); assert.ok(s.dashboardBaseline);
  if (scenario.id.startsWith('undo-')) {
   const saved = scenario.id === 'undo-jump-overview' ? S.undoJump(s) : S.undo(s);
   assertSaved(saved, s, scenario, null);
  }
  if (scenario.id === 'settings-legacy-overview') assert.equal(s.ship.fuel, undefined);
 }
 assert.equal(imported().actual, B); assert.deepEqual(imported().route, [B, A, C]);
 assert.notEqual(imported().worlds[A].name, fixture().worlds[A].name);
 // The diagnostic classifier must distinguish geometry/identity-only rebuilds
 // from candidate actual/route/name exposure; neither is a product assertion.
 const originalMap = {actualIds: [A], routeIds: [A, B], worlds: [{id: A, label: 'Browse Audit Origin'}]};
 const originalDOM = {label: 'before', regions: [{selector: '.world-map', nodeId: 1, html: '<svg viewBox="0 0 400 400"/>'}], semantics: originalMap};
 const rebuiltDOM = {...originalDOM, label: 'resized', regions: [{selector: '.world-map', nodeId: 2, html: '<svg viewBox="0 0 392 400"/>'}]};
 const rebuild = compare(originalDOM, rebuiltDOM, mapCandidate(imported()));
 assert.equal(rebuild.mapSemanticsEqual, true); assert.equal(rebuild.candidateSemanticLeakObserved, false);
 assert.equal(rebuild.regions[0].sameNode, false); assert.ok(rebuild.regions[0].html);
 const exposedDOM = {...rebuiltDOM, label: 'candidate', semantics: {actualIds: [B], routeIds: [B, A, C], worlds: [{id: A, label: 'Browse Imported Origin'}]}};
 const exposed = compare(originalDOM, exposedDOM, mapCandidate(imported()));
 assert.equal(exposed.actualCandidateExposed, true); assert.equal(exposed.routeCandidateExposed, true);
 assert.deepEqual(exposed.candidateNamesExposed, [A]); assert.equal(exposed.candidateSemanticLeakObserved, true);
 assert.equal(compactSnapshot(originalDOM).regions[0].htmlSHA256, hash(originalDOM.regions[0].html));
 assert.equal(Object.hasOwn(compactSnapshot(originalDOM).regions[0], 'html'), false);
 S.validate(replacementExpected(imported(), 12)); S.validate(replacementExpected(S.initial(), 12));
 const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
 assert.match(html, /<script type="module" src="js\/app\.mjs\?[^\"]+"/);
 assert.match(appSource, /import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 assert.match(appSource, /function scheduleMapPaint\(\).*requestAnimationFrame\(\(\)=>\{mapPaintFrame=0;paintMap\(\);\}\)/);
 assert.match(appSource, /new ResizeObserver\(\(\)=>\{/);
 assert.match(appSource, /if\(!state\.ship\.fuel\)\{services\.close\(\);settings\(\);/);
 assert.match(appSource, /text=await file\.text\(\)/);
 assert.match(appSource, /if\(worldWriteOperation\?\.publicationDeferred&&!worldWriteOperation\.invalidated\)return;/);
 console.log(`PASS: ${scenarios.length} validated synthetic cases × ${sizes.length} widths = ${report.declaredCases} diagnostic browser probes; actual versioned Store, native callback and reachable UI wiring verified. Chromium was not launched. No presentation outcome has been observed.`);
} else {
 await mkdir(artifacts, {recursive: true});
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT to the exact requested test commit');
  assert.equal(report.testedCommit, report.requestedCommit, 'Run exactly the requested commit');
  report.workingTree = execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim();
  assert.equal(report.workingTree, '', 'Exact-head diagnostic evidence requires a clean checkout');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
  browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})});
  report.browser = {name: 'Chromium', version: browser.version()};
  for (const viewport of sizes) for (const scenario of scenarios) await runCase(scenario, viewport);
 } catch (error) {report.errors.push(errorText(error));}
 finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  report.probesPassed = report.errors.length === 0 && report.cases.length === report.declaredCases && report.cases.every(result => result.status === 'probes-passed');
  report.productSafetyVerdict = 'Not certified by this diagnostic. Review candidate exposure, no-map controls and DOM-only versus visible-marker evidence.';
  report.candidateLeakCases = report.cases.filter(result => result.candidateLeakObserved).map(result => result.id);
  await writeReport();
  const files = (await readdir(artifacts)).filter(name => name.startsWith(prefix));
  report.artifactBytes = (await Promise.all(files.map(async name => (await stat(join(artifacts, name))).size))).reduce((a, b) => a + b, 0);
  if (report.artifactBytes >= 24 * 1024 * 1024 - 65536) {report.probesPassed = false; report.errors.push('Diagnostic artifacts exceed bounded 24 MiB allowance');}
  await writeReport();
 }
 if (!report.probesPassed) throw Error('Map publication audit probe failed; inspect verification-artifacts/' + prefix + 'report.json');
 console.log(`DIAGNOSTIC COMPLETE: ${report.declaredCases} valid browser probes; ${report.candidateLeakCases.length} cases observed candidate-specific DOM map exposure. This is not a completion-safety pass.`);
}
