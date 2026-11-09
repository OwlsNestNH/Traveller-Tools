import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {api} from '../engine/session.mjs';
const arg=(key,fallback)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.split('=').slice(1).join('=')??fallback;
const goal=Number(arg('goal',10)),max=Number(arg('attempts',500));
const catalog=api({operation:'catalog'}),rows=[];
function run(career,assignment,species,n){
 const seed=`full-random-v1|${species}|${career.id}|${assignment.id}|${n}`;
 let r=api({operation:'create',seed}),trace=[],entered=false;
 let random=n+1; const pick=a=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return a[random%a.length];};
 const act=(type,payload={})=>{trace.push({type,payload});const next=api({operation:'command',session:r.session,command:{type,payload}});if(!next.ok)throw Error(next.error.message);r=next;};
 const result=(outcome,reason)=>({seed,outcome,reason,stage:r.state.stage,entered,terms:r.state.character.terms,...(outcome==='error'||outcome==='unsupported-stage'?{trace:trace.slice(-8),pending:r.state.pendingChoice}: {})});
 try{


  act('setup',{species,gender:career.eligibility?.[assignment.id]??career.gender??(n%2?'male':'female')});
  act('roll-statistics');act('accept-statistics');
  for(let step=0;step<180;step++){
   const s=r.state,c=s.character,record=c.careers[s.active];
   assert.ok(Object.values(c.stats).every(Number.isFinite),'Nonfinite statistic');
   assert.ok(Object.values(c.skills).every(v=>Number.isInteger(v)&&v>=0&&v<=4),'Invalid skill level');
   assert.ok(Number.isFinite(c.cash)&&Number.isFinite(c.debt),'Nonfinite cash/debt');
   if(s.stage==='finish'){
    assert.ok(entered,'Finalized without target career');
    assert.ok(c.careers.some(x=>x.id===career.id&&x.assignment===assignment.id&&x.terms>0),'No target career term');
    assert.equal(s.specializationOptions?.count??0,0,'Unallocated skill awards');
    assert.equal(s.active,null,'Active career remains');assert.ok(!s.pending&&!s.pendingChoice&&!s.effectsQueue?.length,'Pending effect remains');
    const imported=api({operation:'import',raw:JSON.stringify(r.session)});assert.equal(imported.ok,true);assert.deepEqual(imported.state,s);
    const replay=api({operation:'project',session:r.session});assert.equal(replay.ok,true);assert.deepEqual(replay.state,s);
    return result('completed');
   }
   if(s.stage==='book-step')return result('source-stop',s.pending?.kind+': '+s.pending?.label);
   if(s.stage==='deceased')return result('deceased');
   if(s.stage==='failed-entry')return result('qualification-failed','Natural qualification failure');
   switch(s.stage){
    case 'aslan-family':act('roll-aslan-family');break;
    case 'aslan-birth-order':act('roll-aslan-birth-order');break;
    case 'aslan-estate':act('resolve-aslan-estate',{method:'printed-minimum'});break;
    case 'aslan-clan':act('roll-aslan-clan');break;
    case 'aslan-pride':act('roll-aslan-pride');break;
    case 'aslan-rite':act('roll-aslan-rite');break;
    case 'background':{const a=s.backgroundOptions.filter(x=>!Object.hasOwn(c.skills,x)),skills=[];while(skills.length<s.backgroundRemaining){const v=pick(a);a.splice(a.indexOf(v),1);skills.push(v);}act('background',{skills});break;}
    case 'precareer':act(career.id.endsWith('.psion')?'precareer':'skip-precareer',career.id.endsWith('.psion')?{id:'companion.psionic'}:{});break;
    case 'companion-admission':act('companion-entry');break;
    case 'psionic-training':if(s.psionicOptions.length)act('learn-talent',{talent:pick(s.psionicOptions).talent});else act('finish-psionic-training');break;
    case 'education-event':act('education-event');break;
    case 'education-graduation':act('education-graduation');break;
    case 'education-check':act('education-check',{name:pick(s.educationCheckSkills)});break;
    case 'education-skill':act('education-skill',{name:pick(s.educationOptions).name});break;
    case 'companion-skill':act('companion-skill',{selected:[pick(s.educationOptions).name]});break;
    case 'career':case 'retirement':{
     if(entered){if(!s.finishOptions.available)return result('source-stop',s.finishOptions.reason);act('finish');break;}
     if(career.id==='core.prisoner'&&!c.sentenced&&!c.careers.length){act('career',{id:'core.rogue',assignment:'thief'});break;}
     const available=s.careerChoices.find(x=>x.id===career.id),a=available?.assignments.find(x=>x.id===assignment.id);
     if(!available||available.disabled||a?.disabled)return result('ineligible',available?.reason||a?.reason||'Career absent');
     act('career',{id:career.id,assignment:assignment.id});entered=r.state.character.careers.some(x=>x.id===career.id);break;
    }
    case 'cross-career-cover':act('cross-career-cover',{careerId:pick(s.currentCrossCareerCover.options).id});break;
    case 'cross-career-training':act('cross-career-training',{assignment:pick(s.currentCrossCareerTraining.options).id});break;
    case 'effect-choice':act('choose-effect',{index:s.pendingChoice.options.indexOf(pick(s.pendingChoice.options))});break;
    case 'skill-choice':{
     const names=[...s.skillChoiceSuggestions];
     for(const [base,subject] of [['Science','physics'],['Language','galanglic'],['Profession','construction']])if(s.skillChoiceBases?.includes(base))names.push(base+' ('+(s.pendingChoice?.selected?.includes(base+' ('+subject+')')||s.pendingChoice?.scope==='untrained-electronics-or-science'?subject+' alternate '+n:subject)+')');
     if(!names.length)return result('source-stop','No suggested mandatory skill; open speciality needs source review');
     const name=pick(names);act('choose-skill',{name});break;
    }
    case 'training':if(!s.trainingOptions.length)throw Error('No mandatory training options');act('training',{table:pick(s.trainingOptions).id});break;
    case 'survival':act('survival');break;
    case 'advancement':act('advancement');break;
    case 'preterm-commission':act('preterm-commission',{attempt:n%2===0});break;
    case 'ageing':act('ageing');break;
    case 'injury-loss':act('injury-loss',{index:pick(s.injuryOptions.map((_,i)=>i))});break;
    case 'injury-treatment':act('injury-treatment',{restore:{},inService:false});break;
    case 'benefit-wager':act('resolve-benefit-wager',{stake:0});break;
    case 'relationship-event':{const e=s.pendingChoice,person=c.relationships.find(p=>(e.from??e.types).includes(p.role));act('resolve-relationship-event',{confirmed:true,...(person?{relationshipId:person.id}:{}),...(e.to?{role:pick(e.to)}:{})});break;}
    case 'term-end':{
     const exit=s.exitOptions,wantsLeave=record.forcedExit||record.terms>=1+n%3;
     if(wantsLeave&&exit.canLeave)act('leave-career');else if(wantsLeave&&exit.canRetire)act('leave-career',{retire:true});else if(exit.canContinue)act('continue-career');else if(exit.canLeave)act('leave-career');else return result('source-stop','No permitted term-end action');break;
    }
    case 'benefits':act('benefit',{cash:n%2===0&&s.cashRollsUsed<s.cashLimit&&!(species==='aslan'&&c.gender==='male')});break;
    default:return result('unsupported-stage',s.stage);
   }
  }
  return result('error','180-action guard exceeded');
 }catch(e){return result('error',e.message);}
}
for(const career of catalog.careers.filter(c=>(!arg('career','')||c.id===arg('career',''))&&(arg('species','')!=='aezorgh'||['core','vargr','companion'].includes(c.group))))for(const assignment of career.assignments){
 const species=arg('species','')||(['aslan','vargr'].includes(career.group)?career.group:'human');
 const row={career:career.id,assignment:assignment.id,species,attempted:0,completed:0,outcomes:{},runs:[]};
 for(let n=0;n<(species!=='human'&&career.id.endsWith('.psion')?Math.min(max,10):max)&&row.completed<goal;n++){
  const out=run(career,assignment,species,n);row.attempted++;row.completed+=out.outcome==='completed'?1:0;row.outcomes[out.outcome]=(row.outcomes[out.outcome]??0)+1;row.runs.push(out);
  // Static source permission blocks cannot be removed by rerolling.
  
 }
 rows.push(row);console.log(career.id,assignment.id,`${row.completed}/${row.attempted}`,JSON.stringify({outcomes:row.outcomes,completedSeeds:row.runs.filter(x=>x.outcome==='completed').map(x=>x.seed),issues:row.runs.filter(x=>['error','unsupported-stage'].includes(x.outcome))}));
}
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),goal,maxAttemptsPerAssignment:max,method:'Release api only; natural dice; 1-3 target terms, qualification failures retry with new seed; no GM overrides or source adjudications; no session saves.',rows};
const output=arg('output','');if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY',JSON.stringify({assignments:rows.length,attempted:rows.reduce((n,r)=>n+r.attempted,0),completed:rows.reduce((n,r)=>n+r.completed,0),shortfalls:rows.filter(r=>r.completed<goal).map(r=>[r.career,r.assignment,r.completed]),errors:rows.flatMap(r=>r.runs.filter(x=>x.outcome==='error'||x.outcome==='unsupported-stage'))}));






