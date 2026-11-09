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

export function createFinalSheet({document,onSave,onPrint}){
 const dialog=document.getElementById('final-character-sheet'),content=document.getElementById('final-sheet-content');
 let returnToLog=false;
 const close=()=>dialog.close();
 dialog.querySelector('[data-final-close]').addEventListener('click',close);
 dialog.querySelector('[data-final-save]').addEventListener('click',onSave);
 dialog.querySelector('[data-final-print]').addEventListener('click',onPrint);
 dialog.querySelector('[data-final-log]').addEventListener('click',()=>{returnToLog=true;close();});
 dialog.addEventListener('close',()=>{
  document.body.classList.remove('final-sheet-open');
  const target=returnToLog?document.querySelector('.log-section h2'):document.querySelector('[data-action="open-character-sheet"]');
  returnToLog=false;
  if(target){if(!target.hasAttribute('tabindex')&&target.tagName!=='BUTTON')target.tabIndex=-1;target.focus();}
 });
 return {
  open(projection,session,catalog){
   if(dialog.open||projection.state.stage!=='finish')return;
   const record=compactRecord(document,document.getElementById('sheet'));
   const history=document.createElement('div');history.className='final-history';
   history.innerHTML=completedTermsView(projection.state,catalog)+finalEventsView(projection,session);
   content.replaceChildren(record,history);
   document.body.classList.add('final-sheet-open');dialog.showModal();dialog.scrollTop=0;
   document.getElementById('final-sheet-title').focus();
  }
 };
}
