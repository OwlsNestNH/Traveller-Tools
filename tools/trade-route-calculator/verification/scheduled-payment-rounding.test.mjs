import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../js/state.mjs';
import {expenseQuote,recurringExpenseDetails} from '../js/expenses.mjs';
import {campaignReport} from '../js/report.mjs';

function campaign(payment='72',step=100){
 const s=S.initial();s.bank='1000';s.actual='0,0';s.initialized=true;s.settings.creditStep=step;
 s.worlds[s.actual]={id:s.actual,name:'Scheduled rounding test',sector:'Test',hex:'0101',x:0,y:0,uwp:'E000000-0',zone:'Safe'};s.route=[s.actual];
 s.ship.mortgage={originalAmount:'24000000',payment,remainingPayments:360,totalPaid:'123',nextDueDate:'029-1105'};
 s.ship.maintenance={payment,nextDueDate:'015-1105',paidSinceTracking:'456'};
 return S.validate(s);
}
const input=(kind,periods=1)=>({kind,[kind+'Payments']:periods});
const pay=(s,kind,periods=1)=>S.transition(s,'Pay scheduled expense',n=>S.shipExpenses(n,[input(kind,periods)]));
const paidField=kind=>kind==='mortgage'?'totalPaid':'paidSinceTracking';

for(const kind of ['mortgage','maintenance']){
 test(kind+': Cr72 costs Cr100, with one debit and Cr28 incidentals, never additional debt repayment',()=>{
  const s=campaign(),bytes=JSON.stringify(s),q=expenseQuote(s.worlds[s.actual],{...input(kind),recurringShip:s.ship,creditStep:100});
  assert.equal(q.amount,'100');assert.equal(q.scheduledAmount,'72');assert.equal(q.incidentalCosts,'28');assert.equal(q.roundingStep,100);assert.equal(q[kind].amount,'72');assert.equal(q.fixedAmount,true);
  assert.equal(JSON.stringify(s),bytes,'Preview must not mutate the campaign');
  const n=pay(s,kind),entry=n.ledger[0];
  assert.equal(n.bank,'900');assert.equal(n.ledger.length,1);assert.equal(entry.amount,'-100');assert.equal(entry.roundingStep,100);assert.deepEqual(entry.expense,q);
  assert.equal(n.ship[kind][paidField(kind)],String(BigInt(s.ship[kind][paidField(kind)])+72n));assert.equal(n.ship[kind].payment,'72');
  assert.equal(n.ship[kind].nextDueDate,kind==='mortgage'?'057-1105':'043-1105');assert.equal(n.ship.mortgage.remainingPayments,kind==='mortgage'?359:360);
  assert.deepEqual(S.validate(JSON.parse(JSON.stringify(n))),n);
  const undone=S.undo(n);for(const key of ['bank','ship','hours','ledger'])assert.deepEqual(undone[key],s[key]);assert.equal(JSON.stringify(s),bytes);
 });
 test(kind+': round the selected total once, rather than each installment',()=>{
  const n=pay(campaign('36'),kind,2),q=n.ledger[0].expense;
  assert.equal(q[kind].periods,2);assert.equal(q.scheduledAmount,'72');assert.equal(q.amount,'100');assert.equal(q.incidentalCosts,'28');assert.equal(n.bank,'900');
  const second=pay(campaign('72'),kind,2).ledger[0].expense;assert.equal(second.scheduledAmount,'144');assert.equal(second.amount,'200');assert.equal(second.incidentalCosts,'56');
 });
 test(kind+': Cr1 and already aligned Cr100 payments keep a zero incidental audit',()=>{
  for(const [payment,step] of [['72',1],['100',100]]){
   const n=pay(campaign(payment,step),kind),q=n.ledger[0].expense;
   assert.equal(q.amount,payment);assert.equal(q.scheduledAmount,payment);assert.equal(q.incidentalCosts,'0');assert.equal(q.roundingStep,step);assert.equal(n.ledger[0].roundingStep,step);
  }
 });
 test(kind+': large whole Credits use exact arithmetic for debit, incidentals and tracked totals',()=>{
  const s=campaign('9007199254740993123');s.bank='999999999999999999999';const n=pay(s,kind,2),q=n.ledger[0].expense;
  assert.equal(q.scheduledAmount,'18014398509481986246');assert.equal(q.amount,'18014398509481986300');assert.equal(q.incidentalCosts,'54');
  assert.equal(n.bank,'981985601490518013699');assert.equal(n.ship[kind][paidField(kind)],String(BigInt(s.ship[kind][paidField(kind)])+18014398509481986246n));
 });
 test(kind+': cash availability includes incidentals and failed payments remain atomic',()=>{
  const s=campaign();s.bank='99';const bytes=JSON.stringify(s);assert.throws(()=>pay(s,kind),/Insufficient/);assert.equal(JSON.stringify(s),bytes);
  assert.throws(()=>S.shipExpense(s,input(kind)),/Insufficient/);assert.equal(JSON.stringify(s),bytes);
  s.bank='100';assert.equal(pay(s,kind).bank,'0');
 });
 test(kind+': old receipts keep exact historical interpretation, with no migration or rebasing',()=>{
  const s=pay(campaign('72',1),kind),entry=s.ledger[0];
  delete entry.expense.scheduledAmount;delete entry.expense.incidentalCosts;delete entry.expense.roundingStep;
  entry.expense.details=[['Historical receipt','Preserve this audit text']];s.settings.creditStep=100;
  const bytes=JSON.stringify(s),details=recurringExpenseDetails(entry.expense),loaded=S.validate(JSON.parse(bytes));
  assert.equal(JSON.stringify(loaded),bytes);assert.equal(loaded.bank,'928');assert.equal(entry.amount,'-72');assert.equal(entry.roundingStep,1);
  assert.equal(details.some(([label])=>/Incidental costs|Cash debit|Scheduled payment total|Rounding/.test(label)),false);
  const n=pay(loaded,kind);assert.equal(n.bank,'828');assert.deepEqual(n.ledger[0],entry);assert.equal(n.ledger[1].expense.incidentalCosts,'28');
  const undone=S.undo(n);assert.deepEqual(undone.ledger,s.ledger);assert.deepEqual(undone.ship,s.ship);assert.equal(undone.bank,s.bank);
 });
 test(kind+': inconsistent or partial rounding metadata is rejected, even after later settings changes',()=>{
  const s=pay(campaign(),kind);s.settings.creditStep=1;S.validate(s);
  const mutations=[e=>e.expense.scheduledAmount='100',e=>e.expense.incidentalCosts='0',e=>e.expense.amount='72',e=>e.amount='-72',e=>e.expense.roundingStep=1,e=>e.expense.roundingStep=10,e=>e.roundingStep=1,e=>delete e.roundingStep,e=>delete e.expense.scheduledAmount,e=>delete e.expense.incidentalCosts,e=>delete e.expense.roundingStep,e=>e.expense.incidentalCosts=28,e=>e.expense[kind].after[paidField(kind)]=String(BigInt(e.expense[kind].after[paidField(kind)])+28n)];
  for(const mutate of mutations){const corrupt=structuredClone(s);mutate(corrupt.ledger[0]);assert.throws(()=>S.validate(corrupt),/audit/);}
  const stripped=structuredClone(s);for(const field of ['scheduledAmount','incidentalCosts','roundingStep'])delete stripped.ledger[0].expense[field];assert.throws(()=>S.validate(stripped),/audit/);
 });
 test(kind+': recurring Details derive the cash/schedule split from frozen receipt values',()=>{
  const n=pay(campaign(),kind),q=n.ledger[0].expense,expected=recurringExpenseDetails(q);
  assert.ok(expected.some(([label,value])=>label==='Scheduled payment total - Cr'&&value==='72'));
  assert.ok(expected.some(([label,value])=>label==='Incidental costs - Cr'&&value==='28'));
  assert.ok(expected.some(([label,value])=>label==='Cash debit - Cr'&&value==='100'));
  q.details=[['Incidental costs - Cr','FAKE']];assert.deepEqual(recurringExpenseDetails(q),expected);delete q.details;assert.deepEqual(recurringExpenseDetails(q),expected);S.validate(n);
 });
}

test('mixed mortgage, maintenance and salary round independently in one batch, and Undo restores all exact balances',()=>{
 const s=campaign('36'),bytes=JSON.stringify(s),inputs=[input('mortgage',2),input('maintenance',2),{kind:'salary',monthly:'72',months:1}];
 const n=S.transition(s,'Pay mixed expenses',draft=>S.shipExpenses(draft,inputs));
 assert.equal(n.bank,'700');assert.equal(n.ledger.length,3);assert.deepEqual(n.ledger.map(e=>e.amount),['-100','-100','-100']);assert.equal(new Set(n.ledger.map(e=>e.batchId)).size,1);
 assert.equal(n.ship.mortgage.totalPaid,'195');assert.equal(n.ship.maintenance.paidSinceTracking,'528');assert.equal(n.ship.mortgage.remainingPayments,358);
 const report=campaignReport(n,JSON.parse(readFileSync(new URL('../rules/core-2022.json',import.meta.url))),{exportedAt:new Date('2026-11-08T00:00:00Z')});
 assert.match(report,/Recorded operating expenses:\s+Cr 300/);assert.match(report,/Mortgage total paid:\s+Cr 195/);assert.match(report,/Maintenance paid since tracking:\s+Cr 528/);
 const restored=S.undo(S.validate(JSON.parse(JSON.stringify(n))));for(const key of ['bank','ship','hours','ledger'])assert.deepEqual(restored[key],s[key]);assert.equal(JSON.stringify(s),bytes);
 const poor=campaign('36');poor.bank='299';const prior=JSON.stringify(poor);assert.throws(()=>S.shipExpenses(poor,inputs),/Insufficient/);assert.equal(JSON.stringify(poor),prior);
});
