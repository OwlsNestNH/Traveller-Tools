import test from 'node:test';
import assert from 'node:assert/strict';
import {createAslanOutlawRestoration,aslanOutlawRestorationDecision as decide,aslanOutlawRestorationOutcome as outcome} from '../engine/aslan-outlaw-restoration.mjs';
const male={decision:'restore',originalSOC:8,originalSOCConfirmed:true,reason:'Verified original source SOC.'},female={decision:'marry',unmarriedConfirmed:true,reason:'Verified current unmarried status.'};
test('Outlaw event ledger records exact source/origin and no invented marital or SOC result',()=>{
 const r=createAslanOutlawRestoration({id:'x',careerId:'aslan.outlaw',careerIndex:1,assignment:'raider',careerTerms:0,completedTerms:1,gender:'female',soc:2,outcast:true});assert.equal(r.source.page,43);assert.equal(r.status,'pending');assert.equal(r.decision,null);assert.equal(r.socRoll,null);assert.equal(r.married,false);assert.equal(r.socAfter,null);
 assert.throws(()=>createAslanOutlawRestoration({careerId:'aslan.outcast'}));
});
test('male restoration uses verified SOC and exactly three shares without invented decline or dice',()=>{
 const d=decide({gender:'male',payload:male,gm:true});assert.deepEqual(outcome({gender:'male',decision:d}),{restored:true,soc:8,clanShares:3,requiredExit:true,married:false});
 assert.throws(()=>decide({gender:'male',payload:{decision:'decline'},gm:true}));assert.throws(()=>decide({gender:'male',payload:male,gm:false}));assert.throws(()=>outcome({gender:'male',decision:d,socDice:[1,1]}));
 for(const patch of [{originalSOC:0},{originalSOC:41},{originalSOC:8.5},{originalSOCConfirmed:false},{reason:''},{reason:'x'.repeat(501)},{unmarriedConfirmed:true}])assert.throws(()=>decide({gender:'male',payload:{...male,...patch},gm:true}));
});
test('female acceptance requires actual unmarried confirmation and two dice at both boundaries',()=>{
 const d=decide({gender:'female',payload:female,gm:true});
 assert.deepEqual(outcome({gender:'female',decision:d,socDice:[1,1]}),{restored:true,soc:2,clanShares:0,requiredExit:true,married:true});assert.equal(outcome({gender:'female',decision:d,socDice:[6,6]}).soc,12);
 for(const dice of [undefined,[6],[0,6],[6,7],[6,6,6]])assert.throws(()=>outcome({gender:'female',decision:d,socDice:dice}));
 assert.throws(()=>decide({gender:'female',payload:{...female,unmarriedConfirmed:false},gm:true}));assert.throws(()=>decide({gender:'female',payload:female,gm:false}));
});
test('decline and verified ineligibility do not roll, restore or require departure',()=>{
 const decline=decide({gender:'female',payload:{decision:'decline'},gm:false}),ineligible=decide({gender:'female',payload:{decision:'ineligible',unmarriedConfirmed:false,reason:'Currently married.'},gm:true});
 for(const d of [decline,ineligible])assert.deepEqual(outcome({gender:'female',decision:d}),{restored:false,clanShares:0,requiredExit:false,married:false});
 assert.throws(()=>decide({gender:'female',payload:{decision:'ineligible',unmarriedConfirmed:true,reason:'Conflicting eligibility'},gm:true}));assert.throws(()=>decide({gender:'female',payload:{decision:'decline',originalSOC:8},gm:true}));
});
