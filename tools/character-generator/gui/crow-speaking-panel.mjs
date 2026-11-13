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
 if(!root||root.querySelector('.crow-speaking-panel,.career-pilot-guidance,#crow-introduction,.required-action-warning'))return null;
 const instruction=[...root.children].find(n=>n.tagName==='P'&&!n.classList.contains('step-count')&&n.textContent.trim());
 if(!instruction||instruction.querySelector('input,select,textarea,button'))return null;
 const holder=document.createElement('div');holder.innerHTML=crowSpeakingPanel({message:'',type});const panel=holder.firstElementChild,words=panel.querySelector('blockquote');words.lastElementChild.remove();instruction.before(panel);words.append(instruction);return panel;
}
