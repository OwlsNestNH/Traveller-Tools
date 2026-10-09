// Published Traveller Map fields, never calculator overrides. See the API's
// Second Survey specification and World.cs zone flags. This is intentionally
// a small legend subset, not the complete Traveller Map base-symbol system.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ehex=c=>typeof c==='string'&&c.length===1?'0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.indexOf(c.toUpperCase()):-1;
export function worldMapFacts(world){
 const r=world.raw||{},uwp=String(r.UWP||world.uwp||''),bases=typeof r.Bases==='string'?r.Bases:null;
 const placeholder=/^(?:X{7}-X|\?{7,8}-\?)$/.test(uwp);
 const starport=!placeholder&&/^[A-HXY]$/.test(uwp[0]||'')?uwp[0]:null;
 const gas=ehex(typeof r.PBG==='string'?r.PBG[2]:null);
 const sourceZone=typeof r.Zone==='string'?r.Zone.toUpperCase():null;
 const zone=['A','U'].includes(sourceZone)?'A':['R','F'].includes(sourceZone)?'R':['','-','G'].includes(sourceZone)?'':null;
 return {starport,gasGiants:gas<0?null:gas,bases,naval:bases===null||bases==='?'?null:!(/^Zh/.test(r.Allegiance||'')&&bases==='KM')&&/[NK]/.test(bases),scout:bases===null||bases==='?'?null:bases.includes('S'),zone,zoneName:zone==='A'?'Amber':zone==='R'?'Red':zone===''?'Safe':'Not supplied'};
}
const ringed=(x,y)=>`<g class="symbol-gas-giant" transform="translate(${x} ${y}) rotate(-25)"><circle r="3.1"/><ellipse rx="7" ry="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/></g>`;
const bracket=(x,y)=>`<path class="symbol-selection" d="M ${x-6} ${y-11} h -5 v 5 M ${x+6} ${y-11} h 5 v 5 M ${x-6} ${y+11} h -5 v -5 M ${x+6} ${y+11} h 5 v -5" fill="none" stroke="#eaf5ff" stroke-width="1.5"/>`;
export function worldSymbols(world,x,y,{close=false,selected=false,actual=false,scale=50}={}){
 const f=worldMapFacts(world),parts=[];
 if(close&&!world.emptySpace){
  if(f.zone)parts.push(`<path class="symbol-zone ${f.zone==='A'?'zone-amber':'zone-red'}" d="M ${x-28} ${y+6} A 29 29 0 1 1 ${x+28} ${y+6}" fill="none" stroke="${f.zone==='A'?'#f5bd6c':'#ff959e'}" stroke-width="1.7"/>`);
  if(f.starport)parts.push(`<text class="symbol-starport" x="${x}" y="${y-16}" text-anchor="middle">${esc(f.starport)}</text>`);
  if(f.gasGiants>0)parts.push(ringed(x+19,y-2));
  if(f.naval)parts.push(`<text class="symbol-naval" x="${x-20}" y="${y-3}" text-anchor="middle">★</text>`);
  if(f.scout)parts.push(`<path class="symbol-scout" d="M ${x-20} ${y+1} l -4 7 h 8 Z"/>`);
 }
 if(selected&&scale>=24)parts.push(bracket(x,y));
 if(actual&&close)parts.push(`<path class="symbol-ship" d="M ${x+13} ${y+8} l -4 9 4 -3 4 3 Z" fill="#62d3dd"/>`);
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
  [icon(bracket(0,0)),'Selected world']
 ];
 return '<section class="map-key" aria-label="Map key"><h3>Map key <span>Symbols at 240%</span></h3><ul>'+entries.map(([symbol,label])=>'<li>'+symbol+'<span>'+label+'</span></li>').join('')+'</ul><p class="help">Shown symbols use published data. Other base types are listed above. Missing data is not proof of absence. Political borders show allegiance territory, not travel zones.</p></section>';
}
