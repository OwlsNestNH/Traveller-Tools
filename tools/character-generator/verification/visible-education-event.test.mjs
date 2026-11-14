import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {conciseResult} from '../gui/concise-result.mjs';import {command,graduationFixture} from './education-result-fixtures.mjs';
import {failedAcademyPrank} from './visible-education-event-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('failed academy event remains concise and preserves every consequential result at career selection',()=>{
 const r=failedAcademyPrank(),raw=exportSession(r.session),e=r.log.at(-1),view=conciseResult(e,r.state,catalog);
 assert.equal(r.state.stage,'career');assert.equal(view.title,'Prank gone wrong');
 for(const text of ['Graduation failed.','Prison sentence recorded.','Enemy','Required next career: Prisoner.'])assert.ok(view.text.includes(text),text);
 assert.doesNotMatch(view.text,/Table outcome|Source:|Completed terms|Age:|On success:/);
 assert.deepEqual(e.rolls.map(r=>r.values),[[2,2],[2,1]]);assert.match(view.information.paragraphs.join(' '),/Check SOC 8\+/);
 const reloaded=project(importSession(raw));assert.deepEqual(reloaded.state,r.state);assert.deepEqual(reloaded.log,r.log);assert.equal(exportSession(r.session),raw);
});

test('Prisoner starts after the completed academy term, with other careers guarded',()=>{
 const r=failedAcademyPrank();assert.equal(r.state.character.age,22);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.careers.length,0);assert.equal(r.state.character.educations[0].completed,true);assert.equal(r.state.forcedCareer,'core.prisoner');
 assert.ok(r.state.careerChoices.filter(c=>c.id!=='core.prisoner').every(c=>c.disabled));
 for(const assignment of ['inmate','thug','fixer']){const next=command(r,'career',{id:'core.prisoner',assignment});assert.equal(next.state.character.age,22);assert.equal(next.state.character.terms,1);assert.equal(next.state.character.careers[0].terms,0);assert.equal(next.state.character.educations[0].completed,true);}
});

test('graduation EDU is granted only on successful academy graduation, across services and reload',()=>{
 for(const id of ['core.academy-army','core.academy-marine','core.academy-navy'])for(const outcome of ['ordinary','honours','failure']){
  const r=graduationFixture(id,outcome);assert.equal(r.state.character.stats.EDU,outcome==='failure'?7:8);
  const reloaded=project(importSession(exportSession(r.session)));assert.deepEqual(reloaded.state,r.state);assert.deepEqual(reloaded.log,r.log);
 }
 const failed=failedAcademyPrank();assert.equal(failed.state.character.stats.EDU,7);assert.equal(failed.state.character.educations[0].graduationAllowed,false);assert.equal(failed.state.character.educations[0].graduation.graduated,false);
});
