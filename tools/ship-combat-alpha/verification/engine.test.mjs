import {ICON_RADII,iconRadius} from '../icon-bounds.mjs';
import {legacySampleShips} from './legacy-sample-fixture.mjs';
import {rangeInfo,HEX_KM,reducedVelocity} from '../movement-rules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand,sampleShips,getShip,coastTarget,plannedTarget,hexDistance,canPlot,reachableCount,MAX_THRUST,COORDINATE_LIMIT,availableThrust,accelerationOrder,normalizeState} from '../engine.mjs';
import {toWorld,fromWorld,visibleGrid,fitCamera,GRID_LIMIT,GRID_LIMIT_AT_100,HEX_SIZE,shipGlyphScale} from '../geometry.mjs';
const vessel=(id='test',thrust=2,position={q:0,r:0},velocity={q:0,r:0})=>({id,name:id,capabilities:{thrust},motion:{position,velocity,impulse:{q:0,r:0}}});
const state=(...ships)=>createState({ships:ships.length?ships:[vessel()]});
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(deepFreeze);}return x;};

test('complete ship artwork stays inside its hex at every travel rotation and view scale',()=>{
 const apothem=HEX_SIZE*Math.sqrt(3)/2;
 for(const screen of [.000001,.1,.5,1,2,10,1000000]){
  const scale=shipGlyphScale(screen);assert.ok(scale>0);
  for(let degrees=0;degrees<360;degrees+=5)for(const [x,y]of [[-24,-24],[-24,24],[24,-24],[24,24]]){
   const a=degrees*Math.PI/180,px=screen*scale*(x*Math.cos(a)-y*Math.sin(a)),py=screen*scale*(x*Math.sin(a)+y*Math.cos(a));
   assert.ok(Math.hypot(px,py)<=.9*apothem+1e-9,'rotation-safe 10% hex inset');
  }
 }
});

test('visible-art sizing grows with zoom beyond the old cap without a screen minimum',()=>{
 for(const radius of [...Object.values(ICON_RADII),iconRadius('research'),iconRadius('corsair'),iconRadius('other'),Math.hypot(24,24)]){
  let previous=0;for(const zoom of [.01,.33,1,2,4,16]){const screen=1/zoom,scale=shipGlyphScale(screen,radius);assert.ok(scale>previous);assert.ok(Math.abs(scale*screen*radius-.9*HEX_SIZE*Math.sqrt(3)/2)<1e-10);previous=scale;}
 }
 assert.equal(iconRadius('unknown','new-art.webp'),Math.hypot(24,24));
});

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
 const initial=createState({ships:legacySampleShips()}),commands=[{type:'plot',shipId:'merchant',target:{q:-2,r:2}},{type:'advance-round'},{type:'coast',shipId:'fighter'},{type:'advance-round'}],run=s=>commands.reduce((next,c)=>applyCommand(next,c),s);
 assert.deepEqual(run(initial),run(JSON.parse(JSON.stringify(initial))));const hostile=structuredClone(initial);hostile.privateCampaign='DO NOT KEEP';hostile.ships[0].crew={privateNotes:'DO NOT KEEP'};assert.ok(!JSON.stringify(applyCommand(hostile,{type:'coast',shipId:'merchant'})).includes('DO NOT KEEP'));
 assert.throws(()=>createState({ships:[vessel('same'),vessel('same')]}),/unique/);assert.throws(()=>createState({ships:new Array(2)}),/Ship ID/);assert.throws(()=>createState({ships:Array.from({length:11},(_,i)=>vessel('s'+i))}),/0 to 10/);
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
test('100 percent grid detail has a bounded budget while lower zoom keeps its previous cutoff',()=>{
 const camera={x:0,y:0,zoom:1},before=structuredClone(camera),wide={width:2183.35,height:1263};
 for(const zoom of [1,1+Number.EPSILON,1.01,1.4]){const g=visibleGrid({...camera,zoom},wide.width,wide.height);assert.equal(g.limited,false);assert.ok(g.cells.length>0&&g.cells.length<=GRID_LIMIT_AT_100);}
 assert.equal(visibleGrid({...camera,zoom:1-Number.EPSILON},wide.width,wide.height).limited,true);
 assert.equal(visibleGrid({...camera,zoom:.99},wide.width,wide.height).limited,true);
 assert.equal(visibleGrid({...camera,zoom:.99},1200,1200).cells.length,1645,'below-100 phone grid retains its old bounded behavior');
 assert.equal(visibleGrid({...camera,zoom:.3199},100,100).limited,true);
 assert.ok(GRID_LIMIT_AT_100===3600&&GRID_LIMIT===1800);const huge=visibleGrid(camera,1000000,1000000);assert.equal(huge.limited,true);assert.deepEqual(huge.cells,[]);assert.deepEqual(camera,before);
});

// Setup additions exercise independent instances, exact source variants and atomic errors.
import {PRESETS,preset} from '../catalogue.mjs';
import {crewContribution,MAX_SHIPS,ROLES} from '../setup.mjs';
const addPreset=(s,id='core-194',name='Added trader')=>applyCommand(s,{type:'add-ship',presetId:id,name,position:{q:2,r:1},velocity:{q:0,r:0}});

test('fresh/reset samples hydrate full existing presets with citations and wider scenario spacing',()=>{
 const ids={merchant:'acs2023-p22',courier:'acs2023-p136',escort:'drinax-harrier-restored',scout:'acs2023-p6',fighter:'scc2023-p051'},fresh=createState(),old=legacySampleShips();assert.equal(fresh.ships.length,5);
 for(const s of fresh.ships){const p=preset(ids[s.id]);assert.equal(s.name,p.name);const added=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:ids[s.id],name:s.name,position:s.motion.position,velocity:s.motion.velocity,appearance:s.appearance}).ships[0];assert.deepEqual({...s,id:added.id},added);const before=old.find(x=>x.id===s.id);assert.deepEqual(s.motion.position,{q:before.motion.position.q*3,r:before.motion.position.r*3});assert.equal(s.condition.fuel,null);assert.equal(s.condition.weapons,null);assert.equal(s.condition.powerOutput,p.initialCondition?.powerOutput??null);}
 const next=createState();fresh.ships[0].template.record.ratedPower=1;assert.equal(next.ships[0].template.record.ratedPower,preset(ids.merchant).record.ratedPower);assert.equal(createState().ships[0].template.record.ratedPower,next.ships[0].template.record.ratedPower);
});

test('approved source silhouettes retain catalogue identity and saved icon overrides',()=>{
 const defaults=createState(),mapping={merchant:'armed-trader',courier:'hunting-ship',scout:'stealth-scout',fighter:'kashu-fighter'};
 for(const [id,icon]of Object.entries(mapping)){const s=getShip(defaults,id);assert.equal(s.appearance.icon,'auto');assert.equal(iconFor(s),icon);assert.match(ICONS[icon].label,/interpreted deckplan/i);assert.equal(iconFor({...s,appearance:{...s.appearance,icon:'trader'}}),'trader','saved manual representative choices remain honored');}
 const harrier=getShip(defaults,'escort');assert.equal(harrier.appearance.icon,'auto');assert.equal(iconFor(harrier),'harrier');assert.equal(ICONS.harrier.file,'harrier-custom.svg');
 const edited=applyCommand(defaults,{type:'set-appearance',shipId:'merchant',appearance:{icon:'research'}}),saved=JSON.stringify(edited);sampleShips();createState();assert.equal(JSON.stringify(edited),saved);assert.deepEqual(normalizeState(JSON.parse(saved)),edited);assert.equal(iconFor(getShip(normalizeState(JSON.parse(saved)),'merchant')),'research');
 for(let i=0;i<defaults.ships.length;i++){const a=defaults.ships[i],b=edited.ships[i];assert.deepEqual(a.template,b.template);assert.deepEqual(a.motion,b.motion);assert.deepEqual(a.condition,b.condition);assert.deepEqual(a.systems,b.systems);}
});

test('default sample changes never hydrate or overwrite explicit legacy/imported/custom encounters',()=>{
 const legacy=createState({ships:legacySampleShips()}),saved=JSON.stringify(legacy),restored=normalizeState(JSON.parse(saved));assert.deepEqual(restored,legacy);assert.equal(restored.ships[0].template,null);const custom=createState({ships:[vessel('private-custom',4,{q:999,r:-123},{q:0,r:0})]}),copy=JSON.stringify(custom);createState();createState();assert.equal(JSON.stringify(custom),copy);assert.equal(JSON.stringify(legacy),saved);assert.deepEqual(normalizeState(JSON.parse(copy)),custom);
});
test('catalogue keeps <=400-ton source variants and printed citations without inferred armour',()=>{
 assert.equal(PRESETS.length,195);assert.equal(new Set(PRESETS.map(p=>p.id)).size,195);
 for(const p of PRESETS){assert.ok(p.tons>0&&p.tons<=400);assert.ok(p.source.page>0);assert.ok(p.source.book.endsWith('Update 2022')||p.source.book==='Adventure Class Ships (2023)'||p.source.book==='Traders and Gunboats (2024)'||p.source.book==='Small Craft Catalogue (2023)'||p.id==='drinax-harrier-restored');assert.equal(preset(p.id).thrust,p.thrust);}
 assert.deepEqual(['tons','thrust','hull','armour'].map(k=>preset('core-218')[k]),[10,6,4,2]);
 assert.deepEqual(['tons','thrust','hull','armour'].map(k=>preset('highguard-148')[k]),[50,9,22,15]);
 assert.equal(preset('highguard-181').thrust,5);assert.equal(preset('core-204').thrust,6);
 assert.equal(preset('highguard-185').tons,360);assert.equal(preset('highguard-185').hull,160);assert.match(preset('highguard-185').notes,/400-ton/);
 assert.equal(preset('core-220').armour,null);assert.equal(preset('highguard-196').source.page,195);assert.equal(preset('highguard-196').source.endPage,196);
 const copy=preset('core-194');copy.thrust=999;assert.equal(preset('core-194').thrust,1);
});
test('add duplicates independently through ten and reject eleventh atomically with no replacement',()=>{
 let s=createState();const original=structuredClone(s.ships);
 for(let i=0;i<5;i++)s=addPreset(s,'core-194','Trader '+i);
 assert.equal(s.ships.length,MAX_SHIPS);assert.equal(new Set(s.ships.map(x=>x.id)).size,10);assert.deepEqual(s.ships.slice(0,5),original);
 const before=JSON.stringify(s);assert.throws(()=>addPreset(s),/No ship was added or replaced/);assert.equal(JSON.stringify(s),before);
 let next=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:3}});assert.equal(next.ships[5].condition.hull,3);assert.equal(next.ships[6].condition.hull,80);assert.equal(preset('core-194').hull,80);
});
test('custom designs accept inclusive 400 tons and unknown facts; reject malformed setup atomically',()=>{
 const s=state(),command={type:'add-ship',name:'Manual',template:{name:'Custom',tons:400,thrust:18},position:{q:0,r:0},velocity:{q:3,r:0}};
 const next=applyCommand(s,command),added=next.ships.at(-1);assert.equal(added.template.tons,400);assert.equal(added.template.hull,null);assert.equal(added.template.armour,null);assert.equal(added.condition.hull,null);
 for(const tons of [0,-1,400.01,Infinity,NaN,'100']){const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{...command,template:{...command.template,tons}}));assert.equal(JSON.stringify(s),before);}
 assert.throws(()=>applyCommand(s,{...command,presetId:'unknown'}),/preset/);
 assert.throws(()=>applyCommand(next,{type:'set-condition',shipId:'ship-1',condition:{hull:-1}}));
});
test('crew modes and optional TOTAL overrides remain independent of templates, motion and situation',()=>{
 let s=addPreset(state()),id=s.ships.at(-1).id;const other=structuredClone(s.ships[0]),motion=structuredClone(s.ships[1].motion),template=structuredClone(s.ships[1].template);
 for(const [rating,total] of [['Green',1],['Veteran',2],['Elite',3]]){s=applyCommand(s,{type:'set-crew',shipId:id,crew:{mode:'quick',rating,overrides:{pilot:0},details:{pilot:{name:'Ada',skillName:'Pilot (spacecraft)',skill:2,characteristicDM:1}}},situational:{pilot:-2}});assert.equal(crewContribution(s.ships[1].crew,'pilot'),0);assert.equal(crewContribution(s.ships[1].crew,'sensors'),total);assert.equal(s.ships[1].situational.pilot,-2);}
 s=applyCommand(s,{type:'set-crew',shipId:id,crew:{...s.ships[1].crew,mode:'detailed'},situational:s.ships[1].situational});assert.equal(crewContribution(s.ships[1].crew,'pilot'),3);assert.equal(crewContribution(s.ships[1].crew,'gunner'),null);assert.deepEqual(s.ships[0],other);assert.deepEqual(s.ships[1].motion,motion);assert.deepEqual(s.ships[1].template,template);
 const before=JSON.stringify(s);for(const crew of [{rating:'Legendary'},{mode:'detailed',details:{pilot:{name:'X',skillName:'Pilot',skill:2,characteristicDM:6}}},{overrides:{pilot:21}}]){assert.throws(()=>applyCommand(s,{type:'set-crew',shipId:id,crew}));assert.equal(JSON.stringify(s),before);}
 assert.ok(ROLES.includes('astrogator'));
});
test('braking to zero costs velocity-change thrust and applies only on advance; zero thrust coasts',()=>{
 const s=state(vessel('one',3,{q:5,r:2},{q:3,r:0})),plotted=applyCommand(s,{type:'brake',shipId:'one'});assert.deepEqual(plotted.ships[0].motion.velocity,{q:3,r:0});assert.deepEqual(plotted.ships[0].motion.impulse,{q:-3,r:0});const stopped=applyCommand(plotted,{type:'advance-round'});assert.deepEqual(stopped.ships[0].motion.position,{q:5,r:2});assert.deepEqual(stopped.ships[0].motion.velocity,{q:0,r:0});
 const fast=state(vessel('fast',0,{q:1,r:1},{q:1,r:0})),before=JSON.stringify(fast),waiting=applyCommand(fast,{type:'brake',shipId:'fast'});assert.equal(waiting.ships[0].flight.braking,true);assert.deepEqual(waiting.ships[0].motion.impulse,{q:0,r:0});assert.equal(JSON.stringify(fast),before);assert.equal(applyCommand(waiting,{type:'advance-round'}).ships[0].motion.position.q,2);
});

test('continuing braking advances one round at a time, recomputes reservations, and never overshoots',()=>{
 let s=applyCommand(state(vessel('one',2,{q:0,r:0},{q:7,r:0})),{type:'brake',shipId:'one'});assert.equal(s.round,0);assert.deepEqual(s.ships[0].motion.velocity,{q:7,r:0});
 s=applyCommand(s,{type:'advance-round'});assert.equal(s.round,1);assert.equal(s.ships[0].motion.velocity.q,5);assert.equal(s.ships[0].motion.position.q,5);assert.equal(s.ships[0].flight.braking,true);
 s=applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{evasion:1}});assert.equal(availableThrust(s.ships[0]),1);s=applyCommand(s,{type:'advance-round'});assert.equal(s.ships[0].motion.velocity.q,4);assert.equal(s.ships[0].motion.position.q,9);
 s=applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{evasion:0}});s=applyCommand(s,{type:'advance-round'});assert.equal(s.ships[0].motion.velocity.q,2);s=applyCommand(s,{type:'advance-round'});assert.equal(s.ships[0].motion.velocity.q,0);assert.equal(s.ships[0].flight.braking,false);assert.equal(s.round,4);const p=s.ships[0].motion.position;s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[0].motion.position,p);
});
test('braking is legal in every axial direction and editable/cancellable without hidden movement',()=>{
 for(let q=-12;q<=12;q++)for(let r=-12;r<=12;r++)for(let b=0;b<=6;b++){const n=reducedVelocity({q,r},b);assert.equal(hexDistance(n),Math.max(0,hexDistance({q,r})-b));assert.ok(hexDistance(n,{q,r})<=b);assert.ok(!q||!n.q||Math.sign(q)===Math.sign(n.q));assert.ok(!r||!n.r||Math.sign(r)===Math.sign(n.r));}
 let s=applyCommand(state(vessel('one',2,{q:0,r:0},{q:8,r:-3})),{type:'brake',shipId:'one'});const c=applyCommand(s,{type:'coast',shipId:'one'});assert.equal(c.ships[0].flight.braking,false);assert.deepEqual(c.ships[0].motion.impulse,{q:0,r:0});assert.deepEqual(c.ships[0].motion.velocity,{q:8,r:-3});s=applyCommand(s,{type:'plot',shipId:'one',target:{q:9,r:-3}});assert.equal(s.ships[0].flight.braking,false);assert.deepEqual(s.ships[0].motion.impulse,{q:1,r:0});
});
test('reservations constrain targets and existing plots atomically, including zero movement budget',()=>{
 let s=state(vessel('one',6));s=applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{evasion:2,gunners:3}});assert.equal(availableThrust(s.ships[0]),1);assert.equal(canPlot(s.ships[0],{q:2,r:0}),false);s=applyCommand(s,{type:'plot',shipId:'one',target:{q:1,r:0}});const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{gunners:4}}));assert.throws(()=>applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{evasion:7}}));assert.equal(JSON.stringify(s),before);s=applyCommand(s,{type:'coast',shipId:'one'});s=applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{gunners:4}});assert.equal(availableThrust(s.ships[0]),0);assert.equal(canPlot(s.ships[0],{q:0,r:0}),true);
});
test('declarations use recorded initiative, stable referee ties, and simultaneous guarded resolution',()=>{
 let s=state(vessel('slow',9),vessel('fast',1),vessel('tie',4));assert.throws(()=>applyCommand(s,{type:'begin-acceleration'}),/Record initiative/);for(const [shipId,initiative,tie]of [['slow',2,0],['fast',9,0],['tie',2,-1]])s=applyCommand(s,{type:'set-flight-plan',shipId,flight:{initiative,tie}});assert.deepEqual(accelerationOrder(s),['tie','slow','fast']);
 s=applyCommand(s,{type:'begin-acceleration'});const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'declare-acceleration',shipId:'fast'}),/first/);assert.throws(()=>applyCommand(s,{type:'advance-round'}),/Every ship/);assert.throws(()=>applyCommand(s,{type:'plot',shipId:'fast',target:{q:1,r:0}}),/first/);assert.equal(JSON.stringify(s),before);
 s=applyCommand(s,{type:'plot',shipId:'tie',target:{q:2,r:0}});s=applyCommand(s,{type:'declare-acceleration',shipId:'tie'});assert.deepEqual(s.ships[2].motion.position,{q:0,r:0});assert.throws(()=>applyCommand(s,{type:'coast',shipId:'tie'}),/first/);assert.throws(()=>applyCommand(s,{type:'set-flight-plan',shipId:'slow',flight:{initiative:10}}),/Cancel declarations/);s=applyCommand(s,{type:'declare-acceleration',shipId:'slow'});s=applyCommand(s,{type:'plot',shipId:'fast',target:{q:0,r:1}});s=applyCommand(s,{type:'declare-acceleration',shipId:'fast'});assert.throws(()=>applyCommand(s,{type:'declare-acceleration',shipId:'fast'}),/All accelerations/);s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[2].motion.position,{q:2,r:0});assert.deepEqual(s.ships[1].motion.position,{q:0,r:1});assert.equal(s.round,1);assert.equal(s.acceleration,null);assert.equal(s.ships[1].flight.initiative,9);
});
test('legacy records retain manual movement, unknown initiative, deterministic replay and cancellation',()=>{
 const old={version:1,revision:0,round:0,roundMinutes:6,ships:[vessel('one')]};let s=normalizeState(old);assert.equal(s.acceleration,null);assert.equal(s.ships[0].flight.initiative,null);assert.equal(availableThrust(s.ships[0]),2);s=applyCommand(s,{type:'set-flight-plan',shipId:'one',flight:{initiative:0}});s=applyCommand(s,{type:'begin-acceleration'});assert.throws(()=>applyCommand(s,{type:'remove-ship',shipId:'one'}),/Finish or cancel/);s=applyCommand(s,{type:'cancel-acceleration'});s=applyCommand(s,{type:'advance-round'});assert.equal(s.round,1);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);
});
test('Euclidean ranges use 648 km centres and explicit continuous/outward band boundaries',()=>{
 const o={q:0,r:0};assert.equal(HEX_KM,648);for(const [q,band]of [[0,'Adjacent / Close'],[1,'Short'],[2,'Medium'],[15,'Medium'],[16,'Long'],[38,'Long'],[39,'Very Long'],[77,'Very Long'],[78,'Distant']]){const info=rangeInfo({q,r:0},o);assert.equal(info.band,band);assert.equal(info.km,q*648);assert.equal(info.outwardSpaces,q);}
 const diagonal=rangeInfo({q:1,r:1},o);assert.equal(diagonal.spaces,Math.sqrt(3));assert.equal(diagonal.outwardSpaces,2);assert.equal(diagonal.band,'Medium');assert.equal(rangeInfo({q:45,r:45},o).band,'Distant');assert.equal(rangeInfo({q:77+1e-10,r:0},o).band,'Distant');assert.deepEqual(rangeInfo({q:-4,r:-3},o),rangeInfo(o,{q:-4,r:-3}));
});

test('initiative batch is atomic and malformed guided states cannot bypass order or profile guards',()=>{
 let s=state(vessel('a'),vessel('b')),before=JSON.stringify(s);for(const entries of [[],[{shipId:'a',initiative:2,tie:0},{shipId:'a',initiative:4,tie:0}],[{shipId:'a',initiative:2,tie:0},{shipId:'unknown',initiative:4,tie:0}],[{shipId:'a',initiative:2,tie:0},{shipId:'b',initiative:4.5,tie:0}]]){assert.throws(()=>applyCommand(s,{type:'record-initiatives',entries}));assert.equal(JSON.stringify(s),before);}
 s=applyCommand(s,{type:'record-initiatives',entries:[{shipId:'a',initiative:0,tie:0},{shipId:'b',initiative:0,tie:0}]});assert.deepEqual(accelerationOrder(s),['a','b']);s=applyCommand(s,{type:'begin-acceleration'});for(const acceleration of [{order:['b','a'],declared:[]},{order:['a','b'],declared:['b']},{order:['a','b'],declared:['a','b','a']}])assert.throws(()=>normalizeState({...s,acceleration}));assert.throws(()=>normalizeState({...s,roundMinutes:12}),/six-minute/);assert.throws(()=>applyCommand(s,{type:'record-initiatives',entries:[]}),/Finish or cancel/);
});
test('braking retains zero-thrust intent until an explicit thrust recovery and rejects overflow atomically',()=>{
 let s=applyCommand(state(vessel('one',0,{q:0,r:0},{q:5,r:-2})),{type:'brake',shipId:'one'});s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[0].motion.velocity,{q:5,r:-2});s=applyCommand(s,{type:'edit-ship',shipId:'one',name:'one',thrust:3,position:s.ships[0].motion.position,velocity:s.ships[0].motion.velocity});assert.equal(s.ships[0].flight.braking,true);s=applyCommand(s,{type:'advance-round'});assert.equal(hexDistance(s.ships[0].motion.velocity),2);
 const edge=applyCommand(state(vessel('edge',1,{q:COORDINATE_LIMIT,r:0},{q:3,r:0})),{type:'brake',shipId:'edge'}),before=JSON.stringify(edge);assert.throws(()=>applyCommand(edge,{type:'advance-round'}),/Resulting position/);assert.equal(JSON.stringify(edge),before);
});

test('remove and clear preserve remaining IDs and setup; empty encounter can add ten real ships',()=>{
 let s=addPreset(createState()),before=structuredClone(s),kept=structuredClone(s.ships.filter(x=>x.id!=='merchant'));
 s=applyCommand(s,{type:'remove-ship',shipId:'merchant'});assert.deepEqual(s.ships,kept);assert.deepEqual(before.ships[0].id,'merchant');assert.throws(()=>applyCommand(s,{type:'remove-ship',shipId:'missing'}),/existing ship/);
 const empty=applyCommand(s,{type:'clear-ships'});assert.equal(empty.ships.length,0);assert.equal(empty.round,s.round);assert.throws(()=>applyCommand(empty,{type:'advance-round'}),/Add a ship/);assert.deepEqual(fitCamera([]),{zoom:1,x:0,y:0});
 s=empty;for(let i=0;i<10;i++)s=addPreset(s);assert.equal(s.ships.length,10);assert.equal(new Set(s.ships.map(x=>x.id)).size,10);assert.throws(()=>addPreset(s),/Encounter full/);assert.equal(createState({ships:[]}).ships.length,0);
});
test('Express Boat explicitly has no manoeuvre drive and coasts at zero thrust',()=>{
 const p=preset('highguard-158');assert.deepEqual([p.tons,p.thrust,p.hull,p.source.page],[100,0,40,158]);assert.match(p.notes,/No manoeuvre drive/);
 let s=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:p.id,name:'X-boat',position:{q:0,r:0},velocity:{q:2,r:0}});assert.equal(canPlot(s.ships[0],{q:3,r:0}),false);s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[0].motion.position,{q:2,r:0});assert.deepEqual(s.ships[0].motion.velocity,{q:2,r:0});
});

import {ICONS,PRESET_ICONS,iconFor,normalizeAppearance} from '../appearance.mjs';
test('side and silhouette are independent presentation data; edits never alter movement or crew',()=>{
 const s=addPreset(createState()),id=s.ships.at(-1).id,original=structuredClone(s),next=applyCommand(s,{type:'set-appearance',shipId:id,appearance:{side:'B',icon:'research'}});
 assert.deepEqual(next.ships.at(-1).appearance,{side:'B',icon:'research',heading:-90});const expected=structuredClone(original.ships.at(-1));expected.appearance={side:'B',icon:'research',heading:-90};assert.deepEqual(next.ships.at(-1),expected);assert.deepEqual(next.ships.slice(0,-1),original.ships.slice(0,-1));assert.deepEqual(s,original);
 for(const appearance of [{side:'E'},{icon:'../../private'},{icon:'__proto__'}])assert.throws(()=>applyCommand(s,{type:'set-appearance',shipId:id,appearance}),/Choose Side/);
 assert.deepEqual(normalizeAppearance(),{side:'A',icon:'auto',heading:-90});
 const run=x=>applyCommand(applyCommand(x,{type:'set-appearance',shipId:id,appearance:{side:'B',icon:'trader'}}),{type:'advance-round'});assert.deepEqual(run(s),run(JSON.parse(JSON.stringify(s))));
});
test('automatic symbols distinguish Marava and custom ring/corsair and keep unknown hulls generic',()=>{
 const symbol=id=>iconFor({template:preset(id)});
 assert.equal(symbol('highguard-167'),'marava');assert.equal(symbol('core-194'),'trader');assert.equal(symbol('core-206'),'research');assert.equal(symbol('highguard-196'),'corsair');assert.equal(symbol('highguard-158'),'other');assert.equal(symbol('core-218'),'fighter');assert.equal(symbol('core-220'),'launch');
 assert.match(ICONS.research.label,/custom toroid.*not a canonical/);assert.match(ICONS.corsair.label,/custom fallback.*not a canonical/);
 assert.equal(iconFor({template:{name:'Custom mystery',tons:400},appearance:{side:'A',icon:'auto'}}),'other');
 for(const p of PRESETS)assert.ok(Object.hasOwn(ICONS,iconFor({template:p})));
});

test('all 194 source identities explicitly map matching available hulls or honest missing-variant fallbacks',()=>{
 assert.equal(Object.keys(PRESET_ICONS).length,194);
 for(const p of PRESETS)assert.ok(Object.hasOwn(PRESET_ICONS,p.source.book+'/'+p.source.page),p.id);
 for(const [id,icon,file] of [
 ['core-202','yacht','yacht.webp'],['highguard-179','yacht','yacht.webp'],['core-220','launch','launch.webp'],['highguard-139','launch','launch.webp'],['core-204','close-escort','close_escort.webp'],['highguard-181','close-escort','close_escort.webp'],['core-196','far-trader','far_trader.webp'],['highguard-169','far-trader','far_trader.webp'],['highguard-138','military-gig','military_gig.webp'],['core-219','gig','gig.webp'],['core-192','seeker','seeker.webp'],['core-210','subsidised-merchant','subsidised_merchant.webp'],['highguard-191','survey-scout','survey_scout.webp'],['core-227','passenger-shuttle','passenger_shuttle.webp']]){assert.equal(iconFor({template:preset(id)}),icon,id);assert.equal(ICONS[icon].file,file);}
 for(const id of ['highguard-136','highguard-148','highguard-150','highguard-152','highguard-158','highguard-165','highguard-177','highguard-183','highguard-193'])assert.equal(iconFor({template:preset(id)}),'other',id+' must not borrow a different variant');
 assert.equal(Object.values(ICONS).filter(x=>x.file).length,70);
});


test('Side C survives JSON and cosmetic heading follows actual velocity, retaining zero-speed history',async()=>{
 const {velocityHeading,glyphRotation,SIDES}=await import('../appearance.mjs');
 assert.equal(SIDES.C.label,'Side C');assert.equal(SIDES.C.color,'#d3afff');
 for(const [v,angle]of [[{q:1,r:0},0],[{q:0,r:1},60],[{q:-1,r:0},180],[{q:0,r:-1},-120]])assert.ok(Math.abs(velocityHeading(v)-angle)<1e-9);
 assert.equal(glyphRotation('trader',0),-90);assert.equal(glyphRotation('small-craft',0),90);assert.equal(glyphRotation('research',60),0);
 let s=createState();const id=s.ships[0].id;
 s=applyCommand(s,{type:'set-appearance',shipId:id,appearance:{side:'C',icon:'trader'}});
 assert.equal(s.ships[0].appearance.heading,0);
 const restored=createState(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.ships,s.ships);
 s=applyCommand(s,{type:'edit-ship',shipId:id,name:s.ships[0].name,thrust:s.ships[0].capabilities.thrust,position:s.ships[0].motion.position,velocity:{q:0,r:1}});
 const before=s.ships[0].appearance.heading;assert.ok(Math.abs(before-60)<1e-9);
 s=applyCommand(s,{type:'edit-ship',shipId:id,name:s.ships[0].name,thrust:s.ships[0].capabilities.thrust,position:s.ships[0].motion.position,velocity:{q:0,r:0}});assert.equal(s.ships[0].appearance.heading,before);
 s=applyCommand(s,{type:'set-appearance',shipId:id,appearance:{side:'A',icon:'scout'}});assert.equal(s.ships[0].appearance.heading,before);
 const old=JSON.parse(JSON.stringify(s));for(const ship of old.ships)delete ship.appearance.heading;assert.equal(createState(old).ships[0].appearance.heading,-90);
 for(const heading of [NaN,Infinity,181,'90'])assert.throws(()=>normalizeAppearance({heading}),/heading/);
});


test('ACS first batch retains source conflicts and conditional profiles without invented loads',()=>{
 const batch=PRESETS.filter(p=>p.id.startsWith('acs2023-'));assert.equal(batch.length,37);
 for(const p of batch){const s=applyCommand(createState(),{type:'add-ship',presetId:p.id,name:p.name,position:{q:0,r:0},velocity:{q:0,r:0}}).ships.at(-1);assert.equal(s.template.source.book,'Adventure Class Ships (2023)');assert.equal(s.condition.fuel,null);assert.equal(s.condition.powerOutput,null);assert.equal(s.condition.weapons,null);assert.equal(iconFor(s),({'acs2023-p6':'stealth-scout','acs2023-p8':'extended-scout','acs2023-p22':'armed-trader','acs2023-p136':'hunting-ship','acs2023-p10':'frontiersman','acs2023-p12':'far-scout','acs2023-p24':'free-smuggler','acs2023-p26':'volitant-far-trader','acs2023-p14':'medical-scout','acs2023-p28':'shadow-trader','acs2023-p30':'merchant-trader','acs2023-p32':'antique-trader','acs2023-p34':'fast-smuggler','acs2023-p58':'fast-luxury-transport','acs2023-p78':'express-packet','acs2023-p80':'jump-cutter','acs2023-p82':'long-range-courier','acs2023-p84':'hospice-boat','acs2023-p86':'prison-ferry','acs2023-p88':'prospector','acs2023-p98':'strike-scout','acs2023-p100':'light-reconnaissance','acs2023-p102':'pirate-carrier','acs2023-p104':'assault-gunship','acs2023-p106':'valour-missile-corvette','acs2023-p116':'executive-yacht','acs2023-p118':'huntress-warrant-ship','acs2023-p120':'custom-safari-ship','acs2023-p122':'desiree-keah-yacht','acs2023-p124':'blockade-runner','acs2023-p126':'touring-ship','acs2023-p134':'stayaow-combat-scout','acs2023-p142':'sceaf-personal-yacht','acs2023-p144':'sleipnir-patroller','acs2023-p150':'rokkghiok-stealth-runner','acs2023-p152':'nguksu-fast-trader','acs2023-p102-unloaded':'pirate-carrier'})[p.id]??'other');}
 assert.equal(preset('acs2023-p116').record.fuelCapacity,null);assert.match(preset('acs2023-p116').notes,/221/);assert.equal(preset('acs2023-p30').hull,80);assert.equal(preset('acs2023-p78').hull,80);
 assert.equal(preset('acs2023-p102').thrust,3);assert.equal(preset('acs2023-p102-unloaded').thrust,4);assert.match(preset('acs2023-p102').name,/fighters carried/);assert.equal(preset('acs2023-p124').thrust,6);assert.match(preset('acs2023-p124').notes,/reaction Thrust 4/);
 assert.equal(iconFor({template:preset('drinax-harrier-restored')}),'harrier');assert.equal(ICONS.harrier.bowDegrees,-90);assert.match(ICONS.harrier.label,/not official.*CC0/);
});


test('Traders and Gunboats retains conditional drives/armour and honest source-conflict unknowns',()=>{
 const rows=PRESETS.filter(p=>p.id.startsWith('tng2024-'));assert.equal(rows.length,33);
 for(const p of rows){const s=applyCommand(createState(),{type:'add-ship',presetId:p.id,name:p.name,position:{q:0,r:0},velocity:{q:0,r:0}}).ships.at(-1);assert.equal(s.template.source.book,'Traders and Gunboats (2024)');assert.equal(s.condition.fuel,null);assert.equal(s.condition.powerOutput,null);assert.equal(s.condition.weapons,null);}
 assert.equal(preset('tng2024-quvar').hull,null);assert.match(preset('tng2024-quvar').notes,/Hull 12/);assert.equal(preset('tng2024-noql').record.crewTotal,null);assert.equal(preset('tng2024-keldyx').armour,6);assert.match(preset('tng2024-keldyx').notes,/parenthetical 10/);assert.equal(preset('tng2024-ifteaa').thrust,2);assert.equal(preset('tng2024-ifteaa').record.fuelCapacity,2.687);assert.match(preset('tng2024-ifteaa').notes,/reaction Thrust 12/);assert.equal(preset('tng2024-blockade-runner').record.cargoCapacity,65);assert.match(preset('tng2024-blockade-runner').notes,/derived/);
});


test('Small Craft source profiles separate operational caps, reaction propulsion and solar backup',()=>{
 const rows=PRESETS.filter(p=>p.id.startsWith('scc2023-'));assert.equal(rows.length,69);
 for(const p of rows){const s=applyCommand(createState(),{type:'add-ship',presetId:p.id,name:p.name,position:{q:0,r:0},velocity:{q:0,r:0}}).ships.at(-1);assert.equal(s.template.source.book,'Small Craft Catalogue (2023)');assert.equal(s.condition.fuel,null);assert.equal(s.condition.powerOutput,null);assert.equal(s.condition.weapons,null);}
 assert.equal(preset('scc2023-p029').thrust,1);assert.match(preset('scc2023-p029').notes,/installed M-drive rating 6/);assert.equal(preset('scc2023-p042').record.ratedPower,30);assert.match(preset('scc2023-p042').notes,/backup 5/);
 const reaction=rows.filter(p=>p.name.endsWith('(reaction-only)'));assert.equal(reaction.length,4);for(const p of reaction){assert.match(p.notes,/no grav drive/);assert.match(p.record.reference,/not a manoeuvre drive/);}assert.equal(preset('scc2023-p046').thrust,3);assert.equal(preset('scc2023-p046').record.sensors,null);assert.equal(preset('scc2023-p053').record.ratedPower,20);assert.equal(preset('scc2023-p075').record.ratedPower,30);
});

test('batch02 source-specific mapping preserves explicit presentation choices',()=>{
 for(const [id,icon] of [["tng2024-ifteaa","ifteaa"],["acs2023-p10","frontiersman"],["acs2023-p12","far-scout"],["acs2023-p24","free-smuggler"],["acs2023-p26","volitant-far-trader"]]){const template=preset(id);assert.equal(iconFor({template}),icon);assert.equal(iconFor({template,appearance:{icon:'scout'}}),'scout');assert.equal(ICONS[icon].bowDegrees,-90);}
});

test('batch03 source-specific mapping preserves explicit presentation choices',()=>{
 for(const [id,icon] of [["acs2023-p14","medical-scout"],["acs2023-p28","shadow-trader"],["acs2023-p30","merchant-trader"],["acs2023-p32","antique-trader"],["acs2023-p34","fast-smuggler"],["acs2023-p58","fast-luxury-transport"],["acs2023-p78","express-packet"],["acs2023-p80","jump-cutter"],["acs2023-p82","long-range-courier"],["acs2023-p84","hospice-boat"]]){const template=preset(id);assert.equal(iconFor({template}),icon);assert.equal(iconFor({template,appearance:{icon:'scout'}}),'scout');assert.equal(ICONS[icon].bowDegrees,-90);}
});


test('batch04 source-specific mapping preserves explicit presentation choices',()=>{
 for(const [id,icon] of [["acs2023-p86","prison-ferry"],["acs2023-p88","prospector"],["acs2023-p98","strike-scout"],["acs2023-p100","light-reconnaissance"],["acs2023-p102","pirate-carrier"],["acs2023-p104","assault-gunship"],["acs2023-p106","valour-missile-corvette"],["acs2023-p116","executive-yacht"],["acs2023-p118","huntress-warrant-ship"],["acs2023-p120","custom-safari-ship"],["acs2023-p122","desiree-keah-yacht"],["acs2023-p124","blockade-runner"],["acs2023-p126","touring-ship"]]){const template=preset(id);assert.equal(iconFor({template}),icon);assert.equal(iconFor({template,appearance:{icon:'scout'}}),'scout');assert.equal(ICONS[icon].bowDegrees,-90);}
});

test('batch05 source-specific mapping preserves explicit presentation choices',()=>{
 for(const [id,icon] of [["acs2023-p134","stayaow-combat-scout"],["acs2023-p142","sceaf-personal-yacht"],["acs2023-p144","sleipnir-patroller"],["acs2023-p150","rokkghiok-stealth-runner"],["acs2023-p152","nguksu-fast-trader"],["scc2023-p015","civilian-hopper"],["scc2023-p016","advertising-boat"],["scc2023-p017","cargo-shuttle"],["scc2023-p018","smugglers-pinnace"],["scc2023-p019","short-shuttle"],["scc2023-p020","fast-shuttle"],["scc2023-p022","trade-shuttle"],["scc2023-p024","extended-passenger-shuttle"]]){const template=preset(id);assert.equal(iconFor({template}),icon);assert.equal(iconFor({template,appearance:{icon:'scout'}}),'scout');assert.equal(ICONS[icon].bowDegrees,-90);}
});
