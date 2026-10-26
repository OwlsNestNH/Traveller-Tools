import {normalizeIdentity} from './ship-identity.mjs';
import {normalizeSystems} from './systems.mjs';
import {reducedVelocity,ROUND_MINUTES} from './movement-rules.mjs';
import {normalizeAppearance,velocityHeading} from './appearance.mjs';
import {MAX_SHIPS,normalizeTemplate,normalizeCrew,normalizeCondition,normalizeSituational,effectiveDesign,normalizeOverrides} from './setup.mjs';
import {preset} from './catalogue.mjs';
// Pure prototype engine: no DOM, storage, network, clocks, or random numbers.
export const API_VERSION=1,MAX_THRUST=10000,COORDINATE_LIMIT=1000000;
const integer=(n,label,min=-COORDINATE_LIMIT,max=COORDINATE_LIMIT)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${label} must be a whole number from ${min} to ${max}.`);return n===0?0:n;};
const vector=(v,label)=>({q:integer(v?.q,label+' Q'),r:integer(v?.r,label+' R')});
const add=(a,b)=>({q:a.q+b.q,r:a.r+b.r});
const subtract=(a,b)=>({q:a.q-b.q,r:a.r-b.r});
export const hexDistance=(a,b={q:0,r:0})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function name(value){if(typeof value!=='string'||!value.trim()||value.length>60)throw Error('Ship name must contain 1 to 60 characters.');return value.trim();}
export const availableThrust=s=>s.capabilities.thrust-(s.flight?.evasion??0)-(s.flight?.gunners??0);
function flight(v={},thrust){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Flight planning must be a record.');const initiative=v.initiative==null?null:integer(v.initiative,'Recorded initiative'),tie=integer(v.tie??0,'Initiative tie order'),evasion=integer(v.evasion??0,'Reserved evasion thrust',0,thrust),gunners=integer(v.gunners??0,'Reserved gunnery thrust',0,thrust);if(evasion+gunners>thrust)throw Error('Thrust reservations exceed current available thrust.');if(v.braking!=null&&typeof v.braking!=='boolean')throw Error('Braking intent must be true or false.');return {initiative,tie,evasion,gunners,braking:v.braking??false};}
export function brakingImpulse(s){return subtract(reducedVelocity(s.motion.velocity,availableThrust(s)),s.motion.velocity);}
export function accelerationOrder(state){if(state.ships.some(s=>s.flight.initiative==null))throw Error('Record initiative for every ship before starting declarations. No initiative is rolled automatically.');return [...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||(a.id<b.id?-1:a.id>b.id?1:0)).map(s=>s.id);}
function assertPlanning(state,id){if(state.acceleration){const next=state.acceleration.order[state.acceleration.declared.length];if(next!==id)throw Error(next?'Declare acceleration for '+getShip(state,next).name+' first.':'All accelerations declared. Resolve movement or cancel declarations.');}}
function assertSetup(state){if(state.acceleration)throw Error('Finish or cancel acceleration declarations before changing encounter setup.');}
function ship(value){
 if(typeof value?.id!=='string'||!/^[-a-z0-9]{1,32}$/.test(value.id))throw Error('Ship ID must use 1 to 32 lowercase letters, digits or hyphens.');
 const thrust=integer(value.capabilities?.thrust,'Thrust',0,MAX_THRUST),plan=flight(value.flight,thrust),motion={position:vector(value.motion?.position,'Position'),velocity:vector(value.motion?.velocity,'Velocity'),impulse:vector(value.motion?.impulse??{q:0,r:0},'Planned thrust')};if(plan.braking){motion.impulse=brakingImpulse({flight:plan,capabilities:{thrust},motion});if(!hexDistance(motion.velocity))plan.braking=false;}const impulse=motion.impulse;
 if(hexDistance(impulse)>thrust-plan.evasion-plan.gunners)throw Error('Planned velocity change exceeds this ship\'s thrust budget.');
 const appearance=normalizeAppearance(value.appearance);appearance.heading=velocityHeading(vector(value.motion?.velocity,'Velocity'),appearance.heading);
 const template=normalizeTemplate(value.template),designOverrides=normalizeOverrides(value.designOverrides,template),effective=effectiveDesign({template,designOverrides});
 const condition=normalizeCondition(value.condition,effective),systems=normalizeSystems(value.systems,effective,thrust,template);
 return {id:value.id,name:name(value.name),identity:normalizeIdentity(value.identity),template,designOverrides,appearance,crew:normalizeCrew(value.crew),condition,systems,situational:normalizeSituational(value.situational),capabilities:{thrust},flight:plan,motion};
}
function checked(state){
 if(state?.version!==API_VERSION)throw Error('Unsupported movement state version.');
 if(!Array.isArray(state.ships)||state.ships.length>MAX_SHIPS)throw Error(`The alpha supports 0 to ${MAX_SHIPS} ships (usability limit).`);
 const ships=Array.from(state.ships,ship);if(new Set(ships.map(s=>s.id)).size!==ships.length)throw Error('Ship IDs must be unique.');
 let acceleration=null;if(state.acceleration!=null){if(state.roundMinutes!==ROUND_MINUTES)throw Error('Companion declarations require six-minute rounds.');const order=accelerationOrder({ships}),v=state.acceleration;if(!Array.isArray(v.order)||JSON.stringify(v.order)!==JSON.stringify(order)||!Array.isArray(v.declared)||JSON.stringify(v.declared)!==JSON.stringify(order.slice(0,v.declared.length))||v.declared.length>order.length)throw Error('Invalid acceleration declaration sequence.');acceleration={order,declared:[...v.declared]};}
 return {version:API_VERSION,acceleration,revision:integer(state.revision,'Revision',0,1000000),round:integer(state.round,'Completed rounds',0,1000000),roundMinutes:integer(state.roundMinutes,'Round duration',1,60),ships};
}
// Fresh/reset demonstration only: retain each complete catalogue record and its citation.
// Positions, velocities, sides and Green crew are scenario choices, not published ship facts.
// Current condition follows ordinary preset creation, including explicit published initial values.
export function sampleShips(){
 // Fresh samples follow approved source-specific presentation mappings. Saved overrides stay explicit.
 return [
 ['merchant','acs2023-p22',-15,6,2,0],['courier','acs2023-p136',9,-9,-1,1],['escort','drinax-harrier-restored',-6,-12,1,1],['scout','acs2023-p6',3,12,0,-1],['fighter','scc2023-p051',18,6,-2,-1]
].map(([id,presetId,q,r,vq,vr])=>{const template=preset(presetId);return {id,name:template.name,template,appearance:{side:['escort','fighter'].includes(id)?'B':'A',icon:'auto'},crew:{mode:'quick',rating:'Green',ratingVersion:2},systems:{mode:'allocated'},condition:{hull:template.hull,...template.initialCondition},capabilities:{thrust:template.thrust},motion:{position:{q,r},velocity:{q:vq,r:vr},impulse:{q:0,r:0}}};});}
export function createState({ships=sampleShips(),roundMinutes=ROUND_MINUTES}={}){return checked({version:API_VERSION,revision:0,round:0,roundMinutes,ships});}
export function getShip(state,id){const found=state.ships.find(s=>s.id===id);if(!found)throw Error('Select an existing ship.');return found;}
export function coastTarget(ship){return add(ship.motion.position,ship.motion.velocity);}
export function plannedTarget(ship){return add(coastTarget(ship),ship.motion.impulse);}
export function reachableCount(thrust){integer(thrust,'Thrust',0,MAX_THRUST);return 1+3*thrust*(thrust+1);}
export function plotCost(ship,target){target=vector(target,'Target');vector(subtract(target,ship.motion.position),'Resulting velocity');return hexDistance(target,coastTarget(ship));}
export function canPlot(ship,target){try{return plotCost(ship,target)<=availableThrust(ship);}catch{return false;}}
// JSON command contract. Successful commands return a new normalized state;
// rejected commands leave the caller's original state untouched.
export function applyCommand(input,command){
 const state=checked(input);
 if(command?.expectedRevision!==undefined&&command.expectedRevision!==state.revision)throw Error('State changed; refresh the command revision.');
 if(state.revision===1000000)throw Error('Prototype revision limit reached. Reset the sample.');
 switch(command?.type){
 case 'plot':{
  const s=getShip(state,command.shipId);assertPlanning(state,s.id);const target=vector(command.target,'Target'),cost=plotCost(s,target);
  if(cost>availableThrust(s))throw Error(`Target needs ${cost} thrust; ${availableThrust(s)} available. Choose a reachable hex.`);
  s.flight.braking=false;s.motion.impulse=subtract(target,coastTarget(s));break;
 }
 case 'replace-ships':assertSetup(state);state.ships=command.ships;break;
 case 'set-design':{assertSetup(state);const s=getShip(state,command.shipId),next=normalizeTemplate(command.template);if(!next)throw Error('Enter a design record.');if(s.template)s.designOverrides=normalizeOverrides(next,s.template);else{s.template=next;s.designOverrides=null;}if(command.useDesignThrust===true){s.capabilities.thrust=effectiveDesign(s).thrust;s.motion.impulse={q:0,r:0};}break;}
 case 'set-identity':{const s=getShip(state,command.shipId);s.name=name(command.name);s.identity=normalizeIdentity(command.identity);s.appearance=normalizeAppearance({...s.appearance,side:command.side});break;}
 case 'set-appearance':{const s=getShip(state,command.shipId);s.appearance=normalizeAppearance({...s.appearance,...command.appearance});break;}
 case 'remove-ship':{assertSetup(state);getShip(state,command.shipId);state.ships=state.ships.filter(s=>s.id!==command.shipId);break;}
 case 'clear-ships':assertSetup(state);state.ships=[];break;
 case 'add-ship':{
  assertSetup(state);
  if(state.ships.length>=MAX_SHIPS)throw Error(`Encounter full: the alpha limit is ${MAX_SHIPS} ships. No ship was added or replaced.`);
  const template=normalizeTemplate(command.presetId?preset(command.presetId):command.template),designOverrides=normalizeOverrides(command.designOverrides,template),effective=effectiveDesign({template,designOverrides});
  if(!template)throw Error('Choose a preset or enter a custom design.');
  let n=1;while(state.ships.some(s=>s.id==='ship-'+n))n++;
  state.ships.push(ship({id:'ship-'+n,name:command.name,identity:command.identity,template,designOverrides,appearance:command.appearance,crew:command.crew??{},systems:command.systems??{mode:'allocated'},condition:{hull:effective.hull,...(command.presetId?preset(command.presetId).initialCondition:undefined),...command.condition},capabilities:{thrust:effective.thrust},motion:{position:command.position,velocity:command.velocity}}));break;
 }
 case 'set-crew':{const s=getShip(state,command.shipId);s.crew=normalizeCrew(command.crew);s.situational=normalizeSituational(command.situational);break;}
 case 'set-condition':{const s=getShip(state,command.shipId),next=normalizeCondition(command.condition,effectiveDesign(s));if(next.powerUsed!==s.condition.powerUsed)s.systems.mode='manual';s.condition=next;break;}
 case 'set-systems':{const s=getShip(state,command.shipId);s.systems=normalizeSystems(command.systems,effectiveDesign(s),s.capabilities.thrust,s.template);break;}
 case 'record-initiatives':{assertSetup(state);if(!Array.isArray(command.entries)||command.entries.length!==state.ships.length||new Set(command.entries.map(e=>e.shipId)).size!==state.ships.length)throw Error('Record one initiative entry for every current ship.');for(const entry of command.entries){const s=getShip(state,entry.shipId);s.flight=flight({...s.flight,initiative:entry.initiative,tie:entry.tie},s.capabilities.thrust);}break;}
 case 'set-flight-plan':{if(!command.flight||typeof command.flight!=='object'||Array.isArray(command.flight)||Object.hasOwn(command.flight,'braking'))throw Error('Enter a flight-planning record; use brake/coast to change stop intent.');const s=getShip(state,command.shipId);assertPlanning(state,s.id);const next=flight({...s.flight,...command.flight},s.capabilities.thrust);if(state.acceleration&&(next.initiative!==s.flight.initiative||next.tie!==s.flight.tie))throw Error('Cancel declarations before changing initiative order.');s.flight=next;break;}
 case 'begin-acceleration':if(state.acceleration)throw Error('Acceleration declarations already started.');if(!state.ships.length)throw Error('Add a ship before declaring acceleration.');if(state.roundMinutes!==ROUND_MINUTES)throw Error('Companion declarations require six-minute rounds.');state.acceleration={order:accelerationOrder(state),declared:[]};break;
 case 'declare-acceleration':{if(!state.acceleration)throw Error('Begin acceleration declarations first.');const s=getShip(state,command.shipId);assertPlanning(state,s.id);state.acceleration.declared.push(s.id);break;}
 case 'cancel-acceleration':state.acceleration=null;break;
 case 'brake':{const s=getShip(state,command.shipId);assertPlanning(state,s.id);s.flight.braking=hexDistance(s.motion.velocity)>0;s.motion.impulse=brakingImpulse(s);break;}
 case 'coast':{const s=getShip(state,command.shipId);assertPlanning(state,s.id);s.flight.braking=false;s.motion.impulse={q:0,r:0};break;}
 case 'edit-ship':{
  assertSetup(state);const s=getShip(state,command.shipId);s.name=name(command.name);s.capabilities.thrust=integer(command.thrust,'Thrust',0,MAX_THRUST);
  const velocity=vector(command.velocity,'Velocity');if(velocity.q!==s.motion.velocity.q||velocity.r!==s.motion.velocity.r)s.flight.braking=false;s.motion={position:vector(command.position,'Position'),velocity,impulse:{q:0,r:0}};break;
 }
 case 'advance-round':
  if(state.acceleration&&state.acceleration.declared.length!==state.acceleration.order.length)throw Error('Every ship must declare acceleration before simultaneous movement.');
  if(!state.ships.length)throw Error('Add a ship before advancing the round.');
  if(state.round===1000000)throw Error('Prototype round limit reached. Reset the sample.');
  for(const s of state.ships){s.motion.velocity=vector(add(s.motion.velocity,s.motion.impulse),'Resulting velocity');s.motion.position=vector(add(s.motion.position,s.motion.velocity),'Resulting position');s.motion.impulse={q:0,r:0};if(!hexDistance(s.motion.velocity))s.flight.braking=false;}
  state.acceleration=null;state.round++;break;
 default:throw Error('Unknown movement command.');
 }
 state.revision++;return checked(state);
}

export function normalizeState(input){return checked(input);}
