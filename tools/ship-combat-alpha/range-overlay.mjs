import {RANGE_BANDS,HEX_KM} from './movement-rules.mjs';
import {HEX_SIZE,toWorld} from './geometry.mjs';
// Euclidean world-space radii. The viewport/console shape never changes range geometry.
export const SPACE_RADIUS=Math.sqrt(3)*HEX_SIZE;
export const RANGE_MODES=Object.freeze(['off','rings','shaded']);
export const bandRadii=()=>RANGE_BANDS.map(b=>({...b,km:b.max*HEX_KM,radius:b.max*SPACE_RADIUS}));
const disk=r=>`M ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 Z`;
export function renderRangeOverlay(ship,mode,screen=1,view=null){
 if(!ship||mode==='off')return {shade:'',rings:''};
 if(!RANGE_MODES.includes(mode)||!Number.isFinite(screen)||screen<=0)throw Error('Invalid range overlay view.');
 const p=toWorld(ship.motion.position),bands=bandRadii(),tag=`data-focused-ship="${ship.id}" data-mode="${mode}" transform="translate(${p.x} ${p.y})"`;
 const shade=mode==='shaded'?`<g class="range-shading" ${tag}>${bands.map((b,i)=>`<path class="range-band-fill band-tone-${i%2}" data-band="${b.name}" data-inner-spaces="${i?bands[i-1].max:0}" data-outer-spaces="${b.max}" d="${disk(b.radius)} ${i?disk(bands[i-1].radius):''}" fill-rule="evenodd"/>`).join('')}</g>`:'';
 let shortSide='end',shortShift=0,shortOffset=0,compact=false;if(view){const rootX=p.x*view.camera.zoom+view.camera.x,rootY=p.y*view.camera.zoom+view.camera.y,half=view.ellipse?view.width/2*Math.sqrt(Math.max(0,1-(rootY/(view.height/2))**2)):view.width/2,need=(SPACE_RADIUS+168*screen)*view.camera.zoom;shortSide=rootX+half>=need?'end':half-rootX>=need?'start':'middle';if(view.width/(screen*view.camera.zoom)<500){shortSide='middle';compact=true;shortOffset=Math.max(SPACE_RADIUS,44*screen);if(rootY>view.height*.325)shortOffset=-shortOffset;const labelY=(p.y+shortOffset+(shortOffset>0?10:-10)*screen)*view.camera.zoom+view.camera.y,labelHalf=view.ellipse?view.width/2*Math.sqrt(Math.max(0,1-(labelY/(view.height/2))**2)):view.width/2,left=(-labelHalf-view.camera.x)/view.camera.zoom-p.x+80*screen,right=(labelHalf-view.camera.x)/view.camera.zoom-p.x-80*screen;if(left<=right)shortShift=Math.min(right,Math.max(left,0));}}
 const label=b=>{const side=b.max===1?shortSide:'middle',x=b.max===1&&side!=='middle'?(side==='end'?-b.radius:b.radius):b.max===1?shortShift:0,y=b.max===1&&compact?shortOffset:b.max!==1||side==='middle'?-b.radius:0;return `${b.max===1&&compact?`<line class="range-caption-leader" x1="0" y1="${shortOffset>0?b.radius:-b.radius}" x2="${x}" y2="${y}" stroke-width="${screen*.65}"/>`:''}<g transform="translate(${x} ${y}) scale(${screen})"><text class="range-band-label" text-anchor="${side}" x="${side==='end'?-8:side==='start'?8:0}" y="${b.max===1&&compact?(shortOffset>0?16:-7):side==='middle'?-7:4}" font-size="11">${b.name} ≤ ${b.max} space${b.max===1?'':'s'} · ${b.km.toLocaleString('en-US')} km</text></g>`;};
 const rings=`<g class="range-rings" ${tag}>${bands.map(b=>`<circle class="range-ring" data-band="${b.name}" data-spaces="${b.max}" data-km="${b.km}" r="${b.radius}" fill="none" stroke-width="${screen}"/>${label(b)}`).join('')}</g>`;
 return {shade,rings};
}
