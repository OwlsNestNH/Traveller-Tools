// Original bounded procedures. Aliens of Charted Space Volume 1 Update 2026 pp.22,31,32,37-39,47.
// Caller supplies context and dice. No source prose or external identifiers.
export const ASLAN_OFFICER_RULES=Object.freeze([
 Object.freeze({origin:'aslan.military',target:'aslan.military-officer',page:31,events:[10]}),
 Object.freeze({origin:'aslan.spacer',target:'aslan.space-officer',page:37,events:[5,10]})
]);
const clone=x=>structuredClone(x);
const need=(v,m)=>{if(!v)throw Error(m);};
const integer=(v,min,max,n)=>{need(Number.isInteger(v)&&v>=min&&v<=max,n+' is invalid.');return v;};
export function aslanOfficerRule(origin,eventResult,target){
 return ASLAN_OFFICER_RULES.find(r=>r.origin===origin&&r.target===target&&r.events.includes(eventResult))??null;
}
export function createAslanOfficerOffer({id,originCareerId,originCareerIndex,originAssignment,eventResult,targetCareerId,completedTerms,originCareerTerms}={}){
 const rule=aslanOfficerRule(originCareerId,eventResult,targetCareerId);need(rule,'Unknown Aslan officer opportunity.');
 need(typeof id==='string'&&id,'An offer ID is required.');integer(originCareerIndex,0,2000,'Origin career index');integer(completedTerms,0,2000,'Completed terms');integer(originCareerTerms,0,2000,'Origin career terms');need(typeof originAssignment==='string'&&originAssignment,'Origin assignment is required.');
 return {id,source:{id:'aliens',page:rule.page},eventResult,originCareerId,originCareerIndex,originAssignment,grantedAtCompletedTerms:completedTerms,originCareerTermsAtGrant:originCareerTerms,availableAtCompletedTerms:completedTerms+1,targetCareerId,status:'offered',selectedAssignment:null,qualificationDM:null,commitment:null,check:null,transitionId:null,newCareerIndex:null,expired:null};
}
export function aslanOfficerExpiry({offer,completedTerms,careerCount,deceased=false}={}){
 if(offer.status!=='offered')return null;
 if(deceased)return {status:'deceased',reason:'character-deceased',completedTerms};
 if(careerCount>offer.originCareerIndex+1)return {status:'expired',reason:'another-career-entered',completedTerms};
 if(completedTerms>offer.availableAtCompletedTerms)return {status:'expired',reason:'next-term-window-ended',completedTerms};
 return null;
}
export function aslanOfficerEligibility({offer,stage,completedTerms,activeCareerIndex,originCareer,careerCount,outcast=false,forcedCareer=null,retired=false,qualificationBanned=false}={}){
 let reason='';
 if(offer.status!=='offered')reason='This offer has already been used or reserved.';
 else if(!originCareer||originCareer.id!==offer.originCareerId)reason='The originating career is unavailable.';
 else if(completedTerms!==offer.availableAtCompletedTerms)reason='This offer is valid only for the following term.';
 else if(careerCount!==offer.originCareerIndex+1)reason='Another career has already been entered.';
 else if(retired)reason='Character creation has ended.';
 else if(outcast)reason='Outcast status prevents officer entry.';
 else if(qualificationBanned)reason='An ageing crisis prevents this required qualification roll.';
 else if(forcedCareer)reason='Resolve the required next career before using this offer.';
 else if(originCareer.forcedStay)reason='A natural 12 requires another term in the originating career.';
 else if(!((stage==='term-end'&&activeCareerIndex===offer.originCareerIndex&&!originCareer.exit)||(stage==='career'&&activeCareerIndex===null&&originCareer.exit)))reason='Finish the originating term, ageing and benefits before officer qualification.';
 const earlyExit=!!originCareer&&!originCareer.exit&&originCareer.terms<3&&!originCareer.forcedExit;
 return {available:!reason,reason,earlyExit,qualificationDM:originCareer?.terms??null};
}
export const ASLAN_OFFICER_RANK_OPTIONS=Object.freeze([{id:'pilot-gunner',name:'Pilot/Gunner'},{id:'engineer-crew',name:'Engineer/Crew'}].map(Object.freeze));
// Explicit campaign interpretation of the mismatched headings on Aliens 2026 pp.38–39.
export const ASLAN_SPACE_OFFICER_MAPPING=Object.freeze({shipmaster:'pilot-gunner',navigator:'engineer-crew'});
export function aslanSpaceOfficerRankMapping(assignment){
 const tableId=ASLAN_SPACE_OFFICER_MAPPING[assignment];
 return tableId?{tableId,reason:'Source interpretation: Shipmaster uses Pilot/Gunner; Navigator uses Engineer/Crew.',source:{id:'aliens',page:39},interpretation:'resolved-assignment-headings'}:null;
}
export function aslanOfficerRankEffects(tableId,rank){
 need(ASLAN_OFFICER_RANK_OPTIONS.some(x=>x.id===tableId),'Choose one of the printed rank-table headings.');integer(rank,0,6,'Rank');
 const skill=(name)=>({kind:'skill',name,mode:'set',value:1,source:{id:'aliens',page:39}});
 if(rank===1)return [skill(tableId==='pilot-gunner'?'Admin':'Astrogation')];
 if(rank===3)return [skill(tableId==='pilot-gunner'?'Advocate':'Electronics')];
 if(rank===6)return [{kind:'benefit',name:'Clan Share',value:2,source:{id:'aliens',page:39}}];
 return [];
}
export function aslanClanShareTokens(benefits=[]){
 return benefits.filter(b=>!b.assetId&&(b.definitionId==='aslan.clan-share'||/^clan shares?$/i.test(String(b.name).trim()))).map(clone);
}
