import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue} from '../engine/index.mjs';
const evaluate=(patch={},kind='standard',techLevel=13)=>evaluateDesign(updateDesign(createDesign({kind,techLevel}),patch));
const bio=(physical,genomeOptions='unresolved')=>evaluate({special:{genomeLocomotion:'confirmed',genomeOptions},selections:{locomotion:{primary:'walker'},physical}},'biological');
const code=(r,c)=>r.diagnostics.some(d=>d.code===c);
test('p88 genomic coating prerequisite survives every zero-slot installation route',()=>{
 for(const physical of [
  {options:['reflec']},
  {defaultSuite:['reflec']},
  {optionInstances:[{id:'skin',optionId:'reflec',parameters:{}}]}
 ]){
  const r=bio(physical);assert.notEqual(r.status,'verified');assert.equal(r.totals,null);
  assert.ok(code(r,'BIO_GENOME_OPTIONS'));
 }
});
test('p34 biological vacuum pricing cannot use the mechanical row through any route',()=>{
 for(const physical of [
  {options:['vacuum-environment-protection']},
  {defaultSuite:['vacuum-environment-protection']},
  {optionInstances:[{id:'vac',optionId:'vacuum-environment-protection',parameters:{}}]}
 ]){
  const r=bio(physical,'confirmed');assert.notEqual(r.status,'verified');
  assert.ok(code(r,'BIO_VACUUM_PRICE'));
 }
});
test('p34 biological vacuum protection uses50000credits per Base Slot before body multiplier',()=>{
 const r=bio({optionInstances:[{id:'vac',optionId:'vacuum-environment-protection-biological',parameters:{}}]},'confirmed');
 assert.equal(r.status,'verified');assert.equal(r.totals.constructionCost,2556000);
 assert.equal(r.ledger.find(l=>l.id==='instance-vac').cost,16*50000);
});
test('p88 biological bodies cannot gain Slots by removing nonexistent mechanical power cells',()=>{
 for(const physical of [
  {options:['no-internal-power'],powerMode:'direct-connection'},
  {optionInstances:[{id:'power-credit',optionId:'no-internal-power',parameters:{}}],powerMode:'direct-connection'}
 ]){
  const r=bio(physical,'confirmed');assert.notEqual(r.status,'verified');
  assert.ok(code(r,'BIO_INTERNAL_POWER_CREDIT'));assert.ok(code(r,'BIO_ALTERNATIVE_POWER'));
 }
});
test('p88 ordinary sensors do not require a coating-specific genome declaration',()=>{
 const r=bio({optionInstances:[{id:'microphone',optionId:'auditory',parameters:{quantity:1}}]});
 assert.equal(r.status,'verified');assert.ok(!code(r,'BIO_GENOME_OPTIONS'));
});
test('p45 satellite uplink rejects a default5km radio',()=>{
 const r=evaluate({selections:{physical:{options:['satellite-uplink']}}});
 assert.notEqual(r.status,'verified');assert.ok(code(r,'TRANSCEIVER_RANGE'));
});
test('p45 satellite uplink accepts an actual500km transceiver installed separately',()=>{
 const r=evaluate({selections:{physical:{options:['satellite-uplink'],optionInstances:[{id:'long-radio',optionId:'transceiver-500km-enhanced',parameters:{quantity:1}}]}}});
 assert.equal(r.status,'verified');
});
test('p59 two scientific toolkits retain their independently specified fields and costs',()=>{
 const r=evaluate({selections:{physical:{optionInstances:[
  {id:'biology-lab',optionId:'scientific-toolkit-improved',parameters:{quantity:1,detail:'Biology'}},
  {id:'chemistry-lab',optionId:'scientific-toolkit-improved',parameters:{quantity:1,detail:'Chemistry'}}
 ]}}});
 assert.equal(r.status,'verified');
 assert.deepEqual(r.totals.toolCaps.map(t=>[t.id,t.detail]),[['biology-lab','Biology'],['chemistry-lab','Chemistry']]);
 assert.equal(r.ledger.filter(l=>l.id.startsWith('instance-')).reduce((n,l)=>n+l.cost,0),8000);
 assert.equal(r.ledger.filter(l=>l.id.startsWith('instance-')).reduce((n,l)=>n+l.slots,0),6);
});


 // pp80-81: microbots have no actual Slots and no ordinary default suite.
for(const optionId of ['satellite-uplink','medical-chamber','weapon-mount-small','rtg-long-duration-basic','vacuum-environment-protection-biological']){
 test('p80 microbot rejects non-micro hardware '+optionId+' through editor and imported records',()=>{
  const d=createDesign({kind:'microbot',techLevel:14});
  assert.throws(()=>updateDesign(d,{special:{options:[optionId]}}),TypeError);
  d.special.options=[optionId];const r=evaluateDesign(d);
  assert.notEqual(r.status,'verified');assert.equal(r.totals,null);
 });
}
for(const [options,diagnostic] of [
 [['drone-interface'],'OPTION_DEPENDENCY'],
 [['visual-camouflage-basic','solar-coating-basic'],'OPTION_INCOMPATIBLE'],
 [['full-surface-video-screen-basic','full-surface-video-screen-improved'],'OPTION_EXCLUSIVE']
]){
 test('p80 microbot preserves ordinary option prerequisite '+diagnostic,()=>{
  const r=evaluate({special:{options}},'microbot',14);
  assert.notEqual(r.status,'verified');assert.equal(r.totals,null);assert.ok(code(r,diagnostic));
 });
}
test('pp98-99 clone learned skills never buy broad robot software bundles',()=>{
 const d=createDesign({kind:'clone',techLevel:13});
 const choices=getCatalogue(d).stages.flatMap(s=>s.controls).find(c=>c.field==='trainingSkills').choices;
 assert.ok(!choices.some(p=>p.speciality?.startsWith('all')));
 for(const id of ['science-all-referee-four-1','science-all-referee-four-4','electronics-all-listed-1','electronics-all-listed-4']){
  assert.throws(()=>updateDesign(d,{special:{growth:'accelerated',trainingSkills:[id]}}),TypeError);
  const imported=structuredClone(d);imported.special.growth='accelerated';imported.special.trainingSkills=[id];
  const r=evaluateDesign(imported);assert.notEqual(r.status,'verified');assert.equal(r.totals,null);
 }
});
test('pp98-99 clone can still buy one named learned speciality for two initial points',()=>{
 const r=evaluate({special:{growth:'accelerated',trainingSkills:['science-biology-1']}},'clone',13);
 assert.equal(r.status,'verified');assert.equal(r.totals.clone.unspentTrainingPoints,2);
 assert.equal(r.totals.skills.length,1);assert.equal(r.totals.skills[0].speciality,'biology');
});
