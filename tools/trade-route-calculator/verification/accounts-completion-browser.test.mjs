// Bounded Stage 2 legacy Accounts completion gate. Exact tagged application,
// native DOM events, native Store/Web Locks and independent localStorage bytes.
// Provider wrappers separate real write/publication from Promise settlement.
// --fixtures-only (optionally --plan-json) returns BEFORE requiring Playwright.
// Browser dependency 'playwright' is loaded only below the fixtures-only branch.
// Browser execution belongs exclusively to exact-head GitHub CI; this file must
// never be invoked locally without --fixtures-only. No browser discovery flags.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';
import * as E from '../js/expenses.mjs';
import {roomCounts, roomTotal, occupants} from '../js/accommodation.mjs';
import {passengerShip, passengerTotals} from '../js/passengers.mjs';
import {normalizeAmount} from '../js/form-values.mjs';
import {normalize as normalizeWorld} from '../js/map.mjs';
import {displayDate} from '../js/calendar.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {formatCreditsText} from '../js/display.mjs';
import {POLITICAL_TERRITORY_KEY} from '../js/map-preferences.mjs';
const cliFlags=process.argv.slice(2).filter(arg=>arg.startsWith('--'));
for(const flag of cliFlags)assert.ok(['--fixtures-only','--plan-json'].includes(flag),'Unsupported argument; only documented fixture flags are accepted: '+flag);
assert.ok(!cliFlags.includes('--plan-json')||cliFlags.includes('--fixtures-only'),'--plan-json requires --fixtures-only and cannot launch a browser');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const nearbyAPIWorld={Name:'Unrelated nearby refresh world',WorldX:3,WorldY:1,Sector:'Synthetic',Hex:'0402',UWP:'A788879-C',PBG:'703',Zone:''};
const KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer',prefix='accounts-completion-';
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const operations=['bundle','rate','manual','correction'];
const expenseKinds=['berthing','fuel','staterooms','passengerSupport','salary','mortgage','maintenance'];
const baseModes=['native','deferred','retry','unknown-before','unknown-after','contradictory','notification-before','notification-after','missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token','fulfilled-no-publication','foreign-same','new-dialog','editor-regain','native-close','reentrant','queued-pending','queued-settled','foreign-form'];
const scenarios=operations.flatMap(operation=>baseModes.map(mode=>({id:operation+'-'+mode,operation,mode,dual:['native','deferred','retry'].includes(mode)})));
for(const[index,mode]of ['disk-same','disk-unreadable','read-only','foreign-new','render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close','recovery-reentry'].entries())scenarios.push({id:operations[index%4]+'-'+mode,operation:operations[index%4],mode,dual:['read-only','terminal-report'].includes(mode)});
for(const[index,drift]of ['hours','actual','world','ship','settings','history','form','control'].entries())scenarios.push({id:operations[index%4]+'-context-'+drift,operation:operations[index%4],mode:'context-drift',drift});
for(const operation of operations)for(const point of ['title','body'])scenarios.push({id:operation+'-entry-'+point+'-reentry',operation,mode:'construction-reentry',point});
for(const point of ['title','body','normalization'])scenarios.push({id:'bundle-handoff-'+point+'-reentry',operation:'bundle',mode:'handoff-reentry',point});
for(const operation of operations)for(const requested of ['normalization','controls']){const fault=operation==='rate'&&requested==='normalization'?'durable-read':requested;scenarios.push({id:operation+'-entry-'+fault+'-fault',operation,mode:'entry-fault',fault});}
for(const stage of ['first','review','settlement'])for(const drift of ['cancel','replacement','foreign','editor-regain','selection','terms'].filter(d=>stage!=='settlement'||d!=='selection'))scenarios.push({id:'bundle-'+stage+'-'+drift,operation:'bundle',mode:'stage-ownership',stage,drift});
for(const operation of ['bundle','rate'])for(const nearbyStage of ['review','prewrite','publication'])scenarios.push({id:operation+'-nearby-'+nearbyStage,operation,mode:'nearby-refresh',nearby:true,nearbyStage});
for(const operation of ['manual','correction'])for(const mode of ['map-owned','map-foreign'])scenarios.push({id:operation+'-'+mode,operation,mode,map:true,dual:mode==='map-owned'});
for(const point of ['restore','remove','estimate','unlock','report'])scenarios.push({id:'rate-handoff-'+point,operation:'rate',mode:'rate-handoff-reentry',point});
for(const point of ['remove','estimate','unlock'])scenarios.push({id:'rate-saved-'+point+'-fault',operation:'rate',mode:'rate-refresh-fault',point,dual:point==='estimate'});
scenarios.push({id:'rate-payment-chain',operation:'rate',mode:'rate-chain',dual:true},{id:'rate-retry-input-change',operation:'rate',mode:'retry-input-change'},{id:'manual-retry-input-change',operation:'manual',mode:'retry-input-change'},{id:'bundle-first-durable-drift',operation:'bundle',mode:'early-durable',dual:true});
for(const [id,options] of [['partial',{selected:['berthing','salary']}],['zero-fuel',{fuelTons:'0'}],['water-advisory',{selected:['fuel'],fuelType:'water',port:'X',dry:true}],['private-supplier',{selected:['fuel'],fuelType:'refined',port:'D',supplier:true}],['credits-one',{step:1}],['untracked-fuel',{selected:['fuel'],untrackedFuel:true}],['empty-selection',{selected:[],invalid:true}],['insufficient',{bank:'100',invalid:true}]])scenarios.push({id:'bundle-'+id,operation:'bundle',mode:'economic',...options,dual:['water-advisory','private-supplier'].includes(id)});
for(const [id,amount]of [['positive','10.1'],['zero','0'],['negative-bank','-90071992547409939999999.1']])scenarios.push({id:'correction-'+id,operation:'correction',mode:'native',amount});
// Repeated provenance/queue/context cross-products remain fully asserted; their
// identical already-represented surfaces are measured but not photographed.
// Failures always retain a complete viewport diagnostic, even in assertion-only
// cases. This fixes the evidence plan before CI rather than lowering readability.
function persistsEvidence(s){if(s.mode==='construction-reentry')return ['manual-entry-title-reentry','bundle-entry-body-reentry'].includes(s.id);if(s.mode==='handoff-reentry')return s.point==='normalization';if(s.mode==='nearby-refresh')return s.nearbyStage==='publication';if(s.mode==='rate-handoff-reentry')return s.point==='report';return detailedSuccess(s)||['deferred','retry','unknown-before','unknown-after','foreign-same','new-dialog','read-only','disk-same','disk-unreadable','early-durable','reentrant-close','construction-reentry','handoff-reentry','entry-fault','nearby-refresh','map-owned','map-foreign','rate-handoff-reentry','rate-refresh-fault','rate-chain','retry-input-change','controls','economic','published-disk-drift','published-disk-unreadable','retired-unknown-newer','covered-details-pending'].includes(s.mode)||s.mode==='stage-ownership'&&s.drift==='replacement'||s.mode==='native'&&s.operation==='correction';}
for(const operation of operations)scenarios.push({id:operation+'-published-disk-drift',operation,mode:'published-disk-drift'});
for(const operation of ['rate','manual'])for(const mode of ['published-disk-unreadable','retired-unknown-newer','moved-form'])scenarios.push({id:operation+'-'+mode,operation,mode,dual:operation==='manual'&&mode==='retired-unknown-newer'});
for(const operation of ['bundle','manual','correction'])scenarios.push({id:operation+'-entry-formdata-fault',operation,mode:'entry-fault',fault:'form-data'});
scenarios.push({id:'rate-die-reentrant',operation:'rate',mode:'die-reentrant'});
scenarios.push({id:'bundle-covered-details-pending',operation:'bundle',mode:'covered-details-pending',dual:true});
for(const scenario of scenarios)if(scenario.id==='manual-unknown-before'||scenario.id==='rate-unknown-after')scenario.dual=true;
const cases=scenarios.flatMap(scenario=>sizes.filter(size=>size.width===1440||scenario.dual).map(viewport=>({scenario,viewport})));
function detailedSuccess(s){return s.id===s.operation+'-native';}
// Every frame is a complete, original-resolution viewport. Taller first forms
// have separately scrolled full viewport details, never cropped evidence.
const screenshotOptions=Object.freeze({type:'jpeg',quality:55,caret:'initial'});
const successPattern=/^(?:Paid \d+ ship expenses?|Saved starport berthing rate|Manual expense|Bank correction) saved\.$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const releasedEconomics={commit:'81011e305aef7e8561b4b2f9f9417f4059676b44',tree:'3ce9475096d364f337569d833ab862a658418ba4',comparison:'Import-line release query tags are normalized. Released hashes remain retained; reviewed .64 shared transport modules are separately pinned below. Full original-app/controller/Store comparisons remain in the separate pinned native economic oracle.',sha256:{"state.mjs":"be5633196e9a7aa65b91f7816b4b7dcd672a4be0feea4f85b82d860fd597f4fc","expenses.mjs":"4131f762c7469f3d58874dc640c99ef728e2fa1283609b696cb2ee3bbc60e728","amounts.mjs":"8876a391fabc4f842678c9249aa2d9ad6797cca12e51d61c1ad88736ca997958","rounding.mjs":"646cf43e1b118d38da9c7d314dc9f0f75f166462a699045f6adebb155f124568","form-values.mjs":"4e2cddcae2abfe632e4aad31a794b8b889a0b3fa7bc84d0495202ea7187251b4","fuel.mjs":"e4f2cbb65f4be29e552ef0c9424339f1633996b4549693facd2cd6902dde62b3","accommodation.mjs":"9a6fc0b166bd0d2a694dcf4a274eadbf7954165a4a4873a1227add23129431a6","life-support.mjs":"da54f07099b74a19f53cba68b1cb1e27a8df1ce053cf6a5a0b9b4e5b22233c3e","mortgage.mjs":"5eaba86ba4274f1f04c85c7839565f8c9714b66012d5b60aff1b7822321006c4","maintenance.mjs":"e423e6d10b5ef90e703caee38f3921626dfe54cba91dedf0bcb1b2b1b1c29247","passengers.mjs":"c1f5bee3b8bc2d13dbe346ded5a5f6e2ec0253ed84efecf00839729dbe68a818"}};
function importTagNeutral(source){return source.replace(/(^import [^\n]*?)\?v=[^'"]+/gm,'$1?v=<release>');}
// .64 adds manual passenger acceptance/validation and optional fuel advice in
// these shared modules. The pinned released native Accounts oracle verifies all
// 80 economic scenarios; retain original hashes and separately pin the reviewed
// candidate modules rather than claiming their source is byte-identical to .58.
const approvedTransportSources={
 'state.mjs':'1cb1c8288df5ca1cae54c11d03a6e32ca8bbe5174230e3f42a55dacf95c24005',
 'expenses.mjs':'3a5cd61dde41ed642a417137b73aab57802d00c86a93d07ec45c8ee8fe79fb33',
 'passengers.mjs':'07ee50885ba4ae917a06787578fd9c41fee8482ee8858e242812db541963e2b7'
};
// .65 adds saved-refill audit fields and user-approved pooled Low physical supply rounding.
// Original released/.64 identities remain above; monetary oracle assertions remain intact.
const approvedServiceSources={"state.mjs": "75973cea99ef3b90e0d79edfee4d54d68169d5cb21d7c7ef9ce4a69515b3bfe8", "life-support.mjs": "9aa49fbf1fb33e54f7c9e6fe519bf76c95f0877d8e8ae82df3d77297670f2b0e"};
// .66 changes only refill plans, stock-total rounding and saved purchase audit fields.
// Released/.64/.65 identities remain retained; monetary inverse assertions remain.
const approvedRefillSources={"state.mjs": "e805e57e710395d4e932fe8551af1c8cbc633a47fef9c491804714a0f293111c", "life-support.mjs": "823c1ca83ff188c78a9e07e7be3717bb8399b44d6ff4c778eaf7487d6e0e1c53"};
async function assertReleasedEconomics(){for(const[name,expectedHash]of Object.entries(releasedEconomics.sha256))assert.equal(hash(importTagNeutral(await readFile(new URL('../js/'+name,import.meta.url),'utf8'))),approvedServiceSources[name]||approvedRefillSources[name]||approvedServiceSources[name]||approvedTransportSources[name]||expectedHash,(approvedRefillSources[name]?'Reviewed .66 refill source identity: ':approvedServiceSources[name]?'Reviewed .65 service source identity: ':approvedTransportSources[name]?'Reviewed .64 transport source identity: ':'Released economic source identity: ')+name);return {...releasedEconomics,approvedTransportSources,approvedServiceSources,approvedRefillSources};}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const tab=(page,name)=>action(page,'tab',name).click();
const gate=page=>page.evaluate(()=>accountsGate.snapshot());
const release=(page,kind='native')=>page.evaluate(kind=>accountsGate.release(kind),kind);
const errorText=error=>error?.stack||String(error);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
const firstTitle=scenario=>['bundle','rate'].includes(scenario.operation)?'Ship expenses':scenario.operation==='manual'?'Record expense':'Referee bank correction';
const title=scenario=>scenario.operation==='bundle'?'Confirm ship expenses':firstTitle(scenario);
const report={suite:'Legacy Accounts save completion',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,node:process.version,declaredCases:cases.length,declaredDesktopCases:scenarios.length,declaredMobileCases:cases.length-scenarios.length,gateSHA256:hash(await readFile(fileURLToPath(import.meta.url))),scenarios,cases:[],errors:[],limits:{durationMs:14*60*1000,artifactBytes:24*1024*1024,imageBytes:20*1024*1024},scope:'Exactly Accounts atomic multi-charge bundle, retained first-form berthing rate, manual expense and signed bank correction. Native sync plus real write/publication held before settlement; accepted full campaign economics/rounding/Undo/mulligan; deliberate one-die retry; owner/form/tenure/queued reentry and rate-to-payment action rotation; actual nearby/MapAreaCache/ResizeObserver callbacks; genuine uninstrumented reload and History Undo. Dedicated Expense/Fuel/LSS suites remain independent controls. No ledger/CSS redesign: inherited extreme ledger overlap is qualified by baseline source parity, not claimed fixed.'};
let browser,imageBytes=0;
function normalize(value){const ids=new Map();return JSON.parse(JSON.stringify(value).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'generated-'+ids.size);return ids.get(id);}));}
function fixture(scenario={}){
 let s=S.initial();const origin={id:'0,1',x:0,y:1,name:'Accounts Departure',sector:'Synthetic',hex:'0102',uwp:'A788879-C',zone:'Safe',raw:{PBG:'703'}},current={...origin,id:'1,1',x:1,name:'Accounts Port',hex:'0202',uwp:(scenario.port||'A')+(scenario.dry?'000879-C':'788879-C')},destination={...origin,id:'2,1',x:2,name:'Accounts Destination',hex:'0302'};
 if(scenario.operation!=='rate'&&E.berthMultipliers[E.starport(current)])current.berthingRate={port:E.starport(current),die:3};
 Object.assign(s,{initialized:true,name:'Disposable legacy Accounts campaign',actual:origin.id,worlds:{[origin.id]:origin,[current.id]:current,[destination.id]:destination},route:[origin.id,current.id,destination.id],bank:scenario.bank||'90071992547409931234567',hours:671});
 Object.assign(s.ship,{name:'Accounts Trader',capacity:'100',armed:true,staterooms:4,jump:2,fuel:configureFuel(200,40,40,0,2),lifeSupport:{capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}},accommodation:{combinedPeople:true,rooms:{low:0,middle:3,high:1},roomService:{middle:{level:'custom',monthly:'1203'}},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0',passengerCapacity:{reservedCabins:1,installedLowBerths:4}},expenses:{salary:'12000'},mortgage:{originalAmount:'24000000',payment:'100003',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'},maintenance:{payment:'2003',nextDueDate:'015-1105',paidSinceTracking:'4006'}});
 Object.assign(s.trader,{broker:2,streetwise:3,rank:2,soc:1,characteristic:1});Object.assign(s.settings,{creditStep:scenario.step||100,tax:true,profit:50});
 s.lots=[{id:'unrelated-lot',commodity:'11',description:'Unrelated owned cargo',quantity:'3',basis:'10007',goodsValue:'9001'}];s.ledger=[{id:'accounts-opening',type:'Opening bank',amount:s.bank,hours:0,world:origin.id}];s.dashboardBaseline=createDashboardBaseline(s);s=S.validate(s);
 const prepared=S.prepareJump(s,()=>({dice:Array(6).fill(3),total:18}));s=S.transition(prepared.state,'Jump: '+origin.name+' → '+current.name,n=>S.commitJump(n,{attemptId:prepared.attempt.id,elapsed:168}));assert.equal(S.jumpUndoEligibility(s).allowed,true);assert.equal(s.actual,current.id);
 if(scenario.untrackedFuel)delete s.ship.fuel;
 return S.validate(s);
}
function fieldValues(scenario){return ['bundle','rate'].includes(scenario.operation)?{weeks:'3',fuelType:scenario.fuelType||'refined',fuelTons:scenario.fuelTons??(scenario.operation==='rate'?'11':'10.1'),stateroomsPeriod:'week',stateroomsUnits:'2',passengerSupportPeriod:'month',passengerSupportUnits:'1',salary:scenario.salary??(scenario.operation==='rate'?'12400':'12301'),salaryMonths:'3',mortgagePayments:'2',maintenancePayments:'2',expenseNotes:' Synthetic combined payment / confirmed private fuel source '}: {amount:scenario.amount??(scenario.operation==='correction'?'-101.1':'10.1'),reason:'  Synthetic Accounts exact reason  '};}
function acceptedFields(scenario,before){const f=fieldValues(scenario),rounding=[];for(const[name,label,unit]of [['fuelTons','Fuel to acquire · tons','tons'],['salary','Total crew salaries · Cr per month','credits'],['amount',scenario.operation==='correction'?'Bank change · Cr (negative removes money)':'Expense · Cr','credits']]){
 if(!(name in f)||name==='fuelTons'&&!(scenario.selected||expenseKinds).includes('fuel')||name==='salary'&&!(scenario.selected||expenseKinds).includes('salary'))continue;
 const normalized=normalizeAmount(f[name],{unit,creditStep:before.settings.creditStep});if(normalized.rounding)rounding.push({label,...normalized.rounding});f[name]=normalized.value;
 }return {fields:f,rounding};}
function inputs(before,scenario){const {fields:f}=acceptedFields(scenario,before),ship=passengerShip(before);return E.payableExpenses((scenario.selected||expenseKinds).map(kind=>({kind,fuelShip:before.ship,recurringShip:before.ship,mortgagePayments:f.mortgagePayments,maintenancePayments:f.maintenancePayments,creditStep:before.settings.creditStep,weeks:f.weeks,tons:f.fuelTons,fuelType:f.fuelType,monthly:f[kind]??null,months:f[kind+'Months']??null,notes:f.expenseNotes,otherSupplier:!!scenario.supplier,staterooms:roomTotal(before.ship),rooms:roomCounts(before.ship),roomService:before.ship.accommodation?.roomService,period:f[kind+'Period']??null,units:f[kind+'Units']??null,passengers:occupants(ship).passengers,crew:occupants(ship).crew,bookedLowBerths:passengerTotals(before).low})));}
function transitionLabel(scenario,before){return scenario.operation==='rate'?'Saved starport berthing rate':scenario.operation==='manual'?'Manual expense':scenario.operation==='correction'?'Bank correction':'Paid '+inputs(before,scenario).length+' ship expense'+(inputs(before,scenario).length===1?'':'s');}
function expected(before,scenario){const accepted=acceptedFields(scenario,before);return S.transition(before,transitionLabel(scenario,before),s=>{
 if(scenario.nearbyStage==='review')s.worlds={'3,1':normalizeWorld(nearbyAPIWorld),...s.worlds};
 if(scenario.operation==='rate')S.saveBerthingRate(s,3);else if(scenario.operation==='bundle')S.shipExpenses(s,inputs(before,scenario));else if(scenario.operation==='manual')S.expense(s,accepted.fields.amount,accepted.fields.reason);else S.bankCorrection(s,accepted.fields.amount,accepted.fields.reason);
 if(scenario.operation!=='rate'&&accepted.rounding.length)s.events.push({id:S.uid(),label:'Rounding applied [R]',hours:s.hours,roundingStep:s.settings.creditStep,roundingChanges:accepted.rounding});
 });}
function assertSaved(saved,before,scenario){
 assert.deepEqual(normalize(saved),normalize(expected(before,scenario)),'Exact full campaign transition, immutable accepted economics, rounding, audits, inverse Undo');
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 for(const key of ['hours','dateLabel','lots','contracts','policies','actual','route','routeIndex','cooldowns','snapshots','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' unchanged');
 assert.deepEqual(saved.ship.lifeSupport,before.ship.lifeSupport,'Expense payments do not replenish physical support');
 const added=saved.ledger.slice(before.ledger.length);assert.equal(added.length,scenario.operation==='rate'?0:scenario.operation==='bundle'?inputs(before,scenario).length:1);
 if(scenario.operation==='bundle'){
  assert.equal(new Set(added.map(e=>e.batchId)).size,1);assert.ok(added[0].batchId);const total=added.reduce((sum,e)=>sum-BigInt(e.amount),0n);assert.equal(saved.bank,String(BigInt(before.bank)-total));assert.deepEqual(added.map(e=>e.expense.kind),inputs(before,scenario).map(i=>i.kind));
  for(const kind of ['mortgage','maintenance']){const receipt=added.find(e=>e.expense.kind===kind);if(receipt){assert.equal(receipt.amount,String(-BigInt(before.ship[kind].payment)*2n));assert.equal(receipt.roundingStep,1);assert.deepEqual(receipt.paidAt,{dateLabel:before.dateLabel,hours:before.hours});}}
 }else if(scenario.operation==='rate'){assert.equal(saved.bank,before.bank);assert.deepEqual(saved.ship,before.ship);assert.deepEqual(saved.worlds[saved.actual].berthingRate,{port:E.starport(before.worlds[before.actual]),die:3});}
 else assert.equal(added[0].reason,fieldValues(scenario).reason,'Exact original reason whitespace retained');
 assert.deepEqual(material(S.undo(saved)),material(before),'Undo restores all economics, fuel, stock, schedules and ledger');assert.equal(saved.jumpAttempts.at(-1).closed,true);assert.equal(S.undo(saved).jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(S.undo(saved)).allowed,false,'Real mutation permanently closes the prior jump mulligan');
}
function assertRetained(snapshot){assert.deepEqual(snapshot.semantic,{...snapshot.baseline,dice:snapshot.acceptedDice},'Pending completion preserves exact form/main/summary/tab/status and retained die');assert.equal(snapshot.reviewNodeRetained,true);assert.equal(snapshot.mainNodeRetained,true);}
function safeReport(snapshot){const compact=value=>value&&{...value,main:{sha256:hash(value.main),bytes:value.main.length},summary:{sha256:hash(value.summary),bytes:value.summary.length}};const regionHash=value=>value&&{...value,regions:value.regions.map(({html,...region})=>({...region,sha256:html==null?null:hash(html),bytes:html?.length??null}))};return {...snapshot,candidates:snapshot.candidates.map(hash),baseline:compact(snapshot.baseline),semantic:compact(snapshot.semantic),mapBaseline:regionHash(snapshot.mapBaseline),paintEdges:snapshot.paintEdges.map(regionHash)};}
async function contextFor(result, scenario) {
 const context = await browser.newContext({viewport: result.viewport, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(errorText(error)));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
 });
 await context.exposeBinding('__accountsUnhandled', (_source, message) => {result.unhandledRejections.push(message);});
 await context.addInitScript(({key, bytes, origin, politicalKey, nearbyX}) => {
  if (location.origin !== origin) return;
  addEventListener('unhandledrejection', event => {void globalThis.__accountsUnhandled(String(event.reason?.stack || event.reason));});
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  localStorage.setItem(politicalKey, 'false');
  const native = Storage.prototype.setItem;
  globalThis.accountsStorage = {attempts: 0, writes: 0, failNext: false, observations: []};
  Storage.prototype.setItem = function(name, value) {
   if (this !== localStorage || name !== key) return Reflect.apply(native, this, [name, value]);
   accountsStorage.attempts++; accountsStorage.observations.push({message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open});
   if (accountsStorage.failNext) {accountsStorage.failNext = false; throw Error('Synthetic known accounts prewrite rejection');}
   const result = Reflect.apply(native, this, [name, value]); accountsStorage.writes++; return result;
  };
  // Observe native parsing of the boot nearby response independently from the
  // viewport-cache callbacks. The fetch/normalization/refresh continuation is
  // unchanged; later fresh-search options prove it reached the real known-worlds map.
  globalThis.accountsNearbyResponses=[];
  const responseJSON=Response.prototype.json;
  Response.prototype.json=function(...args){
   const url=new URL(this.url,location.href),relevant=url.origin==='https://travellermap.com'&&url.pathname.endsWith('/jumpworlds')&&url.searchParams.get('x')===String(nearbyX)&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12';
   const result=Reflect.apply(responseJSON,this,args);if(!relevant)return result;
   return result.then(value=>{const entry={url:url.href,parsedAt:performance.now(),worldIds:value.Worlds?.map(w=>w.WorldX+','+w.WorldY)||[],pending:!!globalThis.accountsGate?.pending,writeExecuted:!!globalThis.accountsGate?.pending?.executed};accountsNearbyResponses.push(entry);globalThis.accountsGate?.trace('boot-nearby-response-parsed',entry);return value;});
  };
  globalThis.accountsDiceCalls = 0;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) {accountsDiceCalls++;if(globalThis.accountsGate?.dieReentry){const g=accountsGate;g.dieReentry=false;const before=g.totalCalls;g.rate?.click();void g.firstSubmit({preventDefault(){},currentTarget:g.firstForm});g.dispatch('expense');g.dieReentryCheck={before,after:g.totalCalls,dice:accountsDiceCalls};}array[0] = 2; return array;} return random(array);};
  globalThis.accountsMapCallbacks = {scheduled: 0, executed: 0, cacheExecuted: 0, completed: 0, cacheCompleted: 0, loadingCacheCompleted: 0, lastLoadingCacheCompletedAt: null, resizeDelivered: 0};
  globalThis.accountsMapLoadingStatusNode = null;
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
   if (!/\bpaintMap\(\)/.test(Function.prototype.toString.call(callback))) return Reflect.apply(raf, this, [callback]);
   const cache = /\/map-viewport\.mjs(?:\?|:)/.test(new Error().stack || ''); accountsMapCallbacks.scheduled++;
   return Reflect.apply(raf, this, [function(time) {
    accountsMapCallbacks.executed++; if (cache) accountsMapCallbacks.cacheExecuted++;
    globalThis.accountsGate?.paintEdge('before', cache); const result = Reflect.apply(callback, this, [time]); globalThis.accountsGate?.paintEdge('after', cache);
    accountsMapCallbacks.completed++; if (cache) accountsMapCallbacks.cacheCompleted++;
    const statusNode = document.querySelector('#map-load-status'), status = statusNode?.textContent ?? null, pending = !!globalThis.accountsGate?.pending;
    if (cache && !pending && /Loading map data/.test(status || '')) {accountsMapCallbacks.loadingCacheCompleted++; accountsMapCallbacks.lastLoadingCacheCompletedAt = performance.now(); globalThis.accountsMapLoadingStatusNode = statusNode;}
    globalThis.accountsGate?.trace('map-paint-completed', {cache, status, statusNodeId: globalThis.accountsGate?.mapNodeId(statusNode) ?? null, pending, writeExecuted: !!globalThis.accountsGate?.pending?.executed});
    return result;
   }]);
  };
  const RO = ResizeObserver;
  window.ResizeObserver = class extends RO {constructor(callback) {const relevant = /scheduleMapPaint/.test(Function.prototype.toString.call(callback)); super(function(entries, observer) {if (relevant) accountsMapCallbacks.resizeDelivered++; return Reflect.apply(callback, this, [entries, observer]);});}};
 }, {key: KEY, bytes: JSON.stringify(fixture(scenario)), origin: new URL(base).origin, politicalKey: POLITICAL_TERRITORY_KEY, nearbyX:1});
 let held, releaseHold, heldOnce = false, heldReady;const reached=new Promise(resolve=>{heldReady=resolve;});
 context.accountsNetwork = {async waitHeld() {let timeout;try{await Promise.race([reached,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Real MapAreaCache tile did not reach network fixture')),10000);})]);return {...held};}finally{clearTimeout(timeout);}}, release() {assert.ok(releaseHold); const callback = releaseHold; releaseHold = null; callback();}, cleanup() {releaseHold?.(); releaseHold = null;}};
 let nearbyHeld,releaseNearby,nearbyHeldOnce=false,nearbyReached;const nearbyReady=new Promise(resolve=>{nearbyReached=resolve;});
 context.accountsNearbyNetwork={async waitHeld(){let timeout;try{await Promise.race([nearbyReady,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('Actual boot refreshNearby request was not held')),10000);})]);return {...nearbyHeld};}finally{clearTimeout(timeout);}},release(){assert.ok(releaseNearby,'Nearby HTTP response remains held');const resolve=releaseNearby;releaseNearby=null;resolve();},cleanup(){releaseNearby?.();releaseNearby=null;}};
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.href === new URL('verification/accounts-peer.html', base).href) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Disposable accounts native Store peer</title>'});
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) {
    if(scenario.nearby&&!nearbyHeldOnce&&url.searchParams.get('x')==='1'&&url.searchParams.get('y')==='1'&&url.searchParams.get('jump')==='12'){
     nearbyHeldOnce=true;nearbyHeld={url:url.href,heldAt:Date.now(),released:false};result.nearbyResponse=nearbyHeld;nearbyReached();await new Promise(resolve=>{releaseNearby=resolve;});nearbyHeld.released=true;nearbyHeld.releasedAt=Date.now();
     return route.fulfill({json:{Worlds:scenario.endpoint?[{...nearbyAPIWorld,Name:'Changed relevant destination',WorldX:2,WorldY:1,Hex:'0302',UWP:'B788879-C'}]:[nearbyAPIWorld]},headers});
    }

    if (scenario.map && !heldOnce && url.searchParams.get('x') === '0' && url.searchParams.get('y') === '0') {heldOnce = true; held = {url: url.href, heldAt: Date.now(), released: false}; result.mapResponse = held;heldReady(); await new Promise(resolve => {releaseHold = resolve;}); held.released = true; held.releasedAt = Date.now();}
    return route.fulfill({json: {Worlds: []}, headers});
   }
   if (url.pathname.endsWith('/universe')) return route.fulfill({json: {Sectors: []}, headers});
   if (url.pathname.endsWith('/metadata')) return route.fulfill({json: {Subsectors: []}, headers});
   if (url.pathname.endsWith('/sec')) return route.fulfill({json: 'Hex\tName\tUWP\n', headers});
  }
  result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
 }); return context;
}
async function installGate(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(script => script.type === 'module' && /\/app\.mjs(?:\?|$)/.test(script.src))?.src;
  if (!appURL) throw Error('Actual app module unavailable');
  const response = await fetch(appURL); if (!response.ok) throw Error('Cannot inspect runtime app');
  const source = await response.text(), specifier = source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if (!specifier) throw Error('Actual Store import missing');
  const storeURL = new URL(specifier, appURL).href;
  if (!new URL(storeURL).search) throw Error('Actual Store must be version-tagged');
  const {Store, KEY} = await import(storeURL), nativeSave = Store.prototype.save, nativeRead = Store.prototype.read;
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const storeResponse = await fetch(storeURL); if (!storeResponse.ok) throw Error('Cannot inspect runtime Store');
  const storeSource = await storeResponse.text();
  const g = globalThis.accountsGate = {armed: false, pending: null, store: null, args: null, lastState: null, calls: 0, totalCalls: 0, executions: 0, notifyFault: null, cleanupFault: null, entryFault: false, readFault: false, recoveryReentry: false, recoveryChecks: [], faults: [], candidates: [], forwarded: [], publications: [], observations: [], settlements: [], reentrant: false, reentrantChecks: [], oldSubmit: null, baseline: null};
  Object.assign(g, {timeline: [], timelineDropped: 0, constructionChecks: [], normalizationChecks: [], readChecks: []});
  g.trace = (event, detail = {}) => {const entry = {order: g.timeline.length + 1, at: performance.now(), event, ...detail}; if (g.timeline.length < 120) g.timeline.push(entry); else g.timelineDropped++; return entry;};
  Object.assign(g, {strict: false, paintEdges: [], paintEdgesDropped: 0, mutationCount: 0, phase: 'review', nextNodeId: 0, nodeIds: new WeakMap()});
  const nodeId = node => node ? (g.nodeIds.has(node) ? g.nodeIds.get(node) : (g.nodeIds.set(node, ++g.nextNodeId), g.nextNodeId)) : null;
  g.mapNodeId = nodeId;
  g.mapCapture = label => ({label, pending: !!g.pending, settlements: g.settlements.length, regions: ['.world-map', '#map-load-status', '.planned-route', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status'].map(selector => {const node = document.querySelector(selector); return {selector, nodeId: nodeId(node), html: node?.outerHTML ?? null};})});
  g.paintEdge = (edge, cache) => {if (!g.strict) return; if (g.paintEdges.length < 40) g.paintEdges.push({...g.mapCapture('paintMap-' + edge), edge, cache, phase: g.phase}); else g.paintEdgesDropped++;};
  const observer = new MutationObserver(records => {if (g.strict) g.mutationCount += records.length;});
  g.beginStrict = () => {g.strict = true; g.mapBaseline = g.mapCapture('strict-baseline'); for (const selector of ['#main', '#modal-form', '#summary', '#ship-actions', '#tabs', '#message', '#save-status']) observer.observe(document.querySelector(selector), {subtree: true, childList: true, attributes: true, characterData: true});};
  g.endStrict = () => {g.strict = false; observer.disconnect();};
  const semantic = () => ({main: document.querySelector('#main').innerHTML, summary: document.querySelector('#summary').innerHTML, shipActions: document.querySelector('#ship-actions').innerHTML, tabs: document.querySelector('#tabs').innerHTML, message: document.querySelector('#message').textContent, status: document.querySelector('#save-status').textContent, title: document.querySelector('#modal-title').textContent, review: document.querySelector('#modal-body').textContent, form: [...document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea')].map(el => ({name: el.name, value: el.value, checked: el.checked ?? null})), dice: accountsDiceCalls});
  const observation = point => ({point, message: document.querySelector('#message')?.textContent || '', open: !!document.querySelector('#modal')?.open, revision: JSON.parse(localStorage.getItem(KEY)).revision});
  const settled = () => g.settlements.length > 0;
  g.semantic=semantic;
  g.originalClose=close=>Reflect.apply(HTMLDialogElement.prototype.close,close,[]);
  const fault = name => {g.cleanupFault = null; g.faults.push(name); throw Error('Synthetic accounts completion ' + name + ' fault');};
  g.handoffProbe=point=>{
   if(!settled()||g.handoffPoint!==point)return;g.handoffPoint=null;
   if(g.handoffFault){g.faults.push('rate-'+point);throw Error('Synthetic saved rate '+point+' fault');}
   const before=g.totalCalls,form=document.querySelector('#modal-form'),title=document.querySelector('#modal-title').textContent;
   void g.oldSubmit({preventDefault(){},currentTarget:form});
   void form.onsubmit({preventDefault(){},currentTarget:form});
   if(point==='report'&&document.querySelector('#modal-title').textContent==='Confirm ship expenses'){
    g.paymentSubmit=form.onsubmit;g.paymentBaseline=g.semantic();void form.onsubmit({preventDefault(){},currentTarget:form});
   }
   g.handoffChecks??=[];g.handoffChecks.push({point,before,after:g.totalCalls,titleBefore:title,titleAfter:document.querySelector('#modal-title').textContent,pending:!!g.pending});
  };
  const remove=Element.prototype.remove;
  Element.prototype.remove=function(...args){const relevant=this===g.rate&&settled();if(relevant&&g.handoffFault)g.handoffProbe('remove');const result=Reflect.apply(remove,this,args);if(relevant)g.handoffProbe('remove');return result;};
  const inputDisabled=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'disabled');
  Object.defineProperty(HTMLInputElement.prototype,'disabled',{...inputDisabled,set(value){const result=Reflect.apply(inputDisabled.set,this,[value]);if(settled()&&value===false&&this.closest('#modal-form'))g.handoffProbe('restore');return result;}});
  const NativeFormData=FormData;globalThis.FormData=new Proxy(NativeFormData,{construct(target,args,newTarget){if(g.formDataFault&&args[0]?.id==='modal-form'){g.formDataFault=false;g.faults.push('form-data');throw Error('Synthetic Accounts FormData fault');}return Reflect.construct(target,args,newTarget);}});
  const qsa=Element.prototype.querySelectorAll;
  Element.prototype.querySelectorAll=function(selector){
   if(this.id==='modal-form'&&selector==='[data-round]'&&g.normalizationFault){
    const delayed=!!g.normalizationAfter&&--g.normalizationAfter>0;
    if(g.probePendingNormalization){
     const form=this,handler=form.onsubmit,body=document.querySelector('#modal-body').innerHTML,title=document.querySelector('#modal-title').textContent,bytes=localStorage.getItem(KEY);
     const check={call:g.normalizationChecks.length+1,title,open:document.querySelector('#modal').open,sameFirstForm:form===g.firstForm,sameFirstSubmit:handler===g.firstSubmit,providerPending:!!g.pending,totalCalls:g.totalCalls,writes:accountsStorage.writes,dice:accountsDiceCalls,controls:['modal-submit','modal-cancel','modal-close'].map(id=>({id,disabled:document.querySelector('#'+id).disabled}))};
     // The accepted first submit already owns its pending interval. A real Notes
     // click here must be blocked; only the next confirmation's construction may
     // be replaced. Do not confuse this with native-close owner invalidation.
     if(delayed){document.querySelector('#notes').click();Object.assign(check,{notesBlocked:document.querySelector('#modal-title').textContent===title,sameBody:document.querySelector('#modal-body').innerHTML===body,sameHandler:form.onsubmit===handler,sameOpen:document.querySelector('#modal').open===check.open,sameDurableBytes:localStorage.getItem(KEY)===bytes});}
     g.normalizationChecks.push(g.trace(delayed?'first-submit-normalization-notes-blocked':'confirmation-construction-normalization',check));
     if(delayed&&(!check.notesBlocked||!check.sameBody||!check.sameHandler||!check.sameOpen||!check.sameDurableBytes))throw Error('Pending first normalization did not block Notes replacement');
    }
    if(!delayed){const mode=g.normalizationFault;g.normalizationFault=null;g.faults.push('normalization');if(mode==='reentry'){g.constructionFault='normalization';g.replaceConstruction();}else throw Error('Synthetic accounts normalization fault');}
   }
   return Reflect.apply(qsa,this,[selector]);
  };
  const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
   if(g.warningFault&&this.id==='modal-error'&&/Synthetic/.test(value)){g.warningFault=false;g.faults.push('warning');throw Error('Synthetic accounts warning fault');}
   if (settled() && g.cleanupFault === 'clear-error' && this.id === 'modal-error' && value === '') fault('clear-error');
   if (settled() && g.cleanupFault === 'report' && this.id === 'message' && /^(?:Paid \d+ ship expenses?|Saved starport berthing rate|Manual expense|Bank correction) saved\.$/s.test(value)) fault('report');
   if (settled() && g.cleanupFault === 'terminal-report' && this.id === 'message' && /Reload/.test(value)) fault('terminal-report');
   if(this.id==='message'&&/^Saved starport berthing rate saved\.$/.test(value))g.handoffProbe('report');
   const result = Reflect.apply(text.set, this, [value]);
   if (g.constructionFault === 'title' && this.id === 'modal-title') g.replaceConstruction();
   return result;
  }});
  const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {...html, set(value) {
   if (settled() && g.cleanupFault === 'render' && this.id === 'main') fault('render');
   if(this.id==='expense-estimate')g.handoffProbe('estimate');
   const result=Reflect.apply(html.set,this,[value]);
   if(g.constructionFault==='body'&&this.id==='modal-body')g.replaceConstruction();return result;
  }});
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function(...args) {
   if (settled() && g.cleanupFault === 'close-before' && this.id === 'modal') fault('close-before');
   const result = Reflect.apply(close, this, args);
   if (settled() && g.cleanupFault === 'close-after' && this.id === 'modal') fault('close-after');
   if (settled() && g.cleanupFault === 'reentrant-close' && this.id === 'modal') {
    g.cleanupFault = null; g.faults.push('reentrant-close'); document.querySelector('#notes').click();
    g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit=document.querySelector('#modal-form').onsubmit; g.newerClose=document.querySelector('#modal-cancel').onclick;
   }
   return result;
  };
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {...disabled, set(value) {
   if (g.entryFault === this.id && value === true) {g.entryFault = null; g.faults.push('entry-controls'); throw Error('Synthetic accounts entry control fault');}
   if (settled() && g.recoveryReentry && this.id === 'modal-submit' && value === false) {
    g.recoveryReentry = false; const before = g.totalCalls;
    void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')}); document.querySelector('#modal-form').requestSubmit();
    g.recoveryChecks.push({before, after: g.totalCalls, writes: accountsStorage.writes});
   }
   if (settled() && ['restore-controls', 'controls'].includes(g.cleanupFault) && this.id === 'modal-cancel' && value === false) fault(g.cleanupFault);
   if(this.id==='modal-submit'&&value===false&&g.rate&&!g.rate.isConnected)g.handoffProbe('unlock');
   return Reflect.apply(disabled.set, this, [value]);
  }});
  g.dispatch = (name, arg = '') => {const button = document.createElement('button'); button.type = 'button'; button.dataset.action = name; button.dataset.arg = arg; document.body.append(button); button.click(); button.remove();};
  g.replaceConstruction = () => {
   // This direct onclick calls notes() before safely() reaches its await. The
   // delegated data-action route yields at services.action and is NOT a valid
   // synchronous construction-reentry boundary.
   const point = g.constructionFault, previousHandler = document.querySelector('#modal-form').onsubmit; g.constructionFault = null; g.faults.push('construction-' + point); document.querySelector('#notes').click();
   g.newer = {title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').innerHTML, error: document.querySelector('#modal-error').textContent}; g.newerSubmit=document.querySelector('#modal-form').onsubmit; g.newerClose=document.querySelector('#modal-cancel').onclick;
   const check = {point, title: g.newer.title, handlerInstalled: typeof g.newerSubmit === 'function', handlerChanged: g.newerSubmit !== previousHandler, submitHidden: document.querySelector('#modal-submit').hidden, open: document.querySelector('#modal').open};
   g.constructionChecks.push(g.trace('inside-setter-newer-notes', check));
   if (check.title !== 'Rules & Notes' || !check.handlerInstalled || !check.handlerChanged || !check.submitHidden || !check.open) throw Error('Synchronous Notes construction did not complete inside setter');
  };
  g.replay = () => {
   const before = semantic(), open = document.querySelector('#modal').open;
   for (const [name, arg] of [['tab','Cargo'],['world','2,1'],['deposit',''],['ship-expenses',''],['expense',''],['bank-correct',''],['expenses-all',''],['berthing-rate',''],['fuel-next',''],['fuel-fill',''],['refill-support',''],['refuel','']]) g.dispatch(name, arg);
   document.querySelector('#modal-form').requestSubmit();
   if (g.oldSubmit) void g.oldSubmit({preventDefault() {}, currentTarget: document.querySelector('#modal-form')});
   document.querySelector('#notes').click();
   g.reentrantChecks.push({sameTitle: semantic().title === before.title, sameOpen: document.querySelector('#modal').open === open});
  };
  function observeStore(store) {
   if (g.store === store) return; if (g.store) throw Error('Unexpected second application Store'); g.store = store;
   const change = store.onChange;
   store.onChange = function(...args) {
    g.lastState = args[0];
    const record = {revision: args[0].revision, tokenPresent: args[1]?.saveToken != null, tokenMatches: args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null, snapshotMatches: JSON.stringify(args[0]) === JSON.stringify(g.args?.[0]), actualCallback: false};
    g.publications.push(record); g.observations.push(observation('before-native-publication'));
    if (g.notifyFault === 'before') {g.notifyFault = null; throw Error('Synthetic notification before accounts publication');}
    if (g.notifyFault === 'missing') return;
    if (g.notifyFault === 'missing-token') args[1] = {};
    if (g.notifyFault === 'wrong-token') args[1] = {saveToken: {foreign: true}};
    if (g.notifyFault === 'wrong-candidate') args[0]={...args[0],bank:String(BigInt(args[0].bank)+1n)};
    if (g.notifyFault === 'wrong-revision') args[0] = {...args[0], revision: args[0].revision + 1};
    record.deliveredTokenPresent = args[1]?.saveToken != null; record.deliveredTokenMatches = args[1]?.saveToken === g.args?.[2] && args[1]?.saveToken != null; record.deliveredRevision = args[0].revision;
    const result = Reflect.apply(change, this, args); record.actualCallback = true; g.trace('publication-delivered', {revision: args[0].revision, tokenMatches: record.deliveredTokenMatches});
    if (g.notifyFault === 'consumed-token') {g.notifyFault = null; Reflect.apply(change, this, args); record.replayedConsumedToken = true;}
    if (g.reentrant && g.pending) g.replay();
    g.observations.push(observation('after-native-publication'));
    if (g.notifyFault === 'after') {g.notifyFault = null; throw Error('Synthetic notification after accounts publication');}
    return result;
   };
  }
  Store.prototype.read = function(...args) {observeStore(this);if(g.readFailureAt&&++g.boundaryReads===g.readFailureAt){g.readFault=true;g.trace('handoff-durable-read-fault',{read:g.boundaryReads});} if (g.readFault) throw Error('Synthetic unreadable durable accounts baseline'); const value=Reflect.apply(nativeRead,this,args),check={exactDurableCopy:JSON.stringify(value)===localStorage.getItem(KEY),aliasesLive:value===g.lastState,revision:value.revision};g.readChecks.push(check);if(check.aliasesLive||!check.exactDurableCopy)throw Error('Store.read must return the full readable durable campaign copy');return value;};
  Store.prototype.save = function(...args) {
   observeStore(this); g.args = args; g.acceptedDice = accountsDiceCalls; g.totalCalls++; g.trace('provider-invoked', {call: g.totalCalls, mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status'))});
   g.forwarded.push({argumentCount: args.length, tokenPresent: args[2] != null, expectedRevision: args[1], candidateRevision: args[0].revision}); g.candidates.push(JSON.stringify(args[0]));
   if (g.reentrant) g.replay();
   if (!g.armed) {g.executions++; return Reflect.apply(nativeSave, this, args);}
   if (g.pending) throw Error('Application called Store.save twice during pending accounts save'); g.calls++;
   return new Promise((resolve, reject) => {g.pending = {store: this, args, resolve, reject, executed: false, result: undefined, error: null};});
  };
  g.write = () => {const p = g.pending; if (!p || p.executed) throw Error('Native accounts write must execute exactly once'); p.executed = true; g.executions++; g.trace('native-write-invoked', {execution: g.executions}); try {p.result = Reflect.apply(nativeSave, p.store, p.args);} catch (error) {p.error = error;}};
  g.release = kind => {
   const p = g.pending; if (!p) throw Error('No pending accounts completion'); g.trace('provider-release', {kind, writeExecuted: p.executed});
   if (['unknown-before', 'known-before', 'fulfilled-no-publication'].includes(kind)) {
    g.pending = null; g.settlements.push({kind, executed: false});
    if (kind === 'fulfilled-no-publication') p.resolve();
    else p.reject(kind === 'known-before' ? Object.assign(Error('Synthetic known accounts prewrite rejection'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic unknown accounts outcome before write'));
    return;
   }
   if (!p.executed) g.write(); g.pending = null;
   if (['unknown-after', 'contradictory'].includes(kind)) {g.settlements.push({kind, executed: true}); p.reject(kind === 'contradictory' ? Object.assign(Error('Contradictory accounts not-committed after publication'), {code: 'SAVE_NOT_COMMITTED', committed: false}) : Error('Synthetic lost completion after durable accounts save'));}
   else if (p.error) {g.settlements.push({kind: 'native-rejected', code: p.error.code || null, committed: p.error.committed ?? null}); p.reject(p.error);}
   else {g.settlements.push({kind: 'native-fulfilled', executed: true}); p.resolve(p.result);}
  };
  g.remember = () => {g.oldSubmit = document.querySelector('#modal-form').onsubmit; g.baseline = semantic(); g.reviewNode = document.querySelector('#modal-body').firstElementChild; g.mainNode = document.querySelector('#main').firstElementChild; g.retainedBaselineOrder = g.trace('retained-baseline', {mapStatus: document.querySelector('#map-load-status')?.textContent ?? null, mapStatusNodeId: nodeId(document.querySelector('#map-load-status')), cacheCompleted: accountsMapCallbacks.cacheCompleted, loadingCacheCompleted: accountsMapCallbacks.loadingCacheCompleted});};
  g.snapshot=()=>({calls:g.calls,totalCalls:g.totalCalls,executions:g.executions,pending:!!g.pending,editable:g.store?.editable??null,reloadRequired:!!g.store?.reloadRequired,storage:{...accountsStorage},candidates:g.candidates,forwarded:g.forwarded,publications:g.publications,observations:g.observations,settlements:g.settlements,faults:g.faults,reentrantChecks:g.reentrantChecks,baseline:g.baseline,acceptedDice:g.acceptedDice,semantic:semantic(),reviewNodeRetained:!!g.reviewNode?.isConnected,mainNodeRetained:!!g.mainNode?.isConnected,newer:g.newer,recoveryChecks:g.recoveryChecks,callbacks:{...accountsMapCallbacks},nearbyResponses:accountsNearbyResponses,bootstrap:g.bootstrap,mapReadiness:g.mapReadiness,retainedBaselineOrder:g.retainedBaselineOrder,constructionChecks:g.constructionChecks,normalizationChecks:g.normalizationChecks,readChecks:g.readChecks,timeline:g.timeline,timelineDropped:g.timelineDropped,mapBaseline:g.mapBaseline,paintEdges:g.paintEdges,paintEdgesDropped:g.paintEdgesDropped,mutationCount:g.mutationCount,handoffChecks:g.handoffChecks||[],dieReentryCheck:g.dieReentryCheck??null,durableToken:/"saveToken"\s*:/.test(localStorage.getItem(KEY))});
  g.reset = () => {
   if(g.pending)throw Error('Cannot reset pending boundary observations');
   Object.assign(g,{args:null,calls:0,totalCalls:0,executions:0,candidates:[],forwarded:[],publications:[],observations:[],settlements:[],faults:[],reentrantChecks:[],baseline:null,acceptedDice:null,timeline:[],timelineDropped:0,recoveryChecks:[],constructionChecks:[],normalizationChecks:[]});
   Object.assign(accountsStorage,{attempts:0,writes:0,failNext:false,observations:[]});
  };
  // In this.onChange(this.read()), JavaScript resolves onChange before read.
  // First discover the real Store through read; the second actual storage event
  // then reaches the installed observation wrapper and the unchanged app callback.
  const initialBytes = localStorage.getItem(KEY), initialWrites = accountsStorage.writes;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.store) throw Error('Actual Store discovery failed');
  const discoveredPublications = g.publications.length;
  dispatchEvent(new StorageEvent('storage', {key: KEY, newValue: initialBytes}));
  if (!g.lastState || g.publications.length !== discoveredPublications + 1 || !g.publications.at(-1).actualCallback) throw Error('Second storage event did not deliver an observed real campaign to the app');
  if (JSON.stringify(g.lastState) !== initialBytes || localStorage.getItem(KEY) !== initialBytes || accountsStorage.writes !== initialWrites || g.totalCalls !== 0) throw Error('Observation bootstrap changed the synthetic campaign');
  g.bootstrap = {storeDiscovered: true, dispatches: 2, observedPublications: g.publications.length - discoveredPublications, appCallbackCompleted: g.publications.at(-1).actualCallback, deliveredRevision: g.lastState.revision, exactDurableBytes: true, writes: 0};
  g.trace('observation-bootstrap-complete', g.bootstrap);
  // Later in-place fixture drift changes only this actual delivered test object.
  return {appURL, storeURL, appSHA256: await digest(source), storeSHA256: await digest(storeSource), nativeLocks: !!navigator.locks};
 });
 assert.equal(result.runtime.nativeLocks, true);
 assert.equal(result.runtime.appSHA256, hash(await readFile(new URL('../js/app.mjs', import.meta.url))));
 assert.equal(result.runtime.storeSHA256, hash(await readFile(new URL('../js/persistence.mjs', import.meta.url))));
}
async function capture(page,result,label){
 await frames(page);
 if(result.persistEvidence||label==='failure'){
  const name=prefix+result.id+'-'+label+'.jpg',bytes=await page.screenshot(screenshotOptions),digest=hash(bytes);
  const attempt={name,producerCommit:report.testedCommit,appSHA256:result.runtime?.appSHA256??report.sourceSHA256?.['app.mjs']??null,gateSHA256:report.gateSHA256,imageSHA256:digest,bytes:bytes.length,viewport:result.viewport,encoding:screenshotOptions,previousPersistedImageBytes:imageBytes,persisted:false,status:'captured'};
  (result.captureAttempts??=[]).push(attempt);
  if(imageBytes+bytes.length>=report.limits.imageBytes){attempt.status='rejected-budget';assert.fail('Bounded screenshot bytes; failed attempt recorded and not indexed as persisted evidence');}
  await writeFile(join(artifacts,name),bytes);imageBytes+=bytes.length;report.imageBytes=imageBytes;attempt.persisted=true;attempt.status='persisted';result.screenshots.push(name);(result.imageSHA256??={})[name]=digest;(result.frameProvenance??=[]).push({...attempt});
 }
 const geometry = await page.evaluate(() => {const el = document.querySelector('#modal[open]'), rect = el?.getBoundingClientRect(); return {width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, dialog: rect ? {left: rect.left, right: rect.right, overflow: el.scrollWidth - el.clientWidth} : null};});
 result.layouts.push({label, ...geometry}); assert.ok(geometry.pageOverflow <= 2, 'No horizontal page overflow');
 if (geometry.dialog) {assert.ok(geometry.dialog.left >= -1 && geometry.dialog.right <= geometry.width + 1, 'Accounts dialog fits viewport'); assert.ok(geometry.dialog.overflow <= 2, 'Accounts content stays inside dialog');}
}
async function detail(page, result, label, selectors, pattern) {
 const saved = await page.evaluate(() => ({x: scrollX, y: scrollY, dialog: document.querySelector('#modal').scrollTop}));
 let scrollState;
 try {
  // Helper-local references also work after a genuine, uninstrumented reload.
  // Never reinstall the provider gate just to frame or restore a screenshot.
  scrollState=await page.evaluateHandle(selectors=>{
   const nodes=selectors.map(selector=>{const node=document.querySelector(selector);if(!node)throw Error('Missing detail target: '+selector);return node;});
   const union=()=>{const rects=nodes.map(node=>node.getBoundingClientRect());return {top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))};};
   const containers=[];for(let node=nodes[0].parentElement;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){if(nodes.every(target=>node.contains(target))&&/(?:auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight)containers.push(node);}
   const scrolls=containers.map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
   const changes=[];
   // Center the whole requested range, not just its first already-visible dt.
   // Scroll real containers only; never resize, restyle, crop or hide content.
   for(const node of containers){const range=union(),rect=node.getBoundingClientRect(),top=rect.top+node.clientTop,bottom=top+node.clientHeight,before=node.scrollTop;node.scrollTop+=((range.top+range.bottom)-(top+bottom))/2;changes.push({container:node.id?'#'+node.id:node.tagName.toLowerCase(),before,after:node.scrollTop,clientHeight:node.clientHeight,rangeHeight:range.bottom-range.top});}
   const modal=document.querySelector('#modal[open]');if(!modal||!nodes.every(node=>modal.contains(node))){const range=union(),before=scrollY;scrollTo({left:scrollX,top:scrollY+(range.top+range.bottom-innerHeight)/2,behavior:'instant'});changes.push({container:'document',before,after:scrollY,clientHeight:innerHeight,rangeHeight:range.bottom-range.top});}
   return {changes,scrolls};
  },selectors);
  const framing=await scrollState.evaluate(state=>state.changes);await frames(page);
  const targets = await page.evaluate(selectors => selectors.map(selector => {const el = document.querySelector(selector), r = el.getBoundingClientRect(), style = getComputedStyle(el); return {selector, text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, visible: style.display !== 'none' && style.visibility !== 'hidden', viewport: {width: innerWidth, height: innerHeight}};}), selectors);
  // Preserve measured targets even if an assertion below fails, so a failure
  // report identifies every requested edge instead of losing the failing range.
  (result.details??=[]).push({label,targets,framing});
  for (const target of targets) {
   assert.ok(target.visible && target.width > 0 && target.height > 0, label + ' target rendered');
   assert.ok(target.left >= -1 && target.right <= target.viewport.width + 1 && target.top >= -1 && target.bottom <= target.viewport.height + 1, label + ': ' + target.selector + ' fully in screenshot');
  }
  if (pattern) assert.match(targets.map(target => target.text).join('\n'), pattern);
  await capture(page, result, label);
 } finally {
  try {
   if(scrollState)await scrollState.evaluate(state=>{for(const {node,top,left}of state.scrolls)if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}});
  } finally {
   try {await page.evaluate(saved=>{document.querySelector('#modal').scrollTop=saved.dialog;scrollTo(saved.x,saved.y);},saved);}
   finally {await scrollState?.dispose();}
  }
 }
}
async function pointer(page, selector, clickCount = 1) {
 const locator = page.locator(selector); if (!await locator.isVisible()) return;
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount, delay: 20});
}
async function fill(page, name, value) {const input = page.locator('#modal [name="' + name + '"]'); await input.fill(String(value)); await input.blur();}
async function formWalk(page,result,label){
 const geometry=await page.locator('#modal').evaluate(el=>({height:el.clientHeight,total:el.scrollHeight,top:el.scrollTop}));
 const step=Math.max(1,geometry.height-90),max=Math.max(0,geometry.total-geometry.height),positions=[];for(let top=0;top<max;top+=step)positions.push(top);positions.push(max);
 const coverage=[];
 try{for(const[index,top]of positions.entries()){await page.locator('#modal').evaluate((el,top)=>{el.scrollTop=top;},top);await capture(page,result,label+'-'+(index+1));coverage.push(await page.locator('#modal').evaluate(el=>({top:el.scrollTop,bottom:el.scrollTop+el.clientHeight,total:el.scrollHeight})));}}
 finally{await page.locator('#modal').evaluate((el,top)=>{el.scrollTop=top;},geometry.top);}
 assert.equal(coverage[0].top,0);assert.ok(coverage.at(-1).bottom>=geometry.total-1);for(let i=1;i<coverage.length;i++)assert.ok(coverage[i].top<=coverage[i-1].bottom-50,'Full viewport walk overlaps, so no form content is cropped away');
 (result.formWalks??=[]).push({label,geometry,coverage});
}
async function fillTerms(page,scenario){
 if(['bundle','rate'].includes(scenario.operation)){
  if(!scenario.selected)await action(page,'expenses-all').click();else for(const kind of expenseKinds)await page.locator('#modal [name="include-'+kind+'"]').setChecked(scenario.selected.includes(kind));
  for(const[name,value]of Object.entries(fieldValues(scenario))){const control=page.locator('#modal [name="'+name+'"]');if(await control.isDisabled())continue;if(await control.evaluate(el=>el.tagName==='SELECT'))await control.selectOption(value);else await fill(page,name,value);}
  if(scenario.supplier)await page.locator('#modal [name="otherSupplier"]').check();
 }else for(const[name,value]of Object.entries(fieldValues(scenario)))await fill(page,name,value);
}
async function openFirst(page,result,scenario,before){
 await tab(page,scenario.map?'Overview':'Accounts');
 const name=['bundle','rate'].includes(scenario.operation)?'ship-expenses':scenario.operation==='manual'?'expense':'bank-correct';
 if(scenario.map)await page.evaluate(name=>accountsGate.dispatch(name),name);else await action(page,name).click();
 await page.locator('#modal-title').filter({hasText:new RegExp('^'+firstTitle(scenario)+'$')}).waitFor();
 if(detailedSuccess(scenario)&&['bundle','rate'].includes(scenario.operation))await detail(page,result,'initial-selection',['#modal-title','#modal [name="include-berthing"]']);
 await fillTerms(page,scenario);assert.deepEqual(await read(page),before);assert.equal((await gate(page)).totalCalls,0);
 await page.evaluate(()=>{const g=accountsGate;g.firstSubmit=document.querySelector('#modal-form').onsubmit;g.firstForm=document.querySelector('#modal-form');g.firstFields=[...document.querySelectorAll('#modal-body input,#modal-body select')];g.rate=document.querySelector('#modal [data-action="berthing-rate"]');g.firstValues=g.semantic().form;});
 if(detailedSuccess(scenario)){if(scenario.operation==='bundle')await formWalk(page,result,'complete-selected-first-form');else if(scenario.operation==='rate')await detail(page,result,'rate-selection-terms',['#modal [name="weeks"]','#modal [data-action="berthing-rate"]']);else await formWalk(page,result,'manual-correction-accepted-form');}
}
async function acceptPreview(page,result,scenario,before){
 if(scenario.operation!=='bundle')return;const bytes=await raw(page),dice=await page.evaluate(()=>accountsDiceCalls);await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm ship expenses$/}).waitFor();await frames(page);
 assert.equal(await raw(page),bytes,'Preview is exactly unwritten');assert.equal((await gate(page)).totalCalls,0);assert.equal(await page.evaluate(()=>accountsDiceCalls),dice);assert.deepEqual(S.jumpUndoEligibility(await read(page)),S.jumpUndoEligibility(before),'Preview does not close prior jump mulligan');
 const review=await page.locator('#modal-body').innerHTML();await page.evaluate(()=>{const g=accountsGate;for(const c of g.firstFields){if(c.name==='salary')c.value='999999';if(c.type==='checkbox')c.checked=false;}void g.firstSubmit({preventDefault(){},currentTarget:g.firstForm});});await frames(page);assert.equal(await page.locator('#modal-body').innerHTML(),review,'Detached first fields and captured callback cannot change accepted bundle terms');assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);
 if(detailedSuccess(scenario)){
  await formWalk(page,result,'complete-accepted-bundle-review');
  const summary=page.locator('#modal-body > details').filter({hasText:'Mortgage payment calculation'}).locator('summary').first();await summary.click();
  const installments=page.locator('#modal-body .covered-payments').first();await installments.locator('summary').click();await installments.locator('tbody tr').nth(1).waitFor();assert.equal(await installments.locator('tbody tr').count(),2);
  await detail(page,result,'fixed-mortgage-covered-installments',['#modal-body .covered-payments[open]']);await installments.locator('summary').click();await summary.click();
 }
}
async function prepare(page,result,scenario,before,{firstOnly=false,network=null}={}){
 await openFirst(page,result,scenario,before);
 if(!firstOnly)await acceptPreview(page,result,scenario,before);
 await page.evaluate(()=>document.activeElement?.blur());await frames(page);
 if(scenario.map){const held=await network.waitHeld();assert.equal(held.released,false);await page.waitForFunction(()=>accountsMapCallbacks.loadingCacheCompleted>0&&accountsMapLoadingStatusNode===document.querySelector('#map-load-status')&&/Loading map data/.test(document.querySelector('#map-load-status')?.textContent||''));await page.evaluate(held=>{if(accountsGate.totalCalls||accountsGate.pending||accountsStorage.writes)throw Error('Map readiness precedes provider entry');accountsGate.mapReadiness=accountsGate.trace('initial-cache-ready',{heldURL:held.url,heldResponseReleased:held.released,callbacks:{...accountsMapCallbacks},status:document.querySelector('#map-load-status').textContent,statusNodeId:accountsGate.mapNodeId(accountsMapLoadingStatusNode)});},held);}
 await page.evaluate(()=>accountsGate.remember());
}
async function submit(page,scenario,{direct=false,duplicate=false}={}){
 if(direct)return page.evaluate(({rate,duplicate})=>{const g=accountsGate;if(rate){g.rate.click();if(duplicate)g.rate.click();}else{void g.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});if(duplicate)void g.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});}return {writes:accountsStorage.writes,open:document.querySelector('#modal').open,pending:!!g.pending};},{rate:scenario.operation==='rate',duplicate});
 await pointer(page,scenario.operation==='rate'?'#modal [data-action="berthing-rate"]':'#modal-submit',duplicate?2:1);
}
async function replay(page,{physical=true,navigation=true}={}){
 if(physical){for(const id of ['modal-submit','modal-cancel','modal-close'])await pointer(page,'#'+id,2);await page.keyboard.press('Enter');await page.keyboard.press('Escape');}
 await page.evaluate(navigation=>{const form=document.querySelector('#modal-form');if(accountsGate.oldSubmit)void accountsGate.oldSubmit({preventDefault(){},currentTarget:form});form.requestSubmit();accountsGate.rate?.click();if(navigation)accountsGate.replay();},navigation);await frames(page);
}
async function assertPending(page,result,scenario,bytes,before){
 if(['queued-pending','queued-settled'].includes(scenario.mode))await page.evaluate(rate=>{for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit',''],['expenses-all',''],['fuel-fill','']])accountsGate.dispatch(name,arg);if(rate)accountsGate.rate.click();else void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});},scenario.operation==='rate');else await submit(page,scenario,{duplicate:true});
 await page.waitForFunction(()=>!!accountsGate.pending);await frames(page);assert.equal(await raw(page),bytes);let snapshot=await gate(page);assertRetained(snapshot);assert.equal(snapshot.acceptedDice,snapshot.baseline.dice+(scenario.operation==='rate'?1:0));
 for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' frozen before provider entry');for(const control of await page.locator('#modal-body input,#modal-body select,#modal-body textarea,#modal-body button').all())assert.equal(await control.isDisabled(),true,'Accepted control frozen');
 await replay(page);snapshot=await gate(page);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.calls,1);assert.equal(await raw(page),bytes);assertRetained(snapshot);
 for(const forwarded of snapshot.forwarded){assert.ok(forwarded.argumentCount>=3);assert.equal(forwarded.tokenPresent,true);assert.equal(forwarded.expectedRevision,before.revision);assert.equal(forwarded.candidateRevision,before.revision+1);}
 if(scenario.mode==='deferred')await detail(page,result,'pending-before-write-controls',['#modal-cancel','#modal-submit']);
 result.checks.push('Exactly one provider entry; accepted fields/Close/X/Enter/Escape/direct stale submit/queued actions remain frozen; native independent durable baseline');
}
async function reloadUndo(page,result,before,scenario,{committed=true}={}){
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>accountsStorage.writes),0,'Genuine reload does not repeat Accounts write');assert.equal(await page.evaluate(()=>typeof accountsGate),'undefined','No provider gate is reinstalled after reload');
 if(!committed){assert.deepEqual(await read(page),before);return;}
 const saved=await read(page);assertSaved(saved,before,scenario);await tab(page,'Accounts');if(detailedSuccess(scenario))await detail(page,result,'reload-current-balance',['#main .panel-body > .preview > dl > dt:nth-of-type(3)','#main .panel-body > .preview > dl > dd:nth-of-type(3)'],/Current balance/);
 await tab(page,'History');await action(page,'undo').click();await closed(page);await frames(page);assert.deepEqual(normalize(await read(page)),normalize(S.undo(saved)),'Genuine History Undo equals complete original inverse transition');assert.deepEqual(material(await read(page)),material(before));assert.equal((await read(page)).revision,before.revision+2);assert.equal(await page.evaluate(()=>accountsStorage.writes),1);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,false);
 if(detailedSuccess(scenario))await detail(page,result,'history-undo-one-atomic-transition',['#message'],/^Latest action undone\.$/);
 result.checks.push('Genuine uninstrumented reload, exact History Undo, one atomic revision/batch and permanently closed prior jump mulligan');
}
async function successful(page,result,before,scenario,{reload=true}={}){
 if(scenario.operation!=='rate')await closed(page);else await page.waitForFunction(()=>!document.querySelector('#modal [data-action="berthing-rate"]')&&document.querySelector('#modal-submit').disabled===false);await frames(page);
 const saved=await read(page);assertSaved(saved,before,scenario);const snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates.at(-1));assert.equal(snapshot.storage.writes,1);assert.equal(snapshot.durableToken,false);assert.equal(snapshot.reloadRequired,false);assert.equal(await page.locator('#message').textContent(),transitionLabel(scenario,before)+' saved.');assert.equal(snapshot.semantic.dice,snapshot.baseline.dice+(scenario.operation==='rate'?1:0));
 assert.equal(snapshot.publications.filter(p=>p.tokenMatches&&p.snapshotMatches&&p.actualCallback).length,1);assert.ok(snapshot.readChecks.every(c=>c.exactDurableCopy&&!c.aliasesLive));for(const observation of [...snapshot.observations,...snapshot.storage.observations])assert.equal(observation.message,snapshot.baseline.message,'No success report before actual settlement');
 result.economicEvidence={beforeSHA256:hash(JSON.stringify(before)),savedSHA256:hash(JSON.stringify(saved)),bank:saved.bank,hours:saved.hours,fuel:saved.ship.fuel??null,physicalStock:saved.ship.lifeSupport,ledgerCount:saved.ledger.length,ledgerSHA256:hash(JSON.stringify(saved.ledger)),eventsSHA256:hash(JSON.stringify(saved.events)),undoCount:saved.undo.length,mortgage:saved.ship.mortgage,maintenance:saved.ship.maintenance};
 const bytes=await raw(page),calls=snapshot.totalCalls;
 await page.evaluate(()=>{void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void accountsGate.firstSubmit?.({preventDefault(){},currentTarget:accountsGate.firstForm});accountsGate.rate?.click();});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 if(scenario.operation==='rate'){
  assert.equal(await page.locator('#modal-title').textContent(),'Ship expenses');assert.equal(await page.evaluate(()=>document.querySelector('#modal-form')===accountsGate.firstForm),true,'Rate success retains the exact form DOM');assert.deepEqual(await page.evaluate(()=>accountsGate.semantic().form),snapshot.baseline.form,'All entered values and selections survive rate completion');assert.equal(await page.locator('#modal-form').evaluate(form=>form.onsubmit!==accountsGate.firstSubmit),true,'Fresh post-rate submit authority is rebound');
  await detail(page,result,'saved-inline-rate-quote',['#expense-estimate > .scroll','#expense-estimate > .preview > dl'],/Combined total/);
  if(detailedSuccess(scenario))await detail(page,result,'saved-rate-fresh-preview-controls',['#modal-cancel','#modal-submit']);
  await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),bytes,'Cancel after rate leaves its separate saved transition intact');
 }else await detail(page,result,'saved-success-status',['#message'],successPattern);
 if(detailedSuccess(scenario)){
  await tab(page,'Accounts');const added=saved.ledger.slice(before.ledger.length),visible=added.filter(e=>BigInt(e.amount)!==0n);for(const e of visible)assert.equal(await page.locator('[data-action="ledger-audit"][data-arg="'+e.id+'"]').count(),1);
  if(visible.length){await action(page,'ledger-audit',visible.at(-1).id).click();await page.locator('#modal-title').filter({hasText:/details$/i}).waitFor();await formWalk(page,result,'saved-ledger-details');await pointer(page,'#modal-cancel');await closed(page);}
  await detail(page,result,'exact-current-balance',['#main .panel-body > .preview > dl > dt:nth-of-type(3)','#main .panel-body > .preview > dl > dd:nth-of-type(3)'],/Current balance/);assert.ok((await page.locator('#summary .stat:last-child').textContent()).includes(formatCreditsText(saved.bank)));await detail(page,result,'exact-huge-credits',['#summary .stat:last-child'],/Credits/);
  await tab(page,'Overview');assert.equal(await page.locator('#ship-actions .campaign-time .value').textContent(),displayDate(saved.dateLabel,saved.hours));await detail(page,result,'unchanged-time-and-stock',['#ship-actions .campaign-time .value']);
 }
 assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.gate=safeReport(await gate(page));if(reload)await reloadUndo(page,result,before,scenario);
}
async function terminal(page,result,before,scenario,{committed,unknown=false}={}){
 await page.waitForFunction(()=>/Reload/.test(document.querySelector('#save-status').textContent));await frames(page);const snapshot=await gate(page),guidance=await page.locator('#save-status').textContent();
 assert.match(guidance,unknown?/save outcome could not be confirmed[\s\S]*Reload/:/saved, but the display could not update[\s\S]*Reload/);if(scenario.mode!=='terminal-report')assert.equal(await page.locator('#message').textContent(),guidance);assert.equal(snapshot.reloadRequired,true);assert.equal(snapshot.editable,false);assert.equal(await page.locator('#takeover').isDisabled(),true);
 if(committed)assertSaved(await read(page),before,scenario);else assert.deepEqual(await read(page),before);
 if(await page.locator('#modal').evaluate(el=>el.open)){assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#modal-error').textContent(),guidance);await detail(page,result,'terminal-reload-warning',['#modal-error']);await detail(page,result,'terminal-dismissal-controls',['#modal-cancel','#modal-submit']);await pointer(page,'#modal-cancel');await closed(page);}else await detail(page,result,'terminal-reload-status',['#save-status']);
 const bytes=await raw(page);await replay(page,{physical:false,navigation:false});assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);
 await page.waitForFunction(async lock=>(await navigator.locks.query()).held.every(entry=>entry.name!==lock),LOCK);assert.equal(await page.evaluate(lock=>navigator.locks.request(lock,{ifAvailable:true},held=>!!held),LOCK),true);await page.evaluate(()=>{accountsGate.store.yield();accountsGate.store.onChange(accountsGate.store.read());});await frames(page);assert.equal((await gate(page)).reloadRequired,true);assert.equal(await page.locator('#save-status').textContent(),guidance);
 result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario,{committed});result.checks.push('Saved/unknown-specific reload guard survives reporting, editor yield and later callbacks; native lock released and no replay write');
}

async function peerTakeover(page, result, context, {write = false, regain = false} = {}) {
 const peer = await context.newPage(); await peer.goto(new URL('verification/accounts-peer.html', base).href);
 await peer.evaluate(async ({storeURL}) => {const {Store} = await import(storeURL); globalThis.accountsPeer = {state: null, editable: false}; accountsPeer.store = new Store(next => {accountsPeer.state = next;}, editable => {accountsPeer.editable = editable;}); await accountsPeer.store.acquire(true);}, result.runtime);
 await peer.waitForFunction(() => accountsPeer.editable); await page.waitForFunction(() => accountsGate.store.editable === false);
 if (write) {
  const revision = await peer.evaluate(async ({storeURL}) => {const url = new URL('state.mjs', storeURL); url.search = new URL(storeURL).search; const S = await import(url.href); const next = S.transition(accountsPeer.state, 'Foreign deposit during accounts save', s => S.deposit(s, 7, 'Synthetic peer')); accountsPeer.store.save(next, accountsPeer.state.revision); return accountsPeer.state.revision;}, result.runtime);
  await page.waitForFunction(({key, revision}) => JSON.parse(localStorage.getItem(key)).revision === revision, {key: KEY, revision});
 }
 await peer.evaluate(() => {accountsPeer.store.yield(); accountsPeer.store.channel?.close();}); await peer.close();
 if (regain) {await page.evaluate(() => accountsGate.store.acquire(true)); await page.waitForFunction(() => accountsGate.store.editable);}
 result.checks.push('Second version-tagged native Store takes actual Web Lock' + (write ? ' and publishes newer durable revision' : '') + (regain ? '; ownership is not revived by regain' : ''));
}
async function verifyNewerNotes(page,result){
 const bytes=await raw(page),calls=(await gate(page)).totalCalls;
 const before=await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent}));
 const handlers=await page.evaluate(()=>({submit:document.querySelector('#modal-form').onsubmit===accountsGate.newerSubmit,close:document.querySelector('#modal-cancel').onclick===accountsGate.newerClose,submitCallable:typeof accountsGate.newerSubmit==='function',closeCallable:typeof accountsGate.newerClose==='function'}));assert.deepEqual(handlers,{submit:true,close:true,submitCallable:true,closeCallable:true});
 await page.evaluate(()=>{void accountsGate.newerSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});document.querySelector('#modal-form').requestSubmit();});await frames(page);
 assert.deepEqual(await page.evaluate(()=>({title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent})),before);assert.equal(await page.locator('#modal-submit').isHidden(),true);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);
 await page.evaluate(()=>accountsGate.newerClose.call(document.querySelector('#modal-cancel')));await closed(page);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,calls);result.newerNotesHandlers=handlers;result.checks.push('Actual newer Notes handler identities survive old settlement and detached replay; captured Notes submit remains read-only and captured Close dismisses without writes');
}
async function resizeProbe(page, result, {frozen = false, resume = false} = {}) {
 const before = await page.evaluate(() => ({snapshot: accountsGate.mapCapture('before-resize'), callbacks: {...accountsMapCallbacks}}));
 await page.evaluate(() => {accountsGate.phase = 'resize';}); await page.setViewportSize({...result.viewport, width: result.viewport.width + 17});
 await page.waitForFunction(previous => accountsMapCallbacks.resizeDelivered > previous.resizeDelivered && accountsMapCallbacks.executed > previous.executed, before.callbacks); await frames(page);
 const after = await page.evaluate(() => accountsGate.mapCapture('after-resize'));
 if (frozen) assert.deepEqual(after.regions, (await gate(page)).mapBaseline.regions, 'Real resize callback preserves exact SVG/status/review markup and node identity');
 if (resume) assert.notEqual(after.regions[0].nodeId, before.snapshot.regions[0].nodeId, 'Actual map paints resume after settlement or foreign ownership');
 await page.setViewportSize(result.viewport); await frames(page);
 result.checks.push('Observed real ResizeObserver → rAF → paintMap ' + (frozen ? 'with strict DOM identity retained' : 'repainting normally'));
}
async function mapPublication(page, result, scenario, before, context) {
 const held = await context.accountsNetwork.waitHeld(); assert.equal(held.released, false, 'Original response remains held through native publication');
 const setup = await gate(page), provider = setup.timeline.find(entry => entry.event === 'provider-invoked');
 assert.equal(setup.timelineDropped, 0); assert.ok(setup.mapReadiness.callbacks.loadingCacheCompleted > 0);
 const initialPaint = setup.timeline.findLast(entry => entry.event === 'map-paint-completed' && entry.cache && !entry.pending && entry.statusNodeId === setup.mapReadiness.statusNodeId && /Loading map data/.test(entry.status || '') && entry.order < setup.mapReadiness.order);
 assert.ok(initialPaint, 'Current mounted status node has an observed completed initial cache-loading callback before readiness');
 assert.ok(setup.mapReadiness.order < setup.retainedBaselineOrder.order && setup.retainedBaselineOrder.order < provider.order, 'Observed initial cache completion precedes retained baseline, then provider invocation');
 assert.equal(setup.retainedBaselineOrder.mapStatus, setup.mapReadiness.status); assert.equal(setup.retainedBaselineOrder.mapStatusNodeId, setup.mapReadiness.statusNodeId); assert.equal(provider.mapStatusNodeId, setup.mapReadiness.statusNodeId, 'Readiness belongs to the currently mounted status node through provider entry');
 await page.evaluate(() => {accountsGate.beginStrict(); accountsGate.phase='prewrite-resize';});
 await resizeProbe(page,result,{frozen:true});assert.deepEqual(await read(page),before,'Actual prewrite RO/rAF cannot execute the held Store callback');assertRetained(await gate(page));assert.equal((await gate(page)).mutationCount,0,'Strict prewrite presentation retains every visible DOM/map/status region');
 await page.evaluate(()=>accountsGate.write());await frames(page);assertSaved(await read(page),before,scenario);
 const baseline = (await gate(page)).mapBaseline;
 for (const region of baseline.regions) assert.ok(region.nodeId && region.html, 'Mounted strict map region: ' + region.selector);
 const callbacks = (await gate(page)).callbacks; await page.evaluate(() => {accountsGate.phase = 'cache-response'; accountsGate.trace('held-cache-release-requested');}); context.accountsNetwork.release();
 await page.waitForFunction(n => accountsMapCallbacks.cacheCompleted > n, callbacks.cacheCompleted); await frames(page);
 assert.deepEqual((await page.evaluate(() => accountsGate.mapCapture('after-cache'))).regions, baseline.regions, 'Actual cache callback preserves DOM and SVG');
 await resizeProbe(page, result, {frozen: true}); const snapshot = await gate(page);
 assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && edge.cache), 'Real cache after-edge executed'); assert.ok(snapshot.paintEdges.some(edge => edge.edge === 'after' && !edge.cache && edge.phase === 'resize'), 'Real resize after-edge executed');
 assert.equal(snapshot.paintEdgesDropped, 0); assert.equal(snapshot.mutationCount, 0, 'No transient SVG/panel/summary/status mutation');
 const publication = snapshot.timeline.find(entry => entry.event === 'publication-delivered' && entry.tokenMatches), cacheRelease = snapshot.timeline.find(entry => entry.event === 'held-cache-release-requested'), cacheCompletion = snapshot.timeline.find(entry => entry.event === 'map-paint-completed' && entry.cache && entry.writeExecuted && entry.order > cacheRelease.order);
 assert.ok(publication && cacheCompletion && publication.order < cacheRelease.order && cacheRelease.order < cacheCompletion.order, 'Owned publication precedes held HTTP release and actual completed cache callback');
 assert.equal(snapshot.timelineDropped, 0);
 for (const edge of snapshot.paintEdges) {assert.equal(edge.pending, true); assert.equal(edge.settlements, baseline.settlements); assert.deepEqual(edge.regions, baseline.regions);}
 await detail(page, result, 'map-publication-held-controls', ['#modal-cancel', '#modal-submit']);
 await page.evaluate(() => accountsGate.endStrict());
 if (scenario.mode === 'map-foreign') {
  await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, newValue: localStorage.getItem(key)})), KEY); await frames(page);
  await resizeProbe(page,result,{resume:true});await release(page);await frames(page);assertSaved(await read(page),before,scenario);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern,'Retired owner cannot publish clean success');await terminal(page,result,before,scenario,{committed:true});
 } else {await release(page); await closed(page); await frames(page); assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Overview');await resizeProbe(page,result,{resume:true}); await successful(page,result,before,scenario);}
 result.checks.push('Actual held MapAreaCache HTTP completion and RO/rAF callbacks execute under strict freeze, then correct owned or foreign repaint resumes');
}
async function nearbyRefresh(page,result,scenario,before,context){
 const held=await context.accountsNearbyNetwork.waitHeld(),bytes=await raw(page),baseline=await gate(page),parsed=baseline.nearbyResponses.length;assert.equal(held.released,false);
 if(scenario.nearbyStage!=='review'){await page.evaluate(()=>{accountsGate.armed=true;});await assertPending(page,result,scenario,bytes,before);await page.evaluate(()=>accountsGate.beginStrict());if(scenario.nearbyStage==='publication'){await page.evaluate(()=>accountsGate.write());await frames(page);assertSaved(await read(page),before,scenario);}}
 else await page.evaluate(()=>{const g=accountsGate;g.nearbyReview={form:document.querySelector('#modal-form'),html:document.querySelector('#modal-form').innerHTML,submit:document.querySelector('#modal-form').onsubmit,mutations:0};g.nearbyReview.observer=new MutationObserver(records=>{g.nearbyReview.mutations+=records.length;});g.nearbyReview.observer.observe(g.nearbyReview.form,{subtree:true,attributes:true,childList:true,characterData:true});});
 const responseBytes=await raw(page);context.accountsNearbyNetwork.release();await page.waitForFunction(n=>accountsNearbyResponses.length>n,parsed);await frames(page);const after=await gate(page),response=after.nearbyResponses.at(-1);assert.equal(response.url,held.url);assert.deepEqual(response.worldIds,['3,1']);assert.equal(await raw(page),responseBytes);result.nearbyContinuation={stage:scenario.nearbyStage,response,readOnlyDurableBytes:true};
 if(scenario.nearbyStage==='review'){
  const retained=await page.evaluate(()=>{const r=accountsGate.nearbyReview;r.observer.disconnect();return {sameForm:document.querySelector('#modal-form')===r.form,sameHTML:r.form.innerHTML===r.html,sameSubmit:r.form.onsubmit===r.submit,mutations:r.mutations};});assert.deepEqual(retained,{sameForm:true,sameHTML:true,sameSubmit:true,mutations:0});assert.equal(after.totalCalls,0);
  await page.evaluate(()=>{accountsGate.remember();accountsGate.armed=true;});await assertPending(page,result,scenario,bytes,before);
 }else{assertRetained(after);assert.equal(after.mutationCount,0);assert.deepEqual((await page.evaluate(()=>accountsGate.mapCapture('actual-nearby-completed'))).regions,after.mapBaseline.regions);assert.equal(response.pending,true);assert.equal(response.writeExecuted,scenario.nearbyStage==='publication');await page.evaluate(()=>accountsGate.endStrict());}
 await release(page);await successful(page,result,before,scenario,{reload:false});
 // A new ordinary manual-contract selector proves that the actual known-world
 // continuation consumed the held response; merely observing HTTP is not enough.
 const savedBytes=await raw(page),calls=(await gate(page)).totalCalls,dice=await page.evaluate(()=>accountsDiceCalls);await page.evaluate(()=>accountsGate.dispatch('contract-manual'));await page.locator('#modal-title').filter({hasText:'Manual transport contract'}).waitFor();assert.equal(await page.locator('#modal [name="destination"] option[value="3,1"]').count(),1);await detail(page,result,'actual-nearby-world-in-new-selector',['#modal [name="destination"]']);await pointer(page,'#modal-cancel');await closed(page);assert.equal(await raw(page),savedBytes);assert.equal((await gate(page)).totalCalls,calls);assert.equal(await page.evaluate(()=>accountsDiceCalls),dice);result.gate=safeReport(await gate(page));await reloadUndo(page,result,before,scenario);
 result.checks.push('Actual boot refreshNearby response and continuation at '+scenario.nearbyStage+' preserve owned terms/DOM, never consume dice or write, and enrich a real later world selector');
}
async function rememberNotes(page){await page.evaluate(()=>{const g=accountsGate;g.newer={title:document.querySelector('#modal-title').textContent,body:document.querySelector('#modal-body').innerHTML,error:document.querySelector('#modal-error').textContent};g.newerSubmit=document.querySelector('#modal-form').onsubmit;g.newerClose=document.querySelector('#modal-cancel').onclick;});}
async function retired(page,result,before,scenario,context){
 const mode=scenario.mode;
 if(mode==='foreign-same')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
 if(mode==='foreign-new')await peerTakeover(page,result,context,{write:true});if(mode==='editor-regain')await peerTakeover(page,result,context,{regain:true});
 if(['native-close','new-dialog'].includes(mode)){await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});await frames(page);if(mode==='new-dialog'){await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);}}
 const authoritative=await raw(page);await release(page);await frames(page);
 if(mode==='foreign-new'){assert.equal(await raw(page),authoritative);assert.equal((await read(page)).bank,String(BigInt(before.bank)+BigInt(normalizeAmount('7',{unit:'credits',creditStep:before.settings.creditStep}).value)));assert.equal((await gate(page)).settlements.at(-1).code,'SAVE_NOT_COMMITTED');}else assertSaved(await read(page),before,scenario);
 const snapshot=await gate(page);if(['foreign-same','editor-regain','consumed-token'].includes(mode)){assert.equal(snapshot.reloadRequired,true);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);await detail(page,result,'saved-retired-form-reload',['#modal-error'],/saved[\s\S]*Reload/);result.gate=safeReport(snapshot);return reloadUndo(page,result,before,scenario);}assert.equal(await page.locator('#message').textContent(),snapshot.baseline.message,'Retired owner cannot announce success');if(mode==='native-close')assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
 if(mode==='new-dialog'){assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);assert.equal(await page.locator('#modal-error').textContent(),snapshot.newer.error);await detail(page,result,'newer-notes-retained',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);}else if(await page.locator('#modal').evaluate(el=>el.open))await detail(page,result,'retired-owner-warning',['#modal-error']);else await capture(page,result,'retired-closed-owner');
 const bytes=await raw(page);await page.evaluate(()=>{void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});accountsGate.rate?.click();});await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);result.gate=safeReport(await gate(page));if(mode==='foreign-new'){await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),bytes);}else await reloadUndo(page,result,before,scenario);
}
async function stageOwnership(page,result,scenario,before,context){
 const bytes=await raw(page),pending=scenario.stage==='settlement';await prepare(page,result,scenario,before,{firstOnly:scenario.stage==='first'});if(pending){await page.evaluate(()=>{accountsGate.armed=true;});await assertPending(page,result,scenario,bytes,before);}
 if(['cancel','replacement'].includes(scenario.drift)){if(pending)await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});else await pointer(page,'#modal-cancel');await closed(page);if(scenario.drift==='replacement'){await page.locator('#notes').click();await page.locator('#modal-title').filter({hasText:'Rules & Notes'}).waitFor();await rememberNotes(page);}}
 else if(scenario.drift==='foreign')await page.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
 else if(scenario.drift==='editor-regain')await peerTakeover(page,result,context,{regain:true});
 else if(scenario.drift==='selection'){await page.evaluate(()=>accountsGate.dispatch('world','2,1'));await frames(page);}
 else if(scenario.drift==='terms')await page.evaluate(()=>{accountsGate.lastState.ship.accommodation.roomService.middle.monthly='9000';});
 if(pending){await release(page);await frames(page);assertSaved(await read(page),before,scenario);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern,'Retired owner cannot publish clean success');}else{await page.evaluate(()=>{const g=accountsGate;void g.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void g.firstSubmit({preventDefault(){},currentTarget:g.firstForm});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(scenario.drift==='replacement'){assert.equal(await page.locator('#modal-body').innerHTML(),(await gate(page)).newer.body);await detail(page,result,'newer-notes-'+scenario.stage,['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);}else if(await page.locator('#modal').evaluate(el=>el.open))await detail(page,result,'retired-'+scenario.stage,['#modal-title']);else await capture(page,result,'closed-'+scenario.stage);
 result.gate=safeReport(await gate(page));if(pending)await reloadUndo(page,result,before,scenario);
}
async function constructionReentry(page,result,scenario,before,{handoff=false}={}){
 if(handoff)await prepare(page,result,scenario,before,{firstOnly:true});else await tab(page,'Accounts');const bytes=await raw(page);
 await page.evaluate(point=>{if(point==='normalization'){accountsGate.normalizationFault='reentry';accountsGate.normalizationAfter=2;accountsGate.probePendingNormalization=true;}else accountsGate.constructionFault=point;},scenario.point);
 if(handoff)await pointer(page,'#modal-submit');else await action(page,['bundle','rate'].includes(scenario.operation)?'ship-expenses':scenario.operation==='manual'?'expense':'bank-correct').click();
 await page.locator('#modal-title').filter({hasText:/^Rules & Notes$/}).waitFor();await frames(page);let snapshot=await gate(page);assert.equal(snapshot.totalCalls,0);assert.equal(await raw(page),bytes);assert.equal(snapshot.constructionChecks.length,1);assert.equal(snapshot.constructionChecks[0].handlerChanged,true);
 if(scenario.point==='normalization'){
  const [first,second]=snapshot.normalizationChecks;assert.equal(snapshot.normalizationChecks.length,2,'Both exact normalization boundaries must be reached');
  for(const check of [first,second]){assert.equal(check.open,true);assert.equal(check.sameFirstForm,true);assert.equal(check.providerPending,false);assert.equal(check.totalCalls,0);assert.equal(check.writes,0);assert.equal(check.dice,0);}
  assert.equal(first.call,1);assert.equal(first.title,'Ship expenses');assert.equal(first.sameFirstSubmit,true);for(const key of ['notesBlocked','sameBody','sameHandler','sameOpen','sameDurableBytes'])assert.equal(first[key],true,key);assert.ok(first.controls.every(control=>control.disabled),'First normalization already owns pending controls');
  assert.equal(second.call,2);assert.equal(second.title,'Confirm ship expenses');assert.equal(second.sameFirstSubmit,false);assert.ok(second.controls.every(control=>!control.disabled),'Fresh confirmation construction has independent unlocked chrome');assert.ok(first.order<second.order&&second.order<snapshot.constructionChecks[0].order);assert.equal(snapshot.constructionChecks[0].point,'normalization');
  result.checks.push('First accepted-submit normalization blocks actual Notes click without changing DOM/handler/bytes; second normalization demonstrably belongs to fresh Confirm ship expenses construction and is replaced by newer Notes');
 }
 if(handoff)await page.evaluate(()=>{void accountsGate.firstSubmit({preventDefault(){},currentTarget:accountsGate.firstForm});});await frames(page);snapshot=await gate(page);assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);await detail(page,result,'newer-notes-owns-construction',['#modal-body .notes-list article:first-child'],/Rules and verification/);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));
}
async function contextDrift(page,result,scenario,before){
 const bytes=await raw(page);await page.evaluate(drift=>{const g=accountsGate,s=g.lastState;if(drift==='hours')s.hours++;if(drift==='actual')s.actual='2,1';if(drift==='world')s.worlds[s.actual].uwp='B788879-C';if(drift==='ship')s.ship.accommodation.rooms.middle++;if(drift==='settings')s.settings.creditStep=1;if(drift==='history')s.events.push({id:'context-drift',label:'Synthetic same-revision drift',hours:s.hours});if(drift==='form'){const old=document.querySelector('#modal-form');g.replacedForm=old;old.replaceWith(old.cloneNode(true));}if(drift==='control'){const old=document.querySelector('#modal [name]');if(!old)throw Error('Named control required');old.replaceWith(old.cloneNode(true));}},scenario.drift);
 if(['form','control'].includes(scenario.drift))await page.evaluate(()=>{void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});accountsGate.rate?.click();});else await submit(page,scenario,{direct:true});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await detail(page,result,'same-revision-'+scenario.drift+'-retired',['#modal-title']);result.gate=safeReport(await gate(page));
}
async function entryFault(page,result,scenario,before){
 await prepare(page,result,scenario,before,{firstOnly:scenario.operation==='bundle'&&['normalization','form-data'].includes(scenario.fault)});const bytes=await raw(page);await page.evaluate(fault=>{if(fault==='controls')accountsGate.entryFault='modal-submit';else if(fault==='form-data')accountsGate.formDataFault=true;else if(fault==='durable-read')accountsGate.readFault=true;else accountsGate.normalizationFault='throw';},scenario.fault);
 // The inline rate deliberately does not enter normalization. Its paired case
 // injects an independent Store.read fault before the die, not a FormData fault.
 await submit(page,scenario,{direct:true});await frames(page);const snapshot=await gate(page);assert.equal(snapshot.totalCalls,0);assert.equal(snapshot.pending,false);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>accountsDiceCalls),0);await detail(page,result,'unwritten-entry-fault',['#modal-error']);await page.evaluate(()=>{accountsGate.readFault=false;});result.gate=safeReport(await gate(page));
}
async function earlyDurable(page,result,scenario,before){
 await prepare(page,result,scenario,before,{firstOnly:true});await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);const bytes=await raw(page);await pointer(page,'#modal-submit');await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);assert.notEqual(await page.locator('#modal-title').textContent(),'Confirm ship expenses');await detail(page,result,'pre-preview-durable-drift',['#modal-error'],/changed|not saved|Reload/i);result.gate=safeReport(await gate(page));
}
async function rateChain(page,result,scenario,before,{alreadyPending=false}={}){
 const rateSaved=await read(page);assertSaved(rateSaved,before,{...scenario,operation:'rate'});const bundleScenario={...scenario,operation:'bundle',mode:'native',id:'rate-following-payment'};
 // Rate form used exact integer values, so the next bundle has no new rounding.
 bundleScenario.fuelTons='11';bundleScenario.salary='12400';
 if(!alreadyPending){await page.locator('#modal-submit').waitFor({state:'visible'});assert.equal(await page.locator('#modal-submit').isEnabled(),true);await pointer(page,'#modal-submit');await page.locator('#modal-title').filter({hasText:/^Confirm ship expenses$/}).waitFor();await page.evaluate(()=>{accountsGate.paymentSubmit=document.querySelector('#modal-form').onsubmit;accountsGate.paymentBaseline=accountsGate.semantic();});await pointer(page,'#modal-submit');}
 await page.waitForFunction(()=>accountsGate.pending&&accountsGate.totalCalls===2);assert.equal(await raw(page),JSON.stringify(rateSaved));
 const retained=await page.locator('#modal-body').innerHTML();await page.evaluate(()=>{void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});accountsGate.rate?.click();void accountsGate.paymentSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal((await gate(page)).totalCalls,2);assert.equal(await page.locator('#modal-body').innerHTML(),retained);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isDisabled(),true,'Rate finally cannot unlock independent next payment');await detail(page,result,'independent-payment-pending',['#modal-cancel','#modal-submit']);
 await release(page);await closed(page);await frames(page);const paid=await read(page);assertSaved(paid,rateSaved,bundleScenario);assert.equal((await gate(page)).storage.writes,2);assert.equal(await page.evaluate(()=>accountsDiceCalls),1);await detail(page,result,'rate-then-payment-success',['#message'],/Paid 7 ship expenses saved/);result.gate=safeReport(await gate(page));
 const bytes=await raw(page);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>typeof accountsGate),'undefined');await tab(page,'History');await action(page,'undo').click();await frames(page);let restored=await read(page);assert.deepEqual(normalize(restored),normalize(S.undo(paid)));assert.deepEqual(material(restored),material(rateSaved));assert.deepEqual(restored.worlds[restored.actual].berthingRate,{port:'A',die:3});await action(page,'undo').click();await frames(page);assert.deepEqual(material(await read(page)),material(before));assert.equal(S.jumpUndoEligibility(await read(page)).allowed,false);assert.equal(await page.evaluate(()=>accountsStorage.writes),2);
 result.checks.push('One retained die and one separate rate transition, fresh independent next payment, atomic bundle Undo first retaining rate, then separate rate Undo, permanent mulligan closure');
}
async function runBody(page,result,scenario,context){
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);assert.equal(await page.evaluate(()=>accountsStorage.writes),0,'Complete synthetic campaign requires no migration write');await installGate(page,result);const before=await read(page),bytes=await raw(page),mode=scenario.mode;
 if(mode==='early-durable')return earlyDurable(page,result,scenario,before);
 if(mode==='construction-reentry'||mode==='handoff-reentry')return constructionReentry(page,result,scenario,before,{handoff:mode==='handoff-reentry'});
 if(mode==='stage-ownership')return stageOwnership(page,result,scenario,before,context);
 if(mode==='entry-fault')return entryFault(page,result,scenario,before);
 if(mode==='economic'){
  await prepare(page,result,scenario,before,{firstOnly:true});
  if(scenario.invalid){if(scenario.selected?.length===0){assert.equal(await page.locator('#modal-submit').isDisabled(),true);await detail(page,result,'empty-selection-no-payment',['#expense-estimate'],/Nothing to pay/);}else{await pointer(page,'#modal-submit');await detail(page,result,'insufficient-combined-funds',['#modal-error'],/Insufficient funds/);}assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,0);assert.equal(S.jumpUndoEligibility(await read(page)).allowed,true);result.gate=safeReport(await gate(page));return;}
  if(scenario.dry)await detail(page,result,'free-water-advisory',['#fuel-availability'],/Advisory only/);if(scenario.supplier)await detail(page,result,'private-supplier-confirmed',['#modal [name="otherSupplier"]']);
  await acceptPreview(page,result,scenario,before);await page.evaluate(()=>accountsGate.remember());await submit(page,scenario,{direct:true});return successful(page,result,before,scenario);
 }
 await prepare(page,result,scenario,before,{network:context.accountsNetwork});
 if(mode==='nearby-refresh')return nearbyRefresh(page,result,scenario,before,context);
 if(mode==='moved-form'){await page.evaluate(()=>{const form=document.querySelector('#modal-form');accountsGate.originalParent=form.parentNode;document.body.append(form);void accountsGate.oldSubmit({preventDefault(){},currentTarget:form});accountsGate.rate?.click();});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>accountsDiceCalls),0);await page.evaluate(()=>accountsGate.originalParent.append(document.querySelector('#modal-form')));await detail(page,result,'moved-exact-form-cannot-save',['#modal-title']);result.gate=safeReport(await gate(page));return;}
 if(mode==='context-drift')return contextDrift(page,result,scenario,before);
 if(mode==='read-only'){await peerTakeover(page,result,context);await frames(page);assert.equal((await gate(page)).editable,false);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);await detail(page,result,'read-only-warning',['#modal-error'],/editing|ownership|changed/i);await pointer(page,'#modal-cancel');await closed(page);result.gate=safeReport(await gate(page));return;}
 if(mode==='foreign-form'){await page.evaluate(()=>{const clone=document.querySelector('#modal-form').cloneNode(true);void accountsGate.oldSubmit({preventDefault(){},currentTarget:clone});});await frames(page);assert.equal((await gate(page)).totalCalls,0);assert.equal(await raw(page),bytes);}
 if(['native','queued-settled','reentrant','foreign-form','die-reentrant'].includes(mode)){
  await page.evaluate(mode=>{accountsGate.reentrant=mode==='reentrant';accountsGate.dieReentry=mode==='die-reentrant';},mode);
  const immediate=await page.evaluate(({mode,rate})=>{const g=accountsGate;if(mode==='queued-settled')for(const[name,arg]of [['tab','Cargo'],['world','2,1'],['deposit',''],['expenses-all',''],['fuel-fill','']])g.dispatch(name,arg);if(rate){g.rate.click();g.rate.click();}else{void g.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void g.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});}return {writes:accountsStorage.writes,open:document.querySelector('#modal').open,message:document.querySelector('#message').textContent,rateConnected:g.rate?.isConnected??false};},{mode,rate:scenario.operation==='rate'});
  assert.equal(immediate.writes,1,'Native Store writes synchronously in the same callback stack');assert.equal(immediate.open,true,'Preserve original generic modal close continuation after native callback');assert.equal(immediate.message,transitionLabel(scenario,before)+' saved.','Native success announcement stays synchronous');if(scenario.operation==='rate')assert.equal(immediate.rateConnected,false,'Native inline rate handoff completes synchronously');await frames(page);assert.equal((await gate(page)).totalCalls,1);if(mode==='die-reentrant')assert.deepEqual((await gate(page)).dieReentryCheck,{before:0,after:0,dice:1});return successful(page,result,before,scenario);
 }
 await page.evaluate(mode=>{const g=accountsGate;g.armed=true;g.notifyFault=mode==='notification-before'?'before':['notification-after','controls'].includes(mode)?'after':['missing','missing-token','wrong-token','wrong-revision','wrong-candidate','consumed-token'].includes(mode)?mode:null;accountsStorage.failNext=['retry','recovery-reentry','retry-input-change'].includes(mode);g.recoveryReentry=mode==='recovery-reentry';},mode);
 await assertPending(page,result,scenario,bytes,before);
 if(scenario.map)return mapPublication(page,result,scenario,before,context);
 if(['published-disk-drift','published-disk-unreadable'].includes(mode)){
  await page.evaluate(()=>accountsGate.write());await frames(page);assertSaved(await read(page),before,scenario);const saved=await raw(page);
  if(mode==='published-disk-drift')await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key));value.bank=String(BigInt(value.bank)+7n);localStorage.setItem(key,JSON.stringify(value));},KEY);else await page.evaluate(()=>{accountsGate.readFault=true;});const authoritative=await raw(page);await release(page);await page.waitForFunction(()=>accountsGate.reloadRequired||accountsGate.store.reloadRequired);await frames(page);assert.equal(await raw(page),authoritative);assert.equal((await gate(page)).totalCalls,1);assert.equal((await gate(page)).editable,false);assert.doesNotMatch(await page.locator('#message').textContent(),successPattern);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await detail(page,result,'saved-durable-settlement-reload',['#modal-error'],/saved[\s\S]*Reload/);if(scenario.operation==='rate')assert.equal(await page.locator('#modal [data-action="berthing-rate"]').count(),1,'No partial rate handoff after postpublication durable loss');await page.evaluate(()=>{accountsGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),authoritative);if(mode==='published-disk-unreadable')assert.equal(authoritative,saved);return;
 }
 if(mode==='retired-unknown-newer'){
  await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#modal').dispatchEvent(new Event('close'));});await frames(page);await action(page,'expense').click();await page.locator('#modal-title').filter({hasText:/^Record expense$/}).waitFor();await fill(page,'amount','300');await fill(page,'reason','Genuinely newer Accounts intent');await page.evaluate(()=>{const g=accountsGate;g.newerAccounts={body:document.querySelector('#modal-body').innerHTML,submit:document.querySelector('#modal-form').onsubmit};});await release(page,'unknown-before');await page.waitForFunction(()=>accountsGate.store.reloadRequired);await frames(page);assert.equal(await raw(page),bytes);assert.equal((await gate(page)).totalCalls,1);assert.equal(await page.evaluate(()=>document.querySelector('#modal-body').innerHTML===accountsGate.newerAccounts.body&&document.querySelector('#modal-form').onsubmit===accountsGate.newerAccounts.submit),true,'Old unknown save cannot overwrite newer form or handlers');assert.equal(await page.locator('#modal-submit').isDisabled(),true);await page.evaluate(()=>{void accountsGate.newerAccounts.submit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});void accountsGate.oldSubmit({preventDefault(){},currentTarget:document.querySelector('#modal-form')});});await frames(page);assert.equal((await gate(page)).totalCalls,1);await detail(page,result,'newer-owner-form-retained',['#modal-title','#modal [name="reason"]']);await pointer(page,'#modal-cancel');await closed(page);await detail(page,result,'newer-owner-global-unknown-reload',['#save-status'],/outcome could not be confirmed[\s\S]*Reload/);result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario,{committed:false});
 }
 if(mode==='covered-details-pending'){
  const disclosure=page.locator('#modal-body > details').filter({hasText:'Mortgage payment calculation'}).first();await page.evaluate(()=>accountsGate.beginStrict());await disclosure.locator(':scope > summary').click();await frames(page);assert.equal(await disclosure.evaluate(el=>el.open),false,'Native summary default action is blocked while save owns exact review');assert.equal((await gate(page)).mutationCount,0);await page.evaluate(()=>{const details=document.querySelector('#modal-body .covered-payments');accountsGate.covered=details;accountsGate.coveredRows=details.querySelector('tbody').innerHTML;details.dispatchEvent(new Event('toggle'));});await frames(page);assert.equal(await page.evaluate(()=>accountsGate.covered.querySelector('tbody').innerHTML),await page.evaluate(()=>accountsGate.coveredRows));assert.equal((await gate(page)).mutationCount,0);await page.evaluate(()=>{accountsGate.write();});await frames(page);assertSaved(await read(page),before,scenario);assert.equal((await gate(page)).mutationCount,0);await detail(page,result,'covered-details-frozen-pending',['#modal-cancel','#modal-submit']);await page.evaluate(()=>accountsGate.endStrict());await release(page);return successful(page,result,before,scenario);
 }
 if(['foreign-same','foreign-new','editor-regain','native-close','new-dialog','consumed-token'].includes(mode))return retired(page,result,before,scenario,context);
 if(['disk-same','disk-unreadable'].includes(mode)){
  if(mode==='disk-same')await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.bank=String(BigInt(s.bank)+7n);localStorage.setItem(key,JSON.stringify(s));},KEY);else await page.evaluate(()=>{accountsGate.readFault=true;});const current=await raw(page);await release(page,'known-before');await frames(page);assert.equal(await raw(page),current);assert.equal((await gate(page)).totalCalls,1);assert.equal(await page.locator('#modal-submit').isDisabled(),true);await detail(page,result,'not-saved-durable-baseline-reload',['#modal-error'],/not saved[\s\S]*Reload/i);await replay(page,{physical:false,navigation:false});assert.equal((await gate(page)).totalCalls,1);await page.evaluate(()=>{accountsGate.readFault=false;});result.gate=safeReport(await gate(page));await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(page),current);return;
 }
 if(['retry','recovery-reentry','retry-input-change'].includes(mode)){
  await release(page);await page.locator('#modal-error').filter({hasText:'Synthetic known accounts prewrite'}).waitFor();let snapshot=await gate(page);assert.equal(await raw(page),bytes);assert.equal(snapshot.reloadRequired,false);assert.equal(snapshot.editable,true);assertRetained(snapshot);for(const id of ['modal-cancel','modal-close'])assert.equal(await page.locator('#'+id).isEnabled(),true);assert.equal(await page.locator(scenario.operation==='rate'?'#modal [data-action="berthing-rate"]':'#modal-submit').isEnabled(),true);
  if(mode==='recovery-reentry')assert.deepEqual(snapshot.recoveryChecks,[{before:1,after:1,writes:0}]);await detail(page,result,'known-unsaved-deliberate-retry-warning',['#modal-error']);await detail(page,result,'known-unsaved-deliberate-retry-controls',['#modal-cancel','#modal-submit']);
  if(mode==='retry-input-change'){
   await page.evaluate(rate=>{const input=document.querySelector('#modal [name="'+(rate?'weeks':'amount')+'"]');input.value=rate?'4':'900';input.dispatchEvent(new Event('input',{bubbles:true}));},scenario.operation==='rate');await submit(page,scenario,{direct:true});await frames(page);assert.equal((await gate(page)).totalCalls,1);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>accountsDiceCalls),scenario.operation==='rate'?1:0);await detail(page,result,'changed-accepted-terms-require-reopen',['#modal-error'],/changed|reopen/i);result.gate=safeReport(await gate(page));return;
  }
  const candidate=JSON.parse(snapshot.candidates[0]),dice=snapshot.semantic.dice;await submit(page,scenario,{direct:true});await page.waitForFunction(()=>!!accountsGate.pending);snapshot=await gate(page);assert.equal(snapshot.calls,2);assert.deepEqual(normalize(JSON.parse(snapshot.candidates[1])),normalize(candidate),'Safe deliberate retry retains full exact business terms, input rounding and the same prepared die; only generated transition identities may differ');assert.equal(snapshot.semantic.dice,dice);assertRetained(snapshot);await release(page);return successful(page,result,before,scenario);
 }
 if(['deferred','queued-pending'].includes(mode)){
  await page.evaluate(()=>{accountsGate.beginStrict();accountsGate.write();});await frames(page);assertSaved(await read(page),before,scenario);let snapshot=await gate(page);assert.equal(await raw(page),snapshot.candidates[0]);assertRetained(snapshot);assert.equal(snapshot.pending,true);await replay(page);snapshot=await gate(page);assertRetained(snapshot);assert.equal(snapshot.totalCalls,1);assert.equal(snapshot.mutationCount,0,'No transient DOM/SVG/summary/footer/status mutation while real publication is unresolved');assert.deepEqual((await page.evaluate(()=>accountsGate.mapCapture('published-not-settled'))).regions,snapshot.mapBaseline.regions);if(mode==='deferred')await detail(page,result,'durable-publication-held-controls',['#modal-cancel','#modal-submit']);await page.evaluate(()=>accountsGate.endStrict());await release(page);return successful(page,result,before,scenario);
 }
 if(['rate-chain','rate-handoff-reentry','rate-refresh-fault'].includes(mode)){
  if(mode!=='rate-chain')await page.evaluate(({point,fault})=>{accountsGate.handoffPoint=point;accountsGate.handoffFault=fault;},{point:scenario.point,fault:mode==='rate-refresh-fault'});await release(page);await frames(page);
  if(mode==='rate-refresh-fault'){await terminal(page,result,before,scenario,{committed:true});assert.deepEqual(result.gate.faults,['rate-'+scenario.point]);return;}
  if(mode==='rate-handoff-reentry'){
   const checks=(await gate(page)).handoffChecks;assert.equal(checks.length,1);assert.equal(checks[0].point,scenario.point);assert.equal(checks[0].before,1);assert.equal(checks[0].after,scenario.point==='report'?2:1,'Only fully established fresh post-rate authority may start payment');
   if(scenario.point!=='report')return successful(page,result,before,scenario);
  }
  return rateChain(page,result,scenario,before,{alreadyPending:scenario.point==='report'});
 }
 const cleanup=['render','report','terminal-report','close-before','close-after','clear-error','controls','reentrant-close'].includes(mode);if(cleanup)await page.evaluate(mode=>{accountsGate.cleanupFault=mode;},mode);
 await release(page,['unknown-before','unknown-after','contradictory','fulfilled-no-publication'].includes(mode)?mode:mode==='terminal-report'?'unknown-before':'native');
 if(mode==='reentrant-close'){await frames(page);assertSaved(await read(page),before,scenario);const snapshot=await gate(page);assert.deepEqual(snapshot.faults,['reentrant-close']);assert.equal(await page.locator('#modal-title').textContent(),'Rules & Notes');assert.equal(await page.locator('#modal-body').innerHTML(),snapshot.newer.body);await detail(page,result,'newer-notes-during-completion',['#modal-body .notes-list article:first-child']);await verifyNewerNotes(page,result);result.gate=safeReport(await gate(page));return reloadUndo(page,result,before,scenario);}
 await terminal(page,result,before,scenario,{committed:!['unknown-before','fulfilled-no-publication','terminal-report'].includes(mode),unknown:['unknown-before','fulfilled-no-publication','terminal-report','missing','missing-token','wrong-token','wrong-revision'].includes(mode)});if(cleanup)assert.deepEqual(result.gate.faults,[mode]);
}
function evidenceTargets(s){
 if(!persistsEvidence(s))return [];
 const success=()=>s.operation==='rate'?['saved-inline-rate-quote']:['saved-success-status'];
 let labels=[];
 if(['native','deferred','retry','economic'].includes(s.mode)){
  if(s.mode==='economic'&&s.invalid)return [s.selected?.length===0?'empty-selection-no-payment':'insufficient-combined-funds'];
  labels=success();if(s.mode==='deferred')labels.unshift('pending-before-write-controls','durable-publication-held-controls');if(s.mode==='retry')labels.unshift('known-unsaved-deliberate-retry-warning','known-unsaved-deliberate-retry-controls');if(s.dry)labels.unshift('free-water-advisory');if(s.supplier)labels.unshift('private-supplier-confirmed');
 }else if(['unknown-before','unknown-after','rate-refresh-fault','controls'].includes(s.mode))labels=['terminal-reload-warning','terminal-dismissal-controls'];
 else if(s.mode==='foreign-same')labels=['saved-retired-form-reload'];
 else if(s.mode==='new-dialog')labels=['newer-notes-retained'];
 else if(s.mode==='read-only')labels=['read-only-warning'];
 else if(['disk-same','disk-unreadable'].includes(s.mode))labels=['not-saved-durable-baseline-reload'];
 else if(s.mode==='early-durable')labels=['pre-preview-durable-drift'];
 else if(s.mode==='reentrant-close')labels=['newer-notes-during-completion'];
 else if(['construction-reentry','handoff-reentry'].includes(s.mode))labels=['newer-notes-owns-construction'];
 else if(s.mode==='entry-fault')labels=['unwritten-entry-fault'];
 else if(s.mode==='nearby-refresh')labels=[...success(),'actual-nearby-world-in-new-selector'];
 else if(s.mode==='map-owned')labels=['map-publication-held-controls',...success()];
 else if(s.mode==='map-foreign')labels=['map-publication-held-controls','terminal-reload-warning','terminal-dismissal-controls'];
 else if(s.mode==='rate-handoff-reentry')labels=s.point==='report'?['independent-payment-pending','rate-then-payment-success']:success();
 else if(s.mode==='rate-chain')labels=['independent-payment-pending','rate-then-payment-success'];
 else if(s.mode==='retry-input-change')labels=['known-unsaved-deliberate-retry-warning','known-unsaved-deliberate-retry-controls','changed-accepted-terms-require-reopen'];
 else if(s.mode==='stage-ownership')labels=['newer-notes-'+s.stage];
 else if(['published-disk-drift','published-disk-unreadable'].includes(s.mode))labels=['saved-durable-settlement-reload'];
 else if(s.mode==='retired-unknown-newer')labels=['newer-owner-form-retained','newer-owner-global-unknown-reload'];
 else if(s.mode==='covered-details-pending')labels=['covered-details-frozen-pending',...success()];
 if(detailedSuccess(s)){
  labels.push('exact-current-balance','exact-huge-credits','unchanged-time-and-stock','reload-current-balance','history-undo-one-atomic-transition');
  if(s.operation==='bundle')labels.push('initial-selection','complete-selected-first-form','complete-accepted-bundle-review','fixed-mortgage-covered-installments','saved-ledger-details');
  else if(s.operation==='rate')labels.push('initial-selection','rate-selection-terms','saved-rate-fresh-preview-controls');
  else labels.push('manual-correction-accepted-form','saved-ledger-details');
 }
 return labels;
}
async function writeReport(){await writeFile(join(artifacts,prefix+'report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(scenario,viewport){
 const result={id:scenario.id+'-'+viewport.width,mode:scenario.mode,operation:scenario.operation,viewport,status:'running',persistEvidence:persistsEvidence(scenario),evidenceTargets:evidenceTargets(scenario),checks:[],screenshots:[],layouts:[],pageErrors:[],unhandledRejections:[],consoleErrors:[],networkErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{context=await contextFor(result,scenario);const page=await context.newPage();await runBody(page,result,scenario,context);await frames(page);for(const key of ['pageErrors','unhandledRejections','consoleErrors','networkErrors','unexpectedRequests'])assert.deepEqual(result[key],[],key);assert.equal(result.screenshots.length>0,result.persistEvidence,'Predeclared representative frame policy; every semantic/geometry assertion still runs');for(const target of result.evidenceTargets)assert.ok(result.layouts.some(layout=>layout.label===target||layout.label.startsWith(target+'-')),'Declared evidence target captured: '+target);result.status='passed';}
 catch(error){result.status='failed';result.errors.push(errorText(error));const page=context?.pages()[0];if(page){await capture(page,result,'failure').catch(()=>{});result.failedGate=await gate(page).then(safeReport).catch(()=>null);}}
 finally{context?.accountsNetwork?.cleanup();context?.accountsNearbyNetwork?.cleanup();await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}
// This documented early branch has only pure fixture/source assertions. It does
// not discover, import, install, probe or launch a browser or browser executable.
if(process.argv.includes('--fixtures-only')){
 await assertReleasedEconomics();
 for(const scenario of scenarios){const before=fixture(scenario);if(scenario.invalid){assert.throws(()=>expected(before,scenario),/Nothing to pay|Select at least one|Insufficient funds/);continue;}const next=expected(before,scenario);assertSaved(next,before,scenario);S.validate(next);}
 const before=fixture({operation:'rate'}),rate=expected(before,{operation:'rate'}),bundleScenario={operation:'bundle',fuelTons:'11',salary:'12400'},paid=expected(rate,bundleScenario);assertSaved(rate,before,{operation:'rate'});assertSaved(paid,rate,bundleScenario);assert.deepEqual(material(S.undo(S.undo(paid))),material(before));assert.equal(S.jumpUndoEligibility(S.undo(S.undo(paid))).allowed,false);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(html,/<script type="module" src="js\/app\.mjs\?[^\"]+"/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);for(const name of ['shipExpenses','rollBerthingRate','expenseForm'])assert.match(app,new RegExp('function '+name+'\\('));assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);assert.equal(screenshotOptions.caret,'initial');assert.equal(report.limits.imageBytes,20*1024*1024);assert.equal(report.limits.artifactBytes,24*1024*1024);
 const plan={releasedEconomics,suite:report.suite,gateSHA256:report.gateSHA256,declaredCases:report.declaredCases,declaredDesktopCases:report.declaredDesktopCases,declaredMobileCases:report.declaredMobileCases,limits:report.limits,encoding:screenshotOptions,declaredEvidenceCases:cases.filter(c=>persistsEvidence(c.scenario)).length,declaredFrameGroups:cases.reduce((n,c)=>n+evidenceTargets(c.scenario).length,0),viewportWalkRule:'Walk only declared complete form/detail groups at original viewport resolution from scrollTop0 to full scrollHeight in clientHeight-minus90 increments; every interval overlaps by at least50px; no crop, resize or omitted bottom content.',scope:report.scope,sourceChecks:['Tagged actual app and Store; no reconstructed production completion callbacks','Four complete campaign/economics/audit/Undo oracles with only generated UUID identity normalized','Fractional/Cr100 and signed/zero corrections preserve exact original reason','Seven-kind atomic batch, fixed recurring payments, fuel, physical LSS and permanent mulligan closure','Separate retained rate and payment history: Undo bundle then rate','Actual nearby continuation separately from MapAreaCache/ResizeObserver DOM/SVG freeze','Native-resolution full viewport form walks with no crop-away; strict geometry; 20 MiB image and 24 MiB total ceilings'],scenarios,cases:cases.map(({scenario,viewport})=>({id:scenario.id+'-'+viewport.width,operation:scenario.operation,mode:scenario.mode,viewport,evidence:persistsEvidence(scenario)?'original-resolution representative frames':'all semantic and geometry assertions; diagnostic frame on failure',evidenceTargets:evidenceTargets(scenario)})),execution:'Fixture/source validation only; Chromium was NOT required or launched. This is NOT browser evidence.'};
 if(process.argv.includes('--plan-json'))console.log(JSON.stringify(plan,null,2));else console.log(`PASS: independent four-branch Accounts full-state/economic/rounding/Undo/mulligan fixtures and tagged source wiring. ${scenarios.length} scenarios / ${cases.length} declared browser cases (${report.declaredDesktopCases} desktop, ${report.declaredMobileCases} mobile). Chromium was NOT required or launched; this is NOT browser evidence.`);
}else{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual Accounts browsers run only in exact-head GitHub CI; locally use documented --fixtures-only');
 await mkdir(artifacts,{recursive:true});const started=Date.now();let timeout;
 try{
  report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT to exact head');assert.equal(report.testedCommit,report.requestedCommit);report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires exact clean head; generated artifacts are ignored');report.testedTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();
  report.releasedEconomics=await assertReleasedEconomics();
  report.sourceSHA256=Object.fromEntries(await Promise.all(['app.mjs','persistence.mjs','campaign-controller.mjs','state.mjs','expenses.mjs','amounts.mjs','rounding.mjs','form-values.mjs','fuel.mjs','accommodation.mjs','life-support.mjs','mortgage.mjs','maintenance.mjs','map-viewport.mjs'].map(async name=>[name,hash(await readFile(new URL('../js/'+name,import.meta.url)))])));
  const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};timeout=setTimeout(()=>{report.errors.push('Fourteen-minute browser evidence budget exhausted');void browser.close();},report.limits.durationMs);
  for(const{scenario,viewport}of cases){assert.ok(Date.now()-started<report.limits.durationMs,'Bounded suite duration');await runCase(scenario,viewport);}
  const files=(await readdir(artifacts)).filter(name=>name.startsWith(prefix));report.screenshotCount=files.filter(name=>name.endsWith('.jpg')).length;assert.equal(report.screenshotCount,report.cases.reduce((n,r)=>n+r.screenshots.length,0));report.artifactBytes=(await Promise.all(files.map(async name=>(await stat(join(artifacts,name))).size))).reduce((a,b)=>a+b,0);assert.ok(report.artifactBytes<report.limits.artifactBytes-262144,'Evidence remains below 24 MiB');assert.ok(imageBytes<report.limits.imageBytes,'Original-resolution images remain below 20 MiB');
 }catch(error){report.errors.push(errorText(error));console.error(errorText(error));}
 finally{clearTimeout(timeout);await browser?.close();report.durationMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(r=>r.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Legacy Accounts completion Chromium checks failed; see verification-artifacts/accounts-completion-report.json');console.log(`PASS: ${report.declaredCases} exact-head Accounts completion cases, native locks, exact economics/rounding/Undo and bounded full-viewport desktop/mobile evidence.`);
}
