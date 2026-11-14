import {imperialOutcome,IMPERIAL_OUTCOME_LINES} from './imperial-career-tags.mjs';
import {outcomeTagline} from './outcome-taglines.mjs';
import {VARGR_CAREER_DEFINITIONS} from './vargr-career-definitions.mjs';
// Cosmetic selection hashes recorded action IDs, never game RNG.
export function vargrResultCareer(event,state){
 if(state.character?.species!=='vargr'||state.character.culture!=='native')return null;
 const records=state.character.careers??[],indices=[...new Set((event?.changes??[]).flatMap(c=>{const m=c.path.match(/^careers\.(\d+)\.benefitRolls$/);return m?[Number(m[1])]:[];}))];
 const id=event?.type==='career'?state.character.careerTransitions?.at(-1)?.toCareerId:records[state.active]?.id??(event?.type==='benefit'?records.at(-1)?.id:indices.length===1?records[indices[0]]?.id:null);
 return Object.hasOwn(VARGR_CAREER_DEFINITIONS,id)?id:null;
}
export function vargrResultTagline(event,result,state){const id=vargrResultCareer(event,state),kind=imperialOutcome(event,result);return result?.status!=='error'&&id&&kind&&event?.id?outcomeTagline(kind,id+'|'+event.id,IMPERIAL_OUTCOME_LINES):null;}

export function vargrResultCrowType(event,state){const id=vargrResultCareer(event,state);if(!id)return null;const records=state.character.careers??[],active=records[state.active],record=active?.id===id?active:event?.type==='benefit'&&records.at(-1)?.id===id?records.at(-1):null;return id==='vargr.spacer'&&record?.assignment==='corsair'?'corsair':VARGR_CAREER_DEFINITIONS[id].crow;}
