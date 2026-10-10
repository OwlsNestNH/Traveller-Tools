// Deterministic Chromium checks. Only synthetic campaigns and intercepted map data.
// Run: node verification/cargo-hold-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';

const widths=[1440,1100,390,320];
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';

// Exported so fixture validation can run independently of a browser launch.
export function cargoFixture({empty=false}={}){
 const f=guiFixture(12),s=f.state,recorded=structuredClone(s.lots[0]);
 s.name='Read-only cargo manifest verification';s.ship.name='Synthetic Long-Haul Manifest Trader';
 s.ship.capacity='120';s.ship.roundTons=false;s.ship.fuel=configureFuel(200,40,50,40,2);
 s.ship.accommodation={rooms:{low:0,middle:4,high:1},passengers:{low:0,middle:2,high:1},crew:{low:0,middle:2,high:0},luggageTons:'3'};
 s.ship.lifeSupport={capacityHours:672,stockUnits:'950'}; // 800 internal + 150 LSS = 1.5 cargo tons.
 s.ship.expenses={salary:'12000'};
 s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
 s.ship.maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};
 Object.assign(s.settings,{maxBaseRetailEnabled:true,maxBaseRetail:'2000',reducedProfitLimitsEnabled:true,minPurchasePercent:99,maxSalePercent:101});
 s.worlds[s.actual].berthingRate={port:'A',die:2};
 const lot=(id,{commodity='11',quantity='1',unitPrice='1000',basePrice='4000',basis='1000',percent=37}={})=>{
  const row={...structuredClone(recorded),id,commodity,description:'Frozen purchase '+id,quantity,basis,goodsValue:String(BigInt(unitPrice)*BigInt(quantity))};
  row.audit.price.unitPrice=unitPrice;row.audit.price.audit.basePrice=basePrice;row.audit.price.audit.percent=percent;
  row.audit.fee='0';row.audit.premium='0';return row;
 };
 s.lots=[
  lot('lot-historical-first',{quantity:'2',unitPrice:'12345',basePrice:'10000',basis:'26000'}),
  lot('lot-historical-second',{quantity:'3',unitPrice:'11000',basePrice:'20000',basis:'33000',percent:77}),
  {...structuredClone(s.lots[1]),id:'lot-base-unknown',quantity:'1',basis:'15000',goodsValue:'15000'},
  {...structuredClone(s.lots[2]),id:'lot-purchase-unknown',quantity:'1'},
  ...Array.from({length:76},(_,i)=>lot('lot-long-manifest-verification-with-an-unbroken-record-id-'+String(i+5).padStart(3,'0')))
 ];
 // Basis deliberately includes more than unit-price × tons, like saved fees.
 s.lots[0].audit.fee='310';s.lots[0].audit.premium='1000';
 const contract=(id,kind,quantity,payment,status='accepted')=>({id,kind,status,origin:s.actual,destination:s.route[2],description:kind==='mail'?'Sealed priority mail':'Long sealed freight consignment for manifest scrolling',quantity,payment,dueHours:720,audit:{manual:true,reason:'Deterministic manifest verification'}});
 s.contracts=[
  contract('freight-accepted','freight','5','99000000'),
  contract('mail-accepted','mail','2','88000000'),
  contract('freight-delivered','freight','90','77000000','delivered'),
  {...contract('mail-cancelled','mail','80','66000000','cancelled'),firstDeparture:null,cancelledHours:24,cancellation:{world:s.actual,revision:16,source:'recorded'}}
 ];
 if(empty){s.lots=[];s.contracts=s.contracts.filter(c=>c.status!=='accepted');}
 validate(s);f.bytes=JSON.stringify(s);
 // These are independent fixture expectations, not values computed by the feature.
 f.expected={lots:empty?0:80,goods:empty?'0':'83',freight:empty?'0':'5',mail:empty?'0':'2',other:'14.5',occupied:empty?'14.5':'104.5',free:empty?'105.5':'15.5',investment:empty?'Cr 0':'Cr 152,000'};
 return f;
}

const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const click=(page,name,arg)=>action(page,name,arg).click();
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const unchanged=async(page,f,label)=>assert.equal(await raw(page),f.bytes,label+' preserves every campaign byte, including bank, hours, inventories, ledger, history and Undo');
const opened=page=>page.locator('#cargo-hold-panel').waitFor({state:'visible'});

async function selectionGeometry(page,selectedId,actualId,{close=false}={}){
 await frame(page);
 const q=await page.evaluate(({selectedId,actualId})=>{
  const svg=document.querySelector('.world-map'),layer=svg.querySelector('.selected-world-hex');
  const selected=svg.querySelector('[data-action="map-world"][data-arg="'+selectedId+'"]'),actual=svg.querySelector('[data-action="map-world"][data-arg="'+actualId+'"]');
  const fill=layer.querySelector('.selection-hex-fill'),outline=layer.querySelector('.selection-hex-outline');
  const points=p=>Array.from({length:p.points.numberOfItems},(_,i)=>({x:p.points.getItem(i).x,y:p.points.getItem(i).y}));
  const center=ps=>({x:ps.reduce((n,p)=>n+p.x,0)/ps.length,y:ps.reduce((n,p)=>n+p.y,0)/ps.length});
  const fillPoints=points(fill),c=center(fillPoints),selectedDot=selected.querySelector(':scope > circle'),actualDot=actual.querySelector(':scope > circle');
  const cell=[...svg.querySelectorAll('.hex-grid polygon')].find(p=>{const q=center(points(p));return Math.abs(q.x-c.x)<.01&&Math.abs(q.y-c.y)<.01;});
  if(!cell)throw Error('Selected-world highlight has no matching grid cell');
  const radius=ps=>Math.max(...ps.map(p=>Math.hypot(p.x-c.x,p.y-c.y)));
  const before=(a,b)=>!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
  const names=['world-name','world-uwp'];
  const labels=names.map(name=>{const node=selected.querySelector('.'+name);if(!node)return null;const style=getComputedStyle(node);return {name,fill:style.fill,stroke:style.stroke,strokeWidth:parseFloat(style.strokeWidth),paintOrder:style.paintOrder,text:node.textContent};}).filter(Boolean);
  return {count:svg.querySelectorAll('.selected-world-hex').length,selectedId:svg.querySelector('.selected-world').dataset.arg,center:c,selected:{x:Number(selectedDot.getAttribute('cx')),y:Number(selectedDot.getAttribute('cy'))},actual:{x:Number(actualDot.getAttribute('cx')),y:Number(actualDot.getAttribute('cy')),fill:getComputedStyle(actualDot).fill},fill:getComputedStyle(fill).fill,opacity:Number(getComputedStyle(fill).fillOpacity),stroke:getComputedStyle(outline).stroke,strokeWidth:parseFloat(getComputedStyle(outline).strokeWidth),radius:{grid:radius(points(cell)),fill:radius(fillPoints),outline:radius(points(outline))},labels,belowRoute:before(layer,svg.querySelector('.map-content > polyline')),belowLabels:[...svg.querySelectorAll('.hex-grid text')].every(node=>before(layer,node)),belowWorld:before(layer,selected),pointerEvents:getComputedStyle(fill).pointerEvents,selectedShip:selected.querySelectorAll('.symbol-ship').length,actualShip:actual.querySelectorAll('.symbol-ship').length};
 },{selectedId,actualId});
 assert.equal(q.count,1,'Exactly one blue selected-world hex');assert.equal(q.selectedId,selectedId);
 assert.ok(Math.abs(q.center.x-q.selected.x)<.01&&Math.abs(q.center.y-q.selected.y)<.01,'Blue hex follows the browsed world center');
 if(selectedId!==actualId)assert.ok(Math.hypot(q.center.x-q.actual.x,q.center.y-q.actual.y)>1,'Browsing does not move the actual ship marker');
 assert.equal(q.fill,'rgb(36, 93, 148)');assert.equal(q.opacity,.42);assert.equal(q.stroke,'rgb(128, 190, 255)');
 assert.ok(q.radius.fill<q.radius.grid&&q.radius.outline+q.strokeWidth/2<q.radius.grid,'Fill and complete outline remain inset from the hex edges');
 assert.ok(q.belowRoute&&q.belowLabels&&q.belowWorld,'Selection is below route, hex labels and world symbols');
 assert.equal(q.pointerEvents,'none','Selection does not intercept map interactions');
 assert.equal(q.actual.fill,'rgb(98, 211, 221)','Actual ship stays cyan');
 for(const label of q.labels){
  assert.equal(label.fill,'rgb(255, 255, 255)',label.name+' remains white on selection');
  assert.equal(label.stroke,'rgb(9, 27, 42)');assert.ok(label.strokeWidth>0&&label.paintOrder.startsWith('stroke'),label.name+' retains its dark readability halo');
 }
 if(close){assert.equal(q.labels.length,2,'Closest zoom retains both name and UWP');assert.equal(q.actualShip,1);assert.equal(q.selectedShip,selectedId===actualId?1:0);}
 return q;
}

async function manifestFacts(page,f){
 const panel=page.locator('#cargo-hold-panel'),e=f.expected;
 assert.equal(await panel.locator('[data-cargo-lot]').count(),e.lots);
 assert.equal(await panel.locator('[data-cargo-contract]').count(),e.lots?2:0);
 assert.equal(await panel.locator('.cargo-investment .mono').textContent(),e.investment,'Investment is only remaining owned-goods cost basis; freight/mail income is excluded');
 assert.equal(await panel.locator('.cargo-capacity-values strong').textContent(),e.occupied+' / 120 t');
 assert.equal(await panel.locator('.cargo-capacity-values > span').textContent(),e.free+' t free');
 assert.equal(await panel.locator('.cargo-capacity > .help').textContent(),'Goods '+e.goods+' t · Freight '+e.freight+' t · Mail '+e.mail+' t');
 assert.equal(await panel.locator('progress').getAttribute('aria-valuetext'),e.occupied+' of 120 tons');
 assert.match(await panel.locator('.cargo-other summary').textContent(),/Other hold use: 14\.5 t/);
 await panel.locator('.cargo-other summary').click();
 assert.deepEqual(await panel.locator('.cargo-other dd').allTextContents(),['3 t','10 t','1.5 t'],'Luggage, occupied fuel bladders and physical LSS overflow each count once');
 await panel.locator('.cargo-other summary').click();
 assert.match(await panel.locator('.cargo-location').textContent(),new RegExp('ship at '+f.state.worlds[f.state.actual].name));
 assert.equal(await panel.locator('[data-mutate],input,select').count(),0,'Quick manifest has no mutating or editing inputs');
 if(e.lots){
  const row=id=>panel.locator('[data-cargo-lot="'+id+'"]');
  assert.equal(await row('lot-historical-first').locator('td strong').textContent(),await row('lot-historical-second').locator('td strong').textContent(),'Duplicate goods retain separate lots');
  assert.equal(await row('lot-historical-first').locator('td').nth(1).textContent(),'2');
  assert.equal(await row('lot-historical-second').locator('td').nth(1).textContent(),'3');
  assert.equal(await row('lot-historical-first').locator('td').nth(2).textContent(),'Cr 12,345123.45% of base','Actual saved price / historical base, independent of current Cr 2,000 cap or stored table percent');
  assert.equal(await row('lot-historical-second').locator('td').nth(2).textContent(),'Cr 11,00055% of base');
  assert.equal(await row('lot-base-unknown').locator('td').nth(2).textContent(),'Cr 15,000Base not recorded');
  assert.equal(await row('lot-purchase-unknown').locator('td').nth(2).textContent(),'Not recordedBase not recorded','Unknown paid price is not reconstructed from cost basis');
  assert.deepEqual(await panel.locator('[data-cargo-contract]').evaluateAll(rows=>rows.map(row=>row.dataset.cargoContract)),['freight-accepted','mail-accepted'],'Delivered freight and cancelled mail do not appear aboard');
 }else{
  assert.match(await panel.textContent(),/No owned trade goods aboard/);assert.match(await panel.textContent(),/No accepted freight or mail aboard/);
  assert.equal(await panel.locator('.cargo-manifest-scroll').count(),0);
 }
 await unchanged(page,f,'Reading the complete manifest');
}

async function scrollGeometry(page){
 const goods=page.getByRole('region',{name:'Speculative goods; scroll for more lots and columns'}),contracts=page.getByRole('region',{name:'Freight and mail; scroll for more consignments and columns'});
 for(const region of [goods,contracts]){assert.equal(await region.getAttribute('tabindex'),'0');await region.focus();assert.equal(await region.evaluate(el=>document.activeElement===el),true);}
 const measure=()=>page.evaluate(()=>{
  const goods=document.querySelector('.cargo-goods-scroll'),footer=document.querySelector('.cargo-investment'),contracts=document.querySelector('.cargo-consignments'),investment=footer.querySelector('.mono');
  // Focus may scroll the containing MFD screen to expose another region.
  // Compare content coordinates so that only the goods table's own scrolling
  // moves its rows; the investment remains outside that nested scroll region.
  const panelScroll=document.querySelector('#cargo-hold-panel').scrollTop;
  const box=el=>{const r=el.getBoundingClientRect();return {top:r.top+scrollY+panelScroll,bottom:r.bottom+scrollY+panelScroll,left:r.left+scrollX,right:r.right+scrollX,height:r.height};};
  const background=getComputedStyle(footer).backgroundColor,footerAlpha=background.startsWith('rgba(')?Number(background.slice(background.lastIndexOf(',')+1,-1)):background==='transparent'?0:1;
  return {goods:box(goods),footer:box(footer),investment:box(investment),footerOverflow:footer.scrollWidth-footer.clientWidth,contracts:box(contracts),firstRow:box(goods.querySelector('tbody tr')),footerInsideScroll:!!footer.closest('.cargo-manifest-scroll'),footerBackground:background,footerAlpha,cellsNoWrap:[...document.querySelectorAll('.cargo-manifest-scroll th,.cargo-manifest-scroll td')].every(cell=>getComputedStyle(cell).whiteSpace==='nowrap'),scrollWidth:goods.scrollWidth,clientWidth:goods.clientWidth,scrollHeight:goods.scrollHeight,clientHeight:goods.clientHeight,pageOverflow:document.documentElement.scrollWidth-innerWidth};
 });
 const before=await measure();
 assert.ok(before.scrollHeight>before.clientHeight+100,'80 lots overflow inside the goods region');
 assert.ok(before.scrollWidth>before.clientWidth+1,'Long unbroken lot IDs require internal horizontal scrolling');
 assert.ok(before.goods.height<=282,'Goods viewport is bounded independently of lot count');
 assert.equal(before.footerInsideScroll,false,'Investment is outside the scrolling goods table');
 assert.ok(before.footerOverflow<=2&&before.investment.left>=before.footer.left&&before.investment.right<=before.footer.right,'Complete normal investment total is visible without scrolling its footer, including at 320px');
 assert.equal(before.footerAlpha,1,'Investment footer has an opaque background');
 assert.equal(before.cellsNoWrap,true,'Goods and freight/mail keep whole words and columns in their internal scroll areas');
 assert.ok(before.footer.top>=before.goods.bottom-1&&before.footer.top-before.goods.bottom<=12,'Investment sits directly below the goods list');
 assert.ok(before.footer.bottom<=before.contracts.top+1,'Investment is before freight/mail');
 assert.ok(before.pageOverflow<=2,'Long content does not produce page-level horizontal overflow');
 await goods.focus();await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>document.querySelector('.cargo-goods-scroll').scrollTop>0);
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.cargo-goods-scroll').scrollLeft>0);
 await frame(page);
 const after=await measure();
 assert.ok(Math.abs(after.footer.top-before.footer.top)<1&&Math.abs(after.footer.bottom-before.footer.bottom)<1,'Investment stays fixed while goods scroll vertically and horizontally');
 assert.ok(after.firstRow.top<before.firstRow.top,'Keyboard scrolling changes the goods rows');
 // Exercise the separate contracts scroll without moving the footer or page width.
 if(await contracts.evaluate(el=>el.scrollWidth>el.clientWidth+1)){
  await contracts.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('.cargo-contract-scroll').scrollLeft>0);
 }
 await goods.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});await contracts.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});
 await frame(page);return {before,after};
}

async function cargoCameraStability(page,f){
 const ids=[f.state.actual,f.state.route[2]],camera=()=>mapCameraSnapshot(page,ids);
 await click(page,'world',f.state.actual);await click(page,'map-zoom-reset');await click(page,'map-zoom-in');
 await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');
 await camera();
 const start=await page.locator('.world-map').evaluate(svg=>{
  svg.scrollIntoView({block:'center',behavior:'instant'});const b=svg.getBoundingClientRect();
  return {x:b.left+b.width*.6,y:b.top+b.height*.5,pan:svg.querySelector('.map-content').getAttribute('transform')};
 });
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+24,start.y+16,{steps:8});await page.mouse.up();
 await page.waitForFunction(before=>document.querySelector('.map-content')?.getAttribute('transform')!==before,start.pan);
 const baseline=await camera(),checks=[];
 assert.notEqual(baseline.pan,'translate(0 0)');assert.equal(baseline.zoom,'120%');
 const same=async label=>{const measured=await camera();assertMapCameraUnchanged(measured,baseline,label);checks.push({label,height:measured.height});};
 for(const action of ['cargo-hold-close','cargo-hold','ship-expenses','cargo-hold','refuel','cargo-hold','refill-support','cargo-hold']){
  await click(page,action);await same('Cargo camera through '+action);await unchanged(page,f,'Cargo camera through '+action);
 }
 await page.locator('.cargo-other > summary').click();await same('Expanded Cargo capacity breakdown');
 await page.locator('.cargo-other > summary').click();await same('Collapsed Cargo capacity breakdown');
 await click(page,'map-zoom-reset');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%');
 return {baseline,checks};
}

async function auditDetails(page,f){
 const panel=page.locator('#cargo-hold-panel');
 await panel.locator('[data-action="lot-audit"][data-arg="lot-historical-first"]').focus();await page.keyboard.press('Enter');
 await page.locator('#modal[open]').waitFor();
 assert.match(await page.locator('#modal-body').textContent(),/Cr 12,345/);
 assert.match(await page.locator('#modal-body').textContent(),/Cr 26,000/);
 await page.locator('#modal-close').click();await opened(page);
 await panel.locator('[data-action="lot-audit"][data-arg="lot-purchase-unknown"]').click();
 assert.match(await page.locator('#modal-body').textContent(),/no saved generated purchase calculation/);
 await page.locator('#modal-close').click();
 for(const id of ['freight-accepted','mail-accepted']){
  await panel.locator('[data-action="contract-audit"][data-arg="'+id+'"]').click();
  await page.locator('#modal[open]').waitFor();assert.match(await page.locator('#modal-body').textContent(),/Deterministic manifest verification/);
  await page.locator('#modal-close').click();
 }
 await unchanged(page,f,'Keyboard and pointer Details');
}

async function navigationAndDrafts(page,f){
 // The quick-view actions open the full tabs; services appear only on Overview.
 for(const target of ['Cargo','Contracts']){
  await click(page,'cargo-hold-tab',target);
  assert.equal(await page.locator('#tabs [aria-current="page"]').getAttribute('data-arg'),target);
  assert.equal(await page.locator('#cargo-hold-panel').count(),0);
  await click(page,'tab','Overview');
  await click(page,'cargo-hold');await opened(page);
  assert.equal(await page.locator('#tabs [aria-current="page"]').getAttribute('data-arg'),'Overview');
 }
 const remember=selector=>page.locator(selector).evaluate(el=>({...el.dataset}));
 const replay=data=>page.evaluate(data=>{const b=document.createElement('button');Object.assign(b.dataset,data);document.body.append(b);b.click();b.remove();},data);
 // Full-stock support starts in Adjust: 950 LSS / 5 awake people is 190
 // days, already above its 28-day target. Both actual Adjust and Review modes
 // are interrupted without commit, and their detached callbacks stay inert.
 assert.equal(f.state.ship.lifeSupport.stockUnits,'950');
 assert.equal(f.state.ship.lifeSupport.capacityHours,672);
 for(const from of ['refuel','refill-support'])for(const mode of (from==='refuel'?['inline']:['adjust','review'])){
  await click(page,from);await page.locator('#service-panel').waitFor();
  let oldConfirm,oldNoopReview;
  if(from==='refill-support'){
   assert.equal(await page.locator('#service-form [name="extraDays"]').inputValue(),'0');
   assert.equal(await page.locator('#service-panel [data-action="service-confirm"]').count(),0);
   assert.equal(await action(page,'service-review').isDisabled(),true,'Existing 190 days make the normal refill a no-op');
   assert.match(await page.locator('#service-quote').textContent(),/190 days/);
   assert.equal((await page.locator('#service-quote .service-total strong').textContent()).trim(),'Cr 0');
   oldNoopReview=await remember('#service-panel [data-action="service-review"]');
   await unchanged(page,f,'Opening full-stock support adjustments');
   await page.locator('#service-form [name="extraDays"]').fill('200');
   assert.equal((await page.locator('#service-quote .service-total strong').textContent()).trim(),'Cr 6,800','Only the 38-day deficit beyond existing stock is billed');
   assert.match(await page.locator('#service-quote').textContent(),/1140 LSS aboard/);
   await click(page,'service-review');
   oldConfirm=await remember('#service-panel [data-action="service-confirm"]');
   if(mode==='adjust')await click(page,'service-adjust');
  }else{
   oldConfirm=await remember('#service-panel [data-action="service-confirm"]');
   await page.locator('#service-form [name="fuelTons"]').fill('2');
  }
  const oldAction=await remember('#service-panel [data-action="'+(mode==='adjust'?'service-review':'service-confirm')+'"]');
  await click(page,'cargo-hold');await opened(page);
  assert.equal(await page.locator('#service-panel,#expense-panel,#service-form').count(),0);
  await replay(oldAction);await replay(oldConfirm);if(oldNoopReview)await replay(oldNoopReview);await opened(page);await unchanged(page,f,from+'/'+mode+' → Cargo with detached callbacks');
  await click(page,from);await replay(oldAction);await replay(oldConfirm);if(oldNoopReview)await replay(oldNoopReview);
  const reset=await page.locator('#service-form [name="'+(from==='refuel'?'fuelTons':'extraDays')+'"]').inputValue();
  assert.equal(reset,from==='refuel'?'15':'0','Discarded service draft is not resurrected');
  if(from==='refill-support')assert.equal(await action(page,'service-review').isDisabled(),true,'Reopened full-stock draft remains a no-op');
  await unchanged(page,f,'Reopening '+from+' with stale callbacks');
  await click(page,'cargo-hold');await opened(page);
 }
 await click(page,'ship-expenses');await page.locator('#expense-panel').waitFor();
 const oldExpenseLink=await remember('#expense-panel [data-action="expense-open"][data-arg$=":mortgage"]');
 await click(page,'cargo-hold');await replay(oldExpenseLink);await opened(page);
 await click(page,'ship-expenses');await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();
 await page.locator('#expense-form [name="payments"]').fill('2');
 const oldPay=await remember('#expense-panel [data-action="expense-pay"]');
 await click(page,'cargo-hold');await replay(oldPay);await opened(page);await unchanged(page,f,'Mortgage preview → Cargo and detached Pay');
 await click(page,'ship-expenses');await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();
 await replay(oldPay);assert.equal(await page.locator('#expense-form [name="payments"]').inputValue(),'1');
 await unchanged(page,f,'Replacement expense rejects old payment token');
 await click(page,'cargo-hold');await opened(page);
 for(let i=0;i<4;i++){
  await click(page,'cargo-hold');
  await page.getByRole('complementary',{name:'Selected world data'}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'cargo-hold','Toggling the selected button returns keyboard focus to the quick-view button');
  await click(page,'cargo-hold');await opened(page);await unchanged(page,f,'Repeated quick-view switch '+i);
 }
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await unchanged(page,f,'Reload after cancelling every service and expense draft');
 await click(page,'cargo-hold');await opened(page);await manifestFacts(page,f);
}

async function readonlyView(context,f){
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  assert.equal(await action(page,'cargo-hold').isEnabled(),true,'Read-only tabs can inspect the manifest');
  await action(page,'cargo-hold').focus();await page.keyboard.press('Enter');await opened(page);
  await manifestFacts(page,f);await auditDetails(page,f);
  for(const target of ['Cargo','Contracts']){
   await click(page,'cargo-hold-tab',target);assert.equal(await page.locator('#tabs [aria-current="page"]').getAttribute('data-arg'),target);
   await click(page,'tab','Overview');
   await click(page,'cargo-hold');await opened(page);
  }
  await page.reload();await page.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  await click(page,'cargo-hold');await opened(page);await unchanged(page,f,'Read-only opening, Details, routing and reload');
  await page.screenshot({path:artifacts+'/cargo-hold-read-only.png',fullPage:true});assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

async function serviceButtonStyleParity(page){
 const buttons=page.locator('#ship-actions > .ship-actions > button');
 const styles=()=>buttons.evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node);return {background:s.backgroundImage,backgroundColor:s.backgroundColor,color:s.color,border:s.borderColor,opacity:s.opacity,fontWeight:s.fontWeight};}));
 const initial=await styles();for(const style of initial.slice(1))assert.deepEqual(style,initial[0],'Cargo Hold shares the same service-button palette and text contrast');
 const cargo=action(page,'cargo-hold'),fuel=action(page,'refuel');
 await cargo.focus();const cargoFocus=await cargo.evaluate(node=>{const s=getComputedStyle(node);return [s.outlineColor,s.outlineStyle,s.outlineWidth,s.outlineOffset];});
 await fuel.focus();const fuelFocus=await fuel.evaluate(node=>{const s=getComputedStyle(node);return [s.outlineColor,s.outlineStyle,s.outlineWidth,s.outlineOffset];});assert.deepEqual(cargoFocus,fuelFocus,'Cargo focus is equally visible');
 await buttons.evaluateAll(nodes=>nodes.forEach(node=>{node.disabled=true;}));
 const disabled=await styles();for(const style of disabled.slice(1))assert.deepEqual(style,disabled[0],'Cargo disabled palette matches other service controls');
 await buttons.evaluateAll(nodes=>nodes.forEach(node=>{node.disabled=false;node.blur();}));
 await click(page,'cargo-hold');await opened(page);const selected=await cargo.evaluate(node=>{const s=getComputedStyle(node);return [s.backgroundImage,s.color,s.outlineColor,s.outlineWidth,s.boxShadow];});
 await click(page,'refuel');await page.locator('#service-panel').waitFor();const fuelSelected=await fuel.evaluate(node=>{const s=getComputedStyle(node);return [s.backgroundImage,s.color,s.outlineColor,s.outlineWidth,s.boxShadow];});
 assert.deepEqual(selected,fuelSelected,'Cargo active state has the same selected styling');await click(page,'refuel');
}

async function main(){
 await mkdir(artifacts,{recursive:true});
 const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),results=[];
 try{
  for(const width of widths)for(const empty of [false,true]){
   const f=cargoFixture({empty}),name=(empty?'empty':'large')+'-'+width;
   const context=await browser.newContext({viewport:{width,height:1100}}),errors=[],requests=[];
   context.setDefaultTimeout(12000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
   await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
   await context.route('https://travellermap.com/api/**',async route=>{
    const u=new URL(route.request().url());requests.push(u.href);assert.equal(u.searchParams.get('milieu'),'M1105');
    if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
    if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
    if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
    if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
    throw Error('Unexpected map API '+u.href);
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
    assert.deepEqual(await page.locator('#ship-actions > .ship-actions > button').evaluateAll(buttons=>buttons.map(b=>b.dataset.action)),['refuel','refill-support','cargo-hold','ship-expenses']);
    await serviceButtonStyleParity(page);
    await click(page,'cargo-hold');await opened(page);
    if(width<1100){
     const heading=await page.locator('#cargo-hold-panel h2').boundingBox();
     assert.ok(heading.y>=0&&heading.y+heading.height<=1100,'Opening Cargo Hold scrolls its heading into the mobile viewport');
    }
    assert.equal(await page.locator('#modal').isVisible(),false,'Quick manifest replaces the right panel without opening a dialog');
    assert.equal(await page.locator('.world-info,#service-panel,#expense-panel').count(),0);
    assert.equal(await action(page,'cargo-hold').getAttribute('aria-pressed'),'true');
    await manifestFacts(page,f);
    const geometry=await overviewGeometry(page),scroll=empty?null:await scrollGeometry(page);
    await page.screenshot({path:artifacts+'/cargo-hold-'+name+'.png',fullPage:true});
    let selection=null,camera=null;
    if(!empty){
     camera=await cargoCameraStability(page,f);
     const actualId=f.state.actual,selectedId=f.state.route[2];
     await selectionGeometry(page,actualId,actualId);
     await action(page,'map-world',selectedId).focus();await page.keyboard.press('Enter');await opened(page);
     await unchanged(page,f,'Keyboard world browsing while Cargo is open');
     for(let i=0;i<6;i++){await click(page,'map-zoom-in');await frame(page);}
     await page.locator('.map-zoom-controls .help').getByText('288%',{exact:true}).waitFor();
     selection=await selectionGeometry(page,selectedId,actualId,{close:true});
     await manifestFacts(page,f);
     await page.screenshot({path:artifacts+'/cargo-hold-selected-hex-'+width+'.png',fullPage:true});
     await click(page,'cargo-hold-close');
     assert.equal(await page.locator('.world-info .screen-title strong').textContent(),f.state.worlds[selectedId].name,'Back to World data retains the browsed world');
     assert.equal(await page.locator('.map-key .key-selected-world').count(),1,'Legend uses the blue selection hex');
     await click(page,'world',actualId);await selectionGeometry(page,actualId,actualId,{close:true});
     await click(page,'cargo-hold');await opened(page);await auditDetails(page,f);
     if(width===1440||width===320)await navigationAndDrafts(page,f);
     if(width===1440)await readonlyView(context,f);
    }else{
     await click(page,'cargo-hold-tab','Cargo');await click(page,'tab','Overview');await click(page,'cargo-hold');await opened(page);
     await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await click(page,'cargo-hold');await opened(page);
     await manifestFacts(page,f);
    }
    assert.equal(requests.filter(url=>new URL(url).searchParams.get('jump')==='0').length,0,'Manifest and selected hex add no per-world API lookup');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page-level horizontal overflow');
    await unchanged(page,f,'All manifest and selection interactions including reload');assert.deepEqual(errors,[]);
    results.push({width,empty,expected:f.expected,geometry,scroll,selection,camera});console.log('PASS: Cargo Hold '+name);
   }catch(error){await page.screenshot({path:artifacts+'/cargo-hold-'+name+'-failure.png',fullPage:true}).catch(()=>{});throw error;}
   finally{await context.tracing.stop({path:artifacts+'/cargo-hold-'+name+'-trace.zip'});await context.close();}
  }
  await writeFile(artifacts+'/cargo-hold-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,widths,results},null,2));
  console.log('PASS: Cargo Hold saved-price manifest, independent lots, capacity/investment, internal keyboard scrolling, stale service/expense tokens, read-only Details, byte-identical reload and blue selected-world hex.');
 }finally{await browser.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
