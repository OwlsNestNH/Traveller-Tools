// Narrow Stage-2 revision regression. Actual Chromium localStorage and Web Locks
// back the public Store/controller boundary. UI cases use rendered controls.
// Every case has fresh synthetic storage; no production hooks or live map data.
// Run: node verification/campaign-revision-browser.test.mjs [playwright-module]
// Fixture-only check (no browser): append --fixtures-only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {configureFuel} from '../js/fuel.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const KEY='traveller-trade-route-calculator:v1';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const boundaryCases=['fresh-prepare-stale-memory','mulligan-prepare-stale-memory','history-undo-stale-memory','prepare-failure-retry-and-undo','read-only-roll-reuse'];
const report={suite:'Synchronous campaign revision guard',commit:process.env.TRAVELLER_COMMIT||null,cases:[],errors:[],scope:'Real Chromium Store/controller and rendered UI in fresh synthetic contexts. No asynchronous completion contract, cross-device store, or general contention claim.'};
let browser;

function fixture(){
 const state=S.initial(),origin={id:'0,0',x:0,y:0,name:'Revision Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'},destination={...origin,id:'1,0',x:1,name:'Revision Destination',hex:'0201'};
 Object.assign(state,{initialized:true,name:'Disposable revision regression',actual:origin.id,worlds:{[origin.id]:origin,[destination.id]:destination},route:[origin.id,destination.id],bank:'100000'});
 Object.assign(state.ship,{capacity:'100',staterooms:2,fuel:configureFuel(200,40,20,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}},accommodation:{rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}}});
 state.lots=[{id:'revision-cargo',commodity:'11',description:'Synthetic saved cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 state.contracts=[{id:'revision-mail',kind:'mail',status:'accepted',firstDeparture:null,origin:origin.id,destination:destination.id,quantity:'5',payment:'1000',dueHours:null}];
 state.policies=[{id:'revision-policy',lotId:'revision-cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:state.route.slice(),routeProgress:0,destination:destination.id}];
 // Keep storage-fault counters scoped to the revision operation under test.
 state.dashboardBaseline=createDashboardBaseline(state);
 return S.validate(state);
}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function contextFor(result){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});
 context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>page.on('pageerror',error=>result.pageErrors.push(error.stack||String(error))));
 await context.addInitScript(({key,bytes,origin})=>{
  if(location.origin!==origin)return;
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  // A single test-owned fault at the real browser persistence boundary. Other
  // Storage operations remain native; a rejected write never changes bytes.
  const setItem=Storage.prototype.setItem;
  globalThis.revisionFault={failNext:false,attempts:0,writes:0};
  Storage.prototype.setItem=function(name,value){
   if(this===localStorage&&name===key){
    const fault=globalThis.revisionFault;fault.attempts++;
    if(fault.failNext){fault.failNext=false;throw Error('Synthetic one-shot storage failure');}
    const result=Reflect.apply(setItem,this,[name,value]);fault.writes++;return result;
   }
   return Reflect.apply(setItem,this,[name,value]);
  };
  const random=crypto.getRandomValues.bind(crypto);
  globalThis.revisionDice={calls:0};
  crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){globalThis.revisionDice.calls++;array[0]=1;return array;}return random(array);};
 },{key:KEY,bytes:JSON.stringify(fixture()),origin:new URL(base).origin});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.href===new URL('verification/revision-harness.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic revision boundary</title><p>Isolated controller regression</p>'});
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
   const json=url.pathname.endsWith('/jumpworlds')?{Worlds:[]}:url.pathname.endsWith('/universe')?{Sectors:[]}:url.pathname.endsWith('/metadata')?{Subsectors:[]}:'';
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  }
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });
 return context;
}

async function boundaryCase(page,name,result){
 await page.goto(new URL('verification/revision-harness.html',base).href);
 const outcome=await page.evaluate(async ({base,name})=>{
  const S=await import(new URL('js/state.mjs',base).href),{Store,KEY}=await import(new URL('js/persistence.mjs',base).href),{createCampaignController}=await import(new URL('js/campaign-controller.mjs',base).href);
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const same=(a,b,message)=>check(JSON.stringify(a)===JSON.stringify(b),message);
  const rejected=(callback,pattern)=>{try{callback();}catch(error){check(pattern.test(error.message),'Unexpected rejection: '+error.message);return error.message;}throw Error('Expected operation to reject');};
  const economic=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
  let memory,failNotify=false,notifications=0,controller;
  let roleReady,roleFailed;
  const ready=new Promise((resolve,reject)=>{roleReady=resolve;roleFailed=reject;});
  const store=new Store(next=>{notifications++;if(failNotify){failNotify=false;throw Error('Synthetic notification failure after durable write');}memory=next;},(editable,message)=>editable?roleReady():roleFailed(Error(message)));
  controller=createCampaignController({getState:()=>memory,getStore:()=>store,getKnownWorlds:()=>({}),getRounding:()=>[]});
  await store.acquire();await ready;notifications=0;
  const start=structuredClone(memory),roll=()=>({dice:[2,2,2,2,2,2],total:12});
  const snapshot=()=>({raw:localStorage.getItem(KEY),memory:JSON.stringify(memory),notifications,attempts:revisionFault.attempts,writes:revisionFault.writes});
  const unchanged=(before,message)=>{same(snapshot(),before,message);check(!controller.isLocalSave(),'Local-save ownership unwinds after rejection');};
  const errors=[],checks=[];
  const commit=attempt=>controller.transition('Jump: Revision Origin → Revision Destination',s=>S.commitJump(s,{attemptId:attempt.id,elapsed:160}),memory.revision);
  const advanceDisk=()=>{
   const before=structuredClone(memory),next=S.transition(memory,'Newer saved deposit',s=>S.deposit(s,11,'Synthetic later writer'));
   failNotify=true;errors.push(rejected(()=>store.save(next,memory.revision),/notification failure/));
   same(memory,before,'Post-write notification failure keeps the old in-memory snapshot');
   check(store.read().revision===before.revision+1&&store.read().bank===String(BigInt(before.bank)+11n),'The newer disk campaign really committed');
  };
  try{
   if(name==='fresh-prepare-stale-memory'||name==='mulligan-prepare-stale-memory'){
    if(name.startsWith('mulligan')){const prepared=controller.prepareJump(roll,0);commit(prepared.attempt);controller.undoJump(memory.revision);check(memory.jumpAttempts[0].mulliganUsed,'Fixture reached the fresh mulligan-roll branch');}
    advanceDisk();const before=snapshot(),newer=store.read().revision;
    errors.push(rejected(()=>controller.prepareJump(roll,newer),/Campaign changed/));
    unchanged(before,'Stale memory plus newer expected revision cannot overwrite saved money, events, Undo, or rolls');
    errors.push(rejected(()=>controller.prepareJump(roll,memory.revision),/stale/));
    unchanged(before,'The existing disk-revision guard also keeps exact state and bytes');
    memory=store.read();const recovered=controller.prepareJump(roll,memory.revision);
    check(memory.revision===newer+1&&memory.bank==='100011','Reload then prepare preserves the newer saved deposit');
    check(recovered.attempt.rolls.length===(name.startsWith('mulligan')?2:1),'Recovery saves exactly the intended roll count');
    checks.push('Newer disk/old memory reproduced by a real durable write and failed notification','Both revision mismatch paths preserve exact memory, disk bytes and publication/write counts','Reloaded retry preserves newer economics');
   }else if(name==='history-undo-stale-memory'){
    controller.transition('First deposit',s=>S.deposit(s,7,'Synthetic initial deposit'),0);
    advanceDisk();const before=snapshot(),newer=store.read().revision;
    errors.push(rejected(()=>controller.undo(newer),/Campaign changed/));unchanged(before,'History Undo cannot apply the old inverse to a newer disk revision');
    errors.push(rejected(()=>controller.undo(memory.revision),/stale/));unchanged(before,'Old expected revision cannot overwrite the newer disk campaign either');
    memory=store.read();controller.undo(newer);
    check(memory.bank==='100007'&&memory.ledger.length===1&&memory.undo.length===1,'Fresh Undo removes only the newer deposit');
    controller.undo(memory.revision);same(economic(memory),economic(start),'The next legitimate Undo restores all original economics');
    checks.push('Stale History Undo preserves exact bytes, memory, ledger, inverse stack, events and write/publication counts','Reloaded Undo reverses only the newest deposit; following Undo restores the original campaign');
   }else if(name==='prepare-failure-retry-and-undo'){
    const before=snapshot();revisionFault.failNext=true;
    errors.push(rejected(()=>controller.prepareJump(roll,0),/storage failure/));
    const failed=snapshot();same({...failed,attempts:before.attempts},before,'Failed native storage write leaves exact bytes, memory and notifications unchanged');
    check(failed.attempts===before.attempts+1&&!controller.isLocalSave(),'One attempted write and no retained local-save flag');
    const prepared=controller.prepareJump(roll,0);
    check(memory.revision===1&&memory.jumpAttempts.length===1&&memory.events.length===1&&memory.undo.length===0,'Retry records one preparation and no action Undo');
    same(economic(memory),economic(start),'Preparation has no economic effects');
    const saved=snapshot();const reused=controller.prepareJump(()=>{throw Error('Existing dice rerolled');},0);
    unchanged(saved,'Stale expected revision is allowed for existing-roll non-writing reuse');same(reused.roll,prepared.roll,'Reused dice match saved dice');
    memory=store.read();commit(prepared.attempt);
    check(memory.revision===2&&memory.actual==='1,0'&&memory.hours===160&&memory.bank==='100000'&&memory.ship.fuel.aboardTons===0,'Commit preserves bank and consumes the independently expected 20 tons of fuel');
    same(memory.ship.lifeSupport.stockUnits,{numerator:'128',denominator:'3'},'Two crew consume 160/24 * 2 LSS from 56');
    check(memory.contracts[0].firstDeparture.to==='1,0'&&memory.policies[0].status==='arrived','Jump updates mail departure and insurance arrival');
    controller.undo(memory.revision);same(economic(memory),economic(start),'History Undo restores exact bank, stock, contracts, policy, route, ledger and inverse stack');
    check(memory.jumpAttempts[0].mulliganUsed,'History Undo still consumes the jump mulligan');
    checks.push('Preparation save fault leaves state intact; retry saves one prepared roll','Non-writing stale-revision reuse does not reroll or publish','Commit and History Undo retain fuel, exact LSS, mail, policy and bank accounting');
   }else if(name==='read-only-roll-reuse'){
    const prepared=controller.prepareJump(roll,0);advanceDisk();store.yield();check(!store.editable,'The real writer lock was relinquished');const before=snapshot();
    for(const expected of [0,store.read().revision]){
     const reused=controller.prepareJump(()=>{throw Error('Read-only reuse rerolled');},expected);
     check(reused.state===memory,'Read-only reuse returns the unchanged current state');same(reused.roll,prepared.roll,'Read-only reuse retains existing dice');unchanged(before,'Read-only existing-roll reuse never reaches Store.save');
    }
    checks.push('Real writer-lock yield permits saved-roll reuse with either old or newer expected revision despite divergent disk/memory');
   }else throw Error('Unknown boundary case '+name);
   return {checks,rejections:errors,finalRevision:memory.revision,writes:revisionFault.writes,attempts:revisionFault.attempts,notifications};
  }finally{store.yield();store.channel?.close();}
 },{base,name});
 Object.assign(result,outcome);
}

async function capture(page,result,label){
 const name='campaign-revision-'+result.id+'-'+label+'.png';
 await page.screenshot({path:join(artifacts,name),fullPage:false});result.screenshots.push(name);
}
async function layout(page,result,label){
 const geometry=await page.evaluate(()=>{const el=document.querySelector('#modal[open]'),rect=el?.getBoundingClientRect();return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:rect?{left:rect.left,right:rect.right,overflow:el.scrollWidth-el.clientWidth}:null};});
 result.layouts.push({label,...geometry});assert.ok(geometry.pageOverflow<=2,'No page overflow');
 if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,'Review dialog remains reachable');assert.ok(geometry.dialog.overflow<=2,'Review dialog has no horizontal clipping');}
}
async function uiCase(page,result){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const source=await read(page),initial=await raw(page);
 await page.evaluate(()=>{revisionFault.failNext=true;});await action(page,'jump').click();
 await page.locator('#message').filter({hasText:'Synthetic one-shot storage failure'}).waitFor();await closed(page);
 assert.equal(await raw(page),initial,'Failed preparation does not alter campaign bytes');
 await action(page,'jump').click();await page.locator('#modal[open]').waitFor();
 const prepared=await read(page),preparedBytes=await raw(page);
 assert.equal(prepared.revision,1);assert.equal(prepared.jumpAttempts.length,1);assert.equal(prepared.events.length,1);assert.equal(prepared.undo.length,0);assert.deepEqual(material(prepared),material(source));
 assert.equal(await page.evaluate(()=>revisionDice.calls),12,'The failed unsaved preparation is not retained; successful retry rolls once');
 await page.locator('#modal-cancel').click();await closed(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await action(page,'jump').click();assert.equal(await page.evaluate(()=>revisionDice.calls),0,'Reload and reopen reuse saved dice');assert.equal(await raw(page),preparedBytes);
 await page.locator('#modal [name="hours"]').fill('160');await layout(page,result,'prepared-review');await capture(page,result,'prepared-review');
 const title=await page.locator('#modal-title').textContent();
 await page.evaluate(()=>{revisionFault.failNext=true;});await page.locator('#modal-submit').click();
 await page.locator('#modal-error').filter({hasText:'Synthetic one-shot storage failure'}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#modal-submit').disabled);
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),true,'Save failure keeps the review open');assert.equal(await page.locator('#modal-title').textContent(),title);assert.equal(await page.locator('#modal [name="hours"]').inputValue(),'160');assert.equal(await raw(page),preparedBytes,'Failed commitment retains the exact prepared campaign');
 await layout(page,result,'failed-save-review');await capture(page,result,'failed-save-review');
 await page.locator('#modal-submit').click({clickCount:2,delay:20});await closed(page);await frames(page);
 const committed=await read(page);assert.equal(committed.revision,2,'Double-click retry records exactly one jump');assert.equal(committed.ledger.length,1);assert.equal(committed.ledger[0].type,'Jump');assert.equal(committed.ledger[0].amount,'0');assert.equal(committed.undo.length,1);assert.equal(committed.actual,'1,0');assert.equal(committed.bank,'100000');assert.equal(committed.hours,160);assert.equal(committed.ship.fuel.aboardTons,0);assert.deepEqual(committed.ship.lifeSupport.stockUnits,{numerator:'128',denominator:'3'});assert.equal(committed.contracts[0].firstDeparture.to,'1,0');assert.equal(committed.policies[0].status,'arrived');
 assert.equal(await page.evaluate(()=>revisionFault.writes),1,'One successful native campaign write after reload');
 await page.locator('#tabs').getByRole('button',{name:'History',exact:true}).click();
 await page.evaluate(()=>{revisionFault.failNext=true;});await action(page,'undo').click();await page.locator('#message').filter({hasText:'Synthetic one-shot storage failure'}).waitFor();
 assert.deepEqual(await read(page),committed,'Failed History Undo leaves all committed accounting intact');
 await action(page,'undo').click();const restored=await read(page);
 assert.equal(restored.revision,3);assert.deepEqual(material(restored),material(source),'Successful History Undo restores all pre-jump economics');assert.equal(restored.jumpAttempts[0].mulliganUsed,true);
 await page.locator('#tabs').getByRole('button',{name:'Overview',exact:true}).click();
 assert.equal(await action(page,'jump-undo').isDisabled(),true);assert.match(await page.locator('#jump-undo-help').textContent(),/Mulligan used/);
 await layout(page,result,'restored-overview');await capture(page,result,'restored-overview');
 result.checks.push('UI preparation storage failure and retry; cancel/reload reuse retains saved dice','Failed jump save preserves visible review, override and exact disk bytes','Real pointer double-click retry commits exactly once','Failed History Undo preserves economics; retry restores route, stocks, mail, policy, cargo and bank');
}

async function runCase(id,kind,viewport){
 const result={id,kind,viewport,status:'running',checks:[],screenshots:[],layouts:[],pageErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{
  context=await contextFor(result);const page=await context.newPage();
  if(kind==='boundary')await boundaryCase(page,id,result);else await uiCase(page,result);
  assert.deepEqual(result.pageErrors,[],'No uncaught browser errors');assert.deepEqual(result.unexpectedRequests,[],'No uncontrolled external requests');result.status='passed';
 }catch(error){result.status='failed';result.errors.push(error.stack||String(error));const page=context?.pages()[0];if(page)await capture(page,result,'failure').catch(()=>{});}
 finally{await context?.close();await writeFile(join(artifacts,'campaign-revision-report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(result.status.toUpperCase()+': '+id);for(const error of result.errors)console.error(error);
}

if(process.argv[2]==='--fixtures-only'){
 const state=fixture();assert.deepEqual(S.validate(JSON.parse(JSON.stringify(state))),state);assert.equal(boundaryCases.length+sizes.length,7);
 console.log('PASS: synthetic revision fixture validates; 5 boundary cases and 2 UI viewports declared. Chromium was not launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),encoding:'utf8'}).trim();if(report.commit)assert.equal(report.testedCommit,report.commit,'Exact requested revision');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const name of boundaryCases)await runCase(name,'boundary',sizes[0]);
  for(const viewport of sizes)await runCase('ui-failure-retry-undo-'+viewport.width,'ui',viewport);
 }catch(error){report.errors.push(error.stack||String(error));}
 finally{await browser?.close();report.passed=report.errors.length===0&&report.cases.length===boundaryCases.length+sizes.length&&report.cases.every(result=>result.status==='passed');await writeFile(join(artifacts,'campaign-revision-report.json'),JSON.stringify(report,null,2)+'\n');}
 if(!report.passed)throw Error('Campaign revision Chromium checks failed; see verification-artifacts/campaign-revision-report.json');
 console.log('PASS: 5 real-browser revision-boundary cases plus desktop/mobile UI failure, retry, repeated commit and Undo.');
}
