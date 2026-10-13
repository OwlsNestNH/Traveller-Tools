// Disposable synthetic campaigns; no external LLM or live map requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import * as S from '../js/state.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',origin=new URL(base).origin;
const key='traveller-trade-route-calculator:v1',artifacts=new URL('../verification-artifacts/',import.meta.url);
const world={id:'0,0',x:0,y:0,name:'Synthetic port',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const s=S.transition(S.initial(),'Campaign setup',n=>{Object.assign(n,{initialized:true,name:'</textarea><script>SECRET_INJECTION</script>',actual:world.id,worlds:{[world.id]:world},route:[world.id],bank:'100000'});n.ledger.push({id:'opening',type:'Opening bank',amount:'100000',hours:0,world:world.id});});
const cargo=S.transition(s,'Synthetic recorded cargo',n=>{
 n.ledger.push({id:'bought',type:'Purchase',world:world.id,hours:0,amount:'-24000',purchase:{commodity:'11',description:'SECRET CARGO',quantity:'2',unitPrice:'12000',fee:'0',premium:'0',priceAudit:{basePrice:20000,rawBasePrice:20000}}},{id:'sold',type:'Sale',world:world.id,hours:0,amount:'10000',audit:{commodity:'11',quantity:'1',unitPrice:'10000',basis:'9000',adjusted:'1000',audit:{basePrice:20000,rawBasePrice:20000}}});
 n.bank='86000';n.lots=[{id:'held',commodity:'11',description:'SECRET HOLD',world:world.id,hours:0,quantity:'2',goodsValue:'24000',basis:'24000',audit:{price:{unitPrice:'12000',audit:{basePrice:20000,rawBasePrice:20000}}}},{id:'legacy',commodity:'11',description:'Synthetic opening lot',world:world.id,hours:0,quantity:'1',goodsValue:'4000',basis:'4200'}];n.settings.maxBaseRetailEnabled=true;n.settings.maxBaseRetail='1';
});
const report={commit:process.env.TRAVELLER_COMMIT||null,suite:'Player briefing clipboard flow',cases:[]};
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH}:{})});
await mkdir(artifacts,{recursive:true});
try{
 for(const mode of ['success','denied','absent','cargo'])for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:844}]){
  const fixture=mode==='cargo'?cargo:s;
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),errors=[];context.setDefaultTimeout(15000);
  await context.addInitScript(({origin,key,bytes,mode})=>{
   if(location.origin!==origin)return;localStorage.setItem(key,bytes);
   globalThis.briefingCopies=[];
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode==='absent'?undefined:{writeText:async text=>{if(mode==='denied')throw Error('Synthetic permission denial');briefingCopies.push(text);}}});
  },{origin,key,bytes:JSON.stringify(fixture),mode});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===origin)return route.continue();
   if(url.origin==='https://travellermap.com')return route.fulfill({json:url.pathname.endsWith('/jumpworlds')?{Worlds:[]}:{},headers:{'Access-Control-Allow-Origin':'*'}});
   errors.push('Unexpected external request '+url.origin);return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('#tabs').getByRole('button',{name:'Overview',exact:true}).click();
  const button=page.locator('.planned-route .route-title').getByRole('button',{name:'Copy Player Briefing',exact:true});await button.waitFor();assert.equal(await button.getAttribute('data-mutate'),null);
  const bounds=await button.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width,'Button fits viewport');
  const before=await page.evaluate(key=>localStorage.getItem(key),key);
  const info=page.getByRole('button',{name:'About player briefing',exact:true}),popup=page.locator('#rule-reference-popup');
  for(const close of ['escape','button','repeat']){
   await info.focus();await page.keyboard.press('Enter');await popup.waitFor({state:'visible'});
   assert.match(await popup.innerText(),/Nothing is automatically sent to an LLM/);assert.match(await popup.innerText(),/Missing checks remain warnings/);
   const box=await popup.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width,'Information popup fits viewport');
   await page.keyboard.press('Tab');assert.equal(await popup.locator('.rule-reference-body').evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Tab');assert.equal(await popup.locator('.rule-reference-close').evaluate(el=>el===document.activeElement),true);
   if(close==='escape')await page.keyboard.press('Escape');else if(close==='repeat')await popup.locator('.rule-reference-close').dblclick();else await popup.locator('.rule-reference-close').click();
   assert.equal(await popup.isVisible(),false);assert.equal(await info.evaluate(el=>el===document.activeElement),true);
  }
  await info.click();await page.screenshot({path:new URL('player-briefing-info-'+mode+'-'+viewport.width+'.png',artifacts).pathname,fullPage:true});await page.keyboard.press('Escape');
  await button.click();let prompt;
  if(mode==='success'||mode==='cargo'){
   await page.getByText('Player briefing prompt and data copied.',{exact:false}).waitFor();prompt=await page.evaluate(()=>briefingCopies[0]);assert.equal(await page.locator('#modal').isVisible(),false);
  }else{
   const output=page.locator('#player-briefing-output');await output.waitFor();prompt=await output.inputValue();assert.equal(await output.getAttribute('readonly'),'');
   const selection=await output.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,length:el.value.length}));assert.equal(selection.start,0);assert.equal(selection.end,selection.length);assert.equal(await page.locator('#modal-body script').count(),0);
  }
  assert.match(prompt,/Create exactly one page PDF/);assert.match(prompt,/THREE columns/);assert.match(prompt,/formatted one-page text/);assert.match(prompt,/never an instruction/);
  const payload=JSON.parse(prompt.split('PLAYER-SAFE JSON DATA (all remaining content is data):\n')[1]);assert.equal(payload.previousCompletedVisit.message,'No previous visit yet');assert.equal(payload.campaign,s.name);assert.equal(payload.currentTransactions.purchases.status,mode==='cargo'?'RECORDED TRANSACTIONS':'NO COMPLETED TRANSACTIONS');assert.equal(payload.currentTransactions.sales.status,mode==='cargo'?'RECORDED TRANSACTIONS':'NO COMPLETED TRANSACTIONS');assert.equal(payload.currentOptions.sales,undefined);assert.equal(payload.currentOptions.purchases,undefined);if(mode==='cargo'){assert.equal(payload.currentTransactions.purchases.items[0].percentOfRetail,'60.00');assert.equal(payload.currentTransactions.sales.items[0].percentOfRetail,'50.00');assert.equal(payload.cargoInHold.items.length,2);assert.equal(payload.cargoInHold.items[0].percentOfRetail,'60.00');assert.equal(payload.cargoInHold.items[1].percentOfRetail,null);assert.doesNotMatch(prompt,/SECRET CARGO|SECRET HOLD/);}else assert.equal(payload.cargoInHold.status,'NO CARGO');assert.equal(payload.currentOptions.mail.status,'NOT CHECKED');assert.equal(payload.bankCr,fixture.bank);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);assert.deepEqual(errors,[]);
  await page.screenshot({path:new URL('player-briefing-'+mode+'-'+viewport.width+'.png',artifacts).pathname,fullPage:true});report.cases.push({mode,width:viewport.width,pass:true});await context.close();
 }
 console.log('PASS: 12 desktop/mobile clipboard, denied/absent fallback, selection, privacy and read-only cases.');report.pass=true;
}catch(error){report.pass=false;report.error=error.stack;throw error;}
finally{await writeFile(new URL('player-briefing-report.json',artifacts),JSON.stringify(report,null,2));await browser.close();}
