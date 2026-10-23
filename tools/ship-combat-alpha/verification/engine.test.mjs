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

// Setup additions exercise independent instances, exact source variants and atomic errors.
import {PRESETS,preset} from '../catalogue.mjs';
import {crewContribution,MAX_SHIPS,ROLES} from '../setup.mjs';
const addPreset=(s,id='core-194',name='Added trader')=>applyCommand(s,{type:'add-ship',presetId:id,name,position:{q:2,r:1},velocity:{q:0,r:0}});
test('catalogue keeps <=400-ton source variants and printed citations without inferred armour',()=>{
 assert.equal(PRESETS.length,93);assert.equal(new Set(PRESETS.map(p=>p.id)).size,93);
 for(const p of PRESETS){assert.ok(p.tons>0&&p.tons<=400);assert.ok(p.source.page>0);assert.ok(p.source.book.endsWith('Update 2022')||p.source.book==='Adventure Class Ships (2023)'||p.id==='drinax-harrier-restored');assert.equal(preset(p.id).thrust,p.thrust);}
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
 const fast=state(vessel('fast',0,{q:1,r:1},{q:1,r:0})),before=JSON.stringify(fast);assert.throws(()=>applyCommand(fast,{type:'brake',shipId:'fast'}),/Stopping needs 1 thrust; 0 available/);assert.equal(JSON.stringify(fast),before);assert.equal(applyCommand(fast,{type:'advance-round'}).ships[0].motion.position.q,2);
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
 for(const appearance of [{side:'D'},{icon:'../../private'},{icon:'__proto__'}])assert.throws(()=>applyCommand(s,{type:'set-appearance',shipId:id,appearance}),/Choose Side/);
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

test('all 92 source identities explicitly map matching available hulls or honest missing-variant fallbacks',()=>{
 assert.equal(Object.keys(PRESET_ICONS).length,92);
 for(const p of PRESETS)assert.ok(Object.hasOwn(PRESET_ICONS,p.source.book+'/'+p.source.page),p.id);
 for(const [id,icon,file] of [
 ['core-202','yacht','yacht.webp'],['highguard-179','yacht','yacht.webp'],['core-220','launch','launch.webp'],['highguard-139','launch','launch.webp'],['core-204','close-escort','close_escort.webp'],['highguard-181','close-escort','close_escort.webp'],['core-196','far-trader','far_trader.webp'],['highguard-169','far-trader','far_trader.webp'],['highguard-138','military-gig','military_gig.webp'],['core-219','gig','gig.webp'],['core-192','seeker','seeker.webp'],['core-210','subsidised-merchant','subsidised_merchant.webp'],['highguard-191','survey-scout','survey_scout.webp'],['core-227','passenger-shuttle','passenger_shuttle.webp']]){assert.equal(iconFor({template:preset(id)}),icon,id);assert.equal(ICONS[icon].file,file);}
 for(const id of ['highguard-136','highguard-148','highguard-150','highguard-152','highguard-158','highguard-165','highguard-177','highguard-183','highguard-193'])assert.equal(iconFor({template:preset(id)}),'other',id+' must not borrow a different variant');
 assert.equal(Object.values(ICONS).filter(x=>x.file).length,24);
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
 for(const p of batch){const s=applyCommand(createState(),{type:'add-ship',presetId:p.id,name:p.name,position:{q:0,r:0},velocity:{q:0,r:0}}).ships.at(-1);assert.equal(s.template.source.book,'Adventure Class Ships (2023)');assert.equal(s.condition.fuel,null);assert.equal(s.condition.powerOutput,null);assert.equal(s.condition.weapons,null);assert.equal(iconFor(s),'other');}
 assert.equal(preset('acs2023-p116').record.fuelCapacity,null);assert.match(preset('acs2023-p116').notes,/221/);assert.equal(preset('acs2023-p30').hull,80);assert.equal(preset('acs2023-p78').hull,80);
 assert.equal(preset('acs2023-p102').thrust,3);assert.equal(preset('acs2023-p102-unloaded').thrust,4);assert.match(preset('acs2023-p102').name,/fighters carried/);assert.equal(preset('acs2023-p124').thrust,6);assert.match(preset('acs2023-p124').notes,/reaction Thrust 4/);
 assert.equal(iconFor({template:preset('drinax-harrier-restored')}),'harrier');assert.equal(ICONS.harrier.bowDegrees,-90);assert.match(ICONS.harrier.label,/not official.*CC0/);
});
