import test from 'node:test';
import assert from 'node:assert/strict';
import {playerBriefing,playerBriefingData} from '../js/player-briefing.mjs';
import {harness,campaign,core} from './app-harness.mjs';
const data=(s,session)=>playerBriefingData(s,core,session);
function visit(){
 const s=campaign();s.events=[{id:'setup',label:'Campaign setup',revision:1,world:'0,0',hours:0},{id:'a',label:'Jump audit',from:'0,0',to:'1,0',hours:100},{id:'b',label:'Jump audit',from:'1,0',to:'0,0',hours:200}];
 s.actual='0,0';s.ledger=[{id:'open',type:'Opening bank',world:'0,0',amount:'100000',hours:0},{id:'old',type:'Sale',world:'0,0',amount:'9000',hours:10,audit:{adjusted:'8000',description:'SECRET OLD CARGO'}},{id:'ja',type:'Jump',eventId:'a',from:'0,0',to:'1,0',world:'1,0',amount:'0',hours:100},{id:'sale',type:'Sale',world:'1,0',amount:'1000',hours:101,audit:{adjusted:'200',description:'SECRET CARGO'}},{id:'mail',type:'Mail delivery',world:'1,0',amount:'500',hours:102},{id:'expense',type:'Manual expense',world:'1,0',amount:'-50',hours:103,reason:'SECRET GM'},{id:'buy',type:'Purchase',world:'1,0',amount:'-800',hours:104},{id:'jb',type:'Jump',eventId:'b',from:'1,0',to:'0,0',world:'0,0',amount:'0',hours:200}];s.bank='109650';s.hours=200;return s;
}
test('previous completed visit is jump-delimited financial results only, not matching-world history',()=>{
 const s=visit(),before=JSON.stringify(s),r=data(s).previousCompletedVisit;
 assert.equal(r.world.name,'Destination');assert.equal(r.realizedTradingProfitCr,'200');assert.equal(r.transportIncomeCr,'500');assert.equal(r.recordedOperatingExpensesCr,'50');assert.equal(r.netOperatingOutcomeCr,'650');assert.equal(r.cashMovementCr,'650');assert.doesNotMatch(JSON.stringify(r),/SECRET|commodity|quantity|Cargo/);assert.equal(JSON.stringify(s),before);
 s.ledger.find(e=>e.id==='buy').amount='-1800';s.bank='108650';assert.equal(data(s).previousCompletedVisit.cashMovementCr,'-350');assert.equal(data(s).previousCompletedVisit.netOperatingOutcomeCr,'650');
});
test('first completed visit, revisits and same-hour jumps retain saved order',()=>{
 const s=visit();s.ledger=s.ledger.slice(0,3);s.events=s.events.slice(0,2);s.actual='1,0';s.bank='109000';assert.equal(data(s).previousCompletedVisit.realizedTradingProfitCr,'8000');
 const r=visit();r.ledger.filter(e=>e.type==='Jump').forEach(e=>e.hours=100);r.events.filter(e=>e.label==='Jump audit').forEach(e=>e.hours=100);assert.equal(data(r).previousCompletedVisit.netOperatingOutcomeCr,'650');
});
test('missing boundaries, corrections, Undo and baselines cannot fabricate previous visit',()=>{
 for(const mutate of [s=>s.ledger=s.ledger.filter(e=>e.id!=='ja'),s=>s.events=s.events.filter(e=>e.id!=='a'),s=>s.actual='8,0',s=>s.events.push({label:'Starting-world / location correction'}),s=>s.events.push({label:'Undo: Jump'}),s=>s.dashboardBaseline={origin:'current',hours:101,excludedLedgerIds:['sale']},s=>s.dashboardBaseline={origin:'opening',hours:0,excludedLedgerIds:['missing']}]){const s=visit();mutate(s);assert.equal(data(s).previousCompletedVisit.status,'UNAVAILABLE / INCOMPLETE');}
 assert.equal(data(campaign()).previousCompletedVisit.status,'UNAVAILABLE / INCOMPLETE');
});
test('missing sale result preserves known income/expenses and suppresses net; large amounts remain exact',()=>{
 const s=visit();delete s.ledger.find(e=>e.id==='sale').audit.adjusted;assert.equal(data(s).previousCompletedVisit.netOperatingOutcomeCr,null);assert.equal(data(s).previousCompletedVisit.transportIncomeCr,'500');assert.match(data(s).previousCompletedVisit.warnings.join(' '),/incomplete/);
 s.ledger.find(e=>e.id==='sale').audit.adjusted='900719925474099399999';assert.equal(data(s).previousCompletedVisit.netOperatingOutcomeCr,'900719925474099400449');
});
test('passenger session availability is remaining counts by class; history cannot recreate offers',()=>{
 const s=visit(),offers=[{offerId:'p',origin:s.actual,destination:'1,0',passageClass:'high',count:5,fare:'100'}];s.latestPassengerSearchId='p-search';s.events.push({id:'p-search',label:'Passenger search audit',world:s.actual,destination:'1,0',offers});
 assert.equal(data(s).currentOptions.passengers.status,'HISTORICAL ONLY');s.contracts=[{kind:'passenger',offerId:'p',status:'accepted',count:2,passageClass:'high'}];const p=data(s,{passengerSession:{searchId:'p-search',offers}}).currentOptions.passengers;assert.deepEqual(p.availableByClass,{high:3,middle:0,basic:0,low:0});assert.equal(p.status,'CHECKED');assert.equal(data(s,{passengerSession:{searchId:'wrong',offers}}).currentOptions.passengers.availableByClass,null);
});
test('real mail checks distinguish unchecked, checked-none and historical-only without mutations',async()=>{
 const h=harness();assert.equal(data(h.api.state).currentOptions.mail.status,'NOT CHECKED');await h.check({mailAvailability:2});const before=JSON.stringify(h.api.state),calls={...h.calls};
 const r=data(h.api.state,{mailCheck:h.api.check,contractDrafts:h.api.drafts});assert.equal(r.currentOptions.mail.status,'CHECKED');assert.equal(r.currentOptions.mail.availableTons,'0');assert.equal(r.currentOptions.freight.status,'NOT CHECKED');assert.equal(data(h.api.state).currentOptions.mail.status,'HISTORICAL ONLY');assert.equal(JSON.stringify(h.api.state),before);assert.deepEqual(h.calls,calls);
});
test('current freight is aggregate only and mail does not reveal contract descriptions',async()=>{
 const h=harness();h.api.contractSearch(false);h.fill({dice:8,skill:0,characteristic:0,days:14,mailAvailability:12,mailContainers:3});await h.submit();
 const r=data(h.api.state,{mailCheck:h.api.check,contractDrafts:h.api.drafts});assert.equal(r.currentOptions.freight.status,'CHECKED');assert.equal(r.currentOptions.freight.availableContracts,h.api.drafts.filter(c=>c.kind==='freight').length);assert.equal(r.currentOptions.mail.availableTons,'15');assert.doesNotMatch(JSON.stringify(r.currentOptions.freight),/offerId|description|audit/);
});
test('copy action writes one full instruction/data block without saving, quotes or rolls',async()=>{
 const copied=[],h=harness(undefined,[],{navigator:{clipboard:{writeText:async text=>copied.push(text)}}});const before=JSON.stringify(h.api.state),calls={...h.calls};
 assert.match(h.api.actions.tab('Overview')??h.dom.ids.get('main').innerHTML,/Copy Player Briefing/);await h.api.actions['player-briefing']();assert.equal(copied.length,1);assert.match(copied[0],/exactly one page PDF/);assert.match(copied[0],/PLAYER-SAFE JSON DATA/);assert.equal(JSON.stringify(h.api.state),before);assert.deepEqual(h.calls,calls);assert.equal(h.dom.ids.get('modal').open,false);
});
test('clipboard denied or missing exposes escaped, selectable complete text fallback',async()=>{
 for(const navigator of [undefined,{clipboard:{writeText:async()=>{throw Error('denied');}}}]){const s=campaign();s.name='</textarea><script>doBadThings()</script>';const h=harness(s,[],{navigator}),before=JSON.stringify(h.api.state);await h.api.actions['player-briefing']();assert.equal(h.dom.ids.get('modal-title').textContent,'Copy player briefing');assert.match(h.dom.ids.get('modal-body').innerHTML,/readonly aria-label="Player briefing prompt and data"/);assert.match(h.dom.ids.get('modal-body').innerHTML,/&lt;\/textarea&gt;&lt;script&gt;/);assert.doesNotMatch(h.dom.ids.get('modal-body').innerHTML,/<script>/);assert.equal(JSON.stringify(h.api.state),before);assert.equal(h.calls.saves,0);}
});
test('missing financial history with an unreconciled bank suppresses previous results',()=>{
 const s=visit();s.ledger=s.ledger.filter(e=>e.id!=='expense');assert.equal(data(s).previousCompletedVisit.status,'UNAVAILABLE / INCOMPLETE');
});
test('a repeated world visit excludes income from the earlier visit to that same world',()=>{
 const s=visit();s.ledger.push({id:'new-sale',type:'Sale',world:'0,0',amount:'5000',hours:201,audit:{adjusted:'300'}},{id:'jc',type:'Jump',eventId:'c',from:'0,0',to:'1,0',world:'1,0',amount:'0',hours:300});s.events.push({id:'c',label:'Jump audit',from:'0,0',to:'1,0',hours:300});s.actual='1,0';s.bank='114650';assert.equal(data(s).previousCompletedVisit.world.name,'Origin');assert.equal(data(s).previousCompletedVisit.realizedTradingProfitCr,'300');assert.equal(data(s).previousCompletedVisit.cashMovementCr,'5000');
});
test('retained current freight stays aggregate after a later mail-only check',async()=>{
 const h=harness();h.api.contractSearch(false);h.fill({dice:8,skill:0,characteristic:0,days:14,mailAvailability:12,mailContainers:3});await h.submit();const count=h.api.drafts.filter(c=>c.kind==='freight').length;assert.ok(count>0);await h.check();const r=data(h.api.state,{mailCheck:h.api.check,contractDrafts:h.api.drafts});assert.equal(r.currentOptions.freight.status,'CHECKED');assert.equal(r.currentOptions.freight.availableContracts,count);
});

function fresh(){const s=campaign();s.events=[{id:'setup',label:'Campaign setup',world:s.actual,hours:0}];s.ledger=[{id:'opening',type:'Opening bank',world:s.actual,hours:0,amount:s.bank}];return s;}
test('verified first visit has a clear message and no invented financial zero results',()=>{
 const s=fresh(),before=JSON.stringify(s),r=data(s).previousCompletedVisit;
 assert.deepEqual(r,{status:'NO PREVIOUS VISIT',message:'No previous visit yet',warnings:[]});
 assert.equal(data(s).currentOptions.mail.status,'NOT CHECKED');assert.equal(data(s).currentOptions.passengers.availableByClass,null);assert.equal(JSON.stringify(s),before);
 s.events.push({label:'Contact search audit',world:s.actual});assert.equal(data(s).previousCompletedVisit.status,'NO PREVIOUS VISIT');
});
test('no jumps with missing or ambiguous history cannot confirm a fresh run',()=>{
 for(const mutate of [s=>s.events=[],s=>s.ledger=[],s=>s.bank='1',s=>s.actual='1,0',s=>s.events.push({label:'Jump audit'}),s=>s.events.push({label:'Saved jump'}),s=>s.events.push({label:'Starting-world / location correction'}),s=>s.events.push({label:'Undo: Saved jump'}),s=>s.jumpAttempts=[{closed:true}],s=>s.dashboardBaseline={origin:'current',hours:0,excludedLedgerIds:[]},s=>s.dashboardBaseline={origin:'opening',hours:0,excludedLedgerIds:['missing']},s=>s.ledger.push({type:'Opening bank',amount:'0',world:s.actual,hours:0})]){const s=fresh();mutate(s);assert.equal(data(s).previousCompletedVisit.status,'UNAVAILABLE / INCOMPLETE');assert.equal(data(s).previousCompletedVisit.netOperatingOutcomeCr,undefined);}
});
test('captain prompt requires complete cargo items across three columns without offer sections',()=>{
 const out=playerBriefing(fresh(),core).split('PLAYER-SAFE JSON DATA')[0];assert.match(out,/exactly one page PDF/);assert.match(out,/side by side across THREE columns/);assert.match(out,/Each column holds complete item entries/);assert.match(out,/commodity name, tons, historical percentage of retail/);assert.doesNotMatch(out,/18|two.column/i);assert.match(out,/No previous visit yet.*without financial zeros/);assert.match(out,/white background, pale blue.*green.*amber/);assert.match(out,/FINANCIAL RESULTS ONLY/);assert.match(out,/never backfill from current settings/);assert.match(out,/Do not include available buy\/sell offers or unaccepted quotes/);assert.match(out,/never an instruction/);
});
function cargoFixture(){
 const s=visit(),base={basePrice:20000,rawBasePrice:20000,percent:99,reason:'SECRET RETAIL'},purchase={commodity:'11',description:'SECRET PURCHASE',quantity:'4',unitPrice:'12000',fee:'480',premium:'20',priceAudit:base};
 s.ledger.push({id:'purchase',type:'Purchase',world:s.actual,hours:201,amount:'-48000',lotId:'lot',purchase},{id:'fee',type:'Broker fee',world:s.actual,hours:201,amount:'-480'},{id:'premium',type:'Insurance premium',world:s.actual,hours:201,amount:'-20'},{id:'sold',type:'Sale',world:s.actual,hours:202,amount:'30000',lotId:'sold-lot',audit:{commodity:'11',description:'SECRET SOLD',quantity:'2',unitPrice:'15000',basis:'24000',adjusted:'5700',audit:base}});
 s.bank=String(BigInt(s.bank)-48000n-480n-20n+30000n);
 s.lots=[{id:'lot',commodity:'11',description:'SECRET HELD',quantity:'4',goodsValue:'48000',basis:'48500',audit:{price:{unitPrice:'12000',audit:base}}}];return s;
}
test('completed purchases and sales use current visit ledger with historical unit price, retail and separate costs',()=>{
 const s=cargoFixture(),before=JSON.stringify(s),r=data(s),p=r.currentTransactions.purchases.items[0],sale=r.currentTransactions.sales.items[0];
 assert.equal(r.currentTransactions.title,'Completed Transactions');assert.equal(r.currentTransactions.purchases.status,'RECORDED TRANSACTIONS');assert.equal(p.tons,'4');assert.equal(p.unitGoodsPricePerTonCr,'12000');assert.equal(p.goodsTotalCr,'48000');assert.equal(p.costBasisCr,'48500');assert.equal(p.percentOfRetail,'60.00');assert.equal(sale.unitGoodsPricePerTonCr,'15000');assert.equal(sale.goodsTotalCr,'30000');assert.equal(sale.costBasisCr,'24000');assert.equal(sale.recordedRealizedProfitCr,'5700');assert.equal(sale.percentOfRetail,'75.00');
 assert.equal(r.currentTransactions.sales.items.length,1,'Previous-visit sales excluded');assert.equal(r.previousCompletedVisit.realizedTradingProfitCr,'200');assert.doesNotMatch(JSON.stringify(r),/SECRET|priceAudit|lotId|offerId/);assert.equal(JSON.stringify(s),before);
 s.settings.maxBaseRetailEnabled=true;s.settings.maxBaseRetail='1';s.settings.profit=0;assert.deepEqual(data(s).currentTransactions,r.currentTransactions);
});
test('unaccepted quotes and supplier offers never enter completed cargo sections',()=>{
 const s=fresh();s.snapshots=[{id:'snap',kind:'supplier',worldId:s.actual,offers:[{commodity:'11',remaining:'100',unitPrice:'999',audit:{basePrice:20000}}]}];s.events.push({label:'Contact search audit',world:s.actual,snapshotId:'snap'});
 const r=data(s,{saleQuotes:new Map([['unused',{unitPrice:'999'}]])});assert.equal(r.currentTransactions.purchases.status,'NO COMPLETED TRANSACTIONS');assert.equal(r.currentTransactions.sales.status,'NO COMPLETED TRANSACTIONS');assert.equal(r.currentOptions.sales,undefined);assert.equal(r.currentOptions.purchases,undefined);assert.doesNotMatch(JSON.stringify(r.currentTransactions),/NOT CHECKED|999/);
});
test('missing or ambiguous current-visit history is unavailable, never confirmed no transactions',()=>{
 for(const mutate of [s=>s.events=s.events.filter(e=>e.id!=='b'),s=>s.ledger=s.ledger.slice(1),s=>s.bank='1',s=>s.actual='1,0',s=>s.events.push({label:'Starting-world / location correction'}),s=>s.events.push({label:'Undo: Purchase'}),s=>s.events.push({label:'Jump audit',from:s.actual,to:'1,0'}),s=>s.dashboardBaseline={origin:'current',hours:0,excludedLedgerIds:[]}]){const s=cargoFixture();mutate(s);const r=data(s).currentTransactions;assert.equal(r.purchases.status,'UNAVAILABLE / INCOMPLETE');assert.equal(r.purchases.items,null);assert.equal(r.sales.items,null);}
 assert.equal(data(campaign()).currentTransactions.sales.status,'UNAVAILABLE / INCOMPLETE');
});
test('missing transaction details preserve recorded gross amount but never invent price, basis or profit',()=>{
 const s=cargoFixture();delete s.ledger.find(e=>e.id==='purchase').purchase;delete s.ledger.find(e=>e.id==='sold').audit;
 const r=data(s).currentTransactions;assert.equal(r.purchases.status,'INCOMPLETE');assert.equal(r.purchases.items[0].goodsTotalCr,'48000');assert.equal(r.purchases.items[0].unitGoodsPricePerTonCr,null);assert.equal(r.purchases.items[0].percentOfRetail,null);assert.equal(r.sales.items[0].recordedRealizedProfitCr,null);assert.equal(r.sales.items[0].costBasisCr,null);
});
test('historical capped and RAW retail are explicit; actual saved manual price overrides generated percentage',()=>{
 const s=cargoFixture(),p=s.ledger.find(e=>e.id==='purchase').purchase;p.unitPrice='15000';p.priceAudit={basePrice:10000,rawBasePrice:20000,baseRetailCapApplied:true,percent:85};
 const item=data(s).currentTransactions.purchases.items[0];assert.equal(item.percentOfRetail,'150.00');assert.equal(item.percentOfRawRetail,'75.00');assert.equal(item.retailBasis,'Recorded capped effective retail');
 delete p.priceAudit.basePrice;assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRetail,null);assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRawRetail,'75.00');
});
test('held cargo preserves separate lots, remaining goods and carrying basis plus original purchase prices',()=>{
 const s=cargoFixture();s.lots.push({...structuredClone(s.lots[0]),id:'lot-two',quantity:'2',goodsValue:'28000',basis:'29000',audit:{price:{unitPrice:'14000',audit:{basePrice:20000,rawBasePrice:20000}}}});
 const r=data(s).cargoInHold;assert.equal(r.items.length,2);assert.equal(r.items[0].recordedUnitPurchasePricePerTonCr,'12000');assert.equal(r.items[0].remainingGoodsCostCr,'48000');assert.equal(r.items[0].remainingCostBasisCr,'48500');assert.equal(r.items[0].percentOfRetail,'60.00');assert.equal(r.items[1].percentOfRetail,'70.00');
 s.lots[0].quantity='1';s.lots[0].goodsValue='12000';s.lots[0].basis='12125';assert.equal(data(s).cargoInHold.items[0].percentOfRetail,'60.00');assert.equal(data(s).cargoInHold.items[0].remainingCostBasisCr,'12125');
});
test('legacy and opening cargo retain costs while missing historical purchase retail stays unavailable',()=>{
 const s=fresh();s.lots=[{id:'opening',commodity:'11',quantity:'3',goodsValue:'9000',basis:'10000'}];const r=data(s).cargoInHold;assert.equal(r.status,'INCOMPLETE');assert.equal(r.items[0].percentOfRetail,null);assert.equal(r.items[0].recordedUnitPurchasePricePerTonCr,null);assert.equal(r.items[0].remainingGoodsCostCr,'9000');assert.equal(r.items[0].remainingCostBasisCr,'10000');assert.equal(data(fresh()).cargoInHold.status,'NO CARGO');
});
test('same-hour arrivals and repeated worlds use saved ledger order for completed cargo',()=>{
 const s=cargoFixture();s.ledger.filter(e=>e.type==='Jump').forEach(e=>e.hours=200);s.events.filter(e=>e.label==='Jump audit').forEach(e=>e.hours=200);s.ledger.filter(e=>['purchase','sold'].includes(e.id)).forEach(e=>e.hours=200);assert.equal(data(s).currentTransactions.sales.items.length,1);
});
test('retail display uses exact arithmetic for large amounts, zero prices and repeating ratios',()=>{
 const s=cargoFixture(),p=s.ledger.find(e=>e.id==='purchase').purchase;p.unitPrice='900719925474099399999';p.priceAudit.basePrice='900719925474099399999';assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRetail,'100.00');p.unitPrice='1';p.priceAudit.basePrice='3';assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRetail,'33.33');p.unitPrice='0';assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRetail,'0.00');p.priceAudit.basePrice='0';assert.equal(data(s).currentTransactions.purchases.items[0].percentOfRetail,null);
});

test('null and malformed historical audit bases stay unavailable without breaking export',()=>{
 const s=cargoFixture();s.ledger.find(e=>e.id==='purchase').purchase.priceAudit=null;s.lots[0].audit.price.audit={basePrice:['20000'],rawBasePrice:{value:'20000'}};const r=data(s);assert.equal(r.currentTransactions.purchases.items[0].percentOfRetail,null);assert.equal(r.cargoInHold.items[0].percentOfRetail,null);assert.equal(r.cargoInHold.items[0].percentOfRawRetail,null);
});
