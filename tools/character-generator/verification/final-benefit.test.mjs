import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {run} from './assignment-fixtures.mjs';import {finalBenefitFixture} from './final-benefit-fixtures.mjs';
for(const [name,options] of [['Armour',{die:5}],['characteristic',{die:2}],['cash',{cash:true,die:3}],['choice ending award',{die:6}]])test(name+' final result is acknowledged without changing character, rolls or history',()=>{
 const r=finalBenefitFixture(options),v=r.finalBenefitView;assert.ok(v);assert.equal(r.state.stage,'career');assert.equal(v.record.natural,options.die);
 const old=exportSession(r.session),restored=api({operation:'import',raw:old});assert.deepEqual(restored.finalBenefitView,v);
 const next=run(r,'acknowledge-final-benefit',{pendingId:v.id});assert.equal(next.finalBenefitView,undefined);assert.deepEqual(next.state.character,r.state.character);assert.equal(next.state.rng,r.state.rng);assert.deepEqual(next.session.events.slice(0,-1),r.session.events);assert.deepEqual(next.log.at(-1).rolls,[]);
 assert.equal(api({operation:'command',session:next.session,command:{type:'acknowledge-final-benefit',payload:{pendingId:v.id}}}).ok,false);
 const back=run(next,'restore',{revision:r.revision});assert.ok(back.finalBenefitView);assert.deepEqual(back.state.character,r.state.character);
 const mode=run(r,'gm-mode',{enabled:false});assert.equal(mode.finalBenefitView.id,v.id);
 const notes=run(r,'notes',{text:'Keeps the earned benefit.'});assert.equal(notes.finalBenefitView.id,v.id);
 assert.equal(api({operation:'command',session:r.session,command:{type:'acknowledge-final-benefit',payload:{pendingId:'wrong'}}}).ok,false);
});

test('source-resolved final Navy award keeps source resolution before the result screen',()=>{
 const pending=finalBenefitFixture({career:'core.navy',assignment:'crew',die:6});assert.equal(pending.state.pending.kind,'benefit-source');assert.equal(pending.finalBenefitView,undefined);
 const result=run(pending,'resolve-book',{confirmed:true,note:'Synthetic referee resolution for unsupported award.',benefitResolution:'none'});assert.ok(result.finalBenefitView);assert.equal(result.finalBenefitView.record.careerId,'core.navy');assert.equal(result.finalBenefitView.record.natural,6);
 const done=run(result,'acknowledge-final-benefit',{pendingId:result.finalBenefitView.id});assert.deepEqual(done.state.character,result.state.character);assert.equal(done.state.rng,result.state.rng);
});
