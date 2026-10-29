import {effectiveDesign} from './setup.mjs';
import {normalizeWorkflow} from './workflow.mjs';
import {directFireQueue,directFireProfile,combatCrew,unresolvedDeclarations} from './direct-fire-profile.mjs';
import {LASERS,diceTotal,laserAttack,sandProtection,criticalLocation,taskChain} from './direct-fire-rules.mjs';
import {sandReservation,consumeSandReservation} from './sand-reservations.mjs';
import {newDamageLedger,recordCritical,recordHullLoss} from './damage-ledger.mjs';
import {powerReport} from './systems.mjs';

const running=(ship,id)=>ship.systems.software.installed.find(p=>p.id===id)?.running??0;
const sum=a=>a.reduce((x,y)=>x+y,0);
const sandRows=(state,id)=>state.workflow.gunnery.declarations.find(d=>d.shipId===id)?.mounts.filter(m=>m.action==='sand')??[];
function powerIssue(ship,mountId=null){
 const report=powerReport(ship);if(report.output==null||report.used==null)return 'Operating Power is unknown; verify the allocation before automatic firing.';
 if(report.output<=0||report.remaining<0)return 'Operating Power is unavailable or over-allocated.';
 if(mountId){const w=effectiveDesign(ship).record.weapons.find(w=>w.id===mountId),key=s=>s?.toLowerCase().replace(/[^a-z0-9]/g,''),loads=report.profile.loads.filter(l=>l.id==='fit-'+mountId||/^(weapons|weaponry|armament)$/i.test(l.name)||[key(w?.name),key(w?.id)].includes(key(l.name)));
  if(loads.length&&loads.every(l=>!ship.systems.loads.find(c=>c.id===l.id)?.enabled))return 'The declared weapon operating load is switched off.';
 }
 return null;
}
const activeSoftware=(ship,id)=>ship.condition.powerOutput===0?0:running(ship,id);
function eligibility(state,entry){
 const p=directFireProfile(state,entry);if(p.status!=='eligible')return p;
 const ship=state.ships.find(s=>s.id===entry.shipId),target=state.ships.find(s=>s.id===entry.targetId),issues=[...p.issues];
 if(running(ship,'fire-control'))issues.push('Running Fire Control needs an explicit shared allocation; resolve manually.');
 if(target.flight.evasion&&p.pilot.skill==null)issues.push('Reserved evasion needs an applicable Pilot skill.');
 if(ship.flight.gunners&&combatCrew(ship,'pilot').modifier==null)issues.push('Aid Gunners needs an applicable Pilot check.');
 const rows=sandRows(state,target.id);if(rows.length>1)issues.push('Multiple defending sand turrets require manual allocation in this first pass; no stacking is inferred.');
 for(const row of rows){const r=sandReservation(target,row);if(r.reason&&!/unavailable/.test(r.reason))issues.push(r.reason);if(r.available){const issue=powerIssue(target,row.mountId.split(':')[0]);if(issue)issues.push('Reserved sand: '+issue);}}
 // Operating allocation is retained. No per-shot deduction of already allocated
 // Power is made; explicit offline systems/known deficits cannot be ignored.
 const issue=powerIssue(ship,p.mountId);if(issue)issues.push(issue);
 if(target.flight.evasion){const issue=powerIssue(target);if(issue||!target.systems.driveEnabled)issues.push('Reserved evasion: '+(issue??'The operating drive is off.'));}
 if(activeSoftware(target,'evade')){const issue=powerIssue(target);if(issue)issues.push('Evade software: '+issue);}
 return {...p,status:issues.length?'manual':'eligible',issues};
}
export function directFirePreview(state){return directFireQueue(state).map(entry=>({entry,profile:eligibility(state,entry)}));}
function allocation(state,queue){
 const plan={},rank=queue.map((entry,index)=>({entry,index,p:eligibility(state,entry)})).filter(x=>x.p.status==='eligible').sort((a,b)=>(LASERS[b.entry.weapon].dice*(6+b.p.count-1))-(LASERS[a.entry.weapon].dice*(6+a.p.count-1))||a.index-b.index);
 const evade={},sand={};
 for(const {entry}of rank){const target=state.ships.find(s=>s.id===entry.targetId),useEvasion=(evade[target.id]??0)<target.flight.evasion;if(useEvasion)evade[target.id]=(evade[target.id]??0)+1;const row=sandRows(state,target.id)[0],useSand=!!row&&!sand[target.id]&&sandReservation(target,row).available>0;if(useSand)sand[target.id]=true;plan[entry.id]={evasion:useEvasion,sand:useSand?row:null};}
 return plan;
}
function absent(ship,location){const d=effectiveDesign(ship);return location==='Weapon'?d.record.weapons?.length===0:location==='Jump Drive'?d.record.jump===0:location==='Cargo'?d.record.cargoCapacity===0:location==='Fuel'?d.record.fuelCapacity===0:location==='Crew'?d.record.crewTotal===0:location==='Manoeuvre Drive'?ship.systems.driveKind==='none':location==='Sensors'?/^(none|no sensors)$/i.test(d.record.sensors??''):false;}
function applyDamage(ship,amount,critical,eventId,roll){
 if(!amount&&!critical)return {initial:0,events:[]};
 const d=effectiveDesign(ship);ship.combatDamage??=newDamageLedger(d.hull,ship.condition.hull);const events=[],queue=[];
 function loss(n){const r=recordHullLoss(ship.combatDamage,ship.condition.hull,n);ship.combatDamage=r.ledger;ship.condition.hull=r.hull;for(let i=0;i<r.thresholds;i++)queue.push({incoming:1,origin:'sustained'});return r.lost;}
 const initial=loss(amount);if(critical)queue.unshift({incoming:critical,origin:'attack'});
 while(queue.length&&ship.condition.hull>0){
  if(events.length>=256)throw Error('Critical chain needs manual handling.');const task=queue.shift();let location,locationDice,attempts=[];do{locationDice=roll(2);attempts.push(locationDice);location=criticalLocation(locationDice);if(attempts.length>64)throw Error('No applicable critical location in bounded dice stream.');}while(absent(ship,location));
  const r=recordCritical(ship.combatDamage,{eventId:eventId+'/c'+events.length,location,incoming:task.incoming});ship.combatDamage=r.ledger;
  const event={...r.event,origin:task.origin,locationDice:attempts,extraDamage:0,effectDice:[],manual:false,description:''};
  if(r.event.extraDice||location==='Hull'){event.effectDice=roll(r.event.extraDice||r.event.severity);event.extraDamage=loss(sum(event.effectDice));event.description='Hull damage applied, bypassing armour.';}
  else if(location==='Armour'){
   const severity=r.event.severity;event.effectDice=severity===1?[]:roll(severity>=5?2:1);const reduction=severity===1?1:severity===2?Math.ceil(event.effectDice[0]/2):sum(event.effectDice);ship.combatDamage.armourLoss=Math.min(d.armour,ship.combatDamage.armourLoss+reduction);event.description='Armour reduced by '+reduction+'.';
   if(severity>=5){event.manual=true;event.description+=' Hull severity +1 needs GM handling.';}
  }else{event.manual=true;event.description=location+' severity '+r.event.severity+' effect requires GM handling (Core2022 p170).';}
  if(event.manual)ship.combatDamage.pending.push(event.eventId);events.push(event);
 }
 return {initial,events};
}
// Deterministic transaction. readDie is either an explicit recorded command
// stream or the preparer's bounded random source; input is never mutated.
export function resolveDirectFire(snapshot,readDie){
 const state=structuredClone(snapshot),queue=directFireQueue(state),plan=allocation(state,queue),results=[],aid={},usage={evasion:{},sand:{},aid:{}};
 const roll=n=>Array.from({length:n},()=>{const d=readDie();diceTotal([d],1);return d;});
 for(const entry of queue){const ship=state.ships.find(s=>s.id===entry.shipId),target=state.ships.find(s=>s.id===entry.targetId),p=eligibility(state,entry),result={id:entry.id,shipId:ship.id,shipName:ship.name,mountName:entry.mountId,targetId:entry.targetId,targetName:target?.name??'Unavailable',weapon:entry.weapon,status:p.status,message:p.reason??p.issues?.join(' ')??'',profile:p,criticals:[]};
  if(p.status!=='eligible'){results.push(result);continue;}
  if(ship.flight.gunners&&!aid[ship.id]){const profile=combatCrew(ship,'pilot'),dice=roll(2),effect=sum(dice)+profile.modifier+(ship.situational.pilot??0)-8;aid[ship.id]={profile,dice,effect,modifier:taskChain(effect)};usage.aid[ship.id]=1;}
  const allocated=plan[entry.id]??{evasion:false,sand:null},evasion=allocated.evasion?p.pilot.skill:0;let sand=0,sandResult=null;
  if(allocated.evasion)usage.evasion[target.id]=(usage.evasion[target.id]??0)+1;
  if(allocated.sand){const used=usage.sand[target.id+'/'+allocated.sand.mountId]??0,r=sandReservation(target,allocated.sand,used);if(r.available){const consumed=consumeSandReservation(target,allocated.sand,used);target.condition=consumed.ship.condition;usage.sand[target.id+'/'+allocated.sand.mountId]=consumed.used;const dice=roll(2),modifier=consumed.modifier+(target.situational.gunner??0),effect=sum(dice)+modifier-8;sandResult=sandProtection({dice,modifier,count:consumed.count,protectionDie:effect>=0?roll(1)[0]:null});sand=sandResult.protection;}}
  const attackDice=roll(2),mod={weapon:entry.weapon,count:p.count,range:p.range.band,gunner:p.crew.modifier,other:ship.situational.gunner??0,evasion,evade:activeSoftware(target,'evade'),fireControl:activeSoftware(ship,'advanced-fire-control'),aid:aid[ship.id]?.modifier??0,targetTons:p.targetTons,attackDice,armour:p.armour,sand};
  // Determine whether damage dice are needed without consuming any on a miss.
  const hit=sum(attackDice)+mod.gunner+mod.other+LASERS[mod.weapon].attack+(mod.range==='Short'?1:mod.range==='Long'?-2:0)+Math.min(6,Math.floor(mod.targetTons/1000))-mod.evasion-mod.evade+mod.fireControl+mod.aid>=8;
  const attack=laserAttack({...mod,damageDice:hit?roll(LASERS[entry.weapon].dice):[]}),damage=applyDamage(target,attack.damage,attack.critical,'r'+state.round+'/'+entry.id,roll);
  Object.assign(result,{status:attack.hit?'hit':'miss',attack,aid:aid[ship.id]??null,sand:sandResult,evasionUsed:allocated.evasion,actualHullLoss:damage.initial,criticals:damage.events,message:'Recorded once. Remaining system effects, if any, are manual.'});results.push(result);
 }
 return {ships:state.ships,results,plan,usage,pending:unresolvedDeclarations(state)};
}
export function prepareDirectFireCommand(state,random=Math.random){
 if(state.workflow?.phase!=='attacks'||state.workflow.gunnery.declarations.length!==state.workflow.gunnery.order.length||state.workflow.resolutionId)throw Error('Complete declarations first; recorded resolution cannot be rerolled.');
 const dice=[];resolveDirectFire(state,()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Dice source unavailable.');const d=1+Math.floor(n*6);dice.push(d);return d;});
 return {type:'resolve-direct-fire',expectedRevision:state.revision,dice};
}
export function recordedResolution(snapshot,dice){
 if(!Array.isArray(dice)||dice.length>50000)throw Error('Invalid resolution dice stream.');let i=0;const resolved=resolveDirectFire(snapshot,()=>dice[i++]);if(i!==dice.length)throw Error('Unused resolution dice.');return resolved;
}
export function normalizeCombatHistory(value,normalizeShips){
 if(value==null)return [];if(!Array.isArray(value)||value.length>100)throw Error('Combat history limit reached; export the encounter before starting another record.');const ids=new Set();
 return value.map(v=>{if(v.version!==1||!/^r[0-9]+-v[0-9]+$/.test(v.id)||ids.has(v.id)||!Number.isSafeInteger(v.snapshot?.round)||v.snapshot.round<1)throw Error('Invalid resolution record.');ids.add(v.id);
  const ships=normalizeShips(v.snapshot.ships),workflow=normalizeWorkflow(v.snapshot.workflow,ships,null);if(workflow?.phase!=='attacks'||workflow.resolutionId||workflow.gunnery.declarations.length!==workflow.gunnery.order.length)throw Error('Invalid resolution snapshot.');const snapshot={round:v.snapshot.round,ships,workflow},resolved=recordedResolution(snapshot,v.dice);
  if(JSON.stringify(v.results)!==JSON.stringify(resolved.results)||JSON.stringify(v.usage)!==JSON.stringify(resolved.usage)||JSON.stringify(v.plan)!==JSON.stringify(resolved.plan)||JSON.stringify(v.pending)!==JSON.stringify(resolved.pending))throw Error('Resolution record disagrees with its input and dice.');
  if(v.manualResolution!=null&&(typeof v.manualResolution!=='string'||!v.manualResolution.trim()||v.manualResolution.length>300))throw Error('Invalid manual attack acknowledgement.');
  return {version:1,id:v.id,snapshot,dice:[...v.dice],results:resolved.results,usage:resolved.usage,plan:resolved.plan,pending:resolved.pending,...(v.manualResolution?{manualResolution:v.manualResolution.trim()}:{})};
 });
}
