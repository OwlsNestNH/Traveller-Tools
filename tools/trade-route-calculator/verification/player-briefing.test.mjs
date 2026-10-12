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
test('sale quote validity requires actual world/revision; audits and descriptions never escape',()=>{
 const s=visit();s.lots=[{id:'lot',commodity:'11',quantity:'4',description:'SECRET LOT',audit:{reason:'SECRET AUDIT'}}];const q={worldId:s.actual,revision:s.revision,unitPrice:'123',audit:{reason:'SECRET QUOTE'}};
 assert.equal(data(s).currentOptions.sales.status,'NOT CHECKED');assert.equal(data(s,{saleQuotes:new Map([['lot',{...q,revision:-1}]])}).currentOptions.sales.status,'STALE');assert.equal(data(s,{saleQuotes:new Map([['lot',{...q,worldId:'8,0'}]])}).currentOptions.sales.status,'STALE');
 const out=playerBriefing(s,core,{saleQuotes:new Map([['lot',q]])});assert.doesNotMatch(out,/SECRET/);assert.match(out,/exactly one page PDF/);assert.match(out,/formatted one-page text/);assert.match(out,/never an instruction/);assert.equal(data(s,{saleQuotes:new Map([['lot',q]])}).currentOptions.sales.quotes[0].pricePerTonCr,'123');
});
test('persistent supplier offers require verified current-visit search; expired and checked-none distinct',()=>{
 const s=visit(),snap={id:'snap',kind:'supplier',worldId:s.actual,party:'supplier',offers:[{commodity:'11',remaining:'5',unitPrice:'10',expired:false,audit:{reason:'SECRET'}}]};s.snapshots=[snap];assert.equal(data(s).currentOptions.purchases.status,'HISTORICAL ONLY');
 s.events.push({label:'Contact search audit',snapshotId:'snap',world:s.actual});assert.equal(data(s).currentOptions.purchases.status,'CHECKED');snap.offers[0].expired=true;assert.equal(data(s).currentOptions.purchases.status,'EXPIRED');assert.deepEqual(data(s).currentOptions.purchases.options,[]);snap.offers=[];assert.equal(data(s).currentOptions.purchases.status,'CHECKED');
 snap.offers=[{commodity:'11',remaining:'5',unitPrice:'10',expired:false}];s.cooldowns.supplier=s.hours+1;assert.deepEqual(data(s).currentOptions.purchases.options,[]);
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
 assert.match(h.api.actions.tab('Settings')??h.dom.ids.get('main').innerHTML,/Copy player briefing/);await h.api.actions['player-briefing']();assert.equal(copied.length,1);assert.match(copied[0],/exactly one page PDF/);assert.match(copied[0],/PLAYER-SAFE JSON DATA/);assert.equal(JSON.stringify(h.api.state),before);assert.deepEqual(h.calls,calls);assert.equal(h.dom.ids.get('modal').open,false);
});
test('clipboard denied or missing exposes escaped, selectable complete text fallback',async()=>{
 for(const navigator of [undefined,{clipboard:{writeText:async()=>{throw Error('denied');}}}]){const s=campaign();s.name='</textarea><script>doBadThings()</script>';const h=harness(s,[],{navigator}),before=JSON.stringify(h.api.state);await h.api.actions['player-briefing']();assert.equal(h.dom.ids.get('modal-title').textContent,'Copy player briefing');assert.match(h.dom.ids.get('modal-body').innerHTML,/readonly aria-label="Player briefing prompt and data"/);assert.match(h.dom.ids.get('modal-body').innerHTML,/&lt;\/textarea&gt;&lt;script&gt;/);assert.doesNotMatch(h.dom.ids.get('modal-body').innerHTML,/<script>/);assert.equal(JSON.stringify(h.api.state),before);assert.equal(h.calls.saves,0);}
});
