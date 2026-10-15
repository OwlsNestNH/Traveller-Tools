import {tradeField,existingSell} from './trade-ui.mjs';
// Bounded Stage 2 supplier/buyer contact-search completion verification.
// Production tagged app, controller, rules, S.commitContactSearch, Store and native
// Web Locks are executed unchanged. Only provider/publication/DOM boundaries are
// observed or fault-injected. No app bodies, cache callbacks or locks are mocked.
// Synthetic fixtures only. --fixtures-only NEVER starts Chromium or a web server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
import {contactSearchStatus, contactSearchPeriod} from '../js/contact-search.mjs';
import {displayDate} from '../js/calendar.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url), 'utf8'));
const KEY = 'traveller-trade-route-calculator:v1', LOCK = KEY + ':writer', prefix = 'contact-search-completion-';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const scenarios = ['supplier', 'buyer'].flatMap(kind => ['native', 'deferred', 'retry', 'unknown-before', 'unknown-after', 'foreign-same', 'new-dialog', 'map-owned'].map(mode => ({id: kind + '-' + mode, kind, mode, dual: ['native', 'deferred', 'retry', 'unknown-before', 'unknown-after'].includes(mode), map: mode === 'map-owned'})));
for (const [index, mode] of ['entry-controls', 'freeze-controls', 'restore-controls', 'recovery-reentry', 'disk-same', 'disk-unreadable', 'queued-pending', 'queued-settled', 'reentrant', 'contradictory', 'notification-before', 'notification-after', 'missing', 'missing-token', 'wrong-token', 'wrong-revision', 'consumed-token', 'fulfilled-no-publication', 'foreign-new', 'editor-regain', 'native-close', 'render', 'report', 'terminal-report', 'close-before', 'close-after', 'clear-error', 'controls', 'reentrant-close', 'map-foreign'].entries()) {
 const kind = index % 2 ? 'buyer' : 'supplier'; scenarios.push({id: kind + '-' + mode, kind, mode, map: mode === 'map-foreign'});
}
for (const kind of ['supplier', 'buyer']) for (const mode of ['entry-title-reentry', 'review-body-reentry']) scenarios.push({id: kind + '-' + mode, kind, mode});
for (const [index, drift] of ['hours', 'actual', 'date', 'trader', 'settings', 'cooldown', 'history', 'world'].entries()) scenarios.push({id: 'context-' + drift, kind: index % 2 ? 'buyer' : 'supplier', mode: 'context-drift', drift});
scenarios.push({id: 'buyer-selected-native', kind: 'buyer', mode: 'native', selected: true, dual: true}, {id: 'buyer-selected-deferred', kind: 'buyer', mode: 'deferred', selected: true, dual: true}, {id: 'buyer-selected-retry', kind: 'buyer', mode: 'retry', selected: true, dual: true});
for (const kind of ['supplier', 'buyer']) for (const method of ['normal', 'blackMarket']) scenarios.push({id: kind + '-' + method, kind, mode: 'native', method, local: true});
for (const kind of ['supplier', 'buyer']) scenarios.push({id: kind + '-unsuccessful', kind, mode: 'native', unsuccessful: true, dual: true});
scenarios.push({id:'buyer-illegal-legal-guidance',kind:'buyer',mode:'native',selected:true,illegalCargo:true,dual:true}, {id:'buyer-illegal-black-market-handoff',kind:'buyer',mode:'native',selected:true,illegalCargo:true,method:'blackMarket',dual:true});
for(const phase of ['render','title','body'])scenarios.push({id:'buyer-handoff-'+phase+'-reentry',kind:'buyer',mode:'handoff-reentry',selected:true,phase});
for(const kind of ['supplier','buyer'])for(const point of ['title','body'])for(const newer of [false,true])scenarios.push({id:kind+'-review-'+point+'-throw'+(newer?'-after-notes':''),kind,mode:'construction-throw',point,newer,dual:kind==='supplier'&&point==='body'&&!newer});
// Supplier entry is now inline under Trade; map-overlay completion belongs to
// the existing buyer modal. Four-width Buy tests assert the supplier navigation.
for(const scenario of scenarios)if(scenario.kind==='supplier'&&scenario.map){scenario.kind='buyer';scenario.id='buyer-map-after-buy-navigation-'+scenario.mode;}
const cases = scenarios.flatMap(scenario => sizes.filter(size => size.width === 1440 || scenario.dual).map(viewport => ({scenario, viewport})));
function expectedFrames(s) {
 if (s.mode === 'construction-throw') return s.newer?1:2;
 if (s.mode === 'handoff-reentry') return 1;
 if (s.mode === 'native') return 2;
 if (s.mode === 'deferred') return 4;
 if (['retry', 'recovery-reentry', 'entry-controls', 'freeze-controls'].includes(s.mode)) return 4;
 if (s.mode === 'map-owned') return 3;
 if (s.mode === 'map-foreign') return 2;
 if (s.mode === 'queued-pending') return 3;
 if (['queued-settled', 'reentrant'].includes(s.mode)) return 2;
 if (['context-drift', 'entry-title-reentry', 'review-body-reentry', 'disk-same', 'disk-unreadable', 'reentrant-close', 'foreign-same', 'foreign-new', 'editor-regain', 'native-close', 'new-dialog', 'consumed-token', 'render', 'report', 'close-after'].includes(s.mode)) return 1;
 return 2;
}
const screenshotOptions = Object.freeze({type: 'jpeg', quality: 65, caret: 'initial'});
const successPattern = /^(?:(?:supplier|buyer) search: Synthetic (?:supplier|buyer) saved\.|Buyer found\. Select cargo, then Get sale offers\.)$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const read = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closed = page => page.locator('#modal').waitFor({state: 'hidden'});
const action = (page, name, arg) => page.locator('[data-action="' + name + '"]' + (arg === undefined ? '' : '[data-arg="' + arg + '"]')).filter({visible: true}).first();
const tab = (page, name) => action(page, 'tab', name).click();
const gate = page => page.evaluate(() => contactGate.snapshot());
const release = (page, kind = 'native') => page.evaluate(kind => contactGate.release(kind), kind);
const errorText = error => error?.stack || String(error);
const material = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['revision', 'events', 'jumpAttempts'].includes(key)));
const report = {suite: 'Contact search save completion', startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null, node: process.version, declaredCases: cases.length, declaredDesktopCases: scenarios.length, declaredMobileCases: cases.length - scenarios.length, declaredScreenshots: cases.reduce((n, {scenario}) => n + expectedFrames(scenario), 0), gateSHA256: hash(await readFile(fileURLToPath(import.meta.url))), scenarios, cases: [], errors: [], limits: {durationMs: 14 * 60 * 1000, artifactBytes: 24 * 1024 * 1024, imageBytes: 20 * 1024 * 1024}, scope: 'Supplier/buyer search review and completion only. Unchanged preview/cancel/reopen generation, exact contact/time/audit/Undo, selected buyer handoff; real tagged Store/Web Locks and native SYNC; bounded ownership/provenance/reentry/fault cases, real held cache/ResizeObserver/rAF DOM freeze, mobile target-framed JPEG evidence. Not an exhaustive native fault cross-product, Sale audit or Stage 3 cache redesign.'};
let browser, imageBytes = 0;
function normalize(value) {const ids = new Map(); return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, id => {if (!ids.has(id)) ids.set(id, 'generated-' + ids.size); return ids.get(id);}));}
function fixture(scenario = scenarios[0]) {
 const s = S.initial(), origin = {id: '1,1', x: 1, y: 1, name: 'Contact Origin', sector: 'Synthetic', hex: '0202', uwp: 'A788879-C', zone: 'Safe'};
 const destination = {...origin, id: '2,1', x: 2, name: 'Contact Destination', hex: '0302'};
 Object.assign(s, {initialized: true, name: 'Disposable contact completion campaign', actual: origin.id, worlds: {[origin.id]: origin, [destination.id]: destination}, route: [origin.id, destination.id], bank: '90071992547409931234567', hours: 671});
 Object.assign(s.ship, {name: 'Contact Trader', capacity: '100', staterooms: 2, fuel: configureFuel(200, 40, 40, 0, 2), lifeSupport: {capacityHours: 672, stockUnits: {numerator: '56', denominator: '1'}}, accommodation: {rooms: {low: 0, middle: 2, high: 0}, passengers: {low: 0, middle: 0, high: 0}, crew: {low: 0, middle: 2, high: 0}}});
 Object.assign(s.trader, {broker: 2, admin: 1, streetwise: 3});
 s.lots = [{id: 'selected-lot', commodity: scenario.illegalCargo ? '61' : '11', description: 'Synthetic selected cargo', quantity: '3', basis: '10007', goodsValue: '9001', ...(scenario.illegalCargo ? {illegal:true} : {})}];
 s.snapshots = [{id: 'existing-contact', kind: 'supplier', worldId: origin.id, world: R.context(origin, core), party: origin.id + '|legacy', partyName: 'Legacy contact', startedHours: 0, hours: 1, criminal: false, success: false, options: {}, offers: []}];
 s.ledger = [{id: 'contact-opening', type: 'Opening bank', amount: s.bank, hours: 0, world: origin.id}];
 s.dashboardBaseline = createDashboardBaseline(s); return S.validate(s);
}
function specification(before, scenario) {
 const kind = scenario.kind, method = scenario.method || 'online', c = R.context(before.worlds[before.actual], core), previous = contactSearchStatus(before).previous, local = !!scenario.local, rolled = scenario.unsuccessful ? 2 : 12, characteristic = scenario.unsuccessful ? -10 : 1, duration = 2, counterparty = 2;
 const skill = local && method !== 'online' ? 2 : before.trader[core.search.methods[method].skill.toLowerCase()], port = core.search.starportDM[c.uwp.starport] || 0, total = rolled + skill + characteristic + port - previous, success = total >= 8, illegal = method === 'blackMarket', hours = duration * (method === 'online' ? 1 : 24);
 const options = {creditStep: before.settings.creditStep, illegal, skill: local ? 2 : before.trader.broker, local, counterparty, ...R.priceLimits(before.settings), maxBaseRetailEnabled: !!before.settings.maxBaseRetailEnabled, maxBaseRetail: before.settings.maxBaseRetail, useRawIllegalPrices: !!before.settings.useRawIllegalPrices, illegalGood: false};
 const offers = success && kind === 'supplier' ? R.market(c, options, core, () => 3).map(o => {const good = core.commodities.find(g => g.id === o.commodity); return {...o, id: S.uid(), remaining: o.quantity, expired: false, illegal: !!good.universallyIllegal, description: good.name, original: {quantity: o.quantity, unitPrice: o.unitPrice}};}) : [];
 const labels = {Ag:'Agricultural',As:'Asteroid',Ba:'Barren',De:'Desert',Fl:'Fluid oceans',Ga:'Garden',Hi:'High population',Ht:'High technology',Ic:'Ice-capped',In:'Industrial',Lo:'Low population',Lt:'Low technology',Na:'Non-agricultural',Ni:'Non-industrial',Po:'Poor',Ri:'Rich',Va:'Vacuum',Wa:'Water world',Amber:'Amber travel zone',Red:'Red travel zone',Safe:'Safe travel zone'};
 const defaults = core.commodities.filter(g => !g.refereeDefined && (g.common || ((illegal ? g.universallyIllegal : !g.universallyIllegal) && g.availabilityAny.some(code => c.codes.includes(code))))).map(g => ({id:g.id,name:g.name,reason:g.common?'Common goods: available on all worlds':g.availabilityAny.filter(code=>c.codes.includes(code)).map(code=>(labels[code]||code)+' ('+code+')').join(', ')}));
 const availability = success && kind === 'supplier' ? {defaults, population:c.uwp.population, uwp:c.uwp.raw, codes:[...c.codes], draws:offers.find(o=>Array.isArray(o.audit?.randomDraws))?.audit.randomDraws ?? null} : null;
 const id = S.uid(), partyName = 'Synthetic ' + kind;
 const snap = {id, kind, party: before.actual + '|' + partyName.toLowerCase(), partyName, worldId: before.actual, world:c, startedHours: before.hours, hours:before.hours+hours, criminal:illegal, options, offers, availability, success, rulesVersion:R.VERSION, interpretationVersion:2, search:{method,contactPeriod:contactSearchPeriod(before,id),dateLabel:before.dateLabel,generatedDice:{dice:[3,3],total:6},effectiveTotal:rolled,skill,characteristic,port,previous,total,difficulty:8,successOverride:false,durationDie:duration,hours,localSkillDice:local?{dice:[3,3],total:6}:null,fixerWarning:false}};
 return {snap, inputs:{party:partyName,method,dice:rolled,duration,characteristic,counterparty,localSkill:2}, hours};
}
function expected(before, scenario) {const {snap} = specification(before, scenario); return S.transition(before, scenario.kind + ' search: ' + snap.partyName, s => S.commitContactSearch(s, snap, {revision: before.revision}));}
function assertSearch(saved, before, scenario) {
 assert.deepEqual(normalize(saved), normalize(expected(before, scenario)), 'Exact single unchanged S.commitContactSearch transition, generated offers/dice, period audit and inverse Undo');
 assert.equal(saved.revision, before.revision + 1); assert.equal(saved.undo.length, before.undo.length + 1); assert.equal(saved.hours, before.hours + specification(before, scenario).hours); assert.equal(saved.snapshots.length, before.snapshots.length + 1);
 const snap = saved.snapshots.at(-1); assert.equal(snap.startedHours, 671); assert.equal(snap.search.previous, 1); assert.equal(snap.search.contactPeriod.resetsHours, 672); assert.equal(contactSearchStatus(saved).previous, 0, 'Attempt uses original start period even after completion crosses reset');
 for (const key of ['bank','lots','ledger','contracts','policies','actual','worlds','route','routeIndex','cooldowns','dashboardBaseline']) assert.deepEqual(saved[key], before[key], key + ' unchanged');
 assert.deepEqual({...saved.ship,lifeSupport:before.ship.lifeSupport},before.ship,'Only original elapsed-time life support consumption changes ship');
 assert.deepEqual(material(S.undo(saved)), material(before), 'Search Undo restores exact original clock, snapshots and economic data');
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
 await context.exposeBinding('__contactUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__contactUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.contactStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   contactStorage.attempts++; contactStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (contactStorage.failNext) {contactStorage.failNext = false; throw Error('Synthetic known contact prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); contactStorage.writes++; return result;
  };
  globalThis.contactDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {contactDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.contactMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.contactMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); contactMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    contactMapCallbacks.executed++; if (cache) contactMapCallbacks.cacheExecuted++;
    globalThis.contactGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.contactGate?.paintEdge('after', cache);
    contactMapCallbacks.completed++; if (cache) contactMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.contactGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {contactMapCallbacks.loadingCacheCompleted++; contactMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.contactMapLoadingStatusNode = statusNode;}
    globalThis.contactGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.contactGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.contactGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) contactMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 let held, releaseHold, heldOnce = false;
 context.contactNetwork = {async waitHeld() {const end = Date.now() + 10000; while (!held && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25)); assert.ok(held, 'Real MapAreaCache tile reached network fixture'); return {...held};}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/contact-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable contact native Store peer</title>'});
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
  const g = globalThis.contactGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
  Object.assign(g, {timeline: [], timelineDropped: 0, constructionChecks: []});
  g.trace = (event, detail = {}) => {const entry = {order: g.timeline.length + 1, at: performance.now(), event, ...detail}; if (g.timeline.length < 120) g.timeline.push(entry); else g.timelineDropped++; return entry;};
  Object.assign(g, {strict: false, paintEdges: [], paintEdgesDropped: 0, mutationCount: 0, phase: 'review', nextNodeId: 0, nodeIds: new WeakMap()});
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextNodeId), g.nextNodeId)) : null;
  g.mapNodeId = nodeId;
  g.mapCapture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, regions: ['.world-map', '#map-load-status', '.planned-route', '#modal-body', '#summary', '#ship-actions', '#tabs', '#message', '#save-status'].map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.mapCapture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const observer = new MutationObserver(records => {if (g.strict) g.mutationCount += records.length;});
  g.beginStrict = () => {g.strict = true; g.mapBaseline = g.mapCapture('strict-baseline'); for (const selector of ['#main', '#modal-body', '#summary', '#ship-actions', '#tabs', '#message', '#save-status']) observer.observe(document.querySelector(selector), {subtree: true, childList: true, attributes: true, characterData: true});};
  g.endStrict = () => {g.strict = false; observer.disconnect();};
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: contactDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic contact completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^(?:supplier|buyer) search: .* saved\.$/s.test(value)) fault('report');
   if (settled() && g.cleanupFault === 'terminal-report' && this.id === 'message' && /Reload/.test(value)) fault('terminal-report');
   const result = Reflect.apply(text.set, this, [value]);
   if(g.constructionThrow?.point==='title'&&this.id==='modal-title'&&/^Review (?:supplier|buyer) search$/.test(value))g.throwConstruction();
   if (g.handoffFault === 'title' && this.id === 'modal-title' && /^Review sale/.test(value)) {g.handoffFault=null;g.constructionFault='handoff-title';g.replaceConstruction();}
   if (g.constructionFault === 'title' && this.id === 'modal-title') g.replaceConstruction();
   return result;
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {
   if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render');
   const result=Reflect.apply(html.set,this,[value]);
   if(g.constructionFault==='supplier-entry'&&this.id==='main'&&value.includes('id="supplier-form"'))g.replaceConstruction();
   if(g.constructionThrow?.point==='body'&&this.id==='modal-body'&&/^Review (?:supplier|buyer) search$/.test(document.querySelector('#modal-title').textContent))g.throwConstruction();
   if(g.handoffFault==='render'&&this.id==='main'&&contactStorage.writes>0){g.handoffRenderCount=(g.handoffRenderCount||0)+1;if(g.handoffRenderCount===2){g.handoffFault=null;g.constructionFault='handoff-render';g.replaceConstruction();}}
   if(g.handoffFault==='body'&&this.id==='modal-body'&&/^Review sale/.test(document.querySelector('#modal-title').textContent)){g.handoffFault=null;g.constructionFault='handoff-body';g.replaceConstruction();}
   if(g.constructionFault==='body'&&this.id==='modal-body')g.replaceConstruction();return result;
  }});
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
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic contact entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: contactStorage.writes});
   }
   if (settled() && ['restore-controls', 'controls'].includes(g.cleanupFault) && this.id === 'modal-cancel' && value === false) fault(g.cleanupFault);
   return Reflect.apply(disabled.set, this, [value]);
  }});
  g.dispatch = (name, arg = '') => {const button = document.createElement('button'); button.type = 'button'; button.dataset.action = name; button.dataset.arg = arg; document.body.append(button); button.click(); button.remove();};
  g.replaceConstruction = () => {
   // This direct onclick calls notes() before safely() reaches its await. The
   // delegated data-action route yields at services.action and is NOT a valid
   // synchronous construction-reentry boundary.
   const point = g.constructionFault, previousHandler = document.querySelector('#modal-form').onsubmit; g.constructionFault = null; g.faults.push('construction-' + point); document.querySelector('#notes').click();
   g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit = document.querySelector('#modal-form').onsubmit;
   const check = {point, title: g.newer.title, handlerInstalled: typeof g.newerSubmit === 'function', handlerChanged: g.newerSubmit !== previousHandler, submitHidden: document.querySelector('#modal-submit').hidden, open: document.querySelector('#modal').open};
   g.constructionChecks.push(g.trace('inside-setter-newer-notes', check));
   if (check.title !== 'Rules & Notes' || !check.handlerInstalled || !check.handlerChanged || !check.submitHidden || !check.open) throw Error('Synchronous Notes construction did not complete inside setter');
  };
  g.throwConstruction = () => {
   const fault=g.constructionThrow;g.constructionThrow=null;
   const observation={point:fault.point,newer:fault.newer,writes:contactStorage.writes,providerCalls:g.totalCalls,title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML};
   if(fault.newer){g.constructionFault='review-'+fault.point+'-throw-after-notes';g.replaceConstruction();observation.message=document.querySelector('#message').textContent;}
   (g.constructionFailures??=[]).push(observation);
   throw Error('Synthetic contact review '+fault.point+' construction failure');
  };
  g.replay = () => {
   const before = semantic(), open = document.querySelector('#modal').open;
   for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', ''], ['search', ''], ['buyer-search', ''], ['sale-clear', ''], ['sale-all', '']]) g.dispatch(name, arg);
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before contact publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after contact publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this); if (g.readFault) throw Error('Synthetic unreadable durable contact baseline'); return Reflect.apply(nativeRead, this, args);};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending contact'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native contact write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending contact completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known contact prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown contact outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory contact not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable contact'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: contactMapCallbacks.cacheCompleted, loadingCacheCompleted: contactMapCallbacks.loadingCacheCompleted});};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...contactStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, mainNodeRetained: !!g.mainNode?.isConnected, newer: g.newer, recoveryChecks: g.recoveryChecks, callbacks: {...contactMapCallbacks}, bootstrap: g.bootstrap, mapReadiness: g.mapReadiness, retainedBaselineOrder: g.retainedBaselineOrder, constructionChecks: g.constructionChecks, constructionFailures:g.constructionFailures, timeline: g.timeline, timelineDropped: g.timelineDropped, mapBaseline: g.mapBaseline, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, mutationCount: g.mutationCount, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = contactStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || contactStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
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
 imageBytes += bytes.length; assert.ok(imageBytes < report.limits.imageBytes, 'Bounded screenshot bytes'); result.screenshots.push(name); (result.imageSHA256 ??= {})[name] = hash(bytes); (result.frameProvenance ??= []).push({name, producerCommit: report.testedCommit, appSHA256: result.runtime?.appSHA256 ?? report.sourceSHA256?.['app.mjs'] ?? null, gateSHA256: report.gateSHA256, imageSHA256: hash(bytes), bytes: bytes.length});
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Contact search dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Contact search content stays inside dialog');}
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
 if(!await page.locator('#modal').evaluate(el=>el.open)&&await page.locator('#supplier-form').count()){if(selector==='#modal-submit')selector='#supplier-form button[type="submit"]';else if(selector==='#modal-cancel')selector='[data-action="supplier-cancel"]';}
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function fill(page, name, value) {const input = await tradeField(page,name); await input.fill(String(value)); await input.blur();}
async function fillSearch(page, before, scenario) {
 const {inputs} = specification(before, scenario);
 for (const [name, value] of Object.entries(inputs)) {if (name === 'method') await (await tradeField(page,'method')).selectOption(value); else await fill(page, name, value);}
 if (scenario.local) await (await tradeField(page,'local')).check();
}
async function openSearchEntry(page,scenario,{wait=true}={}){
 if(scenario.map){await page.evaluate(kind=>contactGate.dispatch('buyer-search'),scenario.kind);}
 else{
  await tab(page,'Trade');await page.locator('[data-action="trade-side"][data-arg="'+(scenario.kind==='buyer'?'sell':'buy')+'"]').click();
  if(scenario.kind==='buyer'||!await page.locator('#supplier-form').count())await action(page,scenario.kind==='buyer'?'buyer-search':'search').click();
 }
 if(wait)await page.getByRole('heading',{name:'Find a '+scenario.kind,exact:true}).waitFor();
}
async function prepare(page, scenario, before, {loops = false, network = null} = {}) {
 if (scenario.selected) {await existingSell(page); await action(page, 'sale-all').click();}
 await tab(page, scenario.map ? 'Overview' : 'Trade');
 const open = async () => {
  const priorDice = await page.evaluate(() => contactDiceCalls);
  await openSearchEntry(page,scenario);
  assert.equal(await page.evaluate(()=>contactDiceCalls),priorDice,'Opening entry rolls no dice');
  await fillSearch(page, before, scenario); await pointer(page, '#modal-submit');
  await page.locator('#modal-title').filter({hasText: new RegExp('^Review ' + scenario.kind + ' search$')}).waitFor(); await frames(page);
  assert.equal((await gate(page)).totalCalls, 0); assert.deepEqual(await read(page), before, 'Search input and generated preview write nothing');
  assert.equal(await page.locator('#modal-error').textContent(), '');
 };
 await open();
 if (loops) {
  const first = await page.locator('#modal-body').textContent(), priorDice = await page.evaluate(() => contactDiceCalls);
  await pointer(page, '#modal-cancel'); await closed(page); assert.deepEqual(await read(page), before); await open();
  assert.equal(await page.locator('#modal-body').textContent(), first, 'Deterministic fresh-generation fixture displays equivalent review');
  assert.ok(await page.evaluate(() => contactDiceCalls) > priorDice, 'Cancel/reopen intentionally regenerates the original preparation rolls; only accepted-save retry forbids reroll');
 }
 await page.evaluate(() => document.activeElement?.blur()); await frames(page);
 if (scenario.map) {
  const held = await network.waitHeld(); assert.equal(held.released, false);
  await page.waitForFunction(() => contactMapCallbacks.loadingCacheCompleted > 0 && contactMapLoadingStatusNode === document.querySelector('#map-load-status') && /Loading map data/.test(document.querySelector('#map-load-status')?.textContent || ''));
  await page.evaluate(held => {
   if (contactGate.totalCalls || contactGate.pending || contactStorage.writes) throw Error('Map readiness must precede provider work');
   contactGate.mapReadiness = contactGate.trace('initial-cache-ready', {heldURL:held.url,heldResponseReleased:held.released,callbacks:{...contactMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:contactGate.mapNodeId(contactMapLoadingStatusNode)});
  }, held);
 }
 await page.evaluate(() => contactGate.remember());
}
async function replay(page, {physical = true, navigation = true} = {}) {
 if (physical) {for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) await pointer(page, '#' + id, 2); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');}
 await page.evaluate(navigation => {const form = document.querySelector('#modal-form'); if (contactGate.oldSubmit) void contactGate.oldSubmit({preventDefault() {}, currentTarget: form}); form.requestSubmit(); if (navigation) contactGate.replay();}, navigation); await frames(page);
}
async function assertPending(page, result, scenario, bytes) {
 if (scenario.mode === 'queued-pending') await page.evaluate(() => {for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', '']]) contactGate.dispatch(name, arg); void contactGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});});
 else if (scenario.mode === 'deferred') {await page.locator('#modal-submit').focus(); await page.keyboard.press('Enter');}
 else await pointer(page, '#modal-submit', 2);
 await page.waitForFunction(() => !!contactGate.pending); await frames(page);
 assert.equal(await raw(page), bytes, 'Held provider leaves exact durable bytes alone');
 let snapshot = await gate(page); assert.deepEqual(snapshot.semantic, snapshot.baseline, 'Pending contact preserves exact review, main, summary and saved dice');
 assert.equal(snapshot.reviewNodeRetained, true); assert.equal(snapshot.mainNodeRetained, true);
 for (const id of ['modal-submit', 'modal-cancel', 'modal-close']) assert.equal(await page.locator('#' + id).isDisabled(), true, id + ' frozen synchronously');
 for (const control of await page.locator('#modal-body input, #modal-body select, #modal-body textarea').all()) assert.equal(await control.isDisabled(), true, 'Every editable contact field freezes before provider entry');
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 await replay(page); snapshot = await gate(page); assert.equal(snapshot.totalCalls, 1); assert.equal(snapshot.calls, 1); assert.equal(await raw(page), bytes); assert.deepEqual(snapshot.semantic, snapshot.baseline);
 for (const forwarded of snapshot.forwarded) {assert.ok(forwarded.argumentCount >= 3); assert.equal(forwarded.tokenPresent, true); assert.equal(forwarded.candidateRevision, forwarded.expectedRevision + 1);}
 if (scenario.mode === 'deferred') await detail(page, result, 'pending-before-write-footer', ['#modal-cancel', '#modal-submit']);
 result.checks.push('One provider call; frozen Close/X/Escape, Enter, detached/duplicate callbacks, queued tab/world/deposit, unrelated selection and replacement actions');
}
async function reloadUndo(page, result, before, scenario, {committed = true} = {}) {
 const bytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal(await page.evaluate(() => contactStorage.writes), 0, 'Reload must not replay a search');
 if (!committed) {assert.deepEqual(await read(page), before); return;}
 assertSearch(await read(page), before, scenario);
 await tab(page, 'History'); await action(page, 'undo').click(); await closed(page); await frames(page);
 assert.deepEqual(material(await read(page)), material(before)); assert.equal((await read(page)).revision, before.revision + 2); assert.equal(await page.evaluate(() => contactStorage.writes), 1);
 result.checks.push('Reload preserves exact saved bytes; real History Undo restores original snapshots/clock and leaves all economics unchanged');
}
async function successful(page, result, before, scenario) {
 const legalMismatch=scenario.illegalCargo&&scenario.method!=='blackMarket';
 const handoff = scenario.kind === 'buyer' && !scenario.unsuccessful && scenario.selected&&!legalMismatch;
 if (handoff) await page.locator('#modal-title').filter({hasText: /^Review sale.*Synthetic buyer$/}).waitFor(); else await closed(page);
 await frames(page); assertSearch(await read(page), before, scenario);
 const snapshot = await gate(page), saved = await read(page), snap = saved.snapshots.at(-1);
 assert.equal(await raw(page), snapshot.candidates.at(-1)); assert.equal(snapshot.storage.writes, 1); assert.equal(snapshot.durableToken, false); assert.equal(snapshot.reloadRequired, false); assert.equal(await page.locator('#modal-error').textContent(), '');
 assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(), 'Trade', 'Owned completion publishes the Trade tab');
 assert.equal(snapshot.semantic.dice, snapshot.baseline.dice + (handoff ? 3 : 0), 'Accepted save/retry never rerolls; only requested buyer sale quote rolls once after success');
 if (scenario.kind === 'supplier') assert.equal(await page.locator('#snapshot-select').inputValue(), snap.id, 'Correct saved supplier snapshot is selected');
 if(legalMismatch){assert.equal(await page.locator('#message').textContent(),'Illegal cargo needs a black-market buyer.');assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);}
 else if (!handoff) assert.match(await page.locator('#message').textContent(), successPattern);
 else {assert.match(await page.locator('#modal-body').textContent(), /Synthetic selected cargo/); assert.equal(saved.lots.length, before.lots.length); assert.equal(saved.ledger.length, before.ledger.length);}
 for (const item of [...snapshot.observations, ...snapshot.storage.observations]) assert.doesNotMatch(item.message, successPattern, 'Success never precedes provider completion');
 assert.equal(snapshot.publications.filter(p => p.tokenMatches && p.snapshotMatches && p.actualCallback).length, 1);
 const bytes = await raw(page), calls = snapshot.totalCalls, title = await page.locator('#modal-title').textContent();
 await page.evaluate(() => {void contactGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, calls); assert.equal(await page.locator('#modal-title').textContent(), title, 'Detached commit handler cannot close newer sale preparation');
 if (handoff) {await detail(page,result,'saved-buyer-handoff',['#modal-title'],/^Review sale/); await pointer(page,'#modal-cancel'); await closed(page);}
 else await detail(page,result,'saved-success',['#message'],legalMismatch?/^Illegal cargo needs a black-market buyer\.$/:successPattern);
 // Campaign time is an Overview-only control in both released and current UI.
 // First prove the owned Trade/handoff result above, then inspect its saved clock.
 await tab(page, 'Overview'); await frames(page);
 assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(), 'Overview');
 assert.equal(await raw(page), bytes, 'Inspecting the saved clock cannot charge search time again');
 const clock = await gate(page); assert.equal(clock.totalCalls, calls); assert.equal(clock.semantic.dice, snapshot.semantic.dice, 'Clock navigation cannot regenerate contacts or sale quotes');
 assert.equal(await page.locator('#ship-actions .campaign-time .value').textContent(), displayDate(saved.dateLabel, saved.hours), 'Overview shows the exact successfully saved campaign date/hour');
 await detail(page,result,'saved-campaign-time',['#ship-actions .campaign-time .value'],new RegExp(displayDate(saved.dateLabel,saved.hours).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 result.gate = safeReport(await gate(page)); await reloadUndo(page,result,before,scenario);
}
async function terminal(page, result, before, scenario, {committed, unknown = false} = {}) {
 await page.waitForFunction(() => /Reload/.test(document.querySelector('#save-status').textContent)); await frames(page);
 const snapshot = await gate(page), guidance = unknown ? /(?:Supplier|Buyer) search save outcome could not be confirmed[\s\S]*Reload/i : /(?:Supplier|Buyer) search saved, but[\s\S]*Reload/i;
 assert.match(await page.locator('#save-status').textContent(), guidance);
 if (scenario.mode !== 'terminal-report') assert.match(await page.locator('#message').textContent(), guidance);
 assert.equal(snapshot.editable, false); assert.equal(snapshot.reloadRequired, true); assert.equal(await page.locator('#takeover').isDisabled(), true);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (committed) assertSearch(await read(page), before, scenario); else assert.deepEqual(await read(page), before);
 if (await page.locator('#modal').evaluate(el => el.open)) {
  assert.equal(await page.locator('#modal-submit').isDisabled(), true);
  await detail(page, result, 'terminal-warning', ['#modal-error'], guidance);
  await detail(page, result, 'terminal-controls', ['#modal-cancel', '#modal-submit']);
 } else await detail(page, result, 'terminal-banner', ['#save-status'], guidance);
 const bytes = await raw(page); await replay(page, {physical: false, navigation: false}); assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 await page.waitForFunction(async lock => (await navigator.locks.query()).held.every(entry => entry.name !== lock), LOCK);
 assert.equal(await page.evaluate(lock => navigator.locks.request(lock, {ifAvailable: true}, held => !!held), LOCK), true, 'Terminal outcome releases real writer lock');
 await page.evaluate(() => {contactGate.store.yield(); contactGate.store.onChange(contactGate.store.read());}); await frames(page);
 assert.equal((await gate(page)).reloadRequired, true); assert.equal((await gate(page)).editable, false); assert.match(await page.locator('#save-status').textContent(), guidance);
 result.gate = safeReport(await gate(page)); assert.equal(result.gate.storage.writes, committed ? 1 : 0);
 await reloadUndo(page, result, before, scenario, {committed});
 result.checks.push('Terminal saved/unknown state is latched before reporting, releases native lock and rejects replay; reload restores authoritative bytes');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/contact-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.contactPeer = {state: null, editable: false}; contactPeer.store = new Store(next => {contactPeer.state = next;}, editable => {contactPeer.editable = editable;}); await contactPeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => contactPeer.editable); await page.waitForFunction(() => contactGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(contactPeer.state, 'Foreign deposit during contact save', s => S.deposit(s, 7, 'Synthetic peer')); contactPeer.store.save(next, contactPeer.state.revision); return contactPeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {contactPeer.store.yield(); contactPeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => contactGate.store.acquire(true)); await page.waitForFunction(() => contactGate.store.editable);}
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
 else assertSearch(await read(page), before, scenario);
 assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {void contactGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 if (mode === 'foreign-same') await detail(page, result, 'stale-owner-warning', ['#modal-error'], /Campaign or editing ownership changed/);
 else await capture(page, result, 'retired-owner');
 result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign/consumed publication, editor tenure and modal replacement retire old success/cleanup authority permanently');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: contactGate.mapCapture('before-resize'), callbacks: {...contactMapCallbacks}}));
 await page.evaluate(() => {contactGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => contactMapCallbacks.resizeDelivered > previous.resizeDelivered && contactMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => contactGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.contactNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {contactGate.beginStrict(); contactGate.write();}); await frames(page); assertSearch(await read(page), before, scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {contactGate.phase = 'cache-response'; contactGate.trace('held-cache-release-requested');}); context.contactNetwork.release();
 await page.waitForFunction(n => contactMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => contactGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => contactGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page, result, {resume: true}); await release(page); await frames(page); assertSearch(await read(page), before, scenario); assert.doesNotMatch(await page.locator('#message').textContent(), successPattern);
  await detail(page, result, 'foreign-map-warning', ['#modal-error'], /Campaign or editing ownership changed/); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Trade'); await tab(page,'Overview'); await frames(page); await resizeProbe(page,result,{resume:true}); await tab(page,'Trade'); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function runBody(page, result, scenario, context) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact:true}).waitFor(); await frames(page);
 assert.equal(await page.evaluate(() => contactStorage.writes), 0, 'Complete synthetic seed needs no migration write');
 await installGate(page,result); const before = await read(page), bytes = await raw(page), mode = scenario.mode;
 if(mode==='construction-throw') {
  await openSearchEntry(page,scenario);await page.getByRole('heading',{name:'Find a '+scenario.kind,exact:true}).waitFor();await fillSearch(page,before,scenario);
  const priorMessage=await page.locator('#message').textContent();
  await page.evaluate(({point,newer})=>{contactGate.oldSubmit=document.querySelector('#modal-form').onsubmit;contactGate.constructionThrow={point,newer};},scenario);
  await pointer(page,'#modal-submit');await frames(page);
  const snapshot=await gate(page),dice=snapshot.semantic.dice;
  assert.equal(snapshot.totalCalls,0,'Final-review construction failure never enters provider');assert.equal(snapshot.storage.writes,0);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assert.equal(await raw(page),bytes);assert.equal(snapshot.constructionFailures.length,1);assert.equal(snapshot.constructionFailures[0].point,scenario.point);assert.equal(snapshot.constructionFailures[0].title,'Review '+scenario.kind+' search');assert.equal(snapshot.constructionFailures[0].providerCalls,0);
  if(scenario.newer){
   assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#message').textContent(),snapshot.constructionFailures[0].message);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===contactGate.newerSubmit),true);assert.equal(await page.locator('#modal-submit').isHidden(),true);
  } else {
   assert.equal(await page.locator('#modal').evaluate(node=>node.open),true);assert.equal(await page.locator('#modal-error').textContent(),'This contact search was not saved. The review could not be prepared. Close and reopen a new search.');assert.equal(await page.locator('#message').textContent(),priorMessage);assert.doesNotMatch(await page.locator('#modal-error').textContent(),/saved, but|outcome could not be confirmed|Reload/i);assert.equal(await page.locator('#modal-submit').isDisabled(),true);for(const id of ['modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  }
  await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>contactDiceCalls),dice,'Retired partial review and detached handler cannot regenerate or retry');
  if(scenario.newer){assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#message').textContent(),snapshot.constructionFailures[0].message);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===contactGate.newerSubmit),true);await detail(page,result,'throw-after-newer-notes',['#modal-body .notes-list article:first-child'],/Rules and verification/);}
  else{await detail(page,result,'partial-review-not-saved',['#modal-error'],/not saved[\s\S]*Close[\s\S]*reopen/i);await detail(page,result,'partial-review-close-controls',['#modal-cancel','#modal-submit']);}
  await pointer(page,'#modal-cancel');await closed(page);await openSearchEntry(page,scenario);await page.getByRole('heading',{name:'Find a '+scenario.kind,exact:true}).waitFor();assert.equal(await page.evaluate(()=>contactDiceCalls),dice,'Fresh entry generates no rolls until explicit review');await pointer(page,'#modal-cancel');await closed(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);
  result.gate=safeReport(await gate(page));result.checks.push('Actual final-review '+scenario.point+' setter '+(scenario.newer?'installs synchronous newer Notes then throws; newer DOM/handler/message stay owned':'throws after owner binding; partial review retires with accurate no-save Close/reopen guidance')+'; zero provider, no retry/reroll, explicit later reopen remains usable');return;
 }
 if (['entry-title-reentry','review-body-reentry'].includes(mode)) {
  await tab(page,'Trade');
  if (mode === 'entry-title-reentry') await page.evaluate(kind => {contactGate.constructionFault=kind==='supplier'?'supplier-entry':'title';},scenario.kind);
  await openSearchEntry(page,scenario,{wait:mode!=='entry-title-reentry'});
  if (mode === 'review-body-reentry') {
   await page.getByRole('heading',{name:'Find a '+scenario.kind,exact:true}).waitFor(); await fillSearch(page,before,scenario);
   await page.evaluate(() => {contactGate.oldSubmit=document.querySelector('#modal-form').onsubmit;contactGate.constructionFault='body';}); await pointer(page,scenario.kind==='supplier'?'#supplier-form button[type="submit"]':'#modal-submit');
  }
  await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor(); await frames(page);
  const snapshot=await gate(page); assert.equal(snapshot.constructionChecks.length,1); assert.equal(snapshot.constructionChecks[0].handlerChanged,true); assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);
  assert.equal(await page.evaluate(() => document.querySelector('#modal-form').onsubmit===contactGate.newerSubmit),true,'Retired contact construction cannot overwrite newer Notes handler');
  await page.evaluate(() => {if(contactGate.oldSubmit)void contactGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();}); await frames(page);
  assert.equal(await page.locator('#modal-title').textContent(),snapshot.newer.title); assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body); assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error); assert.equal(await page.locator('#modal-submit').isHidden(),true); assert.equal((await gate(page)).totalCalls,0); assert.equal(await raw(page),bytes);
  await detail(page,result,'newer-read-only-notes',['#modal-body .notes-list article:first-child'],/Rules and verification/); await pointer(page,'#modal-cancel'); await closed(page);
  await page.evaluate(() => contactGate.dispatch('deposit')); await page.locator('#modal-title').filter({hasText:/^Record deposit$/}).waitFor(); await fill(page,'amount','17'); await fill(page,'reason','Synthetic newer modal handler'); await pointer(page,'#modal-submit'); await page.locator('#modal-title').filter({hasText:/^Confirm deposit$/}).waitFor(); assert.equal((await gate(page)).totalCalls,0); assert.equal(await raw(page),bytes); await pointer(page,'#modal-cancel'); await closed(page);
  result.gate=safeReport(await gate(page)); result.checks.push('Synchronous Notes onclick executes inside title/body setter, keeps newer DOM/handler/Close ownership; old and real submit cannot write; subsequent Deposit preview works'); return;
 }
 await prepare(page,scenario,before,{loops:mode==='deferred',network:context.contactNetwork});
 if(mode==='handoff-reentry') {
  await page.evaluate(phase=>{contactGate.handoffFault=phase;},scenario.phase);
  await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);
  const snapshot=await gate(page);assertSearch(await read(page),before,scenario);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].point,'handoff-'+scenario.phase);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);
  assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===contactGate.newerSubmit),true);
  const savedBytes=await raw(page);await page.evaluate(()=>{void contactGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
  assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),savedBytes);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-submit').isHidden(),true);
  await detail(page,result,'buyer-handoff-newer-notes',['#modal-body .notes-list article:first-child'],/Rules and verification/);await pointer(page,'#modal-cancel');await closed(page);result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
  result.checks.push('Actual synchronous Notes onclick during buyer handoff '+scenario.phase+' setter preserves newer Notes DOM and handler after exactly one search save; no replay, second search or sale');return;
 }
 if(mode==='context-drift') {
  await page.evaluate(({drift,kind})=>{
   const s=contactGate.lastState;
   if(drift==='hours')s.hours++;
   if(drift==='actual')s.actual='2,1';
   if(drift==='date')s.dateLabel='002-1105';
   if(drift==='trader')s.trader.admin++;
   if(drift==='settings')s.settings.maxBaseRetailEnabled=!s.settings.maxBaseRetailEnabled;
   if(drift==='cooldown')s.cooldowns[s.actual+'|synthetic '+kind]=s.hours+10;
   if(drift==='history')s.snapshots[0].partyName='Changed historical search';
   if(drift==='world')s.worlds[s.actual].uwp='B788879-C';
  },scenario);
  await pointer(page,'#modal-submit'); await frames(page); assert.equal((await gate(page)).totalCalls,0); assert.equal(await raw(page),bytes);
  assert.match(await page.locator('#modal-error').textContent(),/changed|reopen|review/i); assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
  await detail(page,result,'same-revision-context-retired',['#modal-error'],/changed|reopen|review/i); await replay(page,{physical:false,navigation:false}); assert.equal((await gate(page)).totalCalls,0); assert.equal(await raw(page),bytes);
  result.gate=safeReport(await gate(page)); result.checks.push('Same-revision '+scenario.drift+' drift changes the actual app-delivered campaign object and retires stale consent before Store'); return;
 }
 if(['entry-controls','freeze-controls'].includes(mode)) {
  const baseline=(await gate(page)).baseline; await page.evaluate(mode=>{contactGate.entryFault=mode==='entry-controls'?'modal-submit':'modal-cancel';},mode); await pointer(page,'#modal-submit');
  await page.locator('#modal-error').filter({hasText:'Synthetic contact entry control fault'}).waitFor(); assert.equal((await gate(page)).totalCalls,0); assert.equal(await raw(page),bytes); assert.deepEqual((await gate(page)).semantic,baseline);
  for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  await detail(page,result,'entry-no-provider-warning',['#modal-error'],/entry control fault/); await detail(page,result,'entry-restored-controls',['#modal-cancel','#modal-submit']); await pointer(page,'#modal-submit'); await successful(page,result,before,scenario); return;
 }
 if(['native','queued-settled','reentrant'].includes(mode)) {
  const immediate=await page.evaluate(mode=>{
   contactGate.reentrant=mode==='reentrant';
   if(mode==='queued-settled')for(const [name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])contactGate.dispatch(name,arg);
   void contactGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});
   return {writes:contactStorage.writes,open:document.querySelector('#modal').open,title:document.querySelector('#modal-title').textContent};
  },mode);
  assert.equal(immediate.writes,1,'Native Store saves before any added microtask');
  const handoff=!!scenario.selected&&!(scenario.illegalCargo&&scenario.method!=='blackMarket');
  assert.equal(immediate.open,handoff,'Native same-turn completion closes review or opens requested buyer handoff');
  if(handoff)assert.match(immediate.title,/^Review sale.*Synthetic buyer$/); await frames(page); assert.equal((await gate(page)).totalCalls,1);
  if(mode==='reentrant')assert.ok((await gate(page)).reentrantChecks.every(item=>item.sameTitle&&item.sameOpen)); await successful(page,result,before,scenario); return;
 }
 await page.evaluate(mode=>{
  contactGate.armed=true;
  contactGate.notifyFault=mode==='notification-before'?'before':['notification-after','controls'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','consumed-token'].includes(mode)?mode:null;
  contactStorage.failNext=['retry','recovery-reentry','restore-controls'].includes(mode); contactGate.recoveryReentry=mode==='recovery-reentry';
 },mode);
 await assertPending(page,result,scenario,bytes);
 if(scenario.map){await mapPublication(page,result,scenario,before,context);return;}
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token'].includes(mode)){await retired(page,result,before,scenario,context);return;}
 if(['disk-same','disk-unreadable'].includes(mode)) {
  if(mode==='disk-same')await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);
  else await page.evaluate(()=>{contactGate.readFault=true;});
  const current=await raw(page); await release(page,'known-before'); await frames(page); assert.equal(await raw(page),current); assert.equal((await gate(page)).totalCalls,1); assert.equal(await page.locator('#modal-submit').isDisabled(),true); assert.match(await page.locator('#modal-error').textContent(),/not saved[\s\S]*reload/i);
  await detail(page,result,'durable-baseline-retired',['#modal-error'],/not saved[\s\S]*reload/i); await replay(page,{physical:false,navigation:false}); assert.equal((await gate(page)).totalCalls,1); assert.equal(await raw(page),current); await page.evaluate(()=>{contactGate.readFault=false;}); result.gate=safeReport(await gate(page)); await page.reload(); await page.getByText('Editing in this tab',{exact:true}).waitFor(); assert.equal(await raw(page),current);
  result.checks.push('Typed known-unwritten error cannot retry when exact durable baseline changes at same revision or cannot be read');return;
 }
 if(['retry','recovery-reentry'].includes(mode)) {
  await release(page); await page.locator('#modal-error').filter({hasText:'Synthetic known contact prewrite'}).waitFor();
  let snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assert.deepEqual(snapshot.semantic,snapshot.baseline);assert.equal(snapshot.reviewNodeRetained,true);
  for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  if(mode==='recovery-reentry'){assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);assert.equal(snapshot.totalCalls,1);result.checks.push('Actual onsubmit/requestSubmit inside disabled=false recovery setter cannot nest a save; explicit later retry succeeds');}
  await detail(page,result,'known-unsaved-warning',['#modal-error'],/Synthetic known contact prewrite/);await detail(page,result,'known-unsaved-controls',['#modal-cancel','#modal-submit']);
  const candidate=JSON.parse(snapshot.candidates[0]),dice=snapshot.semantic.dice;
  await pointer(page,'#modal-submit');await page.waitForFunction(()=>!!contactGate.pending);snapshot=await gate(page);assert.equal(snapshot.calls,2);assert.deepEqual(JSON.parse(snapshot.candidates[1]).snapshots.at(-1),candidate.snapshots.at(-1),'Explicit retry keeps the exact accepted snapshot ID, every offer ID/die/result, options and period without normalization');assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])),normalize(candidate));assert.equal(snapshot.semantic.dice,dice);assert.deepEqual(snapshot.semantic,snapshot.baseline);
  await release(page);await successful(page,result,before,scenario);return;
 }
 if(['deferred','queued-pending'].includes(mode)) {
  await page.evaluate(()=>{contactGate.beginStrict();contactGate.write();});await frames(page);assertSearch(await read(page),before,scenario);
  const snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates[0]);assert.deepEqual(snapshot.semantic,snapshot.baseline,'Native publication changes durable bytes but exposes no new clock/snapshot/tab/market before completion');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.mainNodeRetained,true);assert.equal(snapshot.pending,true);
  await replay(page);assert.deepEqual((await gate(page)).semantic,snapshot.baseline);assert.equal((await gate(page)).totalCalls,1);await detail(page,result,'durable-publication-held-footer',['#modal-cancel','#modal-submit']);
  const strict=await gate(page);assert.equal(strict.mutationCount,0,'No transient main/review/summary/clock/tab/status mutation during durable publication');assert.deepEqual((await page.evaluate(()=>contactGate.mapCapture('after-publication-replay'))).regions,strict.mapBaseline.regions);await page.evaluate(()=>contactGate.endStrict());await release(page);await successful(page,result,before,scenario);return;
 }
 const cleanup=['restore-controls','render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close'].includes(mode);
 if(cleanup)await page.evaluate(mode=>{contactGate.cleanupFault=mode;},mode);
 await release(page,['unknown-before','unknown-after','contradictory','fulfilled-no-publication'].includes(mode)?mode:mode==='terminal-report'?'unknown-before':'native');
 if(mode==='reentrant-close') {
  await frames(page);assertSearch(await read(page),before,scenario);const snapshot=await gate(page);assert.deepEqual(snapshot.faults,['reentrant-close']);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
  await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);await capture(page,result,'reentrant-newer-dialog');result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);return;
 }
 await terminal(page,result,before,scenario,{committed:!['unknown-before','fulfilled-no-publication','terminal-report','restore-controls'].includes(mode),unknown:['unknown-before','fulfilled-no-publication','terminal-report','restore-controls','missing','missing-token','wrong-token','wrong-revision'].includes(mode)});
 if(cleanup)assert.deepEqual(result.gate.faults,[mode]);
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport) {
 const result={id:scenario.id+'-'+viewport.width,mode:scenario.mode,kind:scenario.kind,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result,scenario);const page=await context.newPage();await runBody(page,result,scenario,context);await frames(page);for(const key of ['pageErrors','unhandledRejections','consoleErrors','networkErrors','unexpectedRequests'])assert.deepEqual(result[key],[],key);assert.equal(result.screenshots.length,expectedFrames(scenario),'All declared target-framed evidence is captured');result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});result.failedGate=await gate(page).then(safeReport).catch(()=>null);}}
 finally{context?.contactNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')) {
 for(const scenario of scenarios){const before=fixture(scenario),next=expected(before,scenario);assertSearch(next,before,scenario);S.validate(next);}
 const supplier=scenarios.find(s=>s.id==='supplier-native'),buyer=scenarios.find(s=>s.id==='buyer-native');
 assert.ok(specification(fixture(supplier),supplier).snap.offers.length>0);assert.equal(specification(fixture(buyer),buyer).snap.offers.length,0);
 for(const scenario of scenarios.filter(s=>s.unsuccessful)){assert.equal(specification(fixture(scenario),scenario).snap.success,false);assert.equal(specification(fixture(scenario),scenario).snap.offers.length,0);}
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 assert.match(await readFile(new URL('../../../.github/workflows/mail-browser.yml',import.meta.url),'utf8'),/contact-search-completion-browser/);
 assert.match(app,/saveContext:'contact-search-save'/);assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');
 console.log(`PASS: independent supplier/buyer contact/time/period/generated-market/Undo oracles and tagged source wiring; ${scenarios.length} scenarios / ${cases.length} browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile), ${report.declaredScreenshots} frames declared. Chromium was NOT launched; this is fixture/source validation, NOT browser evidence.`);
} else {
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT to exact head');assert.equal(report.testedCommit,report.requestedCommit);
  report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires exact clean head; generated artifacts are ignored');
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','persistence.mjs','campaign-controller.mjs','state.mjs','rules.mjs','contact-search.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const {scenario,viewport}of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.declaredScreenshots);assert.equal(report.screenshotCount,report.cases.reduce((n,result)=>n+result.screenshots.length,0));assert.ok(report.cases.every(result=>result.screenshots.length>0));
  report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'All evidence stays below 24 MiB');
 }catch(error){report.errors.push(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(result=>result.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Contact search completion Chromium checks failed; see verification-artifacts/contact-search-completion-report.json');
 console.log(`PASS: ${report.declaredCases} exact-head supplier/buyer completion cases, native locks, exact search/time/audit/Undo and bounded desktop/mobile evidence.`);
}
