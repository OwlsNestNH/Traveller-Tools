import test from 'node:test';import assert from 'node:assert/strict';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {buildLandClaimFixture,landPayload,landResolution,run,force,rejected} from './aslan-land-fixtures.mjs';
import {buildMaleShareAssetsFixture} from './clan-share-assets-fixtures.mjs';
import {buildClanSharesFixture,buildUnverifiedClanSharesFixture} from './clan-shares-fixtures.mjs';
import {buildOutlawDepartureFixture} from './aslan-outlaw-fixtures.mjs';
import {aslanEvent,aslanEndTerm,settle} from './aslan-officer-fixtures.mjs';
const claim=r=>r.state.character.landClaims[0],roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const resolve=(r,extra={},options={})=>run(r,'resolve-land-claim',{claimId:claim(r).id,...landResolution,...extra},options);
const unchanged=r=>{const c=r.state.character;return {age:c.age,terms:c.terms,stage:r.state.stage,active:r.state.active,cash:c.cash,debt:c.debt,stats:c.stats,skills:c.skills,careers:c.careers,cashRolls:r.state.cashRolls,benefitRollHistory:c.benefitRollHistory,medicalBills:c.medicalBills,medicalSettlements:c.medicalSettlements,family:c.aslanOrigin};};
function beforeClaim(soc=9){return run(buildMaleShareAssetsFixture(),'gm-override',{field:'stat.SOC',value:soc,reason:'Recorded current-SOC boundary for source land tests.'});}

test('printed land redemption works in player mode and creates only a delayed claim',()=>{
 let r=run(beforeClaim(),'gm-mode',{enabled:false});const before=unchanged(r);r=run(r,'redeem-clan-shares',landPayload(r));assert.deepEqual(unchanged(r),before);assert.equal(r.state.character.careers.length,0);assert.equal(r.state.character.assets,undefined);assert.equal(claim(r).status,'pending');assert.equal(claim(r).assetId,null);assert.equal(claim(r).parcels,10);assert.equal(claim(r).socAtRedemption,9);assert.equal(claim(r).world.catalogChecked,false);assert.equal(claim(r).quantity,3);assert.equal(r.state.character.clanShareLots[0].spent,3);assert.equal(r.state.character.clanShareLots[0].available,3);assert.equal(r.state.character.benefitAwards[0].quantity,6);assert.equal(r.log.at(-1).rolls.length,1);assert.deepEqual(claim(r).delayRoll,r.log.at(-1).rolls[0]);assert.equal(claim(r).delayYears,claim(r).delayRoll.values[0]+3);roundtrip(r);
});

test('delay boundary rolls retain raw dice, modifier and frozen parcel calculation',()=>{for(const die of [1,6]){const r=buildLandClaimFixture({soc:10,shares:4,die});assert.equal(claim(r).parcels,120);assert.deepEqual(claim(r).delayRoll.values,[die]);assert.equal(claim(r).delayRoll.modifier,3);assert.equal(claim(r).delayYears,die+3);assert.equal(claim(r).eligibleAge,14+die+3);assert.equal(r.state.landClaimOptions.claims[0].mature,false);roundtrip(r);}});

test('world, eligibility, minimum quantity and optional fields reject without accepted dice or spending',()=>{
 const r=beforeClaim(),p=landPayload(r);for(const extra of [{world:null},{world:{}},{world:{name:'Only name'}},{world:{name:'Name',location:false}},{world:{name:'Name',location:'Place',reference:false}},{world:{name:'Name',location:'Place',uwp:'invented'}},{world:{name:'x'.repeat(121),location:'Place'}},{inputs:[{lotId:'clan-lot-1',quantity:2}]},{inputs:[{lotId:'clan-lot-1',quantity:7}]},{delayYears:0},{owned:true},{mature:true},{parcelRuling:null},{parcelRuling:undefined}])rejected(r,'redeem-clan-shares',{...p,...extra});assert.equal(r.state.character.landClaims,undefined);assert.equal(r.state.character.clanShareLots[0].available,6);
 const low=beforeClaim(8);rejected(low,'redeem-clan-shares',landPayload(low),/SOC/);const female=run(buildClanSharesFixture(),'gm-override',{field:'stat.SOC',value:9,reason:'Female land source boundary'});rejected(female,'redeem-clan-shares',landPayload(female),/male source/);assert.ok(female.state.clanShareOptions.choices.every(x=>x.id!=='land'));
});

test('unprinted SOC uses explicit GM baseline and never reuses the initial family estate',()=>{
 const r=beforeClaim(18),p=landPayload(r),estate=structuredClone(r.state.character.aslanOrigin.estate);assert.equal(r.state.clanShareOptions.landRules.requiresParcelRuling,true);assert.equal(r.state.clanShareOptions.landRules.minimumParcels,null);rejected(r,'redeem-clan-shares',p,/unprinted/);rejected(run(r,'gm-mode',{enabled:false}),'redeem-clan-shares',{...p,parcelRuling:{minimumParcels:200,increment:7,reason:'Verified unprinted row'}},/GM/);
 for(const parcelRuling of [{minimumParcels:0,increment:1,reason:'Invalid'},{minimumParcels:200,increment:false,reason:'Invalid'},{minimumParcels:200,increment:7,reason:''},{minimumParcels:200,increment:7,reason:'Valid',extra:true}])rejected(r,'redeem-clan-shares',{...p,parcelRuling});
 const next=force(r,'redeem-clan-shares',{...p,inputs:[{lotId:'clan-lot-1',quantity:5}],parcelRuling:{minimumParcels:200,increment:7,reason:'Referee confirms the minimum and increment for current SOC18.'}},[2]);assert.equal(claim(next).parcels,214);assert.equal(claim(next).parcelRuling.method,'referee-baseline');assert.deepEqual(next.state.character.aslanOrigin.estate,estate);assert.equal(claim(next).eligibleAge,19);roundtrip(next);
});

test('overflow ruling rejects atomically rather than silently rounding parcel totals',()=>{const r=beforeClaim(18);rejected(r,'redeem-clan-shares',{...landPayload(r,{shares:4}),parcelRuling:{minimumParcels:Number.MAX_SAFE_INTEGER,increment:1,reason:'Source arithmetic boundary'}},/exact integer/);assert.equal(r.state.character.landClaims,undefined);});

test('multiple smaller lots combine into one claim while preserving every original award',()=>{
 let r=beforeClaim();r=run(r,'skip-precareer');r=settle(force(r,'career',{id:'aslan.military-officer',assignment:'leader'},[6,6]));r=aslanEndTerm(settle(aslanEvent(r,8)));for(const l of r.state.character.clanShareLots)r=run(r,'redeem-clan-shares',{kind:'ship-shares',inputs:[{lotId:l.id,quantity:4}]});const lots=structuredClone(r.state.character.clanShareLots);assert.deepEqual(lots.map(l=>l.available),[2,2]);assert.equal(r.state.clanShareOptions.choices.find(c=>c.id==='land').available,true);
 r=run(r,'redeem-clan-shares',{...landPayload(r),inputs:[{lotId:lots[0].id,quantity:2},{lotId:lots[1].id,quantity:1}]});assert.equal(claim(r).quantity,3);assert.equal(claim(r).inputs.length,2);assert.deepEqual(claim(r).inputs.map(x=>x.awardId),lots.map(l=>l.awardId));assert.deepEqual(r.state.character.clanShareLots.map(l=>l.available),[0,1]);roundtrip(r);
});

test('known quantity with unknown issuer allows land without inventing clan identity',()=>{
 let r=buildOutlawDepartureFixture({ready:true});r=run(r,'gm-override',{field:'stat.SOC',value:9,reason:'Verified current SOC9 after restoration.'});const l=r.state.character.clanShareLots.find(l=>l.available>0);assert.equal(l.clanId,null);r=run(r,'redeem-clan-shares',landPayload(r));assert.equal(claim(r).inputs[0].clanId,null);assert.equal(r.state.character.clanShareVerifications,undefined);assert.equal(claim(r).world.clanId,undefined);roundtrip(r);
});

test('unverified manual quantity still requires source verification before land redemption',()=>{let r=buildUnverifiedClanSharesFixture();r=run(r,'gm-override',{field:'stat.SOC',value:9,reason:'Land source boundary.'});rejected(r,'redeem-clan-shares',landPayload(r),/genuine/);r=run(r,'verify-clan-share-lot',{lotId:'clan-lot-1',reason:'Referee verifies the manually recorded quantity; issuing clan remains unknown.'});r=run(r,'redeem-clan-shares',landPayload(r));assert.equal(claim(r).inputs[0].clanId,null);roundtrip(r);});

test('maturity and GM actual-claim confirmation are mandatory with no automatic time advance',()=>{
 const r=buildLandClaimFixture();rejected(r,'resolve-land-claim',{claimId:claim(r).id,...landResolution},/mature/);let mature=buildLandClaimFixture({mature:true});const before=unchanged(mature);rejected(run(mature,'gm-mode',{enabled:false}),'resolve-land-claim',{claimId:claim(mature).id,...landResolution},/GM/);
 for(const extra of [{claimEstablished:false},{claimEstablished:'true'},{reason:false},{reason:''},{mode:'teleport'},{relativeName:null},{years:4},{assetId:'forged'}])rejected(mature,'resolve-land-claim',{claimId:claim(mature).id,...landResolution,...extra});mature=resolve(mature);assert.deepEqual(unchanged(mature),before);assert.equal(claim(mature).status,'claimed');assert.equal(claim(mature).assetId,'asset-1');assert.equal(claim(mature).claimResolution.travelSimulated,false);assert.equal(mature.state.character.assets[0].category,'land');assert.equal(mature.state.character.assets[0].assessedValue,undefined);assert.equal(mature.state.character.assets[0].ownership,'personal');assert.equal(mature.log.at(-1).rolls.length,0);roundtrip(mature);
});

test('relative administration requires source-earned Independence3 and explicit identity and completion',()=>{
 const low=buildLandClaimFixture({mature:true});assert.equal(low.state.landClaimOptions.claims[0].modes[1].available,false);rejected(low,'resolve-land-claim',{claimId:claim(low).id,...landResolution,mode:'relative-administration',relativeName:'Relative'},/Independence/);
 let r=buildLandClaimFixture({relative:true});assert.equal(r.state.character.skills.Independence,3);assert.equal(r.state.landClaimOptions.claims[0].modes[1].available,true);for(const extra of [{relativeName:''},{relativeName:false},{relativeName:'Relative',claimEstablished:false}])rejected(r,'resolve-land-claim',{claimId:claim(r).id,...landResolution,mode:'relative-administration',...extra});const before=unchanged(r);r=resolve(r,{mode:'relative-administration',relativeName:'Verified family administrator'});assert.deepEqual(unchanged(r),before);assert.equal(claim(r).claimResolution.independence,3);assert.equal(r.state.character.assets[0].administration.relativeName,'Verified family administrator');roundtrip(r);
});

test('later SOC loss and Outcast standing neither resize nor repossess converted claims',()=>{
 let r=buildLandClaimFixture({mature:true}),original=structuredClone(claim(r)),family=structuredClone(r.state.character.aslanOrigin);r=run(r,'gm-override',{field:'stat.SOC',value:2,reason:'Later personal status change does not alter the recorded land grant.'});r=run(r,'skip-precareer');r=settle(run(r,'career',{id:'aslan.outcast',assignment:'labourer'}));r=aslanEndTerm(settle(aslanEvent(r,6)));assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.clanShareLots[0].forfeited,3);assert.equal(claim(r).parcels,original.parcels);assert.equal(r.state.landClaimOptions.claims[0].available,true);
 const before=unchanged(r);r=resolve(r,{reason:'Referee confirms this pre-existing converted claim was actually established despite later Outcast status.'});assert.deepEqual(unchanged(r),before);assert.equal(claim(r).socAtRedemption,9);assert.equal(r.state.character.assets[0].parcels,10);assert.deepEqual(r.state.character.aslanOrigin,family);roundtrip(r);
});

test('ordinary source term completion can mature a claim but neither grants nor resolves it automatically',()=>{
 let r=buildLandClaimFixture();r=run(r,'skip-precareer');r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));r=aslanEndTerm(settle(aslanEvent(r,8)));assert.equal(r.state.character.age,18);assert.equal(r.state.character.terms,1);assert.equal(r.state.landClaimOptions.claims[0].mature,true);assert.equal(claim(r).status,'pending');assert.equal(r.state.character.assets,undefined);const before=unchanged(r);r=resolve(r);assert.deepEqual(unchanged(r),before);roundtrip(r);
});

test('due ordinary ageing and its continuation must finish before mature land can be recorded',()=>{
 let r=beforeClaim();r=run(r,'gm-override',{field:'age',value:38,reason:'Recorded late-life starting age for a due-ageing source fixture.'});r=force(r,'redeem-clan-shares',landPayload(r),[1]);r=run(r,'skip-precareer');r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));r=settle(aslanEvent(r,8));r=settle(force(r,'advancement',{},[4,5]));r=settle(force(r,'training',{table:'personal'},[1]));assert.equal(r.state.stage,'ageing');assert.equal(r.state.character.age,42);assert.equal(r.state.landClaimOptions.claims[0].mature,true);assert.equal(r.state.landClaimOptions.checkpointAvailable,false);rejected(r,'resolve-land-claim',{claimId:claim(r).id,...landResolution},/procedure/);r=settle(force(r,'ageing',{},[6,6]));assert.equal(r.state.stage,'term-end');const before=unchanged(r);r=resolve(r);assert.deepEqual(unchanged(r),before);roundtrip(r);
});

test('issue and resolution retries and imports cannot duplicate claims, assets or lot spending',()=>{
 const start=beforeClaim(),p=landPayload(start);let r=run(start,'redeem-clan-shares',p,{id:'land-issue-once'});assert.deepEqual(run(r,'redeem-clan-shares',p,{id:'land-issue-once'}).state,r.state);roundtrip(r);r=run(r,'gm-override',{field:'age',value:claim(r).eligibleAge,reason:'Recorded actual chronology for claim completion.'});r=resolve(r,{}, {id:'land-resolve-once'});assert.deepEqual(resolve(r,{}, {id:'land-resolve-once'}).state,r.state);rejected(r,'resolve-land-claim',{claimId:claim(r).id,...landResolution},/unresolved/);assert.equal(r.state.character.assets.length,1);assert.equal(r.state.character.landClaims.length,1);assert.equal(r.state.character.clanShareLots[0].spent,3);roundtrip(r);
});

test('delay replay supersedes later completion with original roll context and no duplicate asset',()=>{
 let r=beforeClaim();r=run(r,'redeem-clan-shares',landPayload(r));const issueRevision=r.revision;r=run(r,'gm-override',{field:'age',value:claim(r).eligibleAge,reason:'Recorded elapsed time'});r=resolve(r);r=run(r,'gm-replay',{revision:issueRevision,rollIndex:0,values:[6],reason:'Correct the original delay roll and supersede its later resolution.'});assert.deepEqual(claim(r).delayRoll.values,[6]);assert.equal(claim(r).delayYears,9);assert.equal(claim(r).eligibleAge,23);assert.equal(claim(r).status,'pending');assert.equal(r.state.character.assets,undefined);assert.equal(r.state.character.clanShareLots[0].spent,3);assert.equal(r.state.character.landClaims.length,1);roundtrip(r);
});

test('audited restore preserves old claim history while returning its unspent source lots',()=>{
 const start=beforeClaim();let r=run(start,'redeem-clan-shares',landPayload(start));r=run(r,'restore',{revision:start.revision});assert.equal(r.state.character.landClaims,undefined);assert.equal(r.state.character.clanShareLots[0].available,6);assert.ok(r.session.events.some(e=>e.command.type==='redeem-clan-shares'&&e.command.payload.kind==='land'));roundtrip(r);
});

test('new revision rejects .12 without mutating or reconstructing original saves',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.24');const old=structuredClone(beforeClaim().session);old.rulesRevision='character-preview-2026-11-08.12';const bytes=JSON.stringify(old),r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
});
