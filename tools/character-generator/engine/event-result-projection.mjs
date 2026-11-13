// Derived after replay validation. Never mutate snapshots, saved commands or summaries.
import {CORE_PACK} from './core-pack.mjs';
import {EXPANSION_PACK,EXPANSION_TABLES} from './expansion-pack.mjs';
import {PRECAREER_EVENTS} from './education-pack.mjs';
import {CORE_LIFE_TABLES} from './core-life-events.mjs';
import {CAREERS} from './catalog.mjs';
import {eventEffectSummary} from './event-effect-summary.mjs';
import {eventNarrative} from './event-narratives.mjs';
const packs={...CORE_PACK,...EXPANSION_PACK};
const shared={...CORE_LIFE_TABLES,...EXPANSION_TABLES};
const words=s=>String(s??'').replace(/[._-]+/g,' ');
const careerName=id=>CAREERS.find(c=>c.id===id)?.name??words(id);
function tableRoutes(effects,label){
 const found=[];
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(value.kind==='table-roll'&&value.table===label)found.push(value);
  Object.values(value).forEach(visit);
 }
 visit(effects);return found;
}
function tableResult(roll,before,after,parent){
 const label=roll.label?.replace(/ \(.*\)$/,'');
 let table,title,effects,protectedStay=false;
 if(label==='Rite of Passage'&&roll.values?.length===2&&roll.values[0]===roll.values[1]){
  table='aslan.rite-doubles';title='Rite of Passage event';effects=shared[table].results[roll.total];
 }else if(label==='Pre-career event'){
  table='core.pre-career-events';title='Pre-career event';effects=PRECAREER_EVENTS[roll.total];
 }else if(['Event table','Mishap table'].includes(label)){
  const career=before?.character?.careers?.[before.active];
  if(!career)return null;
  const mishap=label==='Mishap table';table=career.id+(mishap?'.mishaps':'.events');
  title=careerName(career.id)+(mishap?' mishap':' event');effects=packs[career.id]?.[mishap?'mishaps':'events']?.[roll.total];
 }else if(shared[label]){
  table=label;title=words(label);effects=shared[label].results[roll.total];
 }else if(['event','events','core.events','mishap','mishaps','core.mishap'].includes(label)){
  // Borrowed career routes record their own table provenance. Do not guess from
  // the current career when the actual table could belong to another career.
  const beforeCount=(before?.character?.crossCareerRoutes??[]).flatMap(r=>r.tables??[]).length;
  const allAfter=(after?.character?.crossCareerRoutes??[]).flatMap(r=>r.tables??[]);
  const fresh=allAfter.slice(beforeCount).filter(t=>t.row===roll.total);
  const parentCareer=parent?.table?.match(/^(.*)\.(events|mishaps)$/)?.[1];
  const candidates=tableRoutes(rowEffects(parent??{})??[],label).map(e=>({career:e.career??e.tableCareerId??parentCareer,keepCareer:e.keepCareer===true}));
  const unique=[...new Map(candidates.map(e=>[JSON.stringify(e),e])).values()];
  const route=unique.length===1?unique[0]:null;
  protectedStay=route?.keepCareer===true;
  if(!fresh.length&&route&&(route.career??route.tableCareerId??parentCareer))fresh.push({careerId:route.career??route.tableCareerId??parentCareer,table:['mishap','mishaps','core.mishap'].includes(label)?'mishap':'event'});
  if(fresh.length!==1)return {title:words(label)+' '+roll.total,roll:structuredClone(roll),description:null,summary:'See the recorded source resolution for this secondary career table.'};
  const t=fresh[0],mishap=t.table==='mishap';table=t.careerId+(mishap?'.mishaps':'.events');title=careerName(t.careerId)+(mishap?' mishap':' event');effects=packs[t.careerId]?.[mishap?'mishaps':'events']?.[roll.total];
 }else return null;
 const careerId=table.replace(/\.(events|mishaps)$/,'');
 const source=table==='core.pre-career-events'?{title:'Core Rulebook Update 2022',pages:[17]}:CORE_LIFE_TABLES[table]?{title:'Core Rulebook Update 2022',pages:[46]}:shared[table]?.source??packs[careerId]?.source;
 return {table,row:roll.total,title:title+' '+roll.total,roll:structuredClone(roll),description:eventNarrative(table,roll.total),source:source?structuredClone(source):null,summary:(effects?eventEffectSummary(effects):'The source outcome is not encoded; source resolution is required.')+(protectedStay?' For this event, automatic career ejection from the mishap is waived.':'')};
}
function rowEffects(result){
 if(result.table==='core.pre-career-events')return PRECAREER_EVENTS[result.row];
 if(shared[result.table])return shared[result.table].results[result.row];
 const match=result.table?.match(/^(.*)\.(events|mishaps)$/);return match?packs[match[1]]?.[match[2]]?.[result.row]:null;
}
function nextDirectRandom(effects=[]){
 for(const effect of effects){
  if(effect.kind==='random')return effect;
  if(['choice','check','conditional','assignment-effect','table-roll'].includes(effect.kind))return null;
 }
 return null;
}
function rolledResults(entry,before,after,prior=[]){
 const results=[];let parent=[...prior].reverse().find(r=>rowEffects(r))??null,random=nextDirectRandom(rowEffects(parent??{})??[]),randomNumber=0;
 for(const roll of entry.rolls){
  const result=tableResult(roll,before,after,parent);
  if(result){results.push(result);parent=result;random=nextDirectRandom(rowEffects(result)??[]);randomNumber=0;continue;}
  if(roll.label?.replace(/ \(.*\)$/,'')==='Event random result'&&random){
   const branch=random.outcomes.find(o=>roll.total>=o.min&&roll.total<=o.max);
   if(!branch){random=null;continue;}
   const table=parent.table==='core.prisoner.events'&&parent.row===7?(randomNumber===0?'core.prisoner.incidents':'core.prisoner.riot'):null;
   results.push({table,row:roll.total,title:(table==='core.prisoner.incidents'?'Prison incident':table==='core.prisoner.riot'?'Prison riot':'Event random result')+' '+roll.total,roll:structuredClone(roll),description:table?eventNarrative(table,roll.total):null,summary:eventEffectSummary(branch.effects),source:parent.source});
   random=nextDirectRandom(branch.effects);randomNumber++;
  }
 }
 return results;
}
const continuations=new Set(['roll-education-event-step','cross-career-cover-check','resolve-relationship-event-step','roll-borrowed-event','choose-effect','choose-skill','education-skill','education-check','resolve-life-event','resolve-relationship-event','resolve-relationship-loss','injury-loss','injury-treatment','resolve-book','prisoner-escape','believer-buyout','cross-career-cover','cross-career-training','merchant-fine-roll','resolve-merchant-fine','resolve-benefit-wager','resolve-prisoner-lawyer','skill-award-source','retry-skill-choice','resolve-land-claim','activate-aslan-access','resolve-aslan-access-conflict','resolve-aslan-restoration','resolve-aslan-outlaw-restoration','begin-aslan-officer','qualify-aslan-officer','cancel-aslan-officer','resolve-aslan-officer-rank','advisory-career','advisory-cash','resolve-advisory-cash-result','resolve-advisory-cash-limit','companion-skill','companion-choice-source','education-service','cancel-career-transfer','begin-psionic-training']);
export function decorateEventResults({log,snapshots,events}){
 const contexts=[[]];
 for(let i=0;i<log.length;i++){
  const command=events[i].command,base=command.type==='gm-replay'?command.payload.revision-1:i;
  const actual=command.type==='gm-replay'?events[command.payload.revision-1].command:command;
  const before=snapshots[base],after=snapshots[i+1];
  const prior=command.type==='restore'?contexts[command.payload.revision]:contexts[base];
  const inherited=continuations.has(actual.type)?prior:[];
  const results=rolledResults(log[i],before,after,inherited);
  const context=results.length?[...inherited,...results]:inherited;
  if(context.length)log[i].eventResults=structuredClone(actual.type==='roll-borrowed-event'&&before.pendingBorrowedRoll?.nativeCareerIndex===undefined?results:context);
  contexts.push(command.type==='restore'||['notes','gm-mode','add-extra'].includes(actual.type)?prior:context);
 }
}
