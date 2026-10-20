// Published Traveller Map fields, never calculator overrides. See the API's
// Second Survey specification and World.cs zone flags. This is intentionally
// a documented symbol subset shared by the main and player maps; other codes
// remain literal rather than guessing the full allegiance-specific symbol system.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ehex=c=>typeof c==='string'&&c.length===1?'0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.indexOf(c.toUpperCase()):-1;
export function worldMapFacts(world){
 const r=world.raw||{},uwp=String(r.UWP||world.uwp||''),bases=typeof r.Bases==='string'?r.Bases:null;
 const placeholder=/^(?:X{7}-X|\?{7,8}-\?)$/.test(uwp);
 const starport=!placeholder&&/^[A-HXY]$/.test(uwp[0]||'')?uwp[0]:null;
 const gas=ehex(typeof r.PBG==='string'?r.PBG[2]:null);
 const sourceZone=typeof r.Zone==='string'?r.Zone.toUpperCase():null;
 const zone=['A','U'].includes(sourceZone)?'A':['R','F'].includes(sourceZone)?'R':['','-','G'].includes(sourceZone)?'':null;
 const hydro=uwp[3],body=placeholder?'unknown':uwp[1]==='0'?'belt':hydro==='0'?'dry':/^[1-9A]$/.test(hydro||'')?'water':'unknown';
 const capital=/(?:^|\s)(?:Cp|Cs|Cx)(?:\s|$)/.test(r.Remarks||'');
 return {body,capital,allegiance:typeof r.Allegiance==='string'&&r.Allegiance.trim()?r.Allegiance:'?',starport,gasGiants:gas<0?null:gas,bases,naval:bases===null||bases==='?'?null:!(/^Zh/.test(r.Allegiance||'')&&bases==='KM')&&/[NK]/.test(bases),scout:bases===null||bases==='?'?null:bases.includes('S'),zone,zoneName:zone==='A'?'Amber':zone==='R'?'Red':zone===''?'Safe':'Not supplied'};
}
// Canonical 200-unit hex layout used by both maps. SVG strings escape every
// source string; coordinates and paints below are authored constants.
export function publishedWorldBody(world,x=0,y=0,{radius=20,selected=false}={}){
 const f=worldMapFacts(world),fill={water:'#00b9ed',dry:'#ffffff',unknown:'#88929e',belt:'#ffffff'}[f.body];
 if(world.emptySpace)return `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#9bb7ce"/>`;
 if(f.body==='belt')return `<g class="world-belt" fill="#ffffff">${[[-14,-8],[0,-10],[13,-7],[-20,4],[-6,4],[9,7],[21,3]].map(([bx,by])=>`<circle cx="${x+bx*radius/20}" cy="${y+by*radius/20}" r="${3*radius/20}"/>`).join('')}</g>`;
 return `<circle class="world-disc ${f.body}-disc" cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${selected?'#fff':'none'}" stroke-width="${selected?2:0}"/>`;
}
export function publishedWorldSymbols(world,x=0,y=0,{spacing=200}={}){
 if(world.emptySpace)return '';
 const f=worldMapFacts(world),k=spacing/200,parts=[],text=(value,bx,by,cls,size)=>`<text class="${cls}" x="${x+bx*k}" y="${y+by*k}" text-anchor="middle" style="font-size:${size*k}px">${esc(value)}</text>`;
 if(f.zone)parts.push(`<path class="symbol-zone zone-arc zone-${f.zone} ${f.zone==='A'?'zone-amber':'zone-red'}" d="M ${x-75*k} ${y+29*k} A ${80*k} ${80*k} 0 1 1 ${x+75*k} ${y+29*k}" fill="none" stroke="${f.zone==='A'?'#ffe000':'#ff3045'}" stroke-width="${2.5*k}"/>`);
 parts.push(text(f.starport||'?',0,-43,'symbol-starport world-starport',21));
 if(f.naval)parts.push(text('★',-50,-36,'symbol-naval base-symbol',24));
 if(f.scout)parts.push(text('▲',-50,27,'symbol-scout base-symbol',24));
 const other=f.bases===null?'?':f.bases.replace(f.naval?/[NKS]/g:/[NS]/g,'').replace(/[-\s]/g,'');
 if(other)parts.push(text(other.slice(0,4),-54,0,'base-code',13));
 if(f.gasGiants>0)parts.push(`<g class="symbol-gas-giant gas-giant" transform="translate(${x+50*k} ${y-35*k}) rotate(-25)" fill="#fff" stroke="#fff"><circle r="${8*k}" stroke="none"/><ellipse rx="${16*k}" ry="${5*k}" fill="none" stroke-width="${2*k}"/></g>`);
 if(f.gasGiants===null)parts.push(text('G?',51,-30,'base-code',13));
 parts.push(text(f.allegiance.slice(0,8),53,15,'allegiance-label',13));
 return parts.join('');
}
const ringed=(x,y)=>`<g class="symbol-gas-giant" transform="translate(${x} ${y}) rotate(-25)"><circle r="3.1"/><ellipse rx="7" ry="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/></g>`;
const bracket=(x,y)=>`<path class="symbol-selection" d="M ${x-11} ${y-16} h -5 v 5 M ${x+11} ${y-16} h 5 v 5 M ${x-11} ${y+16} h -5 v -5 M ${x+11} ${y+16} h 5 v -5" fill="none" stroke="#eaf5ff" stroke-width="1.5"/>`;
const hexPoints=(x,y,radius)=>Array.from({length:6},(_,i)=>[x+radius*Math.cos(i*Math.PI/3),y+radius*Math.sin(i*Math.PI/3)].join(',')).join(' ');
// A separate layer keeps the browsing highlight below every route and world
// symbol. Its inset leaves the hex grid and political border strokes visible.
export function selectedWorldHex(x,y,scale=50){
 if(![x,y,scale].every(Number.isFinite)||scale<=0)return '';
 const radius=scale/Math.sqrt(3),factor=Math.min(1,scale/50);
 return `<g class="selected-world-hex" aria-hidden="true"><polygon class="selection-hex-fill" points="${hexPoints(x,y,radius-2*factor)}" fill="#245d94" fill-opacity="0.42" stroke="none"/><polygon class="selection-hex-outline" points="${hexPoints(x,y,radius-3*factor)}" fill="none" stroke="#80beff" stroke-width="${2*factor}" stroke-linejoin="round"/></g>`;
}
export function worldSymbols(world,x,y,{close=false,selected=false,actual=false,scale=50}={}){
 const parts=[];
 if(close)parts.push(publishedWorldSymbols(world,x,y,{spacing:120}));
 if(selected&&scale>=24)parts.push(bracket(x,y));
 if(actual)parts.push(`<path class="symbol-ship" d="M ${x+(close?36:13)} ${y+(close?29:8)} l -4 9 4 -3 4 3 Z" fill="#62d3dd"/>`);
 return '<g class="world-symbols" aria-hidden="true">'+parts.join('')+'</g>';
}
export function mapKeyMarkup(){
 const icon=(body,cls='')=>`<svg class="key-icon ${cls}" viewBox="-12 -12 24 24" aria-hidden="true">${body}</svg>`;
 const entries=[
  [icon('<text y="6" text-anchor="middle">A</text>'),'Starport class'],
  [icon('<text y="6" text-anchor="middle">★</text>'),'Naval base'],
  [icon('<path d="M 0 -7 L -6 5 H 6 Z"/>'),'Scout base'],
  [icon(ringed(0,0)),'Gas giant(s)'],
  [icon('<path d="M -8 5 A 9 9 0 1 1 8 5" fill="none" stroke="#f5bd6c" stroke-width="2"/>'),'Amber zone'],
  [icon('<path d="M -8 5 A 9 9 0 1 1 8 5" fill="none" stroke="#ff959e" stroke-width="2"/>'),'Red zone'],
  [icon('<circle r="3" fill="#62d3dd"/><path d="M 6 3 l -3 7 3 -2 3 2 Z" fill="#62d3dd"/>'),'Ship location'],
  [icon(`<polygon points="${hexPoints(0,0,10)}" fill="#245d94" fill-opacity="0.42" stroke="#80beff" stroke-width="1.8"/>`,'key-selected-world'),'Selected world']
 ];
 return '<section class="map-key" aria-label="Map key"><h3>Map key <span>Symbols at 240–288%</span></h3><ul>'+entries.map(([symbol,label])=>'<li>'+symbol+'<span>'+label+'</span></li>').join('')+'</ul><p class="help">The blue hex marks the selected world; the cyan ship marks your actual location. Browsing never moves the ship.</p><p class="help">Shown symbols use published data. Other base codes appear literally and are listed above. Water worlds are cyan, dry worlds white, unknown worlds grey, and asteroid belts use clustered dots. Red names mark capitals; the code beside a world is its allegiance. Missing data is not proof of absence. Political borders show allegiance territory, not travel zones.</p></section>';
}
