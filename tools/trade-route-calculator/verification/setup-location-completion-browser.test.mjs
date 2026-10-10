// Exact-head Chromium gate for campaign setup and ship-location completion.
// The actual UI, versioned Store body, localStorage and native Web Locks run.
// Only independent map responses and provider completion timing are fixtures.
// Run: node verification/setup-location-completion-browser.test.mjs [playwright-module]
// --fixtures-only validates fixtures/source wiring without launching Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {normalize} from '../js/map.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';
import {normalizeAmount} from '../js/form-values.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='setup-location-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const common=['sync','success','validation','lookup-delay','lookup-failure','lookup-cancel','lookup-close','lookup-escape','lookup-foreign','lookup-editor-regain','lookup-newer-dialog','prewrite','notification-before','notification-after','unknown-before','unknown-after','missing-publication','missing-token','wrong-token','wrong-revision','contradictory','foreign-before','foreign-after','editor-regain-before','editor-regain-after','stale-disk-before','stale-disk-after','detached-before','detached-after','cleanup','render','report','close','freeze-fault','partial-modal'];
const scenarios=[...['setup','location'].flatMap(path=>common.map(mode=>({id:path+'-'+mode,path,mode}))),
 ...['ancillary-failure','ancillary-obsolete','second-baseline','rounding-snapshot','picker-retry'].map(mode=>({id:'setup-'+mode,path:'setup',mode})),
 ...['same-world','picker-retry','handoff-cancel','handoff-obsolete','handoff-editor-regain'].map(mode=>({id:'location-'+mode,path:'location',mode}))];
const report={suite:'Campaign setup and ship-location completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:scenarios.length*sizes.length,cases:[],errors:[],scope:'Actual setup, cascading world picker and Find world starting-location handoff; independent lookup and versioned native Store save/publication/settlement boundaries; native Web Locks; huge exact Credit strings, opening Dashboard boundary, rich established freight/mail/passenger/cargo/insurance and consumed jump; known retry, retired ownership, terminal recovery, reload and actual History Undo at desktop/mobile widths. Disposable synthetic campaigns and intercepted map data only; no arbitrary provider or live-data certification.'};
let browser,evidenceBytes=0;
const syncControls=new Map();
const apiWorlds=[
 {Name:'Completion Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},
 {Name:'Completion Jenghe',Hex:'1810',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'},
 {Name:'Completion Far Haven',Hex:'0101',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-128,WorldY:-79,Sector:'Spinward Marches'},
 {Name:'Completion Far Neighbor',Hex:'0201',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-127,WorldY:-79,Sector:'Spinward Marches'}];
const worlds=apiWorlds.map(normalize),[origin,destination,target]=worlds;
const OPENING='9007199254740993123.01',ROUNDED='9007199254740993200';
const draft={name:'Disposable setup completion',ship:'Exact Credit Trader',bank:OPENING,capacity:'160.1',jump:'2',date:'017-1105','rooms-middle':'4','people-middle':'2',supportUnits:'80'};
const REASON='Synthetic chart correction; no travel or payment';
function freshFixture(){const s=S.initial();s.settings.creditStep=100;return S.validate(s);}
function richFixture(){
 let s=S.initial();Object.assign(s,{initialized:true,name:'Disposable established location campaign',actual:origin.id,worlds:Object.fromEntries(worlds.map(w=>[w.id,w])),route:[origin.id,destination.id,target.id],routeIndex:0,mandatoryStops:[destination.id,target.id],bank:'9007199254740993123',hours:24,dateLabel:'011-1105'});
 Object.assign(s.ship,{name:'Rich manifest trader',capacity:'160',armed:true,staterooms:4,fuel:configureFuel(200,40,40,40,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'100',denominator:'1'}},accommodation:{rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0},passengerCapacity:{reservedCabins:1,installedLowBerths:2}}});
 s.lots=[{id:'location-cargo',commodity:'11',description:'Retained exact cargo terms',quantity:'5',basis:'9007199254740993',goodsValue:'8007199254740993',world:origin.id,hours:12}];
 const offers=['high','middle','basic','low'].map(passageClass=>({offerId:'location-offer-'+passageClass,passageClass,count:2,origin:origin.id,destination:target.id,fare:'1001',audit:{manual:true,reason:'Synthetic retained fare'}}));
 s.events=[{id:'location-passenger-search',label:'Passenger search audit',world:origin.id,destination:target.id,hours:12,offers}];s.latestPassengerSearchId='location-passenger-search';
 s.contracts=[
 {id:'location-freight',kind:'freight',status:'accepted',origin:origin.id,destination:target.id,description:'Retained freight',quantity:'5',payment:'5001',dueHours:720,audit:{manual:true,reason:'Saved exact freight terms'}},
 {id:'location-mail',kind:'mail',status:'accepted',origin:origin.id,destination:target.id,description:'Retained mail',quantity:'5',payment:'25000',dueHours:null,firstDeparture:null},
 {id:'location-passenger',kind:'passenger',status:'accepted',passageClass:'middle',count:1,cabinMode:'private',serviceConfirmed:true,origin:origin.id,destination:target.id,acceptedHours:12,offerId:'location-offer-middle',searchId:'location-passenger-search',fare:'1001',payment:'1001',roundingStep:1,audit:{manual:true,reason:'Saved passenger terms'}}];
 s.policies=[{id:'location-active-policy',lotId:'location-cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'8007199254740993',remainingValue:'8007199254740993',coverage:70,premium:'12345',rate:2,distance:20,route:[origin.id,destination.id,target.id],routeProgress:0,destination:target.id,amendments:[]},
 {id:'location-closed-policy',lotId:'location-cargo',claims:[],status:'closed',initialQuantity:'1',remainingQuantity:'0',insuredValue:'1000',remainingValue:'0',coverage:70}];
 s.snapshots=[{id:'location-supplier',kind:'supplier',worldId:origin.id,hours:12,startedHours:12,party:'Retained supplier',offers:[{id:'location-stock',commodity:'11',description:'Retained offer',expired:false,remaining:'2',unitPrice:'1001'}]}];
 s.ledger=[{id:'location-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];s.dashboardBaseline=createDashboardBaseline(s);
 const jump=state=>{const p=S.prepareJump(state,()=>({dice:[3,3,3,3,3,3],total:18}));return S.transition(p.state,'Jump: '+origin.name+' → '+destination.name,next=>S.commitJump(next,{attemptId:p.attempt.id,elapsed:160}));};
 s=jump(S.undoJump(jump(s)));
 // Legacy stock has not yet been normalized. A location transition may anchor
 // these units, but must match the synchronous UI control exactly, not consume.
 s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};
 return S.validate(s);
}
const fresh=freshFixture(),rich=richFixture();
const seed=scenario=>structuredClone(scenario.path==='setup'?fresh:rich);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY),read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const gate=page=>page.evaluate(()=>worldGate.snapshot());
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const tab=(page,name)=>page.locator('#tabs [data-action="tab"][data-arg="'+name+'"]').click();
const successPattern=/Campaign setup saved\.|Ship location set: .* saved\./;
const errorText=error=>error?.stack||String(error);
const formValues=page=>page.locator('#modal-form [name]').evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.name,el.type==='checkbox'?el.checked:el.value])));
function assertSetup(saved,before,{bank=ROUNDED,capacity='161',date=draft.date,bankInput=OPENING}={}){
 assert.equal(saved.initialized,true);assert.equal(saved.bank,bank);assert.equal(saved.ship.capacity,capacity);assert.equal(saved.name,draft.name);assert.equal(saved.ship.name,draft.ship);assert.equal(saved.actual,origin.id);assert.deepEqual(saved.route,[origin.id]);assert.equal(saved.hours,before.hours);assert.equal(saved.dateLabel,date);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 const opening=saved.ledger.filter(e=>e.type==='Opening bank');assert.equal(opening.length,1);assert.equal(opening[0].amount,bank);assert.equal(saved.events.filter(e=>e.label==='Campaign setup').length,before.events.filter(e=>e.label==='Campaign setup').length+1);
 assert.deepEqual(saved.dashboardBaseline,createDashboardBaseline(saved,'opening'));assert.deepEqual(saved.dashboardBaseline.excludedLedgerIds,[opening[0].id]);assert.equal(dashboardData(saved).operatingResult,'0');assert.equal(dashboardData(saved).otherInflows,'0');assert.equal(dashboardData(saved).adjustment,'0');
 const rounding=saved.events.filter(e=>e.label==='Rounding applied [R]').at(-1);assert.ok(rounding);assert.equal(rounding.roundingStep,100);assert.ok(rounding.roundingChanges.some(c=>c.before===bankInput&&c.after===bank),'Exact huge Credit annotation survives asynchronous lookup');assert.ok(rounding.roundingChanges.some(c=>c.before==='160.1'&&c.after==='161'));
}
function locationExpected(before){return S.transition(before,'Ship location set: '+target.name,s=>{s.actual=target.id;s.route=[target.id];s.routeIndex=0;s.mandatoryStops=[];s.events.push({id:S.uid(),label:'Starting-world / location correction',from:before.actual,to:target.id,reason:REASON,hours:s.hours});for(const p of s.policies.filter(p=>p.status==='active'))p.status='amendment-required';});}
function assertLocation(saved,before,viewport){
 const expected=locationExpected(before);assert.equal(saved.revision,before.revision+1);assert.equal(saved.actual,target.id);assert.deepEqual(saved.route,[target.id]);assert.equal(saved.routeIndex,0);assert.deepEqual(saved.mandatoryStops,[]);assert.equal(saved.undo.length,before.undo.length+1);
 for(const key of ['bank','hours','dateLabel','lots','contracts','snapshots','ledger','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' cannot change during a location correction');
 assert.deepEqual(saved.jumpAttempts,expected.jumpAttempts,'A location correction closes the prior attempt without changing saved rolls or consumed mulligan');assert.deepEqual(saved.jumpAttempts.map(a=>({rolls:a.rolls,mulliganUsed:a.mulliganUsed})),before.jumpAttempts.map(a=>({rolls:a.rolls,mulliganUsed:a.mulliganUsed})));assert.deepEqual(saved.ship,expected.ship,'Only existing synchronous LSS normalization is permitted');assert.deepEqual(saved.policies,expected.policies,'Only active insurance status becomes amendment-required');
 if(viewport&&syncControls.has(viewport.width))assert.deepEqual(saved.ship,syncControls.get(viewport.width).ship,'Delayed location LSS matches actual synchronous UI control');
 assert.deepEqual(saved.events.slice(0,before.events.length),before.events);const correction=saved.events.filter(e=>e.label==='Starting-world / location correction');assert.equal(correction.length,1);assert.equal(correction[0].from,before.actual);assert.equal(correction[0].to,target.id);assert.equal(correction[0].hours,before.hours);assert.equal(correction[0].reason,REASON);assert.equal(S.jumpUndoEligibility(saved).allowed,false);assert.equal(saved.jumpAttempts.at(-1).mulliganUsed,true);
}
const assertSaved=(saved,before,scenario,viewport)=>scenario.path==='setup'?assertSetup(saved,before):assertLocation(saved,before,viewport);

// A network fixture can delay/fail one exact request independently of Store.
// It never replaces picker, resolve(), nearby(), app callbacks or their Promises.
function networkFixture(result){
 let armed=null,pending=null;
 return {
  arm(kind,{hold=false,fail=false,x=null}={}){assert.equal(armed,null);assert.equal(pending,null);let ready;const reached=new Promise(resolve=>ready=resolve);armed={kind,hold,fail,x,ready,reached};return reached;},
  async wait(reached){let timeout;try{await Promise.race([reached,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Synthetic map boundary was not reached')),10000);})]);}finally{clearTimeout(timeout);}},
  release(){assert.ok(pending,'Expected one held map request');const p=pending;pending=null;p.resolve();},
  get pending(){return !!pending;},
  async route(route){const url=new URL(route.request().url()),kind=url.pathname.endsWith('/metadata')?'catalog':url.pathname.endsWith('/jumpworlds')?(url.searchParams.get('jump')==='0'?'world':'nearby'):null;
   if(armed&&armed.kind===kind&&(armed.x===null||url.searchParams.get('x')===String(armed.x))){const a=armed;armed=null;result.lookupBoundaries.push({kind,url:url.href,hold:a.hold,fail:a.fail});if(a.hold){const wait=new Promise(resolve=>pending={resolve});a.ready();await wait;}else a.ready();if(a.fail){result.expectedHTTPFailures.push(url.href);return route.fulfill({status:503,body:'Synthetic map lookup unavailable',headers:{'Access-Control-Allow-Origin':'*'}});}}
   const headers={'Access-Control-Allow-Origin':'*'};
   if(url.pathname.endsWith('/universe'))return route.fulfill({headers,json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin',X:-4,Y:-1,Milieu:'M1105'}]}});
   if(url.pathname.endsWith('/metadata'))return route.fulfill({headers,json:{Subsectors:Array.from({length:16},(_,i)=>({Index:String.fromCharCode(65+i),Name:'Completion subsector '+String.fromCharCode(65+i)}))}});
   if(url.pathname.endsWith('/sec'))return route.fulfill({headers,json:'Hex\tName\n'+apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n')});
   if(url.pathname.endsWith('/jumpworlds')){const zero=url.searchParams.get('jump')==='0',hex=url.searchParams.get('hex');return route.fulfill({headers,json:{Worlds:zero?apiWorlds.filter(w=>hex?w.Hex===hex:w.WorldX===Number(url.searchParams.get('x'))&&w.WorldY===Number(url.searchParams.get('y'))):apiWorlds}});}
   result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
  }
 };
}
async function contextFor(result,scenario){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);const net=networkFixture(result);
 context.on('page',page=>{page.on('pageerror',e=>result.pageErrors.push(errorText(e)));page.on('console',entry=>{if(entry.type()==='error')result.consoleErrors.push({text:entry.text(),url:entry.location().url});});page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')result.networkErrors.push(request.url()+': '+request.failure()?.errorText);});page.on('response',response=>{if(response.status()>=400)result.httpErrors.push({status:response.status(),url:response.url()});});});
 await context.exposeBinding('__worldUnhandled',(_source,message)=>result.unhandledRejections.push(message));
 await context.addInitScript(({key,bytes,origin})=>{if(location.origin!==origin)return;addEventListener('unhandledrejection',event=>{void globalThis.__worldUnhandled(String(event.reason?.stack||event.reason));});if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  // Count only the real scheduled paint callback. Its body and scheduler run
  // unchanged; the postpublication resize probe must actually reach it.
  const nativeRAF=window.requestAnimationFrame;globalThis.worldMapPaint={scheduled:0,executed:0};
  window.requestAnimationFrame=function(callback){if(!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback)))return Reflect.apply(nativeRAF,this,[callback]);worldMapPaint.scheduled++;return Reflect.apply(nativeRAF,this,[time=>{worldMapPaint.executed++;return callback(time);}]);};
  const nativeSet=Storage.prototype.setItem;globalThis.worldStorage={attempts:0,writes:0,failNext:false,observations:[]};
  Storage.prototype.setItem=function(name,value){if(this!==localStorage||name!==key)return Reflect.apply(nativeSet,this,[name,value]);worldStorage.attempts++;worldStorage.observations.push({message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#modal')?.open,submitDisabled:!!document.querySelector('#modal-submit')?.disabled});if(worldStorage.failNext){worldStorage.failNext=false;throw Error('Synthetic known world prewrite rejection');}const result=Reflect.apply(nativeSet,this,[name,value]);worldStorage.writes++;return result;};
 },{key:KEY,bytes:JSON.stringify(seed(scenario)),origin:new URL(base).origin});
 await context.route('**/*',async route=>{try{const url=new URL(route.request().url());if(url.href===new URL('verification/world-completion-peer.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable world completion lock peer</title>'});if(url.origin===new URL(base).origin)return route.continue();if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){assert.equal(url.searchParams.get('milieu'),'M1105');return await net.route(route);}result.unexpectedRequests.push(url.href);return await route.abort('blockedbyclient');}catch(error){result.fixtureErrors.push(errorText(error));await route.abort('failed').catch(()=>{});}});
 return {context,net};
}
async function installGate(page,result){
 result.runtime=await page.evaluate(async()=>{
  const appURL=[...document.scripts].find(script=>script.type==='module'&&/\/app\.mjs(?:\?|$)/.test(script.src))?.src;if(!appURL)throw Error('Actual app module unavailable');
  const response=await fetch(appURL);if(!response.ok)throw Error('Cannot inspect runtime app module');const source=await response.text(),specifier=source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];if(!specifier)throw Error('Actual Store import missing');
  const storeURL=new URL(specifier,appURL).href;if(!new URL(storeURL).search)throw Error('Store must be discovered with its production cache tag');
  const {Store,KEY}=await import(storeURL),nativeSave=Store.prototype.save,nativeRead=Store.prototype.read;
  const g=globalThis.worldGate={armed:false,store:null,pending:null,args:null,calls:0,executions:0,notifyFault:null,cleanupFault:null,freezeFault:false,constructionFault:null,faults:[],candidates:[],forwarded:[],publications:[],settlements:[],observations:[],reentrant:[],oldSubmit:null,form:null,mainNodes:null,mainHTML:null,fields:null,domBaseline:null,domBaselinePhase:null,beforeWriteDOMDiff:null,domMutations:[]};
  const observation=point=>({point,message:document.querySelector('#message')?.textContent||'',title:document.querySelector('#modal-title')?.textContent||'',open:!!document.querySelector('#modal')?.open,submitDisabled:!!document.querySelector('#modal-submit')?.disabled,revision:JSON.parse(localStorage.getItem(KEY)).revision});
  const completed=()=>g.settlements.at(-1)?.kind==='native-fulfilled';
  const text=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(Node.prototype,'textContent',{...text,set(value){
   if(g.constructionFault&&this.id==='modal-title'&&value===g.constructionFault){g.constructionFault=null;g.faults.push('partial-modal');throw Error('Synthetic world modal construction failure');}
   if(g.cleanupFault==='report'&&this.id==='message'&&/Campaign setup saved\.|Ship location set: .* saved\./.test(value)){g.cleanupFault=null;g.faults.push('report');throw Error('Synthetic world completion reporting failure');}
   return Reflect.apply(text.set,this,[value]);
  }});
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){if(g.cleanupFault==='render'&&this.id==='main'&&completed()){g.cleanupFault=null;g.faults.push('render');throw Error('Synthetic world completion render failure');}return Reflect.apply(html.set,this,[value]);}});
  const disabled=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'disabled');Object.defineProperty(HTMLInputElement.prototype,'disabled',{...disabled,set(value){if(g.freezeFault&&value&&['name','reason'].includes(this.name)&&this.closest('#modal-form')){g.freezeFault=false;g.faults.push('freeze-fault');throw Error('Synthetic prepared controls freeze failure');}return Reflect.apply(disabled.set,this,[value]);}});
  const close=HTMLDialogElement.prototype.close;HTMLDialogElement.prototype.close=function(...args){if(g.cleanupFault==='close'&&this.id==='modal'&&completed()){g.cleanupFault=null;g.faults.push('close');throw Error('Synthetic world native close failure');}return Reflect.apply(close,this,args);};
  const filter=Array.prototype.filter;Array.prototype.filter=function(...args){if(g.cleanupFault==='cleanup'&&completed()&&new Error().stack?.includes('syncMailCheck')){g.cleanupFault=null;g.faults.push('cleanup');throw Error('Synthetic world draft cleanup failure');}return Reflect.apply(filter,this,args);};
  function observeStore(store){
   if(g.store===store)return;if(g.store)throw Error('Unexpected second app Store');g.store=store;const change=store.onChange;
   store.onChange=function(...args){
    const ownedAttempt=args[1]?.saveToken!=null&&args[1].saveToken===g.args?.[2],record={revision:args[0].revision,tokenPresent:args[1]?.saveToken!=null,tokenMatchesSave:ownedAttempt,actualCallback:false};g.publications.push(record);g.observations.push(observation('before-publication'));
    if(ownedAttempt){
     if(g.notifyFault==='notification-before'){g.notifyFault=null;throw Error('Synthetic world notification before publication');}
     if(g.notifyFault==='missing-publication'){g.notifyFault=null;return;}
     if(g.notifyFault==='missing-token'){args=[args[0],{}];g.notifyFault=null;}
     if(g.notifyFault==='wrong-token'){args=[args[0],{saveToken:{syntheticWrongToken:true}}];g.notifyFault=null;}
     if(g.notifyFault==='wrong-revision'){args=[{...args[0],revision:args[0].revision+1},args[1]];g.notifyFault=null;}
    }
    const result=Reflect.apply(change,this,args);record.actualCallback=true;g.observations.push(observation('after-publication'));
    if(ownedAttempt&&g.notifyFault==='notification-after'){g.notifyFault=null;throw Error('Synthetic world notification after publication');}
    return result;
   };
  }
  Store.prototype.read=function(...args){observeStore(this);return Reflect.apply(nativeRead,this,args);};
  Store.prototype.save=function(...args){
   observeStore(this);g.args=args;if(!g.armed)return Reflect.apply(nativeSave,this,args);
   if(g.pending)throw Error('Duplicate world Store.save while pending');g.calls++;g.candidates.push(JSON.stringify(args[0]));g.forwarded.push({argumentCount:args.length,expectedRevision:args[1],candidateRevision:args[0].revision,tokenPresent:args[2]!=null});
   const before=observation('provider-entry'),form=document.querySelector('#modal-form');document.querySelector('#notes').click();form.requestSubmit();g.oldSubmit?.({preventDefault(){},currentTarget:form});
   g.reentrant.push({sameTitle:document.querySelector('#modal-title').textContent===before.title,sameOpen:document.querySelector('#modal').open===before.open,sameForm:document.querySelector('#modal-form')===form});
   return new Promise((resolve,reject)=>{g.pending={store:this,args,resolve,reject,executed:false,error:null,result:undefined};});
  };
  const regionSelectors=['.world-map','#map-load-status','.planned-route','#world-information-panel','#overview-navigation'];
  const captureDOM=()=>{const main=document.querySelector('#main');return {nodes:[...main.childNodes],html:main.innerHTML,regions:regionSelectors.map(selector=>{const node=document.querySelector(selector);return {selector,node,html:node?.outerHTML??null};})};};
  const difference=(before,after)=>{if(before===after)return null;before=before??'';after=after??'';let at=0;while(at<Math.min(before.length,after.length)&&before[at]===after[at])at++;return {firstChangedOffset:at,beforeLength:before.length,afterLength:after.length,before:before.slice(Math.max(0,at-80),at+160),after:after.slice(Math.max(0,at-80),at+160)};};
  const describeDOM=()=>{if(!g.domBaseline)return null;const current=captureDOM(),old=g.domBaseline;return {sameChildren:old.nodes.length===current.nodes.length&&old.nodes.every((node,i)=>node===current.nodes[i]),main:difference(old.html,current.html),regions:old.regions.flatMap((before,i)=>{const after=current.regions[i],html=difference(before.html,after.html);return before.node!==after.node||html?[{selector:before.selector,sameNode:before.node===after.node,html}]:[];})};};
  const describeNode=node=>node.nodeType===1?node.tagName.toLowerCase()+(node.id?'#'+node.id:'')+(typeof node.className==='string'&&node.className?'.'+node.className.trim().replace(/\s+/g,'.'):''):node.nodeName;
  const mutations=new MutationObserver(records=>{for(const record of records){if(g.domMutations.length>=30)break;g.domMutations.push({type:record.type,target:describeNode(record.target),attribute:record.attributeName,added:[...record.addedNodes].slice(0,4).map(describeNode),removed:[...record.removedNodes].slice(0,4).map(describeNode)});}});
  g.rememberDOM=phase=>{mutations.disconnect();g.domBaseline=captureDOM();g.mainNodes=g.domBaseline.nodes;g.mainHTML=g.domBaseline.html;g.domBaselinePhase=phase;g.domMutations=[];mutations.observe(document.querySelector('#main'),{subtree:true,childList:true,characterData:true,attributes:true});};
  g.write=()=>{const p=g.pending;if(!p||p.executed)throw Error('Native world save must execute exactly once');g.beforeWriteDOMDiff=describeDOM();g.rememberDOM('immediately-before-native-write');p.executed=true;g.executions++;try{p.result=Reflect.apply(nativeSave,p.store,p.args);}catch(error){p.error=error;}};
  g.release=(kind='native')=>{
   const p=g.pending;if(!p)throw Error('No pending world save');
   if(kind==='unknown-before'){g.pending=null;g.settlements.push({kind,executed:false});p.reject(Error('Synthetic unknown world save outcome'));return;}
   if(!p.executed)g.write();g.pending=null;
   if(kind==='unknown-after'||kind==='contradictory'){g.settlements.push({kind,executed:true});p.reject(kind==='contradictory'?Object.assign(Error('Synthetic contradictory prewrite result'),{code:'SAVE_NOT_COMMITTED',committed:false}):Error('Synthetic lost world save response'));}
   else if(p.error){g.settlements.push({kind:'native-rejected',code:p.error.code??null,committed:p.error.committed??null});p.reject(p.error);}
   else{g.settlements.push({kind:'native-fulfilled',executed:true});p.resolve(p.result);}
  };
  g.remember=()=>{g.form=document.querySelector('#modal-form');g.oldSubmit=g.form.onsubmit;g.rememberDOM('review-before-lookup');g.fields=[...g.form.querySelectorAll('[name]')].map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]);};
  g.snapshot=()=>({calls:g.calls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,storage:{...worldStorage},candidates:g.candidates,forwarded:g.forwarded,publications:g.publications,settlements:g.settlements,observations:g.observations,reentrant:g.reentrant,faults:g.faults,mapPaint:{...worldMapPaint},domBaselinePhase:g.domBaselinePhase,beforeWriteDOMDiff:g.beforeWriteDOMDiff,domDiff:describeDOM(),domMutations:g.domMutations,mainSame:g.mainNodes?g.mainNodes.length===document.querySelector('#main').childNodes.length&&g.mainNodes.every((node,i)=>node===document.querySelector('#main').childNodes[i])&&g.mainHTML===document.querySelector('#main').innerHTML:null,durableToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  // Attach observations to the existing app Store without replacing its body,
  // manufacturing a save, or exporting private app functions for the test.
  dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:localStorage.getItem(KEY)}));
  return {appURL,storeURL};
 });
}
const release=(page,kind='native')=>page.evaluate(kind=>worldGate.release(kind),kind);
const foreign=page=>page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
async function arm(page,mode){await page.evaluate(mode=>{worldGate.armed=true;worldGate.notifyFault=['notification-before','notification-after','missing-publication','missing-token','wrong-token','wrong-revision'].includes(mode)?mode:null;worldStorage.failNext=mode==='prewrite';worldGate.freezeFault=mode==='freeze-fault';},mode);}
async function capture(page,result,label){
 // A CSS-visible node can still be below the fold of the tall setup dialog.
 // Scroll the actual warning/recovery controls into the evidence, then verify
 // their geometry before taking a viewport image.
 let focus=null;
 if(/terminal-reload-warning|retryable|validation-retained/.test(label))focus=await page.locator('#modal').isVisible()?'#modal-error':'#message';
 else if(label==='retired-owner-before-recovery'&&await page.locator('#modal-error').textContent())focus='#modal-error';
 else if(label==='partial-modal-submit-safe')focus=await page.locator('#modal').isVisible()?'#modal-title':'#message';
 else if(/ancillary-warning|saved-before-ancillary|synchronous-control|^completed$/.test(label))focus='#message';
 else if(label==='controls-recovered-before-revert')focus='#settings-reset';
 else if(label==='fresh-setup-recovery')focus='#modal [name="name"]';
 else if(label==='picker-503')focus=(result.path==='setup'?'#setup-world':'#find-world')+' button';
 else if(/^saving|^lookup$|handoff-lookup|durable-awaiting-settlement/.test(label))focus='#modal-submit';
 if(focus){const locator=page.locator(focus).filter({visible:true}).first();await locator.scrollIntoViewIfNeeded();const rect=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog')?.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,dialog:d?{top:d.top,bottom:d.bottom}:null};});assert.ok(rect.width>0&&rect.height>0&&rect.top>=-1&&rect.bottom<=rect.viewportHeight+1&&rect.left>=-1&&rect.right<=rect.viewportWidth+1,'Evidence target '+focus+' is actually in viewport');if(rect.dialog)assert.ok(rect.top>=rect.dialog.top-1&&rect.bottom<=rect.dialog.bottom+1,'Evidence target lies within visible dialog');result.evidenceTargets.push({label,selector:focus,...rect});}
 await frames(page);const geometry=await page.evaluate(()=>{const dialog=document.querySelector('#modal[open]'),r=dialog?.getBoundingClientRect();return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:r?{left:r.left,right:r.right,overflow:dialog.scrollWidth-dialog.clientWidth}:null};});result.layouts.push({label,...geometry});
 assert.ok(geometry.pageOverflow<=2,'No horizontal page overflow');if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,'Dialog remains in viewport');assert.ok(geometry.dialog.overflow<=2,'No horizontal dialog clipping');}
 // Keep the state matrix and every geometry assertion. Repeated healthy
 // saving/reload screens add no evidence to distinct terminal/retirement views.
 const core=['sync','success','validation','prewrite','lookup-delay','lookup-failure','freeze-fault','second-baseline','rounding-snapshot','picker-retry'];
 if(label==='saving'&&!['success','prewrite','ancillary-failure'].includes(result.mode))return;
 if(label==='lookup'&&!['lookup-delay','lookup-foreign'].includes(result.mode))return;
 if(label==='completed'&&!core.includes(result.mode))return;
 if(['reload-and-history-undo','authoritative-reload'].includes(label)&&!['sync','success','unknown-before','unknown-after','second-baseline'].includes(result.mode))return;
 const bytes=await page.screenshot({type:'jpeg',quality:70});assert.ok(evidenceBytes+bytes.length<20*1024*1024,'Readable JPEG evidence leaves 4 MiB for report within 24 MiB total');
 const name=prefix+result.id+'-'+label+'.jpg';await writeFile(join(artifacts,name),bytes);evidenceBytes+=bytes.length;result.screenshots.push({name,bytes:bytes.length});
}
async function pointer(page,id){const button=page.locator('#'+id);if(!await button.isVisible())return;await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{clickCount:2,delay:20});}
async function noNavigationReplay(page,result,{detached=true,label='native requestSubmit'}={}){
 const navigations=[],listen=frame=>{if(frame===page.mainFrame())navigations.push(frame.url());};page.on('framenavigated',listen);
 try{await page.evaluate(detached=>{const form=document.querySelector('#modal-form');form.requestSubmit();if(detached)void worldGate.oldSubmit?.({preventDefault(){},currentTarget:worldGate.form||form});},detached);await frames(page);assert.deepEqual(navigations,[],label+' cannot submit the document or navigate');}
 finally{page.off('framenavigated',listen);result.navigationProbes.push({label,navigations});}
}
async function fill(page,name,value){const field=page.locator('#modal [name="'+name+'"]');await field.fill(String(value));await field.dispatchEvent('change');}
async function choose(page,hex){const picker=page.locator('#find-world');await picker.getByLabel('Sector',{exact:true}).selectOption('Spinward Marches');const subsector=Number(hex.slice(0,2))<=8?'A':'C';await picker.getByLabel('Subsector',{exact:true}).selectOption(subsector);await picker.getByLabel('World',{exact:true}).selectOption(hex);await picker.locator('.picker-selection').filter({hasText:'Hex '+hex}).waitFor();}
async function openFind(page,hex=target.hex){await action(page,'find').click();await page.locator('#find-world .picker-selection').filter({hasText:/Hex \d{4}/}).waitFor();await choose(page,hex);}
async function prepare(page,scenario,overrides={}){
 if(scenario.path==='setup'){
  await action(page,'setup').click();await page.locator('#setup-world .picker-selection').filter({hasText:'Hex 1910'}).waitFor();for(const [name,value]of Object.entries({...draft,...overrides}))await fill(page,name,value);
 }else{
  await openFind(page);await page.locator('#choose-starting-world').click();await page.locator('#modal-title').filter({hasText:'Set ship location'}).waitFor();await fill(page,'reason',REASON);
 }
 await page.evaluate(()=>worldGate.remember());return formValues(page);
}
async function start(page){await page.locator('#modal-submit').click();}
async function pending(page,result,scenario,before){
 await start(page);await page.waitForFunction(()=>!!worldGate.pending);await frames(page);assert.equal(await raw(page),before);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' disabled while saving');
 assert.equal(await page.locator('#modal-body input:enabled,#modal-body select:enabled,#modal-body textarea:enabled,#modal-body button:enabled').count(),0,'All original fields are frozen only once saving begins');
 const values=await formValues(page),title=await page.locator('#modal-title').textContent();await pointer(page,'modal-submit');await page.keyboard.press('Enter');await noNavigationReplay(page,result);await pointer(page,'modal-cancel');await pointer(page,'modal-close');await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#notes').click();document.querySelector('[data-action="find"]')?.click();document.querySelector('#tabs [data-arg="Settings"]')?.click();});await frames(page);
 assert.equal((await gate(page)).calls,1);assert.deepEqual((await gate(page)).reentrant,[{sameTitle:true,sameOpen:true,sameForm:true}]);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await page.locator('#modal-title').textContent(),title);assert.deepEqual(await formValues(page),values);assert.equal(await raw(page),before);
 await capture(page,result,'saving');result.checks.push('Saving blocks actual repeated pointer, Enter, native requestSubmit, detached callback, reentrant Notes/navigation, field edits, Cancel, Close and Escape');
}
async function editorRegain(page,result,context){
 const peer=await context.newPage();await peer.goto(new URL('verification/world-completion-peer.html',base).href);
 await peer.evaluate(async({storeURL})=>{const {Store}=await import(storeURL);globalThis.worldPeer={editable:false};worldPeer.store=new Store(()=>{},editable=>worldPeer.editable=editable);await worldPeer.store.acquire(true);},result.runtime);await peer.waitForFunction(()=>worldPeer.editable);await page.waitForFunction(()=>worldGate.store.editable===false);
 await peer.evaluate(()=>{worldPeer.store.yield();worldPeer.store.channel?.close();});await peer.close();await page.evaluate(()=>worldGate.store.acquire(true));await page.waitForFunction(()=>worldGate.store.editable===true);result.checks.push('Actual second Store takes native Web Lock and production role callbacks run on loss and regain');
}
async function newerDisk(page,result,{publish=true}={}){
 await page.evaluate(async({storeURL,key,publish})=>{const url=new URL('state.mjs',storeURL);url.search=new URL(storeURL).search;const S=await import(url.href),current=worldGate.store.read(),next=S.transition(current,'Synthetic external newer campaign',state=>{state.name='Newer disk campaign';});localStorage.setItem(key,JSON.stringify(next));if(publish)dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)}));},{...result.runtime,key:KEY,publish});
}
async function reloadUndo(page,result,scenario,before,{committed=true,undo=true}={}){
 const bytes=await raw(page),saved=JSON.parse(bytes);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes,'Reload never repeats setup/location');assert.equal(await page.evaluate(()=>worldStorage.writes),0);
 if(committed)assertSaved(await read(page),before,scenario,result.viewport);else assert.deepEqual(await read(page),before);
 if(committed&&undo){
  const expected=S.undo(saved);await tab(page,'History');await action(page,'undo').click();await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:KEY,revision:expected.revision});await closed(page);const undone=await read(page);expected.events.at(-1).id=undone.events.at(-1).id;assert.deepEqual(undone,expected,'Actual History Undo restores precise inverse, preserving audit/baseline and consumed jump');assert.equal(await page.evaluate(()=>worldStorage.writes),1);assert.equal(undone.bank,before.bank);assert.deepEqual(undone.ledger,before.ledger);
  if(scenario.path==='setup'){assert.equal(undone.initialized,false);assert.deepEqual(undone.dashboardBaseline,saved.dashboardBaseline,'Undo preserves original boundary until a second setup replaces it');}
  else{for(const key of ['ship','lots','contracts','policies','route','actual','hours','dashboardBaseline'])assert.deepEqual(undone[key],before[key],key+' restored by History Undo');assert.equal(undone.jumpAttempts.at(-1).mulliganUsed,true);assert.equal(undone.jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(undone).allowed,false);}
 }
 await capture(page,result,committed&&undo?'reload-and-history-undo':'authoritative-reload');result.checks.push('Authoritative reload has zero writes; real History Undo restores the exact inverse without resetting consumed jump or opening baseline');return read(page);
}
async function success(page,result,scenario,before,{recovery=true}={}){
 await closed(page);await frames(page);const snapshot=await gate(page),saved=await read(page);assertSaved(saved,before,scenario,result.viewport);assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.match(await page.locator('#message').textContent(),successPattern);
 for(const entry of snapshot.forwarded){assert.ok(entry.argumentCount>=3);assert.equal(entry.tokenPresent,true);assert.equal(entry.expectedRevision,before.revision);assert.equal(entry.candidateRevision,before.revision+1);}
 for(const entry of [...snapshot.observations,...snapshot.storage.observations])assert.doesNotMatch(entry.message,successPattern,'Save success is never reported before publication and settlement');
 const bytes=await raw(page),calls=snapshot.calls;await noNavigationReplay(page,result,{label:'completed detached callback'});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,calls);result.gate=await gate(page);await capture(page,result,'completed');if(recovery)await reloadUndo(page,result,scenario,before);
}
async function terminal(page,result,scenario,before,{committed=true}={}){
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#save-status').textContent));await frames(page);const snapshot=await gate(page);assert.equal(snapshot.editable,false);assert.equal(snapshot.reloadRequired,true);assert.equal(await page.locator('#takeover').isDisabled(),true);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);assert.match(await page.locator('#message').textContent(),/Reload/i);
 if(committed)assertSaved(await read(page),before,scenario,result.viewport);else assert.deepEqual(await read(page),before);assert.equal(snapshot.storage.writes,committed?1:0);
 if(await page.locator('#modal').isVisible()){assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/Reload/i);for(const id of ['modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true,'Recovery dismissal must be available');}
 const bytes=await raw(page),calls=snapshot.calls;await noNavigationReplay(page,result,{label:'terminal native requestSubmit'});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,calls);
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(item=>item.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true);
 // Capture the actual warning, not just the later restored healthy campaign.
 await capture(page,result,'terminal-reload-warning');await page.evaluate(()=>{worldGate.store.yield();});assert.match(await page.locator('#save-status').textContent(),/Reload/i);if(await page.locator('#modal').isVisible()){await page.locator('#modal-cancel').click();await closed(page);}assert.equal(await page.locator('[data-mutate]:enabled').count(),0);result.gate=await gate(page);
 result.checks.push('Terminal/contradictory result latches reload-only before reporting, releases native writer lock, blocks native and detached replay, and allows safe dismissal');await reloadUndo(page,result,scenario,before,{committed});
}
async function lookupCase(page,result,scenario,before,net,context){
 const bytes=await raw(page),kind=scenario.path==='setup'?'world':'nearby',mode=scenario.mode;
 const reached=net.arm(kind,{hold:mode!=='lookup-failure',fail:mode==='lookup-failure',x:kind==='nearby'?target.x:null});await start(page);await net.wait(reached);await frames(page);
 assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);for(const id of ['modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true,'Lookup remains dismissible before a prepared save');
 if(mode==='lookup-failure'){
  await page.locator('#modal-error').filter({hasText:/503/}).waitFor();assert.equal(await page.locator('#modal-submit').isEnabled(),true);const retained=await formValues(page);assert.equal(retained[scenario.path==='setup'?'name':'reason'],scenario.path==='setup'?draft.name:REASON);assert.equal((await gate(page)).calls,0,'Map failure is not a provider failure');await capture(page,result,'lookup-retryable');
  const field=scenario.path==='setup'?'name':'reason';await fill(page,field,'Corrected draft after failed lookup');await fill(page,field,scenario.path==='setup'?draft.name:REASON);await start(page);await page.waitForFunction(()=>!!worldGate.pending);await release(page);await success(page,result,scenario,before);result.checks.push('503 before save retains editable fields and permits corrected retry with zero provider calls on failure');return;
 }
 await capture(page,result,'lookup');
 if(mode==='lookup-delay'){
  const fields=await formValues(page);await noNavigationReplay(page,result,{label:'lookup duplicate submit'});assert.equal((await gate(page)).calls,0);assert.deepEqual(await formValues(page),fields);net.release();await page.waitForFunction(()=>!!worldGate.pending);await capture(page,result,'saving-after-lookup');await release(page);await success(page,result,scenario,before);return;
 }
 if(['lookup-cancel','lookup-close','lookup-escape'].includes(mode)){if(mode==='lookup-escape')await page.keyboard.press('Escape');else await page.locator(mode==='lookup-close'?'#modal-close':'#modal-cancel').click();await closed(page);}
 else if(mode==='lookup-foreign')await foreign(page);
 else if(mode==='lookup-editor-regain')await editorRegain(page,result,context);
 else if(mode==='lookup-newer-dialog'){await page.locator('#modal-cancel').click();await closed(page);await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();}
 const newer=mode==='lookup-newer-dialog'?await page.locator('#modal-body').innerHTML():null;net.release();await frames(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,0);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 await noNavigationReplay(page,result,{label:'retired lookup detached submit'});assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);
 if(newer!==null){assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),newer);assert.equal(await page.locator('#modal-error').textContent(),'');}
 else if(['lookup-foreign','lookup-editor-regain'].includes(mode)){assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/changed|editing|reopen/i);}
 else assert.equal(await page.locator('#modal').isVisible(),false);
 result.gate=await gate(page);await capture(page,result,'retired-lookup');result.checks.push('Dismissed or obsolete lookup never saves, reports stale errors, hands off to location, or closes a newer dialog');
}
async function handoffCase(page,result,scenario,before,net,context){
 const bytes=await raw(page);await openFind(page,scenario.mode==='same-world'?before.worlds[before.actual].hex:target.hex);
 if(scenario.mode==='same-world'){
  const reached=net.arm('nearby',{hold:true,x:before.worlds[before.actual].x});await page.locator('#choose-starting-world').click();await net.wait(reached);assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);net.release();await page.locator('#message').filter({hasText:'Live nearby worlds loaded.'}).waitFor();assert.equal((await gate(page)).calls,0);assert.equal(await page.evaluate(()=>worldStorage.writes),0);assert.equal(await raw(page),bytes);await capture(page,result,'same-world-no-write');return;
 }
 const reached=net.arm('world',{hold:true});await page.locator('#choose-starting-world').click();await net.wait(reached);assert.equal(await page.locator('#choose-starting-world').isDisabled(),true);assert.equal((await gate(page)).calls,0);await capture(page,result,'handoff-lookup');
 if(scenario.mode==='handoff-cancel'){await page.locator('#modal-cancel').click();await closed(page);await page.locator('#notes').click();}
 else if(scenario.mode==='handoff-editor-regain')await editorRegain(page,result,context);else await foreign(page);
 const title=await page.locator('#modal-title').textContent(),body=await page.locator('#modal-body').innerHTML();net.release();await frames(page);await frames(page);
 assert.equal(await page.locator('#modal-title').textContent(),title);assert.equal(await page.locator('#modal-body').innerHTML(),body);assert.notEqual(title,'Set ship location');assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,0);
 if(scenario.mode!=='handoff-cancel')assert.equal(await page.locator('#choose-starting-world').isDisabled(),true);await capture(page,result,'retired-handoff');result.checks.push('Find-world mutation handoff remains bound to original campaign/editor/session, even when same revision or editing is reacquired');
}
async function pickerRetry(page,result,scenario,before,net){
 const bytes=await raw(page),reached=net.arm('catalog',{fail:true});await action(page,scenario.path==='setup'?'setup':'find').click();await net.wait(reached);const host=page.locator(scenario.path==='setup'?'#setup-world':'#find-world');await host.getByRole('button',{name:'Retry loading',exact:true}).waitFor();assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);await capture(page,result,'picker-503');await host.getByRole('button',{name:'Retry loading',exact:true}).click();await host.locator('.picker-selection').filter({hasText:/Hex \d{4}/}).waitFor();
 if(scenario.path==='setup'){for(const [name,value]of Object.entries(draft))await fill(page,name,value);}else{await choose(page,target.hex);await page.locator('#choose-starting-world').click();await page.locator('#modal-title').filter({hasText:'Set ship location'}).waitFor();await fill(page,'reason',REASON);}
 await page.evaluate(()=>worldGate.remember());await pending(page,result,scenario,bytes);await release(page);await success(page,result,scenario,before);result.checks.push('Actual cascading picker 503 and Retry loading run inside this exact-head desktop/mobile matrix');
}
async function partialModal(page,result,scenario,before){
 if(scenario.path==='location')await openFind(page);
 await page.locator('#modal-form').evaluate(form=>{form.onsubmit=null;});
 await page.evaluate(title=>worldGate.constructionFault=title,scenario.path==='setup'?'Start your campaign':'Set ship location');
 if(scenario.path==='setup')await action(page,'setup').click();else await page.locator('#choose-starting-world').click();await page.waitForFunction(()=>worldGate.faults.includes('partial-modal'));assert.equal(await page.locator('#modal-form').evaluate(form=>form.onsubmit),null,'New handler was never installed');
 const bytes=await raw(page);assert.deepEqual(await read(page),before);assert.equal((await gate(page)).calls,0);await noNavigationReplay(page,result,{detached:false,label:'partially constructed modal actual requestSubmit'});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,0);await capture(page,result,'partial-modal-submit-safe');result.checks.push('Native form.requestSubmit after actual partial modal construction cannot navigate even before the new onsubmit handler exists');
}
async function ancillaryCase(page,result,scenario,before,net){
 const reached=net.arm('nearby',{hold:true,fail:true,x:origin.x});await pending(page,result,scenario,await raw(page));await release(page);await closed(page);await net.wait(reached);assertSetup(await read(page),before);assert.equal((await gate(page)).storage.writes,1);assert.match(await page.locator('#message').textContent(),/Campaign setup saved\./);await capture(page,result,'saved-before-ancillary');
 if(scenario.mode==='ancillary-obsolete'){
  await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();const body=await page.locator('#modal-body').innerHTML(),message=await page.locator('#message').textContent();net.release();await frames(page);await frames(page);assert.equal(await page.locator('#modal-body').innerHTML(),body);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-error').textContent(),'');assert.equal(await page.locator('#message').textContent(),message);await capture(page,result,'obsolete-ancillary-ignored');await page.locator('#modal-cancel').click();await closed(page);
 }else{
  net.release();await page.locator('#message').filter({hasText:/Campaign setup saved\. Could not load nearby worlds:.*503.*Refresh nearby/}).waitFor();assert.equal(await page.locator('#modal').isVisible(),false);assert.equal((await gate(page)).reloadRequired,false);assert.equal((await gate(page)).editable,true);await capture(page,result,'ancillary-warning');
 }
 const bytes=await raw(page);await noNavigationReplay(page,result,{label:'ancillary failure old setup callback'});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,1);assert.equal((await gate(page)).storage.writes,1);assertSetup(await read(page),before);result.gate=await gate(page);await reloadUndo(page,result,scenario,before);result.checks.push('Setup closes and confirms exactly one durable opening deposit before optional map failure; stale ancillary failures cannot modify a newer dialog');
}
async function retiredCase(page,result,scenario,before,context){
 const after=scenario.mode.endsWith('-after');if(after)await page.evaluate(()=>worldGate.write());
 if(scenario.mode.startsWith('foreign-'))await foreign(page);
 if(scenario.mode.startsWith('editor-regain-'))await editorRegain(page,result,context);
 if(scenario.mode.startsWith('stale-disk-'))await newerDisk(page,result,{publish:after});
 let newer=null;
 if(scenario.mode.startsWith('detached-')){
  await page.locator('#modal').evaluate(el=>el.close());await closed(page);await page.waitForFunction(()=>document.querySelector('#modal-body').innerHTML==='');await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();newer=await page.locator('#modal-body').innerHTML();
 }
 const beforeRelease=await raw(page);await release(page);await frames(page);await frames(page);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 if(scenario.mode.startsWith('stale-disk-')){assert.equal(await raw(page),beforeRelease,'Newer disk record remains authoritative');if(!after)assert.equal((await gate(page)).settlements.at(-1).code,'SAVE_NOT_COMMITTED');}
 else assertSaved(await read(page),before,scenario,result.viewport);
 const durable=await raw(page),calls=(await gate(page)).calls;
 if(newer!==null){assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),newer);assert.equal(await page.locator('#modal-error').textContent(),'');}
 else if(scenario.mode==='stale-disk-before'){
  assert.match(await page.locator('#modal-error').textContent(),/stale|changed/i);assert.equal(await page.locator('#modal-cancel').isEnabled(),true);
  // Deliver the pending cross-tab publication before replaying the stale form.
  await foreign(page);
 }else{assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#modal-cancel').isEnabled(),true);}
 await noNavigationReplay(page,result,{label:'retired owner native and detached replay'});assert.equal((await gate(page)).calls,calls);assert.equal(await raw(page),durable);
 // Inspect the failed/retired dialog before closing it or using Settings Revert.
 await capture(page,result,'retired-owner-before-recovery');if(await page.locator('#modal').isVisible()){await page.locator('#modal-cancel').click();await closed(page);}
 if(!(await read(page)).initialized){
  // A stale rejected initial setup remains the welcome campaign. There are no
  // inline Settings controls until setup actually succeeds.
  assert.equal(scenario.id,'setup-stale-disk-before');const current=await read(page);assert.equal(current.bank,before.bank);assert.deepEqual(current.ledger,before.ledger);assert.equal(current.ledger.filter(entry=>entry.type==='Opening bank').length,0);assert.equal(await page.locator('#settings-form').count(),0);assert.equal(await action(page,'setup').isEnabled(),true);assert.equal((await gate(page)).storage.writes,1,'Only the simulated external name change wrote; rejected setup did not');
  await action(page,'setup').click();await page.locator('#setup-world .picker-selection').filter({hasText:'Hex 1910'}).waitFor();for(const name of ['name','ship','bank','capacity','jump','date'])assert.equal(await page.locator('#modal [name="'+name+'"]').isEnabled(),true,'Fresh setup restores '+name);assert.equal(await page.locator('#modal-submit').isEnabled(),true);
  await page.evaluate(()=>{void worldGate.oldSubmit({preventDefault(){},currentTarget:worldGate.form});});await frames(page);assert.equal(await raw(page),durable);assert.equal((await gate(page)).calls,calls);assert.equal(await page.locator('#modal-title').textContent(),'Start your campaign');await capture(page,result,'fresh-setup-recovery');await page.locator('#modal-cancel').click();await closed(page);result.checks.push('Rejected initial setup preserves uninitialized welcome and newer disk; a fresh editable Setup review opens without any opening deposit or stale callback replay');
 }else{
  await tab(page,'Settings');for(const name of ['name','jump','scoops','mode'])assert.equal(await page.locator('#settings-form [name="'+name+'"]').isEnabled(),true,'Retired owner releases '+name+' before Revert or remount');assert.equal(await page.locator('#settings-reset').isEnabled(),true);await capture(page,result,'controls-recovered-before-revert');
  await page.locator('#settings-reset').click();assert.equal(await page.locator('#settings-form [name="name"]').inputValue(),(await read(page)).name);
 }
 await page.locator('#notes').click();const body=await page.locator('#modal-body').innerHTML();await noNavigationReplay(page,result,{label:'obsolete callback against fresh Notes'});assert.equal(await page.locator('#modal-body').innerHTML(),body);assert.equal(await page.locator('#modal-error').textContent(),'');assert.equal(await raw(page),durable);assert.equal((await gate(page)).calls,calls);result.gate=await gate(page);
 await page.locator('#modal-cancel').click();await closed(page);const saved=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),saved);assert.equal(await page.evaluate(()=>worldStorage.writes),0);result.checks.push('Foreign same-revision/editor ABA/newer disk/detached session cannot revive completion; native authoritative disk is retained and recovered controls are checked before Revert');
}
async function repaintWhilePublished(page,result){
 const initial=await gate(page),expected={...result.viewport};assert.equal(initial.pending,true);assert.equal(initial.executions,1);assert.equal(initial.settlements.length,0);
 for(const width of [expected.width-8,expected.width]){
  const previous=await page.evaluate(()=>worldMapPaint.executed);await page.setViewportSize({...expected,width});await page.waitForFunction(previous=>worldMapPaint.executed>previous,previous);await frames(page);
  const observed=await gate(page);assert.equal(observed.pending,true);assert.equal(observed.settlements.length,0);assert.equal(observed.mainSame,true,'Actual scheduled map paint cannot expose uncompleted world state: '+JSON.stringify(observed.domDiff));assert.deepEqual(observed.domMutations,[],'No descendants, map SVG, status text or attributes may change during owned publication deferral');
 }
 result.checks.push('Actual ResizeObserver and scheduled paintMap callbacks execute after durable publication while settlement is held; entire immediately prewrite DOM including SVG/status remains unchanged until completion');result.publicationRepaint=await gate(page);
}
async function runBody(page,result,scenario,context,net){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForLoadState('networkidle');await frames(page);await installGate(page,result);const before=await read(page),bytes=await raw(page);
 if(scenario.mode==='partial-modal'){await partialModal(page,result,scenario,before);return;}
 if(scenario.mode==='picker-retry'){await arm(page,'success');await pickerRetry(page,result,scenario,before,net);return;}
 if(scenario.mode==='same-world'||scenario.mode.startsWith('handoff-')){await handoffCase(page,result,scenario,before,net,context);return;}
 await prepare(page,scenario);
 if(scenario.mode==='sync'){
  await start(page);await closed(page);await frames(page);const saved=await read(page);assertSaved(saved,before,scenario,result.viewport);if(scenario.path==='location')syncControls.set(result.viewport.width,saved);assert.equal((await gate(page)).calls,0);assert.equal((await gate(page)).storage.writes,1);assert.match(await page.locator('#message').textContent(),successPattern);result.gate=await gate(page);await capture(page,result,'synchronous-control');await reloadUndo(page,result,scenario,before);return;
 }
 await arm(page,scenario.mode);
 if(scenario.mode==='validation'){
  if(scenario.path==='setup'){
   await fill(page,'jump','0');await start(page);assert.equal(await page.locator('#modal [name="jump"]').evaluate(el=>el.validity.rangeUnderflow),true);assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);await fill(page,'jump',draft.jump);await fill(page,'date','999-1105');
  }else await fill(page,'reason','');
  await start(page);await page.waitForFunction(()=>!!document.querySelector('#modal-error').textContent);assert.equal(await page.locator('#modal-form').evaluate(form=>form===worldGate.form),true);assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).storage.writes,0);assert.equal(await page.locator('#modal-submit').isEnabled(),true);await capture(page,result,'validation-retained');await fill(page,scenario.path==='setup'?'date':'reason',scenario.path==='setup'?draft.date:REASON);await start(page);await page.waitForFunction(()=>!!worldGate.pending);await release(page);await success(page,result,scenario,before);result.checks.push('Actual native/cross-field validation retains draft, allows correction, and never invokes provider or changes revision/Undo');return;
 }
 if(scenario.mode.startsWith('lookup-')){await lookupCase(page,result,scenario,before,net,context);return;}
 if(scenario.mode.startsWith('ancillary-')){await ancillaryCase(page,result,scenario,before,net);return;}
 if(scenario.mode==='rounding-snapshot'){
  const reached=net.arm('world',{hold:true});await start(page);await net.wait(reached);assert.equal((await gate(page)).calls,0);await fill(page,'bank','200.01');await fill(page,'capacity','177.7');await capture(page,result,'lookup-edited-after-submit');net.release();await page.waitForFunction(()=>!!worldGate.pending);await release(page);await closed(page);const saved=await read(page);assertSetup(saved,before);const changes=saved.events.filter(e=>e.label==='Rounding applied [R]').at(-1).roundingChanges;assert.ok(!changes.some(c=>['200.01','177.7'].includes(c.before)),'Post-submit edits cannot leak into owned rounding audit');await success(page,result,scenario,before);return;
 }
 if(scenario.mode==='freeze-fault'){
  await start(page);await page.locator('#modal-error').filter({hasText:'Synthetic prepared controls freeze failure'}).waitFor();assert.equal((await gate(page)).calls,0);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).reloadRequired,false);assert.equal(await page.locator('#modal-submit').isEnabled(),true);assert.equal(await page.locator('#modal [name="'+(scenario.path==='setup'?'name':'reason')+'"]').isEnabled(),true);await capture(page,result,'prepared-freeze-retryable');await start(page);await page.waitForFunction(()=>!!worldGate.pending);await release(page);await success(page,result,scenario,before);return;
 }
 await pending(page,result,scenario,bytes);
 if(scenario.mode==='prewrite'){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known world prewrite rejection'}).waitFor();assert.equal(await raw(page),bytes);assert.equal((await gate(page)).reloadRequired,false);assert.equal(await page.locator('#modal-submit').isEnabled(),true);for(const id of ['modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);const name=scenario.path==='setup'?'name':'reason',value=scenario.path==='setup'?draft.name:REASON;assert.equal(await page.locator('#modal [name="'+name+'"]').isEnabled(),true);assert.equal(await page.locator('#modal [name="'+name+'"]').inputValue(),value);await capture(page,result,'known-prewrite-retryable');await fill(page,name,'Corrected retry draft');await fill(page,name,value);await start(page);await page.waitForFunction(()=>!!worldGate.pending);assert.equal((await gate(page)).calls,2);await noNavigationReplay(page,result,{label:'retry pending native submission'});assert.equal((await gate(page)).calls,2);await release(page);await success(page,result,scenario,before);return;
 }
 if(/^(foreign|editor-regain|stale-disk|detached)-/.test(scenario.mode)){await retiredCase(page,result,scenario,before,context);return;}
 if(['success','second-baseline'].includes(scenario.mode)){
  await page.evaluate(()=>worldGate.write());await frames(page);assertSaved(await read(page),before,scenario,result.viewport);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal((await gate(page)).domBaselinePhase,'immediately-before-native-write');assert.equal((await gate(page)).mainSame,true,'Owned durable publication does not rerender the immediately prewrite browsing view: '+JSON.stringify((await gate(page)).domDiff));if(scenario.path==='location')await repaintWhilePublished(page,result);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);if(scenario.path==='location')assert.match(await page.locator('.world-info').textContent(),new RegExp(destination.name));await capture(page,result,'durable-awaiting-settlement');await release(page);
  if(scenario.mode==='success'){await success(page,result,scenario,before);return;}
  await success(page,result,scenario,before,{recovery:false});const first=await read(page),undone=await reloadUndo(page,result,scenario,before);await installGate(page,result);await prepare(page,scenario,{bank:'1234.01',date:'002-1106'});await start(page);await closed(page);const second=await read(page);assertSetup(second,undone,{bank:'1300',date:'002-1106',bankInput:'1234.01'});assert.equal(second.dashboardBaseline.bank,'1300');assert.equal(second.dashboardBaseline.dateLabel,'002-1106');assert.notDeepEqual(second.dashboardBaseline.excludedLedgerIds,first.dashboardBaseline.excludedLedgerIds);assert.deepEqual(second.dashboardBaseline.excludedLedgerIds,second.ledger.map(e=>e.id));assert.equal(second.ledger.length,1);assert.equal(dashboardData(second).operatingResult,'0');assert.equal(dashboardData(second).adjustment,'0');assert.equal((await gate(page)).calls,0);assert.equal(await page.evaluate(()=>worldStorage.writes),2);await capture(page,result,'second-setup-new-baseline');result.checks.push('Setup → real Undo → setup replaces the retained opening baseline with the new opening ledger ID, never a duplicate deposit');return;
 }
 if(['cleanup','render','report','close'].includes(scenario.mode))await page.evaluate(mode=>worldGate.cleanupFault=mode,scenario.mode);
 await release(page,['unknown-before','unknown-after','contradictory'].includes(scenario.mode)?scenario.mode:'native');await terminal(page,result,scenario,before,{committed:scenario.mode!=='unknown-before'});if(['cleanup','render','report','close'].includes(scenario.mode))assert.deepEqual(result.gate.faults,[scenario.mode]);
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,path:scenario.path,mode:scenario.mode,viewport,status:'running',checks:[],screenshots:[],layouts:[],evidenceTargets:[],navigationProbes:[],lookupBoundaries:[],expectedHTTPFailures:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],httpErrors:[],unexpectedRequests:[],fixtureErrors:[],errors:[]};report.cases.push(result);let context,net;
 try{
  ({context,net}=await contextFor(result,scenario));const page=await context.newPage();await runBody(page,result,scenario,context,net);await page.waitForLoadState('networkidle');await frames(page);
  for(const key of ['pageErrors','unhandledRejections','networkErrors','unexpectedRequests','fixtureErrors'])assert.deepEqual(result[key],[],key);
  const unexpectedHTTP=result.httpErrors.filter(e=>e.status!==503||!result.expectedHTTPFailures.includes(e.url));assert.deepEqual(unexpectedHTTP,[],'Only explicitly injected 503 responses are allowed');
  const unexpectedConsole=result.consoleErrors.filter(e=>!(/503/.test(e.text)&&result.expectedHTTPFailures.includes(e.url)));assert.deepEqual(unexpectedConsole,[],'No unrelated console errors');
  assert.equal(net.pending,false,'No abandoned network boundary');result.status='passed';
 }catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(e=>result.errors.push('Evidence: '+errorText(e)));result.failedGate=await gate(page).catch(()=>null);}}
 finally{if(net?.pending)net.release();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 assert.equal(normalizeAmount(OPENING,{unit:'credits',creditStep:100}).value,ROUNDED);assert.equal(normalizeAmount('160.1',{unit:'tons'}).value,'161');S.validate(structuredClone(fresh));S.validate(structuredClone(rich));assert.equal(rich.contracts.filter(c=>c.kind==='passenger').length,1);assert.equal(rich.contracts.filter(c=>c.kind==='mail').length,1);assert.equal(rich.contracts.filter(c=>c.kind==='freight').length,1);assert.ok(rich.contracts.find(c=>c.kind==='mail').firstDeparture);assert.equal(rich.jumpAttempts.at(-1).mulliganUsed,true);assert.equal(rich.jumpAttempts.at(-1).rolls.length,2);assert.equal(rich.ship.lifeSupport.elapsedHours,6);
 const corrected=locationExpected(rich);assertLocation(corrected,rich);assert.deepEqual(corrected.ship.lifeSupport.stockUnits,{numerator:'165',denominator:'4'});assert.equal(corrected.policies[0].status,'amendment-required');assert.equal(corrected.policies[1].status,'closed');const undone=S.undo(corrected);for(const key of ['ship','bank','hours','contracts','policies','ledger','lots','actual','route','dashboardBaseline'])assert.deepEqual(undone[key],rich[key]);assert.equal(undone.jumpAttempts.at(-1).mulliganUsed,true);assert.equal(undone.jumpAttempts.at(-1).closed,true);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);for(const name of ['createWorldWriteOwner','worldWriteOwnerCurrent','beginWorldWriteLookup','completeWorldWrite','finishWorldWrite','invalidateWorldWriteOperation'])assert.match(app,new RegExp('function '+name+'\\('));assert.match(app,/saveContext:'setup-save'/);assert.match(app,/saveContext:'location-save'/);assert.match(app,/if\(e\.target\.id==='modal-form'\)\{e\.preventDefault\(\);return;\}/);assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
 console.log(`PASS: synthetic setup/exact Credit and rich location/mail/freight/passenger/insurance/consumed-jump/LSS/Undo fixtures, actual versioned Store discovery and real native submit fallback wiring; ${scenarios.length} scenarios × ${sizes.length} widths = ${report.declaredCases} planned browser cases. Chromium was not launched.`);
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(report.requestedCommit)assert.equal(report.testedCommit,report.requestedCommit,'Run exactly the requested commit');report.workingTree=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Exact-head evidence requires a clean checkout');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const viewport of sizes)for(const scenario of scenarios)await runCase(scenario,viewport);
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<24*1024*1024-65536,'Full bounded setup/location evidence must remain below 24 MiB');
 }catch(error){report.errors.push(errorText(error));}
 finally{await browser?.close();report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(result=>result.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Setup/location completion browser checks failed; see verification-artifacts/'+prefix+'report.json');console.log(`PASS: ${report.declaredCases} actual setup/location browser cases, native locks, separate lookup/save boundaries, exact economics, reload/Undo and bounded desktop/mobile evidence.`);
}
