import test from 'node:test';
import assert from 'node:assert/strict';
import {careerRankSummary,careerRankView} from '../gui/career-rank-view.mjs';
import {CAREERS} from '../engine/catalog.mjs';
const catalog={careers:CAREERS};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const army={id:'core.army',assignment:'infantry',rank:0,officer:false};
const merchant={id:'core.merchant',assignment:'free',rank:3,officer:false};
const state=(careers=[{...army}],active=0)=>({active,character:{careers}});

test('active career index zero and rank zero remain visible even with later records',()=>{
 assert.deepEqual(careerRankSummary(state([army,merchant]),catalog),{heading:'Current career',careerName:'Army',assignmentName:'Infantry',rankLabel:'Rank 0'});
 assert.match(careerRankView(state(),catalog,{esc}),/career-rank-value">Rank 0/);
});
test('current career follows the active index, not the first record',()=>{
 assert.equal(careerRankSummary(state([army,merchant],1),catalog).careerName,'Merchant');
});
test('no active career shows the most recent career without claiming it is current',()=>{
 const summary=careerRankSummary(state([army,merchant],null),catalog);
 assert.equal(summary.heading,'Most recent career');
 assert.equal(summary.careerName,'Merchant');
 assert.equal(summary.assignmentName,'Free trader');
 assert.equal(summary.rankLabel,'Rank 3');
});
test('no career history produces no placeholder rank',()=>{
 assert.equal(careerRankSummary(state([],null),catalog),null);
 assert.equal(careerRankView(state([],null),catalog,{esc}),'');
});
test('no-rank careers do not display a numeric rank or officer label',()=>{
 const s=state([{id:'companion.truther',assignment:'truther',rank:0,officer:true}]);
 assert.equal(careerRankSummary(s,catalog).rankLabel,'No rank system');
 assert.doesNotMatch(careerRankView(s,catalog,{esc}),/Rank 0|Officer rank/);
});
test('promotions and commissions use latest record, not stale term history',()=>{
 const s=state([{...army,termHistory:[{rank:0,officer:false}]}]);
 const before=JSON.stringify(s);
 careerRankView(s,catalog,{esc});
 assert.equal(JSON.stringify(s),before);
 s.character.careers[0].rank=2;
 assert.equal(careerRankSummary(s,catalog).rankLabel,'Rank 2');
 s.character.careers[0].officer=true;
 s.character.careers[0].rank=1;
 assert.equal(careerRankSummary(s,catalog).rankLabel,'Officer rank 1');
});
test('missing catalog names fall back safely and absent ranks are never invented',()=>{
 const s=state([{id:'<unknown>',assignment:'<assignment>'}]);
 const html=careerRankView(s,catalog,{esc});
 assert.match(html,/&lt;unknown&gt; \/ &lt;assignment&gt;/);
 assert.match(html,/Rank not recorded/);
 assert.doesNotMatch(html,/<unknown>|<assignment>|Rank 0/);
});
