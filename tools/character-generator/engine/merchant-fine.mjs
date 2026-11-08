// Original procedural mechanics: Aliens of Charted Space Volume 1 Update 2026,
// printed p.269. The initial Merchant fine is separate from p.276 re-education fines.
// Caller supplies the die. No random generator, financing or elapsed-time assumptions.
export const MERCHANT_FINE_SOURCE=Object.freeze({id:'aliens',title:'Aliens of Charted Space Volume 1 Update 2026',page:269});
const need=(value,message)=>{if(!value)throw new Error(message);};
export function merchantFineRoll({die}={}){
 need(Number.isInteger(die)&&die>=1&&die<=6,'Merchant fine die must be an integer from 1 to 6.');
 return {source:{...MERCHANT_FINE_SOURCE},die,amount:die*1000};
}
export function merchantFineOptions({die,cash}={}){
 const {amount}=merchantFineRoll({die});need(Number.isFinite(cash),'Available cash is invalid.');
 return [{id:'pay',label:'Pay fine',available:cash>=amount,reason:cash>=amount?null:'Insufficient cash. No automatic financing is available.'},
 {id:'decline',label:'Decline payment',available:true,reason:null}];
}
export function merchantFineOutcome({die,cash,socialStanding,decision,protectedStay=false}={}){
 const roll=merchantFineRoll({die});merchantFineOptions({die,cash});
 need(Number.isInteger(socialStanding)&&socialStanding>=0&&socialStanding<=40,'Social Standing is invalid.');
 need(typeof protectedStay==='boolean','Protected-stay context is invalid.');
 need(['pay','decline'].includes(decision),'Choose pay or decline.');
 const paid=decision==='pay';need(!paid||cash>=roll.amount,'Insufficient cash to pay the Merchant fine. Decline payment or restore/replay the context.');
 return {...roll,decision,payment:paid?{amount:roll.amount,funding:'cash'}:null,cashAfter:paid?cash-roll.amount:cash,
  debtDelta:0,disposition:paid||protectedStay?'stay':'leave',protectedStay,reeducation:!paid&&socialStanding<=9,
  nonpaymentDischarge:!paid&&!protectedStay,elapsedMonths:0,careerTerms:0};
}
