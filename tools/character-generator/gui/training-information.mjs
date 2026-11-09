export function trainingInformationView(info,name,esc){
 if(!info)return '';
 const sections=[['Skills',info.skills],['Characteristics',info.characteristics],['Other outcomes',info.other]].filter(([,entries])=>entries?.length);
 return '<details class="training-information"><summary>View skills and outcomes: '+esc(name)+'</summary>'+sections.map(([label,entries])=>'<p><strong>'+label+':</strong> '+entries.map(esc).join(', ')+'.</p>').join('')+'<p class="tiny">Possible outcomes, listed alphabetically. Choosing the table rolls one result; some results require a further choice.</p></details>';
}
export function trainingChoiceView(label,info,action,attributes,{esc,button}){
 return '<div class="training-choice">'+button(esc(label),action,'choice',attributes)+trainingInformationView(info,label,esc)+'</div>';
}
// Describe confirmed changes from the audit, not an assumed table award. Keep
// saved summaries untouched so existing characters still replay identically.
export function skillResultNotice(event,state){
 const gains=(event.changes??[]).filter(c=>c.path.startsWith('skills.')&&typeof c.after==='number'&&(c.before===null||c.after>c.before));
 const changes=gains.map(c=>c.path.slice(7)+' '+c.after+(c.before===null?' (new)':' (was '+c.before+')'));
 const training=event.type==='training'||event.type==='cross-career-training'||(event.rolls??[]).some(r=>/^(Source training:|Borrowed .* assignment training|Prole assignment training)/.test(r.label));
 if(training)for(const c of event.changes??[])if(c.path.startsWith('stats.')&&typeof c.after==='number'&&typeof c.before==='number'&&c.after!==c.before)changes.push(c.path.slice(6)+' '+c.after+' (was '+c.before+')');
 const parts=[];
 if(changes.length)parts.push('Received: '+changes.join('; ')+'.');
 if(training){
  if(state.stage==='skill-choice'){
   const choice=state.pendingChoice,names=choice.allowed?.length?choice.allowed.join(' or '):choice.scope==='psionic-talents'?'a psionic talent':'a skill';
   parts.push('Pending award: '+names+'. Choose the skill or speciality below to apply it.');
  }else if(state.stage==='effect-choice')parts.push('Choose the training outcome below to complete this award.');
  else if(state.stage==='psionic-training')parts.push('Talent acquisition is pending. Complete the talent attempt below.');
  else if(state.stage==='book-step')parts.push('A source decision is required before the pending award can be applied.');
  else if(!changes.length)parts.push('No skill or characteristic increase was applied.');
 }
 return parts.join(' ');
}
