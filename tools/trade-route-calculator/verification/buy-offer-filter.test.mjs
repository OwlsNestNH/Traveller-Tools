import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesBuyRetailFilter,buyOfferRetailLabel} from '../js/buy-offer-filter.mjs';
const offer=(price,base='1000',percent=10)=>({unitPrice:price,audit:{basePrice:base,percent}});
test('95% filter uses exact actual quote over recorded effective retail',()=>{
 for(const [price,keep] of [['0',true],['949.999999',true],['950',true],['950.000001',false],['1000',false],['1100',false]]){
  const o=offer(price),before=JSON.stringify(o);assert.equal(matchesBuyRetailFilter(o,true),keep);assert.equal(matchesBuyRetailFilter(o,false),true);assert.equal(JSON.stringify(o),before);
 }
 assert.equal(matchesBuyRetailFilter(offer('950','1000',120),true),true);
 assert.equal(matchesBuyRetailFilter({...offer('960'),audit:{basePrice:'1000',rawBasePrice:'10000',percent:10}},true),false);
 assert.equal(buyOfferRetailLabel(offer('950','1000',120)),'95%');
});
test('unknown or unresolved retail percentages stay visible and explicitly unknown',()=>{
 for(const o of [offer('1',null),offer('1','0'),offer('1','bad'),offer(null),{...offer('1000'),manualRequired:true},{}]){
  assert.equal(matchesBuyRetailFilter(o,true),true);assert.equal(buyOfferRetailLabel(o),'Unknown');
 }
});
