import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand,sampleShips,getShip,coastTarget,plannedTarget,hexDistance,canPlot,reachableCount,MAX_THRUST,COORDINATE_LIMIT} from '../engine.mjs';
import {toWorld,fromWorld,visibleGrid,fitCamera,GRID_LIMIT} from '../geometry.mjs';
const vessel=(id='test',thrust=2,position={q:0,r:0},velocity={q:0,r:0})=>({id,name:id,capabilities:{thrust},motion:{position,velocity,impulse:{q:0,r:0}}});
const state=(...ships)=>createState({ships:ships.length?ships:[vessel()]});
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(deepFreeze);}return x;};

test('coasting preserves velocity for every ship over repeated six-minute rounds',()=>{
 const initial=deepFreeze(state(vessel('one',1,{q:-8,r:4},{q:3,r:-1}),vessel('two',9,{q:12,r:0},{q:-2,r:2})));let s=initial;
 for(let i=0;i<5;i++)s=applyCommand(s,{type:'advance-round',expectedRevision:s.revision});
 assert.equal(s.round,5);assert.equal(s.roundMinutes,6);assert.deepEqual(s.ships[0].motion.position,{q:7,r:-1});assert.deepEqual(s.ships[0].motion.velocity,{q:3,r:-1});assert.deepEqual(s.ships[1].motion.position,{q:2,r:10});assert.deepEqual(initial.ships[0].motion.position,{q:-8,r:4});
});
test('impulse changes velocity before movement, is spent once, and other ships coast',()=>{
 const s=state(vessel('one',2,{q:1,r:2},{q:3,r:0}),vessel('two',0,{q:8,r:8},{q:-1,r:0})),before=JSON.stringify(s);
 const plotted=applyCommand(s,{type:'plot',shipId:'one',target:{q:6,r:1}});assert.deepEqual(plotted.ships[0].motion.impulse,{q:2,r:-1});assert.deepEqual(plannedTarget(plotted.ships[0]),{q:6,r:1});assert.equal(JSON.stringify(s),before);
 const moved=applyCommand(plotted,{type:'advance-round'});assert.deepEqual(moved.ships[0].motion.velocity,{q:5,r:-1});assert.deepEqual(moved.ships[0].motion.position,{q:6,r:1});assert.deepEqual(moved.ships[1].motion.position,{q:7,r:8});assert.deepEqual(moved.ships[0].motion.impulse,{q:0,r:0});
 assert.deepEqual(applyCommand(moved,{type:'advance-round'}).ships[0].motion.position,{q:11,r:0});
});
test('reachable area follows coast position rather than current position or facing',()=>{
 const s=vessel('one',1,{q:0,r:0},{q:8,r:-2});assert.deepEqual(coastTarget(s),{q:8,r:-2});assert.equal(canPlot(s,{q:9,r:-2}),true);assert.equal(canPlot(s,{q:0,r:0}),false);
 assert.equal(canPlot(vessel('stopped',1),{q:0,r:0}),true);assert.equal(canPlot(s,{q:7,r:-1}),true);assert.equal(canPlot(s,{q:9,r:-1}),false);
});
test('all six boundaries and interior counts match exact axial hex distance',()=>{
 for(let thrust=0;thrust<=12;thrust++){
  const ship=vessel('one',thrust,{q:-3,r:7},{q:2,r:-5}),center=coastTarget(ship);let count=0;
  for(let q=-thrust-1;q<=thrust+1;q++)for(let r=-thrust-1;r<=thrust+1;r++)if(canPlot(ship,{q:center.q+q,r:center.r+r}))count++;
  assert.equal(count,reachableCount(thrust));
  for(const [q,r]of [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]){assert.equal(canPlot(ship,{q:center.q+q*thrust,r:center.r+r*thrust}),true);assert.equal(canPlot(ship,{q:center.q+q*(thrust+1),r:center.r+r*(thrust+1)}),false);}
 }
});
test('thrust above six and the maximum are usable without enumerating targets',()=>{
 const s=state(vessel('reaction',MAX_THRUST)),plotted=applyCommand(s,{type:'plot',shipId:'reaction',target:{q:MAX_THRUST,r:-MAX_THRUST}});
 assert.equal(hexDistance(plotted.ships[0].motion.impulse),MAX_THRUST);assert.equal(reachableCount(MAX_THRUST),300030001);assert.deepEqual(applyCommand(plotted,{type:'advance-round'}).ships[0].motion.position,{q:MAX_THRUST,r:-MAX_THRUST});assert.ok(sampleShips().some(s=>s.capabilities.thrust>6));
});
test('zero thrust can coast but cannot add an impulse; cancelling a plot preserves velocity',()=>{
 const s=state(vessel('one',0,{q:0,r:0},{q:3,r:2}));assert.equal(reachableCount(0),1);assert.equal(canPlot(s.ships[0],{q:3,r:2}),true);assert.throws(()=>applyCommand(s,{type:'plot',shipId:'one',target:{q:4,r:2}}),/thrust/);
 const plotted=applyCommand(state(),{type:'plot',shipId:'test',target:{q:2,r:0}}),cleared=applyCommand(plotted,{type:'coast',shipId:'test'});assert.deepEqual(cleared.ships[0].motion.impulse,{q:0,r:0});assert.deepEqual(cleared.ships[0].motion.velocity,{q:0,r:0});
});
test('manual edits affect only the selected ship and clear its old plot',()=>{
 const s=applyCommand(state(vessel('one'),vessel('two',6)),{type:'plot',shipId:'one',target:{q:1,r:0}}),before=structuredClone(s.ships[1]);
 const next=applyCommand(s,{type:'edit-ship',shipId:'one',name:'Reaction fighter',thrust:18,position:{q:70,r:-9},velocity:{q:-12,r:4}});assert.equal(next.ships[0].capabilities.thrust,18);assert.deepEqual(next.ships[0].motion.impulse,{q:0,r:0});assert.deepEqual(next.ships[1],before);
});
test('invalid, stale, fractional, nonfinite and oversized commands reject atomically',()=>{
 const s=deepFreeze(state()),before=JSON.stringify(s);
 const commands=[{type:'unknown'},{type:'coast',shipId:'missing'},{type:'advance-round',expectedRevision:7},{type:'plot',shipId:'test',target:{q:.5,r:0}},{type:'plot',shipId:'test',target:{q:Infinity,r:0}}];
 for(const thrust of [-1,.5,NaN,Infinity,MAX_THRUST+1,'9'])commands.push({type:'edit-ship',shipId:'test',name:'test',thrust,position:{q:0,r:0},velocity:{q:0,r:0}});
 for(const command of commands){assert.throws(()=>applyCommand(s,command));assert.equal(JSON.stringify(s),before);}
});
test('plot legality rejects impossible resulting velocity on either signed axis and accepts exact limits',()=>{
 for(const axis of ['q','r'])for(const sign of [-1,1]){
  const position={q:0,r:0},velocity={q:0,r:0},target={q:0,r:0};position[axis]=-sign;velocity[axis]=sign*COORDINATE_LIMIT;target[axis]=sign*COORDINATE_LIMIT;
  const s=deepFreeze(state(vessel('edge',1,position,velocity))),before=JSON.stringify(s);assert.equal(canPlot(s.ships[0],target),false);assert.throws(()=>applyCommand(s,{type:'plot',shipId:'edge',target}),/Resulting velocity/);assert.equal(JSON.stringify(s),before);
  target[axis]-=sign;assert.equal(canPlot(s.ships[0],target),true);const moved=applyCommand(applyCommand(s,{type:'plot',shipId:'edge',target}),{type:'advance-round'});assert.deepEqual(moved.ships[0].motion.position,target);assert.equal(moved.ships[0].motion.velocity[axis],sign*COORDINATE_LIMIT);
 }
});

test('a round that would exceed coordinate limits leaves every ship unchanged',()=>{
 const s=deepFreeze(state(vessel('one',1,{q:0,r:0},{q:1,r:0}),vessel('edge',1,{q:COORDINATE_LIMIT,r:0},{q:1,r:0}))),before=JSON.stringify(s);
 assert.throws(()=>applyCommand(s,{type:'advance-round'}),/Resulting position/);assert.equal(JSON.stringify(s),before);
});
test('JSON command replay is deterministic and normalized state has no crew/private extras',()=>{
 const initial=createState(),commands=[{type:'plot',shipId:'merchant',target:{q:-2,r:2}},{type:'advance-round'},{type:'coast',shipId:'fighter'},{type:'advance-round'}],run=s=>commands.reduce((next,c)=>applyCommand(next,c),s);
 assert.deepEqual(run(initial),run(JSON.parse(JSON.stringify(initial))));const hostile=structuredClone(initial);hostile.privateCampaign='DO NOT KEEP';hostile.ships[0].crew={privateNotes:'DO NOT KEEP'};assert.ok(!JSON.stringify(applyCommand(hostile,{type:'coast',shipId:'merchant'})).includes('DO NOT KEEP'));
 assert.throws(()=>createState({ships:[vessel('same'),vessel('same')]}),/unique/);assert.throws(()=>createState({ships:new Array(2)}),/Ship ID/);assert.throws(()=>createState({ships:Array.from({length:9},(_,i)=>vessel('s'+i))}),/1 to 8/);
});
test('hex projection round-trips negative, near and very distant coordinates',()=>{
 for(const q of [-1000000,-17,-1,0,1,18,1000000])for(const r of [-1000000,-19,-1,0,1,23,1000000])assert.deepEqual(fromWorld(toWorld({q,r})),{q,r});
});
test('one affine camera preserves pair-distance ratios; fit covers far ships without compression',()=>{
 const points=[{q:-900000,r:0},{q:0,r:0},{q:900000,r:0}],world=points.map(toWorld),camera=fitCamera(points),screen=world.map(p=>({x:p.x*camera.zoom+camera.x,y:p.y*camera.zoom+camera.y}));
 assert.ok(screen.every(p=>Math.abs(p.x)<=500.01&&Math.abs(p.y)<=280.01));assert.equal((screen[2].x-screen[0].x)/(screen[1].x-screen[0].x),2);assert.equal((world[2].x-world[0].x)/(world[1].x-world[0].x),2);
});
test('visible grid enumeration is bounded at normal and extremely distant zoom',()=>{
 for(const camera of [{x:0,y:0,zoom:1},{x:500000,y:-1000000,zoom:.000001},{x:0,y:0,zoom:8}])assert.ok(visibleGrid(camera).cells.length<=GRID_LIMIT);
 const far=visibleGrid({x:0,y:0,zoom:.000001});assert.equal(far.limited,true);assert.equal(far.cells.length,0);
});
