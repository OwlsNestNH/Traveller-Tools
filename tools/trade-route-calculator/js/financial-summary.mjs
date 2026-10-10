import {credit} from './amounts.mjs';

// Shared by the TXT report and Dashboard. Read only: the saved sale result
// already includes cost basis, fees, tax and the retained-profit adjustment.
export function recordedOperatingResult(ledger){
 let tradeProfit=0n,freightMailIncome=0n,passengerIncome=0n,expenses=0n,complete=true;
 for(const entry of ledger){
  if(entry.type==='Sale'){
   if(entry.audit?.adjusted==null)complete=false;
   else {try{const value=String(entry.audit.adjusted);if(!/^-?\d+$/.test(value))throw Error('Incomplete sale profit');tradeProfit+=BigInt(value);}catch{complete=false;}}
  }else if(['Freight delivery','Mail delivery'].includes(entry.type))freightMailIncome+=credit(entry.amount);
  else if(entry.type==='Passenger delivery')passengerIncome+=credit(entry.amount);
  else if(entry.type.startsWith('Ship expense')||entry.type==='Manual expense')expenses-=credit(entry.amount);
 }
 const income=freightMailIncome+passengerIncome;
 return {complete,tradeProfit:String(tradeProfit),freightMailIncome:String(freightMailIncome),passengerIncome:String(passengerIncome),income:String(income),expenses:String(expenses),result:complete?String(tradeProfit+income-expenses):null};
}
