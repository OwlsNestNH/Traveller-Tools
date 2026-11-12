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
// This prompt changes presentation only; the existing command owns all event effects.
export function educationEventModel(state,projection){
 const potential=educationPotentialModel(state);if(potential)return potential;
 const nested=educationNestedChoiceModel(state);if(nested)return nested;
 if(projection?.educationGraduationPreview)return {name:'University',kind:'graduation',preview:projection.educationGraduationPreview};
 return state?.stage==='education-event'&&state.character.educations?.[state.education]?.id==='core.university'?{name:'University'}:null;
}
export function educationPotentialModel(state){
 const record=state?.character.educations?.[state.education],choice=state?.pendingChoice,options=choice?.options,effects=options?.[0]?.effects;
 if(state?.pending||state?.effectsQueue?.length||state?.effectNext!=='education-graduation'||state?.character.psionicLoss?.permanent||record?.graduationAllowed!==true)return null;
 if(state?.stage!=='effect-choice'||record?.id!=='core.university'||record.completed||record.event!==2||record.entry?.success!==true||record.entry?.manual||choice?.kind!=='choice'||choice.source?.id!=='core'||choice.source?.page!==17||options?.length!==2||effects?.length!==2||options[0].available===false||options[1].available===false||options[1].effects?.length!==0)return null;
 if(Object.keys(effects[0]).length!==3||Object.keys(effects[1]).length!==4||options[0].label!=='Test potential'||options[1].label!=='Decline')return null;
 if(effects[0].kind!=='psionic-test'||effects[0].termPenalty!=='completed-career-terms'||effects[1].kind!=='career-permission'||effects[1].career!=='core.psion'||effects[1].scope!=='future-terms'||effects.some(e=>e.source?.id!=='core'||e.source?.page!==17))return null;
 return {name:'University',kind:'potential',recorded:Object.hasOwn(state.character.stats,'PSI')};
}
export function educationPotentialView(model){
 return '<section class="education-event-prompt education-potential-prompt"><div class="education-event-heading">'+icon('core.university')+'<h3>University education event</h3></div><section class="education-event-content"><p class="education-potential-label">Event 2 · Psionic potential</p><h4>'+(model.recorded?'Use your recorded psionic potential?':'Test your psionic potential?')+'</h4><p>'+(model.recorded?'Use your recorded PSI without another roll.':'Roll 2D to determine PSI.')+' Accepting permits a future Psion career attempt, not admission or training.</p><button type="button" class="education-potential-rules" data-education-info="potential"><span class="precareer-info-icon" aria-hidden="true">i</span> Rules and consequences</button></section><button type="button" data-action="choose-effect" data-index="0" class="education-event-roll">'+(model.recorded?icon('core.university'):diceArt)+'<span>'+(model.recorded?'Use recorded PSI':'Test potential · Roll 2D')+'</span>'+(model.recorded?'':diceArt)+'</button><button type="button" data-action="choose-effect" data-index="1" class="education-potential-decline">Decline</button><p class="education-event-agency">'+(model.recorded?'Your recorded PSI is kept. No potential test is rolled.':'No potential test is rolled until you choose Test.')+'</p></section>';
}

// Only the two already-explicit Core decisions; all other event timing is unchanged.
export function educationNestedChoiceModel(state){
 const record=state?.character.educations?.[state.education],p=state?.pendingChoice,source={id:'core',page:17};
 if(record?.id!=='core.university'||record.completed||record.entry?.success!==true||record.entry.manual||record.graduationAllowed!==true||state.pending||state.effectNext!=='education-graduation'||state.effectsQueue?.length)return null;
 const hobby={kind:'education-skill-choice',selectionId:'hobby',options:'any',exclude:['Jack-of-all-Trades'],mode:'set',value:0,source};
 const challenge={kind:'check',skillScope:'learned-this-term',target:9,success:[{kind:'checked-skill',mode:'increase',value:1,source},{kind:'relationship',type:'Rival',count:1,source}],failure:[],source};
 if(record.event===9&&state.character.species==='human'&&state.stage==='education-skill'&&JSON.stringify(p)===JSON.stringify(hobby))return {name:'University',kind:'hobby',event:9};
 if(record.event===10&&state.stage==='education-check'&&state.educationCheckSkills?.length&&JSON.stringify(p)===JSON.stringify(challenge))return {name:'University',kind:'challenge',event:10};
 return null;
}
export function educationNestedChoiceView(model,state,{esc}){
 const hobby=model.kind==='hobby',choices=hobby?state.educationOptions.map(o=>o.name):state.educationCheckSkills,id=hobby?'education-hobby-skill':'education-check-skill';
 return '<section class="education-event-prompt education-nested-prompt" data-education-choice="'+model.kind+'"><div class="education-event-heading">'+icon('core.university')+'<h3>University education event</h3></div><section class="education-event-content"><p class="education-potential-label">Event '+model.event+' · '+(hobby?'Hobby skill':'Study challenge')+'</p><h4>'+(hobby?'Choose a hobby skill':'Choose a skill you learned')+'</h4><p>'+(hobby?'Gain an allowed base skill at level 0.':'Study challenge · Target 9+')+'</p><button type="button" class="education-potential-rules" data-education-info="nested"><span class="precareer-info-icon" aria-hidden="true">i</span> Rules and consequences</button></section><label class="education-nested-label">'+(hobby?'Hobby skill':'Skill learned or improved this term')+'<select id="'+id+'"><option value="">Choose a skill</option>'+choices.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('')+'</select></label><button type="button" class="education-event-roll" data-action="'+(hobby?'education-skill':'education-check')+'" disabled>'+(hobby?icon('core.university'):diceArt)+'<span>'+(hobby?'Record hobby skill':'Roll the study challenge')+'</span></button><p class="education-event-agency">'+(hobby?'Choose a skill, then record your choice.':'No challenge roll is made until you press Roll.')+'</p></section>';
}

export function educationEventView(){
 return '<section class="education-event-prompt"><div class="education-event-heading">'+icon('core.university')+'<div><h3>University education event</h3><p>Your initial study skills and EDU gain are recorded.</p></div></div><section class="education-event-content"><h4>What happened during your studies?</h4><p>Roll 2D for one education event.</p><p>Resolve its outcome and any choices before graduation.</p></section><button type="button" data-action="education-event" class="education-event-roll">'+diceArt+'<span>Roll education event</span>'+diceArt+'</button><p class="education-event-agency">You choose when to roll. Nothing has been rolled yet.</p></section>';
}

// Filled, dimensional cartoon art for the approved graduation prompt.
const graduationCap='<svg class="graduation-cap-art" viewBox="0 0 120 96" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><path d="M25 46v26c17 14 43 14 60 0V46" fill="#082735" stroke="#f7fafb" stroke-width="6"/><path d="M26 72c15 14 44 14 58 0" fill="none" stroke="#ffd338" stroke-width="7"/><path d="m7 35 51-25 54 25-54 26Z" fill="#092434" stroke="#f7fafb" stroke-width="6"/><path d="M106 39v37m-5 0h10l3 12H98Z" fill="#082735" stroke="#f7fafb" stroke-width="5"/><circle cx="58" cy="34" r="4" fill="#f7fafb"/></g></svg>';
const graduationDice='<svg class="graduation-dice-art" viewBox="0 0 110 100" aria-hidden="true"><g stroke="#171b0d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="m22 38 21-23 39 2-18 26Z" fill="#ffe88a"/><path d="m22 38 42 5 9 42-40-8Z" fill="#ffda45"/><path d="m64 43 18-26 15 39-24 29Z" fill="#efb929"/><path d="m11 25-7-8m9 24-10-2m27-31-1-7m64 12 8-8m-1 73 8 4" fill="none"/></g><g fill="#171b0d"><ellipse cx="52" cy="29" rx="4" ry="3"/><circle cx="33" cy="48" r="3.7"/><circle cx="54" cy="50" r="3.7"/><circle cx="45" cy="60" r="3.7"/><circle cx="37" cy="70" r="3.7"/><circle cx="60" cy="74" r="3.7"/><ellipse cx="79" cy="40" rx="3" ry="4"/><ellipse cx="85" cy="56" rx="3" ry="4"/><ellipse cx="77" cy="69" rx="3" ry="4"/></g></svg>';

export function educationGraduationView(model,{esc}){
 const p=model.preview,info=(kind,label)=>'<button type="button" class="education-prompt-info" data-education-info="'+kind+'" aria-label="'+label+'">i</button>';
 return '<section class="education-event-prompt education-graduation-prompt"><div class="education-event-heading">'+graduationCap+'<div class="graduation-title-group"><h3>University graduation</h3>'+info('graduation','What graduation changes')+'</div>'+'</div><section class="education-event-content"><h4>Graduation '+esc(p.target)+'+ · Honours '+esc(p.honoursTarget)+'+</h4><p class="graduation-formula">Roll 2D '+(p.modifier<0?'− '+Math.abs(p.modifier):'+ '+p.modifier)+'</p><p>'+esc(p.stat)+' '+esc(p.score)+' · Modifier '+esc(signed(p.modifier))+' '+info('calculation','How the graduation roll is calculated')+'</p></section><button type="button" data-action="education-graduation" class="education-event-roll">'+graduationDice+'<span>Roll for graduation</span>'+graduationDice+'</button><p class="education-event-agency">You choose when to roll.</p></section>';
}

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

export function mountPreCareerPopup(root,{state,catalog,projection,session,esc,sourceLabel,generation=0,resultModel=null,eventModel=null}){
 const layout=root.querySelector('.layout'),workspace=root.querySelector('#workspace'),sheet=root.querySelector('#sheet');
 let dialog=root.querySelector('#precareer-dialog'),context=root.querySelector('#precareer-context'),info=root.querySelector('#precareer-information');
 if(state.stage!=='precareer'&&!resultModel&&!eventModel){
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
 function open(){if(!dialog.open){if(dialog.dataset.panel==='event')dialog.showModal();else dialog.show();}context.querySelector('#precareer-resume').hidden=true;}
 function dismiss(){dialog.close();context.querySelector('#precareer-resume').hidden=false;context.querySelector('#precareer-resume').focus({preventScroll:true});}
 function openInfo(kind,title,trigger){info._opener=trigger;for(const name of ['result','rules','previous'])info.querySelector('#precareer-information-'+name).hidden=kind==='details'?name==='previous':name!==kind;info.querySelector('#precareer-information-title').textContent=title;if(!info.open)info.showModal();info.querySelector('#precareer-information-title').focus();}
 function closeInfo(){info.close();if(info._restoreResult!==undefined){info.querySelector('#precareer-information-result').innerHTML=info._restoreResult;delete info._restoreResult;}if(info._opener?.isConnected)info._opener.focus({preventScroll:true});}
 layout.classList.add('precareer-layout');dialog.dataset.educationKind=eventModel?.kind??'';
 const c=state.character,species=catalog.species.find(s=>s.id===c.species)?.name??c.species;
 const overview=context.querySelector('#precareer-overview');overview.innerHTML='<p class="precareer-eyebrow">YOUR TRAVELLER</p><h2>'+esc(c.name||'Your Traveller')+'</h2><p>'+esc(species)+' · Age '+esc(c.age)+'</p><p>'+esc(c.terms)+' completed terms</p>';
 const step=workspace.querySelector('.step-count');step.textContent=species.toUpperCase()+' · PRE-CAREER';
 const title=root.querySelector('#step-title');title.textContent='Pre-Career';
 step.insertAdjacentHTML('beforebegin','<button type="button" id="precareer-dismiss">Cancel</button>');
 workspace.querySelector('#precareer-dismiss').addEventListener('click',dismiss);
 const sessionKey=JSON.stringify([generation,session.seed,session.events[0]?.id]);
 if(dialog._sessionKey!==sessionKey||projection.revision<dialog._revision){dialog.dataset.panel='standard';delete dialog.dataset.admission;}
 dialog._sessionKey=sessionKey;dialog._revision=projection.revision;
 if(!resultModel&&!eventModel){
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
 }else{dialog.dataset.panel=eventModel?'event':'result';delete dialog.dataset.admission;dialog._openAdmission=null;dialog._refreshPreCareerPanel=null;}
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
 if(eventModel?.kind==='graduation')for(const trigger of workspace.querySelectorAll('[data-education-info]'))trigger.addEventListener('click',()=>{
 const calculation=trigger.dataset.educationInfo==='calculation',p=eventModel.preview;
 info._restoreResult=info.querySelector('#precareer-information-result').innerHTML;
 info.querySelector('#precareer-information-result').innerHTML=calculation?'<p>Roll two dice and add your current '+esc(p.stat)+' characteristic modifier ('+esc(signed(p.modifier))+'). Graduation requires '+esc(p.target)+'+; honours requires '+esc(p.honoursTarget)+'+.</p>':'<p>Your initial awards and education event are already recorded. Successful graduation adds the existing study-skill and EDU awards, plus the applicable graduate career benefits. Honours improves the applicable career benefits.</p><p>If you do not graduate, your initial awards and resolved event gains are not removed by this result.</p>';
 openInfo('result',calculation?'How graduation is calculated':'What graduation changes',trigger);
 });
 if(eventModel?.kind==='potential')workspace.querySelector('[data-education-info="potential"]').addEventListener('click',event=>{
 info._restoreResult=info.querySelector('#precareer-information-result').innerHTML;
 info.querySelector('#precareer-information-result').innerHTML='<p>Without recorded PSI, Test potential rolls 2D and reduces the result by completed career terms, not education terms. Recorded PSI is reused without another roll.</p><p>Accepting also permits a future Psion career attempt. It does not grant admission, training or talents. Declining grants neither a potential test nor that permission. Graduation remains separate.</p><p>Core Rulebook Update 2022 · p. 17</p>';
 openInfo('result','Rules and consequences',event.currentTarget);
 });
 if(['hobby','challenge'].includes(eventModel?.kind)){
 const select=workspace.querySelector('.education-nested-label select'),roll=workspace.querySelector('.education-nested-prompt [data-action]');select.addEventListener('change',()=>{roll.disabled=!select.value;});
 workspace.querySelector('[data-education-info="nested"]').addEventListener('click',event=>{
 info._restoreResult=info.querySelector('#precareer-information-result').innerHTML;
 info.querySelector('#precareer-information-result').innerHTML=eventModel.kind==='hobby'?'<p>Choose an allowed base skill except Jack-of-all-Trades. No specialisation is needed for this level-0 award. An existing higher level is retained. This is an event award, not one of your University study subjects.</p>':'<p>Choose a skill learned or improved during this education term. Roll 2D with its existing skill modifier, including applicable species traits, against 9+. No characteristic modifier is added. Success increases that skill by 1 and adds the tutor as a Rival; failure grants neither award.</p>';
 openInfo('result','Rules and consequences',event.currentTarget);
 });
 }
 if(resultModel||eventModel)workspace.querySelector('#precareer-dismiss').textContent='Close';
 if(eventModel){for(const small of workspace.querySelectorAll('.precareer-information-rows small'))small.remove();if(dialog.open&&!dialog.matches(':modal')){dialog.close();open();}}
 if(!eventModel&&dialog.open&&dialog.matches(':modal')){dialog.close();open();}
 dialog._refreshPreCareerPanel?.();if(newlyCreated)open();
}
