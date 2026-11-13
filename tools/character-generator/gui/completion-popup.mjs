import {educationPresentationIcon} from './education-result-view.mjs';
// Approved Education popup frame, applied to existing completion nodes only.
// No commands, storage writes, new choices or result changes.
export function mountCompletionPopup(document,state){
 const layout=document.querySelector('.layout'),workspace=document.getElementById('workspace');
 let dialog=document.getElementById('completion-dialog'),context=document.getElementById('completion-context');
 if(!['finish','retirement','deceased'].includes(state.stage)){
  if(dialog){if(dialog.contains(workspace))layout.prepend(workspace);dialog.remove();context.remove();}layout.classList.remove('completion-layout');return;
 }
 document.querySelector('header h1').textContent='CHARACTER BUILDER';document.querySelector('header .lead').textContent='TRAVELLER RPG';
 const created=!dialog;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='completion-dialog';dialog.setAttribute('aria-labelledby','step-title');context=document.createElement('section');context.id='completion-context';const label=document.createElement('p');label.textContent='Your recorded results and character remain available.';const resume=document.createElement('button');resume.id='completion-resume';resume.type='button';resume.textContent='Open completion review';context.append(label,resume);layout.prepend(context,dialog);dialog.append(workspace);
  resume.addEventListener('click',()=>{dialog.show();workspace.querySelector('#step-title').focus({preventScroll:true});});
  dialog._dismiss=()=>{dialog.close();resume.focus({preventScroll:true});};dialog.addEventListener('cancel',e=>{e.preventDefault();dialog._dismiss();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog:modal,:popover-open')){e.preventDefault();dialog._dismiss();}});
 }
 layout.classList.add('completion-layout');
 const controls=document.createElement('div');controls.className='completion-controls';const close=document.createElement('button');close.type='button';close.textContent='Close';close.id='completion-close';close.addEventListener('click',dialog._dismiss);const sheet=document.createElement('button');sheet.type='button';sheet.className='quiet';sheet.dataset.action='open-current-character-sheet-popup';sheet.textContent='Character sheet';sheet.setAttribute('aria-haspopup','dialog');sheet.setAttribute('aria-controls','final-character-sheet');if(state.stage!=='finish')controls.append(sheet);controls.append(close);workspace.prepend(controls);
 const title=workspace.querySelector('#step-title'),heading=document.createElement('div');heading.className='completion-result-heading';heading.innerHTML=educationPresentationIcon('book');title.before(heading);heading.append(title);
 const result=workspace.querySelector('#last-action-result');if(result){result.classList.add('education-result');const status=result.querySelector(':scope>.result-status');if(status&&result.dataset.resultStatus==='info')status.classList.add('sr-only');for(const crow of result.querySelectorAll('.crow-speaking-panel'))crow.classList.add('education-result-crow');const audit=result.querySelector('.result-information'),dice=result.querySelector('.army-recorded-dice');if(audit&&dice)audit.before(dice);}
 if(created||dialog.dataset.stage!==state.stage){if(!dialog.open)dialog.show();dialog.dataset.stage=state.stage;workspace.querySelector('#step-title').focus({preventScroll:true});}
}
