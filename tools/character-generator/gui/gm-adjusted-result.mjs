import {currentEvents} from './final-sheet-history.mjs';
// Presentation only. The immutable GM action and original roll remain in the log.
export function gmAdjustedResultEvent(event,projection,session){
 if(event?.type!=='gm-replay')return event;
 const command=session?.events?.[event.number-1]?.command,payload=command?.payload;
 if(command?.type!=='gm-replay'||!Number.isInteger(payload?.revision)||payload.revision<1||payload.revision>=event.number||!Number.isInteger(payload.rollIndex))return event;
 const original=projection?.log?.[payload.revision-1]?.rolls?.[payload.rollIndex],replacement=event.rolls?.[payload.rollIndex];
 if(!original||!replacement)return event;
 const underlying=currentEvents(projection,session).find(e=>e.number===event.number);
 if(!underlying?.summary||underlying.type==='gm-replay')return event;
 return {...underlying,gmCorrection:{action:payload.revision,rollIndex:payload.rollIndex,original:structuredClone(original),replacement:structuredClone(replacement),reason:payload.reason??''}};
}
