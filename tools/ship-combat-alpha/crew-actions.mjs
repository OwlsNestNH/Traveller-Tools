import {RATINGS} from './setup.mjs';
import {dutyAssignment,dutySkill,dutyPenalty,commitDutyAction,actionIssue} from './crew-duty.mjs';
import {resolvePilotCheck} from './pilot-check.mjs';

export function crewActionProfile(ship,role,skillId=null){
 const assignment=dutyAssignment(ship,role),penalty=dutyPenalty(ship,role);
 if(!assignment||!penalty.available)return {total:null,source:penalty.reason??'No operator available.'};
 const c=ship.crew,origin=assignment.origin,simple=!origin.startsWith('mount:')&&(c.mode==='quick'||c.mode==='compact'&&!c.activeDetails.includes(origin.startsWith('mount:')?'gunner':origin));
 if(simple)return {total:(c.overrides[origin]??c.bonus??RATINGS[c.rating])+penalty.penalty,source:c.rating+' crew rating as skill'+(penalty.penalty?' · Comms multi-action −2':''),skillName:'Simplified crew rating'};
 const s=dutySkill(ship,role,skillId),d=origin.startsWith('mount:')?c.gunnerStations?.find(s=>s.mountId===origin.slice(6)):c.details[origin];
 if(!s&&!d)return {total:null,source:'Record the required skill in crew setup.'};
 return {total:(s?s.level+(s.stat??0)+s.other:d.skill+d.characteristicDM)+penalty.penalty,source:(s?.name??d.skillName)+(penalty.penalty?' · Comms multi-action −2':''),skillName:s?.name??d.skillName};
}
export function applyCrewAction(state,command){
 if(state.workflow?.phase!=='crew')throw Error('Commit crew actions during Actions.');
 const ship=state.ships.find(s=>s.id===command.shipId);if(!ship||ship.condition.hull===0)throw Error('Choose an available ship.');
 const role=command.role,issue=actionIssue(ship,role);if(issue)throw Error(issue);
 if(role==='sensors'&&state.missileCombat?.ew.some(e=>e.shipId===ship.id&&e.round===state.round))throw Error('Sensor operator already used electronic warfare this round.');
 const {kind}=command;let roll,repair;
 if(!['manual','roll','repair','move'].includes(kind))throw Error('Choose a crew action.');
 if(kind==='roll'||kind==='repair'){
  const profile=crewActionProfile(ship,role,command.skillId);if(profile.total==null)throw Error(profile.source);
  let difficulty=command.difficulty;
  if(kind==='repair'){
   if(role!=='engineer'||(!/^Engineer(?:\s*\(|$)/i.test(profile.skillName)&&profile.skillName!=='Simplified crew rating'))throw Error('Repair System requires an Engineer skill.');
   const event=ship.combatDamage?.history.find(e=>e.eventId===command.eventId),latest=event&&ship.combatDamage.history.filter(e=>e.location===event.location).at(-1);
   if(!event||latest.eventId!==event.eventId||['Hull','Armour'].includes(event.location))throw Error('Choose the latest repairable system critical; Hull and armour damage remain unrepaired.');
   if(command.repairable!==true)throw Error('Confirm the effect is temporary-repair eligible, not destroyed equipment.');
   const previous=(ship.crewDuty?.actions??[]).filter(a=>a.operator===dutyAssignment(ship,role).operator&&a.repair?.eventId===event.eventId).at(-1),effort=previous?.round===state.round-1?Math.min(100,previous.repair.effort+1):0;
   profile.total+=effort-event.severity;profile.source+=' · severity −'+event.severity+' · continuing effort +'+effort;difficulty=8;
   repair={eventId:event.eventId,location:event.location,severity:event.severity,effort,roundMinutes:state.roundMinutes,durationDie:null,expiresRound:null};
  }
  roll={...resolvePilotCheck(profile,difficulty,command.dice),source:profile.source};
  if(repair&&roll.effect>=0){if(!Number.isInteger(command.durationDie)||command.durationDie<1||command.durationDie>6)throw Error('Record one duration die for the successful temporary repair.');repair.durationDie=command.durationDie;repair.expiresRound=state.round+Math.ceil(command.durationDie*60/state.roundMinutes);}
  else if(command.durationDie!=null)throw Error('No duration die is used by this result.');
 }
 return commitDutyAction(ship,{role,kind,note:command.note,roll,repair,to:command.to,skillId:command.skillId},state.round);
}
