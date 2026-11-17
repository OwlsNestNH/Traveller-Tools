import test from 'node:test';
import assert from 'node:assert/strict';
import {call,recordUniversitySubjects} from '../gui/crow-edition-client.mjs';
globalThis.location={search:''};

test('Crow characteristics preserve recorded dice, lock acceptance, and retain logged GM exceptions',async()=>{
 let r=await call({operation:'create',seed:'crow-characteristics-review'}),n=0;
 async function command(type,payload={}){const next=await call({operation:'command',session:r.session,expectedRevision:r.revision,id:'crow-'+(++n),command:{type,payload}});if(next.ok)r=next;return next;}
 assert.equal((await command('configure',{allocation:true,psiGm:true,psiTestingWithoutEvent:true,extras:[]})).ok,true);
 assert.equal((await command('gm-mode',{enabled:true})).ok,true);
 assert.equal((await command('setup',{species:'human',name:'Review',gender:'male',homeworld:''})).ok,true);
 assert.equal((await command('roll-statistics')).ok,true);
 const recorded=structuredClone(r.session.events.find(e=>e.command.type==='roll-statistics'));
 assert.equal(recorded.rolls.length,6);
 assert.equal(Object.hasOwn(r.state.character.stats,'PSI'),false);
 for(const [type,payload] of [['roll-statistics',{}],['configure',{boons:6}],['enter-physical-statistic',{code:'STR',value:12}],['gm-physical-dice',{enabled:true}],['restore',{revision:1}]])assert.equal((await command(type,payload)).ok,false,type);
 assert.equal((await command('swap-statistics',{a:0,b:1})).ok,true);
 assert.equal((await command('gm-override',{field:'pool-score',index:0,value:10,reason:'Reviewed correction'})).ok,true);
 assert.equal((await command('accept-statistics')).ok,true);
 assert.equal(r.state.stage,'background');
 for(const type of ['roll-statistics','swap-statistics','accept-statistics','background'])assert.equal((await command(type,{a:0,b:1,skills:[]})).ok,false,type);
 assert.equal((await command('gm-override',{field:'stat.STR',value:11,reason:'Logged exception after acceptance'})).ok,true);
 assert.deepEqual(r.session.events.find(e=>e.command.type==='roll-statistics'),recorded);
 const replay=await call({operation:'project',session:r.session});assert.equal(replay.ok,true);assert.deepEqual(replay.state,r.state);
});

test('Crow permits physical scores before acceptance without allowing regeneration in the same run',async()=>{
 let r=await call({operation:'create',seed:'crow-physical-review'}),n=0;
 async function send(type,payload={}){const next=await call({operation:'command',session:r.session,expectedRevision:r.revision,id:'manual-'+(++n),command:{type,payload}});if(next.ok)r=next;return next;}
 assert.equal((await send('configure',{physicalDice:true})).ok,true);
 assert.equal((await send('setup',{species:'human',name:'Manual',gender:'female'})).ok,true);
 for(const code of ['STR','DEX','END','INT','EDU','SOC'])assert.equal((await send('enter-physical-statistic',{code,value:8})).ok,true);
 assert.equal((await send('roll-statistics')).ok,false);
 assert.equal((await send('accept-statistics')).ok,true);
 assert.equal((await send('enter-physical-statistic',{code:'STR',value:12})).ok,false);
 assert.equal(r.session.events.flatMap(e=>e.rolls??[]).length,0);
});

test('Crow background and University admission preserve the one-attempt rule on success and failure',async()=>{
 const outcomes=new Set();
 for(let seed=0;seed<30&&outcomes.size<2;seed++){
  let r=await call({operation:'create',seed:'crow-admission-'+seed}),id=0;
  const send=async(type,payload={})=>{const result=await call({operation:'command',session:r.session,id:'admit-'+(++id),expectedRevision:r.revision,command:{type,payload}});if(result.ok)r=result;return result;};
  for(const [type,payload] of [['setup',{species:'human',name:'Admission',gender:'male'}],['roll-statistics',{}],['accept-statistics',{}]])assert.equal((await send(type,payload)).ok,true);
  assert.equal((await send('background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)})).ok,true);
  assert.equal(r.state.stage,'precareer');
  for(const type of ['swap-statistics','roll-statistics','background'])assert.equal((await send(type,{a:0,b:1,skills:[]})).ok,false);
  assert.equal((await send('precareer',{id:'core.academy-army'})).ok,false);
  assert.equal((await send('precareer',{id:'core.university'})).ok,true);
  outcomes.add(r.educationResultView.outcome==='failure'?'failure':'success');
  const accepted=structuredClone(r.session),dice=r.session.events.find(e=>e.command.type==='precareer').rolls;assert.equal(dice.length,1);
  for(const type of ['precareer','open-precareer','skip-precareer','acknowledge-education-result','restore'])assert.equal((await send(type,{id:'core.university',name:'Admin'})).ok,false,type);
  assert.deepEqual(r.session,accepted);
  const replay=await call({operation:'project',session:r.session});assert.equal(replay.ok,true);assert.deepEqual(replay.state,r.state);
  if(r.state.stage==='education-skill'){
   assert.equal(r.state.pendingChoice.value,0);
   const original=structuredClone(r.session),request={session:r.session,id:'pair',expectedRevision:r.revision};
   assert.equal((await recordUniversitySubjects({...request,expectedRevision:r.revision-1},['Science (physics)','Animals (training)'])).ok,false);
   assert.equal((await recordUniversitySubjects(request,['Science (physics)','Animals (riding)'])).ok,false);
   assert.equal((await recordUniversitySubjects(request,['Science (physics)','Science (biology)'])).ok,false);
   let commands=0;
   const interrupted=await recordUniversitySubjects(request,['Science (xenobotany)','Animals (training)'],async q=>{if(q.operation==='command'&&++commands===2)return {ok:false,error:{message:'Simulated second-command failure'}};return call(q);});
   assert.equal(interrupted.ok,false);assert.deepEqual(r.session,original);
   let attempted=0;
   const diverted=await recordUniversitySubjects(request,['Science (xenobotany)','Animals (training)'],async q=>{const result=await call(q);if(q.operation==='command'){attempted++;result.state.stage='book-step';}return result;});
   assert.equal(diverted.ok,false);assert.equal(attempted,1);assert.deepEqual(r.session,original);
   const pair=await recordUniversitySubjects(request,['Science (xenobotany)','Animals (training)']);
   assert.equal(pair.ok,true);assert.equal(pair.session.events.length,original.events.length+2);
   assert.deepEqual(pair.session.events.slice(0,-2),original.events);
   assert.deepEqual(pair.session.events.slice(-2).map(e=>e.command.payload.name),['Science (xenobotany)','Animals (training)']);
   assert.equal(pair.state.character.skills.Science,0);assert.equal(pair.state.character.skills['Animals (training)'],1);
   assert.deepEqual(r.session,original);

   assert.equal((await send('education-skill',{name:'Animals (riding)'})).ok,false);
   assert.equal((await send('education-skill',{name:'Science (xenobotany)'})).ok,true);
   assert.equal(r.state.character.skills.Science,0);
   assert.equal(r.state.pendingChoice.value,1);
   assert.equal((await send('education-skill',{name:'Science (physics)'})).ok,false);
   assert.equal((await send('education-skill',{name:'Animals (training)'})).ok,true);
   assert.equal(r.state.character.skills['Animals (training)'],1);
   assert.deepEqual(r.session.events.find(e=>e.command.type==='precareer').rolls,dice);
   for(const type of ['education-skill','education-event','acknowledge-education-result'])assert.equal((await send(type,{name:'Admin'})).ok,false);
   assert.equal((await call({operation:'project',session:r.session})).ok,true);
  }else assert.equal((await send('education-skill',{name:'Admin'})).ok,false);

 }
 assert.deepEqual([...outcomes].sort(),['failure','success']);
});
