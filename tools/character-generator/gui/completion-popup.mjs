import {mountRecordBars} from './record-bars.mjs';
import {educationPresentationIcon} from './education-result-view.mjs';
// Approved Education popup frame, applied to existing completion nodes only.
// No commands, storage writes, new choices or result changes.
export function sourceAssistedCoverageView(coverage,{labels,esc}){
 if(!coverage.length)return '';
 return '<h3>Source-assisted coverage</h3><ul>'+coverage.map(id=>'<li>'+esc(labels[id]??id.replaceAll('-',' '))+'</li>').join('')+'</ul>';
}
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
 const sheet=document.getElementById('sheet'),nodes=[...sheet.children],stats=nodes.find(n=>n.querySelector('.stats')),skills=nodes.find(n=>n.querySelector('h3')?.textContent==='Skills'),notes=nodes.find(n=>n.id==='notes-connections'),origin=nodes.find(n=>n.matches('.aslan-origin-sheet'));
 const headers=nodes.filter(n=>n.matches('.eyebrow,h2,.sheet-meta,.sheet-facts,.physical-dice-warning')),overview=document.createElement('section');overview.className='completion-record-overview';overview.append(...headers);
 const groups=[['completion-characteristics','Characteristics',stats?[stats]:[]],['completion-aslan-origin','Aslan family and origin',origin?[origin]:[]],['completion-skills','Skills',skills?[skills]:[]],['completion-notes','Notes & connections',notes?[notes]:[]],['completion-more-record','More character details',nodes.filter(n=>![stats,origin,skills,notes,...headers].includes(n))]];
 sheet.replaceChildren(overview);mountRecordBars(document,{sheet,host:context,groups,notes,name:'completion-record-bars'});

 const controls=document.createElement('div');controls.className='completion-controls';const close=document.createElement('button');close.type='button';close.className='quiet';close.textContent='Close';close.id='completion-close';close.addEventListener('click',dialog._dismiss);const sheetButton=document.createElement('button');sheetButton.type='button';sheetButton.className='quiet';sheetButton.dataset.action='open-current-character-sheet-popup';sheetButton.textContent='Character sheet';sheetButton.setAttribute('aria-haspopup','dialog');sheetButton.setAttribute('aria-controls','final-character-sheet');if(state.stage!=='finish')controls.append(sheetButton);controls.append(close);workspace.prepend(controls);
 const title=workspace.querySelector('#step-title'),heading=document.createElement('div');heading.className='completion-result-heading';heading.innerHTML=educationPresentationIcon('book');title.before(heading);heading.append(title);
 const result=workspace.querySelector('#last-action-result');if(result){result.classList.add('education-result');const invitation=workspace.querySelector('.final-sheet-invitation'),speaker=result.querySelector('.crow-speaking-panel');const duplicate=result.querySelector(':scope>h3'),normal=value=>value.trim().replace(/[.!?]+$/,'');if(duplicate&&(state.stage==='finish'||normal(duplicate.textContent)===normal(title.textContent)))duplicate.hidden=true;if(state.stage==='finish'&&invitation&&speaker)speaker.after(invitation);
 const status=result.querySelector(':scope>.result-status');if(status&&result.dataset.resultStatus==='info')status.classList.add('sr-only');for(const crow of result.querySelectorAll('.crow-speaking-panel'))crow.classList.add('education-result-crow');const audit=result.querySelector('.result-information'),dice=result.querySelector('.army-recorded-dice');if(audit&&dice)audit.before(dice);}
 if(created||dialog.dataset.stage!==state.stage){if(!dialog.open)dialog.show();dialog.dataset.stage=state.stage;workspace.querySelector('#step-title').focus({preventScroll:true});}
}
