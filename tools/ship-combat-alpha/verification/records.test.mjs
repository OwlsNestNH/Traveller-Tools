import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand} from '../engine.mjs';
import {beginSetup,editSetup,saveSetup} from '../setup-session.mjs';
import {crewContribution,effectiveDesign} from '../setup.mjs';
import {remainingPower} from '../ship-record.mjs';
import {beginConsoleDraft,commitConsoleDraft,conditionLimits} from '../console-draft.mjs';
const position={q:1,r:2},velocity={q:0,r:0};
const template={name:'Manual hull',tons:400,thrust:3,hull:100,armour:0,record:{className:'Custom escort',tl:12,ratedPower:150,fuelCapacity:42.5,jump:2,sensors:'Military',computer:'Computer/10',software:'Manoeuvre; Library',requirements:[{name:'Basic systems',power:80},{name:'Sensors',power:null}],weapons:[{id:'turret-1',name:'Dorsal turret',type:'Beam laser',count:2,ammunition:null}]}};
const add=s=>applyCommand(s,{type:'add-ship',name:'A1',template,position,velocity});

test('console previews commit atomically to their original ship and revision only',()=>{
 const s=add(add(createState({ships:[]}))),before=JSON.stringify(s),draft=beginConsoleDraft(s,'ship-1');draft.values.hull='40';draft.values.fuel='12.75';draft.values.powerOutput='90';
 assert.equal(JSON.stringify(s),before);assert.throws(()=>commitConsoleDraft(s,draft,'ship-2'),/Return to the draft ship/);
 const next=commitConsoleDraft(s,draft,'ship-1');assert.equal(next.revision,s.revision+1);assert.deepEqual(next.ships[1],s.ships[1]);assert.deepEqual(next.ships[0].template,s.ships[0].template);assert.equal(next.ships[0].condition.fuel,12.75);
 assert.throws(()=>commitConsoleDraft(applyCommand(s,{type:'advance-round'}),draft,'ship-1'),/State changed/);assert.equal(JSON.stringify(s),before);
});
test('manual usable capacities distinguish damage from quantities without repair, refill or allocation changes',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:60,powerOutput:100,powerUsed:90,fuel:12.25,usableHull:80,usablePower:120,usableFuel:30}});
 assert.deepEqual(conditionLimits(s.ships[0],'fuel'),{rated:42.5,original:42.5,usable:30,scale:42.5,lost:12.5});assert.equal(s.ships[0].template.hull,100);
 const before=JSON.stringify(s);for(const c of [{...s.ships[0].condition,usableFuel:12},{...s.ships[0].condition,usableHull:59},{...s.ships[0].condition,usablePower:99},{...s.ships[0].condition,usableFuel:43}])assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:c}));assert.equal(JSON.stringify(s),before);
 const d=beginConsoleDraft(s,'ship-1');d.values.usableHull='';d.values.usablePower='';d.values.usableFuel='';const n=commitConsoleDraft(s,d,'ship-1');assert.deepEqual([n.ships[0].condition.hull,n.ships[0].condition.powerOutput,n.ships[0].condition.powerUsed,n.ships[0].condition.fuel],[60,100,90,12.25]);assert.equal(conditionLimits(n.ships[0],'hull').usable,100);assert.deepEqual(createState(JSON.parse(JSON.stringify(n))).ships,n.ships);
});
test('unknown capacity remains unknown and empty fuel or used power never implies capacity damage',()=>{
 let s=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Unknown',template:{name:'Unknown',tons:1,thrust:0},position,velocity});assert.equal(conditionLimits(s.ships[0],'fuel').usable,null);
 let d=beginConsoleDraft(s,'ship-1');d.values.fuel='0';d.values.usableFuel='2.5';s=commitConsoleDraft(s,d,'ship-1');assert.equal(conditionLimits(s.ships[0],'fuel').rated,null);assert.equal(conditionLimits(s.ships[0],'fuel').usable,2.5);
 const known=applyCommand(add(createState({ships:[]})),{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:0,powerOutput:150,powerUsed:149}}).ships[0];assert.equal(conditionLimits(known,'fuel').lost,0);assert.equal(conditionLimits(known,'powerOutput').lost,0);assert.equal(conditionLimits(known,'hull').usable,100);
});
test('extended setup distinguishes absent facts, zero values and explicitly empty equipment lists',()=>{
 const s=add(createState({ships:[]})),t=s.ships[0].template;
 assert.equal(t.record.fuelCapacity,42.5);assert.equal(t.armour,0);assert.equal(t.record.weapons[0].count,2);assert.equal(t.record.weapons[0].ammunition,null);assert.equal(t.record.requirements[1].power,null);
 const unknown=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Unknown',template:{name:'Unknown',tons:1,thrust:0},position,velocity}).ships[0];assert.equal(unknown.template.record.weapons,null);assert.equal(unknown.template.record.ratedPower,null);assert.equal(unknown.condition.fuel,null);assert.equal(unknown.condition.criticals,null);
 const none=applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record:{weapons:[],fuelCapacity:0,ratedPower:0,jump:0}}}).ships[0];assert.deepEqual(effectiveDesign(none).record.weapons,[]);assert.equal(effectiveDesign(none).record.ratedPower,0);assert.equal(effectiveDesign(none).record.jump,0);
});
test('manual fuel/power/critical/weapon condition is independent per instance with honest unknowns',()=>{
 let s=add(add(createState({ships:[]})));const other=structuredClone(s.ships[1]),motion=structuredClone(s.ships[0].motion);
 s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:75,fuel:20.25,powerOutput:120,powerUsed:100,criticals:'Fuel leak: manual loss recorded; sensor offline',weapons:[{id:'turret-1',ammunition:0,status:'offline'}]}});
 assert.equal(s.ships[0].condition.fuel,20.25);assert.equal(remainingPower(s.ships[0].condition),20);assert.equal(s.ships[0].template.record.ratedPower,150);assert.deepEqual(s.ships[1],other);assert.deepEqual(s.ships[0].motion,motion);
 const before=JSON.stringify(s);for(const fuel of [-1,42.5001,NaN,Infinity,'2']){assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{fuel}}));assert.equal(JSON.stringify(s),before);}
 assert.equal(remainingPower({powerOutput:null,powerUsed:0}),null);assert.equal(remainingPower({powerOutput:0,powerUsed:0}),0);assert.equal(remainingPower({powerOutput:10,powerUsed:12}),-2);
});
test('invalid optional equipment and duplicate mount IDs reject atomically without invented defaults',()=>{
 const s=add(createState({ships:[]})),before=JSON.stringify(s);
 for(const record of [{fuelCapacity:-1},{ratedPower:NaN},{jump:1.5},{weapons:[{id:'bad',name:'',type:'Laser',count:1}]},{weapons:[template.record.weapons[0],template.record.weapons[0]]},{requirements:[{name:'Drive',power:-1}]}]){assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record}}));assert.equal(JSON.stringify(s),before);}
 assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{weapons:[{id:'turret-1',status:'automatically-fired'}]}}));
});
test('setup draft add/edit/remove never mutates live; Save is atomic, single revision, and stale-safe',()=>{
 const live=createState(),before=JSON.stringify(live);let draft=beginSetup(live);draft=editSetup(draft,{type:'clear-ships'});draft=editSetup(draft,{type:'add-ship',name:'A1',template,position,velocity});draft=editSetup(draft,{type:'set-condition',shipId:'ship-1',condition:{fuel:20}});
 assert.equal(JSON.stringify(live),before); // Cancel means dropping the session; no rollback writes are necessary.
 const saved=saveSetup(live,draft);assert.equal(saved.ships.length,1);assert.equal(saved.ships[0].condition.fuel,20);assert.equal(saved.revision,live.revision+1);assert.equal(saved.round,live.round);assert.equal(JSON.stringify(live),before);
 assert.throws(()=>editSetup(draft,{type:'advance-round'}),/cannot run inside setup/);assert.throws(()=>editSetup(draft,{type:'plot',shipId:'ship-1',target:position}),/cannot run inside setup/);
 const moved=applyCommand(live,{type:'advance-round'});assert.throws(()=>saveSetup(moved,draft),/State changed/);assert.equal(moved.round,1);
 const invalid=structuredClone(draft);invalid.draft.ships[0].condition.fuel=100;assert.throws(()=>saveSetup(live,invalid));assert.equal(JSON.stringify(live),before);
});
test('general crew bonus, explicit role overrides and nameless detailed stations stay separate',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-crew',shipId:'ship-1',crew:{mode:'quick',rating:'Green',bonus:2,overrides:{pilot:3}}});assert.equal(crewContribution(s.ships[0].crew,'pilot'),3);assert.equal(crewContribution(s.ships[0].crew,'sensors'),2);
 s=applyCommand(s,{type:'set-crew',shipId:'ship-1',crew:{...s.ships[0].crew,mode:'detailed',details:{pilot:{name:'',skillName:'Pilot (spacecraft)',skill:1,characteristicDM:2}}}});assert.equal(crewContribution(s.ships[0].crew,'pilot'),3);assert.equal(s.ships[0].crew.details.pilot.name,'');assert.equal(s.ships[0].crew.overrides.pilot,3);assert.equal(s.ships[0].template.record.className,'Custom escort');
});

test('every preset supports instance overrides without replacing published facts or repairing/refilling',()=>{
 let s=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-194',name:'A1',position,velocity});const original=structuredClone(s.ships[0].template);s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:5,powerOutput:10,powerUsed:6}});const condition=structuredClone(s.ships[0].condition);
 s=applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...original,hull:90,thrust:4,record:{...original.record,ratedPower:150,fuelCapacity:10}}});assert.deepEqual(s.ships[0].template,original);assert.equal(effectiveDesign(s.ships[0]).hull,90);assert.equal(effectiveDesign(s.ships[0]).record.ratedPower,150);assert.deepEqual(s.ships[0].condition,condition);assert.equal(s.ships[0].capabilities.thrust,1);
 const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...effectiveDesign(s.ships[0]),record:{...effectiveDesign(s.ships[0]).record,fuelCapacity:4}}}));assert.equal(JSON.stringify(s),before);
 s=applyCommand(s,{type:'set-design',shipId:'ship-1',template:original});assert.equal(s.ships[0].designOverrides,null);assert.deepEqual(s.ships[0].condition,condition);
});
test('manual critical/fuel/cargo/crew/life-support records do not resolve effects on advance',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:10.5,cargo:0,crewAvailable:0,lifeSupport:'Manually checked',criticals:[{system:'Fuel',severity:1,effect:'Manual loss pending',status:'open'}]}});const c=structuredClone(s.ships[0].condition);s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[0].condition,c);assert.equal(c.crewAvailable,0);assert.equal(c.cargo,0);
});
test('Harrier is repaired design, with unknown fuel/ammo condition and no campaign damage applied',()=>{
 const s=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'drinax-harrier-restored',name:'Harrier',position,velocity}),ship=s.ships[0];assert.deepEqual([ship.template.tons,ship.template.hull,ship.template.armour,ship.template.thrust,ship.template.record.ratedPower,ship.template.record.fuelCapacity],[200,88,4,6,260,42]);assert.equal(ship.template.source.page,10);assert.equal(ship.template.source.endPage,11);assert.equal(ship.condition.hull,88);assert.equal(ship.condition.fuel,null);assert.equal(ship.condition.powerOutput,260);assert.equal(ship.condition.weapons,null);assert.equal(ship.condition.criticals,null);assert.equal(ship.template.record.weapons[1].ammunition,null);
});

test('malformed record/override shapes reject before altering live state',()=>{
 const s=add(createState({ships:[]})),before=JSON.stringify(s);for(const record of [[],5,'equipment'])assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record}}));const bad=structuredClone(s);bad.ships[0].designOverrides=[];assert.throws(()=>beginSetup(bad),/overrides must be a record/);assert.equal(JSON.stringify(s),before);
});
