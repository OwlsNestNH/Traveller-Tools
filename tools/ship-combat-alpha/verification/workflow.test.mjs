import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand,normalizeState,coastTarget} from '../engine.mjs';
import {workflowRound} from '../workflow.mjs';
const initial=()=>createState({ships:['alpha','beta'].map((id,i)=>({id,name:id,capabilities:{thrust:2},flight:{initiative:10-i,tie:0,evasion:1},motion:{position:{q:i*10,r:0},velocity:{q:1,r:0}}}))});
const act=(s,type,extra={})=>applyCommand(s,{type,...extra});
const start=()=>act(initial(),'start-battle');
const declared=s=>['beta','alpha'].reduce((v,shipId)=>act(v,'declare-acceleration',{shipId}),s);
test('battle confirms initiative once and uses existing simultaneous movement over repeated rounds',()=>{
 let s=start();const initiatives=structuredClone(s.workflow.initiatives),before=structuredClone(s.ships.map(v=>v.motion));
 assert.equal(workflowRound(s),1);assert.deepEqual(s.acceleration.order,['beta','alpha']);
 s=act(s,'plot',{shipId:'beta',target:{q:12,r:0}});s=declared(s);
 assert.equal(s.workflow.phase,'movement');assert.deepEqual(s.ships.map(v=>v.motion.position),before.map(v=>v.position));
 s=act(s,'advance-round');assert.equal(s.workflow.phase,'attacks');assert.equal(workflowRound(s),1);assert.deepEqual(s.ships.map(v=>v.motion.position.q),[1,12]);
 assert.throws(()=>act(s,'advance-round'),/Movement phase/);
 assert.throws(()=>act(s,'plot',{shipId:'alpha',target:coastTarget(s.ships[0])}),/Thrust phase/);
 s=act(s,'next-battle-phase',{phase:'attacks'});assert.equal(s.workflow.phase,'crew');
 assert.throws(()=>act(s,'next-battle-phase',{phase:'attacks'}),/phase changed/);
 s=act(s,'next-battle-phase',{phase:'crew'});assert.equal(workflowRound(s),2);
 assert.deepEqual(s.workflow.initiatives,initiatives);assert.equal(s.ships[0].flight.evasion,1);
 s=act(declared(s),'advance-round');assert.deepEqual(s.ships.map(v=>v.motion.position.q),[2,14]);
 assert.deepEqual(s.workflow.initiatives,initiatives);
});
test('workflow rejects duplicate, out-of-order and stale commits without mutating the input',()=>{
 const s=start(),snapshot=JSON.stringify(s);
 for(const command of [{type:'start-battle'},{type:'declare-acceleration',shipId:'alpha'},{type:'advance-round'},{type:'next-battle-phase',phase:'thrust'},{type:'leave-battle',expectedRevision:0},{type:'record-initiatives',entries:[]},{type:'clear-ships'}])assert.throws(()=>applyCommand(s,command));
 assert.equal(JSON.stringify(s),snapshot);
 const committed=act(s,'declare-acceleration',{shipId:'beta'});assert.throws(()=>act(committed,'declare-acceleration',{shipId:'beta'}));
});
test('cancel/reopen and leaving preserve plans, records and committed positions',()=>{
 let s=start();s=act(s,'plot',{shipId:'beta',target:{q:12,r:0}});s=declared(s);
 const ships=structuredClone(s.ships);s=act(s,'cancel-acceleration');assert.equal(s.workflow.phase,'thrust');assert.deepEqual(s.acceleration.declared,[]);assert.deepEqual(s.ships,ships);
 s=act(s,'leave-battle');assert.equal(s.workflow,null);assert.equal(s.acceleration,null);assert.deepEqual(s.ships,ships);
 s=act(act(declared(act(s,'start-battle')),'advance-round'),'leave-battle');assert.deepEqual(s.ships.map(v=>v.motion.position.q),[1,12]);
});
test('old saves remain manual; every active phase round-trips and corrupt workflow is rejected',()=>{
 const old=initial();delete old.workflow;assert.equal(normalizeState(old).workflow,null);
 let s=start();for(let i=0;i<4;i++){assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);s=i===0?declared(s):i===1?act(s,'advance-round'):act(s,'next-battle-phase',{phase:s.workflow.phase});}
 for(const change of [v=>v.workflow.phase='invalid',v=>v.workflow.initiatives[0].initiative++,v=>v.workflow.initiatives.pop(),v=>v.acceleration=null]){const bad=start();change(bad);assert.throws(()=>normalizeState(bad));}
 const missing=initial();missing.ships[0].flight.initiative=null;assert.throws(()=>act(missing,'start-battle'),/Record initiative/);
 assert.throws(()=>act(createState({ships:[]}),'start-battle'),/Add a ship/);
});

test('workflow presentation derives acting and next ships without changing state',async()=>{
 const {workflowPresentation}=await import('../workflow-presentation.mjs');let s=start();const snapshot=JSON.stringify(s);
 assert.deepEqual(workflowPresentation(s,'alpha'),{phase:'Manoeuvre',step:'Plot ships',current:'beta',next:'alpha',selected:'alpha'});assert.equal(JSON.stringify(s),snapshot);
 s=act(s,'declare-acceleration',{shipId:'beta'});assert.equal(workflowPresentation(s,'beta').current,'alpha');assert.equal(workflowPresentation(s,'beta').next,null);
 s=act(s,'declare-acceleration',{shipId:'alpha'});assert.equal(workflowPresentation(s,'alpha').step,'Move all ships');assert.equal(workflowPresentation(s,'alpha').current,null);
 s=act(s,'advance-round');assert.equal(workflowPresentation(s,'alpha').phase,'Attack');
});
test('critical badge counts systems, not severity or hit history, retaining unknown manual data',async()=>{
 const {criticalSummary}=await import('../workflow-presentation.mjs');const ship={condition:{criticals:[]},combatDamage:{severities:{Bridge:4,'M-drive':2},history:[{},{},{}]}};
 assert.deepEqual(criticalSummary(ship),{count:2,unknown:false});
 ship.condition.criticals=[{system:'bridge',status:'open'},{system:'Manoeuvre Drive',status:'open'},{system:'Sensors',status:'resolved'},{system:'Fuel',status:'open'}];
 const before=JSON.stringify(ship);assert.deepEqual(criticalSummary(ship),{count:3,unknown:false});assert.equal(JSON.stringify(ship),before);
 ship.condition.criticals=null;assert.deepEqual(criticalSummary(ship),{count:2,unknown:true});
});
