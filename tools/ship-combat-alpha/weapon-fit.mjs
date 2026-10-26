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
 return {version:1,kind:v.kind,rules:v.rules,slots,quantity,powerOverride:optionalNumber(v.powerOverride,'Mount Power override'),missileType:v.missileType??'Unknown'};
}
export function turretName(count){return ['','Single turret','Double turret','Triple turret','Quad turret'][count]??'Turret';}
export function validateWeaponFits(design){
 const fits=(design.record?.weapons??[]).filter(w=>w.fit),small=design.tons<100;let upgraded=0;
 for(const w of fits){const f=w.fit,count=f.slots.filter(Boolean).length;if(small&&['fixed','turret'].includes(f.kind)&&count>1)throw Error('A Firmpoint supports one weapon; small craft cannot fit double, triple or quad turrets.');if(small&&f.kind==='turret')upgraded+=f.quantity??1;if(small&&f.kind==='barbette'&&design.tons<70)throw Error('A barbette requires three Firmpoints.');
  const pools=weaponPools(w,design);if(pools.length===1&&pools[0].capacity!=null&&w.ammunition!=null&&w.ammunition>pools[0].capacity)throw Error('Initial loaded ammunition exceeds fitted capacity.');
  const tl=f.kind==='turret'?[0,7,8,9,12][count]:0;if(design.record.tl!=null&&design.record.tl<tl)throw Error(turretName(count)+' requires TL'+tl+'.');
  for(const type of f.slots.filter(Boolean)){const fact=weaponFact(type,f.kind);if(fact&&design.record.tl!=null&&design.record.tl<fact.tl)throw Error(type+' requires TL'+fact.tl+'.');}
 }
 if(small&&upgraded>1)throw Error('Only one Firmpoint may be upgraded to a turret.');
 if(fits.length){const costs=(design.record.weapons??[]).map(w=>{const m=publishedMount(w,design),kind=mountKind(w),quantity=w.fit?w.fit.quantity:m?.quantity;if(quantity==null||kind==='unknown'||kind==='bay')return null;return quantity*(small&&kind==='barbette'?3:1);});if(costs.every(x=>x!=null)&&costs.reduce((a,b)=>a+b,0)>(small?design.tons<35?1:design.tons<70?2:3:Math.floor(design.tons/100)))throw Error('Weapon mounts exceed available '+(small?'Firmpoints.':'Hardpoints.'));}

}
export function mountPower(w,design){
 const f=w.fit;if(!f)return null;if(f.powerOverride!=null)return f.powerOverride;
 if(!['turret','fixed','barbette'].includes(f.kind)||f.quantity==null)return null;
 const small=design?.tons<100;if(small&&f.rules!=='highguard2022')return null;
 const facts=f.slots.filter(Boolean).map(x=>weaponFact(x,f.kind));if(facts.some(x=>!x))return null;
 const base=f.kind==='turret'?(facts.length===4?2:1):0;
 return f.quantity*(base+facts.reduce((sum,x)=>sum+(small?Math.ceil(x.power*.75):x.power),0));
}
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
