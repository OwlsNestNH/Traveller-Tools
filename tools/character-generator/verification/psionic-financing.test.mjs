import test from 'node:test';
import assert from 'node:assert/strict';
import {psionicTrainingFinance as finance} from '../engine/psionic-financing.mjs';
const quote={cash:25000,cost:100000,testingNeeded:false,psi:9,confirmed:true};
test('training credit pays cash first and records only the shortfall',()=>{
 assert.deepEqual(finance(quote),{cost:100000,paid:25000,debt:75000,remainingCash:0,policy:'campaign-training-credit'});
 assert.equal(finance({...quote,cash:0}).debt,100000);
 assert.deepEqual(finance({...quote,cash:120000}),{cost:100000,paid:100000,debt:0,remainingCash:20000,policy:'campaign-training-credit'});
});
test('credit cannot silently finance testing, zero potential or an unconfirmed debt',()=>{
 for(const change of [{confirmed:false},{testingNeeded:true},{psi:0},{psi:undefined},{cost:105000},{cash:-1}])assert.throws(()=>finance({...quote,...change}));
});
