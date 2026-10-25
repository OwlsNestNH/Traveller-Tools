import test from 'node:test';
import assert from 'node:assert/strict';
import {isWrecked,wreckArt} from '../wreck.mjs';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {ICONS,iconFor} from '../appearance.mjs';
test('wrecks require finite known current Hull; unknown is never zero',()=>{
 for(const hull of [0,-1,-100])assert.equal(isWrecked({condition:{hull}}),true);
 for(const hull of [1,88,null,undefined,'0',false,NaN,Infinity,-Infinity])assert.equal(isWrecked({condition:{hull},template:{hull:0}}),false);
 assert.equal(isWrecked({}),false);assert.equal(isWrecked(null),false);
});
test('all explicit silhouette overrides survive wreck, serialization and repair without changing motion or stats',()=>{
 for(const icon of Object.keys(ICONS)){
  const initial=createState({ships:[{id:'test',name:'Test',appearance:{icon,side:'C',heading:37},capabilities:{thrust:2},motion:{position:{q:3,r:-2},velocity:{q:1,r:2},impulse:{q:0,r:0}},condition:{hull:1}}]});
  const wreck=applyCommand(initial,{type:'set-condition',shipId:'test',condition:{...initial.ships[0].condition,hull:0}});
  assert.equal(isWrecked(wreck.ships[0]),true);assert.equal(iconFor(wreck.ships[0]),iconFor(initial.ships[0]));
  const restored=normalizeState(JSON.parse(JSON.stringify(wreck)));assert.deepEqual(restored,wreck);
  const repaired=applyCommand(restored,{type:'set-condition',shipId:'test',condition:{...restored.ships[0].condition,hull:1}});
  assert.equal(isWrecked(repaired.ships[0]),false);assert.deepEqual(repaired.ships,initial.ships);
 }
});
test('wreck decoration retains only the supplied artwork and never adds contact metadata',()=>{
 const symbol='<path data-test="retained"/>';assert.equal(wreckArt(symbol).split(symbol).length,2);
 assert.doesNotMatch(wreckArt(symbol),/ship-id|data-ship|href|name|condition/);
});
