import test from 'node:test';
import assert from 'node:assert/strict';
import {landSelection,landRedemptionPayload,landClaimPayload,landRedemptionFields,landClaimView,landClaimSheet} from '../gui/aslan-land-view.mjs';
import {characterChanges} from '../engine/audit.mjs';
import {buildMaleShareAssetsFixture} from './clan-share-assets-fixtures.mjs';
import {buildLandClaimFixture,run,landResolution} from './aslan-land-fixtures.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(name,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+name+'</button>',sourceLabel:(source,page)=>source+' p'+page};
const state={clanShareOptions:{checkpointAvailable:true,landRules:{minimumShares:3,minimumParcels:10,increment:2,minParcelBaseline:1,minParcelIncrement:0},lots:[{id:'lot1',available:2},{id:'lot2',available:2}],choices:[{id:'land',available:true,lotIds:['lot1','lot2']} ]}};
const rows=[{lotId:'lot1',quantity:2,selected:true},{lotId:'lot2',quantity:1,selected:true}];
test('land selection combines selected lots and keeps below-minimum and invalid inputs unavailable',()=>{
 assert.deepEqual(landSelection(state,rows),{inputs:[{lotId:'lot1',quantity:2},{lotId:'lot2',quantity:1}],total:3,parcels:10,available:true});
 assert.equal(landSelection(state,[{...rows[0],quantity:1}]).available,false);
 for(const quantity of [0,-1,1.5,3,NaN,undefined])assert.equal(landSelection(state,[{...rows[0],quantity},rows[1]]).available,false);
 assert.equal(landSelection(state,[rows[0],rows[0]]).available,false);
 assert.equal(landSelection(state,[{...rows[0],lotId:'unknown'},rows[1]]).available,false);
 assert.equal(landSelection(state,[{...rows[0],selected:false},rows[1]]).total,1);
});
test('land UI previews only current projected values and requires referee bounds when unprinted',()=>{
 assert.equal(landSelection(state,[rows[0],{...rows[1],quantity:2}]).parcels,12);
 const ruled=structuredClone(state);Object.assign(ruled.clanShareOptions.landRules,{requiresParcelRuling:true,minimumParcels:null,increment:null});
 assert.equal(landSelection(ruled,rows).parcels,null);
 assert.equal(landSelection(ruled,rows,{minimumParcels:500,increment:20}).parcels,500);
 assert.equal(landSelection(ruled,[rows[0],{...rows[1],quantity:2}],{minimumParcels:Number.MAX_SAFE_INTEGER,increment:1}).parcels,null);
 ruled.clanShareOptions.choices[0].available=false;assert.equal(landSelection(ruled,rows).available,false);
});
test('redemption and claim payloads omit irrelevant hidden fields and invent no decision',()=>{
 const fields={worldName:'World',worldLocation:'Sector/0101',worldReference:'  ',minimumParcels:999,increment:99,reason:'hidden'};
 assert.deepEqual(landRedemptionPayload(state,rows,fields),{kind:'land',inputs:[{lotId:'lot1',quantity:2},{lotId:'lot2',quantity:1}],world:{name:'World',location:'Sector/0101'}});
 const ruled=structuredClone(state);ruled.clanShareOptions.landRules.requiresParcelRuling=true;
 assert.deepEqual(landRedemptionPayload(ruled,rows,fields).parcelRuling,{minimumParcels:999,increment:99,reason:'hidden'});
 assert.deepEqual(landClaimPayload({claimId:'c1',mode:'personal-return',claimEstablished:false,reason:'',relativeName:'hidden'}),{claimId:'c1',mode:'personal-return',claimEstablished:false,reason:''});
 assert.equal(landClaimPayload({mode:'relative-administration',relativeName:'Aunt'}).relativeName,'Aunt');
});
test('land form uses projected bounds, starts unselected and escapes world/lot labels',()=>{
 const fixture=buildMaleShareAssetsFixture(),s=structuredClone(fixture.state);s.clanShareOptions.lots[0].label='<Synthetic award>';
 const html=landRedemptionFields(s,context);assert.match(html,/&lt;Synthetic award&gt;/);assert.doesNotMatch(html,/<Synthetic|\schecked(?:\s|>|=)/);assert.match(html,/maxlength="160"/);assert.match(html,/pending claim, not owned land/);assert.match(html,/does not advance time/);assert.doesNotMatch(html,/id="land-parcel-ruling"/);
 assert.equal(landRedemptionFields({clanShareOptions:{landRules:null}},context),'');
});
test('land claim controls remain available for inspection without unspent shares, no implicit claim',()=>{
 const fixture=buildLandClaimFixture({shares:6}),html=landClaimView(fixture.state,context);
 assert.equal(fixture.state.clanShareOptions.balance,0);assert.match(html,/1 pending/);assert.match(html,/Choose a claim/);assert.match(html,/actual claim to be established/);assert.doesNotMatch(html,/<input[^>]*\schecked(?:\s|>|=)/);assert.match(html,/data-action="resolve-land-claim" disabled/);
});
test('pending and owned land are distinct, not family estate or liquid cash',()=>{
 let r=buildLandClaimFixture({mature:true});const before=landClaimSheet(r.state,context);assert.match(before,/Pending claim; not owned land/);assert.match(before,/Delay elapsed/);assert.match(before,/Separate from the family estate baseline/);
 r=run(r,'resolve-land-claim',{claimId:r.state.character.landClaims[0].id,...landResolution});const after=landClaimSheet(r.state,context);assert.match(after,/Owned personal landholding/);assert.match(after,/Personal return/);assert.doesNotMatch(after,/Pending claim; not owned land/);assert.match(after,/No cash price/);
});
test('land audit records original dice, current SOC, world and later claim evidence without projection queues',()=>{
 const r=buildLandClaimFixture({mature:true}),claim=r.state.character.landClaims[0],empty=structuredClone(r.state.character);empty.landClaims=[];
 const created=characterChanges(empty,r.state.character);for(const field of ['world','socAtRedemption','delayRoll','delayYears','eligibleAge','status','inputs','parcelRuling'])assert.ok(created.some(c=>c.path==='landClaims.0.'+field));
 const resolved=run(r,'resolve-land-claim',{claimId:claim.id,...landResolution}),changes=characterChanges(r.state.character,resolved.state.character);assert.ok(changes.some(c=>c.path==='landClaims.0.claimResolution'&&c.after.claimEstablished));assert.ok(changes.some(c=>c.path==='landClaims.0.assetId'));assert.ok(changes.some(c=>c.path.startsWith('assets.')));assert.ok(changes.every(c=>!c.path.includes('modes')&&!c.path.includes('remainingYears')));
});
