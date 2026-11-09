// Bounded native Aslan access procedures. Aliens Update2026 pp22,29,35,41;
// Core Update2022 pp18-20,46-48. Upbringing and career context are distinct.
export const ASLAN_ACCESS_RULES=Object.freeze({
 'scientist-scholar':{name:'Continue research in human space',page:35,careerIds:['core.scholar'],automatic:true,mandatory:false},
 'outcast-expedition':{name:'Join the frontier expedition',page:41,careerIds:null,automatic:false,mandatory:true},
 'outside-history':{name:'Leave Aslan space after Outcast or Outlaw service',page:22,careerIds:null,automatic:false,mandatory:false},
 'outside-outcast':{name:'Leave Aslan space as an Outcast',page:22,careerIds:['core.rogue','core.drifter'],automatic:false,mandatory:false},
 'outside-failed-entry':{name:'Depart as a Drifter after failed qualification',page:22,careerIds:['core.drifter'],automatic:false,mandatory:false}
});
const need=(v,m)=>{if(!v)throw Error(m);};
const text=(v,max,label)=>{need(typeof v==='string'&&v.trim()&&v.length<=max,label+' must be a nonempty string of at most '+max+' characters.');return v.trim();};
export function aslanAccessInput(payload){need(payload&&Object.keys(payload).every(k=>['routeId','destination','confirmed'].includes(k)),'Use only the route, destination and confirmation.');need(payload.confirmed===true,'Confirm the recorded move outside Aslan space; travel is not simulated.');return {routeId:text(payload.routeId,100,'Route ID'),destination:text(payload.destination,160,'Destination'),confirmed:true,travelSimulated:false};}
export function createAslanAccess({id,route,careerIndex=null,careerId=null,assignment=null,completedTerms,careerCount,educationCount=0}={}){
 const rule=ASLAN_ACCESS_RULES[route];need(rule,'Unknown Aslan access route.');need(Number.isInteger(completedTerms)&&completedTerms>=0,'A completed-term boundary is required.');
 return {id,route,name:rule.name,source:{id:'aliens',page:rule.page},originCareerIndex:careerIndex,originCareerId:careerId,originAssignment:assignment,grantedAtCompletedTerms:completedTerms,availableAtCompletedTerms:completedTerms+(careerIndex===null?0:1),careerCount,educationCount,careerIds:rule.careerIds?structuredClone(rule.careerIds):null,automatic:rule.automatic,mandatory:rule.mandatory,status:'offered',boundaryAge:null,activation:null,attempt:null,expiry:null,conflictDecision:null};
}
export function aslanAccessExpiry({right,completedTerms,careerCount,educationCount,age,deceased,retired}={}){
 if(!['offered','activated'].includes(right.status))return null;
 let reason=deceased?'deceased':retired?'retired':careerCount>right.careerCount?'another-career-entered':educationCount>right.educationCount?'education-entered':completedTerms>right.availableAtCompletedTerms?'next-term-window-ended':right.boundaryAge!==null&&age!==right.boundaryAge?'chronology-changed':null;
 return reason?{reason,completedTerms,age}:null;
}
export const ASLAN_ACCESS_CONFLICT_CHOICES=Object.freeze([
 {id:'honor-forced-stay',name:'Complete the forced extra term',reason:'Keep the natural-12 continuation and expire the expedition obligation under this referee ruling.'},
 {id:'honor-expedition',name:'Follow the expedition next term',reason:'Keep the expedition obligation and waive only this conflicting forced-stay result under this referee ruling.'}
]);
export function aslanAccessConflictInput(payload,gm){need(gm===true,'Enable GM mode to resolve the conflicting source instructions.');need(payload&&Object.keys(payload).every(k=>['decision','reason'].includes(k)),'Use only the conflict decision and reason.');need(ASLAN_ACCESS_CONFLICT_CHOICES.some(c=>c.id===payload.decision),'Choose one explicit source precedence; no default is assumed.');return {decision:payload.decision,reason:text(payload.reason,500,'Source precedence reason'),source:[{id:'aliens',page:41},{id:'core',page:19}]};}

export function aslanCashAccountPlan({total,history=[]}={}){need(Number.isSafeInteger(total)&&total>=0,'A nonnegative total cash-roll count is required.');need(Array.isArray(history),'Cash history must be a recorded array.');const core=history.filter(r=>r?.table==='cash'&&r.completed===true&&typeof r.careerId==='string'&&r.careerId.startsWith('core.')).length;need(core<=total,'Recorded Core cash history exceeds the total actual cash rolls.');return {aslan:total-core,core};}
