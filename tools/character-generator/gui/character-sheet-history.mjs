// Replaceable, read-only view of the current validated branch. No replay or rolls.
import {currentEvents,finalEventRows} from './final-sheet-history.mjs';
import {characterEffectDetails} from './roll-result-view.mjs';
import {conciseResult} from './concise-result.mjs';
const unique=values=>[...new Set(values.filter(Boolean))];
const words=value=>String(value??'').replace(/[._-]+/g,' ').replace(/^./,c=>c.toUpperCase());
const titles={setup:'Character identity',background:'Background skills','roll-statistics':'Characteristic rolls','accept-statistics':'Accepted characteristics','swap-statistics':'Placed characteristics','enter-physical-statistic':'Physical dice entry','gm-override':'Referee correction',notes:'Character notes',connection:'Connection','roll-aslan-family':'Family background','roll-aslan-birth-order':'Family position','resolve-aslan-estate':'Family estate','roll-aslan-clan':'Clan','roll-aslan-pride':'Pride','roll-aslan-rite':'Rite of Passage',precareer:'Education entry','education-skill':'University skill','education-event':'Pre-career event','education-graduation':'Graduation','choose-skill':'Skill choice','choose-effect':'Life-path choice','resolve-book':'Source decision','continue-career':'Continue career','leave-career':'Leave career',training:'Training',survival:'Survival',advancement:'Advancement',commission:'Commission'};
const navigation=new Set(['configure','gm-mode','gm-physical-dice','restore','open-precareer','cancel-education','cancel-career-transfer','retry-skill-choice']);
export function characterSheetTermLabel(timing){
 if(!timing||!Number.isInteger(timing.term)||timing.term<1)return 'Timing not recorded';
 if(timing.phase==='before')return 'Before Term '+timing.term;
 if(timing.phase==='after')return 'After Term '+timing.term;
 return timing.phase==='term'?'Term '+timing.term:'Timing not recorded';
}
function sourceText(source,catalog){
 if(!source)return '';
 const title=source.title??catalog?.sources?.[source.id]?.title;
 const pages=source.pages??(source.page!=null?[source.page]:[]);
 return title?title+(pages.length?' · p. '+pages.join(', '):''):'';
}
function cleanSummary(event,row){
 const summary=row?.summary??event.summary??'';
 if(event.type==='notes'){const note=event.changes?.find(change=>change.path==='notes');return note?'Character notes: '+(note.after||'cleared'):summary;}
 // Raw mechanics/serialized object dumps remain in the troubleshooting log.
 if(/[{}]/.test(summary))return '';
 if(event.type==='gm-override'){
  const match=summary.match(/^GM override pool\[(\d+)\]: (.*?)\. Reason: (.*)$/);
  if(match)return 'Starting roll '+(Number(match[1])+1)+': '+match[2]+'. Reason: '+match[3];
  return summary.replace(/stat\./g,'');
 }
 return summary;
}
export function characterSheetEventRows(projection,session,catalog){
 const summaries=new Map(finalEventRows(projection,session,catalog).map(row=>[row.number,row]));
 return currentEvents(projection,session).filter(event=>!(navigation.has(event.type)||event.type.startsWith('acknowledge-'))||event.rolls?.length).map(event=>{
  const known=summaries.get(event.number),result=conciseResult({...event,rolls:[]},{},catalog);
  const title=titles[event.type]??words(event.type),summary=cleanSummary(event,known);
  const details=unique(known?.details??result?.details??characterEffectDetails(event,catalog)).filter(detail=>detail!==summary&&!summary.includes(detail));
  const sources=unique((event.eventResults??[]).map(row=>sourceText(row.source,catalog)));
  return {number:event.number,title,summary,details,rolls:event.rolls??[],termLabel:characterSheetTermLabel(projection.characterSheetTiming?.[event.number]),timing:projection.characterSheetTiming?.[event.number]??null,sourceLabel:sources.join(' · '),changes:event.changes??[]};
 }).filter(row=>row.summary||row.details.length||row.rolls.length);
}
