import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run,rejected} from './core-life-event-fixtures.mjs';
import {assignmentSetup,settleAssignment as settle} from './assignment-fixtures.mjs';
import {aslanSetup} from './aslan-officer-fixtures.mjs';
export {run,rejected};
export function force(r,type,payload,values,index=0){const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Verified benefit wager regression fixture'});}
const cache=new Map();
export function wagerFixture({career='core.merchant',terms=1}={}){
 const key=career+'/'+terms;if(cache.has(key))return structuredClone(cache.get(key));
 let r=career==='aslan.manager'?aslanSetup('wager-manager','female'):run(assignmentSetup('wager-'+career),'skip-precareer');
 r=settle(force(r,'career',{id:career,assignment:career==='aslan.manager'?'corporate':career==='core.rogue'?'thief':'marine'},[6,6]));
 for(let t=0;t<=terms;t++){
  for(let n=0;n<40;n++){const before=r.revision;const next=run(r,'survival');if(next.log.at(-1).rolls[1]?.label==='Event table'){r=next;break;}r=run(next,'restore',{revision:before});}
  const survivalRevision=r.revision;assert.equal(r.log.at(-1).rolls[1].label,'Event table');
  const event=t===terms?(career==='core.rogue'?10:5):(career==='core.merchant'?6:career==='core.rogue'?5:10);
  r=run(r,'gm-replay',{revision:survivalRevision,rollIndex:1,values:[Math.max(1,event-6),Math.min(6,event-1)],reason:'Select source wager or safe prior event'});
  if(t===terms)break;
  r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
  if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'term-end');
  r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
 }
 assert.equal(r.state.stage,'benefit-wager');assert.equal(api({operation:'project',session:r.session}).ok,true);cache.set(key,r);return structuredClone(r);
}
