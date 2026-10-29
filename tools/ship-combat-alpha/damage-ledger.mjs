import {CRITICAL_LOCATIONS,criticalEscalation,sustainedThresholds} from './direct-fire-rules.mjs';
const integer=(n,label,min,max)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid '+label+'.');return n;};
// Separate automatic history/current severity from legacy referee notes. Repairs
// do not implicitly clear the ledger or replay earlier critical effects.
export function newDamageLedger(startingHull,currentHull){
 integer(startingHull,'starting hull',1,1000000);integer(currentHull,'current hull',0,startingHull);
 return {version:1,startingHull,damageTaken:startingHull-currentHull,severities:{},history:[]};
}
export function normalizeDamageLedger(value){
 if(value==null)return null;
 if(value.version!==1||!Array.isArray(value.history)||value.history.length>2048)throw Error('Invalid damage ledger.');
 const startingHull=integer(value.startingHull,'starting hull',1,1000000),damageTaken=integer(value.damageTaken,'cumulative hull damage',0,1000000000),severities={};
 const history=Array.from(value.history,h=>{
  if(!h||!CRITICAL_LOCATIONS.includes(h.location)||typeof h.eventId!=='string'||!/^[-a-z0-9/:]{1,120}$/.test(h.eventId))throw Error('Invalid critical history.');
  const previous=severities[h.location]??0,expected=criticalEscalation(previous,h.incoming);if(h.previous!==previous||h.severity!==expected.severity||h.extraDice!==expected.extraDice)throw Error('Critical history and severity disagree.');
  severities[h.location]=expected.severity;return {eventId:h.eventId,location:h.location,...expected};
 });
 if(new Set(history.map(h=>h.eventId)).size!==history.length||JSON.stringify(Object.entries(severities).sort())!==JSON.stringify(Object.entries(value.severities??{}).sort()))throw Error('Duplicate or inconsistent critical history.');
 return {version:1,startingHull,damageTaken,severities,history};
}
export function recordCritical(value,{eventId,location,incoming}){
 const ledger=normalizeDamageLedger(value);if(!ledger)throw Error('Initialize damage ledger first.');
 if(ledger.history.some(h=>h.eventId===eventId))throw Error('Critical already recorded.');
 if(!CRITICAL_LOCATIONS.includes(location))throw Error('Unknown critical location.');
 const event={eventId,location,...criticalEscalation(ledger.severities[location]??0,incoming)};
 ledger.severities[location]=event.severity;ledger.history.push(event);return {ledger:normalizeDamageLedger(ledger),event};
}
export function recordHullLoss(value,currentHull,damage){
 const ledger=normalizeDamageLedger(value);if(!ledger)throw Error('Initialize damage ledger first.');
 integer(currentHull,'current hull',0,ledger.startingHull);integer(damage,'hull damage',0,1000000);
 const lost=Math.min(currentHull,damage),thresholds=sustainedThresholds(ledger.startingHull,ledger.damageTaken,lost);
 ledger.damageTaken+=lost;return {ledger:normalizeDamageLedger(ledger),hull:currentHull-lost,lost,thresholds};
}
