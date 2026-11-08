// Qualified external inputs. This module validates conversion, not another book's claims.
import {assertKeys,integer} from './schema.mjs';
const source={book:'Robot Handbook',edition:'Mongoose 2022',pages:'62'};
export function externalVehicleControl(options){return{field:'externalVehicleOptions',label:'External vehicle options (qualified)',category:'Slot Cost Options',type:'external-vehicle-options',recordNameField:'name',recordIdPrefix:'veh-',composerLabel:'Source-defined external option',maxItems:50,addLabel:'Add external vehicle option',description:'Book-permitted external inputs remain unverified and block automatic certification. Robot Handbook equivalents must be used instead.',source,itemFields:[
 {field:'name',label:'Source option name',type:'text',maxLength:120,default:'External vehicle option'},
 {field:'sourceTitle',label:'Source book',type:'text',maxLength:120,default:'Vehicle Handbook'},
 {field:'sourceEdition',label:'Source edition',type:'text',maxLength:80,default:''},
 {field:'sourcePage',label:'Printed source page',type:'text',maxLength:40,default:''},
 {field:'minimumTL',label:'Source minimum TL',type:'number',min:1,max:23,default:5},
 {field:'quantity',label:'Installations',type:'number',min:1,max:1000,default:1},
 {field:'spaceRule',label:'Source space rule',type:'select',default:'fixed',choices:[{id:'fixed',label:'Fixed vehicle Spaces'},{id:'percent',label:'Percentage of space basis'},{id:'zero',label:'Zero Spaces (must use robot equivalent)'}]},
 {field:'spaceValue',label:'Spaces or percent',type:'number',min:0,max:100000,step:.001,allowFraction:true,default:1},
 {field:'percentageBasis',label:'Percentage interpretation',type:'select',default:'unresolved',visibleWhen:{field:'spaceRule',equals:'percent'},choices:[{id:'unresolved',label:'Unresolved basis'},{id:'robot-base-slots',label:'Referee interpretation: robot Base Slots'},{id:'chassis-vehicle-equivalent',label:'Referee interpretation: chassis vehicle-space equivalent'}]},
 {field:'pricePerInstallation',label:'Source price per installation (Cr)',type:'number',min:0,max:1000000000,default:0},
 {field:'handbookEquivalent',label:'Robot Handbook equivalent',type:'select',default:'unresolved',choices:[{id:'unresolved',label:'Equivalence not reviewed'},{id:'none',label:'Declared no equivalent (still unverified)'},...options.map(o=>({id:o.id,label:o.label}))]}
 ]};}
export function validateExternalVehicleOptions(records,options){
 if(!Array.isArray(records)||records.length>50)throw new TypeError('Expected up to50 external vehicle option records.');const ids=new Set();
 for(const r of records){assertKeys(r,['id','name','sourceTitle','sourceEdition','sourcePage','minimumTL','quantity','spaceRule','spaceValue','percentageBasis','pricePerInstallation','handbookEquivalent'],'physical.externalVehicleOptions');if(typeof r.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(r.id)||ids.has(r.id))throw new TypeError('Invalid or duplicate external option ID.');ids.add(r.id);
 for(const [field,max]of [['name',120],['sourceTitle',120],['sourceEdition',80],['sourcePage',40]])if(typeof r[field]!=='string'||r[field].length>max)throw new TypeError('Invalid external source field '+field);
 integer(r.minimumTL,1,23,'minimumTL');integer(r.quantity,1,1000,'quantity');integer(r.pricePerInstallation,0,1000000000,'pricePerInstallation');
 if(typeof r.spaceValue!=='number'||!Number.isFinite(r.spaceValue)||r.spaceValue<0||r.spaceValue>100000)throw new TypeError('Invalid external space amount.');
 if(!['fixed','percent','zero'].includes(r.spaceRule)||!['unresolved','robot-base-slots','chassis-vehicle-equivalent'].includes(r.percentageBasis)||!['unresolved','none',...options.map(o=>o.id)].includes(r.handbookEquivalent))throw new TypeError('Unknown external option rule choice.');
 }
}
export function evaluateExternalVehicleOptions(design,chassis,options){let cost=0,slots=0;const diagnostics=[],ledger=[],estimates=[];const issue=(severity,code,r,message)=>diagnostics.push({severity,code,path:'physical.externalVehicleOptions.'+r.id,message,source});
 for(const r of design.selections.physical.externalVehicleOptions){let eachSlots=null;const externalSource={book:r.sourceTitle,edition:r.sourceEdition,pages:r.sourcePage};
 issue('blocker','EXTERNAL_OPTION_UNVERIFIED',r,'External source edition, option definition, absence of a robot equivalent and all installation prerequisites are not source-verified. Conversion estimates do not certify this design.');
 if(![r.name,r.sourceTitle,r.sourceEdition,r.sourcePage].every(v=>v.trim()))issue('blocker','EXTERNAL_SOURCE_REQUIRED',r,'Identify the option, source book, edition and printed page.');
 if(r.minimumTL>design.techLevel)issue('error','EXTERNAL_OPTION_TL',r,'Declared source minimum TL exceeds the robot technology.');
 if(r.handbookEquivalent==='unresolved')issue('blocker','EXTERNAL_EQUIVALENCE_REQUIRED',r,'Check whether a Robot Handbook equivalent exists before conversion.');
 else if(r.handbookEquivalent!=='none')issue('error','ROBOT_EQUIVALENT_REQUIRED',r,'Use '+options.find(o=>o.id===r.handbookEquivalent).label+' through the normal robot catalogue. External data cannot override its Slots or price.');
 else if(r.spaceRule==='zero'||r.spaceValue===0)issue('blocker','ZERO_SPACE_EQUIVALENT',r,'Zero-Space vehicle options must use a Robot Handbook equivalent; zero vehicle volume does not grant a free robot option.');
 else if(options.some(o=>o.label.replace(' (unassociated hardware)','').toLowerCase()===r.name.trim().toLowerCase()))issue('error','ROBOT_EQUIVALENT_REQUIRED',r,'The supplied name matches a Robot Handbook option. Use that source-defined option instead of an external slot/price override.');
 else if(r.spaceRule==='fixed')eachSlots=Math.max(1,Math.ceil(64*r.spaceValue-Number.EPSILON*Math.max(1,64*r.spaceValue)));
 else if(r.spaceRule==='percent'){
  if(r.spaceValue>100)issue('error','EXTERNAL_PERCENT_LIMIT',r,'Percentage exceeds100.');
  else if(r.percentageBasis==='unresolved')issue('blocker','EXTERNAL_PERCENT_BASIS',r,'The source percentage basis must be explicitly interpreted; it is not silently assumed to mean free robot Slots.');
  else{const basis=r.percentageBasis==='robot-base-slots'?chassis.slots:chassis.vehicleSpaces*64;if(!basis)issue('blocker','EXTERNAL_PERCENT_SIZE',r,'The printed chassis vehicle-space equivalent is below its table precision; no zero-size percentage installation is inferred.');else{eachSlots=Math.max(1,Math.ceil(basis*r.spaceValue/100-Number.EPSILON*Math.max(1,basis*r.spaceValue/100)));issue('warning','EXTERNAL_PERCENT_INTERPRETATION',r,'Using explicitly selected '+r.percentageBasis+' percentage basis.');}}
 }
 const quotedCost=r.pricePerInstallation*r.quantity,convertedSlots=eachSlots===null?null:eachSlots*r.quantity;cost+=quotedCost;if(convertedSlots!==null)slots+=convertedSlots;
 ledger.push({id:'external-vehicle-'+r.id,label:r.name+' (unverified external input)',cost:quotedCost,slots:convertedSlots,quantity:r.quantity,source,externalSource});estimates.push({id:r.id,name:r.name,quantity:r.quantity,convertedSlots,quotedCost,externalSource,source,verified:false,scope:'Conversion of supplied figures only; not source or prerequisite verification.'});
 }
 return{cost,slots,diagnostics,ledger,estimates};}
