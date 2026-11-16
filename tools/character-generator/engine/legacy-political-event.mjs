import {characterChanges} from './audit.mjs';
import {CORE_ACADEMIES} from './education-war-draft-projection.mjs';
const valid=r=>r?.values?.length===2&&r.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&r.values.reduce((a,b)=>a+b,0)===r.total;
// Reconstruct only accepted evidence; never roll or infer awards from a table.
export function legacyPoliticalEvidence({state,log,snapshots,events},characteristicDM){
 const index=state.education,record=state.character.educations?.[index];
 if(state.stage!=='education-graduation'||!CORE_ACADEMIES.includes(record?.id)||record.completed||record.event!==8||record.politicalEventReviewed||state.educationEventResult)return null;
 const branches=[[]];for(let i=0;i<events.length;i++){const c=events[i].command;branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);}
 for(const i of [...branches.at(-1)].reverse()){
  let original=i;while(events[original]?.command.type==='gm-replay')original=events[original].command.payload.revision-1;
  const before=snapshots[original],after=snapshots[i+1];
  if(events[original]?.command.type!=='education-event'||before?.stage!=='education-event'||before.education!==index||before.character.educations?.[index]?.id!==record.id||after.stage!=='education-graduation'||after.character.educations[index].event!==8)continue;
  const rolls=log[i]?.rolls??[],event=rolls.find(r=>r.label==='Pre-career event'),roll=rolls.find(r=>r.label==='SOC check');
  if(rolls.length!==2||!valid(event)||event.total!==8||!valid(roll)||!Number.isFinite(before.character.stats.SOC))return null;
  const modifier=characteristicDM(before.character.stats.SOC),total=roll.total+modifier,changes=characterChanges(before.character,after.character);
  const ids=changes.filter(c=>c.path.startsWith('relationships.')&&!c.before&&c.after?.id).map(c=>c.after.id);
  return {kind:'checkpoint',mode:'result',legacy:true,status:'resolved',pendingId:log[i].id,id:log[i].id,educationId:record.id,educationIndex:index,row:8,eventName:'Political movement',eventDice:event.values,eventTotal:8,childRolls:[{...roll,check:{stat:'SOC',modifier,total,target:8,success:total>=8}}],appliedChanges:[{changes}],relationships:ids.map(id=>state.character.relationships.find(r=>r.id===id)).filter(Boolean),source:{id:'core',page:17}};
 }
 return null;
}
