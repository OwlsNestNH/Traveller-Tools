// Public-command synthetic histories; no player data or direct state edits.
import assert from 'node:assert/strict';
import {buildAssignmentFixture,run,settleAssignment,force} from './assignment-fixtures.mjs';
import {buildClanSharesFixture} from './clan-shares-fixtures.mjs';
import {settle} from './aslan-officer-fixtures.mjs';
import {coverResult,forceAt} from './agent-cover-fixtures.mjs';
export function completionReviewFixtures(){
 let finished=run(buildAssignmentFixture(),'leave-career');
 for(let i=0;i<12&&finished.state.stage==='benefits';i++)finished=settleAssignment(force(finished,'benefit',{cash:false},[2]));
 finished=run(finished,'finish');assert.equal(finished.state.stage,'finish');
 let retired=run(buildClanSharesFixture({stage:'term-end'}),'leave-career',{retire:true});retired=settle(force(retired,'benefit',{cash:false},[1]));retired=run(retired,'benefit',{cash:false});assert.equal(retired.state.stage,'retirement');assert.equal(retired.log.at(-1).type,'benefit');
 let deceased=coverResult({row:2,end:1}),revision=deceased.log.findLast(l=>l.type==='cross-career-cover').number;
 for(let i=0;i<80&&!(deceased.state.stage==='injury-loss'&&deceased.state.character.injuries.at(-1).options[2]?.label.startsWith('END'));i++)deceased=forceAt(deceased,revision,1,[1,1]);
 assert.equal(deceased.state.stage,'injury-loss');deceased=run(deceased,'injury-loss',{index:2});assert.equal(deceased.state.pending.kind,'injury-zero');deceased=run(deceased,'resolve-book',{confirmed:true,note:'Synthetic referee confirmation of a fatal injury.',injurySurvives:false});assert.equal(deceased.state.stage,'deceased');
 return [['finish',finished],['retirement',retired],['deceased',deceased]];
}
