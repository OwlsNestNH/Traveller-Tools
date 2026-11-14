import test from 'node:test';import assert from 'node:assert/strict';
import {copyWithAwardProvenance,markAwardEffects,inheritAwardOrigin,awardOrigin,beginAwardAction,recordSkillAward,appliedSkillAwards} from '../engine/award-provenance.mjs';
import {api,project,exportSession,createSession} from '../engine/session.mjs';
import {armyEntryAward,armyAcademyAwards,academyCommissionOffer,armyCommissionEvent,settleEffects,run,force} from './rank-award-fixtures.mjs';
import {admissionFixture} from './education-result-fixtures.mjs';
import {buildAssignmentFixture} from './assignment-fixtures.mjs';
import {aslanTemplateEntry,aslanTemplateTerm} from './aslan-template-fixtures.mjs';
import {vargrTemplateStart} from './vargr-template-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
import {readFile} from'node:fs/promises';
import {EXPANSION_PACK} from'../engine/expansion-pack.mjs';
import {awardFixture} from'./constrained-award-fixtures.mjs';
import {buildAslanOfficerFixture,settle,aslanEvent,aslanEndTerm} from'./aslan-officer-fixtures.mjs';
const engineURL=new URL('../engine/session.mjs',import.meta.url);let engineSource=await readFile(engineURL,'utf8');engineSource=engineSource.replace(/from\s+'(\.\.?\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,engineURL).href));engineSource+='\nexport const provenanceAudit={initial,queueEffects,apply};';const{provenanceAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(engineSource).toString('base64'));
const latest=r=>r.skillAwardPresentation.byAction[r.revision]??[];
test('origin metadata survives clone and explicit transformations without entering canonical objects',()=>{
 const original=[{kind:'choice',options:[{effects:[{kind:'skill',name:'Recon',mode:'set',value:1}]}]}],before=JSON.stringify(original),origin={kind:'rank',careerId:'core.army',rank:1};
 markAwardEffects(original,origin);assert.equal(JSON.stringify(original),before);
 const cloned=copyWithAwardProvenance(original),e=cloned[0].options[0].effects[0];assert.deepEqual(awardOrigin(e),origin);assert.deepEqual(cloned,structuredClone(original));
 const manufactured=inheritAwardOrigin(e,{...e,kind:'skill-choice'});assert.deepEqual(awardOrigin(manufactured),origin);assert.equal(Object.hasOwn(manufactured,'origin'),false);
 const state={};beginAwardAction(state);recordSkillAward(state,manufactured,'Recon',3,3);assert.equal(appliedSkillAwards(state)[0].changed,false);beginAwardAction(state);assert.deepEqual(appliedSkillAwards(state),[]);assert.deepEqual(appliedSkillAwards(copyWithAwardProvenance(state)),[]);
});
test('ordinary Army entry identifies the actual Private rank-zero award',()=>{
 const r=armyEntryAward(),p=r.skillAwardPresentation.pending;assert.equal(r.state.stage,'skill-choice');assert.equal(p.kind,'rank');assert.equal(p.rank,0);assert.equal(p.track,'enlisted');assert.equal(p.title,'Private');assert.equal(r.state.pendingChoice.value,1);
 const n=run(r,'choose-skill',{name:'Gun Combat (slug)'}),award=latest(n)[0];assert.equal(award.origin.rank,0);assert.equal(award.after,1);assert.equal(n.state.character.skills['Gun Combat (slug)'],1);assert.equal(Object.hasOwn(n.state.pendingChoice??{},'awardOrigin'),false);
});
test('academy and rank entitlements retain distinct sources without a second fixed-level increase',()=>{
 let r=armyAcademyAwards(false);assert.equal(r.state.stage,'skill-choice');assert.equal(r.skillAwardPresentation.pending.kind,'rank');assert.equal(r.skillAwardPresentation.pending.rank,0);assert.equal(r.state.character.skills['Gun Combat (slug)'],1);
 const old=Object.values(r.skillAwardPresentation.byAction).flat().find(a=>a.name==='Gun Combat (slug)');assert.equal(old.origin.kind,'academy-service');
 r=run(r,'choose-skill',{name:'Gun Combat (slug)'});const a=latest(r)[0];assert.equal(a.origin.kind,'rank');assert.equal(a.before,1);assert.equal(a.after,1);assert.equal(a.changed,false);assert.equal(r.state.character.skills['Gun Combat (slug)'],1);
 const raw=exportSession(r.session),loaded=api({operation:'import',raw});assert.deepEqual(loaded.state,r.state);assert.deepEqual(loaded.skillAwardPresentation,r.skillAwardPresentation);assert.equal(exportSession(loaded.session),raw);assert.equal(Object.keys(project(r.session)).includes('skillAwardPresentation'),false);
});
test('accepted honours commission starts officer one and never claims the unheld Private award',()=>{
 const offer=academyCommissionOffer(),before=offer.state.character.careers[0];assert.equal(offer.state.stage,'preterm-commission');assert.equal(before.officer,false);assert.equal(before.educationCommission.automatic,true);
 const r=armyAcademyAwards(true),awards=Object.values(r.skillAwardPresentation.byAction).flat();assert.equal(r.state.character.careers[0].officer,true);assert.equal(r.state.character.careers[0].rank,1);assert.equal(r.state.character.skills.Leadership,1);assert.equal(r.state.character.skills['Gun Combat (slug)'],1);
 assert.equal(awards.filter(a=>a.origin.kind==='rank'&&a.origin.rank===0).length,0);assert.ok(awards.some(a=>a.origin.kind==='rank'&&a.origin.track==='officer'&&a.name==='Leadership'));
 const accepted=run(offer,'preterm-commission',{attempt:true});assert.equal(accepted.log.at(-1).rolls.length,0);const declined=run(offer,'preterm-commission',{attempt:false});assert.equal(declined.state.character.careers[0].officer,false);assert.equal(declined.state.character.careers[0].rank,0);assert.equal(declined.log.at(-1).rolls.length,0);
});
test('an event commission offer is not acceptance; choosing advancement retains the enlisted track',()=>{
 const offer=armyCommissionEvent();assert.equal(offer.state.stage,'advancement');assert.equal(offer.state.character.careers[0].officer,false);assert.equal(offer.state.commissionAvailability.automatic,true);
 const accepted=run(offer,'commission');assert.equal(accepted.state.character.careers[0].officer,true);assert.equal(accepted.log.at(-1).rolls.length,0);assert.ok(latest(accepted).some(a=>a.name==='Leadership'&&a.origin.track==='officer'));
 const declined=run(offer,'advancement');assert.equal(declined.state.character.careers[0].officer,false);assert.equal(declined.state.character.careers[0].rank,1);assert.equal(declined.state.character.careers[0].automaticCommission,false);assert.equal(declined.log.at(-1).rolls.length,0);assert.ok(latest(declined).some(a=>a.name==='Recon'&&a.origin.title==='Lance Corporal'));
});
test('ordinary commission application still rolls once and repeated command IDs are idempotent',()=>{
 let r=armyEntryAward();r=run(r,'choose-skill',{name:'Gun Combat (slug)'});r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[2,3]);assert.equal(r.state.stage,'advancement');assert.equal(r.state.commissionAvailability.automatic,false);
 const command={type:'commission',payload:{}},id='rank-award-commission-once',first=api({operation:'command',session:r.session,command,id});assert.equal(first.ok,true);assert.equal(first.log.at(-1).rolls.length,1);
 const repeated=api({operation:'command',session:first.session,command,id});assert.equal(repeated.ok,true);assert.equal(repeated.revision,first.revision);assert.deepEqual(repeated.state,first.state);assert.deepEqual(repeated.skillAwardPresentation,first.skillAwardPresentation);assert.equal(exportSession(repeated.session),exportSession(first.session));
});
test('academy admission level-zero awards are not mislabelled graduation or rank awards',()=>{
 const r=admissionFixture('core.academy-army'),awards=Object.values(r.skillAwardPresentation.byAction).flat();assert.ok(awards.length>=6);assert.ok(awards.every(a=>a.origin.kind==='academy-entry'&&a.value===0&&a.mode==='set'));assert.ok(awards.some(a=>a.name==='Gun Combat'&&a.after===0));assert.equal(awards.some(a=>a.origin.kind==='rank'),false);
});
test('rank skill provenance is produced by the shared pipeline across ordinary Core careers',()=>{
 let count=0;
 for(const id of['core.agent','core.army','core.citizen','core.entertainer','core.marine','core.merchant','core.navy','core.noble','core.rogue','core.scholar','core.scout']){
  const r=buildAssignmentFixture({careerId:id}),awards=Object.values(r.skillAwardPresentation.byAction).flat().filter(a=>a.origin.kind==='rank');
  for(const a of awards){assert.equal(a.origin.careerId,id);assert.ok(Number.isInteger(a.origin.rank));assert.equal(a.origin.source.id,'core');assert.ok(a.after>=0);count++;}
  assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).skillAwardPresentation,r.skillAwardPresentation,id+' replay');
 }
 assert.ok(count>=10);
});
test('native Aslan and Vargr rank rewards retain their own career and source context',()=>{
 const aslanEntry=aslanTemplateEntry('aslan.military','warrior','male');assert.equal(Object.values(aslanEntry.skillAwardPresentation.byAction).flat().filter(a=>a.origin.kind==='rank').length,0,'Aslan Recruit has no skill award; do not import Army Private rules');const aslan=aslanTemplateTerm(aslanEntry);
 let vargr=settleAssignment(force(vargrTemplateStart(),'career',{id:'vargr.military',assignment:'army'},[6,6]));assert.equal(Object.values(vargr.skillAwardPresentation.byAction).flat().filter(a=>a.origin.kind==='rank').length,0,'Vargr Military rank zero has no skill award');vargr=force(vargr,'survival-check',{},[6,6]);vargr=settleAssignment(force(vargr,'career-event',{},[2,3]));vargr=settleAssignment(force(vargr,'advancement',{},[6,6]));
 for(const[id,r]of[['aslan.military',aslan],['vargr.military',vargr]]){
  const awards=Object.values(r.skillAwardPresentation.byAction).flat().filter(a=>a.origin.kind==='rank');assert.ok(awards.length,id);assert.ok(awards.every(a=>a.origin.careerId===id&&a.origin.source.id==='aliens'));assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).skillAwardPresentation,r.skillAwardPresentation);
 }
});
test('registered provenance survives cultural-effect replacement without changing its rules',()=>{
 const s=a.initial('origin-culture');s.deferredSpecializations=true;s.character.species='aslan';s.character.gender='male';s.character.stats={STR:7,DEX:7,END:7,INT:7,EDU:7,SOC:7};s.stage='career';const baseline=structuredClone(s),effects=structuredClone(EXPANSION_PACK['aslan.wanderer'].mishaps[5]),origin={kind:'test-recorded-origin'};
 markAwardEffects(effects,origin);beginAwardAction(s);a.queueEffects(s,effects,'career',[]);a.queueEffects(baseline,EXPANSION_PACK['aslan.wanderer'].mishaps[5],'career',[]);assert.deepEqual(s,baseline);assert.ok(appliedSkillAwards(s).some(x=>x.name==='Mechanic'&&x.origin.kind==='test-recorded-origin'));
});
test('source pause and retry preserve registered origin, while manual replacement never inherits it',()=>{
 const r=awardFixture('vargr.psion',6),s=r.state,origin={kind:'test-recorded-origin'},skills=structuredClone(s.character.skills);markAwardEffects([s.pendingChoice],origin);beginAwardAction(s);a.apply(s,{type:'choose-skill',payload:{name:'Science (unclassified field)'}},[]);assert.equal(s.stage,'book-step');assert.deepEqual(awardOrigin(s.pending.effect),origin);assert.deepEqual(s.character.skills,skills);
 a.apply(s,{type:'retry-skill-choice',payload:{}},[]);assert.deepEqual(awardOrigin(s.pendingChoice),origin);a.apply(s,{type:'choose-skill',payload:{name:'Science (unclassified field)'}},[]);beginAwardAction(s);a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Synthetic source eligibility ruling',effects:[{kind:'skill',name:'Science (unclassified field)',value:1}]}},[]);assert.equal(s.character.skills['Science (unclassified field)'],1);assert.deepEqual(appliedSkillAwards(s),[]);
});
test('legacy deferred rank awards retain source through allocation and restore',()=>{
 const session=createSession('legacy-rank-origin');session.rulesRevision='character-preview-2026-11-09.18';let r=api({operation:'import',raw:JSON.stringify(session)});for(const[type,payload]of[['setup',{species:'human'}],['gm-mode',{enabled:true}],['roll-statistics',{}],['accept-statistics',{}]])r=run(r,type,payload);r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=settleEffects(force(r,'career',{id:'core.army',assignment:'infantry'},[6,6]));assert.equal(r.state.stage,'survival');const pending=r.skillAwardPresentation.deferred.find(x=>x.origin?.kind==='rank');assert.ok(pending);const checkpoint=r.revision;r=run(r,'allocate-specializations');assert.equal(r.skillAwardPresentation.pending.rank,0);r=run(r,'choose-skill',{name:'Gun Combat (slug)'});assert.ok(latest(r).some(x=>x.origin.rank===0&&x.name==='Gun Combat (slug)'));r=run(r,'restore',{revision:checkpoint});assert.deepEqual(r.skillAwardPresentation.deferred.find(x=>x.id===pending.id).origin,pending.origin);assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).skillAwardPresentation,r.skillAwardPresentation);
});
test('legacy officer table rulings are labelled as referee-selected rather than canonical mappings',()=>{
 let r=settle(force(buildAslanOfficerFixture({origin:'spacer',gender:'female',ready:true,rulesRevision:'character-preview-2026-11-09.17'}),'qualify-aslan-officer',{},[6,6]));assert.equal(r.state.stage,'aslan-officer-rank');r=run(r,'resolve-aslan-officer-rank',{tableId:'pilot-gunner',reason:'Synthetic explicit printed-table ruling'});r=settle(force(r,'training',{table:'personal'},[1]));r=aslanEndTerm(settle(aslanEvent(r,8)));const rank=Object.values(r.skillAwardPresentation.byAction).flat().find(x=>x.origin.careerId==='aslan.space-officer'&&x.origin.rank===1);assert.ok(rank);assert.equal(rank.origin.mapping.kind,'referee-selected');assert.equal(rank.origin.mapping.tableId,'pilot-gunner');assert.equal(rank.name,'Admin');assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).skillAwardPresentation,r.skillAwardPresentation);
});
