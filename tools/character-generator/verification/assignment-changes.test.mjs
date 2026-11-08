
import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_ASSIGNMENT_MODES,assignmentChangePlan,careerReentryPlan,nobleAutomaticQualification} from '../engine/assignment-changes.mjs';
test('Core p20 explicitly separates seven retained and four restarted careers',()=>{
 assert.deepEqual(Object.entries(CORE_ASSIGNMENT_MODES).filter(([,v])=>v==='retain').map(([k])=>k),['core.army','core.marine','core.navy','core.noble','core.rogue','core.scholar','core.scout']);
 assert.deepEqual(Object.entries(CORE_ASSIGNMENT_MODES).filter(([,v])=>v==='restart').map(([k])=>k),['core.agent','core.citizen','core.entertainer','core.merchant']);
 for(const careerId of ['aslan.military','zhodani.army','vargr.military','core.drifter','core.psion','core.prisoner'])assert.equal(assignmentChangePlan({careerId,stage:'term-end',fromAssignment:'a',toAssignment:'b',canLeave:true}).available,false);
});
test('retained forced stay is same career; restarted route requires a voluntary departure',()=>{
 const base={stage:'term-end',fromAssignment:'a',toAssignment:'b',canLeave:true};
 assert.equal(assignmentChangePlan({...base,careerId:'core.army',forcedStay:true}).available,true);
 for(const flags of [{forcedStay:true},{forcedExit:true},{forcedCareer:'core.prisoner'},{canLeave:false}])assert.equal(assignmentChangePlan({...base,careerId:'core.agent',...flags}).available,false);
 assert.equal(assignmentChangePlan({...base,careerId:'core.army',forcedExit:true}).available,false);
 assert.equal(assignmentChangePlan({...base,careerId:'core.army',stage:'ageing'}).available,false);
 assert.equal(assignmentChangePlan({...base,careerId:'core.army',toAssignment:'a'}).available,false);
});
test('same-career exception is next-term scoped, not a lifetime ban',()=>{
 const previous={id:'core.agent',assignment:'law',exitAssignment:'law',exit:'voluntary',exitGenerationTerms:2};
 const p=extra=>careerReentryPlan({careerId:'core.agent',assignment:'law',previous,generationTerms:2,...extra});
 assert.equal(p({}).allowed,false);assert.equal(p({assignment:'intelligence'}).mode,'assignment-restart');
 assert.equal(p({previous:{...previous,exit:'involuntary'},assignment:'intelligence'}).allowed,false);
 assert.equal(p({generationTerms:3}).allowed,true);assert.equal(p({drafted:true}).allowed,true);
 assert.equal(p({careerId:'core.army'}).allowed,true);
 assert.equal(p({previous:{...previous,exitGenerationTerms:undefined}}).allowed,false);
 assert.equal(careerReentryPlan({careerId:'core.drifter',assignment:'wanderer',previous:{id:'core.drifter'},generationTerms:1}).allowed,true);
});
test('Noble automatic qualification uses actual SOC10, not characteristic DM or a rolled total',()=>{
 assert.equal(nobleAutomaticQualification('core.noble',{SOC:10}),true);
 for(const stats of [{SOC:9},{SOC:undefined},{}])assert.equal(nobleAutomaticQualification('core.noble',stats),false);
 assert.equal(nobleAutomaticQualification('zhodani.government',{SOC:12}),false);
});
