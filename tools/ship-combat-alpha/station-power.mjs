import {effectiveDesign} from './setup.mjs';
import {powerReport,systemProfile} from './systems.mjs';

export function setStationSystem(systems,key,value){
 const s=structuredClone(systems);
 if(key==='basic'){if(![0,50,100].includes(value))throw Error('Choose Off, 50% or Full.');s.basic=value;}
 else if(['driveEnabled','sensorsEnabled','jumpEnabled','otherEnabled'].includes(key)){if(typeof value!=='boolean')throw Error('Choose On or Off.');s[key]=value;}
 else{const [kind,id]=key.split(':');const row=(kind==='load'?s.loads:kind==='extra'?s.extra:[]).find(r=>r.id===id);if(!row||typeof value!=='boolean')throw Error('Recorded system changed. Reopen Engineer.');row.enabled=value;}
 return s;
}

export function stationPowerRows(ship,systems=ship.systems){
 const p=systemProfile(effectiveDesign(ship));systems={...systems,loads:[...systems.loads,...p.loads.filter(l=>l.id.startsWith('fit-')&&!systems.loads.some(x=>x.id===l.id)).map(l=>({id:l.id,enabled:false,override:null}))]};const rows=[{id:'basic',key:'basic',name:'Basic ship systems',value:systems.basic}];
 if(['mdrive','reaction'].includes(systems.driveKind))rows.push({id:'drive',key:'driveEnabled',name:'Drive allocation',value:systems.driveEnabled});
 if(systems.sensorInstalled===true)rows.push({id:'sensors',key:'sensorsEnabled',name:'Sensors',value:systems.sensorsEnabled});
 if(p.jumpInstalled||systems.jumpEnabled||systems.jumpOverride!=null)rows.push({id:'jump',key:'jumpEnabled',name:'Jump initiation reservation',value:systems.jumpEnabled});
 for(const l of systems.loads)rows.push({id:l.id,key:'load:'+l.id,name:p.loads.find(r=>r.id===l.id)?.name??'Retained source load',value:l.enabled});
 for(const l of systems.extra)rows.push({id:l.id,key:'extra:'+l.id,name:l.name,value:l.enabled});
 if(systems.otherEnabled||systems.otherPower!=null)rows.push({id:'other',key:'otherEnabled',name:systems.otherName,value:systems.otherEnabled});
 return rows.map(row=>{const active=setStationSystem(systems,row.key,row.key==='basic'?100:true),r=powerReport(ship,active).rows.find(r=>r.id===row.id);return {...row,draw:r?.power??null,source:r?.source,note:r?.note??'',fullBasic:row.key==='basic'};});
}
