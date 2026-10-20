// Synthetic campaigns only. Run with the same server and Playwright as other GUI suites.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const report=[];
try{
 for(const width of [1440,390,320]){
  const f=guiFixture(),s=f.state;s.ship.roundTons=false;s.ship.accommodation.luggageTons='0.125';
  s.ship.lifeSupport={capacityHours:672,stockUnits:'901.5'};
  s.lots[0].quantity='2.25';s.lots[1].commodity=s.lots[0].commodity;
  s.lots[1].description='Second separate lot';s.lots[0].audit.price.unitPrice='1234.56789';
  const bytes=JSON.stringify(s),context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=(action,arg)=>page.locator('[data-action="'+action+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
  const unchanged=async()=>assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),bytes);
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Cargo');
  assert.equal(await page.locator('[data-management-lot]').count(),3);
  assert.equal(await page.locator('.cargo-management input[type="checkbox"]').count(),0);
  assert.match(await page.locator('[data-management-lot="lot-recorded"]').textContent(),/2.25 t.*Cr 1,234.56789/s);
  assert.match(await page.locator('[data-management-stock="support"]').textContent(),/1.015 t/);
  assert.match(await page.locator('[data-management-stock="luggage"]').textContent(),/0.125 t/);
  assert.equal(await page.locator('.cargo-management').getByText(/overflow/i).count(),0);
  assert.doesNotMatch(await page.locator('#hold-summary').textContent(),/Life support overflow/);
  assert.equal(await page.locator('#hold-summary .value').textContent(),'13.39 / 120 t','Header total still includes cargo LSS');
  await unchanged();
  await click('lot-audit','lot-recorded');await page.locator('#modal-cancel').click();await unchanged();
  for(let i=0;i<2;i++){
   await page.locator('#cargo-search').fill('Second separate');assert.equal(await page.locator('[data-management-lot]').count(),1);
   await page.locator('#cargo-search').fill('');await click('tab','Overview');await click('tab','Cargo');await unchanged();
  }
  await page.locator('.cargo-management').screenshot({path:artifacts+'cargo-management-'+width+'.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page-level overflow at '+width);
  await click('tab','Trade');await click('trade-side','sell');await page.locator('[data-lot="lot-legacy"]').check();
  assert.equal(await page.locator('[data-lot]:checked').count(),1);
  assert.equal(await page.locator('[data-lot]:checked').getAttribute('data-lot'),'lot-legacy');
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),false,'Cargo Sell only opens Trade Sell');await unchanged();
  await click('buyer-search');await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();
  await page.locator('#modal-cancel').click();await unchanged();
  await click('tab','Cargo');assert.equal(await page.locator('[data-management-lot]').count(),3);await unchanged();
  for(const kind of ['empty','speculative','freight','mail','luggage','support']){
   const sample=structuredClone(s);sample.lots=[];sample.contracts=[];sample.ship.accommodation.luggageTons='0';sample.ship.lifeSupport={capacityHours:672,stockUnits:'800'};
   if(kind==='speculative')sample.lots=[structuredClone(s.lots[0])];
   if(kind==='freight'||kind==='mail')sample.contracts=[{...structuredClone(s.contracts[0]),kind,description:'Synthetic '+kind,quantity:'1',...(kind==='mail'?{firstDeparture:null,dueHours:null}:{})}];
   if(kind==='luggage')sample.ship.accommodation.luggageTons='0.125';
   if(kind==='support')sample.ship.lifeSupport.stockUnits='901.5';
   validate(sample);
   const sampleBytes=JSON.stringify(sample),visibleContext=await browser.newContext({viewport:{width,height:900}});
   await visibleContext.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:sampleBytes});
   await visibleContext.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
   const visiblePage=await visibleContext.newPage();visiblePage.on('pageerror',e=>errors.push(e.message));
   const sampleClick=(name,arg)=>visiblePage.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
   await visiblePage.goto(base);await visiblePage.getByText('Editing in this tab',{exact:true}).waitFor();await sampleClick('tab','Cargo');
   const panel=visiblePage.locator('.cargo-management');
   assert.equal(await panel.locator('[data-management-lot]').count(),kind==='speculative'?1:0,kind+' lot visibility');
   assert.equal(await panel.locator('[data-management-contract]').count(),['freight','mail'].includes(kind)?1:0,kind+' transport visibility');
   assert.equal(await panel.locator('[data-management-stock]').count(),['luggage','support'].includes(kind)?1:0,kind+' stock visibility');
   assert.equal(await panel.locator('h3').count(),kind==='empty'?0:1,'Empty categories disappear');
   assert.doesNotMatch(await panel.textContent(),/No owned|No accepted|No other cargo/);
   await sampleClick('tab','Overview');await sampleClick('cargo-hold');
   const quick=visiblePage.locator('#cargo-hold-panel');await quick.waitFor({state:'visible'});
   assert.equal(await quick.locator('.cargo-speculative').count(),kind==='speculative'?1:0);
   assert.equal(await quick.locator('.cargo-consignments').count(),['freight','mail'].includes(kind)?1:0);
   assert.equal(await quick.locator('.cargo-other dt').count(),['luggage','support'].includes(kind)?1:0);
   assert.doesNotMatch(await quick.textContent(),/No owned|No accepted/);
   assert.equal(await visiblePage.evaluate(key=>localStorage.getItem(key),campaignKey),sampleBytes,'Hide-empty rendering preserves every campaign byte');
   if(kind==='empty')await quick.screenshot({path:artifacts+'cargo-empty-'+width+'.png'});
   await visibleContext.close();
  }
  assert.deepEqual(errors,[]);report.push({width,exactQuantities:true,separateLots:true,sellContext:true,cancelPreservesBytes:true,navigationPreservesBytes:true});
  await context.close();
 }
 await writeFile(artifacts+'cargo-management-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
