import * as R from './rules.mjs?v=search-result-20261013-83';
import {contactSearchPeriod} from './contact-search.mjs?v=search-result-20261013-83';

export function tradeCodeLabel(code){const names={Ag:'Agricultural',As:'Asteroid',Ba:'Barren',De:'Desert',Fl:'Fluid oceans',Ga:'Garden',Hi:'High population',Ht:'High technology',Ic:'Ice-capped',In:'Industrial',Lo:'Low population',Lt:'Low technology',Na:'Non-agricultural',Ni:'Non-industrial',Po:'Poor',Ri:'Rich',Va:'Vacuum',Wa:'Water world',Amber:'Amber travel zone',Red:'Red travel zone',Safe:'Safe travel zone'};return (names[code]||code)+' ('+code+')';}

export function marketAvailabilityRecord(c,options,offers,core){
 const defaults=core.commodities.filter(g=>!g.refereeDefined&&(g.common||((options.illegal?g.universallyIllegal:!g.universallyIllegal)&&g.availabilityAny.some(code=>c.codes.includes(code))))).map(g=>({id:g.id,name:g.name,reason:g.common?'Common goods: available on all worlds':g.availabilityAny.filter(code=>c.codes.includes(code)).map(tradeCodeLabel).join(', ')}));
 const draws=offers.find(o=>Array.isArray(o.audit?.randomDraws))?.audit.randomDraws;
 return {defaults,population:c.uwp.population,uwp:c.uwp.raw,codes:[...c.codes],draws:draws??null};
}

// Assemble an already-eligible search outcome into a proposed snapshot.
// All time/identity/options/search fields are explicit; no live campaign writes.
// Keep market dice -> offer UUIDs -> snapshot UUID -> period -> availability
// ordering, including on errors. Caller owns entry rolls, eligibility, outcome,
// stale checks, accepted snapshot freezing, commitContactSearch/save and Undo.
// Rules/UUID bindings permit deterministic headless use without changing draws.
export function prepareContactSearchResult({kind,party,partyName,worldId,world,startedHours,dateLabel,snapshots,options,core,success,search},{rules=R,uid=()=>crypto.randomUUID()}={}){
 const good=id=>core.commodities.find(g=>g.id===id),illegal=search.method==='blackMarket';
 const offers=success&&kind==='supplier'?rules.market(world,options,core).map(o=>({...o,id:uid(),remaining:o.quantity,expired:false,illegal:!!good(o.commodity).universallyIllegal,description:good(o.commodity).name,original:{quantity:o.quantity,unitPrice:o.unitPrice}})):[];
 const id=uid(),contactPeriod=contactSearchPeriod({actual:worldId,hours:startedHours,snapshots},id);
 return {id,kind,party,partyName,worldId,world,startedHours,hours:startedHours+search.hours,criminal:illegal,options,offers,availability:success&&kind==='supplier'?marketAvailabilityRecord(world,options,offers,core):null,success,rulesVersion:rules.VERSION,interpretationVersion:2,search:{method:search.method,contactPeriod,dateLabel,generatedDice:search.generatedDice,effectiveTotal:search.effectiveTotal,skill:search.skill,characteristic:search.characteristic,port:search.port,previous:search.previous,total:search.total,difficulty:8,successOverride:search.successOverride,durationDie:search.durationDie,hours:search.hours,localSkillDice:search.useLocal?search.localSkillDice:null,fixerWarning:search.useLocal&&illegal&&search.localSkillDice.total===2}};
}
