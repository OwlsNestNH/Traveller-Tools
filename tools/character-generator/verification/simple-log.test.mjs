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
 assert.match(text,/GM restored/);assert.match(text,/GM replacement/);assert.match(text,/GM replacement, not a new player roll/);assert.match(text,/Survival: \[6, 6\] = 12/);
});
test('source-assisted and non-dice actions are not fictional rolls',()=>{
 assert.equal(simpleActionLog([{number:1,type:'resolve-book',summary:'Source-assisted success.',rolls:[]}]),'');
 assert.equal(simpleActionLog([]),'');
});
test('table DMs and actual skill or cash awards are concise without false success labels',()=>{
 const text=simpleActionLog([{number:1,type:'benefit',summary:'Rolled cash benefit 7 (DM 2).',rolls:[roll('Cash benefit',[5])],changes:[{path:'cash',before:0,after:10000}]},{number:2,type:'training',summary:'Training service result 4.',rolls:[roll('Training: service',[3])],changes:[{path:'skills.Pilot',before:0,after:1}]}]);
 assert.match(text,/Cash benefit: \[5\]; DM \+2 = 7/);assert.match(text,/Training: service: \[3\]; DM \+1 = 4/);assert.match(text,/Cr10,000/);assert.match(text,/Skill Pilot/);assert.doesNotMatch(text,/failure|success/);
});
test('Simple Log keeps concise choices and explicitly marks GM changed totals with retained original evidence',()=>{
 const original={number:1,type:'survival-check',summary:'Survival: {"natural":3,"total":4,"target":6,"success":false}.',rolls:[roll('Survival',[1,2])]},replacement={number:2,type:'gm-replay',summary:'GM replaced action 1 roll 1 [1, 2] → [6, 6]. Reason: confirmed correction.',rolls:[roll('Survival',[6,6])]},choice={number:3,type:'choose-skill',summary:'Chose Gun Combat (slug) at level 1.',rolls:[]},legacy={number:4,type:'legacy',summary:'Recorded total.',rolls:[{label:'Legacy check',total:11}]};
 const rows=[original,replacement,choice,legacy],before=JSON.stringify(rows),simple=simpleActionLog(rows),full=fullActionLog(rows);assert.match(simple,/DM \+1 = 4 vs 6\+; failure/);assert.match(simple,/GM replacement, not a new player roll/);assert.match(simple,/\[1, 2\] → \[6, 6\]/);assert.match(simple,/Chose Gun Combat/);assert.match(simple,/Legacy check: faces not recorded = 11/);assert.doesNotMatch(simple,/Legacy check:.*DM/);assert.match(full,/ACTION 1/);assert.match(full,/ACTION 2.*GM replaced/);assert.match(full,/1, 2; kept 1, 2; total 3/);assert.match(full,/6, 6; kept 6, 6; total 12/);assert.equal(JSON.stringify(rows),before);
});

test('a stored raw check total still proves the DM when individual faces are missing',()=>{const text=simpleActionLog([{number:1,type:'survival-check',summary:'Survival: {"natural":7,"total":8,"target":6,"success":true}.',rolls:[{label:'Survival',total:7}]}]);assert.match(text,/faces not recorded; DM \+1 = 8 vs 6\+; success/);assert.doesNotMatch(text,/\[3, 4\]/);});
