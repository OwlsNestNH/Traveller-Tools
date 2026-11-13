import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {ironManReady as ready} from './iron-man-fixtures.mjs';

for(const id of ['core.army','core.navy','core.marine','core.agent','core.citizen','core.scholar','core.drifter'])test(id+' optional Iron Man replaces failed Survival only',()=>{
 const before=ready(id),raw=exportSession(before.session);assert.equal(!!before.state.config.ironMan,false);
 const normal=force(before,'survival-check',{},[1,1]);assert.equal(normal.state.stage,'career-mishap');assert.notEqual(normal.state.character.deceased,true);
 let enabled=run(before,'gm-iron-man',{enabled:true});assert.deepEqual(enabled.state.character,before.state.character);assert.equal(enabled.state.rng,before.state.rng);assert.equal(enabled.log.at(-1).rolls.length,0);
 const onRaw=exportSession(enabled.session);assert.equal(project(importSession(onRaw)).state.config.ironMan,true);
 const failed=force(enabled,'survival-check',{},[1,1]);assert.equal(failed.state.stage,'deceased');assert.equal(failed.state.character.deceased,true);assert.equal(failed.state.character.ironManDeath.careerId,id);assert.equal(failed.log.at(-1).rolls.length,1);assert.equal(failed.log.at(-1).rolls[0].label,'Survival');assert.equal(failed.state.character.careers.at(-1).terms,before.state.character.careers.at(-1).terms);
 assert.equal(project(importSession(exportSession(failed.session))).state.stage,'deceased');assert.throws(()=>run(failed,'career-mishap'),/pending|matching/);
 const combined=force(enabled,'survival',{},[1,1]);assert.equal(combined.state.stage,'deceased');assert.equal(combined.log.at(-1).rolls.length,1);
 const withoutSetting=run(failed,'restore',{revision:before.revision});assert.equal(!!withoutSetting.state.config.ironMan,false);assert.equal(withoutSetting.state.stage,'survival');
 const restored=run(failed,'restore',{revision:enabled.revision});assert.equal(restored.state.stage,'survival');assert.equal(restored.state.config.ironMan,true);assert.notEqual(restored.state.character.deceased,true);
 const off=run(restored,'gm-iron-man',{enabled:false}),again=force(off,'survival-check',{},[1,1]);assert.equal(again.state.stage,'career-mishap');assert.deepEqual(again.log.at(-1).rolls,normal.log.at(-1).rolls);assert.equal(restored.state.rng,failed.state.rng,'Restore preserves the advanced RNG, as before');const directOff=run(enabled,'gm-iron-man',{enabled:false}),directResult=force(directOff,'survival-check',{},[1,1]);assert.deepEqual(directResult.log.at(-1).rolls,normal.log.at(-1).rolls);assert.equal(directResult.state.rng,normal.state.rng,'Toggling alone consumes no RNG');assert.equal(project(importSession(raw)).state.stage,'survival');assert.equal(!!project(importSession(raw)).state.config.ironMan,false);
 const success=force(enabled,'survival-check',{},[6,6]);assert.equal(success.state.stage,'career-event');assert.notEqual(success.state.character.deceased,true);
});
test('Iron Man setting requires explicit GM boolean and never changes old results',()=>{let r=ready('core.army');r=run(r,'gm-mode',{enabled:false});assert.throws(()=>run(r,'gm-iron-man',{enabled:true}),/GM/);r=run(r,'gm-mode',{enabled:true});for(const payload of [{},{enabled:'true'},{enabled:true,extra:1}])assert.throws(()=>run(r,'gm-iron-man',payload),/boolean/);const failed=force(r,'survival-check',{},[1,1]),changed=run(failed,'gm-iron-man',{enabled:true});assert.equal(changed.state.stage,'career-mishap');assert.notEqual(changed.state.character.deceased,true);});
