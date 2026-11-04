import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand} from '../engine.mjs';
import {resolutionView} from '../resolution-view.mjs';
import {renderResolution} from '../resolution-mfd.mjs';
import {directFireFixture} from './direct-fire-fixture.mjs';
import {gunneryFixture} from './gunnery-fixture.mjs';
import {missileFixture} from './missile-fixture.mjs';
import {prepareDirectFireCommand} from '../direct-fire-resolution.mjs';
import {prepareImpacts} from '../missile-impact.mjs';
import {holdMounts} from '../gunnery.mjs';

test('resolution view is unavailable until declarations are complete',()=>{
 const state=gunneryFixture(),before=structuredClone(state);
 assert.equal(resolutionView(state).available,false);assert.deepEqual(state,before);
});
test('missile launch and later point defence are shown as separate saved events',()=>{
 let state=applyCommand(missileFixture(),prepareDirectFireCommand(missileFixture(),()=>.9));
 assert.equal(resolutionView(state).results[0].status,'launched');assert.match(renderResolution(state).content,/Missiles launched/);
 state=applyCommand(state,{type:'next-battle-phase',phase:'attacks'});state=applyCommand(state,{type:'next-battle-phase',phase:'crew'});
 for(const shipId of [...state.acceleration.order])state=applyCommand(state,{type:'declare-acceleration',shipId});
 state=applyCommand(state,{type:'advance-round'});
 for(const shipId of state.workflow.gunnery.order){const rows=holdMounts(state.ships.find(s=>s.id===shipId));if(shipId==='low')Object.assign(rows[0],{action:'point-defense',weapon:'Pulse laser',targetId:null});state=applyCommand(state,{type:'declare-gunnery',shipId,mounts:rows});}
 state=applyCommand(state,prepareDirectFireCommand(state,()=>.9));assert.equal(resolutionView(state).needsImpacts,true);
 state=applyCommand(state,prepareImpacts(state,()=>.9));const before=structuredClone(state),view=resolutionView(state),html=renderResolution(state,view.results.length-1).content;
 assert.equal(view.needsImpacts,false);assert.equal(view.results.at(-1).status,'intercepted');assert.match(html,/Point defence/);assert.match(html,/linked/);assert.match(html,/Effect/);assert.deepEqual(state,before);
});
test('resolution view switches from pending to saved results without changing state',()=>{
 const pending=directFireFixture(),before=structuredClone(pending),view=resolutionView(pending);
 assert.equal(view.available,true);assert.equal(view.needsDirect,true);assert.deepEqual(view.results,[]);assert.deepEqual(pending,before);
 const saved=applyCommand(pending,{type:'resolve-direct-fire',dice:[6,6,1,1,4,4]}),snapshot=structuredClone(saved),resolved=resolutionView(saved);
 assert.equal(resolved.needsDirect,false);assert.equal(resolved.results.length,1);assert.equal(resolved.results[0].status,'hit');assert.deepEqual(saved,snapshot);
 const rendered=renderResolution(saved);assert.match(rendered.content,/Hit/);assert.match(rendered.content,/modified total/);assert.doesNotMatch(rendered.actions+rendered.content,/Resolve All/);assert.match(rendered.actions,/GM · Attacks Complete/);assert.deepEqual(saved,snapshot);
});
