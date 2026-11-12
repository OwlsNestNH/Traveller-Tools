import test from 'node:test';
import assert from 'node:assert/strict';
import {educationReady,educationSetup,forceEducation,command} from './education-result-fixtures.mjs';
import {execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const force=(r,type,payload,values)=>{const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values,reason:'Synthetic nested education roll'});};
const dice=row=>[Math.max(1,row-6),Math.min(6,row-1)];
function step(r,values){const p=r.state.pendingEducationEventRoll;assert.equal(r.state.stage,'education-event-roll');const next=force(r,'roll-education-event-step',{pendingId:p.id},values);assert.equal(next.log.at(-1).rolls.length,1);return next;}
function life(row,ready=educationReady()){let r=force(ready,'education-event',{},[3,4]);assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.educationEventView.roll.source.page,46);return step(r,dice(row));}
function unusual(row,ready){let r=life(12,ready);assert.equal(r.educationEventView.roll.dice,'1D');return step(r,[row]);}
const decision=(r,p)=>run(r,'resolve-life-event',{confirmed:true,reason:'Synthetic source decision',...p});
function acknowledge(r){assert.equal(r.state.stage,'education-event-result');const after=run(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});assert.equal(after.state.rng,r.state.rng);assert.deepEqual(after.state.character,r.state.character);return after;}
function roundtrip(r){assert.equal(exportSession(importSession(exportSession(r.session))),exportSession(r.session));assert.deepEqual(project(r.session).state,r.state);}
test('all Life Event rows pause or resolve without bundled secondary rolls',()=>{
 for(let row=2;row<=12;row++){
  let r=life(row);assert.equal(r.state.character.lifeEvents[0].row,row);assert.equal(r.educationEventView.childRolls.length,1);assert.deepEqual(r.educationEventView.childRolls[0].kept,dice(row));roundtrip(r);
  if(row===2){assert.equal(r.educationEventView.roll.label,'Injury table');assert.equal(r.educationEventView.roll.source.page,49);continue;}
  if(row===12){assert.equal(r.educationEventView.roll.label,'Unusual event');continue;}
  if(row===3)r=decision(r,{outcome:'birth'});
  if(row===4||row===8)r=decision(r,{role:'Rival',name:'Synthetic former friend'});
  if(row===11)r=decision(r,{outcome:'prisoner'});
  assert.equal(r.state.character.lifeEvents[0].status,'completed');assert.equal(acknowledge(r).state.stage,'education-graduation');
 }
});
test('all unusual rows preserve typed decisions, deferred awards and table provenance',()=>{
 for(let row=1;row<=6;row++){
  let r=unusual(row);assert.equal(r.state.character.lifeEvents[1].row,row);assert.equal(r.state.character.lifeEvents[1].parentId,r.state.character.lifeEvents[0].id);assert.equal(r.educationEventView.childRolls.length,2);assert.deepEqual(r.educationEventView.childRolls[1].kept,[row]);
  if(row===1)r=decision(r,{outcome:'decline'});
  if(row===4||row===5)r=decision(r,{outcome:row===4?'amnesia':'government'});
  if(row===2&&r.state.stage==='skill-choice')r=run(r,'choose-skill',{name:'Science (physics)'});
  if([3,6].includes(row))assert.ok(r.state.character.deferredEquipment.some(e=>e.kind==='artefact'));
  assert.equal(acknowledge(r).state.stage,'education-graduation');roundtrip(r);
 }
});
test('injury table and severity are distinct explicit dice before loss/treatment',()=>{
 for(let row=1;row<=6;row++)for(const severity of row<=2?[1,6]:[null]){
  let r=step(life(2),[row]);if(row<=2){assert.equal(r.educationEventView.roll.label,'Injury severity');r=step(r,[severity]);}
  assert.equal(r.educationEventView.childRolls.at(-1).source.page,49);const injury=r.state.character.injuries[0];assert.equal(injury.tableResult,row);assert.deepEqual(injury.tableRolls,[row]);if(severity)assert.equal(injury.severityDie,severity);
  if(r.state.stage==='injury-loss')r=run(r,'injury-loss',{index:0});
  if(r.state.stage==='book-step'){assert.equal(r.state.pending.kind,'injury-zero');r=run(r,'resolve-book',{confirmed:true,note:'Synthetic death ruling',injurySurvives:false});assert.equal(acknowledge(r).state.stage,'deceased');assert.equal(r.state.educationEventContext,undefined);continue;}
  if(r.state.stage==='injury-treatment')r=run(r,'injury-treatment',{restore:{},inService:false});
  assert.equal(acknowledge(r).state.stage,'education-graduation');roundtrip(r);
 }
});
test('institute PSI testing retains funding/timing and existing PSI0/8 without automatic training',()=>{
 for(const psi of [undefined,0,8])for(const funding of ['cash','provided']){
  let ready=educationReady();ready=run(ready,'gm-override',{field:'cash',value:7000,reason:'Synthetic test funding'});if(psi!==undefined)ready=run(ready,'gm-override',{field:'stat.PSI',value:psi,reason:'Synthetic known potential'});
  let r=unusual(1,ready);const before=r,raw=exportSession(r.session);assert.throws(()=>decision(r,{outcome:'test',funding,cost:0}),/timing/);assert.equal(exportSession(r.session),raw);
  const cost=psi===undefined&&funding==='cash'?5000:0;r=decision(r,{outcome:'test',funding,cost,timingConfirmed:true});assert.equal(r.log.at(-1).rolls.length,psi===undefined?1:0);assert.equal(r.state.character.cash,7000-cost);assert.deepEqual(r.state.character.skills,before.state.character.skills);assert.equal(r.state.character.psionicTraining,undefined);assert.equal(r.state.character.psionEntryPermission,undefined);assert.equal(r.state.character.psionics?.training?.length??0,0);
  if(psi!==undefined){assert.equal(r.state.character.stats.PSI,psi);assert.equal(r.state.rng,before.state.rng);}assert.equal(acknowledge(r).state.stage,'education-graduation');roundtrip(r);
 }
 const poor=unusual(1);assert.throws(()=>decision(poor,{outcome:'test',funding:'cash',cost:5000,timingConfirmed:true}),/Insufficient/);
});
test('University organisation injury coverage remains a source decision, never an invented contribution die',()=>{
 let r=step(life(2),[3]);r=run(r,'injury-loss',{index:0});const injury=r.state.character.injuries[0],restore=Object.fromEntries(Object.entries(injury.losses).filter(([,n])=>n>0));const rng=r.state.rng;
 r=run(r,'injury-treatment',{restore,inService:true});assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.kind,'injury-medical');assert.equal(r.state.rng,rng);assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.injuries[0].careerId,null);
 r=run(r,'resolve-book',{confirmed:true,note:'Synthetic actual organisation contribution',medicalCoveredCost:1000});assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.character.medicalBills[0].coveredCost,1000);assert.equal(r.state.rng,rng);acknowledge(r);roundtrip(r);
});
test('zero-score survival retains explicit referee stats and treatment before result',()=>{
 let ready=educationReady();ready=run(ready,'gm-override',{field:'stat.STR',value:1,reason:'Synthetic injury zero'});let r=step(step(life(2,ready),[2]),[6]);r=run(r,'injury-loss',{index:0});assert.equal(r.state.pending.kind,'injury-zero');assert.throws(()=>run(r,'resolve-book',{confirmed:true,note:'Missing stats',injurySurvives:true}),/characteristics/);
 r=run(r,'resolve-book',{confirmed:true,note:'Synthetic survival ruling',injurySurvives:true,injuryStats:{STR:0,DEX:7,END:7}});assert.equal(r.state.stage,'injury-treatment');r=run(r,'injury-treatment',{restore:{STR:1},inService:false});assert.equal(r.state.character.deceased,undefined);assert.equal(acknowledge(r).state.stage,'education-graduation');
});
test('unusual Science specialization and capped award keep exact continuation and no extra dice',()=>{
 let r=unusual(2);assert.equal(r.state.stage,'skill-choice');assert.equal(r.state.character.skills['Science (physics)'],undefined);const rng=r.state.rng;r=run(r,'choose-skill',{name:'Science (physics)'});assert.equal(r.state.character.skills['Science (physics)'],1);assert.equal(r.state.rng,rng);assert.equal(r.state.character.relationships.at(-1).name,'Alien contact');acknowledge(r);
 let ready=educationReady();for(const stat of ['INT','EDU'])ready=run(ready,'gm-override',{field:'stat.'+stat,value:0,reason:'Synthetic source cap'});r=unusual(2,ready);r=run(r,'choose-skill',{name:'Science (physics)'});assert.equal(r.state.stage,'book-step');assert.equal(r.state.character.relationships.some(x=>x.name==='Alien contact'),false);r=run(r,'resolve-book',{confirmed:true,note:'Synthetic cap adjudication',effects:[]});assert.equal(r.state.character.skills['Science (physics)'],undefined);assert.equal(r.state.character.relationships.at(-1).name,'Alien contact');assert.equal(r.state.stage,'education-event-result');acknowledge(r);
});
function settle(r){
 for(let n=0;n<20;n++){
  if(r.state.stage==='education-event-roll'){r=run(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id});continue;}
  if(r.state.stage==='education-event-result')return acknowledge(r);
  if(['education-graduation','deceased'].includes(r.state.stage))return r;
  if(r.state.stage==='skill-choice'){r=run(r,'choose-skill',{name:'Science (physics)'});continue;}
  if(r.state.stage==='injury-loss'){r=run(r,'injury-loss',{index:0});continue;}
  if(r.state.stage==='injury-treatment'){r=run(r,'injury-treatment',{restore:{},inService:false});continue;}
  const p=r.state.pending;
  if(p?.kind==='injury-zero'){r=run(r,'resolve-book',{confirmed:true,note:'Synthetic natural death ruling',injurySurvives:false});continue;}
  assert.equal(p?.kind,'core-life-decision');const life=r.state.character.lifeEvents.find(e=>e.id===p.lifeEventId);
  const payload=p.decision==='narrative'?{outcome:life.table==='core.life-events'?'birth':life.row===4?'amnesia':'government'}:p.decision==='crime'?{outcome:'prisoner'}:p.decision==='psionics'?{outcome:'test',funding:'provided',cost:0,timingConfirmed:true}:{role:'Enemy',name:'Synthetic former friend'};
  r=decision(r,payload);
 }
 assert.fail('Education life event did not terminate');
}
test('natural nested events preserve .30 final character, modifiers, source outcomes and RNG',()=>{
 const seen=new Set();let count=0;
 for(let i=0;i<120;i++){
  let ready=forceEducation(educationSetup('life-parity-'+i),'precareer',{id:'core.university'},[6,6]);ready=command(ready,'education-skill',{name:'Admin'});ready=command(ready,'education-skill',{name:'Medic'});
  let modern=run(ready,'education-event');if(modern.state.character.educations[0].event!==7)continue;
  let legacy=run({...structuredClone(ready.session),rulesRevision:'character-preview-2026-11-09.30'},'education-event');modern=settle(modern);legacy=settle(legacy);count++;for(const r of modern.state.character.lifeEvents)seen.add(r.table+':'+r.row);
  assert.deepEqual(modern.state.character,legacy.state.character);assert.deepEqual(modern.state.modifiers,legacy.state.modifiers);assert.deepEqual(modern.state.forcedCareer,legacy.state.forcedCareer);assert.equal(modern.state.rng,legacy.state.rng);assert.equal(modern.state.stage,legacy.state.stage);
 }
 assert.ok(count>=10);assert.ok(seen.size>=5);
});
test('nested identities, severity import, replay pruning and restore preserve exact pending evidence',()=>{
 let r=force(educationReady(),'education-event',{},[3,4]);const lifeId=r.state.pendingEducationEventRoll.id;r=step(r,[1,1]);const tableId=r.state.pendingEducationEventRoll.id,restoreRevision=r.revision,raw=exportSession(r.session);
 assert.throws(()=>run(r,'roll-education-event-step',{pendingId:lifeId}));assert.throws(()=>run(r,'roll-education-event-step',{pendingId:tableId,values:[6]}));assert.equal(exportSession(r.session),raw);
 r=step(r,[1]);assert.equal(r.educationEventView.roll.label,'Injury severity');const severity=r.state.pendingEducationEventRoll;assert.deepEqual(project(importSession(exportSession(r.session))).state.pendingEducationEventRoll,severity);
 const originalTableAction=r.revision-1;r=run(r,'gm-replay',{revision:originalTableAction,rollIndex:0,values:[6],reason:'Synthetic alternate injury result'});assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.pendingEducationEventRoll,undefined);assert.equal(r.educationEventView.childRolls.length,2);assert.deepEqual(r.educationEventView.childRolls.at(-1).kept,[6]);assert.equal(r.educationEventView.childRolls.some(x=>x.label==='Injury severity'),false);
 const rng=r.state.rng;r=run(r,'restore',{revision:restoreRevision});assert.equal(r.state.pendingEducationEventRoll.id,tableId);assert.equal(r.state.rng,rng);assert.equal(r.educationEventView.childRolls.length,1);assert.equal(r.educationEventView.roll.source.page,49);
});
test('event evidence includes applied modifiers and distinguishes owned artefacts from pending details',()=>{
 let r=life(9);const raw=exportSession(r.session),groups=r.educationEventView.appliedStateChanges;
 assert.equal(groups.length,1);assert.equal(groups[0].actionId,r.log.at(-1).id);assert.equal(groups[0].contextId,r.state.educationEventResult.id.replace(/-result$/,''));
 assert.deepEqual(groups[0].changes,[{path:'modifiers.0',before:null,after:r.state.modifiers[0],source:{id:'core',page:46}}]);
 assert.equal(groups[0].changes[0].after.target,'qualification');assert.equal(groups[0].changes[0].after.value,2);assert.equal(groups[0].changes[0].after.scope,'next');
 project(r.session);assert.equal(exportSession(r.session),raw);
 const original=groups;r=run(r,'notes',{text:'Synthetic evidence excludes notes'});assert.deepEqual(r.educationEventView.appliedStateChanges,original);
 const changed=run(r,'gm-replay',{revision:r.revision-2,rollIndex:0,values:[4,6],reason:'Synthetic superseded modifier evidence'});
 assert.equal(changed.educationEventView.appliedStateChanges.some(g=>g.changes.some(c=>c.path.startsWith('modifiers.'))),false);
 const restored=run(changed,'restore',{revision:r.revision});assert.deepEqual(restored.educationEventView.appliedStateChanges,original);
 r=life(10);const bonus=r.educationEventView.appliedChanges.flatMap(x=>x.changes).find(x=>x.path==='lifeBenefitBonuses.0');
 assert.equal(bonus.before,null);assert.equal(bonus.after.value,2);assert.equal(bonus.after.status,'available');assert.deepEqual(bonus.after.source,{id:'core',page:46});
 r=unusual(3);const asset=r.educationEventView.appliedChanges.flatMap(x=>x.changes).find(x=>x.path==='assets.0').after;
 const task=r.educationEventView.appliedStateChanges.flatMap(x=>x.changes).find(x=>x.path==='character.deferredEquipment.0').after;
 assert.equal(asset.ownership,'owned');assert.equal(asset.detailsPending,true);assert.equal(task.status,'pending');assert.equal(task.kind,'artefact');assert.equal(task.assetId,asset.id);assert.equal(asset.value,undefined);
 roundtrip(r);
});
test('medical event evidence records outstanding bill and restored stats without claiming paid cash or debt',()=>{
 let r=step(life(2),[3]);r=run(r,'injury-loss',{index:0});
 const restore=Object.fromEntries(Object.entries(r.state.character.injuries[0].losses).filter(([,n])=>n>0));
 r=run(r,'injury-treatment',{restore,inService:false});
 const changes=r.educationEventView.appliedChanges.flatMap(x=>x.changes),bill=changes.find(x=>x.path==='medicalBills.0').after;
 assert.ok(bill.personalCost>0);assert.equal(bill.totalCost,bill.personalCost);assert.equal(bill.coveredCost,0);
 assert.equal(bill.settled,false);assert.equal(bill.paid,0);assert.equal(bill.debt,0);assert.deepEqual(bill.source,{id:'core',page:49});
 assert.ok(changes.some(x=>x.path.startsWith('stats.')));assert.ok(changes.some(x=>x.path.startsWith('injuries.')));
 assert.equal(changes.some(x=>['cash','debt'].includes(x.path)),false);roundtrip(r);
});
