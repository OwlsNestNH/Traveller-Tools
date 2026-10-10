import {MAP_GEOMETRY} from './map-geometry.mjs?v=map-first-1';
import {camera} from './map-viewport.mjs?v=gui-foundations-1';
import {territoryMarkup} from './map-territory.mjs';

// Keep the existing world views intact. Only the newly added, wider scales use
// sector catalogs instead of requesting hundreds of overlapping jump areas.
export const MIN_MAP_ZOOM=.06;
export const MAP_ZOOM_STEP=1.2;
export const CLOSE_MAP_ZOOM=2.4;
export const MAX_MAP_ZOOM=CLOSE_MAP_ZOOM*MAP_ZOOM_STEP;
export function mapLevel(zoom){return zoom>=.2?'world':zoom>=.16?'subsector':'sector';}
export function nextMapZoom(zoom,factor){
 const next=Math.max(MIN_MAP_ZOOM,Math.min(MAX_MAP_ZOOM,zoom*factor));
 // Preserve the 20% layer boundary and the old 240% close view as reachable
 // stops in either direction. One more existing-size step reaches 288%.
 for(const stop of factor>1?[.2,CLOSE_MAP_ZOOM]:[CLOSE_MAP_ZOOM,.2]){
  if((zoom<stop&&next>stop)||(zoom>stop&&next<stop))return stop;
 }
 return next;
}
export function sectorBounds(sector){
 // Traveller Map world coordinates: x=32*sx+hx-1, y=40*sy+hy-40.
 // Convert the official map-space sector rectangle to this renderer (+.5,+.5).
 return {x:32*sector.x-.5,y:40*sector.y-39.5,width:32,height:40};
}
export function visibleSectors(sectors,anchor,pan,zoom){
 const c=camera(anchor,pan,zoom),rx=(MAP_GEOMETRY.halfWidth+20)/(50*zoom*Math.sqrt(3)/2),ry=(MAP_GEOMETRY.halfHeight+20)/(50*zoom);
 return sectors.filter(s=>Number.isInteger(s.x)&&Number.isInteger(s.y)).filter(s=>{
  const b=sectorBounds(s);return b.x<c.x+rx&&b.x+b.width>c.x-rx&&b.y<c.y+ry&&b.y+b.height>c.y-ry;
 }).sort((a,b)=>{const aa=sectorBounds(a),bb=sectorBounds(b);return Math.hypot(aa.x+16-c.x,aa.y+20-c.y)-Math.hypot(bb.x+16-c.x,bb.y+20-c.y);});
}

export class MapOverviewCache{
 constructor(fetchSectors,fetchCatalog,onChange){this.fetchSectors=fetchSectors;this.fetchCatalog=fetchCatalog;this.onChange=onChange;this.sectors=null;this.loading=false;this.universeError='';this.cache=new Map();this.inflight=new Set();this.failed=new Map();this.wanted=[];this.view=null;}
 request(anchor,pan,zoom,territories=false){
  this.view={anchor,pan:{...pan},zoom,territories};this.failed.clear();this.universeError='';
  this.updateWanted();
  if(mapLevel(zoom)==='world'&&!territories)return;
  if(!this.sectors&&!this.loading){
   this.loading=true;
   Promise.resolve().then(()=>this.fetchSectors()).then(rows=>{
    if(!rows.some(s=>Number.isInteger(s.x)&&Number.isInteger(s.y)))throw Error('Sector coordinates are unavailable');
    this.sectors=rows;
   }).catch(error=>{this.universeError=error.message;}).finally(()=>{this.loading=false;this.updateWanted();this.onChange();});
  }
  this.onChange();
 }
 updateWanted(){
  this.wanted=this.view&&(mapLevel(this.view.zoom)==='subsector'||this.view.territories)?this.visible:[];
  for(const s of this.wanted)if(this.cache.has(s.name)){const data=this.cache.get(s.name);this.cache.delete(s.name);this.cache.set(s.name,data);}
  this.pump();
 }
 pump(){
  for(const s of this.wanted){
   if(this.inflight.size>=2)break;
   if(this.satisfied(s.name)||this.inflight.has(s.name)||this.failed.has(s.name))continue;
   this.inflight.add(s.name);
   const includeWorlds=mapLevel(this.view.zoom)==='subsector',metadata=this.cache.get(s.name)?.metadata;
   Promise.resolve().then(()=>this.fetchCatalog(s.name,{includeWorlds,metadata,onMetadata:data=>{this.remember(s.name,{...this.cache.get(s.name),...data});this.onChange();}})).then(data=>{
    this.remember(s.name,data);
   }).catch(error=>this.failed.set(s.name,error.message)).finally(()=>{this.inflight.delete(s.name);this.pump();this.onChange();});
  }
 }
 remember(name,data){
  this.cache.set(name,data);
  while(this.cache.size>48){const oldest=[...this.cache.keys()].find(key=>!this.wanted.some(s=>s.name===key));if(!oldest)break;this.cache.delete(oldest);}
 }
 get visible(){return this.sectors&&this.view?visibleSectors(this.sectors,this.view.anchor,this.view.pan,this.view.zoom):[];}
 satisfied(name){const data=this.cache.get(name);return !!data&&(mapLevel(this.view.zoom)!=='subsector'||Array.isArray(data.worlds));}
 get pending(){return this.loading||this.wanted.some(s=>!this.satisfied(s.name)&&!this.failed.has(s.name));}
 get error(){return this.universeError||this.wanted.filter(s=>!this.satisfied(s.name)).map(s=>this.failed.get(s.name)).find(Boolean);}
}

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function labelLines(name,width,size,measure){
 const words=name.split(/\s+/),lines=[];let line='';
 for(const word of words){
  if(measure(word,size)>width+.01){
   if(line){lines.push(line);line='';}
   // Balance unusually long unbroken names rather than orphaning one letter.
   let remaining=word;
   while(measure(remaining,size)>width+.01){
    const parts=Math.ceil(measure(remaining,size)/width);let count=Math.ceil(remaining.length/parts);
    while(count>1&&measure(remaining.slice(0,count),size)>width+.01)count--;
    lines.push(remaining.slice(0,count));remaining=remaining.slice(count);
   }
   line=remaining;
  }else if(line&&measure(line+' '+word,size)>width+.01){lines.push(line);line=word;}
  else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 return lines;
}
export function overviewLabelLayout(name,width,size,measure,angle=-45){
 if(!angle)return {lines:[name],size,width:measure(name,size),height:size*1.15,angle};
 // At 45 degrees the rotated bounds are (text width + text height) / sqrt(2).
 // Prefer one readable line, then wrap only where the full rotated box fits.
 const minimum=size>=11?9:8,budget=width*Math.SQRT2-4;
 for(let rows=1;rows<=4;rows++)for(let font=size;font>=minimum-.01;font-=.25){
  const available=budget-font*1.15*rows;if(available<font)continue;
  const lines=labelLines(name,available,font,measure);
  if(lines.length<=rows)return {lines,size:font,width:Math.max(...lines.map(line=>measure(line,font))),height:lines.length*font*1.15,angle};
 }
 // Very unusual long catalog names still stay inside their cell; their full
 // name is also available in the SVG title. Ordinary M1105 names use the range above.
 const lines=labelLines(name,Math.max(8,budget/2),minimum,measure);
 const actualWidth=Math.max(...lines.map(line=>measure(line,minimum))),height=lines.length*minimum*1.15;
 const fit=Math.min(1,budget/(actualWidth+height));
 return {lines,size:minimum*fit,width:actualWidth*fit,height:height*fit,angle};
}
function label(layout,x,y,cls){
 const {lines,size,angle}=layout,height=size*1.15;
 return `<text class="${cls}" text-anchor="middle"${angle?` transform="rotate(${angle} ${x} ${y})"`:''} style="font-size:${size}px">${lines.map((line,i)=>`<tspan x="${x}" y="${y+(i-(lines.length-1)/2)*height+size*.35}">${esc(line)}</tspan>`).join('')}</text>`;
}
function sectorLetterPosition(left,top,cw,ch,cx,cy,layout,row){
 const candidates=row<2?[[left+4,top+11],[left+cw-10,top+11],[left+4,top+ch-5],[left+cw-10,top+ch-5]]:[[left+4,top+ch-5],[left+cw-10,top+ch-5],[left+4,top+11],[left+cw-10,top+11]];
 const overlaps=([x,y])=>{
  const corners=[[x,y-9],[x+6,y-9],[x,y+2],[x+6,y+2]].map(([px,py])=>[(px-cx-(py-cy))/Math.SQRT2,(px-cx+py-cy)/Math.SQRT2]);
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  return Math.min(...xs)<layout.width/2+3&&Math.max(...xs)>-layout.width/2-3&&Math.min(...ys)<layout.height/2+3&&Math.max(...ys)>-layout.height/2-3;
 };
 return candidates.find(p=>!overlaps(p))||candidates[0];
}

export function mapTerritories({anchor,pan,zoom,sectors,catalogs}){
 const scale=50*zoom,ay=anchor.y+((anchor.x%2+2)%2)*.5;
 const project=(x,y)=>[MAP_GEOMETRY.originX+(x-anchor.x)*scale*Math.sqrt(3)/2,MAP_GEOMETRY.originY+(y-ay)*scale];
 return territoryMarkup({sectors:visibleSectors(sectors,anchor,pan,zoom),metadata:new Map([...catalogs].map(([name,data])=>[name,data.metadata])),project});
}

// Returned layers live inside the same translated group as the original map.
// Labels are inert: overview browsing never selects a world or changes a route.
export function overviewMarkup({anchor,pan,zoom,sectors,catalogs,measure,showTerritories=false}){
 const level=mapLevel(zoom),scale=50*zoom,dx=scale*Math.sqrt(3)/2,ay=anchor.y+((anchor.x%2+2)%2)*.5;
 const project=(x,y)=>[MAP_GEOMETRY.originX+(x-anchor.x)*dx,MAP_GEOMETRY.originY+(y-ay)*scale];
 const visible=visibleSectors(sectors,anchor,pan,zoom),grid=[],dots=[],labels=[];
 const territory=showTerritories?mapTerritories({anchor,pan,zoom,sectors,catalogs}):'';
 for(const s of visible){
  const b=sectorBounds(s),[x,y]=project(b.x,b.y),width=32*dx,height=40*scale,cw=width/4,ch=height/4,data=catalogs.get(s.name);
  const sectorLabel=level==='sector'?overviewLabelLayout(s.name,width-12,Math.min(13,width/7),measure):null;
  grid.push(`<rect class="sector-border" x="${x}" y="${y}" width="${width}" height="${height}"/>`);
  for(let i=1;i<4;i++)grid.push(`<path class="subsector-border" d="M${x+i*cw},${y}v${height} M${x},${y+i*ch}h${width}"/>`);
  if(level==='subsector'&&data?.worlds)for(const w of data.worlds){
   const wx=32*s.x+Number(w.hex.slice(0,2))-1,wy=40*s.y+Number(w.hex.slice(2))-40;
   const [p,q]=project(wx,wy+((wx%2+2)%2)*.5);dots.push(`<circle cx="${p}" cy="${q}" r=".8"/>`);
  }
  for(let i=0;i<16;i++){
   const letter=String.fromCharCode(65+i),left=x+(i%4)*cw,top=y+Math.floor(i/4)*ch;
   if(left+pan.x+cw<0||left+pan.x>MAP_GEOMETRY.width||top+pan.y+ch<0||top+pan.y>MAP_GEOMETRY.height)continue;
   const name=data?.subsectors.find(ss=>ss.index===letter)?.mapName;
   if(level==='sector'){const [lx,ly]=sectorLetterPosition(left,top,cw,ch,x+width/2,y+height/2,sectorLabel,Math.floor(i/4));labels.push(`<text class="subsector-letter" x="${lx}" y="${ly}" style="font-size:9px">${letter}</text>`);}
   else labels.push(`<g class="subsector-label" data-sector="${esc(s.name)}" data-subsector="${letter}"><title>${esc(s.name)} · ${letter}${name?' · '+esc(name):''}</title>${label(overviewLabelLayout(name||letter,cw-8,Math.min(12,Math.max(9,cw/4.8)),measure,name?-45:0),left+cw/2,top+ch/2,'subsector-name')}</g>`);
  }
  if(level==='sector')labels.push(`<g class="sector-label" data-sector="${esc(s.name)}"><title>${esc(s.name)}</title>${label(sectorLabel,x+width/2,y+height/2,'sector-name')}</g>`);
 }
 return `${territory}<g class="overview-grid ${level}-grid" aria-hidden="true">${grid.join('')}</g><g class="overview-worlds" aria-hidden="true">${dots.join('')}</g><g class="overview-labels">${labels.join('')}</g>`;
}
