import {weaponPools,MISSILE_TYPES,ammoKind} from './weapon-fit.mjs';
const KINDS=['missile','sand','torpedo','railgun','unknown'];
const number=(v,label)=>{if(v==null)return null;if(!Number.isSafeInteger(v)||v<0||v>1000000)throw Error(label+' must be a whole number from 0 to 1000000, or unknown.');return v;};
const text=(v,label,max=100)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid '+label+'.');return v;};
const id=v=>{if(typeof v!=='string'||!/^[-a-z0-9]{1,64}$/.test(v))throw Error('Invalid ammunition ID.');return v;};
export function inventoryFromShip(ship,design){
 if(ship.condition.ammunition){const result=structuredClone(ship.condition.ammunition),pools=(design?.record?.weapons??[]).flatMap(w=>weaponPools(w,design));for(const row of result.loaded){const p=pools.find(x=>x.id===row.id);if(p&&row.origin==='source-rule'){row.capacity=p.capacity;row.note=p.basis;}}for(const p of pools)if(!result.loaded.some(x=>x.id===p.id))result.loaded.push({...p,sourceCapacity:p.capacity,count:null,origin:'source-rule',note:p.basis});return normalizeAmmunition(result);}
 const loaded=(design?.record?.weapons??[]).flatMap(w=>{const pools=weaponPools(w,design),current=ship.condition.weapons?.find(x=>x.id===w.id),saved=current?current.ammunition:w.ammunition??null;return pools.map(p=>({...p,count:pools.length===1&&(p.capacity==null||saved==null||saved<=p.capacity)?saved:null,sourceCapacity:p.capacity,capacity:p.capacity,origin:'source-rule',missileType:p.missileType,note:saved!=null&&(pools.length!==1||p.capacity!=null&&saved>p.capacity)?'Legacy count '+saved+' retained in original weapon record; allocation unverified.':p.basis}));});
 const reserves=(design?.record?.published?.ammunitionStorage??[]).map((a,i)=>({id:'storage-'+i,name:a.name,kind:ammoKind(a.name)??'unknown',capacity:a.capacity,sourceCapacity:a.capacity,count:null,origin:'published-storage',missileType:'Unknown',note:'Published separate storage; current stock unknown.'}));
 return normalizeAmmunition({version:1,loaded,reserves});
}
export function normalizeAmmunition(v){
 if(v==null)return null;if(v.version!==1)throw Error('Unsupported ammunition inventory version.');
 const rows=(values,loaded)=>{if(!Array.isArray(values)||values.length>128)throw Error('Too many ammunition entries.');const result=values.map(r=>{if(!KINDS.includes(r.kind)||!MISSILE_TYPES.includes(r.missileType??'Unknown')||!['source-rule','published-storage','manual'].includes(r.origin))throw Error('Invalid ammunition basis or type.');const capacity=number(r.capacity,'Ammunition capacity'),count=number(r.count,'Current ammunition');if(capacity!=null&&count!=null&&count>capacity)throw Error(r.name+': current ammunition exceeds capacity.');return {id:id(r.id),...(loaded?{mountId:id(r.mountId)}:{}),name:text(r.name,'ammunition name'),kind:r.kind,capacity,sourceCapacity:number(r.sourceCapacity,'Original capacity'),count,origin:r.origin,missileType:r.missileType??'Unknown',note:typeof r.note==='string'?r.note.slice(0,400):''};});if(new Set(result.map(r=>r.id)).size!==result.length)throw Error('Ammunition IDs must be unique.');return result;};
 return {version:1,loaded:rows(v.loaded,true),reserves:rows(v.reserves,false)};
}
export function validateInventoryFit(inventory,design){
 if(!inventory)return;const pools=(design?.record?.weapons??[]).flatMap(w=>weaponPools(w,design));
 for(const row of inventory.loaded){const p=pools.find(x=>x.id===row.id);if(!p){if(row.count>0)throw Error('Unload '+row.name+' before removing its ammunition fit.');continue;}if(row.origin==='source-rule'&&p.capacity!=null&&row.count>p.capacity)throw Error('Unload '+row.name+' before reducing its fitted capacity.');}
}
export function reloadInventory(value,sourceId,targetId,amount){
 const v=normalizeAmmunition(value),from=v.reserves.find(x=>x.id===sourceId),to=v.loaded.find(x=>x.id===targetId);
 if(!from||!to||from.kind==='unknown'||from.kind!==to.kind)throw Error('Choose matching reserve and loaded ammunition.');
 if(from.kind==='missile'&&(from.missileType==='Unknown'||to.missileType==='Unknown'||from.missileType!==to.missileType))throw Error('Record matching missile types before reloading.');
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Reload a positive whole amount.');
 if(from.count==null||to.count==null||to.capacity==null)throw Error('Record reserve count, loaded count and loaded capacity first.');
 if(amount>from.count||to.count+amount>to.capacity)throw Error('Reload exceeds reserve stock or loaded capacity.');
 from.count-=amount;to.count+=amount;return normalizeAmmunition(v);
}
