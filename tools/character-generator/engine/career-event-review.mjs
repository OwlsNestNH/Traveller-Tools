// Presentation-only boundary detection; never rerolls or changes saved commands.
const roots=new Set(['career-event','career-mishap','survival','survival-check']);
const followups=new Set(['roll-borrowed-event','choose-effect','choose-skill','resolve-relationship-event','resolve-relationship-event-step','resolve-book','agent-person-injury-roll','agent-person-injury-loss','agent-person-injury-continue']);
const passive=new Set(['notes','gm-mode','name-career-event-relationships','acknowledge-career-event-result']);
export function pendingCareerEventReview(state,log,events){
 if(!['advancement','term-end','cross-career-training'].includes(state.stage)||state.active===null||state.pending||state.pendingChoice)return null;
 const branches=[[]];for(let i=0;i<events.length;i++){const c=events[i].command;branches.push(c.type==='restore'?[...branches[c.payload.revision]]:c.type==='gm-replay'?[...branches[c.payload.revision-1],i]:[...branches.at(-1),i]);}
 let end=null,start=null,hasEvent=false;
 for(const i of [...branches.at(-1)].reverse()){
  const event=log[i];if(passive.has(event.type))continue;
  let original=i;while(events[original]?.command.type==='gm-replay')original=events[original].command.payload.revision-1;
  const type=events[original]?.command.type;
  if(end===null){if(!roots.has(type)&&!followups.has(type))return null;end=i;if(state.acknowledgedCareerEventResult===event.id)return null;}
  if(roots.has(type)){hasEvent=true;start=i;break;}
  if(type==='roll-borrowed-event')hasEvent=true;
  if(!followups.has(type))break;
  start=i;
 }
 if(end===null||start===null||!hasEvent)return null;
 const active=branches.at(-1).filter(i=>i>=start&&i<=end);
 return {id:log[end].id,number:log[end].number,startNumber:log[start].number,actionNumbers:active.map(i=>i+1)};
}
