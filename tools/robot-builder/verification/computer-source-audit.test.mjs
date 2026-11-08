import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {evaluateComputer} from '../engine/computer-implants.mjs';

// Core Update 2022 pp 110-113, checked against positioned original PDF tables.
// Robot Handbook p 92 controls implant fit and hardware price; pp 93-94 percentage basis is explicit.
const program=(family,rating,active=-1,extra={})=>({id:family,parentComputer:'computer',program:family,rating,runningBandwidth:active,subject:'',databasePrice:10,expertUse:'assisted',...extra});
const design=(model=14,parameters={},programs=[],tl=14,extra=[])=>updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'computer',optionId:'misc-mass-portable-computer-'+model,parameters},...extra],computerSoftware:programs}});
const run=(...args)=>evaluateDesign(design(...args));
const profile=r=>r.totals.augmentations[0].generalComputer;
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const softwareRows=[
 ['interface',0,7,0],['intelligent-interface',1,11,100],
 ['security',0,8,0],['security',1,10,200],['security',2,11,1000],['security',3,12,20000],
 ['intrusion',1,10,1000],['intrusion',2,11,10000],['intrusion',3,13,100000],['intrusion',4,15,1000000],
 ['expert',1,11,1000],['expert',2,12,10000],['expert',3,13,100000],
 ['translator',0,9,50],['translator',1,10,500],
 ['agent',0,11,500],['agent',1,12,2000],['agent',2,13,100000],['agent',3,14,250000],
 ['intellect',1,12,2000],['intellect',2,13,50000],['intellect',3,14,200000]
];
test('All 22 finite printed program rows retain their own TL and licence prices',()=>{
 for(const [family,rating,tl,cost]of softwareRows){
  const r=run(14,{},[program(family,rating,-1,{subject:['expert','translator'].includes(family)?'Medic':' '})]);
  assert.equal(r.status,'verified',family+'/'+rating);
  const p=profile(r).programs[0];
  assert.equal(p.minimumTL,tl);assert.equal(p.cost,cost);
  assert.equal(profile(r).softwareBaseCost,cost);assert.equal(r.totals.cost,25000+cost);
  assert.equal(p.active,false);assert.equal(profile(r).activeBandwidth,0);assert.deepEqual(r.totals.skills,[]);
 }
});
test('The printed Translator 1 and Security 2 example uses exactly Computer 3',()=>{
 const r=run(12,{},[program('translator',1,1,{subject:'Vilani'}),program('security',2,2)],12);
 assert.equal(r.status,'verified');assert.equal(profile(r).activeBandwidth,3);assert.equal(profile(r).remainingProcessing,0);
 assert.equal(r.totals.cost,14500);assert.ok(!has(r,'COMPUTER_EXPERT_INTERFACE'));
});
test('Adding Intelligent Interface to the full printed example exceeds Processing',()=>{
 const r=run(12,{},[program('translator',1,1,{subject:'Vilani'}),program('security',2,2),program('intelligent-interface',1,1)],12);
 assert.equal(r.status,'invalid');assert.ok(has(r,'COMPUTER_PROCESSING'));
});
test('Software can be stored above computer TL but downrating execution does not erase its purchased TL',()=>{
 const stored=run(14,{},[program('intrusion',4)]);assert.equal(stored.status,'verified');
 const active=run(14,{},[program('intrusion',4,1)]);assert.ok(has(active,'COMPUTER_PROGRAM_TL'));
 const higher=run(14,{computerRatedTL:15},[program('intrusion',4,1)],15);
 assert.equal(higher.status,'verified');assert.equal(profile(higher).activeBandwidth,1);assert.equal(profile(higher).programs[0].cost,1000000);
});
test('Minimum software ratings remain family-specific rather than allowing zero-Bandwidth Expert',()=>{
 assert.throws(()=>design(14,{},[program('expert',1,0,{subject:'Medic'})]));
 assert.throws(()=>design(14,{},[program('intellect',1,0)]));
 const r=run(14,{},[program('agent',3,0)]);assert.equal(r.status,'verified');
 assert.equal(profile(r).programs[0].effects.electronicsComputers,0);
});
test('Computer 0 cannot execute both free included programs at once',()=>{
 const p={computerVariant:'retrotech',computerRatedTL:8};
 const two=run(7,p,[program('interface',0,0),program('security',0,0)]);
 assert.ok(has(two,'COMPUTER_ZERO_PROCESSING'));
 const one=run(7,p,[program('interface',0,0),program('security',0)]);
 assert.equal(one.status,'verified');assert.equal(profile(one).programs.filter(p=>p.active).length,1);
});
test('Assisted Expert requires the active interface and reports conditional INT or EDU assistance only',()=>{
 const records=[program('expert',3,3,{subject:'Medic'}),program('intelligent-interface',1)];
 assert.ok(has(run(14,{},records),'COMPUTER_EXPERT_INTERFACE'));
 records[1].runningBandwidth=1;const r=run(14,{},records),e=profile(r).programs[0].effects;
 assert.equal(r.status,'verified');assert.deepEqual(e.characteristics,['INT','EDU']);assert.equal(e.effectiveSkill,2);
 assert.equal(e.alreadySkilledDM,1);assert.equal(e.listedMaximumTaskTarget,14);assert.deepEqual(r.totals.skills,[]);
});
test('The printed autonomous Medic 2 example uses Intellect 1 and Expert Medic 3 without another interface',()=>{
 const r=run(13,{},[program('intellect',1,1),program('expert',3,3,{subject:'Medic',expertUse:'autonomous'})],13);
 assert.equal(r.status,'verified');assert.equal(profile(r).activeBandwidth,4);assert.equal(r.totals.cost,116500);
 assert.equal(profile(r).recipientSkillsGranted,false);assert.deepEqual(r.totals.skills,[]);
});
test('Intellect 1 cannot supply two simultaneous autonomous Expert skills even if memory fits',()=>{
 const records=[program('intellect',1,1),program('expert',1,1,{id:'medic',subject:'Medic',expertUse:'autonomous'}),program('expert',1,1,{id:'engineer',subject:'Engineer',expertUse:'autonomous'})];
 assert.ok(has(run(14,{},records),'COMPUTER_INTELLECT_TASKS'));
 records[2].runningBandwidth=-1;assert.equal(run(14,{},records).status,'verified');
});
test('Stored Intellect cannot satisfy an active autonomous Expert dependency',()=>{
 assert.ok(has(run(14,{},[program('intellect',1),program('expert',1,1,{subject:'Medic',expertUse:'autonomous'})]),'COMPUTER_EXPERT_INTELLECT'));
});
test('Agent is self-contained and does not add invented separate Expert or Intellect charges',()=>{
 const r=run(14,{},[program('agent',3,3)]);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,275000);assert.equal(profile(r).activeBandwidth,3);
 assert.equal(profile(r).programs[0].effects.electronicsComputers,3);assert.deepEqual(r.totals.skills,[]);
});
test('Specialisation costs 25 percent per point and cannot be borrowed by unrelated programs',()=>{
 const params={computerRatedTL:14,computerSpecialisation:2,computerSpeciality:'Medic'};
 const records=[program('expert',3,3,{subject:'Medic'}),program('intelligent-interface',1,1)];
 const r=run(10,params,records);assert.equal(r.status,'verified');assert.equal(profile(r).hardwareCost,750);
 assert.equal(profile(r).dedicatedCredit,2);assert.equal(r.totals.cost,112350);
 const wrong=run(10,{...params,computerSpeciality:'Navigation'},records);assert.ok(has(wrong,'COMPUTER_PROCESSING'));
});
test('Retrotech uses the selected printed model rather than replacing it with a cheaper equal-Processing row',()=>{
 const a=run(10,{computerVariant:'retrotech',computerRatedTL:12});
 const b=run(11,{computerVariant:'retrotech',computerRatedTL:12});
 assert.equal(profile(a).hardwareCost,125);assert.equal(profile(b).hardwareCost,75);
 assert.equal(profile(a).massKg,.125);assert.equal(profile(b).massKg,.125);
 assert.equal(profile(a).ratedTL,12);assert.equal(profile(b).ratedTL,12);
});
test('Retrotech can bring the five-kilogram model into the two-kilogram implant limit',()=>{
 const r=run(7,{computerVariant:'retrotech',interfaceTier:'basic'},[],9);
 assert.equal(r.status,'verified');assert.equal(profile(r).hardwareCost,125);assert.equal(profile(r).massKg,1.25);
 assert.equal(r.totals.cost,20375);assert.equal(profile(r).processing,0);assert.equal(profile(r).ratedTL,7);
});
test('One-TL and two-TL prototypes preserve rated TL while multiplying mass and price',()=>{
 for(const [variant,tl,factor]of [['prototype-one',9,10],['prototype-two',8,100]]){
  const r=run(10,{computerVariant:variant,interfaceTier:'basic'},[],tl);
  const c=evaluateComputer({tl:10,cost:500,massKg:.5,effects:{processing:2,includedSoftware:[]}}, {computerVariant:variant}, [], tl).profile;
  assert.equal(c.ratedTL,10);assert.equal(c.processing,2);assert.equal(c.hardwareCost,500*factor);assert.equal(c.massKg,.5*factor);
  assert.ok(has(r,'MISC_IMPLANT_MASS'));assert.ok(!has(r,'AUGMENT_TL'));assert.ok(!has(r,'COMPUTER_RATED_TL'));
 }
});
test('Prototype and retrotech selection cannot invent a computer TL outside source bounds',()=>{
 assert.ok(has(run(10,{computerVariant:'prototype-two',computerRatedTL:9},[],8),'COMPUTER_PROTOTYPE_RATING'));
 assert.ok(has(run(10,{computerVariant:'prototype-two'},[],7),'COMPUTER_PROTOTYPE_TL'));
 assert.ok(has(run(10,{computerVariant:'retrotech',computerRatedTL:9}),'COMPUTER_RATED_TL'));
 assert.ok(has(run(10,{computerRatedTL:15},[],14),'COMPUTER_RATED_TL'));
});
test('Stored software is priced per identical device and does not disappear into hardware quantities',()=>{
 const r=run(14,{quantity:2},[program('intellect',1)]);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,54000);assert.equal(r.totals.augmentations[0].softwareCost,4000);
 assert.equal(r.ledger.reduce((n,e)=>n+e.cost,0),54000);
});
test('Separate computers do not pool their Processing or satisfy another device interface dependency',()=>{
 const second={id:'second',optionId:'misc-mass-portable-computer-14',parameters:{}};
 const full=run(12,{},[program('security',3,3),program('intellect',1,1)],14,[second]);
 assert.ok(has(full,'COMPUTER_PROCESSING'));
 const records=[program('expert',1,1,{subject:'Medic'}),program('intelligent-interface',1,1,{parentComputer:'second'})];
 assert.ok(has(run(14,{},records,14,[second]),'COMPUTER_EXPERT_INTERFACE'));
});
test('Software price interpretation and cybernetic percentage interpretation have separate ledgers',()=>{
 const records=[program('intellect',1)];
 const normal=run(14,{},records),triple=run(14,{computerSoftwarePrice:'device-inclusive'},records);
 assert.equal(normal.totals.cost,27000);assert.equal(triple.totals.cost,31000);
 const unknown=run(14,{naturalLooking:'tl10'},records);assert.equal(unknown.status,'blocked');
 const all=run(14,{naturalLooking:'tl10',softwareModifierBasis:'include-all-fixed-costs'},records);
 const physical=run(14,{naturalLooking:'tl10',softwareModifierBasis:'physical-only'},records);
 assert.equal(all.totals.cost,33750);assert.equal(physical.totals.cost,33250);
 assert.equal(all.totals.augmentations[0].softwareModifierBasis.interpretation,'include-all-fixed-costs');
});
test('Database acquisition retains its source price range without inventing numeric execution Bandwidth',()=>{
 for(const price of [10,10000]){
  const r=run(14,{},[program('database',0,-1,{subject:'Local geography',databasePrice:price})]);
  assert.equal(r.status,'verified');assert.equal(profile(r).softwareBaseCost,price);
 }
 assert.throws(()=>design(14,{},[program('database',0,-1,{subject:'Local geography',databasePrice:10001})]));
 const active=run(14,{},[program('database',0,0,{subject:'Local geography'})]);assert.ok(has(active,'COMPUTER_DATABASE_EXECUTION'));
});
test('A terminal retains its network dependency while its local Computer 0 still obeys execution limits',()=>{
 const d=updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'computer',optionId:'misc-mass-computer-terminal-7',parameters:{computerRatedTL:8}}],computerSoftware:[program('interface',0,0),program('security',0,0)]}});
 const r=evaluateDesign(d);assert.ok(has(r,'COMPUTER_ZERO_PROCESSING'));
 const valid=updateDesign(d,{special:{computerSoftware:[program('interface',0,0)]}});
 const p=evaluateDesign(valid).totals.augmentations[0];assert.equal(p.capabilities[0].networkRequired,true);assert.equal(p.capabilities[0].independentProcessing,false);
});

const neural=(optionId,parameters={},records=[],tl=15,extra=[])=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'computer',optionId,parameters},...extra],computerSoftware:records}}));
test('Each bundled neural computer keeps its printed package price and Processing',()=>{
 for(const [id,processing,price,minTL] of [['neural-comm-improved',0,5000,12],['neural-comm-advanced',1,20000,14],['neural-link-basic',0,30000,13],['neural-link-improved',1,45000,14]]){
  const r=neural(id,{},[program('interface',0,0)],minTL),p=r.totals.augmentations[0],c=p.generalComputer;
  assert.equal(r.status,'verified');assert.equal(r.totals.cost,price);assert.equal(c.processing,processing);assert.equal(c.ratedTL,minTL);
  assert.equal(c.hardwareCostIncludedInImplant,true);assert.equal(c.additionalHardwareCost,0);assert.equal(c.massKg,null);
  assert.equal(p.miscDevice,undefined);assert.equal(p.interfaceCost,0);assert.deepEqual(r.totals.skills,[]);
 }
});
test('Bundled Computer 0 remains limited to one active zero-Bandwidth program',()=>{
 for(const id of ['neural-comm-improved','neural-link-basic']){
  const r=neural(id,{},[program('interface',0,0),program('security',0,0)]);
  assert.ok(has(r,'COMPUTER_ZERO_PROCESSING'));assert.equal(r.status,'invalid');
 }
});
test('Advanced neural comm and improved neural link upgrade to Computer 2 for exactly Cr 10000 at TL 15',()=>{
 for(const [id,base]of [['neural-comm-advanced',20000],['neural-link-improved',45000]]){
  const r=neural(id,{computerUpgrade:'yes'});assert.equal(r.status,'verified');
  assert.equal(r.totals.cost,base+10000);assert.equal(profile(r).processing,2);assert.equal(profile(r).ratedTL,15);
  assert.ok(has(neural(id,{computerUpgrade:'yes'},[],14),'NEURAL_COMPUTER_UPGRADE'));
 }
});
test('A basic neural comm is not a hidden zero-cost general computer',()=>{
 assert.throws(()=>neural('neural-comm-basic',{},[program('interface',0,0)]));
 const r=neural('neural-comm-basic');assert.equal(r.status,'verified');assert.equal(r.totals.augmentations[0].generalComputer,undefined);
});
test('Neural computer software is priced once and obeys the same source dependencies',()=>{
 const records=[program('expert',1,1,{subject:'Athletics'}),program('intelligent-interface',1,1)];
 const link=neural('neural-link-improved',{computerUpgrade:'yes'},records);
 assert.equal(link.status,'verified');assert.equal(link.totals.cost,56100);
 assert.equal(link.ledger.reduce((n,e)=>n+e.cost,0),56100);assert.equal(profile(link).softwareBaseCost,1100);
 assert.equal(profile(link).programs[0].effects.physicalAssistance,true);assert.deepEqual(link.totals.skills,[]);
 const comm=neural('neural-comm-advanced',{computerUpgrade:'yes'},records);
 assert.equal(comm.status,'verified');assert.equal(comm.totals.cost,31100);
 assert.equal(profile(comm).programs[0].effects.physicalAssistance,false);
 assert.deepEqual(profile(comm).programs[0].effects.characteristics,['INT','EDU']);
 assert.ok(has(neural('neural-link-improved',{},records),'COMPUTER_PROCESSING'));
 assert.ok(has(neural('neural-link-improved',{computerUpgrade:'yes'},[records[0]]),'COMPUTER_EXPERT_INTERFACE'));
});
test('Bundled hardware is not tripled, specialised or discounted as a miscellaneous computer',()=>{
 for(const parameters of [{computerVariant:'retrotech'},{computerSpecialisation:2,computerSpeciality:'Medic'},{computerSoftwarePrice:'device-inclusive'}]){
  assert.throws(()=>neural('neural-link-improved',parameters));
 }
 const r=neural('neural-link-improved',{computerRatedTL:16},[program('intrusion',4,1)],16);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,1045000);assert.equal(profile(r).ratedTL,16);
});
test('Bundled neural computer does not consume a fourth miscellaneous-device allowance',()=>{
 const devices=[1,2,3].map(n=>({id:'sensor-'+n,optionId:'misc-mass-em-probe',parameters:{interfaceMode:'neural'}}));
 const r=neural('neural-link-improved',{},[],15,devices);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,54000);assert.ok(!has(r,'MISC_IMPLANT_COUNT'));
});
test('Bundled neural software preserves the explicit cybernetic percentage interpretation',()=>{
 const records=[program('agent',1,1)];
 assert.equal(neural('neural-comm-advanced',{naturalLooking:'tl10'},records).status,'blocked');
 const all=neural('neural-comm-advanced',{naturalLooking:'tl10',softwareModifierBasis:'include-all-fixed-costs'},records);
 const hardware=neural('neural-comm-advanced',{naturalLooking:'tl10',softwareModifierBasis:'physical-only'},records);
 assert.equal(all.totals.cost,27500);assert.equal(hardware.totals.cost,27000);
});
test('Security and Translator conditions follow active, not purchased, program rating',()=>{
 const r=run(14,{},[program('security',3,1),program('translator',1,0,{subject:'Vilani'})]);
 const [security,translator]=profile(r).programs;
 assert.equal(r.status,'verified');assert.equal(security.effects.intrusionDifficulty,10);
 assert.equal(translator.effects.translation,'near-real-time');assert.equal(translator.effects.improvedNuance,false);
 assert.match(security.effects.condition,/active/);assert.match(translator.effects.condition,/active/);
});

test('A miscellaneous computer needs an explicit installed neural-link route for physical Expert assistance',()=>{
 const records=[program('expert',1,1,{subject:'Athletics'}),program('intelligent-interface',1,1)];
 const link={id:'link',optionId:'neural-link-basic',parameters:{}};
 const linked=run(14,{interfaceMode:'neural'},records,14,[link]);
 assert.equal(linked.status,'verified');assert.equal(linked.totals.cost,46100);
 assert.equal(profile(linked).programs[0].effects.physicalAssistance,true);assert.deepEqual(linked.totals.skills,[]);
 assert.ok(has(run(14,{interfaceMode:'neural'},records),'MISC_IMPLANT_NEURAL_LINK'));
 const unlinked=run(14,{},records,14,[link]);
 assert.equal(unlinked.status,'verified');assert.equal(profile(unlinked).programs[0].effects.physicalAssistance,false);
});
