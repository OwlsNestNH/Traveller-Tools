// Derived display metadata only; no saved rules, summaries, or dice are changed.
import {lifeEventIdentity} from '../gui/life-event-presentation.mjs';
function rolledEvents(rolls=[]){return rolls.map(roll=>lifeEventIdentity(roll.label?.replace(/ \(.*\)$/, ''),roll.total)).filter(Boolean);}
function goodFortuneChoice(state,identity){
 if(identity?.table!=='vargr.life-events'||identity.row!==10||state?.stage!=='effect-choice')return null;
 const choice=state.pendingChoice,options=choice?.options;
 if(choice?.source?.id!=='aliens'||choice.source.page!==206||options?.length!==2)return null;
 // Verify the actual pending mechanics rather than matching ambiguous labels.
 const labels=options.map(option=>{
  if(option.effects?.length!==1)return null;
  const e=option.effects[0];
  if(e.kind==='benefit-rolls'&&e.value===1&&!e.dice&&!e.mode)return 'Gain 1 Benefit roll in your current career';
  if(e.kind==='stat'&&e.name==='CHA'&&e.value===1)return 'CHA +1';
  return null;
 });
 return labels.every(Boolean)&&new Set(labels).size===2?{title:identity.title,description:'Choose 1 Benefit roll in your current career or CHA +1.',optionLabels:labels}:null;
}
// Run only after replay/audit validation. Snapshots are read, never annotated or changed.
export function decorateLifeEventPresentation({state,log,snapshots,events}){
 const contexts=[null];
 for(let i=0;i<log.length;i++){
  const command=events[i].command,entry=log[i];
  const base=command.type==='gm-replay'?command.payload.revision-1:i;
  const results=rolledEvents(entry.rolls);
  let context=command.type==='restore'?contexts[command.payload.revision]:contexts[base];
  const pendingBefore=goodFortuneChoice(snapshots[base],context);
  const actualCommand=command.type==='gm-replay'?events[command.payload.revision-1].command:command;
  let choice;
  if(actualCommand.type==='choose-effect'&&pendingBefore){
   const selected=pendingBefore.optionLabels[actualCommand.payload.index];
   if(selected)choice={title:pendingBefore.title,effect:selected==='CHA +1'?'Charisma (CHA) +1.':'Gained 1 Benefit roll in the current career.'};
   context=null;
  }
  if(results.length)context=results.at(-1);
  // Keep provenance only while the same mechanically verified choice is pending.
  if(!goodFortuneChoice(snapshots[i+1],context))context=null;
  contexts.push(context);
  if(results.length||choice)entry.lifeEventPresentation={results,...(choice?{choice}:{})};
 }
 const pending=goodFortuneChoice(state,contexts.at(-1));
 if(pending)state.lifeEventPresentation=pending;
}
