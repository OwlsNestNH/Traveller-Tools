import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {characterSheetTiming} from '../engine/character-sheet-timing.mjs';
import {characterSheetEventRows,characterSheetTermLabel} from '../gui/character-sheet-history.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {graduationFixture,educationReady,command} from './education-result-fixtures.mjs';
import {finalSheetFixture,run} from './final-sheet-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('origin and background rolls/decisions remain before Term 1; reads never mutate saves',()=>{
 const r=buildAslanOriginFixture({stage:'precareer'}),before=exportSession(r.session),rows=characterSheetEventRows(r,r.session,catalog);
 for(const title of ['Characteristic rolls','Accepted characteristics','Background skills','Family background','Family position','Clan','Pride','Rite of Passage'])assert.ok(rows.some(row=>row.title===title),title);
 assert.ok(rows.every(row=>row.termLabel==='Before Term 1'));
 assert.equal(rows.filter(row=>row.title==='Rite of Passage').length,1,'superseded Rite roll is not repeated');
 assert.ok(rows.every(row=>!row.title.startsWith('Acknowledge')));
 assert.equal(exportSession(r.session),before);
 assert.deepEqual(characterSheetEventRows(project(importSession(before)),r.session,catalog),rows);
});
test('University awards and graduation use actual education term, before completion and after',()=>{
 let r=educationReady(),rows=characterSheetEventRows(r,r.session,catalog);
 assert.ok(rows.filter(row=>row.title==='University skill').every(row=>row.termLabel==='Term 1'));
 r=graduationFixture();rows=characterSheetEventRows(r,r.session,catalog);
 assert.equal(rows.find(row=>row.title==='Graduation').termLabel,'Term 1');
 assert.equal(r.state.character.terms,1);
 assert.equal(rows.filter(row=>row.title==='Graduation').length,1);
});
test('career outcomes use current term; leave-career and finish do not invent a new term',()=>{
 const r=finalSheetFixture(),rows=characterSheetEventRows(r,r.session,catalog);
 assert.equal(rows.find(row=>row.title==='Survival').termLabel,'Term 1');
 assert.equal(rows.find(row=>row.title==='Leave career').termLabel,'After Term 1');
 assert.ok(rows.every(row=>row.termLabel!=='Term 2'));
});
test('restores discard old decisions; replay timing uses original snapshot rather than later branch',()=>{
 let r=educationReady(),revision=r.revision;
 r=command(r,'notes',{text:'Discarded note'});r=command(r,'restore',{revision});r=command(r,'notes',{text:'Current note'});
 const rows=characterSheetEventRows(r,r.session,catalog);assert.ok(!rows.some(row=>row.summary.includes('Discarded note')));
 assert.ok(rows.some(row=>row.summary.includes('Current note')));
 const timing=characterSheetTiming({stage:'training',active:0,character:{terms:3,careers:[{id:'core.army'}]}},{stage:'term-end',active:0,character:{terms:4,careers:[{id:'core.army'}]}});
 assert.equal(characterSheetTermLabel(timing),'Term 4');
 assert.equal(characterSheetTermLabel(null),'Timing not recorded');
});
test('branch comparisons retain awards that did not change relative to discarded branch',()=>{
 let r=finalSheetFixture({finish:false}),revision=r.revision;
 r=run(r,'notes',{text:'First'});r=run(r,'restore',{revision});r=run(r,'notes',{text:'Second'});
 const rows=characterSheetEventRows(r,r.session,catalog);
 assert.ok(rows.some(row=>row.changes.some(change=>change.path.startsWith('injuries.'))));
 assert.ok(!JSON.stringify(rows).includes('First'));
});
test('timing stays outside historical projection bytes and survives API JSON transport',()=>{
 const fixture=buildAslanOriginFixture({stage:'precareer'}),projection=project(fixture.session);
 assert.equal(Object.prototype.propertyIsEnumerable.call(projection,'characterSheetTiming'),false);
 assert.ok(projection.characterSheetTiming[1]);
 assert.ok(projection.log.every(row=>!Object.hasOwn(row,'timing')));
 assert.ok(!JSON.stringify(projection).includes('characterSheetTiming'));
 const response=JSON.parse(JSON.stringify(api({operation:'project',session:fixture.session})));
 assert.deepEqual(response.characterSheetTiming,projection.characterSheetTiming);
 assert.deepEqual(response.log,projection.log);
 assert.deepEqual(characterSheetEventRows(response,fixture.session,catalog),characterSheetEventRows(projection,fixture.session,catalog));
});
