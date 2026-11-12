import test from 'node:test';
import assert from 'node:assert/strict';
import {characterSheetHeader,characterSheetHistoryView,characterSheetSkillAcquisitions} from '../gui/character-sheet-view.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('current sheet renders actual values and recorded RITE without invented sample data',()=>{
 const r=buildAslanOriginFixture({stage:'precareer'}),before=exportSession(r.session),html=characterSheetHeader(r.state,catalog);
 assert.match(html,/0 completed terms/);assert.match(html,new RegExp('RITE \\+'+r.state.character.aslanOrigin.rite.modifier));
 assert.equal((html.match(/class="traveller-sheet-stat"/g)||[]).length,6);assert.doesNotMatch(html,/DESIGN MOCKUP|SAMPLE CHARACTER/);assert.equal(exportSession(r.session),before);
});
test('sheet escapes identity and decision text and works before statistics exist',()=>{
 const r=api({operation:'create',seed:'sheet-empty'});r.state.character.name='<script>bad</script>';
 const html=characterSheetHeader(r.state,catalog);assert.match(html,/&lt;script&gt;bad/);assert.doesNotMatch(html,/<script>/);assert.match(html,/not been recorded/);
});
test('history is available before finish and preserves medical decisions and completed terms',()=>{
 const r=finalSheetFixture({finish:false}),before=exportSession(r.session),html=characterSheetHistoryView(r,r.session,catalog);
 assert.notEqual(r.state.stage,'finish');assert.match(html,/Source-confirmed synthetic treatment note/);assert.match(html,/Term 1/);assert.equal(exportSession(r.session),before);
});
test('header preserves variant, readable partial years and configured untested PSI',()=>{
 const r=api({operation:'create',seed:'sheet-variant'});r.state.stage='precareer';r.state.character.species='vargr';r.state.character.variant='test-strain';r.state.character.age=18.5;r.state.config.extras=['PSI'];
 const html=characterSheetHeader(r.state,catalog);assert.match(html,/test-strain/);assert.match(html,/Untested/);assert.doesNotMatch(html,/Age 18\.5/);
});

test('skill provenance uses recorded source, timing and progression only',()=>{
 const rows=[{title:'Background skills',termLabel:'Before Term 1',changes:[{path:'skills.Medic',before:null,after:0}]},{title:'University skill',termLabel:'Term 1',changes:[{path:'skills.Medic',before:0,after:1}]},{title:'Training',termLabel:'Term 2',changes:[{path:'skills.Pilot',before:null,after:0}]}];
 const before=JSON.stringify(rows);
 assert.deepEqual(characterSheetSkillAcquisitions(rows,'Medic'),['Background skills · Before Term 1 · Gained Level/0','University skill · Term 1 · Level/0 → Level/1']);
 assert.deepEqual(characterSheetSkillAcquisitions(rows,'Admin'),[]);
 assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(characterSheetSkillAcquisitions([{title:'Skill choice',termLabel:'Timing not recorded',changes:[{path:'skills.Medic',after:1}]}],'Medic'),['Skill choice · Timing not recorded · Gained Level/1']);
});
