import test from 'node:test';
import assert from 'node:assert/strict';
import {talentAcquisition,psionicPotential,psionicTalentOptions} from '../engine/psionics.mjs';
test('Core p228 potential subtracts completed career terms and cannot confer negative potential',()=>{
 assert.deepEqual(psionicPotential({roll:8,careerTerms:3}),{source:{id:'core',page:228},natural:8,careerTerms:3,psi:5});
 assert.equal(psionicPotential({roll:2,careerTerms:5}).psi,0);
 assert.throws(()=>psionicPotential({roll:13}),/roll/);
});
for(const [talent,dm]of[['Telepathy',4],['Clairvoyance',3],['Telekinesis',2],['Awareness',1],['Teleportation',0],['Technopathy',0]])test(talent+' exact learning DM and level0 acquisition',()=>{
 const r=talentAcquisition({talent,psi:9,previousChecks:2,firstTalentChosen:true,roll:8,species:'zhodani'});
 assert.equal(r.learningDM,dm);assert.equal(r.psiDM,1);assert.equal(r.total,7+dm);assert.equal(r.level,0);assert.equal(r.checksAdded,1);assert.equal(r.success,r.total>=8);
});
test('Core p228 automatic first Telepathy does not increment previous CHECK count (literal table wording)',()=>{
 const r=talentAcquisition({talent:'Telepathy',psi:1});assert.equal(r.automatic,true);assert.equal(r.success,true);assert.equal(r.checksAdded,0);assert.equal(r.natural,null);
 assert.throws(()=>talentAcquisition({talent:'Telepathy',psi:8,roll:12}),/does not roll/);
});
test('Telepathy after any prior talent choice requires a check even when previous checks is zero',()=>{
 const r=talentAcquisition({talent:'Telepathy',psi:8,firstTalentChosen:true,roll:3});assert.equal(r.automatic,false);assert.equal(r.success,false);
});
test('zero PSI, contradictory history and non-Zhodani Technopathy are rejected',()=>{
 assert.throws(()=>talentAcquisition({talent:'Telepathy',psi:0}),/Positive/);
 assert.throws(()=>talentAcquisition({talent:'Telepathy',psi:8,previousChecks:1}),/contradict/);
 assert.throws(()=>talentAcquisition({talent:'Technopathy',psi:8,roll:12}),/Unsupported/);
});
test('initial options exclude prior failures and acquired talents, retry allows only named award',()=>{
 assert.equal(psionicTalentOptions({}).length,5);assert.equal(psionicTalentOptions({species:'zhodani'}).length,6);
 assert.deepEqual(psionicTalentOptions({acquired:['Telepathy'],attempted:['Awareness','Clairvoyance']}).map(o=>o.talent),['Telekinesis','Teleportation']);
 assert.deepEqual(psionicTalentOptions({attempted:['Awareness'],talent:'Awareness'}).map(o=>o.talent),['Awareness']);
});
