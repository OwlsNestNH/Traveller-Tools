import test from 'node:test';
import assert from 'node:assert/strict';
import {statisticEditTarget,statisticPreview} from '../gui/statistic-editor.mjs';
const state={stage:'statistics',pool:[{key:'STR',base:8,value:10,adjustment:2,divisor:1}],config:{gm:true},character:{species:'aslan',stats:{STR:10}}};
test('cards resolve the exact existing audited correction field without mutation',()=>{
 const before=structuredClone(state);
 assert.equal(statisticEditTarget({...state,config:{gm:false}},'STR',true),null);
 const raw=statisticEditTarget(state,'STR',true);assert.equal(raw.field,'pool-score');assert.equal(raw.index,0);assert.equal(raw.value,10);assert.match(statisticPreview(raw,state,11),/Final STR: 11/);
 assert.equal(statisticEditTarget(state,'PSI'),null);
 const stat=statisticEditTarget(state,'STR');assert.equal(stat.field,'stat.STR');assert.equal(stat.value,10);
 assert.deepEqual(state,before);
});
test('Aezorgh keeps derived Charisma tied to SOC and round-up pool presentation',()=>{
 const a={...state,aezorghRoundUp:true,character:{species:'aezorgh',stats:{SOC:9,CHA:4}},pool:[{key:'STR',base:7,adjustment:0,divisor:2}]};
 const derived=statisticEditTarget(a,'CHA');assert.equal(derived.field,'stat.SOC');assert.equal(derived.value,9);assert.match(statisticPreview(derived,a,10),/Resulting CHA: 5/);
 assert.match(statisticPreview(statisticEditTarget(a,'STR',true),a,7),/Final STR: 7/);
 assert.match(statisticPreview(statisticEditTarget(a,'STR',true),a,41),/whole number/);
});

