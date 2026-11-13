import {outcomeTagline} from './outcome-taglines.mjs';
import {imperialOutcome} from './imperial-career-tags.mjs';
import {ASLAN_CAREER_DEFINITIONS} from './aslan-career-definitions.mjs';
// Cosmetic comments use recorded action IDs, never the game's random stream.
export const ASLAN_OUTCOME_LINES=Object.freeze({
 success:['Competence. The clan was beginning to lose hope.','You met the standard. Try not to look so astonished.','A useful result. Someone will find you more work.','Success. Your ancestors can stop pretending not to know you.','Well done. Your excuses are now unemployed.','You passed. Do not make it your entire personality.'],
 exceptional:['Show-off. Now the clan will expect that every time.','Excellent work. You have volunteered for harder work.','Your reputation has briefly overtaken your excuses.','The ancestors noticed. Try surviving the expectations.','Exceptional. Your next failure will have a larger audience.','You made that look easy. Management noticed. Unfortunate.'],
 failure:['The clan regrets discovering your limits so quickly.','That went poorly. Your name is still on the record.','Your ambition has outrun your competence again.','A fine demonstration of what not to do.','Your excuses arrived ahead of your results.','Tradition has survived worse. Your reputation may struggle.'],
 survived:['Still alive. The clan has more work for you.','You survived. Standards really are slipping.','Another term, and somehow they still have you.','Alive and available for more terrible decisions.','Your replacement will have to keep waiting.','You lived. Try not to look so smug about it.'],
 'survival-failed':['Your survival plan appears to have omitted survival.','That was not the ending you wanted for this term.','Your luck has abandoned the clan meeting.','The consequences are recorded. Read them before inventing excuses.','A result worth taking seriously. Try starting now.','Your reputation has developed an incident report.'],
 event:['Another chapter in your questionable judgement.','A new story. Try giving the clan one it can repeat in public.','The record grows. So does the evidence.','Something happened. Read the consequences, genius.','A memorable term. That is not necessarily praise.','Tradition has acquired another complication. You.'],
 consequence:['Your decisions have located the consequences department.','One complication. Your optimism remains useless.','The next part requires a decision, tragically from you.','The story continues. Your dignity may not.','A loose end has become your problem. Again.','Resolve the consequences. The clan is not your cleaning service.'],
 training:['You learned something. Try remembering it.','Another skill. Your excuses are running out.','Training completed. Competence remains your responsibility.','The clan’s instructors have done what they can.','Your record is now slightly less speculative.','A useful lesson. Please spare us the demonstration.'],
 choice:['A decision. The clan will treasure the novelty.','Your choice is recorded. Denial is now paperwork.','You picked something. A historic breakthrough.','One loose end tied. Several poor decisions remain.','The record reflects your judgement. Brace yourself.','A choice made. Crow reserves the right to comment.'],
 benefit:['An entitlement recorded. Read the conditions before claiming the glory.','A parting benefit. Try not to squander the clan’s confidence.','Your career has acquired a price tag.','Mustering out: finally, a form with an upside.','Congratulations. Bureaucracy has produced something useful.','The award is recorded. The fine print is still your problem.']
});
export function aslanResultCareer(event,state){
 if(state.character?.species!=='aslan'||state.character.culture!=='native')return null;
 const records=state.character.careers??[],indices=[...new Set((event?.changes??[]).flatMap(c=>{const m=c.path.match(/^careers\.(\d+)\.benefitRolls$/);return m?[Number(m[1])]:[];}))];
 const officer=['qualify-aslan-officer','cancel-aslan-officer','resolve-aslan-officer-rank'].includes(event?.type)?state.currentAslanOfficerOffer?.targetCareerId??state.character.aslanOfficerOffers?.at(-1)?.targetCareerId:null;
 const id=officer??(event?.type==='career'?state.character.careerTransitions?.at(-1)?.toCareerId:records[state.active]?.id??(event?.type==='benefit'?records.at(-1)?.id:indices.length===1?records[indices[0]]?.id:null));
 return Object.hasOwn(ASLAN_CAREER_DEFINITIONS,id)?id:null;
}
const choices=new Set(['fallback','begin-aslan-officer','cancel-aslan-officer','resolve-aslan-officer-rank','resolve-aslan-restoration','resolve-aslan-outlaw-restoration','request-aslan-historical-entry','resolve-aslan-historical-entry','activate-aslan-access','resolve-aslan-access-conflict','resolve-aslan-dishonoured','resolve-aslan-territory','record-aslan-outcast-opportunity','retain-aslan-secret','resolve-land-claim']);
export function aslanOutcome(event,result){if(result?.status==='error')return null;return imperialOutcome(event,result)??(choices.has(event?.type)?'choice':event?.type==='redeem-clan-shares'?'benefit':null);}
export function aslanResultTagline(event,result,state){
 const career=aslanResultCareer(event,state),kind=aslanOutcome(event,result);
 return career&&kind&&event.id?outcomeTagline(kind,career+'|'+event.id,ASLAN_OUTCOME_LINES):null;
}
