import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {configureFuel} from '../js/fuel.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const KEY='traveller-trade-route-calculator:v1';
const origin={id:'0,0',x:0,y:0,name:'Mulligan Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Mulligan Destination',hex:'0201'};
const third={...origin,id:'2,0',x:2,name:'Third World',hex:'0301'};
function fixture({empty=false,shortfall=false}={}){const s=S.initial();Object.assign(s,{initialized:true,actual:origin.id,route:[origin.id,destination.id,third.id],worlds:Object.fromEntries([origin,destination,third].map(w=>[w.id,structuredClone(w)])),bank:'100000'});s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,shortfall?1:60,40,2);s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};s.lots=[{id:'cargo',commodity:'11',description:'Saved cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];s.contracts=[{id:'mail',kind:'mail',status:'accepted',firstDeparture:null,origin:origin.id,destination:destination.id,quantity:'5',payment:'1000',dueHours:null}];s.policies=[{id:'policy',lotId:'cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:[origin.id,destination.id],routeProgress:0,destination:destination.id}];s.snapshots=[{id:'supplier',kind:'supplier',worldId:origin.id,hours:0,startedHours:0,party:'Saved supplier',offers:[{id:'offer',commodity:'11',description:'Saved offer',expired:false,remaining:'2',unitPrice:'100'}]}];if(empty){s.worlds[destination.id].emptySpace=true;s.worlds[destination.id].name='Empty hex 0201';}s.dashboardBaseline=createDashboardBaseline(s);return S.validate(s);}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
const material=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['revision','jumpAttempts','events','undo'].includes(k)));
const action=(page,name)=>page.locator('[data-action="'+name+'"]');
const close=page=>page.locator('#modal').waitFor({state:'hidden'});
const click=async(page,label)=>{await page.getByRole('button',{name:label,exact:true}).click();};
const tab=(page,label)=>page.locator('#tabs').getByRole('button',{name:label,exact:true}).click();
const commit=async page=>{await action(page,'jump').click();await page.locator('#modal [name="hours"]').fill('160');await click(page,'COMMIT JUMP');await close(page);};
const cases=[],errors=[];let activeContext=null;
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
async function context(state){
 const ctx=activeContext=await browser.newContext({viewport:{width:1440,height:1100}});ctx.setDefaultTimeout(10000);
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 await ctx.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));globalThis.jumpDieFace=2;globalThis.jumpDiceCalls=0;const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){globalThis.jumpDiceCalls++;array[0]=globalThis.jumpDieFace-1;return array;}return original(array);};},{key:KEY,state});
 await ctx.route('https://travellermap.com/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path.endsWith('/jumpworlds')?{Worlds:[]}:path.endsWith('/universe')?{Sectors:[]}:path.endsWith('/metadata')?{Subsectors:[]}:''});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();return {ctx,page};
}
async function finish(ctx,name){cases.push(name);await ctx.tracing.stop({path:join(artifacts,`jump-undo-${name}.zip`)});await ctx.close();activeContext=null;}
try{
 for(const options of [{empty:false,shortfall:false},{empty:true,shortfall:true}]){
  const source=fixture(options),{ctx,page}=await context(source),name=options.empty?'empty-shortfall':'normal';
  assert.equal(await action(page,'jump-undo').isDisabled(),true);
  await action(page,'jump').click();const prepared=await read(page);assert.deepEqual(material(prepared),material(source));assert.equal(prepared.jumpAttempts[0].rolls.length,1);
  if(options.shortfall)assert.match(await page.locator('#modal-body').textContent(),/Insufficient fuel/);
  await click(page,'Cancel');await close(page);await page.evaluate(()=>globalThis.jumpDieFace=6);await action(page,'jump').click();assert.equal(await page.evaluate(()=>globalThis.jumpDiceCalls),6,'Reopening does not roll');assert.deepEqual(await read(page),prepared);await page.keyboard.press('Escape');await close(page);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.evaluate(()=>globalThis.jumpDieFace=5);await action(page,'jump').click();assert.equal(await page.evaluate(()=>globalThis.jumpDiceCalls),0,'Reload reuses saved dice');await page.locator('#modal [name="hours"]').fill('160');await click(page,'COMMIT JUMP');await close(page);
  const arrived=await read(page);assert.equal(arrived.actual,destination.id);assert.equal(arrived.contracts[0].firstDeparture.to,destination.id);assert.equal(arrived.policies[0].status,'arrived');assert.equal(await action(page,'jump-undo').isDisabled(),false);
  await page.screenshot({path:join(artifacts,`jump-undo-${name}-available.png`),fullPage:true});
  await action(page,'jump-undo').click();await click(page,'Cancel');await close(page);assert.deepEqual(await read(page),arrived);
  await action(page,'world').filter({hasText:'Third World'}).first().click();await action(page,'jump-undo').click();await click(page,'Use mulligan & return');await close(page);
  const undone=await read(page);assert.deepEqual(material(undone),material(source));assert.equal(undone.jumpAttempts[0].mulliganUsed,true);assert.equal(await page.locator('.route-list [aria-current="location"]').getAttribute('data-arg'),origin.id);assert.match(await page.locator('.world-info').textContent(),/Mulligan Origin/);assert.match(await page.locator('#jump-undo-help').textContent(),/Mulligan used/);
  await page.evaluate(()=>globalThis.jumpDieFace=6);await action(page,'jump').click();const retry=await read(page);assert.deepEqual(retry.jumpAttempts[0].rolls[1],{dice:[6,6,6,6,6,6],total:36});assert.match(await page.locator('#modal-body').textContent(),/Mulligan used/);await click(page,'Cancel');await close(page);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await commit(page);assert.equal(await page.evaluate(()=>globalThis.jumpDiceCalls),0);assert.equal(await action(page,'jump-undo').isDisabled(),true);await tab(page,'History');assert.equal(await action(page,'undo').isDisabled(),false);const protectedBytes=await read(page);await action(page,'undo').click();assert.match(await page.locator('#message').textContent(),/Cannot undo this protected jump.*Mulligan used/);assert.deepEqual(await read(page),protectedBytes);assert.match(await page.locator('#main').textContent(),/Mulligan used/);
  await tab(page,'Overview');await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(artifacts,`jump-undo-${name}-used-mobile.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await finish(ctx,name);
 }
 {
  const {ctx,page}=await context(fixture());await commit(page);await action(page,'day-forward').click();const later=await read(page);assert.equal(await action(page,'jump-undo').isDisabled(),true);assert.match(await page.locator('#jump-undo-help').textContent(),/later campaign change/);await tab(page,'History');await action(page,'undo').click();assert.equal((await read(page)).hours,later.hours-24);assert.equal(await action(page,'undo').isDisabled(),false);const protectedBytes=await read(page);await action(page,'undo').click();assert.match(await page.locator('#message').textContent(),/Cannot undo this protected jump.*later campaign change/);assert.deepEqual(await read(page),protectedBytes);await finish(ctx,'later-action');
 }
 {
  const {ctx,page}=await context(fixture());await commit(page);await action(page,'jump-undo').click();const before=await read(page);const other=await ctx.newPage();await other.goto(base);await other.getByText(/Read-only/).first().waitFor();assert.equal(await action(other,'jump-undo').isDisabled(),true);await other.locator('#takeover').click();await other.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#modal-submit').disabled);assert.deepEqual(await read(page),before);assert.match(await page.locator('#modal-error').textContent(),/Editing moved/);await finish(ctx,'editor-lock');
 }
 assert.deepEqual(errors,[]);console.log('PASS: jump mulligan browser cases: '+cases.join(', '));
}finally{
 if(activeContext){await activeContext.pages()[0]?.screenshot({path:join(artifacts,'jump-undo-failure.png'),fullPage:true}).catch(()=>{});await activeContext.tracing.stop({path:join(artifacts,'jump-undo-failure.zip')}).catch(()=>{});}
 await writeFile(join(artifacts,'jump-undo-browser-summary.json'),JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,cases,errors},null,2));await browser.close();
}
