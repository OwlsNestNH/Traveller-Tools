import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {createServer} from '../server.mjs';
import {lawyerFixture,run,rejected} from './prisoner-lawyer-fixtures.mjs';
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const record=r=>r.state.character.prisonerLawyers.at(-1);
test('public Prisoner Event 9 offers typed choice with audited source and continuation',()=>{
 const r=lawyerFixture();assert.equal(r.state.stage,'book-step');assert.deepEqual(record(r).source,{id:'core',page:57});assert.equal(record(r).status,'pending');assert.ok(r.log.at(-1).changes.some(c=>c.path.startsWith('prisonerLawyers.')));roundtrip(r);
 const done=run(r,'resolve-prisoner-lawyer',{outcome:'decline'});assert.equal(done.state.character.cash,r.state.character.cash);assert.equal(done.log.at(-1).rolls.length,0);assert.equal(record(done).paroleAfter,record(r).paroleBefore);assert.equal(done.state.stage,'advancement');assert.equal(done.state.character.terms,r.state.character.terms);roundtrip(done);
});
test('hiring pays square cost; only printed Advocate DM applies and successful appeal rolls one die',()=>{
 for(const level of [1,4,5,6]){
  const pending=lawyerFixture({cash:36000});let r=run(pending,'resolve-prisoner-lawyer',{outcome:'hire',level});
  const original=r.revision;r=run(r,'gm-replay',{revision:original,rollIndex:0,values:[4,4],reason:'Verify successful appeal.'});
  const d=record(r).decision;assert.equal(d.cost,1000*level*level);assert.equal(d.cashAfter,36000-d.cost);assert.equal(d.check.total,8+level);assert.equal(d.check.success,true);assert.equal(r.log.at(-1).rolls.length,2);assert.equal(r.log.at(-1).rolls[1].values.length,1);assert.equal(record(r).paroleAfter,record(r).paroleBefore-d.reduction);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.careers.at(-1).released,undefined);roundtrip(r);
 }
 const pending=lawyerFixture();let r=run(pending,'resolve-prisoner-lawyer',{outcome:'hire',level:1});r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1,1],reason:'Verify failed appeal.'});assert.equal(record(r).decision.check.total,3);assert.equal(record(r).decision.reduction,0);assert.equal(record(r).paroleBefore,record(r).paroleAfter);assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.state.character.cash,24000);roundtrip(r);
});
test('invalid, unfunded and bypass decisions reject atomically without RNG or cash changes',()=>{
 const r=lawyerFixture({cash:1000});
 for(const payload of [{},{outcome:'loan'},{outcome:'hire',level:-1},{outcome:'hire',level:1.1},{outcome:'hire',level:'1'},{outcome:'hire',level:NaN},{outcome:'hire',level:Infinity},{outcome:'hire',level:9007199254740991},{outcome:'hire',level:2},{outcome:'hire',level:1,cost:0},{outcome:'hire',level:1,funding:'debt'},{outcome:'hire',level:1,reason:'irrelevant'},{outcome:'hire',level:0},{outcome:'hire',level:0,zeroLevelConfirmed:true,reason:''},{outcome:'decline',level:1}])rejected(r,'resolve-prisoner-lawyer',payload);
 for(const [type,payload] of [['resolve-book',{confirmed:true,note:'Bypass',effects:[]}],['gm-override',{field:'cash',value:100000,reason:'Pending funding'}],['advancement',{}],['leave-career',{}],['choose-effect',{index:0}]])rejected(r,type,payload,/pending lawyer/);
 const done=run(r,'resolve-prisoner-lawyer',{outcome:'hire',level:1});assert.equal(done.state.character.cash,0);assert.equal(done.state.character.debt,r.state.character.debt);roundtrip(done);
});
test('level zero requires an explicit source ruling, never an automatic free hire',()=>{
 const pending=lawyerFixture({cash:0}),r=run(pending,'resolve-prisoner-lawyer',{outcome:'hire',level:0,zeroLevelConfirmed:true,reason:'Referee permits a novice using the printed square-cost formula.'});assert.equal(record(r).decision.cost,0);assert.equal(record(r).decision.check.total,record(r).decision.check.natural);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.debt,pending.state.character.debt);roundtrip(r);
});
test('duplicate, replay, restore and import preserve payments and interrupted opportunities',()=>{
 const pending=lawyerFixture(),payload={outcome:'hire',level:2},done=run(pending,'resolve-prisoner-lawyer',payload,{id:'lawyer-payment'});assert.deepEqual(run(done,'resolve-prisoner-lawyer',payload,{id:'lawyer-payment'}).session,done.session);rejected(done,'resolve-prisoner-lawyer',payload,/pending/);roundtrip(done);
 const restored=run(done,'restore',{revision:pending.revision});assert.equal(restored.state.character.cash,25000);assert.equal(record(restored).status,'pending');assert.equal(record(restored).decision,undefined);roundtrip(restored);
 const declined=run(restored,'resolve-prisoner-lawyer',{outcome:'decline'});assert.equal(declined.state.character.cash,25000);roundtrip(declined);
 // Save reconstruction must not trust an injected snapshot or altered log.
 const bad=JSON.parse(exportSession(done.session));bad.events.at(-1).command.payload.level=5;assert.throws(()=>importSession(JSON.stringify(bad)));
});
test('appeal target is inclusive at eight; only a success consumes reduction dice',()=>{
 for(const [values,success] of [[[2,3],false],[[3,3],true]]){let r=run(lawyerFixture(),'resolve-prisoner-lawyer',{outcome:'hire',level:2});r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values,reason:'Verify appeal boundary.'});assert.equal(record(r).decision.check.success,success);assert.equal(r.log.at(-1).rolls.length,success?2:1);roundtrip(r);}
});
test('lawyer resolution preserves strict parole advancement and term-end continuation',()=>{
 const pending=lawyerFixture(),declined=run(pending,'resolve-prisoner-lawyer',{outcome:'decline'});let r=run(declined,'advancement');r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1,1],reason:'Synthetic below-parole advancement boundary.'});const threshold=record(declined).paroleAfter;assert.equal(r.state.character.careers.at(-1).released,r.log.at(-1).rolls[0].total+2>threshold);assert.equal(threshold,4);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers.at(-1).released,false);rejected(r,'leave-career',{},/parole/);roundtrip(r);
 const original=r.session.events.findLastIndex(e=>e.command.type==='advancement')+1;r=run(r,'gm-replay',{revision:original,rollIndex:0,values:[1,2],reason:'Above the parole threshold.'});assert.equal(r.state.character.careers.at(-1).released,true);roundtrip(r);
});
test('HTTP public transport accepts typed hire and rejects unsupported fields atomically',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const pending=lawyerFixture(),url='http://127.0.0.1:'+server.address().port+'/api/v1';const call=async payload=>{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return response.json();};
 const request={operation:'command',session:pending.session,command:{type:'resolve-prisoner-lawyer',payload:{outcome:'hire',level:2}}};const good=await call(request);assert.equal(good.ok,true,JSON.stringify(good));assert.equal(good.state.character.cash,21000);roundtrip(good);const bad=await call({...request,command:{...request.command,payload:{outcome:'hire',level:2,funding:'debt'}}});assert.equal(bad.ok,false);assert.deepEqual((await call(request)).state,good.state);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('public appeal can reduce threshold below zero and release on advancement total zero',()=>{
 let r=lawyerFixture({parole:3,assignment:'thug',cash:36000});assert.equal(record(r).paroleBefore,3);
 r=run(r,'resolve-prisoner-lawyer',{outcome:'hire',level:6});
 r=run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:[6],reason:'Exercise the full printed reduction die.'});
 assert.equal(record(r).decision.check.success,true);assert.equal(record(r).decision.reduction,6);assert.equal(record(r).paroleAfter,-3);assert.equal(r.state.character.careers.at(-1).parole,-3);roundtrip(r);
 r=run(r,'gm-override',{field:'stat.END',value:3,reason:'Exercise END DM -2 on Thug advancement.'});
 r=run(r,'advancement');r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1,1],reason:'Natural advancement 2 plus END DM -2 equals zero.'});
 assert.equal(r.log.at(-1).rolls[0].total,2);assert.equal(r.state.character.stats.END,3);assert.equal(r.state.character.careers.at(-1).released,true);assert.equal(r.state.character.careers.at(-1).parole,-3);assert.equal(r.state.stage,'term-end');roundtrip(r);
});
test('generic parole effects have a ceiling of twelve but no invented lower floor',async()=>{
 const {readFile}=await import('node:fs/promises'),url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\.?\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const paroleAudit={queueEffects};';const {paroleAudit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const state=structuredClone(lawyerFixture({parole:3}).state);state.pending=null;paroleAudit.queueEffects(state,[{kind:'parole',value:-6}],'advancement',[]);assert.equal(state.character.careers.at(-1).parole,-3);paroleAudit.queueEffects(state,[{kind:'parole',value:20}],'advancement',[]);assert.equal(state.character.careers.at(-1).parole,12);
});
