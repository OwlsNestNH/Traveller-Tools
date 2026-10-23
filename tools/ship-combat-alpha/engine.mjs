// Pure prototype engine: no DOM, storage, network, clocks, or random numbers.
export const API_VERSION=1,MAX_THRUST=10000,COORDINATE_LIMIT=1000000;
const integer=(n,label,min=-COORDINATE_LIMIT,max=COORDINATE_LIMIT)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${label} must be a whole number from ${min} to ${max}.`);return n===0?0:n;};
const vector=(v,label)=>({q:integer(v?.q,label+' Q'),r:integer(v?.r,label+' R')});
const add=(a,b)=>({q:a.q+b.q,r:a.r+b.r});
const subtract=(a,b)=>({q:a.q-b.q,r:a.r-b.r});
export const hexDistance=(a,b={q:0,r:0})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function name(value){if(typeof value!=='string'||!value.trim()||value.length>60)throw Error('Ship name must contain 1 to 60 characters.');return value.trim();}
function ship(value){
 if(typeof value?.id!=='string'||!/^[-a-z0-9]{1,32}$/.test(value.id))throw Error('Ship ID must use 1 to 32 lowercase letters, digits or hyphens.');
 const thrust=integer(value.capabilities?.thrust,'Thrust',0,MAX_THRUST),impulse=vector(value.motion?.impulse??{q:0,r:0},'Planned thrust');
 if(hexDistance(impulse)>thrust)throw Error('Planned velocity change exceeds this ship\'s thrust budget.');
 return {id:value.id,name:name(value.name),capabilities:{thrust},motion:{position:vector(value.motion?.position,'Position'),velocity:vector(value.motion?.velocity,'Velocity'),impulse}};
}
function checked(state){
 if(state?.version!==API_VERSION)throw Error('Unsupported movement state version.');
 if(!Array.isArray(state.ships)||state.ships.length<1||state.ships.length>8)throw Error('The movement prototype supports 1 to 8 ships.');
 const ships=Array.from(state.ships,ship);if(new Set(ships.map(s=>s.id)).size!==ships.length)throw Error('Ship IDs must be unique.');
 return {version:API_VERSION,revision:integer(state.revision,'Revision',0,1000000),round:integer(state.round,'Completed rounds',0,1000000),roundMinutes:integer(state.roundMinutes,'Round duration',1,60),ships};
}
export function sampleShips(){return [
 ['merchant','Merchant',1,-5,2,2,0],['courier','Courier',3,3,-3,-1,1],['escort','Escort',6,-2,-4,1,1],['scout','Scout',2,1,4,0,-1],['fighter','Fighter',9,6,2,-2,-1]
].map(([id,label,thrust,q,r,vq,vr])=>({id,name:label,capabilities:{thrust},motion:{position:{q,r},velocity:{q:vq,r:vr},impulse:{q:0,r:0}}}));}
export function createState({ships=sampleShips(),roundMinutes=6}={}){return checked({version:API_VERSION,revision:0,round:0,roundMinutes,ships});}
export function getShip(state,id){const found=state.ships.find(s=>s.id===id);if(!found)throw Error('Select an existing ship.');return found;}
export function coastTarget(ship){return add(ship.motion.position,ship.motion.velocity);}
export function plannedTarget(ship){return add(coastTarget(ship),ship.motion.impulse);}
export function reachableCount(thrust){integer(thrust,'Thrust',0,MAX_THRUST);return 1+3*thrust*(thrust+1);}
export function plotCost(ship,target){return hexDistance(vector(target,'Target'),coastTarget(ship));}
export function canPlot(ship,target){try{return plotCost(ship,target)<=ship.capabilities.thrust;}catch{return false;}}
// JSON command contract. Successful commands return a new normalized state;
// rejected commands leave the caller's original state untouched.
export function applyCommand(input,command){
 const state=checked(input);
 if(command?.expectedRevision!==undefined&&command.expectedRevision!==state.revision)throw Error('State changed; refresh the command revision.');
 if(state.revision===1000000)throw Error('Prototype revision limit reached. Reset the sample.');
 switch(command?.type){
 case 'plot':{
  const s=getShip(state,command.shipId),target=vector(command.target,'Target'),cost=plotCost(s,target);
  if(cost>s.capabilities.thrust)throw Error(`Target needs ${cost} thrust; ${s.capabilities.thrust} available. Choose a reachable hex.`);
  s.motion.impulse=subtract(target,coastTarget(s));break;
 }
 case 'coast':getShip(state,command.shipId).motion.impulse={q:0,r:0};break;
 case 'edit-ship':{
  const s=getShip(state,command.shipId);s.name=name(command.name);s.capabilities.thrust=integer(command.thrust,'Thrust',0,MAX_THRUST);
  s.motion={position:vector(command.position,'Position'),velocity:vector(command.velocity,'Velocity'),impulse:{q:0,r:0}};break;
 }
 case 'advance-round':
  if(state.round===1000000)throw Error('Prototype round limit reached. Reset the sample.');
  for(const s of state.ships){s.motion.velocity=vector(add(s.motion.velocity,s.motion.impulse),'Resulting velocity');s.motion.position=vector(add(s.motion.position,s.motion.velocity),'Resulting position');s.motion.impulse={q:0,r:0};}
  state.round++;break;
 default:throw Error('Unknown movement command.');
 }
 state.revision++;return checked(state);
}
