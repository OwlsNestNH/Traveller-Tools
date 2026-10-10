// Deposit-only delayed completion checkpoint. Run only through real Chromium:
// node verification/deposit-completion-browser.test.mjs [playwright-module]
// --fixtures-only validates fixture/source wiring without launching a browser.
// Native Store, controller, application callbacks, localStorage and Web Locks
// execute unchanged. The test-owned save gate forwards every argument, including
// the ephemeral publication token, and invokes the original save only on release.
// No production function body, debug hook or production campaign is substituted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const scenarios=['delayed-success-keeps-draft','known-prewrite-rejection-retry','unknown-before-write','unknown-after-write','notification-before-publication','notification-after-publication-role-throws','tokenless-publication-while-pending','native-takeover-and-revision'];
const report={suite:'Deposit-only save completion and catalog Beta',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,cases:[],errors:[],scope:'Actual rendered Record deposit / Confirm deposit at 1440px and 390px with a test-owned deferred wrapper around the exact versioned runtime Store.save. Other async callers, new storage backends, cross-device authority and live user campaigns are not certified.'};
let browser;

function fixture(){
 const state=S.initial(),origin={id:'0,0',x:0,y:0,name:'Deposit Origin',sector:'Synthetic',hex:'0101',uwp:'A788899-C',zone:'Safe'},destination={...origin,id:'1,0',x:1,name:'Deposit Destination',hex:'0201'};
 Object.assign(state,{initialized:true,name:'Disposable deposit completion check',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'100000'});
 Object.assign(state.ship,{capacity:'100',staterooms:2,fuel:configureFuel(200,40,20,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}},accommodation:{rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}}});
 state.lots=[{id:'deposit-cargo',commodity:'11',description:'Synthetic retained cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 return S.validate(state);
}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events'].includes(key)));
const tab=(page,name)=>page.locator('#tabs').getByRole('button',{name,exact:true}).click();
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const gate=page=>page.evaluate(()=>depositGate.snapshot());
const errorText=error=>error?.stack||String(error);

async function contextFor(result){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});
 context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>{
  page.on('pageerror',error=>result.pageErrors.push(errorText(error)));
  page.on('console',entry=>{if(entry.type()==='error')result.consoleErrors.push(entry.text());});
 });
 await context.exposeBinding('__depositUnhandled',(_source,message)=>{result.unhandledRejections.push(message);});
 await context.addInitScript(({key,bytes,origin})=>{
  if(location.origin!==origin)return;
  // Observe, but never preventDefault or attach a rejection handler to the
  // injected Promise. The real application must own every gate rejection.
  addEventListener('unhandledrejection',event=>{void globalThis.__depositUnhandled(String(event.reason?.stack||event.reason));});
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  const nativeSet=Storage.prototype.setItem;
  globalThis.depositStorage={attempts:0,writes:0,failNext:false,observations:[]};
  Storage.prototype.setItem=function(name,value){
   if(this!==localStorage||name!==key)return Reflect.apply(nativeSet,this,[name,value]);
   const fault=depositStorage;fault.attempts++;
   fault.observations.push({point:'before-native-setItem',message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#modal')?.open,submitDisabled:!!document.querySelector('#modal-submit')?.disabled});
   if(fault.failNext){fault.failNext=false;throw Error('Synthetic known prewrite storage rejection');}
   const result=Reflect.apply(nativeSet,this,[name,value]);fault.writes++;return result;
  };
  const random=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=2;return array;}return random(array);};
 },{key:KEY,bytes:JSON.stringify(fixture()),origin:new URL(base).origin});
 const catalogRoot=new URL('verification/deposit-catalog/',base);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.href===new URL('index.html',catalogRoot).href)return route.fulfill({contentType:'text/html',body:await readFile(join(root,'index.html'),'utf8')});
  if(url.href===new URL('assets/css/style.css',catalogRoot).href)return route.fulfill({contentType:'text/css',body:await readFile(join(root,'assets/css/style.css'),'utf8')});
  if(url.href===new URL('assets/js/main.js',catalogRoot).href)return route.fulfill({contentType:'text/javascript',body:await readFile(join(root,'assets/js/main.js'),'utf8')});
  if(url.href===new URL('verification/deposit-peer.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable native Store peer</title><p>Native locking test peer</p>'});
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
   const json=url.pathname.endsWith('/jumpworlds')?{Worlds:[]}:url.pathname.endsWith('/universe')?{Sectors:[]}:url.pathname.endsWith('/metadata')?{Subsectors:[]}:'';
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  }
  if(result.kind==='catalog'&&url.origin==='https://img.shields.io'){
   result.blockedCounters.push(url.origin+url.pathname);
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="20"></svg>'});
  }
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });
 return context;
}

async function installGate(page,result){
 result.runtime=await page.evaluate(async()=>{
  const appURL=Array.from(document.scripts).find(script=>script.type==='module'&&/\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if(!appURL)throw Error('The running app module was not found');
  const response=await fetch(appURL);if(!response.ok)throw Error('Cannot inspect actual runtime import URL');
  const source=await response.text(),specifier=source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if(!specifier)throw Error('Cannot identify exact runtime Store import');
  const storeURL=new URL(specifier,appURL).href;
  if(!new URL(storeURL).search)throw Error('Expected the actual versioned runtime Store module');
  const {Store,KEY}=await import(storeURL),nativeSave=Store.prototype.save;
  const observation=point=>({point,message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#modal')?.open,submitDisabled:!!document.querySelector('#modal-submit')?.disabled,revision:JSON.parse(localStorage.getItem(KEY)).revision});
  const g=globalThis.depositGate={storeURL,armed:false,pending:null,store:null,args:null,calls:0,executions:0,notifyFault:null,roleFault:false,publications:[],observations:[],settlements:[],forwarded:[],roleThrows:0,roleCalls:0};
  function observeStore(store){
   if(g.store===store)return;
   if(g.store)throw Error('Unexpected second Store in application page');
   g.store=store;
   const change=store.onChange,role=store.onRole;
   store.onChange=function(...args){
    const record={revision:args[0].revision,tokenPresent:args[1]?.saveToken!=null,tokenMatchesSave:args[1]?.saveToken!=null&&args[1].saveToken===g.args?.[2],actualCallback:false};
    g.publications.push(record);g.observations.push(observation('before-actual-receiveCampaign'));
    if(g.notifyFault==='before'){g.notifyFault=null;throw Error('Synthetic notification failure before actual receiveCampaign');}
    const result=Reflect.apply(change,this,args);record.actualCallback=true;g.observations.push(observation('after-actual-receiveCampaign'));
    if(g.notifyFault==='after'){g.notifyFault=null;throw Error('Synthetic notification failure after actual receiveCampaign');}
    return result;
   };
   store.onRole=function(...args){
    g.roleCalls++;const result=Reflect.apply(role,this,args);
    if(g.roleFault){g.roleFault=false;g.roleThrows++;throw Error('Synthetic role notification failure after actual role callback');}
    return result;
   };
  }
  Store.prototype.save=function(...args){
   observeStore(this);g.args=args;
   if(!g.armed)return Reflect.apply(nativeSave,this,args);
   if(g.pending)throw Error('The application reached Store.save twice while one deposit was pending');
   g.calls++;
   g.forwarded.push({argumentCount:args.length,tokenPresent:args[2]!=null,tokenType:typeof args[2],expectedRevision:args[1],candidateRevision:args[0].revision});
   return new Promise((resolve,reject)=>{g.pending={store:this,args,resolve,reject};});
  };
  g.release=kind=>{
   const pending=g.pending;if(!pending)throw Error('No pending deposit gate');g.pending=null;
   if(kind==='unknown-before'){g.settlements.push({kind,executed:false});pending.reject(Error('Synthetic provider rejection with unknown commit outcome'));return;}
   try{
    g.executions++;const returned=Reflect.apply(nativeSave,pending.store,pending.args);
    if(kind==='unknown-after'){g.settlements.push({kind,executed:true});pending.reject(Error('Synthetic response lost after native durable save'));}
    else{g.settlements.push({kind:'native-fulfilled',executed:true});pending.resolve(returned);}
   }catch(error){g.settlements.push({kind:'native-rejected',code:error.code||null,committed:error.committed??null,message:error.message});pending.reject(error);}
  };
  g.snapshot=()=>({calls:g.calls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,forwarded:g.forwarded,publications:g.publications,observations:g.observations,settlements:g.settlements,roleThrows:g.roleThrows,roleCalls:g.roleCalls,storage:{...depositStorage},durableHasSaveToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL,storeURL};
 });
}
async function arm(page,{notification=null,roleFault=false,prewrite=false}={}){
 await page.evaluate(options=>{
  if(depositGate.pending)throw Error('Previous gate is still pending');
  depositGate.armed=true;depositGate.notifyFault=options.notification;depositGate.roleFault=options.roleFault;
  depositStorage.failNext=options.prewrite;
 },{notification,roleFault,prewrite});
}
const release=(page,kind='native')=>page.evaluate(kind=>depositGate.release(kind),kind);
async function physicalClick(page,selector,options={}){
 const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box,'Physical pointer target exists');
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2,options);
}
async function capture(page,result,label,{fullPage=false}={}){
 const filename='deposit-completion-'+result.id+'-'+label+'.png';
 await page.screenshot({path:join(artifacts,filename),fullPage});result.screenshots.push(filename);
}
async function layout(page,result,label){
 const geometry=await page.evaluate(()=>{const el=document.querySelector('#modal[open]'),rect=el?.getBoundingClientRect();return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:rect?{left:rect.left,right:rect.right,overflow:el.scrollWidth-el.clientWidth}:null};});
 result.layouts.push({label,...geometry});assert.ok(geometry.pageOverflow<=2,'No horizontal page overflow');
 if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,'Review stays within viewport');assert.ok(geometry.dialog.overflow<=2,'Review has no horizontal clipping');}
}
async function freightDraft(page){
 await tab(page,'Contracts');await action(page,'contracts-search').click();
 for(const [name,value] of Object.entries({destination:'1,0',dice:'8',skill:'0',characteristic:'0',days:'14'})){
  const input=page.locator('#modal [name="'+name+'"]');if(name==='destination')await input.selectOption(value);else await input.fill(value);
 }
 await page.getByText('Manual mail rolls (optional)',{exact:true}).click();
 await page.locator('#modal [name="mailAvailability"]').fill('2');await page.locator('#modal [name="mailContainers"]').fill('1');
 await page.getByText('Override freight / mail dice',{exact:true}).click();
 await page.locator('#modal [name="diceSequence"]').fill(Array(256).fill(3).join(','));
 await page.locator('#modal-submit').click();await closed(page);
 const ids=await draftIds(page);assert.ok(ids.length>0,'Actual contract search produced unrelated freight offers');return ids;
}
const draftIds=page=>page.locator('#main tbody tr').filter({hasText:'Freight contract'}).locator('[data-action="draft-edit"]').evaluateAll(elements=>elements.map(el=>el.dataset.arg));
async function reviewDeposit(page,result){
 await tab(page,'Accounts');await action(page,'deposit').click();
 assert.equal(await page.locator('#modal-title').textContent(),'Record deposit');
 await page.locator('#modal [name="amount"]').fill('10.1');await page.locator('#modal [name="reason"]').fill('Disposable completion deposit');
 await page.locator('#modal-submit').click();await page.locator('#modal-title').filter({hasText:'Confirm deposit'}).waitFor();
 assert.match(await page.locator('#modal-submit').textContent(),/11/,'Review normalizes deposit to Cr11');
 result.reviewBody=await page.locator('#modal-body').textContent();
}
async function beginPending(page,result,before){
 await page.locator('#modal-submit').click();await page.waitForFunction(()=>!!depositGate.pending);await frames(page);
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' is disabled during pending completion');
 assert.equal(await raw(page),before,'Pending provider has not touched saved campaign bytes');
 assert.doesNotMatch(await page.locator('#message').textContent(),/Manual deposit saved/i,'Pending deposit must not announce success');
 assert.equal(await page.locator('#modal-title').textContent(),'Confirm deposit');assert.equal(await page.locator('#modal-body').textContent(),result.reviewBody);
 const expectedCalls=(await gate(page)).calls;
 await physicalClick(page,'#modal-submit',{clickCount:2,delay:20});await page.keyboard.press('Enter');await page.keyboard.press('Enter');
 // A native form submission also reaches the real handler, even when a disabled
 // default button would normally suppress Enter's submission in Chromium.
 await page.locator('#modal-form').evaluate(form=>form.requestSubmit());
 for(const id of ['modal-cancel','modal-close'])await physicalClick(page,'#'+id);
 await page.keyboard.press('Escape');await frames(page);
 assert.equal((await gate(page)).calls,expectedCalls,'Pointer, Enter and repeated native submit reach only one provider call');
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),true,'Cancel, X and Escape cannot discard an in-flight review');
 assert.equal(await page.locator('#modal-body').textContent(),result.reviewBody);assert.equal(await raw(page),before);
 await layout(page,result,'pending-'+expectedCalls);await capture(page,result,'pending-'+expectedCalls);
}
function assertOneDeposit(saved,before){
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.bank,String(BigInt(before.bank)+11n));
 assert.equal(saved.ledger.length,before.ledger.length+1);assert.equal(saved.ledger.filter(entry=>entry.type==='Manual deposit'&&entry.reason==='Disposable completion deposit').length,1);
 assert.equal(saved.undo.length,before.undo.length+1);assert.equal(saved.events.filter(entry=>entry.label==='Manual deposit').length,before.events.filter(entry=>entry.label==='Manual deposit').length+1);
 assert.deepEqual(saved.lots,before.lots);assert.deepEqual(saved.ship,before.ship);assert.deepEqual(saved.contracts,before.contracts);
 assert.equal(saved.ledger.at(-1).amount,'11');
}
async function reloadAndUndo(page,result,before,{hasDeposit=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 assert.equal(await raw(page),bytes,'Reload itself never repeats a deposit');
 if(hasDeposit){
  assertOneDeposit(await read(page),before);await tab(page,'History');await action(page,'undo').click();await frames(page);
  const restored=await read(page);assert.equal(restored.revision,before.revision+2);assert.deepEqual(material(restored),material(before),'Actual History Undo restores all original accounting and inverse stack');
 }else assert.deepEqual(await read(page),before,'Reload confirms that unknown-before-write did not commit');
 await tab(page,'Accounts');await layout(page,result,'restored');await capture(page,result,'restored');
 result.checks.push(hasDeposit?'Reload finds exactly one durable deposit; actual History Undo restores bank and all original accounting':'Reload confirms no deposit was committed');
}
async function assertTerminal(page,result,before,{committed,unknown=false,roleThrows=0}){
 const pattern=unknown?/outcome could not be confirmed[\s\S]*Reload[\s\S]*History/i:/Deposit saved[\s\S]*Reload[\s\S]*do not record/i;
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#modal-error').textContent));await frames(page);
 assert.match(await page.locator('#modal-error').textContent(),pattern);assert.match(await page.locator('#message').textContent(),pattern);
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),true,'Terminal guidance stays in the original review');
 assert.equal(await page.locator('#modal-submit').isDisabled(),true,'Terminal deposit cannot be retried');
 assert.equal(await page.locator('#takeover').isDisabled(),true,'Terminal page cannot regain writing without reload');
 const state=await gate(page);assert.equal(state.editable,false);assert.equal(state.reloadRequired,true);assert.equal(state.roleThrows,roleThrows);
 const disk=await read(page);if(committed)assertOneDeposit(disk,before);else assert.deepEqual(disk,before);
 const bytes=await raw(page);await physicalClick(page,'#modal-submit',{clickCount:2,delay:20});await page.keyboard.press('Enter');await page.locator('#modal-form').evaluate(form=>form.requestSubmit());await frames(page);
 assert.equal((await gate(page)).calls,1);assert.equal(await raw(page),bytes,'Repeated terminal activation cannot repeat payment');
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);
 assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true,'The actual native writer lock has been released');
 const rolesBefore=(await gate(page)).roleCalls;
 await page.evaluate(key=>{const channel=new BroadcastChannel(key);channel.postMessage({type:'takeover',id:'synthetic-terminal-peer'});setTimeout(()=>channel.close(),100);},KEY);
 await page.waitForFunction(count=>depositGate.roleCalls>count,rolesBefore);
 await page.evaluate(()=>depositGate.store.yield());
 assert.match(await page.locator('#modal-error').textContent(),pattern,'Later takeover/yield cannot replace terminal reload guidance');
 assert.match(await page.locator('#save-status').textContent(),pattern,'Actual boot role callback preserves terminal reload guidance');
 assert.equal(await page.locator('#takeover').isDisabled(),true);assert.equal(await page.locator('#takeover').isVisible(),false);
 await layout(page,result,'terminal');await capture(page,result,'terminal');
 await page.locator('#modal-cancel').click();await closed(page);
 assert.equal(await page.locator('[data-mutate]:enabled').count(),0,'Dismissing terminal guidance does not restore writing');
 assert.equal(await page.locator('#takeover').isDisabled(),true);
 result.checks.push(unknown?'Unclassified provider rejection requires reload/History, never safe retry':'Durable notification failure shows saved/reload guidance and disables retry');
 result.checks.push('Native writer lock released; reload-only state disables takeover'+(roleThrows?' despite throwing role notification':''));
}
async function assertGateAccounting(page,result,{calls,executions,writes,beforeWrites=0}){
 const snapshot=await gate(page);result.gate=snapshot;
 assert.equal(snapshot.calls,calls);assert.equal(snapshot.executions,executions);assert.equal(snapshot.storage.writes-beforeWrites,writes);assert.equal(snapshot.durableHasSaveToken,false);
 for(const forwarded of snapshot.forwarded){assert.ok(forwarded.argumentCount>=3,'All arguments include the live ephemeral save token');assert.equal(forwarded.tokenPresent,true);}
 // Drop observations from earlier contract-search writes. Every observation
 // made after entering the deferred save must precede the success banner.
 const depositObservations=snapshot.observations.filter(entry=>entry.open);
 for(const entry of depositObservations)assert.doesNotMatch(entry.message,/Manual deposit saved/i,'Success is later than durable write and actual publication');
}
async function runDeposit(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await installGate(page,result);
 let drafts=null;
 if(['delayed-success-keeps-draft','tokenless-publication-while-pending'].includes(scenario))drafts=await freightDraft(page);
 const before=await read(page),beforeBytes=await raw(page),beforeWrites=(await gate(page)).storage.writes;
 await reviewDeposit(page,result);
 await arm(page,{prewrite:scenario==='known-prewrite-rejection-retry',notification:scenario==='notification-before-publication'?'before':scenario==='notification-after-publication-role-throws'?'after':null,roleFault:scenario==='notification-after-publication-role-throws'});
 await beginPending(page,result,beforeBytes);
 result.checks.push('Real Record deposit → Confirm deposit with Cr10.1 normalized to Cr11','Pending review retains exact bytes and content, blocks repeated pointer/Enter/native submit, Cancel/X/Escape and premature success');
 if(scenario==='known-prewrite-rejection-retry'){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known prewrite storage rejection'}).waitFor();await frames(page);
  assert.equal(await raw(page),beforeBytes);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await page.locator('#modal-body').textContent(),result.reviewBody);
  for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),false,'Known prewrite failure restores '+id);
  assert.doesNotMatch(await page.locator('#message').textContent(),/Manual deposit saved/i);
  assert.equal((await gate(page)).settlements[0].code,'SAVE_NOT_COMMITTED');assert.equal((await gate(page)).settlements[0].committed,false);
  await layout(page,result,'retryable-failure');await capture(page,result,'retryable-failure');
  await arm(page);await page.keyboard.press('Tab');await beginPending(page,result,beforeBytes);await release(page);await closed(page);await frames(page);
  assert.match(await page.locator('#message').textContent(),/Manual deposit saved/);assertOneDeposit(await read(page),before);
  await assertGateAccounting(page,result,{calls:2,executions:2,writes:1,beforeWrites});
  result.checks.push('Classified native prewrite rejection preserves the same review and exact disk bytes; one retry creates one durable deposit');
  await reloadAndUndo(page,result,before);return;
 }
 if(scenario.startsWith('unknown-')){
  const committed=scenario==='unknown-after-write';await release(page,committed?'unknown-after':'unknown-before');
  await assertTerminal(page,result,before,{committed,unknown:true});await assertGateAccounting(page,result,{calls:1,executions:committed?1:0,writes:committed?1:0,beforeWrites});
  await reloadAndUndo(page,result,before,{hasDeposit:committed});return;
 }
 if(scenario.startsWith('notification-')){
  await release(page);const after=scenario==='notification-after-publication-role-throws';
  await assertTerminal(page,result,before,{committed:true,roleThrows:after?1:0});await assertGateAccounting(page,result,{calls:1,executions:1,writes:1,beforeWrites});
  const snapshot=await gate(page),publication=snapshot.publications.at(-1);
  assert.equal(publication.actualCallback,after);assert.equal(publication.tokenMatchesSave,true,'Publication retains the exact token across the delay');
  assert.equal(snapshot.settlements[0].code,'SAVE_COMMITTED_PUBLICATION_FAILED');assert.equal(snapshot.settlements[0].committed,true);
  result.checks.push(after?'Fault occurs after actual receiveCampaign ran and durable bytes advanced':'Fault occurs after durable setItem but before actual receiveCampaign');
  await reloadAndUndo(page,result,before);return;
 }
 if(scenario==='native-takeover-and-revision'){
  const peer=await context.newPage();await peer.goto(new URL('verification/deposit-peer.html',base).href);
  const runtime=result.runtime;
  await peer.evaluate(async ({storeURL})=>{
   const {Store}=await import(storeURL);globalThis.depositPeer={state:null,editable:false};
   depositPeer.store=new Store(next=>{depositPeer.state=next;},editable=>{depositPeer.editable=editable;});
   await depositPeer.store.acquire(true);
  },runtime);
  await peer.waitForFunction(()=>depositPeer.editable);await page.waitForFunction(()=>depositGate.store.editable===false);
  result.peerLock=await peer.evaluate(async lock=>({editable:depositPeer.store.editable,held:(await navigator.locks.query()).held.filter(entry=>entry.name===lock).map(entry=>({name:entry.name,mode:entry.mode}))}),LOCK);
  assert.deepEqual(result.peerLock,{editable:true,held:[{name:LOCK,mode:'exclusive'}]},'The real peer exclusively owns the native writer lock');
  const peerRevision=await peer.evaluate(async ({storeURL})=>{
   const url=new URL('state.mjs',storeURL);url.search=new URL(storeURL).search;const S=await import(url.href);
   const next=S.transition(depositPeer.state,'Peer deposit while owner pending',state=>S.deposit(state,'7','Synthetic native lock owner'));
   depositPeer.store.save(next,depositPeer.state.revision);return depositPeer.state.revision;
  },runtime);
  assert.equal(peerRevision,before.revision+1);await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:KEY,revision:peerRevision});
  const peerBytes=await raw(page);assert.equal((await read(page)).bank,String(BigInt(before.bank)+7n));
  await release(page);await page.waitForFunction(()=>/read-only/i.test(document.querySelector('#modal-error').textContent));await frames(page);
  assert.equal(await raw(page),peerBytes,'Delayed old owner cannot overwrite the new owner revision');assert.equal(await page.locator('#modal-submit').isDisabled(),true);
  assert.equal((await gate(page)).settlements[0].code,'SAVE_NOT_COMMITTED');assert.equal((await gate(page)).reloadRequired,false);
  await assertGateAccounting(page,result,{calls:1,executions:1,writes:0,beforeWrites});await layout(page,result,'ownership-lost');await capture(page,result,'ownership-lost');
  await peer.evaluate(()=>{depositPeer.store.yield();depositPeer.store.channel?.close();});await peer.close();
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),peerBytes);
  await tab(page,'History');await action(page,'undo').click();assert.deepEqual(material(await read(page)),material(before),'Undo reverses only the legitimate new owner deposit');
  await tab(page,'Accounts');await capture(page,result,'restored');
  result.checks.push('A second real Store takes the native Web Lock through takeover and commits a newer revision while the original deposit is pending','Original native save rejects read-only without a write; reload retains peer deposit and History Undo restores bank');return;
 }
 if(scenario==='tokenless-publication-while-pending'){
  await page.evaluate(()=>depositGate.store.onChange(depositGate.store.read()));
  assert.equal(await raw(page),beforeBytes,'External publication itself is not a write');assert.equal((await gate(page)).publications.at(-1).tokenPresent,false);
 }
 await release(page);await closed(page);await frames(page);
 assert.match(await page.locator('#message').textContent(),/Manual deposit saved/);assertOneDeposit(await read(page),before);
 await assertGateAccounting(page,result,{calls:1,executions:1,writes:1,beforeWrites});
 assert.equal((await gate(page)).publications.at(-1).tokenMatchesSave,true,'Delayed local completion forwards the exact publication token');
 await tab(page,'Contracts');
 if(scenario==='delayed-success-keeps-draft')assert.deepEqual(await draftIds(page),drafts,'Local delayed completion preserves unrelated freight offers');
 else assert.deepEqual(await draftIds(page),[],'Tokenless external publication during a local wait clears unrelated freight offers');
 result.checks.push(scenario==='delayed-success-keeps-draft'?'Exact local publication identity survives the deferred boundary and retains unrelated freight drafts':'A tokenless external publication remains external during a pending local save and clears unrelated drafts');
 await reloadAndUndo(page,result,before);
}

async function catalogCase(page,result){
 await page.goto(new URL('verification/deposit-catalog/index.html',base).href);
 const cards=page.locator('main .tool-card'),headings=await cards.locator('h2').allTextContents();
 assert.deepEqual(headings,['Nav Calculator','Ship’s Log & Ledger','Traveller Tool Locker','Traveller Ship Operations — Beta','Traveller Vehicle Builder']);
 const card=cards.filter({has:page.getByRole('heading',{name:'Traveller Ship Operations — Beta',exact:true})});await card.scrollIntoViewIfNeeded();
 assert.equal(await card.getByRole('heading',{name:'Traveller Ship Operations — Beta',exact:true}).isVisible(),true);
 assert.equal(await card.getByRole('link',{name:'Launch Tool',exact:true}).getAttribute('href'),'tools/trade-route-calculator/');
 assert.equal(await page.getByRole('heading',{name:/Traveller Ship Operations.*Alpha/}).count(),0);
 assert.deepEqual(await cards.locator('a').evaluateAll(elements=>elements.map(el=>el.getAttribute('href'))),['tools/nav-calculator/','tools/traveller_ship_logger_v2/','tools/traveller_tools_buttons/','tools/trade-route-calculator/','tools/vehicle-builder/']);
 assert.deepEqual(await cards.locator('p').allTextContents(),[
  'Work out travel times before the captain promises delivery by lunch. Space is big. Your fuel budget isn’t.',
  'Track cargo, passengers, jumps and the bills that follow you across the stars. The mortgage survives every adventure.',
  'A stash of Traveller tools and generators for when the crew ignores your carefully prepared adventure. Again.',
  'Buy low, sell somewhere else, and discover what taxes did to your brilliant plan. Plot routes, trade goods and track cargo, fuel, life support and accounts.',
  'Build the ride your crew deserves—or the one they can afford. Add armour, weapons and seats, then see what still fits.'
 ]);
 assert.equal(result.blockedCounters.length,5,'All five external counter images are isolated test fixtures');
 await frames(page);await layout(page,result,'catalog');await capture(page,result,'beta-catalog',{fullPage:true});
 result.checks.push('Actual root catalog source shows the exact Beta heading, unchanged Launch Tool path, five unchanged neighboring card headings/paths and unchanged description; external counters intercepted');
}
async function writeReport(){await writeFile(join(artifacts,'deposit-completion-report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(id,kind,viewport,scenario){
 const result={id,kind,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],unexpectedRequests:[],blockedCounters:[],errors:[]};report.cases.push(result);let context;
 try{
  context=await contextFor(result);const page=await context.newPage();
  if(kind==='catalog')await catalogCase(page,result);else await runDeposit(page,result,scenario,context);
  await frames(page);assert.deepEqual(result.pageErrors,[],'No uncaught browser errors');assert.deepEqual(result.unhandledRejections,[],'No unhandled Promise rejections');assert.deepEqual(result.unexpectedRequests,[],'No uncontrolled external requests');result.status='passed';
 }catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});if(kind!=='catalog')result.failedGate=await gate(page).catch(()=>null);}}
 finally{await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+id);for(const error of result.errors)console.error(error);
}

if(process.argv.includes('--fixtures-only')){
 const state=fixture();assert.deepEqual(S.validate(JSON.parse(JSON.stringify(state))),state);
 const deposited=S.transition(state,'Manual deposit',next=>S.deposit(next,'11','Disposable completion deposit'));assertOneDeposit(deposited,state);assert.deepEqual(material(S.undo(deposited)),material(state));
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 const catalog=await readFile(join(root,'index.html'),'utf8');assert.match(catalog,/<h2>Traveller Ship Operations — Beta<\/h2>/);assert.ok(catalog.includes('href="tools/trade-route-calculator/"'));
 assert.equal(scenarios.length*sizes.length+sizes.length,18);
 console.log('PASS: synthetic deposit/Undo accounting, versioned runtime Store discovery and catalog source fixtures; 16 deposit cases plus 2 catalog viewports declared. Chromium was not launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(report.requestedCommit)assert.equal(report.testedCommit,report.requestedCommit,'Exact requested revision');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const viewport of sizes){for(const scenario of scenarios)await runCase(scenario+'-'+viewport.width,'deposit',viewport,scenario);await runCase('catalog-beta-'+viewport.width,'catalog',viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith('deposit-completion-')&&name.endsWith('.png'));
  report.screenshotBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((total,size)=>total+size,0);
  assert.ok(report.screenshotBytes<24*1024*1024,'Screenshots remain below the bounded 24 MiB artifact budget');
 }catch(error){report.errors.push(errorText(error));}
 finally{await browser?.close();report.passed=report.errors.length===0&&report.cases.length===scenarios.length*sizes.length+sizes.length&&report.cases.every(result=>result.status==='passed');report.finishedAt=new Date().toISOString();await writeReport();}
 if(!report.passed)throw Error('Deposit completion Chromium checks failed; see verification-artifacts/deposit-completion-report.json');
 console.log('PASS: 16 actual deposit completion cases and 2 catalog Beta viewports; no uncaught errors or unhandled rejections. Other async callers and backends remain outside scope.');
}
