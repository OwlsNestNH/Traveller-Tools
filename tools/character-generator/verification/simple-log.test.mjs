import test from 'node:test';
import assert from 'node:assert/strict';
import {simpleActionLog} from '../gui/simple-log.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
import {failedSurvivalFixture,laterCareerFixture} from './concise-result-fixtures.mjs';
const roll=(label,values,total=values.reduce((a,b)=>a+b,0))=>({label,values,kept:values,total});
test('actual career and survival checks show dice, applied DMs and result without changing saves',()=>{
 for(const fixture of [failedSurvivalFixture,laterCareerFixture]){
  const p=fixture().after,save=exportSession(p.session),full=fullActionLog(p.log),text=simpleActionLog([p.log.at(-1)]);
  assert.match(text,/DM \+1/);assert.match(text,/vs \d+\+; (success|failure)/);
  assert.doesNotMatch(text,/careers\.\d|modifierChanges|"success"/);
  assert.equal(exportSession(p.session),save);assert.equal(fullActionLog(p.log),full);
  assert.equal(simpleActionLog(project(importSession(save)).log),simpleActionLog(p.log));
 }
});
test('unknown checks do not invent DMs or success, and notes do not invent rolls',()=>{
 assert.equal(simpleActionLog([{type:'notes',summary:'Success with DM +5',rolls:[]}]),'');
 const text=simpleActionLog([{number:1,type:'unknown',summary:'Recorded result.',rolls:[roll('Unknown check',[1,2])]}]);
 assert.match(text,/Unknown check: \[1, 2\] = 3/);assert.doesNotMatch(text,/DM|success/);
});
test('boons, D3 conversion, recorded expression modifiers and negative check DMs stay explicit',()=>{
 const text=simpleActionLog([{number:1,type:'roll-statistics',summary:'Rolled statistics.',rolls:[{...roll('STR',[2,6,4],10),kept:[6,4]},{...roll('Age (D3+2)',[6],5),kept:[3],modifier:2}]},{number:2,type:'survival-check',summary:'Survival: {"natural":7,"stat":"END","dm":-1,"modifier":-2,"total":4,"target":6,"success":false}.',rolls:[roll('Survival',[3,4])]}]);
 assert.match(text,/kept\/converted \[6, 4\] = 10/);assert.match(text,/kept\/converted \[3\]; DM \+2 = 5/);assert.match(text,/DM -3 \(END -1, other -2\) = 4 vs 6\+; failure/);
});
test('GM history is labelled without presenting replacement snapshots as fresh player rolls',()=>{
 const text=simpleActionLog([{number:3,type:'restore',rolls:[]},{number:4,type:'gm-replay',summary:'Survival: {}.',rolls:[roll('Survival',[6,6])]}]);
 assert.match(text,/GM restored/);assert.match(text,/GM replaced/);assert.doesNotMatch(text,/\[6, 6\]/);
});
test('source-assisted and non-dice actions are not fictional rolls',()=>{
 assert.equal(simpleActionLog([{number:1,type:'resolve-book',summary:'Source-assisted success.',rolls:[]}]),'');
 assert.equal(simpleActionLog([]),'');
});
test('table DMs and actual skill or cash awards are concise without false success labels',()=>{
 const text=simpleActionLog([{number:1,type:'benefit',summary:'Rolled cash benefit 7 (DM 2).',rolls:[roll('Cash benefit',[5])],changes:[{path:'cash',before:0,after:10000}]},{number:2,type:'training',summary:'Training service result 4.',rolls:[roll('Training: service',[3])],changes:[{path:'skills.Pilot',before:0,after:1}]}]);
 assert.match(text,/Cash benefit: \[5\]; DM \+2 = 7/);assert.match(text,/Training: service: \[3\]; DM \+1 = 4/);assert.match(text,/Cr10,000/);assert.match(text,/Skill Pilot/);assert.doesNotMatch(text,/failure|success/);
});
