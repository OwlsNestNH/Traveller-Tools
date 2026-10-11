// Bounded Stage 2 passenger capacity/setup and passenger-search completion gate.
// Executes the actual tagged app, passenger UI/rules, controller and native Store/Web Locks.
// Only synthetic HTTP, entropy, provider settlement and DOM boundaries are observed.
// No copied production modal body, fake navigator.locks, or reconstructed session offers.
// --fixtures-only validates source and independent rules/state oracles without launching a browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
import {distance, normalize as normalizeWorld} from '../js/map.mjs';
import {passengerOffers, PASSAGE_CLASSES, passageLabel} from '../js/passenger-rules.mjs';
import {latestPassengerSearch, passengerCapacity} from '../js/passengers.mjs';
import {displayDate} from '../js/calendar.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {formatCreditsText} from '../js/display.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const nearbyAPIWorld={Name:'Unrelated nearby refresh world',WorldX:3,WorldY:1,Sector:'Synthetic',Hex:'0402',UWP:'A788879-C',PBG:'703',Zone:''};
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='passenger-search-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const operations=['setup','search'];
// Chromium samples each production caller at the meaningful real DOM, publication,
// ownership and paint boundaries. The companion native suite owns the full economic,
// form/context and outcome cross-products; this finite matrix is not that cross-product.
const scenarios=operations.flatMap(operation=>['native','deferred','retry','unknown-before','unknown-after','foreign-same','new-dialog','read-only','map-owned','map-foreign'].map(mode=>({id:operation+'-'+mode,operation,mode,dual:['native','deferred','retry','unknown-before','unknown-after','read-only','map-owned'].includes(mode),map:mode.startsWith('map-')})));
for(const[index,mode]of ['recovery-reentry','disk-same','disk-unreadable','queued-pending','queued-settled','reentrant','contradictory','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','consumed-token','fulfilled-no-publication','foreign-new','editor-regain','native-close','render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close','foreign-form'].entries())scenarios.push({id:operations[index%2]+'-'+mode,operation:operations[index%2],mode});
for(const operation of operations)for(const point of ['title','body'])scenarios.push({id:operation+'-entry-'+point+'-reentry',operation,mode:'construction-reentry',point});
for(const operation of operations)for(const drift of ['hours','actual','world','trader','ship','settings','history','capacity','form'])scenarios.push({id:operation+'-context-'+drift,operation,mode:'context-drift',drift});
for(const operation of operations)scenarios.push({id:operation+'-retry-form-drift',operation,mode:'retry-form-drift'});
scenarios.push({id:'setup-retry-reviewed-drift',operation:'setup',mode:'retry-form-drift',reviewedDrift:true});
for(const [id,options]of [['opening-roll',{openingRoll:true}],['all-manual',{allManual:true}],['partial-manual',{manualSequence:true}],['zero-availability',{unavailable:true}],['cr100-manual-luggage',{step:100,luggage:'7'}],['existing-bookings',{booked:true}]])scenarios.push({id:'search-'+id,operation:'search',mode:'native',...options,dual:['zero-availability','cr100-manual-luggage'].includes(id)});
scenarios.push({id:'setup-preserves-current-search',operation:'setup',mode:'native',preserveSearch:true,dual:true},{id:'setup-zero-manual-luggage',operation:'setup',mode:'native',luggage:'0'},{id:'setup-existing-bookings',operation:'setup',mode:'native',booked:true});
scenarios.push({id:'boarding-delivery-regression',operation:'control',mode:'regression',dual:true});
scenarios.find(s=>s.id==='search-retry').manualSequence=true;scenarios.find(s=>s.id==='search-deferred').allManual=true;
scenarios.push({id:'search-replaces-current-search',operation:'search',mode:'native',preserveSearch:true,dual:true});
for(const operation of operations)for(const nearbyStage of ['review','prewrite','publication'])scenarios.push({id:operation+'-nearby-'+nearbyStage,operation,mode:'nearby-refresh',nearby:true,nearbyStage,dual:nearbyStage==='publication'});
const cases=scenarios.flatMap(scenario=>sizes.filter(size=>size.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
const detailedSuccess=s=>s.id===s.operation+'-native';
function successFrames(s){return 3+(detailedSuccess(s)?s.operation==='setup'?2:7:0);}
function expectedFrames(s){
 if(s.mode==='regression')return 5;
 if(s.mode==='nearby-refresh')return successFrames(s)+2;
 if(['native','queued-settled','reentrant','foreign-form'].includes(s.mode))return successFrames(s);
 if(['deferred','retry','recovery-reentry'].includes(s.mode))return successFrames(s)+2;
 if(s.mode==='map-owned'||s.mode==='queued-pending')return successFrames(s)+1;
 if(s.mode==='map-foreign'||s.mode==='read-only'||s.mode==='retry-form-drift')return 2;
 if(['construction-reentry','context-drift','disk-same','disk-unreadable','reentrant-close','foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token','render','report','close-after'].includes(s.mode))return 1;
 return 3;
}
const screenshotOptions=Object.freeze({type:'jpeg',quality:60,caret:'initial'});
const successPattern=/^(?:Passenger capacity settings saved\.|Passenger availability recorded\. Choose how many people to board\.)$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>passengerSearchGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>passengerSearchGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const isSetup=scenario=>scenario.operation==='setup';
const title=scenario=>isSetup(scenario)?'Review passenger capacity':'Find passengers';
const transitionLabel=scenario=>isSetup(scenario)?'Passenger capacity settings':'Passenger search';
const saveName=scenario=>isSetup(scenario)?'Passenger capacity settings':'Passenger search';
const report={suite:'Passenger setup/search save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,declaredScreenshots:cases.reduce((n,{scenario})=>n+expectedFrames(scenario),0),gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Two migrated callers only: passenger setup → configurePassengerCapacity and passenger search → recordPassengerSearch. Actual boarding/delivery are unchanged regression controls. Independent full-state/ledger/Undo oracles, four-class IDs/audits/manual dice and opening-roll policy; accepted allocation/checkbox preserved; native tagged Store/Web Locks and two-event bootstrap; exact readable durable baseline; actual held boot refreshNearby HTTP separately from MapAreaCache/ResizeObserver/rAF freeze; owned retry, stale context, newer Notes, terminal and read-only outcomes; reload/History Undo; individually reviewable desktop/mobile warning/footer/success/allocation/result/audit/Credits images. Representative Cr1/Cr100/huge-bank/manual-luggage/population/zero-count samples only; exhaustive native combinations are separate. No Stage 3 redesign or passenger boarding/delivery migration.'};
let browser,imageBytes=0;
function normalize(value){const ids=new Map();return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'generated-'+ids.size);return ids.get(id);}));}
function fixture(scenario={}){
 let s=S.initial();const origin={id:'1,1',x:1,y:1,name:'Passenger Origin',sector:'Synthetic',hex:'0202',uwp:'A788879-C',zone:'Safe',raw:{PBG:'703'}},destination={...origin,id:'2,1',x:2,name:'ExtraordinarilyLongUnbrokenPassengerDestinationForNarrowViewportVerification',hex:'0302'};
 Object.assign(s,{initialized:true,name:'Disposable passenger completion campaign',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Passenger Trader',capacity:'100',armed:true,staterooms:4,jump:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}},accommodation:{combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:scenario.luggage===undefined?'auto':'manual',luggageTons:scenario.luggage??'0',...(!isSetup(scenario)||scenario.booked?{passengerCapacity:{reservedCabins:1,installedLowBerths:4}}:{})}});
 Object.assign(s.trader,{broker:2,streetwise:3,rank:2,soc:1,characteristic:1});Object.assign(s.settings,{creditStep:scenario.step||1,tax:true,profit:50});
 s.lots=[{id:'unrelated-lot',commodity:'11',description:'Unrelated owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];
 s.ledger=[{id:'passenger-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];s.dashboardBaseline=createDashboardBaseline(s);
 if(scenario.booked){s=expected(s,{operation:'search',allManual:true});const offer=latestPassengerSearch(s).offers.find(o=>o.passageClass==='high');s=S.transition(s,'Accepted passenger booking',n=>S.acceptPassengers(n,offer.offerId,{count:2,cabinMode:'shared',serviceConfirmed:true}));}
 return S.validate(s);
}
function specification(before,scenario){
 if(isSetup(scenario))return {label:'Passenger capacity settings',capacity:{reservedCabins:2,installedLowBerths:6},diceCalls:0,inputs:{reservedCabins:2,installedLowBerths:6,reviewed:true}};
 const destination=before.route[before.routeIndex+1],from=R.context(before.worlds[before.actual],core),to=R.context(before.worlds[destination],core),parsecs=distance(before.worlds[before.actual],before.worlds[destination]);
 const generated={dice:[3,3],total:6},total=scenario.openingRoll?6:12,skill=2,characteristic=scenario.unavailable?-30:1,steward=1,searchDice=total===generated.total?generated:{dice:null,total,manual:true};
 const manualDice=scenario.allManual?Array(240).fill(2):scenario.manualSequence?[1,2,3,4,5,6,2,3,4,5]:[];let used=0,diceCalls=0;
 const rng=()=>used<manualDice.length?manualDice[used++]:(diceCalls++,3);
 const id=S.uid(),offers=passengerOffers(from,to,parsecs,{effect:total+skill+characteristic-8,steward},core,rng).map(o=>({...o,offerId:S.uid(),origin:before.actual,destination,audit:{...o.audit,searchDice:structuredClone(searchDice),searchSkill:skill,searchCharacteristic:characteristic,manualDice:structuredClone(manualDice)}}));
 const event={id,label:'Passenger search audit',world:before.actual,destination,hours:before.hours,offers,manualDice,manualDiceConsumed:used};
 return {label:'Passenger search',event,offers,diceCalls,inputs:{destination,dice:total,skill,characteristic,steward,sequence:manualDice.join(',')}};
}
function expected(before,scenario){const spec=specification(before,scenario);return S.transition(before,spec.label,s=>{if(scenario.nearbyStage==='review')s.worlds={'3,1':normalizeWorld(nearbyAPIWorld),...s.worlds};if(isSetup(scenario))S.configurePassengerCapacity(s,spec.capacity);else S.recordPassengerSearch(s,spec.event);});}
function assertSaved(saved,before,scenario){
 assert.deepEqual(normalize(saved),normalize(expected(before,scenario)),'Exact original full campaign transition, four-class generation/audit, accepted allocation, immutable economics and inverse Undo');
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 for(const key of ['bank','hours','lots','ledger','contracts','policies','actual','route','routeIndex','cooldowns','snapshots','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' unchanged by setup/search');
 assert.deepEqual(saved.worlds,scenario.nearbyStage==='review'?{'3,1':normalizeWorld(nearbyAPIWorld),...before.worlds}:before.worlds,'Original controller merges nearby data inside the transition only when it arrived before candidate preparation');
 assert.deepEqual(saved.events.slice(0,before.events.length),before.events,'Existing history and passenger booking audits remain immutable');
 if(isSetup(scenario)){
  const expectedShip=structuredClone(before.ship);expectedShip.accommodation.passengerCapacity=specification(before,scenario).capacity;assert.deepEqual(saved.ship,expectedShip,'Only reviewed capacity changes; complement, supplies, luggage and fuel stay exact');assert.equal(saved.latestPassengerSearchId,before.latestPassengerSearchId);
 }else{
  assert.deepEqual(saved.ship,before.ship);const audit=latestPassengerSearch(saved);assert.deepEqual(audit.offers.map(o=>o.passageClass),PASSAGE_CLASSES);assert.equal(new Set(audit.offers.map(o=>o.offerId)).size,4);assert.equal(audit.offers.every(o=>o.audit.originPopulation==='700000000'),true);
  if(scenario.unavailable)assert.ok(audit.offers.every(o=>o.count===0),'Zero-count search still has all four audited classes');
 }
 assert.deepEqual(material(S.undo(saved)),material(before),'Undo restores original capacities, money, complement and current-search reference');
}
function assertRetained(snapshot){assert.deepEqual(snapshot.semantic,{...snapshot.baseline,dice:snapshot.acceptedDice},'Pending completion preserves form/main/summary/tab/status and accepted availability dice');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.mainNodeRetained,true);}
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
 await context.exposeBinding('__passengerSearchUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__passengerSearchUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.passengerSearchStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   passengerSearchStorage.attempts++; passengerSearchStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (passengerSearchStorage.failNext) {passengerSearchStorage.failNext = false; throw Error('Synthetic known passenger-search prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); passengerSearchStorage.writes++; return result;
  };
  // Observe native parsing of the boot nearby response independently from the
  // viewport-cache callbacks. The fetch/normalization/refresh continuation is
  // unchanged; later fresh-search options prove it reached the real known-worlds map.
  globalThis.passengerSearchNearbyResponses=[];
  const responseJSON=Response.prototype.json;
  Response.prototype.json=function(...args){
   const url=new URL(this.url,location.href),relevant=url.origin==='https://travellermap.com'&&url.pathname.endsWith('/jumpworlds')&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12';
   const result=Reflect.apply(responseJSON,this,args);if(!relevant)return result;
   return result.then(value=>{const entry={url:url.href,parsedAt:performance.now(),worldIds:value.Worlds?.map(w=>w.WorldX+','+w.WorldY)||[],pending:!!globalThis.passengerSearchGate?.pending,writeExecuted:!!globalThis.passengerSearchGate?.pending?.executed};passengerSearchNearbyResponses.push(entry);globalThis.passengerSearchGate?.trace('boot-nearby-response-parsed',entry);return value;});
  };
  globalThis.passengerSearchDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {passengerSearchDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.passengerSearchMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.passengerSearchMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); passengerSearchMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    passengerSearchMapCallbacks.executed++; if (cache) passengerSearchMapCallbacks.cacheExecuted++;
    globalThis.passengerSearchGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.passengerSearchGate?.paintEdge('after', cache);
    passengerSearchMapCallbacks.completed++; if (cache) passengerSearchMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.passengerSearchGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {passengerSearchMapCallbacks.loadingCacheCompleted++; passengerSearchMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.passengerSearchMapLoadingStatusNode = statusNode;}
    globalThis.passengerSearchGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.passengerSearchGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.passengerSearchGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) passengerSearchMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY});
 let held, releaseHold, heldOnce = false, heldReady;const reached=new Promise(resolve=>{heldReady=resolve;});
 context.passengerSearchNetwork = {async waitHeld() {let timeout;try{await Promise.race([reached,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Real MapAreaCache tile did not reach network fixture')),10000);})]);return {...held};}finally{clearTimeout(timeout);}}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 let nearbyHeld,releaseNearby,nearbyHeldOnce=false,nearbyReached;const nearbyReady=new Promise(resolve=>{nearbyReached=resolve;});
 context.passengerNearbyNetwork={async waitHeld(){let timeout;try{await Promise.race([nearbyReady,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Actual boot refreshNearby request was not held')),10000);})]);return {...nearbyHeld};}finally{clearTimeout(timeout);}},release(){assert.ok(releaseNearby,'Nearby HTTP response remains held');const resolve=releaseNearby;releaseNearby=null;resolve();},cleanup(){releaseNearby?.();releaseNearby=null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/passenger-search-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable passenger-search native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if(scenario.nearby&&!nearbyHeldOnce&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'){
     nearbyHeldOnce=true;nearbyHeld={url:url.href,heldAt:Date.now(),released:false};result.nearbyResponse=nearbyHeld;nearbyReached();await new Promise(resolve=>{releaseNearby=resolve;});nearbyHeld.released=true;nearbyHeld.releasedAt=Date.now();
     return route.fulfill({json:{Worlds:[nearbyAPIWorld]},headers});
    }

    if (scenario.map && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {heldOnce = true; held = {url: url.href, heldAt: Date.now(), released: false}; result.mapResponse = held;heldReady(); await new Promise(resolve => {releaseHold = resolve;}); held.released = true; held.releasedAt = Date.now();}
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
  const passengerSpecifier=source.match(/import\s*\{[^}]*\bcreatePassengerUI\b[^}]*\}\s*from\s*['"]([^'"]*passenger-ui\.mjs[^'"]*)['"]/u)?.[1];if(!passengerSpecifier)throw Error('Actual passenger UI import missing');const passengerURL=new URL(passengerSpecifier,appURL).href;if(!new URL(passengerURL).search)throw Error('Actual passenger UI must be version-tagged');const passengerResponse=await fetch(passengerURL);if(!passengerResponse.ok)throw Error('Cannot inspect actual passenger UI');const passengerSource=await passengerResponse.text();
  if (!new URL(storeURL).search) throw Error('Actual Store must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save, nativeRead = Store.prototype.read;
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const storeResponse = await fetch(storeURL); if (!storeResponse.ok) throw Error('Cannot inspect runtime Store');
  const storeSource = await storeResponse.text();
  const g = globalThis.passengerSearchGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
  Object.assign(g, {timeline: [], timelineDropped: 0, constructionChecks: [], readChecks: []});
  g.trace = (event, detail = {}) => {const entry = {order: g.timeline.length + 1, at: performance.now(), event, ...detail}; if (g.timeline.length < 120) g.timeline.push(entry); else g.timelineDropped++; return entry;};
  Object.assign(g, {strict: false, paintEdges: [], paintEdgesDropped: 0, mutationCount: 0, phase: 'review', nextNodeId: 0, nodeIds: new WeakMap()});
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextNodeId), g.nextNodeId)) : null;
  g.mapNodeId = nodeId;
  g.mapCapture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, regions: ['.world-map', '#map-load-status', '.planned-route', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status'].map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.mapCapture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const observer = new MutationObserver(records => {if (g.strict) g.mutationCount += records.length;});
  g.beginStrict = () => {g.strict = true; g.mapBaseline = g.mapCapture('strict-baseline'); for (const selector of ['#main', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status']) observer.observe(document.querySelector(selector), {subtree: true, childList: true, attributes: true, characterData: true});};
  g.endStrict = () => {g.strict = false; observer.disconnect();};
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: passengerSearchDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic passenger-search completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^(?:Passenger capacity settings saved\.|Passenger availability recorded\. Choose how many people to board\.)$/s.test(value)) fault('report');
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
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic passenger-search entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: passengerSearchStorage.writes});
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
   for (const [name, arg] of [['tab', 'Cargo'], ['world', '2,1'], ['deposit', ''], ['passenger-setup', ''], ['passenger-search', ''], ['passenger-board', 'missing'], ['passenger-deliver', 'missing'], ['contracts-search', ''], ['mail-check', ''], ['sale-clear', ''], ['sale-all', '']]) g.dispatch(name, arg);
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before passenger-search publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after passenger-search publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this); if (g.readFault) throw Error('Synthetic unreadable durable passenger-search baseline'); const value=Reflect.apply(nativeRead,this,args),check={exactDurableCopy:JSON.stringify(value)===localStorage.getItem(KEY),aliasesLive:value===g.lastState,revision:value.revision};g.readChecks.push(check);if(check.aliasesLive||!check.exactDurableCopy)throw Error('Store.read must return the full readable durable campaign copy');return value;};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = passengerSearchDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending passenger-search save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native passenger-search write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending passenger-search completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known passenger-search prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown passenger-search outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory passenger-search not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable passenger-search save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: passengerSearchMapCallbacks.cacheCompleted, loadingCacheCompleted: passengerSearchMapCallbacks.loadingCacheCompleted});};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...passengerSearchStorage}, candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, acceptedDice:g.acceptedDice, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, mainNodeRetained: !!g.mainNode?.isConnected, newer: g.newer, recoveryChecks: g.recoveryChecks, callbacks: {...passengerSearchMapCallbacks}, nearbyResponses:passengerSearchNearbyResponses, bootstrap: g.bootstrap, mapReadiness: g.mapReadiness, retainedBaselineOrder: g.retainedBaselineOrder, constructionChecks: g.constructionChecks, readChecks: g.readChecks, timeline: g.timeline, timelineDropped: g.timelineDropped, mapBaseline: g.mapBaseline, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, mutationCount: g.mutationCount, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[]});
   Object.assign(passengerSearchStorage,{attempts:0,writes:0,failNext:false,observations:[]});
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = passengerSearchStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || passengerSearchStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
  g.bootstrap = {storeDiscovered: true, dispatches: 2, observedPublications: g.publications.length - discoveredPublications, appCallbackCompleted: g.publications.at(-1).actualCallback, deliveredRevision: g.lastState.revision, exactDurableBytes: true, writes: 0};
  g.trace('observation-bootstrap-complete', g.bootstrap);
  // Later in-place fixture drift changes only this actual delivered test object.
  return {appURL, storeURL, passengerURL, passengerSHA256:await digest(passengerSource), appSHA256: await digest(source), storeSHA256: await digest(storeSource), nativeLocks: !!navigator.locks};
 });
 assert.equal(result.runtime.nativeLocks, true);
 assert.equal(result.runtime.appSHA256, hash(await readFile(new URL('../js/app.mjs', import.meta.url))));
 assert.equal(result.runtime.storeSHA256, hash(await readFile(new URL('../js/persistence.mjs', import.meta.url))));
 assert.equal(result.runtime.passengerSHA256,hash(await readFile(new URL('../js/passenger-ui.mjs',import.meta.url))));
}
async function capture(page, result, label) {
 await frames(page); const name = prefix + result.id + '-' + label + '.jpg';
 const bytes = await page.screenshot({path: join(artifacts, name), ...screenshotOptions});
 imageBytes += bytes.length; assert.ok(imageBytes < report.limits.imageBytes, 'Bounded screenshot bytes'); result.screenshots.push(name); (result.imageSHA256 ??= {})[name] = hash(bytes); (result.frameProvenance ??= []).push({name, producerCommit: report.testedCommit, appSHA256: result.runtime?.appSHA256 ?? report.sourceSHA256?.['app.mjs'] ?? null, passengerSHA256:result.runtime?.passengerSHA256??report.sourceSHA256?.['passenger-ui.mjs']??null, gateSHA256: report.gateSHA256, imageSHA256: hash(bytes), bytes: bytes.length});
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Passenger setup/search dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Passenger setup/search content stays inside dialog');}
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
  const input=page.locator('#modal [name="'+name+'"]');
  for(const details of await input.locator('xpath=ancestor::details').all())if(!await details.evaluate(node=>node.open))await details.locator(':scope > summary').click();
  if(name==='reviewed')await input.setChecked(value);else if(name==='destination')await input.selectOption(value);else await fill(page,name,value);
 }
}
async function draftIds(page){return page.locator('[data-action="passenger-board"]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.arg))]);}
async function seedDrafts(page,result,scenario){
 if(!scenario.preserveSearch)return;
 const seed={operation:'search'};await tab(page,'Contracts');await action(page,'passenger-search').click();const before=await read(page);await fillTerms(page,before,seed);await pointer(page,'#modal-submit');await closed(page);await frames(page);assertSaved(await read(page),before,seed);
 result.initialDraftIds=await draftIds(page);assert.equal(result.initialDraftIds.length,4);await page.evaluate(()=>passengerSearchGate.reset());
}
function actionSpec(_before,scenario){return {name:isSetup(scenario)?'passenger-setup':'passenger-search'};}
async function prepare(page,result,scenario,before,{loops=false,network=null}={}){
 await tab(page,scenario.map?'Overview':'Contracts');
 const open=async()=>{
  const priorDice=await page.evaluate(()=>passengerSearchDiceCalls),{name}=actionSpec(before,scenario);
  if(scenario.map)await page.evaluate(name=>passengerSearchGate.dispatch(name),name);else await action(page,name).click();
  await page.locator('#modal-title').filter({hasText:new RegExp('^'+title(scenario)+'$')}).waitFor();
  assert.equal(await page.evaluate(()=>passengerSearchDiceCalls),priorDice+(isSetup(scenario)?0:2),'Original search entry consumes 2D; setup has no roll and availability waits for submission');
  if(!isSetup(scenario))assert.equal(await page.locator('#modal [name="dice"]').inputValue(),'6','Original generated opening roll is shown before manual override');
  const focus=await page.evaluate(()=>({id:document.activeElement?.id,name:document.activeElement?.name}));(result.entryFocus??=[]).push(focus);assert.ok(focus.id||focus.name);
  await fillTerms(page,before,scenario);await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.deepEqual(await read(page),before);assert.equal(await page.locator('#modal-error').textContent(),'');
 };
 await open();
 if(loops){const priorDice=await page.evaluate(()=>passengerSearchDiceCalls);await pointer(page,'#modal-cancel');await closed(page);assert.deepEqual(await read(page),before);await open();assert.equal(await page.evaluate(()=>passengerSearchDiceCalls),priorDice+(isSetup(scenario)?0:2),'Cancel/reopen changes no capacity/availability; only a fresh search entry rerolls its original 2D');}
 await page.evaluate(()=>document.activeElement?.blur());await frames(page);
 if(scenario.map){
  const held=await network.waitHeld();assert.equal(held.released,false);
  await page.waitForFunction(()=>passengerSearchMapCallbacks.loadingCacheCompleted>0&&passengerSearchMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));
  await page.evaluate(held=>{if(passengerSearchGate.totalCalls||passengerSearchGate.pending||passengerSearchStorage.writes)throw Error('Initial cache readiness must precede provider work');passengerSearchGate.mapReadiness=passengerSearchGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...passengerSearchMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:passengerSearchGate.mapNodeId(passengerSearchMapLoadingStatusNode)});},held);
 }
 await page.evaluate(()=>passengerSearchGate.remember());
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');if(passengerSearchGate.oldSubmit)void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();if(navigation)passengerSearchGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 if(scenario.mode==='queued-pending')await page.evaluate(()=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])passengerSearchGate.dispatch(name,arg);void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});
 else if(scenario.mode==='deferred'){await page.locator('#modal-submit').focus();await page.keyboard.press('Enter');}
 else await pointer(page,'#modal-submit',2);
 await page.waitForFunction(()=>!!passengerSearchGate.pending);await frames(page);
 assert.equal(await raw(page),bytes,'Held completion leaves exact durable bytes alone');let snapshot=await gate(page);assertRetained(snapshot);
 assert.equal(snapshot.acceptedDice,snapshot.baseline.dice+specification(before,scenario).diceCalls,'Only the first accepted search submission consumes remaining availability dice');
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen synchronously');
 for(const control of await page.locator('#modal-body input,#modal-body select,#modal-body textarea').all())assert.equal(await control.isDisabled(),true,'Every accepted term freezes before provider entry');
 await replay(page);snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(await raw(page),bytes);assertRetained(snapshot);
 for(const forwarded of snapshot.forwarded){assert.ok(forwarded.argumentCount>=3);assert.equal(forwarded.tokenPresent,true);assert.equal(forwarded.candidateRevision,forwarded.expectedRevision+1);}
 if(scenario.mode==='deferred')await detail(page,result,'pending-before-write-footer',['#modal-cancel','#modal-submit']);
 result.checks.push('Exactly one provider call; frozen fields/Close/X/Escape, Enter, detached/duplicate callbacks, queued tab/world/deposit, Notes and competing passenger actions');
}
async function reloadUndo(page,result,before,scenario,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>passengerSearchStorage.writes),0,'Reload cannot repeat setup/search');
 await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes);assert.deepEqual(await draftIds(page),[]);assert.equal(await page.locator('[data-action="passenger-board"],[data-action="passenger-offer-audit"]').count(),0,'Actual Contracts surface cannot reconstruct actionable offers from historical results');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 const saved=await read(page);assertSaved(saved,before,scenario);await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);assert.deepEqual(normalize(await read(page)),normalize(S.undo(saved)),'Actual History Undo preserves every original audit and adds exactly the correct Undo record');assert.deepEqual(material(await read(page)),material(before));assert.equal((await read(page)).revision,before.revision+2);assert.equal(await page.evaluate(()=>passengerSearchStorage.writes),1);
 const undoneBytes=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),undoneBytes);assert.deepEqual(await draftIds(page),[]);assert.equal(await page.locator('[data-action="passenger-board"],[data-action="passenger-offer-audit"]').count(),0);assert.equal(await page.evaluate(()=>passengerSearchStorage.writes),1);
 result.checks.push('Reload keeps exact bytes without reviving session offers; actual History Undo restores capacity, economics and the prior search reference without recreating offers');
}
async function successful(page,result,before,scenario){
 await closed(page);await frames(page);const saved=await read(page);assertSaved(saved,before,scenario);result.economicEvidence={beforeSHA256:hash(JSON.stringify(before)),savedSHA256:hash(JSON.stringify(saved)),bank:saved.bank,hours:saved.hours,ledgerCount:saved.ledger.length,undoCount:saved.undo.length,capacity:passengerCapacity(saved),latestPassengerSearch:latestPassengerSearch(saved)};const snapshot=await gate(page),spec=specification(before,scenario);
 assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(await page.locator('#modal-error').textContent(),'');
 assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),scenario.map?'Overview':'Contracts','Setup/search preserves its originating surface');
 assert.equal(snapshot.semantic.dice,snapshot.baseline.dice+spec.diceCalls,'Completion and retry never regenerate the accepted search');
 assert.equal(await page.locator('#message').textContent(),isSetup(scenario)?'Passenger capacity settings saved.':'Passenger availability recorded. Choose how many people to board.');
 await detail(page,result,'saved-success-status',['#message'],successPattern);
 if(scenario.map){const bytes=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,snapshot.totalCalls);}
 const expectedIds=isSetup(scenario)?result.initialDraftIds||[]:latestPassengerSearch(saved).offers.map(o=>o.offerId);if(!isSetup(scenario)&&result.initialDraftIds)assert.ok(expectedIds.every(id=>!result.initialDraftIds.includes(id)),'A completed replacement search replaces all old session IDs while preserving old audits');assert.deepEqual((await draftIds(page)).sort(),expectedIds.sort(),'Only owned settled completion publishes exactly the accepted four-class IDs; capacity retains preexisting session results');
 for(const observation of [...snapshot.observations,...snapshot.storage.observations])assert.equal(observation.message,snapshot.baseline.message,'No success message is published before provider settlement');
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);
 assert.ok(snapshot.readChecks.every(check=>check.exactDurableCopy&&!check.aliasesLive),'Each actual Store.read is the whole readable durable campaign, independent of the delivered live object');
 const bytes=await raw(page),calls=snapshot.totalCalls,dice=snapshot.semantic.dice;
 await page.evaluate(()=>{void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 if(detailedSuccess(scenario)){
  if(isSetup(scenario)){
   await detail(page,result,'saved-capacity-summary',['.passenger-summary'],/2 cabins and 6 Low berths free/);
   await page.locator('.passenger-panel details > summary').click();
   await detail(page,result,'saved-reviewed-allocation',['.passenger-panel .passenger-facts > dt:first-of-type','.passenger-panel .passenger-facts > dd:nth-of-type(4)'],/Installed cabins[\s\S]*6 \/ 0/);
  }else{
   for(const offer of latestPassengerSearch(saved).offers){
    const card='.passenger-offer:has([data-action="passenger-board"][data-arg="'+offer.offerId+'"])';
    assert.equal(await page.locator(card+' h3').textContent(),passageLabel(offer.passageClass));assert.ok((await page.locator(card).textContent()).includes(formatCreditsText(offer.fare)));
    await detail(page,result,'saved-'+offer.passageClass+'-offer',[card],new RegExp(offer.count+' available'));
   }
   const offer=latestPassengerSearch(saved).offers.find(o=>o.passageClass==='high');await action(page,'passenger-offer-audit',offer.offerId).click();await page.locator('#modal-title').filter({hasText:/^Passenger availability audit$/}).waitFor();
   const facts=await page.locator('#modal-body').textContent();assert.ok(facts.includes(formatCreditsText(offer.fare)));assert.ok(facts.includes('Manual total 12'));assert.ok(facts.includes(String(offer.audit.count.total)));
   await detail(page,result,'saved-audit-search-inputs',['#modal-body > dl:nth-of-type(2) > dt:first-of-type','#modal-body > dl:nth-of-type(2) > dd:nth-of-type(4)'],/Search 2D/);
   await detail(page,result,'saved-audit-availability-dice',['#modal-body > dl:nth-of-type(2) > dt:nth-of-type(11)','#modal-body > dl:nth-of-type(2) > dd:nth-of-type(14)'],/Traffic 2D/);
   assert.equal(await page.locator('#modal-submit').isHidden(),true);await detail(page,result,'saved-audit-readonly-footer',['#modal-cancel'],/Close/);await pointer(page,'#modal-cancel');await closed(page);
  }
 }
 assert.equal(await raw(page),bytes,'Allocation, offer and audit inspection is read-only');assert.equal((await gate(page)).totalCalls,calls);assert.equal((await gate(page)).semantic.dice,dice);
 const credits='#summary .stat:last-child';assert.ok((await page.locator(credits).textContent()).includes(formatCreditsText(before.bank)));await detail(page,result,'unchanged-huge-credits',[credits],/Credits/);
 await tab(page,'Overview');await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);assert.equal((await gate(page)).semantic.dice,dice);assert.equal(await page.locator('#ship-actions .campaign-time .value').textContent(),displayDate(saved.dateLabel,saved.hours));await detail(page,result,'unchanged-campaign-time',['#ship-actions .campaign-time .value']);
 if(scenario.nearby)await verifyNearbyAvailable(page,result);result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
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
 await page.evaluate(()=>{passengerSearchGate.store.yield();passengerSearchGate.store.onChange(passengerSearchGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#save-status').textContent(),guidance);
 result.gate=safeReport(await gate(page));assert.equal(result.gate.storage.writes,committed?1:0);await reloadUndo(page,result,before,scenario,{committed});
 result.checks.push('Exact saved/unknown guidance; terminal authority latched before fallible reporting, native lock released, replay refused and reload authoritative');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/passenger-search-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.passengerSearchPeer = {state: null, editable: false}; passengerSearchPeer.store = new Store(next => {passengerSearchPeer.state = next;}, editable => {passengerSearchPeer.editable = editable;}); await passengerSearchPeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => passengerSearchPeer.editable); await page.waitForFunction(() => passengerSearchGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(passengerSearchPeer.state, 'Foreign deposit during passenger-search save', s => S.deposit(s, 7, 'Synthetic peer')); passengerSearchPeer.store.save(next, passengerSearchPeer.state.revision); return passengerSearchPeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {passengerSearchPeer.store.yield(); passengerSearchPeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => passengerSearchGate.store.acquire(true)); await page.waitForFunction(() => passengerSearchGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;
 const before=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent}));
 const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===passengerSearchGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===passengerSearchGate.newerClose,submitCallable:typeof passengerSearchGate.newerSubmit==='function',closeCallable:typeof passengerSearchGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>{void passengerSearchGate.newerSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
 assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent})),before);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await page.evaluate(()=>passengerSearchGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Actual newer Notes handler identities survive old settlement and detached replay; captured Notes submit remains read-only and captured Close dismisses without writes');
}
async function retired(page, result, before, scenario, context) {
 const mode = scenario.mode;
 if (mode === 'foreign-same') await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY);
 if (mode === 'foreign-new') await peerTakeover(page, result, context, {write: true});
 if (mode === 'editor-regain') await peerTakeover(page, result, context, {regain: true});
 if (mode === 'native-close' || mode === 'new-dialog') {
  await page.evaluate(() => {document.querySelector('#modal').close(); document.querySelector('#modal').dispatchEvent(new Event('close'));}); await frames(page);
  if (mode === 'new-dialog') {await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor();await page.evaluate(()=>{passengerSearchGate.newerSubmit=document.querySelector('#modal-form').onsubmit;passengerSearchGate.newerClose=document.querySelector('#modal-cancel').onclick;});}
 }
 const authoritative = await raw(page), newer = mode === 'new-dialog' ? await page.locator('#modal-body').textContent() : null;
 await release(page); await frames(page);
 if (mode === 'foreign-new') {assert.equal(await raw(page), authoritative); assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n)); assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');}
 else assertSaved(await read(page), before, scenario);
 assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {void passengerSearchGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 if (mode === 'foreign-same') await detail(page, result, 'stale-owner-warning', ['#modal-error'], /Campaign, passenger terms or editing ownership changed/);
 else await capture(page, result, 'retired-owner');
 if(mode==='new-dialog')await verifyNewerNotes(page,result);
 result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign/consumed publication, editor tenure and modal replacement retire old success/cleanup authority permanently');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: passengerSearchGate.mapCapture('before-resize'), callbacks: {...passengerSearchMapCallbacks}}));
 await page.evaluate(() => {passengerSearchGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => passengerSearchMapCallbacks.resizeDelivered > previous.resizeDelivered && passengerSearchMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => passengerSearchGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.passengerSearchNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {passengerSearchGate.beginStrict(); passengerSearchGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>passengerSearchGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {passengerSearchGate.phase = 'cache-response'; passengerSearchGate.trace('held-cache-release-requested');}); context.passengerSearchNetwork.release();
 await page.waitForFunction(n => passengerSearchMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => passengerSearchGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => passengerSearchGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page, result, {resume: true}); await release(page); await frames(page); assertSaved(await read(page), before, scenario); assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
  await detail(page, result, 'foreign-map-warning', ['#modal-error'], /Campaign, passenger terms or editing ownership changed/); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function verifyNearbyAvailable(page,result){
 const bytes=await raw(page),before=await gate(page);await page.evaluate(()=>passengerSearchGate.dispatch('passenger-search'));await page.locator('#modal-title').filter({hasText:/^Find passengers$/}).waitFor();
 const option=page.locator('#modal [name="destination"] option[value="3,1"]');assert.equal(await option.count(),1,'The actual boot refreshNearby continuation enriched getWorlds, proven by a fresh real passenger search');assert.equal(await option.textContent(),'Unrelated nearby refresh world · 0402');
 await page.locator('#modal [name="destination"]').selectOption('3,1');await detail(page,result,'nearby-world-available-next-search',['#modal [name="destination"]']);
 assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,before.totalCalls);assert.equal((await gate(page)).semantic.dice,before.semantic.dice+2,'Only an explicitly opened fresh search consumes its original 2D; nearby completion never rerolled the accepted search');await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);
 result.checks.push('Fresh actual passenger search contains the newly loaded unrelated world, proving native refreshNearby finished; that new draft is canceled without another write');
}
async function nearbyRefresh(page,result,scenario,before,context){
 const held=await context.passengerNearbyNetwork.waitHeld();assert.equal(held.released,false);assert.match(held.url,/jumpworlds/);const bytes=await raw(page),baseline=await gate(page);
 const parsedBefore=await page.evaluate(()=>passengerSearchNearbyResponses.length);
 const completeHTTP=async()=>{
  const responseBaseline=await raw(page);context.passengerNearbyNetwork.release();await page.waitForFunction(n=>passengerSearchNearbyResponses.length>n,parsedBefore);await frames(page);
  const snapshot=await gate(page),response=snapshot.nearbyResponses.at(-1);assert.deepEqual(response.worldIds,['3,1']);assert.equal(response.url,held.url);assert.equal(snapshot.semantic.dice,snapshot.acceptedDice??baseline.semantic.dice,'Background nearby normalization and continuation never consume dice');
  result.nearbyContinuation={stage:scenario.nearbyStage,parsedResponse:response,animationFramesCompleted:true,fullCampaignBytesUnchanged:await raw(page)===responseBaseline};assert.equal(result.nearbyContinuation.fullCampaignBytesUnchanged,true);return snapshot;
 };
 if(scenario.nearbyStage==='review'){
  await page.evaluate(()=>{const g=passengerSearchGate;g.nearbyReview={form:document.querySelector('#modal-form'),html:document.querySelector('#modal-form').innerHTML,submit:document.querySelector('#modal-form').onsubmit,close:document.querySelector('#modal-cancel').onclick,mutations:0};g.nearbyReview.observer=new MutationObserver(records=>{g.nearbyReview.mutations+=records.length;});g.nearbyReview.observer.observe(g.nearbyReview.form,{subtree:true,childList:true,attributes:true,characterData:true});});
  const snapshot=await completeHTTP();assert.deepEqual(snapshot.semantic,baseline.semantic,'Unrelated enrichment cannot change accepted review text, field values, current tab, status or opening roll');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.totalCalls,0);assert.equal(await raw(page),bytes);
  result.nearbyReview=await page.evaluate(()=>{const g=passengerSearchGate,r=g.nearbyReview;r.observer.disconnect();return {sameForm:document.querySelector('#modal-form')===r.form,sameHTML:r.form.innerHTML===r.html,sameSubmit:r.form.onsubmit===r.submit,sameClose:document.querySelector('#modal-cancel').onclick===r.close,mutations:r.mutations};});assert.deepEqual(result.nearbyReview,{sameForm:true,sameHTML:true,sameSubmit:true,sameClose:true,mutations:0});
  await detail(page,result,'nearby-review-retained-footer',['#modal-cancel','#modal-submit']);
  // refreshNearby originally renders the underlying Contracts panel at review
  // time. Keep that read-only repaint; retain its newly mounted main baseline
  // before the separate pending write begins. The reviewed form never changed.
  await page.evaluate(()=>{passengerSearchGate.remember();passengerSearchGate.armed=true;});await assertPending(page,result,scenario,bytes,before);await release(page);await successful(page,result,before,scenario);return;
 }
 await page.evaluate(()=>{passengerSearchGate.armed=true;});await assertPending(page,result,scenario,bytes,before);await page.evaluate(()=>passengerSearchGate.beginStrict());
 if(scenario.nearbyStage==='publication'){await page.evaluate(()=>passengerSearchGate.write());await frames(page);assertSaved(await read(page),before,scenario);}
 const heldBytes=await raw(page),snapshot=await completeHTTP();assert.equal(await raw(page),heldBytes,'Read-only refreshNearby never changes durable campaign bytes');assertRetained(snapshot);assert.equal(snapshot.mutationCount,0,'Actual refreshNearby render callback cannot mutate any pending main/form/footer/summary/tab/status DOM');
 assert.deepEqual((await page.evaluate(()=>passengerSearchGate.mapCapture('after-nearby-continuation'))).regions,snapshot.mapBaseline.regions);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.pending,true);assert.equal(snapshot.nearbyResponses.at(-1).pending,true);assert.equal(snapshot.nearbyResponses.at(-1).writeExecuted,scenario.nearbyStage==='publication');
 await detail(page,result,'nearby-pending-retained-footer',['#modal-cancel','#modal-submit']);assert.equal((await gate(page)).mutationCount,0);await page.evaluate(()=>passengerSearchGate.endStrict());await release(page);await successful(page,result,before,scenario);
 result.checks.push('Held actual boot refreshNearby(false) response completes '+scenario.nearbyStage+' without invalidating accepted consent, publishing offers early, mutating pending DOM or rerolling');
}
async function regressionControl(page,result,scenario){
 // These are native, unchanged boarding/delivery regression controls only. They
 // are never armed with a deferred provider or claimed as migrated callers.
 const initial=await read(page),searchScenario={operation:'search',allManual:true};await tab(page,'Contracts');await action(page,'passenger-search').click();await fillTerms(page,initial,searchScenario);await pointer(page,'#modal-submit');await closed(page);await frames(page);
 const searched=await read(page);assertSaved(searched,initial,searchScenario);const offer=latestPassengerSearch(searched).offers.find(o=>o.passageClass==='high'),terms={count:2,cabinMode:'shared',serviceConfirmed:true};
 const preview=async()=>{await action(page,'passenger-board',offer.offerId).click();await fill(page,'count',2);await page.locator('#modal [name="cabinMode"]').selectOption('shared');await page.locator('#modal [name="serviceConfirmed"]').check();await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm passenger booking$/}).waitFor();assert.deepEqual(await read(page),searched,'Actual boarding preview is draft-only');};
 await preview();await detail(page,result,'regression-booking-preview',['#modal-body > dl > dt:nth-of-type(4)','#modal-body > dl > dd:nth-of-type(5)'],/Payment on delivery/);await pointer(page,'#modal-cancel');await closed(page);assert.deepEqual(await read(page),searched);
 await preview();await pointer(page,'#modal-submit');await closed(page);await frames(page);const aboard=await read(page),booking=aboard.contracts.at(-1),expectedAboard=S.transition(searched,'Accepted passenger booking',s=>S.acceptPassengers(s,offer.offerId,terms));assert.deepEqual(normalize(aboard),normalize(expectedAboard));assert.equal(booking.payment,String(BigInt(offer.fare)*2n));assert.equal(aboard.bank,searched.bank);assert.deepEqual(aboard.ship,searched.ship);assert.deepEqual(aboard.ledger,searched.ledger);await detail(page,result,'regression-booking-aboard',['.passenger-summary'],/2 booked people aboard/);
 await tab(page,'Overview');const preJumpCalls=(await gate(page)).totalCalls;await action(page,'jump').click();await page.locator('#modal-title').filter({hasText:/^Commit jump/}).waitFor();assert.equal((await gate(page)).totalCalls,preJumpCalls+1,'Original Jump persists its prepared roll before showing the commit dialog');await fill(page,'hours',168);await pointer(page,'#modal-submit');await closed(page);await frames(page);const arrived=await read(page);assert.equal(arrived.actual,booking.destination);assert.equal(arrived.bank,aboard.bank);assert.equal(Number(arrived.ship.lifeSupport.stockUnits.numerator)/Number(arrived.ship.lifeSupport.stockUnits.denominator),84,'Original seven-day jump uses 28 LSS for two baseline and two booked awake people');
 await tab(page,'Contracts');await action(page,'passenger-deliver',booking.id).click();await page.locator('#modal-title').filter({hasText:/^Complete passenger passage$/}).waitFor();assert.deepEqual(await read(page),arrived,'Actual delivery preview is draft-only');await detail(page,result,'regression-delivery-payment',['#modal-body > dl > dt:nth-of-type(3)','#modal-body > dl > dd:nth-of-type(3)'],/Payment/);await pointer(page,'#modal-submit');await closed(page);await frames(page);
 const delivered=await read(page),expectedDelivered=S.transition(arrived,'Delivered passenger booking',s=>S.deliverPassengers(s,booking.id));assert.deepEqual(normalize(delivered),normalize(expectedDelivered));assert.equal(delivered.ledger.filter(e=>e.type==='Passenger delivery'&&e.contractId===booking.id).length,1);assert.equal(delivered.bank,String(BigInt(arrived.bank)+BigInt(booking.payment)));assert.deepEqual(delivered.ship,arrived.ship);assert.equal(await page.locator('[data-action="passenger-deliver"]').count(),0);
 const credits='#summary .stat:last-child';assert.ok((await page.locator(credits).textContent()).includes(formatCreditsText(delivered.bank)));await detail(page,result,'regression-delivery-credits',[credits],/Credits/);
 await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);assert.deepEqual(normalize(await read(page)),normalize(S.undo(delivered)),'Native passenger delivery Undo preserves complete audit/jump-attempt history');assert.deepEqual(material(await read(page)),material(arrived));await tab(page,'Contracts');await detail(page,result,'regression-history-undo-aboard',['.passenger-summary'],/2 booked people aboard/);
 const bytes=await raw(page);result.gate=safeReport(await gate(page));assert.equal(result.gate.totalCalls,6,'One native search, boarding, jump preparation, jump commit, delivery and actual Undo; passenger previews and Cancel never write');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes);assert.deepEqual(await draftIds(page),[]);assert.equal((await read(page)).contracts.find(c=>c.id===booking.id).status,'accepted');assert.equal(await page.evaluate(()=>passengerSearchStorage.writes),0);
 result.checks.push('Unchanged native boarding/Cancel/confirm, explicit actual destination jump, delivery receipt and actual History Undo preserve full economics/complement; reload never recreates availability');
}
async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>passengerSearchStorage.writes),0,'Complete synthetic seed requires no migration write');
 await installGate(page,result);if(scenario.mode==='regression'){await regressionControl(page,result,scenario);return;}await seedDrafts(page,result,scenario);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(mode==='construction-reentry'){
  await tab(page,'Contracts');const {name,arg}=actionSpec(before,scenario);
  await page.evaluate(point=>{passengerSearchGate.constructionFault=point;},scenario.point);await action(page,name,arg).click();await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);
  const snapshot=await gate(page);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===passengerSearchGate.newerSubmit),true);
  await page.evaluate(()=>document.querySelector('#modal-form').requestSubmit());await frames(page);assert.equal(await page.locator('#modal-title').textContent(),snapshot.newer.title);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);
  await detail(page,result,'newer-notes-owns-entry',['#modal-body .notes-list article:first-child'],/Rules and verification/);await verifyNewerNotes(page,result);
  await page.evaluate(()=>passengerSearchGate.dispatch('deposit'));await page.locator('#modal-title').filter({hasText:/^Record deposit$/}).waitFor();await fill(page,'amount','17');await fill(page,'reason','Synthetic later entry');await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm deposit$/}).waitFor();assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await pointer(page,'#modal-cancel');await closed(page);
  result.gate=safeReport(await gate(page));result.checks.push('Real synchronous Notes onclick during '+scenario.point+' setter owns newer DOM/handler/Close; old construction cannot write or overwrite it; later Deposit entry remains usable');return;
 }
 await prepare(page,result,scenario,before,{loops:mode==='deferred',network:context.passengerSearchNetwork});
 if(mode==='nearby-refresh'){await nearbyRefresh(page,result,scenario,before,context);return;}
 if(mode==='context-drift'){
  await page.evaluate(({drift})=>{const s=passengerSearchGate.lastState;if(drift==='hours')s.hours++;if(drift==='actual')s.actual='2,1';if(drift==='world')s.worlds[s.actual].uwp='B788879-C';if(drift==='trader')s.trader.broker++;if(drift==='ship')s.ship.accommodation.rooms.middle++;if(drift==='settings')s.settings.creditStep=100;if(drift==='history')s.events.push({id:'synthetic-context-drift',label:'Synthetic drift',hours:s.hours});if(drift==='capacity')s.ship.accommodation.passengerCapacity={reservedCabins:0,installedLowBerths:9};if(drift==='form'){const old=document.querySelector('#modal-form');passengerSearchGate.replacedForm=old;const replacement=old.cloneNode(true);old.replaceWith(replacement);}},scenario);
  if(scenario.drift==='form')await page.evaluate(()=>{void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});else await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);if(scenario.drift==='form'){await detail(page,result,'foreign-form-context-retained',['#modal-title']);result.gate=safeReport(await gate(page));return;}assert.match(await page.locator('#modal-error').textContent(),/changed|reopen|review/i);await detail(page,result,'same-revision-context-retired',['#modal-error'],/changed|reopen|review/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);result.gate=safeReport(await gate(page));result.checks.push('Actual app-delivered same-revision '+scenario.drift+' drift retires stale consent before generation or provider work');return;
 }
 if(mode==='read-only'){
  await peerTakeover(page,result,context);await frames(page);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);const beforeCalls=(await gate(page)).totalCalls;await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,beforeCalls);assert.equal(await raw(page),bytes);await detail(page,result,'read-only-warning',['#modal-error'],/Editing moved|ownership changed/);await pointer(page,'#modal-cancel');await closed(page);for(const name of ['passenger-search','passenger-setup'])assert.equal(await action(page,name).isDisabled(),true,'Read-only Contracts action stays disabled: '+name);await detail(page,result,'read-only-status',['#save-status']);result.gate=safeReport(await gate(page));return;
 }
 if(mode==='foreign-form'){await page.evaluate(()=>{const clone=document.querySelector('#modal-form').cloneNode(true);void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:clone});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form'].includes(mode)){
  const immediate=await page.evaluate(mode=>{passengerSearchGate.reentrant=mode==='reentrant';if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])passengerSearchGate.dispatch(name,arg);void passengerSearchGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});return {writes:passengerSearchStorage.writes,open:document.querySelector('#modal').open};},mode);
  assert.equal(immediate.writes,1,'Native Store writes in the same turn without an added microtask');assert.equal(immediate.open,false,'Native completion closes the accepted input immediately');await frames(page);assert.equal((await gate(page)).totalCalls,1);if(mode==='reentrant')assert.ok((await gate(page)).reentrantChecks.every(item=>item.sameTitle&&item.sameOpen));await successful(page,result,before,scenario);return;
 }
 await page.evaluate(mode=>{passengerSearchGate.armed=true;passengerSearchGate.notifyFault=mode==='notification-before'?'before':['notification-after','controls'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','consumed-token'].includes(mode)?mode:null;passengerSearchStorage.failNext=['retry','recovery-reentry','retry-form-drift'].includes(mode);passengerSearchGate.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map){await mapPublication(page,result,scenario,before,context);return;}
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token'].includes(mode)){await retired(page,result,before,scenario,context);return;}
 if(['disk-same','disk-unreadable'].includes(mode)){
  if(mode==='disk-same')await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);else await page.evaluate(()=>{passengerSearchGate.readFault=true;});
  const current=await raw(page);await release(page,'known-before');await frames(page);assert.equal(await raw(page),current);assert.equal((await gate(page)).totalCalls,1);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/not saved[\s\S]*reload/i);await detail(page,result,'durable-baseline-retired',['#modal-error'],/not saved[\s\S]*reload/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),current);await page.evaluate(()=>{passengerSearchGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),current);result.checks.push('Typed known-unwritten failure cannot retry if exact durable campaign baseline changed or cannot be read');return;
 }
 if(mode==='retry-form-drift'){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known passenger-search prewrite'}).waitFor();await detail(page,result,'known-unsaved-before-drift',['#modal-error']);const accepted=(await gate(page)).candidates[0];if(scenario.reviewedDrift)await page.locator('#modal [name="reviewed"]').uncheck();else await fill(page,isSetup(scenario)?'reservedCabins':'dice',isSetup(scenario)?'1':'11');await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,1);assert.equal((await gate(page)).candidates[0],accepted);assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await detail(page,result,'accepted-form-drift-retired',['#modal-error'],/changed|reopen|review/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),bytes);result.gate=safeReport(await gate(page));result.checks.push('Known-unsaved retry never silently substitutes changed allocation, reviewed checkbox or accepted search inputs');return;
 }
 if(['retry','recovery-reentry'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known passenger-search prewrite'}).waitFor();let snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  if(mode==='recovery-reentry'){assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);assert.equal(snapshot.totalCalls,1);}
  await detail(page,result,'known-unsaved-warning',['#modal-error'],/Synthetic known passenger-search prewrite/);await detail(page,result,'known-unsaved-controls',['#modal-cancel','#modal-submit']);const candidate=JSON.parse(snapshot.candidates[0]),dice=snapshot.semantic.dice;
  await pointer(page,'#modal-submit');await page.waitForFunction(()=>!!passengerSearchGate.pending);snapshot=await gate(page);assert.equal(snapshot.calls,2);
  // Compare the actual accepted audit without UUID normalization. Transition's
  // own bookkeeping UUID can differ, but accepted offer/check/edit IDs cannot.
  const accepted=state=>isSetup(scenario)?state.ship.accommodation.passengerCapacity:latestPassengerSearch(state);
  assert.deepEqual(accepted(JSON.parse(snapshot.candidates[1])),accepted(candidate),'Explicit retry keeps the accepted capacity or every search/offer UUID, manual/generated die, class audit and economic term');assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])),normalize(candidate));assert.equal(snapshot.semantic.dice,dice);assertRetained(snapshot);
  await release(page);await successful(page,result,before,scenario);return;
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{passengerSearchGate.beginStrict();passengerSearchGate.write();});await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates[0]);assertRetained(snapshot);assert.equal(snapshot.pending,true);await replay(page);assertRetained(await gate(page));assert.equal((await gate(page)).totalCalls,1);await detail(page,result,'durable-publication-held-footer',['#modal-cancel','#modal-submit']);const strict=await gate(page);assert.equal(strict.mutationCount,0,'No transient main/review/summary/time/tab/status mutation during durable publication');assert.deepEqual((await page.evaluate(()=>passengerSearchGate.mapCapture('after-publication-replay'))).regions,strict.mapBaseline.regions);await page.evaluate(()=>passengerSearchGate.endStrict());await release(page);await successful(page,result,before,scenario);return;
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{passengerSearchGate.cleanupFault=mode;},mode);
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
 finally{context?.passengerSearchNetwork?.cleanup();context?.passengerNearbyNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 for(const scenario of scenarios){let before=fixture(scenario);if(scenario.preserveSearch)before=expected(before,{operation:'search'});if(scenario.mode==='regression'){assert.ok(passengerCapacity(before).configured);continue;}const next=expected(before,scenario);assertSaved(next,before,scenario);S.validate(next);}
 for(const options of [{},{openingRoll:true},{allManual:true},{manualSequence:true},{unavailable:true}]){const before=fixture({operation:'search'}),scenario={operation:'search',...options},spec=specification(before,scenario);assert.equal(spec.offers.length,4);if(options.openingRoll)assert.deepEqual(spec.offers[0].audit.searchDice,{dice:[3,3],total:6});if(options.allManual)assert.equal(spec.diceCalls,0);if(options.manualSequence)assert.ok(spec.diceCalls>0);}
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.match(app,/import\s*\{[^}]*\bcreatePassengerUI\b[^}]*\}\s*from\s*['"]\.\/passenger-ui\.mjs\?[^'"]+['"]/);assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');
 const plan={suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,declaredScreenshots:report.declaredScreenshots,limits:report.limits,scope:report.scope,scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,operation:scenario.operation,mode:scenario.mode,viewport,screenshots:expectedFrames(scenario)})),execution:'Fixture/source validation only; Chromium was not launched.'};
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify(plan,null,2));else console.log(`PASS: independent passenger setup/search full-state, four-class audit/dice, Credits/capacity and Undo fixture oracles; tagged app/Store/passenger UI source wiring. ${scenarios.length} scenarios / ${cases.length} declared browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile), ${report.declaredScreenshots} frames. Chromium was NOT launched; fixture/source validation is NOT browser evidence.`);
}else{
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT to the exact head');assert.equal(report.testedCommit,report.requestedCommit);report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires exact clean head; generated artifacts are ignored');
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','passenger-ui.mjs','passenger-rules.mjs','passengers.mjs','persistence.mjs','campaign-controller.mjs','state.mjs','rules.mjs','map-viewport.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const{scenario,viewport}of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.declaredScreenshots);assert.equal(report.screenshotCount,report.cases.reduce((n,r)=>n+r.screenshots.length,0));assert.ok(report.cases.every(r=>r.screenshots.length>0));report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'Evidence remains below 24 MiB');
 }catch(error){report.errors.push(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(r=>r.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Passenger setup/search completion Chromium checks failed; see verification-artifacts/passenger-search-completion-report.json');
 console.log(`PASS: ${report.declaredCases} exact-head passenger setup/search completion cases, native locks, exact four-class generation/capacity/economics/Undo and bounded desktop/mobile evidence.`);
}
