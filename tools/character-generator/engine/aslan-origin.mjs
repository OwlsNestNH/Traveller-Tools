// Original procedural data. Aliens of Charted Space Vol 1 Update 2026 pp15–20.
// Initial family standing and estate expectations are not personal owned assets.
import {SPECIES_RULES} from './expansion-pack.mjs';
const copy=v=>structuredClone(v);
const need=(v,message)=>{if(!v)throw Error(message);};
const int=(n,min,max,label)=>{need(Number.isInteger(n)&&n>=min&&n<=max,label+' is out of range.');return n;};
export const ASLAN_FAMILY_BANDS=Object.freeze([{id:'outcast',name:'Outcast family'},{id:'lower',name:'Lower-class family'},{id:'middle',name:'Middle-class family'},{id:'noble',name:'Noble family'},{id:'high',name:'High-noble family'}]);
export function aslanFamilyBand(soc){int(soc,0,40,'Family SOC');return soc===2?'outcast':soc>=3&&soc<=5?'lower':soc>=6&&soc<=8?'middle':soc>=9&&soc<=11?'noble':soc>=12?'high':null;}
export function aslanFamilyResult({soc,die,gender,band}={}){
 int(die,1,6,'Family die');need(['male','female'].includes(gender),'A source gender branch is required.');
 const natural=aslanFamilyBand(soc);band??=natural;need(ASLAN_FAMILY_BANDS.some(b=>b.id===band),'The unprinted family SOC requires a referee band decision.');
 need(!natural||band===natural,'Do not replace a printed family band.');
 const key=['noble','high'].includes(band)?'higher':band;
 return {source:{id:'aliens',page:17},die,band,label:ASLAN_FAMILY_BANDS.find(b=>b.id===band).name+' / '+die,effects:copy(SPECIES_RULES.aslan.familySkills[key].rolls[die-1]),needsDecision:band==='outcast'&&die===4&&gender==='female'?'female-independence':null};
}
export function aslanBirthOrder({gender,dice}={}){
 if(gender==='female'){need(dice===undefined,'Female birth order has no source roll.');return {source:{id:'aliens',page:16},id:'daughter',dice:[],total:null};}
 need(gender==='male','A source gender branch is required.');need(Array.isArray(dice)&&dice.length===2,'Birth order requires two dice.');dice.forEach(n=>int(n,1,6,'Birth-order die'));const total=dice.reduce((a,b)=>a+b,0);
 return {source:{id:'aliens',page:16},id:total>=11?'first-son':'second-son',dice:[...dice],total};
}
export function aslanEstateOptions(soc){
 int(soc,0,40,'Family SOC');const row=SPECIES_RULES.aslan.land.rows.find(r=>r.SOC===soc);
 return {printedMinimumAvailable:soc<9||!!row,requiresRefereeBaseline:soc>=9&&!row,minimumParcels:row?.parcels??null,increment:row?.increment??null,interpretation:soc<9?'no-printed-estate':'printed-minimum-no-unspecified-roll'};
}
export function aslanEstate({soc,birthOrder,payload={},gm=false}={}){
 const plan=aslanEstateOptions(soc);let minimumParcels=plan.minimumParcels,increment=plan.increment,decision=null;
 if(plan.requiresRefereeBaseline){need(gm,'Enable GM mode for an unprinted estate baseline.');need(Object.keys(payload).every(k=>['method','parcels','increment','reason'].includes(k))&&payload.method==='referee-baseline','Record a typed referee baseline.');minimumParcels=int(payload.parcels,0,Number.MAX_SAFE_INTEGER,'Parcels');increment=int(payload.increment,0,Number.MAX_SAFE_INTEGER,'Increment');decision={method:payload.method,reason:aslanOriginReason(payload.reason)};}
 else need(Object.keys(payload).every(k=>k==='method')&&payload.method==='printed-minimum','Use the printed family minimum without ownership or an unspecified roll.');
 return {source:{id:'aliens',page:17},familySOC:soc,minimumParcels,increment,ownership:'unestablished',inheritance:birthOrder==='first-son'?'first-son':'none',interpretation:decision?'referee-baseline':plan.interpretation,decision};
}
export function aslanOriginReason(value){need(typeof value==='string'&&value.trim().length>0&&value.length<=500,'A source reason of 1–500 characters is required.');return value.trim();}
export function aslanClanResult({dice,scopeDie}={}){
 need(Array.isArray(dice)&&dice.length===2,'Clan requires two dice.');dice.forEach(n=>int(n,1,6,'Clan die'));const total=dice.reduce((a,b)=>a+b,0);
 const types={2:'Minor',3:'Major Vassal',4:'Multiworld',5:'Vassal',6:'Major',7:'Single World',8:'Major',9:'Single World',10:'Multiworld',11:'Major Vassal',12:'Minor Vassal'};
 let scope;
 if([3,4,5,10,11].includes(total)){int(scopeDie,1,6,'Clan scope die');const divisor=[3,11].includes(total)?2:total===5?3:1;scope={count:Math.ceil(scopeDie/divisor),unit:'sector',die:scopeDie,divisor};}
 else {need(scopeDie===undefined,'This clan result has no scope die.');scope={count:1,unit:[6,8].includes(total)?'Hierate':[7,9].includes(total)?'subsector':'world'};}
 return {source:{id:'aliens',page:18},mode:'rolled',dice:[...dice],total,type:types[total],name:'',scope};
}
export function aslanPrideResult(dice){need(Array.isArray(dice)&&dice.length===2,'Pride requires two dice.');dice.forEach(n=>int(n,1,6,'Pride die'));const total=dice.reduce((a,b)=>a+b,0),id=total<=4?'major':total<=9?'average':'minor';return {source:{id:'aliens',page:18},dice:[...dice],total,id,name:id[0].toUpperCase()+id.slice(1)+' pride'};}
