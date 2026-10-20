import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCampaignPolitics,decodeCampaignPolitics,campaignPoliticsFragment,campaignPoliticsFromFragment} from '../js/campaign-politics-codec.mjs';
import {projectCampaignPolitics} from '../js/campaign-politics.mjs';
import {measureSnapshotLink,encodeSnapshotLink,decodeSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
import {playerSnapshotFixture as fixture} from '../js/player-snapshot-fixture.mjs';
const politics=n=>({version:1,claims:Array.from({length:n},(_,i)=>[-108+i,-17]),allegiances:[[-108,-17],[-107,-17]]});
test('manual claims and separate allegiance survive canonical compact sharing without private data',()=>{
 for(const n of [0,2,10,30,512]){
  const value={...politics(n),gmNotes:'PRIVATE'},expected=projectCampaignPolitics(value),input={...fixture,campaignPolitics:value};
  assert.deepEqual(decodeCampaignPolitics(encodeCampaignPolitics(value)),expected);
  assert.deepEqual(campaignPoliticsFromFragment(campaignPoliticsFragment(value)),expected);
  const url=encodeSnapshotLink(input);assert.deepEqual(decodeSnapshotLink(url).campaignPolitics,expected);assert.ok(!JSON.stringify(decodeSnapshotLink(url)).includes('PRIVATE'));
  assert.throws(()=>measureSnapshotLink(input,{codecVersion:7}),/Older codecs/);
 }
});
test('old codec 7 links still decode without campaign politics',()=>{
 const old=measureSnapshotLink({...fixture,campaignPolitics:null},{codecVersion:7});assert.equal(decodeSnapshotLink(PROPOSED_PREFIX+old.payload).campaignPolitics,null);
});
test('bad versions, duplicate cells, overlong integers, trailing bytes and malformed encodings fail closed',()=>{
 for(const bytes of [[2],[1],[0,1],[1,128,0,0],[1,2,0,0,0,0,0],[1,1,255,255,127,0,0]])assert.throws(()=>decodeCampaignPolitics(Uint8Array.from(bytes)));
 for(const text of ['', '%AA', 'A','AA=', '<script>', 'A'.repeat(5335)])assert.throws(()=>campaignPoliticsFromFragment(text));
 const encoded=encodeCampaignPolitics(politics(2));for(let i=0;i<encoded.length;i++)assert.throws(()=>decodeCampaignPolitics(encoded.slice(0,i)));
});
test('actual encoded manual claims stay bounded and account for separate allegiances',()=>{
 const base=measureSnapshotLink({...fixture,campaignPolitics:null});
 for(const n of [2,10,30]){const m=measureSnapshotLink({...fixture,campaignPolitics:politics(n)});console.log(JSON.stringify({manualHexes:n,worldAllegiances:2,addedCharacters:m.payload.length-base.payload.length,payloadCharacters:m.payload.length,binaryBytes:m.bytes}));assert.ok(m.payload.length-base.payload.length<=n*6+20);}
});

test('campaign JSON validation and global Undo preserve and restore exact claims',async()=>{
 const {guiFixture}=await import('./fixtures/gui-parity.mjs');const {validate,transition,undo}=await import('../js/state.mjs');
 const initial=guiFixture(12).state,before=structuredClone(initial),next=transition(initial,'Campaign territory',s=>{s.campaignPolitics=politics(10);});
 assert.deepEqual(initial,before);assert.deepEqual(validate(JSON.parse(JSON.stringify(next))).campaignPolitics,politics(10));
 const second=transition(next,'Campaign territory',s=>{s.campaignPolitics=politics(2);});assert.deepEqual(undo(second).campaignPolitics,politics(10));assert.equal(undo(next).campaignPolitics,undefined);
 const hostile=structuredClone(next);hostile.campaignPolitics.claims.push(['<script>',0]);assert.throws(()=>validate(hostile),/coordinate/);
});
