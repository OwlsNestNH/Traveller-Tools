import {missileQueue} from './missiles.mjs';
import {arrivals} from './missile-impact.mjs';
import {directFirePreview} from './direct-fire-resolution.mjs';
import {directFireQueue,unresolvedDeclarations} from './direct-fire-profile.mjs';
import {nextGunner} from './gunnery.mjs';
import {initiativeInputsChanged} from './initiative.mjs';
import {PHASES,PHASE_LABELS,workflowRound} from './workflow.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
export function createWorkflowControls({root,getState,getSelected,isLocked,dispatch,onSelect,onStation,onInitiative,onResolve,onResults,onMissiles,onImpacts}){
 let lastLocked=null;
 function render(){
  const state=getState(),battle=state.workflow,locked=isLocked(),next=state.acceleration?.order[state.acceleration.declared.length],ready=state.ships.length&&state.ships.every(s=>s.flight.initiative!=null),phase=battle?.phase;
  lastLocked=locked;
  root.innerHTML=`<h2>Battle workflow</h2><ol class="workflow-phases" aria-label="Battle phases">${PHASES.map(p=>`<li ${phase===p?'aria-current="step"':''}>${PHASE_LABELS[p]}</li>`).join('')}</ol><p role="status">${battle?`Round ${workflowRound(state)} · ${PHASE_LABELS[phase]}`:'Setup · confirm initiative once per battle'}</p>`;
  if(state.combatHistory?.length)root.innerHTML+='<button type="button" data-workflow="results">Review saved results</button>';
  const current=state.ships.find(s=>s.id===getSelected());if(current?.combatDamage?.pending.length)root.innerHTML+='<p role="status">'+current.combatDamage.pending.length+' critical effects require GM handling on '+esc(current.name)+'. Apply required manual changes before confirming.</p><label>Manual critical handling note<input data-critical-note maxlength="300"></label><button type="button" data-workflow="critical-handled">GM · Confirm critical effects handled</button>';
  if(battle)root.innerHTML+='<button type="button" data-workflow="missiles" '+(locked?'disabled':'')+'>Missiles · Sensors</button>';
  if(!battle){root.innerHTML+=`<div class="actions"><button type="button" data-workflow="initiative" ${locked?'disabled':''}>Captain · Initiative</button><button type="button" data-workflow="start" ${locked||!ready||state.acceleration?'disabled':''}>GM · Confirm Initiative</button></div><p class="help">Captain rolls only on request: 2D + Pilot skill + Thrust + naval Tactics Effect. Confirm the recorded order to begin Pilot movement. ${ready?'Recorded values are ready to confirm.':'Record every ship’s initiative first.'}</p>${state.ships.some(initiativeInputsChanged)?'<p role="alert">Crew or thrust changed after a recorded roll. Review Captain initiative before confirming; recorded totals have not changed.</p>':''}${ready?'<ol aria-label="Recorded initiative order">'+[...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||a.id.localeCompare(b.id)).map(s=>'<li>'+esc(s.name)+' · '+s.flight.initiative+'</li>').join('')+'</ol>':''}`;return;}
  const name=id=>esc(state.ships.find(s=>s.id===id)?.name??'');
  if(phase==='thrust')root.innerHTML+=`<p>Lowest initiative first · ${name(next)} next. ${state.acceleration.declared.length}/${state.ships.length} plots committed.</p><div class="actions">${next!==getSelected()?'<button type="button" data-workflow="select">Select next ship</button>':''}<button type="button" data-workflow="plot" ${locked||next!==getSelected()?'disabled':''}>GM · Commit Plot</button><button type="button" data-workflow="pilot">Pilot controls</button></div>`;
  if(phase==='movement')root.innerHTML+=`<p>All plots ready. Positions remain pending; ships move together.</p><button type="button" data-workflow="move" ${locked?'disabled':''}>GM · Move All Ships</button>`;
  if(phase==='attacks'){
   const next=nextGunner(state),g=battle.gunnery,record=state.combatHistory?.find(r=>r.id===battle.resolutionId),needsDirect=(directFireQueue(state).length+missileQueue(state).length+arrivals(state).length)>0&&!record,impactRecord=state.missileCombat?.impacts.find(r=>r.round===state.round),needsImpact=!!record&&arrivals(state).length>0&&!impactRecord,manual=!!record&&((record.pending??[]).some(r=>r.action==='attack')||record.results.some(r=>r.status==='manual')||impactRecord?.results.some(r=>r.status==='manual'));
   const warnings=!next&&!record?directFirePreview(state).filter(x=>x.profile.status==='manual'):[];
   root.innerHTML+=`${warnings.length?'<ul aria-label="Manual attack requirements">'+warnings.map(x=>'<li>'+name(x.entry.shipId)+' · '+esc(x.entry.mountId)+': '+esc(x.profile.issues.join(' '))+'</li>').join('')+'</ul>':''}<p>${next?'Declare · '+name(next)+' next · '+g.declarations.length+'/'+g.order.length+' ships committed.':record?'Attacks and launches recorded. Resolve arriving missiles last; review any manual cases.':'Declarations locked. Resolve eligible attacks and launches highest initiative first.'}</p><button type="button" data-workflow="gunnery">${next?'Declare next ship':'Review declarations'}</button>${g.declarations.length?'<ul aria-label="Committed declarations">'+g.declarations.map(d=>'<li>'+name(d.shipId)+': '+d.mounts.map(m=>esc(m.action)+(m.weapon?' '+esc(m.weapon):'')+(m.targetId?' → '+name(m.targetId):'')).join('; ')+'</li>').join('')+'</ul>':''}${!next&&needsDirect?'<button type="button" data-workflow="resolve" '+(locked?'disabled':'')+'>Resolve attacks & launches</button>':''}${!next&&needsImpact?'<button type="button" data-workflow="impacts" '+(locked?'disabled':'')+'>Resolve missile impacts · last attacks</button>':''}${!next&&manual?'<p>Unsupported attacks remain pending; resolve those explicitly by hand.</p><label>GM manual attack resolution note<input data-manual-attacks maxlength="300" placeholder="Only after handling remaining attacks manually"></label>':''}<button type="button" data-workflow="next" data-phase="${phase}" ${locked||next||needsDirect||needsImpact?'disabled':''}>GM · Attacks Complete</button>`;
  }

  if(phase==='crew')root.innerHTML+=`<p>Use Missiles · Sensors for electronic warfare. Other crew actions remain manual.</p><button type="button" data-workflow="next" data-phase="${phase}" ${locked?'disabled':''}>GM · End Round</button>`;
  root.innerHTML+=`<details><summary>Review / leave workflow</summary>${['thrust','movement'].includes(phase)?`<button type="button" data-workflow="reopen" ${locked?'disabled':''}>Reopen plots · keep plans</button>`:''}<button type="button" data-workflow="leave" ${locked||phase==='attacks'&&battle.gunnery.declarations.length&&nextGunner(state)?'disabled':''}>Leave workflow · keep records</button><p class="help">Leaving preserves initiative, positions, vectors and reservations. It does not undo committed movement. All stations remain accessible. This is the referee view; no automatic detection is inferred.</p></details>`;
 }
 root.addEventListener('click',event=>{const button=event.target.closest('[data-workflow]'),action=button?.dataset.workflow;if(!action||isLocked()||event.detail>1)return;const state=getState();
  if(action==='results'){onResults();return;}
  if(action==='missiles'){onMissiles();return;}if(action==='impacts'){onImpacts();return;}
  if(action==='resolve'){onResolve();return;}
  if(action==='critical-handled'){dispatch({type:'acknowledge-critical-effects',shipId:getSelected(),note:root.querySelector('[data-critical-note]')?.value??''},'Manual critical handling recorded; severity history retained.');return;}
  if(action==='initiative'){onInitiative();return;}
  if(['pilot','gunnery'].includes(action)){if(action==='gunnery'&&nextGunner(state))onSelect(nextGunner(state));onStation(action);return;}
  if(action==='select'){onSelect(state.acceleration.order[state.acceleration.declared.length]);return;}
  const command={start:{type:'start-battle'},plot:{type:'declare-acceleration',shipId:getSelected()},move:{type:'advance-round'},next:{type:'next-battle-phase',phase:button.dataset.phase,manualNote:root.querySelector('[data-manual-attacks]')?.value},reopen:{type:'cancel-acceleration'},leave:{type:'leave-battle'}}[action];
  if(command&&dispatch(command,'Workflow updated. Recorded resolution is retained.')){if(action==='move'){if(nextGunner(getState()))onSelect(nextGunner(getState()));onStation('gunnery');}if(action==='start'){onSelect(getState().acceleration.order[0]);onStation('pilot');}root.querySelector('[data-workflow]:not(:disabled)')?.focus({preventScroll:true});}
 });
 return {render,refreshLock:()=>{if(lastLocked!==isLocked())render();}};
}
