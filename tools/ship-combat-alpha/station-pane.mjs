import {STATIONS} from './console-layout.mjs';
import {effectiveDesign,crewContribution} from './setup.mjs';
import {beginSystemsDraft,commitSystemsDraft} from './systems-draft.mjs';
import {powerReport,systemProfile} from './systems.mjs';
import {stationPowerRows,setStationSystem} from './station-power.mjs';
import {escapeHTML as esc,shown,sourceLabel,signed} from './ui-format.mjs';

export function createStationPane({getState,getSelected,isLocked,onCommit,onSelect,onRefresh,onDetails,onCondition,onAdvanced}){
 const $=id=>document.getElementById(id),root=$('station-pane'),content=$('station-records'),pilot=$('selected-controls');
 let station='pilot',draft=null,error='';
 const selected=()=>getState().ships.find(s=>s.id===getSelected());
 function render(){
  const ship=selected(),own=draft?.shipId===ship?.id,locked=isLocked();
  root.dataset.station=station;$('station-pane-title').textContent=STATIONS.find(([id])=>id===station)[1]+(ship?' — '+ship.name:'');
  document.querySelectorAll('[data-console-station]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.consoleStation===station)));
  pilot.hidden=station!=='pilot'||!ship;$('round-planning').hidden=station!=='pilot'||!ship;
  $('station-pending').innerHTML=draft?`<p>Pending Engineer changes for ${esc(draft.name)}. ${own?'':'Select that ship to continue.'}</p><button type="button" data-station-return>Return to Engineer draft</button> <button type="button" data-station-cancel>Cancel Engineer changes</button>`:'';
  if(!ship){content.innerHTML='<p>Select or add a ship.</p>';return;}
  const design=effectiveDesign(ship),r=design?.record??{};
  if(station==='pilot'){content.innerHTML='<p>Click or tap a reachable map hex to plot the next round. Drag to pan. Unplotted ships coast.</p><div class="actions"><button type="button" data-pilot-action="coast">Coast selected ship</button><button type="button" data-pilot-action="brake">Continue braking</button></div>';content.querySelectorAll('[data-pilot-action]').forEach(e=>e.disabled=$(e.dataset.pilotAction).disabled);return;}
  if(station==='engineer'){
   const systems=own?draft.systems:ship.systems,p=powerReport(ship,systems),allocation=powerReport(ship,{...systems,mode:'allocated'}),rows=stationPowerRows(ship,systems),disabled=locked||!!draft&&!own;
   content.innerHTML=`<p>Switches record operating allocation only. Changes stay pending until Commit. No firing, damage or shutdown is automated.</p><div class="engineer-totals"><div>Current output <strong>${esc(shown(p.output))}</strong></div><div>Calculated allocation <strong>${esc(shown(p.total))}</strong></div><div>Known subtotal <strong>${esc(p.exactKnownSubtotal)}</strong></div><div>Allocation remaining <strong>${esc(allocation.exactRemaining??'Unknown')}</strong></div></div><p class="help">Saved manual used Power: ${esc(shown(ship.condition.powerUsed))}. Display source: ${systems.mode==='manual'?'saved manual value':'calculated allocation'}. Selected remaining: ${esc(shown(p.remaining))}. Switches do not overwrite the saved manual value.</p><div class="engineer-rows">${rows.map(row=>`<section class="engineer-row"><div><strong>${esc(row.name)}</strong><p>${row.fullBasic?'Full draw':'Draw when on'}: ${esc(shown(row.draw))} Power</p><details><summary>Source / basis</summary><p>${esc(row.source?row.source.book+', p. '+row.source.page:'Manual / unverified reference')}. ${esc(row.note)}</p></details></div>${row.fullBasic?`<label>Basic level<select data-station-system="basic" ${disabled?'disabled':''}>${[[0,'Off'],[50,'50%'],[100,'Full']].map(([v,l])=>`<option value="${v}" ${row.value===v?'selected':''}>${l}</option>`).join('')}</select></label>`:`<label class="station-switch"><input type="checkbox" role="switch" data-station-system="${esc(row.key)}" aria-label="${esc(row.name)} operating allocation" ${row.value?'checked':''} ${disabled?'disabled':''}><span>${row.value?'On':'Off'}</span></label>`}</section>`).join('')}</div>${p.unknown.length?`<p class="systems-warning">Unverified: ${esc(p.unknown.join('; '))}. Known subtotal is not a verified total.</p>`:''}${systemProfile(design).unknownFit.length?`<p>Unverified installation: ${esc(systemProfile(design).unknownFit.join('; '))}. Record a verified fit in advanced systems first.</p>`:''}${p.warnings.map(w=>`<p class="systems-warning">${esc(w)}</p>`).join('')}<p id="station-error" role="alert">${esc(error)}</p><div class="actions"><button type="button" data-station-commit ${!own||locked?'disabled':''}>Commit systems</button><button type="button" data-station-cancel ${!own?'disabled':''}>Cancel</button><button type="button" data-station-advanced ${draft||locked?'disabled':''}>Advanced systems / software</button></div>`;
   return;
  }
  const crewRole={captain:'captain',comms:'sensors',astrogator:'astrogator',damage:'engineer',gunnery:'gunner',sensors:'sensors'}[station];
  const crew=ship.crew.details?.[crewRole];
  let text='';
  if(station==='captain')text=`<p>Side ${esc(ship.appearance.side)} · Allegiance: ${esc(ship.identity.allegiance||'Unrecorded')}</p><p>Command checks are not implemented.</p>`;
  if(station==='comms')text='<p>Communications actions and transmissions are not implemented.</p>';
  if(station==='astrogator')text=`<p>Recorded jump rating: ${esc(shown(r.jump))}</p><p>Jump plotting and astrogation checks are not implemented.</p>`;
  if(station==='damage')text=`<p>Current hull: ${esc(shown(ship.condition.hull))} · Design hull: ${esc(shown(design?.hull))}</p><p>Condition and criticals are manual records. No damage or repair rolls are implemented.</p><button type="button" data-station-condition>Condition / criticals</button>`;
  if(station==='sensors')text=`<p>Recorded sensors: ${esc(r.sensors??'Unknown')}</p><p>Detection and sensor checks are not implemented.</p>`;
  if(station==='gunnery')text=`<ul>${r.weapons==null?'<li>Weapon fit unknown / untranscribed.</li>':r.weapons.length?r.weapons.map(w=>`<li>${esc(w.name)}: ${w.count} × ${esc(w.type)}; initial ammunition ${esc(shown(w.ammunition))}</li>`).join(''):'<li>Explicitly unarmed.</li>'}</ul><p>Firing and damage are not implemented.</p>`;
  content.innerHTML=`${text}${station!=='comms'?`<p>Crew: ${esc(crew?.name||'No individual name recorded')} · contribution ${esc(signed(crewContribution(ship.crew,crewRole)))}</p>`:''}<p class="help">${esc(sourceLabel(ship.template))}</p><button type="button" data-station-details>Ship details / crew</button>`;
 }
 function choose(id){if(!STATIONS.some(([key])=>key===id))return;station=id;render();if(innerWidth>700){const pane=$('combat-right');pane.scrollTop+=root.getBoundingClientRect().top-pane.getBoundingClientRect().top;}$('station-pane-title').focus({preventScroll:true});}
 root.addEventListener('change',e=>{const key=e.target.dataset.stationSystem;if(!key)return;if(isLocked()||draft&&draft.shipId!==getSelected())return;try{draft??=beginSystemsDraft(getState(),getSelected());draft.systems=setStationSystem(draft.systems,key,key==='basic'?Number(e.target.value):e.target.checked);error='';onRefresh();root.querySelector(`[data-station-system="${key}"]`)?.focus({preventScroll:true});}catch(err){error=err.message;render();}});
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-station-cancel')){draft=null;error='';onRefresh();}
  if(b.hasAttribute('data-station-return')){onSelect(draft.shipId);choose('engineer');}
  if(b.hasAttribute('data-station-commit')){try{if(isLocked())throw Error('Finish the other editor first.');const next=commitSystemsDraft(getState(),draft,getSelected());onCommit(next);draft=null;error='';onRefresh();}catch(err){error=err.message+' Nothing was committed.';render();}}
  if(b.dataset.pilotAction)$(b.dataset.pilotAction).click();
  if(b.hasAttribute('data-station-details'))onDetails();if(b.hasAttribute('data-station-condition'))onCondition();if(b.hasAttribute('data-station-advanced'))onAdvanced();
 });
 return {render,choose,hasDraft:()=>!!draft,clear:()=>{draft=null;error='';station='pilot';render();}};
}
