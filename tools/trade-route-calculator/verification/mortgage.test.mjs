import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {configureMortgage,validateMortgage,mortgageStatus,mortgagePaymentQuote} from '../js/mortgage.mjs';
import {recordedPaymentDate} from '../js/payment-schedule.mjs';
import {expenseQuote,recurringExpenseDetails} from '../js/expenses.mjs';
import {campaignReport} from '../js/report.mjs';
import {readFileSync} from 'node:fs';

function terms(overrides={}){return {originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105',...overrides};}
function campaign(overrides={}){
 const s=S.initial();s.bank='765432';s.actual='0,0';s.initialized=true;
 s.worlds[s.actual]={id:s.actual,name:'Synthetic mortgage world',sector:'Test',hex:'0101',x:0,y:0,uwp:'E000000-0',zone:'Safe'};s.route=[s.actual];
 s.ship.mortgage=terms(overrides);return S.validate(s);
}
const pay=(s,count=1)=>S.transition(s,'Paid mortgage expense',n=>S.shipExpenses(n,[{kind:'mortgage',mortgagePayments:count}]));

test('legacy campaigns remain unconfigured and no history is guessed',()=>{
 const s=S.initial(),bytes=JSON.stringify(s);assert.equal(S.validate(s),s);assert.equal(JSON.stringify(s),bytes);
 assert.equal(mortgageStatus(s),null);assert.equal(configureMortgage(),undefined);
 assert.throws(()=>mortgagePaymentQuote(s),/Set up/);
 const m=configureMortgage(terms());assert.equal(m.totalPaid,'12000000');assert.equal(m.lastPaidDueDate,undefined);
});
test('all five configuration fields are explicit; new 480-payment terms retain the original amount',()=>{
 const m=configureMortgage(terms({remainingPayments:'480',totalPaid:'0'}));assert.equal(m.remainingPayments,480);assert.equal(m.originalAmount,'24000000');
 assert.equal(mortgageStatus(campaign(m)).remainingAmount,'48000000');
 for(const key of ['originalAmount','payment','remainingPayments','totalPaid','nextDueDate'])assert.throws(()=>configureMortgage({...terms(),[key]:''}),/Enter the original/);
});
test('two prepaid installments update one atomic ledger, count, paid total and schedule',()=>{
 const s=campaign(),bytes=JSON.stringify(s),q=mortgagePaymentQuote(s,2);
 assert.equal(q.amount,'200000');assert.equal(q.firstDueDate,'029-1105');assert.equal(q.lastDueDate,'057-1105');
 assert.equal(q.after.nextDueDate,'085-1105');assert.equal(q.after.remainingPayments,358);assert.equal(q.after.totalPaid,'12200000');assert.equal(q.remainingAmount,'35800000');
 assert.equal(JSON.stringify(s),bytes,'Preview is read-only');
 const n=pay(s,2);assert.equal(n.bank,'565432');assert.deepEqual(n.ship.mortgage,q.after);assert.equal(n.ship.mortgage.originalAmount,s.ship.mortgage.originalAmount);
 assert.equal(n.hours,s.hours);assert.equal(n.ledger.length,1);assert.equal(n.ledger[0].amount,'-200000');assert.equal(n.ledger[0].expense.kind,'mortgage');
 assert.deepEqual(n.ledger[0].expense.mortgage,q);assert.equal(n.undo.length,1);
 const undone=S.undo(n);for(const key of ['bank','ship','hours','ledger'])assert.deepEqual(undone[key],s[key]);
 assert.equal(JSON.stringify(s),bytes,'Commit does not mutate the input campaign');
});
test('paid installments are not charged again by time advances, rollback or the next payment',()=>{
 const s=pay(campaign(),2);
 let n=S.transition(s,'Time advanced',n=>n.hours=84*24);
 assert.equal(n.bank,s.bank);assert.deepEqual(n.ship.mortgage,s.ship.mortgage);assert.equal(mortgageStatus(n).duePayments,1);
 n=S.transition(n,'Time correction',n=>n.hours=0);assert.equal(mortgageStatus(n).duePayments,0);assert.equal(n.bank,s.bank);
 const second=pay(n);assert.equal(second.ledger.at(-1).expense.mortgage.firstDueDate,'085-1105');assert.equal(second.ship.mortgage.nextDueDate,'113-1105');
});
test('due count includes today, catches up arrears and never exceeds remaining installments',()=>{
 const s=campaign();assert.equal(mortgageStatus(s).duePayments,0);
 s.hours=27*24+23;assert.equal(mortgageStatus(s).duePayments,0);
 s.hours=28*24;assert.equal(mortgageStatus(s).duePayments,1);
 s.hours=84*24;assert.equal(mortgageStatus(s).duePayments,3);
 const n=pay(s);assert.equal(n.ship.mortgage.nextDueDate,'057-1105');assert.equal(mortgageStatus(n).duePayments,2);
 s.hours=100000*24;assert.equal(mortgageStatus(s).duePayments,360);
});
test('due dates are absolute Imperial dates and roll across 365-day years',()=>{
 const s=campaign({nextDueDate:'350-1105'}),q=mortgagePaymentQuote(s,2);
 assert.equal(q.lastDueDate,'013-1106');assert.equal(q.after.nextDueDate,'041-1106');
 const n=S.transition(s,'Correct campaign start',n=>n.dateLabel='300-1105');assert.equal(n.ship.mortgage.nextDueDate,'350-1105');
 n.hours=50*24;assert.equal(mortgageStatus(n).duePayments,1);
});
test('final scheduled payment reaches zero without inventing principal or fractional installments',()=>{
 const s=campaign({remainingPayments:2}),n=pay(s,2);
 assert.equal(n.ship.mortgage.remainingPayments,0);assert.equal(mortgageStatus(n).remainingAmount,'0');assert.equal(mortgageStatus(n).duePayments,0);
 assert.equal(n.ship.mortgage.originalAmount,'24000000');assert.equal(n.ship.mortgage.lastPaidDueDate,'057-1105');
 assert.throws(()=>pay(n),/All scheduled/);assert.throws(()=>pay(s,3),/Choose 1 to 2/);
});
test('fixed installment amounts remain exact under Cr100 rounding, including large Credits',()=>{
 const s=campaign({payment:'100001'});s.settings.creditStep=100;
 const n=pay(s,2);assert.equal(n.ledger[0].amount,'-200002');assert.equal(n.ship.mortgage.totalPaid,'12200002');assert.equal(n.ship.mortgage.payment,'100001');
 const big=campaign({originalAmount:'900719925474099312340',payment:'9007199254740993123',totalPaid:'1',remainingPayments:2});big.bank='999999999999999999999';
 const paid=pay(big,2);assert.equal(paid.ledger[0].amount,'-18014398509481986246');assert.equal(paid.ship.mortgage.totalPaid,'18014398509481986247');
 const rounded=S.transition(s,'Round Credits',S.applyRounding);assert.deepEqual(rounded.ship.mortgage,s.ship.mortgage,'Bulk rounding does not rewrite a fixed obligation or original amount');
});
test('mortgage and other selected expenses pay as one audited batch and Undo together',()=>{
 const s=campaign();const n=S.transition(s,'Paid selected expenses',n=>S.shipExpenses(n,[{kind:'mortgage',mortgagePayments:2},{kind:'salary',monthly:'12000',months:1}]));
 assert.equal(n.bank,'553432');assert.equal(n.ledger.length,2);assert.equal(n.ledger[0].batchId,n.ledger[1].batchId);
 assert.equal(n.ship.mortgage.totalPaid,'12200000');assert.equal(n.ship.expenses.salary,'12000');
 const undone=S.undo(n);assert.deepEqual(undone.ship,s.ship);assert.equal(undone.bank,s.bank);assert.deepEqual(undone.ledger,s.ledger);
});
test('unauthorized quote fields, insufficient funds and invalid bundles cannot change campaign data',()=>{
 const s=campaign(),before=JSON.stringify(s);s.bank='150000';const poor=JSON.stringify(s);
 assert.throws(()=>pay(s,2),/Insufficient/);assert.equal(JSON.stringify(s),poor);
 assert.throws(()=>S.transition(s,'Mixed',n=>S.shipExpenses(n,[{kind:'salary',monthly:'12000',months:1},{kind:'mortgage',mortgagePayments:2}])));
 assert.equal(JSON.stringify(s),poor);s.bank='765432';
 const n=S.transition(s,'Pay actual terms',n=>S.shipExpense(n,{kind:'mortgage',mortgagePayments:1,recurringShip:{mortgage:terms({payment:'1'})}}));assert.equal(n.ledger[0].amount,'-100000');
 assert.throws(()=>S.transition(s,'Duplicate',n=>S.shipExpenses(n,[{kind:'mortgage',mortgagePayments:1},{kind:'mortgage',mortgagePayments:1}])),/only once/);
 assert.equal(JSON.stringify(s),before);
});
test('configuration and schedule corrections are audited and undoable without creating payments',()=>{
 const s=campaign();const n=S.transition(s,'Ship / trader settings',n=>S.setMortgage(n,configureMortgage(terms({totalPaid:'123',nextDueDate:'100-1105'}),n.ship.mortgage)));
 assert.equal(n.bank,s.bank);assert.deepEqual(n.ledger,s.ledger);assert.equal(n.events.at(-2).label,'Mortgage settings audit');assert.deepEqual(n.events.at(-2).before,s.ship.mortgage);
 assert.equal(n.ship.mortgage.totalPaid,'123');assert.deepEqual(S.undo(n).ship,s.ship);
 const paid=pay(s);const changed=S.transition(paid,'Edit due date',n=>S.setMortgage(n,configureMortgage({...n.ship.mortgage,nextDueDate:'100-1105'},n.ship.mortgage)));
 assert.equal(changed.ship.mortgage.lastPaidDueDate,undefined,'A corrected schedule does not pretend a prior installment was paid');
 assert.equal(configureMortgage(paid.ship.mortgage,paid.ship.mortgage).lastPaidDueDate,'029-1105');
});
test('unconfigured/configured/cleared records round-trip through validated JSON and Undo',()=>{
 let s=campaign();delete s.ship.mortgage;
 const configured=S.transition(s,'Settings',n=>S.setMortgage(n,configureMortgage(terms())));
 assert.ok(configured.undo.at(-1).inverse.some(op=>op.path.join('.')==='ship.mortgage'&&op.remove));
 const paid=S.validate(JSON.parse(JSON.stringify(pay(configured,2))));assert.deepEqual(S.undo(paid).ship,configured.ship);
 const cleared=S.transition(paid,'Clear mortgage',n=>S.setMortgage(n,undefined));
 const reloaded=S.validate(JSON.parse(JSON.stringify(cleared)));assert.equal(Object.hasOwn(reloaded.ship,'mortgage'),false);assert.deepEqual(S.undo(reloaded).ship,paid.ship);
 assert.deepEqual(S.undo(S.validate(JSON.parse(JSON.stringify(configured)))).ship,s.ship);
});
test('strict values reject malformed imports, missing prior paid total, unsafe dates and invalid periods',()=>{
 const invalid=[null,[],{},terms({originalAmount:'-1'}),terms({payment:'0'}),terms({payment:100000}),terms({payment:'1.5'}),terms({totalPaid:undefined}),terms({totalPaid:'-1'}),terms({remainingPayments:'3'}),terms({remainingPayments:1.5}),terms({remainingPayments:-1}),terms({remainingPayments:Number.MAX_SAFE_INTEGER+1}),terms({nextDueDate:'366-1105'}),terms({nextDueDate:'Monday'}),terms({lastPaidDueDate:'029-1105'}),terms({lastPaidDueDate:'100-1105'})];
 for(const m of invalid){assert.throws(()=>validateMortgage(m));assert.throws(()=>S.validate({...campaign(),ship:{...campaign().ship,mortgage:m}}));}
 for(const periods of [0,-1,1.5,'',null,'1e2','Infinity',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>mortgagePaymentQuote(campaign(),periods));
 const max=campaign({nextDueDate:'365-9007199254740991'});assert.throws(()=>mortgagePaymentQuote(max),/supported calendar/);
});
test('old custom campaign labels retain their mortgage and expose unknown due status honestly',()=>{
 const s=campaign();s.dateLabel='Old custom date';assert.equal(S.validate(s),s);assert.equal(mortgageStatus(s).duePayments,null);assert.match(mortgageStatus(s).calendarError,/Imperial/);
 assert.equal(pay(s).ship.mortgage.nextDueDate,'057-1105');
});
test('expense quote includes fixed original amount, prior total and recorded payment range',()=>{
 const s=campaign(),q=expenseQuote(s.worlds[s.actual],{kind:'mortgage',recurringShip:s.ship,mortgagePayments:2,notes:'Two payments in advance',creditStep:100});
 assert.equal(q.fixedAmount,true);assert.equal(q.amount,'200000');assert.equal(q.notes,'Two payments in advance');assert.equal(q.mortgage.before.originalAmount,'24000000');
 assert.ok(q.details.some(([label,value])=>label==='Paid through installment due'&&value==='057-1105'));
 assert.match(q.reference,/not principal, equity/);assert.match(q.reference,/unaffected by Credit rounding/);
});

test('reports retain original and cumulative mortgage figures without recalculating principal',()=>{
 const core=JSON.parse(readFileSync(new URL('../rules/core-2022.json',import.meta.url))),s=pay(campaign(),2),before=JSON.stringify(s);
 const report=campaignReport(s,core,{exportedAt:new Date('2026-10-09T00:00:00Z')});
 assert.match(report,/Original mortgage amount:\s+Cr 24,000,000/);assert.match(report,/Mortgage total paid:\s+Cr 12,200,000/);
 assert.match(report,/Mortgage payments remaining:\s+358/);assert.match(report,/Mortgage scheduled amount remaining:\s*Cr 35,800,000/);
 assert.match(report,/Paid through installment due:\s+057-1105/);assert.match(report,/Next unpaid mortgage due:\s+085-1105/);
 assert.match(report,/Recorded operating expenses:\s+Cr 200,000/);assert.equal(JSON.stringify(s),before);
});

test('payment receipt dates persist independently of later campaign-label edits; corrupt audits reject',()=>{
 const s=pay(campaign(),2);assert.deepEqual(s.ledger[0].paidAt,{dateLabel:'001-1105',hours:0});
 const n=S.transition(s,'Change campaign date',n=>n.dateLabel='001-1106');assert.deepEqual(n.ledger[0].paidAt,{dateLabel:'001-1105',hours:0});assert.equal(recordedPaymentDate(n,n.ledger[0]),'001-1105 · 00:00');assert.equal(recordedPaymentDate(n,{hours:0}),'001-1106 · 00:00');
 assert.deepEqual(S.validate(JSON.parse(JSON.stringify(n))).ledger,s.ledger);
 for(const mutate of [e=>e.amount='-1',e=>e.expense.amount='1',e=>e.expense.mortgage.after.totalPaid='1',e=>e.expense.mortgage.after.nextDueDate='001-1106',e=>e.expense.mortgage.periods=1,e=>delete e.paidAt]){
  const corrupted=structuredClone(s);mutate(corrupted.ledger[0]);assert.throws(()=>S.validate(corrupted));
 }
});

test('valid reordered JSON keys do not invalidate frozen mortgage audits',()=>{
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,value])=>[key,reorder(value)])):value;
 const paid=pay(campaign(),2);assert.deepEqual(S.validate(reorder(paid)).ship,paid.ship);
});

test('recurring Details derive canonical facts from the validated quote, never duplicate imported text',()=>{
 const s=pay(campaign(),2),entry=s.ledger[0],expected=recurringExpenseDetails(entry.expense);
 entry.expense.details=[['Total paid after · Cr','FAKE']];S.validate(s);assert.deepEqual(recurringExpenseDetails(entry.expense),expected);
 delete entry.expense.details;S.validate(s);assert.deepEqual(recurringExpenseDetails(entry.expense),expected);
});
