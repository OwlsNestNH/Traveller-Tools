// Exact-head Stage 2 Planned Route Save browser gate. Production tagged app,
// controller and Store, real DOM/Web Locks/localStorage; synthetic campaigns only.
// All provider wrappers preserve the real native write/publication and separately
// hold its returned settlement. No private application callback is reconstructed.
// The 'playwright' dependency is reserved for the guarded CI branch below.
// --fixtures-only [--plan-json] exits BEFORE requiring or launching Playwright.
// Browser execution is GitHub Actions only, against the requested clean exact head.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {normalize as normalizeWorld,plan as planRoute,distance as routeDistance} from '../js/map.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const cliFlags=process.argv.slice(2).filter(arg=>arg.startsWith('--'));
for(const flag of cliFlags)assert.ok(['--fixtures-only','--plan-json'].includes(flag),'Unsupported flag: '+flag);
assert.ok(!cliFlags.includes('--plan-json')||cliFlags.includes('--fixtures-only'),'--plan-json requires --fixtures-only');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='route-save-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const modes=['native','deferred','retry','recovery-reentry','unknown-before','unknown-after','contradictory','fulfilled-no-publication','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token','foreign-same','foreign-new','editor-regain','read-only','native-close','new-dialog','retired-unknown-newer','newer-draft','disk-same','disk-unreadable','published-disk-drift','published-disk-unreadable','queued-pending','queued-settled','reentrant','foreign-form','moved-form','render','report','terminal-report','close-before','close-after','clear-error','controls','controls-close','reentrant-close','cancel-review','preclaim-replacement'];
const dual=new Set(['native','deferred','retry','unknown-before','unknown-after','new-dialog','newer-draft','read-only','cancel-review','controls-close']);
const scenarios=[];
for(const entry of ['map','plot']){
 for(const mode of modes)scenarios.push({id:entry+'-'+mode,entry,mode,dual:dual.has(mode)});
 for(const mode of ['map-owned','map-foreign'])scenarios.push({id:entry+'-'+mode,entry,mode,map:true,dual:mode==='map-owned'});
 scenarios.push({id:entry+'-nearby-before-save',entry,mode:'nearby',nearby:true,stage:'review'});
 scenarios.push({id:entry+'-nearby-rejected-after-settlement',entry,mode:'nearby',nearby:true,stage:'after-settlement',reject:true});
 for(const reject of [false,true])scenarios.push({id:entry+'-nearby-'+(reject?'rejected':'resolved'),entry,mode:'nearby',nearby:true,stage:'publication',reject,dual:!reject});
}
for(const lookup of ['world','nearby'])for(const retirement of ['cancel','escape','replacement','foreign','editor','selection'])scenarios.push({id:'plot-lookup-'+lookup+'-'+retirement,entry:'plot',mode:'initial-lookup',lookup,retirement,dual:['cancel','replacement'].includes(retirement)});
// Appended ownership regressions retain every original 140 case and target.
for(const lookup of ['world','nearby'])for(const retirement of ['picker-host','picker-control','row-remove','destination-host','destination-control'])scenarios.push({id:'plot-lookup-'+lookup+'-'+retirement,entry:'plot',mode:'initial-lookup',lookup,retirement});
scenarios.push({id:'plot-initial-foreign-current-target',entry:'plot',mode:'initial-foreign-current-target'});
for(const fault of ['initial-body','first-picker','destination-picker'])scenarios.push({id:'plot-construction-'+fault,entry:'plot',mode:'initial-construction',fault});
// Recovery refinements append to the 154-case ownership freeze unchanged.
scenarios.push({id:'plot-construction-closed-body-cleanup',entry:'plot',mode:'initial-construction',fault:'first-picker',bodyCleanupFault:true});
scenarios.push({id:'plot-initial-close-newer-notes',entry:'plot',mode:'initial-close-newer-notes'});
scenarios.push({id:'plot-construction-close-newer-notes',entry:'plot',mode:'initial-construction',fault:'first-picker',closeReentry:true});
const cases=scenarios.flatMap(scenario=>sizes.filter(viewport=>viewport.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
const screenshotOptions=Object.freeze({type:'jpeg',quality:65,caret:'initial'});
const successPattern=/^Route planned(?: from map)? saved\.$/;
const labelFor=scenario=>scenario.entry==='map'?'Route planned from map':'Route planned';
const successFor=scenario=>labelFor(scenario)+' saved.';
const pathFor=before=>[before.actual,'2,1',before.actual,'2,1'];
const stopsFor=before=>pathFor(before).slice(1);
const savedRoute=before=>[...before.route.slice(0,before.routeIndex),...pathFor(before)];
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>routeSaveGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>routeSaveGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const detailedSuccess=scenario=>scenario.mode==='native';
const nearbyAPIWorld={Name:'Retained nearby catalogue addition',WorldX:3,WorldY:1,Sector:'Synthetic',Hex:'0402',UWP:'A788879-C',PBG:'703',Zone:''};
function persistsEvidence(s){return ['native','deferred','retry','unknown-before','unknown-after','new-dialog','newer-draft','read-only','cancel-review','map-owned','map-foreign','controls-close'].includes(s.mode)||s.mode==='initial-lookup'&&['cancel','replacement'].includes(s.retirement);}
const report={suite:'Planned route save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Only accepted saveMapRoute and final plotRoute save completion; initial plot selection/calculation stays cancellable. Exact original route mutation, retained campaign economics/Undo/permanent mulligan closure; native same-stack saved write and original microtask close; delayed native write/publication/settlement, provenance/retry/terminal/reload and owner faults; real pending initial world/radius-12 nearby and final nearby/cache/ResizeObserver callbacks, exact retained production review and underlying route preview, newer Notes/draft safety. No local browser, user campaign, wider Stage 3 migration or unrelated layout changes.'};
let browser,imageBytes=0;
function fixture(){
 let s=S.initial();const origin={id:'0,1',x:0,y:1,name:'Original Departure',sector:'Synthetic',hex:'0102',uwp:'A788879-C',zone:'Safe',raw:{PBG:'703'}},current={...origin,id:'1,1',x:1,name:'ExtraordinarilyLongUnbrokenCurrentWorldNameForRouteSaveNarrowViewportVerification',hex:'0202',fuelOverride:false},destination={...origin,id:'2,1',x:2,name:'Future destination beyond the exceptionally long named actual current world',hex:'0302',fuelOverride:false};
 Object.assign(s,{initialized:true,name:'Disposable Planned Route Save campaign',actual:origin.id,worlds:{[origin.id]:origin,[current.id]:current,[destination.id]:destination},route:[origin.id,current.id,destination.id],mandatoryStops:[destination.id,current.id,destination.id],bank:'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Route Save Trader',capacity:'100',staterooms:4,jump:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}},accommodation:{combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0',passengerCapacity:{reservedCabins:1,installedLowBerths:4}},expenses:{salary:'12000'},mortgage:{originalAmount:'24000000',payment:'100003',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'},maintenance:{payment:'2003',nextDueDate:'015-1105',paidSinceTracking:'4006'}});
 s.lots=[{id:'11111111-2222-4333-8444-555555555555',commodity:'11',description:'Retained owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];s.ledger=[{id:'route-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];
 s.contracts=[{id:'route-mail',kind:'mail',status:'accepted',origin:origin.id,destination:destination.id,quantity:'5',payment:'9007199254740993',dueHours:null,firstDeparture:null,audit:{manual:true,reason:'Retain mail terms'}}];
 s.policies=[{id:'route-policy',lotId:s.lots[0].id,claims:[],status:'active',initialQuantity:'3',remainingQuantity:'3',insuredValue:'9001',remainingValue:'9001',coverage:70,route:[origin.id,current.id,destination.id],routeProgress:0,destination:destination.id}];
 s.dashboardBaseline=createDashboardBaseline(s);s=S.validate(s);const prepared=S.prepareJump(s,()=>({dice:Array(6).fill(3),total:18}));s=S.transition(prepared.state,'Jump: '+origin.name+' → '+current.name,n=>S.commitJump(n,{attemptId:prepared.attempt.id,elapsed:168}));assert.equal(S.jumpUndoEligibility(s).allowed,true);const ids=new Map();s=JSON.parse(JSON.stringify(s).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'eeeeeeee-1111-4111-8111-'+String(ids.size+1).padStart(12,'0'));return ids.get(id);}));return S.validate(s);
}
function expected(before,scenario){return S.transition(before,labelFor(scenario),s=>{s.worlds=scenario.entry==='map'&&scenario.nearby&&scenario.stage==='review'?{'3,1':normalizeWorld(nearbyAPIWorld),...before.worlds}:{...before.worlds};s.route=savedRoute(before);s.mandatoryStops=stopsFor(before);});}
function matchGenerated(actual,expected){expected.events.at(-1).id=actual.events.at(-1).id;if(expected.undo.length===actual.undo.length&&/^Route planned/.test(expected.undo.at(-1)?.label))expected.undo.at(-1).id=actual.undo.at(-1).id;return expected;}
function assertSaved(saved,before,scenario){assert.deepEqual(saved,matchGenerated(saved,expected(before,scenario)),'Full exact original route transition; only generated event and inverse IDs align');assert.deepEqual(saved.route,savedRoute(before));assert.equal(saved.routeIndex,before.routeIndex);assert.deepEqual(saved.mandatoryStops,stopsFor(before));assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);for(const key of ['hours','dateLabel','bank','actual','lots','contracts','policies','ship','settings','cooldowns','snapshots','ledger','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' unchanged');assert.deepEqual(material(S.undo(saved)),material(before));assert.equal(saved.jumpAttempts.at(-1).closed,true);assert.equal(S.undo(saved).jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(S.undo(saved)).allowed,false);}
const apiWorlds=Object.values(fixture().worlds).map(w=>({Name:w.name,WorldX:w.x,WorldY:w.y,Sector:w.sector,Hex:w.hex,UWP:w.uwp,PBG:'703',Zone:''}));
const releasedEconomics={"commit":"dc9006ad649aff7973be1d24276b7a64946ae982","tree":"3ea07e318412343f9cc986b096a6066dd195b16f","sha256":{"state.mjs":"be5633196e9a7aa65b91f7816b4b7dcd672a4be0feea4f85b82d860fd597f4fc","amounts.mjs":"8876a391fabc4f842678c9249aa2d9ad6797cca12e51d61c1ad88736ca997958","rounding.mjs":"646cf43e1b118d38da9c7d314dc9f0f75f166462a699045f6adebb155f124568","fuel.mjs":"e4f2cbb65f4be29e552ef0c9424339f1633996b4549693facd2cd6902dde62b3","life-support.mjs":"da54f07099b74a19f53cba68b1cb1e27a8df1ce053cf6a5a0b9b4e5b22233c3e","accommodation.mjs":"9a6fc0b166bd0d2a694dcf4a274eadbf7954165a4a4873a1227add23129431a6","passengers.mjs":"c1f5bee3b8bc2d13dbe346ded5a5f6e2ec0253ed84efecf00839729dbe68a818","jump-attempts.mjs":"0b62422f992dde8f4561a7dabf4d77fce3cd38f4125c832cbef46028bdabd593","dashboard-baseline.mjs":"8064fb4e5290224c1e2d49ca0b9210d308c3fa2afa24f3a0e1742f3f748c5195","map.mjs":"3407ba323fb782bfebbb0f5ede406291ce338415ca03d3efee125626d4866574","world-picker.mjs":"83cbe6448fa5be868978e14715bf616e58efe9ab078cbce658a25e37946dc7d7"}};
async function assertReleasedEconomics(){for(const [name,expected] of Object.entries(releasedEconomics.sha256)){const source=(await readFile(new URL('../js/'+name,import.meta.url),'utf8')).replace(/(^import [^\n]*?)\?v=[^'"]+/gm,'$1?v=<release>');assert.equal(hash(source),expected,'Released label-neutral economics: '+name);}return releasedEconomics;}
function assertRetained(snapshot){assert.deepEqual(snapshot.semantic,{...snapshot.baseline,dice:snapshot.acceptedDice},'Pending completion preserves exact form/main/summary/tab/status and retained die');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.mainNodeRetained,true);}
function safeReport(snapshot){const compact=value=>value&&{...value,main:{sha256:hash(value.main),bytes:value.main.length},summary:{sha256:hash(value.summary),bytes:value.summary.length}};const regionHash=value=>value&&{...value,regions:value.regions.map(({html,...region})=>({...region,sha256:html==null?null:hash(html),bytes:html?.length??null}))};return {...snapshot,candidates:snapshot.candidates.map(hash),baseline:compact(snapshot.baseline),semantic:compact(snapshot.semantic),mapBaseline:regionHash(snapshot.mapBaseline),paintEdges:snapshot.paintEdges.map(regionHash)};}
async function contextFor(result, scenario) {
 const context = await browser.newContext({viewport: result.viewport, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(errorText(error)));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
 });
 await context.exposeBinding('__routeSaveUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey, nearbyX}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__routeSaveUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.routeSaveStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   routeSaveStorage.attempts++; routeSaveStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (routeSaveStorage.failNext) {routeSaveStorage.failNext = false; throw Error('Synthetic known routeSave prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); routeSaveStorage.writes++; return result;
  };
  // Observe native parsing of the boot nearby response independently from the
  // viewport-cache callbacks. The fetch/normalization/refresh continuation is
  // unchanged; later fresh-search options prove it reached the real known-worlds map.
  globalThis.routeSaveLookupResponses=[];
  globalThis.routeSaveNearbyResponses=[];
  const responseJSON=Response.prototype.json;
  Response.prototype.json=function(...args){
   const url=new URL(this.url,location.href),relevant=url.origin==='https://travellermap.com'&&url.pathname.endsWith('/jumpworlds')&&url.searchParams.get('x')===String(nearbyX)&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12';
   const result=Reflect.apply(responseJSON,this,args);if(url.searchParams.get('jump')==='0')return result.then(value=>{routeSaveLookupResponses.push({url:url.href,parsedAt:performance.now()});return value;});if(!relevant)return result;
   return result.then(value=>{const entry={url:url.href,parsedAt:performance.now(),worldIds:Array.isArray(value.Worlds)?value.Worlds.map(w=>w.WorldX+','+w.WorldY):[],pending:!!globalThis.routeSaveGate?.pending,writeExecuted:!!globalThis.routeSaveGate?.pending?.executed};routeSaveNearbyResponses.push(entry);globalThis.routeSaveGate?.trace('boot-nearby-response-parsed',entry);return value;});
  };
  globalThis.routeSaveDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if(array instanceof Uint32Array&&array.length===1)routeSaveDiceCalls++;return random(array);};
  globalThis.routeSaveMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.routeSaveMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); routeSaveMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    routeSaveMapCallbacks.executed++; if (cache) routeSaveMapCallbacks.cacheExecuted++;
    globalThis.routeSaveGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.routeSaveGate?.paintEdge('after', cache);
    routeSaveMapCallbacks.completed++; if (cache) routeSaveMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.routeSaveGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {routeSaveMapCallbacks.loadingCacheCompleted++; routeSaveMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.routeSaveMapLoadingStatusNode = statusNode;}
    globalThis.routeSaveGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.routeSaveGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.routeSaveGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) routeSaveMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY, nearbyX:1});
 let held, releaseHold, heldOnce = false, heldReady;const reached=new Promise(resolve=>{heldReady=resolve;});
 context.routeSaveNetwork = {async waitHeld() {let timeout;try{await Promise.race([reached,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Real MapAreaCache tile did not reach network fixture')),10000);})]);return {...held};}finally{clearTimeout(timeout);}}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 let nearbyHeld,releaseNearby,nearbyHeldOnce=false,nearbyReached;const nearbyReady=new Promise(resolve=>{nearbyReached=resolve;});
 context.routeSaveNearbyNetwork={async waitHeld(){let timeout;try{await Promise.race([nearbyReady,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Actual boot refreshNearby request was not held')),10000);})]);return {...nearbyHeld};}finally{clearTimeout(timeout);}},release(){assert.ok(releaseNearby,'Nearby HTTP response remains held');const resolve=releaseNearby;releaseNearby=null;resolve();},cleanup(){releaseNearby?.();releaseNearby=null;}};
 let lookupArmed=false,lookupRelease,lookupReached,lookupHeld;const lookupReady=new Promise(resolve=>{lookupReached=resolve;});
 context.routeSaveLookupNetwork={arm(){lookupArmed=true;result.lookupRequests=[];},async waitHeld(){let timer;try{return await Promise.race([lookupReady,new Promise((_r,reject)=>{timer=setTimeout(()=>reject(Error('Real sequential '+scenario.lookup+' request not reached')),10000);})]);}finally{clearTimeout(timer);}},release(){assert.ok(lookupRelease,'Actual lookup response held');const resolve=lookupRelease;lookupRelease=null;resolve();},cleanup(){lookupRelease?.();lookupRelease=null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/routeSave-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable routeSave native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if(lookupArmed&&(url.searchParams.get('hex')!==null||url.searchParams.get('y')==='1'&&['1','2'].includes(url.searchParams.get('x')))){
     const request={url:url.href,sector:url.searchParams.get('sector'),hex:url.searchParams.get('hex'),x:url.searchParams.get('x'),y:url.searchParams.get('y'),jump:url.searchParams.get('jump')};result.lookupRequests.push(request);
     if(scenario.mode==='initial-lookup'&&!lookupHeld&&((scenario.lookup==='world'&&request.jump==='0')||(scenario.lookup==='nearby'&&request.jump==='12'))){lookupHeld={...request,released:false};lookupReached(lookupHeld);result.lookupResponse=lookupHeld;await new Promise(resolve=>{lookupRelease=resolve;});lookupHeld.released=true;}
    }
    if(url.searchParams.get('jump')==='0')return route.fulfill({json:{Worlds:scenario.mode==='initial-lookup'&&lookupHeld?.url===url.href?[{...apiWorlds.find(w=>w.Hex===url.searchParams.get('hex')),Name:'Late retired lookup sentinel',WorldX:3,WorldY:1}]:apiWorlds.filter(w=>w.Hex===url.searchParams.get('hex'))},headers});
    if(scenario.mode==='initial-lookup'&&lookupHeld?.url===url.href&&scenario.lookup==='nearby')return route.fulfill({json:{Worlds:[nearbyAPIWorld]},headers});

    if(scenario.nearby&&!nearbyHeldOnce&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'){
     nearbyHeldOnce=true;nearbyHeld={url:url.href,heldAt:Date.now(),released:false};result.nearbyResponse=nearbyHeld;nearbyReached();await new Promise(resolve=>{releaseNearby=resolve;});nearbyHeld.released=true;nearbyHeld.releasedAt=Date.now();
     return route.fulfill({json:{Worlds:scenario.reject?{}:[nearbyAPIWorld]},headers});
    }

    if (scenario.map && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {heldOnce = true; held = {url: url.href, heldAt: Date.now(), released: false}; result.mapResponse = held;heldReady(); await new Promise(resolve => {releaseHold = resolve;}); held.released = true; held.releasedAt = Date.now();}
    return route.fulfill({json: {Worlds: []}, headers});
   }
   if (url.pathname.endsWith('/universe')) return route.fulfill({json: {Sectors: [{Names:[{Text:'Synthetic'}],Milieu:'M1105'}]}, headers});
   if (url.pathname.endsWith('/metadata')) return route.fulfill({json: {Subsectors: [{Index:'A',Name:'Synthetic subsector'}]}, headers});
   if (url.pathname.endsWith('/sec')) return route.fulfill({json: 'Hex\tName\n'+apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n'), headers});
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
  const g = globalThis.routeSaveGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
  Object.assign(g, {timeline: [], timelineDropped: 0, constructionChecks: [], normalizationChecks: [], readChecks: []});
  g.trace = (event, detail = {}) => {const entry = {order: g.timeline.length + 1, at: performance.now(), event, ...detail}; if (g.timeline.length < 120) g.timeline.push(entry); else g.timelineDropped++; return entry;};
  Object.assign(g, {strict: false, paintEdges: [], paintEdgesDropped: 0, mutationCount: 0, phase: 'review', nextNodeId: 0, nodeIds: new WeakMap()});
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextNodeId), g.nextNodeId)) : null;
  g.mapNodeId = nodeId;
  g.mapCapture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, regions: ['.world-map', '#map-load-status', '.planned-route', '.route-draft', '#main', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status'].map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.mapCapture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const observer = new MutationObserver(records => {if (g.strict) g.mutationCount += records.length;});
  g.beginStrict = () => {observer.disconnect();g.mutationCount=0;g.paintEdges=[];g.paintEdgesDropped=0;g.strict = true; g.mapBaseline = g.mapCapture('strict-baseline'); for (const selector of ['#main', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status']) observer.observe(document.querySelector(selector), {subtree: true, childList: true, attributes: true, characterData: true});};
  g.endStrict = () => {g.strict = false; observer.disconnect();};
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: routeSaveDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  g.initialNormalizations=0;
  const nativeFormData=globalThis.FormData;
  globalThis.FormData=new Proxy(nativeFormData,{construct(target,args,newTarget){g.initialNormalizations++;return Reflect.construct(target,args,newTarget);}});
  const settled = () => g.settlements.length > 0;
  g.semantic=semantic;
  g.originalClose=close=>Reflect.apply(HTMLDialogElement.prototype.close,close,[]);
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic routeSave completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if(g.warningFault&&this.id==='modal-error'&&/Synthetic/.test(value)){g.warningFault=false;g.faults.push('warning');throw Error('Synthetic routeSave warning fault');}
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^Route planned(?: from map)? saved\.$/.test(value)) fault('report');
   if (settled() && g.cleanupFault === 'terminal-report' && this.id === 'message' && /Reload/.test(value)) fault('terminal-report');
   const result = Reflect.apply(text.set, this, [value]);
   if (g.constructionFault === 'title' && this.id === 'modal-title') g.replaceConstruction();
   return result;
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {
   if(g.initialBodyCleanupFault&&this.id==='modal-body'&&value===''&&!document.querySelector('#modal').open&&g.faults.includes('first-picker')){
    g.initialBodyCleanupFault=false;g.faults.push('closed-body-cleanup');g.closedCleanupObservation={open:document.querySelector('#modal').open,settingsConnected:!!document.querySelector('#settings-form'),partialBodyPresent:this.childElementCount>0};throw Error('Synthetic initial Plot closed-body cleanup failure');
   }
   if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render');
   const result=Reflect.apply(html.set,this,[value]);
   if(g.initialFault==='initial-body'&&this.id==='modal-body'&&value.includes('route-origin'))g.failInitialConstruction();
   if(g.constructionFault==='body'&&this.id==='modal-body')g.replaceConstruction();return result;
  }});
  g.failInitialConstruction=()=>{const point=g.initialFault;g.initialFault=null;g.partialSubmit=document.querySelector('#modal-form').onsubmit;g.faults.push(point);throw Error('Synthetic initial Plot construction '+point);};
  const nativeAppend=Element.prototype.append;
  Element.prototype.append=function(...nodes){
   const result=Reflect.apply(nativeAppend,this,nodes);
   if(g.initialFault==='first-picker'&&this.classList.contains('world-picker')&&this.closest('#route-stops')||g.initialFault==='destination-picker'&&this.id==='route-destination'&&this.classList.contains('world-picker'))g.failInitialConstruction();
   return result;
  };
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {
   if (settled() && g.cleanupFault === 'close-before' && this.id === 'modal') fault('close-before');
   const result = Reflect.apply(close, this, args);
   if(g.initialCloseReentry&&this.id==='modal'&&!this.open){
    const point=g.initialCloseReentry;g.initialCloseReentry=null;g.faults.push('initial-close-newer-'+point);document.querySelector('#notes').click();
    g.newer={title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent};g.newerSubmit=document.querySelector('#modal-form').onsubmit;g.newerClose=document.querySelector('#modal-cancel').onclick;
    g.initialReentryObservation={point,title:g.newer.title,open:document.querySelector('#modal').open,submitHidden:document.querySelector('#modal-submit').hidden,submitCallable:typeof g.newerSubmit==='function',closeCallable:typeof g.newerClose==='function'};
    if(!g.initialReentryObservation.open||g.newer.title!=='Rules & Notes')throw Error('Newer Notes did not open synchronously inside initial Plot native close');
   }
   if (settled() && g.cleanupFault === 'close-after' && this.id === 'modal') fault('close-after');
   if (settled() && g.cleanupFault === 'reentrant-close' && this.id === 'modal') {
    g.cleanupFault = null; g.faults.push('reentrant-close'); document.querySelector('#notes').click();
    g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit=document.querySelector('#modal-form').onsubmit; g.newerClose=document.querySelector('#modal-cancel').onclick;
   }
   return result;
  };
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic routeSave entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: routeSaveStorage.writes});
   }
   if (settled() && ((['restore-controls','controls'].includes(g.cleanupFault)&&this.id==='modal-cancel')||(g.cleanupFault==='controls-close'&&this.id==='modal-close')) && value===false) fault(g.cleanupFault);
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
   for (const [name, arg] of [['tab','Cargo'],['world','2,1'],['deposit',''],['route-build',''],['route-auto',''],['route-clear',''],['route-save',''],['route',''],['route-cancel',''],['route-last',''],['route-retry',''],['nearby','']]) g.dispatch(name, arg);
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before routeSave publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-candidate') args[0]={...args[0],bank:String(BigInt(args[0].bank)+1n)};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision; record.deliveredSnapshotMatches=JSON.stringify(args[0])===JSON.stringify(g.args?.[0]);
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after routeSave publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this);if(g.readFailureAt&&++g.boundaryReads===g.readFailureAt){g.readFault=true;g.trace('handoff-durable-read-fault',{read:g.boundaryReads});} if (g.readFault) throw Error('Synthetic unreadable durable routeSave baseline'); const value=Reflect.apply(nativeRead,this,args),check={exactDurableCopy:JSON.stringify(value)===localStorage.getItem(KEY),aliasesLive:value===g.lastState,revision:value.revision};g.readChecks.push(check);if(check.aliasesLive||!check.exactDurableCopy)throw Error('Store.read must return the full readable durable campaign copy');return value;};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = routeSaveDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending routeSave save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native routeSave write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending routeSave completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known routeSave prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown routeSave outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory routeSave not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable routeSave save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.observations=[];routeSaveStorage.observations=[];g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: routeSaveMapCallbacks.cacheCompleted, loadingCacheCompleted: routeSaveMapCallbacks.loadingCacheCompleted});};
  g.snapshot=()=>({modalControls:['modal-close','modal-cancel','modal-submit'].map(id=>{const node=document.querySelector('#'+id);return {id,disabled:node.disabled,hidden:node.hidden,connected:node.isConnected};}),calls:g.calls,totalCalls:g.totalCalls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,storage:{...routeSaveStorage},candidates:g.candidates,forwarded:g.forwarded,publications:g.publications,observations:g.observations,settlements:g.settlements,faults:g.faults,reentrantChecks:g.reentrantChecks,baseline:g.baseline,acceptedDice:g.acceptedDice,semantic:semantic(),reviewNodeRetained:!!g.reviewNode?.isConnected,mainNodeRetained:!!g.mainNode?.isConnected,newer:g.newer,recoveryChecks:g.recoveryChecks,callbacks:{...routeSaveMapCallbacks},nearbyResponses:routeSaveNearbyResponses,bootstrap:g.bootstrap,mapReadiness:g.mapReadiness,retainedBaselineOrder:g.retainedBaselineOrder,constructionChecks:g.constructionChecks,normalizationChecks:g.normalizationChecks,readChecks:g.readChecks,timeline:g.timeline,timelineDropped:g.timelineDropped,mapBaseline:g.mapBaseline,paintEdges:g.paintEdges,paintEdgesDropped:g.paintEdgesDropped,mutationCount:g.mutationCount,handoffChecks:g.handoffChecks||[],dieReentryCheck:g.dieReentryCheck??null,durableToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[],normalizationChecks:[]});
   Object.assign(routeSaveStorage,{attempts:0,writes:0,failNext:false,observations:[]});
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = routeSaveStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || routeSaveStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
  g.bootstrap = {storeDiscovered: true, dispatches: 2, observedPublications: g.publications.length - discoveredPublications, appCallbackCompleted: g.publications.at(-1).actualCallback, deliveredRevision: g.lastState.revision, exactDurableBytes: true, writes: 0};
  g.trace('observation-bootstrap-complete', g.bootstrap);
  // Later in-place fixture drift changes only this actual delivered test object.
  const controllerSpecifier=source.match(/import\s*\{[^}]*\bcreateCampaignController\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/u)?.[1];if(!controllerSpecifier)throw Error('Actual controller import missing');const controllerResponse=await fetch(new URL(controllerSpecifier,appURL));if(!controllerResponse.ok)throw Error('Cannot inspect controller');return {controllerSHA256:await digest(await controllerResponse.text()),appURL, storeURL, appSHA256: await digest(source), storeSHA256: await digest(storeSource), nativeLocks: !!navigator.locks};
 });
 assert.equal(result.runtime.nativeLocks, true);
 assert.equal(result.runtime.controllerSHA256,hash(await readFile(new URL('../js/campaign-controller.mjs',import.meta.url))));
 assert.equal(result.runtime.appSHA256, hash(await readFile(new URL('../js/app.mjs', import.meta.url))));
 assert.equal(result.runtime.storeSHA256, hash(await readFile(new URL('../js/persistence.mjs', import.meta.url))));
}
async function capture(page,result,label){
 await frames(page);
 if(result.persistEvidence||label==='failure'){
  const name=prefix+result.id+'-'+label+'.jpg',bytes=await page.screenshot(screenshotOptions),digest=hash(bytes);
  const attempt={name,producerCommit:report.testedCommit,appSHA256:result.runtime?.appSHA256??report.sourceSHA256?.['app.mjs']??null,gateSHA256:report.gateSHA256,imageSHA256:digest,bytes:bytes.length,viewport:result.viewport,encoding:screenshotOptions,previousPersistedImageBytes:imageBytes,persisted:false,status:'captured'};
  (result.captureAttempts??=[]).push(attempt);
  if(imageBytes+bytes.length>=report.limits.imageBytes){attempt.status='rejected-budget';assert.fail('Bounded screenshot bytes; failed attempt recorded and not indexed as persisted evidence');}
  await writeFile(join(artifacts,name),bytes);imageBytes+=bytes.length;report.imageBytes=imageBytes;attempt.persisted=true;attempt.status='persisted';result.screenshots.push(name);(result.imageSHA256??={})[name]=digest;(result.frameProvenance??=[]).push({...attempt});
 }
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Planned route save dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Planned route save content stays inside dialog');}
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
async function formWalk(page,result,label){
 const geometry=await page.locator('#modal').evaluate(el=>({height:el.clientHeight,total:el.scrollHeight,top:el.scrollTop}));
 const step=Math.max(1,geometry.height-90),max=Math.max(0,geometry.total-geometry.height),positions=[];for(let top=0;top<max;top+=step)positions.push(top);positions.push(max);
 const coverage=[];
 try{for(const[index,top]of positions.entries()){await page.locator('#modal').evaluate((el,top)=>{el.scrollTop=top;},top);await capture(page,result,label+'-'+(index+1));coverage.push(await page.locator('#modal').evaluate(el=>({top:el.scrollTop,bottom:el.scrollTop+el.clientHeight,total:el.scrollHeight})));}}
 finally{await page.locator('#modal').evaluate((el,top)=>{el.scrollTop=top;},geometry.top);}
 assert.equal(coverage[0].top,0);assert.ok(coverage.at(-1).bottom>=geometry.total-1);for(let i=1;i<coverage.length;i++)assert.ok(coverage[i].top<=coverage[i-1].bottom-50,'Full viewport walk overlaps, so no form content is cropped away');
 (result.formWalks??=[]).push({label,geometry,coverage});
}

async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/routeSave-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.routeSavePeer = {state: null, editable: false}; routeSavePeer.store = new Store(next => {routeSavePeer.state = next;}, editable => {routeSavePeer.editable = editable;}); await routeSavePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => routeSavePeer.editable); await page.waitForFunction(() => routeSaveGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(routeSavePeer.state, 'Foreign deposit during routeSave save', s => S.deposit(s, 7, 'Synthetic peer')); routeSavePeer.store.save(next, routeSavePeer.state.revision); return routeSavePeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {routeSavePeer.store.yield(); routeSavePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => routeSaveGate.store.acquire(true)); await page.waitForFunction(() => routeSaveGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;
 const before=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent}));
 const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===routeSaveGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===routeSaveGate.newerClose,submitCallable:typeof routeSaveGate.newerSubmit==='function',closeCallable:typeof routeSaveGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>{void routeSaveGate.newerSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
 assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent})),before);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await page.evaluate(()=>routeSaveGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Actual newer Notes handler identities survive old settlement and detached replay; captured Notes submit remains read-only and captured Close dismisses without writes');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: routeSaveGate.mapCapture('before-resize'), callbacks: {...routeSaveMapCallbacks}}));
 await page.evaluate(() => {routeSaveGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => routeSaveMapCallbacks.resizeDelivered > previous.resizeDelivered && routeSaveMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => routeSaveGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}

async function mapPublication(page, result, scenario, before, context) {
 const held = await context.routeSaveNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {routeSaveGate.beginStrict(); routeSaveGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>routeSaveGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for(const region of baseline.regions)if(region.selector!=='.route-draft'||scenario.entry==='map')assert.ok(region.nodeId&&region.html,'Mounted strict region: '+region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {routeSaveGate.phase = 'cache-response'; routeSaveGate.trace('held-cache-release-requested');}); context.routeSaveNetwork.release();
 await page.waitForFunction(n => routeSaveMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => routeSaveGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => routeSaveGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page,result,{resume:true});await release(page);await frames(page);assertSaved(await read(page),before,scenario);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern,'Retired owner cannot publish clean success');await terminal(page,result,before,scenario,{committed:true});
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function openInitialPlot(page,context){
 await page.locator('#route-menu > summary').click();await action(page,'route').click();
 await page.locator('#modal-title').filter({hasText:/^Plan route · fewest jumps$/}).waitFor();
 await page.waitForFunction(()=>{const nodes=[...document.querySelectorAll('#route-stops select[aria-label="World"],#route-destination select[aria-label="World"]')];return nodes.length===3&&nodes.every(node=>!node.disabled&&node.value);});
 assert.deepEqual(await page.locator('#route-stops select[aria-label="World"],#route-destination select[aria-label="World"]').evaluateAll(nodes=>nodes.map(node=>node.value)),['0302','0202','0302']);
 context.routeSaveLookupNetwork.arm();
}
async function mapReady(page,result,context){
  const held=await context.routeSaveNetwork.waitHeld();assert.equal(held.released,false);
  await page.setViewportSize({...result.viewport,width:result.viewport.width+17});await frames(page);await page.setViewportSize(result.viewport);await frames(page);
  await page.waitForFunction(()=>routeSaveMapCallbacks.loadingCacheCompleted>0&&routeSaveMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));
  await page.evaluate(held=>{routeSaveGate.mapReadiness=routeSaveGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...routeSaveMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:routeSaveGate.mapNodeId(routeSaveMapLoadingStatusNode)});},held);
}
async function prepare(page,result,scenario,before,context){
 if(scenario.entry==='map'){
  await page.locator('#route-menu > summary').click();await action(page,'route-build').click();
  for(const id of stopsFor(before)){await action(page,'map-world',id).click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);}
  if(scenario.map)await mapReady(page,result,context);
  await action(page,'route-save').click();
 }else{
  await openInitialPlot(page,context);if(scenario.map)await mapReady(page,result,context);await pointer(page,'#modal-submit');
 }
 await page.locator('#modal-title').filter({hasText:scenario.entry==='map'?/^Save planned route$/:/^Review route$/}).waitFor();
 assert.equal(await page.locator('#modal-body > p').first().textContent(),pathFor(before).map(id=>before.worlds[id].name).join(' → '),'Exact accepted repeated route order and full world names');
 assert.match(await page.locator('#modal-body .notice').textContent(),/Fuel alert:[\s\S]*You can continue this route; arrange fuel in play\./,'Fuel warning stays advisory');
 if(scenario.entry==='map')assert.match(await page.locator('#modal-body').textContent(),/3 jumps · Jump-2 ship[\s\S]*Legs: 1 pc → 1 pc → 1 pc[\s\S]*This replaces future planned stops\./);
 else{
  assert.deepEqual(await page.locator('#modal-body .preview dd').allTextContents(),['Jump-2','3','1 pc → 1 pc → 1 pc','3 pc']);
  assert.deepEqual(result.lookupRequests.map(({hex,x,jump})=>({hex,x,jump})),[{hex:'0302',x:null,jump:'0'},{hex:'0202',x:null,jump:'0'},{hex:'0302',x:null,jump:'0'},...['1','2','1','2'].map(x=>({hex:null,x,jump:'12'}))],'Original sequential world lookup order, duplicate occurrences, then exact radius-12 nearby requests');
 }
 assert.match(await page.locator('#rounding-input-note').textContent(),/Rounding[\s\S]*Credits round up to whole Credits; tons round up to whole tons\. Exact intermediate calculations and proportional cost allocations are retained\./);
 assert.equal(await page.locator('#modal-submit').textContent(),'Save route');
 for(const id of ['modal-close','modal-cancel','modal-submit'])assert.equal(await page.locator('#'+id).evaluate(node=>node.form===document.querySelector('#modal-form')),true);
 assert.equal(await page.locator('.route-draft').count(),scenario.entry==='map'?1:0);assert.deepEqual(await read(page),before);assert.equal((await gate(page)).totalCalls,0);assert.equal(S.jumpUndoEligibility(before).allowed,true);
 if(!scenario.map&&!scenario.nearby){await page.waitForFunction(()=>document.querySelector('#map-load-status')?.textContent==='');await frames(page);}
 if(scenario.nearby&&scenario.stage==='review'){await context.routeSaveNearbyNetwork.waitHeld();const parsed=await page.evaluate(()=>routeSaveNearbyResponses.length);context.routeSaveNearbyNetwork.release();await page.waitForFunction(n=>routeSaveNearbyResponses.length>n,parsed);await frames(page);}
 await page.evaluate(()=>document.activeElement?.blur());await frames(page);await page.evaluate(()=>routeSaveGate.remember());
 if(detailedSuccess(scenario)){await formWalk(page,result,'complete-accepted-review');await regionWalk(page,result,'long-world-and-entire-review','#modal-body');await detail(page,result,'complete-save-footer',['#modal-cancel','#modal-submit']);await strictLongNameGeometry(page,result);}
}
async function strictLongNameGeometry(page,result){
 const geometry=await page.locator('#modal-body').evaluate(body=>{const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),rect=body.getBoundingClientRect(),rows=[];let node;while(node=walker.nextNode()){if(!/ExtraordinarilyLongUnbroken/.test(node.textContent))continue;const range=document.createRange();range.selectNodeContents(node);rows.push({text:node.textContent,rects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,width:r.width,height:r.height})),parentWidth:node.parentElement.clientWidth,parentScrollWidth:node.parentElement.scrollWidth});}return {left:rect.left,right:rect.right,rows};});
 assert.ok(geometry.rows.length>=2,'Both accepted path and fuel warning include actual long names');for(const row of geometry.rows){assert.ok(row.parentScrollWidth<=row.parentWidth+2,'Long-name text parent has no horizontal overflow');for(const rect of row.rects)assert.ok(rect.left>=geometry.left-1&&rect.right<=geometry.right+1,'Every original unbroken-name text fragment is inside modal content width');}result.longNameGeometry=geometry;
}
async function submit(page,{native=false,duplicate=false}={}){
 if(native)return page.evaluate(duplicate=>{const g=routeSaveGate,form=document.querySelector('#modal-form');void g.oldSubmit({preventDefault(){},currentTarget:form});if(duplicate)void g.oldSubmit({preventDefault(){},currentTarget:form});return {writes:routeSaveStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent};},duplicate);
 await pointer(page,'#modal-submit',duplicate?2:1);
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();if(navigation)routeSaveGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 // Queue genuine delegated actions across their service-action await, then
 // synchronously claim final save. Later callbacks must not replace its owner.
 if(scenario.mode==='queued-pending')await page.evaluate(()=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['route-build',''],['deposit','']])routeSaveGate.dispatch(name,arg);void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});if(!routeSaveGate.pending)throw Error('Final route submit must synchronously reach the held provider before route-clear replay');routeSaveGate.dispatch('route-clear');});else await submit(page,{duplicate:true});
 await page.waitForFunction(()=>!!routeSaveGate.pending);await frames(page);assert.equal(await raw(page),bytes);assertRetained(await gate(page));
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen before provider entry');
 await replay(page);const snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(snapshot.storage.writes,0);assert.equal(await raw(page),bytes);assertRetained(snapshot);assert.equal(snapshot.semantic.dice,0);
 assert.deepEqual(snapshot.forwarded,[{argumentCount:3,tokenPresent:true,expectedRevision:before.revision,candidateRevision:before.revision+1}]);assertSaved(JSON.parse(snapshot.candidates[0]),before,scenario);
 if(scenario.mode==='deferred')await detail(page,result,'pending-before-write-controls',['#modal-cancel','#modal-submit']);
 result.checks.push('Native retained review, underlying route preview, Close/Cancel/Submit, Enter/Escape, duplicate/detached/queued events held before native write');
}
async function reloadUndo(page,result,before,scenario,{committed=true,undo=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>routeSaveStorage.writes),0);assert.equal(await page.evaluate(()=>typeof routeSaveGate),'undefined','Real reload has no provider instrumentation');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 const saved=await read(page);assertSaved(saved,before,scenario);assert.equal(await page.locator('.route-draft').count(),0);assert.deepEqual(await routeIds(page),savedRoute(before));
 if(detailedSuccess(scenario))await regionWalk(page,result,'real-reload-current-route','.planned-route');
 if(!undo)return;
 await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);const undone=await read(page),expectedUndo=S.undo(saved);expectedUndo.events.at(-1).id=undone.events.at(-1).id;assert.deepEqual(undone,expectedUndo,'Full actual History Undo equals original inverse');assert.deepEqual(material(undone),material(before));assert.equal(undone.revision,before.revision+2);assert.equal(await page.evaluate(()=>routeSaveStorage.writes),1);assert.equal(S.jumpUndoEligibility(undone).allowed,false);
 if(detailedSuccess(scenario)){await detail(page,result,'real-history-undo-status',['#message'],/^Latest action undone\.$/);await tab(page,'Overview');assert.deepEqual(await routeIds(page),before.route);await regionWalk(page,result,'real-undo-restored-route','.planned-route');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(page),undone);assert.deepEqual(await routeIds(page),before.route);await regionWalk(page,result,'undo-reload-restored-route','.planned-route');}
 result.checks.push('Genuine reload, full-state single-revision History Undo and permanently closed prior jump mulligan');
}
const routeIds=page=>page.locator('.route-list [data-action="world"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.arg));
async function successful(page,result,before,scenario){
 await closed(page);await frames(page);const saved=await read(page),snapshot=await gate(page);assertSaved(saved,before,scenario);assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.semantic.dice,0);assert.equal(await page.locator('#message').textContent(),successFor(scenario));assert.equal(await page.locator('.route-draft').count(),0);assert.deepEqual(await routeIds(page),savedRoute(before));
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);assert.ok(snapshot.readChecks.every(c=>c.exactDurableCopy&&!c.aliasesLive));for(const item of [...snapshot.observations,...snapshot.storage.observations])assert.equal(item.message,snapshot.baseline.message,'No success before provider settlement');
 const bytes=await raw(page),calls=snapshot.totalCalls;await page.evaluate(()=>{void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 result.economics={beforeSHA256:hash(JSON.stringify(before)),savedSHA256:hash(bytes),bank:saved.bank,hours:saved.hours,route:saved.route,routeIndex:saved.routeIndex,mandatoryStops:saved.mandatoryStops,shipSHA256:hash(JSON.stringify(saved.ship)),ledgerSHA256:hash(JSON.stringify(saved.ledger)),contractsSHA256:hash(JSON.stringify(saved.contracts)),policiesSHA256:hash(JSON.stringify(saved.policies)),auditSHA256:hash(JSON.stringify(saved.events)),undo:saved.undo.length};
 await detail(page,result,'saved-success-status',['#message'],successPattern);if(detailedSuccess(scenario))await regionWalk(page,result,'saved-current-route','.planned-route');result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
}
async function terminal(page,result,before,scenario,{committed,unknown=false,reportable=true}={}){
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#save-status').textContent));await frames(page);const snapshot=await gate(page),guidance=await page.locator('#save-status').textContent();assert.match(guidance,unknown?/save outcome could not be confirmed[\s\S]*Reload/:/saved, but the display could not update[\s\S]*Reload/);if(reportable&&scenario.mode!=='terminal-report')assert.equal(await page.locator('#message').textContent(),guidance);else if(!reportable)assert.equal(await page.locator('#message').textContent(),snapshot.baseline.message,'A natively closed owner has no authority to overwrite the old message');assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.equal(await page.locator('#takeover').isDisabled(),true);
 if(committed)assertSaved(await read(page),before,scenario);else assert.deepEqual(await read(page),before);
 if(await page.locator('#modal').evaluate(el=>el.open)){
  const controls=await page.evaluate(()=>['modal-close','modal-cancel','modal-submit'].map(id=>{const node=document.querySelector('#'+id);return {id,disabled:node.disabled,hidden:node.hidden,connected:node.isConnected};}));
  result.terminalDismissal={controls,requested:scenario.mode==='controls-close'?'modal-close':'modal-cancel',openBefore:true};
  assert.deepEqual(controls,[{id:'modal-close',disabled:false,hidden:false,connected:true},{id:'modal-cancel',disabled:false,hidden:false,connected:true},{id:'modal-submit',disabled:true,hidden:false,connected:true}],'Terminal Cancel and X must be genuinely enabled after one-shot setter failures; saved action remains disabled');
  assert.equal(await page.locator('#modal-error').textContent(),guidance);await regionWalk(page,result,'terminal-reload-warning','#modal-error');await detail(page,result,'terminal-dismissal-controls',['#modal-cancel','#modal-submit']);
  if(scenario.mode==='controls-close')await detail(page,result,'terminal-x-dismissal-control',['#modal-title','#modal-close']);
  await pointer(page,'#'+result.terminalDismissal.requested);await closed(page);result.terminalDismissal.openAfter=await page.locator('#modal').evaluate(node=>node.open);assert.equal(result.terminalDismissal.openAfter,false,'Actual physical terminal dismissal closes the production dialog');
 }else await detail(page,result,'terminal-reload-status',['#save-status']);
 const bytes=await raw(page);await replay(page,{physical:false,navigation:false});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true);await page.evaluate(()=>{routeSaveGate.store.yield();routeSaveGate.store.onChange(routeSaveGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal(await page.locator('#save-status').textContent(),guidance);if(!reportable){assert.equal(await page.locator('#message').textContent(),snapshot.baseline.message,'Late role/publication callbacks do not revive retired reporting authority');assert.equal(await page.locator('#modal').evaluate(node=>node.open),false);}result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario,{committed});
}
async function rememberNotes(page){await page.evaluate(()=>{const g=routeSaveGate;g.newer={title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent};g.newerSubmit=document.querySelector('#modal-form').onsubmit;g.newerClose=document.querySelector('#modal-cancel').onclick;});}
async function nativeClose(page){await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});await frames(page);}
async function retired(page,result,before,scenario,context){
 const mode=scenario.mode;if(mode==='foreign-same')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);if(mode==='foreign-new')await peerTakeover(page,result,context,{write:true});if(mode==='editor-regain')await peerTakeover(page,result,context,{regain:true});
 if(['native-close','new-dialog','retired-unknown-newer','newer-draft'].includes(mode)){await nativeClose(page);if(['new-dialog','retired-unknown-newer'].includes(mode)){await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);}else if(mode==='newer-draft'){await page.locator('#route-menu > summary').click();await action(page,'route-build').click();await action(page,'map-world','0,1').click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);await page.evaluate(()=>{routeSaveGate.newDraftNode=document.querySelector('.route-draft');routeSaveGate.newDraftHTML=routeSaveGate.newDraftNode.outerHTML;routeSaveGate.newRouteHTML=document.querySelector('.planned-route').outerHTML;});}}
 const authoritative=await raw(page);await release(page,mode==='retired-unknown-newer'?'unknown-before':'native');await frames(page);let snapshot=await gate(page);
 if(mode==='foreign-new'){assert.equal(await raw(page),authoritative);assert.equal((await read(page)).bank,String(BigInt(before.bank)+7n));assert.equal(snapshot.settlements.at(-1).code,'SAVE_NOT_COMMITTED');assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);result.gate=safeReport(snapshot);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),authoritative);return;}
 if(mode==='retired-unknown-newer')assert.deepEqual(await read(page),before);else assertSaved(await read(page),before,scenario);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 if(['new-dialog','retired-unknown-newer'].includes(mode)){assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);await detail(page,result,'newer-notes-retained',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);await regionWalk(page,result,'newer-owner-global-reload','#save-status');result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario,{committed:mode!=='retired-unknown-newer'});}
 if(mode==='newer-draft'){assert.equal(await page.evaluate(()=>document.querySelector('.route-draft')===routeSaveGate.newDraftNode),true);assert.equal(await page.locator('.route-draft').evaluate(node=>node.outerHTML),await page.evaluate(()=>routeSaveGate.newDraftHTML),'Old settlement cannot replace or clear a newer route draft');assert.equal(await page.locator('.planned-route').evaluate(node=>node.outerHTML),await page.evaluate(()=>routeSaveGate.newRouteHTML));await regionWalk(page,result,'newer-route-preview-retained','.route-draft');result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario);}
 if(mode==='native-close')assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);await terminal(page,result,before,scenario,{committed:true,reportable:mode!=='native-close'});
}
// Complete target-range evidence, even when a range is taller than a viewport.
// Full-size frames walk the real scroll container; no cropping/restyling/resizing.
async function regionWalk(page,result,label,selector){
 const target=await page.locator(selector).boundingBox();assert.ok(target);if(target.height<result.viewport.height-100)return detail(page,result,label,[selector]);
 const saved=await page.evaluate(()=>({x:scrollX,y:scrollY,dialog:document.querySelector('#modal').scrollTop}));const bounds=[];let handle;
 try{
  handle=await page.evaluateHandle(selector=>{const node=document.querySelector(selector);let container=node.parentElement;while(container&&container!==document.body){if(/auto|scroll|overlay/.test(getComputedStyle(container).overflowY)&&container.scrollHeight>container.clientHeight)break;container=container.parentElement;}return {node,container:container===document.body?null:container,top:container?.scrollTop??scrollY};},selector);
  const info=await handle.evaluate(({node,container})=>{const r=node.getBoundingClientRect(),top=container?container.getBoundingClientRect().top+container.clientTop:0,height=container?container.clientHeight:innerHeight;return {height,total:r.height,start:(container?.scrollTop??scrollY)+r.top-top};});
  const step=Math.max(1,info.height-90),positions=[];for(let y=0;y<Math.max(0,info.total-info.height);y+=step)positions.push(y);positions.push(Math.max(0,info.total-info.height));
  for(const[index,offset]of positions.entries()){await handle.evaluate(({container},top)=>{if(container)container.scrollTop=top;else scrollTo({top,behavior:'instant'});},info.start+offset);await frames(page);const b=await page.locator(selector).evaluate(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:innerHeight,width:innerWidth};});bounds.push({offset,...b});assert.ok(b.left>=-1&&b.right<=b.width+1,'Complete target width');await capture(page,result,label+'-'+(index+1));}
  assert.ok(bounds[0].top>=-1&&bounds[0].top<bounds[0].height);assert.ok(bounds.at(-1).bottom<=bounds.at(-1).height+1);for(let i=1;i<bounds.length;i++)assert.ok(bounds[i].offset-bounds[i-1].offset<=info.height-50);(result.rangeWalks??=[]).push({label,selector,info,bounds});
 }finally{if(handle)await handle.evaluate(({container,top})=>{if(container)container.scrollTop=top;});await page.evaluate(saved=>{document.querySelector('#modal').scrollTop=saved.dialog;scrollTo(saved.x,saved.y);},saved);await handle?.dispose();}
}
async function initialLookup(page,result,scenario,context,before,bytes){
 await openInitialPlot(page,context);
 await page.evaluate(()=>{routeSaveGate.initialSubmit=document.querySelector('#modal-form').onsubmit;routeSaveGate.initialBody=document.querySelector('#modal-body');});
 await pointer(page,'#modal-submit');const held=await context.routeSaveLookupNetwork.waitHeld();
 assert.equal(held.released,false);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);
 for(const id of ['modal-close','modal-cancel'])assert.equal(await page.locator('#'+id).isEnabled(),true,'Initial route calculation remains cancellable');
 const requests=structuredClone(result.lookupRequests),recents=await page.evaluate(()=>localStorage.getItem('traveller-trade-route-calculator:recent-worlds:v1'));
 assert.deepEqual(requests.map(({hex,x,jump})=>({hex,x,jump})),scenario.lookup==='world'?[{hex:'0302',x:null,jump:'0'}]:[{hex:'0302',x:null,jump:'0'},{hex:'0202',x:null,jump:'0'},{hex:'0302',x:null,jump:'0'},{hex:null,x:'1',jump:'12'}]);
 if(result.persistEvidence){await detail(page,result,'initial-lookup-cancellable',['#modal-cancel','#modal-submit']);}
 if(scenario.retirement==='cancel')await pointer(page,'#modal-cancel');
 else if(scenario.retirement==='escape')await page.keyboard.press('Escape');
 else if(scenario.retirement==='replacement'){await nativeClose(page);await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);}
 else if(scenario.retirement==='foreign')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
 else if(scenario.retirement==='editor')await peerTakeover(page,result,context,{regain:true});
 else if(scenario.retirement==='selection')await page.locator('#route-destination select[aria-label="World"]').selectOption('0102');
 else if(['picker-host','picker-control','row-remove','destination-host','destination-control'].includes(scenario.retirement)){
  const mutation=await page.evaluate(kind=>{
   const selectors={'picker-host':'#route-stops .world-picker','picker-control':'#route-stops select[aria-label="World"]','row-remove':'#route-stops .route-stop','destination-host':'#route-destination','destination-control':'#route-destination select[aria-label="World"]'},node=document.querySelector(selectors[kind]);
   if(!node)throw Error('Missing original initial picker target '+kind);
   const values=target=>[...(target.matches('input,select,textarea')?[target]:target.querySelectorAll('input,select,textarea'))].map(n=>({name:n.name,label:n.getAttribute('aria-label'),value:n.value,checked:n.checked??null}));
   const oldValues=values(node),parents=['route-stops','route-destination'].map(id=>document.getElementById(id));
   routeSaveGate.retiredPickerNode=node;
   if(kind==='row-remove'){node.remove();return {kind,detached:!node.isConnected,oldValues,retainedTopLevel:parents.every(n=>n.isConnected&&document.getElementById(n.id)===n)};}
   const replacement=node.cloneNode(true),controls=replacement.matches('input,select,textarea')?[replacement]:[...replacement.querySelectorAll('input,select,textarea')];controls.forEach((n,i)=>{n.value=oldValues[i].value;if(oldValues[i].checked!==null)n.checked=oldValues[i].checked;});
   node.replaceWith(replacement);routeSaveGate.replacementPickerNode=replacement;
   return {kind,detached:!node.isConnected,connected:replacement.isConnected,identityChanged:replacement!==node,oldValues,newValues:values(replacement),sameMarkup:node.outerHTML===replacement.outerHTML,retainedTopLevel:parents.filter(n=>n!==node).every(n=>n.isConnected&&document.getElementById(n.id)===n),retainedId:!node.id||document.getElementById(node.id)===replacement};
  },scenario.retirement);
  assert.equal(mutation.detached,true);assert.equal(mutation.retainedTopLevel,true);if(scenario.retirement!=='row-remove'){assert.equal(mutation.connected,true);assert.equal(mutation.identityChanged,true);assert.equal(mutation.sameMarkup,true);assert.equal(mutation.retainedId,true);assert.deepEqual(mutation.newValues,mutation.oldValues,'Initial picker replacement preserves every value and checked field; only identity changes');}result.pickerIdentityMutation=mutation;
 }

 const parsed=await page.evaluate(()=>({world:routeSaveLookupResponses.length,nearby:routeSaveNearbyResponses.length}));
 const presentation=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,open:document.querySelector('#modal').open}));
 context.routeSaveLookupNetwork.release();
 await page.waitForFunction(({parsed,lookup})=>lookup==='world'?routeSaveLookupResponses.length>parsed.world:routeSaveNearbyResponses.length>parsed.nearby,{parsed,lookup:scenario.lookup});await frames(page);
 if(scenario.retirement!=='selection'){await page.evaluate(()=>{void routeSaveGate.initialSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);}
 assert.deepEqual(result.lookupRequests,requests,'Retired calculation performs no later world or nearby query');assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-trade-route-calculator:recent-worlds:v1')),recents,'Late world lookup cannot write recent-world preference');
 assert.notEqual(await page.locator('#modal-title').textContent(),'Review route','Retired lookup cannot construct accepted review');
 if(['cancel','escape','replacement'].includes(scenario.retirement))assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,open:document.querySelector('#modal').open})),presentation,'Late calculation preserves closed or newer owner exactly');
 if(result.persistEvidence)await regionWalk(page,result,'initial-lookup-retired',scenario.retirement==='replacement'?'#modal-body .notes-list article:first-child':'.planned-route');
 if(scenario.retirement==='replacement')await verifyNewerNotes(page,result);else if(await page.locator('#modal').evaluate(node=>node.open))await pointer(page,'#modal-cancel');
 await closed(page);
 // Save a fresh genuine map review only as far as its held provider. Its world
 // merge exposes any wrongly retained late lookup without exposing app internals.
 await page.locator('#route-menu > summary').click();await action(page,'route-build').click();await action(page,'map-world','2,1').click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);await action(page,'route-save').click();
 await page.evaluate(()=>{routeSaveGate.remember();routeSaveGate.armed=true;void routeSaveGate.initialSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});assert.equal((await gate(page)).totalCalls,0);await pointer(page,'#modal-submit');await page.waitForFunction(()=>!!routeSaveGate.pending);
 assert.equal(JSON.parse((await gate(page)).candidates.at(-1)).worlds['3,1'],undefined,'Retired lookup cannot enrich the known-world catalogue used by a newer accepted save');
 await release(page,'known-before');await page.locator('#modal-error').filter({hasText:'Synthetic known routeSave prewrite'}).waitFor();await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);
 result.checks.push('Real '+scenario.lookup+' response retired by '+scenario.retirement+' preserves sequential boundary, cancellation, newer presentation, recents and next-save world merge');result.gate=safeReport(await gate(page));
}
async function initialForeignTarget(page,result,scenario,context,before,bytes){
 await openInitialPlot(page,context);
 const snapshot=await page.evaluate(async()=>{
  const g=routeSaveGate,form=document.querySelector('#modal-form'),handler=form.onsubmit,before=g.initialNormalizations,body=document.querySelector('#modal-body').innerHTML,submit=document.querySelector('#modal-submit');g.initialSubmit=handler;
  await handler({preventDefault(){},currentTarget:form.cloneNode(true)});
  return {normalizations:g.initialNormalizations-before,sameHandler:form.onsubmit===handler,sameBody:document.querySelector('#modal-body').innerHTML===body,submitDisabled:submit.disabled,open:document.querySelector('#modal').open};
 });await frames(page);
 assert.deepEqual(snapshot,{normalizations:0,sameHandler:true,sameBody:true,submitDisabled:false,open:true},'Foreign initial currentTarget is rejected before native FormData normalization and pending control changes');
 assert.deepEqual(result.lookupRequests,[],'Foreign initial currentTarget cannot start any world/nearby requests');assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
 await pointer(page,'#modal-cancel');await closed(page);await page.evaluate(()=>{void routeSaveGate.initialSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.deepEqual(result.lookupRequests,[]);assert.equal(await raw(page),bytes);
 result.initialForeignTarget=snapshot;result.checks.push('Actual initial Plot handler rejects cloned currentTarget before FormData normalization, UI pending state, or first lookup');result.gate=safeReport(await gate(page));
}
async function initialCloseNewerNotes(page,result,scenario,context,before,bytes){
 await openInitialPlot(page,context);await page.evaluate(()=>{routeSaveGate.initialSubmit=document.querySelector('#modal-form').onsubmit;routeSaveGate.initialCloseReentry='ordinary';});
 await pointer(page,'#modal-cancel');await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await frames(page);
 const replay=await page.evaluate(async()=>{const g=routeSaveGate,n=g.initialNormalizations;await g.initialSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});return {normalizations:g.initialNormalizations-n,title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent,expected:g.newer,observation:g.initialReentryObservation};});
 assert.equal(replay.normalizations,0);assert.equal(replay.title,replay.expected.title);assert.equal(replay.body,replay.expected.body);assert.equal(replay.error,replay.expected.error);assert.deepEqual(replay.observation,{point:'ordinary',title:'Rules & Notes',open:true,submitHidden:true,submitCallable:true,closeCallable:true});assert.deepEqual(result.lookupRequests,[]);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
 await verifyNewerNotes(page,result);await openInitialPlot(page,context);await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);assert.deepEqual(result.lookupRequests,[]);result.initialCloseReentry=replay;result.checks.push('Real initial Cancel native close can open newer Notes synchronously; old cleanup and retained initial handler preserve its contents and actual handlers');result.gate=safeReport(await gate(page));
}
async function initialConstruction(page,result,scenario,context,before,bytes){
 // Seed a real older modal handler so the partial-construction test challenges
 // stale callbacks without creating an artificial bare HTML form navigation.
 await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await pointer(page,'#modal-cancel');await closed(page);
 await tab(page,'Settings');await page.locator('#settings-form').waitFor();
 await page.evaluate(({fault,bodyCleanupFault,closeReentry})=>{const g=routeSaveGate;g.retainedSettings=document.querySelector('#settings-form');g.retainedSettingsSubmit=g.retainedSettings.onsubmit;g.retainedSettingsValues=[...g.retainedSettings.querySelectorAll('input,select,textarea')].map(n=>({name:n.name,value:n.value,checked:n.checked??null}));g.initialFault=fault;g.initialBodyCleanupFault=!!bodyCleanupFault;g.initialCloseReentry=closeReentry?'construction':null;},scenario);
 context.routeSaveLookupNetwork.arm();await page.evaluate(()=>routeSaveGate.dispatch('route'));
 if(scenario.closeReentry){
  await page.waitForFunction(()=>routeSaveGate.faults.includes('initial-close-newer-construction')&&document.querySelector('#modal').open&&document.querySelector('#modal-title').textContent==='Rules & Notes');await frames(page);
  const replay=await page.evaluate(async()=>{const g=routeSaveGate,normalizations=g.initialNormalizations;if(g.partialSubmit)await g.partialSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});return {normalizations:g.initialNormalizations-normalizations,title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent,sameSubmit:document.querySelector('#modal-form').onsubmit===g.newerSubmit,sameClose:document.querySelector('#modal-cancel').onclick===g.newerClose,expected:g.newer};});
  assert.equal(replay.normalizations,0);assert.equal(replay.title,replay.expected.title);assert.equal(replay.body,replay.expected.body);assert.equal(replay.error,replay.expected.error);assert.equal(replay.sameSubmit,true);assert.equal(replay.sameClose,true);assert.deepEqual(result.lookupRequests,[]);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);result.initialCloseReentry={replay,observation:await page.evaluate(()=>routeSaveGate.initialReentryObservation)};
  await verifyNewerNotes(page,result);
 }else{await page.waitForFunction(fault=>routeSaveGate.faults.includes(fault)&&document.querySelector('#message').textContent.includes('Synthetic initial Plot construction '+fault),scenario.fault);await frames(page);}
 if(scenario.bodyCleanupFault){const observed=await page.evaluate(()=>({faults:routeSaveGate.faults,observation:routeSaveGate.closedCleanupObservation}));assert.deepEqual(observed.faults,['first-picker','closed-body-cleanup']);assert.deepEqual(observed.observation,{open:false,settingsConnected:false,partialBodyPresent:true},'Actual close succeeds before one-shot body clear failure while Settings is still suspended');result.closedCleanupFailure=observed;}

 const restoration=await page.evaluate(()=>{const g=routeSaveGate,form=document.querySelector('#settings-form');return {open:document.querySelector('#modal').open,restored:form===g.retainedSettings,connected:g.retainedSettings.isConnected,sameHandler:form?.onsubmit===g.retainedSettingsSubmit,values:form?[...form.querySelectorAll('input,select,textarea')].map(n=>({name:n.name,value:n.value,checked:n.checked??null})):null,before:g.retainedSettingsValues};});
 assert.equal(restoration.open,false,'Partially built initial Plot dialog is retired');assert.equal(restoration.restored,true,'Actual suspended Settings form identity is restored');assert.equal(restoration.connected,true);assert.equal(restoration.sameHandler,true);assert.deepEqual(restoration.values,restoration.before);assert.deepEqual(result.lookupRequests,[]);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
 const replay=await page.evaluate(async()=>{const g=routeSaveGate,n=g.initialNormalizations,form=document.querySelector('#modal-form');if(g.partialSubmit)await g.partialSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();return {normalizations:g.initialNormalizations-n,formRestored:document.querySelector('#settings-form')===g.retainedSettings};});await frames(page);assert.deepEqual(replay,{normalizations:0,formRestored:true});assert.deepEqual(result.lookupRequests,[]);assert.equal(await raw(page),bytes);
 // The one-shot presentation fault must not poison a genuine new initial owner.
 await tab(page,'Overview');await openInitialPlot(page,context);assert.equal(await page.locator('#modal-submit').isEnabled(),true);await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);assert.deepEqual(result.lookupRequests,[]);
 result.initialConstruction={fault:scenario.fault,restoration,replay};result.checks.push('Actual '+scenario.fault+' exception retires partial Plot, restores suspended Settings identity/values/handler, blocks retained submit and permits fresh reopen');result.gate=safeReport(await gate(page));
}
async function assertStrict(page,label){const snapshot=await gate(page);assert.deepEqual((await page.evaluate(label=>routeSaveGate.mapCapture(label),label)).regions,snapshot.mapBaseline.regions,label+': exact main, route preview, map SVG, form, summary and statuses');assert.equal(snapshot.mutationCount,0,label+': no transient mutations');for(const edge of snapshot.paintEdges)assert.deepEqual(edge.regions,snapshot.mapBaseline.regions,label+': actual callback edge');}
async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>routeSaveStorage.writes),0,'Fixture requires no migration write');await installGate(page,result);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(!scenario.map)await page.waitForFunction(()=>routeSaveMapCallbacks.cacheCompleted>0&&routeSaveMapCallbacks.scheduled===routeSaveMapCallbacks.executed&&document.querySelector('#map-load-status')?.textContent==='');
 if(mode==='initial-lookup')return initialLookup(page,result,scenario,context,before,bytes);
 if(mode==='initial-foreign-current-target')return initialForeignTarget(page,result,scenario,context,before,bytes);
 if(mode==='initial-construction')return initialConstruction(page,result,scenario,context,before,bytes);
 if(mode==='initial-close-newer-notes')return initialCloseNewerNotes(page,result,scenario,context,before,bytes);
 await prepare(page,result,scenario,before,context);
 if(mode==='cancel-review'){
  await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(await page.locator('.route-draft').count(),scenario.entry==='map'?1:0);assert.deepEqual(await routeIds(page),scenario.entry==='map'?pathFor(before):before.route);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,true);await regionWalk(page,result,'cancel-retains-original-preview',scenario.entry==='map'?'.route-draft':'.planned-route');result.gate=safeReport(await gate(page));return;
 }
 if(mode==='preclaim-replacement'){
  await nativeClose(page);await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);const replacement=await page.locator('#modal-body').innerHTML();await page.evaluate(()=>{void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(await page.locator('#modal-body').innerHTML(),replacement);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));return;
 }
 if(mode==='moved-form'){await page.evaluate(()=>{const form=document.querySelector('#modal-form');routeSaveGate.originalParent=form.parentNode;document.body.append(form);void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:form});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await page.evaluate(()=>routeSaveGate.originalParent.append(document.querySelector('#modal-form')));result.gate=safeReport(await gate(page));return;}
 if(mode==='read-only'){await peerTakeover(page,result,context);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await regionWalk(page,result,'read-only-warning','#modal-error');await detail(page,result,'read-only-dismissal-controls',['#modal-cancel','#modal-submit']);await pointer(page,'#modal-cancel');await closed(page);result.gate=safeReport(await gate(page));return;}
 if(mode==='foreign-form'){await page.evaluate(()=>{const form=document.querySelector('#modal-form').cloneNode(true);void routeSaveGate.oldSubmit({preventDefault(){},currentTarget:form});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form'].includes(mode)){
  const immediate=await page.evaluate(({mode,success})=>{const g=routeSaveGate;g.reentrant=mode==='reentrant';if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['route-build',''],['deposit','']])g.dispatch(name,arg);const form=document.querySelector('#modal-form');void g.oldSubmit({preventDefault(){},currentTarget:form});void g.oldSubmit({preventDefault(){},currentTarget:form});g.nativeFirstMicrotask=Promise.resolve().then(()=>({writes:routeSaveStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent}));return {writes:routeSaveStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent};},{mode,success:successFor(scenario)});assert.equal(immediate.writes,1,'Real native Store writes in the original submit stack');assert.equal(immediate.open,true,'Original close remains in its microtask continuation');assert.equal(immediate.message,successFor(scenario),'Native saved announcement remains synchronous');const firstMicrotask=await page.evaluate(()=>routeSaveGate.nativeFirstMicrotask);assert.deepEqual(firstMicrotask,{writes:1,open:false,message:successFor(scenario)},'Original close completes in its first microtask, without a deferred native write');result.nativeTiming={sameStack:immediate,firstMicrotask};await frames(page);assert.equal((await gate(page)).totalCalls,1);return successful(page,result,before,scenario);
 }
 await page.evaluate(mode=>{const g=routeSaveGate;g.armed=true;g.notifyFault=mode==='notification-before'?'before':['notification-after','controls','controls-close'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token'].includes(mode)?mode:null;routeSaveStorage.failNext=['retry','recovery-reentry'].includes(mode);g.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map)return mapPublication(page,result,scenario,before,context);
 if(mode==='nearby'){
  await page.evaluate(()=>routeSaveGate.beginStrict());await page.evaluate(()=>routeSaveGate.write());await frames(page);assertSaved(await read(page),before,scenario);
  if(scenario.stage==='publication'){await context.routeSaveNearbyNetwork.waitHeld();const parsed=await page.evaluate(()=>routeSaveNearbyResponses.length);context.routeSaveNearbyNetwork.release();await page.waitForFunction(n=>routeSaveNearbyResponses.length>n,parsed);await frames(page);}
  await assertStrict(page,'actual refreshNearby continuation');await page.evaluate(()=>routeSaveGate.endStrict());await release(page);
  if(scenario.stage==='after-settlement'){await closed(page);const message=await page.locator('#message').textContent();assert.match(message,successPattern);const parsed=await page.evaluate(()=>routeSaveNearbyResponses.length);context.routeSaveNearbyNetwork.release();await page.waitForFunction(n=>routeSaveNearbyResponses.length>n,parsed);await frames(page);assert.equal(await page.locator('#message').textContent(),message,'Old failed nearby request cannot overwrite settled success');}
  return successful(page,result,before,scenario);
 }
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','retired-unknown-newer','newer-draft','consumed-token'].includes(mode))return retired(page,result,before,scenario,context);
 if(['disk-same','disk-unreadable','published-disk-drift','published-disk-unreadable'].includes(mode)){
  const published=mode.startsWith('published-');if(published){await page.evaluate(()=>routeSaveGate.write());await frames(page);assertSaved(await read(page),before,scenario);}
  if(mode==='disk-same'||mode==='published-disk-drift')await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key));value.bank=String(BigInt(value.bank)+7n);localStorage.setItem(key,JSON.stringify(value));},KEY);else await page.evaluate(()=>{routeSaveGate.readFault=true;});const authoritative=await raw(page);await release(page,published?'native':'known-before');await page.waitForFunction(()=>routeSaveGate.store.reloadRequired);await frames(page);assert.equal(await raw(page),authoritative);assert.equal((await gate(page)).totalCalls,1);assert.equal((await gate(page)).editable,false);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await regionWalk(page,result,published?'saved-durable-settlement-reload':'unwritten-durable-baseline-reload','#modal-error');await page.evaluate(()=>{routeSaveGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),authoritative);return;
 }
 if(['retry','recovery-reentry'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known routeSave prewrite'}).waitFor();const snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);if(mode==='recovery-reentry')assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);await regionWalk(page,result,'known-unsaved-retry-warning','#modal-error');await detail(page,result,'known-unsaved-retry-controls',['#modal-cancel','#modal-submit']);
  await submit(page,{native:true});await page.waitForFunction(()=>!!routeSaveGate.pending);const retry=await gate(page);assert.equal(retry.calls,2);assertSaved(JSON.parse(retry.candidates[1]),before,scenario);assertRetained(retry);await release(page);return successful(page,result,before,scenario);
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{routeSaveGate.beginStrict();routeSaveGate.write();});await frames(page);assertSaved(await read(page),before,scenario);assertRetained(await gate(page));await replay(page);assertRetained(await gate(page));await assertStrict(page,'owned native publication awaiting settlement');if(mode==='deferred')await detail(page,result,'durable-publication-held-controls',['#modal-cancel','#modal-submit']);await page.evaluate(()=>routeSaveGate.endStrict());await release(page);return successful(page,result,before,scenario);
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','controls-close','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{routeSaveGate.cleanupFault=mode;},mode);
 await release(page,['unknown-before','unknown-after','contradictory','fulfilled-no-publication'].includes(mode)?mode:mode==='terminal-report'?'unknown-before':'native');
 if(mode==='reentrant-close'){await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.deepEqual(snapshot.faults,['reentrant-close']);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);await detail(page,result,'newer-notes-during-close',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario);}
 if(mode==='wrong-candidate'){
  await frames(page);const snapshot=await gate(page),delivered=snapshot.publications.filter(entry=>entry.tokenMatches&&entry.actualCallback);assert.equal(delivered.length,1);assert.equal(delivered[0].deliveredTokenMatches,true);assert.equal(delivered[0].deliveredRevision,before.revision+1);assert.equal(delivered[0].deliveredSnapshotMatches,false,'The authenticated callback deliberately delivers a different candidate');assert.equal(snapshot.storage.writes,1);assertSaved(await read(page),before,scenario);result.alteredPublication=delivered[0];
 }
 await terminal(page,result,before,scenario,{committed:!['unknown-before','fulfilled-no-publication','terminal-report'].includes(mode),unknown:['unknown-before','fulfilled-no-publication','terminal-report','missing','missing-token','wrong-token','wrong-revision'].includes(mode)});if(cleanup)assert.deepEqual(result.gate.faults,[mode]);
}
function evidenceTargets(s){
 if(!persistsEvidence(s))return [];
 if(s.mode==='native')return ['complete-accepted-review','long-world-and-entire-review','complete-save-footer','saved-success-status','saved-current-route','real-reload-current-route','real-history-undo-status','real-undo-restored-route','undo-reload-restored-route'];
 if(s.mode==='deferred')return ['pending-before-write-controls','durable-publication-held-controls','saved-success-status'];
 if(s.mode==='retry')return ['known-unsaved-retry-warning','known-unsaved-retry-controls','saved-success-status'];
 if(['unknown-before','unknown-after'].includes(s.mode))return ['terminal-reload-warning','terminal-dismissal-controls'];
 if(s.mode==='controls-close')return ['terminal-reload-warning','terminal-dismissal-controls','terminal-x-dismissal-control'];
 if(s.mode==='read-only')return ['read-only-warning','read-only-dismissal-controls'];
 if(s.mode==='cancel-review')return ['cancel-retains-original-preview'];
 if(s.mode==='map-owned')return ['map-publication-held-controls','saved-success-status'];
 if(s.mode==='map-foreign')return ['map-publication-held-controls','terminal-reload-warning','terminal-dismissal-controls'];
 if(s.mode==='new-dialog')return ['newer-notes-retained','newer-owner-global-reload'];
 if(s.mode==='newer-draft')return ['newer-route-preview-retained'];
 if(s.mode==='initial-lookup')return ['initial-lookup-cancellable','initial-lookup-retired'];
 return [];
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,mode:scenario.mode,entry:scenario.entry,viewport,status:'running',persistEvidence:persistsEvidence(scenario),evidenceTargets:evidenceTargets(scenario),checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result,scenario);const page=await context.newPage();await runBody(page,result,scenario,context);await frames(page);for(const key of ['pageErrors','unhandledRejections','consoleErrors','networkErrors','unexpectedRequests'])assert.deepEqual(result[key],[],key);assert.equal(result.screenshots.length>0,result.persistEvidence);for(const target of result.evidenceTargets)assert.ok(result.layouts.some(layout=>layout.label===target||layout.label.startsWith(target+'-')),'Declared evidence target: '+target);result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(e=>result.errors.push('Diagnostic capture: '+errorText(e)));result.failedGate=await gate(page).then(safeReport).catch(()=>null);}}
 finally{context?.routeSaveNetwork?.cleanup();context?.routeSaveNearbyNetwork?.cleanup();context?.routeSaveLookupNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
// Safe documented local branch. Static imports are native data/helpers only.
// Every path here completes before dependency resolution or Chromium launch.
if(process.argv.includes('--fixtures-only')){
 await assertReleasedEconomics();const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));assert.deepEqual(fixture(),fixture(),'Wholly synthetic fixture has deterministic complete bytes');for(const scenario of scenarios){const before=fixture(),saved=expected(before,scenario);assert.deepEqual(planRoute(before.worlds,[before.actual,...stopsFor(before)],before.ship,core),pathFor(before));assert.deepEqual(pathFor(before).slice(1).map((id,i)=>routeDistance(before.worlds[pathFor(before)[i]],before.worlds[id])),[1,1,1]);assertSaved(saved,before,scenario);S.validate(saved);const undone=S.undo(saved);assert.equal(S.jumpUndoEligibility(undone).allowed,false);}
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.match(app,/function saveMapRoute\(/);assert.match(app,/function plotRoute\(/);const modal=html.match(/<form id="modal-form">([\s\S]*?)<\/form>/)?.[1];for(const id of ['modal-close','modal-cancel','modal-submit'])assert.ok(modal.includes('id="'+id+'"'),'Production '+id+' is inside form');assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');
 const plan={releasedEconomics,suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,limits:report.limits,encoding:screenshotOptions,declaredEvidenceCases:cases.filter(c=>persistsEvidence(c.scenario)).length,declaredFrameGroups:cases.reduce((n,c)=>n+evidenceTargets(c.scenario).length,0),viewportWalkRule:'Complete original-resolution full viewport images; walk entire real modal and every too-tall target range with at least 50 px overlap. Target geometry and coverage retained. No crop, restyle, reduced viewport or unsupported inspection flag.',scope:report.scope,sourceChecks:['Exact tagged app/controller/Store source hashes against clean requested head','Pinned released label-neutral economics and original travelled-prefix/path/stops/world-merge mutations','Full campaign/economics/audit/inverse/reload/Undo with two generated transition IDs aligned only','All production Close/Cancel/Submit buttons are inside modal-form','Real sequential plot world/radius-12 requests, refreshNearby and MapAreaCache/ResizeObserver callbacks','Pending review and underlying Route preview full DOM/SVG/status equality and node identity','Native same-stack saved announcement and original microtask close','20 MiB images, 24 MiB artifact, standard 14-minute suite budget'],scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,mode:scenario.mode,viewport,evidence:persistsEvidence(scenario)?'original-resolution representative frames':'full semantic assertions and geometry; diagnostic frame on failure',evidenceTargets:evidenceTargets(scenario)})),execution:'Fixture/source validation only. Chromium was NOT required or launched; this is NOT browser evidence.'};
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify(plan,null,2));else console.log(`PASS: Planned route save original full-state/economic/route/audit/Undo/mulligan fixtures and tagged source wiring. ${scenarios.length} scenarios / ${cases.length} declared browser cases. Chromium was NOT required or launched; this is NOT browser evidence.`);
}else{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual Planned route save browser runs only in exact-head GitHub CI; locally use documented --fixtures-only');
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT');assert.equal(report.testedCommit,report.requestedCommit);report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires clean exact head');report.testedTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();report.releasedEconomics=await assertReleasedEconomics();
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','campaign-controller.mjs','persistence.mjs','state.mjs','map.mjs','world-picker.mjs','map-viewport.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const {scenario,viewport} of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.cases.reduce((n,r)=>n+r.screenshots.length,0));report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'Bounded 24 MiB evidence');assert.ok(imageBytes<report.limits.imageBytes,'Bounded 20 MiB images');
 }catch(error){report.errors.push(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(r=>r.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Planned Route Save completion Chromium checks failed; see verification-artifacts/route-save-completion-report.json');console.log(`PASS: ${report.declaredCases} exact-head Planned Route Save completion cases with real locks and bounded complete desktop/mobile evidence.`);
}
