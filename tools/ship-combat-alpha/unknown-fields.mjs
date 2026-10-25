import {effectiveDesign} from './setup.mjs';
import {systemProfile} from './systems.mjs';
import {parseUnknownNumber} from './unknown-value.mjs';
// An explicit allowlist: numeric entry cannot resolve unidentified equipment text.
export function numericFields(ship){const t=effectiveDesign(ship),r=t?.record??{},c=ship.condition;
 const row=(key,label,value,min=0,max=1000000,step='any')=>({key,label,value,min,max,step});
 return [row('hull','Maximum hull points',t?.hull,1,1000000,1),row('armour','Armour',t?.armour,0,1000,1),row('record.tl','Tech level',r.tl,0,100,1),row('record.jump','Jump rating',r.jump,0,1000,1),row('record.ratedPower','Rated plant output (Power)',r.ratedPower),row('record.fuelCapacity','Fuel capacity (tons)',r.fuelCapacity),row('record.cargoCapacity','Cargo capacity (tons)',r.cargoCapacity),row('record.crewTotal','Crew complement (people)',r.crewTotal,0,1000000,1),row('condition.hull','Current hull points',c.hull,0,c.usableHull??t?.hull??1000000,1),row('condition.fuel','Current fuel (tons)',c.fuel,0,c.usableFuel??r.fuelCapacity??1000000),row('condition.powerOutput','Current plant output (Power)',c.powerOutput,0,c.usablePower??1000000),row('condition.powerUsed','Current used Power',c.powerUsed),row('condition.cargo','Current cargo (tons)',c.cargo,0,r.cargoCapacity??1000000),row('condition.crewAvailable','Available crew (people)',c.crewAvailable,0,r.crewTotal??1000000,1)];
}
export function numericCommand(ship,key,value,expectedRevision){
 const field=numericFields(ship).find(f=>f.key===key);if(!field)throw Error('This field needs its existing equipment editor.');parseUnknownNumber(String(value),field);
 if(key.startsWith('condition.'))return {type:'set-condition',shipId:ship.id,condition:{...ship.condition,[key.slice(10)]:value},expectedRevision};
 const template=effectiveDesign(ship);if(!template)throw Error('Define a ship design in Advanced ship setup first.');
 if(key.startsWith('record.'))template.record[key.slice(7)]=value;else template[key]=value;
 return {type:'set-design',shipId:ship.id,template,expectedRevision};
}
export function systemOverrideTarget(ship,id){const s=ship.systems,p=systemProfile(effectiveDesign(ship));
 const keys={basic:'basicOverride',drive:'driveOverride',sensors:'sensorOverride',jump:'jumpOverride',other:'otherPower'};
 if(id==='drive'&&['none','unknown'].includes(s.driveKind)||id==='sensors'&&s.sensorInstalled!==true||id==='jump'&&!p.jumpInstalled)return null;
 if(keys[id])return {kind:'core',key:keys[id]};
 if(s.loads.some(l=>l.id===id))return {kind:'load',id};
 if(s.extra.some(l=>l.id===id))return {kind:'extra',id};
 return null;
}
export function systemValueCommand(ship,id,value,expectedRevision){
 parseUnknownNumber(String(value),{label:'Operating Power'});const target=systemOverrideTarget(ship,id),systems=structuredClone(ship.systems);if(!target)throw Error('Record the equipment installation in Power & software first.');
 if(target.kind==='core')systems[target.key]=value;else if(target.kind==='load')systems.loads.find(l=>l.id===id).override=value;else systems.extra.find(l=>l.id===id).power=value;
 return {type:'set-systems',shipId:ship.id,systems,expectedRevision};
}
