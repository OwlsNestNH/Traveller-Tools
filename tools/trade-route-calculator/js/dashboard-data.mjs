import {credit} from './amounts.mjs';
import {displayDate} from './calendar.mjs';
import {recordedPaymentDate} from './payment-schedule.mjs?v=time-completion-20261010-48';
import {recordedOperatingResult} from './financial-summary.mjs?v=time-completion-20261010-48';

const operatingCategories={berthing:'Berthing',fuel:'Fuel',lifeSupport:'Life support',lifeSupportRefill:'Life support refill',salary:'Crew salaries',staterooms:'Stateroom expenses',passengerSupport:'Passenger & crew life support',mortgage:'Mortgage payments',maintenance:'Maintenance'};
const categories={'Sale':'Cargo sales','Purchase':'Cargo purchases','Freight delivery':'Freight','Mail delivery':'Mail','Passenger delivery':'Passengers','Broker fee':'Broker fees','Tax':'Sale taxes','Profit adjustment':'Profit adjustments','Insurance premium':'Insurance premiums','Insurance claim':'Insurance claims','Insurance amendment':'Insurance amendments / refunds','Manual expense':'Manual expenses'};
const nonIncome=new Set(['Opening bank','Manual deposit','Referee bank correction','Rounding adjustment']);
function category(entry){
 if(entry.type.startsWith('Ship expense'))return operatingCategories[entry.expense?.kind]||(entry.expense?.label?String(entry.expense.label):'Other ship expenses');
 return categories[entry.type]||'Other / unclassified';
}
const groups=map=>[...map].map(([label,amount])=>({label,amount:String(amount)})).sort((a,b)=>BigInt(a.amount)===BigInt(b.amount)?a.label.localeCompare(b.label):BigInt(a.amount)>BigInt(b.amount)?-1:1);
export function dashboardData(state){
 const baseline=state.dashboardBaseline;if(!state.initialized||!baseline)return null;
 const excluded=new Set(baseline.excludedLedgerIds),entries=state.ledger.filter(e=>!excluded.has(e.id));
 const sum=entries.reduce((n,e)=>n+credit(e.amount),0n),adjustment=credit(state.bank)-credit(baseline.bank)-sum;
 let balance=credit(baseline.bank),otherInflows=0n,otherOutflows=0n;
 const cashPoints=[{id:'baseline',label:'Starting balance',date:displayDate(baseline.dateLabel,baseline.hours),balance:String(balance)}];
 if(adjustment){balance+=adjustment;cashPoints.push({id:'earlier-adjustment',label:'Earlier-history / balance adjustment',date:'Before surviving tracked activity',balance:String(balance)});}
 const income=new Map(),expenses=new Map();
 const visits=[{label:'Starting visit',date:displayDate(baseline.dateLabel,baseline.hours),entries:[]}];
 for(const entry of entries){
  if(entry.type==='Jump'){
   const from=state.worlds[entry.from]?.name||entry.from||'Unknown origin',to=state.worlds[entry.to||entry.world]?.name||entry.to||entry.world||'Unknown destination';
   visits.push({label:'Jump '+visits.length+' · '+from+' → '+to,date:recordedPaymentDate(state,entry),entries:[]});
  }
  visits.at(-1).entries.push(entry);
  const amount=credit(entry.amount);balance+=amount;
  if(amount!==0n)cashPoints.push({id:entry.id,label:entry.type,date:recordedPaymentDate(state,entry),balance:String(balance)});
  if(nonIncome.has(entry.type)){if(amount>0n)otherInflows+=amount;else otherOutflows-=amount;continue;}
  if(!amount)continue;
  const label=category(entry),map=amount>0n?income:expenses;map.set(label,(map.get(label)||0n)+(amount>0n?amount:-amount));
 }
 const overall=recordedOperatingResult(entries);
 return {baseline,currentBank:state.bank,cashPoints,adjustment:String(adjustment),income:groups(income),expenses:groups(expenses),otherInflows:String(otherInflows),otherOutflows:String(otherOutflows),operatingResult:overall.result,complete:overall.complete,visits:visits.map((v,index)=>{const r=recordedOperatingResult(v.entries);return {label:v.label+(index===visits.length-1?' · ongoing':''),date:v.date,result:r.result,salesComplete:r.complete,income:r.income,expenses:r.expenses,tradeProfit:r.tradeProfit};})};
}
