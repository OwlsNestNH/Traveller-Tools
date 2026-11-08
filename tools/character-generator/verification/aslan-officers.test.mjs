import test from 'node:test';
import assert from 'node:assert/strict';
import {createAslanOfficerOffer,aslanOfficerRule,aslanOfficerEligibility,aslanOfficerExpiry,aslanOfficerRankEffects,aslanClanShareTokens} from '../engine/aslan-officers.mjs';
const offer=(extra={})=>createAslanOfficerOffer({id:'offer-1',originCareerId:'aslan.military',originCareerIndex:0,originAssignment:'warrior',eventResult:10,targetCareerId:'aslan.military-officer',completedTerms:0,originCareerTerms:0,...extra});
const context=(extra={})=>({offer:offer(),stage:'term-end',completedTerms:1,activeCareerIndex:0,originCareer:{id:'aslan.military',terms:1},careerCount:1,...extra});
test('only the three printed event routes create an officer opportunity',()=>{
 assert.ok(aslanOfficerRule('aslan.military',10,'aslan.military-officer'));for(const n of [5,10])assert.ok(aslanOfficerRule('aslan.spacer',n,'aslan.space-officer'));
 assert.equal(aslanOfficerRule('aslan.military',5,'aslan.military-officer'),null);assert.throws(()=>offer({eventResult:5}));assert.throws(()=>offer({completedTerms:-1}));assert.throws(()=>offer({originCareerIndex:null}));
 assert.deepEqual(offer().source,{id:'aliens',page:31});assert.equal(offer().availableAtCompletedTerms,1);
});
test('closed originating terms supply the qualification DM and early waiver only',()=>{
 assert.deepEqual(aslanOfficerEligibility(context()),{available:true,reason:'',earlyExit:true,qualificationDM:1});
 const late=aslanOfficerEligibility(context({originCareer:{id:'aslan.military',terms:3}}));assert.equal(late.qualificationDM,3);assert.equal(late.earlyExit,false);
 const forced=aslanOfficerEligibility(context({originCareer:{id:'aslan.military',terms:1,forcedExit:true}}));assert.equal(forced.available,true);assert.equal(forced.earlyExit,false);
});
test('eligibility rejects wrong boundary, career, status and forced-stay before commitment',()=>{
 for(const patch of [{completedTerms:0},{completedTerms:2},{careerCount:2},{outcast:true},{forcedCareer:'aslan.outcast'},{retired:true},{qualificationBanned:true},{originCareer:{id:'aslan.military',terms:1,forcedStay:true}},{stage:'ageing'},{activeCareerIndex:1}]){
  assert.equal(aslanOfficerEligibility(context(patch)).available,false,JSON.stringify(patch));
 }
 assert.equal(aslanOfficerEligibility(context({stage:'career',activeCareerIndex:null,originCareer:{id:'aslan.military',terms:3,exit:'voluntary'}})).available,true);
});
test('expiry preserves reserved/check records and records why an unused offer ended',()=>{
 assert.equal(aslanOfficerExpiry({offer:offer(),completedTerms:1,careerCount:1}),null);
 assert.equal(aslanOfficerExpiry({offer:offer(),completedTerms:2,careerCount:1}).reason,'next-term-window-ended');
 assert.equal(aslanOfficerExpiry({offer:offer(),completedTerms:1,careerCount:2}).reason,'another-career-entered');
 assert.equal(aslanOfficerExpiry({offer:offer(),completedTerms:1,careerCount:1,deceased:true}).status,'deceased');
 assert.equal(aslanOfficerExpiry({offer:{...offer(),status:'ready'},completedTerms:2,careerCount:1}),null);
});
test('female rank mapping requires an explicit printed header and exact rank awards',()=>{
 assert.throws(()=>aslanOfficerRankEffects('navigator',1));assert.throws(()=>aslanOfficerRankEffects('pilot-gunner',7));assert.deepEqual(aslanOfficerRankEffects('pilot-gunner',0),[]);
 for(const [id,n,name] of [['pilot-gunner',1,'Admin'],['pilot-gunner',3,'Advocate'],['engineer-crew',1,'Astrogation'],['engineer-crew',3,'Electronics']])assert.deepEqual(aslanOfficerRankEffects(id,n),[{kind:'skill',name,mode:'set',value:1,source:{id:'aliens',page:39}}]);
 assert.equal(aslanOfficerRankEffects('engineer-crew',6)[0].value,2);
});
test('Clan Share forfeiture identifies held tokens without repossessing redeemed assets',()=>{
 const list=[{name:'Clan Share',quantity:2,definitionId:'aslan.clan-share'},{name:'Clan Shares',quantity:1},{name:'Ship Share',quantity:4},{name:'Clan Share',quantity:1,assetId:'converted-ship'}],before=structuredClone(list);
 assert.deepEqual(aslanClanShareTokens(list),list.slice(0,2));assert.deepEqual(list,before);
});
