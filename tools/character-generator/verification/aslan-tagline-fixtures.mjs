// Valid synthetic sessions; no character or result is inserted into browser DOM.
import assert from 'node:assert/strict';
import {aslanSetup,aslanEvent,force,settle,run} from './aslan-officer-fixtures.mjs';
export {run};
export function aslanTaglineFixtures(){
 const found={};
 for(let seed=0;seed<80&&(!found.direct||!found.specialty||!found.ordinary);seed++){
  let before=settle(run(aslanSetup('tag-test-'+seed),'career',{id:'aslan.wanderer',assignment:'scout'}));
  if(before.state.stage!=='training')before=settle(force(settle(aslanEvent(before,8)),'advancement',{},[6,6]));
  assert.equal(before.state.stage,'training');
  const after=run(before,'training',{table:'assignment'});
  if(after.log.at(-1).changes.some(c=>c.path==='skills.Broker'||c.path==='skills.Mechanic'))found.direct??={before,after};
  else if(after.state.pendingChoice?.allowed?.[0]==='Electronics')found.specialty??={before,after};
  else if(after.state.stage!=='skill-choice')found.ordinary??={before,after};
 }
 assert.ok(found.direct&&found.specialty&&found.ordinary);
 let before=settle(run(aslanSetup('historical-aslan-tag', 'male',false,{},'character-preview-2026-11-09.18'),'career',{id:'aslan.wanderer',assignment:'scout'}));
 if(before.state.stage!=='training')before=settle(force(settle(aslanEvent(before,8)),'advancement',{},[6,6]));
 // Use replay only to establish the historical pending award. Its eventual
 // choose-skill must carry the original training marker and actual audit gain.
 let delayed=force(before,'training',{table:'assignment'},[3]);
 assert.ok(delayed.state.character.deferredSkillAwards.some(a=>a.name==='Electronics'&&a.psionicOrigin));
 delayed=run(delayed,'allocate-specializations');
 for(let i=0;i<10&&delayed.state.pendingChoice?.allowed?.[0]!=='Electronics';i++){
  const base=delayed.state.pendingChoice?.allowed?.[0],subject={Engineer:'power',Pilot:'spacecraft',Science:'physics',Profession:'construction'}[base];
  assert.ok(subject,'unexpected deferred fixture award '+base);delayed=run(delayed,'choose-skill',{name:base+' ('+subject+')'});
 }
 assert.equal(delayed.state.pendingChoice.allowed[0],'Electronics');
 found.delayed={before:delayed,after:run(delayed,'choose-skill',{name:'Electronics (computers)'})};
 return found;
}
