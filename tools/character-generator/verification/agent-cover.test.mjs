import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {createServer} from '../server.mjs';
import {agentCoverFixture,coverResult,run,rejected,forceAt,finishSkill} from './agent-cover-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
import {crossCareerCoverView,crossCareerRouteSheet} from '../gui/cross-career-view.mjs';
const replay=r=>assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
const route=r=>r.state.character.crossCareerRoutes.at(-1),career=r=>r.state.character.careers[0];
function train(r,assignment,die=3){r=run(r,'cross-career-training',{assignment});r=forceAt(r,r.revision,0,[die]);return finishSkill(r);}
test('Core and Vargr choose cover before check, exposing source-bound choices without entry restrictions',()=>{
 for(const vargr of [false,true]){const r=agentCoverFixture({vargr});assert.equal(route(r).check,null);assert.equal(route(r).source.page,vargr?189:23);assert.equal(r.state.character.terms,0);assert.equal(career(r).id,vargr?'vargr.agent':'core.agent');
 const options=r.state.currentCrossCareerCover.options.map(c=>c.id);assert.deepEqual(options,vargr?['core.drifter','vargr.citizen','vargr.intermediary','vargr.loner','vargr.merchant','vargr.military','vargr.psion','vargr.scientist','vargr.spacer']:['core.rogue','core.citizen']);assert.ok(!options.some(c=>c.startsWith('zhodani.')));replay(r);
 for(const payload of [{careerId:career(r).id},{careerId:'zhodani.prole'},{careerId:'aslan.citizen'},{careerId:options[0],die:6},{}])rejected(r,'cross-career-cover',payload);
 rejected(r,'gm-override',{field:'cash',value:10,reason:'Forbidden pending edit'});rejected(r,'cross-career-training',{assignment:'worker'});
 }
});
test('Core successful cover Event and assignment retain Agent accounting, exact audit and one-shot entitlement',()=>{
 for(const careerId of ['core.citizen','core.rogue']){
 let r=coverResult({careerId,row:5});const before=structuredClone(r.state.character);assert.equal(r.state.stage,'cross-career-training');assert.deepEqual(route(r).tables.map(t=>[t.careerId,t.table,t.row,t.source.page]),[[careerId,'event',5,careerId==='core.citizen'?27:41]]);
 assert.ok(r.log.some(l=>l.changes.some(c=>c.path==='crossCareerRoutes.0.coverCareerId'&&c.after===careerId)));
 const assignment=r.state.currentCrossCareerTraining.options[0].id;r=run(r,'gm-mode',{enabled:false});r=run(r,'cross-career-training',{assignment},{id:'one-award'});r=finishSkill(r);assert.equal(r.state.stage,'advancement');assert.equal(route(r).status,'completed');assert.equal(route(r).training.careerId,careerId);assert.equal(career(r).rank,before.careers[0].rank);assert.equal(career(r).terms,0);assert.equal(r.state.character.age,18);assert.equal(r.state.character.careers.length,1);
 assert.deepEqual(run(r,'cross-career-training',{assignment},{id:'one-award'}).session,r.session);rejected(r,'cross-career-training',{assignment});replay(r);
 }
});
test('Vargr success has no Event and only one specialist roll, with next advancement bonus tied to Agent',()=>{
 let r=coverResult({vargr:true});assert.deepEqual(route(r).tables,[]);replay(r);r=train(r,'worker');assert.equal(route(r).training.source.page,190);assert.equal(r.state.stage,'advancement');assert.equal(route(r).status,'completed');assert.equal(career(r).id,'vargr.agent');assert.equal(r.state.character.terms,0);
 const modifier=r.state.modifiers.find(m=>m.target==='advancement');assert.equal(modifier.value,2);assert.equal(modifier.careerId,'vargr.agent');assert.equal(modifier.scope,'next');assert.deepEqual(modifier.source,{id:'aliens',page:189});replay(r);
 r=run(r,'advancement');assert.ok(!r.state.modifiers.some(m=>m.target==='advancement'&&m.value===2));replay(r);
});
test('every native Vargr cover offers its own complete specialist table set and never a new career record',()=>{
 for(const choice of agentCoverFixture({vargr:true}).state.currentCrossCareerCover.options){let r=coverResult({vargr:true,careerId:choice.id});assert.equal(r.state.currentCrossCareerTraining.sourceCareerId,choice.id);assert.equal(r.state.currentCrossCareerTraining.options.length,3);assert.equal(r.state.character.careers.length,1);replay(r);}
});
test('invalid specialist selection and fabricated dice are atomic; source die replay replaces rather than adds',()=>{
 let r=coverResult();for(const payload of [{assignment:'intelligence'},{assignment:'worker',die:6},{}])rejected(r,'cross-career-training',payload);
 r=train(r,'worker',3);assert.equal(route(r).training.die,3);assert.equal(r.state.character.crossCareerRoutes.length,1);assert.equal(career(r).terms,0);replay(r);
});
test('failed checks borrow only a Mishap and preserve originating term/benefit accounting',()=>{
 for(const vargr of [false,true]){let r=coverResult({vargr,success:false,row:2});assert.equal(route(r).check.success,false);assert.equal(route(r).tables.length,1);assert.equal(route(r).tables[0].table,'mishap');assert.equal(route(r).training,null);assert.equal(route(r).status,'completed');assert.equal(r.state.stage,'term-end');assert.equal(career(r).forcedExit,true);assert.equal(career(r).terms,1);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.careers.length,1);replay(r);}
});
test('nested protected Core disaster uses cover Mishap and restores explicit stay before specialist award',()=>{
 let r=coverResult({row:2});assert.equal(route(r).tables[0].table,'event');assert.equal(route(r).tables[1].table,'mishap');assert.equal(route(r).tables[1].careerId,'core.citizen');
 // Branches can require a skill or choice, but must never become an Agent mishap.
 for(let i=0;i<10&&r.state.stage!=='cross-career-training';i++){
  if(r.state.stage==='skill-choice')r=finishSkill(r);else if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});else if(r.state.stage==='injury-loss')r=run(r,'injury-loss',{index:0});else if(r.state.stage==='injury-treatment')r=run(r,'injury-treatment',{restore:{},inService:false});else break;
 }
 assert.equal(r.state.stage,'cross-career-training');assert.equal(career(r).forcedExit,false);r=train(r,'worker');assert.equal(r.state.stage,'advancement');replay(r);
});
test('borrowed Rogue wager uses Agent balance and resumes exactly one pending training',()=>{
 let r=coverResult({careerId:'core.rogue',row:10});r=finishSkill(r);assert.equal(r.state.stage,'benefit-wager');const wager=r.state.character.benefitWagers.at(-1);assert.equal(wager.source.page,41);assert.equal(wager.sourceCareerId,'core.rogue');assert.equal(wager.careerId,'core.agent');assert.equal(wager.maximum,0);assert.equal(wager.crossCareerRouteId,route(r).id);replay(r);
 rejected(r,'resolve-benefit-wager',{stake:1,skill:'Gambler'});r=run(r,'resolve-benefit-wager',{stake:0});assert.equal(r.state.stage,'cross-career-training');r=train(r,'thief');assert.equal(route(r).status,'completed');assert.equal(r.state.character.careers.length,1);replay(r);
});
test('cover view escapes choices, records Deception rather than Investigate and fails closed',()=>{
 const context={esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),button:(label,action,cls,attrs)=>`<button data-action="${action}" ${attrs}>${label}</button>`,sourceLabel:(id,page)=>id+' p. '+page,careerName:id=>id};
 assert.match(crossCareerCoverView({},context),/unavailable/);const r=agentCoverFixture();assert.match(crossCareerCoverView(r.state,context),/core p. 23/);assert.match(crossCareerCoverView({currentCrossCareerCover:{source:{id:'core',page:23},originCareerId:'<bad>',options:[{id:'"bad',name:'<bad>'}]}},context),/&quot;bad/);assert.match(crossCareerRouteSheet(coverResult().state,context),/Deception check/);
});
test('HTTP cover and training preserve atomic rejection, replay and request-id idempotency',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{
 const send=async(r,type,payload,id)=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'command',session:r.session,command:{type,payload},id})})).json();
 const pending=agentCoverFixture(),raw=exportSession(pending.session);assert.equal((await send(pending,'cross-career-cover',{careerId:'zhodani.prole'},'bad')).ok,false);assert.equal(exportSession(pending.session),raw);
 const cover=await send(pending,'cross-career-cover',{careerId:'core.citizen'},'cover-once');assert.equal(cover.ok,true);assert.deepEqual((await send(cover,'cross-career-cover',{careerId:'core.citizen'},'cover-once')).session,cover.session);replay(cover);
 const training=coverResult({vargr:true});assert.equal((await send(training,'cross-career-training',{assignment:'spy'},'bad-training')).ok,false);const good=await send(training,'cross-career-training',{assignment:'worker'},'training-once');assert.equal(good.ok,true);assert.deepEqual((await send(good,'cross-career-training',{assignment:'worker'},'training-once')).session,good.session);replay(good);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('fatal nested injury cancels queued specialist training without another term or benefit',()=>{
 let r=coverResult({row:2,end:1}),revision=r.log.findLast(l=>l.type==='cross-career-cover').number;
 for(let i=0;i<80&&!(r.state.stage==='injury-loss'&&r.state.character.injuries.at(-1).options[2]?.label.startsWith('END'));i++)r=forceAt(r,revision,1,[1,1]);
 assert.equal(r.state.stage,'injury-loss');assert.equal(r.state.character.injuries.at(-1).careerId,'core.agent');assert.equal(r.state.character.injuries.at(-1).contextSource.page,27);
 r=run(r,'injury-loss',{index:2});assert.equal(r.state.pending.kind,'injury-zero');replay(r);r=run(r,'resolve-book',{confirmed:true,note:'Referee confirms fatal injury.',injurySurvives:false});assert.equal(r.state.stage,'deceased');assert.equal(route(r).status,'deceased');assert.equal(route(r).training,null);assert.equal(career(r).terms,0);assert.equal(career(r).benefitRolls,0);assert.equal(r.state.currentCrossCareerTraining,null);replay(r);rejected(r,'cross-career-training',{assignment:'worker'});
});

test('borrowed Rogue paid wager changes only accrued Agent rolls and retains training',()=>{
 let r=train(coverResult({row:5}),'worker');r=run(r,'advancement');r=forceAt(r,r.revision,0,[4,5]);r=settleAssignment(r);if(r.state.stage==='training')r=settleAssignment(run(r,'training',{table:'personal'}));assert.equal(r.state.stage,'term-end');assert.ok(career(r).benefitRolls>=1);
 r=run(r,'continue-career');r=settleAssignment(run(r,'training',{table:'personal'}));
 let pending;
 for(let i=0;i<40;i++){const before=r.revision,next=run(r,'survival');if(next.log.at(-1).rolls[1]?.label==='Event table'){pending=forceAt(next,next.revision,1,[2,6]);break;}r=run(next,'restore',{revision:before});}
 assert.equal(pending.state.stage,'cross-career-cover');
 let offered;
 for(let i=0;i<40;i++){const next=run(pending,'cross-career-cover',{careerId:'core.rogue'});if(route(next).check.success){offered=forceAt(next,next.revision,1,[4,6]);break;}pending=run(next,'restore',{revision:pending.revision});}
 assert.equal(offered.state.stage,'benefit-wager');const before=career(offered).benefitRolls;assert.ok(before>=1);replay(offered);
 for(const success of [false,true]){let done=run(offered,'resolve-benefit-wager',{stake:1,skill:'Gambler'});done=forceAt(done,done.revision,0,success?[6,6]:[1,1]);assert.equal(career(done).benefitRolls,before+(success?1:-1));assert.equal(done.state.character.careers.length,1);assert.equal(career(done).id,'core.agent');assert.equal(done.state.stage,'cross-career-training');done=train(done,'thief');assert.equal(route(done).status,'completed');assert.equal(done.state.stage,'advancement');replay(done);}
});
