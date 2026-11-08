import {credit} from './amounts.mjs';
import {up} from './rounding.mjs?v=luxury-lss-20261108-1';

// Round the selected installment total once, without changing the obligation.
export function scheduledPaymentCash(scheduledAmount,roundingStep=1){
 if(![1,100].includes(roundingStep))throw Error('Choose Cr1 or Cr100 rounding.');
 scheduledAmount=String(credit(scheduledAmount));
 const amount=String(up(scheduledAmount,roundingStep));
 return {amount,scheduledAmount,incidentalCosts:String(credit(amount)-credit(scheduledAmount)),roundingStep};
}

export function scheduledPaymentRecordMatches(entry,scheduledAmount){
 const expense=entry.expense,fields=['scheduledAmount','incidentalCosts','roundingStep'];
 // Receipts predating cash-debit rounding remain exact and are never migrated.
 if(!fields.some(key=>Object.hasOwn(expense,key)))return expense.amount===scheduledAmount&&credit(entry.amount)===-credit(scheduledAmount);
 if(!fields.every(key=>Object.hasOwn(expense,key))||![1,100].includes(expense.roundingStep))return false;
 const expected=scheduledPaymentCash(scheduledAmount,expense.roundingStep);
 return ['amount',...fields].every(key=>expense[key]===expected[key])&&entry.roundingStep===expected.roundingStep&&credit(entry.amount)===-credit(expected.amount);
}
