import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {clanShareLotInvariant} from '../engine/clan-shares.mjs';
import {buildClanSharesFixture,buildUnverifiedClanSharesFixture,buildClanShareMedicalFixture,run,force,rejected} from './clan-shares-fixtures.mjs';
import {aslanEvent,aslanEndTerm,aslanBenefits,settle,buildAslanOfficerFixture} from './aslan-officer-fixtures.mjs';
import {buildOutlawDepartureFixture} from './aslan-outlaw-fixtures.mjs';
import {buildProleLossFixture} from './zhodani-choice-fixtures.mjs';
import {rolledReeducation,chronology} from './zhodani-reeducation-fixtures.mjs';
const lot=r=>r.state.character.clanShareLots[0];
const payload=(r,kind,quantity=1,extra={})=>({kind,inputs:[{lotId:lot(r).id,quantity}],...extra});
const exchange=(r,kind,quantity=1,extra={},options={})=>run(r,'redeem-clan-shares',payload(r,kind,quantity,extra),options);
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const unchanged=r=>{const c=r.state.character;return {age:c.age,terms:c.terms,stage:r.state.stage,active:r.state.active,careers:c.careers,stats:c.stats,cashRolls:r.state.cashRolls,benefitRollHistory:c.benefitRollHistory,estate:c.aslanOrigin?.estate,assets:c.assets};};

test('rite-earned source lot is usable without any career and retains immutable award provenance',()=>{
 let r=buildClanSharesFixture();const before=unchanged(r),award=structuredClone(r.state.character.benefitAwards[0]);
 assert.equal(r.state.character.careers.length,0);assert.equal(lot(r).awarded,6);assert.equal(lot(r).clanId,'origin-clan');assert.equal(r.state.clanShareOptions.checkpointAvailable,true);
 r=run(r,'gm-mode',{enabled:false});r=exchange(r,'cash',2);assert.equal(r.state.character.cash,20000);assert.deepEqual(unchanged(r),before);
 assert.equal(lot(r).available,4);assert.equal(lot(r).spent,2);assert.equal(lot(r).forfeited,0);assert.equal(r.state.character.benefitAwards[0].quantity,award.quantity);assert.equal(r.state.character.benefitAwards[0].redeemedQuantity,2);
 assert.equal(r.state.character.clanShareRedemptions[0].source.page,47);assert.equal(r.log.at(-1).rolls.length,0);roundtrip(r);
});

test('Ship Share conversion is one-for-one, not cash, and retains the non-cash source restrictions',()=>{
 let r=buildClanSharesFixture({gender:'male'});rejected(r,'redeem-clan-shares',payload(r,'cash'),/Male/);r=exchange(r,'ship-shares',3);
 const token=r.state.character.benefits.find(x=>x.name==='Ship Share');assert.equal(token.quantity,3);assert.equal(token.valuePerShare,1000000);assert.equal(token.redeemableForCash,false);
 assert.equal(r.state.character.cash,0);const a=r.state.character.benefitAwards.at(-1);assert.equal(a.origin.careerId,null);assert.equal(a.source.page,47);assert.equal(a.origin.redemptionId,'clan-redemption-1');assert.equal(a.status,'resolved');roundtrip(r);
});

for(const kind of ['cash','ship-shares'])test('partial '+kind+' conversion then Outcast entry forfeits only unspent shares',()=>{
 let r=buildClanSharesFixture({stage:'career'});r=exchange(r,kind,2);const soc=r.state.character.stats.SOC,received=r.state.character.benefitAwards[0].received;r=run(r,'career',{id:'aslan.outcast',assignment:'labourer'});
 assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.stats.SOC,soc);assert.deepEqual([lot(r).awarded,lot(r).available,lot(r).spent,lot(r).forfeited],[6,0,2,4]);
 const a=r.state.character.benefitAwards[0];assert.equal(a.quantity,6);assert.equal(a.redeemedQuantity,2);assert.equal(a.forfeitedQuantity,4);assert.equal(a.forfeited,false);assert.equal(a.received,received);
 assert.deepEqual(r.state.character.aslanStatusChanges.at(-1).forfeitures,[{lotId:lot(r).id,awardId:a.id,quantity:4}]);assert.ok(!r.state.character.benefits.some(x=>x.name==='Clan Share'));
 if(kind==='cash')assert.equal(r.state.character.cash,20000);else assert.equal(r.state.character.benefits.find(x=>x.name==='Ship Share').quantity,2);
 assert.equal(clanShareLotInvariant(lot(r)),true);roundtrip(r);
});

test('two genuine award lots remain separate and support explicit combined allocation',()=>{
 let r=buildClanSharesFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military-officer',assignment:'executive'},[6,6]));r=aslanEndTerm(settle(aslanEvent(r,8)));
 assert.equal(r.state.character.clanShareLots.length,2);const [a,b]=r.state.character.clanShareLots;assert.notEqual(a.awardId,b.awardId);
 r=run(r,'redeem-clan-shares',{kind:'cash',inputs:[{lotId:a.id,quantity:2},{lotId:b.id,quantity:3}]});assert.equal(r.state.character.cash,50000);
 assert.deepEqual(r.state.character.clanShareLots.map(x=>[x.awarded,x.spent]),[[6,2],[6,3]]);assert.equal(r.state.character.clanShareRedemptions[0].inputs.length,2);roundtrip(r);
});

test('malformed, zero, duplicate, stale and oversized allocations reject atomically',()=>{
 const r=buildClanSharesFixture();for(const inputs of [[],null,{},[{lotId:lot(r).id,quantity:0}],[{lotId:lot(r).id,quantity:7}],[{lotId:lot(r).id,quantity:1},{lotId:lot(r).id,quantity:1}],[{lotId:'missing',quantity:1}],[{lotId:lot(r).id,quantity:1,clanId:'invented'}]])rejected(r,'redeem-clan-shares',{kind:'cash',inputs});
 rejected(r,'redeem-clan-shares',{...payload(r,'cash'),name:'ignored'});rejected(r,'redeem-clan-shares',payload(r,'land'));rejected(r,'redeem-clan-shares',payload(r,'contact',1,{name:''}));rejected(r,'redeem-clan-shares',payload(r,'contact',2,{name:'Two favours'}));
 const spent=exchange(r,'cash',6);rejected(spent,'redeem-clan-shares',payload(spent,'cash'),/insufficient/);roundtrip(spent);
});

test('retry IDs, import and audited restore never duplicate output or lose original awards',()=>{
 const initial=buildClanSharesFixture(),p=payload(initial,'cash',2);let r=run(initial,'redeem-clan-shares',p,{id:'cash-once'});const repeated=run(r,'redeem-clan-shares',p,{id:'cash-once'});assert.equal(repeated.revision,r.revision);assert.deepEqual(repeated.state,r.state);roundtrip(r);
 r=run(r,'restore',{revision:initial.revision});assert.equal(lot(r).available,6);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.clanShareRedemptions,undefined);
 r=exchange(r,'ship-shares',1);assert.equal(r.state.character.cash,0);assert.equal(lot(r).spent,1);assert.equal(r.state.character.clanShareRedemptions.length,1);assert.ok(r.session.events.some(x=>x.command?.type==='redeem-clan-shares'&&x.command.payload.kind==='cash'));roundtrip(r);
});

test('replaying the original share die rebuilds balances without replaying superseded exchanges',()=>{
 let r=buildClanSharesFixture();const revision=r.session.events.filter(e=>e.command?.type==='roll-aslan-rite').at(-1)?.revision??r.log.find(e=>e.type==='roll-aslan-rite').number;
 r=exchange(r,'cash',2);r=run(r,'gm-replay',{revision,rollIndex:1,values:[3],reason:'Replay the original share quantity, not an extra award.'});assert.equal(lot(r).awarded,3);assert.equal(lot(r).available,3);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.clanShareRedemptions,undefined);roundtrip(r);
});

test('duplicate Contact names have distinct stable IDs and only the selected one upgrades',()=>{
 let r=buildClanSharesFixture();r=exchange(r,'contact',1,{name:'Same name'});r=exchange(r,'contact',1,{name:'Same name'});const [a,b]=r.state.character.relationships;assert.notEqual(a.id,b.id);assert.equal(r.state.character.relationshipSequence,2);
 assert.deepEqual(r.state.clanShareOptions.contacts.map(x=>x.eligibleLotIds),[[lot(r).id],[lot(r).id]]);r=exchange(r,'ally',1,{relationshipId:b.id});assert.deepEqual(r.state.character.relationships.map(x=>[x.id,x.role]),[[a.id,'Contact'],[b.id,'Ally']]);
 rejected(r,'redeem-clan-shares',payload(r,'ally',1,{relationshipId:b.id}),/existing Contact/);rejected(r,'redeem-clan-shares',payload(r,'ally',1,{relationshipId:'removed-id'}),/existing Contact/);assert.equal(lot(r).spent,3);roundtrip(r);
});

test('generic source effects create distinct IDs; manual share validity and Contact affiliation require separate rulings',()=>{
 let r=buildUnverifiedClanSharesFixture();assert.deepEqual(r.state.character.relationships.map(x=>x.id),['relationship-1','relationship-2']);assert.equal(lot(r).provenance,'unverified');assert.equal(r.state.clanShareOptions.redeemableBalance,0);
 rejected(r,'redeem-clan-shares',payload(r,'ship-shares'),/genuine/);let player=run(r,'gm-mode',{enabled:false});assert.equal(player.state.clanShareOptions.lots[0].canVerify,false);rejected(player,'verify-clan-share-lot',{lotId:lot(r).id,reason:'Known source'},/GM/);
 r=run(r,'verify-clan-share-lot',{lotId:lot(r).id,reason:'Verified this manually recorded quantity against its source; issuing clan is still unknown.'});assert.equal(lot(r).clanId,null);assert.equal(lot(r).provenance,'referee');assert.equal(r.state.clanShareOptions.choices.find(x=>x.id==='ship-shares').available,true);assert.equal(r.state.clanShareOptions.choices.find(x=>x.id==='contact').available,false);
 r=run(r,'verify-clan-share-lot',{lotId:lot(r).id,newClanName:'Verified clan',reason:'Verified the issuing clan separately.'});const clanId=lot(r).clanId,id=r.state.character.relationships[1].id;
 rejected(r,'redeem-clan-shares',payload(r,'ally',1,{relationshipId:id}),/Verify/);r=run(r,'verify-clan-contact',{relationshipId:id,clanId,reason:'Verified this specific Contact belongs to the clan upper echelons.'});r=exchange(r,'ally',1,{relationshipId:id});assert.equal(r.state.character.relationships[0].role,'Contact');assert.equal(r.state.character.relationships[1].role,'Ally');assert.equal(r.state.character.clanShareVerifications.length,3);roundtrip(r);
});

test('real Outlaw restoration quantity supports Ship Shares without guessing issuing clan',()=>{
 let r=buildOutlawDepartureFixture({ready:true});const sourceLot=r.state.character.clanShareLots.find(l=>l.available===3);assert.ok(sourceLot);assert.equal(sourceLot.provenance,'source');assert.equal(sourceLot.clanId,null);
 const option=r.state.clanShareOptions.lots.find(l=>l.id===sourceLot.id);assert.equal(option.cashShipAvailable,true);assert.equal(option.favourAvailable,false);assert.equal(option.needsClanVerification,true);
 r=run(r,'redeem-clan-shares',{kind:'ship-shares',inputs:[{lotId:sourceLot.id,quantity:1}]});assert.equal(r.state.character.clanShareLots.find(l=>l.id===sourceLot.id).available,2);assert.equal(r.state.character.clanShareVerifications,undefined);r=run(r,'verify-clan-share-lot',{lotId:sourceLot.id,newClanName:'Restoring clan',reason:'Verified the issuer without changing the source-earned quantity provenance.'});assert.equal(r.state.character.clanShareLots.find(l=>l.id===sourceLot.id).provenance,'source');assert.equal(r.state.character.clanShareClans.at(-1).provenance,'referee');roundtrip(r);
});

for(const stage of ['precareer','career','term-end','finish'])test('safe '+stage+' exchange preserves stage, age, terms, estate and optional characteristics',()=>{
 let r=buildClanSharesFixture({stage,extras:['WLT','LCK']});const before=unchanged(r);r=exchange(r,'cash');assert.deepEqual(unchanged(r),before);assert.equal(r.state.character.cash,10000);assert.equal(r.log.at(-1).rolls.length,0);roundtrip(r);
});

test('early retirement is a safe checkpoint without reopening career obligations',()=>{
 let r=buildClanSharesFixture({stage:'term-end'});r=aslanBenefits(run(r,'leave-career',{retire:true}));assert.equal(r.state.stage,'retirement');const before=unchanged(r);r=exchange(r,'cash');assert.deepEqual(unchanged(r),before);assert.equal(r.state.character.retirementFromCreation,true);rejected(r,'career',{id:'aslan.management',assignment:'executive'});roundtrip(r);
});

test('active career procedures and reserved officer benefits cannot be interrupted for redemption or verification',()=>{
 let r=buildClanSharesFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military',assignment:'support'},[6,6]));assert.equal(r.state.stage,'survival');assert.equal(r.state.clanShareOptions.checkpointAvailable,false);rejected(r,'redeem-clan-shares',payload(r,'cash'),/procedure/);rejected(r,'verify-clan-share-lot',{lotId:lot(r).id,reason:'No interrupt'},/procedure/);
 r=buildAslanOfficerFixture({riteShares:true});const offer=r.state.aslanOfficerOptions[0];r=run(r,'begin-aslan-officer',{offerId:offer.id,assignment:offer.assignments.find(a=>a.available).id});assert.equal(r.state.clanShareOptions.checkpointAvailable,false);rejected(r,'redeem-clan-shares',payload(r,'ship-shares'),/reserved officer/);roundtrip(r);
});


test('conversion before final settlement funds actual injury bills once',()=>{
 let r=buildClanShareMedicalFixture();r=exchange(r,'cash');assert.equal(r.state.character.medicalBills[0].settled,false);r=run(r,'finish');assert.equal(r.state.character.cash,0);assert.equal(r.state.character.debt,0);assert.equal(r.state.character.medicalBills[0].paid,10000);assert.equal(r.state.character.medicalSettlements.length,1);roundtrip(r);
});
test('conversion after finishing leaves established medical debt untouched',()=>{
 let r=run(buildClanShareMedicalFixture(),'finish');assert.equal(r.state.character.debt,10000);const bill=structuredClone(r.state.character.medicalBills);r=exchange(r,'cash');assert.equal(r.state.character.cash,10000);assert.equal(r.state.character.debt,10000);assert.deepEqual(r.state.character.medicalBills,bill);assert.equal(r.state.character.medicalSettlements.length,1);roundtrip(r);
});

test('native relationship removal does not reuse the removed ID for later native awards',()=>{
 let r=buildProleLossFixture({protectedStay:true});const before=r.state.character.relationships,sequence=r.state.character.relationshipSequence;assert.ok(before.every(x=>x.id));const removedId=before[0].id;r=run(r,'resolve-relationship-loss',{index:0});assert.equal(r.state.character.relationshipLosses[0].removed.id,removedId);
 r=rolledReeducation(r,1);r=run(r,'resolve-reeducation',{chronology:chronology('before-resume')});r=aslanEndTerm(settle(r));r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));r=settle(aslanEvent(r,5));assert.ok(r.state.character.relationshipSequence>sequence);assert.ok(!r.state.character.relationships.some(x=>x.id===removedId));assert.equal(new Set(r.state.character.relationships.map(x=>x.id)).size,r.state.character.relationships.length);roundtrip(r);
});

test('non-native and Imperial Aslan flows do not gain the bounded native exchange',()=>{
 for(const setup of [{species:'human'},{species:'aslan',culture:'imperial',gender:'female'}]){let r=api({operation:'create',seed:'share-eligibility'});r=run(r,'setup',setup);assert.equal(r.state.clanShareOptions.checkpointAvailable,false);assert.match(r.state.clanShareOptions.checkpointReason,/native Aslan/);rejected(r,'redeem-clan-shares',{kind:'cash',inputs:[{lotId:'invented',quantity:1}]},/native Aslan/);}
});

test('new accounting revision rejects .10 without reconstructing or mutating original history',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.19');const old=structuredClone(buildClanSharesFixture().session);old.rulesRevision='character-preview-2026-11-08.10';const bytes=JSON.stringify(old);const r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
});


test('ordinary nonzero cash-roll use, WLT and completed benefit history are unchanged by cash conversion',()=>{
 let r=buildClanSharesFixture({stage:'term-end',extras:['WLT']});r=run(r,'leave-career',{retire:true});r=force(r,'benefit',{cash:true},[2]);assert.equal(r.state.cashRolls,1);r=aslanBenefits(r);assert.equal(r.state.stage,'retirement');const before=unchanged(r),cash=r.state.character.cash;
 r=exchange(r,'cash',2);assert.equal(r.state.character.cash,cash+20000);assert.deepEqual(unchanged(r),before);assert.equal(r.state.cashRolls,1);roundtrip(r);
});

test('identical clan names never establish matching identity or Contact provenance',()=>{
 let r=buildUnverifiedClanSharesFixture();const origin=r.state.clanShareOptions.clans[0];r=run(r,'verify-clan-share-lot',{lotId:lot(r).id,newClanName:origin.name,reason:'A distinct issuing clan with the same display name is verified.'});assert.notEqual(lot(r).clanId,origin.id);
 const id=r.state.character.relationships[0].id;r=run(r,'verify-clan-contact',{relationshipId:id,clanId:origin.id,reason:'This Contact belongs to the original clan, not the distinct issuer.'});assert.deepEqual(r.state.clanShareOptions.contacts.find(x=>x.id===id).eligibleLotIds,[]);rejected(r,'redeem-clan-shares',payload(r,'ally',1,{relationshipId:id}),/Verify/);
 rejected(r,'verify-clan-contact',{relationshipId:id,clanId:lot(r).clanId,reason:'Do not silently retarget an already recorded Contact.'},/already/);assert.equal(lot(r).spent,0);roundtrip(r);
});


test('optional issuer fields reject malformed presence without silently verifying source-only',()=>{
 const r=buildUnverifiedClanSharesFixture(),base={lotId:lot(r).id,reason:'Review intended issuer verification'},before=structuredClone(r.state.character);
 for(const key of ['clanId','newClanName'])for(const value of ['', '   ',false,true,0,1,null,undefined,[],{},['origin-clan']])rejected(r,'verify-clan-share-lot',{...base,[key]:value},/nonempty string/);
 for(const extra of [{clanId:'origin-clan',newClanName:'Named clan'},{clanId:false,newClanName:'Named clan'},{clanId:'origin-clan',newClanName:false},{clanId:undefined,newClanName:undefined}])rejected(r,'verify-clan-share-lot',{...base,...extra},/only one/);
 for(const extra of [{quantity:1},{ignored:false},{issuer:'origin-clan'}])rejected(r,'verify-clan-share-lot',{...base,...extra},/Use only/);
 assert.deepEqual(r.state.character,before);assert.equal(lot(r).provenance,'unverified');assert.equal(r.state.character.clanShareVerifications,undefined);
 const sourceOnly=run(r,'verify-clan-share-lot',base);assert.equal(lot(sourceOnly).provenance,'referee');assert.equal(lot(sourceOnly).clanId,null);assert.equal(sourceOnly.state.character.clanShareVerifications.length,1);roundtrip(sourceOnly);
 const named=run(r,'verify-clan-share-lot',{...base,newClanName:'Verified issuer'});assert.equal(named.state.character.clanShareClans.at(-1).name,'Verified issuer');assert.notEqual(lot(named).clanId,null);roundtrip(named);
});
