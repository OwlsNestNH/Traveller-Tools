import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {rollResult} from '../gui/roll-result-view.mjs';
import {trainingContext} from '../gui/training-context.mjs';
import {careerOutcomeSummary} from '../engine/career-outcome-summary.mjs';
function start(){let r=run(assignmentSetup('separate-term-steps'),'skip-precareer');return settleAssignment(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));}
function command(r,type,payload={}){return api({operation:'command',session:r.session,command:{type,payload}});}
test('table summary retains random relationship count rather than its fallback count',()=>{
 assert.equal(careerOutcomeSummary([{kind:'relationship',type:'Contact',count:1,dice:'D3'}]),'Gain D3 Contact.');
 assert.equal(careerOutcomeSummary([{kind:'relationship',type:'Enemy',count:2}]),'Gain 2 Enemy.');
});
test('survival and event are separate persisted actions with replay-identical dice and consequences',()=>{
 const r=start(),old=run(r,'survival'),check=run(r,'survival-check');
 assert.equal(check.log.at(-1).rolls.length,1);
 assert.deepEqual(check.state.character,r.state.character);
 const step=check.state.stage;assert.ok(['career-event','career-mishap'].includes(step));
 const imported=api({operation:'import',raw:JSON.stringify(check.session)});assert.equal(imported.ok,true,JSON.stringify(imported.error));assert.equal(imported.state.stage,step);
 const next=run(imported,step);
 assert.deepEqual([...check.log.at(-1).rolls,...next.log.at(-1).rolls],old.log.at(-1).rolls);
 assert.deepEqual(next.state.character,old.state.character);
 assert.equal(next.state.rng,old.state.rng);assert.equal(next.state.stage,old.state.stage);
 assert.equal(command(check,'advancement').ok,false);
 assert.equal(command(next,step).ok,false);
 assert.equal(command(check,step,{result:8}).ok,false);
});
test('failed survival pauses before mishap dice and preserves normal mishap routing',()=>{
 let r=force(start(),'survival-check',{},[1,1]);assert.equal(r.state.stage,'career-mishap');
 assert.equal(r.log.at(-1).rolls.length,1);
 assert.equal(command(r,'career-event').ok,false);
 r=force(r,'career-mishap',{},[2]);assert.equal(r.state.stage,'term-end');
 assert.equal(r.state.character.careers[0].forcedExit,true);
 assert.equal(r.state.character.careers[0].benefitRolls,0);
});
test('four award sources remain independent: regular, event, rank, advancement training',()=>{
 let r=start();assert.equal(r.state.stage,'survival'); // First career substitutes basic training.
 r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[4,5]);
 r=force(r,'advancement',{},[1,2]); // +2 event DM: total 5, no promotion, no forced exit.
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].rank,0);
 r=run(r,'continue-career');assert.equal(r.state.stage,'training');assert.equal(trainingContext(r.state).title,'Regular term training');
 r=force(r,'training',{table:'personal'},[5]);assert.equal(r.state.character.skills.Medic,1);assert.equal(r.state.stage,'survival');
 r=force(r,'survival-check',{},[6,6]);assert.equal(r.state.stage,'career-event');
 r=force(r,'career-event',{},[2,2]);assert.equal(r.state.stage,'effect-choice');
 assert.match(r.log.at(-1).summary,/Choose:.*Stealth/);
 r=run(r,'choose-effect',{index:0});assert.equal(r.state.character.skills.Stealth,1);
 r=force(r,'advancement',{},[4,5]);assert.equal(r.state.character.careers[0].rank,1);assert.equal(r.state.character.skills.Recon,1);
 assert.equal(r.state.stage,'training');assert.equal(trainingContext(r.state).title,'Advancement training');
 r=force(r,'training',{table:'personal'},[4]);assert.equal(r.state.character.skills.Gambler,1);assert.equal(r.state.stage,'term-end');
 for(const skill of ['Medic','Stealth','Recon','Gambler'])assert.equal(r.state.character.skills[skill],1,skill+' retained independently');
 assert.equal(r.state.character.careers[0].terms,2);
 const restored=api({operation:'import',raw:JSON.stringify(r.session)});assert.equal(restored.ok,true);assert.deepEqual(restored.state.character,r.state.character);
});
test('new event presentation is distinct from survival and names table choices',()=>{
 let r=force(start(),'survival-check',{},[6,6]);const survival=rollResult(r.log.at(-1),r.state);
 assert.equal(survival.title,'Survival succeeded.');assert.doesNotMatch(survival.text,/Career event rolled/);
 r=run(r,'career-event');r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[2,2],reason:'Event presentation test'});
 assert.match(r.log.at(-1).summary,/Career event result 4/);assert.match(r.log.at(-1).summary,/Stealth/);
});
