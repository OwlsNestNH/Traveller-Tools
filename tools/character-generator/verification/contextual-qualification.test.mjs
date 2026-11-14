import test from 'node:test';import assert from 'node:assert/strict';
import {aslanTemplateStart,run} from './aslan-template-fixtures.mjs';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {careerTemplateModel} from '../gui/career-template.mjs';
const catalog=api({operation:'catalog'});
for(const [gender,target] of [['male',10],['female',7]])test('Scientist application agrees with the actual '+gender+' qualification check',()=>{
 const before=aslanTemplateStart(gender),raw=exportSession(before.session),character=structuredClone(before.state.character),rng=before.state.rng;
 const model=careerTemplateModel(before.state,catalog,'aslan.scientist');assert.deepEqual(model.career.qualification,{stat:'INT',target});
 const replayed=project(importSession(raw));assert.deepEqual(replayed.state.careerChoices.find(c=>c.id==='aslan.scientist').qualification,{stat:'INT',target});assert.deepEqual(replayed.state.character,character);assert.equal(replayed.state.rng,rng);assert.equal(exportSession(before.session),raw);
 const entered=run(before,'career',{id:'aslan.scientist',assignment:'healer'});assert.match(entered.log.at(-1).summary,new RegExp('"target":'+target+'\\b'));
});
test('contextual projection does not overwrite the shared catalog base check',()=>{assert.deepEqual(catalog.careers.find(c=>c.id==='aslan.scientist').qualification,{stat:'INT',target:7});});
