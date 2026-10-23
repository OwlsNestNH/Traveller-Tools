import {PRESETS} from './catalogue.mjs';
import {ROLES,MAX_SHIPS,crewContribution} from './setup.mjs';
import {createState,applyCommand,getShip,coastTarget,plannedTarget,hexDistance,reachableCount,canPlot} from './engine.mjs';
import {HEX_SIZE,toWorld,fromWorld,visibleGrid,fitCamera} from './geometry.mjs';
const $=id=>document.getElementById(id),svg=$('map'),scene=$('scene');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#75e0d4','#9dc6ff','#f3c773','#deacff','#f59eac'];
function mapHeight(){return 1200*svg.clientHeight/Math.max(1,svg.clientWidth);}
let state=createState(),selected=state.ships[0].id,camera=fitCamera(state.ships.map(s=>s.motion.position),1200,mapHeight()),drag=null,frame=0;
const selectedShip=()=>getShip(state,selected),pair=p=>`${p.q}, ${p.r}`,number=id=>Number($(id).value),color=s=>colors[state.ships.indexOf(s)%colors.length];
function feedback(text='',error=''){$('message').textContent=text;$('error').textContent=error;}
function dispatch(command,message){try{state=applyCommand(state,{...command,expectedRevision:state.revision});feedback(message);render();return true;}catch(error){feedback('',error.message);return false;}}
function populate(){
 const s=state.ships.find(s=>s.id===selected)??state.ships[0];selected=s?.id??null;
 $('round').textContent='Round '+(state.round+1);$('elapsed').textContent=(state.round*state.roundMinutes)+' minutes elapsed';svg.dataset.completedRounds=state.round;svg.dataset.revision=state.revision;
 $('ships').innerHTML=state.ships.map((ship,i)=>`<button class="ship-choice" data-select="${ship.id}" aria-pressed="${ship.id===selected}"><span class="ship-dot" style="background:${colors[i%colors.length]}" aria-hidden="true"></span><span><strong>${esc(ship.name)}</strong><small>Thrust ${ship.capabilities.thrust} · velocity ${esc(pair(ship.motion.velocity))}</small></span></button>`).join('');
 $('ship-count').textContent=`${state.ships.length} / ${MAX_SHIPS} ships on map`;
 $('selected-controls').hidden=!s;$('empty-encounter').hidden=!!s;
 for(const id of ['remove-ship','clear-ships','advance','fit'])$(id).disabled=!s;
 if(!s)return;
 const m=s.motion,target=plannedTarget(s),cost=hexDistance(m.impulse);
 $('selected-name').textContent=s.name;populateSetup(s);
 const facts=[['Position Q, R',pair(m.position)],['Velocity Q, R',pair(m.velocity)+' hex / round'],['Coast target',pair(coastTarget(s))],['Planned Δv',pair(m.impulse)],['Next position',pair(target)]];
 $('motion-facts').innerHTML=facts.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('');
 $('budget').textContent=`${cost} / ${s.capabilities.thrust} thrust plotted · ${reachableCount(s.capabilities.thrust).toLocaleString()} hexes in the thrust region. Prototype coordinate limits also apply.`;
 $('target-q').value=target.q;$('target-r').value=target.r;
 $('ship-name').value=s.name;$('thrust').value=s.capabilities.thrust;
 for(const axis of ['q','r']){$('position-'+axis).value=m.position[axis];$('velocity-'+axis).value=m.velocity[axis];}
 let ranges=$('range-facts');if(!ranges){const h=document.createElement('h3');h.textContent='Ranges from selected ship';ranges=document.createElement('dl');ranges.id='range-facts';$('motion-facts').after(h,ranges);}
 ranges.innerHTML=state.ships.filter(other=>other.id!==selected).map(other=>`<dt>${esc(other.name)}</dt><dd>${hexDistance(m.position,other.motion.position).toLocaleString()} abstract hex steps</dd>`).join('');
}
function select(id){selected=id;feedback('Selected '+selectedShip().name+'. Plot a target or let it coast.');render();}
function hexPolygon(center,size=HEX_SIZE){return Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return `${center.x+size*Math.cos(angle)},${center.y+size*Math.sin(angle)}`;}).join(' ');}
function drawMap(){
 frame=0;if(!state.ships.length){scene.removeAttribute('transform');scene.innerHTML='<text x="0" y="0" text-anchor="middle" fill="#a6b7c7">Add a ship to begin</text>';$('map-detail').textContent='Empty encounter. No ships have been replaced.';return;}svg.setAttribute('viewBox','-600 '+(-mapHeight()/2)+' 1200 '+mapHeight());const s=selectedShip(),m=s.motion,coast=coastTarget(s),p=toWorld(m.position),c=toWorld(coast),budget=s.capabilities.thrust;
 const unit=1200/Math.max(240,svg.clientWidth),screen=unit/camera.zoom,grid=visibleGrid(camera,1200,mapHeight()),showGrid=$('grid-toggle').checked&&!grid.limited;
 const thin=screen,focusedShip=document.activeElement?.closest?.('[data-ship]')?.dataset.ship;
 let html='';
 if(budget){const vertices=[[budget,0],[budget,-budget],[0,-budget],[-budget,0],[-budget,budget],[0,budget]].map(([q,r])=>toWorld({q:coast.q+q,r:coast.r+r}));html+=`<polygon class="reach-boundary" points="${vertices.map(v=>v.x+','+v.y).join(' ')}" stroke-width="${thin}"/>`;}
 if(showGrid)html+=grid.cells.map(cell=>`<polygon data-q="${cell.q}" data-r="${cell.r}" class="cell ${canPlot(s,cell)?'reach':''}" points="${hexPolygon(toWorld(cell))}" style="stroke-width:${.65*screen}"/>`).join('');
 if($('ranges-toggle').checked)for(const other of state.ships){if(other.id===selected)continue;const o=toWorld(other.motion.position),distance=hexDistance(m.position,other.motion.position);html+=`<line class="range" x1="${p.x}" y1="${p.y}" x2="${o.x}" y2="${o.y}" stroke-width="${thin}"/><g transform="translate(${(p.x+o.x)/2} ${(p.y+o.y)/2}) scale(${screen})"><text x="0" y="-8" text-anchor="middle" font-size="12">${distance} hex</text></g>`;}
 for(const ship of state.ships){const pos=toWorld(ship.motion.position),next=toWorld(coastTarget(ship));if(hexDistance(ship.motion.velocity)>0)html+=`<line class="velocity" x1="${pos.x}" y1="${pos.y}" x2="${next.x}" y2="${next.y}" style="stroke-width:${1.8*screen}"/>`;}
 html+=`<g transform="translate(${c.x} ${c.y}) scale(${screen})"><circle class="coast" r="9" stroke-width="1.5"/><text x="12" y="24" font-size="12">coast</text></g>`;
 if(hexDistance(m.impulse)>0){const target=toWorld(plannedTarget(s));html+=`<line class="plan-line" x1="${p.x}" y1="${p.y}" x2="${target.x}" y2="${target.y}" stroke-width="${1.5*screen}"/><polygon class="planned" points="${hexPolygon(target,10*screen)}" stroke-width="${thin}"/>`;}
 html+=state.ships.map(ship=>{const pos=toWorld(ship.motion.position),active=ship.id===selected,labelLeft=pos.x*camera.zoom+camera.x>0,label=ship.name.length>18?ship.name.slice(0,15)+'...':ship.name;return `<g class="ship-node" data-ship="${ship.id}" data-q="${ship.motion.position.q}" data-r="${ship.motion.position.r}" data-vq="${ship.motion.velocity.q}" data-vr="${ship.motion.velocity.r}" role="button" tabindex="0" aria-label="Select ${esc(ship.name)}" aria-pressed="${active}" transform="translate(${pos.x} ${pos.y}) scale(${screen})"><circle r="${active?10:8}" fill="${color(ship)}" stroke="${active?'#fff':'#152a3b'}" stroke-width="2"/><text class="ship-label" x="${labelLeft?-14:14}" text-anchor="${labelLeft?'end':'start'}" y="-9" font-size="14">${esc(label)}</text></g>`;}).join('');
 scene.setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);scene.innerHTML=html;if(focusedShip)scene.querySelector(`[data-ship="${focusedShip}"]`)?.focus({preventScroll:true});svg.dataset.gridVisible=String(showGrid);svg.dataset.zoom=camera.zoom;
 $('zoom-level').textContent=(camera.zoom*100<1?(camera.zoom*100).toPrecision(2):Math.round(camera.zoom*100))+'%';
 $('map-detail').textContent=!$('grid-toggle').checked?'Hex grid off. Positions and target legality are unchanged.':grid.limited?'Hex detail hidden at distant zoom. The map and reach boundary remain proportional; zoom in for individual hexes.':'Reachable hexes are highlighted around the selected ship’s coast target. Ranges use abstract hex steps.';
}
function scheduleMap(){if(!frame)frame=requestAnimationFrame(drawMap);}
function render(){populate();drawMap();}
function rootPoint(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
function worldPoint(event){const point=rootPoint(event);return {x:(point.x-camera.x)/camera.zoom,y:(point.y-camera.y)/camera.zoom};}
function zoom(factor,anchor={x:0,y:0}){const before={x:(anchor.x-camera.x)/camera.zoom,y:(anchor.y-camera.y)/camera.zoom},next=Math.min(8,Math.max(.000001,camera.zoom*factor));camera={zoom:next,x:anchor.x-before.x*next,y:anchor.y-before.y*next};scheduleMap();}
function plot(target){if(!selected){feedback('Add a ship before plotting.');return;}dispatch({type:'plot',shipId:selected,target},'Target plotted. Advance round to apply every ship’s movement.');}
$('ships').addEventListener('click',event=>{const button=event.target.closest('[data-select]');if(button){select(button.dataset.select);$("ships").querySelector(`[data-select="${selected}"]`)?.focus({preventScroll:true});}});
$('plot-form').addEventListener('submit',event=>{event.preventDefault();if(event.currentTarget.reportValidity())plot({q:number('target-q'),r:number('target-r')});});
$('ship-form').addEventListener('submit',event=>{event.preventDefault();if(!event.currentTarget.reportValidity())return;dispatch({type:'edit-ship',shipId:selected,name:$('ship-name').value,thrust:number('thrust'),position:{q:number('position-q'),r:number('position-r')},velocity:{q:number('velocity-q'),r:number('velocity-r')}},'Ship values applied; its plot was cleared. Camera position is unchanged.');});
$('coast').addEventListener('click',()=>dispatch({type:'coast',shipId:selected},'Plot cleared. Existing velocity persists.'));
$('advance').addEventListener('click',()=>dispatch({type:'advance-round'},'Round advanced. Every ship moved; unplotted ships coasted.'));
$('reset').addEventListener('click',()=>{$('ship-form').closest('details').open=false;state=createState();selected=state.ships[0].id;camera=fitCamera(state.ships.map(s=>s.motion.position),1200,mapHeight());feedback('Sample reset. No saved campaign data was read or changed.');render();});
$('fit').addEventListener('click',()=>{camera=fitCamera(state.ships.map(s=>s.motion.position),1200,mapHeight());scheduleMap();});
$('zoom-in').addEventListener('click',()=>zoom(1.4));$('zoom-out').addEventListener('click',()=>zoom(1/1.4));
$('grid-toggle').addEventListener('change',scheduleMap);$('ranges-toggle').addEventListener('change',scheduleMap);
svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.15:1/1.15,rootPoint(event));},{passive:false});
svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;const p=rootPoint(event);drag={pointerId:event.pointerId,start:p,x:camera.x,y:camera.y,clientX:event.clientX,clientY:event.clientY,moved:false,shipId:event.target.closest('[data-ship]')?.dataset.ship};svg.setPointerCapture(event.pointerId);});
svg.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;const p=rootPoint(event);if(Math.hypot(event.clientX-drag.clientX,event.clientY-drag.clientY)>5)drag.moved=true;if(drag.moved){camera.x=drag.x+p.x-drag.start.x;camera.y=drag.y+p.y-drag.start.y;svg.classList.add('dragging');scheduleMap();}});
svg.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.pointerId)return;const action=drag;drag=null;svg.classList.remove('dragging');if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);if(!action.moved){if(action.shipId)select(action.shipId);else plot(fromWorld(worldPoint(event)));}});
svg.addEventListener('pointercancel',()=>{drag=null;svg.classList.remove('dragging');});
svg.addEventListener('keydown',event=>{const ship=event.target.closest('[data-ship]');if(ship&&['Enter',' '].includes(event.key)){event.preventDefault();select(ship.dataset.ship);scene.querySelector(`[data-ship="${selected}"]`)?.focus({preventScroll:true});return;}const delta={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[event.key];if(delta){event.preventDefault();camera.x+=delta[0];camera.y+=delta[1];scheduleMap();}});
let lastMapSize='';new ResizeObserver(()=>{const size=svg.clientWidth+':'+svg.clientHeight;if(size!==lastMapSize){lastMapSize=size;scheduleMap();}}).observe(svg);render();

function sourceLabel(t){return t?.source?`${t.source.book}, printed p${t.source.endPage?'p':''}. ${t.source.page}${t.source.endPage?'–'+t.source.endPage:''}`:'User-entered / synthetic; no book citation';}
function designLabel(t){return t?`${t.name} · ${t.tons} tons · design thrust ${t.thrust} · hull ${t.hull??'unknown'} · armour ${t.armour??'not listed / unknown'}. ${sourceLabel(t)}. ${t.notes??''}`:'Synthetic sample; design statistics unknown. No book citation.';}
function populateSetup(s){
 $('ship-count').textContent=`${state.ships.length} / ${MAX_SHIPS} ships on map`;
 $('design-facts').textContent=designLabel(s.template)+(s.template&&s.capabilities.thrust!==s.template.thrust?' Current thrust has been manually adjusted.':'');
 $('crew-mode').value=s.crew.mode;$('crew-rating').value=s.crew.rating;
 $('crew-fields').innerHTML=ROLES.map(role=>{const d=s.crew.details[role],base=crewContribution(s.crew,role),situational=s.situational[role];return `<fieldset class="crew-role"><legend>${role}</legend><label data-quick>Total override (blank uses rating)<input id="crew-${role}-override" type="number" min="-10" max="20" step="1" value="${s.crew.overrides[role]??''}"></label><div data-detailed><label>Name / station holder (blank = unassigned)<input id="crew-${role}-name" maxlength="60" value="${esc(d?.name??'')}"></label><label>Skill / specialty<input id="crew-${role}-skillname" maxlength="60" value="${esc(d?.skillName??role)}"></label><div class="coordinate-fields"><label>Skill level<input id="crew-${role}-skill" required type="number" min="0" max="10" step="1" value="${d?.skill??0}"></label><label>Characteristic DM<input id="crew-${role}-dm" required type="number" min="-5" max="5" step="1" value="${d?.characteristicDM??0}"></label></div></div><label>Separate situational DM<input id="crew-${role}-situational" required type="number" min="-20" max="20" step="1" value="${situational}"></label><p data-contribution="${role}">Applied crew contribution: ${base===null?'unassigned':(base>=0?'+':'')+base}; situational ${situational>=0?'+':''}${situational} (separate).</p></fieldset>`;}).join('');
 $('current-hull').value=s.condition.hull??'';$('current-hull').max=s.template?.hull??1000000;
 showCrewMode();
}
function showCrewMode(){const quick=$('crew-mode').value==='quick';$('rating-label').hidden=!quick;$('crew-rating').disabled=!quick;document.querySelectorAll('[data-quick]').forEach(e=>{e.hidden=!quick;e.querySelectorAll('input').forEach(i=>i.disabled=!quick);});document.querySelectorAll('[data-detailed]').forEach(e=>{e.hidden=quick;e.querySelectorAll('input').forEach(i=>i.disabled=quick);});}
function showDesign(){const id=$('design-select').value,custom=id==='custom',p=PRESETS.find(p=>p.id===id);$('custom-fields').hidden=!custom;$('custom-fields').querySelectorAll('input').forEach(e=>e.disabled=!custom);$('preset-source').textContent=custom?'Custom setup; no sourced facts inferred. Blank hull or armour stays unknown.':designLabel(p);}
$('design-select').insertAdjacentHTML('beforeend',['Core Rulebook Update 2022','High Guard Update 2022'].map(book=>`<optgroup label="${book}">${PRESETS.filter(p=>p.source.book===book).map(p=>`<option value="${p.id}">${esc(p.name)} — ${p.tons}t — p. ${p.source.page}</option>`).join('')}</optgroup>`).join(''));
$('design-select').addEventListener('change',showDesign);showDesign();
const optionalNumber=id=>$(id).value.trim()===''?null:Number($(id).value);
$('add-form').addEventListener('submit',event=>{
 event.preventDefault();if(!event.currentTarget.reportValidity())return;
 const custom=$('design-select').value==='custom',template=custom?{name:$('design-name').value,tons:number('design-tons'),thrust:number('design-thrust'),hull:optionalNumber('design-hull'),armour:optionalNumber('design-armour')}:undefined;
 if(dispatch({type:'add-ship',presetId:custom?undefined:$('design-select').value,template,name:$('instance-name').value,position:{q:number('add-q'),r:number('add-r')},velocity:{q:number('add-vq'),r:number('add-vr')}},'Independent ship added. Crew and condition belong only to this instance.')){
  selected=state.ships.at(-1).id;camera=fitCamera(state.ships.map(s=>s.motion.position),1200,mapHeight());render();
 }
});
$('crew-mode').addEventListener('change',showCrewMode);
$('crew-form').addEventListener('submit',event=>{
 event.preventDefault();if(!event.currentTarget.reportValidity())return;
 const current=selectedShip().crew,quick=$('crew-mode').value==='quick',overrides=structuredClone(current.overrides),details=structuredClone(current.details),situational={};
 for(const role of ROLES){if(quick)overrides[role]=optionalNumber(`crew-${role}-override`);const label=$(`crew-${role}-name`).value.trim();if(!quick)details[role]=label?{name:label,skillName:$(`crew-${role}-skillname`).value,skill:number(`crew-${role}-skill`),characteristicDM:number(`crew-${role}-dm`)}:null;situational[role]=number(`crew-${role}-situational`);}
 dispatch({type:'set-crew',shipId:selected,crew:{mode:$('crew-mode').value,rating:quick?$('crew-rating').value:current.rating,overrides,details},situational},'Crew setup applied to this ship only. No movement or checks were resolved.');
});
$('condition-form').addEventListener('submit',event=>{event.preventDefault();if(event.currentTarget.reportValidity())dispatch({type:'set-condition',shipId:selected,condition:{hull:optionalNumber('current-hull')}},'Condition recorded for this ship only.');});
$('brake').addEventListener('click',()=>dispatch({type:'brake',shipId:selected},'Stop plotted within this ship’s thrust budget. Advance round to apply it.'));

$('remove-ship').addEventListener('click',()=>{const s=selectedShip();if(window.confirm(`Remove ${s.name} from this unsaved encounter? Its crew, condition and plot will be removed. Other ships are preserved.`))dispatch({type:'remove-ship',shipId:selected},'Selected ship removed. Remaining ships were preserved.');});
$('clear-ships').addEventListener('click',()=>{if(window.confirm(`Clear all ${state.ships.length} ships from this unsaved encounter? Their crew, condition and plots will be removed. Saved campaign data is not affected.`))dispatch({type:'clear-ships'},'Encounter cleared. Add your own ships; the sample was not reloaded.');});
