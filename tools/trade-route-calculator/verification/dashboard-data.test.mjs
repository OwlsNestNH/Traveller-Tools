import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {createDashboardBaseline,validateDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';
import {recordedOperatingResult} from '../js/financial-summary.mjs';
const world={id:'0,0',name:'Origin',sector:'Test',hex:'0101',x:0,y:0,uwp:'A788899-C',zone:'Safe'};
function setup(bank='1000'){
 return S.transition(S.initial(),'Campaign setup',s=>{Object.assign(s,{initialized:true,bank,dateLabel:'123-1106',actual:world.id,worlds:{[world.id]:world},route:[world.id]});s.ledger.push({id:'opening',type:'Opening bank',amount:bank,hours:0,world:world.id});});
}
function append(s,type,amount,detail={}){s.ledger.push({id:'row-'+s.ledger.length,type,amount:String(amount),hours:s.hours,world:s.actual,...detail});s.bank=String(BigInt(s.bank)+BigInt(amount));}
test('new campaign fixed opening baseline is counted once and reads are pure',()=>{
 const s=setup(),raw=JSON.stringify(s),d=dashboardData(s);assert.equal(d.baseline.origin,'opening');assert.equal(d.baseline.bank,'1000');assert.deepEqual(d.baseline.excludedLedgerIds,['opening']);assert.equal(d.cashPoints.length,1);assert.equal(d.cashPoints[0].date,'123-1106 · 00:00');assert.equal(d.currentBank,'1000');assert.equal(d.operatingResult,'0');assert.deepEqual(d.income,[]);assert.equal(JSON.stringify(s),raw);
});
test('existing campaign snapshot excludes its complete earlier ledger without reconstruction',()=>{
 const s=setup();delete s.dashboardBaseline;append(s,'Manual expense',-100);s.hours=50;s.dashboardBaseline=createDashboardBaseline(s);append(s,'Manual deposit',20);const d=dashboardData(s);assert.equal(d.baseline.bank,'900');assert.equal(d.baseline.hours,50);assert.equal(d.cashPoints.length,2);assert.equal(d.otherInflows,'20');assert.equal(d.currentBank,'920');assert.deepEqual(d.expenses,[]);assert.equal(d.operatingResult,'0');
});
test('current ledger drives exact cash and shared realized result with no double counting',()=>{
 const s=setup('10000');append(s,'Purchase',-1000);append(s,'Broker fee',-100);append(s,'Insurance premium',-50);append(s,'Sale',2000,{audit:{adjusted:'650',basis:'1150',fee:'100',tax:'100',adjustment:'0'}});append(s,'Broker fee',-100);append(s,'Tax',-100);append(s,'Freight delivery',500);append(s,'Mail delivery',100);append(s,'Passenger delivery',200);append(s,'Ship expense · Fuel',-300,{expense:{kind:'fuel',label:'Historic label'}});append(s,'Manual expense',-50);append(s,'Manual deposit',700);append(s,'Referee bank correction',-20);append(s,'Rounding adjustment',10);append(s,'Insurance claim',250,{basisWrittenOff:'400'});
 const d=dashboardData(s);assert.equal(d.currentBank,'12040');assert.equal(d.cashPoints.at(-1).balance,s.bank);assert.equal(d.adjustment,'0');assert.equal(d.operatingResult,'1100');assert.equal(d.operatingResult,recordedOperatingResult(s.ledger).result);assert.equal(d.otherInflows,'710');assert.equal(d.otherOutflows,'20');assert.equal(d.expenses.find(e=>e.label==='Fuel').amount,'300');assert.equal(d.income.find(e=>e.label==='Insurance claims').amount,'250');
});
test('partial saved profits and prior cargo are realized only at sale; missing audits are incomplete',()=>{
 const s=setup();s.lots=[{basis:'90000'}];assert.equal(dashboardData(s).operatingResult,'0');append(s,'Sale',300,{audit:{adjusted:'50'}});append(s,'Sale',400,{audit:{adjusted:'-25'}});assert.equal(dashboardData(s).operatingResult,'25');append(s,'Sale',500);assert.equal(dashboardData(s).operatingResult,null);assert.equal(dashboardData(s).visits[0].result,null);assert.equal(dashboardData(s).cashPoints.at(-1).balance,'2200');
});
test('saved order distinguishes same-hour jump visits and backwards clock changes',()=>{
 const s=setup();append(s,'Manual expense',-10);append(s,'Jump',0,{from:'0,0',to:'0,0'});append(s,'Mail delivery',25);s.hours=20;append(s,'Manual expense',-5);s.hours=1;append(s,'Jump',0,{from:'0,0',to:'0,0'});append(s,'Freight delivery',40);const d=dashboardData(s);assert.deepEqual(d.visits.map(v=>v.result),['-10','20','40']);assert.match(d.visits.at(-1).label,/ongoing/);assert.deepEqual(d.cashPoints.map(p=>p.balance),['1000','990','1015','1010','1050']);
});
test('Undo before fixed baseline reconciles visibly and subsequent new IDs still track',()=>{
 let s=setup();s=S.transition(s,'Old expense',x=>S.expense(x,100,'Before tracking'));s.dashboardBaseline=createDashboardBaseline(s);const b=structuredClone(s.dashboardBaseline);s=S.undo(s);assert.deepEqual(s.dashboardBaseline,b);let d=dashboardData(s);assert.equal(d.adjustment,'100');assert.equal(d.operatingResult,'0');assert.equal(d.cashPoints[0].balance,'900');assert.equal(d.cashPoints[1].balance,'1000');s=S.transition(s,'New expense',x=>S.expense(x,30,'After Undo'));d=dashboardData(s);assert.equal(d.adjustment,'100');assert.equal(d.operatingResult,'-30');assert.equal(d.cashPoints.at(-1).balance,'970');assert.deepEqual(s.dashboardBaseline,b);s=S.undo(s);assert.equal(dashboardData(s).operatingResult,'0');assert.equal(dashboardData(s).currentBank,'1000');
});
test('Undo setup retains baseline as metadata and fresh setup establishes new campaign opening',()=>{
 const initial=setup(),undone=S.undo(initial);assert.equal(undone.initialized,false);assert.deepEqual(undone.dashboardBaseline,initial.dashboardBaseline);assert.equal(dashboardData(undone),null);const restarted=S.transition(undone,'Campaign setup',s=>{Object.assign(s,{initialized:true,bank:'500',dateLabel:'321-1200',actual:world.id,worlds:{[world.id]:world},route:[world.id]});s.ledger.push({id:'new-opening',type:'Opening bank',amount:'500',hours:0,world:world.id});});assert.equal(restarted.dashboardBaseline.bank,'500');assert.equal(restarted.dashboardBaseline.dateLabel,'321-1200');assert.deepEqual(restarted.dashboardBaseline.excludedLedgerIds,['new-opening']);
});
test('big integer money, negative balances, unknown and legacy categories stay exact',()=>{
 const s=setup('900719925474099312345');append(s,'Unknown old category',-1);append(s,'Ship expense old',-2);append(s,'Insurance amendment',3);const d=dashboardData(s);assert.equal(d.currentBank,'900719925474099312345');assert.equal(d.expenses.find(e=>e.label==='Other / unclassified').amount,'1');assert.equal(d.expenses.find(e=>e.label==='Other ship expenses').amount,'2');s.bank='-50';s.dashboardBaseline=createDashboardBaseline(s);assert.doesNotThrow(()=>validateDashboardBaseline(s));assert.equal(dashboardData(s).cashPoints[0].balance,'-50');
});
test('baseline validation is intrinsic, nonmutating and rejects unsupported/corrupt metadata',()=>{
 const s=setup();s.dashboardBaseline.hours=100;s.dashboardBaseline.bank='-1';s.dashboardBaseline.dateLabel='';s.dashboardBaseline.excludedLedgerIds=['removed-old-entry'];const bytes=JSON.stringify(s);validateDashboardBaseline(s);assert.equal(JSON.stringify(s),bytes);for(const mutate of [b=>b.version=2,b=>b.bank='1.2',b=>b.hours=-1,b=>b.dateLabel=1,b=>b.excludedLedgerIds=['x','x'],b=>b.excludedLedgerIds=['<bad>'],b=>b.origin='guess']){const clone=structuredClone(s);mutate(clone.dashboardBaseline);assert.throws(()=>validateDashboardBaseline(clone));}const clone=structuredClone(s);clone.undo.at(-1).inverse.push({path:['dashboardBaseline'],remove:true});assert.throws(()=>S.validate(clone),/undo path/);
});
test('aggregated category totals may exceed individual Credit input width without losing precision',()=>{
 const s=setup('0'),amount='9'.repeat(49);for(let i=0;i<20;i++){append(s,'Large receipt',amount);append(s,'Large payment','-'+amount);}append(s,'Sale',1,{audit:{adjusted:'0'}});append(s,'Manual expense',-1);const d=dashboardData(s);assert.equal(d.currentBank,'0');assert.equal(d.income.find(e=>e.label==='Other / unclassified').amount,String(BigInt(amount)*20n));assert.equal(d.expenses.find(e=>e.label==='Other / unclassified').amount,String(BigInt(amount)*20n));
});
