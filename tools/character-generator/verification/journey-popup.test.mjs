import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyResult,journeyResultView} from '../gui/journey-popup.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={stage:'training',character:{careers:[{id:'core.army'}]},active:0};
const catalog={careers:[{id:'core.army',name:'Army'}]};
const result={title:'Recorded result',status:'info',details:[]};
const change=(path,before,after)=>({path,before,after});
const event=(overrides={})=>({type:'training',summary:'Training resolved.',rolls:[],changes:[],...overrides});
const model=(e,s=state,r=result)=>journeyResult(e,s,catalog,r);
const html=m=>journeyResultView(m,{esc});

test('journey survival keeps natural dice separate from adjusted check and failed outcome',()=>{
 const e=event({type:'survival',summary:'Survival: {"natural":8,"total":6,"target":7,"success":false}.',rolls:[{label:'Survival',values:[4,4],total:8}]});
 const m=model(e,{...state,stage:'career-mishap'},{...result,status:'failure'}),view=html(m);
 assert.equal(m.status,'failure');assert.equal(m.title,'Survival failed.');assert.equal(m.rolls[0].total,8);
 assert.equal(m.checkLine,'Check total 6 against target 7+.');assert.match(view,/Dice total 8/);assert.match(view,/Check total 6 against target 7/);assert.doesNotMatch(view,/succeeded/);
});
test('journey advancement does not equate success with promotion at maximum rank',()=>{
 const m=model(event({type:'advancement',summary:'Advancement: {"natural":8,"total":9,"target":7,"success":true}. Rank 6.',rolls:[{label:'Advancement',values:[3,5],total:8}]}),state,{...result,status:'success'});
 assert.match(m.checkLine,/total 9/);assert.match(m.consequences.join(' '),/Rank remains 6/);assert.doesNotMatch(m.consequences.join(' '),/Promoted/);
});
test('journey kept dice remain explicit and presentation does not mutate recorded dice',()=>{
 const e=event({rolls:[{label:'Boon roll',values:[1,5,6],kept:[5,6],total:11}]}),before=structuredClone(e),m=model(e),view=html(m);
 assert.equal((view.match(/class="journey-die"/g)??[]).length,3);assert.match(view,/Kept 5 \+ 6/);assert.match(view,/Dice total 11/);assert.deepEqual(e,before);
});
test('journey displays applied skill deltas instead of awarding table possibilities',()=>{
 const e=event({rolls:[{label:'Service skills: Admin or Medic',values:[2],total:2}],changes:[change('skills.Admin',0,1)]});
 const m=model(e);assert.match(m.consequences.join(' '),/Skill Admin: 0 → 1/);assert.doesNotMatch(m.consequences.join(' '),/Medic|No skill/);
});
test('pending training choice claims no skill increase until recorded',()=>{
 const m=model(event({rolls:[{label:'Service skills: Engineer',values:[3],total:3}]}),{...state,stage:'skill-choice'});
 assert.match(m.consequences.join(' '),/Choose your skill or speciality/);assert.doesNotMatch(m.consequences.join(' '),/Skill Engineer:|No skill or characteristic increase/);
});
test('settled training without a recorded gain says no increase applied',()=>{
 assert.match(model(event()).consequences.join(' '),/No skill or characteristic increase was applied/);
});
test('source decision preserves unresolved status and proposed treatment',()=>{
 const e=event({type:'injury-treatment',changes:[change('injuries.0',null,{tableResult:2,losses:{STR:4},restoration:{STR:4}})]});
 const m=model(e,{...state,stage:'book-step'},{...result,status:'pending'});
 assert.equal(m.status,'pending');assert.match(m.consequences.join(' '),/Proposed treatment \(pending\): Strength \+4/);assert.match(m.consequences.join(' '),/Unresolved effects have not been awarded/);assert.doesNotMatch(m.consequences.join(' '),/Treatment restores/);
});
test('automatic advancement has no fabricated dice or engine sentinel',()=>{
 const m=model(event({type:'advancement',summary:'Advancement: {"automatic":true,"success":true,"total":99}. Rank 2.'}),state,{...result,status:'success'}),view=html(m);
 assert.match(m.title,/automatically/);assert.deepEqual(m.rolls,[]);assert.equal(m.checkLine,undefined);assert.doesNotMatch(view,/journey-die|Dice total|99/);
});
test('unknown check outcome is not inferred from high dice or an award',()=>{
 const m=model(event({rolls:[{label:'Table',values:[6,6],total:12}],changes:[change('skills.Admin',0,1)]}));
 assert.equal(m.status,'info');assert.doesNotMatch(html(m),/succeeded|Success/);
});
test('journey escapes story descriptions, labels, title and consequence text',()=>{
 const e=event({type:'career-event',eventResults:[{description:'<img src=x onerror="alert(1)"> & story'}],rolls:[{label:'<script>bad</script>',values:[1],total:1}],changes:[change('skills.<b>Skill</b>',0,1)]});
 const view=html(model(e));assert.doesNotMatch(view,/<img|<script|<b>Skill/);assert.match(view,/&lt;img/);assert.match(view,/&lt;script&gt;/);assert.match(view,/&lt;b&gt;Skill/);
 const custom=html(model(event({type:'benefit'}),state,{...result,title:'<svg onload="bad">'}));assert.match(custom,/&lt;svg/);assert.doesNotMatch(custom,/<svg onload/);
});
test('navigation and bookkeeping events do not become roll-result popups',()=>{
 for(const type of ['setup','background','accept-statistics','skip-precareer','open-precareer','cancel-education','continue-career','notes','connection'])assert.equal(model(event({type})),null,type);
 assert.equal(journeyResult(null,state,catalog,result),null);assert.equal(journeyResult(event(),state,catalog,null),null);assert.equal(html(null),'');
});
test('finite recorded rolls only and full evidence stays available unchanged',()=>{
 const e=event({rolls:[{label:'Invalid',total:NaN},{label:'Invalid',total:Infinity},{label:'Valid',values:[2],total:2}]}),before=structuredClone(e),m=model(e);
 assert.equal(m.rolls.length,1);assert.equal(m.full,result);assert.deepEqual(e,before);
});
