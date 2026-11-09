import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession,api,RULES_REVISION} from '../engine/session.mjs';
import {inspectRecordedHistory} from '../gui/legacy-history.mjs';
import {legacyRaw} from './legacy-fixture.mjs';
test('authentic historical Aslan save is rejected before mechanics can silently drift',()=>{
 const saved=JSON.parse(legacyRaw),before=JSON.stringify(saved);assert.throws(()=>importSession(legacyRaw),/rules revision/);assert.throws(()=>project(saved),/rules revision/);assert.throws(()=>execute(saved,{type:'notes',payload:{text:'Do not alter'}}),/rules revision/);assert.throws(()=>exportSession(saved),/rules revision/);assert.equal(api({operation:'import',raw:legacyRaw}).ok,false);assert.equal(JSON.stringify(saved),before);const history=inspectRecordedHistory(legacyRaw);assert.equal(history.events.length,4);assert.match(history.events[3].rolls[0],/6,6/);assert.equal(history.character,undefined);
});
test('all missing or different revisions fail before invalid commands can be evaluated',()=>{
 for(const revision of [undefined,null,'',0,{},'older','character-preview-2026-11-09.15','character-preview-2026-11-08.14','character-preview-2026-11-08.999']){const session=createSession('revision');session.rulesRevision=revision;session.events=[{id:'unknown',command:{type:'must-not-execute'}}];assert.throws(()=>project(session),/rules revision/);assert.equal(api({operation:'project',session}).ok,false);}
});
test('current revision round-trips through every public API path',()=>{
 let result=api({operation:'create',seed:'current-revision'});assert.equal(result.ok,true);assert.equal(result.session.rulesRevision,RULES_REVISION);result=api({operation:'command',session:result.session,command:{type:'setup',payload:{name:'Current',species:'human'}}});assert.equal(result.ok,true);const raw=exportSession(result.session);assert.deepEqual(importSession(raw),result.session);assert.deepEqual(api({operation:'import',raw}).state,result.state);assert.deepEqual(project(result.session).log,result.log);
});
test('catalog exposes labels and no complete Companion mechanical payload',()=>{
 const result=api({operation:'catalog'});assert.equal(result.ok,true);assert.equal(Object.hasOwn(result,'companionEducation'),false);assert.equal(result.precareers.find(p=>p.id==='companion.psionic').page,33);
});

// Newly projected controls must not rewrite historical mechanical snapshots.
test('legacy .16 and .17 projections omit new deferred-specialization fields',()=>{
 for(const revision of ['character-preview-2026-11-09.16','character-preview-2026-11-09.17']){
  const session={...createSession('legacy-shape'),rulesRevision:revision};const state=project(session).state;
  for(const key of ['deferredSpecializations','specializationOptions','skillChoiceBases'])assert.equal(Object.hasOwn(state,key),false,key);
 }
 const state=project(createSession('current-shape')).state;assert.equal(state.deferredSpecializations,true);assert.ok(state.specializationOptions);
});
