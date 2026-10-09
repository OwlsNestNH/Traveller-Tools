// Real Chromium regression for natural-3D trade-complication flags. Synthetic
// campaigns and map fixtures only. Seeded purchases exercise saved/legacy data;
// sale negotiations use the actual UI and a counted crypto dice queue. No app
// internals are called to buy, sell, edit previews, commit, reload or Undo.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
import {supportStock} from '../js/life-support.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const good=core.commodities.find(g=>g.id==='11');
const pair=[2,2,5],triple=[3,3,3],distinct=[1,3,5]; // Equal totals, different flags.
const sizes=[['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}],['narrow',{width:320,height:740}]];
const expectedCases=sizes.flatMap(([name])=>['purchase-'+name,'sale-'+name]);
const summary={suite:'Trade complications real-browser verification',startedAt:new Date().toISOString(),baseURL:base,node:process.version,requestedCommit:process.env.TRAVELLER_COMMIT||null,expectedCases,cases:[],errors:[]};
let browser;
const errorText=error=>error?.stack||String(error);

function fixture(){
 const f=guiFixture(),s=f.state,world=R.context(s.worlds[s.actual],core);
 // This suite isolates trade effects using canonical physical inventory.
 // Legacy-to-LSS migration is tested separately by the service/native suites;
 // keep strict whole-ship equality across every buy/sale and cancellation here.
 assert.equal(supportStock(s.ship).remainingUnits,'28');
 s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'28',denominator:'1'}};
 assert.equal(supportStock(s.ship).remainingDays,'14','Canonical fixture retains exactly the original endurance');
 s.name='Disposable trade complication verification';
 s.settings={...s.settings,profit:100,tax:false,insurance:false,creditStep:1};
 s.contracts=[];s.policies=[];s.undo=[];
 const options={side:'buy',skill:2,counterparty:1,creditStep:1};
 const make=(id,description,dice,result)=>{
  let index=0;
  const q=R.quote(good,world,{...options,...(dice?{}:{rollTotal:9})},core,()=>dice[index++]);
  assert.deepEqual(q.audit.tradeComplication,{version:1,result});
  return {id,commodity:good.id,description,remaining:'12',unitPrice:q.unitPrice,expired:false,illegal:false,audit:{...q.audit,quantityRolls:[{dice:[4,4],populationDM:0,multiplier:10,tons:80}],randomDraws:['11','11']}};
 };
 const offers=[make('offer-pair','Pair electronics',pair,'complication'),make('offer-severe','Triple electronics',triple,'severe'),make('offer-none','Distinct electronics',distinct,'none'),make('offer-manual','Entered-total electronics',null,'unknown')];
 const legacy=structuredClone(offers[1]);legacy.id='offer-legacy';legacy.description='Legacy triple electronics';delete legacy.audit.tradeComplication;
 offers.push(legacy);
 assert.equal(new Set(offers.map(o=>o.unitPrice)).size,1,'Matching total and modifiers retain identical prices for every flag');
 s.snapshots=[{id:'supplier-complications',kind:'supplier',worldId:s.actual,world,party:'complications|supplier',partyName:'Deterministic supplier',hours:s.hours,startedHours:s.hours,criminal:false,options,offers},{id:'buyer-complications',kind:'buyer',worldId:s.actual,world,party:'complications|buyer',partyName:'Deterministic buyer',hours:s.hours,startedHours:s.hours,criminal:true,success:true,options:{...options,side:'sell'},offers:[]}];
 s.lots=[{id:'sale-pair',commodity:good.id,description:'Pair sale lot',quantity:'3',basis:'30000',goodsValue:'30000',world:s.actual,hours:s.hours},{id:'sale-severe',commodity:good.id,description:'Triple sale lot',quantity:'3',basis:'30000',goodsValue:'30000',world:s.actual,hours:s.hours}];
 S.validate(s);f.bytes=JSON.stringify(s);return f;
}

const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const modal=page=>page.locator('#modal[open]');
const action=(page,name,arg)=>page.locator('#main [data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]'));
const tab=(page,name)=>page.locator('#tabs [data-arg="'+name+'"]').click();
const title=(page,text)=>page.getByRole('heading',{name:text,exact:true}).waitFor();
const row=(page,kind,id)=>page.locator('.'+kind+'-table tbody tr').filter({has:page.locator('[data-arg="'+id+'"]')});
const campaignData=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events'].includes(key)));
async function fill(page,name,value){
 const input=modal(page).locator('[name="'+name+'"]');
 for(const details of await input.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
 await input.fill(String(value));
}
async function submit(page,label,nextTitle=null){
 await modal(page).getByRole('button',{name:label,exact:true}).click();
 await page.waitForFunction(next=>!document.querySelector('#modal').open||Boolean(document.querySelector('#modal-error').textContent)||(next&&document.querySelector('#modal-title').textContent===next),nextTitle);
 assert.equal(await page.locator('#modal-error').textContent(),'','Actual UI submit must finish without a validation/runtime error');
 if(nextTitle)await title(page,nextTitle);else await page.locator('#modal').waitFor({state:'hidden'});
}
async function dismiss(page){await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});}
async function reload(page){await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Recover saved campaign',exact:true}).count(),0);}
async function flags(scope,result,count=1){
 const expected=['complication','severe'].includes(result)?result:null;
 assert.equal(await scope.locator('.trade-complication:visible').count(),expected?count:0,'Only active, recorded natural-dice complications show flags');
 if(expected){
  const flag=scope.locator('.trade-complication[data-complication="'+expected+'"]:visible');
  assert.equal(await flag.count(),count);
  for(const value of await flag.allTextContents())assert.equal(value.trim(),expected==='severe'?'SEVERE COMPLICATION':'COMPLICATION');
  const styles=await flag.evaluateAll(nodes=>nodes.map(el=>{const css=getComputedStyle(el);return {fontSize:parseFloat(css.fontSize),weight:Number(css.fontWeight),color:css.color,wrap:css.whiteSpace};}));
  for(const css of styles){
   assert.ok(css.fontSize>=20&&css.weight>=700,'Both warnings use large bold lettering');
   const rgb=css.color.match(/[\d.]+/g).slice(0,3).map(Number);
   assert.ok(rgb[0]>=180&&rgb[0]>rgb[1]+40&&rgb[0]>rgb[2]+40,'Both complication levels use visibly red text');
   assert.notEqual(css.wrap,'nowrap','Large warning text may wrap on mobile');
   // The longest alert word must stay readable instead of a letter-by-letter column.
  }
  for(const words of await flag.evaluateAll(nodes=>nodes.map(el=>{
   const text=el.firstChild;
   return [...text.textContent.matchAll(/\S+/g)].map(match=>{
    const range=document.createRange();range.setStart(text,match.index);range.setEnd(text,match.index+match[0].length);
    return {word:match[0],fragments:range.getClientRects().length};
   });
  }))){
   assert.ok(words.every(word=>word.fragments===1),'Each warning word stays intact in rows and full-width confirmation blocks: '+JSON.stringify(words));
  }
 }
}
async function facts(page,label){return modal(page).locator('dt').evaluateAll((nodes,label)=>nodes.filter(node=>node.textContent===label).map(node=>node.nextElementSibling.textContent),label);}
async function audit(page,dice,result){
 const values=await facts(page,'Trade complication · house rule');
 assert.equal(values.length,1,'One saved price complication audit is shown');
 const labels={complication:'COMPLICATION',severe:'SEVERE COMPLICATION',none:'None (no matching dice)',unknown:'Unknown · natural dice not recorded',legacy:'Not recorded for this quote'};
 assert.equal(values[0],labels[result]);
 assert.deepEqual(await facts(page,'3D price roll'),[dice?dice.join(' + ')+' = '+dice.reduce((a,b)=>a+b,0):'Entered total: 9 (individual dice not recorded)']);
 await flags(modal(page),result);
 if(['complication','severe'].includes(result))assert.match(await modal(page).innerText(),/House rule.*GM decides the issue and consequences/);
}
async function armDice(page,dice){
 await page.evaluate(dice=>{assertQueueEmpty();globalThis.tradeDice.queue.push(...dice);function assertQueueEmpty(){if(globalThis.tradeDice.queue.length)throw Error('Previous deterministic dice were not consumed');}},dice);
}
async function diceUsed(page,expected){
 const state=await page.evaluate(()=>globalThis.tradeDice);
 assert.deepEqual(state.used,expected,'Only new negotiations consume natural dice, in lot order');
 assert.equal(state.unexpected,0,'No unplanned reroll is hidden by fallback pricing');
 assert.deepEqual(state.queue,[],'All expected dice were consumed');
}
async function layout(page){
 const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,flags:[...document.querySelectorAll('.trade-complication')].filter(el=>el.getClientRects().length).map(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width,overflow:el.scrollWidth-el.clientWidth}))}));
 assert.ok(geometry.overflow<=2,'Tables scroll inside their panels, without page-width overflow');
 assert.ok(geometry.flags.every(flag=>flag.width<=flag.parent+2&&flag.overflow<=2),'Complication text wraps inside its table cell or dialog');
}
async function screenshot(page,result,name){await page.screenshot({path:join(artifacts,name),fullPage:true});result.screenshots.push(name);}
async function ledgerAudit(page,id,dice,result){
 await tab(page,'Accounts');await action(page,'ledger-audit',id).click();
 assert.equal(await page.locator('#modal-submit').isVisible(),false,'Historical price Audit is read-only');
 await audit(page,dice,result);await dismiss(page);
}

async function purchaseCase(page,context,result,f){
 await tab(page,'Trade');const initial=await raw(page);
 const cases=[['offer-pair',pair,'complication'],['offer-severe',triple,'severe'],['offer-none',distinct,'none'],['offer-manual',null,'unknown'],['offer-legacy',triple,'legacy']];
 for(const [id,dice,outcome]of cases){
  // Purchase warnings belong in the Commodity cell, never a made-up price.
  const offerRow=row(page,'purchase',id);await flags(offerRow.locator('td').nth(0),outcome);
  assert.equal(await offerRow.locator('.trade-complication').count(),['complication','severe'].includes(outcome)?1:0);
  await action(page,'offer-audit',id).click();await audit(page,dice,outcome);await layout(page);await dismiss(page);
  await action(page,'buy',id).click();await title(page,'Purchase · '+f.state.snapshots[0].offers.find(o=>o.id===id).description);
  await flags(modal(page),outcome);await submit(page,'Preview purchase','Confirm purchase');await flags(modal(page),outcome);
  await layout(page);await dismiss(page);assert.equal(await raw(page),initial,'Audit and cancelled purchase previews leave exact saved bytes unchanged');
 }
 await screenshot(page,result,'trade-complications-purchase-'+result.id+'.png');
 const bought=[];
 for(const [id,outcome]of [['offer-pair','complication'],['offer-pair','complication'],['offer-severe','severe']]){
  const before=await read(page),offer=before.snapshots[0].offers.find(o=>o.id===id);
  await action(page,'buy',id).click();await flags(modal(page),outcome);await submit(page,'Preview purchase','Confirm purchase');await flags(modal(page),outcome);await submit(page,'COMMIT PURCHASE');
  const after=await read(page),lot=after.lots.at(-1),entry=after.ledger.at(-1);
  assert.equal(after.lots.length,before.lots.length+1,'Each Buy creates a separate lot');assert.equal(lot.quantity,'1');
  assert.equal(lot.basis,offer.unitPrice);assert.equal(lot.goodsValue,offer.unitPrice);assert.equal(after.bank,String(BigInt(before.bank)-BigInt(offer.unitPrice)));
  assert.equal(after.hours,before.hours,'Flags add no campaign time');assert.deepEqual(after.ship,before.ship,'Trade retains the complete ship, including exactly 28 LSS');assert.deepEqual(after.ship.lifeSupport.stockUnits,{numerator:'28',denominator:'1'});assert.deepEqual(after.route,before.route);assert.deepEqual(after.contracts,before.contracts);
  assert.deepEqual(lot.audit.price.audit,offer.audit,'Each lot preserves the exact supplier price dice and flag');
  assert.deepEqual(entry.purchase.priceAudit,offer.audit,'Purchase ledger independently retains the price audit');
  assert.equal(after.snapshots[0].offers.find(o=>o.id===id).remaining,String(Number(offer.remaining)-1));
  bought.push({lot,entry,outcome});
 }
 assert.notEqual(bought[0].lot.id,bought[1].lot.id);assert.deepEqual(bought[0].lot.audit.price.audit,bought[1].lot.audit.price.audit,'Buying twice never rerolls or changes the offer flag');
 await diceUsed(page,[]);
 const purchased=await read(page);await reload(page);assert.deepEqual(await read(page),purchased,'Saved offer/lot/ledger flags survive reload');
 await tab(page,'Cargo');
 assert.equal(await page.locator('.cargo-table .trade-complication').count(),0,'Acquisition flags are not misrepresented as unnegotiated sale flags');
 for(const {lot,entry,outcome}of bought){
  await tab(page,'Cargo');await action(page,'lot-audit',lot.id).click();await audit(page,lot.audit.price.audit.dice.dice,outcome);await dismiss(page);
  await ledgerAudit(page,entry.id,lot.audit.price.audit.dice.dice,outcome);
 }
 // Fully removing a bought lot must not erase its original purchase audit.
 const removed=bought[0];await armDice(page,[6,6,6]);await tab(page,'Cargo');await action(page,'lot-sell',removed.lot.id).click();
 await flags(modal(page),'severe');await submit(page,'Preview sale','Confirm sale');await submit(page,'COMMIT SALE');
 assert.equal((await read(page)).lots.some(l=>l.id===removed.lot.id),false);
 const sold=await read(page);await diceUsed(page,[6,6,6]);await reload(page);assert.deepEqual(await read(page),sold);
 await ledgerAudit(page,removed.entry.id,pair,'complication');await diceUsed(page,[]); // Reload creates a fresh, unused dice harness.
 await tab(page,'Trade');await flags(row(page,'purchase','offer-pair').locator('td').nth(0),'complication');await layout(page);
}

async function saleCase(page,context,result,f){
 const initial=await raw(page),before=JSON.parse(initial),rolled=[...pair,...triple];
 await armDice(page,rolled);await tab(page,'Cargo');await action(page,'sale-all').click();await action(page,'sale').click();await title(page,'Prepare sale · Deterministic buyer');
 const prepLot=id=>modal(page).locator('.preview').filter({has:page.locator('[name="qty_'+id+'"]')});
 await flags(prepLot('sale-pair'),'complication');await flags(prepLot('sale-severe'),'severe');
 const initialPrices={pair:await modal(page).locator('[name="price_sale-pair"]').inputValue(),severe:await modal(page).locator('[name="price_sale-severe"]').inputValue()};
 assert.equal(initialPrices.pair,initialPrices.severe,'Equal totals/modifiers price pair and triple identically');
 await diceUsed(page,rolled);await layout(page);assert.equal(await raw(page),initial);
 await submit(page,'Preview sale','Confirm sale');
 const confirmationRows=()=>modal(page).locator('.sale-complications .sale-complication');
 await flags(confirmationRows().nth(0),'complication');await flags(confirmationRows().nth(1),'severe');
 await modal(page).locator('details').filter({has:page.locator('summary',{hasText:'Price rolls and modifiers'})}).locator(':scope > summary').click();
 assert.deepEqual(await facts(page,'3D price roll'),['2 + 2 + 5 = 9','3 + 3 + 3 = 9']);
 assert.deepEqual(await facts(page,'Trade complication · house rule'),['COMPLICATION','SEVERE COMPLICATION']);
 await layout(page);await modal(page).evaluate(el=>{el.scrollTop=0;});await screenshot(page,result,'trade-complications-confirm-'+result.id+'.png');await dismiss(page);
 assert.equal(await raw(page),initial,'Negotiation and cancelled confirmation never write a campaign change');
 // Cancel/reopen, editing quantities/fees, then cancel again must reuse both
 // original per-lot offers rather than rolling once for each UI callback.
 await action(page,'sale').click();await title(page,'Prepare sale · Deterministic buyer');
 await fill(page,'qty_sale-pair',1);await fill(page,'qty_sale-severe',2);await fill(page,'fee',7);
 await submit(page,'Preview sale','Confirm sale');await modal(page).getByRole('button',{name:'Edit quantities / fees',exact:true}).click();await title(page,'Prepare sale · Deterministic buyer');
 assert.equal(await modal(page).locator('[name="qty_sale-pair"]').inputValue(),'1');assert.equal(await modal(page).locator('[name="qty_sale-severe"]').inputValue(),'2');assert.equal(await modal(page).locator('[name="fee"]').inputValue(),'7');
 await flags(prepLot('sale-pair'),'complication');await flags(prepLot('sale-severe'),'severe');await dismiss(page);await diceUsed(page,rolled);
 await tab(page,'Trade');await tab(page,'Cargo');
 for(const [id,outcome]of [['sale-pair','complication'],['sale-severe','severe']]){
  const saleRow=row(page,'cargo',id);await flags(saleRow.locator('td').nth(4),outcome);
  assert.equal(await saleRow.locator('.trade-complication').count(),1,'Each Sale Price cell shows its own cached lot flag');
  await action(page,'lot-audit',id).click();await audit(page,id==='sale-pair'?pair:triple,outcome);await dismiss(page);
 }
 assert.equal(await raw(page),initial);await action(page,'sale').click();await title(page,'Prepare sale · Deterministic buyer');
 assert.equal(await modal(page).locator('[name="price_sale-pair"]').inputValue(),initialPrices.pair);
 assert.equal(await modal(page).locator('[name="price_sale-severe"]').inputValue(),initialPrices.severe);
 // Both local-ban repricing paths preserve faces. One lot additionally gets
 // an explicit manual price; neither path may infer a flag from total alone.
 const expectedBan=R.quote(good,R.context(before.worlds[before.actual],core),{...before.snapshots[1].options,rollTotal:9,banThreshold:0},core).unitPrice;
 assert.notEqual(expectedBan,initialPrices.pair,'The fixture actually exercises a changed local-ban price');
 const manual=String(BigInt(initialPrices.severe)+123n);
 await fill(page,'ban_sale-pair',0);await fill(page,'ban_sale-severe',0);await fill(page,'price_sale-severe',manual);await fill(page,'reason','Synthetic approved manual price; natural dice retained');
 await submit(page,'Preview sale','Confirm sale');
 await flags(confirmationRows().nth(0),'complication');await flags(confirmationRows().nth(1),'severe');
 await modal(page).locator('details').filter({has:page.locator('summary',{hasText:'Price rolls and modifiers'})}).locator(':scope > summary').click();
 assert.deepEqual(await facts(page,'3D price roll'),['2 + 2 + 5 = 9','3 + 3 + 3 = 9'],'Local-ban repricing retains original natural dice in the rendered audit');
 assert.deepEqual(await facts(page,'Trade complication · house rule'),['COMPLICATION','SEVERE COMPLICATION']);
 await diceUsed(page,rolled);assert.equal(await raw(page),initial);
 await submit(page,'COMMIT SALE');
 const after=await read(page),sales=after.ledger.filter(e=>e.type==='Sale');
 assert.equal(after.lots.length,0,'Both full-sale lots leave cargo');assert.equal(sales.length,2);
 assert.equal(after.bank,String(BigInt(before.bank)+3n*BigInt(expectedBan)+3n*BigInt(manual)),'Only ordinary sale arithmetic affects the bank');
 assert.equal(after.hours,before.hours,'Flags do not advance time');assert.deepEqual(after.ship,before.ship,'Trade retains the complete ship, including exactly 28 LSS');assert.deepEqual(after.ship.lifeSupport.stockUnits,{numerator:'28',denominator:'1'});assert.deepEqual(after.route,before.route);assert.deepEqual(after.contracts,before.contracts);assert.deepEqual(after.snapshots,before.snapshots);
 for(const [id,dice,outcome,price]of [['sale-pair',pair,'complication',expectedBan],['sale-severe',triple,'severe',manual]]){
  const entry=sales.find(e=>e.lotId===id),a=entry.audit.audit;
  assert.deepEqual(a.dice,{dice,total:9});assert.deepEqual(a.tradeComplication,{version:1,result:outcome});
  assert.equal(entry.audit.unitPrice,price);assert.equal(entry.audit.quantity,'3');assert.equal(a.banThreshold,'0');
  assert.equal(a.manualPrice,id==='sale-severe'?manual:null);assert.equal(a.sale.localIllegalDM,9);
  await ledgerAudit(page,entry.id,dice,outcome);
 }
 await diceUsed(page,rolled);await reload(page);assert.deepEqual(await read(page),after,'Complete sale and ledger audit survive reload');
 for(const entry of sales)await ledgerAudit(page,entry.id,entry.lotId==='sale-pair'?pair:triple,entry.lotId==='sale-pair'?'complication':'severe');
 await tab(page,'History');await action(page,'undo').click();
 const undone=await read(page);assert.deepEqual(campaignData(undone),campaignData(before),'Undo restores cargo, bank, snapshots and all pre-sale campaign fields');
 await reload(page);assert.deepEqual(await read(page),undone);await tab(page,'Cargo');
 assert.equal(await page.locator('.cargo-table .trade-complication').count(),0,'Reload and Undo do not resurrect an invalidated current quote');
 assert.equal(await page.locator('.cargo-table').getByText('Not negotiated',{exact:true}).count(),2);
 // A real campaign mutation invalidates a cached quote and permits exactly
 // one fresh 3D roll. The old purchase/sale audits remain independent.
 await armDice(page,distinct);await action(page,'lot-sell','sale-pair').click();await flags(modal(page),'none');await dismiss(page);await diceUsed(page,distinct);
 await tab(page,'Accounts');await action(page,'bank-correct').click();await fill(page,'amount',1);await fill(page,'reason','Synthetic revision invalidation');await submit(page,'Save');
 await tab(page,'Cargo');const invalid=row(page,'cargo','sale-pair');await flags(invalid,'none');assert.match(await invalid.locator('td').nth(4).innerText(),/Not negotiated/);
 const revised=await raw(page);await armDice(page,[4,4,4]);await action(page,'lot-sell','sale-pair').click();await flags(modal(page),'severe');await dismiss(page);await diceUsed(page,[...distinct,4,4,4]);assert.equal(await raw(page),revised);
 await layout(page);await screenshot(page,result,'trade-complications-restored-'+result.id+'.png');
}

async function runCase(id,viewport,body){
 const result={id,status:'running',startedAt:new Date().toISOString(),errors:[],pageErrors:[],unexpectedRequests:[],screenshots:[]};summary.cases.push(result);
 let context,traceStarted=false;
 try{
  const f=fixture();context=await browser.newContext({viewport,serviceWorkers:'block'});context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(20000);
  context.on('page',page=>page.on('pageerror',error=>result.pageErrors.push(errorText(error))));
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});traceStarted=true;
  await context.addInitScript(({key,bytes,appOrigin})=>{
   if(location.origin!==appOrigin)return;
   if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
   globalThis.tradeDice={queue:[],used:[],unexpected:0};
   const nativeRandom=crypto.getRandomValues.bind(crypto);
   crypto.getRandomValues=function(array){
    if(array instanceof Uint32Array&&array.length===1){
     const value=globalThis.tradeDice.queue.shift();
     if(value===undefined){globalThis.tradeDice.unexpected++;array[0]=0;}
     else{globalThis.tradeDice.used.push(value);array[0]=value-1;}
     return array;
    }
    return nativeRandom(array);
   };
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
  const page=await context.newPage();await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await body(page,context,result,f);
  assert.deepEqual(result.pageErrors,[],'No uncaught browser errors');assert.deepEqual(result.unexpectedRequests,[],'No live external service dependencies');result.status='passed';
 }catch(error){
  result.status='failed';result.errors.push(errorText(error));
  for(const [index,page]of(context?.pages()||[]).entries())if(!page.isClosed())try{await screenshot(page,result,'trade-complications-'+id+'-failure-'+index+'.png');}catch(captureError){result.errors.push(errorText(captureError));}
 }finally{
  if(traceStarted){result.trace='trade-complications-'+id+'-trace.zip';try{await context.tracing.stop({path:join(artifacts,result.trace)});}catch(error){result.status='failed';result.errors.push(errorText(error));}}
  if(context)try{await context.close();}catch(error){result.status='failed';result.errors.push(errorText(error));}
  result.finishedAt=new Date().toISOString();console.log(result.status.toUpperCase()+': '+id);for(const error of result.errors)console.error(error);
 }
}

// This explicit mode verifies synthetic source fixtures without launching a
// browser. It is not browser evidence and is not the mode used by CI.
if(process.argv[2]==='--fixtures-only'){
 const f=fixture();assert.deepEqual(JSON.parse(f.bytes),f.state);console.log('PASS: trade-complication fixtures validate; no browser was launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  summary.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(summary.requestedCommit)assert.equal(summary.testedCommit,summary.requestedCommit,'Verify the exact requested PR head');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
  browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
  summary.browser={name:'Chromium',version:browser.version(),channel:process.env.TRAVELLER_BROWSER_CHANNEL||'bundled'};
  for(const [name,viewport]of sizes){await runCase('purchase-'+name,viewport,purchaseCase);await runCase('sale-'+name,viewport,saleCase);}
 }catch(error){summary.errors.push(errorText(error));console.error(errorText(error));}
 finally{
  if(browser)try{await browser.close();}catch(error){summary.errors.push(errorText(error));}
  summary.finishedAt=new Date().toISOString();summary.passed=summary.errors.length===0&&summary.cases.length===expectedCases.length&&expectedCases.every(id=>summary.cases.some(c=>c.id===id&&c.status==='passed'));
  await writeFile(join(artifacts,'trade-complications-browser-summary.json'),JSON.stringify(summary,null,2)+'\n');
 }
 if(!summary.passed)throw Error('Trade-complication browser verification failed. See verification-artifacts/trade-complications-browser-summary.json and per-case traces/screenshots.');
 console.log('PASS: all '+expectedCases.length+' trade-complication cases: desktop/mobile purchases, natural sales, legacy/manual audits, cache/repricing, ledger, reload and Undo.');
}
