import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
try{
 for(const width of [1440,1100,768,390,320]){
  const f=guiFixture();f.state.settings.insurance=true;f.state.lots[2].description=f.state.lots[1].description;
  f.state.lots[0].description='Synthetic long cargo name — precision electronics held as a separately audited lot';
  const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=(action,arg)=>page.locator('[data-action="'+action+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Trade');await click('trade-side','sell');
  assert.equal(await raw(),bytes);assert.equal(await page.locator('.sale-table tbody tr').count(),f.state.lots.length);
  for(const lot of f.state.lots)assert.equal(await page.locator('[data-sale-quantity="'+lot.id+'"]').inputValue(),lot.quantity);
  assert.equal(await page.locator('[data-action="lot-audit"]').count(),f.state.lots.length);
  assert.equal(await page.locator('[data-action="lot-correct"]').count(),f.state.lots.length);
  assert.equal(await page.locator('[data-action="lot-insure"]').count(),f.state.lots.length);
  if(width>=1100){
   const alignment=await page.locator('.sale-table tbody tr').evaluateAll(rows=>rows.map(row=>{
    const textCenter=el=>{const range=document.createRange();range.selectNodeContents(el);const r=range.getClientRects()[0];return r.y+r.height/2;};
    const input=row.querySelector('[data-sale-quantity]').getBoundingClientRect();
    const values=[...row.querySelectorAll('td:nth-child(1) .cargo-name>span,td:nth-child(2) .cell-primary,td:nth-child(4) .price>span,td:nth-child(5) .price>span,td:nth-child(6) .cell-primary,.row-actions button:first-child')].map(textCenter);
    values.push(input.y+input.height/2);return {spread:Math.max(...values)-Math.min(...values),height:row.getBoundingClientRect().height};
   }));
   for(const row of alignment)assert.ok(row.spread<=3,'Primary text and quantity numerals share a visual center line: '+JSON.stringify(row));
   if(width>=1440)assert.ok(alignment.some(row=>row.height<=43),'Ordinary rows retain approved compact density');
  }
  // Same-description lots stay distinguishable through the existing keyboard/touch Audit action.
  for(const lot of f.state.lots.slice(1)){
   const audit=page.locator('[data-action="lot-audit"][data-arg="'+lot.id+'"]');
   await audit.focus();await audit.press('Enter');
   assert.equal(await page.locator('#modal-body dt').filter({hasText:/^Lot ID$/}).locator('xpath=following-sibling::dd[1]').textContent(),lot.id);
   assert.equal(await raw(),bytes,'Audit identity is read-only');await page.locator('#modal-cancel').click();
  }
  await click('sale-all');await page.locator('[data-sale-quantity]').first().fill('1');
  if(width<=390){
   const quantity=page.locator('[data-sale-quantity]').first();await quantity.scrollIntoViewIfNeeded();
   assert.ok(await quantity.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),'Quantity fully visible without sideways navigation');
   assert.ok(await page.locator('.sell-cargo-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+2));
   await page.screenshot({path:artifacts+'sell-selection-quantity-'+width+'.png'});
  }
  assert.equal(await page.locator('#sale-selection-preview').count(),0);assert.equal(await raw(),bytes);
  await page.locator('#cargo-search').fill('not present');assert.equal(await page.locator('.sale-table').count(),0);
  assert.match(await page.locator('.selected-preview').textContent(),new RegExp(f.state.lots.length+' selected.*'+f.state.lots.length+' hidden by search'));
  await page.locator('#cargo-search').fill('');assert.equal(await page.locator('[data-sale-quantity]').first().inputValue(),'1');
  await click('sale-clear');await click('lot-sell',f.state.lots[0].id);
  await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();assert.equal(await page.locator('[data-lot]:checked').count(),1);assert.equal(await raw(),bytes);
  await page.locator('#modal-cancel').click();
  await page.screenshot({path:artifacts+'sell-selection-'+width+'.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow at '+width);
  assert.deepEqual(errors,[]);report.push({width,selectionOnly:true,unchangedCampaign:true});await context.close();
 }
 await writeFile(artifacts+'sell-page-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}


