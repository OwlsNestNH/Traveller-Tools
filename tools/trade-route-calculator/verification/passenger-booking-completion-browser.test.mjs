// Bounded Stage 2 passenger boarding/delivery completion gate.
// Actual tagged app, passenger UI/rules, controller and native Store/Web Locks.
// Original .57 setup/search browser controls remain separate and unchanged.
// No copied production modal, fake locks, live/durable alias or reconstructed offers.
// --fixtures-only validates source/independent state oracles WITHOUT browser launch.
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
import {latestPassengerSearch, passengerCapacity, passengerOfferRemaining} from '../js/passengers.mjs';
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
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='passenger-booking-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const operations=['board','deliver'];
// Representative real-browser boundary matrix; the companion native suite owns
// the economic and context cross-products. No arbitrary sleeps or cropped frames.
const scenarios=operations.flatMap(operation=>['native','deferred','retry','unknown-before','unknown-after','foreign-same','new-dialog','read-only','map-owned','map-foreign'].map(mode=>({id:operation+'-'+mode,operation,mode,dual:['native','deferred','retry','unknown-before','unknown-after','read-only','map-owned'].includes(mode),map:mode.startsWith('map-')})));
for(const[index,mode]of ['recovery-reentry','disk-same','disk-unreadable','queued-pending','queued-settled','reentrant','contradictory','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','consumed-token','fulfilled-no-publication','foreign-new','editor-regain','native-close','render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close','foreign-form'].entries())scenarios.push({id:operations[index%2]+'-'+mode,operation:operations[index%2],mode});
for(const operation of operations)for(const point of ['title','body'])scenarios.push({id:operation+'-entry-'+point+'-reentry',operation,mode:'construction-reentry',point});
for(const operation of operations)for(const drift of ['hours','actual','world','trader','ship','settings','history','capacity','form','booking'])scenarios.push({id:operation+'-context-'+drift,operation,mode:'context-drift',drift});
for(const stage of ['first','review','settlement'])for(const drift of ['cancel','replacement','foreign','editor-regain','selection','terms'].filter(d=>stage!=='settlement'||d!=='selection'))scenarios.push({id:'board-'+stage+'-'+drift,operation:'board',mode:'stage-ownership',stage,drift});
for(const point of ['title','body','normalization'])scenarios.push({id:'board-handoff-'+point+'-reentry',operation:'board',mode:'handoff-reentry',point});
for(const operation of operations)for(const fault of ['normalization','controls','warning'])scenarios.push({id:operation+'-entry-'+fault+'-fault',operation,mode:'entry-fault',fault});
for(const operation of operations)for(const nearbyStage of ['review','prewrite','publication'])scenarios.push({id:operation+'-nearby-'+nearbyStage,operation,mode:'nearby-refresh',nearby:true,nearbyStage,dual:nearbyStage==='publication'});
for(const nearbyStage of ['review','prewrite'])scenarios.push({id:'board-nearby-endpoint-'+nearbyStage,operation:'board',mode:'nearby-endpoint',nearby:true,nearbyStage,endpoint:true});
for(const [id,options]of [['partial-shared',{prior:true}],['basic-fitted',{passageClass:'basic',cabinMode:'cargo',count:3}],['low-baseline',{passageClass:'low',cabinMode:'low',count:2,baselineLow:1}],['exhausted-basic',{passageClass:'basic',cabinMode:'cargo',exhausted:true}],['manual-luggage-cr100',{luggage:'7',step:100}],['legacy-zero-luggage',{luggage:'0',legacyLuggage:true}]])scenarios.push({id:'board-'+id,operation:'board',mode:'native',...options,dual:['basic-fitted','manual-luggage-cr100'].includes(id)});
scenarios.push({id:'deliver-retains-current-search',operation:'deliver',mode:'native',preserveSearch:true,dual:true},{id:'deliver-manual-luggage',operation:'deliver',mode:'native',luggage:'7',dual:true},{id:'board-browsed-destination',operation:'board',mode:'native',browse:true},{id:'deliver-browsed-origin',operation:'deliver',mode:'native',browse:true});
scenarios.push({id:'board-first-durable-drift',operation:'board',mode:'early-durable',boundary:'first',dual:true},{id:'board-handoff-read-fault',operation:'board',mode:'early-durable',boundary:'handoff',dual:true});
const cases=scenarios.flatMap(scenario=>sizes.filter(size=>size.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
const detailedSuccess=s=>s.id===s.operation+'-native';
function successFrames(s){return detailedSuccess(s)?s.operation==='board'?11:9:1;}
function expectedFrames(s){
 if(['early-durable','handoff-reentry','construction-reentry','context-drift','entry-fault','stage-ownership','nearby-endpoint'].includes(s.mode))return 1;
 if(s.mode==='nearby-refresh')return successFrames(s)+2;
 if(['native','queued-settled','reentrant','foreign-form'].includes(s.mode))return successFrames(s);
 if(['deferred','retry','recovery-reentry'].includes(s.mode))return successFrames(s)+2;
 if(s.mode==='map-owned'||s.mode==='queued-pending')return successFrames(s)+1;
 if(s.mode==='map-foreign'||s.mode==='read-only')return 2;
 if(['disk-same','disk-unreadable','reentrant-close','foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token','render','report','close-after'].includes(s.mode))return 1;
 return 3;
}
// Keep complete native-resolution viewport frames. The lower JPEG encoding is
// bounded by the same byte ceilings and requires original-size visual review.
const screenshotOptions=Object.freeze({type:'jpeg',quality:30,caret:'initial'});
const successPattern=/^(?:Accepted passenger booking saved\.|Delivered passenger booking saved\.)$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>passengerBookingGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>passengerBookingGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const isBoard=scenario=>scenario.operation==='board';
const title=scenario=>isBoard(scenario)?'Confirm passenger booking':'Complete passenger passage';
const transitionLabel=scenario=>isBoard(scenario)?'Accepted passenger booking':'Delivered passenger booking';
const saveName=scenario=>transitionLabel(scenario);
const report={suite:'Passenger boarding/delivery save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,declaredScreenshots:cases.reduce((n,{scenario})=>n+expectedFrames(scenario),0),gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Exactly passenger final boarding confirmation and explicit delivery. First-form/preview/handoff ownership, frozen terms, distinct transient preview UUID, zero-write previews, full state/ledger/supplies/Undo/mulligan, retained session pools, saved real arrivals, native Web Locks and exact independent durable copies, authenticated publication separate from provider settlement, strict actual refreshNearby versus MapAreaCache/ResizeObserver DOM freeze, bounded full viewport warning/footer/receipt/audit/Credits evidence. Setup/search controls remain in their unchanged dedicated suite. No Stage 3, Sale audit or map-focus changes. Long unbroken endpoint names stress these migrated forms; the inherited unchanged Jump status overflow is not part of this migration.'};
let browser,imageBytes=0;
function normalize(value){const ids=new Map();return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'generated-'+ids.size);return ids.get(id);}));}
function fixture(scenario={}){
 let s=S.initial();const origin={id:'1,1',x:1,y:1,name:'Passenger Origin',sector:'Synthetic',hex:'0202',uwp:'A788879-C',zone:'Safe',raw:{PBG:'703'}},destination={...origin,id:'2,1',x:2,name:'ExtraordinarilyLongUnbrokenPassengerDestinationForNarrowViewportVerification',hex:'0302'};
 Object.assign(s,{initialized:true,name:'Disposable passenger booking campaign',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Passenger Trader',capacity:'100',armed:true,staterooms:4,jump:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}},accommodation:{combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:scenario.baselineLow||0,luggageMode:scenario.luggage===undefined?'auto':'manual',luggageTons:scenario.luggage??'0',passengerCapacity:{reservedCabins:1,installedLowBerths:4}}});
 if(scenario.legacyLuggage){delete s.ship.accommodation.luggageMode;delete s.ship.accommodation.combinedPeople;}
 Object.assign(s.trader,{broker:2,streetwise:3,rank:2,soc:1,characteristic:1});Object.assign(s.settings,{creditStep:scenario.step||1,tax:true,profit:50});
 s.lots=[{id:'unrelated-lot',commodity:'11',description:'Unrelated owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];
 s.ledger=[{id:'passenger-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];s.dashboardBaseline=createDashboardBaseline(s);s=S.validate(s);
 if(scenario.operation==='deliver'){
  s=expectedSearch(s);const offer=latestPassengerSearch(s).offers.find(o=>o.passageClass==='high');s=S.transition(s,'Accepted passenger booking',n=>S.acceptPassengers(n,offer.offerId,{count:2,cabinMode:'shared',serviceConfirmed:true}));
  const prepared=S.prepareJump(s,()=>({dice:Array(6).fill(3),total:18}));s=S.transition(prepared.state,'Jump: '+origin.name+' → '+destination.name,n=>S.commitJump(n,{attemptId:prepared.attempt.id,elapsed:168}));
  assert.equal(s.actual,destination.id);assert.equal(S.jumpUndoEligibility(s).allowed,true);assert.equal(Number(s.ship.lifeSupport.stockUnits.numerator)/Number(s.ship.lifeSupport.stockUnits.denominator),84);
 }
 return S.validate(s);
}
function searchSpecification(before){
 const destination=before.actual==='1,1'?'2,1':'1,1',from=R.context(before.worlds[before.actual],core),to=R.context(before.worlds[destination],core),parsecs=distance(before.worlds[before.actual],before.worlds[destination]);
 const manualDice=Array(240).fill(2);let used=0;const id=S.uid(),offers=passengerOffers(from,to,parsecs,{effect:7,steward:1},core,()=>manualDice[used++]).map(o=>({...o,offerId:S.uid(),origin:before.actual,destination,audit:{...o.audit,searchDice:{dice:null,total:12,manual:true},searchSkill:2,searchCharacteristic:1,manualDice:structuredClone(manualDice)}}));
 return {id,label:'Passenger search audit',world:before.actual,destination,hours:before.hours,offers,manualDice,manualDiceConsumed:used};
}
function expectedSearch(before){const event=searchSpecification(before);return S.transition(before,'Passenger search',s=>S.recordPassengerSearch(s,event));}
function specification(before,scenario){
 if(!isBoard(scenario))return {id:before.contracts.find(c=>c.kind==='passenger'&&c.status==='accepted').id,diceCalls:0};
 const offer=latestPassengerSearch(before).offers.find(o=>o.passageClass===(scenario.passageClass||'high'));
 const inputs={count:scenario.exhausted?passengerOfferRemaining(before,offer):scenario.count||2,cabinMode:scenario.cabinMode||'shared',serviceConfirmed:['high','middle'].includes(offer.passageClass),spaceConfirmed:offer.passageClass==='basic',populationException:''};
 return {offer,offerId:offer.offerId,inputs,diceCalls:0};
}
function expected(before,scenario){const spec=specification(before,scenario);return S.transition(before,transitionLabel(scenario),s=>{if(scenario.nearbyStage==='review'&&!scenario.endpoint)s.worlds={'3,1':normalizeWorld(nearbyAPIWorld),...s.worlds};if(isBoard(scenario))S.acceptPassengers(s,spec.offerId,spec.inputs);else S.deliverPassengers(s,spec.id);});}
function assertSaved(saved,before,scenario){
 assert.deepEqual(normalize(saved),normalize(expected(before,scenario)),'Exact original full campaign transition, accepted immutable economics, full audits, receipt and inverse Undo');
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 for(const key of ['hours','lots','policies','actual','route','routeIndex','cooldowns','snapshots','dashboardBaseline','latestPassengerSearchId'])assert.deepEqual(saved[key],before[key],key+' unchanged by booking completion');
 assert.deepEqual(saved.ship,before.ship,'Manual complement, physical stock, consumed supplies, luggage mode and fuel are preserved');
 assert.deepEqual(saved.worlds,scenario.nearbyStage==='review'&&!scenario.endpoint?{'3,1':normalizeWorld(nearbyAPIWorld),...before.worlds}:before.worlds);
 assert.deepEqual(saved.events.slice(0,before.events.length),before.events,'Complete historical search and acceptance audits retained');
 if(isBoard(scenario)){assert.equal(saved.bank,before.bank);assert.deepEqual(saved.ledger,before.ledger);const spec=specification(before,scenario),c=saved.contracts.at(-1);assert.equal(c.offerId,spec.offerId);assert.equal(passengerOfferRemaining(saved,spec.offer),passengerOfferRemaining(before,spec.offer)-spec.inputs.count);}
 else{const spec=specification(before,scenario),c=saved.contracts.find(c=>c.id===spec.id),prior=before.contracts.find(c=>c.id===spec.id),offer=before.events.find(e=>e.id===prior.searchId).offers.find(o=>o.offerId===prior.offerId);assert.equal(c.status,'delivered');assert.equal(c.payout,prior.payment);assert.equal(saved.bank,String(BigInt(before.bank)+BigInt(prior.payment)));assert.equal(saved.ledger.filter(e=>e.type==='Passenger delivery'&&e.contractId===c.id).length,1);assert.equal(passengerOfferRemaining(saved,offer),passengerOfferRemaining(before,offer),'Delivered bookings still consume their original pool');assert.ok(!['late','penaltyDie','dueHours'].some(k=>Object.hasOwn(c,k)));}
 assert.deepEqual(material(S.undo(saved)),material(before),'Undo restores exact booking/payment/capacity without reopening the last committed jump mulligan');
 if(before.jumpAttempts?.length){assert.equal(saved.jumpAttempts.at(-1).closed,true);assert.equal(S.undo(saved).jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(S.undo(saved)).allowed,false);}
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
 await context.exposeBinding('__passengerBookingUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey, nearbyX}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__passengerBookingUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.passengerBookingStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   passengerBookingStorage.attempts++; passengerBookingStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (passengerBookingStorage.failNext) {passengerBookingStorage.failNext = false; throw Error('Synthetic known passenger-booking prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); passengerBookingStorage.writes++; return result;
  };
  // Observe native parsing of the boot nearby response independently from the
  // viewport-cache callbacks. The fetch/normalization/refresh continuation is
  // unchanged; later fresh-search options prove it reached the real known-worlds map.
  globalThis.passengerBookingNearbyResponses=[];
  const responseJSON=Response.prototype.json;
  Response.prototype.json=function(...args){
   const url=new URL(this.url,location.href),relevant=url.origin==='https://travellermap.com'&&url.pathname.endsWith('/jumpworlds')&&url.searchParams.get('x')===String(nearbyX)&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12';
   const result=Reflect.apply(responseJSON,this,args);if(!relevant)return result;
   return result.then(value=>{const entry={url:url.href,parsedAt:performance.now(),worldIds:value.Worlds?.map(w=>w.WorldX+','+w.WorldY)||[],pending:!!globalThis.passengerBookingGate?.pending,writeExecuted:!!globalThis.passengerBookingGate?.pending?.executed};passengerBookingNearbyResponses.push(entry);globalThis.passengerBookingGate?.trace('boot-nearby-response-parsed',entry);return value;});
  };
  globalThis.passengerBookingDiceCalls = 0; globalThis.passengerBookingAcceptanceUUIDs=[];
  const uuid=crypto.randomUUID.bind(crypto);crypto.randomUUID=()=>{const id=uuid();if(/acceptPassengers/.test(new Error().stack||''))passengerBookingAcceptanceUUIDs.push(id);return id;};
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {passengerBookingDiceCalls++; array[0] = 2; return array;} return random(array);};
  globalThis.passengerBookingMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.passengerBookingMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); passengerBookingMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    passengerBookingMapCallbacks.executed++; if (cache) passengerBookingMapCallbacks.cacheExecuted++;
    globalThis.passengerBookingGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.passengerBookingGate?.paintEdge('after', cache);
    passengerBookingMapCallbacks.completed++; if (cache) passengerBookingMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.passengerBookingGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {passengerBookingMapCallbacks.loadingCacheCompleted++; passengerBookingMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.passengerBookingMapLoadingStatusNode = statusNode;}
    globalThis.passengerBookingGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.passengerBookingGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.passengerBookingGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) passengerBookingMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY, nearbyX:scenario.operation==='deliver'?2:1});
 let held, releaseHold, heldOnce = false, heldReady;const reached=new Promise(resolve=>{heldReady=resolve;});
 context.passengerBookingNetwork = {async waitHeld() {let timeout;try{await Promise.race([reached,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Real MapAreaCache tile did not reach network fixture')),10000);})]);return {...held};}finally{clearTimeout(timeout);}}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 let nearbyHeld,releaseNearby,nearbyHeldOnce=false,nearbyReached;const nearbyReady=new Promise(resolve=>{nearbyReached=resolve;});
 context.passengerNearbyNetwork={async waitHeld(){let timeout;try{await Promise.race([nearbyReady,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Actual boot refreshNearby request was not held')),10000);})]);return {...nearbyHeld};}finally{clearTimeout(timeout);}},release(){assert.ok(releaseNearby,'Nearby HTTP response remains held');const resolve=releaseNearby;releaseNearby=null;resolve();},cleanup(){releaseNearby?.();releaseNearby=null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/passenger-booking-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable passenger-booking native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if(scenario.nearby&&!nearbyHeldOnce&&url.searchParams.get('x')===(scenario.operation==='deliver'?'2':'1')&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'){
     nearbyHeldOnce=true;nearbyHeld={url:url.href,heldAt:Date.now(),released:false};result.nearbyResponse=nearbyHeld;nearbyReached();await new Promise(resolve=>{releaseNearby=resolve;});nearbyHeld.released=true;nearbyHeld.releasedAt=Date.now();
     return route.fulfill({json:{Worlds:scenario.endpoint?[{...nearbyAPIWorld,Name:'Changed relevant destination',WorldX:2,WorldY:1,Hex:'0302',UWP:'B788879-C'}]:[nearbyAPIWorld]},headers});
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
  const g = globalThis.passengerBookingGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
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
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: passengerBookingDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic passenger-booking completion ' + name + ' fault');};
  const qsa=Element.prototype.querySelectorAll;
  Element.prototype.querySelectorAll=function(selector){
   if(this.id==='modal-form'&&selector==='[data-round]'&&g.normalizationFault&&(!g.normalizationAfter||!--g.normalizationAfter)){const mode=g.normalizationFault;g.normalizationFault=null;g.faults.push('normalization');if(mode==='reentry'){g.constructionFault='normalization';g.replaceConstruction();}else throw Error('Synthetic passenger-booking normalization fault');}
   return Reflect.apply(qsa,this,[selector]);
  };
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if(g.warningFault&&this.id==='modal-error'&&/Synthetic/.test(value)){g.warningFault=false;g.faults.push('warning');throw Error('Synthetic passenger-booking warning fault');}
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^(?:Accepted passenger booking saved\.|Delivered passenger booking saved\.)$/s.test(value)) fault('report');
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
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic passenger-booking entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: passengerBookingStorage.writes});
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before passenger-booking publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after passenger-booking publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this);if(g.readFailureAt&&++g.boundaryReads===g.readFailureAt){g.readFault=true;g.trace('handoff-durable-read-fault',{read:g.boundaryReads,previewUUIDs:passengerBookingAcceptanceUUIDs.length});} if (g.readFault) throw Error('Synthetic unreadable durable passenger-booking baseline'); const value=Reflect.apply(nativeRead,this,args),check={exactDurableCopy:JSON.stringify(value)===localStorage.getItem(KEY),aliasesLive:value===g.lastState,revision:value.revision};g.readChecks.push(check);if(check.aliasesLive||!check.exactDurableCopy)throw Error('Store.read must return the full readable durable campaign copy');return value;};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = passengerBookingDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending passenger-booking save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native passenger-booking write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending passenger-booking completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known passenger-booking prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown passenger-booking outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory passenger-booking not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable passenger-booking save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: passengerBookingMapCallbacks.cacheCompleted, loadingCacheCompleted: passengerBookingMapCallbacks.loadingCacheCompleted});};
  g.snapshot = () => ({calls: g.calls, totalCalls: g.totalCalls, executions: g.executions, pending: !!g.pending, editable: g.store?.editable ?? null, reloadRequired: !!g.store?.reloadRequired, storage: {...passengerBookingStorage}, acceptanceUUIDs:[...passengerBookingAcceptanceUUIDs], candidates: g.candidates, forwarded: g.forwarded, publications: g.publications, observations: g.observations, settlements: g.settlements, faults: g.faults, reentrantChecks: g.reentrantChecks, baseline: g.baseline, acceptedDice:g.acceptedDice, semantic: semantic(), reviewNodeRetained: !!g.reviewNode?.isConnected, mainNodeRetained: !!g.mainNode?.isConnected, newer: g.newer, recoveryChecks: g.recoveryChecks, callbacks: {...passengerBookingMapCallbacks}, nearbyResponses:passengerBookingNearbyResponses, bootstrap: g.bootstrap, mapReadiness: g.mapReadiness, retainedBaselineOrder: g.retainedBaselineOrder, constructionChecks: g.constructionChecks, readChecks: g.readChecks, timeline: g.timeline, timelineDropped: g.timelineDropped, mapBaseline: g.mapBaseline, paintEdges: g.paintEdges, paintEdgesDropped: g.paintEdgesDropped, mutationCount: g.mutationCount, durableToken: /"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[]});
   Object.assign(passengerBookingStorage,{attempts:0,writes:0,failNext:false,observations:[]});passengerBookingAcceptanceUUIDs.length=0;
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = passengerBookingStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || passengerBookingStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
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
 // Capture to memory first. Every attempt has producer/hash/byte metadata, but
 // rejected-budget attempts are explicitly non-persisted and never indexed as
 // evidence frames. A failed capture cannot leave an unindexed JPG on disk.
 const bytes = await page.screenshot(screenshotOptions), digest = hash(bytes);
 const attempt={name,producerCommit:report.testedCommit,appSHA256:result.runtime?.appSHA256??report.sourceSHA256?.['app.mjs']??null,passengerSHA256:result.runtime?.passengerSHA256??report.sourceSHA256?.['passenger-ui.mjs']??null,gateSHA256:report.gateSHA256,imageSHA256:digest,bytes:bytes.length,viewport:result.viewport,encoding:screenshotOptions,previousPersistedImageBytes:imageBytes,persisted:false,status:'captured'};
 (result.captureAttempts??=[]).push(attempt);
 if(imageBytes+bytes.length>=report.limits.imageBytes){attempt.status='rejected-budget';assert.fail('Bounded screenshot bytes; attempt recorded but not persisted');}
 await writeFile(join(artifacts,name),bytes);imageBytes+=bytes.length;report.imageBytes=imageBytes;attempt.persisted=true;attempt.status='persisted';
 result.screenshots.push(name);(result.imageSHA256??={})[name]=digest;(result.frameProvenance??=[]).push({...attempt});
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Passenger boarding/delivery dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Passenger boarding/delivery content stays inside dialog');}
}
async function detail(page, result, label, selectors, pattern) {
 const saved = await page.evaluate(() => ({x: scrollX, y: scrollY, dialog: document.querySelector('#modal').scrollTop}));
 let scrollState;
 try {
  // Helper-local references also work after a genuine, uninstrumented reload.
  // Never reinstall the provider gate just to frame or restore a screenshot.
  scrollState=await page.evaluateHandle(selectors=>{
   const nodes=selectors.map(selector=>{const node=document.querySelector(selector);if(!node)throw Error('Missing detail target: '+selector);return node;});
   const union=()=>{const rects=nodes.map(node=>node.getBoundingClientRect());return {top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))};};
   const containers=[];for(let node=nodes[0].parentElement;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){if(nodes.every(target=>node.contains(target))&&/(?:auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight)containers.push(node);}
   const scrolls=containers.map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
   const changes=[];
   // Center the whole requested range, not just its first already-visible dt.
   // Scroll real containers only; never resize, restyle, crop or hide content.
   for(const node of containers){const range=union(),rect=node.getBoundingClientRect(),top=rect.top+node.clientTop,bottom=top+node.clientHeight,before=node.scrollTop;node.scrollTop+=((range.top+range.bottom)-(top+bottom))/2;changes.push({container:node.id?'#'+node.id:node.tagName.toLowerCase(),before,after:node.scrollTop,clientHeight:node.clientHeight,rangeHeight:range.bottom-range.top});}
   const modal=document.querySelector('#modal[open]');if(!modal||!nodes.every(node=>modal.contains(node))){const range=union(),before=scrollY;scrollTo({left:scrollX,top:scrollY+(range.top+range.bottom-innerHeight)/2,behavior:'instant'});changes.push({container:'document',before,after:scrollY,clientHeight:innerHeight,rangeHeight:range.bottom-range.top});}
   return {changes,scrolls};
  },selectors);
  const framing=await scrollState.evaluate(state=>state.changes);await frames(page);
  const targets = await page.evaluate(selectors => selectors.map(selector => {const el = document.querySelector(selector), r = el.getBoundingClientRect(), style = getComputedStyle(el); return {selector, text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, visible: style.display !== 'none' && style.visibility !== 'hidden', viewport: {width: innerWidth, height: innerHeight}};}), selectors);
  // Preserve measured targets even if an assertion below fails, so a failure
  // report identifies every requested edge instead of losing the failing range.
  (result.details??=[]).push({label,targets,framing});
  for (const target of targets) {
   assert.ok(target.visible && target.width > 0 && target.height > 0, label + ' target rendered');
   assert.ok(target.left >= -1 && target.right <= target.viewport.width + 1 && target.top >= -1 && target.bottom <= target.viewport.height + 1, label + ': ' + target.selector + ' fully in screenshot');
  }
  if (pattern) assert.match(targets.map(target => target.text).join('\n'), pattern);
  await capture(page, result, label);
 } finally {
  try {
   if(scrollState)await scrollState.evaluate(state=>{for(const {node,top,left}of state.scrolls)if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}});
  } finally {
   try {await page.evaluate(saved=>{document.querySelector('#modal').scrollTop=saved.dialog;scrollTo(saved.x,saved.y);},saved);}
   finally {await scrollState?.dispose();}
  }
 }
}
async function pointer(page, selector, clickCount = 1) {
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function fill(page, name, value) {const input = page.locator('#modal [name="' + name + '"]'); await input.fill(String(value)); await input.blur();}
async function fillTerms(page,before,scenario){
 if(!isBoard(scenario))return;
 for(const [name,value]of Object.entries(specification(before,scenario).inputs)){
  const input=page.locator('#modal [name="'+name+'"]');if(!await input.count()){assert.ok(['serviceConfirmed','spaceConfirmed'].includes(name));continue;}
  if(typeof value==='boolean')await input.setChecked(value);else if(name==='cabinMode')await input.selectOption(value);else await fill(page,name,value);
 }
}
async function draftIds(page){return page.locator('[data-action="passenger-board"]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.arg))]);}
async function seedDrafts(page,result,scenario){
 if(isBoard(scenario)||scenario.preserveSearch){
  await tab(page,'Contracts');const before=await read(page);await action(page,'passenger-search').click();await page.locator('#modal-title').filter({hasText:/^Find passengers$/}).waitFor();
  await page.locator('#modal [name="destination"]').selectOption(before.actual==='1,1'?'2,1':'1,1');for(const[name,value]of Object.entries({dice:12,skill:2,characteristic:1,steward:1}))await fill(page,name,value);
  await page.locator('#modal-body details > summary').click();await fill(page,'sequence',Array(240).fill(2).join(','));await pointer(page,'#modal-submit');await closed(page);await frames(page);
  assert.deepEqual(normalize(await read(page)),normalize(expectedSearch(before)),'Real .57 search produces the independently specified session pool');
  if(scenario.prior){const searched=await read(page);await openFirst(page,result,{...scenario,count:1},searched);await acceptPreview(page,result,{...scenario,count:1},searched);await pointer(page,'#modal-submit');await closed(page);await frames(page);assertSaved(await read(page),searched,{...scenario,count:1});}
 }
 result.initialDraftIds=await draftIds(page);result.seedBytes=await raw(page);await page.evaluate(()=>passengerBookingGate.reset());
}
function actionSpec(before,scenario){const spec=specification(before,scenario);return {name:isBoard(scenario)?'passenger-board':'passenger-deliver',arg:isBoard(scenario)?spec.offerId:spec.id};}
async function openFirst(page,result,scenario,before){
 const {name,arg}=actionSpec(before,scenario),dice=await page.evaluate(()=>passengerBookingDiceCalls);if(scenario.map||scenario.browse)await page.evaluate(({name,arg})=>passengerBookingGate.dispatch(name,arg),{name,arg});else await action(page,name,arg).click();
 const wanted=isBoard(scenario)?'Board '+passageLabel(scenario.passageClass||'high')+' passengers':title(scenario);await page.locator('#modal-title').filter({hasText:new RegExp('^'+wanted+'$')}).waitFor();
 await fillTerms(page,before,scenario);assert.equal(await page.evaluate(()=>passengerBookingDiceCalls),dice,'Opening boarding/delivery never rolls availability');assert.equal(await page.locator('#modal-error').textContent(),'');assert.deepEqual(await read(page),before);
 await page.evaluate(()=>{passengerBookingGate.firstSubmit=document.querySelector('#modal-form').onsubmit;passengerBookingGate.firstForm=document.querySelector('#modal-form');passengerBookingGate.firstFields=[...document.querySelectorAll('#modal-body input,#modal-body select')];});
}
async function acceptPreview(page,result,scenario,before){
 if(!isBoard(scenario))return;const prior=await gate(page),bytes=await raw(page),mulligan=S.jumpUndoEligibility(before),uuids=prior.acceptanceUUIDs.length;
 await pointer(page,'#modal-submit',scenario.mode==='deferred'?2:1);await page.locator('#modal-title').filter({hasText:/^Confirm passenger booking$/}).waitFor();await frames(page);
 assert.equal(await raw(page),bytes,'Preview writes no campaign state');assert.equal((await gate(page)).totalCalls,prior.totalCalls);assert.deepEqual(S.jumpUndoEligibility(await read(page)),mulligan,'Preview/cancel do not consume existing mulligan eligibility');assert.equal((await gate(page)).acceptanceUUIDs.length,uuids+2,'Actual original preview creates distinct transient booking and acceptance-audit UUIDs');
 const review=await page.locator('#modal-body').innerHTML();await page.evaluate(()=>{for(const control of passengerBookingGate.firstFields){if(control.name==='count')control.value='1';if(control.type==='checkbox')control.checked=false;}void passengerBookingGate.firstSubmit({preventDefault(){},currentTarget:passengerBookingGate.firstForm});});await frames(page);
 assert.equal(await page.locator('#modal-body').innerHTML(),review,'Detached first controls/callback cannot alter frozen final consent or open a fresh review');assert.equal((await gate(page)).totalCalls,prior.totalCalls);assert.equal(await raw(page),bytes);
}
async function prepare(page,result,scenario,before,{loops=false,network=null,firstOnly=false}={}){
 await tab(page,scenario.map?'Overview':'Contracts');if(scenario.browse){await page.evaluate(id=>passengerBookingGate.dispatch('world',id),before.actual==='1,1'?'2,1':'1,1');await frames(page);}
 await openFirst(page,result,scenario,before);
 if(detailedSuccess(scenario)){
  if(isBoard(scenario))await detail(page,result,'first-boarding-form',['#modal [name="count"]','#modal [name="cabinMode"]']);
  else await detail(page,result,'delivery-preview-terms',['#modal-body > dl > dt:nth-of-type(3)','#modal-body > dl > dd:nth-of-type(5)'],/Payment/);
 }
 if(firstOnly){await page.evaluate(()=>passengerBookingGate.remember());return;}
 await acceptPreview(page,result,scenario,before);
 if(loops){await pointer(page,'#modal-cancel');await closed(page);assert.deepEqual(await read(page),before);await openFirst(page,result,scenario,before);await acceptPreview(page,result,scenario,before);}
 if(detailedSuccess(scenario)&&isBoard(scenario)){
  await detail(page,result,'immutable-booking-review',['#modal-body > dl > dt:nth-of-type(2)','#modal-body > dl > dt:nth-of-type(4)','#modal-body > dl > dd:nth-of-type(4)'],/People boarding[\s\S]*Payment on delivery/);
  await detail(page,result,'booking-luggage-lss-review',['#modal-body > dl > dt:nth-of-type(6)','#modal-body > dl > dd:nth-of-type(11)'],/Total luggage after[\s\S]*Existing LSS stock is preserved/);
 }
 assert.equal((await gate(page)).totalCalls,0);await page.evaluate(()=>document.activeElement?.blur());await frames(page);
 if(scenario.map){
  const held=await network.waitHeld();assert.equal(held.released,false);await page.waitForFunction(()=>passengerBookingMapCallbacks.loadingCacheCompleted>0&&passengerBookingMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));
  await page.evaluate(held=>{if(passengerBookingGate.totalCalls||passengerBookingGate.pending||passengerBookingStorage.writes)throw Error('Initial cache readiness must precede provider work');passengerBookingGate.mapReadiness=passengerBookingGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...passengerBookingMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:passengerBookingGate.mapNodeId(passengerBookingMapLoadingStatusNode)});},held);
 }
 await page.evaluate(()=>passengerBookingGate.remember());
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');if(passengerBookingGate.oldSubmit)void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();if(navigation)passengerBookingGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 if(scenario.mode==='queued-pending')await page.evaluate(()=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])passengerBookingGate.dispatch(name,arg);void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});
 else if(scenario.mode==='deferred'){await page.locator('#modal-submit').focus();await page.keyboard.press('Enter');}
 else await pointer(page,'#modal-submit',2);
 await page.waitForFunction(()=>!!passengerBookingGate.pending);await frames(page);
 assert.equal(await raw(page),bytes,'Held completion leaves exact durable bytes alone');let snapshot=await gate(page);assertRetained(snapshot);
 assert.equal(snapshot.acceptedDice,snapshot.baseline.dice+specification(before,scenario).diceCalls,'Boarding/delivery consume no dice and never regenerate the retained search pool');
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen synchronously');
 for(const control of await page.locator('#modal-body input,#modal-body select,#modal-body textarea').all())assert.equal(await control.isDisabled(),true,'Every accepted term freezes before provider entry');
 await replay(page);snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(await raw(page),bytes);assertRetained(snapshot);
 for(const forwarded of snapshot.forwarded){assert.ok(forwarded.argumentCount>=3);assert.equal(forwarded.tokenPresent,true);assert.equal(forwarded.candidateRevision,forwarded.expectedRevision+1);}
 if(['deferred','queued-pending'].includes(scenario.mode))await detail(page,result,'pending-before-write-footer',['#modal-cancel','#modal-submit']);
 result.checks.push('Exactly one provider call; frozen fields/Close/X/Escape, Enter, detached/duplicate callbacks, queued tab/world/deposit, Notes and competing passenger actions');
}
async function reloadUndo(page,result,before,scenario,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>passengerBookingStorage.writes),0,'Reload cannot repeat boarding/delivery');
 await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes);assert.deepEqual(await draftIds(page),[]);assert.equal(await page.locator('[data-action="passenger-board"],[data-action="passenger-offer-audit"]').count(),0,'Actual Contracts surface cannot reconstruct actionable offers from historical results');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 if(detailedSuccess(scenario))await detail(page,result,'reload-booking-authoritative',['.passenger-summary']);
 const saved=await read(page);assertSaved(saved,before,scenario);await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);assert.deepEqual(normalize(await read(page)),normalize(S.undo(saved)),'Actual History Undo preserves every original audit and adds exactly the correct Undo record');assert.deepEqual(material(await read(page)),material(before));assert.equal((await read(page)).revision,before.revision+2);assert.equal(await page.evaluate(()=>passengerBookingStorage.writes),1);
 const undoneBytes=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),undoneBytes);assert.deepEqual(await draftIds(page),[]);assert.equal(await page.locator('[data-action="passenger-board"],[data-action="passenger-offer-audit"]').count(),0);assert.equal(await page.evaluate(()=>passengerBookingStorage.writes),1);
 if(detailedSuccess(scenario))await detail(page,result,'history-undo-booking-restored',['.passenger-summary']);
 result.checks.push('Reload keeps exact bytes without reviving session offers; actual History Undo restores capacity, economics and the prior search reference without recreating offers');
}
async function successful(page,result,before,scenario){
 await closed(page);await frames(page);const saved=await read(page);assertSaved(saved,before,scenario);const snapshot=await gate(page),spec=specification(before,scenario);
 result.economicEvidence={beforeSHA256:hash(JSON.stringify(before)),savedSHA256:hash(JSON.stringify(saved)),bank:saved.bank,hours:saved.hours,ledgerCount:saved.ledger.length,undoCount:saved.undo.length,capacity:passengerCapacity(saved),latestPassengerSearch:latestPassengerSearch(saved)};
 assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(await page.locator('#modal-error').textContent(),'');
 assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),scenario.map?'Overview':'Contracts');assert.equal(snapshot.semantic.dice,snapshot.baseline.dice);assert.equal(await page.locator('#message').textContent(),transitionLabel(scenario)+' saved.');
 if(isBoard(scenario)){const id=saved.contracts.at(-1).id;assert.equal(snapshot.acceptanceUUIDs.at(-2),id,'Preserved acceptPassengers emits booking UUID, then acceptance-audit UUID');assert.ok(snapshot.acceptanceUUIDs.slice(0,-2).every(previewId=>previewId!==id),'Preview-generated IDs are never persisted or stabilized');}
 await detail(page,result,'saved-success-status',['#message'],successPattern);
 if(scenario.map){const bytes=await raw(page);await tab(page,'Contracts');await frames(page);assert.equal(await raw(page),bytes);}
 assert.deepEqual((await draftIds(page)).sort(),[...result.initialDraftIds].sort(),'Both final boarding and delivery retain the original current session pool');
 for(const observation of [...snapshot.observations,...snapshot.storage.observations])assert.equal(observation.message,snapshot.baseline.message,'No success before settlement');
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);assert.ok(snapshot.readChecks.every(check=>check.exactDurableCopy&&!check.aliasesLive));
 const bytes=await raw(page),calls=snapshot.totalCalls,dice=snapshot.semantic.dice;await page.evaluate(()=>{void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void passengerBookingGate.firstSubmit?.({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 if(isBoard(scenario)){const card='.passenger-offer:has([data-action="passenger-board"][data-arg="'+spec.offerId+'"])';assert.equal(await page.locator(card+' strong').textContent(),passengerOfferRemaining(saved,spec.offer)+' available');assert.equal(await action(page,'passenger-board',spec.offerId).isDisabled(),scenario.exhausted===true);}
 if(detailedSuccess(scenario)){
  const booking=isBoard(scenario)?saved.contracts.at(-1):saved.contracts.find(c=>c.id===spec.id);
  if(isBoard(scenario))await detail(page,result,'partial-pool-retained',['.passenger-offer:has([data-action="passenger-board"][data-arg="'+spec.offerId+'"])']);
  else await detail(page,result,'delivered-capacity-released',['.passenger-summary'],/0 booked people aboard/);
  if(isBoard(scenario)){await page.locator('.passenger-panel details > summary').click();await detail(page,result,'booked-luggage-lss-summary',['.passenger-panel .passenger-facts > dt:nth-of-type(5)','.passenger-panel .passenger-facts > dt:nth-of-type(8)','.passenger-panel .passenger-facts > dd:nth-of-type(9)'],/Awake people[\s\S]*Whole-ship luggage/);}
  await action(page,'contract-audit',booking.id).click();await page.locator('#modal-title').filter({hasText:/^Contract$/}).waitFor();const audit=await page.locator('#modal-body').textContent();assert.ok(audit.includes(formatCreditsText(booking.payment)));assert.match(audit,/Passenger availability calculation/);assert.match(audit,isBoard(scenario)?/Aboard; unpaid/:/Delivered and paid/);
  await detail(page,result,'booking-audit-immutable-fare',['#modal-body > dl:first-of-type > dt:nth-of-type(6)','#modal-body > dl:first-of-type > dt:nth-of-type(7)','#modal-body > dl:first-of-type > dd:nth-of-type(7)','#modal-body > dl:first-of-type > dd:nth-of-type(8)'],/Fare per person[\s\S]*Agreed total/);await pointer(page,'#modal-cancel');await closed(page);
  if(!isBoard(scenario)){await tab(page,'Accounts');const receipt=saved.ledger.find(e=>e.type==='Passenger delivery'&&e.contractId===booking.id);await action(page,'ledger-audit',receipt.id).click();await page.locator('#modal-title').filter({hasText:/Ledger|Passenger/}).waitFor();assert.ok((await page.locator('#modal-body').textContent()).includes(formatCreditsText(booking.payment)));await detail(page,result,'single-passenger-payout-receipt',['#modal-body .preview > dl:first-of-type > dt:nth-of-type(4)','#modal-body .preview > dl:first-of-type > dd:nth-of-type(6)']);await pointer(page,'#modal-cancel');await closed(page);}
  const credits='#summary .stat:last-child';assert.ok((await page.locator(credits).textContent()).includes(formatCreditsText(saved.bank)));await detail(page,result,'exact-huge-credits',[credits],/Credits/);
  await tab(page,'Overview');await frames(page);assert.equal(await page.locator('#ship-actions .campaign-time .value').textContent(),displayDate(saved.dateLabel,saved.hours));await detail(page,result,'unchanged-campaign-time',['#ship-actions .campaign-time .value']);
 }
 assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);assert.equal((await gate(page)).semantic.dice,dice);
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
 await page.evaluate(()=>{passengerBookingGate.store.yield();passengerBookingGate.store.onChange(passengerBookingGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#save-status').textContent(),guidance);
 result.gate=safeReport(await gate(page));assert.equal(result.gate.storage.writes,committed?1:0);await reloadUndo(page,result,before,scenario,{committed});
 result.checks.push('Exact saved/unknown guidance; terminal authority latched before fallible reporting, native lock released, replay refused and reload authoritative');
}
async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/passenger-booking-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.passengerBookingPeer = {state: null, editable: false}; passengerBookingPeer.store = new Store(next => {passengerBookingPeer.state = next;}, editable => {passengerBookingPeer.editable = editable;}); await passengerBookingPeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => passengerBookingPeer.editable); await page.waitForFunction(() => passengerBookingGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(passengerBookingPeer.state, 'Foreign deposit during passenger-booking save', s => S.deposit(s, 7, 'Synthetic peer')); passengerBookingPeer.store.save(next, passengerBookingPeer.state.revision); return passengerBookingPeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {passengerBookingPeer.store.yield(); passengerBookingPeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => passengerBookingGate.store.acquire(true)); await page.waitForFunction(() => passengerBookingGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;
 const before=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent}));
 const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===passengerBookingGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===passengerBookingGate.newerClose,submitCallable:typeof passengerBookingGate.newerSubmit==='function',closeCallable:typeof passengerBookingGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>{void passengerBookingGate.newerSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
 assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent})),before);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await page.evaluate(()=>passengerBookingGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Actual newer Notes handler identities survive old settlement and detached replay; captured Notes submit remains read-only and captured Close dismisses without writes');
}
async function retired(page, result, before, scenario, context) {
 const mode = scenario.mode;
 if (mode === 'foreign-same') await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY);
 if (mode === 'foreign-new') await peerTakeover(page, result, context, {write: true});
 if (mode === 'editor-regain') await peerTakeover(page, result, context, {regain: true});
 if (mode === 'native-close' || mode === 'new-dialog') {
  await page.evaluate(() => {document.querySelector('#modal').close(); document.querySelector('#modal').dispatchEvent(new Event('close'));}); await frames(page);
  if (mode === 'new-dialog') {await page.locator('#notes').click(); await page.locator('#modal-title').filter({hasText: 'Rules & Notes'}).waitFor();await page.evaluate(()=>{passengerBookingGate.newerSubmit=document.querySelector('#modal-form').onsubmit;passengerBookingGate.newerClose=document.querySelector('#modal-cancel').onclick;});}
 }
 const authoritative = await raw(page), newer = mode === 'new-dialog' ? await page.locator('#modal-body').textContent() : null;
 await release(page); await frames(page);
 if (mode === 'foreign-new') {assert.equal(await raw(page), authoritative); assert.equal((await read(page)).bank, String(BigInt(before.bank) + 7n)); assert.equal((await gate(page)).settlements.at(-1).code, 'SAVE_NOT_COMMITTED');}
 else assertSaved(await read(page), before, scenario);
 assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
 if (mode === 'native-close') assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
 if (mode === 'new-dialog') {assert.equal(await page.locator('#modal-title').textContent(), 'Rules & Notes'); assert.equal(await page.locator('#modal-body').textContent(), newer); assert.equal(await page.locator('#modal-error').textContent(), '');}
 const bytes = await raw(page); await page.evaluate(() => {void passengerBookingGate.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});}); await frames(page);
 assert.equal(await raw(page), bytes); assert.equal((await gate(page)).totalCalls, 1);
 if (mode === 'foreign-same') {
  assert.equal(await page.locator('#modal-error').textContent(),'This passenger change was saved, but its earlier review changed before completion. Close and review the current campaign; do not record this change again.');
  await detail(page,result,'stale-owner-warning',['#modal-error']);
 }
 else await capture(page, result, 'retired-owner');
 if(mode==='new-dialog')await verifyNewerNotes(page,result);
 result.gate = safeReport(await gate(page));
 if (mode === 'foreign-new') {await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor(); assert.equal(await raw(page), bytes);} else await reloadUndo(page, result, before, scenario);
 result.checks.push('Foreign/consumed publication, editor tenure and modal replacement retire old success/cleanup authority permanently');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: passengerBookingGate.mapCapture('before-resize'), callbacks: {...passengerBookingMapCallbacks}}));
 await page.evaluate(() => {passengerBookingGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => passengerBookingMapCallbacks.resizeDelivered > previous.resizeDelivered && passengerBookingMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => passengerBookingGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.passengerBookingNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {passengerBookingGate.beginStrict(); passengerBookingGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>passengerBookingGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {passengerBookingGate.phase = 'cache-response'; passengerBookingGate.trace('held-cache-release-requested');}); context.passengerBookingNetwork.release();
 await page.waitForFunction(n => passengerBookingMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => passengerBookingGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => passengerBookingGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page, result, {resume: true}); await release(page); await frames(page); assertSaved(await read(page), before, scenario); assert.equal(await page.locator('#message').textContent(), (await gate(page)).baseline.message, 'Retired owner cannot publish completion message');
  await detail(page, result, 'foreign-map-warning', ['#modal-error'], /Campaign, passenger terms or editing ownership changed/); result.gate = safeReport(await gate(page)); await reloadUndo(page, result, before, scenario);
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function verifyNearbyAvailable(page,result){
 const bytes=await raw(page),before=await gate(page);await page.evaluate(()=>passengerBookingGate.dispatch('passenger-search'));await page.locator('#modal-title').filter({hasText:/^Find passengers$/}).waitFor();
 const option=page.locator('#modal [name="destination"] option[value="3,1"]');assert.equal(await option.count(),1,'The actual boot refreshNearby continuation enriched getWorlds, proven by a fresh real passenger search');assert.equal(await option.textContent(),'Unrelated nearby refresh world · 0402');
 await page.locator('#modal [name="destination"]').selectOption('3,1');await detail(page,result,'nearby-world-available-next-search',['#modal [name="destination"]']);
 assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,before.totalCalls);assert.equal((await gate(page)).semantic.dice,before.semantic.dice+2,'Only an explicitly opened fresh search consumes its original 2D; nearby completion never rerolled the accepted search');await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);
 result.checks.push('Fresh actual passenger search contains the newly loaded unrelated world, proving native refreshNearby finished; that new draft is canceled without another write');
}
async function nearbyRefresh(page,result,scenario,before,context){
 const held=await context.passengerNearbyNetwork.waitHeld();assert.equal(held.released,false);assert.match(held.url,/jumpworlds/);const bytes=await raw(page),baseline=await gate(page);
 const parsedBefore=await page.evaluate(()=>passengerBookingNearbyResponses.length);
 const completeHTTP=async()=>{
  const responseBaseline=await raw(page);context.passengerNearbyNetwork.release();await page.waitForFunction(n=>passengerBookingNearbyResponses.length>n,parsedBefore);await frames(page);
  const snapshot=await gate(page),response=snapshot.nearbyResponses.at(-1);assert.deepEqual(response.worldIds,['3,1']);assert.equal(response.url,held.url);assert.equal(snapshot.semantic.dice,snapshot.acceptedDice??baseline.semantic.dice,'Background nearby normalization and continuation never consume dice');
  result.nearbyContinuation={stage:scenario.nearbyStage,parsedResponse:response,animationFramesCompleted:true,fullCampaignBytesUnchanged:await raw(page)===responseBaseline};assert.equal(result.nearbyContinuation.fullCampaignBytesUnchanged,true);return snapshot;
 };
 if(scenario.nearbyStage==='review'){
  await page.evaluate(()=>{const g=passengerBookingGate;g.nearbyReview={form:document.querySelector('#modal-form'),html:document.querySelector('#modal-form').innerHTML,submit:document.querySelector('#modal-form').onsubmit,close:document.querySelector('#modal-cancel').onclick,mutations:0};g.nearbyReview.observer=new MutationObserver(records=>{g.nearbyReview.mutations+=records.length;});g.nearbyReview.observer.observe(g.nearbyReview.form,{subtree:true,childList:true,attributes:true,characterData:true});});
  const snapshot=await completeHTTP();assert.deepEqual(snapshot.semantic,baseline.semantic,'Unrelated enrichment cannot change accepted review text, field values, current tab, status or opening roll');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.totalCalls,0);assert.equal(await raw(page),bytes);
  result.nearbyReview=await page.evaluate(()=>{const g=passengerBookingGate,r=g.nearbyReview;r.observer.disconnect();return {sameForm:document.querySelector('#modal-form')===r.form,sameHTML:r.form.innerHTML===r.html,sameSubmit:r.form.onsubmit===r.submit,sameClose:document.querySelector('#modal-cancel').onclick===r.close,mutations:r.mutations};});assert.deepEqual(result.nearbyReview,{sameForm:true,sameHTML:true,sameSubmit:true,sameClose:true,mutations:0});
  await detail(page,result,'nearby-review-retained-footer',['#modal-cancel','#modal-submit']);
  // refreshNearby originally renders the underlying Contracts panel at review
  // time. Keep that read-only repaint; retain its newly mounted main baseline
  // before the separate pending write begins. The reviewed form never changed.
  await page.evaluate(()=>{passengerBookingGate.remember();passengerBookingGate.armed=true;});await assertPending(page,result,scenario,bytes,before);await release(page);await successful(page,result,before,scenario);return;
 }
 await page.evaluate(()=>{passengerBookingGate.armed=true;});await assertPending(page,result,scenario,bytes,before);await page.evaluate(()=>passengerBookingGate.beginStrict());
 if(scenario.nearbyStage==='publication'){await page.evaluate(()=>passengerBookingGate.write());await frames(page);assertSaved(await read(page),before,scenario);}
 const heldBytes=await raw(page),snapshot=await completeHTTP();assert.equal(await raw(page),heldBytes,'Read-only refreshNearby never changes durable campaign bytes');assertRetained(snapshot);assert.equal(snapshot.mutationCount,0,'Actual refreshNearby render callback cannot mutate any pending main/form/footer/summary/tab/status DOM');
 assert.deepEqual((await page.evaluate(()=>passengerBookingGate.mapCapture('after-nearby-continuation'))).regions,snapshot.mapBaseline.regions);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.pending,true);assert.equal(snapshot.nearbyResponses.at(-1).pending,true);assert.equal(snapshot.nearbyResponses.at(-1).writeExecuted,scenario.nearbyStage==='publication');
 await detail(page,result,'nearby-pending-retained-footer',['#modal-cancel','#modal-submit']);assert.equal((await gate(page)).mutationCount,0);await page.evaluate(()=>passengerBookingGate.endStrict());await release(page);await successful(page,result,before,scenario);
 result.checks.push('Held actual boot refreshNearby(false) response completes '+scenario.nearbyStage+' without invalidating accepted consent, publishing offers early, mutating pending DOM or rerolling');
}

async function handoffReentry(page,result,scenario,before){
 await prepare(page,result,scenario,before,{firstOnly:true});const bytes=await raw(page);
 await page.evaluate(point=>{if(point==='normalization'){passengerBookingGate.normalizationFault='reentry';passengerBookingGate.normalizationAfter=2;}else passengerBookingGate.constructionFault=point;},scenario.point);
 await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);
 const snapshot=await gate(page);assert.equal(snapshot.totalCalls,0);assert.equal(await raw(page),bytes);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);
 await page.evaluate(()=>{void passengerBookingGate.firstSubmit({preventDefault(){},currentTarget:passengerBookingGate.firstForm});});await frames(page);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-title').textContent(),snapshot.newer.title);assert.equal((await gate(page)).totalCalls,0);
 await detail(page,result,'newer-notes-owns-preview-handoff',['#modal-body .notes-list article:first-child'],/Rules and verification/);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));
}
async function stageOwnership(page,result,scenario,before,context){
 const bytes=await raw(page),pending=scenario.stage==='settlement';await prepare(page,result,scenario,before,{firstOnly:scenario.stage==='first'});
 if(pending){await page.evaluate(()=>{passengerBookingGate.armed=true;});await assertPending(page,result,scenario,bytes,before);}
 if(['cancel','replacement'].includes(scenario.drift)){
  if(pending)await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});else await pointer(page,'#modal-cancel');await closed(page);
  if(scenario.drift==='replacement'){await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await page.evaluate(()=>{const g=passengerBookingGate;g.newer={title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent};g.newerSubmit=document.querySelector('#modal-form').onsubmit;g.newerClose=document.querySelector('#modal-cancel').onclick;});}
 }else if(scenario.drift==='foreign')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
 else if(scenario.drift==='editor-regain')await peerTakeover(page,result,context,{regain:true});
 else if(scenario.drift==='selection'){await page.evaluate(()=>passengerBookingGate.dispatch('world','2,1'));await frames(page);}
 else if(scenario.drift==='terms')await page.evaluate(()=>{passengerBookingGate.lastState.ship.accommodation.passengerCapacity.reservedCabins++;});
 if(pending){await release(page);await frames(page);assertSaved(await read(page),before,scenario);assert.equal(await page.locator('#message').textContent(),(await gate(page)).baseline.message,'A retired settlement cannot claim success');}
 else{await page.evaluate(()=>{const g=passengerBookingGate;void (g.oldSubmit||g.firstSubmit)({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void g.firstSubmit({preventDefault(){},currentTarget:g.firstForm});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);if(scenario.stage==='first')assert.notEqual(await page.locator('#modal-title').textContent(),'Confirm passenger booking');}
 const snapshot=await gate(page);if(scenario.drift==='replacement'){assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);await detail(page,result,'newer-notes-retained',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);}
 else if(await page.locator('#modal').evaluate(el=>el.open))await detail(page,result,'stale-'+scenario.stage+'-authority',['#modal-error']);else await detail(page,result,'closed-'+scenario.stage+'-authority',['#save-status']);
 assert.equal((await gate(page)).totalCalls,pending?1:0);result.gate=safeReport(await gate(page));if(pending)await reloadUndo(page,result,before,scenario);
}
async function entryFault(page,result,scenario,before){
 await prepare(page,result,scenario,before);const bytes=await raw(page);
 await page.evaluate(fault=>{const g=passengerBookingGate;if(fault==='controls')g.entryFault='modal-submit';else{g.normalizationFault='throw';if(fault==='warning')g.warningFault=true;}},scenario.fault);
 await pointer(page,'#modal-submit');await frames(page);const snapshot=await gate(page);assert.equal(snapshot.totalCalls,0);assert.equal(snapshot.storage.writes,0);assert.equal(await raw(page),bytes);assert.equal(snapshot.pending,false);
 assert.ok(snapshot.faults.includes(scenario.fault==='controls'?'entry-controls':scenario.fault));assert.match(await page.locator('#modal-error').textContent(),/Synthetic|Reload/i);await detail(page,result,'no-write-'+scenario.fault+'-warning',['#modal-error']);
 if(scenario.fault==='warning'){assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);}
 result.gate=safeReport(await gate(page));
}
async function endpointDriftWithNearby(page,result,scenario,before,context){
 await prepare(page,result,scenario,before);const bytes=await raw(page),held=await context.passengerNearbyNetwork.waitHeld(),n=(await gate(page)).nearbyResponses.length;
 // Saved endpoint objects outrank catalog enrichment. A real same-revision
 // endpoint mutation is the negative context; the held real callback is observed
 // separately, so an unrelated network response is never blamed for that drift.
 await page.evaluate(()=>{passengerBookingGate.lastState.worlds['2,1'].uwp='B788879-C';});
 if(scenario.nearbyStage==='prewrite'){await page.evaluate(()=>{passengerBookingGate.armed=true;});await page.evaluate(()=>{void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});}
 context.passengerNearbyNetwork.release();await page.waitForFunction(n=>passengerBookingNearbyResponses.length>n,n);await frames(page);assert.equal((await gate(page)).nearbyResponses.at(-1).url,held.url);
 await page.evaluate(()=>{void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isDisabled(),true);
 await detail(page,result,'relevant-endpoint-drift-retired',['#modal-error'],/changed|review|reopen/i);result.gate=safeReport(await gate(page));
}

async function earlyDurableBoundary(page,result,scenario,before){
 await prepare(page,result,scenario,before,{firstOnly:true});const original=await raw(page);
 if(scenario.boundary==='first')await page.evaluate(key=>{const foreign=JSON.parse(localStorage.getItem(key));foreign.bank=String(BigInt(foreign.bank)+7n);localStorage.setItem(key,JSON.stringify(foreign));},KEY);
 else await page.evaluate(()=>{passengerBookingGate.boundaryReads=0;passengerBookingGate.readFailureAt=2;});
 const durable=await raw(page);await pointer(page,'#modal-submit');await frames(page);const snapshot=await gate(page);
 assert.equal(snapshot.totalCalls,0,'First/preview/handoff durability failure cannot reach Store.save');assert.equal(snapshot.executions,0);assert.equal(await raw(page),durable);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.notEqual(await page.locator('#modal-title').textContent(),'Confirm passenger booking');
 assert.equal(snapshot.acceptanceUUIDs.length,scenario.boundary==='first'?0:2,'The failure is observed at its declared side of the real preview');
 if(scenario.boundary==='handoff')assert.equal(snapshot.timeline.filter(e=>e.event==='handoff-durable-read-fault').length,1);else assert.notEqual(durable,original);
 await detail(page,result,'early-'+scenario.boundary+'-durable-warning',['#modal-error'],/not saved[\s\S]*Reload/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),durable);result.gate=safeReport(await gate(page));
 await page.evaluate(()=>{passengerBookingGate.readFault=false;passengerBookingGate.readFailureAt=null;});await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),durable);await tab(page,'Contracts');assert.deepEqual(await draftIds(page),[]);
}

async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>passengerBookingStorage.writes),0,'Complete synthetic seed requires no migration write');
 await installGate(page,result);await seedDrafts(page,result,scenario);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(mode==='early-durable'){await earlyDurableBoundary(page,result,scenario,before);return;}
 if(mode==='handoff-reentry'){await handoffReentry(page,result,scenario,before);return;}
 if(mode==='stage-ownership'){await stageOwnership(page,result,scenario,before,context);return;}
 if(mode==='entry-fault'){await entryFault(page,result,scenario,before);return;}
 if(mode==='nearby-endpoint'){await endpointDriftWithNearby(page,result,scenario,before,context);return;}
 if(mode==='construction-reentry'){
  await tab(page,'Contracts');const {name,arg}=actionSpec(before,scenario);
  await page.evaluate(point=>{passengerBookingGate.constructionFault=point;},scenario.point);await action(page,name,arg).click();await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);
  const snapshot=await gate(page);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===passengerBookingGate.newerSubmit),true);
  await page.evaluate(()=>document.querySelector('#modal-form').requestSubmit());await frames(page);assert.equal(await page.locator('#modal-title').textContent(),snapshot.newer.title);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);
  await detail(page,result,'newer-notes-owns-entry',['#modal-body .notes-list article:first-child'],/Rules and verification/);await verifyNewerNotes(page,result);
  await page.evaluate(()=>passengerBookingGate.dispatch('deposit'));await page.locator('#modal-title').filter({hasText:/^Record deposit$/}).waitFor();await fill(page,'amount','17');await fill(page,'reason','Synthetic later entry');await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm deposit$/}).waitFor();assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await pointer(page,'#modal-cancel');await closed(page);
  result.gate=safeReport(await gate(page));result.checks.push('Real synchronous Notes onclick during '+scenario.point+' setter owns newer DOM/handler/Close; old construction cannot write or overwrite it; later Deposit entry remains usable');return;
 }
 await prepare(page,result,scenario,before,{loops:mode==='deferred',network:context.passengerBookingNetwork});
 if(mode==='nearby-refresh'){await nearbyRefresh(page,result,scenario,before,context);return;}
 if(mode==='context-drift'){
  await page.evaluate(({drift})=>{const s=passengerBookingGate.lastState;if(drift==='hours')s.hours++;if(drift==='actual')s.actual=s.actual==='1,1'?'2,1':'1,1';if(drift==='world')s.worlds[s.actual].uwp='B788879-C';if(drift==='trader')s.trader.broker++;if(drift==='ship')s.ship.accommodation.rooms.middle++;if(drift==='settings')s.settings.creditStep=100;if(drift==='history')s.events.push({id:'synthetic-context-drift',label:'Synthetic drift',hours:s.hours});if(drift==='capacity')s.ship.accommodation.passengerCapacity={reservedCabins:0,installedLowBerths:9};if(drift==='booking'){if(s.contracts.length)s.contracts[0].payment=String(BigInt(s.contracts[0].payment)+1n);else s.events.find(e=>e.id===s.latestPassengerSearchId).offers[0].count++;}if(drift==='form'){const old=document.querySelector('#modal-form');passengerBookingGate.replacedForm=old;const replacement=old.cloneNode(true);old.replaceWith(replacement);}},scenario);
  if(scenario.drift==='form')await page.evaluate(()=>{void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});else await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);if(scenario.drift==='form'){await detail(page,result,'foreign-form-context-retained',['#modal-title']);result.gate=safeReport(await gate(page));return;}assert.match(await page.locator('#modal-error').textContent(),/changed|reopen|review/i);await detail(page,result,'same-revision-context-retired',['#modal-error'],/changed|reopen|review/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);result.gate=safeReport(await gate(page));result.checks.push('Actual app-delivered same-revision '+scenario.drift+' drift retires stale consent before generation or provider work');return;
 }
 if(mode==='read-only'){
  await peerTakeover(page,result,context);await frames(page);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);const beforeCalls=(await gate(page)).totalCalls;await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,beforeCalls);assert.equal(await raw(page),bytes);await detail(page,result,'read-only-warning',['#modal-error'],/Editing moved|ownership changed/);await pointer(page,'#modal-cancel');await closed(page);for(const name of ['passenger-search','passenger-setup'])assert.equal(await action(page,name).isDisabled(),true,'Read-only Contracts action stays disabled: '+name);await detail(page,result,'read-only-status',['#save-status']);result.gate=safeReport(await gate(page));return;
 }
 if(mode==='foreign-form'){await page.evaluate(()=>{const clone=document.querySelector('#modal-form').cloneNode(true);void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:clone});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form'].includes(mode)){
  const immediate=await page.evaluate(mode=>{passengerBookingGate.reentrant=mode==='reentrant';if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit','']])passengerBookingGate.dispatch(name,arg);void passengerBookingGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});return {writes:passengerBookingStorage.writes,open:document.querySelector('#modal').open};},mode);
  assert.equal(immediate.writes,1,'Native Store writes in the same turn without an added microtask');assert.equal(immediate.open,false,'Native completion closes the accepted input immediately');await frames(page);assert.equal((await gate(page)).totalCalls,1);if(mode==='reentrant')assert.ok((await gate(page)).reentrantChecks.every(item=>item.sameTitle&&item.sameOpen));await successful(page,result,before,scenario);return;
 }
 await page.evaluate(mode=>{passengerBookingGate.armed=true;passengerBookingGate.notifyFault=mode==='notification-before'?'before':['notification-after','controls'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','consumed-token'].includes(mode)?mode:null;passengerBookingStorage.failNext=['retry','recovery-reentry','retry-form-drift'].includes(mode);passengerBookingGate.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map){await mapPublication(page,result,scenario,before,context);return;}
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token'].includes(mode)){await retired(page,result,before,scenario,context);return;}
 if(['disk-same','disk-unreadable'].includes(mode)){
  if(mode==='disk-same')await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);else await page.evaluate(()=>{passengerBookingGate.readFault=true;});
  const current=await raw(page);await release(page,'known-before');await frames(page);assert.equal(await raw(page),current);assert.equal((await gate(page)).totalCalls,1);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/not saved[\s\S]*reload/i);await detail(page,result,'durable-baseline-retired',['#modal-error'],/not saved[\s\S]*reload/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),current);await page.evaluate(()=>{passengerBookingGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),current);result.checks.push('Typed known-unwritten failure cannot retry if exact durable campaign baseline changed or cannot be read');return;
 }

 if(['retry','recovery-reentry'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known passenger-booking prewrite'}).waitFor();let snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);
  if(mode==='recovery-reentry'){assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);assert.equal(snapshot.totalCalls,1);}
  await detail(page,result,'known-unsaved-warning',['#modal-error'],/Synthetic known passenger-booking prewrite/);await detail(page,result,'known-unsaved-controls',['#modal-cancel','#modal-submit']);const candidate=JSON.parse(snapshot.candidates[0]),dice=snapshot.semantic.dice;
  await pointer(page,'#modal-submit');await page.waitForFunction(()=>!!passengerBookingGate.pending);snapshot=await gate(page);assert.equal(snapshot.calls,2);
  // Compare the actual accepted audit without UUID normalization. Transition's
  // own bookkeeping UUID can differ, but accepted offer/check/edit IDs cannot.
  const accepted=state=>{const c=isBoard(scenario)?state.contracts.at(-1):state.contracts.find(c=>c.id===specification(before,scenario).id);const {id,...terms}=c;return terms;};
  assert.deepEqual(accepted(JSON.parse(snapshot.candidates[1])),accepted(candidate),'Deliberate known-unwritten retry retains exact accepted count, cabin, confirmations, offer/search IDs, fare, rounding and audit terms');assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])),normalize(candidate));assert.equal(snapshot.semantic.dice,dice);assertRetained(snapshot);
  await release(page);await successful(page,result,before,scenario);return;
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{passengerBookingGate.beginStrict();passengerBookingGate.write();});await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates[0]);assertRetained(snapshot);assert.equal(snapshot.pending,true);await replay(page);assertRetained(await gate(page));assert.equal((await gate(page)).totalCalls,1);if(mode==='deferred')await detail(page,result,'durable-publication-held-footer',['#modal-cancel','#modal-submit']);const strict=await gate(page);assert.equal(strict.mutationCount,0,'No transient main/review/summary/time/tab/status mutation during durable publication');assert.deepEqual((await page.evaluate(()=>passengerBookingGate.mapCapture('after-publication-replay'))).regions,strict.mapBaseline.regions);await page.evaluate(()=>passengerBookingGate.endStrict());await release(page);await successful(page,result,before,scenario);return;
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{passengerBookingGate.cleanupFault=mode;},mode);
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
 finally{context?.passengerBookingNetwork?.cleanup();context?.passengerNearbyNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 for(const scenario of scenarios){let before=fixture(scenario);if(isBoard(scenario)||scenario.preserveSearch)before=expectedSearch(before);if(scenario.prior){const offer=latestPassengerSearch(before).offers.find(o=>o.passageClass==='high');before=S.transition(before,'Accepted passenger booking',n=>S.acceptPassengers(n,offer.offerId,{count:1,cabinMode:'shared',serviceConfirmed:true}));}const next=expected(before,scenario);assertSaved(next,before,scenario);S.validate(next);}
 const board=expectedSearch(fixture({operation:'board'})),boardSpec=specification(board,{operation:'board'}),preview=S.transition(board,'Preview passenger boarding',n=>S.acceptPassengers(n,boardSpec.offerId,boardSpec.inputs)),committed=expected(board,{operation:'board'});assert.notEqual(preview.contracts.at(-1).id,committed.contracts.at(-1).id);assert.equal(board.contracts.length,0);
 const delivery=fixture({operation:'deliver'});assert.equal(S.jumpUndoEligibility(delivery).allowed,true);assert.equal(delivery.actual,'2,1');assert.equal(delivery.ledger.filter(e=>e.type==='Jump').length,1);assert.equal(delivery.contracts[0].status,'accepted');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8'),ui=await readFile(new URL('../js/passenger-ui.mjs',import.meta.url),'utf8');
 assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.match(app,/import\s*\{[^}]*\bcreatePassengerUI\b[^}]*\}\s*from\s*['"]\.\/passenger-ui\.mjs\?[^'"]+['"]/);
 for(const kind of operations)assert.match(ui,new RegExp("completion\\.open\\(\\{kind:'"+kind+"'"));assert.match(ui,/kind:'board',[\s\S]*preview:true/);assert.match(ui,/success:'Accepted passenger booking saved\.'/);assert.match(ui,/success:'Delivered passenger booking saved\.'/);assert.match(app,/reviewArgs/);
 assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');assert.equal(screenshotOptions.quality,30);assert.equal(report.limits.imageBytes,20*1024*1024);assert.equal(report.limits.artifactBytes,24*1024*1024);for(const operation of operations)assert.match(fixture({operation}).worlds['2,1'].name,/^ExtraordinarilyLongUnbroken/);
 const sourceChecks=['Actual tagged app/Store/passenger UI import wiring','Two completion.open board/deliver callers and distinct side-effect-free preview UUID','Independent full-state acceptance/delivery/receipt/Undo oracle; only UUIDs normalized','Immutable persisted real arrival with consumed LSS and open jump mulligan','No live Store.read alias; full readable durable baseline','Full viewport JPEG quality 30; 20 MiB images / 24 MiB artifacts; capture before registration'];
 const plan={suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,declaredScreenshots:report.declaredScreenshots,limits:report.limits,scope:report.scope,sourceChecks,scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,operation:scenario.operation,mode:scenario.mode,viewport,screenshots:expectedFrames(scenario)})),execution:'Fixture/source validation only; Chromium was not launched.'};
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify(plan,null,2));else console.log(`PASS: independent passenger boarding/delivery full-state, immutable terms, receipt, consumed supplies, pool/Undo/mulligan fixture oracles and tagged source wiring. ${scenarios.length} scenarios / ${cases.length} declared browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile), ${report.declaredScreenshots} frames. Chromium was NOT launched; fixture/source validation is NOT browser evidence.`);
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
 if(!report.passed)throw Error('Passenger boarding/delivery completion Chromium checks failed; see verification-artifacts/passenger-booking-completion-report.json');
 console.log(`PASS: ${report.declaredCases} exact-head passenger boarding/delivery completion cases, native locks, exact booking/receipt/capacity/economics/Undo and bounded desktop/mobile evidence.`);
}
