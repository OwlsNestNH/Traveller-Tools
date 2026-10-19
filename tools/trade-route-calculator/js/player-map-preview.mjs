import {referenceOrigin,referenceWorld,referenceFacts,hexDistance,stagger,referenceSectorAreas} from './player-map-reference.mjs';
import {territoryMarkup} from './map-territory.mjs';
const control=document.getElementById('radius'),output=document.getElementById('radius-value'),status=document.getElementById('map-status'),frame=document.getElementById('map-frame'),details=document.getElementById('world-details');
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const svgNode=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
let origin,anchor,selected,worlds=[],metadata=new Map(),sectors=[],generation=0,controller,project,svg;
async function read(path,params,signal,limit=1000000) {
 const url=new URL('https://travellermap.com/api/'+path);url.search=new URLSearchParams({...params,milieu:'M1105'});
 const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});if(!response.ok)throw Error('Reference request failed.');
 const reader=response.body.getReader(),chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Reference data too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function showWorld(world) {
 selected=world;details.replaceChildren(node('h2',world.name),node('p',world.sector+' / '+world.hex+' · '+world.uwp));
 const names=new Map();for(const data of metadata.values())for(const item of data.Allegiances??[])if(typeof item.Code==='string'&&typeof item.Name==='string'&&item.Name.length<=120)names.set(item.Code,item.Name);
 const facts=referenceFacts(world,names),grid=node('dl');grid.className='uwp-fields';
 for(const [label,code,meaning]of facts.fields){const box=node('div');box.append(node('dt',label),node('dd',code+' · '+meaning));grid.append(box);}details.append(grid);
 const extra=node('dl');extra.className='reference-facts';for(const [label,value]of [['Travel zone',facts.zone],['Bases',facts.bases],['Gas giants',facts.gasGiants==='0'?'None recorded':facts.gasGiants],['Trade codes',facts.tradeCodes],['Allegiance',facts.allegiance]])extra.append(node('dt',label),node('dd',value));details.append(extra);
 for(const el of frame.querySelectorAll('[data-world]'))el.setAttribute('aria-pressed',String(el.dataset.world===world.id));
}
function centerMap(){if(!anchor||!project)return;const [x,y]=project(...stagger(anchor));frame.scrollLeft=Math.max(0,x-frame.clientWidth/2);frame.scrollTop=Math.max(0,y-frame.clientHeight/2);}
function centerOrigin(){if(!anchor)return;showWorld(anchor);centerMap();}
let previousWidth=0;new ResizeObserver(()=>{if(frame.clientWidth!==previousWidth){previousWidth=frame.clientWidth;centerMap();}}).observe(frame);
function draw(radius) {
 const scale=72,size=(radius*2+3)*scale,[cx,cy]=stagger(anchor);project=(x,y)=>[size/2+(x-cx)*scale*Math.sqrt(3)/2,size/2+(y-cy)*scale];
 svg=svgNode('svg',{viewBox:`0 0 ${size} ${size}`,width:size,height:size,role:'group','aria-label':'Nearby systems reference map'});
 const territories=svgNode('g');territories.innerHTML=territoryMarkup({sectors,metadata,project});svg.append(territories);
 for(let x=anchor.x-radius;x<=anchor.x+radius;x++)for(let y=anchor.y-radius-1;y<=anchor.y+radius+1;y++)if(hexDistance(anchor,{x,y})<=radius){const [px,py]=project(...stagger({x,y})),r=scale/Math.sqrt(3);svg.append(svgNode('polygon',{points:Array.from({length:6},(_,i)=>`${px+r*Math.cos(i*Math.PI/3)},${py+r*Math.sin(i*Math.PI/3)}`).join(' '),class:'hex-grid'}));}
 for(const world of worlds){const [x,y]=project(...stagger(world)),g=svgNode('g',{transform:`translate(${x} ${y})`,role:'button',tabindex:0,'aria-label':'Inspect '+world.name,'aria-pressed':'false','data-world':world.id,class:'world-target'});
  g.append(svgNode('circle',{r:22,class:world.id===anchor.id?'origin-disc':'world-disc'}));
  const name=svgNode('text',{y:-6,'text-anchor':'middle'});name.textContent=world.name.length>12?world.name.slice(0,11)+'…':world.name;const code=svgNode('text',{y:10,'text-anchor':'middle',class:'allegiance-label'});code.textContent=world.raw.Allegiance||'?';g.append(name,code);
  const title=svgNode('title');title.textContent=world.name+' · '+referenceFacts(world).allegiance;g.append(title);
  g.addEventListener('click',()=>showWorld(world));g.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();showWorld(world);}});svg.append(g);
 }
 frame.replaceChildren(svg);showWorld(worlds.find(w=>w.id===selected?.id)||anchor);requestAnimationFrame(()=>{const keep=selected;centerOrigin();if(keep)showWorld(keep);});
}
async function load() {
 const radius=Number(control.value);if(!Number.isInteger(radius)||radius<0||radius>5)return;output.value=String(radius);const current=++generation;controller?.abort();controller=new AbortController();const requestController=controller,signal=requestController.signal,timer=setTimeout(()=>requestController.abort(),12000);
 status.textContent='Loading nearby systems…';frame.replaceChildren();details.replaceChildren(node('p','Loading reference data…'));document.getElementById('current-world').disabled=true;
 try {
  if(!anchor){const data=await read('jumpworlds',{...origin,jump:0},signal);if(!Array.isArray(data.Worlds)||data.Worlds.length!==1)throw Error('Origin unavailable.');const candidate=referenceWorld(data.Worlds[0]);if(candidate.hex!==origin.hex||candidate.sector.toLowerCase()!==origin.sector.toLowerCase())throw Error('Origin mismatch.');anchor=candidate;document.getElementById('origin-label').textContent='Snapshot reference origin: '+anchor.name+' · '+anchor.sector+' / '+anchor.hex;}
  const data=radius===0?{Worlds:[]} : await read('jumpworlds',{x:anchor.x,y:anchor.y,jump:radius},signal);if(!Array.isArray(data.Worlds)||data.Worlds.length>91)throw Error('Invalid world list.');
  const rows=data.Worlds.map(referenceWorld).filter(w=>hexDistance(anchor,w)<=radius),unique=new Map([[anchor.id,anchor],...rows.map(w=>[w.id,w])]);const next=[...unique.values()];
  const covered=referenceSectorAreas(anchor,radius),known=new Map(next.map(w=>[w.sectorX+','+w.sectorY,w.sector]));
  if(covered.length>4)throw Error('Invalid nearby sectors.');
  if(covered.some(s=>!known.has(s.x+','+s.y)))try {
   const universe=await read('universe',{requireData:1},signal,4000000);if(!Array.isArray(universe.Sectors)||universe.Sectors.length>10000)throw Error('Invalid sector index.');
   for(const s of universe.Sectors){const name=s.Names?.[0]?.Text;if(Number.isSafeInteger(s.X)&&Number.isSafeInteger(s.Y)&&typeof name==='string'&&name.trim()&&name.length<=80&&!/[\u0000-\u001f\u007f]/u.test(name)&&(!s.Milieu||s.Milieu==='M1105'))known.set(s.X+','+s.Y,name);}
  }catch{/* Missing sectors leave an explicit partial-coverage warning. */}
  const nextSectors=covered.map(s=>({...s,name:known.get(s.x+','+s.y)})).filter(s=>s.name);
  const incomplete=nextSectors.length!==covered.length;
  const results=await Promise.allSettled(nextSectors.map(async sector=>{const raw=await read('metadata',{sector:sector.name},signal,2000000);if(!Array.isArray(raw.Borders)||raw.Borders.length>256)throw Error('Borders unavailable.');if(raw.Borders.some(b=>typeof b.Path!=='string'||b.Path.length>65536))throw Error('Invalid borders.');return [sector.name,{Borders:raw.Borders,Stylesheet:typeof raw.Stylesheet==='string'?raw.Stylesheet.slice(0,65536):'',Allegiances:Array.isArray(raw.Allegiances)?raw.Allegiances.slice(0,256):[]}];}));
  if(current!==generation)return;worlds=next;sectors=nextSectors;metadata=new Map(results.filter(r=>r.status==='fulfilled').map(r=>r.value));draw(radius);document.getElementById('current-world').disabled=false;
  status.textContent='Reference map loaded · radius '+radius+'. '+(incomplete||results.some(r=>r.status==='rejected')?'Political borders unavailable; world allegiance codes remain shown.':'Political borders use TravellerMap source data.');
 }catch{if(current===generation){frame.replaceChildren();details.replaceChildren(node('p','World reference unavailable. Frozen snapshot data is unchanged.'));status.textContent='Reference map unavailable. Check your connection and retry. Snapshot information is unaffected.';}}
 finally{clearTimeout(timer);}
}
control.addEventListener('input',()=>{output.value=control.value;});control.addEventListener('change',load);
document.getElementById('map-retry').addEventListener('click',load);document.getElementById('current-world').addEventListener('click',centerOrigin);
try{origin=referenceOrigin(new URLSearchParams(location.search));load();}catch(error){status.textContent=error.message;control.disabled=true;document.getElementById('map-retry').disabled=true;}
