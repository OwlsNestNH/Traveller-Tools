import {credit} from './amounts.mjs';
import {paymentCount,canonicalPaymentDate,validatePaymentDate,advancePaymentDate,duePaymentCount} from './payment-schedule.mjs?v=undo-completion-20261010-43';
export const MAINTENANCE_REFERENCE='Campaign monthly maintenance: the entered fixed cost every 4 weeks (28 days), payable in advance. Each confirmed payment advances this expense’s own next-unpaid date. No annual overhaul, penalties or automatic bank charges are simulated.';
export function validateMaintenance(m){
 if(m===undefined)return;
 if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Invalid monthly maintenance settings.');
 if(typeof m.payment!=='string'||credit(m.payment)<=0n)throw Error('Monthly maintenance must be positive whole Credits.');
 if(typeof m.paidSinceTracking!=='string'||credit(m.paidSinceTracking)<0n)throw Error('Invalid maintenance payments total.');
 validatePaymentDate(m.nextDueDate);
 if(m.lastPaidDueDate!==undefined){validatePaymentDate(m.lastPaidDueDate);if(advancePaymentDate(m.lastPaidDueDate,1)!==m.nextDueDate)throw Error('Invalid last paid maintenance date.');}
}
export function configureMaintenance({payment='',nextDueDate=''}={},previous){
 payment=String(payment).trim();nextDueDate=String(nextDueDate).trim();
 if(!payment&&!nextDueDate)return undefined;
 if(!payment||!nextDueDate)throw Error('Enter both the monthly maintenance cost and next unpaid due date.');
 const m={payment:String(credit(payment)),nextDueDate:canonicalPaymentDate(nextDueDate),paidSinceTracking:previous?.paidSinceTracking??'0'};
 if(previous?.lastPaidDueDate&&previous.nextDueDate===m.nextDueDate)m.lastPaidDueDate=previous.lastPaidDueDate;
 validateMaintenance(m);return m;
}
export function maintenanceStatus(s){
 const m=s.ship.maintenance;if(!m)return null;validateMaintenance(m);
 try{return {duePayments:String(duePaymentCount(s,m.nextDueDate)),calendarError:null};}
 catch{return {duePayments:null,calendarError:'Set a valid Imperial campaign date to show whether maintenance payments are due.'};}
}
export function maintenancePaymentQuote(s,periods=1){
 const m=s.ship.maintenance;if(!m)throw Error('Set up monthly maintenance in Settings first.');validateMaintenance(m);
 periods=paymentCount(periods);if(!periods)throw Error('Choose at least one maintenance payment.');
 const amount=credit(m.payment)*BigInt(periods),lastDueDate=advancePaymentDate(m.nextDueDate,periods-1),nextDueDate=advancePaymentDate(m.nextDueDate,periods);
 const before=structuredClone(m),after={...m,nextDueDate,lastPaidDueDate:lastDueDate,paidSinceTracking:String(credit(m.paidSinceTracking)+amount)};validateMaintenance(after);
 return {periods,amount:String(amount),before,after,firstDueDate:m.nextDueDate,lastDueDate};
}

export function validateMaintenancePaymentRecord(entry){
 if(entry.expense?.kind!=='maintenance')return;
 const q=entry.expense.maintenance;
 if(!q||!q.before)throw Error('Invalid maintenance payment audit.');
 const expected=maintenancePaymentQuote({ship:{maintenance:q.before}},q.periods);
 if(['periods', 'amount', 'firstDueDate', 'lastDueDate'].some(key=>q[key]!==expected[key])||!q.after||['payment', 'paidSinceTracking', 'nextDueDate', 'lastPaidDueDate'].some(key=>q.after[key]!==expected.after[key])||entry.expense.fixedAmount!==true||entry.expense.amount!==q.amount||credit(entry.amount)!==-credit(q.amount))throw Error('Maintenance payment audit does not match its recorded expense.');
}
