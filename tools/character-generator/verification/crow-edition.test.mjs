import test from 'node:test';
import assert from 'node:assert/strict';
import {call} from '../gui/crow-edition-client.mjs';
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
