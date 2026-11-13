import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {careerTemplateModel} from '../gui/career-template.mjs';
const catalog=api({operation:'catalog'}),ids=['agent','army','citizen','drifter','entertainer','marine','merchant','navy','noble','rogue','scholar','scout'];
function settle(r){for(let i=0;i<40;i++){r=settleAssignment(r);if(r.state.stage!=='borrowed-event-roll')return r;r=run(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id});}throw Error('Unbounded career consequences');}
function roll(r,type,payload,values){const next=run(r,type,payload);return next.log.at(-1).rolls.length?force(r,type,payload,values):next;}
for(const short of ids){const id='core.'+short,career=catalog.careers.find(c=>c.id===id);for(const assignment of career.assignments)test(id+' '+assignment.id+' preserves specialty through basic training, term, rank and cash benefit',()=>{
 let r=run(assignmentSetup('imperial-full-'+id+'-'+assignment.id,10),'skip-precareer');r=settle(roll(r,'career',{id,assignment:assignment.id},[6,6]));assert.equal(r.state.stage,'survival');assert.equal(r.state.character.careers[0].assignment,assignment.id);assert.equal(careerTemplateModel(r.state,catalog).career.id,id);
 r=force(r,'survival-check',{},[6,6]);assert.equal(r.state.stage,'career-event');const row=short==='scout'||short==='noble'||short==='rogue'||short==='drifter'?5:short==='merchant'?6:9;r=settle(force(r,'career-event',{},row>7?[6,row-6]:[1,row-1]));assert.equal(r.state.stage,'advancement',id);
 r=settle(roll(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));assert.equal(r.state.stage,'term-end',id);assert.equal(r.state.character.careers[0].assignment,assignment.id);
 r=run(r,'leave-career');assert.equal(r.state.stage,'benefits');const before=r.state.character.cash;r=run(r,'benefit',{cash:true});assert.equal(r.state.cashRolls,1);assert.ok(r.state.character.cash>=before);const raw=exportSession(r.session),replayed=api({operation:'import',raw});assert.equal(replayed.ok,true);assert.equal(exportSession(replayed.session),raw);assert.deepEqual(replayed.state,r.state);
 });}
