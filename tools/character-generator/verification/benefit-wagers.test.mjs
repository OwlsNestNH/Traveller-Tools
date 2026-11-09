import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {BENEFIT_WAGERS,wagerLimit,wagerDelta} from '../engine/benefit-wagers.mjs';
import {benefitWagerView,benefitWagerSheet} from '../gui/benefit-wager-view.mjs';
import {wagerFixture,run,rejected,force} from './benefit-wager-fixtures.mjs';
import {createServer} from '../server.mjs';
const replay=r=>assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
const ledger=r=>r.state.character.benefitWagers.at(-1);
test('source bounds and payouts do not borrow future entitlements',()=>{
 for(const route of Object.keys(BENEFIT_WAGERS)){assert.equal(wagerLimit(route,0),0);assert.equal(wagerLimit(route,9),route==='manager-event-5'?3:9);for(const n of [1,2,3,7]){assert.equal(wagerDelta(route,n,false),-n);assert.equal(wagerDelta(route,n,true),route==='manager-event-5'?n:Math.ceil(n/2));}}
 assert.throws(()=>wagerLimit('merchant-event-5',-1));
});
for(const career of ['core.merchant','core.rogue','aslan.manager']){
 test(career+' zero balance, refusal, replay and atomic rejection',()=>{
  let r=wagerFixture({career,terms:0});const before=r.state.character.skills;assert.equal(ledger(r).maximum,0);replay(r);
  for(const [type,payload] of [['resolve-benefit-wager',{stake:1,skill:ledger(r).skills[0]}],['resolve-benefit-wager',{stake:0,skill:'Broker'}],['resolve-benefit-wager',{stake:0,effects:[]}],['advancement',{}],['gm-override',{field:'cash',value:50,reason:'Invalid during wager'}]])rejected(r,type,payload);
  r=run(r,'resolve-benefit-wager',{stake:0});assert.equal(r.state.stage,'advancement');assert.equal(ledger(r).status,'declined');assert.deepEqual(r.state.character.skills,before);assert.equal(r.log.at(-1).rolls.length,0);if(career==='core.rogue')assert.equal(r.state.character.skills.Gambler,1);replay(r);rejected(r,'resolve-benefit-wager',{stake:0});
 });
 test(career+' wins and loses only accrued current-career rolls, preserves continuation and audits',()=>{
  for(const success of [false,true])for(const skill of BENEFIT_WAGERS[career==='core.merchant'?'merchant-event-5':career==='core.rogue'?'rogue-event-10':'manager-event-5'].skills){
   let r=wagerFixture({career,terms:3});const w=ledger(r);assert.equal(w.available,3);assert.equal(w.maximum,3);assert.equal(w.assignment,r.state.character.careers[0].assignment);replay(r);
   rejected(r,'resolve-benefit-wager',{stake:4,skill});rejected(r,'resolve-benefit-wager',{stake:1.5,skill});rejected(r,'resolve-benefit-wager',{stake:1,skill:'Admin'});rejected(r,'resolve-benefit-wager',{stake:-1,skill});
   const oldSkill=r.state.character.skills[skill];r=force(r,'resolve-benefit-wager',{stake:3,skill},success?[6,6]:[1,1]);const result=ledger(r);assert.equal(result.status,'completed');assert.equal(result.check.success,success);assert.equal(result.after,success?(career==='aslan.manager'?6:5):0);assert.equal(r.state.character.careers[0].benefitRolls,result.after);assert.equal(r.state.stage,'advancement');if(career==='core.merchant')assert.equal(r.state.character.skills[skill],oldSkill===undefined?1:Math.min(4,oldSkill+1));replay(r);rejected(r,'resolve-benefit-wager',{stake:1,skill});
   assert.ok(JSON.stringify(r.log).includes('benefitWagers.0.check'));
  }
 });
}
test('Manager source maximum is three even with four earned terms',()=>{const r=wagerFixture({career:'aslan.manager',terms:4});assert.equal(ledger(r).available,4);assert.equal(ledger(r).maximum,3);rejected(r,'resolve-benefit-wager',{stake:4,skill:'Broker'});});
test('wager UI exposes source, skill choice, accrued-only boundary and refusal',()=>{for(const career of ['core.merchant','core.rogue','aslan.manager']){const r=wagerFixture({career});const helpers={esc:String,sourceLabel:(id,p)=>id+' p. '+p,button:(text,action)=>'<button data-action="'+action+'">'+text+'</button>'};const html=benefitWagerView(r.state,helpers);assert.match(html,/Unfinished-term and future rank/);assert.match(html,/Decline wager/);assert.match(html,/wager-skill/);assert.match(benefitWagerSheet(r.state,helpers),/Benefit wagers/);}});
test('HTTP validates wager atomically and reproduces direct transport',async()=>{const server=createServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));try{const r=wagerFixture(),before=exportSession(r.session);const send=async stake=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'command',session:r.session,command:{type:'resolve-benefit-wager',payload:{stake,skill:'Broker'}}})})).json();assert.equal((await send(2)).ok,false);assert.equal(exportSession(r.session),before);const good=await send(1);assert.equal(good.ok,true);assert.deepEqual(good.state,run(r,'resolve-benefit-wager',{stake:1,skill:'Broker'}).state);replay(good);}finally{await new Promise(ok=>server.close(ok));}});
test('duplicate wager command IDs are idempotent and stale revisions cannot add another wager',()=>{
 const r=wagerFixture(),command={type:'resolve-benefit-wager',payload:{stake:1,skill:'Broker'}},first=api({operation:'command',session:r.session,command,id:'one-wager',expectedRevision:r.revision});assert.equal(first.ok,true);
 const duplicate=api({operation:'command',session:first.session,command,id:'one-wager',expectedRevision:r.revision});assert.equal(duplicate.ok,true);assert.deepEqual(duplicate,first);
 const stale=api({operation:'command',session:first.session,command,id:'another-wager',expectedRevision:r.revision});assert.equal(stale.ok,false);assert.match(stale.error.message,/changed/);replay(first);
});
test('GM restore returns to the exact pending wager and replay replaces, never stacks, outcomes',()=>{
 let r=wagerFixture({terms:3});const pending=r.revision;const first=run(r,'resolve-benefit-wager',{stake:3,skill:'Gambler'});const changed=run(first,'gm-replay',{revision:first.revision,rollIndex:0,values:[6,6],reason:'Correct the verified wager dice'});assert.equal(changed.state.character.benefitWagers.length,1);assert.equal(ledger(changed).after,5);replay(changed);
 r=run(changed,'restore',{revision:pending});assert.equal(r.state.stage,'benefit-wager');assert.equal(ledger(r).status,'pending');assert.equal(ledger(r).available,3);replay(r);r=run(r,'resolve-benefit-wager',{stake:0});assert.equal(ledger(r).status,'declined');assert.equal(r.state.character.careers[0].benefitRolls,3);replay(r);
});
