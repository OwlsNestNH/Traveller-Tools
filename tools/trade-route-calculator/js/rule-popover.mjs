import {ruleReference,referenceMarkup} from './rule-references.mjs?v=time-completion-20261010-48';

// Refresh an audit's text while retaining its existing reference buttons. This
// keeps a pointer/Tab target alive when a form's ordinary blur handler rerenders
// the quote, and keeps a focused source control stable during recalculation.
export function replaceReferenceContent(container,html){
 const active=container.ownerDocument?.activeElement,previous=new Map();
 for(const button of container.querySelectorAll?.('[data-rule-info]')||[]){
  const list=previous.get(button.dataset.ruleInfo)||[];list.push(button);previous.set(button.dataset.ruleInfo,list);
 }
 container.innerHTML=html;
 for(const button of container.querySelectorAll?.('[data-rule-info]')||[]){
  const kept=previous.get(button.dataset.ruleInfo)?.shift();if(kept)button.replaceWith(kept);
 }
 if(active?.matches?.('[data-rule-info]')&&container.contains(active))active.focus({preventScroll:true});
}

// A separate native dialog can sit above an existing transaction dialog without
// replacing its draft, submit callback, revision guard or rounding annotations.
export function mountRulePopover(document){
 const dialog=document.createElement('dialog');
 dialog.id='rule-reference-popup';dialog.className='rule-reference-popup';
 dialog.setAttribute('aria-labelledby','rule-reference-title');
 dialog.innerHTML='<div class="rule-reference-heading"><h2 id="rule-reference-title"></h2><button type="button" class="rule-reference-close" aria-label="Close rules reference">×</button></div><div class="rule-reference-body" tabindex="0" role="region" aria-label="Rules reference details"></div>';
 document.body.append(dialog);
 const title=dialog.querySelector('h2'),body=dialog.querySelector('.rule-reference-body'),closeButton=dialog.querySelector('button');
 let opener=null,origin=null,transition=null;
 function rememberGesture(event){transition=event?.detail>0?{at:Date.now(),x:event.clientX,y:event.clientY,button:event.button,pointerId:event.pointerId}:null;}
 function repeatedGesture(event,checkPointer=true){
  const previous=transition,now=Date.now();
  return previous&&event.detail>1&&event.button===previous.button&&(!checkPointer||event.pointerId===previous.pointerId)&&now>=previous.at&&now-previous.at<=750&&Math.abs(event.clientX-previous.x)<=4&&Math.abs(event.clientY-previous.y)<=4;
 }
 function mousedown(event){
  // A double-close's second mousedown can steal the restored opener focus
  // before its click is consumed. MouseEvent has no pointerId.
  if(repeatedGesture(event,false)){event.preventDefault();event.stopImmediatePropagation();}
 }
 function close(event){
  if(!dialog.open)return;
  rememberGesture(event);let target=opener;opener=null;dialog.close();
  const parentModal=document.getElementById('modal');
  const visible=el=>el?.isConnected&&!el.disabled&&el.getClientRects().length>0&&(!parentModal?.open||parentModal.contains(el));
  if(!visible(target)){
   // Background renders may replace the original main-page marker. Return to
   // its same logical group/reference where possible, otherwise a safe visible
   // navigation control. Never focus behind an underlying transaction dialog.
   const group=origin?.group&&[...document.querySelectorAll('[data-settings-group]')].find(el=>el.dataset.settingsGroup===origin.group);
   const scope=parentModal?.open?parentModal:group||document.getElementById(origin?.scopeId)||document.getElementById('main');
   const candidates=[...(scope?.querySelectorAll('[data-rule-info]')||[])].filter(el=>el.dataset.ruleInfo===origin?.id&&visible(el));
   target=candidates[origin?.ordinal]||candidates[0]||(parentModal?.open?document.getElementById('modal-close'):document.querySelector('#tabs [aria-current="page"]')||document.getElementById('notes'));
  }
  origin=null;if(visible(target))target.focus({preventScroll:true});
 }
 function open(button,event){
  const id=button.dataset.ruleInfo,reference=ruleReference(id);
  if(dialog.open)dialog.close();
  opener=button;
  const group=button.closest('[data-settings-group]'),scope=group||button.closest('[id]');
  origin={id,group:group?.dataset.settingsGroup,scopeId:scope?.id,ordinal:[...(scope?.querySelectorAll('[data-rule-info]')||[])].filter(el=>el.dataset.ruleInfo===id).indexOf(button)};
  title.textContent=reference.title[0].toUpperCase()+reference.title.slice(1);
  body.innerHTML=referenceMarkup(id);dialog.dataset.reference=id;body.scrollTop=0;
  rememberGesture(event);dialog.showModal();closeButton.focus({preventScroll:true});
 }
 function pointerdown(event){
  // Keep the original target through pointerdown → click. Focusing the button
  // here would first blur a form field; its normal change handler can replace
  // this audit/rounding region before the click arrives. Opening still waits
  // for click, and showModal then performs the ordinary field blur.
  const button=event.target.closest?.('[data-rule-info]');
  if(button&&!button.disabled&&event.button===0)event.preventDefault();
 }
 function click(event){
  // Consume only the remainder of the same double-click across a popup change,
  // never a fresh click. Dismissal must not click a transaction behind the popup.
  if(repeatedGesture(event)){event.preventDefault();event.stopImmediatePropagation();return;}
  transition=null;
  const button=event.target.closest?.('[data-rule-info]');
  if(button&&!button.disabled){event.preventDefault();event.stopImmediatePropagation();open(button,event);}
  else if(event.target.closest?.('.rule-reference-close')&&dialog.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();close(event);}
 }
 function keydown(event){
  transition=null;
  if(event.key==='Tab'&&dialog.open){
   // Native modal dialogs can still move Tab focus into browser chrome. This
   // read-only popup has exactly two tab stops: Close and its scrollable text.
   event.preventDefault();event.stopImmediatePropagation();
   (document.activeElement===closeButton?body:closeButton).focus();
  }
  if(event.key==='Escape'&&dialog.open){event.preventDefault();event.stopImmediatePropagation();close();}
 }
 function cancel(event){event.preventDefault();event.stopPropagation();close();}
 document.addEventListener('pointerdown',pointerdown,true);
 document.addEventListener('mousedown',mousedown,true);
 document.addEventListener('click',click,true);
 document.addEventListener('keydown',keydown,true);
 dialog.addEventListener('cancel',cancel);
 return {close,isOpen:()=>dialog.open,destroy(){close();document.removeEventListener('pointerdown',pointerdown,true);document.removeEventListener('mousedown',mousedown,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',keydown,true);dialog.removeEventListener('cancel',cancel);dialog.remove();}};
}
