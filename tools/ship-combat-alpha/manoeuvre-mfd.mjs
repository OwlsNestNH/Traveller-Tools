import {availableThrust,hexDistance,plannedTarget,coastTarget} from './engine.mjs';
import {escapeHTML as esc} from './ui-format.mjs';

// This view only presents existing commands; the engine remains authoritative.
export function renderManoeuvre({state,ship,locked,preview}){
 const phase=state.workflow?.phase, next=state.acceleration?.order[state.acceleration.declared.length], canPlan=phase==='thrust'&&next===ship?.id&&!locked;
 const move=phase==='movement'&&!locked, present=!!ship;
 const button=(action,label,enabled,extra='')=>`<button type="button" data-manoeuvre="${action}" ${enabled?'':'disabled'} ${extra}>${label}</button>`;
 const actions=`<div class="manoeuvre-action-row">${button('plot','Plot',canPlan,'aria-pressed="true"')}${button('coast','Coast',canPlan)}${button('brake','Brake to Stop',canPlan)}${button('reserve','Reserve Thrust',canPlan)}${button('gunners','Aid Gunners',canPlan)}${move?button('move','GM · Move All Ships',true):button('commit','Commit Plot &amp; Next Ship',canPlan)}</div>`;
 if(!present)return {actions,content:'<h2>Manoeuvre</h2><p>Select a ship to inspect movement.</p>'};
 const used=hexDistance(ship.motion.impulse), reserved=ship.flight.evasion+ship.flight.gunners,target=plannedTarget(ship),coast=coastTarget(ship),nextShip=state.ships.find(s=>s.id===next);
 return {actions,content:`<h2>Manoeuvre — ${esc(ship.name)}</h2>${phase==='thrust'?`<p>Plot lowest initiative first · ${esc(nextShip?.name??'No ship')} next · ${state.acceleration.declared.length}/${state.ships.length} committed.</p>`:phase==='movement'?'<p>All plots committed; awaiting the GM.</p>':'<p>Read-only inspection. Confirm Opening to begin plotting.</p>'}<div class="manoeuvre-preview"><div>${preview(ship)}<p>Current ${ship.motion.position.q}, ${ship.motion.position.r} · Coast ${coast.q}, ${coast.r} · Planned ${target.q}, ${target.r}</p><p>${ship.flight.braking?'Braking continues each round':used?'Acceleration plotted':'Coasting'}</p></div><dl><div><dt>Thrust available</dt><dd>${availableThrust(ship)}</dd></div><div><dt>Thrust used</dt><dd>${used}</dd></div><div><dt>Reserved</dt><dd>${reserved}</dd><small>Evade ${ship.flight.evasion} · Aid Gunners ${ship.flight.gunners}</small></div></dl></div><p class="manoeuvre-note">All ships move together only after all plots are committed and the GM chooses Move All Ships.</p>`};
}
