import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run} from './vargr-training-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
export {run};
function force(r,type,payload,values,index=0){
 const next=run(r,type,payload);
 return run(next,'gm-replay',{revision:next.revision,rollIndex:index,values,reason:'Later-term event regression'});
}
function event(r,row){
 for(let attempt=0;attempt<100;attempt++){
  const before=r.revision,next=run(r,'survival'),roll=next.log.at(-1).rolls[1];
  if(roll?.label==='Event table'){
   if(row===7&&roll.total===7)return run(next,'gm-replay',{revision:next.revision,rollIndex:2,values:[1,4],reason:'Verify later-term romantic life event'});
   if(row!==7)return run(next,'gm-replay',{revision:next.revision,rollIndex:1,values:[row-6,6],reason:'Verify later-term career event'});
  }
  r=run(next,'restore',{revision:before});
 }
 throw Error('No matching later-term event branch found.');
}
let cache;
export function laterTermVargrFixture(){
 if(cache)return structuredClone(cache);
 let r=api({operation:'create',seed:'vargr-later-term-events'});
 r=run(r,'setup',{species:'vargr',name:'Later-term regression'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let index=0;index<6;index++)r=run(r,'gm-override',{field:'pool',index,value:index===3?12:8,reason:'Stable later-term fixture'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
 r=settleAssignment(force(r,'career',{id:'vargr.agent',assignment:'investigator'},[6,6]));
 const results=[];
 for(const row of [10,11,7,11]){
  assert.equal(r.state.stage,'survival');r=event(r,row);results.push(structuredClone(r));
  if(results.length===4)break;
  assert.equal(r.state.stage,'advancement');
  r=settleAssignment(force(r,'advancement',{},[6,6]));
  if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));
  assert.equal(r.state.stage,'term-end');r=run(r,'continue-career');
  r=settleAssignment(force(r,'training',{table:'personal'},[1]));
 }
 cache=results;return structuredClone(cache);
}
