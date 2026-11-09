// Preserved full-engine development regression, including deferred Zhodani.
import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentApi as api,project,importSession,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {buildProleLossFixture,buildScholarChoiceFixture,buildGovernmentCheckFixture,buildGovernmentLostPsiFixture,run,rejected,force} from './zhodani-choice-fixtures.mjs';
import {rolledReeducation,chronology} from './zhodani-reeducation-fixtures.mjs';
const prole=buildProleLossFixture(),empty=buildProleLossFixture({withRelationships:false}),protectedProle=buildProleLossFixture({protectedStay:true});
const scholar=buildScholarChoiceFixture(),government=buildGovernmentCheckFixture();
const career=r=>r.state.character.careers[r.state.active];
function roundtrip(r){assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);}
test('source-earned Prole removal consumes one existing relationship and reaches re-education without altering the career',()=>{
 let r=prole;const before=structuredClone(r.state.character),choice=r.state.relationshipLossOptions[0];
 assert.equal(r.state.pendingChoice.source.page,273);r=run(r,'gm-mode',{enabled:false});
 r=run(r,'resolve-relationship-loss',{index:choice.index},{id:'remove-once'});assert.equal(r.state.stage,'reeducation-roll');
 assert.equal(r.state.character.relationships.length,before.relationships.length-1);assert.equal(r.state.character.relationshipLosses.length,1);
 assert.match(before.relationships[choice.index].id,/^relationship-\d+$/);assert.deepEqual(r.state.character.relationshipLosses[0].removed,before.relationships[choice.index]);assert.equal(r.state.character.relationships.some(p=>p.id===before.relationships[choice.index].id),false);assert.equal(r.state.character.relationshipLosses[0].source.page,273);
 assert.equal(r.state.character.age,before.age);assert.equal(career(r).id,'zhodani.prole');assert.equal(career(r).terms,before.careers[0].terms);
 assert.deepEqual(run(r,'resolve-relationship-loss',{index:choice.index},{id:'remove-once'}).session,r.session);roundtrip(r);
});
test('relationship decisions reject invalid indices, invented absences and unrelated context edits atomically',()=>{
 for(const payload of [{index:-1},{index:999},{index:'0'},{index:0,reason:'extra'},{absent:true,reason:'Actually present'}])rejected(prole,'resolve-relationship-loss',payload);
 rejected(prole,'gm-override',{field:'stat.SOC',value:10,reason:'Not during pending removal'},/pending relationship/);
 rejected(prole,'leave-career',{},/pending relationship/);roundtrip(prole);
});
test('missing Prole relationship is a typed source ruling and preserves the whole empty roster',()=>{
 rejected(empty,'resolve-relationship-loss',{absent:true,reason:''},/reason/);assert.equal(empty.state.coverage.includes('zhodani-relationship-loss'),false);
 let r=run(empty,'resolve-relationship-loss',{absent:true,reason:'No eligible relationship exists in this history.'});assert.equal(r.state.stage,'reeducation-roll');
 assert.deepEqual(r.state.character.relationships,empty.state.character.relationships);assert.equal(r.state.character.relationshipLosses[0].absent,true);
 assert.equal(r.state.character.relationshipLosses[0].removed,null);assert.equal(r.state.coverage.filter(x=>x==='zhodani-relationship-loss').length,1);roundtrip(r);
});
test('protected Prole loss removes only the selected duplicate entry and retains its original Event continuation',()=>{
 const before=protectedProle.state.character.relationships;assert.equal(new Set(before.map(p=>p.id)).size,before.length);assert.ok(before.every(p=>/^relationship-\d+$/.test(p.id)));let r=run(protectedProle,'resolve-relationship-loss',{index:1});
 assert.deepEqual(r.state.character.relationships,[before[0],...before.slice(2)]);r=rolledReeducation(r,1);
 r=run(r,'resolve-reeducation',{chronology:chronology('before-resume')});assert.equal(r.state.stage,'advancement');assert.equal(career(r).forcedExit,false);
 assert.equal(career(r).terms,1);assert.equal(r.state.character.nonCareerMonths,48);assert.equal(r.log.at(-1).rolls.length,0);roundtrip(r);
});
test('relationship restore permits a different selection without erasing prior accepted action history',()=>{
 const removed=run(protectedProle,'resolve-relationship-loss',{index:0}),restored=run(removed,'restore',{revision:protectedProle.revision});
 assert.equal(restored.state.stage,'relationship-loss');assert.equal(restored.state.character.relationshipLosses,undefined);
 const next=run(restored,'resolve-relationship-loss',{index:2});assert.equal(next.state.character.relationshipLosses[0].relationshipIndex,2);
 assert.ok(next.log.some(x=>x.number===removed.revision));roundtrip(next);
});
test('secret Scholar choices are two distinct Science awards with preserved partial progress',()=>{
 let r=scholar;assert.equal(r.state.pendingChoice.count,2);assert.equal(r.state.pendingChoice.source.page,275);
 rejected(r,'choose-skill',{name:'Medic'},/not available/);r=run(r,'choose-skill',{name:'Science (physics)'});
 assert.equal(r.state.stage,'skill-choice');assert.equal(r.state.pendingChoice.count,1);assert.deepEqual(r.state.pendingChoice.selected,['Science (physics)']);roundtrip(r);
 for(const name of ['Science (physics)','Science (PHYSICS)','Science (ｐｈｙｓｉｃｓ)'])rejected(r,'choose-skill',{name},/different/);
 r=run(r,'choose-skill',{name:'Science (chemistry)'});assert.equal(r.state.character.skills['Science (physics)'],1);assert.equal(r.state.character.skills['Science (chemistry)'],1);
 assert.equal(r.state.stage,'reeducation-roll');assert.equal(career(r).terms,0);assert.equal(career(r).mishap,true);roundtrip(r);
 r=rolledReeducation(r,6);r=run(r,'resolve-reeducation',{});assert.equal(career(r).terms,1);assert.equal(career(r).rank,0);assert.equal(career(r).benefitRolls,1);assert.equal(career(r).forcedExit,true);assert.equal(r.log.at(-1).rolls.length,0);
});
test('Scholar SOC10 secret research awards two skills but does not trigger Prole re-education',()=>{
 let r=buildScholarChoiceFixture({soc:10});r=run(r,'choose-skill',{name:'Science (physics)'});r=run(r,'choose-skill',{name:'Science (chemistry)'});
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.reeducations,undefined);assert.equal(career(r).forcedExit,true);assert.equal(career(r).benefitRolls,0);assert.equal(career(r).rank,0);roundtrip(r);
});
test('open Scholar research awards exactly one Science and retains ordinary failed-survival departure',()=>{
 let r=buildScholarChoiceFixture({secret:false});r=run(r,'choose-skill',{name:'Science (physics)'});
 assert.equal(r.state.stage,'term-end');assert.equal(career(r).terms,1);assert.equal(career(r).forcedExit,true);assert.equal(r.state.character.reeducations,undefined);assert.equal(r.log.at(-1).rolls.length,0);
});
test('Scholar Event3 distinct choices retain following Enemy roll and benefit award without a second ordinary Event',()=>{
 let r=buildScholarChoiceFixture({event:true});assert.equal(career(r).benefitRolls,1);
 r=run(r,'choose-skill',{name:'Science (physics)'});r=run(r,'choose-skill',{name:'Science (chemistry)'});
 assert.equal(r.state.stage,'advancement');assert.equal(career(r).terms,0);assert.equal(career(r).benefitRolls,1);
 assert.ok(r.state.character.relationships.some(x=>x.role==='Enemy'));assert.equal(r.log.at(-1).rolls.length,1);assert.match(r.log.at(-1).rolls[0].label,/Enemy/);roundtrip(r);
});
test('protected Scholar secret research preserves its stay and benefit loss through re-education',()=>{
 let r=buildScholarChoiceFixture({protectedStay:true});r=run(r,'choose-skill',{name:'Science (physics)'});r=run(r,'choose-skill',{name:'Science (chemistry)'});
 r=rolledReeducation(r,1);r=run(r,'resolve-reeducation',{chronology:chronology('after-current-term')});
 assert.equal(r.state.stage,'advancement');assert.equal(career(r).forcedExit,false);assert.equal(career(r).mishap,true);assert.equal(r.state.currentReeducation.status,'deferred');roundtrip(r);
});
test('Scholar selection retry and restore preserve distinctness state without duplicate awards',()=>{
 let r=run(scholar,'choose-skill',{name:'Science (physics)'},{id:'first-science'});
 assert.deepEqual(run(r,'choose-skill',{name:'Science (physics)'},{id:'first-science'}).session,r.session);
 r=run(r,'restore',{revision:scholar.revision});assert.deepEqual(r.state.pendingChoice.selected,[]);assert.equal(r.state.character.skills['Science (physics)'],undefined);
 r=run(r,'choose-skill',{name:'Science (biology)'});r=run(r,'choose-skill',{name:'Science (physics)'});assert.equal(r.state.stage,'reeducation-roll');roundtrip(r);
});
test('Government assassination check offers exactly PSI/Melee/Recon and native success stays without an ordinary Event',()=>{
 for(const index of [0,1,2]){
  let r=force(government,'choose-effect',{index},[6,6]);assert.equal(r.state.stage,'term-end');assert.equal(career(r).forcedExit,false);assert.equal(career(r).terms,1);
  assert.equal(career(r).benefitRolls,0);assert.equal(career(r).rank,0);assert.equal(r.log.at(-1).rolls.length,1);roundtrip(r);
 }
 rejected(government,'choose-effect',{index:3});
});
test('failed Government check reaches native injury without granting stay or a second Event',()=>{
 for(const index of [0,1,2]){
  const r=force(government,'choose-effect',{index},[1,1]);assert.ok(['injury-loss','injury-treatment','term-end'].includes(r.state.stage));
  assert.equal(career(r).forcedExit,true);assert.equal(career(r).terms,r.state.stage==='term-end'?1:0);assert.equal(r.state.character.injuries.at(-1).careerId,'zhodani.government');assert.equal(r.state.character.injuries.at(-1).contextSource.page,265);assert.ok(!r.log.at(-1).rolls.some(x=>x.label==='Event table'));roundtrip(r);
 }
});
test('protected Government successful check resumes the existing Event at advancement',()=>{
 let r=buildGovernmentCheckFixture({protectedStay:true});r=force(r,'choose-effect',{index:0},[6,6]);
 assert.equal(r.state.stage,'advancement');assert.equal(career(r).forcedExit,false);assert.equal(career(r).terms,0);assert.equal(r.log.at(-1).rolls.length,1);roundtrip(r);
});
test('revision .6 rejects every prior candidate unchanged before replay',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.17');
 for(const rev of [2,3,4,5]){const old=structuredClone(prole.session);old.rulesRevision='character-preview-2026-11-08.'+rev;const before=JSON.stringify(old);
 const r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),before);}
});

test('distinct Scholar partial progress survives a skill-cap source stop without replaying the first award',()=>{
 let r=run(scholar,'choose-skill',{name:'Science (physics)'});
 r=run(r,'gm-override',{field:'stat.INT',value:0,reason:'Skill-cap boundary fixture'});r=run(r,'gm-override',{field:'stat.EDU',value:0,reason:'Skill-cap boundary fixture'});
 r=run(r,'choose-skill',{name:'Science (chemistry)'});assert.equal(r.state.stage,'book-step');
 assert.deepEqual(r.state.pending.effect.selected,['Science (physics)']);assert.equal(r.state.pending.effect.count,1);assert.equal(r.state.character.skills['Science (physics)'],1);
 r=run(r,'resolve-book',{confirmed:true,note:'Referee discards the remaining over-cap award.',effects:[]});assert.equal(r.state.stage,'reeducation-roll');
 assert.equal(r.state.character.skills['Science (chemistry)'],undefined);roundtrip(r);
});

test('public permanent PSI loss removes only the Government PSI defence, preserves alternatives and replay',()=>{
 let r=buildGovernmentLostPsiFixture();assert.equal(r.state.character.psionicLoss.permanent,true);assert.equal(r.state.character.stats.PSI,0);
 assert.deepEqual(r.state.pendingChoice.options.map(o=>o.label),['Melee','Recon']);assert.deepEqual(r.state.pendingChoice.unavailableOptions,[{label:'PSI',reason:'Permanent psionic loss prevents this defence option.'}]);
 assert.equal(r.state.pendingChoice.source.page,265);roundtrip(r);
 rejected(r,'choose-effect',{index:2});r=force(r,'choose-effect',{index:1},[6,6]);
 assert.equal(r.state.stage,'ageing');assert.equal(career(r).forcedExit,false);assert.equal(r.state.character.psionicLoss.permanent,true);
 assert.equal(r.log.at(-1).rolls[0].label,'Skill check');assert.ok(!r.log.at(-1).rolls.some(x=>x.label==='PSI check'));roundtrip(r);
});
