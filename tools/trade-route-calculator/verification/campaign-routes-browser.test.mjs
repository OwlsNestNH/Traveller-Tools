// Real rendered Chromium journeys. Only initial baseline is seeded; every subsequent
// campaign mutation is a visible UI action. World API answers are pinned public M1105
// snapshots, not live API coverage. Natural dice use a recorded, repeatable PRNG stream.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {campaignBaseline,campaignKey,mapSnapshot,routePlan,byHex,hexDistance} from './fixtures/campaign-baseline.mjs';
import {validate} from '../js/state.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const destination=process.env.TRAVELLER_ROUTE||'Theev',trip=routePlan.routes.find(r=>r.destination===destination);assert.ok(trip);
const index=routePlan.routes.indexOf(trip),seed=11052223+index*1009,base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const report={destination,seed,commit:process.env.TRAVELLER_COMMIT||'local',fixtureSource:routePlan.source,milieu:'M1105',liveAPI:false,route:trip,baseline:campaignBaseline(),strategy:'Each world: deliver, sell existing legal lots, one natural local-broker supplier search until a local-broker purchase is recorded (at most two attempts at Drinax), buy <=8t and <=Cr40,000 while retaining Cr60,000 operating reserve, accept available next-stop freight/mail within 20t and fuel-space limits. Natural dice only; no price/market success overrides. Refined A/B; unrefined C/D. Refill only missing fuel to40t, except60t atNoricum. Refill normal LSS as needed. Pay salary/maintenance when due and affordable; defer mortgage unless Cr60,000 remains. Salary firstdue028 is a test assumption; no automatic salary schedule exists.',checks:[],checkpoints:[],decisions:[],localBrokerProof:[],runtimeErrors:[],apiRequests:[]};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});context.setDefaultTimeout(15000);
await context.tracing.start({screenshots:true,snapshots:false,sources:false});
await context.addInitScript(({state,key,seed,origin})=>{
 if(location.origin!==origin)return;
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
 // Only the rules die() single Uint32 draw is replaced. UUIDs and all other crypto
 // remain browser-generated. Persist stream across reloads in this test tab.
 const native=crypto.getRandomValues.bind(crypto);let x=Number(sessionStorage.getItem('qa-rng-state')||seed)>>>0;
 window.qaDiceDraws=[];crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){x=(x+0x6D2B79F5)>>>0;sessionStorage.setItem('qa-rng-state',String(x));let t=Math.imul(x^(x>>>15),x|1);t^=t+Math.imul(t^(t>>>7),t|61);const value=(t^(t>>>14))>>>0;a[0]=value;window.qaDiceDraws.push({value,face:value<4294967292?value%6+1:null});return a;}return native(a);};
 window.addEventListener('unhandledrejection',e=>{window.qaRejections??=[];window.qaRejections.push(String(e.reason?.stack||e.reason));});
},{state:report.baseline,key:campaignKey,seed,origin:new URL(base).origin});
await context.route('https://travellermap.com/api/**',async route=>{
 const u=new URL(route.request().url());report.apiRequests.push(u.href);assert.equal(u.searchParams.get('milieu'),'M1105');
 if(u.pathname.endsWith('/universe'))return route.fulfill({json:{Sectors:[{Names:[{Text:'Trojan Reach'}],Abbreviation:'Troj',X:-4,Y:0,Milieu:'M1105'}]}});
 if(u.pathname.endsWith('/metadata'))return route.fulfill({json:{X:-4,Y:0,Names:[{Text:'Trojan Reach'}],Subsectors:Array.from({length:16},(_,i)=>({Index:String.fromCharCode(65+i),Name:'M1105 '+String.fromCharCode(65+i)}))}});
 if(u.pathname.endsWith('/sec'))return route.fulfill({json:'Hex\tName\n'+mapSnapshot.Worlds.filter(w=>w.Sector==='Trojan Reach').map(w=>w.Hex+'\t'+w.Name).join('\n')});
 if(u.pathname.endsWith('/jumpworlds')){
  const center=u.searchParams.has('x')?{WorldX:Number(u.searchParams.get('x')),WorldY:Number(u.searchParams.get('y'))}:byHex(u.searchParams.get('hex'));
  assert.ok(center,'Known snapshot query center '+u.href);const radius=Number(u.searchParams.get('jump')||0);
  return route.fulfill({json:{Worlds:mapSnapshot.Worlds.filter(w=>hexDistance(center,w)<=radius)}});
 }
 throw Error('Unexpected external map request '+u.href);
});
const page=await context.newPage();page.on('pageerror',e=>report.runtimeErrors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.runtimeErrors.push(m.text());});
const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
const action=name=>page.locator('[data-action="'+name+'"]:visible').first();
const click=name=>action(name).click();
const tab=async name=>{await page.locator('#tabs [data-arg="'+name+'"]').click();};
const field=name=>page.locator('#modal [name="'+name+'"]');
const modalButton=name=>page.locator('#modal').getByRole('button',{name,exact:true});
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
const stock=s=>Number(s.ship.lifeSupport.stockUnits.numerator)/Number(s.ship.lifeSupport.stockUnits.denominator);
const date=s=>String(1+Math.floor(s.hours/24)).padStart(3,'0')+'-1105';
const dueHours=label=>(Number(label.slice(0,3))-1)*24+(Number(label.slice(4))-1105)*365*24;
const used=s=>1+Math.max(0,s.ship.fuel.aboardTons-40)+Math.max(0,stock(s)-800)*.01+s.lots.reduce((n,l)=>n+Number(l.quantity),0)+s.contracts.filter(c=>c.status==='accepted').reduce((n,c)=>n+Number(c.quantity),0);
const check=(name,details={})=>report.checks.push({name,...details});
const nextDate=(label,count)=>{const days=Number(label.slice(0,3))-1+count*28;return String(days%365+1).padStart(3,'0')+'-'+(Number(label.slice(4))+Math.floor(days/365));};
function priceOracle(a,commodity,unitPrice){
 assert.equal(a.dice.dice.length,3);assert.ok(a.dice.dice.every(d=>Number.isInteger(d)&&d>=1&&d<=6));assert.equal(a.dice.total,a.dice.dice.reduce((n,d)=>n+d,0));assert.equal(a.dice.manual,undefined);assert.equal(a.manualPrice??null,null);assert.equal(a.priceLimitApplied,false);assert.equal(a.baseRetailCapApplied,false);
 const raw=core.commodities.find(g=>g.id===commodity).baseCreditsPerTon;assert.equal(a.basePrice,raw);
 const modified=a.dice.total+a.skill+a.localDM+(a.side==='sell'?a.sale.selected-a.purchase.selected:a.purchase.selected-a.sale.selected)-a.counterparty;
 const row=core.priceTable.rows.find(r=>r.result===Math.max(-3,Math.min(25,modified))),percent=a.side==='sell'?row.salePercent:row.purchasePercent;
 assert.equal(a.modified,modified);assert.equal(a.percent,percent);assert.equal(String(unitPrice),String((BigInt(raw)*BigInt(percent)+99n)/100n));
}

let salaryDue=648,localUsed=false;
async function checkpoint(label){
 const s=await read();validate(s);assert.equal(s.bank,String(s.ledger.reduce((n,e)=>n+BigInt(e.amount),0n)),'Cash equals signed ledger at '+label);assert.ok(BigInt(s.bank)>=0n);assert.ok(used(s)<=50+1e-9);assert.equal(s.settings.profit,100);assert.equal(s.settings.tax,false);assert.equal(s.settings.insurance,false);assert.equal(s.settings.reducedProfitLimitsEnabled,false);assert.equal(s.settings.maxBaseRetailEnabled,false);assert.equal(s.trader.broker,2);assert.equal(s.ship.fuel.capacityTons,80);
 let expectedN=3360n-BigInt(s.hours)*5n,expectedD=24n;
 for(const e of s.ledger.filter(e=>e.expense?.kind==='lifeSupportRefill')){const q=e.expense.purchasedStockUnits,n=BigInt(q.numerator),d=BigInt(q.denominator);expectedN=expectedN*d+n*expectedD;expectedD*=d;}
 // Exact independent person-hour oracle, without supportStock/used/refillQuote imports.
 assert.equal(BigInt(s.ship.lifeSupport.stockUnits.numerator)*expectedD,expectedN*BigInt(s.ship.lifeSupport.stockUnits.denominator),'Five people consume exactly 5 LSS/day at '+label);
 for(const rows of [s.lots,s.contracts,s.ledger])assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 report.checkpoints.push({label,world:s.worlds[s.actual].name,hex:s.worlds[s.actual].hex,hours:s.hours,date:date(s),bank:s.bank,fuel:s.ship.fuel.aboardTons,bladder:Math.max(0,s.ship.fuel.aboardTons-40),lss:stock(s),holdUsed:used(s),lots:s.lots.map(l=>({id:l.id,commodity:l.commodity,quantity:l.quantity,basis:l.basis})),contracts:s.contracts.map(c=>({kind:c.kind,status:c.status,quantity:c.quantity,payment:c.payment,destination:s.worlds[c.destination].hex})),ledgerEntries:s.ledger.length,mortgage:structuredClone(s.ship.mortgage),maintenance:structuredClone(s.ship.maintenance)});console.log('CHECKPOINT '+JSON.stringify({route:destination,label,world:s.worlds[s.actual].name,date:date(s),hours:s.hours,bank:s.bank,cargo:used(s),fuel:s.ship.fuel.aboardTons,bladder:Math.max(0,s.ship.fuel.aboardTons-40),LSS:stock(s)}));return s;
}
async function screenshot(label){await page.screenshot({path:artifacts+`/route-${destination}-${label}.png`,fullPage:true});}
async function planNext(hex){
 await tab('Overview');if(!await page.locator('#route-menu').evaluate(e=>e.open))await page.locator('#route-menu > summary').click();await page.getByRole('button',{name:'Build route',exact:true}).click();
 const raw=byHex(hex),id=raw?raw.WorldX+','+raw.WorldY:'-108,-23';
 const selector=raw?'svg [data-action="map-world"][data-arg="'+id+'"]':'svg polygon[data-action="map-empty"][data-arg="'+id+'"]';
 await page.locator(selector).click();await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')&&!document.querySelector('[data-action="route-save"]').disabled);
 await page.getByRole('button',{name:'Save planned route',exact:true}).click();await modalButton('Save route').click();await closed();
 const s=await read();assert.equal(s.worlds[s.route[s.routeIndex+1]].hex,hex);await checkpoint('route planned to '+hex);
}
async function refillLss(force=false){
 let s=await read();if(s.worlds[s.actual].emptySpace)return;
 if(stock(s)>=140-1e-9||!force&&stock(s)>=105)return;
 const cost=Math.ceil((140-stock(s))*100-1e-7); // Cr14,000 /140 LSS, once.
 if(BigInt(s.bank)<BigInt(cost)){report.decisions.push({kind:'LSS unavailable: insufficient cash',world:s.actual,cost,bank:s.bank});throw Error('Expected operating cash shortfall stops this trip before unsupported travel.');}
 await tab('Overview');await click('refill-support');assert.equal(await action('service-confirm').isEnabled(),true);await click('service-confirm');await page.locator('#service-panel').waitFor({state:'hidden'});
 const after=await checkpoint('LSS normal refill');assert.equal(after.bank,String(BigInt(s.bank)-BigInt(cost)));assert.ok(Math.abs(stock(after)-140)<1e-9);assert.equal(after.ledger.length,s.ledger.length+1);check('normal LSS refill: exact prorating; no duplicate cabin/person payment',{world:s.worlds[s.actual].name,cost});
}
async function refuel(target){
 const s=await read(),tons=target-s.ship.fuel.aboardTons;if(tons<=0)return;assert.equal(s.worlds[s.actual].emptySpace,undefined,'Never refuel empty space');const port=s.worlds[s.actual].uwp[0],type=['A','B'].includes(port)?'refined':'unrefined';assert.ok(['A','B','C','D'].includes(port),'Do not invent supplier');const cost=tons*(type==='refined'?500:100);assert.ok(BigInt(s.bank)>=BigInt(cost),'Operating fuel affordability');
 await tab('Overview');await click('refuel');await page.locator('#service-form [name="fuelTons"]').fill(String(tons));await page.locator('#service-form [name="fuelType"]').selectOption(type);await click('service-confirm');await page.locator('#service-panel').waitFor({state:'hidden'});
 const after=await checkpoint('fuel purchase '+tons+'t '+type);assert.equal(after.ship.fuel.aboardTons,target);assert.equal(after.bank,String(BigInt(s.bank)-BigInt(cost)));check('fuel only fills missing stock',{world:s.worlds[s.actual].name,tons,target,type,cost});
}
async function payExpense(kind,count=1){
 await tab('Overview');await click('ship-expenses');const labels={salary:'Crew salaries',mortgage:'Mortgage',maintenance:'Monthly maintenance',berthing:'Port costs'};
 await page.getByRole('button',{name:labels[kind]+' ›',exact:true}).click();
 if(kind==='berthing'&&await action('expense-berthing-rate').count()){await click('expense-berthing-rate');await page.locator('#expense-form').waitFor();}
 await page.locator('#expense-form [name="'+(kind==='berthing'?'weeks':'payments')+'"]').fill(String(count));
 if(kind==='salary')assert.equal(await page.locator('#expense-form [name="monthly"]').inputValue(),'20000');
 const before=await read();if(await action('expense-pay').isDisabled()){report.decisions.push({kind:'defer '+kind,bank:before.bank,world:before.actual,count,reason:await page.locator('#expense-panel').textContent()});await click('expense-back');await click('expense-close');return false;}
 await click('expense-pay');await page.locator('.expense-receipt').waitFor();const after=await checkpoint('paid '+kind+' '+count);const last=after.ledger.at(-1);assert.equal(last.expense.kind,kind);
 const expected=kind==='salary'?20000*count:kind==='mortgage'?150000*count:kind==='maintenance'?2300*count:({A:1000,B:500,C:100,D:10,E:0,X:0}[before.worlds[before.actual].uwp[0]]*(before.worlds[before.actual].berthingRate?.die??0)*count);
 assert.equal(last.expense.amount,String(expected));
 if(kind==='mortgage'){assert.equal(after.ship.mortgage.remainingPayments,before.ship.mortgage.remainingPayments-count);assert.equal(after.ship.mortgage.totalPaid,String(BigInt(before.ship.mortgage.totalPaid)+BigInt(expected)));assert.equal(after.ship.mortgage.nextDueDate,nextDate(before.ship.mortgage.nextDueDate,count));}
 if(kind==='maintenance'){assert.equal(after.ship.maintenance.paidSinceTracking,String(BigInt(before.ship.maintenance.paidSinceTracking)+BigInt(expected)));assert.equal(after.ship.maintenance.nextDueDate,nextDate(before.ship.maintenance.nextDueDate,count));}
 assert.equal(after.bank,String(BigInt(before.bank)-BigInt(last.expense.amount)));assert.equal(after.ledger.length,before.ledger.length+1);await click('expense-back');await click('expense-close');return true;
}
async function recurring(){
 let s=await read();if(s.worlds[s.actual].emptySpace)return;
 const salaryCount=s.hours>=salaryDue?1+Math.floor((s.hours-salaryDue)/672):0;if(salaryCount&&BigInt(s.bank)>=BigInt(salaryCount*20000)){if(await payExpense('salary',salaryCount))salaryDue+=salaryCount*672;}else if(salaryCount)report.decisions.push({kind:'salary deferred',world:s.actual,bank:s.bank,periods:salaryCount,shortfall:String(BigInt(salaryCount*20000)-BigInt(s.bank))});
 s=await read();const maintenanceCount=s.hours>=dueHours(s.ship.maintenance.nextDueDate)?1+Math.floor((s.hours-dueHours(s.ship.maintenance.nextDueDate))/672):0;
 if(maintenanceCount&&BigInt(s.bank)>=BigInt(maintenanceCount*2300))await payExpense('maintenance',maintenanceCount);else if(maintenanceCount)report.decisions.push({kind:'maintenance deferred',world:s.actual,bank:s.bank,periods:maintenanceCount,shortfall:String(BigInt(maintenanceCount*2300)-BigInt(s.bank))});
 s=await read();if(s.hours>=dueHours(s.ship.mortgage.nextDueDate)){
 const due=1+Math.floor((s.hours-dueHours(s.ship.mortgage.nextDueDate))/672),affordable=Math.max(0,Math.floor((Number(s.bank)-60000)/150000)),count=Math.min(due,affordable);
 const mortgageBefore=structuredClone(s.ship.mortgage);if(count)await payExpense('mortgage',count);s=await read();if(!count)assert.deepEqual(s.ship.mortgage,mortgageBefore,'Deferral leaves all mortgage debt fields untouched');if(count<due)report.decisions.push({kind:'mortgage deferred',world:s.worlds[s.actual].name,date:date(s),bank:s.bank,unpaidDue:s.ship.mortgage.nextDueDate,paymentsDeferred:due-count,reason:'Preserve Cr60,000 for fuel, LSS, salaries and maintenance; no top-up or fictional payment.'});
 }
}
async function search(kind,useLocal=false){
 if(kind==='supplier'){await tab('Trade');await page.getByRole('button',{name:'Find supplier',exact:true}).click();}
 else {await tab('Cargo');await page.getByRole('button',{name:'Select all cargo',exact:true}).click();await page.getByRole('button',{name:'Get sale offers',exact:true}).click();}
 await page.getByRole('heading',{name:'Find a '+kind,exact:true}).waitFor();if(useLocal)await field('local').check();
 await modalButton('Preview search').click();await modalButton('Commit search').click();
 const s=await checkpoint(kind+' natural search'),snap=s.snapshots.at(-1);assert.equal(snap.search.effectiveTotal,snap.search.generatedDice.total);assert.equal(snap.search.successOverride,false);
 if(snap.success&&kind==='buyer'){await page.getByRole('heading',{name:/Prepare sale/}).waitFor();}
 else await closed();return snap;
}
async function sellCargo(){
 const before=await read();if(!before.lots.length)return;
 const buyer=await search('buyer');if(!buyer.success){report.decisions.push({kind:'buyer search failed naturally',world:before.actual});return;}
 await modalButton('Preview sale').click();await modalButton('COMMIT SALE').click();await closed();
 const s=await checkpoint('sold carried cargo');assert.equal(s.lots.length,0);const added=s.ledger.slice(before.ledger.length);assert.ok(added.some(e=>e.type==='Sale'));for(const e of added.filter(e=>e.type==='Sale')){assert.equal(e.audit.tax,'0');assert.equal(e.audit.profitPercent,100);assert.equal(e.audit.adjustment,'0');priceOracle(e.audit.audit,e.audit.commodity,e.audit.unitPrice);assert.equal(e.amount,String(BigInt(e.audit.unitPrice)*BigInt(e.audit.quantity)));}
 check('natural sale commits once and removes all sold cargo',{world:s.worlds[s.actual].name,bank:s.bank});
}
async function buyCargo(){
 let s=await read();if(Number(s.bank)<=60000)return;
 let snap=await search('supplier',!localUsed);if(!snap.success&&s.hours===0)snap=await search('supplier',!localUsed);
 if(!snap.success){report.decisions.push({kind:'supplier search failed naturally',world:s.actual});return;}
 s=await read();const limit=s.worlds[s.actual].hex==='2018'&&destination==='Theev'?29:49;
 const offers=snap.offers.filter(o=>!o.illegal&&!o.manualRequired&&!o.expired&&Number(o.remaining)>0&&Number(o.unitPrice)>0).sort((a,b)=>Number(a.unitPrice)-Number(b.unitPrice)||a.commodity.localeCompare(b.commodity));
 const offer=offers.find(o=>Math.ceil(Number(o.unitPrice)*(snap.options.local?1.1:1))<=Math.min(40000,Number(s.bank)-60000));if(!offer){report.decisions.push({kind:'no affordable legal offer',world:s.actual});return;}
 const quantity=Math.min(8,Number(offer.remaining),Math.floor(limit-used(s)+1),Math.floor(Math.min(40000,Number(s.bank)-60000)/(Number(offer.unitPrice)*(snap.options.local?1.1:1))));if(quantity<1)return;
 await page.locator('[data-action="buy"][data-arg="'+offer.id+'"]').click();await field('quantity').fill(String(quantity));const feePercent=Number(await field('fee').inputValue());assert.equal(feePercent,snap.options.local?10:0);await modalButton('Preview purchase').click();await modalButton('COMMIT PURCHASE').click();await closed();
 const after=await checkpoint('bought '+quantity+'t '+offer.description),lot=after.lots.at(-1),goods=BigInt(offer.unitPrice)*BigInt(quantity),fee=(goods*BigInt(feePercent)+99n)/100n;
 assert.equal(after.bank,String(BigInt(s.bank)-goods-fee));assert.equal(lot.basis,String(goods+fee));assert.equal(lot.quantity,String(quantity));assert.equal(after.snapshots.find(x=>x.id===snap.id).offers.find(o=>o.id===offer.id).remaining,String(Number(offer.remaining)-quantity));
 priceOracle(offer.audit,offer.commodity,offer.unitPrice);assert.equal(offer.audit.dice.dice.length,3);assert.equal(offer.audit.dice.manual,undefined);assert.equal(offer.audit.tradeComplication.result,new Set(offer.audit.dice.dice).size===1?'severe':new Set(offer.audit.dice.dice).size===2?'complication':'none');
 if(snap.options.local){localUsed=true;assert.equal(snap.options.skill,Math.floor(snap.search.localSkillDice.total/3));assert.equal(offer.audit.localDM,2);await page.locator('[data-action="offer-audit"][data-arg="'+offer.id+'"]').click();const auditText=await page.locator('#modal-body').textContent();assert.match(auditText,/Local|local/);await screenshot('local-broker');await page.locator('#modal-cancel').click();await closed();report.localBrokerProof.push({world:s.worlds[s.actual].name,hex:s.worlds[s.actual].hex,skillDice:snap.search.localSkillDice,skill:snap.options.skill,priceDice:offer.audit.dice,localDM:offer.audit.localDM,feePercent,goods:String(goods),fee:String(fee),basis:lot.basis,quantity,lotId:lot.id,bankBefore:s.bank,bankAfter:after.bank,auditText});}
 check('purchase exact goods+broker fee and cargo once',{world:s.worlds[s.actual].name,quantity,goods:String(goods),fee:String(fee)});
}
async function acceptContracts(nextHex){
 if(nextHex==='2117')return;await tab('Contracts');await page.getByRole('button',{name:'Find contracts',exact:true}).click();const dest=byHex(nextHex);await field('destination').selectOption(dest.WorldX+','+dest.WorldY);await modalButton('Generate offers').click();await closed();
 let s=await checkpoint('natural freight/mail generation');const event=[...s.events].reverse().find(e=>e.label==='Contract search audit'),offers=event.offers;assert.deepEqual(event.manualDice,[]);
 const limit=s.worlds[s.actual].hex==='2018'&&destination==='Theev'?30:50;let acceptedTons=0;
 // Mail first, then highest revenue per ton; accept only what actually exists.
 for(const o of [...offers].sort((a,b)=>(a.kind==='mail'?-1:1)-(b.kind==='mail'?-1:1)||Number(b.payment)/Number(b.quantity)-Number(a.payment)/Number(a.quantity))){
  s=await read();if(Number(o.quantity)>20-acceptedTons||used(s)+Number(o.quantity)>limit)continue;
  const control=page.locator('[data-action="contract-accept"][data-arg="'+o.offerId+'"]:visible').first();if(!await control.count()||await control.isDisabled())continue;const bank=s.bank;
  await control.click();await modalButton('Accept whole contract').click();await closed();s=await checkpoint('accepted '+o.kind);assert.equal(s.bank,bank);acceptedTons+=Number(o.quantity);assert.equal(s.contracts.filter(c=>c.status==='accepted'&&c.kind==='mail'&&c.origin===s.actual).length<=1,true);
  if(acceptedTons>=20)break;
 }
}
async function deliverContracts(){
 let s=await read();const due=s.contracts.filter(c=>c.status==='accepted'&&c.destination===s.actual);if(!due.length)return;await tab('Contracts');
 for(const c of due){const before=await read();await page.locator('[data-action="deliver"][data-arg="'+c.id+'"]').click();await modalButton('Commit delivery & payout').click();await closed();const after=await checkpoint('delivered '+c.kind),paid=after.contracts.find(x=>x.id===c.id);assert.equal(paid.status,'delivered');const payout=c.kind==='freight'&&c.dueHours!==null&&before.hours>c.dueHours?(BigInt(c.payment)*BigInt(6-paid.penaltyDie)+9n)/10n:BigInt(c.payment);assert.equal(paid.payout,String(payout));assert.equal(after.bank,String(BigInt(before.bank)+BigInt(paid.payout)));await page.locator('[data-action="contract-audit"][data-arg="'+c.id+'"]').click();assert.match(await page.locator('#modal-body').textContent(),/Actual payment/);await page.locator('#modal-cancel').click();await closed();}
}
async function jumpLeg(i){
 await tab('Overview');const before=await read(),distance=trip.legParsecs[i];assert.ok(before.ship.fuel.aboardTons>=distance*20);assert.ok(stock(before)>=184*5/24);
 await click('jump');await modalButton('COMMIT JUMP').click();await closed();const after=await checkpoint('arrival '+trip.stops[i+1]),event=after.events.findLast(e=>e.label==='Jump audit');assert.equal(after.worlds[after.actual].hex,trip.hexes[i+1]);assert.equal(after.ship.fuel.aboardTons,before.ship.fuel.aboardTons-distance*20);assert.equal(event.generatedHours,event.effectiveHours);assert.equal(event.dice.dice.length,6);assert.equal(after.hours-before.hours,148+event.dice.dice.reduce((a,b)=>a+b,0));assert.equal(after.bank,before.bank);await screenshot('arrival-'+trip.hexes[i+1]);
 check('natural Jump-'+distance+' exact fuel/time/LSS',{from:trip.hexes[i],to:trip.hexes[i+1],hours:event.effectiveHours,fuelBefore:before.ship.fuel.aboardTons,fuelAfter:after.ship.fuel.aboardTons});
}
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await checkpoint('identical baseline');await screenshot('baseline');
 for(let i=0;i<trip.hexes.length;i++){
  let s=await read();assert.equal(s.worlds[s.actual].hex,trip.hexes[i]);const portStart=s.hours,final=i===trip.hexes.length-1;
  if(s.worlds[s.actual].emptySpace){assert.equal(s.ship.fuel.aboardTons,20);check('empty2117: no fuel/LSS purchase or trade');await planNext(trip.hexes[i+1]);await jumpLeg(i);continue;}
  await deliverContracts();await refillLss();await sellCargo();await recurring();
  if(!final){await planNext(trip.hexes[i+1]);await buyCargo();await acceptContracts(trip.hexes[i+1]);}
  s=await read();const weeks=Math.max(1,Math.ceil((s.hours-portStart)/168));await payExpense('berthing',weeks);await recurring();
  if(final)break;
  await tab('Overview');await refuel(destination==='Theev'&&trip.hexes[i]==='2018'?60:40);s=await read();if(stock(s)<80)await refillLss(true);
  if(destination==='Theev'&&trip.hexes[i]==='2018'){assert.equal((await read()).ship.fuel.aboardTons,60);await refillLss(true);}
  await jumpLeg(i);
 }
 assert.ok(localUsed,'Every trip requires an actual local-broker transaction');assert.equal(report.localBrokerProof.length>=1,true);
 const final=await checkpoint('final destination');assert.equal(final.worlds[final.actual].name,destination);assert.equal(final.events.filter(e=>e.label==='Jump audit').length,trip.jumps);
 // Reload and export are actual UI operations, without resetting the route state.
 report.runtimeErrors.push(...await page.evaluate(()=>window.qaRejections||[]));const beforeReload=structuredClone(final),draws=await page.evaluate(()=>window.qaDiceDraws);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(),beforeReload);await tab('Accounts');const downloadPromise=page.waitForEvent('download');await click('export');const download=await downloadPromise;assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),final);check('final reload and UI export preserve exact campaign');
 report.naturalDiceDraws=draws;report.final=final;report.runtimeErrors.push(...await page.evaluate(()=>window.qaRejections||[]));assert.deepEqual(report.runtimeErrors,[]);report.status='passed';console.log(`PASS ${destination}: ${trip.jumps} jumps; ${report.checkpoints.length} invariant checkpoints; local broker proved; bank Cr${final.bank}; ${date(final)}; mortgage next ${final.ship.mortgage.nextDueDate}.`);
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};report.final=await read().catch(()=>null);report.naturalDiceDraws=await page.evaluate(()=>window.qaDiceDraws).catch(()=>[]);await screenshot('failure').catch(()=>{});throw error;}
finally{
 await writeFile(artifacts+`/route-${destination}-report.json`,JSON.stringify(report,null,2));
 await writeFile(artifacts+`/route-${destination}-summary.txt`,`${report.status}: ${destination}\n${trip.stops.join(' -> ')}\nSeed ${seed}; public M1105 snapshot (not live API).\n${report.checkpoints.length} checkpoints; ${report.checks.length} checks; local broker proofs ${report.localBrokerProof.length}.\n${report.failure?.stack||''}\n`);
 await context.tracing.stop({path:artifacts+`/route-${destination}-trace.zip`});await browser.close();
}
