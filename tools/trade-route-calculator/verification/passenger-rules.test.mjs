import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {passengerDM,passengerFare,passengerOffers,PASSAGE_CLASSES} from '../js/passenger-rules.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const ctx=(population=5,starport='C',zone='Safe',techLevel=8,pbg='100')=>({world:{name:'Test',raw:{PBG:pbg}},uwp:{population,starport,techLevel},zone});
test('passage fares independently match every Core p239 numeric row',()=>{
 const expected={high:[9000,14000,21000,34000,60000,210000],middle:[6500,10000,14000,23000,40000,130000],basic:[2000,3000,5000,8000,14000,55000],low:[700,1300,2200,3900,7200,27000]};
 for(const type of PASSAGE_CLASSES)for(let d=1;d<=6;d++)assert.equal(passengerFare(type,d,core),String(expected[type][d-1]));
 for(const d of [0,7,1.5,NaN])assert.throws(()=>passengerFare('high',d,core));assert.throws(()=>passengerFare('working',1,core));
});
test('passenger traffic uses its own population and zone DMs, both endpoints, and no technology modifier',()=>{
 for(const [pop,expected]of [[0,-4],[1,-4],[2,0],[5,0],[6,1],[7,1],[8,3],[15,3]])assert.equal(passengerDM(ctx(pop),ctx(),1,{},core).origin,expected);
 for(const [port,expected]of [['A',2],['B',1],['C',0],['D',0],['E',-1],['X',-3]])assert.equal(passengerDM(ctx(5,port),ctx(),1,{},core).origin,expected);
 assert.equal(passengerDM(ctx(8,'A','Amber',1),ctx(8,'A','Amber',15),3,{effect:-2,steward:2},core).total,10);
 assert.equal(passengerDM(ctx(5,'C','Red'),ctx(5,'C','Red'),1,{},core).total,-8);
 assert.deepEqual(passengerDM(ctx(5,'C','Safe',0),ctx(),1,{},core),passengerDM(ctx(5,'C','Safe',15),ctx(),1,{},core));
 for(const value of [1.5,NaN,Infinity,'2'])assert.throws(()=>passengerDM(ctx(),ctx(),1,{effect:value},core));
 assert.throws(()=>passengerDM(ctx(null),ctx(),1,{},core));assert.throws(()=>passengerDM(ctx(),ctx(),1,{steward:-1},core));
});
test('every passenger traffic band, clamping and four class modifiers are independent of freight',()=>{
 const expected=[0,1,1,2,2,2,3,3,3,3,4,4,4,5,5,6,7,8,9,10];
 for(let result=-3;result<=24;result++){
  const offers=passengerOffers(ctx(),ctx(),1,{effect:result-2},core,()=>1),middle=offers.find(o=>o.passageClass==='middle');
  assert.equal(middle.audit.total,result);assert.equal(middle.count,expected[Math.max(1,Math.min(20,result))-1]);
  assert.equal(offers.find(o=>o.passageClass==='high').audit.total,result-4);assert.equal(offers.find(o=>o.passageClass==='low').audit.total,result+1);
 }
 assert.notDeepEqual(core.passengers.trafficCountDice,core.freight.trafficTable.map(x=>x.numberOfLotDice));
});
test('availability audits freeze inputs and exact dice; unknown PBG does not invent population',()=>{
 const a=ctx(1,'A','Amber',9,'300'),b=ctx(),offers=passengerOffers(a,b,2,{effect:3,steward:1},core,()=>6),saved=structuredClone(offers);
 assert.equal(offers[0].audit.originPopulation,'30');a.uwp.population=9;a.world.name='Changed';assert.deepEqual(offers,saved);
 for(const c of offers){assert.equal(c.audit.traffic.total,12);assert.equal(c.count,c.audit.countDice*6);assert.equal(c.payment,String(BigInt(c.fare)*BigInt(c.count)));}
 assert.equal(passengerOffers(ctx(4,'C','Safe',8,'?00'),b,1,{},core,()=>1)[0].audit.originPopulation,null);
 assert.equal(passengerOffers(ctx(4,'C','Safe',8,'000'),b,1,{},core,()=>1)[0].audit.originPopulation,null);
 assert.equal(passengerOffers(ctx(0,'C','Safe',8,'000'),b,1,{},core,()=>1)[0].audit.originPopulation,'0');
});
