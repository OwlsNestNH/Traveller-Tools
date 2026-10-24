// One geometric construction, mirrored in both axes. No station changes game rules.
export const STATIONS=Object.freeze([['captain','Captain'],['comms','Comms'],['pilot','Pilot'],['astrogator','Astrogator'],['damage','Damage Control'],['engineer','Engineer'],['sensors','Sensors'],['gunnery','Gunnery']]);
export function mountConsoleLayout(){
 const $=id=>document.getElementById(id),main=document.querySelector('main'),left=document.querySelector('.tactical-column'),right=document.createElement('aside');
 document.body.classList.add('station-console');right.id='combat-right';right.setAttribute('aria-label','Ship information, selection and movement');main.prepend(left);left.before(document.createComment('Tactical console; right pane remains during expansion.'));left.after(right);
 for(const id of ['selected-workspace','ship-rail','movement-workspace','advanced-workspace'])right.append($(id));
 const frame=document.createElement('div');frame.className='console-frame';frame.id='console-frame';$('map').before(frame);const viewport=document.createElement('div');viewport.className='tactical-viewport';frame.append(viewport);viewport.append($('map'));
 const k=504-Math.sqrt(486**2/2-16),edge=500-Math.sqrt(486**2-4**2);
 const top=`M 8 0 H 496 V ${edge} A 486 486 0 0 0 ${k} ${k-8} Z`,side=`M 0 8 V 496 H ${edge} A 486 486 0 0 1 ${k-8} ${k} Z`;
 const corners=[['',0,1],['translate(1000 0) scale(-1 1)',2,3],['translate(0 1000) scale(1 -1)',4,5],['translate(1000 1000) scale(-1 -1)',6,7]];
 const positions=[[174,62],[60,174],[826,62],[940,174],[174,938],[60,826],[826,938],[940,826]];
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('station-regions');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('aria-label','Crew stations');
 svg.innerHTML=corners.map(([t,a,b])=>`<g transform="${t}">${[[top,a],[side,b]].map(([d,i])=>`<path d="${d}" class="station-shape" data-console-station="${STATIONS[i][0]}" tabindex="0" role="button" aria-label="${STATIONS[i][1]} station"><title>${STATIONS[i][1]}</title></path>`).join('')}</g>`).join('')+STATIONS.map(([id,label],i)=>`<text x="${positions[i][0]}" y="${positions[i][1]}" text-anchor="middle" dominant-baseline="middle" aria-hidden="true">${label==='Damage Control'?'<tspan x="174" dy="-10">Damage</tspan><tspan x="174" dy="27">Control</tspan>':label}</text>`).join('');frame.append(svg);
 const mobile=document.createElement('details');mobile.className='mobile-stations';mobile.innerHTML='<summary>Crew stations</summary><div>'+STATIONS.map(([id,label])=>`<button type="button" data-console-station="${id}">${label}</button>`).join('')+'</div>';frame.after(mobile);
 const thrust=document.createElement('p');thrust.id='drive-status';$('selected-workspace').append(thrust);
 const station=document.createElement('dialog');station.id='station-dialog';station.setAttribute('aria-labelledby','station-title');station.innerHTML='<div class="dialog-shell"><header class="dialog-header"><h2 id="station-title">Station</h2><button id="station-close" aria-label="Close station">×</button></header><div id="station-content" class="sheet-body"></div></div>';document.body.append(station);
 return {station};
}
