import {acknowledgeEducationEvent} from './education-event-scenario.mjs';

import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
const specialties={'Gun Combat':'slug','Melee':'blade','Heavy Weapons':'man portable','Athletics':'dexterity','Electronics':'computers','Drive':'wheel','Flyer':'grav','Pilot':'spacecraft','Engineer':'power','Science':'physics','Profession':'construction','Art':'performer','Gunner':'turret','Tactics':'military','Animals':'handling','Seafarer':'ocean ships','Language':'Vilani'};
export function settleAssignment(r){
 for(let i=0;i<30;i++){
  if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
  else if(r.state.stage==='skill-choice'){
   const p=r.state.pendingChoice,name=p.allowed?.[0]??p.names?.[0]??(p.scope==='existing'?Object.keys(r.state.character.skills)[0]:'Admin');
   r=run(r,'choose-skill',{name:specialties[name]?name+' ('+specialties[name]+')':name});
  }else return r;
 }throw Error('Assignment fixture exceeded bounded choices.');
}
const settle=settleAssignment;
import {run,rejected,force} from './zhodani-reeducation-fixtures.mjs';
export {run,rejected,force};
const cache=new Map();
export function assignmentSetup(seed='assignment-source',soc=8){
 let r=api({operation:'create',seed});r=run(r,'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5?soc:8,reason:'Core assignment source fixture'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});return r;
}
function forcedIfRoll(r,type,payload,values,index=0){const rolled=run(r,type,payload);if(!rolled.log.at(-1).rolls.length)return rolled;return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Core assignment fixture dice'});}
function survived(r,event=9){
 for(let attempt=0;attempt<40;attempt++){const before=r.revision;r=run(r,'survival');if(r.log.at(-1).rolls[1]?.label==='Event table')return run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:[Math.max(1,event-6),Math.min(6,event-1)],reason:'Core assignment source event fixture'});r=run(r,'restore',{revision:before});}
 throw Error('No successful source term found.');
}
const entries={
 'core.army':'support','core.marine':'support','core.navy':'crew','core.noble':'administrator','core.rogue':'thief','core.scholar':'field','core.scout':'courier',
 'core.agent':'law','core.citizen':'corporate','core.entertainer':'artist','core.merchant':'marine'
};
export function buildAssignmentFixture({careerId='core.army',officer=false,forcedStay=false,forcedExit=false,university=false}={}){
 const key=JSON.stringify({careerId,officer,forcedStay,forcedExit,university});if(cache.has(key))return structuredClone(cache.get(key));
 let r=assignmentSetup('assignment-'+careerId,careerId==='core.noble'?10:8);
 if(university){
  r=forcedIfRoll(r,'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});r=force(r,'education-event',{},[1,4]);r=acknowledgeEducationEvent(r);r=force(r,'education-graduation',{},[6,6]);assert.equal(r.state.stage,'education-result');r=run(r,'acknowledge-education-result');
 }else r=run(r,'skip-precareer');
 r=forcedIfRoll(r,'career',{id:careerId,assignment:entries[careerId]},[6,6]);if(r.state.stage==='preterm-commission')r=run(r,'preterm-commission',{attempt:false});r=settle(r);
 r=settle(survived(r,careerId==='core.scout'?5:careerId==='core.merchant'?6:careerId==='core.noble'?5:careerId==='core.rogue'?5:9));
 if(r.state.stage==='book-step')throw Error('Fixture encountered source-assisted event '+r.state.pending.kind);
 if(officer)r=settle(forcedIfRoll(r,'commission',{},[6,6]));
 else r=settle(forcedIfRoll(r,'advancement',{},forcedStay?[6,6]:[4,5]));
 if(r.state.stage==='training')r=settle(force(r,'training',{table:'service'},[1]));
 if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
 if(forcedExit){
  r=run(r,'continue-career');r=settle(force(r,'training',{table:'service'},[1]));r=settle(survived(r,careerId==='core.merchant'?6:5));
  r=settle(forcedIfRoll(r,'advancement',{},[1,1]));if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
  assert.equal(r.state.character.careers.at(-1).forcedExit,true,'Fixture must earn a genuine departure.');
 }
 assert.equal(r.state.stage,'term-end',careerId+' term fixture');cache.set(key,structuredClone(r));return r;
}
export function buildRestartAssignmentFixture({careerId='core.agent',ready=false}={}){
 let r=buildAssignmentFixture({careerId}),assignment=careerId==='core.agent'?'intelligence':'free';r=run(r,'change-assignment',{assignment});
 if(ready)while(r.state.stage==='benefits')r=settle(force(r,'benefit',{cash:false},[2]));
 return r;
}
export function buildNobleEntryFixture({soc=10}={}){
 return run(assignmentSetup('assignment-noble-auto',soc),'skip-precareer');
}
