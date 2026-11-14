// Read-only evidence for already accepted combined pre-career War/SOC rolls.
// Never infer a modifier from today's edited SOC or consume replacement dice.
export const CORE_ACADEMIES=['core.academy-army','core.academy-marine','core.academy-navy'];
const valid=r=>r?.values?.length===2&&r.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&r.values.reduce((a,b)=>a+b,0)===r.total;
export function legacyEducationWarDraftEvidence({state,log,snapshots,events},characteristicDM){
 const index=state.education,record=state.character.educations?.[index],choice=state.pendingChoice;
 if(state.stage!=='effect-choice'||!CORE_ACADEMIES.includes(record?.id)||record.completed||record.event!==11||record.graduationAllowed!==false||state.effectNext!=='education-graduation'||choice?.kind!=='choice'||choice.source?.id!=='core'||choice.source.page!==17||choice.options?.length!==2||choice.options[0].label!=='Flee'||choice.options[1].label!=='Draft'||state.educationEventContext)return null;
 const branches=[[]];for(let i=0;i<events.length;i++){const c=events[i].command;branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);}
 for(const i of [...branches.at(-1)].reverse()){
  let original=i;while(events[original]?.command.type==='gm-replay')original=events[original].command.payload.revision-1;
  const before=snapshots[original],after=snapshots[i+1];
  if(events[original]?.command.type!=='education-event'||before?.stage!=='education-event'||before.education!==index||before.character.educations?.[index]?.id!==record.id||after.character.educations?.[index]?.event!==11)continue;
  const rolls=log[i]?.rolls??[],event=rolls.find(r=>r.label==='Pre-career event'),check=rolls.find(r=>r.label==='SOC check');
  if(rolls.length!==2||!valid(event)||event.total!==11||!valid(check)||!Number.isFinite(before.character.stats.SOC))return null;
  const modifier=characteristicDM(before.character.stats.SOC),total=check.total+modifier;if(total>=9||after.character.educations[index].graduationAllowed!==false)return null;
  return {kind:'war-draft',mode:'departure-choice',educationId:record.id,educationIndex:index,row:11,name:'War and the draft',eventDice:[...event.values],eventTotal:11,nextTerm:record.term+1,check:{values:[...check.values],natural:check.total,modifier,total,target:9,success:false},separateDraftRoll:false,source:{id:'core',page:17}};
 }
 return null;
}
