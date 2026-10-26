import {availableThrust,plannedTarget,coastTarget,hexDistance} from './engine.mjs';
import {STATIONS} from './console-layout.mjs';
import {effectiveDesign,crewContribution,crewSkill} from './setup.mjs';
import {beginSystemsDraft,commitSystemsDraft} from './systems-draft.mjs';
import {powerReport,systemProfile} from './systems.mjs';
import {stationPowerRows,setStationSystem} from './station-power.mjs';
import {escapeHTML as esc,shown,sourceLabel,signed} from './ui-format.mjs';

export function createStationPane({getState,getSelected,isLocked,onCommit,onSelect,onRefresh,onDetails,onCondition,onAdvanced,onRoleChange=()=>{}}){
 const $=id=>document.getElementById(id),root=$('station-pane'),content=$('station-records'),pilot=$('selected-controls');
 let station='pilot',draft=null,error='';
 const selected=()=>getState().ships.find(s=>s.id===getSelected());
 function render(){
  const ship=selected(),own=draft?.shipId===ship?.id,locked=isLocked();
  root.dataset.station=station;$('station-pane-title').textContent=STATIONS.find(([id])=>id===station)[1]+(ship?' — '+ship.name:'');
  document.querySelectorAll('[data-console-station]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.consoleStation===station)));
  $('drive-status').hidden=station!=='pilot'||!ship;pilot.hidden=station!=='pilot'||!ship;$('round-planning').hidden=station!=='pilot'||!ship;
  $('station-pending').innerHTML=draft?`<p>Pending Engineer changes for ${esc(draft.name)}. ${own?'':'Select that ship to continue.'}</p><button type="button" data-station-return>Return to Engineer draft</button> <button type="button" data-station-cancel>Cancel Engineer changes</button>`:'';
  if(!ship){content.innerHTML='<p>Select or add a ship.</p>';return;}
  const design=effectiveDesign(ship),r=design?.record??{};
  const crewSummary=role=>{const skill=crewSkill(ship.crew,role),d=skill==null?null:ship.crew.details[role],total=crewContribution(ship.crew,role);return `<div class="station-crew-summary"><div><strong>${esc(d?.name|| (d?'Unnamed crew':ship.crew.mode==='detailed'?'Unassigned':'Ship rating / total override'))} · ${role==='pilot'?'Pilot':'Engineer'}</strong><p>${skill==null?'Actual skill unrecorded':`Skill ${skill} + Other ${d.characteristicDM}`}</p></div><span class="station-total">Total ${esc(signed(total))}</span></div>`;};
  if(station==='pilot'){
   const budget=availableThrust(ship),used=hexDistance(ship.motion.impulse),target=plannedTarget(ship),coast=coastTarget(ship),pos=ship.motion.position;
   const pts=[pos,coast,target].map(p=>({x:p.q+p.r/2,y:p.r*Math.sqrt(3)/2})),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),scale=Math.min(240/Math.max(1,Math.max(...xs)-Math.min(...xs)),40/Math.max(1,Math.max(...ys)-Math.min(...ys))),xy=p=>`${30+(p.x-Math.min(...xs))*scale},${16+(p.y-Math.min(...ys))*scale}`;
   const state=getState(),phase=state.acceleration,next=phase?.order[phase.declared.length],declaring=!!next,commitId=declaring?'declare-acceleration':'advance',canCommit=declaring?next===ship.id&&!locked:!$('advance').disabled&&!locked;
   content.innerHTML=crewSummary('pilot')+`<div class="pilot-thrust"><strong>Available thrust ${budget}</strong><p>${used} of ${budget} used · ${budget-used} remaining after reservations</p><progress aria-label="Plotted thrust" max="${Math.max(1,budget)}" value="${used}"></progress></div><div class="pilot-preview"><strong>Plotted move</strong><svg viewBox="0 0 300 72" role="img" aria-label="Planned movement from Q ${pos.q}, R ${pos.r} to Q ${target.q}, R ${target.r}"><path d="M 15 16 H 285 M 15 36 H 285 M 15 56 H 285" stroke="#244555"/><polyline points="${xy(pts[0])} ${xy(pts[2])}" fill="none" stroke="#7ed6df" stroke-width="2"/><circle cx="${xy(pts[1]).split(',')[0]}" cy="${xy(pts[1]).split(',')[1]}" r="5" fill="none" stroke="#b2c9d7"/><circle cx="${xy(pts[0]).split(',')[0]}" cy="${xy(pts[0]).split(',')[1]}" r="4" fill="#d7eaf4"/><circle cx="${xy(pts[2]).split(',')[0]}" cy="${xy(pts[2]).split(',')[1]}" r="4" fill="#7ed6df"/></svg><p>Next Q/R: ${target.q}, ${target.r} · ${ship.flight.braking?'Continuing stop':used?'Planned acceleration':'Coasting'}</p><p class="help">${declaring?'Commit declares this ship; all ships move together after declarations.':'Commit resolves one round for all ships; unplotted ships coast.'}</p></div><div class="pilot-actions"><button type="button" data-pilot-commit="${commitId}" ${canCommit?'':'disabled'}>Commit Move</button><button type="button" data-pilot-action="coast">Coast</button><button type="button" data-pilot-action="brake">Stop</button></div><p class="help">Stop applies available thrust each round until stopped. It may take several rounds. Plot a new target or Coast to cancel.</p>`;
   content.querySelectorAll('[data-pilot-action]').forEach(e=>e.disabled=$(e.dataset.pilotAction).disabled||locked);return;
  }
  if(station==='engineer'){
   const systems=own?draft.systems:ship.systems,p=powerReport(ship,systems),allocation=powerReport(ship,{...systems,mode:'allocated'}),rows=stationPowerRows(ship,systems),disabled=locked||!!draft&&!own;
   content.innerHTML=crewSummary('engineer')+`<p>Switches record operating allocation only. Changes stay pending until Apply Changes. No firing, damage or shutdown is automated.</p><div class="engineer-totals"><div>Available output <strong>${esc(shown(p.output))}</strong></div><div>Used (${systems.mode==='manual'?'manual':'allocation'}) <strong>${esc(shown(p.used))}</strong></div><div>Known subtotal <strong>${esc(p.exactKnownSubtotal)}</strong></div><div>Remaining <strong>${esc(shown(p.remaining))}</strong></div></div><p class="help">Calculated allocation: ${esc(shown(p.total))}; allocation remaining: ${esc(allocation.exactRemaining??'Unknown')}. Saved manual used Power: ${esc(shown(ship.condition.powerUsed))}. Display source: ${systems.mode==='manual'?'saved manual value':'calculated allocation'}. Selected remaining: ${esc(shown(p.remaining))}. Switches do not overwrite the saved manual value.</p><div class="engineer-rows">${rows.map(row=>`<section class="engineer-row"><div><strong>${esc(row.name)}</strong><p>${row.fullBasic?'Full draw':'Draw when on'}: ${esc(shown(row.draw))} Power</p><details><summary>Source / basis</summary><p>${esc(row.source?row.source.book+', p. '+row.source.page:'Manual / unverified reference')}. ${esc(row.note)}</p></details></div>${row.fullBasic?`<label>Basic level<select data-station-system="basic" ${disabled?'disabled':''}>${[[0,'Off'],[50,'Half'],[100,'Full']].map(([v,l])=>`<option value="${v}" ${row.value===v?'selected':''}>${l}</option>`).join('')}</select></label>`:`<label class="station-switch"><input type="checkbox" role="switch" data-station-system="${esc(row.key)}" aria-label="${esc(row.name)} operating allocation" ${row.value?'checked':''} ${disabled?'disabled':''}><span>${row.value?'On':'Off'}</span></label>`}</section>`).join('')}</div>${p.unknown.length?`<p class="systems-warning">Unverified: ${esc(p.unknown.join('; '))}. Known subtotal is not a verified total.</p>`:''}${systemProfile(design).unknownFit.length?`<p>Unverified installation: ${esc(systemProfile(design).unknownFit.join('; '))}. Record a verified fit in advanced systems first.</p>`:''}${p.warnings.map(w=>`<p class="systems-warning">${esc(w)}</p>`).join('')}<p id="station-error" role="alert">${esc(error)}</p><div class="actions"><button type="button" data-station-commit ${!own||locked?'disabled':''}>Apply Changes</button><button type="button" data-station-cancel ${!own?'disabled':''}>Cancel</button><button type="button" data-station-advanced ${draft||locked?'disabled':''}>Advanced systems / software</button></div>`;
   return;
  }
  const crewRole={captain:'captain',comms:'sensors',astrogator:'astrogator',damage:'engineer',gunnery:'gunner',sensors:'sensors'}[station];
  const crew=crewSkill(ship.crew,crewRole)==null?null:ship.crew.details?.[crewRole];
  let text='';
  if(station==='captain')text=`<p>Side ${esc(ship.appearance.side)} · Allegiance: ${esc(ship.identity.allegiance||'Unrecorded')}</p><p>Command checks are not implemented.</p>`;
  if(station==='comms')text='<p>Communications actions and transmissions are not implemented.</p>';
  if(station==='astrogator')text=`<p>Recorded jump rating: ${esc(shown(r.jump))}</p><p>Jump plotting and astrogation checks are not implemented.</p>`;
  if(station==='damage')text=`<p>Current hull: ${esc(shown(ship.condition.hull))} · Design hull: ${esc(shown(design?.hull))}</p><p>Condition and criticals are manual records. No damage or repair rolls are implemented.</p><button type="button" data-station-condition>Condition / criticals</button>`;
  if(station==='sensors')text=`<p>Recorded sensors: ${esc(r.sensors??'Unknown')}</p><p>Detection and sensor checks are not implemented.</p>`;
  if(station==='gunnery')text=`<ul>${r.weapons==null?'<li>Weapon fit unknown / untranscribed.</li>':r.weapons.length?r.weapons.map(w=>`<li>${esc(w.name)}: ${w.count} × ${esc(w.type)}; initial ammunition ${esc(shown(w.ammunition))}</li>`).join(''):'<li>Explicitly unarmed.</li>'}</ul><p>Firing and damage are not implemented.</p>`;
  content.innerHTML=`${text}${station!=='comms'?`<p>Crew: ${esc(crew?.name||'No individual name recorded')} · contribution ${esc(signed(crewContribution(ship.crew,crewRole)))}</p>`:''}<p class="help">${esc(sourceLabel(ship.template))}</p><button type="button" data-station-details>Ship details / crew</button>`;
 }
 function choose(id){if(!STATIONS.some(([key])=>key===id))return;onRoleChange();station=id;render();if(innerWidth>700){const pane=$('combat-right');pane.scrollTop+=root.getBoundingClientRect().top-pane.getBoundingClientRect().top;}$('station-pane-title').focus({preventScroll:true});}
 root.addEventListener('change',e=>{const key=e.target.dataset.stationSystem;if(!key)return;if(isLocked()||draft&&draft.shipId!==getSelected())return;try{draft??=beginSystemsDraft(getState(),getSelected());draft.systems=setStationSystem(draft.systems,key,key==='basic'?Number(e.target.value):e.target.checked);error='';onRefresh();root.querySelector(`[data-station-system="${key}"]`)?.focus({preventScroll:true});}catch(err){error=err.message;render();}});
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-station-cancel')){draft=null;error='';onRefresh();}
  if(b.hasAttribute('data-station-return')){onSelect(draft.shipId);choose('engineer');}
  if(b.hasAttribute('data-station-commit')){try{if(isLocked())throw Error('Finish the other editor first.');const next=commitSystemsDraft(getState(),draft,getSelected());onCommit(next);draft=null;error='';onRefresh();}catch(err){error=err.message+' Nothing was committed.';render();}}
  if(b.dataset.pilotAction)$(b.dataset.pilotAction).click();
  if(b.dataset.pilotCommit)$(b.dataset.pilotCommit)?.click();
  if(b.hasAttribute('data-station-details'))onDetails();if(b.hasAttribute('data-station-condition'))onCondition();if(b.hasAttribute('data-station-advanced'))onAdvanced();
 });
 return {render,choose,hasDraft:()=>!!draft,clear:()=>{draft=null;error='';station='pilot';render();}};
}
