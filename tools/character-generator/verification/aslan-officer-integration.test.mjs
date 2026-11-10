import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,project,importSession,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {buildAslanOfficerFixture,aslanSetup,aslanBenefits,aslanEvent,aslanEndTerm,run,force,rejected,settle} from './aslan-officer-fixtures.mjs';
const last=r=>r.state.character.careers.at(-1),offer=r=>r.state.currentAslanOfficerOffer;
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const begin=(r,assignment)=>run(r,'begin-aslan-officer',{offerId:r.state.aslanOfficerOptions[0].id,assignment:assignment??r.state.aslanOfficerOptions[0].assignments.find(a=>a.available).id});
const url=new URL('../engine/session.mjs',import.meta.url);let src=await readFile(url,'utf8');src=src.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));src+='\nexport const officerAudit={apply,drainEffects,aslanOfficerOptions,refreshAslanOfficerOffers,forfeitAslanClanShares,rankEffects};';const {officerAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
for(const o of [{},{origin:'spacer',eventResult:5},{origin:'spacer',eventResult:10}])test('source event offer '+JSON.stringify(o)+' keeps current career until next term',()=>{
 const r=buildAslanOfficerFixture(o),c=last(r),p=r.state.aslanOfficerOptions[0];assert.equal(r.state.stage,'term-end');assert.equal(c.terms,1);assert.equal(r.state.character.careers.length,1);assert.equal(p.qualificationDM,1);assert.equal(p.available,true);assert.equal(p.earlyExit,true);
 assert.equal(offer(r).originCareerIndex,0);assert.equal(offer(r).originCareerTermsAtGrant,0);assert.equal(offer(r).availableAtCompletedTerms,1);assert.equal(offer(r).check,null);assert.ok(!p.training);roundtrip(r);
});
test('gender prerequisites are validated before exit, benefits or dice',()=>{
 for(const [o,allowed]of [[{},['assassin','leader']],[{gender:'female'},['executive']],[{origin:'spacer'},['commander']],[{origin:'spacer',gender:'female'},['navigator','shipmaster']]]){
  const r=buildAslanOfficerFixture(o),p=r.state.aslanOfficerOptions[0];assert.deepEqual(p.assignments.filter(a=>a.available).map(a=>a.id).sort(),allowed.sort());
  for(const bad of p.assignments.filter(a=>!a.available))rejected(r,'begin-aslan-officer',{offerId:p.id,assignment:bad.id});
  rejected(r,'begin-aslan-officer',{offerId:p.id});rejected(r,'begin-aslan-officer',{offerId:p.id,assignment:allowed[0],roll:12});
 }
});
test('waived exit preserves original benefits then requires one genuine officer qualification',()=>{
 let r=buildAslanOfficerFixture(),before=structuredClone(last(r)),terms=r.state.character.terms,age=r.state.character.age;r=begin(r,'leader');
 assert.equal(r.state.stage,'benefits');assert.equal(offer(r).status,'mustering-out');assert.equal(offer(r).commitment.mode,'waived-early-exit');assert.equal(last(r).exit,'voluntary');
 rejected(r,'qualify-aslan-officer');rejected(r,'career',{id:'aslan.agent',assignment:'spy'});rejected(r,'gm-override',{field:'cash',value:100000,reason:'Pending context must be immutable'});
 r=aslanBenefits(r);assert.equal(r.state.stage,'aslan-officer-entry');const history=structuredClone(r.state.character.benefitRollHistory),benefits=structuredClone(r.state.character.benefits);
 assert.equal(last(r).totalBenefits,before.benefitRolls+1);assert.equal(last(r).benefitRolls,0);r=settle(force(r,'qualify-aslan-officer',{},[6,6]));
 assert.equal(last(r).id,'aslan.military-officer');assert.equal(last(r).rank,0);assert.equal(last(r).officer,false);assert.equal(last(r).terms,0);assert.equal(r.state.character.terms,terms);assert.equal(r.state.character.age,age);
 assert.equal(offer(r).check.natural,12);assert.equal(offer(r).check.dm,6);assert.equal(offer(r).check.modifier,1);assert.equal(offer(r).check.total,19);assert.equal(offer(r).status,'entered');
 assert.deepEqual(r.state.character.benefitRollHistory,history);assert.deepEqual(r.state.character.benefits,benefits);assert.equal(r.state.character.careerTransitions.at(-1).automaticReason,null);
 rejected(r,'qualify-aslan-officer');rejected(r,'begin-aslan-officer',{offerId:offer(r).id,assignment:'leader'});roundtrip(r);
});
test('DM uses the three completed originating terms rather than event-time terms or other careers',()=>{
 const r=buildAslanOfficerFixture({termsBefore:2,ready:true});assert.equal(offer(r).originCareerTermsAtGrant,2);assert.equal(offer(r).qualificationDM,3);assert.equal(offer(r).commitment.mode,'ordinary-exit');
 const x=force(r,'qualify-aslan-officer',{},[1,1]);assert.equal(offer(x).check.modifier,3);assert.equal(offer(x).check.total,11);assert.equal(offer(x).check.success,true);
});
test('qualification failure forfeits held Rite and just-mustered Clan Shares but not other property',()=>{
 let r=buildAslanOfficerFixture({riteShares:true});r=run(r,'gm-override',{field:'cash',value:12345,reason:'Pre-existing cash preservation'});r=begin(r);
 r=aslanBenefits(r);const shares=r.state.character.benefits.find(x=>x.definitionId==='aslan.clan-share').quantity,awards=structuredClone(r.state.character.benefitAwards),history=structuredClone(r.state.character.benefitRollHistory);
 assert.ok(shares>=3);r=force(r,'qualify-aslan-officer',{},[1,1]);assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.character.stats.SOC,2);assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.cash,12345);
 assert.equal(offer(r).status,'failed');assert.equal(r.state.character.benefits.length,0);const loss=r.state.character.aslanStatusChanges[0];assert.equal(loss.careerIndex,0);assert.equal(loss.removed[0].quantity,shares);assert.equal(loss.awardIds.length,awards.length);
 assert.deepEqual(r.state.character.benefitRollHistory,history);assert.ok(r.state.character.benefitAwards.every((x,i)=>x.quantity===awards[i].quantity&&x.forfeited&&x.received===false&&x.forfeitureIds[0]===loss.id));
 rejected(r,'qualify-aslan-officer');r=settle(run(r,'fallback',{draft:false}));assert.equal(last(r).id,'aslan.outcast');assert.equal(r.state.character.aslanStatusChanges.length,1);roundtrip(r);
});
test('early cancellation permits retirement only and never opens a generic early transfer',()=>{
 let r=buildAslanOfficerFixture({ready:true}),benefits=structuredClone(r.state.character.benefits),cash=r.state.character.cash;assert.deepEqual(offer(r).cancelOptions.map(x=>x.id),['retire']);
 rejected(r,'cancel-aslan-officer',{mode:'career-choice'});rejected(r,'leave-career');r=run(r,'cancel-aslan-officer',{mode:'retire'});assert.equal(r.state.stage,'retirement');assert.equal(r.state.character.retirementFromCreation,true);assert.equal(offer(r).check,null);assert.deepEqual(r.state.character.benefits,benefits);assert.equal(r.state.character.cash,cash);
 rejected(r,'career',{id:'aslan.scientist',assignment:'researcher'});r=run(r,'finish');while(r.state.stage==='skill-choice'){r=run(r,'choose-skill',{name:r.state.skillChoiceSuggestions[0]});}if(r.state.stage!=='finish')r=run(r,'finish');assert.equal(r.state.stage,'finish');roundtrip(r);
});
test('ordinary legal exit can cancel the unrolled offer without restoring benefits',()=>{
 let r=buildAslanOfficerFixture({termsBefore:2,ready:true}),benefits=structuredClone(r.state.character.benefits),history=structuredClone(r.state.character.benefitRollHistory);assert.deepEqual(offer(r).cancelOptions.map(x=>x.id),['career-choice','retire']);
 r=run(r,'cancel-aslan-officer',{mode:'career-choice'});assert.equal(r.state.stage,'career');assert.equal(offer(r).status,'cancelled');assert.equal(offer(r).check,null);assert.deepEqual(r.state.character.benefits,benefits);assert.deepEqual(r.state.character.benefitRollHistory,history);assert.equal(last(r).benefitRolls,0);roundtrip(r);
});
test('offer remains usable after an ordinary exit with benefits already resolved',()=>{
 let r=buildAslanOfficerFixture({termsBefore:2});r=aslanBenefits(run(r,'leave-career'));const history=structuredClone(r.state.character.benefitRollHistory);assert.equal(r.state.aslanOfficerOptions[0].available,true);r=begin(r,'leader');assert.equal(r.state.stage,'aslan-officer-entry');assert.deepEqual(r.state.character.benefitRollHistory,history);roundtrip(r);
});
test('forced stay blocks the waiver; an earned discharge permits the named opportunity',()=>{
 const stay=buildAslanOfficerFixture({forcedStay:true});assert.equal(stay.state.aslanOfficerOptions[0].available,false);rejected(stay,'begin-aslan-officer',{offerId:offer(stay).id,assignment:'leader'});
 let exit=buildAslanOfficerFixture({forcedExit:true});assert.equal(exit.state.aslanOfficerOptions[0].available,true);exit=aslanBenefits(begin(exit,'leader'));assert.equal(offer(exit).commitment.mode,'ordinary-exit');assert.ok(offer(exit).cancelOptions.some(x=>x.id==='career-choice'));roundtrip(exit);
});
test('continuing the originating career expires the one-use next-term offer immediately',()=>{
 let r=buildAslanOfficerFixture();r=run(r,'continue-career');assert.equal(offer(r).status,'expired');assert.equal(offer(r).expired.reason,'continued-originating-career');assert.equal(r.state.aslanOfficerOptions.length,0);rejected(r,'begin-aslan-officer',{offerId:offer(r).id,assignment:'leader'});roundtrip(r);
});
test('qualification replay can replace failure with success without duplicated forfeiture or benefits',()=>{
 const base=buildAslanOfficerFixture({riteShares:true,ready:true});let r=force(base,'qualify-aslan-officer',{},[1,1]),revision=base.revision+1;
 assert.equal(offer(r).status,'failed');r=run(r,'gm-replay',{revision,rollIndex:0,values:[6,6],reason:'Review the officer qualification roll'});assert.equal(offer(r).status,'entered');assert.equal(r.state.character.aslanStatusChanges,undefined);assert.equal(r.state.character.careers.length,2);assert.equal(r.state.character.outcast,undefined);assert.deepEqual(r.state.character.benefitRollHistory,base.state.character.benefitRollHistory);roundtrip(r);
 r=run(r,'restore',{revision:base.revision});assert.equal(offer(r).status,'ready');assert.equal(r.state.character.careers.length,1);roundtrip(r);
});
test('duplicate command ID is idempotent and player restore remains rejected',()=>{
 const base=buildAslanOfficerFixture({ready:true});let r=run(base,'qualify-aslan-officer',{}, {id:'officer-once'});const saved=exportSession(r.session);r=run(r,'qualify-aslan-officer',{}, {id:'officer-once'});assert.equal(exportSession(r.session),saved);r=run(r,'gm-mode',{enabled:false});rejected(r,'restore',{revision:base.revision});roundtrip(r);
});
for(const tableId of ['pilot-gunner','engineer-crew'])test('legacy female Space Officer preserves successful check through explicit '+tableId+' mapping',()=>{
 let r=settle(force(buildAslanOfficerFixture({origin:'spacer',gender:'female',ready:true,rulesRevision:'character-preview-2026-11-09.17'}),'qualify-aslan-officer',{},[6,6]));assert.equal(r.state.stage,'aslan-officer-rank');const check=structuredClone(offer(r).check),rolls=structuredClone(r.log.findLast(e=>e.type==='qualify-aslan-officer').rolls);
 assert.deepEqual(offer(r).rankOptions.map(x=>x.id),['pilot-gunner','engineer-crew']);rejected(r,'resolve-aslan-officer-rank',{tableId});rejected(r,'resolve-aslan-officer-rank',{tableId:'navigator',reason:'Invalid invented mapping'});
 r=run(r,'gm-mode',{enabled:false});rejected(r,'resolve-aslan-officer-rank',{tableId,reason:'Source reading'});r=run(r,'gm-mode',{enabled:true});r=run(r,'resolve-aslan-officer-rank',{tableId,reason:'Referee maps the printed heading to this selected assignment.'});
 assert.equal(r.state.stage,'training');assert.equal(last(r).aslanRankMapping.tableId,tableId);assert.deepEqual(offer(r).check,check);assert.deepEqual(r.log.findLast(e=>e.type==='qualify-aslan-officer').rolls,rolls);assert.equal(last(r).rank,0);rejected(r,'resolve-aslan-officer-rank',{tableId,reason:'Duplicate'});
 r=settle(force(r,'training',{table:'personal'},[1]));r=aslanEndTerm(settle(aslanEvent(r,8)));assert.equal(last(r).rank,1);assert.ok(r.state.character.skills[tableId==='pilot-gunner'?'Admin':'Astrogation']>=1);roundtrip(r);
});
test('historical source verification is GM-gated, offer-scoped and can decline without exit',()=>{
 const base=buildAslanOfficerFixture({historical:true});let r=begin(base,'leader');assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.kind,'aslan-officer-status');assert.deepEqual(r.state.pending.priorCareerIndices,[0]);const career=structuredClone(last(r));
 rejected(r,'resolve-book',{confirmed:true,aslanOfficerStatusApproved:true,note:'Missing explicit source confirmation'});
 r=run(r,'gm-mode',{enabled:false});rejected(r,'resolve-book',{confirmed:true,aslanOfficerStatusApproved:false,note:'Declined'});r=run(r,'gm-mode',{enabled:true});
 r=run(r,'resolve-book',{confirmed:true,aslanOfficerStatusApproved:false,note:'The referee did not verify a restoration or exception.'});assert.equal(r.state.stage,'term-end');assert.equal(offer(r).status,'declined');assert.deepEqual(last(r),career);assert.equal(offer(r).check,null);assert.equal(offer(r).statusVerification.approved,false);roundtrip(r);
 let approved=begin(base,'leader');approved=run(approved,'resolve-book',{confirmed:true,aslanOfficerStatusApproved:true,aslanOfficerStatusConfirmed:true,note:'Verified the earlier source-earned Outcast event 11 redemption.'});assert.equal(approved.state.stage,'benefits');assert.equal(offer(approved).statusVerification.approved,true);approved=aslanBenefits(approved);approved=settle(force(approved,'qualify-aslan-officer',{},[6,6]));assert.equal(offer(approved).status,'entered');assert.equal(offer(approved).qualificationDM,1);assert.equal(approved.state.character.careers.length,3);roundtrip(approved);
});
test('shared Aslan qualification failure handles first-career failure and retains non-share assets',()=>{
 let r=aslanSetup('first-aslan-failure','female',true);r=run(r,'gm-override',{field:'cash',value:4321,reason:'Existing cash'});r=force(r,'career',{id:'aslan.military-officer',assignment:'executive'},[1,1]);assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.character.stats.SOC,2);assert.equal(r.state.character.benefits.length,0);assert.equal(r.state.character.cash,4321);assert.equal(r.state.character.aslanStatusChanges[0].careerIndex,null);roundtrip(r);
 const s=structuredClone(buildAslanOfficerFixture().state);s.character.benefits=[{name:'Clan Share',quantity:2},{name:'Ship Share',quantity:3},{name:'Converted ship',assetId:'ship-1',quantity:1}];s.character.assets=[{id:'ship-1',active:true}];a.forfeitAslanClanShares(s,'test',{id:'aliens',page:22},true);assert.deepEqual(s.character.benefits.map(x=>x.name),['Ship Share','Converted ship']);assert.equal(s.character.assets[0].active,true);
});
test('new native Clan Share awards while Outcast are forfeited without erasing their award records',()=>{
 const s=structuredClone(buildAslanOfficerFixture().state);s.character.outcast=true;s.character.benefits=[];s.effectsQueue=[{kind:'benefit',name:'Clan Share',value:2,source:{id:'aliens',page:47}}];s.effectsNext='term-end';a.drainEffects(s,[]);assert.equal(s.character.benefits.length,0);assert.equal(s.character.aslanStatusChanges[0].removed[0].quantity,2);assert.equal(s.character.benefitAwards.at(-1).forfeited,true);assert.equal(s.character.benefitAwards.at(-1).quantity,2);
});
test('native Aslan benefit limits and male halving remain distinct from Core cash limits',()=>{
 let female=begin(buildAslanOfficerFixture({gender:'female',termsBefore:2}),'executive');while(female.state.stage==='benefits')female=settle(force(female,'benefit',{cash:true},[1]));assert.ok(female.state.cashRolls>3);assert.equal(female.state.stage,'aslan-officer-entry');
 const s=structuredClone(begin(buildAslanOfficerFixture(),'leader').state);s.character.skills.Independence=1;const before=s.character.cash;const rolls=[];a.apply(s,{type:'benefit',payload:{cash:true}},rolls);const d=rolls[0].values[0],cash=[500,500,1000,1000,5000,5000,10000,10000][d-1];assert.equal(s.character.cash-before,cash*0.5);
});
test('missing Rite uses the original pending offer command and keeps all original context',()=>{
 const s=structuredClone(buildAslanOfficerFixture({ready:true}).state);delete s.character.stats.RITE;let rolls=[];a.apply(s,{type:'qualify-aslan-officer',payload:{}},rolls);assert.equal(s.pending.kind,'missing-characteristic-check');assert.equal(s.pending.command.type,'qualify-aslan-officer');assert.equal(rolls.length,0);a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Source-approved missing Rite check',checkNatural:12,checkTotal:19}},rolls);a.refreshAslanOfficerOffers(s);assert.equal(s.character.aslanOfficerOffers[0].check.sourceAssisted,true);assert.equal(s.character.aslanOfficerOffers[0].status,'entered');
});
test('offer rechecks forced next career and current outcast restrictions without spending a roll',()=>{
 for(const patch of [{forcedCareer:'aslan.outcast'},{outcast:true},{qualificationBanned:true}]){
  const s=structuredClone(buildAslanOfficerFixture().state);if(patch.forcedCareer)s.forcedCareer=patch.forcedCareer;else Object.assign(s.character,patch);assert.equal(a.aslanOfficerOptions(s)[0].available,false);const before=structuredClone(s),rolls=[];assert.throws(()=>a.apply(s,{type:'begin-aslan-officer',payload:{offerId:'aslan-officer-1',assignment:'leader'}},rolls));assert.deepEqual(s,before);assert.equal(rolls.length,0);
 }
});
test('revision .10 rejects old .9 before replay without modifying the save',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.24');const old=structuredClone(buildAslanOfficerFixture().session);old.rulesRevision='character-preview-2026-11-08.9';const bytes=JSON.stringify(old);const result=api({operation:'project',session:old});assert.equal(result.ok,false);assert.match(result.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
});

for(const [assignment,tableId,skill] of [['shipmaster','pilot-gunner','Admin'],['navigator','engineer-crew','Astrogation']])test('resolved Space Officer mapping '+assignment+' applies without a GM mapping prompt',()=>{
 let r=settle(force(buildAslanOfficerFixture({origin:'spacer',gender:'female',ready:true,assignment}),'qualify-aslan-officer',{},[6,6]));assert.equal(r.state.stage,'training');assert.equal(last(r).aslanRankMapping.tableId,tableId);assert.equal(offer(r).rankMapping.tableId,tableId);rejected(r,'resolve-aslan-officer-rank',{tableId:tableId==='pilot-gunner'?'engineer-crew':'pilot-gunner',reason:'Cannot remap a resolved assignment'});roundtrip(r);
 r=settle(force(r,'training',{table:'personal'},[1]));r=aslanEndTerm(settle(aslanEvent(r,8)));assert.equal(last(r).rank,1);assert.ok(r.state.character.skills[skill]>=1);roundtrip(r);
 const direct=structuredClone(r.state);delete direct.character.careers.at(-1).aslanOfficerOfferId;delete direct.character.careers.at(-1).aslanRankMapping;direct.character.careers.at(-1).rank=3;const effects=a.rankEffects(direct);assert.equal(effects[0].name,assignment==='shipmaster'?'Advocate':'Electronics');assert.equal(direct.character.careers.at(-1).aslanRankMapping.tableId,tableId);
});
