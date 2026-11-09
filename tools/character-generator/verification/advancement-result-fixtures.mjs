import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
// Public commands only. Seek a deterministic, ordinary Vargr advancement outcome.
export function advancementFixture(success){
 for(let seed=0;seed<100;seed++){
  let r=api({operation:'create',seed:'advancement-result-'+seed});
  r=run(r,'setup',{name:'Advancement tester',species:'vargr'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
  r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
  r=settleAssignment(run(r,'career',{id:'vargr.loner',assignment:'wanderer'}));
  if(r.state.stage==='training')r=settleAssignment(run(r,'training',{table:r.state.trainingOptions[0].id}));
  if(r.state.stage!=='survival')continue;
  r=settleAssignment(run(r,'survival'));if(r.state.stage!=='advancement')continue;
  const before=r,after=run(r,'advancement');
  if(after.log.at(-1).summary.includes('"success":'+success)){assert.equal(after.log.at(-1).type,'advancement');return {before,after};}
 }
 throw Error('No ordinary Vargr advancement fixture found.');
}
