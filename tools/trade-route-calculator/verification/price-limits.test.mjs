import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
import {Store,KEY} from '../js/persistence.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const world={id:'0,0',x:0,y:0,name:'Test',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const ctx=R.context(world,core),good={...core.commodities[0],baseCreditsPerTon:1000,purchaseDM:{},saleDM:{}};
const enabled={reducedProfitLimitsEnabled:true};
const quote=(side,rollTotal,options={})=>R.quote(good,ctx,{skill:0,counterparty:0,side,rollTotal,...options},core);
const roundTrip=s=>S.validate(JSON.parse(JSON.stringify(s)));
test('limits start off at 85/115; legacy saves receive disabled defaults',()=>{
 const s=S.initial();assert.deepEqual(R.priceLimits(s.settings),{reducedProfitLimitsEnabled:false,minPurchasePercent:85,maxSalePercent:115});
 delete s.settings.reducedProfitLimitsEnabled;delete s.settings.minPurchasePercent;delete s.settings.maxSalePercent;
 const restored=roundTrip(s);assert.equal(restored.schema,1);assert.deepEqual(R.priceLimits(restored.settings),R.priceLimits());
 assert.equal(quote('buy',100,restored.settings).unitPrice,'150');
});
test('off preserves RAW prices even with custom limit values',()=>{
 for(const side of ['buy','sell'])for(const roll of [-100,8,11,14,100]){
  const raw=quote(side,roll),off=quote(side,roll,{reducedProfitLimitsEnabled:false,minPurchasePercent:99,maxSalePercent:101});
  assert.equal(off.unitPrice,raw.unitPrice);assert.equal(off.audit.percent,raw.audit.percent);assert.equal(off.audit.priceLimitApplied,false);
 }
});
test('enabled defaults clamp extreme rolls before conversion to Credits',()=>{
 const buy=quote('buy',100,enabled),sell=quote('sell',100,enabled);
 assert.equal(buy.audit.tablePercent,15);assert.equal(buy.audit.percent,85);assert.equal(buy.unitPrice,'850');
 assert.equal(sell.audit.tablePercent,400);assert.equal(sell.audit.percent,115);assert.equal(sell.unitPrice,'1150');
 assert.equal(buy.audit.priceLimitApplied,true);assert.equal(sell.audit.priceLimitApplied,true);
});
test('purchase above floor and sale below ceiling, including exact boundaries, are unchanged',()=>{
 for(const [side,roll]of [['buy',8],['buy',11],['sell',8],['sell',14],['buy',-100],['sell',-100]]){
  const raw=quote(side,roll),limited=quote(side,roll,enabled);
  assert.equal(limited.unitPrice,raw.unitPrice);assert.equal(limited.audit.percent,raw.audit.percent);assert.equal(limited.audit.priceLimitApplied,false);
 }
});
test('custom whole-point values and independently crossed bounds work',()=>{
 const custom={...enabled,minPurchasePercent:92,maxSalePercent:108};
 assert.equal(quote('buy',100,custom).unitPrice,'920');assert.equal(quote('sell',100,custom).unitPrice,'1080');
 assert.equal(quote('buy',100,{...enabled,minPurchasePercent:200,maxSalePercent:100}).audit.percent,200);
 assert.equal(quote('buy',100,{...enabled,minPurchasePercent:0}).audit.percent,15);
 assert.equal(quote('sell',100,{...enabled,maxSalePercent:0}).unitPrice,'0');
 assert.equal(quote('buy',100,{...enabled,minPurchasePercent:400}).unitPrice,'4000');
});
test('base retail cap and illegal RAW exception stay independent of percentage limits',()=>{
 const cap={...enabled,maxBaseRetailEnabled:true,maxBaseRetail:500};
 for(const [side,expected]of [['buy','425'],['sell','575']]){
  const q=quote(side,100,cap);assert.equal(q.unitPrice,expected);assert.equal(q.audit.rawBasePrice,1000);assert.equal(q.audit.basePrice,500);assert.equal(q.audit.baseRetailCapApplied,true);
 }
 const illegal=quote('sell',100,{...cap,useRawIllegalPrices:true,illegalGood:true});
 assert.equal(illegal.unitPrice,'1150');assert.equal(illegal.audit.illegalRawPriceExempt,true);assert.equal(illegal.audit.percent,115);
 assert.equal(quote('sell',100,{...cap,reducedProfitLimitsEnabled:false}).unitPrice,'2000');
});
test('generated supplier quotes also use limits',()=>{
 const offers=R.market(ctx,{skill:100,counterparty:0,...enabled},core,()=>1);
 assert.ok(offers.length>0);assert.ok(offers.filter(o=>!o.manualRequired).every(o=>o.audit.percent===85&&o.audit.tablePercent===15));
});
test('purchase and sale broker fees use clamped gross, then existing accounting',()=>{
 const s=S.initial();s.initialized=true;s.actual=world.id;s.worlds[world.id]=world;s.bank='100000';
 const buyQuote=quote('buy',100,enabled);
 s.snapshots=[{id:'snapshot',kind:'supplier',worldId:world.id,hours:0,startedHours:0,offers:[{id:'offer',commodity:good.id,remaining:'2',unitPrice:buyQuote.unitPrice,expired:false,audit:buyQuote.audit}]}];
 S.buy(s,{snapshotId:'snapshot',offerId:'offer',quantity:'2',feePercent:10});
 assert.equal(s.lots[0].goodsValue,'1700');assert.equal(s.lots[0].basis,'1870');assert.equal(s.bank,'98130');
 const saleQuote=quote('sell',100,enabled);
 const p=R.salePreview(s.lots,[{lotId:s.lots[0].id,quantity:'2',unitPrice:saleQuote.unitPrice,audit:saleQuote.audit}],{percent:100,feePercent:10,taxEnabled:false},core,mp);
 assert.equal(p.gross,'2300');assert.equal(p.fee,'230');assert.equal(p.lines[0].raw,'200');assert.equal(p.bankDelta,'2070');
 S.sell(s,p,world.id);assert.equal(s.bank,'100200');
});
test('toggle on/off/on preserves custom values, cap, existing profit mode and saved audits; undo works',()=>{
 let s=S.initial();s.settings.minPurchasePercent=91;s.settings.maxSalePercent=109;s.settings.maxBaseRetailEnabled=true;s.settings.maxBaseRetail='500';s.settings.profit=75;
 s.worlds[world.id]=world;
 const savedQuote=quote('buy',100);
 s.snapshots=[{id:'frozen',kind:'supplier',worldId:world.id,hours:0,startedHours:0,offers:[{id:'frozen-offer',commodity:good.id,remaining:'1',unitPrice:savedQuote.unitPrice,expired:false,audit:savedQuote.audit}]}];
 const frozen=JSON.stringify(s.snapshots);
 const before=JSON.stringify(s);
 for(const value of [true,false,true]){
  s=S.transition(s,'Toggle limits',next=>{next.settings.reducedProfitLimitsEnabled=value;});
  s=roundTrip(s);assert.equal(s.settings.minPurchasePercent,91);assert.equal(s.settings.maxSalePercent,109);assert.equal(s.settings.profit,75);assert.equal(s.settings.maxBaseRetail,'500');assert.equal(s.settings.maxBaseRetailEnabled,true);
  assert.equal(quote('buy',100,s.settings).audit.percent,value?91:15);assert.equal(JSON.stringify(s.snapshots),frozen);
 }
 assert.equal(S.undo(s).settings.reducedProfitLimitsEnabled,false);
 assert.equal(JSON.parse(before).settings.reducedProfitLimitsEnabled,false);
});
test('imports reject malformed toggles and empty, fractional, negative, nonfinite or excessive values',()=>{
 for(const key of ['minPurchasePercent','maxSalePercent'])for(const value of ['', ' ',null,true,[],{},-1,401,85.5,'NaN',Infinity]){
  const s=S.initial();s.settings[key]=value;assert.throws(()=>S.validate(s),/whole percentage/);
 }
 for(const value of ['false',0,null]){const s=S.initial();s.settings.reducedProfitLimitsEnabled=value;assert.throws(()=>S.validate(s),/on or off/);}
 const s=S.initial();s.settings.minPurchasePercent='86';s.settings.maxSalePercent='116';assert.equal(roundTrip(s).settings.minPurchasePercent,86);
});
test('settings render labeled native number inputs with one-point bounds and save both values',()=>{
 for(const name of ['minPurchasePercent','maxSalePercent']){
  const field=app.slice(app.indexOf("field('"+name+"'"));assert.ok(field.slice(0,240).includes("'number','min=\"0\" max=\"400\" step=\"1\" required'"));
 }
 assert.match(app,/Minimum buy · % of base retail/);assert.match(app,/Maximum sell · % of base retail/);
 assert.match(app,/reducedProfitLimitsEnabled:f.has\('reducedProfitLimitsEnabled'\),minPurchasePercent:f.get\('minPurchasePercent'\),maxSalePercent:f.get\('maxSalePercent'\)/);
});

test('Store save/read/replace preserves limits and supplies legacy defaults',()=>{
 const original={window:globalThis.window,localStorage:globalThis.localStorage,BroadcastChannel:globalThis.BroadcastChannel};
 const memory=new Map();
 globalThis.window={addEventListener(){}};
 globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value))};
 globalThis.BroadcastChannel=undefined;
 try{
  const store=new Store(()=>{},()=>{});store.editable=true;
  const s=S.initial();s.settings.reducedProfitLimitsEnabled=true;s.settings.minPurchasePercent=93;s.settings.maxSalePercent=107;
  store.save(s,0);assert.deepEqual(store.read().settings,s.settings);
  const backup=JSON.parse(memory.get(KEY));backup.settings.reducedProfitLimitsEnabled=false;
  store.replace(backup,0);assert.equal(store.read().settings.minPurchasePercent,93);assert.equal(store.read().settings.maxSalePercent,107);assert.equal(store.read().settings.reducedProfitLimitsEnabled,false);
  const legacy=S.initial();delete legacy.settings.reducedProfitLimitsEnabled;delete legacy.settings.minPurchasePercent;delete legacy.settings.maxSalePercent;
  memory.set(KEY,JSON.stringify(legacy));assert.deepEqual(R.priceLimits(store.read().settings),R.priceLimits());
 }finally{Object.assign(globalThis,original);}
});
