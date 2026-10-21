import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true}),base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
try{for(const width of [1440,390,320]){
 const f=guiFixture();f.state.snapshots[0].options.local=true;f.state.bank='10000000';f.state.ship.capacity='1000';
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);const native=Storage.prototype.setItem;globalThis.failBuy=false;Storage.prototype.setItem=function(k,v){if(k===key&&globalThis.failBuy){globalThis.failBuy=false;throw Error('Synthetic prewrite failure');}return Reflect.apply(native,this,[k,v]);};},{key:campaignKey,bytes:JSON.stringify(f.state)});
 await context.route('https://travellermap.com/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('[data-action="tab"][data-arg="Trade"]').click();
 const row=page.locator('[data-purchase-row]').first(),qty=row.locator('[name="quantity"]'),fee=row.locator('[name="fee"]'),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),campaignKey);
 const before=await read();await qty.fill('2');await fee.fill('7.5');assert.deepEqual(await read(),before);assert.match(await row.innerText(),/Goods.*broker.*=/);
 const info=page.locator('[data-action="offer-audit"]').first();await info.click();await page.locator('#modal').waitFor();await page.keyboard.press('Escape');assert.equal(await qty.inputValue(),'2');assert.equal(await fee.inputValue(),'7.5');assert.deepEqual(await read(),before);
 await page.evaluate(()=>globalThis.failBuy=true);await row.locator('[data-action="inline-buy"]').click();await row.locator('[role="status"]').filter({hasText:/fixed/}).waitFor();assert.deepEqual(await read(),before);assert.equal(await qty.getAttribute('readonly'),'');
 await row.locator('[data-action="inline-buy"]').click();await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision+1,{key:campaignKey,revision:before.revision});
 const saved=await read(),lot=saved.lots.at(-1);assert.equal(lot.quantity,'2');assert.equal(lot.audit.feePercent,7.5);assert.equal(saved.lots.length,before.lots.length+1);assert.equal(saved.actual,before.actual);assert.equal(saved.ledger.filter(x=>x.type==='Purchase').length,before.ledger.filter(x=>x.type==='Purchase').length+1);
 assert.ok(await page.locator('.cargo-table').count());await page.locator('[data-action="trade-side"][data-arg="sell"]').click();assert.ok(await page.locator('.sale-table').count());await page.locator('#tabs [data-action="tab"][data-arg="Cargo"]').click();assert.ok(await page.locator('.cargo-management-scroll').count());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 await mkdir(new URL('../verification-artifacts/',import.meta.url),{recursive:true});await page.locator('[data-action="tab"][data-arg="Trade"]').click();await page.locator('[data-action="trade-side"][data-arg="buy"]').click();await page.screenshot({path:new URL(`../verification-artifacts/inline-buy-${width}.png`,import.meta.url).pathname,fullPage:true});await context.close();console.log('Inline purchase passed '+width);
}
 for(const mode of ['deferred','unknown-before','unknown-after','ownership','stale-quote']){
  const f=guiFixture();f.state.bank='10000000';f.state.ship.capacity='1000';f.state.snapshots[0].options.local=true;
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:JSON.stringify(f.state)});
  await context.route('https://travellermap.com/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
  // Expose only provider boundaries and existing production actions; never replace a transaction body.
  await context.route('**/js/app.mjs*',r=>r.fulfill({contentType:'text/javascript',body:source+`\nglobalThis.inlineProbe={calls:0,promise:null,commit:buyInline,lose:()=>store.yield(),drift:()=>{state.snapshots[0].offers[0].unitPrice='1';},arm(mode){const save=store.save.bind(store);store.save=(...args)=>{this.calls++;if(mode==='unknown-before')return Promise.reject(Error('Synthetic unknown prewrite outcome'));if(mode==='unknown-after'){save(...args);return Promise.reject(Error('Synthetic unknown postwrite outcome'));}return new Promise((resolve,reject)=>{this.release=()=>{try{resolve(save(...args));}catch(error){reject(error);}};});};}};` }));
  const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('#tabs [data-action="tab"][data-arg="Trade"]').click();
  const row=page.locator('[data-purchase-row]').first(),id=await row.getAttribute('data-purchase-row'),before=await page.evaluate(k=>localStorage.getItem(k),campaignKey);
  await row.locator('[name="quantity"]').fill('2');
  if(mode==='stale-quote'){await page.evaluate(()=>inlineProbe.drift());await row.locator('[data-action="inline-buy"]').click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),campaignKey),before);assert.equal(await page.evaluate(()=>inlineProbe.calls),0);}
  else{
   await page.evaluate(mode=>inlineProbe.arm(mode),mode);await row.locator('[data-action="inline-buy"]').click();await page.waitForFunction(()=>inlineProbe.calls===1);
   if(mode==='deferred'||mode==='ownership'){
    assert.equal(await row.locator('[data-action="inline-buy"]').isDisabled(),true);await page.evaluate(id=>inlineProbe.commit(id),id);assert.equal(await page.evaluate(()=>inlineProbe.calls),1);assert.equal(await page.evaluate(k=>localStorage.getItem(k),campaignKey),before);
    if(mode==='ownership')await page.evaluate(()=>inlineProbe.lose());await page.evaluate(()=>inlineProbe.release());
   }
   if(mode==='deferred'){await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).lots.length===4,campaignKey);}
   else{await page.getByText(/Reload before buying again|Reload this page/i).first().waitFor();const after=await page.evaluate(k=>localStorage.getItem(k),campaignKey);if(mode==='unknown-after')assert.equal(JSON.parse(after).revision,JSON.parse(before).revision+1);else assert.equal(after,before);await page.evaluate(id=>inlineProbe.commit(id),id);assert.equal(await page.evaluate(()=>inlineProbe.calls),1);}
  }
  await context.close();console.log('Inline fault passed '+mode);
 }
}finally{await browser.close();}
