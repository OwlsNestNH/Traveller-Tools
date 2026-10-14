import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from '../js/rules.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url))),ctx=R.context({id:'0,0',uwp:'A788899-C',zone:'Safe'},core),good={...core.commodities[0],baseCreditsPerTon:1000,purchaseDM:{},saleDM:{}};
const q=(side,options={})=>R.quote(good,ctx,{side,rollTotal:100,skill:0,counterparty:0,...options},core);
test('criminal contacts widen default and custom buy/sell limits by ten percentage points',()=>{
 for(const [floor,ceiling]of [[85,115],[90,110],[92,108],[0,400]])for(const side of ['buy','sell']){
  const options={reducedProfitLimitsEnabled:true,minPurchasePercent:floor,maxSalePercent:ceiling,criminalMarket:true},quote=q(side,options);
  assert.equal(quote.audit.minPurchasePercent,floor);assert.equal(quote.audit.maxSalePercent,ceiling);
  assert.equal(quote.audit.effectiveMinPurchasePercent,floor-10);assert.equal(quote.audit.effectiveMaxSalePercent,ceiling+10);
  const percentage=side==='buy'?Math.max(15,floor-10):Math.min(400,ceiling+10);assert.equal(quote.audit.percent,percentage);assert.equal(quote.unitPrice,String(percentage*10));
 }
});
test('limits off is uncapped and legal quotes remain unchanged',()=>{
 for(const side of ['buy','sell']){
  assert.equal(q(side,{criminalMarket:true,reducedProfitLimitsEnabled:false}).unitPrice,q(side).unitPrice);
  const legal=q(side,{reducedProfitLimitsEnabled:true});assert.equal(legal.audit.percent,side==='buy'?85:115);assert.equal(legal.audit.criminalLimitWideningPoints??0,0);
 }
});
test('contact classification governs widening independently of cargo illegality and base-retail exemption',()=>{
 const opts={reducedProfitLimitsEnabled:true,maxBaseRetailEnabled:true,maxBaseRetail:500,useRawIllegalPrices:true};
 assert.equal(q('buy',{...opts,illegalGood:true,criminalMarket:false}).audit.percent,85);
 assert.equal(q('buy',{...opts,illegalGood:false,criminalMarket:true}).audit.percent,75);
 assert.equal(q('buy',{...opts,illegalGood:false,criminalMarket:true}).audit.basePrice,500);
 assert.equal(q('buy',{...opts,illegalGood:true,criminalMarket:true}).audit.basePrice,1000);
 assert.equal(q('buy',{...opts,illegal:true}).audit.percent,75,'Legacy black-market contact option remains supported');
 const original=q('sell',{...opts,criminalMarket:true});const repriced=R.repriceQuote(good,ctx,{...opts,side:'sell',criminalMarket:true,skill:0,counterparty:0},core,original);
 assert.equal(repriced.audit.percent,125);assert.deepEqual(repriced.audit.dice,original.audit.dice);
});
