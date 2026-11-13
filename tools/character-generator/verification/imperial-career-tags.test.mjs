import assert from 'node:assert/strict';
import test from 'node:test';
import {IMPERIAL_OUTCOME_LINES,imperialOutcome,imperialResultTagline} from '../gui/imperial-career-tags.mjs';
import {IMPERIAL_CAREER_DEFINITIONS} from '../gui/imperial-career-definitions.mjs';
const examples={success:[{type:'career'},{status:'success'}],exceptional:[{type:'commission',summary:'Commission: {"success":true,"total":14,"target":8}.'},{status:'success'}],failure:[{type:'career'},{status:'failure'}],survived:[{type:'survival-check'},{status:'success'}],'survival-failed':[{type:'survival-check'},{status:'failure'}],event:[{type:'career-event'},{}],consequence:[{type:'career-mishap'},{}],training:[{type:'training'},{}],choice:[{type:'choose-skill'},{}],benefit:[{type:'benefit'},{}]};
test('every Imperial career receives all six deterministic variants for each applicable outcome',()=>{
 for(const id of Object.keys(IMPERIAL_CAREER_DEFINITIONS))for(const [kind,[event,result]] of Object.entries(examples)){
  const state={active:0,rng:123,character:{species:'human',careers:[{id}],careerTransitions:[{toCareerId:id}]}},before=JSON.stringify(state),seen=new Set();
  assert.equal(imperialOutcome(event,result),kind);assert.equal(IMPERIAL_OUTCOME_LINES[kind].length,6);
  for(let i=0;i<400;i++){const e={...event,id:'synthetic-'+i},line=imperialResultTagline(e,result,state);assert.ok(IMPERIAL_OUTCOME_LINES[kind].includes(line));assert.equal(line,imperialResultTagline(e,result,state));seen.add(line);}
  assert.equal(seen.size,6,id+' '+kind);assert.equal(JSON.stringify(state),before);
 }
});
test('technical errors and unrelated later choices receive no mocking result tag',()=>{
 const state={active:0,character:{species:'human',careers:[{id:'core.navy'}]}};
 assert.equal(imperialResultTagline({id:'error',type:'career-event'},{status:'error'},state),null);
 assert.equal(imperialResultTagline({id:'later',type:'choose-skill'},{},{...state,active:null}),null);
 assert.equal(imperialResultTagline({id:'alien',type:'training'},{},{...state,character:{...state.character,species:'aslan'}}),null);
 assert.equal(imperialOutcome({type:'career-event',rolls:[{total:12}]},{status:'success'}),'success');
});
