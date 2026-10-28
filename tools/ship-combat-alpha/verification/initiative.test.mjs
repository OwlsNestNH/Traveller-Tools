import test from 'node:test';import assert from 'node:assert/strict';
import {initiativeProfile,openingInitiative} from '../initiative.mjs';
const ship=crew=>({crew,capabilities:{thrust:2}});
test('simplified experience supplies skill once, not bundled override or characteristic',()=>{const p=initiativeProfile(ship({mode:'quick',rating:'Veteran',ratingVersion:2,bonus:12,overrides:{pilot:10,captain:11}}));assert.equal(p.pilot,3);assert.equal(p.tactics,3);});
test('detailed Pilot excludes characteristic and Captain is not automatically naval Tactics',()=>{const p=initiativeProfile(ship({mode:'detailed',details:{pilot:{skill:2,characteristicDM:3,skillName:'Pilot'},captain:{skill:4,characteristicDM:2,skillName:'Leadership'}}}));assert.equal(p.pilot,2);assert.equal(p.tactics,null);});
test('explicit naval skill supplies its recorded modifiers',()=>{const p=initiativeProfile(ship({mode:'detailed',details:{captain:{skill:2,characteristicDM:1,skillName:'Tactics (naval)'}}}));assert.equal(p.tactics,3);assert.equal(p.pilot,null);});
test('opening initiative uses a separate naval roll and raw Effect including negatives',()=>{const r=openingInitiative({pilot:2,thrust:3,tacticsModifier:1,baseDice:[3,4],tacticsDice:[1,1]});assert.equal(r.tacticsEffect,-5);assert.equal(r.total,7);assert.deepEqual(r.baseDice,[3,4]);});
test('recorded fleet Effect works without a new Tactics roll',()=>{assert.equal(openingInitiative({pilot:1,thrust:2,recordedEffect:4,baseDice:[6,6]}).total,19);});
test('invalid values do not produce results',()=>{for(const v of [{pilot:null},{pilot:1.5},{thrust:10001},{baseDice:[0,6]},{recordedEffect:NaN}])assert.throws(()=>openingInitiative({pilot:1,thrust:2,baseDice:[3,4],...v}));});

import {createState,applyCommand,normalizeState} from '../engine.mjs';
test('new opening totals retain existing state format and legacy round-trip',()=>{let s=createState();const before=structuredClone(s.ships);s=applyCommand(s,{type:'record-initiatives',entries:s.ships.map((ship,i)=>({shipId:ship.id,initiative:i+10,tie:0}))});assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);for(let i=0;i<s.ships.length;i++){assert.deepEqual(s.ships[i].crew,before[i].crew);assert.deepEqual(s.ships[i].motion,before[i].motion);assert.equal(s.ships[i].flight.evasion,before[i].flight.evasion);}});
