import {knownSkillOptions} from './skill-knowledge.mjs';
function informationId(name){let hash=2166136261;for(const c of name)hash=Math.imul(hash^c.codePointAt(0),16777619);return 'training-information-'+(hash>>>0).toString(36);}
export function trainingInformationView(info,name,esc,identity=name,skills={}){
 if(!info)return '';
 const known=knownSkillOptions(info.skills,skills);
 const entries=info.entries??[...(info.skills??[]),...(info.characteristics??[]),...(info.other??[])],id=informationId(identity),label='View skills and outcomes: '+name;
 return '<button type="button" class="training-info-trigger" aria-haspopup="dialog" popovertarget="'+id+'" aria-label="'+esc(label)+'" title="'+esc(label)+'"><span aria-hidden="true">ⓘ</span></button><div popover="auto" id="'+id+'" class="training-information" role="dialog" aria-label="'+esc(name+' table information')+'"><div class="training-info-heading"><h3>'+esc(name)+'</h3><button type="button" class="training-info-close" popovertarget="'+id+'" popovertargetaction="hide" aria-label="Close table information">×</button></div><ul>'+entries.map(entry=>'<li>'+esc(entry)+'</li>').join('')+'</ul>'+(known.length?'<h4>Already known</h4><ul>'+known.map(name=>'<li>'+esc(name)+'</li>').join('')+'</ul>':'')+(info.legend?'<p class="help training-culture-legend">'+esc(info.legend)+'</p>':'')+'<p class="tiny">In table order. Choosing the table rolls one result; some results require a further choice.</p></div>';
}
export function trainingChoiceView(label,info,action,attributes,{esc,button,skills={}}){
 return '<div class="training-choice">'+button(esc(label),action,'choice',attributes)+trainingInformationView(info,label,esc,action+' '+attributes+' '+label,skills)+'</div>';
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
