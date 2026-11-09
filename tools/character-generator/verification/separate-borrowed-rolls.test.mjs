import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {agentCoverFixture,run,rejected,forceAt} from './agent-cover-fixtures.mjs';
const route=r=>r.state.character.crossCareerRoutes.at(-1);
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
export function separatedCover({success=false,careerId='core.rogue',vargr=false}={}){
 let r=agentCoverFixture({vargr,rulesRevision:RULES_REVISION});r=run(r,'cross-career-cover',{careerId});
 return forceAt(r,r.revision,0,success?[6,6]:[1,1]);
}
export function rolledBorrowed(r,values){r=run(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id});return values?forceAt(r,r.revision,0,values):r;}
test('failed undercover check stops before mishap, exit, age or relationship changes',()=>{
 const r=separatedCover();assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.log.at(-1).rolls.length,1);assert.equal(route(r).tables.length,0);assert.equal(r.state.character.careers[0].forcedExit,undefined);assert.equal(r.state.character.age,18);assert.equal(r.state.character.terms,0);assert.equal(r.state.pendingBorrowedRoll.label,'Rogue mishap');assert.deepEqual(r.state.pendingBorrowedRoll.source,{id:'core',page:41});roundtrip(r);
});
test('reported Rogue betrayal separates mishap, relationship and random consequence with story',()=>{
 let r=rolledBorrowed(separatedCover(),[3]);assert.equal(r.state.stage,'relationship-event');assert.equal(r.log.at(-1).rolls.length,1);assert.match(r.log.at(-1).eventResults.at(-1).description,/Betrayal/);assert.equal(r.state.character.terms,0);roundtrip(r);
 r=run(r,'resolve-relationship-event',{role:'Enemy',confirmed:true});assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.state.pendingBorrowedRoll.kind,'random');assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.terms,0);roundtrip(r);
 r=rolledBorrowed(r,[4,4]);assert.equal(r.state.stage,'term-end');assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.age,22);assert.equal(route(r).status,'completed');assert.equal(r.log.at(-1).eventResults.length,1);assert.match(r.log.at(-1).summary,/No automatic mechanical effect/i);roundtrip(r);
});
test('pending token and request id prevent retries from rolling a subsequent nested table',()=>{
 const start=separatedCover({success:true,careerId:'core.citizen'}),payload={pendingId:start.state.pendingBorrowedRoll.id};
 let r=run(start,'roll-borrowed-event',payload,{id:'once'});assert.deepEqual(run(r,'roll-borrowed-event',payload,{id:'once'}).session,r.session);
 r=forceAt(r,r.revision,0,[1,1]);assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(route(r).tables.length,1);assert.notEqual(r.state.pendingBorrowedRoll.id,payload.pendingId);rejected(r,'roll-borrowed-event',payload);rejected(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id,die:2});rejected(r,'gm-override',{field:'cash',value:10,reason:'Context protection'});roundtrip(r);
});
test('successful cover table then skill check require separate actions',()=>{
 let r=separatedCover({success:true,careerId:'core.citizen'});assert.equal(r.state.pendingBorrowedRoll.label,'Citizen event');r=rolledBorrowed(r,[3,3]);assert.equal(r.log.at(-1).rolls.length,1);
 if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.state.pendingBorrowedRoll.kind,'check');r=rolledBorrowed(r,[6,6]);assert.equal(r.log.at(-1).rolls.length,1);assert.match(r.log.at(-1).summary,/succeeded/);roundtrip(r);
});
test('Vargr failed cover also pauses its borrowed mishap, successful cover adds no Event',()=>{
 const failed=separatedCover({vargr:true,careerId:'vargr.citizen'});assert.equal(failed.state.stage,'borrowed-event-roll');assert.equal(failed.log.at(-1).rolls.length,1);roundtrip(failed);
 const success=separatedCover({vargr:true,careerId:'vargr.citizen',success:true});assert.equal(success.state.stage,'cross-career-training');assert.equal(route(success).tables.length,0);roundtrip(success);
});
test('legacy .16-.19 retain combined rolls and exact exported replay bytes',()=>{
 for(const suffix of [16,17,18,19]){let r=agentCoverFixture({rulesRevision:'character-preview-2026-11-09.'+suffix});r=run(r,'cross-career-cover',{careerId:'core.rogue'});r=forceAt(r,r.revision,0,[1,1]);assert.ok(r.log.at(-1).rolls.length>=2);assert.equal(r.state.separateBorrowedRolls,undefined);const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);roundtrip(r);}
});

test('new explicit UI commands separate future rolls in existing revisions without rewriting history',()=>{
 for(const suffix of [16,17,18,19]){const old=agentCoverFixture({rulesRevision:'character-preview-2026-11-09.'+suffix}),prefix=JSON.stringify(old.session.events);let r=run(old,'cross-career-cover-check',{careerId:'core.rogue'});assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.log.at(-1).rolls.length,1);assert.equal(JSON.stringify(r.session.events.slice(0,old.revision)),prefix);assert.equal(r.session.rulesRevision,old.session.rulesRevision);roundtrip(r);}
});
