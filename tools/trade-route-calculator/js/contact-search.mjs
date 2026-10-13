// Home Rule / campaign interpretation. Core's "same month" wording does not
// specify this grouped 28-day clock. Snapshots are the durable attempt ledger.
export const CONTACT_SEARCH_PERIOD_HOURS=28*24;
export const contactSearchRule='Home Rule / campaign interpretation: each planet has one 28-day (672-hour) period starting with its first committed buyer or supplier search. Each earlier committed attempt in that period gives DM −1, across all counterparties and search methods. All penalties clear together at the reset time; the next committed search starts a new period. Previews and cancelled searches do not count. Core Rulebook Update 2022, pp. 241–243, says “same month”; the grouped 28-day period is this campaign’s ruling.';
const rule='Home Rule / campaign interpretation',version=1;
const validHours=n=>Number.isSafeInteger(n)&&n>=0;

// Prepare buyer/supplier search arithmetic from explicit, already-parsed inputs.
// Integers: skill, rolled (2..12), duration (1..6), characteristic, counterparty.
// Also supply starport, its DM table, previous-attempt count, durationUnit and
// boolean successOverride. Counterparty is validated but is not a search DM.
// Returns {port,total,success,hours}; difficulty is 8, missing/falsy port DM is 0,
// and only durationUnit === 'days' multiplies by 24. No new rounding/ranges.
// Numeric errors remain 'Invalid search input', before the starport lookup.
// Eligibility/cooldowns, skill selection, dice, offers, IDs, period/snapshot
// audits, validation, modal ownership, persistence and Undo stay with callers.
// See ARCHITECTURE.md and verification/contact-search-outcome.test.mjs.
export function prepareContactSearchOutcome({skill,rolled,duration,characteristic,counterparty,starport,starportDM,previous,durationUnit,successOverride}){
 if(![skill,rolled,duration,characteristic,counterparty].every(Number.isInteger)||rolled<2||rolled>12||duration<1||duration>6)throw Error('Invalid search input');
 const port=starportDM[starport]||0,total=rolled+skill+characteristic+port-previous,success=total>=8||successOverride,hours=duration*(durationUnit==='days'?24:1);
 return {port,total,success,hours};
}

function appendPeriod(period,snapshot){
 // Saved array order is commit order, including when the clock was corrected
 // backward. A backward correction cannot discard the latest committed group.
 if(!period||snapshot.startedHours>=period.resetsHours){
  const resetsHours=snapshot.startedHours+CONTACT_SEARCH_PERIOD_HOURS;
  if(!validHours(resetsHours))throw Error('Contact-search reset time is outside the supported campaign clock.');
  period={anchorSearchId:snapshot.id,startedHours:snapshot.startedHours,resetsHours,attempts:0};
 }
 return {...period,attempts:period.attempts+1};
}
export function contactSearchStatus(state,worldId=state.actual,hours=state.hours){
 if(!validHours(hours))throw Error('Invalid contact-search time.');
 let period=null;
 for(const snapshot of state.snapshots)if(snapshot.worldId===worldId)period=appendPeriod(period,snapshot);
 const active=!!period&&hours<period.resetsHours;
 return {worldId,active,previous:active?period.attempts:0,periodHours:CONTACT_SEARCH_PERIOD_HOURS,period};
}
export function contactSearchPeriod(state,snapshotId,worldId=state.actual){
 const status=contactSearchStatus(state,worldId),period=status.active?status.period:{anchorSearchId:snapshotId,startedHours:state.hours,resetsHours:state.hours+CONTACT_SEARCH_PERIOD_HOURS};
 if(!validHours(period.resetsHours))throw Error('Contact-search reset time is outside the supported campaign clock.');
 return {version,rule,worldId,periodHours:CONTACT_SEARCH_PERIOD_HOURS,anchorSearchId:period.anchorSearchId,startedHours:period.startedHours,resetsHours:period.resetsHours,previous:status.previous};
}
function samePeriod(actual,expected){return actual&&Object.keys(expected).every(key=>actual[key]===expected[key]);}
export function validateContactSearchHistory(state){
 // Legacy snapshots are replayed deterministically, without adding fields or
 // recalculating saved totals. Keeping their bytes and Undo patches untouched
 // makes load, import and undo agree with a freshly derived preview.
 const periods=new Map();
 for(const snapshot of state.snapshots){
  const before=periods.get(snapshot.worldId),current=appendPeriod(before,snapshot),saved=snapshot.search?.contactPeriod;
  if(saved!==undefined){
   const previous=current.attempts-1;
   const expected={version,rule,worldId:snapshot.worldId,periodHours:CONTACT_SEARCH_PERIOD_HOURS,anchorSearchId:current.anchorSearchId,startedHours:current.startedHours,resetsHours:current.resetsHours,previous};
   if(!samePeriod(saved,expected)||snapshot.search.previous!==previous)throw Error('Invalid contact-search period audit.');
  }
  periods.set(snapshot.worldId,current);
 }
}
export function commitContactSearch(state,snapshot,{revision=state.revision}={}){
 if(revision!==state.revision||snapshot.worldId!==state.actual||snapshot.startedHours!==state.hours||state.snapshots.some(s=>s.id===snapshot.id))throw Error('Contact-search preview is stale. Reopen it before committing.');
 if(!state.actual||!state.worlds[state.actual]||state.worlds[state.actual].emptySpace)throw Error('Contact searches require the ship’s actual planet.');
 if(!['buyer','supplier'].includes(snapshot.kind)||typeof snapshot.partyName!=='string'||!snapshot.partyName.trim()||snapshot.party!==state.actual+'|'+snapshot.partyName.trim().toLowerCase())throw Error('Invalid contact-search counterparty.');
 if((state.cooldowns[snapshot.party]||0)>state.hours)throw Error('This counterparty is still in rejection cooldown.');
 const search=snapshot.search,period=contactSearchPeriod(state,snapshot.id);
 if(!search||!samePeriod(search.contactPeriod,period)||search.previous!==period.previous)throw Error('Contact-search penalty changed. Reopen the search preview.');
 if(!['normal','blackMarket','online'].includes(search.method)||!Number.isInteger(search.durationDie)||search.durationDie<1||search.durationDie>6||search.hours!==search.durationDie*(search.method==='online'?1:24)||!validHours(snapshot.hours)||snapshot.hours!==state.hours+search.hours)throw Error('Invalid contact-search duration.');
 if(![search.effectiveTotal,search.skill,search.characteristic,search.port,search.total].every(Number.isInteger)||search.effectiveTotal<2||search.effectiveTotal>12||search.total!==search.effectiveTotal+search.skill+search.characteristic+search.port-period.previous||snapshot.success!==(search.total>=8||search.successOverride===true))throw Error('Invalid contact-search result.');
 // The caller wraps this helper in transition(), so time, snapshot and audit
 // are one undoable action. Nothing is written during preview construction.
 const saved=structuredClone(snapshot);
 state.hours=saved.hours;state.snapshots.push(saved);
 state.events.push({id:crypto.randomUUID(),label:'Contact search audit',hours:state.hours,world:state.actual,snapshotId:saved.id,kind:saved.kind,partyName:saved.partyName,contactSearch:structuredClone(saved.search),dateLabel:state.dateLabel});
 return saved;
}
