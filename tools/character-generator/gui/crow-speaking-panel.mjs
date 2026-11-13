import {outcomeTagline} from './outcome-taglines.mjs';
import {IMPERIAL_OUTCOME_LINES} from './imperial-career-tags.mjs';
// Shared presentation only: no commands, storage, random draws or rule effects.
import {crowAsset} from './crow-assistance.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function crowSpeakingPanel({message,aside='',type='generic',tone='information',className=''}={}){
 const asset=crowAsset(type),src=typeof asset==='string'?asset:asset.src;
 return '<section class="crow-speaking-panel '+escape(className)+'" data-tone="'+escape(['information','success','failure'].includes(tone)?tone:'information')+'"><img src="'+escape(src)+'" alt="Crow, your character-building assistant" width="144" height="144"><blockquote><strong>Crow says</strong><p>'+escape(message)+'</p>'+(aside?'<p class="crow-speaking-aside">'+escape(aside)+'</p>':'')+'</blockquote></section>';
}
// Promote an existing primary instruction without recreating its nodes or
// listeners. Purpose-built Crow panels keep their approved layout.
export function mountCrowStageGuidance(document,root,{type='generic'}={}){
 if(!root||root.querySelector(':scope > .crow-speaking-panel,.career-pilot-guidance,#crow-introduction,.required-action-warning'))return null;
 const instruction=[...root.children].find(n=>n.tagName==='P'&&!n.classList.contains('step-count')&&n.textContent.trim());
 if(!instruction||instruction.querySelector('input,select,textarea,button'))return null;
 const holder=document.createElement('div');holder.innerHTML=crowSpeakingPanel({message:'',type});const panel=holder.firstElementChild,words=panel.querySelector('blockquote');words.lastElementChild.remove();instruction.before(panel);words.append(instruction);return panel;
}
export function mountCrowSpeakingContent(document,content,{type='generic',tone='information'}={}){
 if(!content||content.closest('.crow-speaking-panel')||content.querySelector('.crow-speaking-panel'))return null;
 const holder=document.createElement('div');holder.innerHTML=crowSpeakingPanel({message:'',type,tone});const panel=holder.firstElementChild,words=panel.querySelector('blockquote');words.lastElementChild.remove();
 if(content.tagName==='P'){content.before(panel);words.append(content);return panel;}
 // Preserve the original grid item, IDs and event listeners. Only its existing
 // children move into the speaking bubble.
 words.append(...content.childNodes);content.classList.add('crow-speaking-panel');content.dataset.tone=tone;content.replaceChildren(...panel.childNodes);return content;
}
// Completion has no new decision/roll. Keep its existing result and next
// instruction with one speaker, retaining the original nodes and wording.
export function mountCrowCompletionGuidance(document,root,{actionId}={}){
 const result=root?.querySelector('#last-action-result'),guide=root?.querySelector(':scope > .crow-speaking-panel');
 if(!result||!guide)return null;
 const audit=result.querySelector('.result-information'),instructions=[...guide.querySelector('blockquote').children].filter(n=>n.tagName==='P');
 const existing=result.querySelector('.outcome-tagline.crow-speaking-panel');
 let speaker=existing;
 if(existing)guide.remove();else{speaker=guide;const quote=guide.querySelector('blockquote');for(const p of instructions)p.remove();const comment=document.createElement('p');comment.textContent=outcomeTagline('choice',actionId,IMPERIAL_OUTCOME_LINES);quote.append(comment);if(audit)audit.before(guide);else result.append(guide);}
 speaker.classList.add('education-result-crow','education-result-tagline');
 for(const instruction of instructions){instruction.classList.add('completion-next-instruction');if(audit)audit.before(instruction);else result.append(instruction);}
 return speaker;
}
