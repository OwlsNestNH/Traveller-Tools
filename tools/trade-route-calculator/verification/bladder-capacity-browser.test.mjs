// Deterministic real-browser fuel migration and direct-ton settings regression.
// Run: node verification/bladder-capacity-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {resourceBarGeometry} from './world-readability.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const report={pass:false,widths:[320,390,1100,1440],scenarios:[]};
try{
 for(const width of report.widths){
  const fixture=guiFixture(),s=fixture.state;
  Object.assign(s,{lots:[],contracts:[],snapshots:[],policies:[],ledger:[],events:[],undo:[],jumpAttempts:[]});
  s.ship.capacity='100';s.ship.fuel={displacementTons:200,baseCapacityTons:40,aboardTons:40,bladderJumps:2,bladderTons:80,capacityTons:120};
  s.ship.accommodation.luggageMode='manual';s.ship.accommodation.luggageTons='0';
  const bytes=JSON.stringify(validate(s)),context=await browser.newContext({viewport:{width,height:1100},acceptDownloads:true}),errors=[];
  context.setDefaultTimeout(15000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
   if(u.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
   if(u.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
   if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?fixture.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):fixture.apiWorlds}});
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),read=async()=>JSON.parse(await raw());
  const tab=name=>page.locator('#tabs [data-arg="'+name+'"]').click();
  const field=name=>page.locator('#settings-form [name="'+name+'"]');
  async function set(name,value){
   const input=field(name);for(const detail of await input.locator('xpath=ancestor::details').all())if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
   await input.fill(String(value));
  }
  const save=()=>page.locator('#settings-save').click();
  const undo=async()=>{await tab('History');await page.locator('[data-action="undo"]').click();};
  async function checkSummary(aboard,baseTank,bladder){
   await tab('Overview');assert.equal(await page.locator('.fuel-counter .value').textContent(),`Aboard ${aboard}t · Tank ${baseTank}t · Bladder ${bladder}t`+(aboard===0?' · EMPTY':''));
   const geometry=await resourceBarGeometry(page);assert.equal(geometry.fuel.max,baseTank+bladder);assert.equal(geometry.fuel.fill,aboard);
   const display=await page.locator('.fuel-counter .value').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth}));
   assert.ok(display.font<=14&&display.height<=65&&display.overflow<=1,'Distinct quantities retain the compact summary at '+width+'px');
  }
  async function importCampaign(contents,confirm){
   await tab('Settings');await page.locator('#import-file').setInputFiles({name:'synthetic-bladder.json',mimeType:'application/json',buffer:Buffer.from(contents)});
   await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();
   if(confirm){await page.locator('#modal [name="backed"]').check();await page.locator('#modal').getByRole('button',{name:'Replace campaign',exact:true}).click();}
   else await page.locator('#modal').getByRole('button',{name:'Cancel',exact:true}).click();
   await page.locator('#modal').waitFor({state:'hidden'});
  }
  try{
   await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await checkSummary(40,40,80);assert.equal(await raw(),bytes,'Reading legacy capacity never changes saved bytes');
   await page.screenshot({path:artifacts+'/bladder-summary-'+width+'.png',fullPage:true});
   await tab('Settings');assert.equal(await field('bladderTons').inputValue(),'80');assert.equal(await page.locator('[name="bladderJumps"]').count(),0);
   assert.match(await page.locator('#settings-form').textContent(),/Fuel bladder capacity/);
   await set('bladderTons',2);await tab('Overview');assert.equal(await raw(),bytes);await tab('Settings');assert.equal(await field('bladderTons').inputValue(),'2');await page.locator('#settings-reset').click();assert.equal(await field('bladderTons').inputValue(),'80');assert.equal(await raw(),bytes);
   await set('bladderTons',2);await save();let saved=await read();assert.equal(saved.ship.fuel.bladderTons,2);assert.equal(saved.ship.fuel.capacityTons,42);assert.equal(Object.hasOwn(saved.ship.fuel,'bladderJumps'),false);assert.equal(saved.bank,s.bank);await checkSummary(40,40,2);
   await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await checkSummary(40,40,2);await undo();assert.deepEqual((await read()).ship.fuel,s.ship.fuel);
   await tab('Settings');await set('bladderTons',2);await save();const direct=await raw();await importCampaign(bytes,false);assert.equal(await raw(),direct,'Cancelled import retains direct settings');await importCampaign(direct,true);assert.equal((await read()).ship.fuel.bladderTons,2);
   await tab('Settings');await set('bladderTons',101);const beforeBad=await raw();await save();assert.match(await page.locator('#settings-error').textContent(),/exceeds cargo hold capacity/);assert.equal(await raw(),beforeBad);
   await set('bladderTons',2);await set('fuelAboard',43);await save();assert.match(await page.locator('#settings-error').textContent(),/Fuel aboard exceeds total fuel capacity/);assert.equal(await raw(),beforeBad);
   await set('fuelAboard',42);await save();await checkSummary(42,40,2);assert.match(await page.locator('#hold-summary').textContent(),/Fuel in bladders: 2 t/);
   await tab('Settings');await set('bladderTons',0);const beforeRemove=await raw();await save();assert.match(await page.locator('#settings-error').textContent(),/shrinking or removing/);assert.equal(await raw(),beforeRemove);
   await set('fuelAboard',40);await save();await checkSummary(40,40,0);assert.match(await page.locator('#hold-summary').textContent(),/Fuel in bladders: 0 t/);await undo();assert.equal((await read()).ship.fuel.bladderTons,2);assert.equal((await read()).ship.fuel.aboardTons,42);
   // Imported installed capacity can exceed the hold without reserving empty space.
   const oversized=structuredClone(s);oversized.ship.capacity='50';await importCampaign(JSON.stringify(oversized),true);await tab('Settings');await set('name','Unrelated settings edit');await save();assert.equal((await read()).ship.fuel.bladderTons,80);assert.equal(Object.hasOwn((await read()).ship.fuel,'bladderJumps'),false);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab('Settings');await set('name','Second unrelated edit');await save();assert.equal((await read()).ship.fuel.bladderTons,80);
   await set('capacity',49);const beforeHold=await raw();await save();assert.match(await page.locator('#settings-error').textContent(),/exceeds cargo hold capacity/);assert.equal(await raw(),beforeHold);
   // Actual fuel, cargo and support share the hold even with fitting equipment.
   const crowded=structuredClone(s);crowded.ship.capacity='50';crowded.ship.fuel={displacementTons:200,baseCapacityTons:40,aboardTons:40,bladderTons:40,capacityTons:80};crowded.lots=[{id:'crowded-cargo',commodity:'11',description:'Crowded cargo',quantity:'31',basis:'0',goodsValue:'0'}];await importCampaign(JSON.stringify(crowded),true);
   await tab('Settings');await set('fuelAboard',60);const beforeCargo=await raw();await save();assert.match(await page.locator('#settings-error').textContent(),/Fuel in bladders would exceed cargo capacity: 20 t of fuel, with 19 t available/);assert.equal(await raw(),beforeCargo);
   assert.deepEqual(errors,[]);report.scenarios.push({width,pass:true});console.log('PASS: direct bladder tons, migration/save/import/Undo, cargo bounds and compact readout at '+width+'px');
  }finally{await context.tracing.stop({path:artifacts+'/bladder-capacity-'+width+'.zip'});await context.close();}
 }
 report.pass=true;
}finally{await writeFile(artifacts+'/bladder-capacity-report.json',JSON.stringify(report,null,2));await browser.close();}
