import test from 'node:test';import assert from 'node:assert/strict';
import{availableEffectChoiceIndex as pick}from'./available-effect-choice.mjs';
test('smoke choices skip unavailable outcomes without renumbering API indices',()=>{const options=[{label:'Independence',available:false},{label:'Streetwise'},{label:'blocked',available:false},{label:'Contact',available:true}];assert.deepEqual([0,1,2,3].map(n=>pick(options,n)),[1,3,1,3]);assert.equal(options[0].available,false);});
test('unrestricted choice traversal is unchanged and all-blocked choices fail visibly',()=>{const options=[{label:'a'},{label:'b'},{label:'c'}];for(let i=0;i<12;i++)assert.equal(pick(options,i),i%3);assert.throws(()=>pick([]),/No available/);assert.throws(()=>pick([{available:false}]),/No available/);});
