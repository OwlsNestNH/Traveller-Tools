import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
try{for(const width of [1440,390,320])for(const mode of ['off','manual','automatic','criminal']){
 const f=guiFixture();f.state.worlds[f.state.actual].uwp='A788879-C';f.state.settings.tax=['automatic','criminal'].includes(mode);f.state.settings.insurance=true;
 f.state.lots[0].description='Synthetic long independently audited electronics cargo lot for combined sale review';
 f.state.snapshots.push({id:'sell-buyer',kind:'buyer',worldId:f.state.actual,party:'synthetic|buyer',partyName:'Synthetic long buyer name — independently reviewed legal or criminal market',hours:f.state.hours,success:true,criminal:mode==='criminal',options:{side:'sell',skill:1,counterparty:2},offers:[]});
 const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);globalThis.saleDiceCalls=0;const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){saleDiceCalls++;array[0]=2;return array;}return random(array);};},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),dice=()=>page.evaluate(()=>saleDiceCalls);
 const click=(action,arg)=>page.locator('[data-action="'+action+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
 const fill=async(name,value)=>{const input=page.locator('#modal [name="'+name+'"]');for(const details of await input.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope>summary').click();await input.fill(value);await input.blur();};
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Trade');await click('trade-side','sell');assert.equal(await dice(),0);
 await click('lot-sell','lot-recorded');await page.getByRole('heading',{name:/^Review sale/}).waitFor();assert.equal(await dice(),3,'Explicit lot negotiation generates only its natural price dice');
 assert.equal(await page.locator('#modal-submit').textContent(),'COMMIT SALE');assert.equal(await page.locator('#modal details').first().evaluate(el=>el.open),false,'GM adjustments start collapsed');
 await fill('qty_lot-recorded','1');await fill('price_lot-recorded','25000');await fill('fee','10');await fill('reason','Synthetic explicit GM price and optional tax');
 if(mode==='manual')await fill('taxRate','8');
 if(mode==='off')assert.equal(await page.locator('[name="taxRate"]').inputValue(),'0');
 if(mode==='automatic'){
  assert.equal(await dice(),3);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await click('sale-tax-roll');assert.equal(await dice(),4);
  await fill('qty_lot-recorded','3');assert.equal(await dice(),4);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await click('sale-tax-roll');assert.equal(await dice(),5);
  await fill('qty_lot-recorded','1');assert.equal(await dice(),5);assert.equal(await page.locator('#modal-submit').isDisabled(),false);
 }else{assert.equal(await dice(),3);assert.equal(await page.locator('#sale-tax-action').isVisible(),false);}
 const expectedTax=mode==='automatic'?'Tax — 3%':mode==='manual'?'Tax — 8%':'Tax — 0%';assert.match(await page.locator('#sale-live-preview').textContent(),new RegExp(expectedTax));
 assert.match(await page.locator('#sale-live-preview').textContent(),mode==='manual'?/GM percentage override/:mode==='criminal'?/exemption \(house rule\)/:mode==='off'?/Automatic taxes off/:/Merchant Prince/);
 const count=await dice();await fill('qty_lot-recorded','999');assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await raw(),bytes);assert.equal(await dice(),count);await fill('qty_lot-recorded','1');
 await page.screenshot({path:artifacts+'sell-review-'+mode+'-'+width+'.png',fullPage:true});
 await page.locator('#modal-submit').scrollIntoViewIfNeeded();await page.screenshot({path:artifacts+'sell-review-footer-'+mode+'-'+width+'.png'});
 await page.evaluate(key=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k===key&&fail){fail=false;throw new DOMException('Synthetic prewrite failure','QuotaExceededError');}return original.call(this,k,v);};},campaignKey);
 await page.locator('#modal-submit').click();await page.locator('#modal-error').filter({hasText:/Synthetic prewrite/}).waitFor();assert.equal(await raw(),bytes);assert.equal(await page.locator('[name="qty_lot-recorded"]').evaluate(el=>el.readOnly),true);
 await page.locator('#modal-submit').dblclick();await page.locator('#modal').waitFor({state:'hidden'});const saved=JSON.parse(await raw());assert.equal(saved.revision,f.state.revision+1);assert.equal(saved.lots.find(l=>l.id==='lot-recorded').quantity,'3');assert.equal(await dice(),count);assert.equal(saved.undo.length,f.state.undo.length+1);
 const tax=saved.ledger.filter(l=>l.type==='Tax');assert.equal(tax.length,['manual','automatic'].includes(mode)?1:0);if(tax.length)assert.equal(tax[0].amount,mode==='manual'?'-400':'-150');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);report.push({width,mode,dice:count,revision:saved.revision});await context.close();
 }await writeFile(artifacts+'sell-review-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser.close();}
