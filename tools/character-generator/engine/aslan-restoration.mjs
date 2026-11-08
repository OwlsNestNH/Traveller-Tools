// Original bounded procedure: Aliens of Charted Space Volume 1 Update 2026 pp.16,22,41.
// Original family SOC and the status timing are referee inputs, never inferred.
export const ASLAN_RESTORATION_SOURCE=Object.freeze({id:'aliens',page:41});
const need=(condition,message)=>{if(!condition)throw Error(message);};
const integer=(value,min,max,label)=>{need(Number.isInteger(value)&&value>=min&&value<=max,label+' is invalid.');return value;};
export function createAslanRestoration({id,careerId,careerIndex,assignment,completedTerms,soc,outcast}={}){
 need(careerId==='aslan.outcast','Restoration requires the earned Outcast event.');need(typeof id==='string'&&id,'Restoration ID is required.');
 integer(careerIndex,0,2000,'Career index');integer(completedTerms,0,2000,'Completed terms');integer(soc,0,40,'Current SOC');need(typeof assignment==='string'&&assignment,'Assignment is required.');
 return {id,source:{...ASLAN_RESTORATION_SOURCE},eventResult:11,originCareerId:careerId,originCareerIndex:careerIndex,originAssignment:assignment,grantedAtCompletedTerms:completedTerms,availableAtCompletedTerms:completedTerms+1,socBefore:soc,outcastBefore:!!outcast,status:'offered',decision:null,socAfter:null,outcastAfter:null,attempt:null,expiry:null};
}
export function aslanRestorationDecision(payload={},gm=false){
 need(typeof payload.accept==='boolean','Choose whether to accept restoration.');
 if(!payload.accept){need(Object.keys(payload).every(k=>k==='accept'),'Declining restoration does not take unrelated fields.');return {accept:false};}
 need(gm,'Enable GM mode to verify original family SOC and the source timing.');
 need(Object.keys(payload).every(k=>['accept','originalSOC','originalSOCConfirmed','statusTiming','reason'].includes(k)),'Use only the typed restoration fields.');
 integer(payload.originalSOC,1,40,'Verified original SOC');need(payload.originalSOCConfirmed===true,'Confirm the original family SOC from the character source history.');
 need(['on-restoration','on-successful-entry'].includes(payload.statusTiming),'Record when the referee rules that current Outcast status ends.');
 need(typeof payload.reason==='string'&&payload.reason.trim().length>0&&payload.reason.trim().length<=500,'A source reason of 1 to 500 characters is required.');
 return {accept:true,originalSOC:payload.originalSOC,originalSOCConfirmed:true,statusTiming:payload.statusTiming,reason:payload.reason.trim()};
}
export function aslanRestorationAvailability({restoration,stage,activeCareerIndex,completedTerms,careerCount,originCareer,retired=false,deceased=false}={}){
 let reason='';
 if(restoration.status!=='available')reason='This restoration attempt is not available.';
 else if(deceased||retired)reason='Character creation has ended.';
 else if(completedTerms!==restoration.availableAtCompletedTerms)reason='The qualification permission applies only to the following term.';
 else if(careerCount!==restoration.originCareerIndex+1)reason='Another career has already been entered.';
 else if(!originCareer||originCareer.id!==restoration.originCareerId)reason='The originating Outcast career is unavailable.';
 else if(originCareer.forcedStay)reason='A natural 12 requires another term in the originating career.';
 else if(stage!=='career'||activeCareerIndex!==null||!originCareer.exit)reason='Finish the originating term, due ageing and benefits before qualification.';
 return {available:!reason,reason};
}
export function aslanRestorationExpiry({restoration,completedTerms,careerCount,deceased=false,retired=false}={}){
 if(restoration.status!=='available')return null;
 if(deceased)return {status:'deceased',reason:'character-deceased',generationTerms:completedTerms};
 if(retired)return {status:'expired',reason:'character-retired',generationTerms:completedTerms};
 if(careerCount>restoration.originCareerIndex+1)return {status:'expired',reason:'another-career-entered',generationTerms:completedTerms};
 if(completedTerms>restoration.availableAtCompletedTerms)return {status:'expired',reason:'next-term-window-ended',generationTerms:completedTerms};
 return null;
}
