import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand} from '../engine.mjs';
import {beginSetup,editSetup,saveSetup} from '../setup-session.mjs';
import {crewContribution} from '../setup.mjs';
import {remainingPower} from '../ship-record.mjs';
const position={q:1,r:2},velocity={q:0,r:0};
const template={name:'Manual hull',tons:400,thrust:3,hull:100,armour:0,record:{className:'Custom escort',tl:12,ratedPower:150,fuelCapacity:42.5,jump:2,sensors:'Military',computer:'Computer/10',software:'Manoeuvre; Library',requirements:[{name:'Basic systems',power:80},{name:'Sensors',power:null}],weapons:[{id:'turret-1',name:'Dorsal turret',type:'Beam laser',count:2,ammunition:null}]}};
const add=s=>applyCommand(s,{type:'add-ship',name:'A1',template,position,velocity});
test('extended setup distinguishes absent facts, zero values and explicitly empty equipment lists',()=>{
 const s=add(createState({ships:[]})),t=s.ships[0].template;
 assert.equal(t.record.fuelCapacity,42.5);assert.equal(t.armour,0);assert.equal(t.record.weapons[0].count,2);assert.equal(t.record.weapons[0].ammunition,null);assert.equal(t.record.requirements[1].power,null);
 const unknown=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Unknown',template:{name:'Unknown',tons:1,thrust:0},position,velocity}).ships[0];assert.equal(unknown.template.record.weapons,null);assert.equal(unknown.template.record.ratedPower,null);assert.equal(unknown.condition.fuel,null);assert.equal(unknown.condition.criticals,null);
 const none=applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record:{weapons:[],fuelCapacity:0,ratedPower:0,jump:0}}}).ships[0];assert.deepEqual(none.template.record.weapons,[]);assert.equal(none.template.record.ratedPower,0);assert.equal(none.template.record.jump,0);
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
