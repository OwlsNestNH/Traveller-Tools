import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringExpenseDetails} from '../js/expenses.mjs';
import * as S from '../js/state.mjs';
import {configureMaintenance,validateMaintenance,maintenancePaymentQuote,maintenanceStatus} from '../js/maintenance.mjs';
function campaign(){
 const s=S.initial();s.bank='500000';s.actual='0,0';s.initialized=true;s.worlds[s.actual]={id:s.actual,name:'Maintenance test',sector:'Test',hex:'0101',x:0,y:0,uwp:'E000000-0',zone:'Safe'};s.route=[s.actual];
 s.ship.maintenance=configureMaintenance({payment:'2001',nextDueDate:'015-1105'});
 s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
 return S.validate(s);
}
const pay=(s,periods=1)=>S.transition(s,'Paid maintenance expense',n=>S.shipExpenses(n,[{kind:'maintenance',maintenancePayments:periods}]));
test('maintenance configuration starts a distinct schedule without guessing past payments',()=>{
 assert.equal(configureMaintenance(),undefined);assert.throws(()=>configureMaintenance({payment:'2000'}),/both/);
 const s=campaign();assert.equal(s.ship.maintenance.paidSinceTracking,'0');assert.equal(s.ship.maintenance.lastPaidDueDate,undefined);
 assert.equal(maintenanceStatus(s).duePayments,'0');assert.equal(maintenanceStatus(S.initial()),null);
});
test('advance payment increments only its own schedule and exact tracked total; Undo restores it all',()=>{
 const s=campaign();s.settings.creditStep=100;const before=JSON.stringify(s),q=maintenancePaymentQuote(s,3);
 assert.equal(q.amount,'6003');assert.equal(q.firstDueDate,'015-1105');assert.equal(q.lastDueDate,'071-1105');assert.equal(q.after.nextDueDate,'099-1105');
 assert.equal(q.after.paidSinceTracking,'6003');assert.equal(JSON.stringify(s),before);
 const n=pay(s,3);assert.equal(n.bank,'493997');assert.deepEqual(n.ship.maintenance,q.after);assert.deepEqual(n.ship.mortgage,s.ship.mortgage);
 assert.equal(n.ledger[0].roundingStep,1);assert.equal(n.ledger[0].expense.fixedAmount,true);assert.equal(n.hours,0);
 const undone=S.undo(n);for(const key of ['bank','ship','ledger','hours'])assert.deepEqual(undone[key],s[key]);
});
test('mortgage, maintenance and salary can prepay independently in one atomic batch',()=>{
 const s=campaign(),n=S.transition(s,'Paid expenses',n=>S.shipExpenses(n,[{kind:'mortgage',mortgagePayments:2},{kind:'maintenance',maintenancePayments:3},{kind:'salary',monthly:'12000',months:1}]));
 assert.equal(n.bank,'281997');assert.equal(n.ship.mortgage.nextDueDate,'085-1105');assert.equal(n.ship.maintenance.nextDueDate,'099-1105');assert.equal(n.ledger.length,3);
 assert.equal(new Set(n.ledger.map(e=>e.batchId)).size,1);assert.deepEqual(S.undo(n).ship,s.ship);
 const poor=campaign();poor.bank='205000';const bytes=JSON.stringify(poor);
 assert.throws(()=>S.transition(poor,'Cannot afford both',n=>S.shipExpenses(n,[{kind:'mortgage',mortgagePayments:2},{kind:'maintenance',maintenancePayments:3}])),/Insufficient/);assert.equal(JSON.stringify(poor),bytes);
});
test('time never debits maintenance; overdue payments begin from the next unpaid date',()=>{
 const s=campaign(),n=S.transition(s,'Wait',n=>n.hours=70*24);
 assert.equal(maintenanceStatus(n).duePayments,'3');assert.equal(n.bank,s.bank);assert.deepEqual(n.ship.maintenance,s.ship.maintenance);
 const paid=pay(n);assert.equal(paid.ship.maintenance.nextDueDate,'043-1105');assert.equal(maintenanceStatus(paid).duePayments,'2');
 const back=S.transition(paid,'Time correction',n=>n.hours=0);assert.equal(back.bank,paid.bank);assert.equal(maintenanceStatus(back).duePayments,'0');
});
test('maintenance year rollover, custom campaign labels and direct setting corrections are safe',()=>{
 const s=campaign();s.ship.maintenance.nextDueDate='350-1105';assert.equal(maintenancePaymentQuote(s,2).after.nextDueDate,'041-1106');
 s.dateLabel='Old custom label';assert.equal(maintenanceStatus(s).duePayments,null);assert.match(maintenanceStatus(s).calendarError,/Imperial/);
 const paid=pay(s),m=configureMaintenance({payment:'3000',nextDueDate:'100-1106'},paid.ship.maintenance);
 assert.equal(m.paidSinceTracking,'2001');assert.equal(m.lastPaidDueDate,undefined);
 const n=S.transition(paid,'Settings',n=>S.setMaintenance(n,m));assert.equal(n.bank,paid.bank);assert.deepEqual(n.ledger,paid.ledger);assert.deepEqual(S.undo(n).ship,paid.ship);
});
test('maintenance JSON reload, clear and Undo preserve optional absence and recorded payments',()=>{
 const s=campaign(),paid=S.validate(JSON.parse(JSON.stringify(pay(s,2))));
 assert.equal(paid.ship.maintenance.paidSinceTracking,'4002');assert.equal(paid.ship.maintenance.lastPaidDueDate,'043-1105');
 assert.equal(configureMaintenance(paid.ship.maintenance,paid.ship.maintenance).lastPaidDueDate,'043-1105');
 const cleared=S.transition(paid,'Clear maintenance',n=>S.setMaintenance(n,undefined));
 assert.equal(Object.hasOwn(cleared.ship,'maintenance'),false);assert.deepEqual(S.undo(S.validate(JSON.parse(JSON.stringify(cleared)))).ship,paid.ship);
});
test('invalid maintenance imports, periods, counterfeit quote terms and overflow reject atomically',()=>{
 const m=campaign().ship.maintenance;
 for(const value of [null,[],{}, {...m,payment:'0'},{...m,payment:2000},{...m,payment:'-1'},{...m,paidSinceTracking:'-1'},{...m,paidSinceTracking:undefined},{...m,nextDueDate:'366-1105'},{...m,lastPaidDueDate:'015-1105'}])assert.throws(()=>validateMaintenance(value));
 for(const periods of [0,-1,'',null,1.5,'1e2',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>maintenancePaymentQuote(campaign(),periods));
 const s=campaign(),n=S.transition(s,'Actual terms',n=>S.shipExpense(n,{kind:'maintenance',maintenancePayments:1,recurringShip:{maintenance:{...m,payment:'1'}}}));assert.equal(n.ledger[0].amount,'-2001');
 s.ship.maintenance.nextDueDate='365-9007199254740991';assert.throws(()=>pay(s),/supported calendar/);
});

test('maintenance receipt dates and independent frozen audit survive reload and reject inconsistency',()=>{
 const s=pay(campaign(),2);assert.deepEqual(s.ledger[0].paidAt,{dateLabel:'001-1105',hours:0});assert.deepEqual(S.validate(JSON.parse(JSON.stringify(s))),s);
 for(const mutate of [e=>e.amount='-1',e=>e.expense.maintenance.after.paidSinceTracking='1',e=>e.expense.maintenance.after.nextDueDate='001-1106',e=>delete e.paidAt]){
  const corrupt=structuredClone(s);mutate(corrupt.ledger[0]);assert.throws(()=>S.validate(corrupt));
 }
});

test('valid reordered JSON keys do not invalidate maintenance receipts',()=>{
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,value])=>[key,reorder(value)])):value;
 const paid=pay(campaign(),2);assert.deepEqual(S.validate(reorder(paid)).ship,paid.ship);
});

test('maintenance Details ignore missing or falsified duplicate text and show frozen quote values',()=>{
 const s=pay(campaign(),2),entry=s.ledger[0],expected=recurringExpenseDetails(entry.expense);
 entry.expense.details=[['Paid since tracking after · Cr','FAKE']];S.validate(s);assert.deepEqual(recurringExpenseDetails(entry.expense),expected);
 delete entry.expense.details;S.validate(s);assert.deepEqual(recurringExpenseDetails(entry.expense),expected);
});
