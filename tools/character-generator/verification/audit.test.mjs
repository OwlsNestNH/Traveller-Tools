import test from 'node:test';import assert from 'node:assert/strict';
import {characterChanges} from '../engine/audit.mjs';import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
test('mechanical changes retain both sides without mutating the character',()=>{
 const before={stats:{STR:7},skills:{Admin:0},benefits:[],careers:[]},after={stats:{STR:8},skills:{Admin:1},benefits:[{name:'Ship Share',quantity:1}],careers:[]};
 const changes=characterChanges(before,after);assert.deepEqual(changes[0],{path:'stats.STR',before:7,after:8});assert.ok(changes.some(c=>c.path==='skills.Admin'&&c.before===0&&c.after===1));
 changes.find(c=>c.path==='benefits.0').after.quantity=99;assert.equal(after.benefits[0].quantity,1);
});
test('every accepted mechanical action has replayable detailed audit output',()=>{
 let s=createSession('audit');s=execute(s,{type:'setup',payload:{name:'Audit',species:'human'}}).session;s=execute(s,{type:'roll-statistics'}).session;let r=execute(s,{type:'accept-statistics'});
 assert.equal(r.log.at(-1).changes.filter(c=>c.path.startsWith('stats.')).length,6);
 assert.deepEqual(project(importSession(exportSession(r.session))).log,r.log);
});

test('education decisions and future-right consumption are included without dumping rule tables',()=>{
 const before={educations:[{id:'core.university',selections:{},careerAttempts:0}]};
 const after={educations:[{id:'core.university',selections:{'university-1':'Medic'},careerAttempts:1,graduation:{graduated:true,honours:false,effects:[{kind:'skill',name:'Medic',value:1}]}}]};
 const changes=characterChanges(before,after);assert.ok(changes.some(c=>c.path.endsWith('.selections.university-1')&&c.after==='Medic'));assert.ok(changes.some(c=>c.path.endsWith('.careerAttempts')&&c.after===1));assert.ok(changes.some(c=>c.path.endsWith('.graduation.graduated')&&c.after===true));assert.ok(!JSON.stringify(changes).includes('effects'));
});

test('notes, assets and imported acquisition attempts retain explicit before and after values',()=>{
 const before={notes:'Earlier biography',assets:[],psionics:{importedAttempted:['Telepathy']}},after={notes:'Updated biography',assets:[{id:'asset-1',name:'Scout',ownership:'borrowed'}],psionics:{importedAttempted:['Telepathy','Clairvoyance']}};
 const changes=characterChanges(before,after);assert.deepEqual(changes.find(c=>c.path==='notes'),{path:'notes',before:'Earlier biography',after:'Updated biography'});assert.ok(changes.some(c=>c.path==='assets.0'&&c.after.ownership==='borrowed'));assert.ok(changes.some(c=>c.path==='psionics.importedAttempted.1'&&c.after==='Clairvoyance'));
});


test('source ledgers audit choices and treatment time without copying continuation mechanics',()=>{
 const before={nonCareerMonths:0,treatmentAgeingTerms:0,merchantFines:[{id:'fine-1',status:'decision',die:3,amount:3000}],reeducations:[]};
 const after={nonCareerMonths:48,treatmentAgeingTerms:1,merchantFines:[{id:'fine-1',status:'completed',die:3,amount:3000,decision:'decline',reeducationId:'treatment-1',continuation:{queue:[{kind:'secret-table'}]}}],reeducations:[{id:'treatment-1',status:'completed',decisions:{chronology:{mode:'before-resume',reason:'Referee ruling'}},timeline:{ageBefore:18,ageAfter:22},continuation:{queue:[{kind:'internal-effect'}]},plan:{requirements:[]}}],psionicLoss:{permanent:true,cause:'ageing'},statusReviews:[{elevated:true}],careerTransfers:[{id:'transfer-1',status:'consumed'}]};
 const changes=characterChanges(before,after);
 assert.deepEqual(changes.find(c=>c.path==='nonCareerMonths'),{path:'nonCareerMonths',before:0,after:48});
 assert.ok(changes.some(c=>c.path==='merchantFines.0.decision'&&c.after==='decline'));
 assert.ok(changes.some(c=>c.path==='reeducations.0.decisions'&&c.after.chronology.reason==='Referee ruling'));
 assert.ok(changes.some(c=>c.path==='psionicLoss'&&c.after.permanent));
 assert.ok(changes.some(c=>c.path==='careerTransfers.0'&&c.after.status==='consumed'));
 assert.ok(changes.some(c=>c.path==='statusReviews.0'&&c.after.elevated));
 assert.doesNotMatch(JSON.stringify(changes),/continuation|secret-table|internal-effect|requirements/);
 changes.find(c=>c.path==='reeducations.0.decisions').after.chronology.reason='Changed only in derived log';
 assert.equal(after.reeducations[0].decisions.chronology.reason,'Referee ruling');
});


test('borrowed career awards retain source, rolls and explicit cap rulings in the audit',()=>{
 const after={crossCareerRoutes:[{id:'route-1',originCareerId:'zhodani.agent',tables:[{careerId:'zhodani.prole',table:'mishap',row:4}],completion:null,continuation:{queue:['internal']}}],advisoryServices:[{id:'advisory-1',careerId:'zhodani.prole',ruling:{table:'service',timing:'immediate',countsTowardCashLimit:true},cash:{die:2,modifier:1,amount:10000,cashRollsBefore:3,cashRollsAfter:4},cashLimitDecision:{decision:'allow-extra',reason:'GM exception',cashRolls:3,limit:3},context:{effects:['internal']}}]};
 const changes=characterChanges({},after);
 assert.ok(changes.some(c=>c.path==='crossCareerRoutes.0.tables'&&c.after[0].careerId==='zhodani.prole'));
 assert.ok(changes.some(c=>c.path==='advisoryServices.0.cashLimitDecision'&&c.after.reason==='GM exception'));
 assert.ok(changes.some(c=>c.path==='advisoryServices.0.ruling'&&c.after.countsTowardCashLimit===true));
 assert.doesNotMatch(JSON.stringify(changes),/internal|continuation|context/);
});


test('assignment changes and completed-term provenance are audited without continuation internals',()=>{const after={assignmentChanges:[{id:'change-1',careerId:'core.army',fromAssignment:'support',toAssignment:'infantry',mode:'retain',status:'completed',check:{total:8,target:5,success:true},continuation:{queue:['internal']}}],careers:[{id:'core.army',assignment:'infantry',termHistory:[{careerTerm:1,assignment:'support',rank:1,age:22}],exitGenerationTerms:3,exitAge:30,exitAssignment:'infantry'}]};const changes=characterChanges({},after);assert.ok(changes.some(c=>c.path==='assignmentChanges.0.fromAssignment'&&c.after==='support'));assert.ok(changes.some(c=>c.path==='assignmentChanges.0.check'&&c.after.success));assert.ok(changes.some(c=>c.path==='careers.0.termHistory'&&c.after[0].assignment==='support'));assert.ok(changes.some(c=>c.path==='careers.0.exitGenerationTerms'&&c.after===3));assert.doesNotMatch(JSON.stringify(changes),/internal|continuation/);});


test('career entry audit keeps automatic reasons and actual qualification sources',()=>{const after={careerTransitions:[{id:'transition-1',source:{id:'core',page:38},procedureSource:{id:'core',page:18},toCareerId:'core.noble',toAssignment:'administrator',automaticReason:'noble-social-standing',status:'entered',newCareerIndex:0,internal:{queue:['hidden']}}]};const changes=characterChanges({},after);assert.ok(changes.some(c=>c.path==='careerTransitions.0.source'&&c.after.page===38));assert.ok(changes.some(c=>c.path==='careerTransitions.0.procedureSource'&&c.after.page===18));assert.ok(changes.some(c=>c.path==='careerTransitions.0.automaticReason'&&c.after==='noble-social-standing'));assert.doesNotMatch(JSON.stringify(changes),/hidden|internal/);});
