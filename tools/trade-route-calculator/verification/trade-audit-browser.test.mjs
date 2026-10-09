// Audit F02/F03: real-browser forms, native validity, preview/commit, reload and
// Undo with synthetic campaigns only. --fixtures-only is not browser evidence.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const good=core.commodities.find(g=>g.name==='Radioactives');
const sizes=[['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}],['narrow',{width:320,height:740}]];
const scenarios=[['price-exempt',{raw:true},priceCase],['price-capped',{raw:false},priceCase],['noncriminal',{criminal:false},noncriminalCase],['half-ton',{quantity:'0.5'},fractionalCase],['one-and-half-ton',{quantity:'1.5'},fractionalCase],['partial-remainder',{quantity:'1.5'},partialCase]];
const expectedCases=sizes.flatMap(([size])=>scenarios.map(([name])=>name+'-'+size));
const summary={suite:'Effective trade legality and historical fractional sales',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,expectedCases,cases:[],errors:[]};
let browser;
function fixture({raw=true,quantity='1.5',criminal=true}={}){
 const f=guiFixture(),s=f.state;
 s.name='Disposable trade audit verification';s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'28',denominator:'1'}};
 Object.assign(s.settings,{profit:100,tax:false,insurance:false,creditStep:1,maxBaseRetailEnabled:true,maxBaseRetail:'100000',useRawIllegalPrices:raw});
 s.contracts=[];s.policies=[];s.undo=[];s.ledger=[];s.events=[];
 const world=R.context(s.worlds[s.actual],core),options={...s.settings,skill:1,counterparty:2,local:false};
 const q=R.quote(good,world,{...options,side:'buy',illegalGood:false,rollTotal:10},core);
 s.snapshots=[{id:'supplier',kind:'supplier',worldId:s.actual,world,party:'audit|supplier',partyName:'Audit supplier',hours:s.hours,startedHours:s.hours,options,offers:[{id:'radio-offer',commodity:good.id,description:'Radioactives',remaining:'3',illegal:false,expired:false,...q}]},{id:'buyer',kind:'buyer',worldId:s.actual,world,party:'audit|buyer',partyName:'Audit buyer',hours:s.hours,startedHours:s.hours,criminal,success:true,options,offers:[]}];
 s.lots=[{id:'legacy',commodity:good.id,description:'Legacy radioactives',quantity,basis:'1001',goodsValue:'501',illegal:false,world:s.actual,hours:s.hours}];
 S.validate(s);f.bytes=JSON.stringify(s);return f;
}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const modal=page=>page.locator('#modal[open]');
const action=(page,name,arg)=>page.locator('#main [data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]'));
const tab=(page,name)=>page.locator('#tabs [data-arg="'+name+'"]').click();
const title=(page,text)=>page.getByRole('heading',{name:text,exact:true}).waitFor();
async function fill(page,name,value){
 const input=modal(page).locator('[name="'+name+'"]');
 for(const details of await input.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
 await input.fill(String(value));
}
async function submit(page,label,nextTitle=null){
 await modal(page).getByRole('button',{name:label,exact:true}).click();
 await page.waitForFunction(next=>!document.querySelector('#modal').open||Boolean(document.querySelector('#modal-error').textContent)||(next&&document.querySelector('#modal-title').textContent===next),nextTitle);
 assert.equal(await page.locator('#modal-error').textContent(),'','No form validation/runtime error');
 if(nextTitle)await title(page,nextTitle);else await page.locator('#modal').waitFor({state:'hidden'});
}
async function dismiss(page){await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});}
async function reload(page){await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Recover saved campaign',exact:true}).count(),0);}
async function openSale(page){await tab(page,'Cargo');await action(page,'lot-sell','legacy').click();await title(page,'Prepare sale · Audit buyer');}
async function undo(page){await tab(page,'History');await action(page,'undo').click();}
const sales=state=>state.ledger.filter(e=>e.type==='Sale');
async function screenshot(page,result,label){const name='trade-audit-'+result.id+'-'+label+'.png';await page.screenshot({path:join(artifacts,name),fullPage:true});result.screenshots.push(name);}
async function priceCase(page,context,result,f){
 const rawEnabled=f.state.settings.useRawIllegalPrices;
 await tab(page,'Trade');
 const saveOffer=async illegal=>{
  await action(page,'offer-edit','radio-offer').click();
  await modal(page).locator('[name="illegal"]').setChecked(illegal);await modal(page).locator('[name="useRoll"]').check();
  await fill(page,'roll',10);await fill(page,'reason','Synthetic local legality correction');await submit(page,'Save');
  return (await read(page)).snapshots[0].offers[0];
 };
 const first=await saveOffer(true);assert.equal(first.audit.basePrice,rawEnabled?1000000:100000);assert.equal(first.audit.illegalRawPriceExempt,rawEnabled);assert.equal(first.illegal,true);
 const second=await saveOffer(true);assert.equal(second.unitPrice,first.unitPrice);
 const legal=await saveOffer(false);assert.equal(legal.audit.basePrice,100000);assert.equal(legal.illegal,false);
 await action(page,'offer-edit','radio-offer').click();await modal(page).locator('[name="illegal"]').check();await fill(page,'price',123456);await fill(page,'reason','Synthetic manual price');await submit(page,'Save');assert.equal((await read(page)).snapshots[0].offers[0].unitPrice,'123456');
 const before=await raw(page);await openSale(page);await fill(page,'ban_legacy',5);await submit(page,'Preview sale','Confirm sale');assert.equal(await raw(page),before);
 const audit=modal(page).locator('details').filter({has:page.locator('summary',{hasText:'Price rolls and modifiers'})});await audit.locator(':scope > summary').click();
 assert.match(await audit.innerText(),rawEnabled?/Cr 1,000,000/:/Cr 100,000/);await screenshot(page,result,'local-ban-preview');
 await submit(page,'COMMIT SALE');let s=await read(page),line=sales(s).at(-1).audit;
 assert.equal(line.audit.effectiveIllegal,true);assert.equal(line.audit.locallyBanned,true);assert.equal(line.audit.sale.localIllegalDM,4);assert.equal(line.audit.illegalRawPriceExempt,rawEnabled);assert.equal(line.audit.basePrice,rawEnabled?1000000:100000);assert.equal(line.benchmarkPrice,String(rawEnabled?1000000:100000));assert.equal(line.audit.manualPrice,null);
 await reload(page);await undo(page);await openSale(page);await fill(page,'ban_legacy',5);await fill(page,'price_legacy',123456);await fill(page,'benchmark_legacy',234567);await fill(page,'reason','Synthetic special terms');await submit(page,'Preview sale','Confirm sale');await submit(page,'COMMIT SALE');line=sales(await read(page)).at(-1).audit;assert.equal(line.unitPrice,'123456');assert.equal(line.benchmarkPrice,'234567');assert.equal(line.audit.manualPrice,'123456');
}
async function noncriminalCase(page,context,result,f){
 const before=await raw(page);await openSale(page);await fill(page,'ban_legacy',5);await modal(page).getByRole('button',{name:'Preview sale',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#modal-error').textContent.includes('Locally banned cargo needs a black-market buyer'));
 assert.equal(await raw(page),before);await screenshot(page,result,'blocked-local-ban');await dismiss(page);
}
async function fractionalCase(page,context,result,f){
 const before=await read(page),beforeBytes=await raw(page),quantity=before.lots[0].quantity;
 await openSale(page);const input=modal(page).locator('[name="qty_legacy"]');assert.equal(await input.inputValue(),quantity);assert.equal(await input.getAttribute('step'),'any');assert.equal(await input.evaluate(el=>el.checkValidity()),true);
 await submit(page,'Preview sale','Confirm sale');assert.equal(await raw(page),beforeBytes);assert.match(await modal(page).innerText(),new RegExp(quantity.replace('.','\\.')+'\\s'));
 await modal(page).getByRole('button',{name:'Edit quantities / fees',exact:true}).click();await title(page,'Prepare sale · Audit buyer');assert.equal(await modal(page).locator('[name="qty_legacy"]').inputValue(),quantity);
 await submit(page,'Preview sale','Confirm sale');await screenshot(page,result,'exact-quantity-preview');await dismiss(page);assert.equal(await raw(page),beforeBytes);
 await openSale(page);await submit(page,'Preview sale','Confirm sale');await submit(page,'COMMIT SALE');const sold=await read(page);assert.equal(sold.lots.length,0);assert.equal(sales(sold)[0].audit.quantity,quantity);assert.equal(sales(sold)[0].audit.basis,'1001');
 await reload(page);assert.equal((await read(page)).lots.length,0);await undo(page);const restored=await read(page);assert.deepEqual(restored.lots,before.lots);assert.equal(restored.bank,before.bank);await screenshot(page,result,'restored');
}
async function partialCase(page,context,result,f){
 const before=await read(page);await openSale(page);await fill(page,'qty_legacy',1);await submit(page,'Preview sale','Confirm sale');await submit(page,'COMMIT SALE');
 const partial=await read(page);assert.equal(partial.lots[0].quantity,'0.5');assert.equal(partial.lots[0].basis,'334');assert.equal(partial.lots[0].goodsValue,'167');assert.equal(sales(partial)[0].audit.basis,'667');
 await reload(page);await openSale(page);assert.equal(await modal(page).locator('[name="qty_legacy"]').inputValue(),'0.5');await submit(page,'Preview sale','Confirm sale');await screenshot(page,result,'remaining-half-ton');await submit(page,'COMMIT SALE');
 const allSold=await read(page);assert.equal(allSold.lots.length,0);assert.equal(A.decimal(A.sum(sales(allSold).map(e=>e.audit.quantity))),'1.5');assert.equal(sales(allSold).reduce((n,e)=>n+BigInt(e.audit.basis),0n),1001n);
 await reload(page);await undo(page);let restored=await read(page);assert.deepEqual(restored.lots,partial.lots);assert.equal(restored.bank,partial.bank);await undo(page);restored=await read(page);assert.deepEqual(restored.lots,before.lots);assert.equal(restored.bank,before.bank);
 // A newly entered quantity other than the full legacy remainder still rounds up.
 await openSale(page);await fill(page,'qty_legacy','0.25');await submit(page,'Preview sale','Confirm sale');assert.match(await modal(page).innerText(),/0.25 → 1/);await submit(page,'COMMIT SALE');assert.equal((await read(page)).lots[0].quantity,'0.5');
}
async function runCase(id,viewport,options,body){
 const result={id,status:'running',errors:[],pageErrors:[],unexpectedRequests:[],screenshots:[]};summary.cases.push(result);let context,trace=false;
 try{
  const f=fixture(options);context=await browser.newContext({viewport,serviceWorkers:'block'});context.setDefaultTimeout(15000);
  context.on('page',page=>page.on('pageerror',error=>result.pageErrors.push(String(error))));await context.tracing.start({screenshots:true,snapshots:true,sources:true});trace=true;
  await context.addInitScript(({key,bytes,appOrigin})=>{
   if(location.origin!==appOrigin)return;if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
   const nativeRandom=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=2;return array;}return nativeRandom(array);};
  },{key:campaignKey,bytes:f.bytes,appOrigin:new URL(base).origin});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
   if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
    const headers={'Access-Control-Allow-Origin':'*'};
    if(url.pathname.endsWith('/universe'))return route.fulfill({json:f.universe,headers});
    if(url.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata,headers});
    if(url.pathname.endsWith('/sec'))return route.fulfill({json:f.sec,headers});
    if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:f.apiWorlds},headers});
   }
   result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
  });
  const page=await context.newPage();await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await body(page,context,result,f);
  assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unexpectedRequests,[]);result.status='passed';
 }catch(error){result.status='failed';result.errors.push(error.stack||String(error));for(const page of context?.pages()||[])try{await screenshot(page,result,'failure');}catch{}}
 finally{
  if(trace)try{result.trace='trade-audit-'+id+'-trace.zip';await context.tracing.stop({path:join(artifacts,result.trace)});}catch(error){result.status='failed';result.errors.push(String(error));}
  if(context)await context.close();console.log(result.status.toUpperCase()+': '+id);for(const error of result.errors)console.error(error);
 }
}
if(process.argv[2]==='--fixtures-only'){
 for(const[,options]of scenarios){const f=fixture(options);assert.deepEqual(JSON.parse(f.bytes),f.state);}
 console.log('PASS: all trade-audit synthetic fixtures validate; no browser was launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  summary.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(summary.requestedCommit)assert.equal(summary.testedCommit,summary.requestedCommit);
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
  summary.browser=browser.version();for(const[size,viewport]of sizes)for(const[name,options,body]of scenarios)await runCase(name+'-'+size,viewport,options,body);
 }catch(error){summary.errors.push(error.stack||String(error));}
 finally{
  if(browser)await browser.close();summary.finishedAt=new Date().toISOString();summary.passed=!summary.errors.length&&summary.cases.length===expectedCases.length&&summary.cases.every(c=>c.status==='passed');
  await writeFile(join(artifacts,'trade-audit-browser-summary.json'),JSON.stringify(summary,null,2)+'\n');
 }
 if(!summary.passed)throw Error('Trade-audit browser regression failed; see verification-artifacts/trade-audit-browser-summary.json and traces.');
 console.log('PASS: all '+expectedCases.length+' trade-audit browser cases.');
}
