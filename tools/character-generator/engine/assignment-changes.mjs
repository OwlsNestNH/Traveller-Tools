// Original procedural rules: Traveller Core Rulebook Update 2022 pp. 14, 18-20, 38, 49.
export const ASSIGNMENT_SOURCE=Object.freeze({id:'core',page:20});
export const CORE_ASSIGNMENT_MODES=Object.freeze({
 'core.army':'retain','core.marine':'retain','core.navy':'retain','core.noble':'retain','core.rogue':'retain','core.scholar':'retain','core.scout':'retain',
 'core.agent':'restart','core.citizen':'restart','core.entertainer':'restart','core.merchant':'restart'
});
export function nobleAutomaticQualification(careerId,stats={}){return careerId==='core.noble'&&Number.isFinite(stats.SOC)&&stats.SOC>=10;}
export function careerReentryPlan({careerId,assignment,previous,generationTerms,drafted=false}={}){
 if(!previous||previous.id!==careerId)return {allowed:true,mode:'new',reason:''};
 if(careerId==='core.drifter'||drafted)return {allowed:true,mode:drafted?'draft':'return',reason:''};
 if(!Number.isInteger(previous.exitGenerationTerms))return {allowed:false,mode:'return',reason:'The previous career exit boundary is not recorded.'};
 if(generationTerms>previous.exitGenerationTerms)return {allowed:true,mode:'return',reason:''};
 if(CORE_ASSIGNMENT_MODES[careerId]==='restart'&&previous.exit==='voluntary'&&assignment!==previous.exitAssignment)return {allowed:true,mode:'assignment-restart',reason:''};
 return {allowed:false,mode:'return',reason:'Cannot immediately return to the same career except through a voluntary new-assignment route or the draft.'};
}
export function assignmentChangePlan({careerId,fromAssignment,toAssignment,stage,forcedExit=false,forcedStay=false,forcedCareer=null,canLeave=false}={}){
 const mode=CORE_ASSIGNMENT_MODES[careerId];let reason='';
 if(stage!=='term-end')reason='Resolve the current term and ageing first.';
 else if(!mode)reason='This career needs its own assignment-change source procedure.';
 else if(fromAssignment===toAssignment)reason='Choose a different assignment.';
 else if(forcedExit)reason='A forced departure cannot be used to change assignments.';
 else if(forcedCareer)reason='Resolve the required next career.';
 else if(mode==='restart'&&(forcedStay||!canLeave))reason=forcedStay?'Another term in this career is required.':'This career cannot be left voluntarily now.';
 return {available:!reason,mode:mode??null,reason,source:{...ASSIGNMENT_SOURCE}};
}
