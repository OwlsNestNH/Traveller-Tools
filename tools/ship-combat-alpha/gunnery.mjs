import {effectiveDesign} from './setup.mjs';
import {mountKind,publishedMount} from './weapon-fit.mjs';
import {isWrecked} from './wreck.mjs';
// Declaration records only. Core 2022 pp.168,171; low-to-high is a home rule.
const TYPES=['Beam laser','Pulse laser','Missile rack','Sandcaster'];
const canonical=s=>TYPES.find(t=>t.toLowerCase()===s?.trim().toLowerCase().replace(/lasers$/,'laser').replace(/racks$/,'rack').replace(/sandcasters$/,'sandcaster'))??null;
export function gunneryMounts(ship){
 const design=effectiveDesign(ship),out=[];
 for(const w of design?.record?.weapons??[]){if(mountKind(w)!=='turret')continue;
  const raw=w.fit?w.fit.slots.filter(Boolean):w.type.split(/[,/]/).map(x=>x.trim()),types=[...new Set(raw.map(canonical).filter(Boolean))],quantity=w.fit?w.fit.quantity:publishedMount(w,design)?.quantity??null;
  for(let unit=1;unit<=(quantity??1);unit++)out.push({id:w.id+':'+unit,mountId:w.id,unit,name:w.name+(quantity>1?' '+unit:''),types:quantity==null?[]:types,slots:w.fit?.slots??null,note:quantity==null?'Mount quantity unverified; Hold only.':types.length<new Set(raw).size?'Some weapon types are unsupported in this declaration stage.':!w.fit?'Recorded legacy fit; individual slot counts are not inferred.':'',status:ship.condition.weapons?.find(x=>x.id===w.id)?.status??'unknown'});
 }return out;
}
export function gunneryOrder(ships,initiatives){return [...initiatives].sort((a,b)=>a.initiative-b.initiative||a.tie-b.tie||(a.shipId<b.shipId?-1:a.shipId>b.shipId?1:0)).filter(e=>gunneryMounts(ships.find(s=>s.id===e.shipId)).length).map(e=>e.shipId);}
export const newGunnery=(ships,initiatives)=>({version:1,order:gunneryOrder(ships,initiatives),declarations:[]});
export const nextGunner=state=>state.workflow?.gunnery?.order[state.workflow.gunnery.declarations.length]??null;
export function weaponActions(type){return type==='Sandcaster'?['sand']:['Beam laser','Pulse laser'].includes(type)?['attack','point-defense']:type==='Missile rack'?['attack']:[];}
export const holdMounts=ship=>gunneryMounts(ship).map(m=>({mountId:m.id,weapon:null,action:'hold',targetId:null}));
function operator(ship,m){const c=ship.crew,a=c.roster?.assignments,station=c.gunnerStations?.find(s=>s.mountId===m.mountId);return a?.['mount:'+m.mountId]?.memberId??(station?'mount:'+m.mountId:c.mode==='detailed'||c.mode==='compact'&&c.activeDetails.includes('gunner')?a?.gunner?.memberId??(c.details.gunner?'gunner':null):m.id);}
export function normalizeDeclarations(rows,ship,ships,{commit=false}={}){
 const mounts=gunneryMounts(ship);if(!Array.isArray(rows)||rows.length!==mounts.length||new Set(rows.map(r=>r.mountId)).size!==rows.length)throw Error('Declare each turret exactly once.');const operators=new Set();
 return mounts.map(m=>{const r=rows.find(r=>r.mountId===m.id);if(!r)throw Error('Missing turret declaration.');if(r.action==='hold'){if(r.weapon!=null||r.targetId!=null)throw Error('Hold fire cannot allocate a weapon or target.');return {mountId:m.id,weapon:null,action:'hold',targetId:null};}
  if(!m.types.includes(r.weapon)||!weaponActions(r.weapon).includes(r.action))throw Error('Choose an installed weapon and supported action.');
  if(r.action==='attack'){if(r.targetId===ship.id||!ships.some(s=>s.id===r.targetId))throw Error('Choose another ship as target.');if(commit&&isWrecked(ships.find(s=>s.id===r.targetId)))throw Error('Choose an operable target before committing.');}else if(r.targetId!=null)throw Error('Defensive reservations protect this ship; do not allocate an attack target.');
  const op=operator(ship,m);if(op&&operators.has(op))throw Error('The same gunner cannot be allocated to multiple turret uses.');if(op)operators.add(op);if(commit){if(isWrecked(ship)||['offline','destroyed'].includes(m.status))throw Error('An inoperable ship or turret must hold fire.');if(!op)throw Error('Assign a gunner in ship setup, or hold fire.');}
  return {mountId:m.id,weapon:r.weapon,action:r.action,targetId:r.targetId??null};
 });
}
export function normalizeGunnery(value,ships,initiatives){
 const order=gunneryOrder(ships,initiatives);if(value==null)return newGunnery(ships,initiatives);
 if(value.version!==1||JSON.stringify(value.order)!==JSON.stringify(order)||!Array.isArray(value.declarations)||value.declarations.length>order.length)throw Error('Invalid gunnery declaration sequence.');
 const declarations=value.declarations.map((d,i)=>{if(d.shipId!==order[i])throw Error('Gunnery declarations must follow initiative order.');return {shipId:d.shipId,mounts:normalizeDeclarations(d.mounts,ships.find(s=>s.id===d.shipId),ships)};});return {version:1,order,declarations};
}
