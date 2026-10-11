// Exact-head Stage 2 Clear Planned Route browser gate. Production tagged app,
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
import {normalize as normalizeWorld} from '../js/map.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const cliFlags=process.argv.slice(2).filter(arg=>arg.startsWith('--'));
for(const flag of cliFlags)assert.ok(['--fixtures-only','--plan-json'].includes(flag),'Unsupported flag: '+flag);
assert.ok(!cliFlags.includes('--plan-json')||cliFlags.includes('--fixtures-only'),'--plan-json requires --fixtures-only');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='clear-route-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const modes=['native','deferred','retry','recovery-reentry','unknown-before','unknown-after','contradictory','fulfilled-no-publication','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token','foreign-same','foreign-new','editor-regain','read-only','native-close','new-dialog','retired-unknown-newer','newer-draft','disk-same','disk-unreadable','published-disk-drift','published-disk-unreadable','queued-pending','queued-settled','reentrant','foreign-form','moved-form','render','report','terminal-report','close-before','close-after','clear-error','controls','controls-close','reentrant-close','cancel-review','preclaim-replacement'];
const dual=new Set(['native','deferred','retry','unknown-before','unknown-after','new-dialog','newer-draft','read-only','cancel-review','controls','controls-close','preclaim-replacement']);
const scenarios=modes.map(mode=>({id:mode,mode,dual:dual.has(mode)}));
for(const mode of ['map-owned','map-foreign'])scenarios.push({id:mode,mode,map:true,dual:true});
for(const lookup of ['hex','auto'])for(const stage of ['review','prewrite','publication','cancel','retry'])scenarios.push({id:lookup+'-'+stage,mode:'lookup',lookup,stage,dual:stage==='publication'||stage==='cancel'});
for(const stage of ['review','publication'])scenarios.push({id:'nearby-'+stage,mode:'nearby',nearby:true,stage,dual:stage==='publication'});
for(const lookup of ['hex','auto']){scenarios.push({id:lookup+'-reopened',mode:'lookup',lookup,stage:'reopened',dual:true});scenarios.push({id:lookup+'-rejected-publication',mode:'lookup',lookup,stage:'publication',reject:true});}
for(const stage of ['publication','after-settlement','control'])scenarios.push({id:'nearby-rejected-'+stage,mode:'nearby',nearby:true,reject:true,stage,dual:stage==='publication'});
const cases=scenarios.flatMap(scenario=>sizes.filter(viewport=>viewport.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
const screenshotOptions=Object.freeze({type:'jpeg',quality:65,caret:'initial'});
const successPattern=/^Cleared planned route saved\.$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>clearRouteGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>clearRouteGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const detailedSuccess=scenario=>scenario.mode==='native';
const nearbyAPIWorld={Name:'Retained nearby catalogue addition',WorldX:3,WorldY:1,Sector:'Synthetic',Hex:'0402',UWP:'A788879-C',PBG:'703',Zone:''};
function persistsEvidence(s){return ['native','deferred','retry','unknown-before','unknown-after','new-dialog','newer-draft','read-only','cancel-review','map-owned','map-foreign','retired-unknown-newer','render','reentrant-close','controls','controls-close'].includes(s.mode)||s.mode==='lookup'&&!s.reject&&['publication','cancel','reopened'].includes(s.stage)||s.mode==='nearby'&&!s.reject&&s.stage==='publication';}
const report={suite:'Clear Planned Route save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Only Clear Planned Route completion. Exact original route mutation, retained campaign economics/Undo/permanent mulligan closure; native same-stack saved write and original microtask close; delayed native write/publication/settlement, provenance/retry/terminal/reload and owner faults; real pending hex/auto-route/nearby/cache/ResizeObserver callbacks, exact retained production review and underlying route preview, newer Notes/draft safety. No local browser, user campaign, wider Stage 3 migration or unrelated layout changes.'};
let browser,imageBytes=0;
function fixture(){
 let s=S.initial();const origin={id:'0,1',x:0,y:1,name:'Original Departure',sector:'Synthetic',hex:'0102',uwp:'A788879-C',zone:'Safe',raw:{PBG:'703'}},current={...origin,id:'1,1',x:1,name:'ExtraordinarilyLongUnbrokenCurrentWorldNameForClearRouteNarrowViewportVerification',hex:'0202'},destination={...origin,id:'2,1',x:2,name:'Future destination beyond the exceptionally long named actual current world',hex:'0302'};
 Object.assign(s,{initialized:true,name:'Disposable Clear Planned Route campaign',actual:origin.id,worlds:{[origin.id]:origin,[current.id]:current,[destination.id]:destination},route:[origin.id,current.id,destination.id],mandatoryStops:[current.id,destination.id],bank:'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Clear Route Trader',capacity:'100',staterooms:4,jump:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}},accommodation:{combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0',passengerCapacity:{reservedCabins:1,installedLowBerths:4}},expenses:{salary:'12000'},mortgage:{originalAmount:'24000000',payment:'100003',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'},maintenance:{payment:'2003',nextDueDate:'015-1105',paidSinceTracking:'4006'}});
 s.lots=[{id:'11111111-2222-4333-8444-555555555555',commodity:'11',description:'Retained owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];s.ledger=[{id:'route-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];
 s.contracts=[{id:'route-mail',kind:'mail',status:'accepted',origin:origin.id,destination:destination.id,quantity:'5',payment:'9007199254740993',dueHours:null,firstDeparture:null,audit:{manual:true,reason:'Retain mail terms'}}];
 s.policies=[{id:'route-policy',lotId:s.lots[0].id,claims:[],status:'active',initialQuantity:'3',remainingQuantity:'3',insuredValue:'9001',remainingValue:'9001',coverage:70,route:[origin.id,current.id,destination.id],routeProgress:0,destination:destination.id}];
 s.dashboardBaseline=createDashboardBaseline(s);s=S.validate(s);const prepared=S.prepareJump(s,()=>({dice:Array(6).fill(3),total:18}));s=S.transition(prepared.state,'Jump: '+origin.name+' → '+current.name,n=>S.commitJump(n,{attemptId:prepared.attempt.id,elapsed:168}));assert.equal(S.jumpUndoEligibility(s).allowed,true);return S.validate(s);
}
function expected(before,scenario={}){return S.transition(before,'Cleared planned route',s=>{if(scenario.nearby&&scenario.stage==='review')s.worlds={'3,1':normalizeWorld(nearbyAPIWorld),...s.worlds};s.route=[s.actual];s.routeIndex=0;s.mandatoryStops=[];});}
function matchGenerated(actual,expected){expected.events.at(-1).id=actual.events.at(-1).id;if(expected.undo.length===actual.undo.length&&expected.undo.at(-1)?.label==='Cleared planned route')expected.undo.at(-1).id=actual.undo.at(-1).id;return expected;}
function assertSaved(saved,before,scenario={}){assert.deepEqual(saved,matchGenerated(saved,expected(before,scenario)),'Full exact original clear transition; only its generated event and inverse IDs are aligned');assert.deepEqual(saved.route,[before.actual]);assert.equal(saved.routeIndex,0);assert.deepEqual(saved.mandatoryStops,[]);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);for(const key of ['hours','dateLabel','bank','actual','lots','contracts','policies','ship','settings','cooldowns','snapshots','ledger','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' unchanged');assert.deepEqual(material(S.undo(saved)),material(before));assert.equal(saved.jumpAttempts.at(-1).closed,true);assert.equal(S.undo(saved).jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(S.undo(saved)).allowed,false);}
const releasedEconomics={"commit": "ae68a384318581131f6575c38c147e34411bf120", "tree": "9cf138a71ef02d8f9fea9cad95750efa826d6bdf", "sha256": {"state.mjs": "be5633196e9a7aa65b91f7816b4b7dcd672a4be0feea4f85b82d860fd597f4fc", "amounts.mjs": "8876a391fabc4f842678c9249aa2d9ad6797cca12e51d61c1ad88736ca997958", "rounding.mjs": "646cf43e1b118d38da9c7d314dc9f0f75f166462a699045f6adebb155f124568", "fuel.mjs": "e4f2cbb65f4be29e552ef0c9424339f1633996b4549693facd2cd6902dde62b3", "life-support.mjs": "da54f07099b74a19f53cba68b1cb1e27a8df1ce053cf6a5a0b9b4e5b22233c3e", "accommodation.mjs": "9a6fc0b166bd0d2a694dcf4a274eadbf7954165a4a4873a1227add23129431a6", "passengers.mjs": "c1f5bee3b8bc2d13dbe346ded5a5f6e2ec0253ed84efecf00839729dbe68a818", "jump-attempts.mjs": "0b62422f992dde8f4561a7dabf4d77fce3cd38f4125c832cbef46028bdabd593", "dashboard-baseline.mjs": "8064fb4e5290224c1e2d49ca0b9210d308c3fa2afa24f3a0e1742f3f748c5195"}};
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
 await context.exposeBinding('__clearRouteUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey, nearbyX}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__clearRouteUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.clearRouteStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   clearRouteStorage.attempts++; clearRouteStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (clearRouteStorage.failNext) {clearRouteStorage.failNext = false; throw Error('Synthetic known clearRoute prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); clearRouteStorage.writes++; return result;
  };
  // Observe native parsing of the boot nearby response independently from the
  // viewport-cache callbacks. The fetch/normalization/refresh continuation is
  // unchanged; later fresh-search options prove it reached the real known-worlds map.
  globalThis.clearRouteLookupResponses=[];
  globalThis.clearRouteNearbyResponses=[];
  const responseJSON=Response.prototype.json;
  Response.prototype.json=function(...args){
   const url=new URL(this.url,location.href),relevant=url.origin==='https://travellermap.com'&&url.pathname.endsWith('/jumpworlds')&&url.searchParams.get('x')===String(nearbyX)&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12';
   const result=Reflect.apply(responseJSON,this,args);if(url.searchParams.get('jump')==='0')return result.then(value=>{clearRouteLookupResponses.push({url:url.href,parsedAt:performance.now()});return value;});if(!relevant)return result;
   return result.then(value=>{const entry={url:url.href,parsedAt:performance.now(),worldIds:Array.isArray(value.Worlds)?value.Worlds.map(w=>w.WorldX+','+w.WorldY):[],pending:!!globalThis.clearRouteGate?.pending,writeExecuted:!!globalThis.clearRouteGate?.pending?.executed};clearRouteNearbyResponses.push(entry);globalThis.clearRouteGate?.trace('boot-nearby-response-parsed',entry);return value;});
  };
  globalThis.clearRouteDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if(array instanceof Uint32Array&&array.length===1)clearRouteDiceCalls++;return random(array);};
  globalThis.clearRouteMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.clearRouteMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); clearRouteMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    clearRouteMapCallbacks.executed++; if (cache) clearRouteMapCallbacks.cacheExecuted++;
    globalThis.clearRouteGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.clearRouteGate?.paintEdge('after', cache);
    clearRouteMapCallbacks.completed++; if (cache) clearRouteMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.clearRouteGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {clearRouteMapCallbacks.loadingCacheCompleted++; clearRouteMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.clearRouteMapLoadingStatusNode = statusNode;}
    globalThis.clearRouteGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.clearRouteGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.clearRouteGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) clearRouteMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY, nearbyX:1});
 let held, releaseHold, heldOnce = false, heldReady;const reached=new Promise(resolve=>{heldReady=resolve;});
 context.clearRouteNetwork = {async waitHeld() {let timeout;try{await Promise.race([reached,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Real MapAreaCache tile did not reach network fixture')),10000);})]);return {...held};}finally{clearTimeout(timeout);}}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 let nearbyHeld,releaseNearby,nearbyHeldOnce=false,nearbyReached;const nearbyReady=new Promise(resolve=>{nearbyReached=resolve;});
 context.clearRouteNearbyNetwork={async waitHeld(){let timeout;try{await Promise.race([nearbyReady,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Actual boot refreshNearby request was not held')),10000);})]);return {...nearbyHeld};}finally{clearTimeout(timeout);}},release(){assert.ok(releaseNearby,'Nearby HTTP response remains held');const resolve=releaseNearby;releaseNearby=null;resolve();},cleanup(){releaseNearby?.();releaseNearby=null;}};
 let lookupArmed=false,lookupRelease,lookupReached,lookupHeld;const lookupReady=new Promise(resolve=>{lookupReached=resolve;});
 context.clearRouteLookupNetwork={arm(){lookupArmed=true;},async waitHeld(){let timer;try{return await Promise.race([lookupReady,new Promise((_r,reject)=>{timer=setTimeout(()=>reject(Error('Real '+scenario.lookup+' route request not reached')),10000);})]);}finally{clearTimeout(timer);}},release(){assert.ok(lookupRelease,'Actual lookup response held');const resolve=lookupRelease;lookupRelease=null;resolve();},cleanup(){lookupRelease?.();lookupRelease=null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/clearRoute-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable clearRoute native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if(lookupArmed&&!lookupHeld&&((scenario.lookup==='hex'&&url.searchParams.get('jump')==='0')||(scenario.lookup==='auto'&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'))){lookupHeld={url:url.href,released:false};lookupReached(lookupHeld);result.lookupResponse=lookupHeld;await new Promise(resolve=>{lookupRelease=resolve;});lookupHeld.released=true;return route.fulfill({json:{Worlds:scenario.reject?{}:[]},headers});}

    if(scenario.nearby&&!nearbyHeldOnce&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'){
     nearbyHeldOnce=true;nearbyHeld={url:url.href,heldAt:Date.now(),released:false};result.nearbyResponse=nearbyHeld;nearbyReached();await new Promise(resolve=>{releaseNearby=resolve;});nearbyHeld.released=true;nearbyHeld.releasedAt=Date.now();
     return route.fulfill({json:{Worlds:scenario.reject?{}:[nearbyAPIWorld]},headers});
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
  if (!new URL(storeURL).search) throw Error('Actual Store must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save, nativeRead = Store.prototype.read;
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const storeResponse = await fetch(storeURL); if (!storeResponse.ok) throw Error('Cannot inspect runtime Store');
  const storeSource = await storeResponse.text();
  const g = globalThis.clearRouteGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
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
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: clearRouteDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  g.semantic=semantic;
  g.originalClose=close=>Reflect.apply(HTMLDialogElement.prototype.close,close,[]);
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic clearRoute completion ' + name + ' fault');};
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if(g.warningFault&&this.id==='modal-error'&&/Synthetic/.test(value)){g.warningFault=false;g.faults.push('warning');throw Error('Synthetic clearRoute warning fault');}
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^Cleared planned route saved\.$/.test(value)) fault('report');
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
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic clearRoute entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: clearRouteStorage.writes});
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
   for (const [name, arg] of [['tab','Cargo'],['world','2,1'],['deposit',''],['route-build',''],['route-auto',''],['route-clear',''],['route-cancel',''],['route-last',''],['route-retry',''],['nearby','']]) g.dispatch(name, arg);
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
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before clearRoute publication');}
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
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after clearRoute publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this);if(g.readFailureAt&&++g.boundaryReads===g.readFailureAt){g.readFault=true;g.trace('handoff-durable-read-fault',{read:g.boundaryReads});} if (g.readFault) throw Error('Synthetic unreadable durable clearRoute baseline'); const value=Reflect.apply(nativeRead,this,args),check={exactDurableCopy:JSON.stringify(value)===localStorage.getItem(KEY),aliasesLive:value===g.lastState,revision:value.revision};g.readChecks.push(check);if(check.aliasesLive||!check.exactDurableCopy)throw Error('Store.read must return the full readable durable campaign copy');return value;};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = clearRouteDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending clearRoute save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native clearRoute write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending clearRoute completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known clearRoute prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown clearRoute outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory clearRoute not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable clearRoute save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.observations=[];clearRouteStorage.observations=[];g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: clearRouteMapCallbacks.cacheCompleted, loadingCacheCompleted: clearRouteMapCallbacks.loadingCacheCompleted});};
  g.snapshot=()=>({modalControls:['modal-close','modal-cancel','modal-submit'].map(id=>{const node=document.querySelector('#'+id);return {id,disabled:node.disabled,hidden:node.hidden,connected:node.isConnected};}),calls:g.calls,totalCalls:g.totalCalls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,storage:{...clearRouteStorage},candidates:g.candidates,forwarded:g.forwarded,publications:g.publications,observations:g.observations,settlements:g.settlements,faults:g.faults,reentrantChecks:g.reentrantChecks,baseline:g.baseline,acceptedDice:g.acceptedDice,semantic:semantic(),reviewNodeRetained:!!g.reviewNode?.isConnected,mainNodeRetained:!!g.mainNode?.isConnected,newer:g.newer,recoveryChecks:g.recoveryChecks,callbacks:{...clearRouteMapCallbacks},nearbyResponses:clearRouteNearbyResponses,bootstrap:g.bootstrap,mapReadiness:g.mapReadiness,retainedBaselineOrder:g.retainedBaselineOrder,constructionChecks:g.constructionChecks,normalizationChecks:g.normalizationChecks,readChecks:g.readChecks,timeline:g.timeline,timelineDropped:g.timelineDropped,mapBaseline:g.mapBaseline,paintEdges:g.paintEdges,paintEdgesDropped:g.paintEdgesDropped,mutationCount:g.mutationCount,handoffChecks:g.handoffChecks||[],dieReentryCheck:g.dieReentryCheck??null,durableToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[],normalizationChecks:[]});
   Object.assign(clearRouteStorage,{attempts:0,writes:0,failNext:false,observations:[]});
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = clearRouteStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || clearRouteStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
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
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Clear route dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Clear route content stays inside dialog');}
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
 const peer = await context.newPage(); await peer.goto(new URL('verification/clearRoute-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.clearRoutePeer = {state: null, editable: false}; clearRoutePeer.store = new Store(next => {clearRoutePeer.state = next;}, editable => {clearRoutePeer.editable = editable;}); await clearRoutePeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => clearRoutePeer.editable); await page.waitForFunction(() => clearRouteGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(clearRoutePeer.state, 'Foreign deposit during clearRoute save', s => S.deposit(s, 7, 'Synthetic peer')); clearRoutePeer.store.save(next, clearRoutePeer.state.revision); return clearRoutePeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {clearRoutePeer.store.yield(); clearRoutePeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => clearRouteGate.store.acquire(true)); await page.waitForFunction(() => clearRouteGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;
 const before=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent}));
 const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===clearRouteGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===clearRouteGate.newerClose,submitCallable:typeof clearRouteGate.newerSubmit==='function',closeCallable:typeof clearRouteGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>{void clearRouteGate.newerSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
 assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent})),before);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await page.evaluate(()=>clearRouteGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Actual newer Notes handler identities survive old settlement and detached replay; captured Notes submit remains read-only and captured Close dismisses without writes');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: clearRouteGate.mapCapture('before-resize'), callbacks: {...clearRouteMapCallbacks}}));
 await page.evaluate(() => {clearRouteGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => clearRouteMapCallbacks.resizeDelivered > previous.resizeDelivered && clearRouteMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => clearRouteGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}

async function mapPublication(page, result, scenario, before, context) {
 const held = await context.clearRouteNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {clearRouteGate.beginStrict(); clearRouteGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>clearRouteGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {clearRouteGate.phase = 'cache-response'; clearRouteGate.trace('held-cache-release-requested');}); context.clearRouteNetwork.release();
 await page.waitForFunction(n => clearRouteMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => clearRouteGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => clearRouteGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page,result,{resume:true});await release(page);await frames(page);assertSaved(await read(page),before,scenario);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern,'Retired owner cannot publish clean success');await terminal(page,result,before,scenario,{committed:true});
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function prepare(page,result,scenario,before,context){
 // Always retain a genuine local Route preview underneath the Clear review.
 // Clear must discard that exact old draft only after owned successful save.
 await page.locator('#route-menu > summary').click();await action(page,'route-'+(scenario.lookup==='auto'?'auto':'build')).click();
 if(scenario.lookup){context.clearRouteLookupNetwork.arm();if(scenario.lookup==='hex')await page.locator('polygon[data-action="map-empty"][data-arg="1,2"]').click();else await action(page,'map-world','2,1').click();await context.clearRouteLookupNetwork.waitHeld();}
 else {await action(page,'map-world','2,1').click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);}
 if(scenario.map){const held=await context.clearRouteNetwork.waitHeld();assert.equal(held.released,false);await page.setViewportSize({...result.viewport,width:result.viewport.width+17});await frames(page);await page.setViewportSize(result.viewport);await frames(page);await page.waitForFunction(()=>clearRouteMapCallbacks.loadingCacheCompleted>0&&clearRouteMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));await page.evaluate(held=>{clearRouteGate.mapReadiness=clearRouteGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...clearRouteMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:clearRouteGate.mapNodeId(clearRouteMapLoadingStatusNode)});},held);}
 else if(!scenario.nearby&&!scenario.lookup){await page.waitForFunction(()=>document.querySelector('#map-load-status')?.textContent==='');await frames(page);}
 await page.locator('#route-menu > summary').click();await action(page,'route-clear').click();await page.locator('#modal-title').filter({hasText:/^Clear planned route$/}).waitFor();
 assert.equal((await page.locator('#modal-body > p').allTextContents()).join(''),`Clear future stops and start a new route from ${before.worlds[before.actual].name}, the ship’s actual location?This does not return the ship to its original campaign starting world. Time, cargo, bank, completed travel history and insurance terms stay unchanged. You can undo this change.`,'Complete original review text and exact actual world');
 assert.match(await page.locator('#rounding-input-note').textContent(),/Rounding[\s\S]*Credits round up to whole Credits; tons round up to whole tons\. Exact intermediate calculations and proportional cost allocations are retained\./,'Unchanged production rounding note is part of complete review');
 assert.equal(await page.locator('#modal-submit').textContent(),'Clear route');
 for(const id of ['modal-close','modal-cancel','modal-submit'])assert.equal(await page.locator('#'+id).evaluate(node=>node.form===document.querySelector('#modal-form')),true,'Real production '+id+' belongs to modal form');
 assert.equal(await page.locator('.route-draft').count(),1);assert.deepEqual(await read(page),before);assert.equal((await gate(page)).totalCalls,0);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,true);
 if(scenario.nearby&&scenario.stage==='review'){await context.clearRouteNearbyNetwork.waitHeld();context.clearRouteNearbyNetwork.release();await page.waitForFunction(()=>clearRouteNearbyResponses.some(r=>r.worldIds.includes('3,1')));await frames(page);}
 await page.evaluate(()=>document.activeElement?.blur());await frames(page);
 await page.evaluate(()=>clearRouteGate.remember());
 if(detailedSuccess(scenario)){await formWalk(page,result,'complete-clear-review');await detail(page,result,'long-world-and-entire-review',['#modal-title','#modal-body']);await detail(page,result,'complete-clear-footer',['#modal-cancel','#modal-submit']);}
}
async function submit(page,{native=false,duplicate=false}={}){
 if(native)return page.evaluate(duplicate=>{const g=clearRouteGate,form=document.querySelector('#modal-form');void g.oldSubmit({preventDefault(){},currentTarget:form});if(duplicate)void g.oldSubmit({preventDefault(){},currentTarget:form});return {writes:clearRouteStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent};},duplicate);
 await pointer(page,'#modal-submit',duplicate?2:1);
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();if(navigation)clearRouteGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 // Only await-boundary actions belong ahead of the submit claim. Route-clear
 // intentionally replaces its review synchronously; challenge that action only
 // after pending ownership exists. The separate preclaim case proves replacement.
 if(scenario.mode==='queued-pending')await page.evaluate(()=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['route-build',''],['deposit','']])clearRouteGate.dispatch(name,arg);void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});if(!clearRouteGate.pending)throw Error('Clear submit must synchronously reach the held provider before route-clear replay');clearRouteGate.dispatch('route-clear');});else await submit(page,{duplicate:true});
 await page.waitForFunction(()=>!!clearRouteGate.pending);await frames(page);assert.equal(await raw(page),bytes);assertRetained(await gate(page));
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen before provider entry');
 await replay(page);const snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(snapshot.storage.writes,0);assert.equal(await raw(page),bytes);assertRetained(snapshot);assert.equal(snapshot.semantic.dice,0);
 assert.deepEqual(snapshot.forwarded,[{argumentCount:3,tokenPresent:true,expectedRevision:before.revision,candidateRevision:before.revision+1}]);assertSaved(JSON.parse(snapshot.candidates[0]),before,scenario);
 if(scenario.mode==='deferred')await detail(page,result,'pending-before-write-controls',['#modal-cancel','#modal-submit']);
 result.checks.push('Native retained review, underlying route preview, Close/Cancel/Submit, Enter/Escape, duplicate/detached/queued events held before native write');
}
async function reloadUndo(page,result,before,scenario,{committed=true,undo=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>clearRouteStorage.writes),0);assert.equal(await page.evaluate(()=>typeof clearRouteGate),'undefined','Real reload has no provider instrumentation');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 const saved=await read(page);assertSaved(saved,before,scenario);assert.equal(await page.locator('.route-draft').count(),0);assert.deepEqual(await routeIds(page),[before.actual]);
 if(detailedSuccess(scenario))await detail(page,result,'real-reload-current-route',['.planned-route'],/Planned route · 1 stop/);
 if(!undo)return;
 await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);const undone=await read(page),expectedUndo=S.undo(saved);expectedUndo.events.at(-1).id=undone.events.at(-1).id;assert.deepEqual(undone,expectedUndo,'Full actual History Undo equals original inverse');assert.deepEqual(material(undone),material(before));assert.equal(undone.revision,before.revision+2);assert.equal(await page.evaluate(()=>clearRouteStorage.writes),1);assert.equal(S.jumpUndoEligibility(undone).allowed,false);
 if(detailedSuccess(scenario)){await detail(page,result,'real-history-undo-status',['#message'],/^Latest action undone\.$/);await tab(page,'Overview');assert.deepEqual(await routeIds(page),before.route);await regionWalk(page,result,'real-undo-restored-route','.planned-route');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(page),undone);assert.deepEqual(await routeIds(page),before.route);await regionWalk(page,result,'undo-reload-restored-route','.planned-route');}
 result.checks.push('Genuine reload, full-state single-revision History Undo and permanently closed prior jump mulligan');
}
const routeIds=page=>page.locator('.route-list [data-action="world"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.arg));
async function successful(page,result,before,scenario){
 await closed(page);await frames(page);const saved=await read(page),snapshot=await gate(page);assertSaved(saved,before,scenario);assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.semantic.dice,0);assert.equal(await page.locator('#message').textContent(),'Cleared planned route saved.');assert.equal(await page.locator('.route-draft').count(),0);assert.deepEqual(await routeIds(page),[before.actual]);
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);assert.ok(snapshot.readChecks.every(c=>c.exactDurableCopy&&!c.aliasesLive));for(const item of [...snapshot.observations,...snapshot.storage.observations])assert.equal(item.message,snapshot.baseline.message,'No success before provider settlement');
 const bytes=await raw(page),calls=snapshot.totalCalls;await page.evaluate(()=>{void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 result.economics={beforeSHA256:hash(JSON.stringify(before)),savedSHA256:hash(bytes),bank:saved.bank,hours:saved.hours,route:saved.route,routeIndex:saved.routeIndex,mandatoryStops:saved.mandatoryStops,shipSHA256:hash(JSON.stringify(saved.ship)),ledgerSHA256:hash(JSON.stringify(saved.ledger)),contractsSHA256:hash(JSON.stringify(saved.contracts)),policiesSHA256:hash(JSON.stringify(saved.policies)),auditSHA256:hash(JSON.stringify(saved.events)),undo:saved.undo.length};
 await detail(page,result,'saved-success-status',['#message'],successPattern);if(detailedSuccess(scenario))await detail(page,result,'saved-current-route',['.planned-route'],/Planned route · 1 stop/);result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
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
 const bytes=await raw(page);await replay(page,{physical:false,navigation:false});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true);await page.evaluate(()=>{clearRouteGate.store.yield();clearRouteGate.store.onChange(clearRouteGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal(await page.locator('#save-status').textContent(),guidance);if(!reportable){assert.equal(await page.locator('#message').textContent(),snapshot.baseline.message,'Late role/publication callbacks do not revive retired reporting authority');assert.equal(await page.locator('#modal').evaluate(node=>node.open),false);}result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario,{committed});
}
async function rememberNotes(page){await page.evaluate(()=>{const g=clearRouteGate;g.newer={title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent};g.newerSubmit=document.querySelector('#modal-form').onsubmit;g.newerClose=document.querySelector('#modal-cancel').onclick;});}
async function nativeClose(page){await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});await frames(page);}
async function retired(page,result,before,scenario,context){
 const mode=scenario.mode;if(mode==='foreign-same')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);if(mode==='foreign-new')await peerTakeover(page,result,context,{write:true});if(mode==='editor-regain')await peerTakeover(page,result,context,{regain:true});
 if(['native-close','new-dialog','retired-unknown-newer','newer-draft'].includes(mode)){await nativeClose(page);if(['new-dialog','retired-unknown-newer'].includes(mode)){await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);}else if(mode==='newer-draft'){await page.locator('#route-menu > summary').click();await action(page,'route-build').click();await action(page,'map-world','0,1').click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);await page.evaluate(()=>{clearRouteGate.newDraftNode=document.querySelector('.route-draft');clearRouteGate.newDraftHTML=clearRouteGate.newDraftNode.outerHTML;clearRouteGate.newRouteHTML=document.querySelector('.planned-route').outerHTML;});}}
 const authoritative=await raw(page);await release(page,mode==='retired-unknown-newer'?'unknown-before':'native');await frames(page);let snapshot=await gate(page);
 if(mode==='foreign-new'){assert.equal(await raw(page),authoritative);assert.equal((await read(page)).bank,String(BigInt(before.bank)+7n));assert.equal(snapshot.settlements.at(-1).code,'SAVE_NOT_COMMITTED');assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);result.gate=safeReport(snapshot);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),authoritative);return;}
 if(mode==='retired-unknown-newer')assert.deepEqual(await read(page),before);else assertSaved(await read(page),before,scenario);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 if(['new-dialog','retired-unknown-newer'].includes(mode)){assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);await detail(page,result,'newer-notes-retained',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);await regionWalk(page,result,'newer-owner-global-reload','#save-status');result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario,{committed:mode!=='retired-unknown-newer'});}
 if(mode==='newer-draft'){assert.equal(await page.evaluate(()=>document.querySelector('.route-draft')===clearRouteGate.newDraftNode),true);assert.equal(await page.locator('.route-draft').evaluate(node=>node.outerHTML),await page.evaluate(()=>clearRouteGate.newDraftHTML),'Old settlement cannot replace or clear a newer route draft');assert.equal(await page.locator('.planned-route').evaluate(node=>node.outerHTML),await page.evaluate(()=>clearRouteGate.newRouteHTML));await regionWalk(page,result,'newer-route-preview-retained','.route-draft');result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario);}
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
async function lookupRelease(page,result,scenario,context){
 const before=await page.evaluate(()=>({nearby:clearRouteNearbyResponses.length,hex:clearRouteLookupResponses.length}));context.clearRouteLookupNetwork.release();await page.waitForFunction(({before,lookup})=>lookup==='hex'?clearRouteLookupResponses.length>before.hex:clearRouteNearbyResponses.length>before.nearby,{before,lookup:scenario.lookup});await frames(page);result.checks.push('Actual held '+scenario.lookup+' HTTP response parsed during '+scenario.stage);
}
async function assertStrict(page,label){const snapshot=await gate(page);assert.deepEqual((await page.evaluate(label=>clearRouteGate.mapCapture(label),label)).regions,snapshot.mapBaseline.regions,label+': exact main, route preview, map SVG, form, summary and statuses');assert.equal(snapshot.mutationCount,0,label+': no transient mutations');for(const edge of snapshot.paintEdges)assert.deepEqual(edge.regions,snapshot.mapBaseline.regions,label+': actual callback edge');}
async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>clearRouteStorage.writes),0,'Fixture requires no migration write');await installGate(page,result);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(scenario.nearby&&scenario.stage==='control'){await context.clearRouteNearbyNetwork.waitHeld();context.clearRouteNearbyNetwork.release();await page.locator('#message').filter({hasText:/Could not load nearby worlds: Invalid world-list response/}).waitFor();assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);result.checks.push('Unrelated ordinary failed nearby refresh still reports its genuine error');result.gate=safeReport(await gate(page));return;}
 if(!scenario.map)await page.waitForFunction(()=>clearRouteMapCallbacks.cacheCompleted>0&&clearRouteMapCallbacks.scheduled===clearRouteMapCallbacks.executed&&document.querySelector('#map-load-status')?.textContent==='');
 await prepare(page,result,scenario,before,context);
 if(mode==='lookup'&&scenario.stage==='reopened'){await page.evaluate(()=>{clearRouteGate.previousSubmit=clearRouteGate.oldSubmit;document.querySelector('#modal-cancel').click();document.querySelector('[data-action="route-clear"]').click();});await page.waitForFunction(()=>document.querySelector('#modal').open&&document.querySelector('#modal-title').textContent==='Clear planned route'&&document.querySelector('#modal-form').onsubmit!==clearRouteGate.previousSubmit);await frames(page);await page.evaluate(()=>clearRouteGate.remember());await page.evaluate(()=>clearRouteGate.beginStrict());await lookupRelease(page,result,scenario,context);await assertStrict(page,'immediately reopened Clear holds same pending draft');await page.evaluate(()=>{clearRouteGate.endStrict();void clearRouteGate.previousSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);await detail(page,result,'reopened-clear-holds-prior-lookup',['#modal-body']);}

 if(mode==='cancel-review'){await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(await page.locator('.route-draft').count(),1);assert.deepEqual(await routeIds(page),[before.actual,'2,1']);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,true);await regionWalk(page,result,'cancel-retains-original-preview','.route-draft');result.gate=safeReport(await gate(page));return;}
 if(mode==='preclaim-replacement'){
  const replacement=await page.evaluate(()=>{const g=clearRouteGate,form=document.querySelector('#modal-form'),oldReview=document.querySelector('#modal-body').firstElementChild;g.dispatch('route-clear');g.replacementSubmit=form.onsubmit;g.replacementBody=document.querySelector('#modal-body').innerHTML;void g.oldSubmit({preventDefault(){},currentTarget:form});return {handlerChanged:form.onsubmit!==g.oldSubmit,oldReviewDetached:!oldReview.isConnected,title:document.querySelector('#modal-title').textContent,open:document.querySelector('#modal').open,calls:g.totalCalls,writes:clearRouteStorage.writes};});
  assert.deepEqual(replacement,{handlerChanged:true,oldReviewDetached:true,title:'Clear planned route',open:true,calls:0,writes:0},'Preclaim route-clear synchronously replaces the old review and revokes its captured submit');await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(await page.evaluate(()=>document.querySelector('#modal-form').onsubmit===clearRouteGate.replacementSubmit),true);assert.equal(await page.locator('#modal-body').innerHTML(),await page.evaluate(()=>clearRouteGate.replacementBody));assert.equal(await page.locator('#modal-error').textContent(),'');
  await pointer(page,'#modal-cancel');await closed(page);await page.evaluate(()=>{void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,true);result.preclaimReplacement=replacement;result.gate=safeReport(await gate(page));return;
 }
 if(mode==='moved-form'){await page.evaluate(()=>{const form=document.querySelector('#modal-form');clearRouteGate.originalParent=form.parentNode;document.body.append(form);void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:form});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await page.evaluate(()=>clearRouteGate.originalParent.append(document.querySelector('#modal-form')));result.gate=safeReport(await gate(page));return;}
 if(mode==='read-only'){await peerTakeover(page,result,context);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await regionWalk(page,result,'read-only-warning','#modal-error');await detail(page,result,'read-only-dismissal-controls',['#modal-cancel','#modal-submit']);await pointer(page,'#modal-cancel');await closed(page);result.gate=safeReport(await gate(page));return;}
 if(mode==='foreign-form'){await page.evaluate(()=>{const form=document.querySelector('#modal-form').cloneNode(true);void clearRouteGate.oldSubmit({preventDefault(){},currentTarget:form});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form'].includes(mode)){
  const immediate=await page.evaluate(mode=>{const g=clearRouteGate;g.reentrant=mode==='reentrant';if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['route-build',''],['deposit','']])g.dispatch(name,arg);const form=document.querySelector('#modal-form');void g.oldSubmit({preventDefault(){},currentTarget:form});void g.oldSubmit({preventDefault(){},currentTarget:form});g.nativeFirstMicrotask=Promise.resolve().then(()=>({writes:clearRouteStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent}));return {writes:clearRouteStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent};},mode);assert.equal(immediate.writes,1,'Real native Store writes in the original submit stack');assert.equal(immediate.open,true,'Original close remains in its microtask continuation');assert.equal(immediate.message,'Cleared planned route saved.','Native saved announcement remains synchronous');const firstMicrotask=await page.evaluate(()=>clearRouteGate.nativeFirstMicrotask);assert.deepEqual(firstMicrotask,{writes:1,open:false,message:'Cleared planned route saved.'},'Original close completes in its first microtask, without a deferred native write');result.nativeTiming={sameStack:immediate,firstMicrotask};await frames(page);assert.equal((await gate(page)).totalCalls,1);return successful(page,result,before,scenario);
 }
 if(mode==='lookup'&&['review','cancel'].includes(scenario.stage)){
  await page.evaluate(()=>clearRouteGate.beginStrict());await lookupRelease(page,result,scenario,context);await assertStrict(page,'lookup held by exact confirmation review');assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
  await page.evaluate(()=>clearRouteGate.endStrict());
  if(scenario.stage==='cancel'){await pointer(page,'#modal-cancel');await closed(page);await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);assert.deepEqual(await routeIds(page),[before.actual,scenario.lookup==='hex'?'1,2':'2,1']);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);await regionWalk(page,result,'cancel-resumes-held-'+scenario.lookup+'-preview','.route-draft');result.gate=safeReport(await gate(page));return;}
 }
 await page.evaluate(mode=>{const g=clearRouteGate;g.armed=true;g.notifyFault=mode==='notification-before'?'before':['notification-after','controls','controls-close'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token'].includes(mode)?mode:null;clearRouteStorage.failNext=['retry','recovery-reentry'].includes(mode);g.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map)return mapPublication(page,result,scenario,before,context);
 if(mode==='lookup'){
  await page.evaluate(()=>clearRouteGate.beginStrict());
  if(scenario.stage==='retry'){
   await page.evaluate(()=>clearRouteGate.endStrict());await release(page,'known-before');await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isEnabled(),true);await page.evaluate(()=>clearRouteGate.beginStrict());await lookupRelease(page,result,scenario,context);await assertStrict(page,'retry still owns exact held draft');await page.evaluate(()=>clearRouteGate.endStrict());await submit(page,{native:true,duplicate:true});await page.waitForFunction(()=>!!clearRouteGate.pending);assert.equal((await gate(page)).totalCalls,2);await page.evaluate(()=>clearRouteGate.beginStrict());
  }
  if(scenario.stage==='prewrite'){await lookupRelease(page,result,scenario,context);await assertStrict(page,'prewrite lookup');assert.equal(await raw(page),bytes);}
  await page.evaluate(()=>clearRouteGate.write());await frames(page);assertSaved(await read(page),before,scenario);
  if(scenario.stage==='publication')await lookupRelease(page,result,scenario,context);
  await assertStrict(page,'written but unsettled '+scenario.lookup);if(scenario.stage==='publication')await detail(page,result,'lookup-publication-held-controls',['#modal-cancel','#modal-submit']);await page.evaluate(()=>clearRouteGate.endStrict());await release(page);return successful(page,result,before,scenario);
 }
 if(mode==='nearby'){
  await page.evaluate(()=>clearRouteGate.beginStrict());await page.evaluate(()=>clearRouteGate.write());await frames(page);assertSaved(await read(page),before,scenario);
  if(scenario.stage==='publication'){await context.clearRouteNearbyNetwork.waitHeld();const parsed=await page.evaluate(()=>clearRouteNearbyResponses.length);context.clearRouteNearbyNetwork.release();await page.waitForFunction(n=>clearRouteNearbyResponses.length>n,parsed);await frames(page);}
  await assertStrict(page,'actual refreshNearby continuation');await page.evaluate(()=>clearRouteGate.endStrict());await release(page);
  if(scenario.stage==='after-settlement'){await closed(page);const message=await page.locator('#message').textContent();assert.match(message,successPattern);const parsed=await page.evaluate(()=>clearRouteNearbyResponses.length);context.clearRouteNearbyNetwork.release();await page.waitForFunction(n=>clearRouteNearbyResponses.length>n,parsed);await frames(page);assert.equal(await page.locator('#message').textContent(),message,'Old failed nearby request cannot overwrite settled success');}
  return successful(page,result,before,scenario);
 }
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','retired-unknown-newer','newer-draft','consumed-token'].includes(mode))return retired(page,result,before,scenario,context);
 if(['disk-same','disk-unreadable','published-disk-drift','published-disk-unreadable'].includes(mode)){
  const published=mode.startsWith('published-');if(published){await page.evaluate(()=>clearRouteGate.write());await frames(page);assertSaved(await read(page),before,scenario);}
  if(mode==='disk-same'||mode==='published-disk-drift')await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key));value.bank=String(BigInt(value.bank)+7n);localStorage.setItem(key,JSON.stringify(value));},KEY);else await page.evaluate(()=>{clearRouteGate.readFault=true;});const authoritative=await raw(page);await release(page,published?'native':'known-before');await page.waitForFunction(()=>clearRouteGate.store.reloadRequired);await frames(page);assert.equal(await raw(page),authoritative);assert.equal((await gate(page)).totalCalls,1);assert.equal((await gate(page)).editable,false);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await regionWalk(page,result,published?'saved-durable-settlement-reload':'unwritten-durable-baseline-reload','#modal-error');await page.evaluate(()=>{clearRouteGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),authoritative);return;
 }
 if(['retry','recovery-reentry'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known clearRoute prewrite'}).waitFor();const snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);if(mode==='recovery-reentry')assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);await regionWalk(page,result,'known-unsaved-retry-warning','#modal-error');await detail(page,result,'known-unsaved-retry-controls',['#modal-cancel','#modal-submit']);
  await submit(page,{native:true});await page.waitForFunction(()=>!!clearRouteGate.pending);const retry=await gate(page);assert.equal(retry.calls,2);assertSaved(JSON.parse(retry.candidates[1]),before,scenario);assertRetained(retry);await release(page);return successful(page,result,before,scenario);
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{clearRouteGate.beginStrict();clearRouteGate.write();});await frames(page);assertSaved(await read(page),before,scenario);assertRetained(await gate(page));await replay(page);assertRetained(await gate(page));await assertStrict(page,'owned native publication awaiting settlement');if(mode==='deferred')await detail(page,result,'durable-publication-held-controls',['#modal-cancel','#modal-submit']);await page.evaluate(()=>clearRouteGate.endStrict());await release(page);return successful(page,result,before,scenario);
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','controls-close','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{clearRouteGate.cleanupFault=mode;},mode);
 await release(page,['unknown-before','unknown-after','contradictory','fulfilled-no-publication'].includes(mode)?mode:mode==='terminal-report'?'unknown-before':'native');
 if(mode==='reentrant-close'){await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.deepEqual(snapshot.faults,['reentrant-close']);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);await detail(page,result,'newer-notes-during-close',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario);}
 if(mode==='wrong-candidate'){
  await frames(page);const snapshot=await gate(page),delivered=snapshot.publications.filter(entry=>entry.tokenMatches&&entry.actualCallback);assert.equal(delivered.length,1);assert.equal(delivered[0].deliveredTokenMatches,true);assert.equal(delivered[0].deliveredRevision,before.revision+1);assert.equal(delivered[0].deliveredSnapshotMatches,false,'The authenticated callback deliberately delivers a different candidate');assert.equal(snapshot.storage.writes,1);assertSaved(await read(page),before,scenario);result.alteredPublication=delivered[0];
 }
 await terminal(page,result,before,scenario,{committed:!['unknown-before','fulfilled-no-publication','terminal-report'].includes(mode),unknown:['unknown-before','fulfilled-no-publication','terminal-report','missing','missing-token','wrong-token','wrong-revision'].includes(mode)});if(cleanup)assert.deepEqual(result.gate.faults,[mode]);
}
function evidenceTargets(s){
 if(!persistsEvidence(s))return [];
 if(s.mode==='native')return ['complete-clear-review','long-world-and-entire-review','complete-clear-footer','saved-success-status','saved-current-route','real-reload-current-route','real-history-undo-status','real-undo-restored-route','undo-reload-restored-route'];
 if(s.mode==='deferred')return ['pending-before-write-controls','durable-publication-held-controls','saved-success-status'];
 if(s.mode==='retry')return ['known-unsaved-retry-warning','known-unsaved-retry-controls','saved-success-status'];
 if(['unknown-before','unknown-after','render','controls'].includes(s.mode))return ['terminal-reload-warning','terminal-dismissal-controls'];
 if(s.mode==='controls-close')return ['terminal-reload-warning','terminal-dismissal-controls','terminal-x-dismissal-control'];
 if(s.mode==='read-only')return ['read-only-warning','read-only-dismissal-controls'];
 if(s.mode==='cancel-review')return ['cancel-retains-original-preview'];
 if(s.mode==='map-owned')return ['map-publication-held-controls','saved-success-status'];
 if(s.mode==='map-foreign')return ['map-publication-held-controls','terminal-reload-warning','terminal-dismissal-controls'];
 if(['new-dialog','retired-unknown-newer'].includes(s.mode))return ['newer-notes-retained','newer-owner-global-reload'];
 if(s.mode==='newer-draft')return ['newer-route-preview-retained'];
 if(s.mode==='reentrant-close')return ['newer-notes-during-close'];
 if(s.mode==='lookup')return s.stage==='cancel'?['cancel-resumes-held-'+s.lookup+'-preview']:s.stage==='reopened'?['reopened-clear-holds-prior-lookup','saved-success-status']:['lookup-publication-held-controls','saved-success-status'];
 if(s.mode==='nearby')return ['saved-success-status'];
 return [];
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,mode:scenario.mode,viewport,status:'running',persistEvidence:persistsEvidence(scenario),evidenceTargets:evidenceTargets(scenario),checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result,scenario);const page=await context.newPage();await runBody(page,result,scenario,context);await frames(page);for(const key of ['pageErrors','unhandledRejections','consoleErrors','networkErrors','unexpectedRequests'])assert.deepEqual(result[key],[],key);assert.equal(result.screenshots.length>0,result.persistEvidence);for(const target of result.evidenceTargets)assert.ok(result.layouts.some(layout=>layout.label===target||layout.label.startsWith(target+'-')),'Declared evidence target: '+target);result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(e=>result.errors.push('Diagnostic capture: '+errorText(e)));result.failedGate=await gate(page).then(safeReport).catch(()=>null);}}
 finally{context?.clearRouteNetwork?.cleanup();context?.clearRouteNearbyNetwork?.cleanup();context?.clearRouteLookupNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
// Safe documented local branch. Static imports are native data/helpers only.
// Every path here completes before dependency resolution or Chromium launch.
if(process.argv.includes('--fixtures-only')){
 await assertReleasedEconomics();for(const scenario of scenarios){const before=fixture(),saved=expected(before,scenario);assertSaved(saved,before,scenario);S.validate(saved);const undone=S.undo(saved);assert.equal(S.jumpUndoEligibility(undone).allowed,false);}
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.match(app,/function clearPlannedRoute\(/);const modal=html.match(/<form id="modal-form">([\s\S]*?)<\/form>/)?.[1];for(const id of ['modal-close','modal-cancel','modal-submit'])assert.ok(modal.includes('id="'+id+'"'),'Production '+id+' is inside form');assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');
 const plan={releasedEconomics,suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,limits:report.limits,encoding:screenshotOptions,declaredEvidenceCases:cases.filter(c=>persistsEvidence(c.scenario)).length,declaredFrameGroups:cases.reduce((n,c)=>n+evidenceTargets(c.scenario).length,0),viewportWalkRule:'Complete original-resolution full viewport images; walk entire real modal and every too-tall target range with at least 50 px overlap. Target geometry and coverage retained. No crop, restyle, reduced viewport or unsupported inspection flag.',scope:report.scope,sourceChecks:['Exact tagged app/controller/Store source hashes against clean requested head','Pinned .59 label-neutral economics and original [actual]/0/[] mutation','Full campaign/economics/audit/inverse/reload/Undo with two generated transition IDs aligned only','All production Close/Cancel/Submit buttons are inside modal-form','Real held hex/auto-route/refreshNearby and MapAreaCache/ResizeObserver callbacks','Pending review and underlying Route preview full DOM/SVG/status equality and node identity','Native same-stack saved announcement and original microtask close','20 MiB images, 24 MiB artifact, standard 14-minute suite budget'],scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,mode:scenario.mode,viewport,evidence:persistsEvidence(scenario)?'original-resolution representative frames':'full semantic assertions and geometry; diagnostic frame on failure',evidenceTargets:evidenceTargets(scenario)})),execution:'Fixture/source validation only. Chromium was NOT required or launched; this is NOT browser evidence.'};
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify(plan,null,2));else console.log(`PASS: Clear route original full-state/economic/route/audit/Undo/mulligan fixtures and tagged source wiring. ${scenarios.length} scenarios / ${cases.length} declared browser cases. Chromium was NOT required or launched; this is NOT browser evidence.`);
}else{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual Clear route browser runs only in exact-head GitHub CI; locally use documented --fixtures-only');
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT');assert.equal(report.testedCommit,report.requestedCommit);report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires clean exact head');report.testedTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();report.releasedEconomics=await assertReleasedEconomics();
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','campaign-controller.mjs','persistence.mjs','state.mjs','map-viewport.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const {scenario,viewport} of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.cases.reduce((n,r)=>n+r.screenshots.length,0));report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'Bounded 24 MiB evidence');assert.ok(imageBytes<report.limits.imageBytes,'Bounded 20 MiB images');
 }catch(error){report.errors.push(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(r=>r.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Clear Planned Route completion Chromium checks failed; see verification-artifacts/clear-route-completion-report.json');console.log(`PASS: ${report.declaredCases} exact-head Clear Planned Route completion cases with real locks and bounded complete desktop/mobile evidence.`);
}
