import {escapeHTML as esc} from './ui-format.mjs';
export function unknownButton(key,label,attribute='data-unknown-value'){return `<button type="button" class="unknown-value" ${attribute}="${esc(key)}" aria-label="Enter ${esc(label)} manually">Unknown</button>`;}
export function parseUnknownNumber(raw,{label,min=0,max=1000000,step='any'}){
 if(typeof raw!=='string'||!raw.trim())throw Error('Enter a value, or Cancel to keep it unknown.');
 const value=Number(raw);if(!Number.isFinite(value)||value<min||value>max||(step===1&&!Number.isSafeInteger(value)))throw Error(`${label} must be ${step===1?'a whole number':'a number'} from ${min} to ${max}.`);
 return value===0?0:value;
}
let dialog=null,pending=null;
export function openUnknownNumber(options){
 if(pending)return false;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='unknown-value-dialog';dialog.setAttribute('aria-labelledby','unknown-value-title');document.body.append(dialog);
  const close=()=>{const old=pending;pending=null;dialog.close();if(old?.focus?.isConnected)old.focus.focus({preventScroll:true});else old?.fallbackFocus?.()?.focus({preventScroll:true});};
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-cancel-unknown]'))close();});
  dialog.addEventListener('submit',e=>{e.preventDefault();const item=pending;if(!item||item.saving)return;const field=dialog.querySelector('input');try{const value=parseUnknownNumber(field.value,item);if(!field.reportValidity())return;item.saving=true;item.onSave(value);if(pending===item)close();}catch(error){item.saving=false;dialog.querySelector('[role=alert]').textContent=error.message;}});
 }
 pending={...options,focus:document.activeElement,saving:false};const {label,min=0,max=1000000,step='any',reference='Manual value for this ship. Published source data is retained.'}=options;
 dialog.innerHTML=`<form><header><h2 id="unknown-value-title">${esc(label)}</h2><button type="button" data-cancel-unknown aria-label="Cancel value entry">×</button></header><p>${esc(reference)}</p><label>${esc(label)}<input id="unknown-number" type="number" min="${min}" max="${max}" step="${step}" required placeholder="Enter a value"></label><p class="help">Blank stays unknown when cancelled. Zero is an explicit value.</p><p role="alert"></p><div class="actions"><button type="submit" class="primary">Save</button><button type="button" data-cancel-unknown>Cancel</button></div></form>`;
 dialog.showModal();dialog.querySelector('input').focus();return true;
}
export function editUnknownInput(input,{label,reference,fallbackFocus,onSave=()=>{}}){
 const previous=input.value;
 return openUnknownNumber({label,reference,fallbackFocus,min:Number(input.min||0),max:Number(input.max||1000000),step:input.step==='1'?1:'any',onSave:value=>{
  if(!input.isConnected||input.value!==previous)throw Error('This draft changed. Cancel and reopen the value editor.');
  input.value=String(value);try{onSave(value);}catch(e){input.value=previous;throw e;}
 }});
}
