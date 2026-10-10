import {credit} from './amounts.mjs';

// A snapshot and an exclusion set, never another transaction ledger. Entry IDs
// survive array reordering and Undo followed by a new transaction.
export function createDashboardBaseline(state,origin='current'){
 return {version:1,origin,bank:String(credit(state.bank)),dateLabel:String(state.dateLabel),hours:state.hours,excludedLedgerIds:state.ledger.map(entry=>entry.id)};
}
export function validateDashboardBaseline(state){
 const b=state.dashboardBaseline;if(b===undefined)return;
 if(!b||typeof b!=='object'||Array.isArray(b)||b.version!==1||!['opening','current'].includes(b.origin)||typeof b.bank!=='string'||typeof b.dateLabel!=='string'||!Number.isSafeInteger(b.hours)||b.hours<0||!Array.isArray(b.excludedLedgerIds))throw Error('Invalid dashboard starting point.');
 credit(b.bank);
 const ids=new Set();for(const id of b.excludedLedgerIds){if(typeof id!=='string'||!/^[A-Za-z0-9_,.:-]{1,100}$/.test(id)||ids.has(id))throw Error('Invalid dashboard starting ledger.');ids.add(id);}
 // IDs, hours and balance describe the original boundary. Older Undo may
 // remove those entries, move the clock backwards, or leave a negative bank.
}
export function sameDashboardBaseline(a,b){return JSON.stringify(a)===JSON.stringify(b);}
