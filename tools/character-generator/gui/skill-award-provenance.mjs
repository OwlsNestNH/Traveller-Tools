// Presentation only: origin is supplied by replay at the actual award producer.
// A current rank or a matching skill name is never proof of an award's source.
import {showOpeningInformation} from './opening-help.mjs';
import {characterEffectDetails} from './roll-result-view.mjs';
export function skillAwardSource(origin,catalog){
 if(!origin)return null;
 const career=catalog.careers?.find(c=>c.id===origin.careerId)?.name;
 if(origin.kind==='rank'&&career&&Number.isInteger(origin.rank)){
  const track=origin.track==='officer'?'officer ':origin.track==='enlisted'?'enlisted ':'';
  return (origin.reason==='source-assisted-mapping'||origin.mapping?.kind==='referee-selected'?'Referee-selected ':'')+career+' '+track+'rank '+origin.rank+(origin.title?' · '+origin.title:'')+' award';
 }
 if(['academy-entry','academy-service'].includes(origin.kind)){
  const education=catalog.precareers?.find(e=>e.id===origin.educationId)?.name;
  return (education??(career?career+' academy':'Academy'))+(origin.kind==='academy-entry'?' admission basic-training award':' graduation service award');
 }
 return null;
}
function sourceCitation(origin,catalog){
 const source=origin?.source;if(!source)return null;
 const title=source.title??catalog.sources?.[source.id]?.title;if(!title)return null;
 if(Number.isInteger(source.page))return title+' · p. '+source.page;
 const pages=Array.isArray(source.pages)?source.pages.filter(Number.isInteger):null;
 return title+(pages?.length?' · pp. '+pages.join('–'):'');
}
export function pendingSkillAwardSource(presentation,state,catalog,{esc}){
 const source=skillAwardSource(presentation?.pending,catalog);if(!source)return '';
 const choice=state.pendingChoice,base=choice?.name??(choice?.allowed?.length===1?choice.allowed[0]:null);
 const award=base&&Number.isInteger(choice.value)?base+(choice.mode==='set'?' '+choice.value:' +'+choice.value):null;
 return '<section class="skill-award-origin" aria-label="Award source"><div class="skill-award-origin-heading"><div><p class="eyebrow">'+esc(source)+'</p>'+(award?'<h3>'+esc(award)+'</h3>':'')+'</div><button type="button" class="opening-info-trigger" data-award-source-information aria-label="About this earned award" aria-haspopup="dialog" aria-controls="opening-help-dialog"><span aria-hidden="true">i</span></button></div></section>';
}
export function pendingAwardInformation(presentation,state,catalog){
 const origin=presentation?.pending,title=skillAwardSource(origin,catalog);if(!title)return null;
 const effect=state.pendingChoice??state.pending?.effect??state.psionicTraining?.award;
 const rule=state.stage==='psionic-training'?'Resolve the offered talent acquisition. This source identifies the opportunity; it does not grant a free talent or an unrecorded skill level.':effect?.mode==='set'&&Number.isInteger(effect.value)?'This is an award to at least level '+effect.value+', not an extra +'+effect.value+'. A chosen skill already at that level or higher keeps its existing level.':'Resolve the specific offered award. Its level and any specialisation are kept separately from other earned awards.';
 return {title,paragraphs:[title+'.',rule,origin.kind==='rank'?'This reward belongs to the rank actually attained on this career track. Academy service awards are separate.':'This academy award is separate from any reward for an actual career rank.','The paperwork has a source. Your memory was apparently unavailable.'],source:sourceCitation(origin,catalog)??'Recorded award; source citation unavailable.'};
}
export function mountPendingAwardInformation(document,presentation,state,catalog,{crowType='generic'}={}){
 const trigger=document.querySelector('[data-award-source-information]'),info=pendingAwardInformation(presentation,state,catalog);if(!trigger||!info)return;
 trigger.addEventListener('click',()=>showOpeningInformation(document,{...info,crowType},trigger));
}
export function skillAwardResult(result,awards,catalog,{event=null}={}){
 const known=(awards??[]).map(award=>({...award,source:skillAwardSource(award.origin,catalog)})).filter(a=>a.source&&a.origin.kind!=='academy-entry');
 if(!result||!known.length)return result;
 const lines=known.map(a=>a.name+' '+a.after+' — '+a.source+(a.changed?'':'; already satisfied, no increase.'));
 // Retain every original consequence and audit detail, including other awards.
 const previous=result.full??result;
 // Remove only an exact duplicate of a producer-observed skill change. A later
 // unrelated change to the same skill must remain visible with other effects.
 const duplicated=new Set(characterEffectDetails({changes:(event?.changes??[]).filter(c=>known.some(a=>c.path==='skills.'+a.name&&(c.before??null)===(a.before??null)&&c.after===a.after))},catalog));
 const details=[...new Set([...(result.details??[]).filter(line=>!duplicated.has(line)),...lines.slice(1)])];
 const grouped=new Map();for(const a of known){const earlier=grouped.get(a.name);grouped.set(a.name,{...a,changed:a.changed||earlier?.changed});}
 const first=known[0],title=[...grouped.values()].map(a=>a.name+' '+a.after+(a.changed?'':' retained')).join(' · '),source=first.source+(first.changed?'.':'; no skill increase.');
 return {...result,title,details:[source,...details],text:[title,source,...details].join(' '),full:previous,compact:true,information:{...(result.information??{}),title:'Your earned skill and its source',label:'About this skill award',retainCrow:true,contextual:true,source:[...new Set(known.map(a=>sourceCitation(a.origin,catalog)).filter(Boolean))].join('; '),paragraphs:[...new Set([...(result.information?.paragraphs??[]),previous.title,...(previous.details??[]),...lines])]}};
}
