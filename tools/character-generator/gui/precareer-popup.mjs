import {currentActionNumbers} from './final-sheet-history.mjs';
import {conciseResult} from './concise-result.mjs';
// Pre-Career presentation only. All education choices and admission rules
// still use the existing catalog and commands.
export function preCareerGroups(catalog){return {standard:catalog.precareers.filter(p=>p.source==='core'),additional:catalog.precareers.filter(p=>p.source!=='core')};}
export function educationUnavailable(state,choice){return !!(state.character.terms>=3||state.educationAttemptTerms?.includes(state.character.terms)||choice.maxTerm&&state.character.terms>=choice.maxTerm);}
const art={
 university:'<path d="M8 25 40 10 72 25 40 40Z M20 33v17c10 12 30 12 40 0V33 M68 28v27 M65 55h6l2 9H63Z"/>',
 army:'<path d="M9 26 40 10 71 26Z M13 65h54 M9 72h62 M18 29v32 M29 29v32 M40 29v32 M51 29v32 M62 29v32"/>',
 marine:'<circle cx="40" cy="15" r="7"/><path d="M40 22v49 M27 31h26 M13 47c3 15 13 20 27 24 14-4 24-9 27-24 M10 53l3-9 8 5 M59 49l8-5 3 9"/>',
 navy:'<circle cx="40" cy="40" r="22"/><circle cx="40" cy="40" r="5"/><path d="M40 8v27 M40 45v27 M8 40h27 M45 40h27 M17 17l19 19 M44 44l19 19 M17 63l19-19 M44 36l19-19"/>',
 colonial:'<path d="M5 65a24 24 0 0 1 48 0Z M39 70a18 22 0 0 1 36 0Z M20 65v-8a3 3 0 0 1 6 0v8 M50 70v-7a3 3 0 0 1 6 0v7 M28 41V16 M35 55v2 M64 62v2"/><circle cx="28" cy="12" r="4"/>',
 psionic:'<path d="M28 72 25 64H14V50L8 47l6-13C14 1 65 2 66 32c0 16-17 23-11 40 M42 24v24 M30 36h24 M34 28l16 16 M34 44l16-16"/>',
 merchant:'<path d="M10 21 40 8 70 21v43L40 74 10 64Z M10 21l30 14 30-14 M40 35v39 M10 21l30 53 30-53 M10 64l30-29 M70 64 40 35 M22 20l18 8 18-8 M20 46v5 M59 47v5"/>',
 'hard-knocks':'<path d="M14 17h48v15H14Z M3 32h72v16H3Z M14 48h48v16H14Z M38 17v15 M26 32v16 M51 32v16 M38 48v16"/>',
 spacer:'<path d="M25 57C14 30 32 11 40 8c8 3 26 22 15 49L40 67Z M24 40 12 58l15-5 M56 40l12 18-15-5 M33 67l-3 9 M47 67l3 9"/><circle cx="40" cy="31" r="8"/>'
};
function icon(id){const key=id.split('.').at(-1).replace('academy-','');return '<svg class="precareer-art" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">'+(art[key]??art.university)+'</g></svg>';}
export function preCareerChoicesView(state,catalog,{esc,button}){
 const groups=preCareerGroups(catalog),card=choice=>button(icon(choice.id)+'<span>'+esc(choice.name)+'</span>','precareer','precareer-choice','data-id="'+esc(choice.id)+'"'+(educationUnavailable(state,choice)?' disabled':''));
 return '<div id="precareer-standard"><p class="precareer-intro">Choose education before your '+(state.character.terms===0?'first':'next')+' career.</p><div class="precareer-options">'+groups.standard.map(card).join('')+'</div><div class="precareer-more"><button type="button" id="precareer-additional">Additional careers <span aria-hidden="true">→</span></button><p>Opens the additional options in a new popup.</p></div></div><div id="precareer-extras" hidden><p class="precareer-intro">Choose another education or upbringing option.</p><div class="precareer-options">'+groups.additional.map(card).join('')+'</div><div class="precareer-back"><button type="button" id="precareer-options-back">← Back to Pre-Career</button></div></div><div class="precareer-skip">'+button('Go straight to careers <span aria-hidden="true">→</span>','skip-precareer')+'</div>';
}

const signed=value=>value>=0?'+'+value:String(value);
const diceArt='<svg class="admission-dice" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 30 49 17 68 43 32 58Z M12 30l6 32 24 12 26-31 M32 58l10 16 M49 17l7 31 M5 18l-3-7 M67 18l7-8 M72 62l6 3"/><path d="M25 32h1 M42 28h1 M38 42h1 M24 49h1 M27 60h1 M50 60h1 M59 50h1" stroke-width="6"/></g></svg>';
export function admissionPreviewView(state,catalog,id,{esc,sourceLabel}){
 const choice=catalog.precareers.find(p=>p.id===id&&p.source==='core'),preview=state.educationAdmissionPreviews?.[id];
 if(!choice||!preview||educationUnavailable(state,choice))return '';
 const special=preview.sourceAssisted;
 return '<div class="admission-heading">'+icon(id)+'<div><h3>'+esc(choice.name)+' admission</h3><p>You choose when to '+(special?'continue':'roll')+'.</p></div></div><div class="admission-numbers">'+(special?'<h4>Source-assisted admission</h4><p>'+esc(preview.reason)+'</p><p>No automated admission roll will be made.</p>':'<h4>Admission target: '+esc(preview.target)+'+</h4><p class="admission-formula">Roll 2D '+(preview.modifier<0?'− '+Math.abs(preview.modifier):'+ '+preview.modifier)+'</p><p>'+esc(preview.stat)+' '+esc(preview.score)+': '+signed(preview.characteristicDM)+' · '+(preview.term===1?'First term':'Term '+preview.term)+': '+signed(preview.termDM)+(id==='core.university'?' · SOC bonus: '+signed(preview.thresholdModifier):'')+'</p>')+'</div><button type="button" id="precareer-admission-roll" data-action="precareer-admit" data-id="'+esc(id)+'">'+diceArt+'<span>'+(special?'Continue to source resolution':'Roll for Admission')+'</span>'+diceArt+'</button><p class="admission-warning">One admission attempt this term.<br>If you do not get in, you can still start a career.</p><p class="source admission-source">'+esc(sourceLabel(preview.source.id,preview.source.page))+'</p><div class="precareer-back"><button type="button" id="precareer-admission-back">← Back to Pre-Career</button></div>';
}

export function preCareerSourceView(state,catalog,{esc,sourceLabel}){
 const special=!Object.hasOwn(state.character.stats,'SOC')||catalog.species.find(s=>s.id===state.character.species)?.precareerDM;
 return '<p>Choosing an education follows its existing admission, study, event and graduation procedure. Core choices open a review first. Only Roll for Admission (or Continue to source resolution) begins the entry attempt.</p><p>Education is available during the first three terms, with one entry attempt per term. Individual paths can have earlier timing and other admission requirements.</p>'+(special?'<p>This Traveller’s Core education needs source-assisted resolution for species-specific rules. The choice does not grant admission or benefits automatically.</p>':'')+'<ul>'+catalog.precareers.map(p=>'<li><strong>'+esc(p.name)+'</strong> · '+esc(sourceLabel(p.source,p.page))+'</li>').join('')+'</ul><p>Unresolved psionics and cross-book exceptions stop for an explicit source decision. Review the relevant source with your referee.</p>';
}

export function previousStepRecord(projection,session){
 const active=currentActionNumbers(session),administrative=new Set(['acknowledge-education-result','acknowledge-aslan-rite','notes','connection','configure','open-precareer','skip-precareer','cancel-education','cancel-career-transfer','restore']);
 for(const event of [...projection.log].reverse()){
  if(!active.has(event.number))continue;
  let command=session.events[event.number-1]?.command;
  for(let depth=0;command?.type==='gm-replay'&&depth<session.events.length;depth++)command=session.events[command.payload.revision-1]?.command;
  if(!command||administrative.has(command.type)||command.type.startsWith('gm-')||command.type==='precareer'&&command.payload.id?.startsWith('companion.'))continue;
  return {event,command};
 }
 return null;
}
function previousStepView(projection,session,catalog,{esc}){
 // Review completed evidence from the current branch, never restore it as the
 // active character. A GM dice replacement retains its original step identity.
 const record=previousStepRecord(projection,session),skills=record?.command.type==='background'?record.command.payload.skills:null;
 const result=record?conciseResult(record.event,projection.state,catalog):null;
 return '<p class="precareer-readonly">Read only · Your character stays at Pre-Career.</p>'+(skills?'<h3>Background skills</h3><p>These were the skills you accepted.</p><ul>'+skills.map(name=>'<li>'+esc(name)+' 0</li>').join('')+'</ul>':result?'<h3>'+esc(record.event.type==='gm-replay'&&record.command.type==='roll-aslan-rite'?'Rite of passage':result.title)+'</h3>'+result.details.map(line=>'<p>'+esc(line)+'</p>').join(''):'<p>No previous completed step is recorded.</p>');
}

export function mountPreCareerPopup(root,{state,catalog,projection,session,esc,sourceLabel,generation=0,resultModel=null}){
 const layout=root.querySelector('.layout'),workspace=root.querySelector('#workspace'),sheet=root.querySelector('#sheet');
 let dialog=root.querySelector('#precareer-dialog'),context=root.querySelector('#precareer-context'),info=root.querySelector('#precareer-information');
 if(state.stage!=='precareer'&&!resultModel){
  if(dialog){layout.prepend(workspace);layout.append(sheet);dialog.remove();context.remove();info.remove();}
  layout.classList.remove('precareer-layout');return;
 }
 state={...state,educationAdmissionPreviews:projection.educationAdmissionPreviews};
 const newlyCreated=!dialog;
 if(!dialog){
  dialog=root.createElement('dialog');dialog.id='precareer-dialog';dialog.setAttribute('aria-labelledby','step-title');dialog.dataset.panel='standard';
  context=root.createElement('div');context.id='precareer-context';context.innerHTML='<section class="precareer-step-card"><button type="button" id="precareer-previous">← Back</button><p class="precareer-back-hint">Previous step</p><div class="precareer-step-rule"></div><p class="precareer-eyebrow">YOUR NEXT STEP</p><p class="precareer-next">Pre-Career</p><button type="button" id="precareer-resume" hidden>Open Pre-Career</button></section><aside id="precareer-rail"><section id="precareer-overview"></section></aside>';
  info=root.createElement('dialog');info.id='precareer-information';info.setAttribute('aria-labelledby','precareer-information-title');info.innerHTML='<div class="precareer-information-heading"><h2 id="precareer-information-title" tabindex="-1"></h2><button type="button" id="precareer-information-close">Back</button></div><div id="precareer-information-result"></div><div id="precareer-information-rules"></div><div id="precareer-information-previous"></div>';
  layout.append(context,dialog);dialog.append(workspace);context.querySelector('#precareer-rail').append(sheet);root.body.append(info);
  context.querySelector('#precareer-resume').addEventListener('click',()=>{open();root.querySelector('#step-title').focus();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.querySelector('dialog:modal,:popover-open')){event.preventDefault();dismiss();}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  info.addEventListener('cancel',event=>{event.preventDefault();closeInfo();});info.querySelector('#precareer-information-close').addEventListener('click',closeInfo);
  context.querySelector('#precareer-previous').addEventListener('click',event=>openInfo('previous','Previous step',event.currentTarget));
 }
 function open(){if(!dialog.open)dialog.show();context.querySelector('#precareer-resume').hidden=true;}
 function dismiss(){dialog.close();context.querySelector('#precareer-resume').hidden=false;context.querySelector('#precareer-resume').focus({preventScroll:true});}
 function openInfo(kind,title,trigger){info._opener=trigger;for(const name of ['result','rules','previous'])info.querySelector('#precareer-information-'+name).hidden=kind==='details'?name==='previous':name!==kind;info.querySelector('#precareer-information-title').textContent=title;if(!info.open)info.showModal();info.querySelector('#precareer-information-title').focus();}
 function closeInfo(){info.close();if(info._opener?.isConnected)info._opener.focus({preventScroll:true});}
 layout.classList.add('precareer-layout');
 const c=state.character,species=catalog.species.find(s=>s.id===c.species)?.name??c.species;
 const overview=context.querySelector('#precareer-overview');overview.innerHTML='<p class="precareer-eyebrow">YOUR TRAVELLER</p><h2>'+esc(c.name||'Your Traveller')+'</h2><p>'+esc(species)+' · Age '+esc(c.age)+'</p><p>'+esc(c.terms)+' completed terms</p>';
 const step=workspace.querySelector('.step-count');step.textContent=species.toUpperCase()+' · PRE-CAREER';
 const title=root.querySelector('#step-title');title.textContent='Pre-Career';
 step.insertAdjacentHTML('beforebegin','<button type="button" id="precareer-dismiss">Cancel</button>');
 workspace.querySelector('#precareer-dismiss').addEventListener('click',dismiss);
 const sessionKey=JSON.stringify([generation,session.seed,session.events[0]?.id]);
 if(dialog._sessionKey!==sessionKey||projection.revision<dialog._revision){dialog.dataset.panel='standard';delete dialog.dataset.admission;}
 dialog._sessionKey=sessionKey;dialog._revision=projection.revision;
 if(!resultModel){
 if(dialog.dataset.panel==='result')dialog.dataset.panel='standard';
 const admission=root.createElement('div');admission.id='precareer-admission';workspace.querySelector('.precareer-skip').before(admission);
 const showPanel=panel=>{dialog.dataset.panel=panel;workspace.querySelector('.precareer-skip').hidden=panel!=='standard';const previousResult=workspace.querySelector('#precareer-result-open');if(previousResult)previousResult.hidden=panel==='additional';workspace.querySelector('#precareer-standard').hidden=panel!=='standard';workspace.querySelector('#precareer-extras').hidden=panel!=='additional';admission.hidden=panel!=='admission';title.textContent=panel==='additional'?'Additional Careers':'Pre-Career';dialog.scrollTop=0;if(dialog.open&&dialog.getBoundingClientRect().top<0)dialog.scrollIntoView({block:'start'});};
 function showAdmission(id,focus=true){
  const html=admissionPreviewView(state,catalog,id,{esc,sourceLabel});if(!html)return false;
  dialog.dataset.admission=id;admission.innerHTML=html;showPanel('admission');
  admission.querySelector('#precareer-admission-back').addEventListener('click',()=>{delete dialog.dataset.admission;showPanel('standard');workspace.querySelector('[data-action="precareer"][data-id="'+id+'"]').focus({preventScroll:true});});
  if(focus)title.focus({preventScroll:true});return true;
 }
 dialog._openAdmission=showAdmission;
 workspace.querySelector('#precareer-additional').addEventListener('click',()=>{showPanel('additional');title.focus({preventScroll:true});});
 workspace.querySelector('#precareer-options-back').addEventListener('click',()=>{showPanel('standard');title.focus({preventScroll:true});});
 dialog._refreshPreCareerPanel=()=>{if(dialog.dataset.panel==='admission'&&!showAdmission(dialog.dataset.admission,false)){delete dialog.dataset.admission;showPanel('standard');}else showPanel(dialog.dataset.panel);};
 }else{dialog.dataset.panel='result';delete dialog.dataset.admission;dialog._openAdmission=null;dialog._refreshPreCareerPanel=null;}
 const result=workspace.querySelector('#last-action-result');info.querySelector('#precareer-information-result').replaceChildren(...(result?[result]:[]));
 info.querySelector('#precareer-information-rules').innerHTML=preCareerSourceView(state,catalog,{esc,sourceLabel});
 info.querySelector('#precareer-information-previous').innerHTML=previousStepView(projection,session,catalog,{esc});
 workspace.insertAdjacentHTML('beforeend','<div class="precareer-information-rows"><button type="button" id="precareer-result-open"'+(result?'':' disabled')+'><span class="precareer-info-icon" aria-hidden="true">i</span><span><strong>Previous result</strong><small>Your most recent completed result appears here.</small></span></button><button type="button" id="precareer-rules-open"><span class="precareer-info-icon" aria-hidden="true">i</span><span><strong>Education rules and sources</strong><small>Rules and source references for the available options.</small></span></button></div>');
 workspace.querySelector('#precareer-result-open').addEventListener('click',event=>openInfo('result','Previous result',event.currentTarget));
 workspace.querySelector('#precareer-rules-open').addEventListener('click',event=>openInfo(resultModel?'details':'rules',resultModel?'Result details and sources':'Education rules and sources',event.currentTarget));
 if(resultModel){info.querySelector('#precareer-information-result').innerHTML='<h3>'+esc(resultModel.name)+' '+esc(resultModel.kind)+'</h3><p>'+resultModel.dice.map(esc).join(' + ')+' '+(resultModel.modifier<0?'− ':'+ ')+Math.abs(resultModel.modifier)+' = '+esc(resultModel.total)+' · Target '+esc(resultModel.target)+'+</p><ul>'+[...(resultModel.details??[]),...(resultModel.benefits??[]),...(resultModel.retained??[]),...(resultModel.missed??[])].map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>';workspace.querySelector('#precareer-result-open').remove();workspace.querySelector('#precareer-rules-open strong').textContent='Result details and sources';workspace.querySelector('#precareer-rules-open small').remove();}
 // Move existing record nodes, never clone editors or their IDs. Each top-level
 // bar is part of one exclusive group, with a fallback for older browsers.
 const rail=context.querySelector('#precareer-rail'),previousBar=rail.dataset.openBar;
 const nodes=[...sheet.children],stats=nodes.find(n=>n.querySelector('.stats')),skills=nodes.find(n=>n.querySelector('h3')?.textContent==='Skills'),notes=nodes.find(n=>n.id==='notes-connections');
 const groups=[['precareer-characteristics','Characteristics',stats?[stats]:[]],['precareer-skills','Skills',skills?[skills]:[]],['precareer-notes','Notes & connections',notes?[notes]:[]],['precareer-more-record','More character details',nodes.filter(n=>![stats,skills,notes].includes(n)&&n.tagName!=='H2'&&!n.matches('.eyebrow'))]];
 sheet.replaceChildren();
 for(const [id,label,contents] of groups){if(!contents.length)continue;const bar=root.createElement('details');bar.id=id;bar.dataset.precareerBar='';bar.name='precareer-record-bars';bar.innerHTML='<summary>'+label+' <span aria-hidden="true">+</span></summary>';bar.append(...contents);sheet.append(bar);bar.open=previousBar===id;
  if(id==='precareer-notes')notes.open=bar.open;
  bar.addEventListener('toggle',()=>{if(!bar.isConnected)return;if(id==='precareer-notes')notes.open=bar.open;if(bar.open){rail.dataset.openBar=id;for(const other of sheet.querySelectorAll(':scope > details'))if(other!==bar)other.open=false;}else if(rail.dataset.openBar===id)delete rail.dataset.openBar;});
 }
 dialog._refreshPreCareerPanel?.();if(newlyCreated)open();
}
