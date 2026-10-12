import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {cmp} from '../js/amounts.mjs';
import {refillQuote,supportStock,supportCargo,supportAmount,configureSupport,consumeSupport,monthlySupport,supportMigration} from '../js/life-support.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {campaignReport} from '../js/report.mjs';

function campaign({awake=4,frozen=0,hull=200,days=14,capacity='60'}={}){
 const s=S.initial();s.bank='100000';s.ship.capacity=capacity;
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:awake,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:frozen,luggageTons:'0'};
 if(hull)s.ship.fuel=configureFuel(hull,Math.max(1,Math.floor(hull/5)),0,0,2);
 s.ship.lifeSupport=configureSupport(s.ship,{targetDays:28,stockDays:days});return S.validate(s);
}
const units=s=>supportStock(s.ship).remainingUnits;
const stock=s=>supportAmount(s.ship.lifeSupport.stockUnits);
const assertExact=(actual,n,d=1)=>assert.equal(cmp(actual,{n:BigInt(n),d:BigInt(d)}),0);
function cargo(s,quantity){s.lots=[{id:'existing',commodity:'11',description:'Existing cargo',quantity,basis:'100',goodsValue:'100'}];return s;}

test('standard top-up buys only the exact deficit; Undo restores stock and money',()=>{
 const s=campaign(),q=refillQuote(s);assert.equal(q.monthly,'8000');assert.equal(q.standardDays,'14');assert.equal(q.amount,'4000');assert.equal(q.purchasedUnits,'56');
 const n=S.transition(s,'Refill',S.refillLifeSupport);assert.equal(n.bank,'96000');assert.equal(units(n),'112');assert.equal(n.hours,0);assert.equal(refillQuote(n).amount,'0');
 assert.throws(()=>S.transition(n,'Again',S.refillLifeSupport),/already full/);assert.deepEqual(S.undo(n).ship,s.ship);assert.equal(S.undo(n).bank,s.bank);
});
test('approved standard plus extra plus comfort example and audit',()=>{
 const s=campaign(),options={extraDays:'14',comfortCost:'2000',comfortNote:'Fresh food and entertainment'},q=refillQuote(s,options);
 assert.equal(q.standardAmount,'4000');assert.equal(q.extraAmount,'2000');assert.equal(q.comfortAmount,'2000');assert.equal(q.amount,'8000');assert.equal(q.afterUnits,'168');assert.equal(q.afterDays,'42');
 const n=S.transition(s,'Refill',x=>S.refillLifeSupport(x,options));assert.equal(units(n),'168');assert.equal(n.bank,'92000');assert.equal(n.ledger.length,1);
 assert.equal(n.ledger[0].expense.extraPricingLabel,'Home rule');assert.match(JSON.stringify(n.ledger[0]),/Cr1000 × 4 person-equivalents × 14 days \/ 28/);assert.match(JSON.stringify(n.ledger[0]),/rounded UP once to Cr100/);assert.match(JSON.stringify(n.ledger[0]),/Cost only/);
 assert.equal(refillQuote(n,{extraDays:'14'}).amount,'0');assert.equal(refillQuote(n,{extraDays:'21'}).extraAmount,'1000');assert.equal(refillQuote(n,{extraDays:'21'}).extraUnits,'28');
 assert.equal(n.ship.lifeSupport.capacityHours,672,'extra provisions do not change the normal target');
});
test('high-service monthly bundle stays in standard top-up; extras use only approved flat rate',()=>{
 const s=campaign();s.ship.accommodation.passengers={low:0,middle:2,high:2};s.ship.accommodation.luggageTons='0';
 assert.equal(monthlySupport(s.ship),12000n);const q=refillQuote(s,{extraDays:14});assert.equal(q.standardAmount,'6000');assert.equal(q.extraAmount,'2000');
});
test('full stock still permits extra provisions or comfort-only cost; old stock is credited',()=>{
 const s=campaign({days:28});assert.equal(refillQuote(s,{extraDays:14}).standardAmount,'0');assert.equal(refillQuote(s,{extraDays:14}).amount,'2000');
 const n=S.transition(s,'Comfort',x=>S.refillLifeSupport(x,{comfortCost:'777',comfortNote:'Luxury meal'}));assert.deepEqual(n.ship.lifeSupport,s.ship.lifeSupport);assert.equal(n.bank,'99223');
 assert.throws(()=>refillQuote(s,{comfortCost:'1'}),/note/);assert.throws(()=>refillQuote(s,{extraDays:-1}),/negative/);
});
test('fractional consumption happens every hour exactly, including actual low berths',()=>{
 let s=campaign({awake:1,frozen:1,days:2});assert.equal(units(s),'2.2');
 s=S.transition(s,'One hour',n=>n.hours++);assertExact(stock(s),517,240);assert.equal(supportStock(s.ship).dailyUnits,'1.1');
 for(let i=1;i<24;i++)s=S.transition(s,'One hour',n=>n.hours++);
 assert.equal(units(s),'1.1');assert.equal(supportStock(s.ship).remainingDays,'1');
 const n=S.transition(s,'Exhaust',x=>x.hours+=1000);assert.equal(units(n),'0');assert.deepEqual(S.undo(n).ship.lifeSupport,s.ship.lifeSupport);
});
test('frozen extra headcount charges one tenth and rounds combined extra charge once to Cr100',()=>{
 const s=campaign({awake:0,frozen:1,days:28}),q=refillQuote(s,{extraDays:1});assert.equal(q.extraHeadcount,'0.1');assert.equal(q.extraUnits,'0.1');assert.equal(q.extraAmount,'100');assert.equal(q.standardAmount,'0');
 const mixed=campaign({awake:1,frozen:1,days:28}),m=refillQuote(mixed,{extraDays:1});assert.equal(m.extraHeadcount,'1.1');assert.equal(m.extraAmount,'100');assert.deepEqual(m.extraExact,{numerator:'275',denominator:'7'});
});
test('partial refill retains the fraction instead of charging a whole consumed day',()=>{
 const s=campaign({days:28});const n=S.transition(s,'Six hours',x=>x.hours+=6);assert.equal(units(n),'111');
 const q=refillQuote(n);assert.equal(q.standardDays,'0.25');assert.equal(q.standardAmount,'72');assert.equal(q.purchasedUnits,'1');
 const refilled=S.transition(n,'Refill',S.refillLifeSupport);assert.equal(units(refilled),'112');assert.deepEqual(S.undo(refilled).ship.lifeSupport,n.ship.lifeSupport);
 const rounded=structuredClone(n);rounded.settings.creditStep=100;assert.equal(refillQuote(rounded).standardAmount,'100');
});
test('internal capacity covers all stock; overflow reserves exact cargo and consumption releases it',()=>{
 let s=campaign({hull:10,days:14});assert.equal(supportStock(s.ship).internalCapacityUnits,'40');assert.equal(supportStock(s.ship).internalUnits,'40');assert.equal(supportStock(s.ship).cargoTons,'0.16');assertExact(S.used(s),4,25);
 s=S.transition(s,'One hour',x=>x.hours++);assertExact(supportCargo(s.ship),19,120);assertExact(S.used(s),19,120);
 const full=campaign({hull:10,days:10});assert.equal(supportStock(full.ship).cargoTons,'0');assertExact(S.used(full),0);
});
test('fractional capacity boundary succeeds and overflow failures are fully atomic',()=>{
 const s=cargo(campaign({hull:10,days:10,capacity:'1'}),'0.28');S.validate(s);
 const q=refillQuote(s);assert.equal(q.afterCargoTons,'0.72');const n=S.transition(s,'Refill',S.refillLifeSupport);assertExact(S.used(n),1);
 const tooFull=cargo(campaign({hull:10,days:10,capacity:'1'}),'0.2801'),before=JSON.stringify(tooFull);
 assert.throws(()=>S.refillLifeSupport(tooFull),/exceed cargo/);assert.equal(JSON.stringify(tooFull),before);
 assert.throws(()=>S.transition(tooFull,'Refill',S.refillLifeSupport),/exceed cargo/);assert.equal(JSON.stringify(tooFull),before);
 const poor=campaign();poor.bank='1';const original=JSON.stringify(poor);assert.throws(()=>S.refillLifeSupport(poor),/Insufficient/);assert.equal(JSON.stringify(poor),original);
});
test('fuel bladders, luggage and LSS share cargo capacity atomically',()=>{
 const s=campaign({hull:10,days:28,capacity:'3'});s.ship.fuel=configureFuel(10,2,2,2,2);s.ship.accommodation.luggageTons='1';s.worlds={'0,0':{id:'0,0',x:0,y:0,sector:'Test',hex:'0101',zone:'Safe',name:'Port',uwp:'A000000-0'}};s.actual='0,0';
 assertExact(S.used(s),43,25);const before=JSON.stringify(s);
 assert.throws(()=>S.transition(s,'Fuel',x=>S.shipExpense(x,{kind:'fuel',fuelType:'refined',tons:'2'})),/capacity/);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>S.transition(s,'Luggage',x=>x.ship.accommodation.luggageTons='3'),/capacity/);assert.equal(JSON.stringify(s),before);
});
test('complement edits preserve units and elapsed time consumes the original complement',()=>{
 const s=campaign();const n=S.transition(s,'Double complement',x=>x.ship.accommodation.passengers.middle=8);assert.equal(units(n),'56');assert.equal(supportStock(n.ship).remainingDays,'7');
 const simultaneous=S.transition(s,'Travel then double complement',x=>{x.hours+=24;x.ship.accommodation.passengers.middle=8;});assert.equal(units(simultaneous),'52');assert.equal(supportStock(simultaneous.ship).remainingDays,'6.5');
 const configured=S.transition(s,'Settings',x=>{x.ship.accommodation.passengers.middle=8;x.ship.lifeSupport=configureSupport(x.ship,{targetDays:35});});assert.equal(units(configured),'56');assert.equal(configured.ship.lifeSupport.capacityHours,840);
 assert.deepEqual(S.undo(configured).ship,s.ship);
});
test('legacy days preserve actual endurance including partial elapsed and old inverse history',()=>{
 const s=campaign();s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};const raw=JSON.stringify(s);S.validate(s);assert.equal(JSON.stringify(s),raw);
 assert.equal(supportStock(s.ship).remainingDays,'13.75');assert.equal(supportStock(s.ship).remainingUnits,'55');
 const q=refillQuote(s);assert.equal(q.standardDays,'14.25');assert.equal(q.standardAmount,'4072');
 const n=S.transition(s,'Double complement',x=>x.ship.accommodation.passengers.middle=8);assert.equal(units(n),'55');assert.equal(supportStock(n.ship).remainingDays,'6.875');assert.deepEqual(S.undo(n).ship,s.ship);
 const legacy=campaign();legacy.ship.lifeSupport={capacityHours:672,remainingHours:650};assert.equal(supportStock(legacy.ship).remainingDays,'27.083333');const after=S.transition(legacy,'Two hours',x=>x.hours+=2);assert.equal(units(after),'108');assert.deepEqual(S.undo(after).ship,legacy.ship);
 // An old inverse can still restore hour fields after migration is undone.
 const old=campaign();old.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};old.hours=6;old.undo=[{id:'old',label:'Old six hours',inverse:[{path:['hours'],value:0},{path:['ship','lifeSupport','elapsedHours'],value:0}]}];
 const migrated=S.transition(old,'New note',x=>x.ship.name='New');const first=S.undo(migrated),second=S.undo(first);assert.equal(first.ship.lifeSupport.elapsedHours,6);assert.equal(second.ship.lifeSupport.elapsedHours,0);assert.equal(second.hours,0);
});
test('unknown or zero legacy complement never invents stock; explicit inventory resolves it',()=>{
 for(const unknown of [false,true]){const s=campaign({awake:0,days:0});s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};if(unknown)delete s.ship.accommodation;
  const raw=JSON.stringify(s);S.validate(s);assert.equal(JSON.stringify(s),raw);assert.equal(supportStock(s.ship).remainingUnits,null);
  const n=S.transition(s,'Wait',x=>x.hours+=24);assert.equal(n.ship.lifeSupport.remainingHours,336);assert.equal(n.ship.lifeSupport.elapsedHours,6);assert.equal(n.ship.lifeSupport.migrationRequired,true);assert.equal(supportMigration(n.ship).possible,false);
  const a=S.transition(n,'Set complement',x=>x.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}});assert.equal(supportStock(a.ship).remainingUnits,null);
  const b=S.transition(a,'Confirm inventory',x=>x.ship.lifeSupport=configureSupport(x.ship,{stockDays:13.75}));assert.equal(units(b),'55');assert.deepEqual(S.undo(b).ship,a.ship);
 }
});
test('zero-complement physical stock stays aboard and missing hull does not invalidate saves',()=>{
 const s=campaign();s.ship.accommodation.passengers.middle=0;const n=S.transition(s,'Wait',x=>x.hours+=240);assert.equal(units(n),'56');assert.equal(supportStock(n.ship).remainingDays,null);assert.throws(()=>refillQuote(n),/positive/);
 const missing=campaign();delete missing.ship.fuel;assert.equal(S.validate(missing),missing);assert.equal(supportStock(missing.ship).internalCapacityUnits,null);assert.throws(()=>refillQuote(missing),/displacement/);
 const advance=S.transition(missing,'One hour',x=>x.hours++);assertExact(stock(advance),335,6);assert.deepEqual(S.undo(advance).ship,missing.ship);
});
test('legacy low-service headcount is never interpreted as occupied low berths',()=>{
 const s=campaign();s.ship.accommodation.passengers.low=9;assert.equal(supportStock(s.ship).occupiedLowBerths,0);assert.equal(supportStock(s.ship).dailyUnits,'13');
 s.ship.accommodation.occupiedLowBerths=2;assert.equal(supportStock(s.ship).dailyUnits,'13.2');assert.throws(()=>S.validate({...s,ship:{...s.ship,accommodation:{...s.ship.accommodation,occupiedLowBerths:0.5}}}),/whole/);
});
test('rollback does not create supplies and fractional stock survives reload/import/report',()=>{
 const s=campaign({hull:10});const n=S.transition(s,'One hour',x=>x.hours++),back=S.transition(n,'Correct time',x=>x.hours=0);assert.deepEqual(back.ship.lifeSupport,n.ship.lifeSupport);assert.deepEqual(S.undo(back).ship.lifeSupport,n.ship.lifeSupport);
 const loaded=S.validate(JSON.parse(JSON.stringify(n)));assert.deepEqual(loaded,n);assertExact(S.used(loaded),19,120);
 const text=campaignReport(loaded,{commodities:[]},{exportedAt:new Date('2026-10-09T00:00:00Z')});assert.match(text,/55\.833333 LSS/);assert.match(text,/Cluster Truck, p\. 14/);assert.doesNotMatch(text,/NaN|undefined/);
});
test('invalid stock and negative options fail without rewriting history',()=>{
 const s=campaign();for(const stockUnits of [{numerator:'-1',denominator:'1'},{numerator:'1',denominator:'0'},'NaN'])assert.throws(()=>S.validate({...s,ship:{...s.ship,lifeSupport:{capacityHours:672,stockUnits}}}));
 for(const remainingHours of [-1,673,0.5,null])assert.throws(()=>S.validate({...s,ship:{...s.ship,lifeSupport:{capacityHours:672,remainingHours}}}));
 s.ledger=[{id:'historic',type:'Old refill',amount:'-150',hours:0}];const n=S.transition(s,'Settings',x=>x.ship.name='Changed');assert.deepEqual(n.ledger,s.ledger);
 delete s.ship.lifeSupport;assert.equal(S.validate(s),s);assert.throws(()=>refillQuote(s),/Set life support/);
});

test('Jump consumes exact physical supplies and dedicated Undo restores stock, cargo, time and fuel',()=>{
 const s=campaign({hull:10,days:14});
 const world=(x,name)=>({id:x+',0',x,y:0,sector:'Test',hex:'0'+(x+1)+'01',zone:'Safe',name,uwp:'A000000-0'});
 Object.assign(s,{initialized:true,actual:'0,0',worlds:{'0,0':world(0,'Origin'),'1,0':world(1,'Destination')},route:['0,0','1,0']});s.ship.fuel.aboardTons=2;
 const p=S.prepareJump(s,()=>({dice:[2,2,2,2,2,2],total:12}));
 const jumped=S.transition(p.state,'Jump: Origin → Destination',x=>S.commitJump(x,{attemptId:p.attempt.id,elapsed:25}));
 assertExact(stock(jumped),311,6);assertExact(supportCargo(jumped.ship),71,600);assert.equal(jumped.hours,25);assert.equal(jumped.ship.fuel.aboardTons,1);
 const reload=S.validate(JSON.parse(JSON.stringify(jumped))),undone=S.undoJump(reload);assert.deepEqual(undone.ship,s.ship);assert.equal(undone.hours,0);assert.equal(undone.actual,'0,0');assert.equal(undone.bank,s.bank);assert.deepEqual(undone.ledger,s.ledger);
});

test('switching between awake and frozen changes future consumption only, and fractions do not drift',()=>{
 const s=campaign({awake:1,days:1});let n=S.transition(s,'Enter low berth',x=>{x.ship.accommodation.passengers.middle=0;x.ship.accommodation.occupiedLowBerths=1;});
 assert.equal(units(n),'1');assert.equal(supportStock(n.ship).remainingDays,'10');
 for(let hour=0;hour<240;hour++)consumeSupport(n.ship,1);
 assert.equal(units(n),'0');assertExact(supportCargo(n.ship),0);
 const one=campaign({awake:1,days:1});const u=S.transition(one,'One hour',x=>x.hours++);assertExact(stock(u),23,24);
 const again=S.transition(S.validate(JSON.parse(JSON.stringify(u))),'Twenty-three hours',x=>x.hours+=23);assert.equal(units(again),'0');
});


test('legacy refill billing headcounts alone do not establish a physical manifest',()=>{
 const s=campaign();s.ship.supportOccupants={passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};delete s.ship.accommodation;s.ship.lifeSupport={capacityHours:672,remainingHours:336};
 assert.equal(supportStock(s.ship).complementKnown,false);assert.equal(supportStock(s.ship).remainingUnits,null);assert.equal(monthlySupport(s.ship),4000n);
 const n=S.transition(s,'Wait',x=>x.hours+=24);assert.equal(n.ship.lifeSupport.remainingHours,336);assert.equal(n.ship.lifeSupport.migrationRequired,true);assert.deepEqual(S.undo(n).ship,s.ship);
});


test('an unconfigured zero monthly bundle cannot create free standard LSS',()=>{
 const s=campaign({awake:0,frozen:1,days:0});s.ship.accommodation.rooms.middle=0;
 assert.throws(()=>refillQuote(s),/service charges/);s.ship.accommodation.rooms.low=1;assert.equal(refillQuote(s).standardAmount,'100');
});

for(const [need,before,purchase]of [['0.4','2.4','0.6'],['0.5','2.3','0.7'],['0.6','2.2','0.8'],['1','1.8','1.2'],['1.1','1.7','1.3']])test(`fractional Low stock ${before} rounds resulting stock to 3, adding ${purchase}`,()=>{const s=campaign({awake:0,frozen:1,days:0});s.ship.accommodation.rooms={low:1,middle:0,high:0};s.ship.lifeSupport=configureSupport(s.ship,{targetDays:28,stockUnits:before});const q=refillQuote(s);assert.equal(q.purchasedUnits,purchase);assert.equal(q.roundPostPurchaseTotal,true);assert.equal(q.nominalPurchasedUnits,need);assert.equal(q.afterUnits,'3');assert.equal(q.afterDays,'30');assert.equal(q.dailyUnits,'0.1');assertExact(supportAmount(q.afterStockUnits),3);});
test('Low rounds the combined standard and reserve purchase, preserves period charges and retains surplus',()=>{const s=campaign({awake:0,frozen:1,days:0});s.ship.accommodation.rooms={low:1,middle:0,high:0};s.ship.lifeSupport=configureSupport(s.ship,{targetDays:4,stockUnits:'0'});const q=refillQuote(s,{extraDays:'4'});assert.equal(q.standardUnits,'0.4');assert.equal(q.extraUnits,'0.4');assert.equal(q.purchasedUnits,'1');assert.equal(q.nominalPurchasedUnits,'0.8');assert.equal(q.purchaseSurplusUnits,'0.2');assert.equal(q.afterDays,'10');assert.equal(q.standardAmount,'15');assert.equal(q.extraAmount,'100');const n=S.transition(s,'Refill',x=>S.refillLifeSupport(x,{extraDays:'4'}));assert.equal(units(n),'1');assert.equal(n.bank,'99885');const undone=S.undo(n);assert.deepEqual(undone.ship,s.ship);assert.equal(undone.bank,s.bank);});
test('zero Low requirement stays zero and comfort changes only money',()=>{const s=campaign({awake:0,frozen:1,days:28}),q=refillQuote(s);assert.equal(q.purchasedUnits,'0');assert.equal(q.amount,'0');const comfort=refillQuote(s,{comfortCost:'1000',comfortNote:'Coffee only'});assert.equal(comfort.purchasedUnits,'0');assert.equal(comfort.afterUnits,q.beforeUnits);assert.equal(comfort.amount,'1000');assert.equal(comfort.standardAmount,'0');assert.equal(comfort.extraAmount,'0');});
test('without occupied Low, the purchase can be fractional to finish at a whole stock total',()=>{const s=campaign({awake:1,days:0});s.ship.lifeSupport=configureSupport(s.ship,{targetDays:2,stockUnits:'1.6'});const q=refillQuote(s);assert.equal(q.purchasedUnits,'0.4');assert.equal(q.afterUnits,'2');assert.equal(q.roundPostPurchaseTotal,true);});

test('12.1 aboard tops up to 13 by adding 0.9, with exact cost and Undo',()=>{const s=campaign({awake:1,days:0});s.ship.lifeSupport=configureSupport(s.ship,{targetDays:13,stockUnits:'12.1'});const q=refillQuote(s);assert.equal(q.purchasedUnits,'0.9');assert.equal(q.afterUnits,'13');assert.equal(q.purchaseSurplusUnits,'0');assert.equal(q.standardAmount,'161');const n=S.transition(s,'Refill',S.refillLifeSupport);assert.equal(units(n),'13');assert.equal(n.bank,'99839');assert.deepEqual(S.undo(n).ship,s.ship);assert.equal(S.undo(n).bank,s.bank);});
test('fractional full stock stays exact for no-purchase and comfort-only spending',()=>{const s=campaign({awake:1,days:0});s.ship.lifeSupport=configureSupport(s.ship,{targetDays:13,stockUnits:'14.1'});const q=refillQuote(s);assert.equal(q.purchasedUnits,'0');assert.equal(q.afterUnits,'14.1');assert.equal(q.roundPostPurchaseTotal,false);const n=S.transition(s,'Comfort',x=>S.refillLifeSupport(x,{comfortCost:'1000',comfortNote:'Quality only'}));assert.deepEqual(n.ship.lifeSupport,s.ship.lifeSupport);assert.equal(n.bank,'99000');});

test('Top off 28 then add 7 reaches 35 days; add-only 7 reaches 21',()=>{const s=campaign();const add=refillQuote(s,{addDays:'7'});assert.equal(add.afterDays,'21');assert.equal(add.purchasedUnits,'28');assert.equal(add.amount,'2000');const top=refillQuote(s,{topOffDays:'28',addDays:'7'});assert.equal(top.afterDays,'35');assert.equal(top.purchasedUnits,'84');assert.equal(top.amount,'5000');assert.equal(top.basicSupplyCharge,'3000');assert.equal(top.cabinCharge,'2000');assert.equal(top.highServiceCharge,'0');assert.equal(top.priceRounding,'0');});
test('Top off 28 preserves configured target and never removes supplies above 28',()=>{const s=campaign();s.ship.lifeSupport=configureSupport(s.ship,{targetDays:14,stockDays:14});const top=refillQuote(s,{topOffDays:'28',addDays:'0'}),add=refillQuote(s,{addDays:'14'});assert.equal(top.afterDays,'28');assert.equal(top.amount,add.amount);assert.equal(top.amount,'2000');const n=S.transition(s,'Top off',x=>S.refillLifeSupport(x,{topOffDays:'28',addDays:'0'}));assert.equal(n.ship.lifeSupport.capacityHours,336);const full=campaign({days:35}),q=refillQuote(full,{topOffDays:'28',addDays:'0'});assert.equal(q.purchasedUnits,'0');assert.equal(q.afterDays,'35');assert.equal(q.amount,'0');assert.equal(q.roundPostPurchaseTotal,false);});
test('day purchase rounds final stock before cargo admission and includes surplus overflow',()=>{const s=campaign({awake:1,hull:1,capacity:'0.005',days:0});s.ship.lifeSupport=configureSupport(s.ship,{targetDays:28,stockUnits:'3.1'});const q=refillQuote(s,{addDays:'1'});assert.equal(q.afterUnits,'5');assert.equal(q.purchasedUnits,'1.9');assert.equal(q.afterInternalUnits,'4');assert.equal(q.afterCargoTons,'0.01');assert.throws(()=>S.transition(s,'Too much',x=>S.refillLifeSupport(x,{addDays:'1'})),/cargo capacity/);assert.equal(units(s),'3.1');});
test('High and comfort increase costs without increasing daily use or physical day quantity',()=>{const s=campaign();s.ship.accommodation.passengers={low:0,middle:2,high:2};const q=refillQuote(s,{topOffDays:'28',addDays:'0',comfortCost:'1000',comfortNote:'Quality only'});assert.equal(q.dailyUnits,'4');assert.equal(q.purchasedUnits,'56');assert.equal(q.basicSupplyCharge,'2000');assert.equal(q.cabinCharge,'2000');assert.equal(q.highServiceCharge,'2000');assert.equal(q.comfortAmount,'1000');assert.equal(q.amount,'7000');});
