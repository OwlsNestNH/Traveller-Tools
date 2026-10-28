import {initiativeInputsChanged} from './initiative.mjs';
import {PHASES,PHASE_LABELS,workflowRound} from './workflow.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
export function createWorkflowControls({root,getState,getSelected,isLocked,dispatch,onSelect,onStation,onInitiative}){
 let lastLocked=null;
 function render(){
  const state=getState(),battle=state.workflow,locked=isLocked(),next=state.acceleration?.order[state.acceleration.declared.length],ready=state.ships.length&&state.ships.every(s=>s.flight.initiative!=null),phase=battle?.phase;
  lastLocked=locked;
  root.innerHTML=`<h2>Battle workflow</h2><ol class="workflow-phases" aria-label="Battle phases">${PHASES.map(p=>`<li ${phase===p?'aria-current="step"':''}>${PHASE_LABELS[p]}</li>`).join('')}</ol><p role="status">${battle?`Round ${workflowRound(state)} · ${PHASE_LABELS[phase]}`:'Setup · confirm initiative once per battle'}</p>`;
  if(!battle){root.innerHTML+=`<div class="actions"><button type="button" data-workflow="initiative" ${locked?'disabled':''}>Captain · Initiative</button><button type="button" data-workflow="start" ${locked||!ready||state.acceleration?'disabled':''}>GM · Confirm Initiative</button></div><p class="help">Captain rolls only on request: 2D + Pilot skill + Thrust + naval Tactics Effect. Confirm the recorded order to begin Pilot movement. ${ready?'Recorded values are ready to confirm.':'Record every ship’s initiative first.'}</p>${state.ships.some(initiativeInputsChanged)?'<p role="alert">Crew or thrust changed after a recorded roll. Review Captain initiative before confirming; recorded totals have not changed.</p>':''}${ready?'<ol aria-label="Recorded initiative order">'+[...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||a.id.localeCompare(b.id)).map(s=>'<li>'+esc(s.name)+' · '+s.flight.initiative+'</li>').join('')+'</ol>':''}`;return;}
  const name=id=>esc(state.ships.find(s=>s.id===id)?.name??'');
  if(phase==='thrust')root.innerHTML+=`<p>Lowest initiative first · ${name(next)} next. ${state.acceleration.declared.length}/${state.ships.length} plots committed.</p><div class="actions">${next!==getSelected()?'<button type="button" data-workflow="select">Select next ship</button>':''}<button type="button" data-workflow="plot" ${locked||next!==getSelected()?'disabled':''}>GM · Commit Plot</button><button type="button" data-workflow="pilot">Pilot controls</button></div>`;
  if(phase==='movement')root.innerHTML+=`<p>All plots ready. Positions remain pending; ships move together.</p><button type="button" data-workflow="move" ${locked?'disabled':''}>GM · Move All Ships</button>`;
  if(phase==='attacks'){const order=[...battle.initiatives].sort((a,b)=>b.initiative-a.initiative||a.tie-b.tie||a.shipId.localeCompare(b.shipId));root.innerHTML+=`<p>Highest initiative first. Resolve attacks manually; this acknowledgement applies no firing or damage.</p><ol>${order.map(e=>`<li>${name(e.shipId)} · ${e.initiative}</li>`).join('')}</ol><button type="button" data-workflow="gunnery">Gunnery</button> <button type="button" data-workflow="next" data-phase="${phase}" ${locked?'disabled':''}>GM · Attacks Complete</button>`;}
  if(phase==='crew')root.innerHTML+=`<p>Resolve crew actions manually, including any next-round effects. No action or effect is automated here.</p><button type="button" data-workflow="next" data-phase="${phase}" ${locked?'disabled':''}>GM · End Round</button>`;
  root.innerHTML+=`<details><summary>Review / leave workflow</summary>${['thrust','movement'].includes(phase)?`<button type="button" data-workflow="reopen" ${locked?'disabled':''}>Reopen plots · keep plans</button>`:''}<button type="button" data-workflow="leave" ${locked?'disabled':''}>Leave workflow · keep records</button><p class="help">Leaving preserves initiative, positions, vectors and reservations. It does not undo committed movement. All stations remain accessible. This is the referee view; no automatic detection is inferred.</p></details>`;
 }
 root.addEventListener('click',event=>{const button=event.target.closest('[data-workflow]'),action=button?.dataset.workflow;if(!action||isLocked()||event.detail>1)return;const state=getState();
  if(action==='initiative'){onInitiative();return;}
  if(['pilot','gunnery'].includes(action)){onStation(action);return;}
  if(action==='select'){onSelect(state.acceleration.order[state.acceleration.declared.length]);return;}
  const command={start:{type:'start-battle'},plot:{type:'declare-acceleration',shipId:getSelected()},move:{type:'advance-round'},next:{type:'next-battle-phase',phase:button.dataset.phase},reopen:{type:'cancel-acceleration'},leave:{type:'leave-battle'}}[action];
  if(command&&dispatch(command,'Workflow updated. No combat effects automated.')){if(action==='start'){onSelect(getState().acceleration.order[0]);onStation('pilot');}root.querySelector('[data-workflow]:not(:disabled)')?.focus({preventScroll:true});}
 });
 return {render,refreshLock:()=>{if(lastLocked!==isLocked())render();}};
}
