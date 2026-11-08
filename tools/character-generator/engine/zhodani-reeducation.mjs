// Original procedural mechanics: Aliens of Charted Space Volume 1 Update 2026,
// printed pp.254-256,276-277; Core Rulebook Update 2022, pp.11,48-49.
// Caller-supplied dice and explicit source rulings only. No random generator or state mutation.
export const ZHODANI_REEDUCATION_SOURCE=Object.freeze({id:'aliens',title:'Aliens of Charted Space Volume 1 Update 2026',page:276});
const source=()=>structuredClone(ZHODANI_REEDUCATION_SOURCE);
const need=(value,message)=>{if(!value)throw new Error(message);};
function integer(value,min,max,label){need(Number.isSafeInteger(value)&&value>=min&&value<=max,label+' is invalid.');return value;}
function number(value,min,max,label){need(Number.isFinite(value)&&value>=min&&value<=max,label+' is invalid.');return value;}
function reason(value,label){need(typeof value==='string'&&value.trim()&&value.length<=500,label+' requires a source reason.');return value.trim();}
function decision(value,modes,label){need(value&&modes.includes(value.mode),'Choose a supported '+label+'.');return {mode:value.mode,reason:reason(value.reason,label)};}
const clean=value=>Math.round(value*1e9)/1e9;

export function reeducationRoll({die,anagathicTerms}={}){
 integer(die,1,6,'Re-education die');integer(anagathicTerms,0,1000,'Anagathic terms');
 return {source:source(),die,anagathicTerms,modifier:anagathicTerms===0?0:-anagathicTerms,total:die-anagathicTerms};
}
export function reeducationPlan({roll,stats,cash,context={},decisions={},fineDie}={}){
 need(roll&&typeof roll==='object','A re-education roll is required.');
 const verified=reeducationRoll(roll);need(roll.total===verified.total&&roll.modifier===verified.modifier,'The roll audit is inconsistent.');
 need(stats&&typeof stats==='object','Characteristic scores are required.');integer(stats.END,0,40,'END');integer(stats.SOC,0,40,'SOC');number(cash,0,100000000,'Available cash');
 need(decisions&&typeof decisions==='object'&&!Array.isArray(decisions),'Typed decisions are required.');
 const requirements=[],recorded={},allowed=new Set(),requireField=(key,extra={})=>requirements.push({key,...extra});
 let row=verified.total;
 if(row<1||row>6){
  allowed.add('rowOverride');
  if(!decisions.rowOverride){requireField('rowOverride',{rows:[1,2,3,4,5,6]});return {source:source(),row:null,roll:verified,requirements,decisions:recorded,resolved:false};}
  row=integer(decisions.rowOverride.row,1,6,'Adjudicated row');recorded.rowOverride={row,reason:reason(decisions.rowOverride.reason,'Row override')};
 }
 const timed=row<=4,months=row<=2?48:null;
 let durationMonths=months,chronology=null;
 if(row===3||row===4){
  allowed.add('duration');
  if(!decisions.duration)requireField('duration',{minimumExclusive:0,maximumExclusive:12,unit:'months'});
  else{const value=number(decisions.duration.months,0,12,'Treatment months');need(value>0&&value<12,'Treatment duration must be greater than zero and less than 12 months.');durationMonths=value;recorded.duration={months:value,reason:reason(decisions.duration.reason,'Duration')};}
 }
 if(timed){
  allowed.add('chronology');
  if(!decisions.chronology)requireField('chronology',{options:['before-resume','after-current-term']});
  else{recorded.chronology=decision(decisions.chronology,['before-resume','after-current-term'],'chronology');chronology=recorded.chronology.mode;}
 }
 let disposition=row===1||row===3?'leave':row===2?'stay':'unchanged';
 if(context.protectedStay)disposition='stay';
 else if(row===2&&context.explicitDischarge){
  allowed.add('disposition');
  if(!decisions.disposition)requireField('disposition',{options:['stay','leave']});
  else{recorded.disposition=decision(decisions.disposition,['stay','leave'],'career disposition');disposition=recorded.disposition.mode;}
 }
 let fine=0,funding=null;
 if(row===5){
  if(fineDie===undefined)requireField('fineDie',{dice:'1D'});
  else{
   fine=integer(fineDie,1,6,'Fine die')*1000;funding='cash';
   if(fine>cash){
    allowed.add('funding');
    if(!decisions.funding)requireField('funding',{options:['debt','provided'],amount:fine,shortfall:fine-cash});
    else{recorded.funding=decision(decisions.funding,['debt','provided'],'fine funding');funding=recorded.funding.mode;}
   }
  }
 }
 let endAfter=stats.END-(row===1?1:0),deceased=false;
 if(row===1)allowed.add('endZero');
 if(row===1&&endAfter<=0){
  if(!decisions.endZero)requireField('endZero',{options:['restore-to-one','death']});
  else{recorded.endZero=decision(decisions.endZero,['restore-to-one','death'],'END-zero outcome');deceased=recorded.endZero.mode==='death';endAfter=deceased?0:1;}
 }
 for(const key of Object.keys(decisions))need(allowed.has(key),'The '+key+' decision is not required for this result.');
 const socAfter=row===1&&stats.SOC>=11?Math.max(11,stats.SOC-1):stats.SOC;
 return {source:source(),row,roll:verified,requirements,resolved:requirements.length===0,decisions:recorded,
  durationMonths:timed?durationMonths:0,chronology,disposition,protectedStay:!!context.protectedStay,explicitDischarge:!!context.explicitDischarge,
  endAfter,socAfter,deceased,fine,funding,benefitRolls:row===6?1:0,
  careerCredit:{terms:0,benefitRolls:0,advancement:0,skills:0,pensionTerms:0}};
}
export function treatmentTimeline({age,nonCareerMonths=0,months,careerTerms}={}){
 number(age,0,500,'Age');number(nonCareerMonths,0,24000,'Non-career months');number(months,0,48,'Treatment months');need(months>0,'Treatment must take positive time.');
 integer(careerTerms,0,2000,'Completed generation terms');
 const ageAfter=clean(age+months/12),monthsAfter=clean(nonCareerMonths+months),checkpoints=[];
 for(let boundary=34;boundary<=ageAfter+1e-9;boundary+=4){
  if(boundary<=age+1e-9)continue;
  const addedMonths=clean((boundary-age)*12),credit=Math.floor((nonCareerMonths+addedMonths+1e-9)/48);
  checkpoints.push({age:boundary,terms:careerTerms+credit,treatmentTermCredit:credit,source:{id:'core',page:48}});
 }
 return {ageBefore:age,ageAfter,months,nonCareerMonthsBefore:nonCareerMonths,nonCareerMonthsAfter:monthsAfter,
  ageingCreditBefore:Math.floor((nonCareerMonths+1e-9)/48),ageingCreditAfter:Math.floor((monthsAfter+1e-9)/48),checkpoints};
}
export function zhodaniStatusPlan({soc,psi,inCareer,permanentlyLost=false}={}){
 integer(soc,0,40,'SOC');integer(psi,0,40,'PSI');need(typeof inCareer==='boolean','Career context is required.');
 return {source:{id:'aliens',page:255},elevate:inCareer&&!permanentlyLost&&soc<10&&psi>=9,socAfter:inCareer&&!permanentlyLost&&soc<10&&psi>=9?10:soc,
  reapplyInitialEducation:false,removeBackgroundSkills:false,resetTalentHistory:false};
}
// Explicit discharge is separate from the ordinary failed-survival default.
// Protected career events have higher priority and retain their provenance.
export const REEDUCATION_EXPLICIT_DISCHARGE=Object.freeze({
 'zhodani.agent':[2,4],'zhodani.army':[3,4],'zhodani.entertainer':[3],
 'zhodani.government':[5],'zhodani.scholar':[2]
});
