// Original bounded transfer mechanics. Aliens of Charted Space Volume 1 Update 2026,
// pp.195,261,267,269. Ordinary rank awards and later-career training remain session procedures.
// No source prose, random generator, state mutation, or private source locations.
const source=page=>({id:'aliens',title:'Aliens of Charted Space Volume 1 Update 2026',pages:[page]});
const rules=[
 {id:'zhodani.army-guard',from:'zhodani.army',to:'zhodani.guard',assignment:null,retainRank:true,track:'preserve-military',socMin:10,page:261},
 {id:'zhodani.guard-agent',from:'zhodani.guard',to:'zhodani.agent',assignment:'tavrchedl',retainRank:true,track:'single',page:267},
 {id:'zhodani.merchant-navy',from:'zhodani.merchant',to:'zhodani.navy',assignment:null,retainRank:true,track:'source-decision',page:269},
 {id:'vargr.loner-spacer',from:'vargr.loner',to:'vargr.spacer',assignment:'corsair',retainRank:false,track:'single',page:195}
];
export const CAREER_TRANSFER_RULES=Object.freeze(rules.map(rule=>Object.freeze(rule)));
const clone=value=>structuredClone(value);
function need(value,message){if(!value)throw new Error(message);}
function integer(value,min,max,label){need(Number.isSafeInteger(value)&&value>=min&&value<=max,label+' is invalid.');return value;}
function ruleById(id){const rule=rules.find(r=>r.id===id);need(rule,'Unknown bounded career-transfer rule.');return rule;}
export function careerTransferRule(fromCareerId,effect={}){
 const rule=rules.find(r=>r.from===fromCareerId&&effect.kind==='career-status'&&effect.action==='auto-qualify'&&effect.career===r.to&&
  (effect.assignment??null)===r.assignment&&!!effect.retainRank===r.retainRank&&!effect.careerGroup&&!effect.careerChoices);
 return rule?clone(rule):null;
}
export function createCareerTransfer({ruleId,id,sourceCareerIndex,sourceAssignment,sourceRank,sourceOfficer,completedTerms,soc}={}){
 const rule=ruleById(ruleId);need(typeof id==='string'&&id.length>0&&id.length<=100,'A transfer record ID is required.');
 integer(sourceCareerIndex,0,2000,'Source career index');integer(sourceRank,0,6,'Source rank');integer(completedTerms,0,2000,'Completed terms');
 need(typeof sourceOfficer==='boolean','Source officer status is required.');need(typeof sourceAssignment==='string'&&sourceAssignment,'Source assignment is required.');
 if(rule.socMin)need(Number.isInteger(soc)&&soc>=rule.socMin,'The transfer source requires SOC '+rule.socMin+' or greater.');
 return {id,ruleId:rule.id,source:source(rule.page),sourceCareerId:rule.from,sourceCareerIndex,sourceAssignment,sourceRank,sourceOfficer,
  grantedAtCompletedTerms:completedTerms,availableAtCompletedTerms:completedTerms+1,targetCareerId:rule.to,targetAssignmentId:rule.assignment,
  retainedRank:rule.retainRank?sourceRank:null,rankTrack:rule.track==='preserve-military'?(sourceOfficer?'officer':'enlisted'):rule.track==='single'?'single':null,
  status:'unconsumed',rankTrackDecision:null,consumed:null,expired:null};
}
function verify(right){
 need(right&&typeof right==='object','A saved transfer right is required.');const rule=ruleById(right.ruleId);
 need(right.sourceCareerId===rule.from&&right.targetCareerId===rule.to&&(right.targetAssignmentId??null)===rule.assignment,'Transfer target contradicts the source rule.');
 need(typeof right.sourceOfficer==='boolean','Source officer status is required.');integer(right.sourceRank,0,6,'Source rank');integer(right.sourceCareerIndex,0,2000,'Source career index');
 integer(right.grantedAtCompletedTerms,0,2000,'Grant term');need(right.availableAtCompletedTerms===right.grantedAtCompletedTerms+1,'Transfer is valid only in its immediately following term.');
 need(right.retainedRank===(rule.retainRank?right.sourceRank:null),'Retained rank contradicts the source rule.');
 need(['unconsumed','consumed','expired'].includes(right.status),'Invalid transfer status.');
 const track=rule.track==='preserve-military'?(right.sourceOfficer?'officer':'enlisted'):rule.track==='single'?'single':null;
 need(right.rankTrack===track,'Rank-track provenance contradicts the source rule.');return rule;
}
export function careerTransferExpiry({right,completedTerms,careerCount}={}){
 verify(right);integer(completedTerms,0,2000,'Completed terms');integer(careerCount,0,2000,'Career count');
 if(right.status!=='unconsumed')return null;
 if(careerCount>right.sourceCareerIndex+1)return {reason:'another-career-entered',completedTerms,careerCount};
 if(completedTerms>right.availableAtCompletedTerms)return {reason:'next-term-window-ended',completedTerms,careerCount};
 return null;
}
export function careerTransferEligibility({right,completedTerms,careerCount,activeCareerIndex,careerId,assignmentId}={}){
 verify(right);integer(completedTerms,0,2000,'Completed terms');integer(careerCount,0,2000,'Career count');
 const reasons=[];
 if(right.status!=='unconsumed')reasons.push('right-'+right.status);
 const expiry=careerTransferExpiry({right,completedTerms,careerCount});if(expiry)reasons.push(expiry.reason);
 if(completedTerms<right.availableAtCompletedTerms)reasons.push('source-term-incomplete');
 if(careerCount!==right.sourceCareerIndex+1)reasons.push('source-career-not-latest');
 if(activeCareerIndex!==null)reasons.push('finish-source-career-and-benefits');
 if(careerId!==right.targetCareerId)reasons.push('different-target-career');
 if(right.targetAssignmentId&&assignmentId!==right.targetAssignmentId)reasons.push('different-target-assignment');
 return {available:reasons.length===0,reasons,source:clone(right.source)};
}
export function careerTransferEntry(input={}){
 const {right,rankTrackDecision=right?.rankTrackDecision}=input,rule=verify(right),eligibility=careerTransferEligibility(input);
 if(!eligibility.available)return {...eligibility,resolved:true,automaticEntry:false,needsAdjudication:false};
 let rankTrack=right.rankTrack,decision=null;
 if(rule.track==='source-decision'){
  if(rankTrackDecision===null||rankTrackDecision===undefined)return {...eligibility,resolved:false,automaticEntry:true,needsAdjudication:true,
   requiredFields:['transferRankTrack'],rankTracks:['enlisted','officer'],rank:right.retainedRank};
  need(rankTrackDecision&&['enlisted','officer'].includes(rankTrackDecision.rankTrack),'Choose an enlisted or officer transfer rank track.');
  need(typeof rankTrackDecision.reason==='string'&&rankTrackDecision.reason.trim()&&rankTrackDecision.reason.length<=500,'A source reason is required for the rank-track decision.');
  rankTrack=rankTrackDecision.rankTrack;decision={rankTrack,reason:rankTrackDecision.reason.trim(),source:source(rule.page)};
 }else need(rankTrackDecision===null||rankTrackDecision===undefined,'This transfer uses its established source rank track.');
 return {...eligibility,resolved:true,automaticEntry:true,needsAdjudication:false,rank:right.retainedRank,
  officer:rankTrack==='officer',rankTrack,decision,source:source(rule.page)};
}
