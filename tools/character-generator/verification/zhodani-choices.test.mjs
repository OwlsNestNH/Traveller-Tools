import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipLossOptions,relationshipLoss,scienceSelectionKey,distinctScienceSelection} from '../engine/zhodani-choices.mjs';
test('relationship candidates retain original indices and only eligible roles',()=>{
 const entries=[{role:'Enemy',name:'A'},{role:'Ally',name:'B'},{role:'Contact',name:'C'},{role:'Rival',name:'D'}];
 assert.deepEqual(relationshipLossOptions(entries),[{index:1,role:'Ally',name:'B'},{index:2,role:'Contact',name:'C'}]);
 const before=JSON.stringify(entries),r=relationshipLoss(entries,{index:2});assert.deepEqual(r.removed,entries[2]);assert.equal(r.relationshipIndex,2);assert.equal(r.remaining.length,3);assert.equal(JSON.stringify(entries),before);
});
test('exactly one eligible entry must be selected; stale and extra values are rejected',()=>{
 const entries=[{role:'Enemy',name:'A'},{role:'Contact',name:'B'}];
 for(const decision of [{index:0},{index:-1},{index:2},{index:'1'},{index:1,reason:'extra'},{absent:true,reason:'Not absent'}])assert.throws(()=>relationshipLoss(entries,decision));
});
test('empty eligible roster requires an explicit reason without inventing or removing a person',()=>{
 const entries=[{role:'Enemy',name:'A'}];assert.throws(()=>relationshipLoss(entries,{absent:true,reason:''}));assert.throws(()=>relationshipLoss(entries,{index:0}));
 const r=relationshipLoss(entries,{absent:true,reason:'No eligible relationship exists in the recorded history.'});assert.equal(r.absent,true);assert.equal(r.removed,null);assert.deepEqual(r.remaining,entries);
});
test('distinct Science uses canonical subject identity without closing the open subject list',()=>{
 assert.equal(scienceSelectionKey('Science (PHYSICS)'),'physics');
 for(const name of ['Science (physics)','Science (PHYSICS)','Science (ｐｈｙｓｉｃｓ)'])assert.throws(()=>distinctScienceSelection(name,['Science (physics)']),/different/);
 assert.equal(distinctScienceSelection('Science (xenobiology)',['Science (physics)']),'Science (xenobiology)');
});
test('Science selection rejects missing subjects and other skill families',()=>{
 for(const name of ['Science','Medic','Engineer (power)','Science ()'])assert.throws(()=>distinctScienceSelection(name));
});
