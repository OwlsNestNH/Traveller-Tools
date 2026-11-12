// Read-only evidence for revision .31 University event checkpoints. Roll faces
// come only from recorded roll objects; effects are never inferred as awards.
import {characterChanges} from './audit.mjs';
const names={2:'Psionic potential',3:'Education interrupted',4:'Social conflict',5:'Carousing',6:'New allies',7:'Life event',8:'Social connections',9:'Hobby skill',10:'Study challenge',11:'Political trouble',12:'Social standing'};
const commands=new Set(['education-event','choose-effect','education-check','roll-education-event-step','resolve-book','choose-skill','allocate-specializations','skill-award-source','retry-skill-choice','education-skill','resolve-life-event','injury-loss','injury-treatment']);
const contextId=s=>s.educationEventContext?.id??s.educationEventResult?.id?.replace(/-result$/,'');
export function educationEventEvidence(view,{state,log,snapshots,events,skillModifier}){
 if(!view)return null;
 const initial=view.eventRoll;if(!Array.isArray(initial?.kept)||initial.kept.length!==2||initial.kept.some(n=>!Number.isInteger(n)||n<1||n>6)||initial.kept.reduce((a,b)=>a+b,0)!==view.row)return null;
 const id=view.id.replace(/-result$/,''),branches=[[]];
 for(let i=0;i<events.length;i++){const c=events[i].command;branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);}
 const applied=[],childRolls=[];
 for(const i of branches.at(-1)){
  let original=i;while(events[original]?.command.type==='gm-replay')original=events[original].command.payload.revision-1;
  const command=events[original]?.command,before=snapshots[original],after=snapshots[i+1];
  if(!commands.has(command?.type)||contextId(before)!==id&&contextId(after)!==id)continue;
  const changes=characterChanges(before.character,after.character);if(changes.length)applied.push({actionId:log[i].id,command:command.type,changes});
  for(const roll of log[i].rolls??[])if(roll.label!=='Pre-career event'){
   const pending=before.pendingEducationEventRoll;let check=null;
   if(Number.isFinite(pending?.target)&&Number.isFinite(pending.modifier))check={...(pending.stat?{stat:pending.stat}:{}),modifier:pending.modifier,target:pending.target,...(pending.comparison?{comparison:pending.comparison,comparisonStat:pending.comparisonStat,comparisonScore:pending.comparisonScore}:{})};
   else if(command.type==='education-check'&&typeof skillModifier==='function')check={skill:command.payload.name,modifier:skillModifier(before,command.payload.name),target:before.pendingChoice.target};
   if(check){check.total=roll.total+check.modifier;check.success=check.total>=check.target;}
   childRolls.push({actionId:log[i].id,...structuredClone(roll),source:structuredClone(pending?.source??(command.type==='resolve-life-event'?{id:'core',page:228}:{id:'core',page:17})),...(check?{check}:{})});
  }
 }
 const {rolls:_internalRolls,...publicView}=view;
 return {...structuredClone(publicView),name:names[view.row],forcedCareer:structuredClone(state.forcedCareer??null),descriptionSource:'implemented-mechanics',eventDice:[...initial.kept],eventTotal:view.row,childRolls,appliedChanges:applied,pendingEffects:structuredClone(state.effectsQueue??[]),pendingChoice:structuredClone(state.pendingChoice??null),source:{id:'core',title:'Core Rulebook Update 2022',page:17}};
}
