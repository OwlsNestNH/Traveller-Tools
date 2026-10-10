import {credit} from './amounts.mjs';
import {PAYMENT_DAYS,paymentCount,canonicalPaymentDate,validatePaymentDate,advancePaymentDate,duePaymentCount} from './payment-schedule.mjs?v=shared-helpers-20261010-31';

export const MORTGAGE_DAYS=PAYMENT_DAYS;
export const MORTGAGE_REFERENCE='Campaign installment tracking: a fixed payment every 4 weeks (28 days). A new 40-year mortgage has 480 payments, with each payment normally equal to the original financed amount divided by 240. This tracks scheduled payments and total paid, not principal, equity or an early-payoff value. Time passing never charges the bank.';

export function validateMortgage(m){
 if(m===undefined)return;
 if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Invalid mortgage settings.');
 if(typeof m.originalAmount!=='string'||credit(m.originalAmount)<=0n)throw Error('Original mortgage amount must be positive whole Credits.');
 if(typeof m.payment!=='string'||credit(m.payment)<=0n)throw Error('Mortgage payment must be positive whole Credits.');
 if(!Number.isSafeInteger(m.remainingPayments)||m.remainingPayments<0)throw Error('Mortgage payments remaining must be a whole nonnegative number.');
 if(typeof m.totalPaid!=='string'||credit(m.totalPaid)<0n)throw Error('Mortgage total paid must be nonnegative whole Credits.');
 validatePaymentDate(m.nextDueDate);
 if(m.lastPaidDueDate!==undefined){validatePaymentDate(m.lastPaidDueDate);if(advancePaymentDate(m.lastPaidDueDate,1)!==m.nextDueDate)throw Error('Invalid last paid mortgage installment date.');}
}
export function configureMortgage({originalAmount='',payment='',remainingPayments='',totalPaid='',nextDueDate=''}={},previous){
 const values=[originalAmount,payment,remainingPayments,totalPaid,nextDueDate].map(value=>String(value).trim());
 if(values.every(value=>value===''))return undefined;
 if(values.some(value=>value===''))throw Error('Enter the original mortgage amount, fixed payment, payments remaining, total paid so far (0 for a new loan), and next unpaid due date.');
 const m={originalAmount:String(credit(values[0])),payment:String(credit(values[1])),remainingPayments:paymentCount(values[2],'Payments remaining'),totalPaid:String(credit(values[3])),nextDueDate:canonicalPaymentDate(values[4])};
 // A manual schedule correction cannot invent which installment was last paid.
 if(previous?.lastPaidDueDate&&previous.nextDueDate===m.nextDueDate)m.lastPaidDueDate=previous.lastPaidDueDate;
 validateMortgage(m);return m;
}
export function mortgageStatus(s){
 const m=s.ship.mortgage;if(!m)return null;validateMortgage(m);
 const remainingAmount=String(credit(m.payment)*BigInt(m.remainingPayments));
 if(!m.remainingPayments)return {remainingAmount,duePayments:0,calendarError:null};
 try{
  const elapsed=duePaymentCount(s,m.nextDueDate);
  return {remainingAmount,duePayments:Number(elapsed>BigInt(m.remainingPayments)?BigInt(m.remainingPayments):elapsed),calendarError:null};
 }catch{return {remainingAmount,duePayments:null,calendarError:'Set a valid Imperial campaign date to show whether payments are due.'};}
}
export function mortgagePaymentQuote(s,periods=1){
 const m=s.ship.mortgage;if(!m)throw Error('Set up the mortgage in Settings first.');validateMortgage(m);
 if(!m.remainingPayments)throw Error('All scheduled mortgage payments are paid.');
 periods=paymentCount(periods);
 if(!periods||periods>m.remainingPayments)throw Error('Choose 1 to '+m.remainingPayments+' mortgage payments.');
 const amount=credit(m.payment)*BigInt(periods),nextDueDate=advancePaymentDate(m.nextDueDate,periods);
 const lastDueDate=advancePaymentDate(m.nextDueDate,periods-1);
 const before=structuredClone(m),after={...m,remainingPayments:m.remainingPayments-periods,totalPaid:String(credit(m.totalPaid)+amount),nextDueDate,lastPaidDueDate:lastDueDate};
 validateMortgage(after);
 return {periods,amount:String(amount),before,after,firstDueDate:m.nextDueDate,lastDueDate,remainingAmount:String(credit(after.payment)*BigInt(after.remainingPayments))};
}

export function validateMortgagePaymentRecord(entry){
 if(entry.expense?.kind!=='mortgage')return;
 const q=entry.expense.mortgage;
 if(!q||!q.before)throw Error('Invalid mortgage payment audit.');
 const expected=mortgagePaymentQuote({ship:{mortgage:q.before}},q.periods);
 if(['periods', 'amount', 'firstDueDate', 'lastDueDate', 'remainingAmount'].some(key=>q[key]!==expected[key])||!q.after||['originalAmount', 'payment', 'remainingPayments', 'totalPaid', 'nextDueDate', 'lastPaidDueDate'].some(key=>q.after[key]!==expected.after[key])||entry.expense.fixedAmount!==true||entry.expense.amount!==q.amount||credit(entry.amount)!==-credit(q.amount))throw Error('Mortgage payment audit does not match its recorded expense.');
}
