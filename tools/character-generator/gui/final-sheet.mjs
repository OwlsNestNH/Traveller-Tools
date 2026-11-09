import {completedTermsView,finalEventsView} from './final-sheet-history.mjs';

// Reuse the live record's read-only sections so benefits, effects, source
// rulings and species-specific ledgers cannot drift between the two sheets.
export function compactRecord(document,source){
 const record=document.createElement('div');
 record.className='final-record';
 record.innerHTML=source.innerHTML;
 for(const details of record.querySelectorAll('details')){
  if(details.querySelector('button,input,select,textarea'))details.remove();
 }
 for(const node of record.querySelectorAll('button,input,select,textarea,datalist,.log-actions'))node.remove();
 // Informational disclosures already have print-only duplicates. Keep a
 // single visible version, while showing the standalone saved narrative.
 for(const node of record.querySelectorAll('.print-only')){
  if(node.classList.contains('sheet-section'))node.classList.remove('print-only');
  else node.remove();
 }
 for(const details of record.querySelectorAll('details'))details.open=true;
 record.querySelector('.eyebrow')?.remove();
 // A second read-only view must not duplicate live editor IDs or references.
 for(const node of record.querySelectorAll('*')){
  for(const attribute of [...node.attributes])if(attribute.name==='id'||attribute.name.startsWith('data-')||['for','aria-controls','aria-describedby','aria-labelledby'].includes(attribute.name))node.removeAttribute(attribute.name);
 }
 return record;
}

export function createFinalSheet({document,onSave,onPrint,onLog}){
 const dialog=document.getElementById('final-character-sheet'),content=document.getElementById('final-sheet-content');
 const close=()=>{dialog.close();finishClose();};
 dialog.querySelector('[data-final-close]').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelector('[data-final-save]').addEventListener('click',onSave);
 dialog.querySelector('[data-final-print]').addEventListener('click',onPrint);
 dialog.querySelector('[data-final-log]').addEventListener('click',onLog);
 // Native modal inertness protects the editor; wrap the last/first Tab too
 // so Chromium does not move keyboard focus into browser chrome mid-review.
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
  const controls=[...dialog.querySelectorAll('button,a[href],summary,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);
  const first=controls[0],last=controls.at(-1),current=document.activeElement;
  if(!first){event.preventDefault();document.getElementById('final-sheet-title').focus();return;}
  if(event.shiftKey&&(current===first||!controls.includes(current))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&current===last){event.preventDefault();first.focus();}
 });
 function finishClose(){
  // Button closes are synchronous. Ignore their later native event, or a
  // queued close event from a dialog that has already been reopened.
  if(dialog.open||!document.body.classList.contains('final-sheet-open'))return;
  document.body.classList.remove('final-sheet-open');
  const target=document.querySelector('[data-action="open-character-sheet"]');
  if(target){if(!target.hasAttribute('tabindex')&&target.tagName!=='BUTTON')target.tabIndex=-1;target.focus();}
 }
 dialog.addEventListener('close',finishClose);
 return {
  open(projection,session,catalog){
   if(dialog.open||projection.state.stage!=='finish')return;
   const record=compactRecord(document,document.getElementById('sheet'));
   const history=document.createElement('div');history.className='final-history';
   history.innerHTML=completedTermsView(projection.state,catalog)+finalEventsView(projection,session,catalog);
   content.replaceChildren(record,history);
   document.body.classList.add('final-sheet-open');dialog.showModal();dialog.scrollTop=0;
   document.getElementById('final-sheet-title').focus();
  }
 };
}
