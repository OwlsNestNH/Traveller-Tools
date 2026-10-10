import {parseUWP} from './rules.mjs?v=closer-map-zoom-20261010-35';
const API='https://travellermap.com/api/';
const MILIEU='M1105';
async function get(path,params,{signal}={}){const url=new URL(path,API);url.searchParams.set('milieu',MILIEU);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));const response=await fetch(url,{headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!response.ok)throw Error('Traveller Map returned '+response.status);return response.json();}
// Traveller Map World.cs treats Unabsorbed (U) as Amber and Forbidden (F) as Red.
// Normalize API data only; saved referee overrides and historical audits stay intact.
export function normalize(w){if(!Number.isInteger(w.WorldX)||!Number.isInteger(w.WorldY)||!w.Sector||!/^\d{4}$/.test(w.Hex))throw Error('Traveller Map world is missing coordinates');return {id:w.WorldX+','+w.WorldY,name:w.Name||w.Hex,sector:w.Sector,hex:w.Hex,x:w.WorldX,y:w.WorldY,uwp:w.UWP,zone:['A','U'].includes(String(w.Zone||'').toUpperCase())?'Amber':['R','F'].includes(String(w.Zone||'').toUpperCase())?'Red':'Safe',gasGiants:w.PBG&&w.PBG[2]!=='?'?parseInt(w.PBG[2],16):null,raw:structuredClone(w)};}
export async function loadWorld(sector,hex){if(!sector.trim()||!/^\d{4}$/.test(hex))throw Error('Enter a sector and four-digit hex');const data=await get('jumpworlds',{sector,hex,jump:0});if(!Array.isArray(data.Worlds)||!data.Worlds.length)throw Error('No world at that location');return normalize(data.Worlds[0]);}
export async function nearby(world,radius=6){const data=await get('jumpworlds',{x:world.x,y:world.y,jump:radius});if(!Array.isArray(data.Worlds))throw Error('Invalid world-list response');return data.Worlds.map(normalize);}
export function distance(a,b){const az=a.y-Math.floor(a.x/2),bz=b.y-Math.floor(b.x/2),dx=a.x-b.x,dz=az-bz;return Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dx+dz));}
export function fuel(world,ship,data){if(world.emptySpace)return false;if(world.fuelOverride===true)return true;if(world.fuelOverride===false)return false;try{const u=parseUWP(world.overrideUWP||world.uwp,data);if(['A','B','C','D'].includes(u.starport))return true;return !!ship.scoops&&(world.gasGiants>0||world.accessibleWater===true||(['D','E'].includes(u.starport)&&u.hydrographics>0));}catch{return false;}}
export function plan(worlds,stops,ship,data){if(stops.length<2)throw Error('Choose an origin and destination');const all=Object.values(worlds).sort((a,b)=>a.id.localeCompare(b.id));if(all.length>1600)throw Error('Route search exceeds 1,600 loaded worlds. Plan shorter segments.');const result=[];for(let leg=1;leg<stops.length;leg++){const from=worlds[stops[leg-1]],to=worlds[stops[leg]];if(!from||!to)throw Error('Load every mandatory stop first');if(from.id===to.id){if(!result.length)result.push(from.id);continue;}const best=new Map([[from.id,{jumps:0,length:0,legs:[],path:[from.id]}]]),queue=[from.id],visited=new Set();const compare=(a,b)=>{if(a.jumps!==b.jumps)return a.jumps-b.jumps;for(let i=0;i<a.legs.length;i++){if(a.legs[i]!==b.legs[i])return b.legs[i]-a.legs[i];}return a.path.join('|').localeCompare(b.path.join('|'));};while(queue.length){queue.sort((a,b)=>compare(best.get(a),best.get(b)));const id=queue.shift();if(visited.has(id))continue;visited.add(id);if(id===to.id)break;const at=best.get(id);for(const w of all){const d=distance(worlds[id],w);if(!d||d>ship.jump||visited.has(w.id))continue;const option={jumps:at.jumps+1,length:at.length+d,legs:[...at.legs,d],path:[...at.path,w.id]};if(!best.has(w.id)||compare(option,best.get(w.id))<0){best.set(w.id,option);queue.push(w.id);}}}if(!best.has(to.id))throw Error('No valid connection from '+from.name+' to '+to.name+' within the loaded search area (12 parsecs around each requested stop).');const path=best.get(to.id).path;result.push(...(result.length?path.slice(1):path));}return result;}

const catalogCache=new Map();
function cached(key,loader){if(!catalogCache.has(key)){const p=loader().catch(e=>{catalogCache.delete(key);throw e;});catalogCache.set(key,p);}return catalogCache.get(key);}
export function subsectorForHex(hex){
 if(!/^[0-9]{4}$/.test(hex))throw Error('Invalid world hex');
 const x=Number(hex.slice(0,2)),y=Number(hex.slice(2));
 if(x<1||x>32||y<1||y>40)throw Error('World hex is outside its sector');
 return String.fromCharCode(65+Math.floor((x-1)/8)+4*Math.floor((y-1)/10));
}
export function sectors(){return cached('sectors',async()=>{
 const data=await get('universe',{requireData:1});
 if(!Array.isArray(data.Sectors))throw Error('Invalid sector list');
 const unique=new Map();
 for(const s of data.Sectors.filter(s=>s.Names?.[0]?.Text&&(!s.Milieu||s.Milieu===MILIEU))){
  const name=s.Names[0].Text.trim(),key=name.toLowerCase(),aliases=s.Names.map(n=>n.Text).concat(s.Abbreviation||'');
  if(unique.has(key))unique.get(key).aliases=[...new Set([...unique.get(key).aliases,...aliases])];
  else unique.set(key,{name,aliases,x:s.X,y:s.Y});
 }
 return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name));
});}
function sectorSubsectors(metadata){return Array.from({length:16},(_,i)=>{const index=String.fromCharCode(65+i),name=metadata.Subsectors?.find(s=>s.Index===index)?.Name?.trim();return {index,name:name||'Subsector '+index,mapName:name||null};});}
function parseSectorCatalog(sector,metadata,table){
 if(typeof table!=='string')throw Error('Invalid world list');
 const lines=table.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));
 const header=lines.shift()?.split('\t'),hexIndex=header?.indexOf('Hex'),nameIndex=header?.indexOf('Name');
 if(hexIndex<0||nameIndex<0||!header)throw Error('World list is missing names or hexes');
 const worlds=lines.map(l=>l.split('\t')).map(row=>({name:row[nameIndex]||row[hexIndex],hex:row[hexIndex]})).filter(w=>/^\d{4}$/.test(w.hex)).map(w=>({...w,sector,subsector:subsectorForHex(w.hex)})).sort((a,b)=>a.name.localeCompare(b.name)||a.hex.localeCompare(b.hex));
 return {subsectors:sectorSubsectors(metadata),worlds,metadata};
}
export function sectorCatalog(sector){return cached('sector:'+sector,async()=>{
 const [metadata,table]=await Promise.all([get('metadata',{sector}),get('sec',{sector,type:'TabDelimited',metadata:0})]);
 return parseSectorCatalog(sector,metadata,table);
});}
// Overview retention belongs to its bounded viewport cache, not the picker cache.
// Sequential requests keep two overview jobs to at most two active HTTP requests.
export async function sectorOverview(sector,{includeWorlds=true,metadata=null,onMetadata=null}={}){
 metadata??=await get('metadata',{sector});
 const partial={subsectors:sectorSubsectors(metadata),metadata};
 onMetadata?.(partial);
 if(!includeWorlds)return partial;
 const table=await get('sec',{sector,type:'TabDelimited',metadata:0});
 return parseSectorCatalog(sector,metadata,table);
}


export async function loadMapHex(x,y,anchor){
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw Error('Invalid hex coordinates');
 const data=await get('jumpworlds',{x,y,jump:0});if(!Array.isArray(data.Worlds))throw Error('Unable to check this hex. Try again.');
 const hit=data.Worlds.find(w=>w.WorldX===x&&w.WorldY===y);if(hit)return normalize(hit);
 const hx=Number(anchor.hex.slice(0,2))+x-anchor.x,hy=Number(anchor.hex.slice(2))+y-anchor.y;
 const hex=String(((hx-1)%32+32)%32+1).padStart(2,'0')+String(((hy-1)%40+40)%40+1).padStart(2,'0');
 return {id:x+','+y,x,y,hex,sector:hx>=1&&hx<=32&&hy>=1&&hy<=40?anchor.sector:'Empty space (global '+x+', '+y+')',name:'Empty hex '+hex,emptySpace:true,uwp:'X000000-0',zone:'Safe',gasGiants:0};
}

// Official SearchHandler supports types=worlds and caps results at 160, with no
// paging. Search worlds carry sector/hex, not subsector names: join metadata.
// https://github.com/inexorabletash/travellermap/blob/main/server/api/SearchHandler.cs
export async function searchWorlds(query,{signal}={}){
 query=String(query).trim();
 if(!query)return {worlds:[],limited:false,missingNames:0};
 const data=await get('search',{q:query,types:'worlds'},{signal});
 if(!Array.isArray(data.Results?.Items))throw Error('Invalid planet-search response');
 const unique=new Map();
 for(const item of data.Results.Items){
  const w=item.World;if(!w)continue;
  if(typeof w.Name!=='string'||typeof w.Sector!=='string'||!w.Name.trim()||!w.Sector.trim()||!Number.isInteger(w.SectorX)||!Number.isInteger(w.SectorY)||!Number.isInteger(w.HexX)||!Number.isInteger(w.HexY))throw Error('Invalid planet-search location');
  const hex=String(w.HexX).padStart(2,'0')+String(w.HexY).padStart(2,'0'),subsector=subsectorForHex(hex),sector=w.Sector.trim();
  unique.set(w.SectorX+','+w.SectorY+'|'+hex,{name:w.Name,sector,hex,subsector,sectorX:w.SectorX,sectorY:w.SectorY});
 }
 const worlds=[...unique.values()],names=new Map(),key=w=>w.sectorX+','+w.sectorY,pending=[...new Map(worlds.map(w=>[key(w),w])).values()];
 // Keep global searches polite even when a broad name spans many sectors.
 async function worker(){while(pending.length){
  signal?.throwIfAborted();const w=pending.shift(),id=key(w);
  try{names.set(id,sectorSubsectors(await cached('metadata-coordinates:'+id,()=>get('metadata',{sx:w.sectorX,sy:w.sectorY}))));}catch{names.set(id,null);}
 }}
 await Promise.all(Array.from({length:Math.min(4,pending.length)},worker));signal?.throwIfAborted();
 let missingNames=0;
 for(const w of worlds){const name=names.get(key(w))?.find(s=>s.index===w.subsector)?.mapName;w.subsectorName=name||'Subsector '+w.subsector+' (name unavailable)';if(!name)missingNames++;}
 const exact=w=>w.name.toLowerCase()===query.toLowerCase()?0:1;
 worlds.sort((a,b)=>exact(a)-exact(b)||a.name.localeCompare(b.name)||a.sector.localeCompare(b.sector)||a.hex.localeCompare(b.hex));
 return {worlds,limited:data.Results.Count>=160||data.Results.Items.length>=160,missingNames};
}
