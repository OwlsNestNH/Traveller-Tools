import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390,320]){
 const f=guiFixture();f.state.settings.tax=false;f.state.snapshots.push({id:'inline-buyer',kind:'buyer',worldId:f.state.actual,world:f.state.snapshots[0].world,party:'synthetic-inline-buyer',partyName:'Synthetic buyer',startedHours:f.state.hours,hours:f.state.hours,success:true,criminal:false,options:{side:'sell',local:true,skill:1,counterparty:2},offers:[]});
 const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);globalThis.priceDice=0;const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{if(a instanceof Uint32Array&&a.length===1){priceDice++;a[0]=2;return a;}return random(a);};},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const click=(action,arg)=>page.locator(`[data-action="${action}"]${arg===undefined?'':`[data-arg="${arg}"]`}`).filter({visible:true}).first().click();
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Trade');await click('trade-side','sell');
 await page.locator('[data-lot="lot-recorded"]').check();await click('sale-offers');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await raw(),bytes);
 const row=page.locator('#sale-row-lot-recorded');await row.locator('[name="quantity"]').fill('1');await row.locator('[name="fee"]').fill('7.5');const dice=await page.evaluate(()=>priceDice);
 assert.equal(await raw(),bytes);assert.match(await row.locator('[data-inline-sale-total]').textContent(),/net/);
 await click('inline-sale-info','lot-recorded');await page.keyboard.press('Escape');assert.equal(await row.locator('[name="quantity"]').inputValue(),'1');assert.equal(await row.locator('[name="fee"]').inputValue(),'7.5');assert.equal(await page.evaluate(()=>priceDice),dice);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');
 await mkdir(new URL('../verification-artifacts/',import.meta.url),{recursive:true});await page.screenshot({path:new URL(`../verification-artifacts/inline-sale-${width}.png`,import.meta.url).pathname,fullPage:true});
 await page.evaluate(key=>{const native=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k===key&&fail){fail=false;throw Error('Synthetic inline sale prewrite');}return Reflect.apply(native,this,[k,v]);};},campaignKey);
 await click('inline-sell','lot-recorded');await row.locator('[data-inline-sale-error]').filter({hasText:/Synthetic inline sale prewrite/}).waitFor();assert.equal(await raw(),bytes);assert.equal(await row.locator('[name="quantity"]').evaluate(el=>el.readOnly),true);
 await click('inline-sell','lot-recorded');await page.waitForFunction(({key,rev})=>JSON.parse(localStorage.getItem(key)).revision===rev+1,{key:campaignKey,rev:f.state.revision});
 const saved=JSON.parse(await raw());assert.equal(saved.lots.find(l=>l.id==='lot-recorded').quantity,'3');const sales=saved.ledger.filter(e=>e.type==='Sale');assert.equal(sales.length,1);assert.equal(Number(sales[0].audit.feePercent),7.5);assert.equal(await page.evaluate(()=>priceDice),dice);assert.equal(saved.actual,f.state.actual);assert.deepEqual(errors,[]);
 await click('tab','Cargo');assert.match(await page.locator('#main').textContent(),/3/);await click('tab','Trade');await click('trade-side','buy');assert.match(await page.locator('.cargo-table').textContent(),/3 t/);
 console.log('Inline sale passed '+width);await context.close();
}
 for(const mode of ['deferred','unknown-before','unknown-after','ownership','stale-quote']){
  const f=guiFixture();f.state.settings.tax=false;f.state.snapshots.push({id:'inline-seller',kind:'buyer',worldId:f.state.actual,world:f.state.snapshots[0].world,party:'synthetic-inline-seller',partyName:'Synthetic buyer',startedHours:f.state.hours,hours:f.state.hours,success:true,criminal:false,options:{side:'sell',local:true,skill:1,counterparty:2},offers:[]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:JSON.stringify(f.state)});
  await context.route('https://travellermap.com/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
  // Expose only provider boundaries and existing production actions; never replace a transaction body.
  await context.route('**/js/app.mjs*',r=>r.fulfill({contentType:'text/javascript',body:source+`\nglobalThis.inlineProbe={calls:0,promise:null,commit:sellInline,lose:()=>store.yield(),drift:()=>{currentQuote('lot-recorded').unitPrice='1';},arm(mode){const save=store.save.bind(store);store.save=(...args)=>{this.calls++;if(mode==='unknown-before')return Promise.reject(Error('Synthetic unknown prewrite outcome'));if(mode==='unknown-after'){save(...args);return Promise.reject(Error('Synthetic unknown postwrite outcome'));}return new Promise((resolve,reject)=>{this.release=()=>{try{resolve(save(...args));}catch(error){reject(error);}};});};}};` }));
  const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('#tabs [data-action="tab"][data-arg="Trade"]').click();await page.locator('[data-action="trade-side"][data-arg="sell"]').click();await page.locator('[data-lot="lot-recorded"]').check();await page.locator('[data-action="sale-offers"]').click();
  const row=page.locator('#sale-row-lot-recorded'),id=await row.getAttribute('data-inline-sale'),before=await page.evaluate(k=>localStorage.getItem(k),campaignKey);
  await row.locator('[name="quantity"]').fill('2');
  if(mode==='stale-quote'){await page.evaluate(()=>inlineProbe.drift());await row.locator('[data-action="inline-sell"]').click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),campaignKey),before);assert.equal(await page.evaluate(()=>inlineProbe.calls),0);}
  else{
   await page.evaluate(mode=>inlineProbe.arm(mode),mode);await row.locator('[data-action="inline-sell"]').click();await page.waitForFunction(()=>inlineProbe.calls===1);
   if(mode==='deferred'||mode==='ownership'){
    assert.equal(await row.locator('[data-action="inline-sell"]').isDisabled(),true);await page.evaluate(id=>inlineProbe.commit(id),id);assert.equal(await page.evaluate(()=>inlineProbe.calls),1);assert.equal(await page.evaluate(k=>localStorage.getItem(k),campaignKey),before);
    if(mode==='ownership')await page.evaluate(()=>inlineProbe.lose());await page.evaluate(()=>inlineProbe.release());
   }
   if(mode==='deferred'){await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).lots.find(l=>l.id==='lot-recorded').quantity==='2',campaignKey);}
   else{await page.getByText(/Reload before selling again|Reload this page/i).first().waitFor();const after=await page.evaluate(k=>localStorage.getItem(k),campaignKey);if(mode==='unknown-after')assert.equal(JSON.parse(after).revision,JSON.parse(before).revision+1);else assert.equal(after,before);await page.evaluate(id=>inlineProbe.commit(id),id);assert.equal(await page.evaluate(()=>inlineProbe.calls),1);}
  }
  await context.close();console.log('Inline fault passed '+mode);
 }
}finally{await browser.close();}
