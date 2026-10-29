import {normalizeDuty,freshDuty,dutyPenalty,expiredRepairs,crewIdentity} from './crew-duty.mjs';
import {applyCrewAction} from './crew-actions.mjs';
import {freshMissiles,normalizeMissiles,missileQueue,moveMissiles,applyEW,detectSalvo} from './missiles.mjs';
import {arrivals,recordedImpacts} from './missile-impact.mjs';
import {diceTotal} from './direct-fire-rules.mjs';
import {normalizeDamageLedger} from './damage-ledger.mjs';
import {normalizeCombatHistory,recordedResolution} from './direct-fire-resolution.mjs';
import {directFireQueue,unresolvedDeclarations} from './direct-fire-profile.mjs';
import {nextGunner,normalizeDeclarations} from './gunnery.mjs';
import {normalizeInitiativeRecord} from './initiative.mjs';
import {normalizeWorkflow,canPlanWorkflow} from './workflow.mjs';
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
function flight(v={},thrust){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Flight planning must be a record.');const initiative=v.initiative==null?null:integer(v.initiative,'Recorded initiative'),tie=integer(v.tie??0,'Initiative tie order'),evasion=integer(v.evasion??0,'Reserved evasion thrust',0,thrust),gunners=integer(v.gunners??0,'Reserved gunnery thrust',0,thrust);if(evasion+gunners>thrust)throw Error('Thrust reservations exceed current available thrust.');if(v.braking!=null&&typeof v.braking!=='boolean')throw Error('Braking intent must be true or false.');const record=normalizeInitiativeRecord(v.initiativeRecord);return {initiative,tie,evasion,gunners,braking:v.braking??false,...(record&&initiative!==null?{initiativeRecord:record}:{})};}
export function brakingImpulse(s){return subtract(reducedVelocity(s.motion.velocity,availableThrust(s)),s.motion.velocity);}
export function accelerationOrder(state){if(state.ships.some(s=>s.flight.initiative==null))throw Error('Record initiative for every ship before starting declarations. No initiative is rolled automatically.');return [...state.ships].sort((a,b)=>a.flight.initiative-b.flight.initiative||a.flight.tie-b.flight.tie||(a.id<b.id?-1:a.id>b.id?1:0)).map(s=>s.id);}
function assertPlanning(state,id){if(!canPlanWorkflow(state))throw Error('Plot movement during the Thrust phase.');if(state.acceleration){const next=state.acceleration.order[state.acceleration.declared.length];if(next!==id)throw Error(next?'Declare acceleration for '+getShip(state,next).name+' first.':'All accelerations declared. Resolve movement or cancel declarations.');}}
function assertSetup(state){if(state.workflow)throw Error('Leave battle workflow before changing encounter setup or confirmed initiative.');if(state.acceleration)throw Error('Finish or cancel acceleration declarations before changing encounter setup.');}
function ship(value){
 if(typeof value?.id!=='string'||!/^[-a-z0-9]{1,32}$/.test(value.id))throw Error('Ship ID must use 1 to 32 lowercase letters, digits or hyphens.');
 const thrust=integer(value.capabilities?.thrust,'Thrust',0,MAX_THRUST),plan=flight(value.flight,thrust),motion={position:vector(value.motion?.position,'Position'),velocity:vector(value.motion?.velocity,'Velocity'),impulse:vector(value.motion?.impulse??{q:0,r:0},'Planned thrust')};if(plan.braking){motion.impulse=brakingImpulse({flight:plan,capabilities:{thrust},motion});if(!hexDistance(motion.velocity))plan.braking=false;}const impulse=motion.impulse;
 if(hexDistance(impulse)>thrust-plan.evasion-plan.gunners)throw Error('Planned velocity change exceeds this ship\'s thrust budget.');
 const appearance=normalizeAppearance(value.appearance);appearance.heading=velocityHeading(vector(value.motion?.velocity,'Velocity'),appearance.heading);
 const template=normalizeTemplate(value.template),designOverrides=normalizeOverrides(value.designOverrides,template),effective=effectiveDesign({template,designOverrides});
 const condition=normalizeCondition(value.condition,effective),systems=normalizeSystems(value.systems,effective,thrust,template);
 return {id:value.id,name:name(value.name),identity:normalizeIdentity(value.identity),template,designOverrides,appearance,crew:normalizeCrew(value.crew),...(value.crewDuty==null?{}:{crewDuty:normalizeDuty(value.crewDuty)}),condition,systems,situational:normalizeSituational(value.situational),capabilities:{thrust},flight:plan,motion,...(value.combatDamage==null?{}:{combatDamage:normalizeDamageLedger(value.combatDamage)})};
}
function checked(state){
 if(state?.version!==API_VERSION)throw Error('Unsupported movement state version.');
 if(!Array.isArray(state.ships)||state.ships.length>MAX_SHIPS)throw Error(`The alpha supports 0 to ${MAX_SHIPS} ships (usability limit).`);
 const ships=Array.from(state.ships,ship);if(new Set(ships.map(s=>s.id)).size!==ships.length)throw Error('Ship IDs must be unique.');
 let acceleration=null;if(state.acceleration!=null){if(state.roundMinutes!==ROUND_MINUTES)throw Error('Companion declarations require six-minute rounds.');const order=accelerationOrder({ships}),v=state.acceleration;if(!Array.isArray(v.order)||JSON.stringify(v.order)!==JSON.stringify(order)||!Array.isArray(v.declared)||JSON.stringify(v.declared)!==JSON.stringify(order.slice(0,v.declared.length))||v.declared.length>order.length)throw Error('Invalid acceleration declaration sequence.');acceleration={order,declared:[...v.declared]};}
 const missileCombat=normalizeMissiles(state.missileCombat,rows=>rows.map(ship));
 const workflow=normalizeWorkflow(state.workflow,ships,acceleration),combatHistory=normalizeCombatHistory(state.combatHistory,rows=>{if(!Array.isArray(rows)||rows.length>MAX_SHIPS)throw Error('Invalid snapshot ships.');return rows.map(ship);});
 if(workflow&&ships.some(s=>s.crewDuty&&s.crewDuty.round!==state.round+(['thrust','movement'].includes(workflow.phase)?1:0)))throw Error('Crew duty round and workflow disagree.');
 if(workflow?.resolutionId&&!combatHistory.some(r=>r.id===workflow.resolutionId&&r.snapshot.round===state.round&&JSON.stringify(r.snapshot.workflow.gunnery)===JSON.stringify(workflow.gunnery)))throw Error('Active resolution record is missing or mismatched.');
 if(workflow?.phase==='attacks'&&!workflow.resolutionId&&combatHistory.some(r=>r.snapshot.round===state.round))throw Error('Current round resolution reference is missing.');
 return {version:API_VERSION,...(missileCombat?{missileCombat}:{}),...(combatHistory.length?{combatHistory}:{}),acceleration,workflow,revision:integer(state.revision,'Revision',0,1000000),round:integer(state.round,'Completed rounds',0,1000000),roundMinutes:integer(state.roundMinutes,'Round duration',1,60),ships};
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
function archiveResolution(state,dice){const snapshot=structuredClone({round:state.round,ships:state.ships,workflow:state.workflow,missileCombat:state.missileCombat??freshMissiles()}),resolved=recordedResolution(snapshot,dice),id='r'+state.round+'-v'+state.revision;state.combatHistory??=[];state.combatHistory.push({version:1,id,snapshot,dice:[...dice],results:resolved.results,plan:resolved.plan,usage:resolved.usage,pending:resolved.pending,...(resolved.missileCombat?{missileAfter:resolved.missileCombat}:{})});if(resolved.missileCombat)state.missileCombat=resolved.missileCombat;state.ships=resolved.ships;state.workflow.resolutionId=id;return state.combatHistory.at(-1);}
export function applyCommand(input,command){
 const state=checked(input);
 if(command?.expectedRevision!==undefined&&command.expectedRevision!==state.revision)throw Error('State changed; refresh the command revision.');
 if(state.revision===1000000)throw Error('Prototype revision limit reached. Reset the sample.');
 if(state.ships.some(s=>expiredRepairs(s,state.round).length)&&['resolve-direct-fire','resolve-missile-impacts','missile-ew','scan-missiles','crew-action'].includes(command?.type))throw Error('Review expired temporary repairs before automated actions.');
 const pendingCriticals=state.ships.some(s=>s.combatDamage?.pending.length||expiredRepairs(s,state.round).length)||state.missileCombat?.salvos.some(s=>s.status==='manual');
 if(pendingCriticals&&(['plot','brake','coast','set-flight-plan','begin-acceleration','declare-acceleration','start-battle','advance-round'].includes(command?.type)||command?.type==='next-battle-phase'&&command.phase==='crew'))throw Error('Confirm pending critical effects and expired temporary repairs handled before automated movement or the next round.');
 switch(command?.type){
 case 'review-expired-repair':{const s=getShip(state,command.shipId);if(!expiredRepairs(s,state.round).some(a=>a.id===command.actionId)||typeof command.note!=='string'||!command.note.trim()||command.note.length>300)throw Error('Record how expired temporary effects were reversed or never applied.');s.crewDuty.repairReviews.push({actionId:command.actionId,note:command.note.trim()});break;}
 case 'crew-action':applyCrewAction(state,command);break;
 case 'resolve-missile-impacts':{const r=recordedImpacts(state,command.dice);state.ships=r.ships;state.missileCombat=r.missileCombat;break;}
 case 'missile-ew':applyEW(state,command.shipId,command.salvoId,command.dice);break;
 case 'scan-missiles':{if(state.workflow?.phase!=='thrust'||state.acceleration?.declared.length)throw Error('Scan at the start of the round before committing movement.');const observer=getShip(state,command.shipId),round=state.round+1;state.missileCombat??=freshMissiles();if(state.missileCombat.scans.some(s=>s.round===round&&s.shipId===observer.id))throw Error('This round scan is already recorded.');if(!Array.isArray(command.dice)||command.dice.length>2000)throw Error('Invalid scan dice.');let i=0;const roll=n=>Array.from({length:n},()=>{const d=command.dice[i++];diceTotal([d],1);return d;});for(const salvo of state.missileCombat.salvos.filter(s=>s.status==='flight'&&s.count>0))detectSalvo(state,salvo,roll,{observerId:observer.id,round});if(i!==command.dice.length)throw Error('Unused scan dice.');state.missileCombat.scans.push({round,shipId:observer.id,dice:[...command.dice]});break;}
 case 'acknowledge-critical-effects':{const s=getShip(state,command.shipId),ledger=s.combatDamage;if(!ledger?.pending.length||typeof command.note!=='string'||!command.note.trim()||command.note.length>300)throw Error('Describe the pending critical effects handled manually.');ledger.handled.push({ids:[...ledger.pending],note:command.note.trim()});ledger.pending=[];break;}
 case 'resolve-direct-fire':{
  if(state.workflow?.phase!=='attacks'||nextGunner(state)||state.workflow.resolutionId||(state.combatHistory??[]).some(r=>r.snapshot.round===state.round))throw Error('Complete declarations first; direct fire can resolve only once per round.');
  archiveResolution(state,command.dice);break;
 }
 case 'plot':{
  const s=getShip(state,command.shipId);assertPlanning(state,s.id);if(!dutyPenalty(s,'pilot').available)throw Error('Pilot unavailable; coast without thrust.');const target=vector(command.target,'Target'),cost=plotCost(s,target);
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
 case 'set-crew':{const s=getShip(state,command.shipId);if((state.workflow&&s.crewDuty?.actions.length||s.crewDuty?.moves.some(m=>m.availableRound>s.crewDuty.round))&&crewIdentity(normalizeCrew(command.crew))!==crewIdentity(s.crew))throw Error('Finish combat before editing crew assignments with committed crew actions.');s.crew=normalizeCrew(command.crew);s.situational=normalizeSituational(command.situational);break;}
 case 'set-condition':{const s=getShip(state,command.shipId),next=normalizeCondition(command.condition,effectiveDesign(s));if(next.powerUsed!==s.condition.powerUsed)s.systems.mode='manual';s.condition=next;break;}
 case 'set-systems':{const s=getShip(state,command.shipId);s.systems=normalizeSystems(command.systems,effectiveDesign(s),s.capabilities.thrust,s.template);break;}
 case 'record-initiatives':{assertSetup(state);if(!Array.isArray(command.entries)||command.entries.length!==state.ships.length||new Set(command.entries.map(e=>e.shipId)).size!==state.ships.length)throw Error('Record one initiative entry for every current ship.');for(const entry of command.entries){const s=getShip(state,entry.shipId);s.flight=flight({...s.flight,initiative:entry.initiative,tie:entry.tie,initiativeRecord:Object.hasOwn(entry,'initiativeRecord')?entry.initiativeRecord:entry.initiative===s.flight.initiative?s.flight.initiativeRecord:null},s.capabilities.thrust);}break;}
 case 'set-flight-plan':{if(!command.flight||typeof command.flight!=='object'||Array.isArray(command.flight)||Object.hasOwn(command.flight,'braking'))throw Error('Enter a flight-planning record; use brake/coast to change stop intent.');const s=getShip(state,command.shipId);assertPlanning(state,s.id);const next=flight({...s.flight,...command.flight,...(Object.hasOwn(command.flight,'initiative')&&command.flight.initiative!==s.flight.initiative?{initiativeRecord:null}:{})},s.capabilities.thrust);if((state.acceleration||state.workflow)&&(next.initiative!==s.flight.initiative||next.tie!==s.flight.tie))throw Error('Cancel declarations before changing initiative order.');if(!dutyPenalty(s,'pilot').available&&(next.evasion||next.gunners))throw Error('Pilot unavailable for thrust reservations.');s.flight=next;break;}
 case 'begin-acceleration':if(state.workflow)throw Error('Use the active battle workflow.');if(state.acceleration)throw Error('Acceleration declarations already started.');if(!state.ships.length)throw Error('Add a ship before declaring acceleration.');if(state.roundMinutes!==ROUND_MINUTES)throw Error('Companion declarations require six-minute rounds.');state.acceleration={order:accelerationOrder(state),declared:[]};break;
 case 'declare-acceleration':{if(!state.acceleration)throw Error('Begin acceleration declarations first.');const s=getShip(state,command.shipId);assertPlanning(state,s.id);state.acceleration.declared.push(s.id);if(state.workflow&&state.acceleration.declared.length===state.ships.length)state.workflow.phase='movement';break;}
 case 'cancel-acceleration':if(state.workflow){if(!['thrust','movement'].includes(state.workflow.phase))throw Error('Movement has already been committed.');state.workflow.phase='thrust';state.acceleration={order:accelerationOrder(state),declared:[]};}else state.acceleration=null;break;
 case 'start-battle':{assertSetup(state);if(state.roundMinutes!==ROUND_MINUTES)throw Error('Battle workflow requires six-minute rounds.');if(!state.ships.length)throw Error('Add a ship before starting battle workflow.');const order=accelerationOrder(state);for(const ship of state.ships){ship.crewDuty??=freshDuty(state.round+1);ship.crewDuty.round=state.round+1;}state.workflow={version:1,phase:'thrust',initiatives:state.ships.map(s=>({shipId:s.id,initiative:s.flight.initiative,tie:s.flight.tie}))};state.acceleration={order,declared:[]};break;}
 case 'leave-battle':if(state.missileCombat?.salvos.some(s=>s.status==='manual'))throw Error('Acknowledge pending manual missile impacts before leaving the workflow.');if(state.workflow?.phase==='attacks'&&state.workflow.gunnery.declarations.length&&nextGunner(state))throw Error('Finish locked declarations before leaving the workflow.');if(!state.workflow)throw Error('No active battle workflow.');state.workflow=null;state.acceleration=null;break;
 case 'declare-gunnery':{if(state.workflow?.phase!=='attacks'||nextGunner(state)!==command.shipId)throw Error('Declare the next eligible ship only; committed choices are locked.');const s=getShip(state,command.shipId);const mounts=normalizeDeclarations(command.mounts,s,state.ships,{commit:true});state.workflow.gunnery.declarations.push({shipId:s.id,mounts});break;}
 case 'next-battle-phase':if(!state.workflow||command.phase!==state.workflow.phase)throw Error('Battle phase changed; review the current phase.');if(state.workflow.phase==='attacks'){if(nextGunner(state))throw Error('Commit every ship’s gunnery declarations before resolution acknowledgement.');if((directFireQueue(state).length||missileQueue(state).length||arrivals(state).length)&&!state.workflow.resolutionId)throw Error('Resolve direct fire before acknowledging attacks.');const record=state.combatHistory?.find(r=>r.id===state.workflow.resolutionId);if(arrivals(state).length&&!state.missileCombat.impacts.some(r=>r.round===state.round))throw Error('Resolve missile impacts last before completing attacks.');const manual=(record?.pending??unresolvedDeclarations(state)).some(r=>r.action==='attack')||record?.results.some(r=>r.status==='manual')||state.missileCombat?.impacts.find(r=>r.round===state.round)?.results.some(r=>r.status==='manual');if(manual){if(typeof command.manualNote!=='string'||!command.manualNote.trim()||command.manualNote.length>300)throw Error('Record explicit GM confirmation of remaining manual attacks; unsupported attacks require manual handling.');const archived=record??archiveResolution(state,[]);archived.manualResolution=command.manualNote.trim();state.workflow.manualResolution=command.manualNote.trim();for(const result of state.missileCombat?.impacts.find(r=>r.round===state.round)?.results??[]){if(result.status==='manual'){const salvo=state.missileCombat.salvos.find(s=>s.id===result.id);salvo.status='spent';salvo.history.push({kind:'manual',round:state.round,note:command.manualNote.trim()});}}}state.workflow.phase='crew';}else if(state.workflow.phase==='crew'){for(const s of state.ships){if(s.crewDuty){s.crewDuty.round=state.round+1;if(!dutyPenalty(s,'pilot').available){s.flight.evasion=0;s.flight.gunners=0;s.flight.braking=false;s.motion.impulse={q:0,r:0};}}}state.workflow.phase='thrust';delete state.workflow.gunnery;delete state.workflow.resolutionId;delete state.workflow.manualResolution;state.acceleration={order:accelerationOrder(state),declared:[]};}else throw Error('Commit all plots and movement before acknowledging actions.');break;
 case 'brake':{const s=getShip(state,command.shipId);assertPlanning(state,s.id);if(!dutyPenalty(s,'pilot').available)throw Error('Pilot unavailable; coast without thrust.');s.flight.braking=hexDistance(s.motion.velocity)>0;s.motion.impulse=brakingImpulse(s);break;}
 case 'coast':{const s=getShip(state,command.shipId);assertPlanning(state,s.id);s.flight.braking=false;s.motion.impulse={q:0,r:0};break;}
 case 'edit-ship':{
  assertSetup(state);const s=getShip(state,command.shipId);s.name=name(command.name);s.capabilities.thrust=integer(command.thrust,'Thrust',0,MAX_THRUST);
  const velocity=vector(command.velocity,'Velocity');if(velocity.q!==s.motion.velocity.q||velocity.r!==s.motion.velocity.r)s.flight.braking=false;s.motion={position:vector(command.position,'Position'),velocity,impulse:{q:0,r:0}};break;
 }
 case 'advance-round':
  if(state.workflow&&state.workflow.phase!=='movement')throw Error('Use the Movement phase to move all ships once.');
  if(state.acceleration&&state.acceleration.declared.length!==state.acceleration.order.length)throw Error('Every ship must declare acceleration before simultaneous movement.');
  if(!state.ships.length)throw Error('Add a ship before advancing the round.');
  if(state.round===1000000)throw Error('Prototype round limit reached. Reset the sample.');
  for(const s of state.ships){s.motion.velocity=vector(add(s.motion.velocity,s.motion.impulse),'Resulting velocity');s.motion.position=vector(add(s.motion.position,s.motion.velocity),'Resulting position');s.motion.impulse={q:0,r:0};if(!hexDistance(s.motion.velocity))s.flight.braking=false;}
  state.acceleration=null;state.round++;moveMissiles(state,state.round);if(state.workflow)state.workflow.phase='attacks';break;
 default:throw Error('Unknown movement command.');
 }
 state.revision++;return checked(state);
}

export function normalizeState(input){return checked(input);}
