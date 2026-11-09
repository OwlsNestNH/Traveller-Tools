import test from 'node:test';import assert from 'node:assert/strict';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {buildMaleShareAssetsFixture,buildMaleShareMedicalFixture,maleAssetPayload,verifiedWeapons,run,force,rejected} from './clan-share-assets-fixtures.mjs';
import {buildClanSharesFixture,buildUnverifiedClanSharesFixture} from './clan-shares-fixtures.mjs';
import {buildOutlawDepartureFixture} from './aslan-outlaw-fixtures.mjs';
import {aslanBenefits,aslanEvent,aslanEndTerm,settle} from './aslan-officer-fixtures.mjs';
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const stable=r=>{const c=r.state.character;return {age:c.age,terms:c.terms,stage:r.state.stage,active:r.state.active,cash:c.cash,debt:c.debt,skills:c.skills,stats:c.stats,careers:c.careers,estate:c.aslanOrigin?.estate,cashRolls:r.state.cashRolls,benefitRollHistory:c.benefitRollHistory,medicalBills:c.medicalBills,medicalSettlements:c.medicalSettlements};};
const redeem=(r,kind='art',quantity=1,extra={},options={})=>run(r,'redeem-clan-shares',maleAssetPayload(r,kind,quantity,extra),options);

test('male art creates a separately owned holding with exact value and no cash, rolls or career changes',()=>{
 let r=run(buildMaleShareAssetsFixture({extras:['WLT','LCK']}),'gm-mode',{enabled:false});const before=stable(r),award=structuredClone(r.state.character.benefitAwards[0]);assert.equal(r.state.character.careers.length,0);r=redeem(r,'art',2);
 const a=r.state.character.assets[0],o=r.state.character.clanShareRedemptions[0].outputs;assert.equal(a.id,'asset-1');assert.equal(a.category,'art');assert.equal(a.quantity,1);assert.equal(a.assessedValue,20000);assert.equal(a.valuationBasis,'share-redemption-not-resale');assert.equal(a.ownership,'personal');assert.equal(a.sourceVerification.method,'source-derived');assert.equal(a.redemptionId,'clan-redemption-1');assert.equal(a.originCareerId,null);assert.deepEqual(a.awardIds,[award.id]);assert.equal(a.source.page,47);
 assert.deepEqual(o.assetIds,[a.id]);assert.equal(o.budget,20000);assert.equal(o.assessedValue,20000);assert.equal(o.unusedValue,0);assert.equal(o.lowerValueAcceptance,null);assert.equal(r.state.character.benefitAwards[0].quantity,award.quantity);assert.equal(r.state.character.benefitAwards[0].redeemedQuantity,2);assert.deepEqual(stable(r),before);assert.equal(r.log.at(-1).rolls.length,0);roundtrip(r);
});

test('male assets do not use Independence cash-roll access, cash halving or an equipment cash credit',()=>{
 let r=buildMaleShareAssetsFixture();assert.equal(r.state.cashLimit,0);assert.equal(r.state.character.skills.Independence,undefined);r=redeem(r,'art');assert.equal(r.state.character.assets[0].assessedValue,10000);assert.equal(r.state.character.cash,0);assert.equal(r.state.cashRolls,0);assert.equal(r.state.character.clanShareLots[0].available,5);rejected(r,'redeem-clan-shares',{kind:'cash',inputs:[{lotId:'clan-lot-1',quantity:1}]},/Male/);
});

test('weapon rows record exact quantities and reference text as referee-confirmed rather than catalog-checked',()=>{
 let r=buildMaleShareAssetsFixture();const before=stable(r);r=redeem(r,'weapons');const a=r.state.character.assets[0],o=r.state.character.clanShareRedemptions[0].outputs;
 assert.equal(a.name,'Broadsword');assert.equal(a.quantity,20);assert.equal(a.unitCost,500);assert.equal(a.tl,2);assert.equal(a.assessedValue,10000);assert.equal(a.sourceReference,'Core Rulebook Update2022 p124');assert.equal(a.sourceVerification.method,'referee-confirmed');assert.equal(a.sourceVerification.catalogChecked,false);assert.equal(o.sourceVerification.confirmed,true);assert.equal(a.weaponSkill,undefined);assert.deepEqual(stable(r),before);roundtrip(r);
});

test('repeated and multi-row weapon awards create distinct assets without Core repeat skill bonuses',()=>{
 let r=buildMaleShareAssetsFixture(),skills=structuredClone(r.state.character.skills);r=redeem(r,'weapons');r=redeem(r,'weapons',1,{items:[{...verifiedWeapons.items[0],quantity:10},{...verifiedWeapons.items[0],quantity:10}]});assert.deepEqual(r.state.character.assets.map(x=>x.id),['asset-1','asset-2','asset-3']);assert.equal(r.state.character.assets.reduce((n,a)=>n+a.assessedValue,0),20000);assert.equal(r.state.character.assets.reduce((n,a)=>n+a.quantity,0),40);assert.deepEqual(r.state.character.skills,skills);assert.equal(r.state.character.clanShareRedemptions.length,2);assert.equal(r.state.character.benefitAwards.length,1);roundtrip(r);
});

test('referee campaign weapons above Core ordinary Weapon cost and TL limits are not silently rejected',()=>{
 let r=buildMaleShareAssetsFixture();r=redeem(r,'weapons',1,{items:[{name:'Referee-defined campaign weapon',quantity:1,unitCost:10000,tl:15,sourceReference:'Referee campaign equipment entry'}],sourceReason:'Explicit campaign weapon ruling: TL15 and Cr10000; no claim of a catalog lookup.'});assert.equal(r.state.character.assets[0].tl,15);assert.equal(r.state.character.assets[0].assessedValue,10000);assert.equal(r.state.character.assets[0].sourceVerification.catalogChecked,false);roundtrip(r);
});

test('under-budget selection remains unspent until explicit lower-value exception and never returns change',()=>{
 const base=buildMaleShareAssetsFixture(),items=[{...verifiedWeapons.items[0],quantity:10}],p=maleAssetPayload(base,'weapons',1,{items});rejected(base,'redeem-clan-shares',p,/below budget/);assert.equal(base.state.character.clanShareLots[0].available,6);assert.equal(base.state.character.assets,undefined);
 let r=run(base,'redeem-clan-shares',{...p,lowerValueAcceptance:{confirmed:true,reason:'Referee accepts the smaller weapon bundle and surrendered value.'}});const o=r.state.character.clanShareRedemptions[0].outputs;assert.equal(o.budget,10000);assert.equal(o.assessedValue,5000);assert.equal(o.unusedValue,5000);assert.equal(o.unusedValueDisposition,'surrendered');assert.equal(o.lowerValueAcceptance.interpretation,'referee-exception');assert.equal(o.lowerValueAcceptance.unusedValue,5000);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.clanShareLots[0].spent,1);assert.equal(r.state.character.clanShareLots[0].available,5);assert.equal(r.state.character.benefits.some(b=>/credit|change/i.test(b.name)),false);roundtrip(r);
});

test('weapon verification, over-budget and malformed per-item/exception data reject atomically',()=>{
 const r=buildMaleShareAssetsFixture(),p=maleAssetPayload(r,'weapons');
 for(const extra of [{sourceConfirmed:false},{sourceConfirmed:'true'},{sourceReason:''},{sourceReason:false},{sourceReason:'x'.repeat(501)},{cashSupplement:1},{ignored:1},{items:[]},{items:null},{items:[null]},{items:[{...verifiedWeapons.items[0],unitCost:501}]},{items:[{...verifiedWeapons.items[0],extra:1}]},{lowerValueAcceptance:{confirmed:true,reason:'Unneeded'}}])rejected(r,'redeem-clan-shares',{...p,...extra});
 for(const key of ['name','quantity','unitCost','tl','sourceReference'])for(const value of ['',null,false,[],{}])rejected(r,'redeem-clan-shares',{...p,items:[{...verifiedWeapons.items[0],[key]:value}]});
 for(const lowerValueAcceptance of [false,null,{}, {confirmed:'true',reason:'Reason'},{confirmed:true,reason:''},{confirmed:true,reason:'Reason',cash:5000}])rejected(r,'redeem-clan-shares',{...p,items:[{...verifiedWeapons.items[0],quantity:10}],lowerValueAcceptance});
 assert.equal(r.state.character.clanShareLots[0].available,6);assert.equal(r.state.character.assets,undefined);assert.equal(r.state.character.clanShareRedemptions,undefined);roundtrip(r);
});

test('art rejects arbitrary prices, ownership and source flags instead of ignoring them',()=>{
 const r=buildMaleShareAssetsFixture(),p=maleAssetPayload(r);for(const extra of [{name:''},{name:false},{name:0},{name:'x'.repeat(121)},{value:999999},{assessedValue:1},{ownership:'borrowed'},{cash:10000},{sourceConfirmed:true},{items:[]}])rejected(r,'redeem-clan-shares',{...p,...extra});assert.equal(r.state.character.assets,undefined);
});

test('projected male choices and source constraints agree with GM gating; female choices omit both kinds',()=>{
 let r=buildMaleShareAssetsFixture();const rules=r.state.clanShareOptions.assetRules;assert.equal(rules.valuePerShare,10000);assert.equal(rules.maxItems,20);assert.equal(rules.maxItemQuantity,100);assert.equal(rules.nameMaxLength,120);assert.equal(rules.reasonMaxLength,500);assert.equal(rules.weaponsRequireGM,true);
 r=run(r,'gm-mode',{enabled:false});assert.equal(r.state.clanShareOptions.choices.find(c=>c.id==='art').available,true);assert.equal(r.state.clanShareOptions.choices.find(c=>c.id==='weapons').available,false);rejected(r,'redeem-clan-shares',maleAssetPayload(r,'weapons'),/GM/);rejected(r,'redeem-clan-shares',maleAssetPayload(r,'weapons',1,{items:[{...verifiedWeapons.items[0],quantity:1}],lowerValueAcceptance:{confirmed:true,reason:'Not without GM'}}),/GM/);
 const female=buildClanSharesFixture();assert.equal(female.state.clanShareOptions.assetRules,null);assert.ok(female.state.clanShareOptions.choices.every(c=>!['art','weapons'].includes(c.id)));for(const kind of ['art','weapons'])rejected(female,'redeem-clan-shares',maleAssetPayload(female,kind),/male source/);
});

for(const kind of ['art','weapons'])test(kind+' remains owned after only the remaining lot portion is forfeited',()=>{
 let r=buildMaleShareAssetsFixture({stage:'career'});r=redeem(r,kind);const assets=structuredClone(r.state.character.assets);r=run(r,'career',{id:'aslan.outcast',assignment:'labourer'});assert.deepEqual(r.state.character.assets,assets);const l=r.state.character.clanShareLots[0];assert.deepEqual([l.awarded,l.available,l.spent,l.forfeited],[6,0,1,5]);assert.equal(r.state.character.aslanStatusChanges.at(-1).forfeitures[0].quantity,5);assert.equal(r.state.character.benefitAwards[0].quantity,6);assert.equal(r.state.character.benefitAwards[0].forfeitedQuantity,5);assert.equal(r.state.character.cash,0);roundtrip(r);
});

test('genuine unknown-clan restoration shares allow male assets without clan invention',()=>{
 let r=buildOutlawDepartureFixture({ready:true});const l=r.state.character.clanShareLots.find(x=>x.available>0);assert.equal(l.clanId,null);assert.equal(l.provenance,'source');r=redeem(r);assert.equal(r.state.character.assets[0].assessedValue,10000);assert.equal(r.state.character.clanShareVerifications,undefined);assert.equal(r.state.character.clanShareRedemptions[0].inputs[0].clanId,null);roundtrip(r);
});

test('manual quantity requires the existing source-validity ruling before either asset kind',()=>{
 let r=buildUnverifiedClanSharesFixture();for(const kind of ['art','weapons'])rejected(r,'redeem-clan-shares',maleAssetPayload(r,kind),/genuine/);r=run(r,'verify-clan-share-lot',{lotId:'clan-lot-1',reason:'Referee verifies the recorded manual share award without inventing an issuing clan.'});r=redeem(r);assert.equal(r.state.character.clanShareLots[0].provenance,'referee');assert.equal(r.state.character.clanShareLots[0].clanId,null);roundtrip(r);
});

test('idempotent retries, import and restore preserve asset IDs without double spending',()=>{
 const start=buildMaleShareAssetsFixture(),p=maleAssetPayload(start,'weapons');let r=run(start,'redeem-clan-shares',p,{id:'weapons-once'});const again=run(r,'redeem-clan-shares',p,{id:'weapons-once'});assert.equal(again.revision,r.revision);assert.deepEqual(again.state,r.state);roundtrip(r);
 r=run(r,'restore',{revision:start.revision});assert.equal(r.state.character.assets,undefined);assert.equal(r.state.character.clanShareLots[0].available,6);r=redeem(r);assert.equal(r.state.character.assets[0].id,'asset-1');assert.equal(r.state.character.assets[0].category,'art');assert.equal(r.state.character.clanShareRedemptions.length,1);assert.ok(r.session.events.some(e=>e.command.payload?.kind==='weapons'));roundtrip(r);
});

test('original share-die replay supersedes asset spending while retaining the original command history',()=>{
 let r=buildMaleShareAssetsFixture();const revision=r.log.find(x=>x.type==='roll-aslan-rite').number;r=redeem(r,'art',2);r=run(r,'gm-replay',{revision,rollIndex:1,values:[3],reason:'Replay source share die, superseding the asset exchange.'});assert.equal(r.state.character.assets,undefined);assert.equal(r.state.character.clanShareRedemptions,undefined);assert.equal(r.state.character.clanShareLots[0].awarded,3);assert.equal(r.state.character.clanShareLots[0].available,3);roundtrip(r);
});

test('noncash assets cannot settle medical bills or silently repay established debt',()=>{
 let r=buildMaleShareMedicalFixture(),before=stable(r);r=redeem(r,'art');assert.deepEqual(stable(r),before);r=run(r,'finish');assert.equal(r.state.character.cash,0);assert.equal(r.state.character.debt,5000);assert.equal(r.state.character.medicalBills[0].paid,0);assert.equal(r.state.character.assets[0].assessedValue,10000);const settled=stable(r);r=redeem(r,'weapons');assert.deepEqual(stable(r),settled);assert.equal(r.state.character.medicalSettlements.length,1);roundtrip(r);
});

test('finished-sheet assets and active-procedure rejection keep the shared checkpoint contract',()=>{
 let r=buildMaleShareAssetsFixture({stage:'finish'});const before=stable(r);r=redeem(r);assert.deepEqual(stable(r),before);roundtrip(r);
 r=buildMaleShareAssetsFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));assert.equal(r.state.stage,'survival');assert.equal(r.state.clanShareOptions.checkpointAvailable,false);for(const kind of ['art','weapons'])rejected(r,'redeem-clan-shares',maleAssetPayload(r,kind),/procedure/);
});

test('asset IDs coexist with ordinary benefit equipment without changing its definition or repeat rules',()=>{
 let r=buildMaleShareAssetsFixture({stage:'term-end'});r=redeem(r);r=run(r,'leave-career',{retire:true});r=force(r,'benefit',{cash:false},[4]);assert.equal(r.state.pending.kind,'benefit-equipment');r=run(r,'resolve-book',{confirmed:true,note:'Referee verified Corep124 Broadsword and the ordinary benefit restrictions.',benefitItemName:'Broadsword',benefitItemCost:500,benefitItemTL:2,benefitWeaponSkill:'Melee (blade)'});r=aslanBenefits(r);assert.equal(r.state.character.assets[0].definitionId,'aslan.clan-share.art');assert.equal(r.state.character.assets[1].definitionId,'core.material.Weapon');assert.equal(r.state.character.assets[1].id,'asset-2');r=redeem(r,'weapons');assert.equal(r.state.character.assets.at(-1).id,'asset-3');assert.equal(r.state.character.assets.at(-1).definitionId,'aslan.clan-share.weapon');roundtrip(r);
});

test('revision .12 rejects previous .11 bytes unchanged before replay',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.19');const old=structuredClone(buildMaleShareAssetsFixture().session);old.rulesRevision='character-preview-2026-11-08.11';const bytes=JSON.stringify(old),r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
});


test('an art holding allocated across two genuine lots retains every originating award ID',()=>{
 let r=buildMaleShareAssetsFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military-officer',assignment:'leader'},[6,6]));r=aslanEndTerm(settle(aslanEvent(r,8)));const lots=r.state.character.clanShareLots;assert.equal(lots.length,2);
 r=run(r,'redeem-clan-shares',{kind:'art',name:'Clan Share',inputs:[{lotId:lots[0].id,quantity:1},{lotId:lots[1].id,quantity:2}]});assert.deepEqual(r.state.character.assets[0].awardIds,lots.map(l=>l.awardId));assert.equal(r.state.character.assets[0].assessedValue,30000);assert.deepEqual(r.state.character.clanShareLots.map(l=>l.spent),[1,2]);
 r=redeem(r,'art');assert.ok(r.state.character.benefits.some(b=>b.assetId==='asset-1'&&b.name==='Clan Share'));assert.equal(r.state.character.assets[1].id,'asset-2');roundtrip(r);
});
