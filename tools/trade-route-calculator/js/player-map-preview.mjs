import {campaignPoliticsFromFragment} from './campaign-politics-codec.mjs';
import {campaignTerritoryMarkup,campaignAllegiance} from './campaign-politics.mjs';
import {informationButton} from './player-info.mjs?v=campaign-politics-20261020-103';
if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('embedded-reference');
import {referenceOrigin,referenceWorld,referenceFacts,hexDistance,stagger,referenceSectorAreas} from './player-map-reference.mjs';
import {publishedWorldBody,publishedWorldSymbols,worldMapFacts} from './world-symbols.mjs?v=campaign-politics-20261020-103';
import {territoryMarkup} from './map-territory.mjs';
document.getElementById('map-help').append(informationButton(document,'Map reference', ['Choose 0–6 rings. Fewer rings enlarge the map’s worlds and labels. Move the slider to update the rings. Select a world for details; the map stays centered on the current system. Current World restores its details.', '★ naval · ▲ scout · ringed planet: gas giants · yellow/red arc: travel zone. Other base codes appear literally; ?: unknown.', 'Live reference and political borders use TravellerMap source data. Political borders are allegiance territory, not travel zones. Browsing does not move the ship or change frozen cargo, prices, offers or GM world overrides.', 'Radius changes this preview only. It is not saved or included in a snapshot URL. No campaign storage is accessed.']));
const control=document.getElementById('radius'),output=document.getElementById('radius-value'),status=document.getElementById('map-status'),frame=document.getElementById('map-frame'),details=document.getElementById('world-details');
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const svgNode=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
let campaignPolitics=null;
let origin,anchor,selected,worlds=[],metadata=new Map(),sectors=[],generation=0,controller,project,svg,homeBox;
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
 const extra=node('dl');extra.className='reference-facts';for(const [label,value]of [['Travel zone',facts.zone],['Bases',facts.bases],['Gas giants',facts.gasGiants==='0'?'None recorded':facts.gasGiants],['Trade codes',facts.tradeCodes],['Allegiance',facts.allegiance]])extra.append(node('dt',label),node('dd',value));details.append(extra);if(campaignAllegiance(campaignPolitics,world.x,world.y))details.append(node('p','Campaign allegiance: Drinax. Published allegiance remains '+facts.allegiance+'.'));
 for(const el of frame.querySelectorAll('[data-world]'))el.setAttribute('aria-pressed',String(el.dataset.world===world.id));
}
function centerMap(){if(svg&&homeBox)svg.setAttribute('viewBox',homeBox.join(' '));}
function centerOrigin(){if(!anchor)return;showWorld(anchor);centerMap();}
let previousWidth=0;new ResizeObserver(()=>{if(frame.clientWidth!==previousWidth){previousWidth=frame.clientWidth;centerMap();}}).observe(frame);
function draw(radius) {
 const scale=200,size=(radius*2+3)*scale,[cx,cy]=stagger(anchor);project=(x,y)=>[size/2+(x-cx)*scale*Math.sqrt(3)/2,size/2+(y-cy)*scale];
 svg=svgNode('svg',{viewBox:`0 0 ${size} ${size}`,width:size,height:size,role:'group','aria-label':'Nearby systems reference map'});
 const cells=[],vertices=[];
 for(let x=anchor.x-radius;x<=anchor.x+radius;x++)for(let y=anchor.y-radius-1;y<=anchor.y+radius+1;y++)if(hexDistance(anchor,{x,y})<=radius){const [px,py]=project(...stagger({x,y})),r=scale/Math.sqrt(3);const corners=Array.from({length:6},(_,i)=>[px+r*Math.cos(i*Math.PI/3),py+r*Math.sin(i*Math.PI/3)]);vertices.push(...corners);cells.push(corners.map(p=>p.join(',')).join(' '));}
 const left=Math.min(...vertices.map(p=>p[0]))-2,top=Math.min(...vertices.map(p=>p[1]))-2,width=Math.max(...vertices.map(p=>p[0]))-left+2,height=Math.max(...vertices.map(p=>p[1]))-top+2;
 homeBox=[left,top,width,height];svg.setAttribute('viewBox',homeBox.join(' '));svg.setAttribute('width',width);svg.setAttribute('height',height);
 const defs=svgNode('defs'),clip=svgNode('clipPath',{id:'reference-footprint'});for(const points of cells)clip.append(svgNode('polygon',{points}));defs.append(clip);svg.append(defs);
 const footprint=svgNode('g',{'clip-path':'url(#reference-footprint)',class:'map-footprint'});footprint.append(svgNode('rect',{x:left,y:top,width,height,fill:'#080b10'}));
 const territories=svgNode('g');territories.innerHTML=territoryMarkup({sectors,metadata,project});footprint.append(territories);const campaign=svgNode('g');campaign.innerHTML=campaignTerritoryMarkup(campaignPolitics,project);footprint.append(campaign);
 for(const points of cells)footprint.append(svgNode('polygon',{points,class:'hex-grid'}));svg.append(footprint);
 const visible=worlds.filter(world=>hexDistance(anchor,world)<=radius);
 for(const world of visible){const [x,y]=project(...stagger(world)),g=svgNode('g',{transform:`translate(${x} ${y})`,role:'button',tabindex:0,'aria-label':'Inspect '+world.name,'aria-pressed':'false','data-world':world.id,class:'world-target'});
  // Original SVG primitives following Traveller Map's conventional label positions.
  // Data alone determines symbols; unsupported base codes remain literal codes.
  const label=(text,x,y,cls)=>{const t=svgNode('text',{x,y,'text-anchor':'middle',class:cls});t.textContent=text;g.append(t);return t;};
  g.append(svgNode('circle',{r:86,class:'world-hit'}));
  const body=svgNode('g');body.innerHTML=publishedWorldBody(world);g.append(body);
  label(world.hex,0,-88,'world-hex');
  label(world.uwp,0,48,'world-uwp');
  const capital=worldMapFacts(world).capital;
  const name=label(world.name,0,78,'world-name'+(capital?' capital-name':''));
  // Keep long names inside their cell without changing their underlying text.
  if(world.name.length>12){name.setAttribute('textLength','150');name.setAttribute('lengthAdjust','spacingAndGlyphs');}
  const symbols=svgNode('g',{class:'world-symbols'});g.append(symbols);
  symbols.innerHTML=publishedWorldSymbols(world);
  const title=svgNode('title');title.textContent=world.name+' · '+referenceFacts(world).allegiance;g.append(title);
  g.addEventListener('click',()=>showWorld(world));g.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();showWorld(world);}});svg.append(g);
 }
 frame.replaceChildren(svg);showWorld(visible.find(w=>w.id===selected?.id)||anchor);requestAnimationFrame(()=>{const keep=selected;centerOrigin();if(keep)showWorld(keep);});
}
async function load() {
 const radius=Number(control.value);if(!Number.isInteger(radius)||radius<0||radius>6)return;output.value=String(radius);const current=++generation;controller?.abort();controller=new AbortController();const requestController=controller,signal=requestController.signal,timer=setTimeout(()=>requestController.abort(),12000);
 status.textContent='Loading nearby systems…';if(anchor)draw(radius);else {frame.replaceChildren();details.replaceChildren(node('p','Loading reference data…'));}document.getElementById('current-world').disabled=!anchor;
 try {
  if(!anchor){const data=await read('jumpworlds',{...origin,jump:0},signal);if(!Array.isArray(data.Worlds)||data.Worlds.length!==1)throw Error('Origin unavailable.');const candidate=referenceWorld(data.Worlds[0]);if(candidate.hex!==origin.hex||candidate.sector.toLowerCase()!==origin.sector.toLowerCase())throw Error('Origin mismatch.');anchor=candidate;document.getElementById('origin-label').textContent='Snapshot reference origin: '+anchor.name+' · '+anchor.sector+' / '+anchor.hex;}
  const data=radius===0?{Worlds:[]} : await read('jumpworlds',{x:anchor.x,y:anchor.y,jump:radius},signal);if(!Array.isArray(data.Worlds)||data.Worlds.length>127)throw Error('Invalid world list.');
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
  status.textContent='Reference map loaded · radius '+radius+'. '+(incomplete||results.some(r=>r.status==='rejected')?'Political borders unavailable; world allegiance codes remain shown.':'');
 }catch{if(current===generation){frame.replaceChildren();details.replaceChildren(node('p','World reference unavailable. Frozen snapshot data is unchanged.'));status.textContent='Reference map unavailable. Check your connection and retry. Snapshot information is unaffected.';}}
 finally{clearTimeout(timer);}
}
control.addEventListener('input',load);
document.getElementById('map-retry').addEventListener('click',load);document.getElementById('current-world').addEventListener('click',centerOrigin);
function readCampaignLayer(){
 generation++;controller?.abort();campaignPolitics=null;document.getElementById('campaign-map-legend')?.remove();
 try{
  if(location.hash){if(!location.hash.startsWith('#politics='))throw Error('Invalid campaign territory link.');campaignPolitics=campaignPoliticsFromFragment(location.hash.slice(10));}
  if(campaignPolitics){const legend=node('p','Violet / lavender: frozen Drinax campaign territory. Claims do not alter published world allegiance.');legend.id='campaign-map-legend';document.getElementById('map-help').append(legend);}
  origin=referenceOrigin(new URLSearchParams(location.search));control.disabled=false;document.getElementById('map-retry').disabled=false;load();
 }catch(error){frame.replaceChildren();details.replaceChildren();status.textContent=error.message;control.disabled=true;document.getElementById('map-retry').disabled=true;document.getElementById('current-world').disabled=true;}
}
window.addEventListener('hashchange',readCampaignLayer);readCampaignLayer();
