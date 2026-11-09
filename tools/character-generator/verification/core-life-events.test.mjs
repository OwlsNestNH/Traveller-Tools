import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {CORE_LIFE_TABLES,lifePsionAccess} from '../engine/core-life-events.mjs';
import {lifeFixture,run,rejected} from './core-life-event-fixtures.mjs';
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const decision=(r,p)=>run(r,'resolve-life-event',{confirmed:true,reason:'Original referee source decision.',...p});
// Retain explicit-description legacy coverage; new generic artefacts are covered by equipment-finalization tests.
const unusual=row=>lifeFixture({seed:'life-566',unusual:row,...([3,6].includes(row)?{rulesRevision:'character-preview-2026-11-09.20'}:{})});
const sourceURL=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(sourceURL,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,sourceURL).href));source+='\nexport const lifeAudit={apply,queueEffects};';const {lifeAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('Core p46 encodes every life and unusual row without source narration',()=>{
 assert.deepEqual(Object.keys(CORE_LIFE_TABLES['core.life-events'].results).map(Number),[2,3,4,5,6,7,8,9,10,11,12]);assert.deepEqual(Object.keys(CORE_LIFE_TABLES['core.unusual-events'].results).map(Number),[1,2,3,4,5,6]);
});
test('public natural Event7 rolls secondary dice without a fallback or consuming a term',()=>{
 const r=lifeFixture();assert.equal(r.state.pending.kind,'core-life-decision');assert.equal(r.state.pending.decision,'crime');assert.equal(r.state.character.lifeEvents[0].row,11);assert.equal(r.state.character.terms,0);assert.equal(r.state.character.age,18);assert.ok(r.log.at(-1).changes.some(c=>c.path.startsWith('lifeEvents.')));roundtrip(r);
});
test('all public life rows retain source and resume through their actual mechanical procedures',()=>{
 for(let row=2;row<=12;row++){
  const r=lifeFixture({row}),entry=r.state.character.lifeEvents[0];assert.equal(entry.row,row);assert.deepEqual(entry.source,{id:'core',page:46});assert.equal(r.log.at(-1).rolls[2].total,row);assert.equal(r.state.character.terms,0);assert.equal(r.state.character.careers[0].forcedExit??false,false);
  if(row===2){assert.ok(r.state.stage.startsWith('injury')||r.state.pending?.source==='core');assert.ok(r.log.at(-1).rolls.some(x=>x.label==='Injury table'));}
  if([5,6,7].includes(row)){assert.equal(r.state.character.relationships.at(-1).role,row===7?'Contact':'Ally');assert.equal(r.state.stage,'advancement');assert.equal(entry.status,'completed');}
  if(row===9){assert.ok(r.state.modifiers.some(x=>x.target==='qualification'&&x.value===2&&x.careerId==='any'));assert.equal(r.state.stage,'advancement');}
  if(row===10){assert.equal(r.state.character.lifeBenefitBonuses[0].status,'available');assert.equal(r.state.stage,'advancement');}
  if(row===12){assert.equal(r.state.character.lifeEvents.length,2);assert.equal(r.state.character.lifeEvents[1].parentId,entry.id);assert.equal(r.log.at(-1).rolls[3].values.length,1);}
  roundtrip(r);
 }
});
test('typed narrative and relationship decisions are atomic, mandatory and idempotent',()=>{
 let r=lifeFixture({row:3});for(const payload of [{outcome:'government'},{outcome:'birth',effects:[]},{outcome:'birth',confirmed:false},{outcome:'birth',reason:''}])rejected(r,'resolve-life-event',{confirmed:true,reason:'Source decision',...payload});
 rejected(r,'resolve-book',{confirmed:true,note:'Bypass',effects:[]},/typed/);rejected(r,'gm-override',{field:'cash',value:50,reason:'Edit while pending'},/pending life/);
 const before=r;r=run(r,'resolve-life-event',{confirmed:true,reason:'A birth in the family.',outcome:'birth'},{id:'life-decision'});assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.lifeEvents[0].decision.outcome,'birth');assert.deepEqual(run(r,'resolve-life-event',{confirmed:true,reason:'A birth in the family.',outcome:'birth'}, {id:'life-decision'}).session,r.session);rejected(r,'resolve-life-event',{confirmed:true,reason:'Again',outcome:'birth'},/pending/);assert.equal(before.state.character.lifeEvents[0].status,'pending');roundtrip(r);
 for(const row of [4,8])for(const role of ['Rival','Enemy']){const next=decision(lifeFixture({row}),{role,name:'Former friend'});assert.equal(next.state.character.relationships.at(-1).role,role);assert.equal(next.state.stage,'advancement');roundtrip(next);}
});
test('betrayal converts exactly one existing Contact or Ally, retaining identity and interrupted queue',()=>{
 for(const role of ['Rival','Enemy']){
  const s=structuredClone(lifeFixture({row:8}).state);s.character.relationships=[{id:'r-a',role:'Contact',name:'A'},{id:'r-b',role:'Ally',name:'B'},{id:'r-c',role:'Rival',name:'C'}];
  s.effectsQueue.unshift({kind:'cash',value:23});const prior=structuredClone(s.character.relationships);
  assert.throws(()=>a.apply(structuredClone(s),{type:'resolve-life-event',payload:{confirmed:true,reason:'Test',role,relationshipId:'r-c'}},[]),/Contact or Ally/);
  a.apply(s,{type:'resolve-life-event',payload:{confirmed:true,reason:'Test',role,relationshipId:'r-b'}},[]);
  assert.deepEqual(s.character.relationships,[prior[0],{...prior[1],role},prior[2]]);assert.equal(s.character.cash,23);assert.equal(s.stage,'advancement');assert.deepEqual(s.effectsQueue,[]);
 }
});
test('all unusual rows retain typed records while Science is allocated before its Contact',()=>{
 for(let row=1;row<=6;row++){
  let r=unusual(row);assert.equal(r.state.character.lifeEvents[1].row,row);assert.equal(r.state.character.lifeEvents[0].status,'pending');
  if(row===2){assert.equal(r.state.stage,'skill-choice');assert.deepEqual(r.state.pendingChoice.allowed,['Science']);assert.deepEqual(r.state.pendingChoice.source,{id:'core',page:46});assert.ok(!r.state.character.relationships?.some(x=>x.name==='Alien contact'));assert.equal(r.state.character.deferredSkillAwards?.length??0,0);roundtrip(r);r=run(r,'choose-skill',{name:'Science (xenology)'});assert.equal(r.state.character.skills['Science (xenology)'],1);assert.equal(r.state.character.relationships.at(-1).name,'Alien contact');}
  else if(row===1)r=decision(r,{outcome:'decline'});
  else if([3,6].includes(row)){rejected(r,'resolve-life-event',{confirmed:true,reason:'Agreed item',name:'',cost:100});r=decision(r,{name:'Uncatalogued object'});assert.equal(r.state.character.assets.at(-1).name,'Uncatalogued object');assert.equal(r.state.character.assets.at(-1).cost,undefined);}
  else r=decision(r,{outcome:row===4?'amnesia':'government'});
  assert.equal(r.state.stage,'advancement');assert.ok(r.state.character.lifeEvents.every(x=>x.status==='completed'));assert.equal(r.state.character.terms,0);roundtrip(r);
 }
});
test('institute testing is opt-in, funding checked, no free talent or training, with next-term-only entry permission',()=>{
 const initial=unusual(1);rejected(initial,'resolve-life-event',{confirmed:true,reason:'Testing',outcome:'test',funding:'cash',cost:5000,timingConfirmed:true},/Insufficient/);rejected(initial,'resolve-life-event',{confirmed:true,reason:'Testing',outcome:'test',funding:'provided',cost:0},/timing/);
 let r=decision(initial,{outcome:'test',funding:'provided',cost:0,timingConfirmed:true});assert.equal(r.log.at(-1).rolls[0].label,'Psionic potential');assert.equal(r.state.character.psionics.tests.length,1);assert.equal(r.state.character.psionics.training.length,0);assert.equal(r.state.character.psionEntryPermission,undefined);assert.equal(r.state.character.lifePsionAccess.availableAtTerms,1);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.age,18);assert.equal(lifePsionAccess(r.state),false);const s=structuredClone(r.state);s.character.terms=1;assert.equal(lifePsionAccess(s),true);s.character.terms=2;assert.equal(lifePsionAccess(s),false);roundtrip(r);
 const known=structuredClone(initial.state);known.character.stats.PSI=8;const rolls=[];a.apply(known,{type:'resolve-life-event',payload:{confirmed:true,reason:'Known testing record',outcome:'test',funding:'cash',cost:0,timingConfirmed:true}},rolls);assert.equal(rolls.length,0);assert.equal(known.character.stats.PSI,8);
 const funded=structuredClone(initial.state);funded.character.cash=7000;a.apply(funded,{type:'resolve-life-event',payload:{confirmed:true,reason:'Paid source testing',outcome:'test',funding:'cash',cost:6000,timingConfirmed:true}},[]);assert.equal(funded.character.cash,1000);
});
function benefits(r){r=run(r,'advancement');while(r.state.stage==='training'||r.state.stage==='skill-choice'){if(r.state.stage==='training')r=run(r,'training',{table:'personal'});else {const name=r.state.pendingChoice.allowed?.[0];r=run(r,'choose-skill',{name:name==='Profession'?'Profession (construction)':name});}}assert.equal(r.state.stage,'term-end');return run(r,'leave-career');}
test('crime loses one actually earned Benefit roll or requires Prisoner after completing current term',()=>{
 let loss=decision(lifeFixture({row:11}),{outcome:'lose-benefit'});assert.equal(loss.state.character.lifeBenefitLosses[0].status,'owed');loss=benefits(loss);assert.equal(loss.state.character.lifeBenefitLosses[0].status,'applied');assert.equal(loss.state.character.careers[0].benefitRolls,loss.state.character.careers[0].rank>=1?1:0);roundtrip(loss);
 let prison=decision(lifeFixture({row:11}),{outcome:'prisoner'});assert.equal(prison.state.forcedCareer,'core.prisoner');assert.equal(prison.state.character.sentenced,true);assert.equal(prison.state.character.careers[0].forcedExit??false,false);assert.equal(prison.state.stage,'advancement');assert.equal(prison.state.character.terms,0);roundtrip(prison);
 prison=benefits(prison);assert.equal(prison.state.character.careers[0].forcedExit,true);assert.equal(prison.state.character.terms,1);assert.equal(prison.state.forcedCareer,'core.prisoner');roundtrip(prison);
});
test('good fortune can be saved for any chosen cash or material Benefit roll, exactly once',()=>{
 for(const cash of [true,false]){
  let r=benefits(lifeFixture({row:10}));const id=r.state.character.lifeBenefitBonuses[0].id;rejected(r,'benefit',{cash,lifeBonusIds:['missing']},/unavailable/);rejected(r,'benefit',{cash,lifeBonusIds:[id,id]},/distinct/);
  const used=run(r,'benefit',{cash,lifeBonusIds:[id]});assert.equal(used.state.character.lifeBenefitBonuses[0].status,'consumed');assert.equal(used.state.character.lifeBenefitBonuses[0].consumption.result-used.state.character.lifeBenefitBonuses[0].consumption.die,2);roundtrip(used);
  const saved=run(r,'benefit',{cash});assert.equal(saved.state.character.lifeBenefitBonuses[0].status,'available');roundtrip(saved);
 }
});
test('education and Companion shared routes do not require an active career',()=>{
 for(const row of [3,9,10,11]){
  const s=structuredClone(lifeFixture({row}).state);s.active=null;s.character.careers=[];s.effectNext='education-graduation';s.education=0;s.character.educations=[{id:'core.university',graduationAllowed:true}];
  if(row===11){a.apply(s,{type:'resolve-life-event',payload:{confirmed:true,reason:'Pre-career crime',outcome:'lose-benefit'}},[]);assert.equal(s.character.lifeBenefitLosses[0].careerIndex,null);}
  if(row===3)a.apply(s,{type:'resolve-life-event',payload:{confirmed:true,reason:'Family birth',outcome:'birth'}},[]);
  if([3,11].includes(row))assert.equal(s.stage,'education-graduation');
 }
});
test('restore/replay and import preserve interrupted secondary outcomes without rerolling',()=>{
 const pending=unusual(3),done=decision(pending,{name:'Recorded device'});const restored=run(done,'restore',{revision:pending.revision});assert.equal(restored.state.pending.kind,'core-life-decision');assert.equal(restored.state.character.assets?.length??0,0);assert.equal(restored.state.character.lifeEvents.length,2);roundtrip(restored);roundtrip(decision(restored,{name:'Different agreed name'}));
 const bad=JSON.parse(exportSession(done.session));bad.rulesRevision='character-preview-old';assert.equal(api({operation:'import',raw:JSON.stringify(bad)}).ok,false);
});
test('HTTP API delivers the same typed outcome and rejects forged effects without changing the save',async()=>{
 const {createServer}=await import('../server.mjs');const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const r=unusual(3),call=async payload=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',body:JSON.stringify({operation:'command',session:r.session,command:{type:'resolve-life-event',payload}})});return response.json();};
  const bad=await call({confirmed:true,reason:'Forgery',name:'Object',effects:[{kind:'cash',value:1000}]});assert.equal(bad.ok,false);
  const good=await call({confirmed:true,reason:'Agreed with the referee',name:'Object'});assert.equal(good.ok,true);assert.equal(good.state.character.assets.at(-1).name,'Object');assert.equal(good.state.character.cash,0);roundtrip(good);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('Companion and Aslan Outcast Event7 dispatch the same Core source and preserve caller continuation',async()=>{
 const {EXPANSION_PACK}=await import('../engine/expansion-pack.mjs');const {findCareer}=await import('../engine/catalog.mjs');
 for(const id of ['companion.truther','companion.believer','aslan.outcast']){
  const s=structuredClone(lifeFixture({row:7}).state),career=findCareer(id);s.character.lifeEvents=[];s.character.relationships=[];s.character.careers[0].id=id;s.character.careers[0].assignment=career.assignments[0].id;if(id.startsWith('aslan'))s.character.species='aslan';
  const rolls=[];s._override={index:0,values:[3,4]};a.queueEffects(s,EXPANSION_PACK[id].events[7],'after-event',rolls);delete s._override;
  assert.equal(s.character.lifeEvents[0].table,'core.life-events');assert.equal(s.character.lifeEvents[0].careerId,id);assert.deepEqual(s.character.lifeEvents[0].source,{id:'core',page:46});assert.equal(s.character.relationships[0].role,'Contact');assert.equal(s.stage,'advancement');assert.equal(s.character.terms,0);assert.equal(rolls.length,1);
 }
});

test('Crime preserves current advancement awards but next-term Prisoner overrides natural 12 continuation',()=>{
 const pending=decision(lifeFixture({row:11}),{outcome:'prisoner'});
 for(const values of [[1,1],[6,6]]){
  let r=run(pending,'advancement');r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values,reason:'Verify Crime advancement and next-term precedence.'});
  if(values[0]===6){assert.equal(r.state.character.careers[0].rank,1);assert.equal(r.state.stage,'training');}
  while(['training','skill-choice'].includes(r.state.stage)){
   if(r.state.stage==='training')r=run(r,'training',{table:'personal'});
   else {const name=r.state.pendingChoice.allowed?.[0];r=run(r,'choose-skill',{name:name==='Profession'?'Profession (construction)':name});}
  }
  assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.terms,1);assert.equal(r.state.character.careers[0].forcedExit,true);assert.equal(r.state.character.careers[0].forcedStay,false);assert.equal(r.state.exitOptions.canContinue,false);assert.equal(r.state.exitOptions.canLeave,true);
  rejected(r,'continue-career',{},/must be left/);roundtrip(r);
 }
});
