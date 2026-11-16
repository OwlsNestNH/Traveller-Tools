import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {showOpeningInformation} from './opening-help.mjs';
import {armyRecordedDice} from './career-template.mjs';
export function agentInjuryDice(record,event,{esc}){
 const mishap=event?.eventResults?.find(e=>e.table==='core.agent.mishaps'&&e.row===5)?.roll;
 const rolls=record?[...record.tableRolls.map((value,index)=>({label:'Injury table '+(index+1),values:[value],total:value})),...(record.severityDie===undefined?[]:[{label:'Injury severity',values:[record.severityDie],total:record.severityDie}])]:mishap?[{...mishap,label:'Recorded Agent mishap'}]:[];
 return '<div class="agent-injury-dice">'+armyRecordedDice({rolls},{esc})+'</div>';
}
export function agentInjuryTargetLabels(targets){
 return targets.map((person,index)=>{
  const label=person.role+': '+person.name;
  const duplicates=targets.filter(other=>other.role===person.role&&other.name===person.name);
  return duplicates.length>1?label+' ('+(targets.slice(0,index+1).filter(other=>other.role===person.role&&other.name===person.name).length)+' of '+duplicates.length+')':label;
 });
}
export function agentOtherPersonInjury(state){
 const p=state?.pending,e=p?.effect,r=state?.character?.careers?.[state.active];
 return state?.stage==='book-step'&&r?.id==='core.agent'&&(p?.kind==='agent-person-injury'||p?.kind==='native-effect'&&e?.kind==='injury'&&e.table==='core.injury'&&e.subject==='chosen-contact-ally-or-family'&&e.rolls===2&&e.take==='lower');
}
export function agentInjuryInformation(){return {title:'Injury to another person',crowType:'agent',paragraphs:['Choose a Contact, Ally or family member. The app rolls twice on the existing Injury table and keeps the lower result. Severe results also roll the required characteristic-loss die.','Choose the affected characteristics where the table allows a choice. The result is saved for this person; your Traveller’s characteristics, cash and medical bills are unchanged.'],source:'Core Rulebook Update 2022 · Agent p. 23; Injury p. 49.'};}
export function agentInjuryView(state,event,{esc,button}){
 const career=state.character.careers[state.active],r=state.character.otherPersonInjuries?.find(r=>r.id===state.pending.recordId);
 let content='<p>Your work has injured a contact, ally or family member.</p>'+(career.forcedExit?'<p><strong>You must leave Agent after this mishap.</strong></p>':'');
 content+='<button type="button" class="quiet" id="agent-injury-information" aria-haspopup="dialog">ⓘ Injury rules</button>';
 if(!r){
  content+=agentInjuryDice(null,event,{esc});
  const targets=(state.character.relationships??[]).filter(p=>['Contact','Ally'].includes(p.role));
  content+=crowSpeakingPanel({message:targets.length?'Choose who was hurt, then roll their injury.':'Roll the injury for a family member.',type:'agent'});
  const targetLabels=agentInjuryTargetLabels(targets);
  if(targets.length)content+='<label>Who was hurt?<select id="injured-person-target"><option value="family">Family member</option>'+targets.map((p,index)=>'<option value="'+esc(p.id)+'">'+esc(targetLabels[index])+'</option>').join('')+'</select></label>';
  else content+='<p>A family member is affected. No name entry is required.</p>';
  content+=button('Roll their injury','agent-person-injury-roll');
 }else{
  const targets=(state.character.relationships??[]).filter(p=>['Contact','Ally'].includes(p.role)),targetIndex=targets.findIndex(p=>p.id===r.targetId),targetLabel=targetIndex>=0?agentInjuryTargetLabels(targets)[targetIndex]:r.person===r.relationship?r.person:r.relationship+': '+r.person;
  content+='<h3>'+esc(targetLabel)+'</h3>'+agentInjuryDice(r,event,{esc})+'<p>Kept lower injury result: <strong>'+r.tableResult+'</strong>.</p>';
  if(r.effects===undefined){content+=crowSpeakingPanel({message:'Choose which of their characteristics takes the recorded loss.',type:'agent'});content+='<div class="choice-list">'+r.options.map((o,index)=>button(esc(o.label),'agent-person-injury-loss','choice','data-index="'+index+'"')).join('')+'</div>';}
  else {content+='<p><strong>'+(r.effects.length?esc(r.effects.map(e=>e.name+' '+e.value).join(', ')):'No permanent characteristic loss.')+'</strong></p><p>This injury belongs to '+esc(r.person)+'. Your Traveller is unchanged.</p>'+button('Record injury and continue','agent-person-injury-continue');}
 }
 return '<section id="agent-person-injury">'+content+'</section>';
}
export function mountAgentInjury(document,state){
 if(!agentOtherPersonInjury(state))return;
 if(!document.getElementById('agent-injury-layout')){const style=document.createElement('style');style.id='agent-injury-layout';style.textContent='#agent-person-injury .agent-injury-dice{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:14px 0}#agent-person-injury .army-recorded-dice{margin:0;padding:12px;min-width:0}#agent-person-injury .army-recorded-dice p{font-size:16px;line-height:1.3;margin:0 0 8px}#agent-person-injury .army-recorded-dice p:last-child{margin:8px 0 0}#agent-person-injury .army-dice-calculation{margin:0}#agent-person-injury .choice-list{display:flex;flex-wrap:wrap;gap:10px}#agent-person-injury .choice-list button{flex:1;min-width:85px}@media(max-width:600px){#agent-person-injury .agent-injury-dice{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}#agent-person-injury .army-recorded-dice{padding:8px}#agent-person-injury .army-recorded-dice p{font-size:14px}#agent-person-injury .education-result-die{width:42px;height:42px}}';document.head.append(style);}
 const workspace=document.getElementById('workspace');document.getElementById('step-title').textContent='Someone close to you is hurt';
 workspace.querySelector('#last-action-result')?.remove();for(const node of workspace.querySelectorAll('.career-pilot-guidance'))node.remove();
 const trigger=document.getElementById('agent-injury-information');trigger?.addEventListener('click',()=>showOpeningInformation(document,agentInjuryInformation(),trigger));
}
