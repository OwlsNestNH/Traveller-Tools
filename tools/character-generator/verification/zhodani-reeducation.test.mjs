import test from 'node:test';
import assert from 'node:assert/strict';
import {reeducationRoll,reeducationPlan,treatmentTimeline,zhodaniStatusPlan} from '../engine/zhodani-reeducation.mjs';
const clock={mode:'before-resume',reason:'Recorded chronological interpretation'};
const input=(row,extra={})=>({roll:reeducationRoll({die:row,anagathicTerms:0}),stats:{END:8,SOC:12},cash:10000,decisions:row<=4?{chronology:clock,...(row>=3?{duration:{months:6,reason:'Recorded duration'}}:{})}:{},...(row===5?{fineDie:2}:{}),...extra});
for(let row=1;row<=6;row++)test('source row '+row+' has exact numeric effects and no extra career credit',()=>{
 const p=reeducationPlan(input(row));assert.equal(p.resolved,true);assert.equal(p.row,row);assert.equal(p.durationMonths,row<=2?48:row<=4?6:0);
 assert.equal(p.endAfter,row===1?7:8);assert.equal(p.socAfter,row===1?11:12);assert.equal(p.fine,row===5?2000:0);assert.equal(p.benefitRolls,row===6?1:0);
 assert.deepEqual(p.careerCredit,{terms:0,benefitRolls:0,advancement:0,skills:0,pensionTerms:0});
});
test('source roll validates required die/history and preserves negative results',()=>{
 for(const bad of [{},{die:1},{die:7,anagathicTerms:0},{die:1,anagathicTerms:-1}])assert.throws(()=>reeducationRoll(bad));
 const roll=reeducationRoll({die:1,anagathicTerms:3});assert.equal(roll.total,-2);
 const p=reeducationPlan(input(1,{roll,decisions:{}}));assert.deepEqual(p.requirements.map(r=>r.key),['rowOverride']);assert.equal(p.row,null);
 const decided=reeducationPlan(input(1,{roll,decisions:{rowOverride:{row:2,reason:'Referee extended the missing row'},chronology:clock}}));
 assert.equal(decided.row,2);assert.equal(decided.roll.total,-2);
});
test('short durations and chronology require explicit valid decisions',()=>{
 for(const row of [1,2,3,4])assert.ok(reeducationPlan(input(row,{decisions:{}})).requirements.some(r=>r.key==='chronology'));
 for(const months of [0,-1,12,Infinity,NaN])assert.throws(()=>reeducationPlan(input(3,{decisions:{chronology:clock,duration:{months,reason:'Checked'}}})));
 assert.equal(reeducationPlan(input(3,{decisions:{chronology:clock,duration:{months:.5,reason:'Referee half-month duration'}}})).durationMonths,.5);
 assert.throws(()=>reeducationPlan(input(2,{decisions:{chronology:{mode:'assume',reason:'X'}}})));
});
test('Nobles stop at SOC11 and lower classes receive no invented demotion',()=>{
 for(const soc of [9,10,11,12])assert.equal(reeducationPlan(input(1,{stats:{END:8,SOC:soc}})).socAfter,soc>=11?Math.max(11,soc-1):soc);
});
test('protected stay, independent discharge and default mishap exit remain distinguishable',()=>{
 assert.equal(reeducationPlan(input(1,{context:{protectedStay:true}})).disposition,'stay');
 assert.equal(reeducationPlan(input(2,{context:{explicitDischarge:true}})).resolved,false);
 for(const mode of ['stay','leave'])assert.equal(reeducationPlan(input(2,{context:{explicitDischarge:true},decisions:{chronology:clock,disposition:{mode,reason:'Explicit source priority'}}})).disposition,mode);
 assert.equal(reeducationPlan(input(4)).disposition,'unchanged');
});
test('fine die and unavailable funding remain explicit, never automatic debt',()=>{
 assert.deepEqual(reeducationPlan(input(5,{fineDie:undefined})).requirements.map(r=>r.key),['fineDie']);
 assert.deepEqual(reeducationPlan(input(5,{cash:0})).requirements.map(r=>r.key),['funding']);
 for(const mode of ['debt','provided'])assert.equal(reeducationPlan(input(5,{cash:0,decisions:{funding:{mode,reason:'Referee funding outcome'}}})).funding,mode);
 assert.throws(()=>reeducationPlan(input(5,{cash:0,decisions:{funding:{mode:'cash',reason:'No cash'}}})));
});
test('END zero is unresolved until a bounded referee outcome is recorded',()=>{
 assert.deepEqual(reeducationPlan(input(1,{stats:{END:1,SOC:10}})).requirements.map(r=>r.key),['endZero']);
 for(const mode of ['restore-to-one','death']){const p=reeducationPlan(input(1,{stats:{END:1,SOC:10},decisions:{chronology:clock,endZero:{mode,reason:'Referee resolved this unsupported zero consequence'}}}));assert.equal(p.deceased,mode==='death');assert.equal(p.endAfter,mode==='death'?0:1);}
});
test('timeline credits treatment separately and emits each crossed ageing checkpoint',()=>{
 const p=treatmentTimeline({age:30,months:48,careerTerms:3});assert.equal(p.ageAfter,34);assert.equal(p.nonCareerMonthsAfter,48);assert.deepEqual(p.checkpoints.map(c=>[c.age,c.terms]),[[34,4]]);
 const q=treatmentTimeline({age:33.5,nonCareerMonths:42,months:6,careerTerms:3});assert.equal(q.ageAfter,34);assert.equal(q.ageingCreditAfter,1);assert.equal(q.checkpoints[0].terms,4);
 assert.equal(treatmentTimeline({age:18,months:48,careerTerms:0}).checkpoints.length,0);
 assert.equal(treatmentTimeline({age:34,months:48,careerTerms:4}).checkpoints.length,1);
});
test('elevation requires an in-career Prole PSI9+ and never resets initial education or history',()=>{
 for(const soc of [8,9,10,11])for(const psi of [8,9]){const p=zhodaniStatusPlan({soc,psi,inCareer:true});assert.equal(p.elevate,soc<10&&psi>=9);assert.equal(p.reapplyInitialEducation,false);assert.equal(p.resetTalentHistory,false);}
 assert.equal(zhodaniStatusPlan({soc:9,psi:10,inCareer:false}).elevate,false);
 assert.equal(zhodaniStatusPlan({soc:9,psi:10,inCareer:true,permanentlyLost:true}).elevate,false);
});
