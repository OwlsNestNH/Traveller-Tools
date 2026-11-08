import assert from 'node:assert/strict';
import {executeEconomics,canonical} from './accounts-economic-observations.mjs';
const retired=kind=>['staterooms','passengerSupport','lifeSupport'].includes(kind);
export async function combinedAccountsObservation(spec,seed,factory,report,S,deps,original){
 const selection=spec.selection?.filter(kind=>!retired(kind)),removedOnly=spec.kind==='bundle'&&spec.selection?.length>0&&!selection.length;
 const values=Object.fromEntries(Object.entries(spec.values??{}).filter(([key])=>! /^(?:include-)?(?:staterooms|passengerSupport)/.test(key)));
 const adapted={...spec,selection,values,...(removedOnly?{reject:true}:{})};
 const result=await executeEconomics(adapted,seed,factory,report,S,deps);
 if(spec.kind==='bundle')assert.doesNotMatch(result.opened,/name="include-(staterooms|passengerSupport)"/,'Retired separate support payments must not be offered');
 const saved=result.checkpoints.find(c=>c.stage==='saved');
 if(saved){
  // Independent recorded .58 ledger is preserved, not regenerated. Only the
  // specifically retired support entries are removed from its expected debit.
  const ledger=original.economics.newLedger.filter(e=>!retired(e.expenseKind)).map(e=>{
   if(seed.settings.creditStep!==100||!['mortgage','maintenance'].includes(e.expenseKind))return e;
   // New explicit user policy: round only cash, not the original obligation.
   // Calculate independently from the frozen release's exact scheduled debit.
   const scheduled=BigInt(e.expenseAmount),cash=((scheduled+99n)/100n)*100n;
   return {...e,amount:String(-cash),expenseAmount:String(cash)};
  });
  for(const entry of saved.durable.ledger.slice(seed.ledger.length))if(['mortgage','maintenance'].includes(entry.expense?.kind)){
   const q=entry.expense,schedule=q.mortgage||q.maintenance;
   assert.equal(q.scheduledAmount,schedule.amount);
   assert.equal(BigInt(q.amount)-BigInt(q.scheduledAmount),BigInt(q.incidentalCosts));
   const tracked=q.kind==='mortgage'?'totalPaid':'paidSinceTracking';
   assert.equal(BigInt(schedule.after[tracked])-BigInt(schedule.before[tracked]),BigInt(q.scheduledAmount),'Incidental costs never inflate scheduled repayment');
  }
  const actual=saved.durable.ledger.slice(seed.ledger.length).map(e=>({type:e.type,amount:e.amount,world:e.world,hours:e.hours,...(e.expense?{expenseKind:e.expense.kind,expenseAmount:e.expense.amount}:{}),...(e.reason!==undefined?{reason:e.reason}:{})}));
  assert.deepEqual(actual,ledger,'Every surviving expense retains original economics except the independently calculated authorized scheduled-payment allowance');
  assert.equal(saved.durable.bank,String(BigInt(seed.bank)+ledger.reduce((n,e)=>n+BigInt(e.amount),0n)));
  assert.equal(saved.durable.revision,original.economics.revisionAfter);assert.equal(saved.durable.hours,original.economics.hoursAfter);
  assert.deepEqual(saved.durable.ledger.slice(0,seed.ledger.length),seed.ledger,'Historical receipts unchanged');
  assert.equal(saved.durable.ship.fuel?.aboardTons??null,original.economics.fuelAfter);
 }
 if(removedOnly){assert.equal(result.writes,0);assert.deepEqual(result.checkpoints.at(-1).durable,seed);}
 else {assert.equal(result.writes,original.writes);assert.equal(result.rolls,original.rolls);assert.deepEqual(result.checkpoints.map(c=>c.stage),original.checkpoints);}
 return canonical(result).value;
}
