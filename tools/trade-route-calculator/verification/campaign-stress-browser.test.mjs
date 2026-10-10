// Bounded compound-flow Chromium stress gate. Only fresh synthetic campaigns,
// deterministic dice and intercepted map responses are used. After initial
// fixture seeding, campaign changes use rendered UI controls/file import only.
// No state transition/price engine is used as the expected-result oracle.
// Run: node verification/campaign-stress-browser.test.mjs [playwright-module]
// Fixture-only syntax/schema check: node .../campaign-stress-browser.test.mjs --fixtures-only
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sizes=[{width:1440,height:1100},{width:390,height:844},{width:320,height:740}];
const report={suite:'Bounded synthetic campaign compound-flow stress',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,baseURL:base,cases:[],errors:[],evidencePolicy:'One viewport-sized completion image, a targeted mail review image, and at most two failure images per scenario; no unbounded traces, videos, or live campaign data.'};
let browser;
const errorText=error=>error?.stack||String(error);

function fixture(kind='ordinary'){
 const f=guiFixture(),s=f.state;
 Object.assign(s,{name:'Disposable campaign stress',bank:'10000000',revision:0,events:[],undo:[],ledger:[],policies:[],jumpAttempts:[],latestMailCheckId:null});
 s.ship.name='Synthetic compound-flow trader';s.ship.roundTons=true;s.ship.armed=true;
 s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'28',denominator:'1'}};
 s.ship.fuel.aboardTons=40;
 s.trader.rank=2;s.trader.soc=1;
 s.settings={...s.settings,profit:75,tax:false,insurance:false,creditStep:1};
 const world=structuredClone(s.snapshots[0].world),options={side:'buy',skill:0,counterparty:0,creditStep:1};
 s.snapshots=[
  {id:'stress-supplier',kind:'supplier',worldId:s.actual,world,party:'stress|supplier',partyName:'Stress supplier',hours:s.hours,startedHours:s.hours,criminal:false,options,offers:[{id:'stress-offer',commodity:'11',description:'Fixed-price stress electronics',remaining:'12',unitPrice:'12345',expired:false,illegal:false,audit:{manual:true,reason:'Synthetic opening quote'}}]},
  {id:'stress-buyer',kind:'buyer',worldId:s.actual,world,party:'stress|buyer',partyName:'Stress buyer',hours:s.hours,startedHours:s.hours,criminal:false,success:true,options:{...options,side:'sell'},offers:[]}
 ];
 s.lots=[
  {id:'stress-low',commodity:'11',description:'Low-basis opening electronics',quantity:'4',basis:'10001',goodsValue:'10000',world:s.actual,hours:s.hours},
  {id:'stress-high',commodity:'11',description:'High-basis opening electronics',quantity:'4',basis:'80000',goodsValue:'80000',world:s.actual,hours:s.hours}
 ];
 s.contracts=[{id:'stress-freight',offerId:'stress-freight-offer',kind:'freight',description:'Opening synthetic freight',status:'accepted',origin:s.actual,destination:s.route[s.routeIndex+1],quantity:'7',payment:'7000',dueHours:1000,audit:{manual:true,reason:'Opening fixture'}}];
 if(kind==='jump')s.contracts.push({id:'stress-jump-mail',offerId:'stress-jump-mail-offer',kind:'mail',status:'accepted',firstDeparture:null,origin:s.actual,destination:s.route[s.routeIndex+1],quantity:'5',payment:'25000',dueHours:null,audit:{manual:true,reason:'Opening zero-hour departure fixture'}});
 // Keep known worlds fully in the initial fixture so first-commit comparisons
 // are not confused with a map response adding unrelated synthetic worlds.
 f.apiWorlds=f.apiWorlds.filter(w=>s.worlds[w.WorldX+','+w.WorldY]);
 f.sec='Hex\tName\n'+f.apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n');
 validate(s);f.bytes=JSON.stringify(s);assert.deepEqual(JSON.parse(f.bytes),s);
 return f;
}

const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const read=async page=>JSON.parse(await raw(page));
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>page.locator('#tabs [data-arg="'+name+'"]').click();
const modal=page=>page.locator('#modal[open]');
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const heading=(page,name)=>page.getByRole('heading',{name,exact:true}).waitFor();
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const comparable=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const accounting=s=>({bank:s.bank,hours:s.hours,lots:s.lots,ledger:s.ledger,ship:s.ship,actual:s.actual,route:s.route,routeIndex:s.routeIndex});
const contractsOf=(s,kind,status)=>s.contracts.filter(c=>c.kind===kind&&(!status||c.status===status));
const lot=(s,id)=>s.lots.find(l=>l.id===id);
const ledgerNet=(before,after)=>after.ledger.slice(before.ledger.length).reduce((total,entry)=>total+BigInt(entry.amount),0n);
async function reveal(target){
 for(const detail of await target.locator('xpath=ancestor::details').all())if(!await detail.evaluate(el=>el.open)){await detail.locator(':scope > summary').click({position:{x:8,y:8}});assert.equal(await detail.evaluate(el=>el.open),true,'Field disclosure opens without activating its reference');}
}
async function fill(page,name,value,scope='#modal'){
 const field=page.locator(scope+' [name="'+name+'"]');await reveal(field);await field.fill(String(value));
}
async function choose(page,name,value,scope='#modal'){
 const field=page.locator(scope+' [name="'+name+'"]');await reveal(field);await field.selectOption(String(value));
}
async function submit(page,label,next=null,{double=false}={}){
 const button=modal(page).getByRole('button',{name:label,exact:true});
 // Real pointer events, rather than invoking application callbacks or injecting
 // a stale synthetic button. The follow-up click must not reach a background
 // control when the first confirmation closes the dialog.
 const originalTitle=await page.locator('#modal-title').innerText();
 await button.click({clickCount:double?2:1,delay:double?20:0});
 if(double){
  await frames(page);
  const open=await page.locator('#modal').evaluate(el=>el.open),title=await page.locator('#modal-title').innerText();
  if(next)assert.equal(open,true,'Repeated Preview must leave its confirmation open for a separate explicit commitment');
  assert.ok(!open||title===(next||originalTitle),'Repeated button activation must not open an unrelated dialog: '+title);
 }
 await page.waitForFunction(next=>!document.querySelector('#modal').open||!!document.querySelector('#modal-error').textContent||(next&&document.querySelector('#modal-title').textContent===next),next);
 assert.equal(await page.locator('#modal-error').textContent(),'','The requested UI action succeeds without a validation/runtime error');
 if(next)await heading(page,next);else await closed(page);
}
async function dismiss(page,method='Cancel'){
 if(method==='Escape')await page.keyboard.press('Escape');else await page.locator(method==='Close dialog'?'#modal-close':'#modal-cancel').click();
 await closed(page);
}
async function reload(page){await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Recover saved campaign',exact:true}).count(),0);}
async function unchanged(page,before,label){assert.equal(await raw(page),before,label+' preserves exact campaign bytes');}
async function undo(page){await tab(page,'History');assert.equal(await action(page,'undo').isEnabled(),true);await action(page,'undo').click();}
async function protectedHistoryUndo(page,reason,label){
 await tab(page,'History');const before=await raw(page);
 assert.equal(await action(page,'undo').isEnabled(),true,'Protected History Undo remains available to explain its refusal');
 await action(page,'undo').click({clickCount:2,delay:20});
 const warning=await page.locator('#message').innerText();assert.match(warning,/Cannot undo this protected jump/);assert.match(warning,reason);assert.match(warning,/Nothing was changed/);
 await unchanged(page,before,label);assert.equal(await modal(page).count(),0,'A protected Undo cannot open a rollback confirmation');
}
async function layout(page,result,label){
 const geometry=await page.evaluate(()=>{
  const d=document.querySelector('#modal[open]');
  return {pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:d?{left:d.getBoundingClientRect().left,right:d.getBoundingClientRect().right,overflow:d.scrollWidth-d.clientWidth}:null,width:innerWidth,auditCells:d?[...d.querySelectorAll('.preview dt,.preview dd')].filter(el=>el.getClientRects().length).map(el=>({text:el.textContent,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,overflow:el.scrollWidth-el.clientWidth})):[]};
 });
 result.layouts.push({label,...geometry});assert.ok(geometry.pageOverflow<=2,label+': no page-width overflow');
 if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,label+': dialog is reachable at this width');assert.ok(geometry.dialog.overflow<=2,label+': dialog content scrolls within its controls');}
 for(const cell of geometry.auditCells){assert.ok(cell.overflow<=2,label+': audit value wraps without clipping: '+cell.text);assert.ok(cell.left>=geometry.dialog.left&&cell.right<=geometry.dialog.right,label+': complete audit value stays inside dialog: '+cell.text);}
}
async function buy(page,{quantity=1,fee=0,double=false,cancel=false}={}){
 await tab(page,'Trade');await action(page,'buy','stress-offer').click();
 await fill(page,'quantity',quantity);await fill(page,'fee',fee);await submit(page,'Preview purchase','Confirm purchase');
 if(cancel)await dismiss(page);else await submit(page,'COMMIT PURCHASE',null,{double});
}
async function deposit(page,amount=7){
 await tab(page,'Accounts');await action(page,'deposit').click();await fill(page,'amount',amount);await fill(page,'reason','Synthetic transaction boundary');
 await submit(page,'Preview deposit','Confirm deposit');await submit(page,'Deposit Cr '+amount,null,{double:true});
}
async function exportBytes(page){
 await tab(page,'Settings');const target=action(page,'export');await reveal(target);
 const ready=page.waitForEvent('download');await target.click();const download=await ready;
 assert.equal(await download.failure(),null);const path=await download.path();assert.ok(path,'Real backup download exists');
 return readFile(path,'utf8');
}
async function importBytes(page,bytes,{cancel=false}={}){
 await tab(page,'Settings');const target=action(page,'import');await reveal(target);
 const ready=page.waitForEvent('filechooser');await target.click();await(await ready).setFiles({name:'synthetic-stress-backup.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
 await heading(page,'Load campaign (JSON)');
 if(cancel)return dismiss(page);
 await modal(page).locator('[name="backed"]').check();await submit(page,'Replace campaign');
}
async function saleDraft(page){
 await tab(page,'Cargo');await action(page,'sale-clear').click();
 for(const id of ['stress-low','stress-high'])await page.locator('[data-lot="'+id+'"]').check();
 await action(page,'sale').click();await heading(page,'Prepare sale · Stress buyer');
 await fill(page,'qty_stress-low',1);await fill(page,'qty_stress-high',2);
 await fill(page,'price_stress-low',20000);await fill(page,'price_stress-high',20000);await fill(page,'fee',0);await fill(page,'reason','Synthetic fixed sale price for independent cost-basis arithmetic');
}
async function recordServiceFrames(page,result,f){
 const ids=f.state.route.slice(0,3),baseline=await mapCameraSnapshot(page,ids);
 const capture=async label=>{
  const camera=await mapCameraSnapshot(page,ids);
  assertMapCameraUnchanged(camera,baseline,label+' preserves functional map scale/center');
  const boxes=await page.evaluate(()=>{
   const box=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   return {navigation:box('.navigation-panel'),mapFrame:box('.map-viewport'),svg:box('.world-map'),worldScreen:box('.world-screen'),service:box('#service-panel'),expenses:box('#expense-panel'),cargo:box('#cargo-hold-panel')};
  });
  result.knownVisualFollowup.measurements.push({label,...boxes,camera,frameHeightDeltaFromWorld:camera.height-baseline.height});
 };
 await capture('Overview world');await action(page,'refuel').click();await capture('Refuel');
 await action(page,'refill-support').click();await action(page,'service-adjust').click();await capture('LSS adjust');
 await action(page,'ship-expenses').click();await capture('Expenses');
 await action(page,'cargo-hold').click();await capture('Cargo Hold');await action(page,'cargo-hold-close').click();await capture('Overview restored');
 // A changing decorative frame height is recorded as the user's deferred
 // visual follow-up, never classified as a functional failure by this suite.
}

async function tradingCase(page,context,result){
 const start=await read(page),initial=await raw(page);
 await buy(page,{quantity:2,fee:10,cancel:true});await unchanged(page,initial,'Cancelled purchase');
 await buy(page,{quantity:2,fee:10,double:true});const first=await read(page),firstLot=first.lots.at(-1);
 assert.equal(first.revision,start.revision+1,'Double purchase confirmation records one revision');assert.equal(first.undo.length,1);
 assert.equal(first.lots.length,3);assert.equal(firstLot.quantity,'2');assert.equal(firstLot.goodsValue,'24690');assert.equal(firstLot.basis,'27159');assert.equal(first.bank,'9972841');
 assert.equal(ledgerNet(start,first),-27159n);assert.equal(first.snapshots[0].offers[0].remaining,'10');assert.deepEqual(first.ship,start.ship);assert.equal(first.hours,start.hours);
 await buy(page,{quantity:1,double:true});const bought=await read(page),secondLot=bought.lots.at(-1);
 assert.notEqual(secondLot.id,firstLot.id,'Same commodity purchases remain separate lots');assert.equal(secondLot.basis,'12345');assert.equal(bought.bank,'9960496');assert.equal(bought.snapshots[0].offers[0].remaining,'9');
 const beforeSale=await raw(page);
 await saleDraft(page);const diceBefore=await page.evaluate(()=>globalThis.stressDice.calls);
 await submit(page,'Preview sale','Confirm sale');await layout(page,result,'partial-sale-review');await dismiss(page,'Escape');await unchanged(page,beforeSale,'Cancelled mixed-basis partial sale');
 await saleDraft(page);assert.equal(await page.evaluate(()=>globalThis.stressDice.calls),diceBefore,'Cancel/reopen reuses the buyer quotes');
 await submit(page,'Preview sale','Confirm sale');await action(page,'sale-edit').click();await heading(page,'Prepare sale · Stress buyer');
 assert.equal(await modal(page).locator('[name="qty_stress-low"]').inputValue(),'1');assert.equal(await modal(page).locator('[name="qty_stress-high"]').inputValue(),'2');
 await submit(page,'Preview sale','Confirm sale');await submit(page,'COMMIT SALE',null,{double:true});
 const sold=await read(page),entries=sold.ledger.slice(bought.ledger.length),sales=entries.filter(e=>e.type==='Sale');
 assert.equal(sold.revision,bought.revision+1,'Double sale commits once');assert.equal(sales.length,2);assert.equal(sold.bank,'10016121');assert.equal(ledgerNet(bought,sold),55625n);
 // Independent arithmetic: floor(10001 * 1/4)=2500; 75% of its
 // positive 17500 profit is 13125, yielding 15625 bank credit. The
 // high-basis lot sells 2/4 for 40000, retaining its other 40000 basis.
 assert.deepEqual(['quantity','basis','goodsValue'].map(k=>lot(sold,'stress-low')[k]),['3','7501','7500']);
 assert.deepEqual(['quantity','basis','goodsValue'].map(k=>lot(sold,'stress-high')[k]),['2','40000','40000']);
 assert.equal(sales.find(e=>e.lotId==='stress-low').audit.basis,'2500');assert.equal(sales.find(e=>e.lotId==='stress-high').audit.basis,'40000');
 assert.equal(entries.find(e=>e.type==='Profit adjustment').amount,'-4375');assert.deepEqual(lot(sold,firstLot.id),firstLot);assert.deepEqual(lot(sold,secondLot.id),secondLot);assert.deepEqual(sold.contracts,bought.contracts);assert.deepEqual(sold.ship,bought.ship);
 await tab(page,'Accounts');for(const entry of sales){const bytes=await raw(page);await action(page,'ledger-audit',entry.id).click();assert.equal(await page.locator('#modal-submit').isVisible(),false);await dismiss(page);await unchanged(page,bytes,'Sale audit');}
 await reload(page);assert.deepEqual(await read(page),sold,'Mixed lots and accounting survive reload');
 const backup=await exportBytes(page);assert.deepEqual(JSON.parse(backup),sold,'Backup contains exactly the saved campaign');
 await deposit(page,7);const later=await read(page);assert.equal(later.bank,'10016128');
 const laterBytes=await raw(page);await importBytes(page,backup,{cancel:true});await unchanged(page,laterBytes,'Import cancellation');
 await importBytes(page,backup);const imported=await read(page);assert.equal(imported.revision,later.revision+1);assert.deepEqual({...imported,revision:sold.revision},sold,'Import changes only the replacement revision');
 await undo(page);assert.deepEqual(comparable(await read(page)),comparable(bought),'History Undo after real import restores both lots and exact pre-sale accounting');
 await tab(page,'Cargo');await layout(page,result,'partial-lots-restored');
 result.checks.push('Double Buy/Sell, separate purchase lots, manual sale reasons, partial cost-basis floor, per-lot reduced profit, ledger Audit, cancel/reopen, export/import cancellation, imported History Undo');
}

async function invalidCase(page,context,result){
 const initial=await raw(page);
 for(const value of ['-1','0','13','9007199254740993','1e309']){
  await tab(page,'Trade');await action(page,'buy','stress-offer').click();const field=modal(page).locator('[name="quantity"]');
  await field.fill('');await field.pressSequentially(value);await modal(page).getByRole('button',{name:'Preview purchase',exact:true}).click();await frames(page);
  assert.equal(await page.locator('#modal-title').innerText(),'Purchase · Fixed-price stress electronics','Invalid quantity never reaches commit');
  const validity=await field.evaluate(el=>({value:el.value,badInput:el.validity.badInput,rangeOverflow:el.validity.rangeOverflow,rangeUnderflow:el.validity.rangeUnderflow,valid:el.validity.valid}));
  result.invalidInputs.push({form:'purchase',attempt:value,...validity,error:await page.locator('#modal-error').innerText()});
  await unchanged(page,initial,'Invalid purchase '+value);await dismiss(page);
 }
 for(const [name,value]of [['jump','-1'],['jump','7'],['jump','1e309'],['fuelAboard','9007199254740993'],['capacity','-1']]){
  await tab(page,'Settings');await page.locator('#settings-reset').click();const field=page.locator('#settings-form [name="'+name+'"]');await reveal(field);
  await field.fill('');await field.pressSequentially(value);await page.locator('#settings-save').click();await frames(page);
  result.invalidInputs.push({form:'settings',field:name,attempt:value,value:await field.inputValue(),error:await page.locator('#settings-error').innerText()});
  await unchanged(page,initial,'Invalid settings '+name+'='+value);await page.locator('#settings-reset').click();
 }
 for(const [name,value]of [['qty_stress-low','5'],['fee','101'],['price_stress-low','-1'],['price_stress-low','1e309']]){
  await saleDraft(page);const field=modal(page).locator('[name="'+name+'"]');await reveal(field);await field.fill('');await field.pressSequentially(value);
  await modal(page).getByRole('button',{name:'Preview sale',exact:true}).click();await frames(page);
  assert.equal(await page.locator('#modal-title').innerText(),'Prepare sale · Stress buyer','Invalid sale never reaches commit');
  result.invalidInputs.push({form:'sale',field:name,attempt:value,value:await field.inputValue(),error:await page.locator('#modal-error').innerText()});
  await unchanged(page,initial,'Invalid sale '+name+'='+value);await dismiss(page);
 }
 await tab(page,'Settings');await page.locator('#settings-reset').click();
 await page.getByRole('button',{name:'Increase Jump rating',exact:true}).click({clickCount:2,delay:20});assert.equal(await page.locator('#settings-form [name="jump"]').inputValue(),'4','Ordinary real double-click increments remain two actions');
 await page.getByRole('button',{name:'Decrease Jump rating',exact:true}).click({clickCount:2,delay:20});assert.equal(await page.locator('#settings-form [name="jump"]').inputValue(),'2');await unchanged(page,initial,'Repeated settings increment/decrement drafts');await page.locator('#settings-reset').click();
 await buy(page,{quantity:1,double:true});const recovered=await read(page);assert.equal(recovered.bank,'9987655');assert.equal(recovered.revision,1,'Invalid drafts did not leave invisible commits');
 await undo(page);assert.deepEqual(comparable(await read(page)),comparable(JSON.parse(initial)),'Valid transaction and Undo still work after all invalid attempts');
 await tab(page,'Settings');await layout(page,result,'invalid-input-recovery');
 result.checks.push('Negative/zero/out-of-stock purchase, unsafe-large values, keyboard nonfinite exponent, out-of-range jump/fuel/capacity/sale/fee, no incidental save, valid recovery');
}

async function previewRepeatCase(page,context,result){
 const before=await raw(page);
 await tab(page,'Trade');await action(page,'buy','stress-offer').click();await fill(page,'quantity',2);await fill(page,'fee',10);
 await submit(page,'Preview purchase','Confirm purchase',{double:true});await unchanged(page,before,'Repeated purchase Preview');await dismiss(page);
 await saleDraft(page);await submit(page,'Preview sale','Confirm sale',{double:true});await unchanged(page,before,'Repeated sale Preview');await dismiss(page);
 await tab(page,'Accounts');await action(page,'deposit').click();await fill(page,'amount',7);await fill(page,'reason','Synthetic repeated-preview boundary');
 await submit(page,'Preview deposit','Confirm deposit',{double:true});await unchanged(page,before,'Repeated deposit Preview');await layout(page,result,'repeated-preview-awaits-commit');await dismiss(page);
 result.checks.push('Real pointer double-click Preview purchase/sale/deposit must stop at review without committing or opening an unrelated screen');
}

async function settingsCase(page,context,result,f){
 const initial=await raw(page);
 await tab(page,'Overview');await recordServiceFrames(page,result,f);await unchanged(page,initial,'Service frame inspection');
 await action(page,'refuel').click();await page.locator('#service-form').waitFor();
 await page.locator('#service-form [name="fuelTons"]').fill('3');
 await page.locator('.route-list [data-action="world"][data-arg="'+f.state.route[2]+'"]').click();
 assert.equal(await page.locator('#service-form [name="fuelTons"]').inputValue(),'3','World browsing retains the same uncommitted service draft');
 await action(page,'cargo-hold').click();assert.equal(await page.locator('#service-form').count(),0);await unchanged(page,initial,'Cargo Hold abandons fuel draft');
 await tab(page,'Settings');await fill(page,'name','Stale draft must never win','#settings-form');await tab(page,'Trade');
 await action(page,'buyer-search').click();await heading(page,'Trade at the current system');await submit(page,'Continue at current system','Find a buyer');await dismiss(page);
 await unchanged(page,initial,'World-recovery form cancellation');await buy(page,{quantity:1,double:true});const changed=await read(page),changedBytes=await raw(page);
 await tab(page,'Settings');assert.equal(await page.locator('#settings-form [name="name"]').inputValue(),'Stale draft must never win');
 await page.locator('#settings-save').click();assert.match(await page.locator('#settings-error').innerText(),/Campaign changed.*Revert changes/);await unchanged(page,changedBytes,'Stale settings after purchase');
 await page.locator('#settings-reset').click();assert.equal(await page.locator('#settings-form [name="name"]').inputValue(),changed.name);
 await choose(page,'mode','100','#settings-form');await choose(page,'creditStep','100','#settings-form');await page.locator('#settings-save').click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).settings.creditStep===100,campaignKey);const configured=await read(page);
 assert.equal(configured.revision,changed.revision+1);assert.equal(configured.settings.profit,100);assert.equal(configured.bank,changed.bank);assert.equal(configured.snapshots[0].offers[0].unitPrice,'12345','Saved offers are not repriced by settings');
 await buy(page,{quantity:1,double:true});const bought=await read(page);
 assert.equal(bought.bank,String(BigInt(configured.bank)-12400n),'Only the new purchase rounds up to Cr100');assert.equal(bought.lots.at(-1).basis,'12400');assert.equal(lot(bought,'stress-low').basis,'10001','Existing lot costs are not retroactively rounded');
 await undo(page);assert.deepEqual(comparable(await read(page)),comparable(configured));await undo(page);assert.deepEqual(comparable(await read(page)),comparable(changed));
 await tab(page,'Overview');await action(page,'refuel').click();assert.equal(await page.locator('#service-form [name="fuelTons"]').inputValue(),'0','Old three-ton draft cannot survive a tab/settings/Undo cycle');
 await tab(page,'Accounts');assert.equal(await page.locator('#service-form').count(),0);assert.equal(await action(page,'deposit').isEnabled(),true);await layout(page,result,'settings-and-service-recovery');
 result.checks.push('Fuel draft/world/Cargo Hold/tab abandonment, remote trading recovery, stale Settings blocked by purchase, Revert, frozen offers and cost basis, new Cr100 purchase, two exact History Undos');
}

async function checkMail(page,destination,{combined=false,availability=12,containers=2}={}){
 await tab(page,'Contracts');await action(page,combined?'contracts-search':'mail-check').click();await choose(page,'destination',destination);
 await fill(page,'dice',8);await fill(page,'skill',0);await fill(page,'characteristic',0);await fill(page,'mailAvailability',availability);await fill(page,'mailContainers',containers);
 if(combined){await fill(page,'days',17);await fill(page,'diceSequence',Array(256).fill(3).join(','));}
 await submit(page,combined?'Generate offers':'Check for mail');
 const state=await read(page);return state.events.find(e=>e.id===state.latestMailCheckId);
}
async function contractsCase(page,context,result,f){
 const start=await read(page),destination=f.state.route[2],first=await checkMail(page,destination,{combined:true});
 assert.ok(first&&first.offers.some(o=>o.kind==='mail'));const firstMail=first.offers.find(o=>o.kind==='mail');
 const freight=first.offers.filter(o=>o.kind==='freight'&&Number(o.quantity)<=80).sort((a,b)=>Number(a.quantity)-Number(b.quantity))[0];assert.ok(freight,'Deterministic generated freight fits with opening cargo');
 const generatedBytes=await raw(page);await action(page,'draft-audit',freight.offerId).click();assert.equal(await page.locator('#modal-submit').isVisible(),false);await dismiss(page);await unchanged(page,generatedBytes,'Generated freight audit');
 await action(page,'contract-accept',freight.offerId).click();await dismiss(page);await unchanged(page,generatedBytes,'Freight acceptance cancellation');
 await action(page,'contract-accept',freight.offerId).click();await submit(page,'Accept whole contract',null,{double:true});const acceptedFreight=await read(page);
 assert.equal(contractsOf(acceptedFreight,'freight','accepted').length,2);assert.equal(acceptedFreight.bank,start.bank);assert.deepEqual(acceptedFreight.ledger,start.ledger);
 const second=await checkMail(page,destination,{containers:1});const secondMail=second.offers.find(o=>o.kind==='mail');assert.ok(secondMail);
 assert.equal(await page.locator('[data-action="contract-accept"][data-arg="'+firstMail.offerId+'"]').count(),0,'Recheck removes every old mail acceptance control');
 const mailIds=await page.locator('[data-action="contract-accept"]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.arg))]);
 assert.ok(mailIds.includes(secondMail.offerId));assert.equal(mailIds.filter(id=>[firstMail.offerId,secondMail.offerId].includes(id)).length,1,'Only the latest unaccepted mail offer is actionable');
 const checkedBytes=await raw(page);await tab(page,'History');await action(page,'event-audit',first.id).click();assert.match(await modal(page).innerText(),/Superseded mail check/);assert.equal(await page.locator('#modal-submit').isVisible(),false);assert.equal(await modal(page).locator('[data-action="contract-accept"]').count(),0);await dismiss(page);await unchanged(page,checkedBytes,'Superseded mail audit');
 await tab(page,'Contracts');await action(page,'contract-accept',secondMail.offerId).click();await submit(page,'Accept whole contract',null,{double:true});const accepted=await read(page),mail=contractsOf(accepted,'mail','accepted')[0];
 assert.equal(contractsOf(accepted,'mail').length,1);assert.equal(mail.quantity,'5');assert.equal(mail.payment,'25000');assert.equal(accepted.bank,start.bank);assert.deepEqual(accepted.ledger,start.ledger);
 const acceptedBytes=await raw(page);await action(page,'mail-cancel',mail.id).click();await layout(page,result,'mail-cancel-review');await capture(page,result,'mail-cancel-review');await dismiss(page,'Close dialog');await unchanged(page,acceptedBytes,'Mail cancel close/reopen');
 await action(page,'mail-cancel',mail.id).click();await submit(page,'Cancel mail and start over',null,{double:true});const cancelled=await read(page);
 assert.equal(cancelled.revision,accepted.revision+1);assert.equal(contractsOf(cancelled,'mail','cancelled').length,1);assert.deepEqual(accounting(cancelled),accounting(accepted));assert.deepEqual(contractsOf(cancelled,'freight'),contractsOf(accepted,'freight'));
 assert.equal(await page.locator('#main [data-action="contract-audit"][data-arg="'+mail.id+'"]').count(),0,'Cancelled mail leaves the active contract list');
 const cancelledBytes=await raw(page);await tab(page,'History');await action(page,'contract-audit',mail.id).click();assert.equal(await page.locator('#modal-submit').isVisible(),false);await dismiss(page);await unchanged(page,cancelledBytes,'Cancelled mail archive Audit');
 const unavailable=await checkMail(page,destination,{availability:2,containers:1});assert.equal(unavailable.offers.some(o=>o.kind==='mail'),false);assert.equal(await page.locator('#mail-card [data-action="contract-accept"]').count(),0,'Unavailable recheck cannot stack an old offer');
 await undo(page);await tab(page,'Contracts');assert.equal(await page.locator('#mail-card [data-action="contract-accept"]').count(),0,'Undo reconstructs a read-only previous result');
 const undone=await read(page);assert.equal(undone.latestMailCheckId,second.id);assert.equal(contractsOf(undone,'mail','cancelled').length,1);assert.deepEqual(contractsOf(undone,'freight'),contractsOf(accepted,'freight'));
 await reload(page);assert.deepEqual(await read(page),undone);await tab(page,'Contracts');assert.equal(await page.locator('#mail-card [data-action="contract-accept"]').count(),0);await layout(page,result,'contract-recheck-reload');
 result.checks.push('Generated freight Audit/cancel/double acceptance, mail supersession without stacking, read-only old audit, double acceptance/cancellation, no payout on acceptance/cancel, freight preservation, unavailable recheck, History Undo and reload');
}

async function ownershipCase(page,context,result){
 await tab(page,'Trade');await action(page,'buy','stress-offer').click();await fill(page,'quantity',2);await fill(page,'fee',10);await submit(page,'Preview purchase','Confirm purchase');
 const before=await raw(page),other=await context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
 await tab(other,'Trade');assert.equal(await action(other,'buy','stress-offer').isDisabled(),true);await unchanged(other,before,'Read-only trade browsing');
 await other.locator('#takeover').click({clickCount:2,delay:20});await other.getByText('Editing in this tab',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#modal-submit').disabled);assert.match(await page.locator('#modal-error').innerText(),/Editing moved/);await unchanged(page,before,'Takeover invalidates pending purchase');
 await tab(other,'Settings');await fill(other,'name','New editor campaign','#settings-form');await other.locator('#settings-save').click();
 await other.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).name==='New editor campaign',campaignKey);
 const edited=await read(other);assert.equal(edited.revision,1);assert.equal(edited.bank,'10000000');assert.equal(edited.lots.length,2);
 await dismiss(page);await page.locator('#takeover').click({clickCount:2,delay:20});await page.getByText('Editing in this tab',{exact:true}).waitFor();await other.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
 await buy(page,{quantity:1,double:true});const bought=await read(page);assert.equal(bought.revision,2);assert.equal(bought.bank,'9987655');assert.equal(bought.lots.length,3);assert.equal(bought.lots.at(-1).quantity,'1','Discarded two-ton draft cannot replace a fresh one-ton confirmation');assert.equal(bought.name,'New editor campaign');
 const stable=await raw(page);for(const name of ['Overview','Trade','Cargo','Contracts','Accounts','History','Settings']){await tab(other,name);assert.equal(await other.locator('#main [data-mutate]:enabled').count(),0,name+' remains read-only after repeated takeover');await unchanged(other,stable,'Read-only '+name);}
 await layout(other,result,'read-only-settings');await other.close();await tab(page,'History');await layout(page,result,'editor-recovered');
 result.checks.push('Second tab read-only, double takeover, stale purchase disabled, new-owner settings, editor handback, fresh single purchase, all seven read-only tabs');
}

async function jumpCase(page,context,result,f){
 const source=await read(page);await action(page,'jump').click();const prepared=await read(page);
 assert.equal(prepared.jumpAttempts.length,1);assert.equal(prepared.jumpAttempts[0].rolls.length,1);assert.equal(await page.evaluate(()=>globalThis.stressDice.calls),6);
 await dismiss(page);await action(page,'jump').click();assert.deepEqual(await read(page),prepared,'Cancelled jump retains its recorded roll');await dismiss(page,'Escape');
 await reload(page);await action(page,'jump').click();assert.equal(await page.evaluate(()=>globalThis.stressDice.calls),0,'Reloaded jump does not reroll');await fill(page,'hours',0);await submit(page,'COMMIT JUMP',null,{double:true});
 const arrived=await read(page);assert.equal(arrived.actual,f.state.route[2]);assert.equal(arrived.routeIndex,source.routeIndex+1);assert.equal(arrived.hours,source.hours);assert.equal(arrived.bank,source.bank);assert.equal(arrived.ship.fuel.aboardTons,20);
 assert.equal(arrived.ledger.filter(e=>e.type==='Jump').length,1);assert.equal(arrived.contracts.find(c=>c.id==='stress-jump-mail').firstDeparture.to,arrived.actual,'A zero-hour jump still records first departure');assert.equal(await action(page,'jump-undo').isEnabled(),true);
 await action(page,'jump-undo').click();await dismiss(page);assert.deepEqual(await read(page),arrived);
 await action(page,'jump-undo').click();await submit(page,'Use mulligan & return',null,{double:true});const returned=await read(page);
 assert.deepEqual(comparable(returned),comparable(source),'Mulligan restores all material campaign state');assert.equal(returned.jumpAttempts[0].mulliganUsed,true);
 await action(page,'jump').click();const retry=await read(page);assert.equal(retry.jumpAttempts[0].rolls.length,2);assert.equal(await page.evaluate(()=>globalThis.stressDice.calls),6,'Only the one permitted retry rolls six dice');await dismiss(page);
 await reload(page);await action(page,'jump').click();assert.equal(await page.evaluate(()=>globalThis.stressDice.calls),0);await fill(page,'hours',168);await submit(page,'COMMIT JUMP',null,{double:true});const repeated=await read(page);
 assert.equal(repeated.actual,f.state.route[2]);assert.equal(repeated.hours,source.hours+168);assert.equal(repeated.bank,source.bank);assert.equal(repeated.ship.lifeSupport.stockUnits.numerator,'14');assert.equal(repeated.ship.lifeSupport.stockUnits.denominator,'1');assert.equal(await action(page,'jump-undo').isDisabled(),true);
 await protectedHistoryUndo(page,/Mulligan used/,'History cannot bypass the used mulligan');
 await tab(page,'Overview');await action(page,'jump').click();await fill(page,'hours',0);await submit(page,'COMMIT JUMP');const next=await read(page);assert.equal(next.actual,f.state.route[3]);assert.equal(await action(page,'jump-undo').isEnabled(),true,'Next departure has its own one mulligan');
 await deposit(page,7);await tab(page,'Overview');assert.equal(await action(page,'jump-undo').isDisabled(),true,'Later monetary transaction closes jump mulligan');
 await undo(page);const depositUndone=await read(page);assert.equal(depositUndone.bank,next.bank);assert.equal(depositUndone.actual,next.actual);await protectedHistoryUndo(page,/later campaign change/,'Undoing later payment does not reopen the jump');
 const bytes=await exportBytes(page);await importBytes(page,bytes);await reload(page);await protectedHistoryUndo(page,/later campaign change/,'Closed mulligan survives backup/import/reload');
 await tab(page,'Overview');assert.equal(await action(page,'jump-undo').isDisabled(),true);await layout(page,result,'jump-boundaries');
 result.checks.push('Cancel/reopen/reload retained dice, double zero-hour jump, first mail departure, one mulligan restores whole campaign, exactly one reroll, repeat cannot Undo, next-departure independence, later deposit/Undo boundary, import/reload retention');
}

const scenarios=[['trade-partial-lots-backup-undo',tradingCase],['invalid-values-and-recovery',invalidCase],['settings-world-tabs-and-rounding',settingsCase],['freight-mail-recheck-and-audit',contractsCase],['editor-handover-stale-confirmation',ownershipCase],['jump-mulligan-and-transaction-boundary',jumpCase],['preview-repeat-no-commit',previewRepeatCase]];
report.expectedCases=sizes.flatMap(size=>scenarios.map(([name])=>name+'-'+size.width));
async function capture(page,result,label){
 const filename='campaign-stress-'+result.id+'-'+label+'.png';await page.screenshot({path:join(artifacts,filename),fullPage:false});result.screenshots.push(filename);
}
async function runScenario(name,body,viewport){
 const result={id:name+'-'+viewport.width,status:'running',viewport,startedAt:new Date().toISOString(),checks:[],layouts:[],invalidInputs:[],screenshots:[],knownVisualFollowup:{subject:'Deferred map frame height changes between Overview services',failingAssertion:false,measurements:[]},pageErrors:[],consoleErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);
 let context;
 try{
  const f=fixture(name.startsWith('jump-')?'jump':'ordinary');
  context=await browser.newContext({viewport,acceptDownloads:true,serviceWorkers:'block'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
  context.on('page',page=>{
   page.on('pageerror',e=>result.pageErrors.push(errorText(e)));
   page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  });
  await context.addInitScript(({key,bytes,origin})=>{
   if(location.origin!==origin)return;
   if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
   globalThis.stressDice={calls:0};const original=crypto.getRandomValues.bind(crypto);
   crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){globalThis.stressDice.calls++;array[0]=2;return array;}return original(array);};
  },{key:campaignKey,bytes:f.bytes,origin:new URL(base).origin});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin===new URL(base).origin)return route.continue();
   const headers={'Access-Control-Allow-Origin':'*'};
   if(u.origin==='https://travellermap.com'&&u.pathname.startsWith('/api/')){
    if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe,headers});
    if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata,headers});
    if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec,headers});
    if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:f.apiWorlds},headers});
   }
   result.unexpectedRequests.push(u.href);return route.abort('blockedbyclient');
  });
  const page=await context.newPage();await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await unchanged(page,f.bytes,'Initial fixture load');
  await body(page,context,result,f);await frames(page);await capture(page,result,'complete');
  assert.deepEqual(result.pageErrors,[],'No uncaught Chromium runtime errors');assert.deepEqual(result.consoleErrors,[],'No browser console errors');assert.deepEqual(result.unexpectedRequests,[],'No uncontrolled external request');result.status='passed';
 }catch(error){
  result.status='failed';result.errors.push(errorText(error));
  for(const [index,page]of(context?.pages()||[]).slice(0,2).entries())if(!page.isClosed())try{await capture(page,result,'failure-'+index);}catch(e){result.errors.push(errorText(e));}
 }finally{
  if(context)try{await context.close();}catch(e){result.status='failed';result.errors.push(errorText(e));}
  result.finishedAt=new Date().toISOString();result.durationMs=Date.parse(result.finishedAt)-Date.parse(result.startedAt);
  await writeFile(join(artifacts,'campaign-stress-'+result.id+'.json'),JSON.stringify(result,null,2)+'\n');
  console.log(result.status.toUpperCase()+': '+result.id+' ('+result.durationMs+'ms)');for(const error of result.errors)console.error(error);
 }
}

if(process.argv[2]==='--fixtures-only'){
 for(const kind of ['ordinary','jump'])fixture(kind);
 assert.equal(new Set(report.expectedCases).size,21);console.log('PASS: both synthetic fixture branches validate; 21 unique named scenarios. Chromium was not launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(report.requestedCommit)assert.equal(report.testedCommit,report.requestedCommit,'Exact requested revision');
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};
  for(const viewport of sizes)for(const [name,body]of scenarios)await runScenario(name,body,viewport);
 }catch(error){report.errors.push(errorText(error));console.error(errorText(error));}
 finally{
  if(browser)try{await browser.close();}catch(error){report.errors.push(errorText(error));}
  report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.expectedCases.length&&report.expectedCases.every(id=>report.cases.some(c=>c.id===id&&c.status==='passed'));
  report.screenshotBytes=0;for(const filename of report.cases.flatMap(c=>c.screenshots))report.screenshotBytes+=(await stat(join(artifacts,filename))).size;
  if(report.screenshotBytes>=30*1024*1024){report.passed=false;report.errors.push('Campaign stress screenshots exceeded the 30 MiB artifact bound');}
  await writeFile(join(artifacts,'campaign-stress-report.json'),JSON.stringify(report,null,2)+'\n');
 }
 if(!report.passed)throw Error('Campaign stress verification failed; see verification-artifacts/campaign-stress-report.json and per-scenario screenshots/results.');
 console.log('PASS: '+report.expectedCases.length+' independent Chromium scenarios at 1440, 390 and 320px; synthetic compound-flow accounting, validation, settings, contracts, ownership, jump and repeated-preview boundaries.');
}
