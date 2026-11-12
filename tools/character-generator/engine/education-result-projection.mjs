// Derived evidence only. No state writes, dice draws or saved presentation copy.
import {EDUCATION_PACK,educationEntryCheck,educationGraduationCheck,educationCareerBenefits} from './education-pack.mjs';
import {PRECAREERS,CAREERS,SPECIES} from './catalog.mjs';
import {characterChanges} from './audit.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const signed=n=>n>=0?'+'+n:String(n);
function branchIndices(events){
 const branches=[[]];
 for(let i=0;i<events.length;i++){
  const c=events[i].command;
  branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);
 }
 return branches.at(-1);
}
function original(events,index){
 let i=index;for(let depth=0;depth<events.length;depth++){const command=events[i]?.command;if(command?.type!=='gm-replay')return {command,beforeIndex:i};i=command.payload.revision-1;}return {};
}
function evidence({id,kind,result,index,term,state,log,snapshots,events,branch}){
 for(const i of [...branch].reverse()){
  const {command,beforeIndex}=original(events,i),before=snapshots[beforeIndex],after=snapshots[i+1];
  if(!before||!after||command?.type!==(kind==='admission'?'precareer':'education-graduation'))continue;
  if(kind==='admission'&&(command.payload?.id!==id||before.character.terms+1!==term))continue;
  if(kind==='graduation'&&(before.education!==index||before.character.educations?.[index]?.id!==id))continue;
  const roll=log[i]?.rolls?.find(r=>r.label===(kind==='admission'?'Education entry':'Graduation'));
  const dice=roll?.kept;if(!Array.isArray(dice)||dice.length!==2||dice.some(n=>!Number.isInteger(n)||n<1||n>6)||dice.reduce((a,b)=>a+b,0)!==result.roll)continue;
  if(kind==='admission'&&(SPECIES.find(s=>s.id===before.character.species)?.precareerDM||!Object.hasOwn(before.character.stats,'SOC')))continue;
  let expected;try{expected=kind==='admission'?educationEntryCheck({id,term,stats:before.character.stats,roll:result.roll}):educationGraduationCheck({id,stats:before.character.stats,roll:result.roll,graduationAllowed:before.character.educations[index].graduationAllowed});}catch{continue;}
  if(!equal(expected,result))continue;
  const recorded=kind==='admission'?after.educationResult?.result??after.character.educations?.[index]?.entry:after.character.educations?.[index]?.graduation;
  if(!equal(recorded,result))continue;
  return {i,before,after,dice:[...dice],actionId:log[i].id};
 }
 return null;
}
function sourcedGains({found,endIndex,branch,events,snapshots,kind}){
 const collected=new Map();
 const ignored=new Set(['notes','connection','gm-override','gm-mode','gm-psi-mode','configure','restore']);
 for(const i of branch.filter(i=>i>=found.i&&i<=endIndex)){
  const {command,beforeIndex}=original(events,i),before=snapshots[beforeIndex],after=snapshots[i+1];
  if(!command||ignored.has(command.type))continue;
  const continuation=kind==='graduation'?'education-finish':'education-event';
  if(i!==found.i&&before.effectNext!==continuation&&before.specializationContinuation?.effectNext!==continuation)continue;
  for(const change of characterChanges(before.character,after.character).filter(c=>c.path.startsWith('stats.')||c.path.startsWith('skills.'))){
   if(!Number.isFinite(change.after))continue;
   const previous=collected.get(change.path),delta=change.after-(change.before??0);
   collected.set(change.path,previous?{...previous,after:change.after,delta:previous.delta+delta,continuous:previous.continuous&&previous.after===change.before}:{...change,delta,continuous:true});
  }
 }
 return [...collected.values()].map(c=>{
  const name=c.path.slice(c.path.indexOf('.')+1),skill=c.path.startsWith('skills.');
  return {...c,text:skill?(c.before===null&&c.continuous?name+' '+c.after:c.continuous?name+' '+c.before+' → '+c.after:name+' '+signed(c.delta)+' from resolved education awards'):name+' '+signed(c.delta)+(c.continuous?' ('+c.before+' → '+c.after+')':' from resolved education awards')};
 });
}
const careerName=id=>CAREERS.find(c=>c.id===id)?.name??id;
function futureBenefits(state,record,result){
 const pack=EDUCATION_PACK[record.id],rules=pack.careerRules,out=[];
 const check=(careerId,assignment)=>educationCareerBenefits({id:record.id,graduation:result,careerId,assignment,firstCareerAfterEducation:state.character.careers.length===record.careersBefore,firstCareerAttempt:(record.careerAttempts??0)===0,serviceAwardUsed:!!record.serviceAwardUsed,enteringCareer:true,forcedNextCareer:state.forcedCareer??null,resolvedEducationRulings:!!state.deferredSpecializations});
 if(rules.qualification){
  const values=rules.qualification.careers.map(r=>check(r.career,r.assignment).qualificationModifier??0),modifier=Math.max(...values);
  if(modifier)out.push('Qualification DM '+signed(modifier)+' in eligible careers.');
 }
 const serviceCareer=rules.automaticEntry?.career??rules.failedGraduation?.career;
 if(serviceCareer){
  const rights=check(serviceCareer);
  if(rights.automaticEntry)out.push('Automatic entry to '+careerName(serviceCareer)+(result.graduated?' on the first career attempt after education.':'; first career after education.'));
  if(rights.serviceAward){const award=rights.effects.find(e=>e.kind==='service-training');if(award)out.push('When entering '+careerName(serviceCareer)+': choose '+award.count+' different service skills at level '+award.value+'.');}
  if(rights.commission?.allowed===false)out.push('No commission in the first term of '+careerName(serviceCareer)+'.');
 }
 const commissions=rules.commission.careers.map(id=>({id,result:check(id).commission})).filter(r=>r.result?.allowed);
 if(commissions.length){
  const commission=commissions[0].result,scope=state.forcedCareer?careerName(state.forcedCareer):'military';
  out.push(commission.automatic?'Automatic commission: first-career '+scope+', before term 1.':'First-career '+scope+' commission'+(commission.modifier?' '+signed(commission.modifier):' opportunity')+'; roll required before term 1.');
 }
 return out;
}
export function educationResultProjection({state,log,snapshots,events}){
 const study=state.stage==='education-skill'&&['university-0','university-1'].includes(state.pendingChoice?.selectionId);
 const pending=state.stage==='education-result'?state.educationResult:null;
 if(!pending&&!study)return null;
 const index=study?state.education:pending.educationIndex,record=state.character.educations?.[index];
 const kind=study?'admission':pending.kind,id=study?record?.id:pending.id,result=study?record?.entry:pending.result;
 if(!EDUCATION_PACK[id]||!['admission','graduation'].includes(kind)||!result||result.manual||result.needsAdjudication||result.id!==id||!Number.isInteger(result.roll)||!Number.isFinite(result.total)||!Number.isFinite(result.target))return null;
 if(kind==='graduation'&&(!result.attempted||!record?.completed||!equal(record.graduation,result)))return null;
 if(kind==='admission'&&typeof result.success!=='boolean'||kind==='graduation'&&(typeof result.graduated!=='boolean'||typeof result.honours!=='boolean'))return null;
 const branch=branchIndices(events),term=record?.term??state.character.terms+1;
 const found=evidence({id,kind,result,index,term,state,log,snapshots,events,branch});if(!found)return null;
 let completed=found.after,endIndex=found.i;
 if(kind==='graduation'){
  const completion=branch.find(i=>i>=found.i&&snapshots[i+1]?.character.educations?.[index]?.completed&&equal(snapshots[i+1].character.educations[index].graduation,result));
  if(completion===undefined)return null;completed=snapshots[completion+1];endIndex=completion;
 }else if(!study&&result.success){
  const completion=branch.find(i=>i>=found.i&&snapshots[i+1]?.educationResult?.kind==='admission'&&snapshots[i+1].educationResult.educationIndex===index&&equal(snapshots[i+1].educationResult.result,result));
  if(completion===undefined)return null;completed=snapshots[completion+1];endIndex=completion;
 }
 const changes=sourcedGains({found,endIndex,branch,events,snapshots,kind}),outcome=kind==='admission'?(result.success?'success':'failure'):result.honours?'honours':result.graduated?'success':'failure';
 const model={id,name:PRECAREERS.find(p=>p.id===id)?.name??EDUCATION_PACK[id].name,kind,outcome,dice:found.dice,modifier:result.total-result.roll,total:result.total,target:result.target,honoursTarget:result.honoursTarget??null,source:structuredClone(result.source),actionId:found.actionId,details:[],benefits:[],retained:[],missed:[],actualAwardChanges:changes,years:0,terms:0,study,studyStep:study?(state.pendingChoice.selectionId==='university-0'?1:2):null,continuation:pending?.nextStage??null};
 if(kind==='admission'){
  if(result.success){if(!study)model.benefits=changes.map(c=>c.text);}else model.details.push('One admission attempt used. This term remains available for a career.');
  return model;
 }
 model.years=completed.character.age-found.before.character.age;model.terms=completed.character.terms-found.before.character.terms;
 const skillGains=changes.filter(c=>c.path.startsWith('skills.')).map(c=>c.text);
 model.benefits=[...(skillGains.length?[skillGains.join(' · ')]:[]),...changes.filter(c=>!c.path.startsWith('skills.')).map(c=>c.text),...futureBenefits(completed,record,result)];
 if(completed.forcedCareer)model.details.push('Required next career: '+careerName(completed.forcedCareer)+'. It takes precedence over other education entry benefits.');
 if(!result.graduated){
  model.retained=['Earlier skills and resolved event gains are not removed.'];
  if(id==='core.university'){
   const admission=evidence({id,kind:'admission',result:record.entry,index,term:record.term,state,log,snapshots,events,branch});
   const initialEnd=admission&&branch.find(i=>i>=admission.i&&i<found.i&&snapshots[i+1]?.stage==='education-event'&&snapshots[i+1].education===index);
   if(initialEnd!==undefined&&admission){
    const initialEdu=sourcedGains({found:admission,endIndex:initialEnd,branch,events,snapshots,kind:'admission'}).find(c=>c.path==='stats.EDU'&&c.delta>0);
    if(initialEdu)model.retained.push('Initial EDU '+signed(initialEdu.delta)+' is not removed by this result.');
   }
  }
  const selections=Object.values(record.selections??{}),studySkills=[];
  for(const name of selections){const base=name.split(' (')[0],level=found.before.character.skills[name]??found.before.character.skills[base];if(Number.isFinite(level))studySkills.push(name+' '+level);}
  if(studySkills.length)model.retained.push(studySkills.join(' · '));
  model.missed=id==='core.university'?['No graduation skill increases or EDU award.','No graduate qualification or commission benefits.']:['No graduation EDU award or honours SOC award.','No graduate service-skill award or graduate commission benefit.'];
 }
 return model;
}
