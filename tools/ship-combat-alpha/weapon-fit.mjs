import {normalizeWeaponTech,weaponTechReason,WEAPON_TECH_OPTIONS,WEAPON_TECH_PROFILES} from './weapon-tech.mjs';
import {decimal,add,multiply,numeric} from './power-arithmetic.mjs';
// Bounded setup facts. High Guard Update 2022 pp26,28–31,36,81; Core Update2022 pp167–168,184.
// No attack, damage, reload timing or salvo resolution.
export const WEAPON_TYPES=Object.freeze([
 ['Beam laser',4,'energy',10],['Pulse laser',4,'energy',9],['Laser drill',4,'energy',8],['Particle beam',8,'energy',12],['Plasma gun',6,'energy',11],['Fusion gun',12,'energy',14],['Missile rack',0,'missile',7],['Sandcaster',0,'sand',9],['Railgun',2,'railgun',10]
].map(([name,power,ammo,tl])=>({name,power,ammo,tl})));
export const BARBETTE_TYPES=Object.freeze([['Beam laser barbette',12,'energy',10],['Fusion barbette',20,'energy',12],['Ion cannon',10,'energy',12],['Missile barbette',0,'missile',7],['Particle barbette',15,'energy',11],['Plasma barbette',12,'energy',11],['Pulse laser barbette',12,'energy',9],['Railgun barbette',5,'railgun',10],['Torpedo barbette',2,'torpedo',7]].map(([name,power,ammo,tl])=>({name,power,ammo,tl})));
export const MISSILE_TYPES=Object.freeze(['Unknown','Standard','Advanced','Antimatter','Anti-Torpedo','Decoy','Fragmentation','Ion','Jumpbreaker','Long Range','Multi-Warhead','Nuclear','Ortillery','Shockwave']);
export const MOUNT_KINDS=Object.freeze(['turret','fixed','barbette','bay','unknown']);
// Catalogue rows may expand a published group into mount-id-1, mount-id-2, ... .
// Accept that link only with a bounded source quantity and an unchanged matching fit.
export function publishedMount(w,design){const mounts=design?.record?.published?.mounts??[],exact=mounts.find(m=>m.id===w.id);if(exact)return exact;const match=mounts.filter(m=>{const suffix=w.id.startsWith(m.id+'-')?w.id.slice(m.id.length+1):'';return /^[1-9][0-9]*$/.test(suffix)&&m.quantity!=null&&Number(suffix)<=m.quantity&&(w.fit||w.name===m.name&&w.type===m.fit&&w.count===m.fittedCount);});return match.length===1?{...match[0],quantity:1}:null;}
export function mountKind(w){if(w.fit)return w.fit.kind;const n=w.name??'';return /barbette/i.test(n)?'barbette':/bay/i.test(n)?'bay':/turret/i.test(n)?'turret':/fixed/i.test(n)?'fixed':'unknown';}
export function weaponFact(type,kind='turret'){return (kind==='barbette'?BARBETTE_TYPES:WEAPON_TYPES).find(w=>w.name.toLowerCase()===type?.toLowerCase())??null;}
export function ammoKind(type){return /sandcaster/i.test(type)?'sand':/torpedo/i.test(type)?'torpedo':/missile/i.test(type)?'missile':/railgun/i.test(type)?'railgun':null;}
const optionalNumber=(v,label)=>{if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)throw Error(label+' must be a nonnegative number.');return v;};
export function normalizeWeaponFit(v){
 if(v==null)return null;if(v.version!==1||!MOUNT_KINDS.includes(v.kind)||!['core2022','highguard2022','unknown'].includes(v.rules))throw Error('Choose a valid mount and rules basis.');
 if(!Array.isArray(v.slots)||v.slots.length!==4||v.slots.some(x=>x!==null&&(typeof x!=='string'||!x.trim()||x.length>100)))throw Error('Record four optional weapon slots.');
 const slots=v.slots.map(x=>x?.trim()??null),count=slots.filter(Boolean).length;if(!count)throw Error('Fit at least one weapon or remove the mount.');
 const max=v.kind==='turret'?4:v.kind==='fixed'?3:1;if(count>max)throw Error('This mount class does not support that many slots.');
 if(!MISSILE_TYPES.includes(v.missileType??'Unknown'))throw Error('Choose a listed missile type.');
 const quantity=v.quantity==null?null:v.quantity;if(quantity!=null&&(!Number.isSafeInteger(quantity)||quantity<1||quantity>32))throw Error('Mount quantity must be 1 to 32, or unknown.');
 const extra={};if(v.tech!==undefined){if(!Array.isArray(v.tech)||v.tech.length!==4)throw Error('Record tech options for four slots.');extra.tech=v.tech.map(normalizeWeaponTech);if(extra.tech.some((t,i)=>t&&!slots[i]))throw Error('An empty slot cannot have tech options.');}
 if(v.powerMode!==undefined){if(!['recorded','calculated'].includes(v.powerMode))throw Error('Choose a valid weapon Power basis.');extra.powerMode=v.powerMode;extra.recordedPower=optionalNumber(v.recordedPower,'Recorded weapon Power');}
 return {...extra,version:1,kind:v.kind,rules:v.rules,slots,quantity,powerOverride:optionalNumber(v.powerOverride,'Mount Power override'),missileType:v.missileType??'Unknown'};
}
export function turretName(count){return ['','Single turret','Double turret','Triple turret','Quad turret'][count]??'Turret';}
export function validateWeaponFits(design){
 const fits=(design.record?.weapons??[]).filter(w=>w.fit),small=design.tons<100;let upgraded=0;
 for(const w of fits){const f=w.fit,count=f.slots.filter(Boolean).length;if(small&&['fixed','turret'].includes(f.kind)&&count>1)throw Error('A Firmpoint supports one weapon; small craft cannot fit double, triple or quad turrets.');if(small&&f.kind==='turret')upgraded+=f.quantity??1;if(small&&f.kind==='barbette'&&design.tons<70)throw Error('A barbette requires three Firmpoints.');
  const pools=weaponPools(w,design);if(pools.length===1&&pools[0].capacity!=null&&w.ammunition!=null&&w.ammunition>pools[0].capacity)throw Error('Initial loaded ammunition exceeds fitted capacity.');
  const tl=f.kind==='turret'?[0,7,8,9,12][count]:0;if(design.record.tl!=null&&design.record.tl<tl)throw Error(turretName(count)+' requires TL'+tl+'.');
  for(const [i,type] of f.slots.entries()){if(!type)continue;const fact=weaponFact(type,f.kind),tech=f.tech?.[i],profile=tech?WEAPON_TECH_PROFILES[tech.profile]:null,required=fact?fact.tl+(profile?.tl??0):null;if(fact&&design.record.tl!=null&&design.record.tl<required)throw Error(type+' requires TL'+required+'.');}
 }
 if(small&&upgraded>1)throw Error('Only one Firmpoint may be upgraded to a turret.');
 if(fits.length){const costs=(design.record.weapons??[]).map(w=>{const m=publishedMount(w,design),kind=mountKind(w),quantity=w.fit?w.fit.quantity:m?.quantity;if(quantity==null||kind==='unknown'||kind==='bay')return null;return quantity*(small&&kind==='barbette'?3:1);});if(costs.every(x=>x!=null)&&costs.reduce((a,b)=>a+b,0)>(small?design.tons<35?1:design.tons<70?2:3:Math.floor(design.tons/100)))throw Error('Weapon mounts exceed available '+(small?'Firmpoints.':'Hardpoints.'));}

}
export function mountPowerReport(w,design){
 const unknown=reason=>({value:null,reason}),f=w.fit;if(!f)return unknown('No structured weapon fit is recorded.');
 if(f.powerOverride!=null)return {value:f.powerOverride,reason:'Manual total Power override retained.'};
 if(f.powerMode==='recorded')return {value:f.recordedPower??null,reason:f.recordedPower==null?'Recorded Power is unknown; choose calculated fit or enter a verified override.':'Recorded Power retained; choose calculated fit to apply changed options.'};
 if(!['turret','fixed','barbette'].includes(f.kind))return unknown('Power for this mount class needs a verified record or manual override.');
 if(f.quantity==null)return unknown('Number of mounts in this group is unknown.');
 if(design?.tons==null)return unknown('Hull tonnage is unknown; Hardpoint / Firmpoint basis is unresolved.');
 const small=design.tons<100;if(small&&f.rules!=='highguard2022')return unknown('Small-craft Power needs the High Guard Firmpoint rules basis.');
 let sum=decimal(f.kind==='turret'?(f.slots.filter(Boolean).length===4?2:1):0);
 for(const [i,type] of f.slots.entries()){
  if(!type)continue;const fact=weaponFact(type,f.kind);if(!fact)return unknown('Slot '+(i+1)+': Power for “'+type+'” is unverified.');
  const tech=f.tech?.[i],reason=weaponTechReason(tech,fact,f.kind);if(reason)return unknown('Slot '+(i+1)+': '+reason);
  const adjustment=(tech?.options??[]).reduce((n,id)=>n+(WEAPON_TECH_OPTIONS.find(o=>o.id===id)?.power??0),0);
  if(small&&adjustment)return unknown('Slot '+(i+1)+': combined Firmpoint and tech Power rounding is unverified; use a recorded value or manual override.');
  const power=small?decimal(Math.ceil(fact.power*.75)):multiply(decimal(fact.power),add(decimal(1),decimal(adjustment)));
  sum=add(sum,power);
 }
 return {value:numeric(multiply(decimal(f.quantity),sum)),reason:'Calculated mount baseline plus fitted weapon Power. High Guard 2022 pp26–31,70–72; tech adjustments are additive.'};
}
export function mountPower(w,design){return mountPowerReport(w,design).value;}
export function weaponPools(w,design){
 const kind=mountKind(w),f=w.fit,types=f?f.slots.filter(Boolean):[w.type],rules=f?.rules??(/High Guard/i.test(design?.source?.book??'')?'highguard2022':/Core Rulebook/i.test(design?.source?.book??'')?'core2022':'unknown'),small=design?.tons<100,counts={};
 for(const t of types){const k=ammoKind(t);if(k)counts[k]=(counts[k]??0)+(f?1:publishedMount(w,design)?.fittedCount??w.count??1);}
 return Object.entries(counts).map(([ammo,count])=>{let capacity=null,basis='Capacity unverified';
  if(ammo==='missile'&&kind==='turret'&&!small){capacity=12;basis='Core2022 p167 / High Guard2022 p28: shared turret load';}
  if(ammo==='missile'&&small&&['turret','fixed'].includes(kind)&&rules==='highguard2022'){capacity=4;basis='High Guard2022 p28: Firmpoint rack';}
  if(ammo==='sand'&&kind==='turret'&&!small&&rules==='core2022'){capacity=20;basis='Core2022 p168: shared turret load';}
  if(ammo==='sand'&&!small&&['fixed','turret'].includes(kind)&&rules==='highguard2022'){capacity=20*count;basis='High Guard2022 p29: 20 per Hardpoint-mounted sandcaster';}
  if(ammo==='sand'&&small&&['fixed','turret'].includes(kind)&&rules==='highguard2022'){capacity=4;basis='High Guard2022 p29: Firmpoint sandcaster';}
  if(kind==='barbette'&&ammo==='missile'){capacity=25;basis='High Guard2022 p31: missile barbette';}
  if(kind==='barbette'&&ammo==='torpedo'){capacity=3;basis='High Guard2022 p31: torpedo barbette';}
  if(kind==='turret'&&ammo==='railgun'&&rules==='highguard2022'){capacity=12;basis='High Guard2022 p29: attacks, not individual projectiles';}
  const quantity=f?f.quantity:publishedMount(w,design)?.quantity??null;if(quantity!=null&&capacity!=null)capacity*=quantity;else if(quantity==null)capacity=null;
  return {id:w.id+'-'+ammo,mountId:w.id,name:w.name,kind:ammo,capacity,basis,unit:ammo==='sand'?'canisters':ammo==='railgun'?'attacks':'rounds',missileType:f?.missileType??'Unknown'};
 });
}
export function fittedRequirement(row,design){
 const weapons=design?.record?.weapons??[];if(row.basis==='manual override'||!weapons.some(w=>w.fit))return row;
 const key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=weapons.filter(w=>key(w.name)===key(row.name)||key(w.id)===key(row.name)||key(publishedMount(w,design)?.name??'')===key(row.name));
 const group=/^(weapons|weaponry|armament)$/i.test(row.name)?weapons:matches.length===1&&matches[0].fit?matches:null;
 if(!group)return row;
 const values=group.map(w=>w.fit?mountPower(w,design):null);
 return {...row,source:null,sourceReference:{...row},power:values.some(x=>x==null)?null:values.reduce((a,b)=>a+b,0),basis:'Calculated customized fit. Published requirement retained in original design; unknown components remain unknown.'};
}
