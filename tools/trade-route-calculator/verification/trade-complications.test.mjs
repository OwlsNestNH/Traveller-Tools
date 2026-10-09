import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const world={id:'0,0',x:0,y:0,name:'Synthetic world',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const ctx=R.context(world,core),good=core.commodities[0],options={skill:1,counterparty:2,side:'buy'};
const quote=(faces,extra={})=>{let calls=0;const q=R.quote(good,ctx,{...options,...extra},core,()=>{assert.ok(calls<faces.length,'No extra RNG');return faces[calls++];});return {q,calls};};
const roundTrip=s=>S.validate(JSON.parse(JSON.stringify(s)));
const economic=s=>Object.fromEntries(['bank','hours','lots','policies','contracts','ledger','snapshots'].map(k=>[k,s[k]]));

test('all 216 natural 3D outcomes classify exactly 90 pairs, 6 triples and 120 clean rolls',()=>{
 const counts={complication:0,severe:0,none:0};
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++){
  const faces=[a,b,c],expected=a===b&&b===c?'severe':a===b||a===c||b===c?'complication':'none';
  assert.equal(R.classifyTradeComplication(faces),expected);counts[expected]++;
  for(const side of ['buy','sell']){
   const {q,calls}=quote(faces,{side,skill:50,local:true,reducedProfitLimitsEnabled:true});
   assert.equal(calls,3);assert.deepEqual(q.audit.dice,{dice:faces,total:a+b+c});assert.deepEqual(q.audit.tradeComplication,{version:1,result:expected});
   const entered=quote([],{side,skill:50,local:true,reducedProfitLimitsEnabled:true,rollTotal:a+b+c});
   assert.equal(entered.calls,0);assert.equal(q.unitPrice,entered.q.unitPrice);
   for(const k of ['modified','tableResult','tablePercent','percent','priceLimitApplied'])assert.equal(q.audit[k],entered.q.audit[k]);
  }
 }
 assert.deepEqual(counts,{complication:90,severe:6,none:120});
});
test('missing, nonnatural or malformed faces are unknown, never clean; totals never imply triples',()=>{
 for(const faces of [undefined,null,[],Array(3),[5,,5],[5,5],[5,5,5,5],['5',5,5],[0,1,1],[7,1,1],[1.5,1,1],[NaN,1,1],{},'555'])assert.equal(R.classifyTradeComplication(faces),'unknown');
 for(const rollTotal of [-100,3,12,15,18,100]){const {q,calls}=quote([],{rollTotal});assert.equal(calls,0);assert.equal(q.audit.dice.manual,true);assert.equal(q.audit.tradeComplication.result,'unknown');}
});
test('local-ban repricing preserves original natural/manual/legacy provenance without RNG or mutation',()=>{
 for(const seed of [[5,5,2],[5,5,5],[1,2,3],null]){
  const original=seed?quote(seed,{side:'sell'}).q:quote([],{side:'sell',rollTotal:15}).q;
  for(const legacy of [false,true]){
   const q=structuredClone(original);if(legacy)delete q.audit.tradeComplication;
   const bytes=JSON.stringify(q),repriced=R.repriceQuote(good,ctx,{...options,side:'sell',banThreshold:2},core,q);
   assert.equal(JSON.stringify(q),bytes);assert.deepEqual(repriced.audit.dice,q.audit.dice);assert.deepEqual(repriced.audit.tradeComplication,q.audit.tradeComplication);assert.notEqual(repriced.audit.dice,q.audit.dice);assert.equal(repriced.audit.sale.localIllegalDM,7);
   assert.equal(repriced.unitPrice,quote([],{side:'sell',rollTotal:q.audit.dice.total,banThreshold:2}).q.unitPrice);
  }
 }
 for(const original of [{},{audit:{}},{audit:{dice:{dice:[5,5,5]}}}])assert.throws(()=>R.repriceQuote(good,ctx,options,core,original),/Original price roll is unavailable/);
});
test('duplicate availability draws retain one price roll per commodity and distinct quantity rolls',()=>{
 const duplicateContext={...ctx,uwp:{...ctx.uwp,population:3}};let calls=0;
 const market=R.market(duplicateContext,options,core,()=>{calls++;return 1;}),original=market.find(o=>o.commodity==='11');
 assert.deepEqual(original.audit.randomDraws,['11','11','11']);assert.equal(original.audit.quantityRolls.length,4);assert.equal(original.audit.tradeComplication.result,'severe');
 const quantityCalls=market.reduce((n,o)=>n+o.audit.quantityRolls.reduce((n,r)=>n+r.dice.length,0),0);
 assert.equal(calls,6+quantityCalls+market.length*3);
});
test('repeated purchases, partial/full sales, reload and Undo preserve quote flags without other consequences',()=>{
 let s=S.initial();s.initialized=true;s.actual=world.id;s.worlds[world.id]=world;s.bank='1000000';const buy=quote([5,5,2]).q;
 s.snapshots=[{id:'supplier',kind:'supplier',worldId:world.id,party:'supplier',hours:0,startedHours:0,offers:[{id:'offer',commodity:good.id,description:'Shared offer',remaining:'6',expired:false,...buy}]}];
 const before=roundTrip(s);
 for(let i=0;i<2;i++)s=roundTrip(S.transition(s,'Purchase',next=>S.buy(next,{snapshotId:'supplier',offerId:'offer',quantity:'2',description:'Lot '+i})));
 assert.equal(s.lots.length,2);assert.notEqual(s.lots[0].id,s.lots[1].id);assert.equal(s.hours,before.hours);
 for(const lot of s.lots)assert.deepEqual(lot.audit.price.audit.tradeComplication,buy.audit.tradeComplication);
 for(const entry of s.ledger)assert.deepEqual(entry.purchase.priceAudit.tradeComplication,buy.audit.tradeComplication);
 assert.equal(s.bank,String(BigInt(before.bank)-4n*BigInt(buy.unitPrice)));
 const acquired=roundTrip(s),ids=s.lots.map(l=>l.id),sales=[quote([5,5,5],{side:'sell'}).q,quote([1,2,3],{side:'sell'}).q];
 const preview=R.salePreview(s.lots,ids.map((lotId,i)=>({lotId,quantity:i?'2':'1',unitPrice:sales[i].unitPrice,audit:sales[i].audit})),{percent:75,feePercent:10,taxEnabled:false},core,mp);
 s=roundTrip(S.transition(s,'Sale',next=>S.sell(next,preview,world.id)));
 assert.equal(s.hours,before.hours);assert.equal(s.lots.length,1);assert.equal(s.lots[0].quantity,'1');
 assert.deepEqual(s.ledger.filter(e=>e.type==='Sale').map(e=>e.audit.audit.tradeComplication.result),['severe','none']);assert.equal(s.bank,String(BigInt(acquired.bank)+BigInt(preview.bankDelta)));assert.deepEqual(economic(roundTrip(S.undo(s))),economic(acquired));
 const last=R.salePreview(s.lots,[{lotId:ids[0],quantity:'1',unitPrice:sales[0].unitPrice,audit:sales[0].audit}],{percent:100,feePercent:0,taxEnabled:false},core,mp),partial=roundTrip(s);
 s=roundTrip(S.transition(s,'Final sale',next=>S.sell(next,last,world.id)));
 assert.equal(s.lots.length,0);assert.equal(s.ledger.filter(e=>e.type==='Sale').at(-1).audit.audit.tradeComplication.result,'severe');assert.deepEqual(economic(roundTrip(S.undo(s))),economic(partial));assert.deepEqual(s.snapshots[0].offers[0].audit,buy.audit);
});
test('historical audits stay untouched through validation, JSON import and new purchases',()=>{
 const old=quote([5,5,5]).q;delete old.audit.tradeComplication;const s=S.initial();s.initialized=true;s.actual=world.id;s.worlds[world.id]=world;s.bank='1000000';
 s.snapshots=[{id:'old',kind:'supplier',worldId:world.id,hours:0,startedHours:0,offers:[{id:'old-offer',commodity:good.id,remaining:'2',expired:false,...old}]}];
 const loaded=roundTrip(s);assert.equal(Object.hasOwn(loaded.snapshots[0].offers[0].audit,'tradeComplication'),false);S.buy(loaded,{snapshotId:'old',offerId:'old-offer',quantity:'1'});assert.equal(Object.hasOwn(roundTrip(loaded).lots[0].audit.price.audit,'tradeComplication'),false);
});
