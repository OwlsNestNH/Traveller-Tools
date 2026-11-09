import test from 'node:test';
import assert from 'node:assert/strict';
import {createAslanRestoration,aslanRestorationDecision,aslanRestorationAvailability,aslanRestorationExpiry} from '../engine/aslan-restoration.mjs';
const make=()=>createAslanRestoration({id:'restoration-1',careerId:'aslan.outcast',careerIndex:0,assignment:'labourer',completedTerms:0,soc:2,outcast:true});
const decision={accept:true,originalSOC:8,originalSOCConfirmed:true,statusTiming:'on-successful-entry',reason:'Verified original family SOC and source timing.'};
test('restoration provenance is only generated from the earned Outcast event context',()=>{
 const r=make();assert.deepEqual(r.source,{id:'aliens',page:41});assert.equal(r.availableAtCompletedTerms,1);assert.equal(r.socBefore,2);assert.equal(r.status,'offered');
 assert.throws(()=>createAslanRestoration({careerId:'aslan.outlaw'}));assert.throws(()=>createAslanRestoration({id:'x',careerId:'aslan.outcast',careerIndex:0,assignment:'labourer',completedTerms:-1,soc:2}));
});
test('acceptance requires GM original-SOC verification, explicit timing and bounded reason',()=>{
 assert.deepEqual(aslanRestorationDecision(decision,true),decision);assert.equal(aslanRestorationDecision({...decision,statusTiming:'on-restoration'},true).statusTiming,'on-restoration');
 assert.throws(()=>aslanRestorationDecision(decision,false));
 for(const patch of [{originalSOC:0},{originalSOC:41},{originalSOC:8.5},{originalSOC:'8'},{originalSOCConfirmed:false},{statusTiming:''},{reason:''},{reason:'x'.repeat(501)},{effects:[]}]){
  assert.throws(()=>aslanRestorationDecision({...decision,...patch},true),JSON.stringify(patch));
 }
 assert.equal(aslanRestorationDecision({...decision,originalSOC:1},true).originalSOC,1);assert.equal(aslanRestorationDecision({...decision,originalSOC:40},true).originalSOC,40);
});
test('decline does not require GM mode or accept irrelevant original-SOC fields',()=>{
 assert.deepEqual(aslanRestorationDecision({accept:false},false),{accept:false});assert.throws(()=>aslanRestorationDecision({accept:false,originalSOC:8},true));assert.throws(()=>aslanRestorationDecision({},true));
});
test('following-term permission requires completed exit and does not override forced stay',()=>{
 const context={restoration:{...make(),status:'available'},stage:'career',activeCareerIndex:null,completedTerms:1,careerCount:1,originCareer:{id:'aslan.outcast',exit:'voluntary'}};
 assert.equal(aslanRestorationAvailability(context).available,true);
 for(const patch of [{completedTerms:0},{completedTerms:2},{careerCount:2},{activeCareerIndex:0},{stage:'benefits'},{retired:true},{deceased:true},{originCareer:{id:'aslan.outcast',exit:'voluntary',forcedStay:true}}])assert.equal(aslanRestorationAvailability({...context,...patch}).available,false);
});
test('expiry records terminal or elapsed history without altering a spent attempt',()=>{
 const r={...make(),status:'available'};
 assert.equal(aslanRestorationExpiry({restoration:r,completedTerms:1,careerCount:1}),null);
 for(const patch of [{completedTerms:2},{careerCount:2},{retired:true},{deceased:true}])assert.ok(aslanRestorationExpiry({restoration:r,completedTerms:1,careerCount:1,...patch}));
 assert.equal(aslanRestorationExpiry({restoration:{...r,status:'consumed'},completedTerms:2,careerCount:2}),null);
});
