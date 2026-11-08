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
