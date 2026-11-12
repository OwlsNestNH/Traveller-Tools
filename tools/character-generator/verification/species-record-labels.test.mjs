import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPANSION_PACK} from '../engine/expansion-pack.mjs';
import {readableFutureCondition,readableTrait} from '../gui/species-record-labels.mjs';
test('actual Guardian secret condition is readable and remains pending without state mutation',()=>{
 const condition=EXPANSION_PACK['aslan.guardian'].events[3].find(e=>e.kind==='conditional-future');assert.ok(condition);
 const before=JSON.stringify(condition),text=readableFutureCondition(condition);assert.equal(text,'If you expose the secret, gain 1 Enemy. This consequence has not been applied yet.');assert.equal(JSON.stringify(condition),before);assert.doesNotMatch(text,/conditional-future|expose-secret|[{}]/);
});
test('future-condition fallback neither serializes unknown rules nor invents effects',()=>{
 for(const condition of [{trigger:'unknown',effects:[{kind:'cash',value:999}]},{trigger:'expose-secret',effects:[{kind:'relationship',type:'Enemy',count:2}]},{trigger:'expose-secret',effects:[{kind:'relationship',type:'Enemy',count:1},{kind:'unknown'}]}]){const text=readableFutureCondition(condition);assert.match(text,/Review it with your referee/);assert.doesNotMatch(text,/999|gain|unknown|[{}]/);}
 assert.equal(readableFutureCondition({text:'Player recorded condition'}),'Player recorded condition');
});
test('traits keep available names and description without technical fallback',()=>{
 assert.equal(readableTrait({name:'Bite',description:'Player description'}),'Bite: Player description');assert.equal(readableTrait({name:'Bite'}),'Bite');assert.equal(readableTrait('Recorded description'),'Recorded description');assert.equal(readableTrait({kind:'internal-trait',id:'secret-id'}),'Recorded trait; review the Full Log for details.');
});
