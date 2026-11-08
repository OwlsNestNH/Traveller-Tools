// Original bounded procedures: Aliens of Charted Space Volume 1 Update 2026 pp.16,22,43.
// The male restoration value and female marital eligibility require explicit source verification.
const need=(condition,message)=>{if(!condition)throw Error(message);};
const integer=(value,min,max,label)=>{need(Number.isInteger(value)&&value>=min&&value<=max,label+' is invalid.');return value;};
const reason=value=>{need(typeof value==='string'&&value.trim().length>0&&value.trim().length<=500,'A source reason of 1 to 500 characters is required.');return value.trim();};
export function createAslanOutlawRestoration({id,careerId,careerIndex,assignment,careerTerms,completedTerms,gender,soc,outcast,forcedExit,forcedStay}={}){
 need(careerId==='aslan.outlaw','This result requires the earned Outlaw event.');need(typeof id==='string'&&id,'Restoration ID is required.');need(['male','female'].includes(gender),'This event requires a source-defined gender branch.');
 integer(careerIndex,0,2000,'Career index');integer(careerTerms,0,2000,'Career terms');integer(completedTerms,0,2000,'Completed terms');integer(soc,0,40,'Current SOC');need(typeof assignment==='string'&&assignment,'Assignment is required.');
 return {id,source:{id:'aliens',page:43},eventResult:11,originCareerId:careerId,originCareerIndex:careerIndex,originAssignment:assignment,originCareerTerms:careerTerms,grantedAtCompletedTerms:completedTerms,gender,socBefore:soc,outcastBefore:!!outcast,exitBefore:!!forcedExit,stayBefore:!!forcedStay,status:'pending',decision:null,socRoll:null,socAfter:null,outcastAfter:null,clanShares:0,shareAwardIds:[],married:false,departure:null};
}
export function aslanOutlawRestorationDecision({gender,payload={},gm=false}={}){
 need(['male','female'].includes(gender),'This event requires a source-defined gender branch.');
 if(gender==='male'){
  need(payload.decision==='restore','The male event requires its restoration procedure; no decline is specified.');
  need(gm,'Enable GM mode to verify the restored SOC.');need(Object.keys(payload).every(k=>['decision','originalSOC','originalSOCConfirmed','reason'].includes(k)),'Use only the typed male restoration fields.');
  integer(payload.originalSOC,1,40,'Verified original SOC');need(payload.originalSOCConfirmed===true,'Confirm the restored SOC from the source and original character history.');
  return {decision:'restore',originalSOC:payload.originalSOC,originalSOCConfirmed:true,reason:reason(payload.reason)};
 }
 if(payload.decision==='decline'){need(Object.keys(payload).every(k=>k==='decision'),'Declining marriage does not take unrelated fields.');return {decision:'decline'};}
 need(gm,'Enable GM mode to verify current marriage eligibility.');need(['marry','ineligible'].includes(payload.decision),'Choose marriage, decline, or verified ineligibility.');
 need(Object.keys(payload).every(k=>['decision','unmarriedConfirmed','reason'].includes(k)),'Use only the typed marriage eligibility fields.');
 need(payload.unmarriedConfirmed===(payload.decision==='marry'),'Confirm the current unmarried eligibility, without inferring it from missing history.');
 return {decision:payload.decision,unmarriedConfirmed:payload.unmarriedConfirmed,reason:reason(payload.reason)};
}
export function aslanOutlawRestorationOutcome({gender,decision,socDice}={}){
 if(gender==='male'){
  need(decision.decision==='restore','Male restoration decision is missing.');integer(decision.originalSOC,1,40,'Verified original SOC');need(socDice===undefined,'Male restoration has no SOC roll.');
  return {restored:true,soc:decision.originalSOC,clanShares:3,requiredExit:true,married:false};
 }
 need(gender==='female','Unknown restoration branch.');
 if(['decline','ineligible'].includes(decision.decision)){need(socDice===undefined,'A declined or ineligible marriage has no SOC roll.');return {restored:false,clanShares:0,requiredExit:false,married:false};}
 need(decision.decision==='marry'&&decision.unmarriedConfirmed===true,'Marriage eligibility has not been verified.');
 need(Array.isArray(socDice)&&socDice.length===2&&socDice.every(n=>Number.isInteger(n)&&n>=1&&n<=6),'Supply the two actual SOC dice.');
 return {restored:true,soc:socDice[0]+socDice[1],clanShares:0,requiredExit:true,married:true};
}
