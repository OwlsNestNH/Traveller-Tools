import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAREERS,SPECIES,SKILLS} from '../engine/catalog.mjs';
import {SPECIALITIES,PSIONIC_TALENTS} from '../engine/skills.mjs';
import {createSession,execute} from '../engine/session.mjs';

// WHITE-BOX CONTINUATION STRESS ONLY.
// These synthetic fixtures bypass qualification, background and species setup.
// They do not certify complete character generation or source-rule compliance.
// Stop at explicit source-assisted steps; never silently adjudicate them.
// Examples:
//   node tools/character-generator/verification/career-smoke.mjs
//   node tools/character-generator/verification/career-smoke.mjs --seeds=200
//   node tools/character-generator/verification/career-smoke.mjs --seeds=100 --terms=6 --mental=2
function option(name,fallback,min,max) {
 const value=process.argv.find(arg=>arg.startsWith('--'+name+'='));
 const number=value===undefined?fallback:Number(value.slice(name.length+3));
 assert.ok(Number.isInteger(number)&&number>=min&&number<=max,'Invalid --'+name);
 return number;
}
const seeds=option('seeds',20,1,500),termGoal=option('terms',3,1,10),mental=option('mental',8,2,15);
const sourceURL=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(sourceURL,'utf8');
source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,relative)=>'from '+JSON.stringify(new URL(relative,sourceURL).href));
source+='\nexport const continuationAudit={initial,enterCareer,apply,trainingOptions};';
const {continuationAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const failures=[],stages={},sourceStops={},completedTerms={},completedStages={};
let scenarios=0,completed=0;
for(const career of CAREERS)for(const assignment of career.assignments)for(let seed=0;seed<seeds;seed++) {
 scenarios++;
 let state=a.initial(career.id+'|'+assignment.id+'|smoke'+seed);
 const species=['aslan','vargr','zhodani'].includes(career.group)?career.group:'human';
 state.character.species=species;
 state.character.gender=career.eligibility?.[assignment.id]??career.gender??(seed%2?'male':'female');
 state.character.age=SPECIES.find(item=>item.id===species).startAge;
 state.character.stats={STR:8,DEX:8,END:8,INT:mental,EDU:mental,SOC:8};
 if(species==='aslan')state.character.stats.RITE=6;
 if(species==='vargr'){delete state.character.stats.SOC;state.character.stats.CHA=8;}
 if(species==='zhodani'||career.id.endsWith('.psion')) {
  state.character.stats.PSI=8;
  // Represents talents acquired before entry; this harness does not test acquisition.
  for(const skill of PSIONIC_TALENTS)state.character.skills[skill]=0;
 }
 state.character.skills.Admin=0;
 const trace=[];
 try {
  a.enterCareer(state,career,assignment.id,[]);
  for(let step=0;step<160;step++) {
   stages[state.stage]=(stages[state.stage]??0)+1;
   if(state.stage==='book-step') {
    sourceStops[state.pending.kind]=(sourceStops[state.pending.kind]??0)+1;break;
   }
   if(['career','deceased','finish'].includes(state.stage)) {
    completed++;completedTerms[state.character.terms]=(completedTerms[state.character.terms]??0)+1;
    completedStages[state.stage]=(completedStages[state.stage]??0)+1;break;
   }
   const record=state.character.careers[state.active];
   let command;
   switch(state.stage) {
    case 'injury-loss':command={type:'injury-loss',payload:{index:(seed+step)%state.character.injuries[state.injury].options.length}};break;
    case 'injury-treatment':command={type:'injury-treatment',payload:{restore:{},inService:false}};break;
    case 'effect-choice':
     command={type:'choose-effect',payload:{index:(seed+step)%state.pendingChoice.options.length}};break;
    case 'skill-choice': {
     const pending=state.pendingChoice,bases=pending.names??pending.allowed??SKILLS;
     const candidates=[...new Set([...Object.keys(state.character.skills),...bases.flatMap(name=>
      Object.hasOwn(SPECIALITIES,name)?SPECIALITIES[name]?.map(speciality=>name+' ('+speciality+')')??[name+' (review)']:[name])])];
     const rejected=[];
     for(let attempt=0;attempt<candidates.length;attempt++) {
      const name=candidates[(attempt+seed)%candidates.length],candidate=structuredClone(state);
      try {a.apply(candidate,{type:'choose-skill',payload:{name}},[]);state=candidate;trace.push('choose-skill '+name);break;}
      catch(error){rejected.push(name+': '+error.message);}
     }
     if(rejected.length===candidates.length)throw new Error('No accepted mandatory skill choice: '+JSON.stringify(pending)+'; '+rejected.slice(-4).join('; '));
     continue;
    }
    case 'training': {
     const tables=a.trainingOptions(state);
     if(!tables.length)throw new Error('No available mandatory training table.');
     command={type:'training',payload:{table:tables[(seed+step)%tables.length].id}};break;
    }
    case 'survival':command={type:'survival'};break;
    case 'advancement':
     if(seed%3===0&&career.commission&&!record.officer&&!record.commissionTried&&
       (record.terms===0||(state.character.stats.SOC??0)>=9)&&
       !(career.group==='zhodani'&&(state.character.stats.SOC??0)<10))command={type:'commission'};
     else command={type:'advancement'};break;
    case 'term-end':
     command={type:record.forcedExit?'leave-career':
      record.forcedStay||career.id==='core.prisoner'&&!record.released||record.terms<termGoal?'continue-career':'leave-career',
      payload:{retire:true}};break;
    case 'benefits':
     command={type:'benefit',payload:{cash:seed%2===0&&state.cashRolls<3&&!(species==='aslan'&&state.character.gender==='male')}};break;
    case 'ageing':command={type:'ageing'};break;
    default:throw new Error('Unexpected continuation stage '+state.stage);
   }
   trace.push(command.type+(command.payload?' '+JSON.stringify(command.payload):''));
   a.apply(state,command,[]);
   if(step===159)throw new Error('Continuation exceeded 160 actions without completion or an explicit source stop.');
  }
 } catch(error) {
  failures.push({career:career.id,assignment:assignment.id,seed,mental,stage:state.stage,message:error.message,
   pending:state.pendingChoice,record:state.character.careers[state.active],trace:trace.slice(-12)});
 }
}

// Separate PUBLIC-API regression. No white-box fixture, guessed SOC or manual book resolution.
// Native Vargr may be disabled for an incompatible assignment or receive an explicit source stop.
let vargrResult;
try {
 let result={session:createSession('native-vargr-believer-review')};
 const run=(type,payload={})=>result=execute(result.session,{type,payload});
 run('setup',{species:'vargr',name:'Cross-species regression'});
 run('roll-statistics');run('accept-statistics');
 run('background',{skills:result.state.backgroundOptions.slice(0,result.state.backgroundRemaining)});
 run('skip-precareer');
 const career=result.state.careerChoices.find(item=>item.id==='companion.believer');
 if(!career||career.disabled)vargrResult='disabled with source limitation';
 else {
  const mainstream=career.assignments.find(item=>item.id==='mainstream');
  if(!mainstream||mainstream.disabled)vargrResult='assignment disabled with source limitation';
  else {
   run('career',{id:career.id,assignment:mainstream.id});
   for(let choices=0;result.state.stage==='effect-choice'&&choices<20;choices++)run('choose-effect',{index:0});
   if(result.state.stage==='survival')run('survival');
   assert.equal(result.state.stage,'book-step','Unsupported native-Vargr SOC check must stop explicitly.');
   assert.equal(Object.hasOwn(result.state.character.stats,'SOC'),false,'Do not invent SOC for native Vargr.');
   vargrResult='explicit source-assisted stop';
  }
 }
} catch(error) {
 vargrResult='FAILED: '+error.message;
 failures.push({career:'companion.believer',assignment:'mainstream',seed:'native-vargr-believer-review',publicAPI:true,message:error.message});
}
const grouped=new Map();
for(const failure of failures) {
 const type=failure.message.startsWith('No accepted mandatory skill choice')?'No accepted '+failure.pending?.kind:failure.message;
 const key=failure.career+': '+type;
 const group=grouped.get(key)??{reason:key,count:0,examples:[]};group.count++;
 if(group.examples.length<2)group.examples.push(failure);grouped.set(key,group);
}
console.log(JSON.stringify({
 scope:'White-box career continuation stress; not full qualification or source compliance.',
 careers:CAREERS.length,assignments:CAREERS.reduce((sum,career)=>sum+career.assignments.length,0),seeds,termGoal,mental,
 scenarios,completed,completedStages,completedTerms,sourceStopCount:Object.values(sourceStops).reduce((sum,count)=>sum+count,0),
 sourceStops,stages,publicVargrBeliever:vargrResult,failureCount:failures.length,failureGroups:[...grouped.values()]
},null,2));
if(failures.length)process.exitCode=1;
