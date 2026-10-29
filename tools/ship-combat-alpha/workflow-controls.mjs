import {workflowPresentation} from './workflow-presentation.mjs';
import {missileQueue} from './missiles.mjs';
import {arrivals} from './missile-impact.mjs';
import {directFirePreview} from './direct-fire-resolution.mjs';
import {directFireQueue,unresolvedDeclarations} from './direct-fire-profile.mjs';
import {nextGunner} from './gunnery.mjs';
import {initiativeInputsChanged} from './initiative.mjs';
import {workflowRound} from './workflow.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
export function createWorkflowControls({root,getState,getSelected,isLocked,dispatch,onSelect,onStation,onInitiative,onResolve,onResults,onMissiles,onImpacts,onCrew,onRoundReview,onEndCombat,onReport}){
 let lastLocked=null;
 const strip=document.createElement('section');strip.id='workflow-strip';strip.setAttribute('aria-label','Combat progress');document.querySelector('main').prepend(strip);
 strip.addEventListener('click',event=>{if(!event.target.closest('button')||isLocked())return;const state=getState(),view=workflowPresentation(state,getSelected());if(!state.workflow){onStation('captain');onInitiative();return;}if(view.current)onSelect(view.current);onStation(view.phase==='Manoeuvre'?'pilot':view.phase==='Attack'?'gunnery':'captain');root.scrollIntoView({block:'nearest'});});
 function place(){const bar=document.getElementById('command-bar');if(bar){if(root.parentElement!==bar)bar.append(root);return;}const pane=document.getElementById('station-pane');pane.prepend(root);}
 function compact(){
  const bar=document.getElementById('command-bar');if(!bar)return;
  const phase=getState().workflow?.phase,primary=phase==='thrust'?['select','plot']:phase==='movement'?['reopen','move']:phase==='attacks'?['gunnery','resolve','impacts','next']:phase==='crew'?['crew','round-review']:['initiative','start'];
  const popup=document.createElement('dialog');popup.id='workflow-more';popup.className='console-popup';popup.setAttribute('aria-label','Workflow information and additional commands');popup.innerHTML='<div class="console-popup-heading"><h2>Workflow information and commands</h2><button type="button" data-close-workflow>Close</button></div>';
  const buttons=[...root.querySelectorAll('[data-workflow]')].filter(b=>primary.includes(b.dataset.workflow));
  // Keep explanatory text and manual adjudication fields in an accessible popup.
  const content=document.createElement('div');while(root.firstChild)content.append(root.firstChild);popup.append(content);root.append(popup);
  const actions=document.createElement('div');actions.className='console-primary-actions';root.prepend(actions);
  for(const button of buttons){if(button.dataset.workflow==='next'&&content.querySelector('[data-manual-attacks]')){const review=document.createElement('button');review.type='button';review.textContent='Review manual attacks';review.onclick=()=>popup.showModal();actions.append(review);continue;}if(button.dataset.workflow==='reopen')button.textContent='Back · review plots';actions.append(button);}
  if(content.querySelector('[data-critical-note]')){const critical=document.createElement('button');critical.type='button';critical.textContent='Review pending critical effects';critical.onclick=()=>{popup.showModal();popup.querySelector('[data-critical-note]').focus();};actions.append(critical);}
  const heading=document.createElement('span');heading.className='workflow-action-title';heading.tabIndex=-1;actions.prepend(heading);
  popup.querySelector('[data-close-workflow]').onclick=()=>popup.close();popup.addEventListener('click',e=>{if(e.target.closest('[data-workflow]'))popup.close();});popup.addEventListener('close',()=>document.querySelector('[data-console-more]')?.focus({preventScroll:true}));
 }


 function render(){
  const state=getState(),battle=state.workflow,locked=isLocked(),next=state.acceleration?.order[state.acceleration.declared.length],ready=state.ships.length&&state.ships.every(s=>s.flight.initiative!=null),phase=battle?.phase;
  lastLocked=locked;
  const view=workflowPresentation(state,getSelected()),shipName=id=>state.ships.find(s=>s.id===id)?.name??'None';
  strip.innerHTML=`<ol aria-label="Combat phases">${['Setup','Manoeuvre','Attack','Actions'].map(p=>`<li ${p===view.phase?'aria-current="step"':''}>${p}</li>`).join('')}</ol><div><strong>${battle?'Round '+workflowRound(state)+' · ':''}${view.phase} · ${view.step}</strong><span>${view.current?'Acting: '+esc(shipName(view.current))+' · Next: '+esc(view.next?shipName(view.next):'phase completion'):phase==='movement'?'All ships ready to move':phase==='crew'?'Selected: '+esc(shipName(getSelected()))+' · Choose a station':phase==='attacks'?'Declarations locked · highest initiative first':'Record initiative, then GM confirms'}</span></div><button type="button" ${locked?'disabled':''}>${!battle?'Start combat · Captain initiative':view.phase==='Manoeuvre'?'Go to Pilot':view.phase==='Attack'?'Go to Gunnery':'Go to Crew Actions'}</button>`;

  root.innerHTML='<h3 class="workflow-action-title" tabindex="-1">'+view.step+'</h3>';
  if(state.completedCombats?.length)root.innerHTML+='<button type="button" data-workflow="report">After-action reports</button>';
  if(state.combatHistory?.length)root.innerHTML+='<button type="button" data-workflow="results">Review saved results</button>';
  const current=state.ships.find(s=>s.id===getSelected());if(current?.combatDamage?.pending.length)root.innerHTML+='<p role="status">'+current.combatDamage.pending.length+' critical effects require GM handling on '+esc(current.name)+'. Apply required manual changes before confirming.</p><label>Manual critical handling note<input data-critical-note maxlength="300"></label><button type="button" data-workflow="critical-handled">GM · Confirm critical effects handled</button>';
  if(battle)root.innerHTML+='<button type="button" data-workflow="crew">Crew Actions / saved duties</button>';
  if(battle)root.innerHTML+='<button type="button" data-workflow="missiles" '+(locked?'disabled':'')+'>Missiles · Sensors</button>';
  const auxiliary=root.innerHTML.slice(root.innerHTML.indexOf('</h3>')+5);root.innerHTML='<h3 class="workflow-action-title" tabindex="-1">'+view.step+'</h3>';
  if(!battle){root.innerHTML+=`<div class="actions"><button type="button" data-workflow="initiative" ${locked?'disabled':''}>Captain · Initiative</button><button type="button" data-workflow="start" ${locked||!ready||state.acceleration?'disabled':''}>GM · Confirm Initiative</button></div><p class="help">Captain rolls only on request: 2D + Pilot skill + Thrust + naval Tactics Effect. Confirm the recorded order to begin Pilot movement. ${ready?'Recorded values are ready to confirm.':'Record every ship’s initiative first.'}</p>${state.ships.some(initiativeInputsChanged)?'<p role="alert">Crew or thrust changed after a recorded roll. Review Captain initiative before confirming; recorded totals have not changed.</p>':''}${ready?'<ol aria-label="Recorded initiative order">'+[...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||a.id.localeCompare(b.id)).map(s=>'<li>'+esc(s.name)+' · '+s.flight.initiative+'</li>').join('')+'</ol>':''}`;root.innerHTML+=auxiliary;compact();return;}
  const name=id=>esc(state.ships.find(s=>s.id===id)?.name??'');
  if(phase==='thrust')root.innerHTML+=`<p>Lowest initiative first · ${name(next)} next. ${state.acceleration.declared.length}/${state.ships.length} plots committed.</p><div class="actions">${next!==getSelected()?'<button type="button" data-workflow="select">Select next ship</button>':''}<button type="button" data-workflow="plot" ${locked||next!==getSelected()?'disabled':''}>Commit Plot &amp; Next</button><button type="button" data-workflow="pilot">Pilot controls</button></div>`;
  if(phase==='movement')root.innerHTML+=`<p>All plots ready. Positions remain pending; ships move together.</p><button type="button" data-workflow="move" ${locked?'disabled':''}>GM · Move All Ships</button>`;
  if(phase==='attacks'){
   const next=nextGunner(state),g=battle.gunnery,record=state.combatHistory?.find(r=>r.id===battle.resolutionId),needsDirect=(directFireQueue(state).length+missileQueue(state).length+arrivals(state).length)>0&&!record,impactRecord=state.missileCombat?.impacts.find(r=>r.round===state.round),needsImpact=!!record&&arrivals(state).length>0&&!impactRecord,manual=!!record&&((record.pending??[]).some(r=>r.action==='attack')||record.results.some(r=>r.status==='manual')||impactRecord?.results.some(r=>r.status==='manual'));
   const warnings=!next&&!record?directFirePreview(state).filter(x=>x.profile.status==='manual'):[];
   root.innerHTML+=`${warnings.length?'<ul aria-label="Manual attack requirements">'+warnings.map(x=>'<li>'+name(x.entry.shipId)+' · '+esc(x.entry.mountId)+': '+esc(x.profile.issues.join(' '))+'</li>').join('')+'</ul>':''}<p>${next?'Declare · '+name(next)+' next · '+g.declarations.length+'/'+g.order.length+' ships committed.':record?'Attacks and launches recorded. Resolve arriving missiles last; review any manual cases.':'Declarations locked. Resolve eligible attacks and launches highest initiative first.'}</p><button type="button" data-workflow="gunnery">${next?'Declare next ship':'Review declarations'}</button>${g.declarations.length?'<ul aria-label="Committed declarations">'+g.declarations.map(d=>'<li>'+name(d.shipId)+': '+d.mounts.map(m=>esc(m.action)+(m.weapon?' '+esc(m.weapon):'')+(m.targetId?' → '+name(m.targetId):'')).join('; ')+'</li>').join('')+'</ul>':''}${!next&&needsDirect?'<button type="button" data-workflow="resolve" '+(locked?'disabled':'')+'>Resolve attacks & launches</button>':''}${!next&&needsImpact?'<button type="button" data-workflow="impacts" '+(locked?'disabled':'')+'>Resolve missile impacts · last attacks</button>':''}${!next&&manual?'<p>Unsupported attacks remain pending; resolve those explicitly by hand.</p><label>GM manual attack resolution note<input data-manual-attacks maxlength="300" placeholder="Only after handling remaining attacks manually"></label>':''}<button type="button" data-workflow="next" data-phase="${phase}" ${locked||next||needsDirect||needsImpact?'disabled':''}>GM · Attacks Complete</button>`;
  }

  if(phase==='crew')root.innerHTML+=`<p>Choose a station action, review its saved result, then end the round.</p><button type="button" data-workflow="round-review" ${locked?'disabled':''}>GM · End Round</button>`;
  root.innerHTML+=`${auxiliary}<button type="button" data-workflow="end-combat" ${locked?'disabled':''}>End Combat…</button><details><summary>Review / leave workflow</summary>${['thrust','movement'].includes(phase)?`<button type="button" data-workflow="reopen" ${locked?'disabled':''}>Reopen plots · keep plans</button>`:''}<button type="button" data-workflow="leave" ${locked||phase==='attacks'&&battle.gunnery.declarations.length&&nextGunner(state)?'disabled':''}>Leave workflow · keep records</button><p class="help">Leaving preserves initiative, positions, vectors and reservations. It does not undo committed movement. All stations remain accessible. This is the referee view; no automatic detection is inferred.</p></details>`;
  compact();
 }
 root.addEventListener('click',event=>{const button=event.target.closest('[data-workflow]'),action=button?.dataset.workflow;if(!action||!root.contains(button)||button.disabled||isLocked()||event.detail>1)return;const state=getState();
  if(action==='round-review'){onRoundReview();return;}if(action==='end-combat'){onEndCombat();return;}if(action==='report'){onReport();return;}
  if(action==='crew'){onCrew();return;}
  if(action==='results'){onResults();return;}
  if(action==='missiles'){onMissiles();return;}if(action==='impacts'){onImpacts();return;}
  if(action==='resolve'){onResolve();return;}
  if(action==='critical-handled'){dispatch({type:'acknowledge-critical-effects',shipId:getSelected(),note:root.querySelector('[data-critical-note]')?.value??''},'Manual critical handling recorded; severity history retained.');return;}
  if(action==='initiative'){onInitiative();return;}
  if(['pilot','gunnery'].includes(action)){if(action==='gunnery'&&nextGunner(state))onSelect(nextGunner(state));onStation(action);return;}
  if(action==='select'){onSelect(state.acceleration.order[state.acceleration.declared.length]);return;}
  const command={start:{type:'start-battle'},plot:{type:'declare-acceleration',shipId:getSelected()},move:{type:'advance-round'},next:{type:'next-battle-phase',phase:button.dataset.phase,manualNote:root.querySelector('[data-manual-attacks]')?.value},reopen:{type:'cancel-acceleration'},leave:{type:'leave-battle'}}[action];
  if(command&&dispatch(command,'Workflow updated. Recorded resolution is retained.')){if(action==='reopen'){onSelect(getState().acceleration.order[0]);onStation('pilot');}if(action==='move'){if(nextGunner(getState()))onSelect(nextGunner(getState()));onStation('gunnery');}if(action==='next'&&getState().workflow?.phase==='thrust'){onSelect(getState().acceleration.order[0]);onStation('pilot');}if(action==='next'&&getState().workflow?.phase==='crew')onStation('captain');if(action==='plot'){const pending=getState().acceleration;const next=pending?.order[pending.declared.length];if(next)onSelect(next);onStation('pilot');}if(action==='start'){onSelect(getState().acceleration.order[0]);onStation('pilot');}root.querySelector('.workflow-action-title')?.focus({preventScroll:true});}
 });
 return {render,place,refreshLock:()=>{if(lastLocked!==isLocked())render();}};
}
