import {currentActionNumbers} from './final-sheet-history.mjs';
// Retain the active education result across note/tool edits, never recover an
// unrelated or superseded education event from an abandoned history branch.
export function currentEducationEvent(projection,session){
 const state=projection?.state,record=state?.character?.educations?.[state.education];
 if(state?.stage!=='education-graduation'||!record||record.completed)return null;
 const current=currentActionNumbers(session);
 for(const event of [...projection.log].reverse()){
  if(!current.has(event.number)||['notes','gm-mode','gm-psi-mode'].includes(event.type))continue;
  return event.eventResults?.some(r=>r.table==='core.pre-career-events'&&r.row===record.event)?event:null;
 }
 return null;
}
