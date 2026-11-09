import test from 'node:test';
import assert from 'node:assert/strict';
import {characterChanges} from '../engine/audit.mjs';
test('Clan Share audit distinguishes spent and forfeited portions and preserves outputs',()=>{
 const before={clanShareLots:[{id:'lot-1',awardId:'award-1',awarded:3,available:3,spent:0,forfeited:0,clanId:'clan-1',provenance:'source'}]};
 const after={clanShareLots:[{...before.clanShareLots[0],available:0,spent:1,forfeited:2,forfeitureIds:['status-1']}],clanShareRedemptions:[{id:'exchange-1',kind:'ship-shares',inputs:[{lotId:'lot-1',quantity:1}],quantity:1,outputs:{shipShares:1},before:{available:3},after:{available:2},source:{id:'aliens',page:47},internal:{queue:['hidden']}}],aslanStatusChanges:[{id:'status-1',forfeitures:[{lotId:'lot-1',quantity:2}],internal:['hidden']}]};
 const changes=characterChanges(before,after);
 assert.ok(changes.some(c=>c.path==='clanShareLots.0.spent'&&c.after===1));
 assert.ok(changes.some(c=>c.path==='clanShareLots.0.forfeited'&&c.after===2));
 assert.ok(changes.some(c=>c.path==='clanShareRedemptions.0.outputs'&&c.after.shipShares===1));
 assert.ok(changes.some(c=>c.path==='aslanStatusChanges.0.forfeitures'&&c.after[0].quantity===2));
 assert.doesNotMatch(JSON.stringify(changes),/internal|queue|hidden/);
 changes.find(c=>c.path==='clanShareRedemptions.0.outputs').after.shipShares=99;
 assert.equal(after.clanShareRedemptions[0].outputs.shipShares,1);
});
test('clan and Contact source rulings audit identity and provenance without quantity grants',()=>{
 const before={relationships:[{id:'person-1',role:'Contact',name:'Same name'}],relationshipSequence:1};
 const after={relationships:[{id:'person-1',role:'Contact',name:'Same name',clanFavour:{clanId:'clan-1',upperEchelon:true}}],relationshipSequence:1,clanShareClans:[{id:'clan-1',name:'Verified clan',source:{id:'aliens',page:47},provenance:'referee'}],clanShareVerifications:[{id:'verify-1',kind:'contact',relationshipId:'person-1',clanId:'clan-1',before:null,after:{upperEchelon:true},reason:'Verified source affiliation',source:{id:'aliens',page:47},choices:['not public']}]};
 const changes=characterChanges(before,after);
 assert.ok(changes.some(c=>c.path==='relationships.0'&&c.before.id===c.after.id));
 assert.ok(changes.some(c=>c.path==='clanShareVerifications.0.reason'&&c.after==='Verified source affiliation'));
 assert.ok(changes.some(c=>c.path==='clanShareClans.0.id'&&c.after==='clan-1'));
 assert.doesNotMatch(JSON.stringify(changes),/not public|choices/);
 assert.ok(!changes.some(c=>c.path==='relationshipSequence'));
});
