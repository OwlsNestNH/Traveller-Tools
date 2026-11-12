import {educationResultDie} from './education-result-view.mjs';
// Presentation templates: existing engine data remains the only rules authority.
import {crowAssistanceView} from './crow-assistance.mjs';
import {outcomeTagline} from './outcome-taglines.mjs';
export const ARMY_TEMPLATE=Object.freeze({id:'core.army',name:'Army',source:'Core Rulebook Update 2022 · pp. 24–25',specialties:Object.freeze({support:'Keep the unit supplied, repaired and functioning.',infantry:'Serve on foot at the sharp end of a campaign.',cavalry:'Operate the vehicles that carry the fight.'}),exceptions:Object.freeze({})});
export const CAREER_TEMPLATES=Object.freeze({'core.army':ARMY_TEMPLATE});
const phases=['Application','Training','Survival','Events','Progression','Term review','Mustering out'];
export function careerPhase(stage){return stage==='career'||stage==='failed-entry'?0:['training','effect-choice','skill-choice','preterm-commission'].includes(stage)?1:stage==='survival'?2:['career-event','career-mishap','book-step','injury-loss','injury-treatment','relationship-event','relationship-loss'].includes(stage)?3:stage==='advancement'?4:['term-end','ageing','assignment-entry'].includes(stage)?5:['benefits','benefit-wager','equipment-finalization'].includes(stage)?6:null;}
export function careerTemplateModel(state,catalog,selectedCareer=''){
 // This pilot is deliberately limited to ordinary human Army careers.
 if(state.character?.species!=='human')return null;
 const record=state.character.careers?.[state.active];
 const id=state.stage==='career'?selectedCareer:state.stage==='failed-entry'?state.character.careerTransitions?.at(-1)?.toCareerId:record?.id;
 const definition=CAREER_TEMPLATES[id];if(!definition)return null;const template={...definition,rankRewards:catalog.careerPresentation?.[id]?.ranks};
 const career=(state.careerChoices??catalog.careers).find(c=>c.id===id);if(!career)return null;
 const rank=record&&template.rankRewards?.[record.officer?'officer':'enlisted']?.[record.rank];
 return {template,career,record,phase:state.resolvingEquipmentTask||state.pending?.deferredContext==='finalization'?6:['effect-choice','skill-choice'].includes(state.stage)&&state.effectNext&&!['survival','new-career-training','training'].includes(state.effectNext)?(state.effectNext==='end-term'?4:['benefits','benefit-complete'].includes(state.effectNext)?6:3):careerPhase(state.stage),rank,specialties:career.assignments.map(a=>({...a,description:template.specialties[a.id]??''}))};
}
const lines={
 'army.success':['Competence. Try not to make it look accidental.','You met the standard. The standard is relieved.','Well done. Do not expect applause from payroll.','The Army has found a use for you. Disturbing.','A successful result. Someone will give you more work.','You passed. Your replacement can stop warming up.'],
 'army.exceptional':['Show-off. Now they will expect that every time.','Congratulations. You have volunteered for harder work.','The recruitment poster wants its ego back.','An excellent result. Try surviving your new reputation.','You made that look easy. Management noticed. Unfortunate.','Exceptional work. Your reward is responsibility.'],
 'army.failure':['The Army regrets discovering your limits so quickly.','That went poorly. Your paperwork remains outstanding.','A fine demonstration of what not to do.','Your ambition has outrun your competence again.','The result is recorded. Sadly, so is your name.','Try looking surprised. It may help the report.'],
 'army.survived':['Still alive. The Army will invoice you for the inconvenience.','You survived. Standards really are slipping.','Another term, and somehow they still have you.','Alive and available for more terrible decisions.','Your survival has disappointed the replacement office.','You lived. Try not to look so smug about it.'],
 'army.survival-failed':['Your survival plan appears to have omitted survival.','That was not the exit interview you wanted.','The Army has a mishap form with your name on it.','A career setback. An understatement worthy of command.','Your luck has requested reassignment.','The mission report will be kinder than Crow.'],
 'army.event':['A new story. Try making this one less embarrassing.','The universe has more paperwork for you.','Another chapter in your questionable judgment.','Your service record grows. So does the evidence.','Something happened. Command would prefer fewer details.','A memorable term. That is not necessarily praise.'],
 'army.training':['You learned something. Try remembering it under fire.','Another skill. Your excuses are running out.','Training completed. Competence remains your responsibility.','The instructors have done what they can.','Your résumé is now slightly less speculative.','A useful lesson. Please spare us the demonstration.'],
 'army.choice':['A decision. Command will treasure the novelty.','Your choice is recorded. Denial is now paperwork.','You picked something. A historic breakthrough.','One loose end tied. Several poor decisions remain.','The record reflects your judgment. Brace yourself.','A choice made. Crow reserves the right to comment.'],
 'army.benefit':['Payment for your service. Keep the receipt and your dignity.','The Army returns some of what it owes you. Some.','A parting gift. Try not to spend it on worse decisions.','Your service has acquired a price tag.','Mustering out: finally, a form with an upside.','Congratulations. Bureaucracy has produced something useful.']
};
// Registered with the same stable action-id hash as all existing cosmetic tags.
export function armyOutcome(event,result){
 if(!event||['restore','gm-replay'].includes(event.type))return null;
 if(event.type==='survival-check'||event.type==='survival')return result?.status==='success'?'army.survived':result?.status==='failure'?'army.survival-failed':null;
 if(result?.status==='failure')return 'army.failure';
 if(event.type==='benefit')return 'army.benefit';
 if(result?.status==='success'){
  // Exceptional is cosmetic, based on a validated check margin, never raw dice.
  const checks=(event.changes??[]).flatMap(c=>c.path.endsWith('.check')&&c.after?[c.after]:[]);
  const match=event.summary?.match(/^(?:Advancement|Commission): (\{[^{}]+\})/);if(match)try{checks.push(JSON.parse(match[1]));}catch{}
  return checks.some(c=>c.success===true&&Number.isFinite(c.total)&&Number.isFinite(c.target)&&c.total-c.target>=6)?'army.exceptional':'army.success';
 }
 if(event.type==='training')return 'army.training';
 if(['choose-effect','choose-skill'].includes(event.type))return 'army.choice';
 if(['career-event','career-mishap'].includes(event.type))return 'army.event';
 return null;
}
export function armyTagline(event,result){const key=armyOutcome(event,result);if(!key||!event.id)return null;return outcomeTagline(key,event.id,lines);}
export function armyResultTagline(event,result,state){
 if(state.character?.species!=='human')return null;
 const active=state.character.careers?.[state.active],latest=state.character.careers?.at(-1);
 const context=event?.type==='career'?state.character.careerTransitions?.at(-1)?.toCareerId:active?.id??(event?.type==='benefit'?latest?.id:null);
 return context==='core.army'?armyTagline(event,result):null;
}
export function armyRecordedDice(event,{esc}){
 const rolls=(event?.rolls??[]).filter(roll=>Array.isArray(roll.values)&&roll.values.length&&roll.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6));
 return rolls.map(roll=>'<div class="army-recorded-dice"><p>'+esc(roll.label??'Recorded dice')+'</p><div class="army-dice-faces" role="img" aria-label="'+esc('Recorded dice: '+roll.values.join(', '))+'">'+roll.values.map(educationResultDie).join('')+'</div><p>Recorded total: '+esc(roll.total)+'.</p></div>').join('');
}
export function mountCareerTemplate(document,model,{esc,event=null,showDice=false}){
 const result=document.querySelector('#last-action-result');if(result&&event&&(model||showDice))result.insertAdjacentHTML('beforeend',armyRecordedDice(event,{esc}));
 if(!model)return;
 const workspace=document.getElementById('workspace'),body=document.createElement('div');body.className='career-pilot-body';body.append(...workspace.childNodes);
 const card=document.createElement('section');card.className='career-pilot';card.dataset.careerTemplate=model.template.id;card.setAttribute('aria-label',model.career.name+' career');
 const header=document.createElement('div');header.className='career-pilot-header';
 header.innerHTML='<p class="eyebrow">IMPERIAL CAREER · COMPLETED TERMS '+(model.record?.terms??0)+'</p><h2>'+esc(model.career.name)+(model.record?' · '+esc(model.specialties.find(s=>s.id===model.record.assignment)?.name??model.record.assignment):'')+'</h2><p class="source">'+esc(model.template.source)+'</p><ol class="career-journey" aria-label="Career journey">'+phases.map((name,i)=>'<li'+(i===model.phase?' aria-current="step"':'')+'>'+esc(name)+'</li>').join('')+'</ol>';
 if(model.rank){const rank=document.createElement('p');rank.className='career-pilot-rank';rank.textContent=(model.record.officer?'Officer':'Enlisted')+' · Rank '+model.record.rank+(model.rank.title?' · '+model.rank.title:'');header.append(rank);const reward=document.createElement('p');reward.className='help';reward.textContent='Current rank reference: '+(model.rank.reward||'No additional rank reward.')+' The engine records any award and required specialisation separately.';header.append(reward);}
 const guidance=document.createElement('aside');guidance.className='career-pilot-guidance';guidance.setAttribute('aria-label','Crow guidance');const assistance=crowAssistanceView(document,{type:model.phase===1?'skills':model.phase===4?'referee':'generic'});guidance.append(assistance.row,assistance.help);const words=document.createElement('p');words.textContent=['Choose your specialty. Even the Army needs to know where to file you.','Choose the training offered here. Wishful thinking remains unaccredited.','Training is recorded. Now find out whether it kept you alive.','Resolve the event and every required choice. A loose end is still your problem.','Review advancement or an available commission. Ambition is not a modifier.','Review the recorded term before deciding to stay or leave. Nostalgia is not a plan.','Resolve the remaining benefits. Payroll will not chase you.'][model.phase]??'Follow the current step below. Even your detours need an ending.';guidance.append(words);
 if(model.phase===0){const specialties=document.createElement('ul');specialties.className='career-specialties';for(const specialty of model.specialties){const li=document.createElement('li');li.textContent=specialty.name+' — '+specialty.description;specialties.append(li);}guidance.append(specialties);}
 card.append(header,guidance,body);workspace.append(card);
}
