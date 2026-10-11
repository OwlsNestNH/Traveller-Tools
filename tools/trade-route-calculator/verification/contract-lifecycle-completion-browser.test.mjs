// Bounded Stage 2 freight/mail acceptance, cancellation and delivery completion gate.
// Standalone Playwright suite; runner dependency: 'playwright'.
// Executes unchanged tagged app, rules, controller, Store and native Web Locks.
// Only external HTTP, entropy, provider completion and DOM boundaries are observed.
// Synthetic campaigns only. --fixtures-only never starts a browser or web server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
import {distance} from '../js/map.mjs';
import {recordMailCheck, latestMailCheck} from '../js/mail-history.mjs';
import {displayDate} from '../js/calendar.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {up} from '../js/rounding.mjs';
import {formatCreditsText} from '../js/display.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='contract-lifecycle-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const operations=['manual-freight','manual-mail','accept-freight','accept-mail','cancel-mail','deliver-freight','deliver-mail'];
// Seven economic variants exercise exactly four production callers. The native
// differential suite owns exhaustive economic/context cross-products; Chromium
// covers representative real dialog, publication, ownership and paint boundaries.
const scenarios=operations.flatMap(operation=>['native','deferred','retry'].map(mode=>({id:operation+'-'+mode,operation,mode,dual:mode==='native'||mode==='deferred'&&['manual-freight','accept-mail','cancel-mail','deliver-freight'].includes(operation)||mode==='retry'&&['manual-mail','accept-freight','deliver-freight'].includes(operation)})));
for(const operation of ['manual-freight','accept-mail','cancel-mail','deliver-freight'])for(const mode of ['unknown-before','unknown-after'])scenarios.push({id:operation+'-'+mode,operation,mode,dual:['accept-mail','deliver-freight'].includes(operation)});
for(const [index,mode]of ['recovery-reentry','disk-same','disk-unreadable','queued-pending','reentrant','contradictory','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','consumed-token','fulfilled-no-publication','foreign-same','foreign-new','editor-regain','new-dialog','render','report','terminal-report','close-before','close-after','clear-error','reentrant-close','read-only','foreign-form'].entries()) {
 const operation=operations[index%operations.length];scenarios.push({id:operation+'-'+mode,operation,mode,dual:['new-dialog','read-only'].includes(mode)});
}
for(const [operation,point]of [['manual-freight','title'],['accept-mail','body'],['cancel-mail','title'],['deliver-freight','body']])scenarios.push({id:operation+'-entry-'+point+'-reentry',operation,mode:'construction-reentry',point});
for(const [operation,drift]of [['manual-freight','hours'],['accept-mail','settings'],['cancel-mail','ship'],['deliver-freight','contract'],['manual-mail','form']])scenarios.push({id:operation+'-context-'+drift,operation,mode:'context-drift',drift});
for(const operation of ['manual-freight','accept-mail','cancel-mail','deliver-freight'])scenarios.push({id:operation+'-map-owned',operation,mode:'map-owned',map:true});
scenarios.push({id:'deliver-mail-map-foreign',operation:'deliver-mail',mode:'map-foreign',map:true});
for(const operation of ['manual-freight','deliver-freight'])scenarios.push({id:operation+'-retry-form-drift',operation,mode:'retry-form-drift'});
scenarios.push({id:'deliver-freight-zero-payout-cr100',operation:'deliver-freight',mode:'native',die:6,step:100,dual:true},{id:'deliver-freight-due-boundary',operation:'deliver-freight',mode:'native',dueBoundary:true,dual:true},{id:'manual-mail-rounding-cr100',operation:'manual-mail',mode:'native',step:100,fractional:true},{id:'cancel-mail-legacy-proof',operation:'cancel-mail',mode:'native',legacy:true});
const cases=scenarios.flatMap(scenario=>sizes.filter(size=>size.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
const detailedSuccess=s=>s.id===s.operation+'-native'||s.die===6||s.dueBoundary;
function expectedFrames(s){
 const success=1+(detailedSuccess(s)?3:0)+(s.operation.startsWith('deliver-')&&detailedSuccess(s)?3:0);
 if(['native','queued-settled','reentrant','foreign-form'].includes(s.mode))return success;
 if(['deferred','retry','recovery-reentry'].includes(s.mode))return success+2;
 if(s.mode==='map-owned')return success+1;if(s.mode==='map-foreign')return 2;if(s.mode==='queued-pending')return success+1;
 if(['construction-reentry','context-drift','disk-same','disk-unreadable','reentrant-close','foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token','render','report','close-after'].includes(s.mode))return 1;
 if(['read-only','retry-form-drift'].includes(s.mode))return 2;return 3;
}
const screenshotOptions=Object.freeze({type:'jpeg',quality:60,caret:'initial'});
const successPattern=/^(?:Manual contract accepted|Accepted (?:mail|freight)|Cancelled mail|Delivered (?:mail|freight)) saved\.$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>contractLifecycleGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>contractLifecycleGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const isManual=scenario=>scenario.operation?.startsWith('manual-');
const isAccept=scenario=>scenario.operation?.startsWith('accept-');
const isDeliver=scenario=>scenario.operation?.startsWith('deliver-');
const kind=scenario=>scenario.operation.endsWith('mail')?'mail':'freight';
const title=scenario=>isManual(scenario)?'Manual freight / mail contract':(isAccept(scenario)?'Accept ':isDeliver(scenario)?'Deliver ':'Cancel ')+kind(scenario);
const transitionLabel=scenario=>isManual(scenario)?'Manual contract accepted':(isAccept(scenario)?'Accepted ':isDeliver(scenario)?'Delivered ':'Cancelled ')+kind(scenario);
const saveName=scenario=>isManual(scenario)||isAccept(scenario)?'Contract acceptance':isDeliver(scenario)?'Contract delivery':'Mail cancellation';
const report={suite:'Contract-lifecycle save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,declaredScreenshots:cases.reduce((n,{scenario})=>n+expectedFrames(scenario),0),gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Actual manual/generated freight/mail acceptance, mail cancellation and freight/mail delivery callers. Exact full state/ledger/Undo oracles, immutable accepted terms/IDs/die retry, no acceptance/cancellation money, representative late die/zero payout/due boundary/Cr1/Cr100/huge Credits, tagged Store/native Web Locks, real two-event bootstrap, prewrite and split-publication RO/rAF/cache DOM freeze, stale/reentrant/terminal/read-only ownership, individually inspectable desktop/mobile warning/footer/status/contract/ledger frames. No passenger migration, Stage 3 redesign, or separately blocked Sale audit.'};
let browser,imageBytes=0;
function normalize(value){const ids=new Map();return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'generated-'+ids.size);return ids.get(id);}));}
function fixture(scenario={}){
 let s=S.initial();const origin={id:'1,1',x:1,y:1,name:'Contract Origin',sector:'Synthetic',hex:'0202',uwp:'A788879-C',zone:'Safe'},destination={...origin,id:'2,1',x:2,name:'Contract Destination',hex:'0302'};
 Object.assign(s,{initialized:true,name:'Disposable contract-lifecycle completion campaign',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Contract Trader',capacity:'100',armed:true,staterooms:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}},accommodation:{rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}}});
 Object.assign(s.trader,{broker:2,streetwise:3,rank:2,soc:1});Object.assign(s.settings,{creditStep:scenario.step||1,tax:true,profit:50});
 s.lots=[{id:'unrelated-lot',commodity:'11',description:'Unrelated owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];
 s.ledger=[{id:'contract-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];s.dashboardBaseline=createDashboardBaseline(s);
 if(isDeliver(scenario)||scenario.operation==='cancel-mail'){
  s=S.transition(s,'Manual contract accepted',state=>S.acceptContract(state,{offerId:'selected-lifecycle-offer',description:'Synthetic whole '+kind(scenario)+' consignment',kind:kind(scenario),origin:origin.id,destination:destination.id,quantity:'3',payment:'90071992547409931234501',dueHours:kind(scenario)==='mail'?null:671,audit:{manual:true,reason:'Synthetic lifecycle fixture'},rulesVersion:R.VERSION}));
  if(scenario.legacy){const c=s.contracts[0];delete c.firstDeparture;delete c.acceptanceEventId;}
  if(isDeliver(scenario))s=S.transition(s,'Synthetic destination fixture',state=>{state.actual=destination.id;state.routeIndex=1;state.hours=scenario.dueBoundary?671:672;});
 }
 return S.validate(s);
}
function generatedSpecification(before){
 const destination=before.route[1],a=R.context(before.worlds[before.actual],core),b=R.context(before.worlds[destination],core),parsecs=distance(before.worlds[before.actual],before.worlds[destination]);
 const searchDice={dice:null,total:8,manual:true},dice={dice:[3,3],total:6},freight=R.freightOffers(a,b,parsecs,0,core,()=>3),mail=R.mailOffer(a,b,parsecs,0,before.ship,before.trader,core,()=>3,{availabilityTotal:12,containerRoll:3});
 Object.assign(mail.audit,{searchDice:structuredClone(searchDice),generatedSearchDice:structuredClone(dice),searchSkill:0,searchCharacteristic:0});
 const offers=[...freight,mail].map(o=>({...o,offerId:S.uid(),origin:before.actual,destination,dueHours:o.kind==='mail'?null:before.hours+14*24,generatedHours:before.hours,rulesVersion:R.VERSION}));
 const event={id:S.uid(),label:'Contract search audit',hours:before.hours,world:before.actual,destination,mailOnly:false,searchDice,generatedSearchDice:dice,effectiveSearchDice:8,searchSkill:0,searchCharacteristic:0,effect:0,manualDice:[],manualDiceConsumed:0,mailAudit:mail.audit,offers:structuredClone(offers)};
 return S.transition(before,'Contract search',s=>recordMailCheck(s,event));
}
function specification(before,scenario){
 const type=kind(scenario),manualPayment=scenario.fractional?'9007199254740993':'9007199254741000',quantity=scenario.fractional?'2.5':'3',payment=String(up(manualPayment,before.settings.creditStep)),rounded=String(up(quantity));
 const c=isManual(scenario)?{offerId:S.uid(),kind:type,origin:before.actual,destination:'2,1',quantity:rounded,payment,dueHours:type==='mail'?null:before.hours+14*24,audit:{manual:true,reason:'Synthetic referee-approved terms'},rulesVersion:R.VERSION}:isAccept(scenario)?latestMailCheck(before).offers.find(o=>o.kind===type):before.contracts.find(c=>c.offerId==='selected-lifecycle-offer');
 assert.ok(c,'Lifecycle target exists');
 const rounding=[];if(isManual(scenario)&&quantity!==rounded)rounding.push({label:'Whole contract · tons',before:quantity,after:rounded});if(isManual(scenario)&&manualPayment!==payment)rounding.push({label:'Payment on delivery · Cr',before:manualPayment,after:payment});
 return {c,id:isAccept(scenario)?c.offerId:c.id,label:transitionLabel(scenario),die:scenario.die||4,rounding,inputs:isManual(scenario)?{kind:type,destination:c.destination,quantity,payment:manualPayment,days:14,reason:c.audit.reason}:isDeliver(scenario)&&type==='freight'&&!scenario.dueBoundary?{die:scenario.die||4}:{}};
}
function expected(before,scenario){const spec=specification(before,scenario);return S.transition(before,spec.label,s=>{if(isManual(scenario)||isAccept(scenario))S.acceptContract(s,spec.c);else if(isDeliver(scenario))S.deliver(s,spec.id,spec.die);else S.cancelMail(s,spec.id);if(spec.rounding.length)s.events.push({id:S.uid(),label:'Rounding applied [R]',hours:s.hours,roundingStep:before.settings.creditStep,roundingChanges:spec.rounding});});}
function selectedSaved(saved,before,scenario){return isManual(scenario)||isAccept(scenario)?saved.contracts.at(-1):saved.contracts.find(c=>c.id===specification(before,scenario).id);}
function assertSaved(saved,before,scenario){
 assert.deepEqual(normalize(saved),normalize(expected(before,scenario)),'Exact original full campaign transition across exactly four production callers, monetary/contract/history state and inverse Undo');
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 for(const key of ['hours','ship','lots','policies','actual','worlds','route','routeIndex','cooldowns','snapshots','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' is unchanged by lifecycle completion');
 assert.deepEqual(saved.events.slice(0,before.events.length),before.events,'Original generation/acceptance audits stay immutable');assert.equal(saved.latestMailCheckId,before.latestMailCheckId);
 if(!isDeliver(scenario)){assert.equal(saved.bank,before.bank);assert.deepEqual(saved.ledger,before.ledger,'Acceptance and cancellation create no income, penalty or zero-value receipt');}
 else{const c=selectedSaved(saved,before,scenario);assert.equal(saved.ledger.length,before.ledger.length+1);assert.equal(saved.ledger.at(-1).amount,c.payout);assert.equal(saved.bank,String(BigInt(before.bank)+BigInt(c.payout)));assert.equal(c.penaltyDie,c.late?specification(before,scenario).die:null);if(scenario.die===6)assert.equal(c.payout,'0','Six preserves an explicit zero-value delivery ledger entry');}
 assert.deepEqual(material(S.undo(saved)),material(before),'Undo restores exact original bank/hold/contract/history reference');
}
function assertRetained(snapshot){assert.deepEqual(snapshot.semantic,{...snapshot.baseline,dice:snapshot.acceptedDice},'Pending completion preserves form/main/summary/tab/status and accepted delivery die');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.mainNodeRetained,true);}
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
 await context.exposeBinding('__contractLifecycleUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__contractLifecycleUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.contractLifecycleStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   contractLifecycleStorage.attempts++; contractLifecycleStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (contractLifecycleStorage.failNext) {contractLifecycleStorage.failNext = false; throw Error('Synthetic known contract-lifecycle prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); contractLifecycleStorage.writes++; return result;
  };
  globalThis.contractLifecycleDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {contractLifecycleDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.contractLifecycleMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.contractLifecycleMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); contractLifecycleMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    contractLifecycleMapCallbacks.executed++; if (cache) contractLifecycleMapCallbacks.cacheExecuted++;
    globalThis.contractLifecycleGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.contractLifecycleGate?.paintEdge('after', cache);
    contractLifecycleMapCallbacks.completed++; if (cache) contractLifecycleMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.contractLifecycleGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {contractLifecycleMapCallbacks.loadingCacheCompleted++; contractLifecycleMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.contractLifecycleMapLoadingStatusNode = statusNode;}
    globalThis.contractLifecycleGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.contractLifecycleGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.contractLifecycleGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) contractLifecycleMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 let held, releaseHold, heldOnce = false;
 context.contractLifecycleNetwork = {async waitHeld() {const end = Date.now() + 10000; while (!held && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25)); assert.ok(held, 'Real MapAreaCache tile reached network fixture'); return {...held};}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/contract-lifecycle-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable contract-lifecycle native Store peer</title>'});
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
  const g = globalThis.contractLifecycleGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
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
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: contractLifecycleDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic contract-lifecycle completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^(?:Manual contract accepted|Accepted (?:mail|freight)|Cancelled mail|Delivered (?:mail|freight)) saved\.$/s.test(value)) fault('report');
   if (settled() && g.cleanupFault === 'terminal-report' && this.id === 'message' && /Reload/.test(value)) fault('terminal-report');
   const result = Reflect.apply(text.set, this, [value]);
   if (g.constructionFault === 'title' && this.id === 'modal-title') g.replaceConstruction();
   return result;
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {
   if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render');
   const result=Reflect.apply(html.set,this,[value]);
   if(g.constructionFault==='body'&&this.id==='modal-body')g.replaceConstruction();return result;
  }});
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {
   if (settled() && g.cleanupFault === 'close-before' && this.id === 'modal') fault('close-before');
   const result = Reflect.apply(close, this, args);
   if (settled() && g.cleanupFault === 'close-after' && this.id === 'modal') fault('close-after');
   if (settled() && g.cleanupFault === 'reentrant-close' && this.id === 'modal') {
    g.cleanupFault = null; g.faults.push('reentrant-close'); document.querySelector('#notes').click();
    g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit=document.querySelector('#modal-form').onsubmit; g.newerClose=document.querySelector('#modal-cancel').onclick;
   }
   return result;
  };
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic contract-lifecycle entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: contractLifecycleStorage.writes});
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
   g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit=document.querySelector('#modal-form').onsubmit; g.newerClose=document.querySelector('#modal-cancel').onclick;
   const check = {point, title: g.newer.title, handlerInstalled: typeof g.newerSubmit === 'function', handlerChanged: g.newerSubmit !== previousHandler, submitHidden: document.querySelector('#modal-submit').hidden, open: document.querySelector('#modal').open};
   g.constructionChecks.push(g.trace('inside-setter-newer-notes', check));
   if (check.title !== 'Rules & Notes' || !check.handlerInstalled || !check.handlerChanged || !check.submitHidden || !check.open) throw Error('Synchronous Notes construction did not complete inside setter');
  };
  g.replay = () => {
   const before = semantic(), open = document.querySelector('#modal').open;
   for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', ''], ['contracts-search', ''], ['mail-check', ''], ['contract-manual', ''], ['contract-accept', g.offerId || 'missing'], ['mail-cancel', g.contractId || 'missing'], ['deliver', g.contractId || 'missing'], ['draft-edit', g.offerId || 'missing'], ['sale-clear', ''], ['sale-all', '']]) g.dispatch(name, arg);
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before contract-lifecycle publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after contract-lifecycle publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this); if (g.readFault) throw Error('Synthetic unreadable durable contract-lifecycle baseline'); return Reflect.apply(nativeRead, this, args);};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = contractLifecycleDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending contract-lifecycle save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native contract-lifecycle write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending contract-lifecycle completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known contract-lifecycle prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown contract-lifecycle outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory contract-lifecycle not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable contract-lifecycle save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: contractLifecycleMapCallbacks.cacheCompleted, loadingCacheCompleted: contractLifecycleMapCallbacks.loadingCacheCompleted});};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...contractLifecycleStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, acceptedDice:g.acceptedDice, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, mainNodeRetained: !!g.mainNode?.isConnected, newer: g.newer, recoveryChecks: g.recoveryChecks, callbacks: {...contractLifecycleMapCallbacks}, bootstrap: g.bootstrap, mapReadiness: g.mapReadiness, retainedBaselineOrder: g.retainedBaselineOrder, constructionChecks: g.constructionChecks,  timeline: g.timeline, timelineDropped: g.timelineDropped, mapBaseline: g.mapBaseline, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, mutationCount: g.mutationCount, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[]});
   Object.assign(contractLifecycleStorage,{attempts:0,writes:0,failNext:false,observations:[]});
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = contractLifecycleStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || contractLifecycleStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
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
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Lifecycle dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Lifecycle content stays inside dialog');}
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
async function fillTerms(page,before,scenario){
 for(const [name,value]of Object.entries(specification(before,scenario).inputs)){
  if(['kind','destination'].includes(name))await page.locator('#modal [name="'+name+'"]').selectOption(value);
  else await fill(page,name,value);
 }
}
async function draftIds(page){return page.locator('[data-action="draft-edit"]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.arg))]);}
async function seedDrafts(page,result,scenario){
 if(!isAccept(scenario))return;
 const before=await read(page);await tab(page,'Contracts');await action(page,'contracts-search').click();
 for(const summary of await page.locator('#modal-body details > summary').all())if(!await summary.evaluate(node=>node.parentElement.open))await summary.click();
 for(const [name,value]of Object.entries({dice:8,skill:0,characteristic:0,days:14,mailAvailability:12,mailContainers:3}))await fill(page,name,value);
 await page.locator('#modal [name="destination"]').selectOption('2,1');await pointer(page,'#modal-submit');await closed(page);await frames(page);
 assert.deepEqual(normalize(await read(page)),normalize(generatedSpecification(before)),'Prerequisite offers come from unchanged actual contractSearch and original rules');result.initialDraftIds=await draftIds(page);assert.ok(result.initialDraftIds.length>1);
 await page.evaluate(()=>contractLifecycleGate.reset());
}
function actionSpec(before,scenario){const spec=specification(before,scenario);return {name:isManual(scenario)?'contract-manual':isAccept(scenario)?'contract-accept':isDeliver(scenario)?'deliver':'mail-cancel',arg:isManual(scenario)?undefined:spec.id};}
async function prepare(page,result,scenario,before,{loops=false,network=null}={}){
 await tab(page,scenario.map?'Overview':'Contracts');
 const open=async()=>{
  const priorDice=await page.evaluate(()=>contractLifecycleDiceCalls),{name,arg}=actionSpec(before,scenario);
  if(scenario.map)await page.evaluate(({name,arg})=>contractLifecycleGate.dispatch(name,arg),{name,arg});else await action(page,name,arg).click();
  await page.locator('#modal-title').filter({hasText:new RegExp('^'+title(scenario)+'$')}).waitFor();
  assert.equal(await page.evaluate(()=>contractLifecycleDiceCalls),priorDice+(isDeliver(scenario)?1:0),'Original delivery entry consumes one die; acceptance/cancellation do not roll');
  const focus=await page.evaluate(()=>({id:document.activeElement?.id,name:document.activeElement?.name,selectionStart:document.activeElement?.selectionStart??null,selectionEnd:document.activeElement?.selectionEnd??null}));
  (result.entryFocus??=[]).push(focus);assert.ok(focus.id||focus.name,'Native dialog initial focus remains present');
  await fillTerms(page,before,scenario);await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.deepEqual(await read(page),before);assert.equal(await page.locator('#modal-error').textContent(),'');
 };
 await open();
 if(loops){const priorDice=await page.evaluate(()=>contractLifecycleDiceCalls);await pointer(page,'#modal-cancel');await closed(page);assert.deepEqual(await read(page),before);await open();assert.equal(await page.evaluate(()=>contractLifecycleDiceCalls),priorDice+(isDeliver(scenario)?1:0),'Cancel/reopen never mutates campaign; only fresh delivery entry rolls the original one die');}
 await page.evaluate(()=>document.activeElement?.blur());await frames(page);
 if(scenario.map){
  const held=await network.waitHeld();assert.equal(held.released,false);
  await page.waitForFunction(()=>contractLifecycleMapCallbacks.loadingCacheCompleted>0&&contractLifecycleMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));
  await page.evaluate(held=>{if(contractLifecycleGate.totalCalls||contractLifecycleGate.pending||contractLifecycleStorage.writes)throw Error('Initial cache readiness must precede provider work');contractLifecycleGate.mapReadiness=contractLifecycleGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...contractLifecycleMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:contractLifecycleGate.mapNodeId(contractLifecycleMapLoadingStatusNode)});},held);
 }
 const spec=specification(before,scenario);await page.evaluate(({offerId,contractId})=>{contractLifecycleGate.offerId=offerId;contractLifecycleGate.contractId=contractId;contractLifecycleGate.remember();},{offerId:spec.c.offerId,contractId:spec.c.id??null});
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');if(contractLifecycleGate.oldSubmit)void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();if(navigation)contractLifecycleGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 if(scenario.mode==='queued-pending')await page.evaluate(()=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])contractLifecycleGate.dispatch(name,arg);void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});
 else if(scenario.mode==='deferred'){await page.locator('#modal-submit').focus();await page.keyboard.press('Enter');}
 else await pointer(page,'#modal-submit',2);
 await page.waitForFunction(()=>!!contractLifecycleGate.pending);await frames(page);
 assert.equal(await raw(page),bytes,'Held completion leaves exact durable bytes alone');let snapshot=await gate(page);assertRetained(snapshot);
 assert.equal(snapshot.acceptedDice,snapshot.baseline.dice,'Submitting the accepted lifecycle intent never rerolls delivery dice');
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen synchronously');
 for(const control of await page.locator('#modal-body input,#modal-body select,#modal-body textarea').all())assert.equal(await control.isDisabled(),true,'Every accepted term freezes before provider entry');
 await replay(page);snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(await raw(page),bytes);assertRetained(snapshot);
 for(const forwarded of snapshot.forwarded){assert.ok(forwarded.argumentCount>=3);assert.equal(forwarded.tokenPresent,true);assert.equal(forwarded.candidateRevision,forwarded.expectedRevision+1);}
 if(scenario.mode==='deferred')await detail(page,result,'pending-before-write-footer',['#modal-cancel','#modal-submit']);
 result.checks.push('Exactly one provider call; frozen fields/Close/X/Escape, Enter, detached/duplicate callbacks, queued tab/world/deposit, Notes and competing contract actions');
}
async function reloadUndo(page,result,before,scenario,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>contractLifecycleStorage.writes),0,'Reload cannot replay a lifecycle action');
 assert.deepEqual(await draftIds(page),[],'Reload starts without visible draft controls');
 await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes,'Inspecting Contracts after reload does not change authoritative bytes');assert.equal(await page.evaluate(()=>contractLifecycleStorage.writes),0);assert.deepEqual(await draftIds(page),[],'The actual Contracts surface does not reconstruct session-only offers from historical audits');assert.equal(await page.locator('[data-action="contract-accept"],[data-action="draft-edit"]').count(),0,'Historical generation/edits cannot restore actionable session controls after reload');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 assertSaved(await read(page),before,scenario);await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);assert.deepEqual(material(await read(page)),material(before));assert.equal((await read(page)).revision,before.revision+2);assert.equal(await page.evaluate(()=>contractLifecycleStorage.writes),1);
 const undoneBytes=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),undoneBytes,'Post-Undo Contracts inspection is read-only');assert.equal(await page.evaluate(()=>contractLifecycleStorage.writes),1);assert.deepEqual(await draftIds(page),[]);assert.equal(await page.locator('[data-action="contract-accept"],[data-action="draft-edit"]').count(),0,'Undo cannot reconstruct an old session offer');
 result.checks.push('Reload keeps exact bytes without reconstructing session offers; real History Undo restores campaign economics and latest-mail history reference');
}
async function successful(page,result,before,scenario){
 await closed(page);await frames(page);const saved=await read(page);assertSaved(saved,before,scenario);const snapshot=await gate(page),spec=specification(before,scenario),contract=selectedSaved(saved,before,scenario);
 assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(await page.locator('#modal-error').textContent(),'');
 assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),scenario.map?'Overview':'Contracts','Lifecycle completion preserves the originating surface');
 assert.equal(snapshot.semantic.dice,snapshot.baseline.dice,'Completion and retry never reroll the accepted delivery die');assert.equal(await page.locator('#message').textContent(),transitionLabel(scenario)+' saved.');
 if(scenario.map){const durable=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),durable);assert.equal((await gate(page)).totalCalls,snapshot.totalCalls);}
 const expectedIds=isAccept(scenario)?latestMailCheck(before).offers.filter(o=>o.offerId!==spec.id).map(o=>o.offerId):[];
 assert.deepEqual((await draftIds(page)).sort(),expectedIds.sort(),'Only the accepted draft is removed; every unrelated offer remains owned and actionable');
 for(const observation of [...snapshot.observations,...snapshot.storage.observations])assert.equal(observation.message,snapshot.baseline.message,'No completion message publishes before provider settlement');
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);
 const bytes=await raw(page),calls=snapshot.totalCalls,dice=snapshot.semantic.dice;
 await page.evaluate(()=>{void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await detail(page,result,'saved-success-status',['#message'],successPattern);
 if(detailedSuccess(scenario)){
  if(scenario.operation==='cancel-mail')await tab(page,'History');
  const row='#main tr:has([data-action="contract-audit"][data-arg="'+contract.id+'"])';
  await detail(page,result,'saved-contract-terms',[row+' > td:first-child'],scenario.operation==='cancel-mail'?/Synthetic whole mail/:/(?:Freight|Mail) contract/);
  await detail(page,result,'saved-contract-status',[row+(scenario.operation==='cancel-mail'?' > td:nth-child(3)':' > td:nth-child(7)')],scenario.operation==='cancel-mail'?/3 t/:isDeliver(scenario)?/Delivered · paid/:/Accepted · unpaid/);
  await detail(page,result,'saved-contract-actions',[row+' > td:last-child'],/Audit\/View/);
  if(isDeliver(scenario)){
   await tab(page,'Accounts');await action(page,'ledger-audit',saved.ledger.at(-1).id).click();await page.locator('#modal-title').filter({hasText:/Ledger|entry|delivery/i}).waitFor();
   const facts=await page.locator('#modal-body').textContent();assert.ok(facts.includes(formatCreditsText(contract.payout)));assert.ok(facts.includes(formatCreditsText(saved.bank)));
   await detail(page,result,'saved-ledger-money',['#modal-body > .preview:first-child'],/Bank change[\s\S]*Bank before[\s\S]*Bank after/);
   await detail(page,result,'saved-ledger-delivery-terms',['#modal-body > .preview:last-of-type'],/Agreed payment[\s\S]*Payment received[\s\S]*Late delivery[\s\S]*Late-penalty roll/);
   await detail(page,result,'saved-ledger-readonly-footer',['#modal-cancel'],/Close/);assert.equal(await page.locator('#modal-submit').isHidden(),true);await pointer(page,'#modal-cancel');await closed(page);
  }
  assert.equal(await raw(page),bytes,'Inspecting contract and ledger details is read-only');assert.equal((await gate(page)).totalCalls,calls);assert.equal((await gate(page)).semantic.dice,dice);
 }
 // Campaign time belongs to Overview. Account/contract/ledger selectors are
 // asserted in their own visible surface before navigating to the clock.
 await tab(page,'Overview');await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);assert.equal((await gate(page)).semantic.dice,dice);
 assert.equal(await page.locator('#ship-actions .campaign-time .value').textContent(),displayDate(saved.dateLabel,saved.hours));
 result.checks.push('View-specific Overview campaign clock remains exact without any extra write or die');result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
}
function terminalGuidance(scenario,unknown){const name=saveName(scenario),lower=name.toLowerCase();return unknown?'The '+lower+' save outcome could not be confirmed. Reload this page and check History before trying again.':name+' saved, but the display could not update. Reload this page before continuing; do not record this '+lower+' again.';}
async function terminal(page,result,before,scenario,{committed,unknown=false}={}){
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#save-status').textContent));await frames(page);const snapshot=await gate(page),guidance=terminalGuidance(scenario,unknown);
 assert.equal(await page.locator('#save-status').textContent(),guidance);if(scenario.mode!=='terminal-report')assert.equal(await page.locator('#message').textContent(),guidance);
 assert.equal(snapshot.editable,false);assert.equal(snapshot.reloadRequired,true);assert.equal(await page.locator('#takeover').isDisabled(),true);
 if(committed)assertSaved(await read(page),before,scenario);else assert.deepEqual(await read(page),before);
 if(await page.locator('#modal').evaluate(el=>el.open)){assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#modal-error').textContent(),guidance);await detail(page,result,'terminal-warning',['#modal-error']);await detail(page,result,'terminal-controls',['#modal-cancel','#modal-submit']);await pointer(page,'#modal-cancel');await closed(page);}
 await detail(page,result,'terminal-save-status',['#save-status']);
 const bytes=await raw(page);await replay(page,{physical:false,navigation:false});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true,'Terminal completion releases the native writer lock');
 await page.evaluate(()=>{contractLifecycleGate.store.yield();contractLifecycleGate.store.onChange(contractLifecycleGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#save-status').textContent(),guidance);
 result.gate=safeReport(await gate(page));assert.equal(result.gate.storage.writes,committed?1:0);await reloadUndo(page,result,before,scenario,{committed});
 result.checks.push('Exact saved/unknown guidance; terminal authority latched before fallible reporting, native lock released, replay refused and reload authoritative');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/contract-lifecycle-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.contractLifecyclePeer = {state: null, editable: false}; contractLifecyclePeer.store = new Store(next => {contractLifecyclePeer.state = next;}, editable => {contractLifecyclePeer.editable = editable;}); await contractLifecyclePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => contractLifecyclePeer.editable); await page.waitForFunction(() => contractLifecycleGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(contractLifecyclePeer.state, 'Foreign deposit during contract-lifecycle save', s => S.deposit(s, 7, 'Synthetic peer')); contractLifecyclePeer.store.save(next, contractLifecyclePeer.state.revision); return contractLifecyclePeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {contractLifecyclePeer.store.yield(); contractLifecyclePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => contractLifecycleGate.store.acquire(true)); await page.waitForFunction(() => contractLifecycleGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===contractLifecycleGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===contractLifecycleGate.newerClose,submitCallable:typeof contractLifecycleGate.newerSubmit==='function',closeCallable:typeof contractLifecycleGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>contractLifecycleGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Real newer Notes submit/Close handler identities survive old settlement and detached replay; captured Close still dismisses without writes');
}
async function retired(page, result, before, scenario, context) {
 const mode = scenario.mode;
 if (mode === 'foreign-same') await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY);
 if (mode === 'foreign-new') await peerTakeover(page, result, context, {write: true});
 if (mode === 'editor-regain') await peerTakeover(page, result, context, {regain: true});
 if (mode === 'native-close' || mode === 'new-dialog') {
  await page.evaluate(() => {document.querySelector('#modal').close(); document.querySelector('#modal').dispatchEvent(new Event('close'));}); await frames(page);
  if (mode === 'new-dialog') {await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor();await page.evaluate(()=>{contractLifecycleGate.newerSubmit=document.querySelector('#modal-form').onsubmit;contractLifecycleGate.newerClose=document.querySelector('#modal-cancel').onclick;});}
 }
 const authoritative = await raw(page), newer = mode === 'new-dialog' ? await page.locator('#modal-body').textContent() : null;
 await release(page); await frames(page);
 if (mode === 'foreign-new') {assert.equal(await raw(page), authoritative); assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n)); assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');}
 else assertSaved(await read(page), before, scenario);
 assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {void contractLifecycleGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 if (mode === 'foreign-same') await detail(page, result, 'stale-owner-warning', ['#modal-error'], /Campaign, contract terms or editing ownership changed/);
 else await capture(page, result, 'retired-owner');
 if(mode==='new-dialog')await verifyNewerNotes(page,result);
 result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign/consumed publication, editor tenure and modal replacement retire old success/cleanup authority permanently');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: contractLifecycleGate.mapCapture('before-resize'), callbacks: {...contractLifecycleMapCallbacks}}));
 await page.evaluate(() => {contractLifecycleGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => contractLifecycleMapCallbacks.resizeDelivered > previous.resizeDelivered && contractLifecycleMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => contractLifecycleGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.contractLifecycleNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {contractLifecycleGate.beginStrict(); contractLifecycleGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>contractLifecycleGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {contractLifecycleGate.phase = 'cache-response'; contractLifecycleGate.trace('held-cache-release-requested');}); context.contractLifecycleNetwork.release();
 await page.waitForFunction(n => contractLifecycleMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => contractLifecycleGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => contractLifecycleGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page, result, {resume: true}); await release(page); await frames(page); assertSaved(await read(page), before, scenario); assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
  await detail(page, result, 'foreign-map-warning', ['#modal-error'], /Campaign, contract terms or editing ownership changed/); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>contractLifecycleStorage.writes),0,'Complete synthetic seed requires no migration write');
 await installGate(page,result);await seedDrafts(page,result,scenario);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(mode==='construction-reentry'){
  await tab(page,'Contracts');const {name,arg}=actionSpec(before,scenario);
  await page.evaluate(point=>{contractLifecycleGate.constructionFault=point;},scenario.point);await action(page,name,arg).click();await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);
  const snapshot=await gate(page);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===contractLifecycleGate.newerSubmit),true);
  await page.evaluate(()=>document.querySelector('#modal-form').requestSubmit());await frames(page);assert.equal(await page.locator('#modal-title').textContent(),snapshot.newer.title);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);
  await detail(page,result,'newer-notes-owns-entry',['#modal-body .notes-list article:first-child'],/Rules and verification/);await pointer(page,'#modal-cancel');await closed(page);
  await page.evaluate(()=>contractLifecycleGate.dispatch('deposit'));await page.locator('#modal-title').filter({hasText:/^Record deposit$/}).waitFor();await fill(page,'amount','17');await fill(page,'reason','Synthetic later entry');await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm deposit$/}).waitFor();assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await pointer(page,'#modal-cancel');await closed(page);
  result.gate=safeReport(await gate(page));result.checks.push('Real synchronous Notes onclick during '+scenario.point+' setter owns newer DOM/handler/Close; old construction cannot write or overwrite it; later Deposit entry remains usable');return;
 }
 await prepare(page,result,scenario,before,{loops:mode==='deferred',network:context.contractLifecycleNetwork});
 if(mode==='context-drift'){
  await page.evaluate(({drift})=>{const s=contractLifecycleGate.lastState;if(drift==='hours')s.hours++;if(drift==='actual')s.actual='2,1';if(drift==='world')s.worlds[s.actual].uwp='B788879-C';if(drift==='trader')s.trader.rank++;if(drift==='ship')s.ship.armed=!s.ship.armed;if(drift==='settings')s.settings.creditStep=100;if(drift==='history')s.events.push({id:'synthetic-context-drift',label:'Synthetic drift',hours:s.hours});if(drift==='contract')s.contracts[0].payment='17';if(drift==='form'){const old=document.querySelector('#modal-form');contractLifecycleGate.replacedForm=old;const replacement=old.cloneNode(true);old.replaceWith(replacement);}},scenario);
  if(scenario.drift==='form')await page.evaluate(()=>{void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});else await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);if(scenario.drift==='form'){await detail(page,result,'foreign-form-context-retained',['#modal-title']);result.gate=safeReport(await gate(page));return;}assert.match(await page.locator('#modal-error').textContent(),/changed|reopen|review/i);await detail(page,result,'same-revision-context-retired',['#modal-error'],/changed|reopen|review/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);result.gate=safeReport(await gate(page));result.checks.push('Actual app-delivered same-revision '+scenario.drift+' drift retires stale consent before generation or provider work');return;
 }
 if(mode==='read-only'){
  await peerTakeover(page,result,context);await frames(page);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);const beforeCalls=(await gate(page)).totalCalls;await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,beforeCalls);assert.equal(await raw(page),bytes);await detail(page,result,'read-only-warning',['#modal-error'],/Editing moved|ownership changed/);await pointer(page,'#modal-cancel');await closed(page);await detail(page,result,'read-only-status',['#save-status']);result.gate=safeReport(await gate(page));return;
 }
 if(mode==='foreign-form'){await page.evaluate(()=>{const clone=document.querySelector('#modal-form').cloneNode(true);void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:clone});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form'].includes(mode)){
  const immediate=await page.evaluate(mode=>{contractLifecycleGate.reentrant=mode==='reentrant';if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])contractLifecycleGate.dispatch(name,arg);void contractLifecycleGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});return {writes:contractLifecycleStorage.writes,open:document.querySelector('#modal').open};},mode);
  assert.equal(immediate.writes,1,'Native Store writes in the same turn without an added microtask');assert.equal(immediate.open,false,'Native completion closes the accepted input immediately');await frames(page);assert.equal((await gate(page)).totalCalls,1);if(mode==='reentrant')assert.ok((await gate(page)).reentrantChecks.every(item=>item.sameTitle&&item.sameOpen));await successful(page,result,before,scenario);return;
 }
 await page.evaluate(mode=>{contractLifecycleGate.armed=true;contractLifecycleGate.notifyFault=mode==='notification-before'?'before':['notification-after','controls'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','consumed-token'].includes(mode)?mode:null;contractLifecycleStorage.failNext=['retry','recovery-reentry','retry-form-drift'].includes(mode);contractLifecycleGate.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map){await mapPublication(page,result,scenario,before,context);return;}
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token'].includes(mode)){await retired(page,result,before,scenario,context);return;}
 if(['disk-same','disk-unreadable'].includes(mode)){
  if(mode==='disk-same')await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);else await page.evaluate(()=>{contractLifecycleGate.readFault=true;});
  const current=await raw(page);await release(page,'known-before');await frames(page);assert.equal(await raw(page),current);assert.equal((await gate(page)).totalCalls,1);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/not saved[\s\S]*reload/i);await detail(page,result,'durable-baseline-retired',['#modal-error'],/not saved[\s\S]*reload/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),current);await page.evaluate(()=>{contractLifecycleGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),current);result.checks.push('Typed known-unwritten failure cannot retry if exact durable campaign baseline changed or cannot be read');return;
 }
 if(mode==='retry-form-drift'){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known contract-lifecycle prewrite'}).waitFor();await detail(page,result,'known-unsaved-before-drift',['#modal-error']);const accepted=(await gate(page)).candidates[0];await fill(page,isManual(scenario)?'payment':'die',isManual(scenario)?'17':'6');await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,1);assert.equal((await gate(page)).candidates[0],accepted);assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await detail(page,result,'accepted-form-drift-retired',['#modal-error'],/changed|reopen|review/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),bytes);result.gate=safeReport(await gate(page));result.checks.push('Known-unsaved retry never silently substitutes changed manual terms or penalty die');return;
 }
 if(['retry','recovery-reentry'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known contract-lifecycle prewrite'}).waitFor();let snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  if(mode==='recovery-reentry'){assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);assert.equal(snapshot.totalCalls,1);}
  await detail(page,result,'known-unsaved-warning',['#modal-error'],/Synthetic known contract-lifecycle prewrite/);await detail(page,result,'known-unsaved-controls',['#modal-cancel','#modal-submit']);const candidate=JSON.parse(snapshot.candidates[0]),dice=snapshot.semantic.dice;
  await pointer(page,'#modal-submit');await page.waitForFunction(()=>!!contractLifecycleGate.pending);snapshot=await gate(page);assert.equal(snapshot.calls,2);
  // Compare the actual accepted audit without UUID normalization. Transition's
  // own bookkeeping UUID can differ, but accepted offer/check/edit IDs cannot.
  const accepted=state=>{const c=selectedSaved(state,before,scenario),{id,acceptanceEventId,...terms}=c;return {...terms,...(!isManual(scenario)&&!isAccept(scenario)?{id,...(acceptanceEventId?{acceptanceEventId}: {})}:{}),generation:latestMailCheck(state)};};
  assert.deepEqual(accepted(JSON.parse(snapshot.candidates[1])),accepted(candidate),'Explicit retry keeps every accepted offer UUID, die, original generation audit and economic term');assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])),normalize(candidate));assert.equal(snapshot.semantic.dice,dice);assertRetained(snapshot);
  await release(page);await successful(page,result,before,scenario);return;
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{contractLifecycleGate.beginStrict();contractLifecycleGate.write();});await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates[0]);assertRetained(snapshot);assert.equal(snapshot.pending,true);await replay(page);assertRetained(await gate(page));assert.equal((await gate(page)).totalCalls,1);await detail(page,result,'durable-publication-held-footer',['#modal-cancel','#modal-submit']);const strict=await gate(page);assert.equal(strict.mutationCount,0,'No transient main/review/summary/time/tab/status mutation during durable publication');assert.deepEqual((await page.evaluate(()=>contractLifecycleGate.mapCapture('after-publication-replay'))).regions,strict.mapBaseline.regions);await page.evaluate(()=>contractLifecycleGate.endStrict());await release(page);await successful(page,result,before,scenario);return;
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{contractLifecycleGate.cleanupFault=mode;},mode);
 await release(page,['unknown-before','unknown-after','contradictory','fulfilled-no-publication'].includes(mode)?mode:mode==='terminal-report'?'unknown-before':'native');
 if(mode==='reentrant-close'){
  await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.deepEqual(snapshot.faults,['reentrant-close']);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#message').textContent(),snapshot.baseline.message);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);await capture(page,result,'reentrant-newer-dialog');await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);return;
 }
 await terminal(page,result,before,scenario,{committed:!['unknown-before','fulfilled-no-publication','terminal-report'].includes(mode),unknown:['unknown-before','fulfilled-no-publication','terminal-report','missing','missing-token','wrong-token','wrong-revision'].includes(mode)});if(cleanup)assert.deepEqual(result.gate.faults,[mode]);
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,mode:scenario.mode,operation:scenario.operation,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result,scenario);const page=await context.newPage();await runBody(page,result,scenario,context);await frames(page);for(const key of ['pageErrors','unhandledRejections','consoleErrors','networkErrors','unexpectedRequests'])assert.deepEqual(result[key],[],key);assert.equal(result.screenshots.length,expectedFrames(scenario),'Every declared evidence target is captured');result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});result.failedGate=await gate(page).then(safeReport).catch(()=>null);}}
 finally{context?.contractLifecycleNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 for(const scenario of scenarios){let before=fixture(scenario);if(isAccept(scenario))before=generatedSpecification(before);const next=expected(before,scenario);assertSaved(next,before,scenario);S.validate(next);if(scenario.legacy)assert.equal(S.mailCancellationEligibility(before,before.contracts[0].id).source,'legacy-undo');}
 const generated=generatedSpecification(fixture());assert.ok(latestMailCheck(generated).offers.some(o=>o.kind==='freight'));assert.ok(latestMailCheck(generated).offers.some(o=>o.kind==='mail'));
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.match(await readFile(new URL('../../../.github/workflows/mail-browser.yml',import.meta.url),'utf8'),/contract-lifecycle-completion-browser/);assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify({suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,declaredScreenshots:report.declaredScreenshots,limits:report.limits,scope:report.scope,scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,operation:scenario.operation,mode:scenario.mode,viewport,screenshots:expectedFrames(scenario)})),execution:'Fixture/source validation only; Chromium was not launched.'},null,2));
 else console.log(`PASS: independent manual/generated acceptance, cancellation/delivery exact full-state/ledger/Undo fixture oracles and tagged source wiring; ${scenarios.length} scenarios / ${cases.length} browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile), ${report.declaredScreenshots} frames declared. Chromium was NOT launched; fixture/source validation is NOT browser evidence.`);

}else{
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT to the exact head');assert.equal(report.testedCommit,report.requestedCommit);report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires exact clean head; generated artifacts are ignored');
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','persistence.mjs','campaign-controller.mjs','state.mjs','rules.mjs','mail-history.mjs','map-viewport.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const{scenario,viewport}of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.declaredScreenshots);assert.equal(report.screenshotCount,report.cases.reduce((n,r)=>n+r.screenshots.length,0));assert.ok(report.cases.every(r=>r.screenshots.length>0));report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'Evidence remains below 24 MiB');
 }catch(error){report.errors.push(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(r=>r.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Contract-lifecycle completion Chromium checks failed; see verification-artifacts/contract-lifecycle-completion-report.json');
 console.log(`PASS: ${report.declaredCases} exact-head contract-lifecycle completion cases, native locks, exact freight/mail lifecycle money/die/Undo and bounded desktop/mobile evidence.`);
}
