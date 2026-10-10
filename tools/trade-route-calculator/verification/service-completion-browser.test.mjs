// Actual rendered Fuel/Life Support MFD completion checks, synthetic data only.
// Run through Chromium: node verification/service-completion-browser.test.mjs [playwright-module]
// --fixtures-only checks fixture economics/source wiring without launching Chromium.
// The test-owned deferred Store.save wrapper forwards every argument/token to
// the exact versioned runtime Store. No production implementation is replaced.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {fuelCorrection} from '../js/service-panels.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
// Representative rather than a full failure x service x purchase Cartesian product.
// Both panels share completion, while distinct prices/stock/correction paths each
// have their own real save, reload and actual History Undo positive control.
const scenarios=[
 {id:'fuel-standard',variant:'standard',mode:'success',navigation:true,fromExpenses:true},
 {id:'fuel-custom',variant:'custom',mode:'success'},
 {id:'fuel-water',variant:'water',mode:'success'},
 {id:'fuel-correction',variant:'correction',mode:'success'},
 {id:'support-standard',variant:'support',mode:'success',navigation:true},
 {id:'support-extra-comfort',variant:'extra',mode:'success'},
 {id:'fuel-prewrite-retry',variant:'custom',mode:'prewrite'},
 {id:'support-prewrite-retry',variant:'extra',mode:'prewrite'},
 {id:'fuel-unknown-before',variant:'standard',mode:'unknown-before'},
 {id:'support-unknown-after',variant:'extra',mode:'unknown-after'},
 {id:'support-notification-before',variant:'support',mode:'notification-before'},
 {id:'fuel-notification-after-role-throws',variant:'standard',mode:'notification-after'},
 {id:'support-completed-cleanup-failure',variant:'support',mode:'cleanup'},
 {id:'support-tokenless-publication',variant:'extra',mode:'tokenless'},
 {id:'fuel-native-takeover-revision',variant:'custom',mode:'takeover'}
];
const support=variant=>['support','extra'].includes(variant);
const label=variant=>support(variant)?'Refilled life support':variant==='correction'?'Adjusted fuel aboard':'Refuelled';
const successPattern=/\b(?:Refuelled|Adjusted fuel aboard|Refilled life support) saved\./i;
const reason='Disposable service completion verification';
const report={suite:'Fuel and Life Support MFD save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:scenarios.length*sizes.length,cases:[],errors:[],scope:'30 actual rendered service cases at 1440px and 390px. Exact versioned Store/controller, localStorage, native Web Locks and application handlers. Test-owned deferred save wrapper only. Pricing/schema unchanged; other async callers, network providers, cross-device authority and live user campaigns are not certified.'};
let browser;

function fixture(variant){
 const state=S.initial(),origin={id:'0,0',x:0,y:0,name:'Service Origin',sector:'Synthetic',hex:'0101',uwp:variant==='water'?'X700000-0':'A788899-C',zone:'Safe'},destination={...origin,id:'1,0',x:1,name:'Service Destination',hex:'0201'};
 Object.assign(state,{initialized:true,name:'Disposable service completion check',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'100000'});
 Object.assign(state.ship,{name:'Synthetic Service Trader',capacity:'100',staterooms:4,fuel:configureFuel(200,43,20,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}},accommodation:{rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:4,high:0}}});
 state.lots=[{id:'retained-service-cargo',commodity:'11',description:'Synthetic retained cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 return S.validate(state);
}
function inputFor(variant){return {kind:'fuel',fuelType:variant==='water'?'water':variant==='custom'?'refined':'unrefined',tons:variant==='water'?'3':variant==='custom'?'7.25':'23',...(variant==='custom'?{customFuelRate:'101.25'}:{}),otherSupplier:false,notes:reason};}
function candidateFor(before,variant){return S.transition(before,label(variant),state=>{
 if(support(variant))S.refillLifeSupport(state,variant==='extra'?{extraDays:'14',comfortCost:'2000',comfortNote:reason}:{extraDays:'0',comfortCost:'0',comfortNote:''});
 else if(variant==='correction')fuelCorrection(state,'13',reason);
 else S.shipExpense(state,inputFor(variant));
});}
function assertService(saved,before,variant){
 const cost={standard:'2300',custom:'810',water:'0',correction:'0',support:'4000',extra:'8000'}[variant];
 assert.equal(saved.revision,before.revision+1,'Exactly one campaign revision');assert.equal(saved.bank,String(BigInt(before.bank)-BigInt(cost)),'Existing exact service price');
 assert.equal(saved.undo.length,before.undo.length+1,'Exactly one inverse transaction');
 assert.equal(saved.events.filter(entry=>entry.label===label(variant)).length,before.events.filter(entry=>entry.label===label(variant)).length+1,'Exactly one transition event');
 for(const key of Object.keys(before).filter(key=>!['revision','bank','ship','ledger','undo','events'].includes(key)))assert.deepEqual(saved[key],before[key],'Unrelated campaign field '+key+' is unchanged');
 const ship=structuredClone(before.ship);
 if(support(variant)){
  ship.lifeSupport={capacityHours:672,stockUnits:{numerator:variant==='extra'?'168':'112',denominator:'1'}};
  const q=saved.ledger.at(-1).expense;
  assert.equal(q.kind,'lifeSupportRefill');assert.equal(q.standardAmount,'4000');assert.equal(q.extraAmount,variant==='extra'?'2000':'0');assert.equal(q.comfortAmount,variant==='extra'?'2000':'0');
  assert.equal(q.afterUnits,variant==='extra'?'168':'112');assert.equal(q.afterDays,variant==='extra'?'42':'28');
  if(variant==='extra')assert.equal(q.comfortNote,reason,'Comfort cost records its note and adds no separate stock');
 }else ship.fuel.aboardTons=variant==='correction'?13:variant==='water'?23:variant==='custom'?28:43;
 assert.deepEqual(saved.ship,ship,'Only the selected service stock changes');
 if(variant==='correction'){
  assert.deepEqual(saved.ledger,before.ledger,'Correction has no payment, refund or zero-value receipt');
  const corrections=saved.events.filter(event=>event.fuelCorrection);assert.equal(corrections.length,1);assert.deepEqual(corrections[0].fuelCorrection,{before:20,after:13,removed:7,reason,bankChange:'0',world:before.actual});
 }else{
  assert.equal(saved.ledger.length,before.ledger.length+1);assert.deepEqual(saved.ledger.slice(0,-1),before.ledger);assert.equal(saved.ledger.at(-1).amount,cost==='0'?'0':'-'+cost);assert.equal(saved.ledger.at(-1).world,before.actual);
  if(!support(variant)){assert.equal(saved.ledger.at(-1).expense.kind,'fuel');assert.equal(saved.ledger.at(-1).expense.amount,cost);}
 }
}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events'].includes(key)));
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const field=(page,name)=>page.locator('#service-form [name="'+name+'"]');
const tab=(page,name)=>page.locator('#tabs').getByRole('button',{name,exact:true}).click();
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const gate=page=>page.evaluate(()=>serviceGate.snapshot());
const errorText=error=>error?.stack||String(error);
const panelClosed=page=>page.locator('#service-panel').waitFor({state:'hidden'});

async function contextFor(result,variant){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});
 context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>{page.on('pageerror',error=>result.pageErrors.push(errorText(error)));page.on('console',entry=>{if(entry.type()==='error')result.consoleErrors.push(entry.text());});});
 await context.exposeBinding('__serviceUnhandled',(_source,message)=>{result.unhandledRejections.push(message);});
 await context.addInitScript(({key,bytes,origin})=>{
  if(location.origin!==origin)return;
  // Observe only. No preventDefault and no test-owned .catch on the injected
  // rejection: the application must actually handle its completion Promise.
  addEventListener('unhandledrejection',event=>{void globalThis.__serviceUnhandled(String(event.reason?.stack||event.reason));});
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  const nativeSet=Storage.prototype.setItem;
  globalThis.serviceStorage={attempts:0,writes:0,failNext:false,observations:[]};
  Storage.prototype.setItem=function(name,value){
   if(this!==localStorage||name!==key)return Reflect.apply(nativeSet,this,[name,value]);
   const fault=serviceStorage;fault.attempts++;
   fault.observations.push({point:'before-native-setItem',message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#service-panel'),confirmDisabled:!!document.querySelector('#service-panel [data-action="service-confirm"]')?.disabled});
   if(fault.failNext){fault.failNext=false;throw Error('Synthetic known prewrite storage rejection');}
   const result=Reflect.apply(nativeSet,this,[name,value]);fault.writes++;return result;
  };
 },{key:KEY,bytes:JSON.stringify(fixture(variant)),origin:new URL(base).origin});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.href===new URL('verification/service-peer.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable native service Store peer</title><p>Native locking test peer</p>'});
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
   const json=url.pathname.endsWith('/jumpworlds')?{Worlds:[]}:url.pathname.endsWith('/universe')?{Sectors:[]}:url.pathname.endsWith('/metadata')?{Subsectors:[]}:'';
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  }
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });
 return context;
}
async function installGate(page,result){
 result.runtime=await page.evaluate(async()=>{
  const appURL=Array.from(document.scripts).find(script=>script.type==='module'&&/\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if(!appURL)throw Error('Actual app module was not found');
  const response=await fetch(appURL);if(!response.ok)throw Error('Cannot inspect actual runtime import URL');
  const source=await response.text(),specifier=source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if(!specifier)throw Error('Cannot identify exact runtime Store import');
  const storeURL=new URL(specifier,appURL).href;if(!new URL(storeURL).search)throw Error('Expected actual versioned runtime Store');
  const {Store,KEY}=await import(storeURL),nativeSave=Store.prototype.save;
  const observation=point=>({point,message:document.querySelector('#message')?.textContent||'',open:!!document.querySelector('#service-panel'),confirmDisabled:!!document.querySelector('#service-panel [data-action="service-confirm"]')?.disabled,revision:JSON.parse(localStorage.getItem(KEY)).revision});
  const g=globalThis.serviceGate={storeURL,armed:false,pending:null,store:null,args:null,calls:0,executions:0,notifyFault:null,roleFault:false,publications:[],observations:[],settlements:[],forwarded:[],candidates:[],roleThrows:0,roleCalls:0,cleanupFault:false,cleanupThrows:0,cleanupObservations:[]};
  // Fault the browser DOM primitive only when successful completion dismisses
  // the service. Actual receiveCampaign still renders the busy service first.
  const innerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{...innerHTML,set(value){
   if(g.cleanupFault&&this.id==='main'&&!String(value).includes('id="service-panel"')){
    g.cleanupFault=false;g.cleanupThrows++;g.cleanupObservations.push({point:'after-fulfilled-save-before-dismissal-render',settlement:g.settlements.at(-1)?.kind,actualPublication:g.publications.at(-1)?.actualCallback,durableCandidate:localStorage.getItem(KEY)===g.candidates.at(-1),message:document.querySelector('#message')?.textContent||''});
    throw Error('Synthetic DOM render failure after fulfilled service save');
   }
   return Reflect.apply(innerHTML.set,this,[value]);
  }});
  function observeStore(store){
   if(g.store===store)return;if(g.store)throw Error('Unexpected second Store in application page');g.store=store;
   const change=store.onChange,role=store.onRole;
   store.onChange=function(...args){
    const record={revision:args[0].revision,tokenPresent:args[1]?.saveToken!=null,tokenMatchesSave:args[1]?.saveToken!=null&&args[1].saveToken===g.args?.[2],actualCallback:false};
    g.publications.push(record);g.observations.push(observation('before-actual-receiveCampaign'));
    if(g.notifyFault==='before'){g.notifyFault=null;throw Error('Synthetic notification failure before actual receiveCampaign');}
    const result=Reflect.apply(change,this,args);record.actualCallback=true;g.observations.push(observation('after-actual-receiveCampaign'));
    if(g.notifyFault==='after'){g.notifyFault=null;throw Error('Synthetic notification failure after actual receiveCampaign');}return result;
   };
   store.onRole=function(...args){g.roleCalls++;const result=Reflect.apply(role,this,args);if(g.roleFault){g.roleFault=false;g.roleThrows++;throw Error('Synthetic role notification failure after actual role callback');}return result;};
  }
  Store.prototype.save=function(...args){
   observeStore(this);g.args=args;if(!g.armed)return Reflect.apply(nativeSave,this,args);
   if(g.pending)throw Error('Application reached Store.save twice while one service was pending');
   g.calls++;g.candidates.push(JSON.stringify(args[0]));
   g.forwarded.push({argumentCount:args.length,tokenPresent:args[2]!=null,tokenType:typeof args[2],expectedRevision:args[1],candidateRevision:args[0].revision});
   return new Promise((resolve,reject)=>{g.pending={store:this,args,resolve,reject};});
  };
  g.release=kind=>{
   const pending=g.pending;if(!pending)throw Error('No pending service gate');g.pending=null;
   if(kind==='unknown-before'){g.settlements.push({kind,executed:false});pending.reject(Error('Synthetic provider rejection with unknown commit outcome'));return;}
   try{
    g.executions++;const returned=Reflect.apply(nativeSave,pending.store,pending.args);
    if(kind==='unknown-after'){g.settlements.push({kind,executed:true});pending.reject(Error('Synthetic response lost after native durable save'));}
    else{g.settlements.push({kind:'native-fulfilled',executed:true});pending.resolve(returned);}
   }catch(error){g.settlements.push({kind:'native-rejected',code:error.code||null,committed:error.committed??null,message:error.message});pending.reject(error);}
  };
  g.snapshot=()=>({calls:g.calls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,forwarded:g.forwarded,publications:g.publications,observations:g.observations,settlements:g.settlements,candidates:g.candidates,roleThrows:g.roleThrows,roleCalls:g.roleCalls,cleanupThrows:g.cleanupThrows,cleanupObservations:g.cleanupObservations,storage:{...serviceStorage},durableHasSaveToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  return {appURL,storeURL};
 });
}
async function arm(page,{notification=null,roleFault=false,prewrite=false}={}){await page.evaluate(options=>{
 if(serviceGate.pending)throw Error('Previous gate still pending');serviceGate.armed=true;serviceGate.notifyFault=options.notification;serviceGate.roleFault=options.roleFault;serviceStorage.failNext=options.prewrite;
},{notification,roleFault,prewrite});}
const release=(page,kind='native')=>page.evaluate(kind=>serviceGate.release(kind),kind);
async function physicalClick(page,selector,options={}){
 const locator=page.locator(selector).filter({visible:true}).first();await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box,'Pointer target exists: '+selector);
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2,options);
}
async function capture(page,result,label,{controls=false}={}){
 const panel=page.locator('#service-panel');
 if(await panel.count()){
  if(controls)await action(page,'service-confirm').scrollIntoViewIfNeeded();
  else{await panel.evaluate(el=>{el.scrollTop=0;});await panel.scrollIntoViewIfNeeded();}
 }else await page.locator('#summary').scrollIntoViewIfNeeded();
 await frames(page);const filename='service-completion-'+result.id+'-'+label+'.jpg';
 // Readable quality-85 screenshots keep all before/after states in one bounded
 // evidence archive, without heavyweight traces or duplicate full-page images.
 await page.screenshot({path:join(artifacts,filename),type:'jpeg',quality:85});result.screenshots.push(filename);
}
async function layout(page,result,label){
 const geometry=await page.evaluate(()=>{
  const panel=document.querySelector('#service-panel'),r=panel?.getBoundingClientRect();
  return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,panel:r?{left:r.left,right:r.right,overflow:panel.scrollWidth-panel.clientWidth}:null};
 });
 result.layouts.push({label,...geometry});assert.ok(geometry.pageOverflow<=2,'No horizontal page overflow');
 if(geometry.panel){assert.ok(geometry.panel.left>=-1&&geometry.panel.right<=geometry.width+1,'MFD panel stays within viewport');assert.ok(geometry.panel.overflow<=2,'MFD has no horizontal clipping');}
}
const draftValues=page=>page.locator('#service-form').evaluateAll(forms=>forms.length?Object.fromEntries([...forms[0].elements].filter(el=>el.name).map(el=>[el.name,el.type==='checkbox'?el.checked:el.value])):null);
async function prepare(page,result,variant,{captureBefore=true,fromExpenses=false}={}){
 if(fromExpenses){
  await page.locator('#ship-actions [data-action="ship-expenses"]').click();await page.locator('#expense-panel').getByRole('button',{name:'Fuel ›',exact:true}).click();
  assert.equal(await page.locator('#expense-panel').count(),0,'Expense entry yields to the real Fuel MFD');result.checks.push('Actual Expenses → Fuel navigation enters the same completion-owned service');
 }else await page.locator('#ship-actions [data-action="'+(support(variant)?'refill-support':'refuel')+'"]').click();
 await page.locator('#service-panel').waitFor({state:'visible'});
 assert.equal(await page.locator('#modal').isVisible(),false,'Actual service is an MFD, not a substitute modal');
 if(support(variant)){
  await action(page,'service-adjust').click();await field(page,'extraDays').fill(variant==='extra'?'14':'0');
  if(variant==='extra'){await page.locator('.service-comfort > summary').click();await field(page,'comfortCredits').fill('2000');await field(page,'comfortNote').fill(reason);}
 }else if(variant==='correction'){
  await action(page,'service-fuel-correct').click();await field(page,'fuelRemaining').fill('21');assert.equal(await action(page,'service-review').isDisabled(),true,'Correction cannot create fuel or refund');
  await field(page,'fuelRemaining').fill('13');await field(page,'fuelReason').fill(reason);
 }else{
  const input=inputFor(variant);await field(page,'fuelTons').fill(input.tons);await field(page,'fuelType').selectOption(variant==='custom'?'custom':input.fuelType);
  if(variant==='custom'){await field(page,'customFuelType').selectOption('refined');await field(page,'customFuelRate').fill(input.customFuelRate);}
  await field(page,'expenseNotes').fill(reason);
  if(variant==='water'){assert.equal(await field(page,'otherSupplier').isChecked(),false);assert.match(await page.locator('#fuel-availability').textContent(),/advisory/i);}
 }
 result.draft=await draftValues(page);result.formHTML=await page.locator('#service-form').evaluate(form=>form.outerHTML);
 if(support(variant)||variant==='correction'){
  if(captureBefore)await capture(page,result,'before-editor');await action(page,'service-review').click();
 }
 result.review=await page.locator('#service-quote').textContent();result.token=await action(page,'service-confirm').getAttribute('data-service-token');
 result.confirmData=await action(page,'service-confirm').evaluate(button=>({...button.dataset}));
 assert.equal(await action(page,'service-confirm').isEnabled(),true,'Every planned scenario has a payable/recordable positive control');
 await layout(page,result,'before');if(captureBefore)await capture(page,result,'before');
}
async function replayConfirm(page,data){await page.evaluate(data=>{const button=document.createElement('button');Object.assign(button.dataset,data);document.body.append(button);button.click();button.remove();},data);}
async function repeatForm(page,html){await page.evaluate(html=>{
 const real=document.querySelector('#service-form');if(real){real.requestSubmit();real.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return;}
 const template=document.createElement('template');template.innerHTML=html;const form=template.content.firstElementChild;form.hidden=true;document.body.append(form);form.requestSubmit();form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.remove();
},html);}
async function beginPending(page,result,before,{navigation=false}={}){
 await action(page,'service-confirm').click();await page.waitForFunction(()=>!!serviceGate.pending);await frames(page);
 const expectedCalls=(await gate(page)).calls;
 assert.equal(await raw(page),before,'Deferred provider has not touched any saved byte');assert.doesNotMatch(await page.locator('#message').textContent(),successPattern,'No premature success');
 assert.equal(await page.locator('#service-panel').getAttribute('aria-busy'),'true');assert.match(await page.locator('#service-status').textContent(),/saving/i);
 assert.equal(await page.locator('#service-quote').textContent(),result.review,'Pending quote remains exact');
 assert.equal(await page.locator('#service-panel [data-action]:enabled').count(),0,'Every service action is disabled while saving');
 assert.equal(await page.locator('#service-panel input:enabled,#service-panel select:enabled').count(),0,'Every displayed service field is frozen');
 await physicalClick(page,'#service-panel [data-action="service-confirm"]',{clickCount:2,delay:20});await page.keyboard.press('Enter');await page.keyboard.press('Enter');
 await replayConfirm(page,result.confirmData);await repeatForm(page,result.formHTML);
 for(const name of ['service-back','service-cancel'])if(await action(page,name).count())await physicalClick(page,'#service-panel [data-action="'+name+'"]');
 // A detached but correctly tokened Cancel remains inert even for summary
 // layouts whose visible dismissal control is Back.
 for(const name of ['service-back','service-cancel','service-adjust','service-fuel-step'])await replayConfirm(page,{...result.confirmData,action:name,arg:'10'});
 await page.keyboard.press('Escape');
 if(navigation){
  for(const name of ['refuel','refill-support','ship-expenses','cargo-hold'])await physicalClick(page,'#ship-actions [data-action="'+name+'"]');
  await physicalClick(page,'#tabs [data-arg="Accounts"]');await physicalClick(page,'[data-action="map-expand"]');
  assert.equal(await page.locator('#modal').isVisible(),false,'Pending expansion cannot open a discard modal');assert.equal(await page.locator('.map-expanded').count(),0);
  assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');
  result.checks.push('Actual main tab, same/other service, Cargo, Expenses, map expansion, Back/Cancel and Escape cannot dismiss an in-flight MFD');
 }
 if(!await page.locator('#service-form').count()){
  // Reviewed LSS/correction panels intentionally have no editor. Replay their
  // real token-bearing editor as a connected detached form and deliver native
  // input/change events, verifying that the pending draft owns these values.
  const restored=await page.evaluate(({html})=>{
   const template=document.createElement('template');template.innerHTML=html;const form=template.content.firstElementChild;form.hidden=true;document.body.append(form);
   try{
    for(const el of form.elements){if(!el.name)continue;el.value=el.type==='number'?'1':'Must not replace reviewed draft';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    return Object.fromEntries([...form.elements].filter(el=>el.name).map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
   }finally{form.remove();}
  },{html:result.formHTML});
  assert.deepEqual(restored,result.draft,'Pending reviewed service restores its original draft even for detached editor input/change events');
 }
 if(await page.locator('#service-form').count()){
  const beforeValues=await draftValues(page);
  // Disabled physical controls are checked above. Injected DOM input/change
  // also cannot alter the captured draft or candidate; rerender reads session.
  await page.locator('#service-form').evaluate(form=>{for(const el of form.elements){if(!el.name)continue;if(el.type==='checkbox')el.checked=!el.checked;else if(el.tagName==='SELECT')el.selectedIndex=(el.selectedIndex+1)%el.options.length;else el.value=el.type==='number'?'1':'Must not replace pending draft';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
  await page.locator('#map-uwp').evaluate(el=>{el.checked=!el.checked;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await frames(page);assert.deepEqual(await draftValues(page),beforeValues,'Pending input/change cannot change frozen session values after actual map rerender');
 }
 await frames(page);assert.equal((await gate(page)).calls,expectedCalls,'Repeated pointer, Enter, tokened confirmation and native form submission reach one provider call');
 assert.equal(await raw(page),before);assert.equal(await page.locator('#service-panel').isVisible(),true);assert.equal(await page.locator('#service-quote').textContent(),result.review);
 assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);await layout(page,result,'pending-'+expectedCalls);await capture(page,result,'pending-'+expectedCalls);
 if(navigation)await capture(page,result,'pending-controls',{controls:true});
 result.checks.push('Delayed exact-byte preservation, no premature success, frozen service fields/actions, repeated activation and native form submission');
}
async function assertGateAccounting(page,result,{calls,executions,writes,beforeWrites=0,committed=false}){
 const snapshot=await gate(page);result.gate=snapshot;
 assert.equal(snapshot.calls,calls);assert.equal(snapshot.executions,executions);assert.equal(snapshot.storage.writes-beforeWrites,writes);assert.equal(snapshot.durableHasSaveToken,false);
 for(const entry of snapshot.forwarded){assert.ok(entry.argumentCount>=3,'Forward all live save arguments');assert.equal(entry.tokenPresent,true);assert.equal(entry.candidateRevision,entry.expectedRevision+1);}
 for(const entry of [...snapshot.observations,...snapshot.storage.observations])assert.doesNotMatch(entry.message,successPattern,'Success occurs only after durable write and actual publication complete');
 if(committed)assert.equal(await raw(page),snapshot.candidates.at(-1),'Native Store persisted exactly the submitted detached candidate bytes');
}
async function restored(page,result,before,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 assert.equal(await raw(page),bytes,'Reload cannot duplicate a service payment or correction');
 if(committed){
  assertService(await read(page),before,result.variant);await tab(page,'History');await action(page,'undo').click();await frames(page);
  assert.equal((await read(page)).revision,before.revision+2);assert.deepEqual(material(await read(page)),material(before),'Actual History Undo restores all original accounting, stock, cargo and inverse stack');
 }else assert.deepEqual(await read(page),before,'Reload confirms unknown-before-write did not commit');
 await tab(page,'Overview');await capture(page,result,'restored');result.checks.push(committed?'Reload retains exactly one service; actual History Undo restores complete material campaign':'Reload confirms no service was recorded');
}
async function terminal(page,result,before,{committed,unknown=false,roleThrows=0}){
 const pattern=unknown?/outcome could not be confirmed[\s\S]*Reload[\s\S]*History/i:/saved[\s\S]*Reload[\s\S]*do not record/i;
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#service-status')?.textContent||''));await frames(page);
 for(const selector of ['#service-status','#message','#save-status'])assert.match(await page.locator(selector).textContent(),pattern,'Authoritative terminal guidance in '+selector);
 assert.equal(await page.locator('#service-panel').isVisible(),true);assert.equal(await action(page,'service-confirm').isDisabled(),true);assert.equal(await page.locator('#takeover').isDisabled(),true);
 const snapshot=await gate(page);assert.equal(snapshot.editable,false);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.roleThrows,roleThrows);
 if(committed)assertService(await read(page),before,result.variant);else assert.deepEqual(await read(page),before);
 const bytes=await raw(page);await physicalClick(page,'#service-panel [data-action="service-confirm"]',{clickCount:2,delay:20});await page.keyboard.press('Enter');await replayConfirm(page,result.confirmData);await repeatForm(page,result.formHTML);await frames(page);
 assert.equal((await gate(page)).calls,1);assert.equal(await raw(page),bytes,'Terminal retry attempts cannot duplicate/guess payment');
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);
 assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true,'Native writer lock has actually been released');
 const roleCalls=(await gate(page)).roleCalls;
 await page.evaluate(key=>{const channel=new BroadcastChannel(key);channel.postMessage({type:'takeover',id:'synthetic-terminal-service-peer'});setTimeout(()=>channel.close(),100);},KEY);
 await page.waitForFunction(count=>serviceGate.roleCalls>count,roleCalls);await page.evaluate(()=>serviceGate.store.yield());
 assert.match(await page.locator('#service-status').textContent(),pattern);assert.match(await page.locator('#save-status').textContent(),pattern,'Later role callbacks retain reload-only guidance');
 assert.equal(await page.locator('#takeover').isVisible(),false);await layout(page,result,'terminal');await capture(page,result,'terminal');
 await action(page,'service-back').click();await panelClosed(page);assert.equal(await page.locator('[data-mutate]:enabled').count(),0,'Dismissal cannot restore mutation rights');
 await capture(page,result,'terminal-dismissed');result.checks.push('Terminal outcome freezes retries, releases native lock and keeps global reload-only guidance across role callbacks and dismissal');
}
async function takeover(page,result,before,context,beforeWrites){
 const peer=await context.newPage();await peer.goto(new URL('verification/service-peer.html',base).href);
 await peer.evaluate(async({storeURL})=>{const {Store}=await import(storeURL);globalThis.servicePeer={state:null,editable:false};servicePeer.store=new Store(next=>{servicePeer.state=next;},editable=>{servicePeer.editable=editable;});await servicePeer.store.acquire(true);},result.runtime);
 await peer.waitForFunction(()=>servicePeer.editable);await page.waitForFunction(()=>serviceGate.store.editable===false);
 result.peerLock=await peer.evaluate(async lock=>({editable:servicePeer.store.editable,held:(await navigator.locks.query()).held.filter(entry=>entry.name===lock).map(entry=>({name:entry.name,mode:entry.mode}))}),LOCK);
 assert.deepEqual(result.peerLock,{editable:true,held:[{name:LOCK,mode:'exclusive'}]},'The real peer exclusively owns the native writer lock');
 const revision=await peer.evaluate(async({storeURL})=>{
  const url=new URL('state.mjs',storeURL);url.search=new URL(storeURL).search;const S=await import(url.href),next=S.transition(servicePeer.state,'Peer deposit during pending service',state=>S.deposit(state,'7','Synthetic native lock owner'));
  servicePeer.store.save(next,servicePeer.state.revision);return servicePeer.state.revision;
 },result.runtime);
 assert.equal(revision,before.revision+1);await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:KEY,revision});
 const peerBytes=await raw(page);assert.equal((await read(page)).bank,String(BigInt(before.bank)+7n));assert.deepEqual((await read(page)).ship,before.ship);
 await release(page);await page.waitForFunction(()=>!document.querySelector('#service-panel')?.getAttribute('aria-busy')||document.querySelector('#service-panel').getAttribute('aria-busy')==='false');await frames(page);
 assert.equal(await raw(page),peerBytes,'Old owner cannot overwrite the new owner revision');assert.equal(await action(page,'service-confirm').isDisabled(),true);
 assert.match(await page.locator('#service-status').textContent(),/ownership|changed|read-only/i);assert.equal((await gate(page)).settlements[0].code,'SAVE_NOT_COMMITTED');assert.equal((await gate(page)).reloadRequired,false);
 await assertGateAccounting(page,result,{calls:1,executions:1,writes:0,beforeWrites});await capture(page,result,'ownership-lost');
 await replayConfirm(page,result.confirmData);await repeatForm(page,result.formHTML);assert.equal(await raw(page),peerBytes);assert.equal((await gate(page)).calls,1);
 await peer.evaluate(()=>{servicePeer.store.yield();servicePeer.store.channel?.close();});await peer.close();
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),peerBytes);
 await tab(page,'History');await action(page,'undo').click();await frames(page);assert.deepEqual(material(await read(page)),material(before),'Undo reverses only the legitimate new-owner deposit');
 await tab(page,'Overview');await capture(page,result,'restored');result.checks.push('Second real Store takes native Web Lock and writes newer revision; pending old-owner save rejects without a write, reload/Undo preserves peer authority');
}
async function tokenlessInvalidation(page,result,beforeBytes){
 // A successful first service is not needed to get the real Store: capture it
 // by observing the first gated write, then reject atomically before setItem.
 // This remains a genuine failure/retry scenario with a positive final save.
 await arm(page,{prewrite:true});await beginPending(page,result,beforeBytes);await release(page);
 await page.locator('#service-status').filter({hasText:'Synthetic known prewrite storage rejection'}).waitFor();
 await capture(page,result,'retryable-failure');
 const calls=(await gate(page)).calls;await page.evaluate(()=>serviceGate.store.onChange(serviceGate.store.read()));await frames(page);
 assert.equal((await gate(page)).publications.at(-1).tokenPresent,false);assert.equal(await raw(page),beforeBytes);
 assert.equal(await action(page,'service-confirm').isDisabled(),true,'Same-revision external publication invalidates the failed draft');assert.match(await page.locator('#service-status').textContent(),/changed|reopen/i);
 await replayConfirm(page,result.confirmData);await repeatForm(page,result.formHTML);await frames(page);assert.equal((await gate(page)).calls,calls);assert.equal(await raw(page),beforeBytes);
 await capture(page,result,'external-invalidated');await action(page,'service-back').click();await panelClosed(page);
 await prepare(page,result,result.variant,{captureBefore:false});await arm(page);await beginPending(page,result,beforeBytes);
 result.checks.push('Tokenless same-revision receiveCampaign after a classified failure invalidates that draft; only an explicitly reopened fresh service can save');
}
async function runService(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await installGate(page,result);
 const before=await read(page),beforeBytes=await raw(page),beforeWrites=(await gate(page)).storage.writes;
 await prepare(page,result,scenario.variant,{fromExpenses:scenario.fromExpenses});assert.equal(await raw(page),beforeBytes,'Opening/editing/review never serialize any campaign change');
 if(scenario.mode==='tokenless')await tokenlessInvalidation(page,result,beforeBytes);
 else{
  await arm(page,{prewrite:scenario.mode==='prewrite',notification:scenario.mode==='notification-before'?'before':scenario.mode==='notification-after'?'after':null,roleFault:scenario.mode==='notification-after'});
  await beginPending(page,result,beforeBytes,{navigation:scenario.navigation});
 }
 if(scenario.mode==='prewrite'){
  await release(page);await page.locator('#service-status').filter({hasText:'Synthetic known prewrite storage rejection'}).waitFor();await frames(page);
  assert.equal(await raw(page),beforeBytes);assert.equal(await page.locator('#service-quote').textContent(),result.review);assert.equal(await action(page,'service-confirm').isEnabled(),true);assert.equal(await action(page,'service-back').isEnabled(),true);
  if(support(scenario.variant)){await action(page,'service-adjust').click();assert.deepEqual(await draftValues(page),result.draft,'Failed support review retains all editable draft values');await capture(page,result,'failed-draft-editor');await action(page,'service-review').click();}
  else assert.deepEqual(await draftValues(page),result.draft,'Failed fuel keeps all exact draft values');
  assert.equal((await gate(page)).settlements[0].code,'SAVE_NOT_COMMITTED');assert.equal((await gate(page)).settlements[0].committed,false);
  assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);await capture(page,result,'retryable-failure');
  await arm(page);await beginPending(page,result,beforeBytes);await release(page);await panelClosed(page);await frames(page);
  assert.match(await page.locator('#message').textContent(),successPattern);assertService(await read(page),before,scenario.variant);
  await assertGateAccounting(page,result,{calls:2,executions:2,writes:1,beforeWrites,committed:true});await capture(page,result,'saved');
  result.checks.push('Native atomic setItem rejection preserves exact bytes, quote and editable draft; deliberate retry records one service only');await restored(page,result,before);return;
 }
 if(scenario.mode.startsWith('unknown-')){
  const committed=scenario.mode==='unknown-after';await release(page,scenario.mode);await terminal(page,result,before,{committed,unknown:true});
  await assertGateAccounting(page,result,{calls:1,executions:committed?1:0,writes:committed?1:0,beforeWrites,committed});await restored(page,result,before,{committed});return;
 }
 if(scenario.mode==='cleanup'){
  await page.evaluate(()=>{serviceGate.cleanupFault=true;});await release(page);await terminal(page,result,before,{committed:true});
  await assertGateAccounting(page,result,{calls:1,executions:1,writes:1,beforeWrites,committed:true});
  const snapshot=await gate(page);assert.equal(snapshot.cleanupThrows,1,'Fault fires in actual dismissal render, never a no-op injection');assert.equal(snapshot.settlements[0].kind,'native-fulfilled');assert.equal(snapshot.publications.at(-1).actualCallback,true);
  assert.deepEqual(snapshot.cleanupObservations,[{point:'after-fulfilled-save-before-dismissal-render',settlement:'native-fulfilled',actualPublication:true,durableCandidate:true,message:'Refilled life support saved.'}],'Fault stage is after durable candidate, actual publication and fulfilled application success, not an earlier notification failure');
  result.checks.push('Actual DOM cleanup throws after fulfilled native save and receiveCampaign; saved/reload guidance blocks payment retry');await restored(page,result,before);return;
 }
 if(scenario.mode.startsWith('notification-')){
  await release(page);const after=scenario.mode==='notification-after';await terminal(page,result,before,{committed:true,roleThrows:after?1:0});
  await assertGateAccounting(page,result,{calls:1,executions:1,writes:1,beforeWrites,committed:true});
  const snapshot=await gate(page),publication=snapshot.publications.at(-1);assert.equal(publication.actualCallback,after);assert.equal(publication.tokenMatchesSave,true);
  assert.equal(snapshot.settlements[0].code,'SAVE_COMMITTED_PUBLICATION_FAILED');assert.equal(snapshot.settlements[0].committed,true);
  result.checks.push(after?'Fault after actual receiveCampaign plus a secondary role callback throw cannot hide durable completion':'Fault before actual receiveCampaign follows durable setItem and is never called a safe retry');await restored(page,result,before);return;
 }
 if(scenario.mode==='takeover'){await takeover(page,result,before,context,beforeWrites);return;}
 await release(page);await panelClosed(page);await frames(page);assert.match(await page.locator('#message').textContent(),successPattern);assertService(await read(page),before,scenario.variant);
 const retried=scenario.mode==='tokenless';await assertGateAccounting(page,result,{calls:retried?2:1,executions:retried?2:1,writes:1,beforeWrites,committed:true});
 assert.equal((await gate(page)).publications.at(-1).tokenMatchesSave,true,'Native publication preserves the exact ephemeral token');
 await capture(page,result,'saved');result.checks.push('Exact original service economics, stock, audit, cargo and one inverse transaction after delayed native completion');await restored(page,result,before);
}
async function writeReport(){await writeFile(join(artifacts,'service-completion-report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,variant:scenario.variant,mode:scenario.mode,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{
  context=await contextFor(result,scenario.variant);const page=await context.newPage();await runService(page,result,scenario,context);await frames(page);
  assert.deepEqual(result.pageErrors,[],'No uncaught browser errors');assert.deepEqual(result.unhandledRejections,[],'No unhandled Promise rejection');assert.deepEqual(result.unexpectedRequests,[],'No uncontrolled external requests');result.status='passed';
 }catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});result.failedGate=await gate(page).catch(()=>null);}}
 finally{delete result.formHTML;await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
if(process.argv.includes('--fixtures-only')){
 for(const variant of ['standard','custom','water','correction','support','extra']){
  const before=fixture(variant);assert.deepEqual(S.validate(JSON.parse(JSON.stringify(before))),before);const saved=candidateFor(before,variant);assertService(saved,before,variant);assert.deepEqual(material(S.undo(saved)),material(before));
 }
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 assert.equal(scenarios.length,15);assert.equal(scenarios.length*sizes.length,30);assert.equal(new Set(scenarios.map(scenario=>scenario.id)).size,scenarios.length);
 console.log('PASS: six synthetic Fuel/LSS economics and inverse-Undo fixtures, actual versioned Store discovery; 15 scenarios x 2 widths = 30 browser cases declared. Chromium was not launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(report.requestedCommit)assert.equal(report.testedCommit,report.requestedCommit,'Exact requested revision');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const viewport of sizes)for(const scenario of scenarios)await runCase(scenario,viewport);
  const files=(await readdir(artifacts)).filter(name=>name.startsWith('service-completion-'));
  report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;
  report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((total,size)=>total+size,0);
  assert.ok(report.artifactBytes<24*1024*1024-65536,'Service screenshots and report remain below bounded 24 MiB artifact budget');
 }catch(error){report.errors.push(errorText(error));}
 finally{await browser?.close();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(result=>result.status==='passed');report.finishedAt=new Date().toISOString();await writeReport();}
 if(!report.passed)throw Error('Service completion Chromium checks failed; see verification-artifacts/service-completion-report.json');
 console.log('PASS: 30 actual Fuel/LSS MFD cases at desktop/mobile, exact durable economics, native locking, reload and actual History Undo; no uncaught errors or unhandled rejections.');
}
