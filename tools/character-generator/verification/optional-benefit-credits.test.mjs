import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {CORE_PACK} from '../engine/core-pack.mjs';
import {EXPANSION_PACK} from '../engine/expansion-pack.mjs';
import {lifeFixture,run,rejected} from './core-life-event-fixtures.mjs';
import {optionalBenefitFixture as benefits,settle} from './optional-benefit-fixtures.mjs';
import {createServer} from '../server.mjs';
const replay=(r,index,values)=>run(r,'gm-replay',{revision:r.revision,rollIndex:index,values,reason:'Optional Benefit regression source roll'});
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
test('verified Core and Vargr single-roll sources preserve restricted versus unrestricted scope',()=>{
 assert.deepEqual(CORE_PACK['core.citizen'].events[5],[{kind:'benefit-credit',value:1,scope:'any',source:{id:'core',page:27}}]);assert.equal(CORE_PACK['core.agent'].events[4][0].scope,'career');
 assert.deepEqual(EXPANSION_PACK['vargr.merchant'].events[4],[{kind:'benefit-credit',value:1,scope:'career',source:{id:'aliens',page:197}}]);assert.equal(EXPANSION_PACK['vargr.citizen'].events[5][0].scope,'any');assert.equal(EXPANSION_PACK['vargr.intermediary'].events[4][0].scope,'any');
 assert.equal(EXPANSION_PACK['companion.believer'].events[6].at(-1).scope,'all');assert.equal(EXPANSION_PACK['zhodani.agent'].events[5][0].kind,'modifier');
});
for(const vargr of [false,true])test('public source credit can be held, selected once, restored and replayed: '+vargr,()=>{
 let r=benefits(vargr);assert.equal(r.state.benefitCreditOptions.length,1);const id=r.state.benefitCreditOptions[0].id,base=Object.hasOwn(r.state.character.skills,'Gambler')?1:0;
 for(const creditIds of [[id,id],['forged'],[{}],'forged'])rejected(r,'benefit',{cash:true,creditIds});
 r=replay(run(r,'benefit',{cash:true}),0,[1]);assert.equal(r.state.character.benefitCredits[0].status,'available');assert.equal(r.state.character.benefitRollHistory.at(-1).modifier,base);roundtrip(r);
 const before=r.revision;r=run(r,'benefit',{cash:true,creditIds:[id]},{id:'credit-once'});const forged=structuredClone(r.session);forged.events.at(-1).command.payload.creditIds=['forged'];assert.throws(()=>importSession(JSON.stringify(forged)),/credit|unavailable/);assert.deepEqual(run(r,'benefit',{cash:true,creditIds:[id]},{id:'credit-once'}).session,r.session);r=replay(r,0,[1]);assert.equal(r.state.character.benefitCredits[0].status,'consumed');assert.equal(r.state.character.benefitRollHistory.at(-1).modifier,base+1);assert.deepEqual(r.state.character.benefitRollHistory.at(-1).creditIds,[id]);rejected(r,'benefit',{cash:true,creditIds:[id]});roundtrip(r);
 r=run(r,'restore',{revision:before});assert.equal(r.state.character.benefitCredits[0].status,'available');roundtrip(r);
});
for(const vargr of [false,true])test('career exit expires only current-career credits: '+vargr,()=>{let r=benefits(vargr);while(r.state.stage==='benefits')r=settle(replay(run(r,'benefit',{cash:false}),0,[2]));assert.equal(r.state.character.benefitCredits[0].status,vargr?'expired':'available');roundtrip(r);});
test('release HTTP validates selected credit identities and matches direct transport',async()=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const r=benefits();for(const creditIds of [['forged'],[r.state.benefitCreditOptions[0].id],[]]){const request={operation:'command',session:r.session,command:{type:'benefit',payload:{cash:true,creditIds}}};const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});assert.deepEqual(await response.json(),api(request));}roundtrip(r);}finally{await new Promise(resolve=>server.close(resolve));}});
test('all source-backed single-roll awards are credits while coupled Merchant and deferred packs stay unchanged',()=>{
 const credits=[];function walk(v){if(!v||typeof v!=='object')return;if(v.kind==='benefit-credit')credits.push(v);if(v.kind==='modifier'&&v.target==='benefit')assert.notEqual(v.scope,'one');for(const child of Object.values(v))walk(child);}
 for(const pack of Object.values(CORE_PACK))walk(pack.events);
 for(const [id,pack] of Object.entries(EXPANSION_PACK))if(id.startsWith('vargr.'))for(const [row,effects] of Object.entries(pack.events))if(!(id==='vargr.merchant'&&row==='3'))walk(effects);
 assert.equal(credits.length,26);assert.ok(credits.every(c=>c.source.page&&['any','career'].includes(c.scope)));
});
