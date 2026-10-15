// Synthetic campaigns only. Run with the same server and Playwright as other GUI suites.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
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
  await unchanged();
  await click('lot-audit','lot-recorded');await page.locator('#modal-cancel').click();await unchanged();
  for(let i=0;i<2;i++){
   await page.locator('#cargo-search').fill('Second separate');assert.equal(await page.locator('[data-management-lot]').count(),1);
   await page.locator('#cargo-search').fill('');await click('tab','Overview');await click('tab','Cargo');await unchanged();
  }
  await page.locator('.cargo-management').screenshot({path:artifacts+'cargo-management-'+width+'.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page-level overflow at '+width);
  await click('lot-sell','lot-legacy');
  assert.equal(await page.locator('[data-lot]:checked').count(),1);
  assert.equal(await page.locator('[data-lot]:checked').getAttribute('data-lot'),'lot-legacy');
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),false,'Cargo Sell only opens Trade Sell');await unchanged();
  await click('lot-sell','lot-legacy');await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();
  await page.locator('#modal-cancel').click();await unchanged();
  await click('tab','Cargo');assert.equal(await page.locator('[data-management-lot]').count(),3);await unchanged();
  assert.deepEqual(errors,[]);report.push({width,exactQuantities:true,separateLots:true,sellContext:true,cancelPreservesBytes:true,navigationPreservesBytes:true});
  await context.close();
 }
 await writeFile(artifacts+'cargo-management-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
