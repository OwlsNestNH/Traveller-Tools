import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCrew} from '../setup.mjs';
import {pilotCheckProfile,resolvePilotCheck,rollPilotDice,PILOT_DIFFICULTIES} from '../pilot-check.mjs';
test('simple crew bonus supplies level without inventing a characteristic',()=>{
 const ship={crew:normalizeCrew({rating:'Veteran',ratingVersion:2}),situational:{pilot:-1}},before=structuredClone(ship),p=pilotCheckProfile(ship);
 assert.deepEqual(p,{name:'',level:3,other:null,situational:-1,total:2,detailed:false});assert.deepEqual(ship,before);
 assert.equal(pilotCheckProfile({crew:{rating:'Veteran'}}).level,2,'legacy Veteran keeps its saved bonus');
 assert.equal(pilotCheckProfile({crew:{bonus:4,overrides:{pilot:2}}}).level,2);
});
test('unnamed detailed skill zero remains distinct from Other and total',()=>{
 const crew={mode:'compact',activeDetails:['pilot'],details:{pilot:{name:'',skillName:'Pilot',skill:0,characteristicDM:2}}};
 assert.deepEqual(pilotCheckProfile({crew,situational:{pilot:-1}}),{name:'',level:0,other:2,situational:-1,total:1,detailed:true});
 crew.activeDetails=[];assert.equal(pilotCheckProfile({crew}).level,1);assert.equal(pilotCheckProfile({crew}).other,null);
 assert.equal(pilotCheckProfile({crew:{mode:'detailed'}}).total,null);
});
test('all offered difficulties resolve 2D plus recorded modifier and Effect',()=>{
 for(const difficulty of PILOT_DIFFICULTIES){const p={total:3};assert.deepEqual(resolvePilotCheck(p,difficulty,[2,5]),{dice:[2,5],modifier:3,difficulty,total:10,effect:10-difficulty});}
 assert.equal(resolvePilotCheck({total:-3},8,[1,1]).effect,-9);
 assert.throws(()=>resolvePilotCheck({total:null},8,[3,4]));assert.throws(()=>resolvePilotCheck({total:1},9,[3,4]));assert.throws(()=>resolvePilotCheck({total:1},8,[0,7]));
});
test('dice range endpoints and invalid sources',()=>{const values=[0,.999999];assert.deepEqual(rollPilotDice(()=>values.shift()),[1,6]);for(const value of [-1,1,NaN])assert.throws(()=>rollPilotDice(()=>value));});
