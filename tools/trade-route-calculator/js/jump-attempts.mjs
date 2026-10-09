// Jump rolls and the one-mulligan allowance survive campaign Undo. They are
// ordinary exported campaign data, not a security or backup-tampering boundary.
const id=value=>typeof value==='string'&&value.length>0;
export function validJumpRoll(roll){return !!roll&&Array.isArray(roll.dice)&&roll.dice.length===6&&roll.dice.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&roll.total===roll.dice.reduce((a,b)=>a+b,0);}
export function validateJumpAttempts(state){
 if(state.jumpAttempts===undefined){if(state.events?.some(e=>e.jumpAttemptId!==undefined))throw Error('Missing jump attempt history');return;}
 if(!Array.isArray(state.jumpAttempts))throw Error('Invalid jump attempts');
 const ids=new Set(),keys=new Set();
 for(const a of state.jumpAttempts){
  const key=JSON.stringify([a?.departure,a?.from]);
  if(!a||!id(a.id)||ids.has(a.id)||!id(a.departure)||!id(a.from)||keys.has(key)||typeof a.mulliganUsed!=='boolean'||typeof a.closed!=='boolean'||!Array.isArray(a.rolls)||a.rolls.length<1||a.rolls.length>2||!a.rolls.every(validJumpRoll)||a.rolls.length===2&&!a.mulliganUsed)throw Error('Invalid jump attempt record');
  ids.add(a.id);keys.add(key);
 }
 for(const event of state.events||[]){
  if(event.jumpAttemptId===undefined)continue;
  const attempt=state.jumpAttempts.find(a=>a.id===event.jumpAttemptId);
  if(!attempt||typeof event.mulliganUsed!=='boolean')throw Error('Invalid jump attempt audit reference');
  if(event.label==='Jump roll prepared'&&(!Number.isSafeInteger(event.preparedRevision)||event.preparedRevision<1||event.rollIndex!==(event.mulliganUsed?1:0)||!attempt.rolls[event.rollIndex]))throw Error('Invalid jump preparation audit');
  if(event.label==='Jump audit'){const roll=attempt.rolls[event.mulliganUsed?1:0];if(!roll||!validJumpRoll(event.dice)||JSON.stringify(event.dice.dice)!==JSON.stringify(roll.dice)||event.generatedHours!==148+roll.total)throw Error('Jump audit does not match its saved roll');}
 }
}
export function lastJump(state){return state.ledger.findLast(e=>e.type==='Jump')||null;}
export function departureKey(state){return lastJump(state)?.eventId||'campaign-start';}
export function currentJumpAttempt(state){return state.jumpAttempts?.find(a=>a.departure===departureKey(state)&&a.from===state.actual)||null;}
export function jumpAttemptForEvent(state,event){return state.jumpAttempts?.find(a=>a.id===event?.jumpAttemptId)||null;}
// Existing campaigns gain an allowance only when their saved jump audit has
// enough information. No older rolls or state are invented during migration.
export function legacyJumpAttempt(state,jump){
 const event=state.events.find(e=>e.id===jump?.eventId);
 if(!event||event.label!=='Jump audit'||!validJumpRoll(event.dice))return null;
 const index=state.ledger.findIndex(e=>e.id===jump.id),previous=state.ledger.slice(0,index).findLast(e=>e.type==='Jump');
 const actions=state.events.slice(state.events.indexOf(event)+1).filter(e=>Number.isSafeInteger(e.revision));
 const summary=actions[0];
 const closed=actions.length!==1||!summary?.label.startsWith('Jump: ')||summary.hours!==event.hours||summary.world!==event.to;
 return {id:'legacy:'+event.id,departure:previous?.eventId||'campaign-start',from:event.from,rolls:[structuredClone(event.dice)],mulliganUsed:false,closed};
}
export function savedJumpAttempt(state,jump){
 const event=state.events.find(e=>e.id===jump?.eventId);
 return jumpAttemptForEvent(state,event)||state.jumpAttempts?.find(a=>a.id==='legacy:'+event?.id)||legacyJumpAttempt(state,jump);
}

// A saved roll advances optimistic-lock revision without being an undoable
// campaign action. Only these retained, contiguous preparation audits explain
// a legacy mail proof's gap; an import/replacement revision never does.
export function jumpPreparationBridge(state,previous,next){
 const start=state.events.indexOf(previous),end=state.events.indexOf(next);
 if(start<0||end<=start||next.revision<=previous.revision+1)return false;
 const preparations=state.events.slice(start+1,end).filter(e=>e.label==='Jump roll prepared');
 return preparations.length===next.revision-previous.revision-1&&preparations.every((event,i)=>event.preparedRevision===previous.revision+i+1&&state.jumpAttempts?.some(a=>a.id===event.jumpAttemptId&&a.rolls[event.rollIndex]));
}
