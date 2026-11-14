import {currentActionNumbers} from './final-sheet-history.mjs';

// Notes update the record, not the current creation step. Retain its accepted
// result across those edits without reaching into an abandoned history branch.
// All other commands remain presentation boundaries, including restore/replay.
export function currentResultEvent(projection,session){
 const latest=projection?.log?.at(-1);
 if(latest?.type!=='notes')return latest;
 const current=currentActionNumbers(session);
 return [...projection.log].reverse().find(event=>current.has(event.number)&&event.type!=='notes')??latest;
}
