import {characterChanges} from './audit.mjs';
// Read-only evidence over the active history branch. Old commands keep their semantics.
export function finalBenefitResult({state,log,snapshots,events}){
 if(state.active!==null||!['career','retirement','assignment-entry','aslan-officer-entry'].includes(state.stage))return null;
 const branches=[[]];for(let i=0;i<events.length;i++){const c=events[i].command;branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);}
 const path=branches.at(-1);let end;
 for(const i of [...path].reverse()){
  if(['notes','gm-mode','acknowledge-final-benefit'].includes(events[i].command.type))continue;
  end=i;break;
 }
 if(end===undefined||state.acknowledgedFinalBenefit===events[end].id)return null;
 const command=events[end].command,priorIndex=command.type==='gm-replay'?command.payload.revision-1:end,before=snapshots[priorIndex],after=snapshots[end+1];
 const history=after.character.benefitRollHistory??[],previous=before.character.benefitRollHistory??[];
 if(!Number.isInteger(before.active)||after.active!==null||history.length!==previous.length+1)return null;
 const record=history.at(-1);if(!record.completed||record.careerIndex!==before.active)return null;
 const endPosition=path.indexOf(end);let start;
 for(let p=endPosition;p>=0;p--){const i=path[p],c=events[i].command,original=c.type==='gm-replay'?events[c.payload.revision-1].command:c;if(original.type==='benefit'){start=c.type==='gm-replay'?c.payload.revision-1:i;break;}}
 if(start===undefined)return null;
 const initial=snapshots[start];if(initial.active!==record.careerIndex)return null;
 const event={number:end+1,id:events[end].id,type:'benefit',summary:log[end].summary,rolls:[],changes:characterChanges(initial.character,after.character)};
 return {id:event.id,careerIndex:record.careerIndex,record,event};
}
