// Mechanical data: Core Rulebook Update 2022, printed pp. 238–239.
import {roll,die} from './rules.mjs?v=dashboard-20261010-41';
export const PASSAGE_CLASSES=['low','basic','middle','high'];
export const passageLabel=x=>({low:'Low',basic:'Basic',middle:'Middle',high:'High'}[x]||x);
function integer(value,label){if(!Number.isSafeInteger(value))throw Error(label+' must be a whole number.');return value;}
export function passengerFare(passageClass,distance,data){
 if(!PASSAGE_CLASSES.includes(passageClass)||!Number.isInteger(distance)||distance<1||distance>6)throw Error('Passenger fares require a class and a single jump of 1–6 parsecs.');
 return String(data.passengers.fareCreditsByParsecs[passageClass][distance-1]);
}
export function passengerDM(origin,destination,distance,{effect=0,steward=0,refereeDM=0}={},data){
 if(!Number.isSafeInteger(distance)||distance<1||distance>6)throw Error('Choose a single-jump destination from 1–6 parsecs away.');
 [effect,steward,refereeDM].forEach(v=>integer(v,'Passenger modifier'));if(steward<0)throw Error('Highest Steward skill cannot be negative; use 0 when there is no positive modifier.');
 const rules=data.passengers.endpointDM,endpoint=ctx=>{
  const u=ctx.uwp;if(u.population===null||u.starport===null||!['Safe','Amber','Red'].includes(ctx.zone))throw Error('Passenger traffic needs known population, starport and travel zone.');
  return {population:rules.population.filter(r=>(r.min===undefined||u.population>=r.min)&&(r.max===undefined||u.population<=r.max)).reduce((n,r)=>n+r.dm,0),starport:rules.starport[u.starport]||0,zone:rules.zone[ctx.zone]||0};
 };
 const components={origin:endpoint(origin),destination:endpoint(destination)},sum=x=>Object.values(x).reduce((a,b)=>a+b,0),from=sum(components.origin),to=sum(components.destination),distanceDM=-(distance-1),total=from+to+distanceDM+effect+steward+refereeDM;
 if(!Number.isSafeInteger(total))throw Error('Passenger modifiers are too large.');
 return {components,origin:from,destination:to,distance:distanceDM,effect,steward,refereeDM,total};
}
export function passengerOffers(origin,destination,distance,options,data,rng=die){
 const dm=passengerDM(origin,destination,distance,options,data),inputs=ctx=>({name:ctx.world?.name||'',population:ctx.uwp.population,starport:ctx.uwp.starport,zone:ctx.zone});
 const pbg=String(origin.world?.raw?.PBG||''),multiplier=/^[0-9]/.test(pbg)?Number(pbg[0]):null,pop=origin.uwp.population;
 // PBG zero on an inhabited world is ambiguous in source data; do not invent an exact cap.
 const originPopulation=multiplier!==null&&(multiplier>0||pop===0)?String(BigInt(multiplier)*10n**BigInt(pop)):null;
 return PASSAGE_CLASSES.map(passageClass=>{
  const traffic=roll(2,rng),classDM=data.passengers.classDM[passageClass],total=traffic.total+dm.total+classDM,band=Math.max(1,Math.min(20,total)),countDice=data.passengers.trafficCountDice[band-1],count=roll(countDice,rng),fare=passengerFare(passageClass,distance,data);
  return {kind:'passenger',passageClass,count:count.total,fare,payment:String(BigInt(fare)*BigInt(count.total)),audit:{dm:structuredClone(dm),traffic,classDM,total,band,countDice,count,distance,worldInputs:{origin:inputs(origin),destination:inputs(destination)},originPopulation,rulesDataVersion:data.passengers.dataVersion,sourcePages:[158,238,239]}};
 });
}
