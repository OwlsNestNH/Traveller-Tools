// Exact-head Chromium evidence for jump preparation and final commit completion.
// Synthetic campaigns only; all Traveller Map responses are intercepted.
// Run: node verification/jump-completion-browser.test.mjs [playwright-module]
// --fixtures-only checks wiring/economics without launching Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const scenarios=[{id:'synchronous-roll-reuse-mulligan',phase:'both',mode:'sync'},{id:'idle-review-invalidated',phase:'commit',mode:'idle-invalidated'},{id:'reentrant-preparation-publication',phase:'prepare',mode:'reentrant'},...['before','after'].map(point=>({id:'pending-screen-'+point+'-write',phase:'prepare',mode:'pending-ui-'+point})),...['prepare','commit'].flatMap(phase=>['success','prewrite','unknown-before','unknown-after','notification-before','notification-after','cleanup','tokenless','takeover','late-role-loss'].map(mode=>({id:phase+'-'+mode,phase,mode})))];
const successPattern=/Jump:.*saved\./;
const report={suite:'Jump preparation and commit save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:scenarios.length*sizes.length,cases:[],errors:[],scope:'Actual app modal gestures and exact versioned Store/controller with test-owned deferred save boundary at desktop/mobile widths. Synthetic localStorage campaigns, native Web Locks, durable accounting, saved dice, one mulligan, reload and screenshots. Other asynchronous action groups, arbitrary providers, live map availability and real campaigns are outside this gate.'};
let browser;
function fixture(){
 const state=S.initial(),origin={id:'0,0',x:0,y:0,name:'Jump Origin',sector:'Synthetic',hex:'0101',uwp:'A788899-C',zone:'Safe'},destination={...origin,id:'1,0',x:1,name:'Jump Destination',hex:'0201'};
 Object.assign(state,{initialized:true,name:'Disposable jump completion campaign',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'100000'});
 Object.assign(state.ship,{capacity:'100',staterooms:2,fuel:configureFuel(200,40,60,40,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}},accommodation:{rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}}});
 state.lots=[{id:'jump-cargo',commodity:'11',description:'Saved jump cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 state.contracts=[{id:'jump-mail',kind:'mail',status:'accepted',firstDeparture:null,origin:origin.id,destination:destination.id,quantity:'5',payment:'1000',dueHours:null}];
 state.policies=[{id:'jump-policy',lotId:'jump-cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:[origin.id,destination.id],routeProgress:0,destination:destination.id}];
 state.snapshots=[{id:'jump-supplier',kind:'supplier',worldId:origin.id,hours:0,startedHours:0,party:'Saved supplier',offers:[{id:'jump-stock',commodity:'11',description:'Saved offer',expired:false,remaining:'2',unitPrice:'100'}]}];
 state.dashboardBaseline=createDashboardBaseline(state);return S.validate(state);
}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','jumpAttempts','events','undo'].includes(key)));
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const gate=page=>page.evaluate(()=>jumpGate.snapshot());
const diceCalls=page=>page.evaluate(()=>jumpDiceCalls);
const errorText=error=>error?.stack||String(error);
function assertPrepared(saved,before){
 assert.equal(saved.revision,before.revision+1);assert.deepEqual(material(saved),material(before));assert.deepEqual(saved.undo,before.undo);
 assert.equal(saved.jumpAttempts.length,1);assert.deepEqual(saved.jumpAttempts[0].rolls,[{dice:[3,3,3,3,3,3],total:18}]);assert.equal(saved.events.filter(e=>e.label==='Jump roll prepared').length,1);assert.equal(saved.events.filter(e=>e.label==='Jump audit').length,0);
}
function assertJump(saved,before){
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.actual,'1,0');assert.equal(saved.routeIndex,1);assert.equal(saved.hours,before.hours+160);assert.equal(saved.bank,before.bank);
 assert.equal(saved.ship.fuel.aboardTons,40);assert.deepEqual(saved.ship.lifeSupport.stockUnits,{numerator:'128',denominator:'3'});assert.deepEqual(saved.lots,before.lots);assert.deepEqual(saved.snapshots,before.snapshots);assert.deepEqual(saved.jumpAttempts,before.jumpAttempts);
 assert.equal(saved.ledger.length,before.ledger.length+1);assert.equal(saved.ledger.at(-1).type,'Jump');assert.equal(saved.ledger.at(-1).amount,'0');assert.equal(saved.undo.length,before.undo.length+1);
 const audit=saved.events.filter(e=>e.label==='Jump audit');assert.equal(audit.length,1);assert.equal(audit[0].effectiveHours,160);assert.equal(audit[0].generatedHours,166);assert.deepEqual(audit[0].dice,before.jumpAttempts[0].rolls.at(-1));
 assert.equal(saved.contracts[0].firstDeparture.eventId,audit[0].id);assert.equal(saved.policies[0].status,'arrived');assert.equal(saved.policies[0].routeProgress,1);assert.equal(S.jumpUndoEligibility(saved).allowed,true);
}
async function contextFor(result){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>{page.on('pageerror',error=>result.pageErrors.push(errorText(error)));page.on('console',entry=>{if(entry.type()==='error')result.consoleErrors.push(entry.text());});});
 await context.exposeBinding('__jumpUnhandled',(_source,message)=>{result.unhandledRejections.push(message);});
 await context.addInitScript(({key,bytes,origin})=>{
  if(location.origin!==origin)return;
  // Observe only: app handlers must own all provider rejections themselves.
  addEventListener('unhandledrejection',event=>{void globalThis.__jumpUnhandled(String(event.reason?.stack||event.reason));});
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  const nativeSet=Storage.prototype.setItem;globalThis.jumpStorage={attempts:0,writes:0,failNext:false,observations:[]};
  Storage.prototype.setItem=function(name,value){
   if(this!==localStorage||name!==key)return Reflect.apply(nativeSet,this,[name,value]);
   jumpStorage.attempts++;jumpStorage.observations.push({message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#modal')?.open,title:document.querySelector('#modal-title')?.textContent||'',submitDisabled:!!document.querySelector('#modal-submit')?.disabled});
   if(jumpStorage.failNext){jumpStorage.failNext=false;throw Error('Synthetic known prewrite jump storage rejection');}
   const result=Reflect.apply(nativeSet,this,[name,value]);jumpStorage.writes++;return result;
  };
  globalThis.jumpDiceCalls=0;globalThis.jumpDieFace=3;const random=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){jumpDiceCalls++;array[0]=jumpDieFace-1;return array;}return random(array);};
 },{key:KEY,bytes:JSON.stringify(fixture()),origin:new URL(base).origin});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.href===new URL('verification/jump-peer.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable jump Store peer</title>'});
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname.endsWith('/jumpworlds')?{Worlds:[]}:url.pathname.endsWith('/universe')?{Sectors:[]}:url.pathname.endsWith('/metadata')?{Subsectors:[]}:'' ,headers:{'Access-Control-Allow-Origin':'*'}});
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });return context;
}
async function installGate(page,result){
 result.runtime=await page.evaluate(async()=>{
  const appURL=[...document.scripts].find(script=>script.type==='module'&&/\/app\.mjs(?:\?|$)/.test(script.src))?.src;if(!appURL)throw Error('Actual app module unavailable');
  const response=await fetch(appURL);if(!response.ok)throw Error('Cannot inspect runtime app import');const source=await response.text();
  const specifier=source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];if(!specifier)throw Error('Exact runtime Store import missing');
  const storeURL=new URL(specifier,appURL).href;if(!new URL(storeURL).search)throw Error('Expected versioned runtime Store');
  const {Store,KEY}=await import(storeURL),nativeSave=Store.prototype.save;
  const observation=point=>({point,message:document.querySelector('#message')?.textContent||'',title:document.querySelector('#modal-title')?.textContent||'',open:!!document.querySelector('#modal')?.open,submitDisabled:!!document.querySelector('#modal-submit')?.disabled,revision:JSON.parse(localStorage.getItem(KEY)).revision});
  const g=globalThis.jumpGate={armed:false,phase:null,pending:null,store:null,args:null,calls:0,executions:0,notifyFault:null,roleFault:false,cleanupFault:null,cleanupThrows:0,pendingUI:null,pendingUIThrows:0,reentrant:false,reentrantCalls:0,roleThrows:0,roleCalls:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],cleanupObservations:[]};
  // Throw only at the real post-fulfillment UI boundary. Neither production
  // write logic nor campaign callbacks are replaced by synthetic equivalents.
  const text=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  Object.defineProperty(Node.prototype,'textContent',{...text,set(value){
   if(g.pendingUI&&this.id==='modal-title'&&/^Preparing jump/.test(value)){g.pendingUI=null;g.pendingUIThrows++;g.cleanupObservations.push(observation('pending-screen-construction'));throw Error('Synthetic pending jump screen construction failure');}
   if(g.cleanupFault==='prepare'&&this.id==='modal-title'&&/^Commit jump/.test(value)){
    g.cleanupFault=null;g.cleanupThrows++;g.cleanupObservations.push(observation('prepared-review-after-fulfillment'));throw Error('Synthetic prepared review cleanup failure');
   }return Reflect.apply(text.set,this,[value]);
  }});
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){
   if(g.cleanupFault==='commit'&&this.id==='main'&&g.settlements.at(-1)?.kind==='native-fulfilled'){
    g.cleanupFault=null;g.cleanupThrows++;g.cleanupObservations.push(observation('arrival-render-after-fulfillment'));throw Error('Synthetic arrival cleanup failure');
   }return Reflect.apply(html.set,this,[value]);
  }});
  function observeStore(store){
   if(g.store===store)return;if(g.store)throw Error('Unexpected second application Store');g.store=store;const change=store.onChange,role=store.onRole;
   store.onChange=function(...args){
    const record={revision:args[0].revision,tokenPresent:args[1]?.saveToken!=null,tokenMatchesSave:args[1]?.saveToken!=null&&args[1]?.saveToken===g.args?.[2],actualCallback:false};g.publications.push(record);g.observations.push(observation('before-actual-receiveCampaign'));
    if(g.notifyFault==='before'){g.notifyFault=null;throw Error('Synthetic notification failure before actual receiveCampaign');}
    const result=Reflect.apply(change,this,args);record.actualCallback=true;if(g.reentrant){g.reentrant=false;g.reentrantCalls++;document.querySelector('[data-action="jump"]')?.click();}g.observations.push(observation('after-actual-receiveCampaign'));
    if(g.notifyFault==='after'){g.notifyFault=null;throw Error('Synthetic notification failure after actual receiveCampaign');}return result;
   };
   store.onRole=function(...args){g.roleCalls++;const result=Reflect.apply(role,this,args);if(g.roleFault){g.roleFault=false;g.roleThrows++;throw Error('Synthetic role notification failure');}return result;};
  }
  Store.prototype.save=function(...args){
   observeStore(this);g.args=args;if(!g.armed)return Reflect.apply(nativeSave,this,args);
   if(g.pending)throw Error('Application invoked Store.save twice during a pending jump');g.calls++;g.candidates.push(JSON.stringify(args[0]));g.forwarded.push({argumentCount:args.length,tokenPresent:args[2]!=null,expectedRevision:args[1],candidateRevision:args[0].revision});
   const completion=new Promise((resolve,reject)=>{g.pending={store:this,args,resolve,reject,executed:false,result:undefined,error:null};});if(g.pendingUI==='after')g.write();return completion;
  };
  g.write=()=>{const pending=g.pending;if(!pending||pending.executed)throw Error('Pending native write must run exactly once');pending.executed=true;g.executions++;try{pending.result=Reflect.apply(nativeSave,pending.store,pending.args);}catch(error){pending.error=error;}};
  g.release=kind=>{
   const pending=g.pending;if(!pending)throw Error('No pending jump save');
   if(kind==='unknown-before'){g.pending=null;g.settlements.push({kind,executed:false});pending.reject(Error('Synthetic unknown jump save outcome'));return;}
   if(!pending.executed)g.write();g.pending=null;
   if(kind==='unknown-after'){g.settlements.push({kind,executed:true});pending.reject(Error('Synthetic lost response after durable jump write'));}
   else if(pending.error){const error=pending.error;g.settlements.push({kind:'native-rejected',code:error.code||null,committed:error.committed??null});pending.reject(error);}
   else{g.settlements.push({kind:'native-fulfilled',executed:true});pending.resolve(pending.result);}
  };
  g.snapshot=()=>({calls:g.calls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,storage:{...jumpStorage},diceCalls:jumpDiceCalls,forwarded:g.forwarded,candidates:g.candidates,publications:g.publications,observations:g.observations,settlements:g.settlements,pendingUIThrows:g.pendingUIThrows,reentrantCalls:g.reentrantCalls,cleanupThrows:g.cleanupThrows,cleanupObservations:g.cleanupObservations,roleThrows:g.roleThrows,roleCalls:g.roleCalls,durableHasSaveToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL,storeURL};
 });
}
async function arm(page,scenario){await page.evaluate(({phase,mode})=>{if(jumpGate.pending)throw Error('Previous jump gate pending');Object.assign(jumpGate,{armed:true,phase,notifyFault:mode==='notification-before'?'before':mode==='notification-after'?'after':null,roleFault:mode==='notification-after'});jumpStorage.failNext=mode==='prewrite';},scenario);}
const release=(page,kind='native')=>page.evaluate(kind=>jumpGate.release(kind),kind);
async function capture(page,result,label){
 await frames(page);const name='jump-completion-'+result.id+'-'+label+'.jpg';await page.screenshot({path:join(artifacts,name),type:'jpeg',quality:85});result.screenshots.push(name);
 const geometry=await page.evaluate(()=>{const dialog=document.querySelector('#modal[open]'),r=dialog?.getBoundingClientRect();return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:r?{left:r.left,right:r.right,overflow:dialog.scrollWidth-dialog.clientWidth}:null};});
 result.layouts.push({label,...geometry});assert.ok(geometry.pageOverflow<=2,'No horizontal page overflow');if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,'Jump dialog remains in viewport');assert.ok(geometry.dialog.overflow<=2,'Jump dialog has no horizontal clipping');}
}
async function pointer(page,id){const locator=page.locator('#'+id);if(!await locator.isVisible())return;await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{clickCount:2,delay:20});}
async function review(page){await action(page,'jump').click();await page.locator('#modal-title').filter({hasText:/^Commit jump/}).waitFor();await page.locator('#modal [name="hours"]').fill('160');}
async function beginPending(page,result,scenario,before){
 if(scenario.phase==='prepare')await action(page,'jump').click();else await page.locator('#modal-submit').click();
 await page.waitForFunction(()=>!!jumpGate.pending);await frames(page);const title=await page.locator('#modal-title').textContent();assert.match(title,scenario.phase==='prepare'?/Preparing jump/:/^Commit jump/);
 assert.equal(await raw(page),before);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' is disabled while save completion is pending');
 if(scenario.phase==='commit'){const hours=page.locator('#modal [name="hours"]');assert.equal(await hours.isEditable(),false);assert.equal(await hours.isDisabled(),false);await hours.focus();await hours.press('Control+A');await hours.press('9');assert.equal(await hours.inputValue(),'160','Real keyboard cannot edit pending elapsed hours');}
 await page.locator('#modal-form').evaluate(form=>{globalThis.detachedJumpSubmit=form.onsubmit;});const calls=(await gate(page)).calls;
 await pointer(page,'modal-submit');await page.keyboard.press('Enter');await page.locator('#modal-form').evaluate(form=>form.requestSubmit());
 await page.evaluate(()=>{void detachedJumpSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('[data-action="jump"]')?.click();});
 await pointer(page,'modal-cancel');await pointer(page,'modal-close');await page.keyboard.press('Escape');await frames(page);
 assert.equal((await gate(page)).calls,calls);assert.equal(await page.locator('#modal').evaluate(dialog=>dialog.open),true);assert.equal(await page.locator('#modal-title').textContent(),title);assert.equal(await raw(page),before);assert.equal(await diceCalls(page),6);
 await capture(page,result,'pending-'+calls);result.checks.push('Real repeated pointer, Enter, requestSubmit, detached handler and Escape cannot duplicate or abandon pending '+scenario.phase);
}
async function assertTerminal(page,result,scenario,before,{committed,unknown=false}){
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#modal-error').textContent));await frames(page);
 const pattern=unknown?/outcome could not be confirmed[\s\S]*Reload[\s\S]*History/i:/saved[\s\S]*Reload[\s\S]*do not record/i;
 for(const id of ['modal-error','message','save-status'])assert.match(await page.locator('#'+id).textContent(),pattern);
 assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#takeover').isDisabled(),true);const snapshot=await gate(page);assert.equal(snapshot.editable,false);assert.equal(snapshot.reloadRequired,true);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
 if(committed){if(scenario.phase==='prepare')assertPrepared(await read(page),before);else assertJump(await read(page),before);}else assert.deepEqual(await read(page),before);
 if(scenario.phase==='prepare')assert.match(await page.locator('#modal-error').textContent(),/prepared jump roll/i,'Preparation failure must not claim ship travel was committed');
 const bytes=await raw(page),calls=snapshot.calls;await pointer(page,'modal-submit');await page.keyboard.press('Enter');await page.locator('#modal-form').evaluate(form=>form.requestSubmit());await frames(page);assert.equal((await gate(page)).calls,calls);assert.equal(await raw(page),bytes);
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true);
 await page.evaluate(()=>{jumpGate.store.yield();jumpGate.store.onChange(jumpGate.store.read());});for(const id of ['modal-error','save-status'])assert.match(await page.locator('#'+id).textContent(),pattern);assert.equal(await page.locator('#takeover').isVisible(),false);
 await capture(page,result,'reload-only');await page.locator('#modal-cancel').click();await closed(page);assert.equal(await page.locator('[data-mutate]:enabled').count(),0);
 result.checks.push('Terminal outcome releases real Web Lock and remains reload-only across repeated activation and role callback');
}
async function restore(page,result,scenario,before,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),bytes,'Reload cannot duplicate preparation or travel');
 if(scenario.phase==='commit'&&committed){
  assertJump(await read(page),before);await action(page,'jump-undo').click();await page.locator('#modal-submit').click();await closed(page);assert.deepEqual(material(await read(page)),material(before));assert.equal((await read(page)).jumpAttempts[0].mulliganUsed,true);assert.equal(await diceCalls(page),0);
 }else if(scenario.phase==='prepare'&&committed){
  assertPrepared(await read(page),before);await review(page);assert.equal(await diceCalls(page),0,'Durable preparation reopens with saved dice after reload');assert.equal(await raw(page),bytes);await page.locator('#modal-cancel').click();await closed(page);
 }else assert.deepEqual(await read(page),before);
 await capture(page,result,'reloaded');result.checks.push('Reload establishes authoritative saved bytes; saved preparation reuses dice, saved jump supports actual one-mulligan Undo');
}
async function successful(page,result,scenario,before){
 if(scenario.phase==='prepare'){
  await page.locator('#modal-title').filter({hasText:/^Commit jump/}).waitFor();assertPrepared(await read(page),before);assert.equal(await page.locator('#modal-submit').isEnabled(),true);assert.equal(await diceCalls(page),6);await capture(page,result,'prepared');
 }else{
  await closed(page);assertJump(await read(page),before);assert.match(await page.locator('#message').textContent(),successPattern);assert.match(await page.locator('.world-info').textContent(),/Jump Destination/);await capture(page,result,'arrived');
 }
 const snapshot=await gate(page);result.gate=snapshot;
 for(const entry of snapshot.forwarded){assert.ok(entry.argumentCount>=3);assert.equal(entry.tokenPresent,true);assert.equal(entry.candidateRevision,entry.expectedRevision+1);}assert.equal(snapshot.durableHasSaveToken,false);
 for(const entry of [...snapshot.observations,...snapshot.storage.observations])assert.doesNotMatch(entry.message,successPattern,'Success follows completed durable write/publication');
 assert.equal(await raw(page),snapshot.candidates.at(-1));const bytes=await raw(page),calls=snapshot.calls;
 await page.evaluate(()=>{void detachedJumpSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).calls,calls,'Stale phase submit does not enter a new phase');
 await restore(page,result,scenario,before);result.checks.push('Exact durable accounting and post-completion UI transition, with no stale modal replay');
}
async function takeover(page,result,scenario,before,context){
 const peer=await context.newPage();await peer.goto(new URL('verification/jump-peer.html',base).href);
 await peer.evaluate(async({storeURL})=>{const {Store}=await import(storeURL);globalThis.jumpPeer={state:null,editable:false};jumpPeer.store=new Store(next=>{jumpPeer.state=next;},editable=>{jumpPeer.editable=editable;});await jumpPeer.store.acquire(true);},result.runtime);
 await peer.waitForFunction(()=>jumpPeer.editable);await page.waitForFunction(()=>jumpGate.store.editable===false);
 const revision=await peer.evaluate(async({storeURL})=>{const url=new URL('state.mjs',storeURL);url.search=new URL(storeURL).search;const S=await import(url.href),next=S.transition(jumpPeer.state,'Peer deposit during jump save',state=>S.deposit(state,'7','Synthetic native lock owner'));jumpPeer.store.save(next,jumpPeer.state.revision);return jumpPeer.state.revision;},result.runtime);
 await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:KEY,revision});const bytes=await raw(page);assert.equal((await read(page)).bank,String(BigInt(before.bank)+7n));
 await release(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/editing|changed|read-only|stale/i);assert.equal((await gate(page)).reloadRequired,false);assert.equal((await gate(page)).settlements.at(-1).code,'SAVE_NOT_COMMITTED');
 await page.locator('#modal-form').evaluate(form=>form.requestSubmit());assert.equal((await gate(page)).calls,1);assert.equal(await raw(page),bytes);await capture(page,result,'ownership-lost');result.gate=await gate(page);
 await peer.evaluate(()=>{jumpPeer.store.yield();jumpPeer.store.channel?.close();});await peer.close();await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),bytes);await capture(page,result,'authoritative-reload');
 result.checks.push('Second real Store owns native writer lock; late old-owner result cannot overwrite its revision or revive the old jump review');
}
async function synchronous(page,result){
 const before=await read(page);await review(page);const prepared=await read(page);assertPrepared(prepared,before);assert.equal(await diceCalls(page),6);await page.locator('#modal-cancel').click();await closed(page);
 await page.evaluate(()=>jumpDieFace=6);await review(page);assert.deepEqual(await read(page),prepared);assert.equal(await diceCalls(page),6);await page.keyboard.press('Escape');await closed(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await review(page);assert.equal(await diceCalls(page),0);await page.locator('#modal-submit').click();await closed(page);assertJump(await read(page),prepared);await capture(page,result,'first-arrival');
 await action(page,'jump-undo').click();await page.locator('#modal-submit').click();await closed(page);assert.deepEqual(material(await read(page)),material(before));await review(page);assert.equal(await diceCalls(page),6);const final=(await read(page)).jumpAttempts[0];assert.equal(final.mulliganUsed,true);assert.equal(final.rolls.length,2);await page.locator('#modal-cancel').click();await closed(page);await review(page);assert.equal(await diceCalls(page),6);
 await page.locator('#modal-submit').click();await closed(page);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,false);assert.equal(await action(page,'jump-undo').isDisabled(),true);await capture(page,result,'final-attempt');result.checks.push('Synchronous saves, cancel/reopen/reload roll retention, one fresh mulligan roll and final-attempt lock remain unchanged');
}
async function runJump(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 if(scenario.mode==='sync'){await synchronous(page,result);return;}
 await installGate(page,result);
 if(scenario.mode==='idle-invalidated'){
  const original=await read(page);await review(page);const prepared=await read(page),bytes=await raw(page),writes=(await gate(page)).storage.writes;await page.evaluate(()=>jumpGate.store.onChange(jumpGate.store.read()));await frames(page);
  assert.match(await page.locator('#modal-error').textContent(),/changed|reopen/i);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#modal [name="hours"]').isEditable(),false);await page.locator('#modal-form').evaluate(form=>form.requestSubmit());assert.equal(await raw(page),bytes);await capture(page,result,'stale-review');
  await page.locator('#modal-cancel').click();await closed(page);await review(page);assert.equal((await gate(page)).storage.writes,writes);assert.equal(await diceCalls(page),6);await page.locator('#modal-submit').click();await closed(page);assertJump(await read(page),prepared);await capture(page,result,'fresh-review-arrival');
  await action(page,'jump-undo').click();await page.locator('#modal-submit').click();await closed(page);assert.deepEqual(material(await read(page)),material(original));result.checks.push('Idle foreign same-revision publication immediately explains stale review, blocks submission, and permits saved dice only through a fresh review');return;
 }
 if(scenario.mode==='reentrant'){
  const original=await read(page);await page.evaluate(()=>{jumpGate.reentrant=true;});await review(page);assertPrepared(await read(page),original);assert.equal((await gate(page)).reentrantCalls,1);assert.equal((await gate(page)).storage.writes,1);assert.equal(await diceCalls(page),6);await capture(page,result,'one-preparation');result.gate=await gate(page);result.checks.push('Synchronous actual receiveCampaign reenters the real jump click handler once without a second save or fresh dice');return;
 }
 if(scenario.mode.startsWith('pending-ui-')){
  const before=await read(page),afterWrite=scenario.mode==='pending-ui-after';await page.evaluate(after=>{jumpGate.armed=true;jumpGate.pendingUI=after?'after':'before';},afterWrite);await action(page,'jump').click();await page.waitForFunction(()=>jumpGate.pendingUIThrows===1&&jumpGate.store?.reloadRequired===true&&!!jumpGate.pending);await frames(page);
  const snapshot=await gate(page);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.equal(snapshot.pendingUIThrows,1);assert.equal(snapshot.calls,1);assert.equal(snapshot.storage.writes,afterWrite?1:0);for(const id of ['message','save-status'])assert.match(await page.locator('#'+id).textContent(),/outcome could not be confirmed[\s\S]*Reload/i);assert.equal(await page.locator('#takeover').isDisabled(),true);
  const bytes=await raw(page);if(afterWrite)assertPrepared(await read(page),before);else assert.deepEqual(await read(page),before);await capture(page,result,'pending-screen-fault');await release(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).reloadRequired,true);result.gate=await gate(page);await restore(page,result,scenario,before,{committed:afterWrite});result.checks.push('Pending UI construction fault before/after durable write cannot abandon original Promise, unlock editing or offer a fresh-roll retry');return;
 }
 if(scenario.phase==='commit')await review(page);const before=await read(page),bytes=await raw(page),initialWrites=(await gate(page)).storage.writes;
 await arm(page,scenario);await beginPending(page,result,scenario,bytes);
 if(scenario.mode==='takeover'){await takeover(page,result,scenario,before,context);return;}
 if(scenario.mode==='prewrite'){
  const originalRoll=JSON.parse((await gate(page)).candidates[0]).jumpAttempts[0].rolls;await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known prewrite'}).waitFor();assert.equal(await raw(page),bytes);assert.equal(await page.locator('#modal-submit').isEnabled(),true);assert.equal(await diceCalls(page),6);
  if(scenario.phase==='commit'){assert.equal(await page.locator('#modal [name="hours"]').inputValue(),'160');assert.equal(await page.locator('#modal [name="hours"]').isEditable(),true);}await capture(page,result,'retryable');
  await page.locator('#modal-submit').click();await page.waitForFunction(()=>!!jumpGate.pending);assert.deepEqual(JSON.parse((await gate(page)).candidates[1]).jumpAttempts[0].rolls,originalRoll);assert.equal(await diceCalls(page),6);await page.locator('#modal-form').evaluate(form=>form.requestSubmit());assert.equal((await gate(page)).calls,2);
  await release(page);await frames(page);assert.equal((await gate(page)).storage.writes-initialWrites,1);await successful(page,result,scenario,before);return;
 }
 if(scenario.mode==='tokenless'){
  await page.evaluate(()=>jumpGate.store.onChange(jumpGate.store.read()));await release(page);await frames(page);assert.equal((await gate(page)).calls,1);
  if(scenario.phase==='prepare'){assertPrepared(await read(page),before);assert.equal(await page.locator('#modal [name="hours"]').count(),0,'Late preparation must not create an actionable stale commit preview');}
  else assertJump(await read(page),before);
  const saved=await raw(page);await page.locator('#modal-form').evaluate(form=>form.requestSubmit());await frames(page);assert.equal((await gate(page)).calls,1);assert.equal(await raw(page),saved);if(await page.locator('#modal').isVisible())assert.equal(await page.locator('#modal-submit').isDisabled(),true);
  await capture(page,result,'stale-publication');result.gate=await gate(page);await restore(page,result,scenario,before);result.checks.push('Tokenless same-revision replacement invalidates original session; late fulfillment never revives its commit authority');return;
 }
 if(scenario.mode==='late-role-loss'){
  await page.evaluate(()=>{jumpGate.write();jumpGate.store.yield();});const durable=await raw(page);await release(page);await frames(page);assert.equal(await raw(page),durable);assert.equal((await gate(page)).calls,1);assert.match(await page.locator('.world-info').textContent(),/Jump Origin/,'Late result must not override the now-unowned browsing view');
  if(scenario.phase==='prepare'){assertPrepared(await read(page),before);assert.equal(await page.locator('#modal [name="hours"]').count(),0);}else assertJump(await read(page),before);
  await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);await capture(page,result,'late-ownership-loss');result.gate=await gate(page);await restore(page,result,scenario,before);result.checks.push('Ownership lost after real durable write but before provider fulfillment does not revive a stale preparation or arrival callback');return;
 }
 if(scenario.mode==='success'){
  await page.evaluate(()=>jumpGate.write());await frames(page);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-title').textContent(),scenario.phase==='prepare'?/Preparing jump/:/^Commit jump/);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);
  if(scenario.phase==='prepare')assertPrepared(await read(page),before);else{assertJump(await read(page),before);assert.match(await page.locator('.world-info').textContent(),/Jump Origin/,'Durable publication alone does not browse to arrival');}
  await capture(page,result,'durable-awaiting-completion');await release(page);await successful(page,result,scenario,before);return;
 }
 if(scenario.mode==='cleanup')await page.evaluate(phase=>{jumpGate.cleanupFault=phase;},scenario.phase);
 const unknown=scenario.mode.startsWith('unknown-'),committed=scenario.mode!=='unknown-before';await release(page,unknown?scenario.mode:'native');await assertTerminal(page,result,scenario,before,{committed,unknown});
 const snapshot=await gate(page);result.gate=snapshot;assert.equal(snapshot.storage.writes-initialWrites,committed?1:0);assert.equal(snapshot.calls,1);
 if(scenario.mode==='cleanup'){assert.equal(snapshot.cleanupThrows,1);assert.equal(snapshot.settlements.at(-1).kind,'native-fulfilled');assert.equal(snapshot.publications.at(-1).actualCallback,true);}
 if(scenario.mode==='notification-after')assert.equal(snapshot.roleThrows,1);
 await restore(page,result,scenario,before,{committed});
}
async function writeReport(){await writeFile(join(artifacts,'jump-completion-report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,phase:scenario.phase,mode:scenario.mode,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result);const page=await context.newPage();await runJump(page,result,scenario,context);await frames(page);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unhandledRejections,[]);assert.deepEqual(result.unexpectedRequests,[]);result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});result.failedGate=await gate(page).catch(()=>null);}}
 finally{await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 const before=fixture(),prepared=S.prepareJump(before,()=>({dice:[3,3,3,3,3,3],total:18}));assertPrepared(prepared.state,before);const saved=S.transition(prepared.state,'Jump: Jump Origin → Jump Destination',state=>S.commitJump(state,{attemptId:prepared.attempt.id,elapsed:160}));assertJump(saved,prepared.state);assert.deepEqual(material(S.undoJump(saved)),material(before));
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
 console.log(`PASS: exact synthetic jump preparation, fuel/LSS/cargo/mail/insurance and mulligan fixtures; actual versioned Store discovery; ${scenarios.length} scenarios x ${sizes.length} widths = ${report.declaredCases} browser cases declared. Chromium was not launched.`);
}else{
 await mkdir(artifacts,{recursive:true});
 try{report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(report.requestedCommit)assert.equal(report.testedCommit,report.requestedCommit);
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const viewport of sizes)for(const scenario of scenarios)await runCase(scenario,viewport);
  const files=(await readdir(artifacts)).filter(name=>name.startsWith('jump-completion-'));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<24*1024*1024-65536,'Jump evidence stays below bounded 24 MiB download size');
 }catch(error){report.errors.push(errorText(error));}
 finally{await browser?.close();report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(result=>result.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Jump completion Chromium checks failed; see verification-artifacts/jump-completion-report.json');console.log(`PASS: ${report.declaredCases} actual jump preparation/commit browser cases, exact accounting, native locking, saved dice and one mulligan, desktop/mobile screenshots; no uncaught errors or unhandled rejections.`);
}
