import {characterEffectDetails,modifierEffectDetails,pendingEffectDetails} from './roll-result-view.mjs';
import {survivalResult} from './survival-result.mjs';
import {advancementResult} from './advancement-result.mjs';
import {checkOutcome} from './check-outcome.mjs';

const opening=new Set(['identity','statistics','background']);
const navigation=new Set(['setup','background','accept-statistics','skip-precareer','open-precareer','cancel-education','continue-career','notes','connection']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const unique=values=>[...new Set(values.filter(Boolean))];

// Read the replay-validated result. Do not infer a successful check from dice,
// confuse a table's possible award with an applied one, or change the audit.
export function journeyResult(event,state,catalog,result){
 if(!event||!result||navigation.has(event.type))return null;
 const specific=survivalResult(event,state)??advancementResult(event),check=checkOutcome(event);
 const training=['training','cross-career-training'].includes(event.type);
 const stories=(event.eventResults??[]).map(row=>row.description||row.title);
 const changes=characterEffectDetails(event,catalog).filter(line=>!/^Age:|^Completed terms:|^Career terms:/.test(line));
 const modifiers=modifierEffectDetails(event.modifierChanges?{modifiers:event.modifierChanges.before}:null,{modifiers:event.modifierChanges?.after},catalog);
 const pending=pendingEffectDetails(event,catalog);
 const consequences=unique([...(specific?.details??check?.details??[]).filter(line=>!/^Check total|^Mishap rolled:|^Career event rolled:/.test(line)),...changes,...modifiers,...pending]);
 if(training&&!changes.length&&!['skill-choice','effect-choice','book-step','psionic-training'].includes(state.stage))consequences.push('No skill or characteristic increase was applied.');
 if(state.stage==='skill-choice')consequences.push('Choose your skill or speciality below to complete this award.');
 if(state.stage==='effect-choice')consequences.push('Choose an outcome below to complete this step.');
 if(state.stage==='book-step')consequences.push('A source decision is still needed. Unresolved effects have not been awarded.');
 const checkLine=specific?.details.find(line=>/^Check total/.test(line));
 return {title:specific?.title??(training?'Your training result':stories.length?'Your story continues':result.title),status:result.status,stories,consequences:unique(consequences),checkLine,rolls:(event.rolls??[]).filter(roll=>finite(roll.total)),full:result};
}

const pips={1:[[50,50]],2:[[27,27],[73,73]],3:[[27,27],[50,50],[73,73]],4:[[27,27],[73,27],[27,73],[73,73]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[27,25],[73,25],[27,50],[73,50],[27,75],[73,75]]};
function die(value){return '<svg class="journey-die" viewBox="0 0 100 100" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="currentColor" stroke-width="5"/>'+ (pips[value]??[]).map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="8" fill="currentColor"/>').join('')+'</svg>';}
export function journeyResultView(model,{esc}){
 if(!model)return '';
 const paragraphs=lines=>lines.map(line=>'<p>'+esc(line)+'</p>').join('');
 return '<section id="journey-result" class="journey-result" data-result-status="'+esc(model.status)+'"><p class="journey-eyebrow">YOUR RESULT</p><h3>'+esc(model.title)+'</h3>'+model.rolls.map(roll=>'<div class="journey-roll"><div class="journey-dice">'+(roll.values??[]).map(die).join('')+'</div><div><span>'+esc(roll.label)+'</span><strong>Dice total '+esc(roll.total)+'</strong>'+(roll.kept&&JSON.stringify(roll.kept)!==JSON.stringify(roll.values)?'<small>Kept '+esc(roll.kept.join(' + '))+'</small>':'')+'</div></div>').join('')+(model.checkLine?'<p class="journey-check">'+esc(model.checkLine)+'</p>':'')+'<div class="journey-story">'+paragraphs(model.stories)+'</div><div class="journey-consequences">'+paragraphs(model.consequences)+'</div></section>';
}

// A nonmodal dialog leaves the persistent file toolbar available. Existing
// editors and forms are moved, never cloned. Their IDs, handlers, drafts and
// commands are unchanged. Native modal information dialogs still open above it.
export function mountJourneyPopup(root,{state,catalog,event,result,freshResult=false,esc}){
 const layout=root.querySelector('.layout'),workspace=root.querySelector('#workspace'),sheet=root.querySelector('#sheet');
 let dialog=root.querySelector('#journey-dialog'),context=root.querySelector('#journey-context');
 const active=!opening.has(state.stage);
 if(!active){
  if(dialog){layout.prepend(workspace);layout.append(sheet);dialog.remove();context.remove();}
  layout.classList.remove('journey-layout');root.body.classList.remove('journey-open');return;
 }
 if(!dialog){
  dialog=root.createElement('dialog');dialog.id='journey-dialog';dialog.className='journey-dialog';dialog.setAttribute('aria-labelledby','step-title');
  context=root.createElement('div');context.id='journey-context';context.innerHTML='<section class="journey-stage-card"><p class="journey-eyebrow">YOUR NEXT STEP</p><h2 id="journey-stage-name"></h2><button type="button" id="journey-reopen" class="quiet" aria-controls="journey-dialog">Open this step</button></section><aside class="journey-rail"><div id="journey-character-summary"></div><details id="journey-record"><summary>Character sheet <span aria-hidden="true">＋</span></summary></details></aside>';
  layout.append(context,dialog);dialog.append(workspace);context.querySelector('#journey-record').append(sheet);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.querySelector('dialog:modal,:popover-open')){event.preventDefault();close();}});
  context.querySelector('#journey-reopen').addEventListener('click',()=>{context.querySelector('#journey-record').open=false;open();root.querySelector('#step-title')?.focus({preventScroll:true});});
  context.querySelector('#journey-record').addEventListener('toggle',()=>{if(context.querySelector('#journey-record').open)close();});
 }
 function close(){dialog.close();root.body.classList.remove('journey-open');context.querySelector('#journey-reopen').focus({preventScroll:true});}
 function open(){if(!dialog.open)dialog.show();root.body.classList.add('journey-open');}
 layout.classList.add('journey-layout');
 const c=state.character,title=root.querySelector('#step-title').textContent;
 context.querySelector('#journey-stage-name').textContent=title;
 context.querySelector('#journey-character-summary').innerHTML='<p class="journey-eyebrow">YOUR TRAVELLER</p><h2>'+esc(c.name||'Your Traveller')+'</h2><p>'+esc(catalog.species.find(s=>s.id===c.species)?.name??c.species)+' · Age '+esc(c.age)+'</p><p>'+esc(c.terms)+' completed terms</p>';
 const heading=root.querySelector('#step-title'),eyebrow=workspace.querySelector('.step-count');
 eyebrow.textContent=state.stage.replaceAll('-',' ').toUpperCase();
 const dismiss=root.createElement('button');dismiss.type='button';dismiss.id='journey-close';dismiss.className='journey-close quiet';dismiss.textContent='Close step';dismiss.addEventListener('click',close);eyebrow.before(dismiss);
 const originalResult=workspace.querySelector('#last-action-result'),model=journeyResult(event,state,catalog,result);
 if(originalResult){
  const details=root.createElement('details');details.className='journey-details journey-previous-result';
  details.innerHTML='<summary>'+(freshResult?'Roll and result details':'Previous result')+'</summary>';
  originalResult.before(details);details.append(originalResult);
  // Keep full existing presentation accessible without making the audit the
  // first thing a player has to read on each new choice screen.
  workspace.append(details);
 }
 if(freshResult&&model){
  heading.insertAdjacentHTML('beforebegin',journeyResultView(model,{esc}));heading.classList.add('journey-next-title');
 }
 // The source explanation is still available, but not repeated above choices.
 if(state.stage==='training'){
  const explanation=heading.nextElementSibling;
  if(explanation?.tagName==='P'){
   const details=root.createElement('details');details.className='journey-details';details.innerHTML='<summary>About this training roll</summary>';explanation.before(details);details.append(explanation);workspace.append(details);
   heading.insertAdjacentHTML('afterend','<p class="journey-instruction">Choose a table. Roll to discover what you learn.</p>');
  }
 }
 if(state.stage==='finish'){
  for(const node of [...workspace.children])if(node.matches('h3,ul,p.warning')||node.matches('p:not(.step-count)')){let details=workspace.querySelector('.journey-finish-details');if(!details){details=root.createElement('details');details.className='journey-details journey-finish-details';details.innerHTML='<summary>Source-assisted coverage</summary>';workspace.append(details);}details.append(node);}
 }
 // A new stage or result opens naturally. Closing and reopening is read-only.
 context.querySelector('#journey-record').open=false;open();
}
