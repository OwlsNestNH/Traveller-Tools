import {bandRadii} from './range-overlay.mjs';
import {toWorld} from './geometry.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
// The caller supplies the visible projection, never the complete hidden roster.
// Short is a cosmetic extent, not a sensor/detection range.
export function renderSensorPings(visibleShips,enabled,screen=1){
 if(!enabled)return '';
 const radius=bandRadii().find(b=>b.name==='Short').radius;
 return visibleShips.filter(s=>s.systems?.sensorsEnabled&&s.systems.sensorMode==='active').map(s=>{const p=toWorld(s.motion.position);return `<g class="sensor-ping" data-ping-ship="${esc(s.id)}" transform="translate(${p.x} ${p.y})" aria-hidden="true">${[0,1,2].map(i=>`<circle r="${radius}" fill="none" stroke-width="${2.25*screen}" style="animation-delay:-${i}s"/>`).join('')}</g>`;}).join('');
}
