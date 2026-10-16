import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as S from '../js/session.mjs';
import * as E from '../js/engine.mjs';
import {positions,worldData} from '../js/map-adapter.mjs';
const chart=JSON.parse(await readFile(new URL('../../trade-route-calculator/rules/merchant-prince-1e.json',import.meta.url))).tax;
const origin={id:'0,0',name:'Origin',x:0,y:0,uwp:'A788899-C'},dest={id:'1,0',name:'Destination',x:1,y:0,uwp:'A788899-C'};
const start=()=>S.setup(S.initial(),{...S.defaults,bank:'600000'},origin);
const load=s=>JSON.parse(JSON.stringify(s));
test('purchase, separate search/quote, reload, cancellation/hold and consolidated sale retain exact cost and dice',()=>{
  let s=start();s=S.offer(s,{id:'l1',name:'Cargo',tonnes:'25',purchase:'100000',risk:'moderate'});s=S.buy(s,'l1');
  assert.equal(E.approximate(s.cash),500000);assert.throws(()=>S.buy(s,'l1'),/unavailable/);
  s=S.destination(s,dest);s=S.arrive(s,{freight:'40000',freightTonnes:'25'});
  assert.equal(E.approximate(s.lots[0].departure.baseline),226875);
  assert.throws(()=>S.value(s,'l1',[3,4]),/buyer/);
  s=S.search(s,'l1',[3,4]);s=S.value(s,'l1',[3,4]);s=load(s);S.validate(s);
  const before=JSON.stringify(s);S.search(s,'l1',[6,6]);S.value(s,'l1',[6,6]);assert.equal(JSON.stringify(s),before);
  const preview=S.preview(s,chart,{fees:'1000',government:'4'});assert.equal(JSON.stringify(s),before);
  assert.equal(E.approximate(preview.gross),226875);assert.equal(s.lots[0].purchase,'100000');
  assert.throws(()=>S.nextDeparture(s),/Carry\/retry/);
  s=S.sell(s,chart,{fees:'1000',government:'4'});assert.equal(s.phase,'closed');assert.equal(E.approximate(s.cash),740700);
  assert.throws(()=>S.sell(s,chart,{fees:'1000',government:'4'}),/unsettled/);
});
test('full capacity and affordability reject purchases; failed buyer search and invalid dice cannot be rerolled',()=>{
  let s=start();s=S.offer(s,{id:'l',name:'Oversize',tonnes:'51',purchase:'100000',risk:'high'});assert.throws(()=>S.buy(s,'l'),/fit/);
  s.offers[0].tonnes='25';s.offers[0].purchase='700000';assert.throws(()=>S.buy(s,'l'),/cash/);
  s.offers[0].purchase='100000';s=S.buy(s,'l');s=S.destination(s,dest);s=S.arrive(s,{});
  assert.throws(()=>S.search(s,'l',[0,7]),/d6/);s=S.search(s,'l',[1,1]);assert.equal(s.lots[0].search.success,false);
  s=S.search(s,'l',[6,6]);assert.equal(s.lots[0].search.success,false);
});
test('combined port sale nets losses against gains; monthly bill and month-start target are explicit',()=>{
  const result=E.settle({lines:[{gross:150000,purchase:100000},{gross:90000,purchase:100000}],fees:1000,government:'4',taxChart:chart,zeroLossTrial:true});
  assert.equal(E.approximate(result.gain),39000);assert.equal(E.approximate(result.tax),4680);
  let s=start();s.jumps=1;s.phase='closed';s=S.nextDeparture(s,{monthlyTarget:'-50000'});assert.equal(s.settings.monthlyTarget,'50000');
  s.jumps=2;s.phase='closed';s.cash=E.packed(100000);s=S.nextDeparture(s);assert.equal(s.phase,'stopped');assert.equal(E.approximate(s.unpaid),133000);
});
test('four-parsec filter uses hex distance and handles negative-column parity',()=>{
  const worlds=[origin,{...dest,x:4,y:2,id:'4,2'},{...dest,x:5,y:2,id:'5,2'}];
  assert.deepEqual(positions(worlds,origin,4).map(x=>x.world.id),['0,0','4,2']);
  assert.throws(()=>positions(worlds,origin,5),/1–4/);
  assert.equal(positions([{...origin,x:-1,y:0}],origin,4)[0].y,277);
});
test('malformed imported search HTML and inconsistent active sessions are rejected',()=>{
  const s=start();s.phase='arrived';s.current=null;assert.throws(()=>S.validate(s),/current world/);
  const bad=start();bad.lots.push({id:'x',name:'x',tonnes:'1',purchase:'1',risk:'low',search:{dice:['<img src=x onerror=alert(1)>'],total:'<img src=x>'}});
  assert.throws(()=>S.validate(bad),/d6/);
});
test('same adapter provides a labeled dated partial backup and refuses unsupported coverage',async()=>{
  const backup=JSON.parse(await readFile(new URL('../data/world-backup.json',import.meta.url)));
  assert.equal(backup.Worlds.length,127);assert.equal(backup.captured,'2026-10-09');
  const adapter=worldData({load:async()=>{throw Error('offline');},nearby:async()=>{throw Error('offline');},backup:async()=>backup});
  const world=await adapter.loadWorld('Trojan Reach','2211');assert.ok(world.dataSource.includes('2026-10-09'));
  const neighbors=await adapter.loadNearby(world);assert.ok(neighbors.length>0);assert.ok(neighbors.every(w=>w.dataSource.includes('partial')));
  await assert.rejects(adapter.loadWorld('Spinward Marches','1910'),/no matching world/);
  await assert.rejects(adapter.loadNearby(origin),/no verified local coverage/);
});
