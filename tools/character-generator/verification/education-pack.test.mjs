import test from 'node:test';
import assert from 'node:assert/strict';
import {
 EDUCATION_PACK_VERSION,EDUCATION_PACK,PRECAREER_EVENTS,UNIVERSITY_SKILL_CHOICES,
 EDUCATION_EFFECT_SCHEMA,educationEntryCheck,educationGraduationCheck,
 educationCareerBenefits,educationEventFour
} from '../engine/education-pack.mjs';
const ids=['core.university','core.academy-army','core.academy-marine','core.academy-navy'];
const standard={STR:7,DEX:7,END:7,INT:7,EDU:7,SOC:7};
const graduate=(id,honours=false)=>educationGraduationCheck({id,stats:standard,roll:honours?11:7});
function visit(value,fn) {
 if(Array.isArray(value)) return value.forEach(v=>visit(v,fn));
 if(value&&typeof value==='object') {fn(value);Object.values(value).forEach(v=>visit(v,fn));}
}
test('education catalogue contains four Core options with source and term limits',()=>{
 assert.equal(EDUCATION_PACK_VERSION,1);
 assert.deepEqual(Object.keys(EDUCATION_PACK),ids);
 for(const id of ids) {
  const p=EDUCATION_PACK[id];
  assert.equal(p.id,id);assert.equal(p.source.page,16);
  assert.equal(p.source.title,'Core Rulebook Update 2022');
  assert.deepEqual([p.termRules.firstTerm,p.termRules.lastTerm,p.termRules.years],[1,3,4]);
  assert.equal(p.termRules.entryAttemptsPerTerm,1);
  assert.equal(p.termRules.entryFailure.consumesTerm,false);
  assert.equal(p.termRules.successfulEntry.keepInitialAwardsOnFailure,true);
  assert.equal(p.termRules.musteringOut,false);
  assert.equal(p.termRules.eventBeforeGraduation,true);
  assert.equal(p.events,PRECAREER_EVENTS);
 }
});
test('University entry has term DMs -1/-2 and the SOC9 threshold',()=>{
 for(const [term,termDM] of [[1,0],[2,-1],[3,-2]]) {
  for(const [soc,bonus] of [[8,0],[9,1],[15,1]]) {
   const r=educationEntryCheck({id:'core.university',term,stats:{EDU:7,SOC:soc},roll:6});
   assert.equal(r.termDM,termDM);assert.equal(r.thresholdModifier,bonus);
   assert.equal(r.total,6+termDM+bonus);
   assert.equal(r.success,r.total>=6);
  }
 }
});
test('academy entry characteristics and targets are independent of graduation DMs',()=>{
 const expected={'core.academy-army':['END',7],'core.academy-marine':['END',8],'core.academy-navy':['INT',8]};
 for(const [id,[stat,target]] of Object.entries(expected)) {
  for(const [term,termDM] of [[1,0],[2,-2],[3,-4]]) {
   const r=educationEntryCheck({id,term,stats:{...standard,SOC:15},roll:8});
   assert.equal(r.stat,stat);assert.equal(r.target,target);
   assert.equal(r.termDM,termDM);assert.equal(r.thresholdModifier,0);
   assert.equal(r.total,8+termDM);
  }
 }
});
test('failed education entry has no initial awards and leaves the term for a career',()=>{
 const r=educationEntryCheck({id:'core.university',term:3,stats:{EDU:7,SOC:7},roll:2});
 assert.equal(r.success,false);assert.equal(r.consumesTerm,false);
 assert.equal(r.next,'career-qualification');assert.deepEqual(r.effects,[]);
});
test('University initial award records one level0 and one level1 selection plus EDU1',()=>{
 assert.deepEqual(UNIVERSITY_SKILL_CHOICES.map(x=>x.name),[
  'Admin','Advocate','Animals','Art','Astrogation','Electronics','Engineer','Language','Medic','Navigation','Profession','Science'
 ]);
 assert.deepEqual(UNIVERSITY_SKILL_CHOICES.find(x=>x.name==='Animals').specialities,['training','veterinary']);
 for(const name of ['Art','Electronics','Engineer','Language','Profession','Science']) {
  assert.equal(UNIVERSITY_SKILL_CHOICES.find(x=>x.name===name).specialities,'any');
 }
 const r=educationEntryCheck({id:'core.university',term:1,stats:standard,roll:6});
 assert.equal(r.success,true);
 assert.deepEqual(r.effects.slice(0,2).map(x=>[x.selectionId,x.value,x.mode]),[
  ['university-0',0,'set'],['university-1',1,'set']
 ]);
 assert.deepEqual(r.effects[2],{kind:'stat',name:'EDU',value:1});
});
test('academy initial awards reference all of the matching service table at level0',()=>{
 for(const suffix of ['army','marine','navy']) {
  const id='core.academy-'+suffix,r=educationEntryCheck({id,term:1,stats:standard,roll:8});
  assert.deepEqual(r.effects,[{kind:'service-training',career:'core.'+suffix,selection:'all',mode:'set',value:0}]);
 }
});
test('University graduation and honours use modified total thresholds 6 and10',()=>{
 for(const [roll,graduated,honours] of [[5,false,false],[6,true,false],[9,true,false],[10,true,true]]) {
  const r=educationGraduationCheck({id:'core.university',stats:standard,roll});
  assert.equal(r.graduated,graduated);assert.equal(r.honours,honours);
  assert.equal(r.total,roll);
  assert.equal(r.effects.length,graduated?3:0);
 }
 const withDM=educationGraduationCheck({id:'core.university',stats:{INT:12},roll:8});
 assert.equal(withDM.total,10);assert.equal(withDM.honours,true);
 assert.deepEqual(withDM.effects,[
  {kind:'education-selected-skill',selectionId:'university-0',mode:'increase',value:1},
  {kind:'education-selected-skill',selectionId:'university-1',mode:'increase',value:1},
  {kind:'stat',name:'EDU',value:1}
 ]);
});
test('academy graduation has independent END8 and SOC8 bonuses and honours at11',()=>{
 for(const suffix of ['army','marine','navy']) {
  const id='core.academy-'+suffix;
  for(const [end,soc,bonus] of [[7,7,0],[8,7,1],[7,8,1],[8,8,2]]) {
   const r=educationGraduationCheck({id,stats:{INT:7,END:end,SOC:soc},roll:7});
   assert.equal(r.thresholdModifier,bonus);assert.equal(r.total,7+bonus);
   assert.equal(r.graduated,true);assert.equal(r.honours,false);
  }
  const h=educationGraduationCheck({id,stats:{INT:7,END:8,SOC:8},roll:9});
  assert.equal(h.honours,true);
  assert.deepEqual(h.effects,[{kind:'stat',name:'EDU',value:1},{kind:'stat',name:'SOC',value:1}]);
  assert.equal(educationGraduationCheck({id,stats:standard,roll:6}).graduated,false);
 }
});
test('event-blocked graduation does not roll or create failed-academy entry rights',()=>{
 const id='core.academy-army';
 const g=educationGraduationCheck({id,graduationAllowed:false});
 assert.equal(g.attempted,false);assert.equal(g.graduated,false);assert.equal(g.honours,false);
 assert.equal(g.total,null);assert.deepEqual(g.effects,[]);
 const rights=educationCareerBenefits({id,graduation:g,careerId:'core.army'});
 assert.equal(rights.automaticEntry,false);assert.equal(rights.commission,null);assert.deepEqual(rights.effects,[]);
});
test('University qualification modifiers persist and respect assignment restrictions',()=>{
 const id='core.university';
 for(const honours of [false,true]) {
  const g=graduate(id,honours),bonus=honours?2:1;
  for(const [careerId,assignment,expected] of [
   ['core.agent',undefined,bonus],['core.army',undefined,bonus],
   ['core.citizen','corporate',bonus],['core.citizen','worker',0],
   ['core.entertainer','journalist',bonus],['core.entertainer','artist',0],
   ['core.marine',undefined,bonus],['core.navy',undefined,bonus],
   ['core.scholar',undefined,bonus],['core.scout',undefined,bonus],
   ['core.merchant',undefined,0],['core.noble',undefined,0],['core.psion',undefined,0]
  ]) {
   const r=educationCareerBenefits({id,graduation:g,careerId,assignment,firstCareerAfterEducation:false,firstCareerAttempt:false});
   assert.equal(r.qualificationModifier,expected,careerId+' '+assignment);
  }
 }
});
test('University pre-term commission access expires after the first chosen career',()=>{
 const id='core.university';
 for(const honours of [false,true]) {
  for(const careerId of ['core.army','core.marine','core.navy']) {
   const g=graduate(id,honours);
   const r=educationCareerBenefits({id,graduation:g,careerId});
   assert.deepEqual(r.commission,{allowed:true,beforeFirstTerm:true,rankOnSuccess:1,modifier:honours?2:0,automatic:false});
   assert.equal(r.automaticEntry,false);
   assert.equal(educationCareerBenefits({id,graduation:g,careerId,firstCareerAfterEducation:false}).commission,null);
  }
 }
 const g=graduate(id);
 assert.equal(educationCareerBenefits({id,graduation:g,careerId:'core.agent'}).commission,null);
});
test('matching academy graduation grants first-attempt auto entry and one choose3 service award',()=>{
 for(const suffix of ['army','marine','navy']) {
  const id='core.academy-'+suffix,careerId='core.'+suffix,g=graduate(id);
  const r=educationCareerBenefits({id,graduation:g,careerId});
  assert.equal(r.automaticEntry,true);assert.equal(r.serviceAward,true);
  assert.ok(r.effects.some(e=>e.kind==='service-training'&&e.count===3&&e.value===1&&e.mode==='set'));
  const laterAttempt=educationCareerBenefits({id,graduation:g,careerId,firstCareerAttempt:false});
  assert.equal(laterAttempt.automaticEntry,false);
  const alreadyAwarded=educationCareerBenefits({id,graduation:g,careerId,serviceAwardUsed:true});
  assert.equal(alreadyAwarded.serviceAward,false);
  const notEntered=educationCareerBenefits({id,graduation:g,careerId,enteringCareer:false});
  assert.equal(notEntered.serviceAward,false);
 }
});
test('academy ordinary commission uses DM2; honours grants automatic commission',()=>{
 const id='core.academy-army';
 for(const honours of [false,true]) for(const careerId of ['core.army','core.marine','core.navy']) {
  const r=educationCareerBenefits({id,graduation:graduate(id,honours),careerId});
  assert.equal(r.commission.modifier,2);assert.equal(r.commission.automatic,honours);
  assert.equal(r.automaticEntry,careerId==='core.army');
  assert.equal(r.serviceAward,careerId==='core.army');
 }
});
test('failed academy total greater than2 permits matching entry but forbids first-term commission',()=>{
 const id='core.academy-army';
 const totalTwo=educationGraduationCheck({id,stats:standard,roll:2});
 assert.equal(totalTwo.total,2);
 assert.equal(educationCareerBenefits({id,graduation:totalTwo,careerId:'core.army'}).automaticEntry,false);
 const g=educationGraduationCheck({id,stats:standard,roll:3});
 assert.equal(g.graduated,false);
 const r=educationCareerBenefits({id,graduation:g,careerId:'core.army'});
 assert.equal(r.automaticEntry,true);
 assert.deepEqual(r.commission,{allowed:false,forbiddenTerms:1});

 assert.ok(r.effects.some(e=>e.kind==='commission-prohibition'&&e.terms===1));
 assert.equal(educationCareerBenefits({id,graduation:g,careerId:'core.navy'}).automaticEntry,false);
 assert.equal(educationCareerBenefits({id,graduation:g,careerId:'core.army',firstCareerAfterEducation:false}).needsAdjudication,true);
 const naturalTwo=educationGraduationCheck({id,stats:{INT:9,END:7,SOC:7},roll:2});
 assert.equal(naturalTwo.total,3);
 assert.equal(educationCareerBenefits({id,graduation:naturalTwo,careerId:'core.army'}).automaticEntry,true);
});
test('forced next career takes precedence over educational entitlements',()=>{
 const id='core.academy-army';
 const r=educationCareerBenefits({id,graduation:graduate(id),careerId:'core.army',forcedNextCareer:'core.prisoner'});
 assert.equal(r.needsAdjudication,true);assert.deepEqual(r.effects,[]);
});
test('all eleven pre-career events have explicit mechanical entries',()=>{
 assert.deepEqual(Object.keys(PRECAREER_EVENTS).map(Number),[2,3,4,5,6,7,8,9,10,11,12]);
 assert.deepEqual(PRECAREER_EVENTS[3],[{kind:'education-status',graduationAllowed:false}]);
 assert.deepEqual(PRECAREER_EVENTS[5],[{kind:'skill',name:'Carouse',mode:'set',value:1}]);
 assert.deepEqual(PRECAREER_EVENTS[6],[{kind:'relationship',type:'Ally',count:1,dice:'D3'}]);
 assert.deepEqual(PRECAREER_EVENTS[7],[{kind:'table-roll',table:'core.life-events',dice:'2D',sourcePage:46}]);
 assert.deepEqual(PRECAREER_EVENTS[12],[{kind:'stat',name:'SOC',value:1}]);
});
test('psionic education event provides optional testing and future entry permission, not trained talents',()=>{
 const c=PRECAREER_EVENTS[2][0];
 assert.equal(c.kind,'choice');assert.equal(c.options.length,2);
 assert.deepEqual(c.options[0].effects,[
  {kind:'psionic-test',termPenalty:'completed-career-terms'},
  {kind:'career-permission',career:'core.psion',scope:'future-terms'}
 ]);
 assert.deepEqual(c.options[1].effects,[]);
});
test('prank event uses modified total2 and still grants the failed-check Enemy',()=>{
 const r=educationEventFour({roll:2,socialStanding:7});
 assert.equal(r.total,2);assert.equal(r.forcedNextCareer,'core.prisoner');assert.equal(r.graduationAllowed,false);
 assert.equal(r.effects[0].type,'Enemy');assert.equal(r.effects[1].graduationAllowed,false);
 const naturalTwoWithBonus=educationEventFour({roll:2,socialStanding:9});
 assert.equal(naturalTwoWithBonus.total,3);assert.equal(naturalTwoWithBonus.forcedNextCareer,null);
 const modifiedTwo=educationEventFour({roll:3,socialStanding:5});
 assert.equal(modifiedTwo.total,2);assert.equal(modifiedTwo.forcedNextCareer,'core.prisoner');
 assert.equal(educationEventFour({roll:8,socialStanding:7}).effects[0].type,'Rival');
 assert.deepEqual(PRECAREER_EVENTS[4][0].total[2],[
  {kind:'education-status',graduationAllowed:false},{kind:'career-status',action:'next',career:'core.prisoner'}
 ]);
});
test('politics and hobby outcomes preserve both relationships and the JaT exclusion',()=>{
 const politics=PRECAREER_EVENTS[8][0];
 assert.equal(politics.stat,'SOC');assert.equal(politics.target,8);
 assert.deepEqual(politics.success.map(e=>e.type),['Ally','Enemy']);assert.deepEqual(politics.failure,[]);
 const hobby=PRECAREER_EVENTS[9][0];
 assert.equal(hobby.value,0);assert.equal(hobby.mode,'set');
 assert.deepEqual(hobby.exclude,['Jack-of-all-Trades']);
});
test('tutor event checks a skill learned this term and increases that exact skill on success',()=>{
 const e=PRECAREER_EVENTS[10][0];
 assert.equal(e.kind,'check');assert.equal(e.skillScope,'learned-this-term');assert.equal(e.target,9);
 assert.deepEqual(e.success,[{kind:'checked-skill',mode:'increase',value:1},{kind:'relationship',type:'Rival',count:1}]);
 assert.deepEqual(e.failure,[]);
});
test('wartime event allows SOC9 escape, otherwise no graduation and correct military draft bands',()=>{
 const e=PRECAREER_EVENTS[11][0];
 assert.equal(e.stat,'SOC');assert.equal(e.target,9);assert.deepEqual(e.success,[]);
 assert.equal(e.failure[0].graduationAllowed,false);
 const options=e.failure[1].options;
 assert.equal(options[0].effects[0].career,'core.drifter');
 const random=options[1].effects[0];
 assert.deepEqual(random.outcomes.map(o=>[o.min,o.max,o.effects[0].career]),[
  [1,3,'core.army'],[4,5,'core.marine'],[6,6,'core.navy']
 ]);
 random.outcomes.forEach(o=>{
  assert.equal(o.effects[0].viaDraft,true);assert.equal(o.effects[0].exceptionToLifetimeLimit,true);
 });
});
test('data is immutable; helper outputs are independent, serializable and source-safe',()=>{
 visit(EDUCATION_PACK,v=>assert.equal(Object.isFrozen(v),true));
 const before=JSON.stringify(EDUCATION_PACK);
 const first=educationEntryCheck({id:'core.university',term:1,stats:standard,roll:8});
 first.effects[0].value=3;
 assert.equal(EDUCATION_PACK['core.university'].initialEffects[0].value,0);
 assert.equal(JSON.stringify(EDUCATION_PACK),before);
 const output=educationCareerBenefits({id:'core.university',graduation:graduate('core.university'),careerId:'core.army'});
 assert.deepEqual(JSON.parse(JSON.stringify(output)),output);
 assert.ok(!/https?:\/\/|libfile_|Order #|drive\.google/.test(before));
});
test('every emitted effect uses a documented schema',()=>{
 const outputs=[
  EDUCATION_PACK,educationEventFour({roll:2,socialStanding:7}),
  educationCareerBenefits({id:'core.academy-army',graduation:graduate('core.academy-army',true),careerId:'core.army'}),
  educationCareerBenefits({id:'core.academy-army',graduation:educationGraduationCheck({id:'core.academy-army',stats:standard,roll:3}),careerId:'core.army'})
 ];
 outputs.forEach(v=>visit(v,e=>{if(e.kind) assert.ok(Object.hasOwn(EDUCATION_EFFECT_SCHEMA,e.kind),e.kind);}));
});
test('invalid and contradictory inputs are rejected without coercion',()=>{
 const bad=[
  ()=>educationEntryCheck({id:'unknown',term:1,stats:standard,roll:8}),
  ()=>educationEntryCheck({id:'core.university',term:4,stats:standard,roll:8}),
  ()=>educationEntryCheck({id:'core.university',term:1,stats:{EDU:7},roll:8}),
  ()=>educationEntryCheck({id:'core.university',term:1,stats:standard,roll:'8'}),
  ()=>educationGraduationCheck({id:'core.academy-army',stats:{INT:7},roll:8}),
  ()=>educationGraduationCheck({id:'core.university',graduationAllowed:0}),
  ()=>educationCareerBenefits({id:'core.university',graduation:graduate('core.academy-army'),careerId:'core.army'}),
  ()=>educationCareerBenefits({id:'core.university',graduation:graduate('core.university'),careerId:'core.army',firstCareerAttempt:'yes'}),
  ()=>educationCareerBenefits({id:'core.university',graduation:{id:'core.university',graduated:false,honours:true,attempted:true},careerId:'core.army'}),
  ()=>educationEventFour({roll:1,socialStanding:7})
 ];
 bad.forEach(call=>assert.throws(call));
});
