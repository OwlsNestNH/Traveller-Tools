
import test from 'node:test';
import assert from 'node:assert/strict';
import {advisoryCashPlan} from '../engine/cross-career-procedures.mjs';
const cashTable=[1000,5000,10000,20000,30000,50000,100000];
test('cash uses its source career and supplied die, with Gambler including level zero',()=>{
 assert.equal(advisoryCashPlan({die:6,cashTable,cashRolls:0}).amount,50000);
 const p=advisoryCashPlan({die:6,cashTable,cashRolls:0,gambler:true});assert.equal(p.result,7);assert.equal(p.amount,100000);assert.equal(p.cashRollsAfter,1);
});
test('cash cap blocks before requiring dice and never invents an extra roll',()=>{
 const p=advisoryCashPlan({cashRolls:3});assert.equal(p.blocked,true);assert.equal(p.die,undefined);
 assert.equal(advisoryCashPlan({cashRolls:3,die:1,cashTable,allowExtra:true}).capException,true);
});
test('optional Wealth inherits one point per cash roll capped at fifteen',()=>{
 for(const [before,after] of [[0,1],[14,15],[15,15]])assert.equal(advisoryCashPlan({die:1,cashTable,cashRolls:0,wealth:before}).wealthAfter,after);
 assert.equal(advisoryCashPlan({die:1,cashTable,cashRolls:0}).wealthAfter,null);
});
test('invalid and missing inputs are rejected rather than rolled or approximated',()=>{
 for(const data of [{},{cashRolls:0},{cashRolls:-1},{cashRolls:0,die:0,cashTable},{cashRolls:0,die:7,cashTable},{cashRolls:0,die:1,cashTable:[1]},{cashRolls:0,die:1,cashTable,gambler:1}])assert.throws(()=>advisoryCashPlan(data));
});
