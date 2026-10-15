import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
async function open(width,legacyReserve=false){
 const f=guiFixture(),s=f.state;s.ship.roundTons=false;s.ship.accommodation.luggageMode='manual';s.ship.accommodation.luggageTons='2';s.ship.accommodation.passengers.high=2;
 s.ship.lifeSupport=legacyReserve==='recurring'?{capacityHours:672,stockUnits:{numerator:'2701',denominator:'3'},cargoUnits:{numerator:'301',denominator:'3'},roundCargoSpace:true}:legacyReserve?{capacityHours:672,stockUnits:'901.5',cargoUnits:'101.5',roundCargoSpace:true}:{capacityHours:672,stockUnits:'1000',cargoUnits:'200'};s.contracts.push({...structuredClone(s.contracts[0]),id:'mail-removal',kind:'mail',quantity:'1',dueHours:null,firstDeparture:null});validate(s);
 const bytes=JSON.stringify(s),context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const click=(action,arg)=>page.locator('[data-action="'+action+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
 await click('tab','Cargo');
 return {s,bytes,context,page,errors,click,read:()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey),unchanged:async()=>assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),bytes),field:key=>page.locator('[data-cargo-remaining="'+key+'"]')};
}
try{
 for(const width of [1440,390,320]){
  const h=await open(width),{page,click,field}=h;
  assert.equal(await field('lot:lot-recorded').inputValue(),'4');assert.equal(await page.locator('[data-action="cargo-step"][data-arg="lot:lot-recorded|1"]').isDisabled(),true);
  await click('cargo-step','lot:lot-recorded|-1');await click('cargo-step','lot:lot-recorded|-1');assert.equal(await field('lot:lot-recorded').inputValue(),'2');
  await click('cargo-step','lot:lot-recorded|1');assert.equal(await field('lot:lot-recorded').inputValue(),'3');await h.unchanged();
  await click('cargo-cancel');assert.equal(await field('lot:lot-recorded').inputValue(),'4');await h.unchanged();
  await click('cargo-step','luggage|-1');await click('tab','Overview');await click('tab','Cargo');assert.equal(await field('luggage').inputValue(),'2');await h.unchanged();
  await field('lot:lot-recorded').fill('0');await field('lot:lot-recorded').press('Tab');await field('luggage').fill('0');await field('luggage').press('Tab');
  await field('contract:contract-fixture').fill('3');await field('contract:contract-fixture').press('Tab');await field('contract:mail-removal').fill('0');await field('contract:mail-removal').press('Tab');
  await click('cargo-step','support|-1');
  assert.equal(await page.locator('[data-management-lot="lot-recorded"]').count(),1,'Pending zero remains restorable');assert.equal(await page.locator('[data-management-stock="luggage"]').count(),1);
  assert.match(await page.locator('.cargo-removal-footer').innerText(),/Total removed: 10 t/);assert.match(await page.locator('.cargo-removal-footer').innerText(),/blocks ordinary delivery and payment/);await h.unchanged();
  await page.locator('.cargo-management').screenshot({path:artifacts+'cargo-removal-preview-'+width+'.png'});
  await page.locator('[data-action="cargo-confirm"]').evaluate(el=>{el.click();el.click();});
  await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision+1,{key:campaignKey,revision:h.s.revision});
  await page.locator('[data-management-lot="lot-recorded"]').waitFor({state:'detached'});const saved=await h.read();
  assert.equal(saved.revision,h.s.revision+1,'Repeated click commits exactly once');assert.equal(saved.bank,h.s.bank);assert.deepEqual(saved.ledger,h.s.ledger);assert.deepEqual(saved.ship.accommodation.passengers,h.s.ship.accommodation.passengers);assert.deepEqual(saved.ship.accommodation.crew,h.s.ship.accommodation.crew);
  assert.equal(saved.contracts.find(c=>c.id==='contract-fixture').quantity,'3');assert.equal(saved.contracts.find(c=>c.id==='mail-removal').status,'lost');assert.equal(saved.lots.length,h.s.lots.length-1);
  assert.equal(await page.locator('[data-management-stock="luggage"]').count(),0);assert.equal(await page.locator('[data-management-contract="mail-removal"]').count(),0);
  assert.deepEqual(saved.ship.lifeSupport.stockUnits,{numerator:'900',denominator:'1'});assert.deepEqual(saved.ship.lifeSupport.cargoUnits,{numerator:'100',denominator:'1'});
  await click('tab','Contracts');assert.equal(await page.locator('[data-action="deliver"][data-arg="contract-fixture"]').count(),0);assert.match(await page.locator('#main').innerText(),/Cargo loss - delivery\/payment blocked/);
  await click('tab','Cargo');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Cargo');assert.equal(await page.locator('[data-management-stock="luggage"]').count(),0);assert.deepEqual(await h.read(),saved);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');assert.deepEqual(h.errors,[]);await h.context.close();
  const failure=await open(width);await failure.click('cargo-step','lot:lot-recorded|-1');
  await failure.page.evaluate(key=>{window.__cargoSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.__cargoSet.call(this,k,v);};},campaignKey);
  await failure.click('cargo-confirm');await failure.page.getByText('Synthetic quota failure',{exact:false}).waitFor();await failure.unchanged();assert.equal(await failure.field('lot:lot-recorded').inputValue(),'3');
  await failure.page.evaluate(()=>Storage.prototype.setItem=window.__cargoSet);await failure.click('cargo-confirm');await failure.page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision+1,{key:campaignKey,revision:failure.s.revision});assert.equal((await failure.read()).lots[0].quantity,'3');assert.deepEqual(failure.errors,[]);await failure.context.close();
  const batch=await open(width,true);await batch.click('tab','Overview');await batch.click('refill-support');
  const cargoInput=batch.page.locator('#lss-cargo');await cargoInput.waitFor();assert.equal(await cargoInput.getAttribute('min'),'1.5');assert.equal(await cargoInput.getAttribute('step'),'100');assert.equal(await cargoInput.inputValue(),'101.5');assert.equal(await cargoInput.evaluate(el=>el.validity.valid),true);
  await cargoInput.press('ArrowUp');assert.equal(await cargoInput.inputValue(),'201.5');assert.equal(await cargoInput.evaluate(el=>el.validity.valid),true);await batch.unchanged();
  await cargoInput.press('ArrowDown');assert.equal(await cargoInput.inputValue(),'101.5');await batch.unchanged();await batch.click('service-cancel');await batch.unchanged();assert.deepEqual(batch.errors,[]);await batch.context.close();
  const recurring=await open(width,'recurring');await recurring.click('tab','Overview');await recurring.click('refill-support');const recurringInput=recurring.page.locator('#lss-cargo');await recurringInput.waitFor();assert.equal(await recurringInput.getAttribute('readonly'),'');await recurringInput.press('ArrowUp');assert.equal(await recurringInput.inputValue(),'100.333333');
  await recurring.click('service-lss-plus');await recurring.page.locator('#lss-reason').fill('Exact reserve preserved');assert.equal(await recurringInput.inputValue(),'200.333333');assert.equal(await recurring.page.locator('[data-action="service-confirm"]').isEnabled(),true);await recurring.unchanged();await recurring.click('service-lss-minus');assert.equal(await recurringInput.inputValue(),'100.333333');await recurring.click('service-cancel');await recurring.unchanged();assert.deepEqual(recurring.errors,[]);await recurring.context.close();
  report.push({width,recurringTailExactControls:true,legacyReserveNativeStep:true,previewCancel:true,navigationCancel:true,restorationCap:true,pendingZero:true,onceOnly:true,lossProtection:true,passengersPreserved:true,reload:true,quotaFailureRetry:true});
 }
 await writeFile(artifacts+'cargo-removal-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT??null,report},null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
