/* Traveller Vehicle Forge. Pure calculation engine; handbook page numbers are printed pages. */
(function(root){
'use strict';
const D=root.VEHICLE_DATA;
const clone=x=>JSON.parse(JSON.stringify(x));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const ceil=x=>Math.ceil(x-1e-9), round=x=>Math.floor(x+0.5);
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const find=(t,k,v)=>D[t].find(x=>x[k]===v);
const types=D.Type.filter(x=>!['Wind','Muscle'].includes(x.Type));
const features=D.FeatureEffect.filter(x=>x['Feature Effect']!=='Biotech');
const powers=clone(D.Power.filter(x=>x.Power!=='n/a'));
// Explicit corrections and editorial choices are documented in the source audit.
findPower('Muscle').CostP=-0.7;
findPower('Wind').xSpaces=-0.2;
function findPower(name){return powers.find(x=>x.Power===name)}
const options=D.Options.map(x=>{
 if(x.Name==='Sensor System (basic)')return {...x,CostU:2000};
 if(/^Landing Deck \((improved|advanced)\)$/.test(x.Name))return {...x,Costing:'S',_pages:'69–70'};
 if(x.Name.startsWith('Luxury Exterior'))return {...x,TL:0,CostP:x.Name.includes('13+')?5:x.CostP,_pages:'70',_category:'Exterior'};
 return x;
}).filter(x=>Number.isFinite(x.TL)&&x.Costing&& !/Custom|\+STR or DEX|Manipulator Arms \((small )?robot\)/i.test(x.Name));
for(const c of D.ShipComputer)options.push({Name:'Ship '+c['Ship Computer'],TL:c.TL,'F/%/S':'Fixed',FSpaces:ceil(c.Bandwidth/10),Costing:'U',CostU:c.Cost,Bonus:c.Bandwidth,Powered:'P',_source:c._source,_book:'Vehicle Handbook Update 2026',_pages:'92',Traits:`Bandwidth ${c.Bandwidth}; no TL price reduction`});
for(const [name,tl,spaces,cost] of [['Transceiver Encryption',6,0,4000],['Satellite Uplink',6,1,1000],['Transceiver Tightbeam',8,0,2000]])options.push({Name:name,TL:tl,'F/%/S':'Fixed',FSpaces:spaces,Costing:'U',CostU:cost,Powered:'P',_source:'Handbook p59',_book:'Vehicle Handbook Update 2026',_pages:'59',_handbookOnly:true});
for(const o of [...options].filter(x=>x.Name.startsWith('Sensor System')))options.push({...o,Name:o.Name.replace(')',', underwater)'),CostU:o.CostU*2,Traits:`Underwater range ${o.Traits/2} km`,_pages:'60'});
for(const [Name,TL,CostS,page,source] of [['Docking Bay',3,12500,'86','Blank!M29:AA29'],['Hangar Bay',1,10000,'86–87','Blank!M30:AA30']])options.push({Name,TL,'F/%/S':'Fixed',FSpaces:1,Costing:'S',CostS,_source:source,_book:'Vehicle Handbook Update 2026',_pages:page,_category:'Utility',Traits:Name==='Docking Bay'?'Allocate ceil(4.4 × carried vehicle shipping tons) Spaces; fitted to a specific vehicle shape.':'Allocate 8 × carried vehicle shipping tons, rounded up; includes maintenance access.'});
options.push({Name:'Drone Control Helmet',TL:11,'F/%/S':'Fixed',FSpaces:0,Costing:'U',CostU:50000,_source:'Handbook p96',_book:'Vehicle Handbook Update 2026',_pages:'81, 96',_handbookOnly:true,_category:'Automation',Traits:'3 kg; control DM+1; integrated 50 km transceiver. DM−1 per 5,000 km to drone.'});
options.push({Name:'Auxiliary Fuel Tank (external hardpoint)',TL:5,Costing:'U',CostU:2500,FSpaces:0,_source:'Handbook p102',_book:'Vehicle Handbook Update 2026',_pages:'102',_handbookOnly:true,_category:'Exterior',Traits:'Each unit is one external tank Space (250 kg). Cr500 tank plus Cr2000 hardpoint. Range gain = 2.5 × tank Spaces / (nominal Spaces + tank Spaces).'});
for(const o of [...options].filter(x=>x.Name.startsWith('Computer/')||x.Name.startsWith('Ship ')))options.push({...o,Name:o.Name+'/fib',_fibreBase:o.Name,_pages:'92',Traits:[o.Traits,'Fibre-optic protection against EMP, radiation and ion weapons'].filter(Boolean).join('; ')});
for(const [name,source] of [['Transceiver Encryption','Blank!V18:V19'],['Transceiver Tightbeam','Blank!Q18:Q19'],['Satellite Uplink','Blank!U18:U19']])Object.assign(options.find(o=>o.Name===name),{_source:source,_handbookOnly:false});
Object.assign(options.find(o=>o.Name==='Digger Blade'),{FSpaces:1,Costing:'S',CostS:2500,_pages:'69'});
for(const o of [...options].filter(x=>x.Name.startsWith('Transceiver,')||/^Computer\/\d+$/.test(x.Name)))for(const [stage,delta,mult] of [['early prototype',2,11],['prototype',1,6]])options.push({...o,Name:o.Name+' ('+stage+')',TL:o.TL-delta,_prototypeBase:o.Name,_prototypeMultiplier:mult,_prototypeEarly:delta===2,_pages:'57, '+(o.Name.startsWith('Computer')?'92':'59'),Traits:String(o.Traits||'')});
options.push({Name:'Robot Manipulator Arm',TL:7,Costing:'U',CostU:0,Powered:'P',_category:'Exterior',_source:'Options!B156:Z157; Robot Handbook pp25–27; Vehicle Handbook Update 2026 p67',_handbookOnly:true,_book:'Robot Handbook',_pages:'25–27; Vehicle Handbook Update 2026 p67',_robotArm:true,Traits:'Configure Size and characteristic increases. Up to four arms per vehicle Space; the one-Space vehicle exception is applied across all installed arms.'});
const weapons=D.Weapons.filter(x=>x.Bio!=="B"&&Number.isFinite(x.TL)&&Number.isFinite(x.Cost)&&x.Cost>0&&Number.isFinite(x.Tons)).map(w=>w.Weapon.startsWith('Anti-Missile System')?{...w,Pwr:'P',_book:'Vehicle Handbook Update 2026',_pages:'73–74'}:w);
for(const [Weapon,flag] of [['No weapon installed','_empty'],['Personal weapon (gunport)','_personal']])weapons.push({Weapon,[flag]:true,TL:0,Cost:0,Tons:0,Crew:0,Damage:'—',Rangekm:0,Traits:flag==='_empty'?'Reserved mount capacity; no weapon fitted':'Personal weapon supplied by occupant',_source:'Handbook pp102–103',_book:'Vehicle Handbook Update 2026',_pages:'102–103'});
const ammunition=[['Standard',0,1,'Standard weapon profile'],['Aerosol',7,3,'Blast 12; reduces laser damage through the cloud'],['APDS',5,5,'Range +10%; damage −1 per die; extra AP = 3 × dice'],['Armour Piercing',4,4,'Extra AP = damage dice'],['Baton',5,2,'Range −25%; half damage is Stun; removes AP and Blast'],['Bomblet',7,4,'3D damage; Blast 20; artillery and bombs only'],['Canister',2,2,'20 m range; 4D damage; Blast 20'],['Chemical',5,5,'Special gas effects; Blast 12'],['Concussion',7,1,'4D Stun'],['Directed Plasma',15,10,'+1D damage; AP ×3; Blast 0'],['Electromagnetic Pulse',9,10,'No direct damage; Blast 20; affects electronics'],['Extended Range',7,3,'Range +25%; damage −1D'],['Flare',4,1,'No damage; Blast 100 illumination'],['Fragmentation',6,1,'4D damage; Blast ×2 (or Blast 10 if absent)'],['Foam',9,5,'Immobilisation; special effects'],['Fuel-air',7,8,'1DD damage; Blast ×3; requires atmospheric oxygen'],['Guided',7,6,'Smart; small-arms TL restrictions apply'],['HEAP',5,8,'Range −25%; +1D; special AP based on original damage'],['Incendiary',8,3,'Fire; Blast equals damage dice'],['Net',8,3,'Range −50%; immobilisation; Blast ×0.5'],['Neurotoxin',5,10,'Special gas effects; Blast 12'],['Nuclear',6,20,'6DD; Blast 500; Radiation; calibre restrictions at TL13'],['Plasma',15,10,'+1D; AP ×2; Blast ×2 (or Blast 3 if absent)'],['Smoke',4,1,'No damage; Blast 12; visual concealment'],['Solid Shot',5,2,'Range −25%; extra AP = half damage dice, rounded up'],['Thermal Smoke',7,2,'Blast 12; visual and infrared concealment'],['Tracer',5,2,'Accurate when firing bursts or automatic fire; detection DM+2']].map(([name,tl,multiplier,effect])=>({name,tl,multiplier,effect}));
const faces=['Forward','Aft','Port','Starboard','Dorsal','Ventral'];
const defaults={version:1,name:'Frontier utility rover',type:'Ground Vehicle',tl:9,spaces:12,power:'Powered',secondary:'none',extraPower:0,features:['Off-Roader'],speedMod:0,efficiency:0,fuel:0,hull:'Standard',armour:0,armourShift:[0,0,0,0,0,0],crew:1,passengers:3,crewSpace:1,passengerSpace:1,passengerGroups:[],sophont:1,cargo:4,gas:'Helium',depth:1,aux:[],equipment:[],weapons:[],control:'Control System (basic)',controlQuantity:1,unmodelledComponents:[],rail:'Rail (basic)',vacTube:false,drone:false,description:'',ruling:'table'};
const rules=[
 ['Size and volume','25–27','Whole Spaces; 1 Space cargo = 250 kg. Structures have twice their nominal Spaces. Size changes agility, armour volume and most primary speeds.'],
 ['Baseline and features','28–43','Type/TL eligibility, size limits, prerequisites and incompatible features are checked. Feature price changes add against the original chassis cost. AFV + Tracks incur one speed penalty.'],
 ['Power','44–48','Primary and secondary plants have separate sizes and minimums. Unpowered vehicles cannot add secondary power; structures are an exception. Nuclear output limits spacecraft systems.'],
 ['Performance','49–54','Faster and slower changes round separately for each step. TL limits speed and efficiency changes. Fuel and efficiency percentages add, after feature and power modifiers.'],
 ['Protection','55–56','Overall armour includes base protection; AFV triples the limit. Added armour costs use actual fractional volume while installed Spaces round up. Face transfers conserve armour.'],
 ['Systems','57–100','TL, power, life support sealing, grav prerequisites, software bandwidth and selected equipment restrictions are checked. Equipment with additional unimplemented construction rules is marked for review.'],
 ['Armament','101–105','Weapons total 100 kg per Space before a speed penalty and may never exceed 250 kg per Space. Mounts, crew, fire control, ammunition and nuclear power are budgeted.'],
 ['Scope','127–136','This builds new conventional vehicles. Biotech growth, post-construction refits, custom robot brains and combat simulation are not automated.']
];
const corrections=[
 ['Comfort-point accounting','Options!P111; P261; P281:P284','24, 83–85, 100','Entertainment contributes 0.1 CP per unit; a tour guide contributes 2 CP. Luxury treatment multiplies existing 1-CP accommodation Spaces without adding volume. The record shows overall comfort separately from seating allocation.'],
 ['Linked weapon volume','Weapons mass; mount quantities','25, 101, 104','The dedicated p104 rule permits pooling only when each weapon masses 125 kg or less. Heavier weapons round separately. This specific rule governs the more general mass wording on pp25 and 101.'],
 ['Workbook option omissions','Options!B186:O187; B275:O280','69–70','Restores landing-deck grades with blank Costing cells and luxury exteriors with blank TL cells. No minimum TL is specified for luxury exteriors. SOC13+ costs +500%, correcting worksheet +300%.'],
 ['Controls outside named tables','Blank!Q19; U19; V19; M29:AA30','59, 86–87','Encryption, tightbeam, satellite uplink, docking bays and hangars are explicit worksheet controls rather than Options rows. They are included separately.'],
 ['Variable equipment quantities','Options!B144:Z145; B177:Z177; B247:Z249','65–66, 69, 80–81','Tow hitch quantity means powered towed Spaces; life-support quantity means people; digger-blade quantity means installed Spaces, capped at 25% of the chassis.'],
 ['Basic sensor cost','Options!L32','60','Uses handbook Cr2000, correcting worksheet Cr5000. Underwater systems double that cost.'],
 ['Sensor customisations','Blank!Q21:V22; Z21:AA22','60','Includes hardened, high fidelity, range ×10/100/1000 and sensor mast. Independent cost multipliers compound as in the worksheet; fidelity and mast each add one Space per installed system.'],
 ['Fibre-optic computers','Blank!O25; AA25','92','Includes /fib variants of vehicle and ship computers: +50% of current computer cost, or Cr100 when the computer is free.'],
 ['Muscle power cost','Power!AN21','45','Worksheet −40%; handbook −70%. Uses −70%.'],
 ['Wind usable space','Power!AE20','46','Worksheet +30%; handbook +20%. Uses +20%.'],
 ['Airship lift gas TL','Type!C52:C55','29','Uses Hot Air TL3, Helium TL5, Hydrogen TL4 and Vacuum TL12.'],
 ['Airship TL5 range','Type!N18','29','Worksheet 4,000; table 6,000. Uses 6,000 before gas modifiers.'],
 ['Submersible speed and depth','Type!R10:T10; O27:Q27','33','Uses Slow at TL9–11 (the printed “9–1” is interpreted as 9–11); safe depth 300 m at TL6–8.'],
 ['Powered structures','Power!AF18','32 / 45','Handbook p32 says 25%; the dedicated p45 table and workbook say 30%. A visible selector chooses the ruling; default 30%.'],
 ['Rail wheels','Type!AE38','52','Worksheet subtracts a band; handbook gives equivalent ground-vehicle speed. Uses handbook baseline.'],
 ['Software bandwidth','Options!P77:P81; P94','93–95','Salvo Solution uses 2/4/6/8 bandwidth. Sensop/0 and Weaponry/0 each use 1.'],
 ['Feature eligibility','Features table','35–43','For conflicting summary lists, the dedicated feature text governs; AFV submersibles follow the availability matrix and type list.'],
 ['Feature range stacking','Blank!Q10','35','Follows the worksheet: multiply feature range factors; cost and stat changes are additive.'],
 ['Space rounding','Blank!Z6:Z7','25 / 44–48','Installed plant fractions round up; gained Spaces round down, subject to printed minimums. Workbook truncates some plant sizes.'],
 ['Spacecraft power','Blank!J7','44 / 105','Uses the detailed p44 total-output percentage rule; p105 gives a conflicting per-point shorthand.'],
 ['Half points on armour faces','Blank armour allocation','26 / 56','Half points round up per the general rounding rule. Transfers conserve the rounded starting pool.']
];
function baseType(name,tl){
 const t=find('Type','Type',name), r=find('TypeRange','Type',name);
 let speed=num(t[tl]),range=num(r[tl]);
 if(name==='Airship'&&tl===5)range=6000;
 if(name==='Submersible'&&tl>=9&&tl<=11)speed=3;
 return {...t,speed,range,terrain:r.Terrain,heavy:r.HeavyR};
}
function sizeFor(s){return D.SizeNumber.find(x=>s>=x.Bottom&&(!x.Top||s<=x.Top))||D.SizeNumber[0]}
function featureReasons(name,s){
 const f=features.find(x=>x['Feature Effect']===name); if(!f)return ['Unsupported feature'];
 const reasons=[], has=n=>s.features.some(x=>norm(x)===norm(n));
 let allowed=find('Features','Features',s.type)?.[name]==='X';
 if(name==='Open-Topped'&&s.type==='Submersible')allowed=true;
 if(!allowed)reasons.push(`Not available for ${s.type}`);
 if(s.tl<f.TL)reasons.push(`Requires TL${f.TL}`);
 if(f['Size Limit']==='Size 20+'&&s.spaces<20)reasons.push('Requires at least 20 Spaces');
 if(f['Size Limit']==='Size 1-3'&&s.spaces>3)reasons.push('Limited to 1–3 Spaces');
 for(const n of String(f.Incompatible).split(',').map(x=>x.trim().replace('Open Topped','Open-Topped').replace('Tracked','Tracks')))if(has(n))reasons.push(`Incompatible with ${n}`);
 // The incompatibility is symmetric even where one source row omits it.
 if(name==='Tracks'&&has('Rail Rider'))reasons.push('Incompatible with Rail Rider');
 if(f.Prerequisite==='Jet'&&!has('Jet Engines'))reasons.push('Requires Jet Engines');
 if(f.Prerequisite==='Powered'&&!isPowered(s))reasons.push('Requires a powered vehicle');
 if(name==='Unresponsive'&&s.spaces>=200)reasons.push('Already Unresponsive from size; no duplicate discount');
 return reasons;
}
function isPowered(s){return [s.power,s.secondary].some(x=>x&& !['none','Unpowered','Muscle','Wind'].includes(x))}
function bandwidth(o){if(/^Salvo Solution\//.test(o.Name))return num(o.Bonus)*2;if(/^(Sensop|Weaponry)\/0$/.test(o.Name))return 1;return num(o.Bonus)}
function category(o){if(o._category)return o._category;if(o.Name.startsWith('Ship '))return 'Automation';const r=num(o._source.match(/B(\d+)/)?.[1]);return r<53?'Core systems':r<115?'Automation':r<121?'Defence':r<205?'Exterior':r<240?'Defence':r<294?'Interior & comfort':r<340?'Utility':'Specialist & spacecraft'}
function optionBudget(o,q,s,custom={}){
 if(o._prototypeBase){const base=options.find(x=>x.Name===o._prototypeBase),v=optionBudget(base,1,{...s,tl:base.TL});return {...v,spaces:(v.spaces?(o._prototypeEarly?v.spaces*2:v.spaces):(o._prototypeEarly?2:1))*q,cost:v.cost*o._prototypeMultiplier*q};}
 if(o._robotArm){const size=custom.armSize??5,ds=custom.strIncrease??0,dd=custom.dexIncrease??0;return {spaces:ceil(q/4),cost:100*size*(1+ds*ds+2*dd*dd)*q,str:2*size-1+ds,dex:ceil(s.tl/2+1)+dd};}
 if(o._fibreBase){const base=optionBudget(options.find(x=>x.Name===o._fibreBase),q,s);return {...base,cost:base.cost===0?100*q:base.cost*1.5};}
 let unit=0;
 if(o['F/%/S']==='Percent')unit=Math.max(num(o.MinSpaces),ceil(num(o['%Spaces'])*s.spaces));
 else if(o['F/%/S']==='Sophont')unit=Math.max(num(o.MinSpaces),num(o.Sspaces)*s.sophont);
 else unit=Math.max(num(o.MinSpaces),num(o.FSpaces)||num(o.Sspaces));
 let spaces=ceil(unit*q);
 if(o.Name==='Satellite Uplink'&&s.tl>=8)spaces=0;
 if(/^Life Support \(/.test(o.Name))spaces=Math.max(1,ceil(q*(o.Name.includes('short')?0.05:0.2)));
 let cost=o.Costing==='V'?num(o.CostV)*s.spaces*q:o.Costing==='S'?num(o.CostS)*spaces:o.Costing==='P'?num(o.CostP)*baseType(s.type,s.tl).Cost*s.spaces*q:num(o.CostU)*q;
 if(/^Transceiver,|^Meson Communicator,|^Computer\/\d$/.test(o.Name)){
  const diff=s.tl-o.TL; const ratios=[1,.5,.25,.1,.05,.01,0];cost*=ratios[Math.max(0,Math.min(6,diff))];
  if(o.Name.startsWith('Meson'))spaces=ceil(spaces*ratios[Math.max(0,Math.min(6,diff))]);
  if(o.Name.startsWith('Computer/')){const free=[8,11,13,16,18,19,20,21][num(o.Bonus)];if(s.tl>=free)cost=0;}
 }
 if(o.Name.startsWith('Sensor System')){
  const boosts=Math.max(0,Math.min(3,num(custom.rangeBoost))),fidelity=custom.highFidelity===true,mast=custom.mast===true,hardened=custom.hardened===true;
  cost*=2**(boosts+Number(fidelity)+Number(mast)+Number(hardened));spaces+=q*(Number(fidelity)+Number(mast));
  const range=(o.Name.includes('underwater')?num(String(o.Traits).match(/[\d.]+/)?.[0]):num(o.Traits))*10**boosts;
  return {spaces,cost,range};
 }
 if(/^(Heavy )?Manipulator Arm \(/.test(o.Name))cost*=2**(num(custom.strIncrease)+num(custom.dexIncrease));
 return {spaces,cost};
}
function passengerSeating(s){
 return [{name:'Main passenger seats',count:s.passengers,space:s.passengerSpace},...(Array.isArray(s.passengerGroups)?s.passengerGroups:[])];
}
function validPassengerGroup(g){return !!g&&typeof g.name==='string'&&g.name.length<=100&&Number.isInteger(g.count)&&g.count>=0&&g.count<=1000000&&Number.isFinite(g.space)&&g.space>=0.25&&g.space<=100;}
function calculate(input){
 const s={...clone(defaults),...clone(input)},issues=[],ledger=[],notes=[];
 const issue=(code,message,page,level='error')=>{if(!issues.some(x=>x.code===code&&x.message===message))issues.push({code,message,page,level})};
 const line=(name,spaces,cost,source)=>ledger.push({name,spaces,cost,source});
 if(!Array.isArray(s.unmodelledComponents))issue('UNMODELLED','Unmodelled components must be a list.',57);else for(const item of s.unmodelledComponents)issue('UNMODELLED',String(item),57);
 if(!Number.isInteger(s.passengers)||s.passengers<0)issue('INPUT','Main passenger count must be a non-negative whole number.',25);
 const extraGroups=Array.isArray(s.passengerGroups)?s.passengerGroups:[];
 if(!Array.isArray(s.passengerGroups)||extraGroups.length>100||!extraGroups.every(validPassengerGroup))issue('PASSENGER_GROUP','Passenger groups need a label, whole non-negative count and 0.25–100 Spaces per person (maximum 100 groups).',24);
 const seating=passengerSeating(s).map(g=>validPassengerGroup(g)?g:{name:'Invalid passenger group',count:0,space:1});
 s.passengers=seating.reduce((sum,g)=>sum+g.count,0);
 const ints=['controlQuantity','tl','spaces','crew','passengers','cargo','speedMod','efficiency','fuel','extraPower','armour','depth'];
 for(const k of ints)if(!Number.isFinite(s[k])||!Number.isInteger(s[k]))issue('INPUT',`${k} must be a whole number.`,25);
 if(s.tl<0||s.tl>20)issue('TL','Tech Level must be 0–20.',27);
 if(s.spaces<1||s.spaces>1000000)issue('SIZE','Choose 1–1,000,000 nominal Spaces.',25);
 for(const k of ['crew','passengers','cargo','extraPower','armour'])if(s[k]<0)issue('NEGATIVE',`${k} cannot be negative.`,25);
 if(s.sophont<0.5||s.sophont>100||!Number.isFinite(s.sophont))issue('OCCUPANTS','Sophont size must be 0.5–100.',24);
 for(const k of ['crewSpace','passengerSpace'])if(s[k]<0.25||s[k]>100||!Number.isFinite(s[k]))issue('SEATING',`${k} must be 0.25–100 per occupant.`,24);
 if(!types.some(x=>x.Type===s.type))return {valid:false,issues:[{code:'TYPE',message:'Unknown vehicle type.',page:28,level:'error'}],ledger:[]};
 const t=baseType(s.type,Math.max(0,Math.min(20,s.tl))),size=sizeFor(s.spaces),b=t.Cost*s.spaces,has=n=>s.features.includes(n),powered=isPowered(s);
 if(new Set(s.features).size!==s.features.length)issue('DUPLICATE_FEATURE','Each construction feature may only be selected once.',35);
 if(s.tl<t.TL)issue('TYPE_TL',`${s.type} requires TL${t.TL}.`,28);
 const armour=D.Armour[Math.max(0,Math.min(20,s.tl))]||D.Armour[0];
 let capacity=s.type==='Structure'?2*s.spaces:s.spaces,baseCost=b,agility=t.Agility+size.Agility,hull=t.Hull*s.spaces,shipping=t.Shipping*s.spaces,range=t.range*(s.spaces>=20?t.heavy:1),speed=t.speed+(['Aeroplane','Submersible'].includes(s.type)?0:size.Speed),pp=0;
 const plant=(name,secondary=false)=>{
  if(name==='none')return {range:0,spaces:0,cost:0};
  const p=findPower(name);if(!p){issue('POWER','Unknown power system.',44);return {range:0,spaces:0,cost:0}}
  let used=0,cost=0,add=0;
  if(s.tl<p.TL&&!(s.type==='Structure'&&name==='Grid Power'&&s.tl>=3))issue('POWER_TL',`${name} requires TL${p.TL}.`,44);
  if(s.type!=='Structure'&&String(p.Prohibited).split(', ').includes(s.type))issue('POWER_TYPE',`${name} cannot power ${s.type}.`,45);
  if(s.type==='Structure'&&!secondary){
   if(!['Unpowered','Grid Power','Powered','Beamed Power'].includes(name))issue('STRUCTURE_POWER','Install this plant as secondary power on a structure.',45);
   if(name==='Powered'){used=Math.max(1,ceil(s.spaces*(s.ruling==='prose'?.25:.30)));cost=b;notes.push(`Powered structure uses ${s.ruling==='prose'?'25% (p32 prose)':'30% (p45 table)'}; see source audit.`)}
   if(name==='Beamed Power'){used=Math.max(2,ceil(s.spaces*.2));cost=10000*s.spaces;}
  }else if(secondary){
   used=Math.max(Math.abs(num(p.Min2)),ceil(num(p.Space2)*s.spaces));
   cost=name==='Powered'?b:name==='Grid Power'?b:['Wind','Muscle'].includes(name)?used*p.CostV:name==='Beamed Power'?10000*s.spaces:used*num(p.CostS);
  }else{
   if(p.xSpaces<0)add=Math.max(1,Math.floor(-p.xSpaces*s.spaces));
   else used=Math.max(Math.abs(num(p.Minimum)),ceil(p.xSpaces*s.spaces));
   cost=p.VorSorP==='P'?b*num(p.CostP):p.VorSorP==='V'?s.spaces*p.CostV:used*num(p.CostS);
  }
  if(!secondary){capacity+=add;shipping*=p.Shipping||1;baseCost+=p.VorSorP==='P'||s.type==='Structure'?cost:0;}
  line(`${secondary?'Secondary':'Primary'}: ${name}`,used-add,(!secondary&&(p.VorSorP==='P'||s.type==='Structure'))?0:cost,'Handbook pp44–48; '+p._source);
  pp+=used*num(p.PP)*(has('Locomotive')?3:1);
  if(name.startsWith('Fission'))notes.push('Fission plant requires hostile environment protection; lifetime replacement costs twice the plant cost.');
  return {p,spaces:used,cost,range:p.Range,years:typeof p.Endurance==='number'?p.Endurance:0};
 };
 const primary=plant(s.power),second=plant(s.secondary,true);
 if(s.secondary!=='none'&&s.power==='Unpowered'&&s.type!=='Structure')issue('UNPOWERED_SECONDARY','An unpowered vehicle may not install secondary power.',44);
 if(s.secondary===s.power&&s.power!=='Beamed Power')issue('DUPLICATE_POWER','Use extra reactor Spaces instead of duplicating the primary power system.',44);
 if(s.extraPower){if(!primary.p?.PP)issue('EXTRA_POWER','Extra reactor Spaces require a nuclear primary plant.',44);else{line('Extra reactor Spaces',s.extraPower,s.extraPower*primary.p.CostS,'Handbook p44');pp+=s.extraPower*primary.p.PP;}}
  if(s.type==='Airship'){
  const gas={ 'Hot Air':[3,.01,1],Helium:[5,.015,2],Hydrogen:[4,.02,2],Vacuum:[12,.025,0]}[s.gas]||[99,0,1];
  if(s.tl<gas[0])issue('GAS_TL',`${s.gas} requires TL${gas[0]}.`,29);
  if(s.gas==='Vacuum'&&!has('Rigid'))issue('GAS_RIGID','Vacuum lift requires Rigid.',29);
  capacity=Math.floor(s.spaces*(gas[1]+(has('Streamlined')?.01:0)));
  if(s.power==='Unpowered')capacity+=Math.max(1,Math.floor(s.spaces*.5));
  range*=gas[2];if(s.gas==='Hydrogen')notes.push('Hydrogen: hull/fuel critical hits can cause a catastrophic fire.');
  if(s.tl===3&&s.power!=='Unpowered')issue('BALLOON','TL3 airships must be unpowered balloons.',29);
  if(s.power!=='Powered')issue('AIRSHIP_POWER_REVIEW','Airship envelope capacity combined with alternate-power Space changes needs referee review; the sources do not resolve this interaction consistently.',29,'review');
 }
 if(['Wind','Muscle'].includes(s.power)){speed=s.power==='Muscle'?1:s.tl>=9?3:s.tl>=5?2:1;range=0;}
 else if(s.power==='Unpowered'){speed=s.type==='Aeroplane'?Math.min(3,Math.floor(t.speed/2)):0;range=0;}
 else range*=num(primary.range);
 if(s.type==='Submersible'&&primary.p?.PP)speed++;
 if(s.secondary!=='none'&&['Wind','Muscle'].includes(s.power)&&second.p&& !['Wind','Muscle'].includes(s.secondary))speed=Math.max(speed,t.speed+(['Aeroplane','Submersible'].includes(s.type)?0:size.Speed)-(['Grid Power','Beamed Power'].includes(s.secondary)?0:1));
 for(const name of s.features){
  const f=features.find(x=>x['Feature Effect']===name);
  for(const r of featureReasons(name,s))issue('FEATURE',`${name}: ${r}.`,35);
  if(!f)continue;
  baseCost+=b*f['Cost add'];agility+=f.Agility;speed+=f.Speed;range*=f.RangeMod;shipping*=f.ShippingMod;hull*=f.HullMod;
 }
 if(has('AFV')&&has('Tracks'))speed++;
 if(has('Supersonic'))speed=9;
 if(has('Hypersonic'))speed=10+(has('Fast')?1:0);
 const speedLimit=Math.max(0,Math.min(3,s.tl-3));
 if(Math.abs(s.speedMod)>speedLimit)issue('SPEED_TL',`Speed modification is limited to ±${speedLimit} at TL${s.tl}.`,49);
 if(s.speedMod<0&&(has('Supersonic')||has('Hypersonic')))issue('SLOWER_SONIC','Supersonic/hypersonic aeroplanes cannot use Slower.',49);
 if(s.type==='Structure'&&s.speedMod)issue('STRUCTURE_SPEED','A structure has no primary speed to modify.',49);
 speed+=s.speedMod;line('Speed customisation',s.speedMod>=0?ceil(s.spaces*.2)*s.speedMod:Math.floor(s.spaces*.1)*s.speedMod,0,'Handbook p49');baseCost+=b*(s.speedMod>=0?s.speedMod:s.speedMod*.1);
 if(Math.abs(s.efficiency)>Math.max(0,Math.min(3,s.tl-2)))issue('EFFICIENCY_TL','Efficiency exceeds the TL limit (one at TL3, two at TL4, three at TL5).',50);
 if(s.fuel< -2)issue('FUEL_LIMIT','Fuel capacity can be reduced at most twice.',50);
 if(s.fuel&&s.tl<3)issue('FUEL_TL','Fuel changes require TL3.',50);
 if((s.fuel||s.efficiency)&&s.power!=='Powered'&&primary.p?.Type!=='Fusion Plus')issue('NO_FUEL','Fuel and efficiency changes require conventional or Fusion+ primary power.',50);
 const rangeMod=1+(s.efficiency>=0?s.efficiency*.5:s.efficiency*.25)+s.fuel*.25;
 if(rangeMod<=0)issue('RANGE_ZERO','Combined fuel and efficiency changes must leave positive range.',50);
 range*=rangeMod;baseCost+=b*(s.efficiency>=0?s.efficiency*.25:s.efficiency*.1);
 line('Fuel capacity',s.fuel>=0?ceil(s.spaces*.1)*s.fuel:Math.floor(s.spaces*.1)*s.fuel,0,'Handbook p50');
 if(s.depth<1||s.depth>100)issue('DEPTH','Depth multiplier must be 1–100.',33);
 let baseArmour=armour.Base;
 if(s.type==='Submersible'){baseCost+=b*(s.depth-1);baseArmour+=s.depth-1;}
 if(baseArmour>armour.Max)issue('DEPTH_ARMOUR','Depth reinforcement exceeds the TL base armour limit.',33);
 if(s.spaces===1&&s.hull!=='Standard')issue('ONE_HULL','One-Space vehicles cannot reinforce or lighten their hull.',56);
 if(s.hull==='Reinforced'){hull+=Math.max(1,round(hull*.1));baseCost+=b*.5;}
 if(s.hull==='Light'){hull-=Math.max(1,round(hull*.25));baseCost-=b*.25;}
 hull=Math.max(1,round(hull));
 const floorCost=b*.1;if(baseCost<floorCost)notes.push('The chassis price floor of 10% of baseline cost has been applied.');
 baseCost=Math.max(baseCost,floorCost);line('Chassis, features & customisations',0,baseCost,'Handbook pp26,35,44,49–56');
 if(s.armour+baseArmour>armour.Max*(has('AFV')?3:1))issue('ARMOUR_LIMIT',`Overall protection is limited to ${armour.Max*(has('AFV')?3:1)} including base ${baseArmour}.`,55);
 const armourRaw=s.armour*s.spaces*armour['Vehicle Spaces per Point']*size.Armour;
 line('Added armour',ceil(armourRaw),armourRaw*armour['Cost per Armour Space'],'Handbook p55; '+armour._source);
 const defaultFaces=faces.map((_,i)=>baseArmour+(i<4?s.armour:round(s.armour/2)));
 if(has('Open-Topped'))defaultFaces[4]=0;
 if(has('Monowheel')){defaultFaces[2]=0;defaultFaces[3]=0;}
 if(!Array.isArray(s.armourShift)||s.armourShift.length!==6)s.armourShift=[0,0,0,0,0,0];
 if(s.armourShift.some(x=>!Number.isInteger(x))||s.armourShift.reduce((a,v)=>a+num(v),0)!==0)issue('ARMOUR_POOL','Armour transfers must be whole points and sum to zero.',56);
 const protection=defaultFaces.map((a,i)=>a+num(s.armourShift[i]));
 protection.forEach((a,i)=>{if((has('Open-Topped')&&i===4)||(has('Monowheel')&&(i===2||i===3))){if(a!==0)issue('OPEN_ARMOUR',`${faces[i]} armour must be zero.`,39);}else if(a<baseArmour)issue('ARMOUR_BASE',`${faces[i]} cannot fall below base protection ${baseArmour}.`,55);});
 const auxResults=[];
 if(s.aux.length>2)issue('AUX_LIMIT','This workbench supports two auxiliary drives.',50);
 for(const name of s.aux){
  const a=find('Secondary','Secondary',name);if(!a||name==='none'){issue('AUX','Unknown auxiliary drive.',50);continue;}
  if(s.tl<a.TL)issue('AUX_TL',`${name} requires TL${a.TL}.`,50);
  if(!powered&&a.Terrain!=='Rocket')issue('AUX_POWER',`${name} requires vehicle power.`,50);
  const special=/Supercavitation|Rocket/.test(name);
  if(name.startsWith('Supercavitation')&&s.type!=='Submersible')issue('SUPERCAV','Supercavitating drives are restricted to submersibles.',52);
  if(name==='Grav Drive'&&s.type==='Grav Vehicle'||name==='Ground Drive'&&s.type==='Ground Vehicle'||name==='Submarine Drive'&&s.type==='Submersible')issue('AUX_DUPLICATE',`${name} duplicates primary locomotion.`,50);
  const at=types.some(x=>x.Type===a.Basis)?baseType(a.Basis,s.tl):t;
  const ar=special?num(a[s.tl]):Math.max(1,at.speed+(a.Basis==='Submersible'||a.Basis==='Aeroplane'?0:size.Speed)+num(a.Speed)+(name==='Rail Wheels'?1:0));
  const asp=Math.max(Math.abs(num(a.Minimum)),ceil(a.Spaces*s.spaces));
  line(name,asp,a.Terrain==='Rocket'?a.Cost*asp:a.Cost*s.spaces,'Handbook pp50–54; '+a._source);
  auxResults.push({name,speed:name==='Lifters'?Math.min(2,ar):ar,agility:at.Agility+size.Agility+a.Agility,range:special?num(a.Range):at.range*(s.spaces>=20?at.heavy:1)*a.Range,spaces:asp});
  if(a.Terrain==='Rocket')issue('ROCKET_REVIEW','Rocket thruster installed for one round of thrust; orbital trajectory and staging require referee review.',54,'review');
 }
 if(new Set(s.aux).size!==s.aux.length)issue('AUX_DUPLICATE','Do not install the same auxiliary drive twice.',50);
 const installed=s.equipment.map(e=>({e,o:options.find(o=>o.Name===e.name)}));
 const hasOption=n=>installed.some(({e,o})=>o&&e.quantity>0&&o.Name.includes(n));
 const hostile=s.type==='Submersible'||s.aux.includes('Submarine Drive')||['Hostile Environment','Vacuum Environment','Corrosive Environment','Insidious Environment','High Pressure'].some(hasOption);
 if(s.power.startsWith('Fission')||s.secondary.startsWith('Fission'))if(!hostile)issue('FISSION_SHIELD','Fission power requires hostile environment protection.',47);
 const control=options.find(x=>x.Name===s.control);
 if(!control||!s.control.startsWith('Control System'))issue('CONTROL','Choose a control system.',58);
 else{if(s.tl<control.TL)issue('CONTROL_TL',`${s.control} requires TL${control.TL}.`,58);if(control.Bonus>0&&!powered)issue('CONTROL_POWER','Improved controls require vehicle power.',58);agility+=num(control.Bonus);line(s.control+(s.controlQuantity>1?' × '+s.controlQuantity:''),0,num(control.CostU)*(control.CostU<0?1:s.controlQuantity),'Handbook p58; '+control._source);}
 if(s.controlQuantity<1)issue('CONTROL_COUNT','At least one control station is required.',58);
 let robotArms=0,smallRobotArms=0,robotArmRows=[];
 let cp=0,powerDemand=0,software=0,maxProgram=0,computers=[],support=0;
 for(const {e,o} of installed){
  if(!o){issue('OPTION_UNKNOWN',`Unknown equipment: ${e.name}.`,57);continue;}
  const q=e.quantity;
  if(!Number.isInteger(q)||q<1||q>1000000){issue('OPTION_QUANTITY',`${o.Name}: quantity must be a positive whole number.`,25);continue;}
  if(o.TL>s.tl)issue('OPTION_TL',`${o.Name} requires TL${o.TL}.`,57);
  if(o._book===null||o._book===undefined)issue('SOURCE_REVIEW',`${o.Name}: extracted from the worksheet; book page and detailed rules are not verified.`,91,'review');
  if(o.Powered==='P'&&!powered)issue('OPTION_POWER',`${o.Name} requires power.`,57);
  if(o.Powered==='F'&&pp<=0)issue('OPTION_NUCLEAR',`${o.Name} requires nuclear power.`,44);
  const budget=optionBudget(o,q,s,e);
  if(o._robotArm){const size=e.armSize??5,ds=e.strIncrease??0,dd=e.dexIncrease??0;if(!Number.isInteger(size)||size<1||size>10||!Number.isInteger(ds)||ds<0||ds>2*size-1||!Number.isInteger(dd)||dd<0||budget.dex>s.tl+3)issue('ARM_CHARACTERISTICS','Robot arm Size or characteristic increase is outside Robot Handbook pp25–27 limits.',67);if(s.spaces<=3&&size>(s.spaces===1?8:9))issue('ARM_SIZE','Manipulator exceeds the chassis-equivalent Size +2 limit (Robot Handbook p27).',67);robotArms+=q;if(size<=5)smallRobotArms+=q;budget.spaces=0;robotArmRows.push(ledger.length);notes.push(`${o.Name} × ${q}: Size ${size}, STR ${budget.str}, DEX ${budget.dex} (Robot Handbook pp25–27; Vehicle Handbook p67).`);}
  if(/^(Heavy )?Manipulator Arm \(/.test(o.Name)){const ds=e.strIncrease??0,dd=e.dexIncrease??0;if(!Number.isInteger(ds)||!Number.isInteger(dd)||ds<0||dd<0||ds+dd>5)issue('ARM_UPGRADE','Manipulator characteristic increases must be whole, non-negative and total at most +5.',67);if(ds||dd)notes.push(`${o.Name}: STR +${ds}, DEX +${dd}; cost ×${2**(ds+dd)} (p67).`);}
  line(`${o.Name}${q>1?' × '+q:''}`,budget.spaces,budget.cost,o._source);
  if(o.Name.startsWith('Sensor System')){
   if(e.highFidelity&&s.tl<6)issue('SENSOR_FIDELITY','High-fidelity sensors require TL6.',60);
   if(e.hardened&&s.tl<7)issue('SENSOR_HARDENED','Hardened sensors require TL7.',60);
   if(e.rangeBoost!==undefined&&(!Number.isInteger(e.rangeBoost)||e.rangeBoost<0||e.rangeBoost>3))issue('SENSOR_RANGE','Sensor range can be increased by up to three factors of ten.',60);
  }
  if(o.Name.startsWith('Autopilot')&&s.tl<9&&!['Aeroplane','Airship','Grav Vehicle','Rotorcraft','Watercraft','Submersible'].includes(s.type)){
   if(s.aux.some(a=>['Aquatic Drive','Submarine Drive'].includes(a)))notes.push('Before TL9, this autopilot is useful in waterborne operation only; it is not a capable ground-driving autopilot (p58).');
   else issue('AUTOPILOT_TYPE','Before TL9, autopilots are only useful on aircraft and waterborne vessels.',58);
  }
  if(o.Limit==='L'&&q>s.spaces)issue('OPTION_LIMIT',`${o.Name} is limited to one per nominal vehicle Space.`,80);
  if(o.Special==='E'&&(has('Open Frame')||has('Open-Topped'))&&!o.Name.includes('Life Support Seat'))issue('OPEN_ENV',`${o.Name} requires an enclosed vehicle.`,39);
  if(/^Life Support \(/.test(o.Name)){support+=budget.spaces*(o.Name.includes('short')?20:5);if(!hostile)issue('LIFE_SEAL','Life support requires at least hostile environment protection.',80);}
  if(o.Name==='Life Support Seat')support+=q;
  if(o.Name==='Grav Plating'||o.Name==='Inertial Compensator'){
   if(s.type!=='Grav Vehicle'&&!s.aux.some(x=>['Grav Drive','Lifters'].includes(x)))issue('GRAV_PREREQ',`${o.Name} requires grav drives or lifters.`,80);
   if(o.Name==='Inertial Compensator'&&q>s.tl-7)issue('COMP_LIMIT','Inertial compensator applications cannot exceed TL−7.',80);
  }
  if(o.Name==='Gecko Grippers'&&s.spaces>3)issue('GECKO_SIZE','Gecko grippers are limited to 1–3 Spaces.',66);
  if(o.Name==='Digger Blade'&&budget.spaces>s.spaces*.25)issue('DIGGER_LIMIT','Digger blade size cannot exceed 25% of nominal vehicle Spaces.',69);
  if(o.Name==='Winch'&&q>6)issue('WINCH_LIMIT','At most one winch per face (six faces).',66);
  if(o.Name==='Winch'&&q>1)issue('WINCH_FACES','Assign each winch to a different vehicle face.',66,'review');
  if(o.Name==='Docking Bay'||o.Name==='Hangar Bay')notes.push(`${o.Name}: ${budget.spaces} Spaces support up to ${Math.floor(budget.spaces/(o.Name==='Docking Bay'?4.4:8)*100)/100} shipping tons. Verify the carried vehicle fits; a docking bay is shape-specific (pp86–87).`);
  if(o.Name==='Tow Hitch')notes.push(`Tow hitch includes cables and hooks, rated for ${q} powered towed Spaces or ${q*2} unpowered towed Spaces. Vehicle towing limits still apply (pp23,65).`);
  if(/Climbing Wheels|Tyre Chains|Wheel Tracks/.test(o.Name)&&s.type!=='Ground Vehicle')issue('WHEELS','Wheel options require a ground vehicle.',66);
  if(/Tailhook/.test(o.Name)&&s.type!=='Aeroplane')issue('TAILHOOK','Tailhooks require an aeroplane.',70);
  if(o.Name.startsWith('Computer/')||o.Name.startsWith('Ship '))computers.push(...Array(Math.min(q,100)).fill(num(o.Bonus)));
  if(category(o)==='Automation'&& /\/\d$|^HPI /.test(o.Name)&&!o.Name.startsWith('Computer/')&&!o.Name.startsWith('Ship ')){software+=bandwidth(o)*q;maxProgram=Math.max(maxProgram,bandwidth(o));}
  if(o.Name==='Entertainment System'||o.Name==='Tour Guide')cp+=q*num(o.Bonus);
  else if(o.Name.startsWith('Luxury Interior Space'))cp+=q*(num(o.Bonus)-1);
  else if(o.Comfort==='C')cp+=budget.spaces*(num(o.Bonus)||1);
  if(o.Powered==='F')powerDemand+=(o.Name==='Meson Screen'?9*q:o.Name==='Nuclear Damper'?6*q:o.Name==='Holographic Hull'?s.spaces*.25*q:(num(o['Pwr/Space'])||1)*(budget.spaces||q));
  if(['Transceiver Encryption','Transceiver Tightbeam','Satellite Uplink'].includes(o.Name)&&!hasOption('Transceiver,'))issue('RADIO_PREREQ',`${o.Name} requires a radio transceiver; meson communicators already include these functions.`,59);
  if(o.Name==='Satellite Uplink'&&!installed.some(({o:r})=>r?.Name.startsWith('Transceiver,')&&num(String(r.Traits).replace(/[^0-9.]/g,''))>=500))issue('UPLINK_RANGE','Satellite uplink requires a transceiver range of at least 500 km.',59);
  const row=num(o._source.match(/B(\d+)/)?.[1]);
  if(row>=340)issue('SPECIALIST',`${o.Name}: cost and Spaces are budgeted; specialist prerequisites require handbook review.`,91,'review');
  if(/Biosphere|Landing Deck|Launch Deck|Holographic|Reflec|Convertible|Outboard|Collision Protection|Fire Director|Brain|Chauffeur|Vehicle Parachute|Self-Repairing|Self-Sealing|Entertainment|Neural|Psionic/.test(o.Name))issue('SPECIAL_RULE',`${o.Name}: consult its operating/combination rules before finalising.`,category(o)==='Automation'?97:57,'review');
 }
 if(robotArms){const free=s.spaces===1?Math.min(2,smallRobotArms):0;ledger[robotArmRows[0]].spaces=ceil((robotArms-free)/4);notes.push('Robot-arm Space allowance is pooled across installed arms; see Vehicle Handbook p67.');}
 if(!computers.length&&s.tl>=8&&powered)computers=[0];
 if(hasOption('Reflec')&&(hasOption('Camouflage')||hasOption('Holographic Hull')))issue('REFLEC_CAMOUFLAGE','Reflec cannot be combined with camouflage or a holographic hull.',61);
 if(installed.filter(({o})=>o?.Name.startsWith('Luxury Exterior')).reduce((n,{e})=>n+e.quantity,0)>1)issue('LUXURY_EXTERIOR','Choose one luxury exterior treatment for the vehicle.',70);
 if(hasOption('Holographic Hull')&&hasOption('Camouflage'))issue('HOLOGRAM_CAMOUFLAGE','Holographic hull emitters preclude other camouflage.',61);
 if(hasOption('Electrostatic Armour')&&hasOption('Reactive Armour'))issue('ARMOUR_CONFLICT','Electrostatic and reactive armour are incompatible.',76);
 if(installed.filter(({o})=>o?.Name.startsWith('Recon Sensor')).reduce((a,{e})=>a+e.quantity,0)>1)issue('RECON_LIMIT','Only one recon sensor may be installed.',77);
 if(hasOption('Stealth')&&hasOption('ECM'))notes.push('Stealth and ECM may be installed together but cannot provide their benefits simultaneously (pp61,75).');
 if(software>computers.reduce((a,v)=>a+v,0)||maxProgram>Math.max(0,...computers))issue('BANDWIDTH',`Software needs ${software} bandwidth; installed computers provide ${computers.reduce((a,v)=>a+v,0)}. A program must fit on one computer.`,92);
 if(computers.length>1&&software>0)issue('PROGRAM_ASSIGN','Multiple computers: assign programs to individual computers before operation; pooled bandwidth alone does not prove they fit.',92,'review');
 if(s.drone){if(!hasOption('Drone Interface')||!hasOption('Drone Actuators')||!hasOption('Transceiver'))issue('DRONE','A drone requires a transceiver, Drone Interface and Drone Actuators.',95);notes.push('Drone operation requires an external operator and a compatible console.');}
 if(s.crew<1&&!s.drone&&s.type!=='Structure'&&s.power!=='Unpowered'&&!installed.some(({o})=>o?.Name.includes('Brain')&&!o.Name.includes('Interface'))&&!hasOption('Chauffeur'))issue('OPERATOR','Provide an operator or a complete drone/robot control system.',95);
 if(support&&support<s.crew+s.passengers)issue('LIFE_CAPACITY',`Life support covers ${support} people; ${s.crew+s.passengers} are aboard.`,81);
 if((s.type==='Submersible'||s.aux.includes('Submarine Drive'))&&!support)notes.push(`Without life support, submerged endurance is ${Math.floor(s.tl/2)} hours (p33).`);
 const externalFuel=installed.filter(({o})=>o?.Name==='Auxiliary Fuel Tank (external hardpoint)').reduce((n,{e})=>n+e.quantity,0);
 if(externalFuel){range*=1+externalFuel*2.5/(s.spaces+externalFuel);notes.push('External fuel tanks include their hardpoints and count toward the external weapon-load limit (p102).');}
 let weaponMass=externalFuel*250,weaponCrew=0,turretOccupants=0;
 const weaponResults=[];
 for(const mount of s.weapons){
  const w=weapons.find(x=>x.Weapon===mount.weapon);if(!w){issue('WEAPON_UNKNOWN','Unknown weapon.',105);continue;}
  const q=mount.quantity||1;if(!Number.isInteger(q)||q<1||q>1000){issue('WEAPON_QUANTITY','Weapon count must be 1–1,000.',101);continue;}
  if(s.tl<w.TL)issue('WEAPON_TL',`${w.Weapon} requires TL${w.TL}.`,105);
  if(w.Pwr==='P'&&!powered)issue('WEAPON_POWER',`${w.Weapon} needs vehicle power.`,105);
  if(String(w.Pwr).startsWith('F')){if(!pp)issue('WEAPON_NUCLEAR',`${w.Weapon} needs nuclear power.`,105);powerDemand+=(num(String(w.Pwr).slice(1))||1)*q;}
  const integrated=w.Weapon.startsWith('Anti-Missile System');
  const mass=w.Tons*1000*q;weaponMass+=mass;const ws=w._empty?num(mount.ratedSpaces):w.Tons<=.125?ceil(mass/250):ceil(w.Tons*4)*q, kind=integrated?'Integrated AMS':mount.mount;
  let used=ws,mc=0;
  if(w._empty&&(!Number.isInteger(mount.ratedSpaces)||mount.ratedSpaces<1))issue('MOUNT_CAPACITY','Specify positive whole weapon Spaces for an empty mount.',102);
  if(w._empty&&!['Hardpoint','Turret','Bay','Multi-Bay','Fixed Mount','Pintle Mount','Ring Mount'].includes(kind))issue('EMPTY_MOUNT','Choose a supported empty mount type.',102);
  if(w._personal&&kind!=='Gunport')issue('PERSONAL_GUNPORT','Personal-weapon aperture requires Gunport.',103);
  if((w._empty||w._personal)&&(q!==1||mount.ammo||mount.autoloader))issue('EMPTY_FITTINGS','Empty mounts and personal-weapon apertures cannot contain linked weapons, ammunition or autoloaders.',103);
  if(w._empty&&(!Number.isInteger(mount.reservedCrew??0)||(mount.reservedCrew??0)<0))issue('MOUNT_CREW','Reserved turret crew must be a non-negative whole number.',103);
  const requiredLoaders=num(w.Loader)*q;
  let loaders=mount.loaders===undefined?requiredLoaders:num(mount.loaders),gunners=w._empty?num(mount.reservedCrew):num(w.Crew);
  if(!Number.isInteger(loaders)||loaders<0||loaders>requiredLoaders)issue('LOADER_COUNT',`Assigned loaders must be between 0 and ${requiredLoaders} for ${w.Weapon}.`,102);
  if(loaders<requiredLoaders&&!mount.autoloader)notes.push(`${w.Weapon}: ${requiredLoaders-loaders} loader(s) unassigned; reload time doubles per missing loader. No loader berth is reserved (p102; Appendix I p178).`);
  if(integrated){used=num(w.Spaces)*q;if(q!==1)issue('AMS_LINK','Install each self-contained anti-missile system in its own mount.',74);if(mount.modular)mc+=w.Cost*q*.5;}
  else if(['Pintle Mount','Ring Mount'].includes(kind)){used=0;mc=kind==='Pintle Mount'?250:750;if(mass>500)issue('PINTLE_MASS',`${kind} supports at most 500 kg.`,102);}
  else if(kind==='Hardpoint'){used=0;mc=ws*2000;}
  else if(kind==='Turret'){const inside=(mount.remote?0:gunners)+(mount.autoloader?0:loaders);turretOccupants+=inside;used=Math.max(1,ceil(ws/4))+ceil(inside*s.sophont);mc=used*20000;}
  else if(kind==='Gunport'){mc=w._personal?250:ws*250;if(q>1)issue('GUNPORT','Only one weapon is allowed per gunport.',103);}
  else if(kind==='Bay'||kind==='Multi-Bay')mc=ws*(kind==='Bay'?2500:5000);
  else if(kind!=='Fixed Mount')issue('MOUNT_TYPE','Unknown mount type.',101);
  const fc=find('FireControl','Fire Control System',mount.fireControl||'none')||{TL:0,Cost:0,DM:0};
  if(fc.TL>s.tl)issue('FCS_TL',`${mount.fireControl} fire control requires TL${fc.TL}.`,104);
  if(mount.remote&&num(fc.DM)<1)issue('REMOTE_FCS','A remote gunner requires Basic or better fire control.',104);
  if(mount.remote&&!powered)issue('REMOTE_POWER','Remote gunnery requires power.',104);
  let autoCost=0;
  if(mount.autoloader){if(s.tl<6)issue('AUTOLOADER_TL','Autoloaders require TL6.',103);used+=Math.max(1,ceil(ws*.1));autoCost=num(w.MagCost)*20;loaders=0;}
  if(mount.modular&&kind!=='Hardpoint'&&!integrated)mc*=1.5;
  const shield=num(mount.gunShield);
  if(shield){if(!['Pintle Mount','Ring Mount'].includes(kind))issue('SHIELD_MOUNT','Gun shields only protect pintle or ring mounts.',103);if(!Number.isInteger(shield)||shield<0||shield>armour.Max)issue('SHIELD_ARMOUR',`Gun shield Protection must be 0–${armour.Max}; AFV does not triple this limit.`,103);mc+=shield*num(armour['Cost per point per Vehicle Space']);}
  if(mount.popup){const added=Math.max(1,used,['Hardpoint','Pintle Mount','Ring Mount'].includes(kind)?ws+(mount.autoloader?Math.max(1,ceil(ws*.1)):0):0);used+=added;mc+=added*10000;}
  const ammo=mount.ammo||0;if(!Number.isInteger(ammo)||ammo<0)issue('AMMO','Reload rounds must be a non-negative whole number.',105);
  const rp=num(w.RpSpace);let ammoSpaces=0,ammoCost=0;
  if(ammo){if(!rp)issue('AMMO_TYPE',`${w.Weapon} has no verified rounds-per-Space value.`,105,'review');else ammoSpaces=ceil(ammo/rp);ammoCost=num(w.Mag)>0?ceil(ammo/num(w.Mag))*num(w.MagCost):0;}
  const ammoProfile=ammunition.find(a=>a.name===(mount.ammoType||'Standard'));
  if(!ammoProfile)issue('AMMO_PROFILE','Unknown ammunition profile.',122);
  else if(ammoProfile.name!=='Standard'){
   if(!num(w.Mag)||!num(w.MagCost)||/Laser|Plasma|Fusion|Meson|Stun|Water Cannon/i.test(w.Weapon))issue('SPECIAL_AMMO_WEAPON','Special ammunition is unavailable for energy weapons or weapons without priced physical ammunition.',120);
   if(s.tl<ammoProfile.tl)issue('SPECIAL_AMMO_TL',`${ammoProfile.name} requires a weapon manufactured at TL${ammoProfile.tl} or higher.`,122);
   const artillery=/Howitzer|Mortar|Field Gun|Siege Gun|Bombardment Gun|Mass Driver|Demolition Gun|Black Powder Mortar/.test(w.Weapon),bomb=/Bomb/.test(w.Weapon)&&!/Bombardment/.test(w.Weapon);
   if(['APDS','Canister'].includes(ammoProfile.name)&&(artillery||bomb))issue('AMMO_COMPATIBILITY',`${ammoProfile.name} cannot be used by artillery or bombs.`,120);
   if(ammoProfile.name==='Bomblet'&&!artillery&&!bomb)issue('AMMO_COMPATIBILITY','Bomblets require artillery or bombs.',120);
   ammoCost*=ammoProfile.multiplier;
   issue('AMMO_REVIEW',`${ammoProfile.name}: reserve ammunition cost is included; confirm weapon manufacture TL, calibre and Referee-approved compatibility. Base weapon damage/range stay on the sheet; apply the listed ammunition effects when firing.`,120,'review');
  }
  weaponCrew+=gunners+loaders;
  const cost=w.Cost*q+mc+num(fc.Cost)+autoCost+ammoSpaces*100+ammoCost;
  line(`${kind}: ${w.Weapon} × ${q}`,used+ammoSpaces,cost,'Handbook pp101–105; '+w._source);
  weaponResults.push({...mount,mount:kind,mass,spaces:used+ammoSpaces,cost,damage:w.Damage,range:w.Rangekm,crew:gunners+loaders,traits:w._empty?`Empty mount: capacity ${ws} weapon Spaces; ${num(mount.reservedCrew)} reserved crew`:w.Traits,ammoEffect:ammoProfile?.effect});
 }
 if(weaponMass>s.spaces*250)issue('WEAPON_MASS',`Weapon mass ${weaponMass} kg exceeds ${s.spaces*250} kg hard limit.`,101);
 if(externalFuel&&weaponMass>s.spaces*100)issue('FUEL_HARDPOINT_LIMIT','With external fuel tanks installed, the combined tanks/weapon load exceeds the 100 kg per nominal Space allowance on p102.',102);
 if(hasOption('Stealth')&&s.weapons.some(w=>w.mount==='Hardpoint'&&!w.popup))issue('HARDPOINT_STEALTH','Exposed hardpoints impair stealth; apply the detection modifiers in the handbook.',61,'review');
 const massPenalty=weaponMass>s.spaces*100?1:0;
 if(massPenalty)notes.push('Weapon mass exceeds 100 kg per Space: maximum and cruise speed −1 band.');
 if(weaponCrew>s.crew)issue('WEAPON_CREW',`Weapon crews total ${weaponCrew}; ${s.crew} crew allocated. Shared duties or missing-loader penalties need referee review.`,102,'review');
 if(powerDemand>pp)issue('POWER_OUTPUT',`Spacecraft systems require ${powerDemand} Power; reactors deliver ${pp}.`,44);
 const firingPenalty=powerDemand>0&&pp>0?Math.floor(powerDemand/pp*10):0;
 if(firingPenalty)notes.push(`Operating all spacecraft systems reduces speed by ${firingPenalty} bands; systems cannot run above total reactor output (p44 ruling).`);
 const crewSpaces=ceil(Math.max(0,s.crew-turretOccupants)*s.crewSpace*s.sophont),passengerSpaces=seating.reduce((sum,g)=>sum+ceil(g.count*g.space*s.sophont),0);
 const luxury=installed.filter(({o})=>o?.Name.startsWith('Luxury Interior Space')).reduce((a,{e})=>a+e.quantity,0);
 if(luxury){
  const eligible=crewSpaces+passengerSpaces+installed.filter(({o})=>o?.Comfort==='C'&&!o.Name.startsWith('Luxury Interior Space')&&!['Entertainment System','Tour Guide','Grav Plating'].includes(o.Name)).reduce((a,{o,e})=>a+optionBudget(o,e.quantity,s,e).spaces,0);
  if(luxury>eligible)issue('LUXURY_ALLOCATION',`${luxury} luxury-treated Spaces exceed ${eligible} allocated accommodation/common Spaces.`,84);
  notes.push('Luxury interiors upgrade existing 1-CP accommodation/common Spaces; they add no volume. Assign distinct treated Spaces. Applying luxury to spaces with an existing CP multiplier needs manual review (pp84–85).');
 }
 line('Crew accommodation',crewSpaces,0,'Handbook pp24,27');if(extraGroups.length){for(const g of seating)line('Passenger accommodation: '+g.name,ceil(g.count*g.space*s.sophont),0,'Handbook pp24,27');}else line('Passenger accommodation',passengerSpaces,0,'Handbook pp24,27');line('Cargo',s.cargo,0,'Handbook p27');
 // Gains were already added to capacity by plant(); keep their ledger entries explanatory only.
 const used=ledger.reduce((a,l)=>a+Math.max(0,l.spaces),0);const gains=ledger.filter(x=>x.name==='Speed customisation'||x.name==='Fuel capacity').reduce((a,l)=>a+Math.max(0,-l.spaces),0);capacity+=gains;
 const remaining=capacity-used;
 if(remaining<0)issue('SPACE_BUDGET',`Over capacity by ${-remaining} Spaces. Remove equipment, cargo or occupants, or enlarge the chassis.`,25);
 if(has('Rail Rider')){
  const rail=find('RailNetwork','Rail Network',s.rail);
  if(rail){
   speed+=rail['Speed Band']-1+(s.vacTube?2:0);
   if(s.tl<rail.TL)issue('RAIL_TL',`${s.rail} requires TL${rail.TL}.`,40);
   if(/Maglev|Gravlev/.test(s.rail)&&s.power!=='Grid Power'&&s.secondary!=='Grid Power')issue('RAIL_GRID','Maglev and gravlev require grid power.',40);
   if(s.rail.includes('Gravlev')&&!s.aux.includes('Lifters'))issue('RAIL_LIFTERS','Gravlev requires lifters.',40);
   if(speed>rail.SB)notes.push(`Rail speed exceeds the network's base safe band (${rail['Max Speed']}); track upgrades or repeated operator checks are required.`);
  }
  if(s.vacTube&&s.tl<8)issue('VACTUBE_TL','Vacc tube rail requires TL8.',40);
 }
 const theoretical=speed;
 let cap=11;
 if(s.type==='Hovercraft'||has('Open Frame')||has('Open-Topped'))cap=8;
 else if(s.type==='Aeroplane')cap=has('Hypersonic')?11:has('Supersonic')?9:8;
 else if(s.type==='Rotorcraft')cap=has('Aerodyne')&&has('Streamlined')?11:8;
 else if(['Grav Vehicle','Ground Vehicle'].includes(s.type)&&!has('Streamlined')&&!(has('Rail Rider')&&s.vacTube))cap=8;
 if(s.power==='Muscle')cap=Math.min(cap,3);
 if(s.type==='Structure')speed=0;else speed=Math.min(speed,cap);
 if(speed<1&&s.power!=='Unpowered'&&s.type!=='Structure')issue('MIN_SPEED','A moving vehicle must achieve at least Idle.',26);
 if(s.type==='Aeroplane'&&speed<3)issue('STALL','An aeroplane must achieve at least Slow to fly.',28);
 if(theoretical>11&&!has('Hypersonic'))issue('MAX_SPEED','Speed modifications exceed the Orbital limit.',49);
 speed=Math.max(0,Math.min(11,speed));
 let cruise=speed?Math.max(1,Math.min(speed,theoretical-1)):0;
 if(massPenalty){speed=Math.max(0,speed-1);cruise=Math.max(0,cruise-1);}
 if(s.type==='Aeroplane'&&speed<3)issue('STALL','An aeroplane must achieve at least Slow to fly.',28);
 if(s.power==='Unpowered'&&!['Aeroplane','Airship'].includes(s.type)){speed=0;cruise=0;}
 const total=ledger.reduce((a,l)=>a+l.cost,0);
 const traits=[...(t.Trait&&t.Trait!=='none'?[t.Trait]:[]),...s.features.filter(x=>['AFV','ATV','Off-Roader','Open Frame','Open-Topped','Tracks','STOL','Responsive','Unresponsive'].includes(x))];
 if(s.spaces>=200||has('Locomotive'))traits.push('Unresponsive');
 const comfort=(seats,people)=>people?(seats+cp)/(s.sophont*people):null;
 const infinite=['Wind','Muscle','Grid Power','Beamed Power'].includes(s.power)||primary.years>0||(s.power.startsWith('Fusion+')&&['Watercraft','Submersible'].includes(s.type))||(s.type==='Airship'&&s.gas==='Vacuum');
 if(primary.p?.Type==='Fission'||primary.p?.Type==='Fusion')notes.push('Cooling fluid: replenish 1 Space per 10 plant Spaces every four weeks; not extra installed plant volume (p47).');
 const depth=(s.tl>=15?4000:s.tl>=12?2000:s.tl>=9?600:s.tl>=6?300:s.tl>=5?200:50)*s.depth;
 return {valid:!issues.some(x=>x.level==='error'),review:issues.some(x=>x.level==='review'),issues,ledger,notes,t,size,capacity,used,remaining,baseCost,total,hull,structure:ceil(hull*.1),critical:ceil(hull*.1),shipping,agility,speed,cruise,range:Math.max(0,round(range)),cruiseRange:Math.max(0,round(range*1.5)),infinite,pp,powerDemand,firingPenalty,protection,defaultFaces,baseArmour,maxArmour:armour.Max*(has('AFV')?3:1),armourSpaces:ceil(armourRaw),weaponMass,weaponCrew,weaponResults,auxResults,traits:[...new Set(traits)],passengerCount:s.passengers,passengerSeating:seating,crewSpaces,passengerSpaces,comfortBonus:cp,comfort:comfort(crewSpaces+passengerSpaces,s.crew+s.passengers),crewComfort:s.crewSpace,passengerComfort:s.passengerSpace,depth,software,bandwidth:computers.reduce((a,v)=>a+v,0),primary,secondary:second};
}
root.Forge={D,types,features,powers,options,weapons,ammunition,faces,defaults,rules,corrections,calculate,featureReasons,optionBudget,category,sizeFor,baseType,passengerSeating,validPassengerGroup};
if(typeof module!=='undefined')module.exports=root.Forge;
})(globalThis);
