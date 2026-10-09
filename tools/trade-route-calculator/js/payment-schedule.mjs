import {parseDate,displayDate} from './calendar.mjs';
export const PAYMENT_DAYS=28;
export function paymentCount(value,label='Number of payments'){
 if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Error(label+' must be a whole nonnegative number.');
 return Number(value);
}
function dateDay(label){const {day,year}=parseDate(label);return BigInt(year)*365n+BigInt(day-1);}
function dateLabel(day){
 const year=day/365n;
 if(year>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Payment date is outside the supported calendar.');
 return String(day%365n+1n).padStart(3,'0')+'-'+String(year).padStart(4,'0');
}
export const canonicalPaymentDate=label=>dateLabel(dateDay(label));
export function validatePaymentDate(label){
 if(typeof label!=='string'||canonicalPaymentDate(label)!==label)throw Error('Enter a valid payment due date such as 001-1105.');
}
export function advancePaymentDate(label,periods){return dateLabel(dateDay(label)+BigInt(paymentCount(periods))*BigInt(PAYMENT_DAYS));}
export function duePaymentCount(s,nextDueDate){
 const today=dateDay(s.dateLabel)+BigInt(Math.floor(s.hours/24)),due=dateDay(nextDueDate);
 return today<due?0n:(today-due)/BigInt(PAYMENT_DAYS)+1n;
}

export function recordedPaymentDate(s,entry){
 return displayDate(entry.paidAt?.dateLabel??s.dateLabel,entry.paidAt?.hours??entry.hours);
}
