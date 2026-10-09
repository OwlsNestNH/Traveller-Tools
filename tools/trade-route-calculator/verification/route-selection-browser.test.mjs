import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import {normalize} from '../js/map.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(process.env.TRAVELLER_COMMIT)assert.equal(testedCommit,process.env.TRAVELLER_COMMIT,'Test the exact requested PR head');
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const sample=[
 {Name:'Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},
 {Name:'Jenghe',Hex:'1810',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'}
];
const worlds=sample.map(normalize),origin=worlds[0].id,known=worlds[1].id,first='-109,-70',second='-109,-71';
const seed=S.initial();Object.assign(seed,{initialized:true,bank:'100000',actual:origin,worlds:Object.fromEntries(worlds.map(w=>[w.id,w])),route:[origin]});S.validate(seed);
const key='traveller-trade-route-calculator:v1',seedBytes=JSON.stringify(seed),errors=[],checks=[],waiters=new Map();
const nextHex=id=>new Promise((resolve,reject)=>{
 assert.ok(!waiters.has(id),'Only one expected request per hex');
 const timer=setTimeout(()=>{waiters.delete(id);reject(Error('Timed out waiting for hex lookup '+id));},15000);
 waiters.set(id,value=>{clearTimeout(timer);waiters.delete(id);resolve(value);});
});
await context.route('https://travellermap.com/api/**',async route=>{
 const url=new URL(route.request().url()),kind=url.pathname.split('/').at(-1);
 if(kind==='jumpworlds'){
  if(url.searchParams.get('jump')==='0'&&url.searchParams.has('x')){
   const id=url.searchParams.get('x')+','+url.searchParams.get('y'),waiting=waiters.get(id);
   if(!waiting){errors.push('Unexpected empty-hex lookup '+id);await route.fulfill({status:500,body:'Unexpected test lookup'});return;}
   const response=await new Promise(resolve=>waiting(resolve));await route.fulfill(response);return;
  }
  await route.fulfill({json:{Worlds:sample}});return;
 }
 if(kind==='universe'){await route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],X:-4,Y:-1}]}});return;}
 if(kind==='metadata'){await route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'}]}});return;}
 if(kind==='sec'){await route.fulfill({json:'Hex\tName\r\n'+sample.map(w=>w.Hex+'\t'+w.Name).join('\r\n')});return;}
 await route.fulfill({status:404,body:'Unused deterministic fixture'});
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
// Reset the synthetic baseline on navigation between independent scenarios.
await page.addInitScript(({key,seedBytes})=>{localStorage.setItem(key,seedBytes);window.qaRouteRejections=[];window.addEventListener('unhandledrejection',event=>window.qaRouteRejections.push(String(event.reason)));},{key,seedBytes});
const read=()=>page.evaluate(key=>localStorage.getItem(key),key);
const click=action=>page.locator('[data-action="'+action+'"]').click();
const hex=id=>page.locator('polygon[data-action="map-empty"][data-arg="'+id+'"]');
const choose=id=>page.locator('svg [data-action="map-world"][data-arg="'+id+'"]').click();
const path=()=>page.locator('.route-list [data-action="world"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.arg));
const status=()=>page.locator('.route-draft > p[role="status"]');
const save=()=>page.locator('[data-action="route-save"]');
const ready=()=>page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);
const emptyResponse=()=>({json:{Worlds:[]}});
const failureResponse=()=>({status:503,body:'Synthetic Traveller Map outage'});
async function begin(mode='build'){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await page.locator('#route-menu > summary').click();await click('route-'+mode);assert.equal(await read(),seedBytes);
}
async function pending(id,keyPress){
 const incoming=nextHex(id);
 if(keyPress){await hex(id).focus();await page.keyboard.press(keyPress);}else await hex(id).click();
 return incoming;
}
async function check(name){
 assert.equal(await read(),seedBytes);assert.deepEqual(await page.evaluate(()=>window.qaRouteRejections),[]);checks.push(name);
}
async function cancel(){await click('route-cancel');assert.equal(await page.locator('.route-draft').count(),0);}
async function drained(){await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>window.qaRouteRejections),[]);}
try{
 await begin();const a=await pending(first),b=await pending(second);
 assert.equal(await page.locator('.route-draft > ol > li').count(),2);assert.equal(await save().isDisabled(),true);
 b(emptyResponse());await page.locator('.route-draft > ol > li').nth(1).filter({hasText:/Empty hex 2009/}).waitFor();
 assert.equal(await save().isDisabled(),true);a(emptyResponse());await ready();assert.deepEqual(await path(),[origin,first,second]);
 await check('Build route preserves reversed empty-hex response order and blocks premature saves');
 await click('route-save');await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
 const saved=JSON.parse(await read());assert.deepEqual(saved.mandatoryStops,[first,second]);assert.deepEqual(saved.route,[origin,first,second]);
 for(const name of ['actual','hours','bank','lots','contracts','policies'])assert.deepEqual(saved[name],seed[name]);
 checks.push('Explicit save persists the intended route without moving ship, time, cargo or bank');

 await begin();const unknown=await pending(first);await choose(known);
 assert.equal(await page.locator('.route-draft > ol > li').count(),2);assert.equal(await save().isDisabled(),true);
 unknown(emptyResponse());await ready();assert.deepEqual(await path(),[origin,first,known]);await check('Build route preserves known-world clicks behind pending empty hex');await cancel();

 await begin('auto');const old=await pending(first);await choose(known);await ready();const latest=await path();old(emptyResponse());await drained();
 assert.deepEqual(await path(),latest);assert.deepEqual(latest,[origin,known]);assert.equal(await page.locator('.route-draft > ol > li').count(),1);
 await check('Auto plot keeps newer known world after obsolete empty lookup');await cancel();

 await begin('auto');const older=await pending(first),newer=await pending(second);newer(emptyResponse());await ready();older(emptyResponse());await drained();
 assert.deepEqual(await path(),[origin,second]);await check('Auto plot keeps only the latest unknown destination');await cancel();

 for(const keyPress of ['Enter','Space']){
  await begin();const failed=await pending(first,keyPress);failed(failureResponse());
  await page.locator('#message.error').filter({hasText:/Traveller Map returned 503.*Retry route/}).waitFor();
  await status().filter({hasText:/Could not check hex/}).waitFor();assert.equal(await save().isDisabled(),true);
  await check(keyPress+' reports async lookup failure visibly and preserves saved bytes');
  const retry=nextHex(first);await click('route-retry');const response=await retry;response(emptyResponse());await ready();
  assert.deepEqual(await path(),[origin,first]);await check(keyPress+' failure can retry the same ordered selection');
  await page.screenshot({path:join(artifacts,'route-selection-'+keyPress.toLowerCase()+'.png'),fullPage:true});await cancel();
 }

 for(const result of ['success','failure']){
  await begin();const stale=await pending(first,'Enter');await cancel();
  const message=await page.locator('#message').textContent();stale(result==='success'?emptyResponse():failureResponse());await drained();
  assert.equal(await page.locator('.route-draft').count(),0);assert.equal(await page.locator('#message').textContent(),message);
  await check('Cancel ignores pending keyboard '+result+' without resurrecting the draft');
 }

 await begin();const removed=await pending(first);await click('route-last');await choose(known);await ready();removed(emptyResponse());await drained();
 assert.deepEqual(await path(),[origin,known]);await check('Removing a pending stop retires its late response');await cancel();

 await begin();const previousDraft=await pending(first);await cancel();await page.locator('#route-menu > summary').click();await click('route-build');await choose(known);await ready();
 previousDraft(emptyResponse());await drained();assert.deepEqual(await path(),[origin,known]);await check('An older draft lookup cannot change a new plan');await cancel();

 assert.deepEqual(errors,[]);console.log('PASS: '+checks.join('; ')+'.');
}catch(error){
 errors.push(error.stack||String(error));await page.screenshot({path:join(artifacts,'route-selection-failure.png'),fullPage:true});throw error;
}finally{
 await context.tracing.stop({path:join(artifacts,'route-selection-trace.zip')});
 await writeFile(join(artifacts,'route-selection-report.json'),JSON.stringify({testedCommit,requestedCommit:process.env.TRAVELLER_COMMIT||null,browser:browser.version(),checks,errors},null,2));await browser.close();
}
