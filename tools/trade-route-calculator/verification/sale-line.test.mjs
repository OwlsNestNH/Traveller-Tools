import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as R from '../js/rules.mjs';
import {prepareSaleLine} from '../js/sale-line.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const before=await readFile(new URL('fixtures/sale-line-before-pilot.mjs',import.meta.url),'utf8');
const world={id:'0,0',uwp:'A788899-C',zone:'Safe'};
const context=R.context(world,core),commodity=core.commodities[0];
const pricing={...R.priceLimits(),maxBaseRetailEnabled:true,maxBaseRetail:5000,useRawIllegalPrices:true};
function input(extra={}){
 const lot={id:'synthetic-lot',commodity:commodity.id,illegal:false,quantity:'2.5',basis:'1000',description:'Synthetic cargo'};
 const buyer={criminal:true,options:{skill:1,counterparty:2}};
 const quote=R.quote(commodity,context,{...buyer.options,...pricing,side:'sell',creditStep:1},core,()=>3);
 return {lot,buyer,context,quote,commodity,pricing,creditStep:1,core,values:{ban:'',price:quote.unitPrice,benchmark:'5000',quantity:'2.5',taxRate:null,reason:''},...extra};
}
const json=x=>JSON.parse(JSON.stringify(x));
function outcome(call){try{return {value:json(call())};}catch(e){return {error:e.message};}}
function legacy(i){
 const sandbox={R,core,state:{},good:()=>i.commodity,creditStep:()=>i.creditStep,pricingOptions:illegal=>({...i.pricing,illegalGood:!!illegal}),effectiveRetailValue:(_id,illegal)=>R.effectiveBasePrice(i.commodity,{...i.pricing,illegalGood:!!illegal}).effective};
 const fn=vm.runInNewContext(before+'\nprepareSaleLine',sandbox);
 const entries=new Map(Object.entries({['ban_'+i.lot.id]:i.values.ban,['price_'+i.lot.id]:i.values.price,['benchmark_'+i.lot.id]:i.values.benchmark,['qty_'+i.lot.id]:i.values.quantity,taxRate:i.values.taxRate,reason:i.values.reason}));
 return fn(i.lot,i.buyer,i.context,i.quote,{get:k=>entries.get(k)});
}
test('plain-input preparation equals checkpoint outputs/errors across legality, caps, overrides and quote provenance',()=>{
 let cases=0;
 for(const illegal of [false,true])for(const criminal of [false,true])for(const ban of ['',' 8 ','10','-1','bad'])for(const cap of [false,true])for(const raw of [false,true])for(const creditStep of [1,100])for(const mode of ['natural','manual','historical','missing','required'])for(const edit of ['none','price','benchmark','tax','reason','blankReason']){
  const i=input({creditStep});i.lot.illegal=illegal;i.buyer.criminal=criminal;i.values.ban=ban;i.pricing.maxBaseRetailEnabled=cap;i.pricing.useRawIllegalPrices=raw;
  i.quote=R.quote(commodity,context,{...i.buyer.options,...i.pricing,illegalGood:illegal,creditStep,side:'sell'},core,()=>3);
  if(mode==='manual')i.quote.audit.dice={dice:null,total:9,manual:true};
  if(mode==='historical')delete i.quote.audit.tradeComplication;
  if(mode==='missing')delete i.quote.audit.dice;
  if(mode==='required')i.quote.audit.manualRequired=true;
  i.values.price=i.quote.unitPrice;i.values.benchmark=String(R.effectiveBasePrice(commodity,{...i.pricing,illegalGood:illegal}).effective);
  if(edit==='price')i.values.price='12345.1';if(edit==='benchmark')i.values.benchmark='999';if(edit==='tax')i.values.taxRate=' 0 ';if(edit==='reason')i.values.reason=' Referee value ';if(edit==='blankReason'){i.values.price='12345';i.values.reason='  ';}
  const snapshot=json(i),expected=outcome(()=>legacy(i)),actual=outcome(()=>prepareSaleLine(i));assert.deepEqual(actual,expected,JSON.stringify({illegal,criminal,ban,cap,raw,creditStep,mode,edit}));assert.deepEqual(json(i),snapshot,'Preparation never mutates inputs');cases++;
 }
 assert.equal(cases,4800);
});
test('unknown Law Level and referee-defined benchmark preserve original errors and output',()=>{
 for(const ban of ['','8'])for(const missingBase of [false,true]){
  const i=input();i.context={...context,uwp:{...context.uwp,law:null}};i.values.ban=ban;
  if(missingBase){i.commodity={...commodity,baseCreditsPerTon:null};i.values.price='10';i.values.benchmark='100';i.values.reason='Referee price';i.quote={unitPrice:'0',audit:{manualRequired:true}};}
  assert.deepEqual(outcome(()=>prepareSaleLine(i)),outcome(()=>legacy(i)));
 }
});
test('headless consumer prepares fractional full sale and feeds existing preview without DOM, FormData or new dice',()=>{
 const i=input();i.values.ban='8';const saved=json(i);
 const line=prepareSaleLine(i);
 const preview=R.salePreview([i.lot],[line],{creditStep:1,percent:75,feePercent:5,criminal:true,taxEnabled:false},core,mp,()=>{throw Error('Unexpected new dice');});
 const original=R.salePreview([i.lot],[legacy(i)],preview.options,core,mp,()=>{throw Error('Unexpected new dice');});
 assert.deepEqual(preview,json(original));assert.equal(preview.lines[0].quantity,'2.5');assert.deepEqual(preview.lines[0].audit.dice,i.quote.audit.dice);assert.deepEqual(json(i),saved);
});
