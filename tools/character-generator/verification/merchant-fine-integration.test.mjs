import {settle} from './career-transfer-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project,RULES_REVISION} from '../engine/session.mjs';
import {buildMerchantFineFixture,rolledMerchantFine,run,rejected,force} from './merchant-fine-fixtures.mjs';
import {chronology,rolledReeducation} from './zhodani-reeducation-fixtures.mjs';
const ordinary=buildMerchantFineFixture({cash:6000}),noble=buildMerchantFineFixture({cash:6000,soc:10}),protectedFine=buildMerchantFineFixture({cash:6000,protectedStay:true});
function roundtrip(r){assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);}
const record=r=>r.state.character.careers[r.state.active];
test('public source-earned fine has an immutable context and no premature fine or term',()=>{
 const r=ordinary,f=r.state.currentMerchantFine;assert.equal(r.state.stage,'merchant-fine-roll');assert.equal(f.source.page,269);assert.equal(f.die,null);assert.equal(f.amount,null);
 assert.equal(f.origin.row,3);assert.equal(f.origin.careerId,'zhodani.merchant');assert.equal(f.context.cash,6000);
 assert.equal(r.state.character.age,18);assert.equal(record(r).terms,0);assert.deepEqual(r.state.merchantFineOptions,[]);roundtrip(r);
});
test('all six public dice are audited and payment applies once with p14 next-term continuation',()=>{
 for(let die=1;die<=6;die++){
  let r=rolledMerchantFine(ordinary,die);assert.equal(r.state.currentMerchantFine.die,die);assert.equal(r.log.at(-1).rolls[0].label,'Merchant mishap fine');
  const before=r;r=run(r,'gm-mode',{enabled:false});r=run(r,'resolve-merchant-fine',{decision:'pay'},{id:'paid-once'});
  assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.cash,6000-die*1000);assert.equal(r.state.character.debt,0);assert.equal(r.state.character.age,22);
  assert.equal(record(r).terms,1);assert.equal(record(r).rank,0);assert.equal(record(r).benefitRolls,0);assert.equal(record(r).forcedExit,false);
  assert.equal(r.state.character.reeducations,undefined);assert.equal(r.state.currentMerchantFine.status,'completed');
  assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.nonCareerMonths,undefined);
  const again=run(r,'resolve-merchant-fine',{decision:'pay'},{id:'paid-once'});assert.deepEqual(again.session,r.session);
  rejected(r,'resolve-merchant-fine',{decision:'pay'},/pending/);roundtrip(r);assert.equal(before.state.currentMerchantFine.payment,null);
 }
});
test('unaffordable pay rejects without mutation; affordable SOC10 decline leaves with no debt or re-education',()=>{
 let r=buildMerchantFineFixture({cash:999});r=rolledMerchantFine(r,1);assert.equal(r.state.merchantFineOptions[0].available,false);rejected(r,'resolve-merchant-fine',{decision:'pay'},/Insufficient/);
 r=rolledMerchantFine(noble,2);assert.equal(r.state.merchantFineOptions[0].available,true);r=run(r,'resolve-merchant-fine',{decision:'decline'});
 assert.equal(r.state.stage,'term-end');assert.equal(record(r).forcedExit,true);assert.equal(r.state.character.cash,6000);assert.equal(r.state.character.debt,0);assert.equal(r.state.character.reeducations,undefined);roundtrip(r);
});
test('SOC9 decline links a separate re-education episode and preserves the payment context',()=>{
 let r=run(rolledMerchantFine(ordinary,2),'resolve-merchant-fine',{decision:'decline'});
 assert.equal(r.state.stage,'reeducation-roll');assert.equal(r.state.character.age,18);assert.equal(record(r).terms,0);
 assert.equal(r.state.currentMerchantFine.reeducationId,r.state.currentReeducation.id);assert.equal(r.state.currentReeducation.origin.merchantFineId,r.state.currentMerchantFine.id);
 assert.equal(r.state.currentReeducation.origin.nonpaymentDischarge,true);assert.equal(r.state.currentReeducation.origin.explicitDischarge,true);
 assert.equal(r.state.character.cash,6000);assert.equal(r.state.character.debt,0);roundtrip(r);
 r=rolledReeducation(r,6);r=run(r,'resolve-reeducation',{});assert.equal(record(r).benefitRolls,1);assert.equal(record(r).forcedExit,true);assert.equal(record(r).terms,1);
});
test('unprotected nonpayment row2 requires explicit disposition; either chronology closes the career term once',()=>{
 for(const mode of ['before-resume','after-current-term'])for(const disposition of ['stay','leave']){
  let r=run(rolledMerchantFine(ordinary,1),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,2);
  assert.ok(r.state.reeducationRequirements.some(x=>x.key==='disposition'));rejected(r,'resolve-reeducation',{chronology:chronology(mode)},/disposition/);
  r=run(r,'resolve-reeducation',{chronology:chronology(mode),disposition:{mode:disposition,reason:'Referee resolves the p269/p276 permission precedence.'}});
  assert.equal(r.state.stage,'term-end');assert.equal(record(r).forcedExit,disposition==='leave');assert.equal(record(r).terms,1);
  assert.equal(r.state.character.age,26);assert.equal(r.state.character.nonCareerMonths,48);assert.equal(record(r).benefitRolls,0);assert.equal(record(r).rank,0);roundtrip(r);
 }
});
test('row1/3 discharge and row4 unchanged disposition remain effective after the unpaid fine',()=>{
 for(const row of [1,3,4]){
  let r=run(rolledMerchantFine(ordinary,1),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,row);
  r=run(r,'resolve-reeducation',{chronology:chronology('before-resume'),...(row>=3?{duration:{months:6,reason:'Referee duration within the printed range.'}}:{})});
  assert.equal(record(r).forcedExit,true);assert.equal(record(r).terms,1);assert.equal(record(r).benefitRolls,0);assert.equal(r.state.character.nonCareerMonths,row===1?48:6);roundtrip(r);
 }
});
test('protected Event2 pay and decline retain the existing after-event continuation without a second Event',()=>{
 for(const decision of ['pay','decline']){
  let r=run(rolledMerchantFine(protectedFine,2),'resolve-merchant-fine',{decision});
  if(decision==='decline'){assert.equal(r.state.currentReeducation.origin.protectedStay,true);r=rolledReeducation(r,1);r=run(r,'resolve-reeducation',{chronology:chronology('before-resume')});}
  assert.equal(r.state.stage,'advancement');assert.equal(record(r).forcedExit,false);assert.equal(record(r).terms,0);assert.equal(record(r).mishap??false,false);
  assert.equal(r.log.at(-1).rolls.length,0);roundtrip(r);
 }
});
test('protected row2 needs no disposition ruling and its deferred treatment resumes once',()=>{
 let r=run(rolledMerchantFine(protectedFine,1),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,2);
 assert.equal(r.state.reeducationRequirements.some(x=>x.key==='disposition'),false);
 r=run(r,'resolve-reeducation',{chronology:chronology('after-current-term')});
 assert.equal(r.state.stage,'advancement');assert.equal(r.state.currentReeducation.status,'deferred');assert.equal(r.state.character.nonCareerMonths,undefined);
 roundtrip(r);
});
test('initial and later re-education fines have distinct dice and payments, without retroactive initial debt',()=>{
 let r=run(rolledMerchantFine(ordinary,2),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,5);r=force(r,'reeducation-fine',{},[3]);
 const original=structuredClone(r.state.currentMerchantFine);r=run(r,'resolve-reeducation',{});
 assert.deepEqual(r.state.currentMerchantFine,original);assert.equal(r.state.currentMerchantFine.die,2);assert.equal(r.state.currentMerchantFine.payment,null);
 assert.equal(r.state.currentReeducation.fineDie,3);assert.deepEqual(r.state.currentReeducation.finePayment,{amount:3000,funding:'cash'});
 assert.equal(r.state.character.cash,3000);assert.equal(r.state.character.debt,0);assert.equal(record(r).forcedExit,true);roundtrip(r);
});
test('pending commands are strict, block unrelated changes and preserve action retry/restore/replay semantics',()=>{
 let r=ordinary;rejected(r,'merchant-fine-roll',{die:1},/engine-generated/);rejected(r,'gm-override',{field:'cash',value:50000,reason:'Cannot change pending funds'},/pending Merchant/);
 r=rolledMerchantFine(r,2);rejected(r,'merchant-fine-roll',{},/pending/);rejected(r,'resolve-merchant-fine',{decision:'pay',debt:1},/only/);
 rejected(r,'resolve-merchant-fine',{decision:'debt'},/pay or decline/);rejected(r,'leave-career',{},/pending Merchant/);rejected(r,'continue-career',{},/pending Merchant/);
 const pending=r,original=r.log.findLast(e=>e.type==='merchant-fine-roll');
 r=run(r,'resolve-merchant-fine',{decision:'pay'});r=run(r,'restore',{revision:pending.revision});assert.equal(r.state.currentMerchantFine.status,'decision');assert.equal(r.state.character.cash,6000);roundtrip(r);
 r=run(r,'gm-replay',{revision:original.number,rollIndex:0,values:[4],reason:'Referee corrected the initial fine die.'});
 assert.equal(r.state.currentMerchantFine.die,4);assert.equal(r.state.currentMerchantFine.payment,null);assert.equal(record(r).terms,0);roundtrip(r);
});
test('revision .6 rejects earlier published revisions before reconstruction without modifying old bytes',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-08.6');
 for(const rulesRevision of ['character-preview-2026-11-08.2','character-preview-2026-11-08.3','character-preview-2026-11-08.4']){
  const old=structuredClone(ordinary.session);old.rulesRevision=rulesRevision;old.events.push({invalid:true});const bytes=JSON.stringify(old);
  const out=api({operation:'project',session:old});assert.equal(out.ok,false);assert.match(out.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
 }
});

test('protected deferred row2 completes after advancement with one ordinary benefit and no treatment career credit',()=>{
 let r=run(rolledMerchantFine(protectedFine,1),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,2);
 r=run(r,'resolve-reeducation',{chronology:chronology('after-current-term')});r=force(r,'advancement',{},[4,5]);
 // Rank one grants Broker 1 directly; the normal advancement training is still distinct.
 assert.equal(r.state.stage,'training');r=settle(force(r,'training',{table:'personal'},[1]));
 assert.equal(r.state.stage,'term-end');assert.equal(record(r).terms,1);assert.equal(record(r).rank,1);assert.equal(record(r).benefitRolls,1);
 assert.equal(r.state.character.age,26);assert.equal(r.state.character.nonCareerMonths,48);assert.equal(r.state.currentReeducation.status,'completed');
 assert.equal(r.state.currentMerchantFine.payment,null);roundtrip(r);
});
test('protected SOC10 decline stays without re-education and preserves its original Event tail',()=>{
 let r=buildMerchantFineFixture({soc:10,protectedStay:true});r=rolledMerchantFine(r,6);r=run(r,'resolve-merchant-fine',{decision:'decline'});
 assert.equal(r.state.stage,'advancement');assert.equal(record(r).forcedExit,false);assert.equal(record(r).terms,0);
 assert.equal(r.state.character.cash,0);assert.equal(r.state.character.debt,0);assert.equal(r.state.character.reeducations,undefined);roundtrip(r);
});
test('replaying the later fine preserves the initial unpaid fine record and never retroactively finances it',()=>{
 let r=run(rolledMerchantFine(ordinary,2),'resolve-merchant-fine',{decision:'decline'});r=rolledReeducation(r,5);r=force(r,'reeducation-fine',{},[3]);
 const initial=structuredClone(r.state.currentMerchantFine),fine=r.log.findLast(e=>e.type==='reeducation-fine');
 r=run(r,'gm-replay',{revision:fine.number,rollIndex:0,values:[4],reason:'Referee correction of only the re-education fine.'});
 assert.deepEqual(r.state.currentMerchantFine,initial);assert.equal(r.state.currentReeducation.fineDie,4);assert.equal(r.state.character.cash,6000);
 r=run(r,'resolve-reeducation',{});assert.equal(r.state.character.cash,2000);assert.equal(r.state.character.debt,0);assert.deepEqual(r.state.currentMerchantFine,initial);roundtrip(r);
});
