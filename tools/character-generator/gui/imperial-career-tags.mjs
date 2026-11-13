import {outcomeTagline} from './outcome-taglines.mjs';
import {recordedConsequenceCheck} from './check-outcome.mjs';
import {IMPERIAL_CAREER_DEFINITIONS} from './imperial-career-definitions.mjs';
export const IMPERIAL_OUTCOME_LINES=Object.freeze({
 success:['Competence. Try not to make it look accidental.','You met the standard. The standard is relieved.','Well done. Do not expect applause from payroll.','A useful result. Someone will give you more work.','You passed. Your excuses will need updating.','Success. Try remembering how you managed that.'],
 exceptional:['Show-off. Now they will expect that every time.','Congratulations. You have volunteered for harder work.','An excellent result. Try surviving your new reputation.','You made that look easy. Management noticed. Unfortunate.','Exceptional work. Your reward is responsibility.','Your résumé has briefly overtaken your excuses.'],
 failure:['That went poorly. Your paperwork remains outstanding.','A fine demonstration of what not to do.','Your ambition has outrun your competence again.','The result is recorded. Sadly, so is your name.','Try looking surprised. It may help the report.','Your excuses have arrived ahead of your results.'],
 survived:['Still alive. The universe will invoice you later.','You survived. Standards really are slipping.','Another term, and somehow they still have you.','Alive and available for more terrible decisions.','Your survival has disappointed the replacement office.','You lived. Try not to look so smug about it.'],
 'survival-failed':['Your survival plan appears to have omitted survival.','That was not the exit interview you wanted.','The mishap paperwork has your name on it.','A career setback. An impressive understatement.','Your luck has requested reassignment.','The incident report will be kinder than Crow.'],
 event:['A new story. Try making this one less embarrassing.','The universe has more paperwork for you.','Another chapter in your questionable judgment.','Your record grows. So does the evidence.','Something happened. Try reading the consequences.','A memorable term. That is not necessarily praise.'],
 consequence:['Your choices have found the consequences department.','One complication. Your optimism remains unhelpful.','The next part requires a decision, tragically from you.','The story continues. Your dignity may not.','A loose end has become your problem. Again.','Resolve the consequences. They have already located you.'],
 training:['You learned something. Try remembering it.','Another skill. Your excuses are running out.','Training completed. Competence remains your responsibility.','The instructors have done what they can.','Your résumé is now slightly less speculative.','A useful lesson. Please spare us the demonstration.'],
 choice:['A decision. A historic breakthrough.','Your choice is recorded. Denial is now paperwork.','You picked something. Crow has noted the occasion.','One loose end tied. Several poor decisions remain.','The record reflects your judgment. Brace yourself.','A choice made. Crow reserves the right to comment.'],
 benefit:['Payment for your time. Keep the receipt and your dignity.','A parting gift. Try not to spend it on worse decisions.','Your career has acquired a price tag.','Mustering out: finally, a form with an upside.','Congratulations. Bureaucracy has produced something useful.','An entitlement recorded. Reading the conditions remains your job.']
});
export function imperialOutcome(event,result){
 if(!event||result?.status==='error'||['restore','gm-replay'].includes(event.type))return null;
 if(['survival','survival-check'].includes(event.type))return result?.status==='success'?'survived':result?.status==='failure'?'survival-failed':null;
 if(result?.status==='failure')return 'failure';
 if(event.type==='benefit')return 'benefit';
 if(result?.status==='success'){
  const checks=(event.changes??[]).flatMap(c=>c.path.endsWith('.check')&&c.after?[c.after]:[]),nested=recordedConsequenceCheck(event);
  if(nested)checks.push(nested);
  const match=event.summary?.match(/^(?:Advancement|Commission): (\{[^{}]+\})/);if(match)try{checks.push(JSON.parse(match[1]));}catch{}
  return checks.some(c=>c.success===true&&Number.isFinite(c.total)&&Number.isFinite(c.target)&&c.total-c.target>=6)?'exceptional':'success';
 }
 if(event.type==='training')return 'training';
 if(['choose-effect','choose-skill','resolve-book'].includes(event.type))return 'choice';
 if(['career-mishap','roll-borrowed-event','injury-loss','injury-treatment'].includes(event.type))return 'consequence';
 if(event.type==='career-event')return 'event';
 return null;
}
export function imperialResultCareer(event,state){
 if(state.character?.species!=='human')return null;
 const records=state.character.careers??[];
 const indices=[...new Set((event?.changes??[]).flatMap(c=>{const m=c.path.match(/^careers\.(\d+)\.benefitRolls$/);return m?[Number(m[1])]:[];}))];
 const id=event?.type==='career'?state.character.careerTransitions?.at(-1)?.toCareerId:records[state.active]?.id??(event?.type==='benefit'?records.at(-1)?.id:indices.length===1?records[indices[0]]?.id:null);
 return Object.hasOwn(IMPERIAL_CAREER_DEFINITIONS,id)?id:null;
}
export function imperialResultTagline(event,result,state){
 const career=imperialResultCareer(event,state),kind=imperialOutcome(event,result);
 if(!career||!kind||!event.id)return null;
 return outcomeTagline('imperial.'+kind,career+'|'+event.id,Object.fromEntries(Object.entries(IMPERIAL_OUTCOME_LINES).map(([key,rows])=>['imperial.'+key,rows])));
}
