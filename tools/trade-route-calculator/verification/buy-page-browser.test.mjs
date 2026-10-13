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
 for(const width of [1440,1100,390,320]){
  const f=guiFixture();f.state.settings.insurance=true;f.state.bank='10000000';f.state.ledger[0].amount=f.state.bank;
  const original=f.state.snapshots[0].offers[0];f.state.snapshots[0].offers=Array.from({length:12},(_,i)=>({...structuredClone(original),id:i?'offer-'+i:original.id,description:'Synthetic commodity lot '+(i+1),audit:{...structuredClone(original.audit),percent:i===1?110:i===2?null:90}}));
  const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}}),errors=[];
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),click=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
  const screenshot=async name=>{await page.screenshot({path:artifacts+'buy-'+name+'-'+width+'.png',fullPage:true});};
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Trade');
  assert.equal(await raw(),bytes);assert.equal(await page.locator('.purchase-table tbody tr').count(),12);assert.equal(await page.locator('.cargo-table th').nth(4).textContent(),'Price paid / t');
  assert.equal(await page.locator('[data-action="buyer-search"]').count(),0);await screenshot('normal-collapsed');
  const before=await page.locator('.purchase-table').boundingBox();await click('search');await page.locator('#supplier-form').waitFor();
  const after=await page.locator('.purchase-table').boundingBox();assert.ok(after.y>before.y+100,'Inline supplier pushes goods down');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await raw(),bytes);await screenshot('normal-supplier');
  await page.locator('#supplier-form [name="party"]').fill('Synthetic review supplier');await page.locator('#supplier-form [name="dice"]').fill('12');await page.locator('#supplier-form [name="duration"]').fill('1');
  await page.locator('#supplier-form button[type="submit"]').click();try{await page.getByRole('heading',{name:'Review supplier search',exact:true}).waitFor({timeout:5000});}catch(error){console.log('Supplier error',await page.locator('#supplier-error').textContent(),errors);await screenshot('supplier-error');throw error;}assert.equal(await raw(),bytes);await page.locator('#modal-cancel').click();
  await click('supplier-close');assert.equal(await raw(),bytes);await click('market-expand');await screenshot('expanded-collapsed');
  const scroll=await page.locator('.market-goods .scroll').evaluate(el=>({h:el.clientHeight,full:el.scrollHeight}));assert.ok(scroll.h>=scroll.full-2,'Expanded market exposes all goods');
  await click('search');await screenshot('expanded-supplier');await click('supplier-close');
  await page.locator('#hide-high-prices').check();assert.equal(await page.locator('.purchase-table tbody tr').count(),11,'Only known above-retail quote is filtered');assert.equal(await raw(),bytes);await page.locator('#hide-high-prices').uncheck();
  await click('buy',original.id);await page.getByRole('heading',{name:/Review purchase/}).waitFor();await page.locator('#modal [name="quantity"]').fill('2');await page.locator('#modal [name="fee"]').fill('10');
  assert.match(await page.locator('#purchase-totals').textContent(),/Cash after/);assert.match(await page.locator('#purchase-totals').textContent(),/Cargo used \/ capacity after/);assert.equal(await page.locator('#modal button[type="submit"]').count(),1);await screenshot('purchase-review');assert.equal(await raw(),bytes);await page.locator('#modal-close').click();
  await click('lot-sell','lot-recorded');assert.equal(await page.locator('.trade-subtabs .active').textContent(),'Sell');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await page.locator('[data-lot="lot-recorded"]').isChecked(),true);assert.equal(await raw(),bytes);await screenshot('sell-navigation');
  await click('sale');await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();assert.equal(await raw(),bytes);await page.locator('#modal-cancel').click();await click('trade-side','buy');
  await click('buy',original.id);await page.locator('#modal [name="quantity"]').fill('1');await page.locator('#modal-submit').dblclick();await page.locator('#modal').waitFor({state:'hidden'});
  const purchased=JSON.parse(await raw());assert.equal(purchased.revision,f.state.revision+1);assert.equal(purchased.lots.length,f.state.lots.length+1);assert.equal(purchased.snapshots[0].offers[0].remaining,'11');
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');report.push({width,screenshots:6,revision:purchased.revision});await context.close();
 }
 await writeFile(artifacts+'buy-page-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
