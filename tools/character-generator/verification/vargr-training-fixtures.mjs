import {api} from '../engine/session.mjs';
import assert from 'node:assert/strict';
export function run(r,type,payload={}){const next=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(next.ok,true,JSON.stringify(next.error));return next;}
export function lonerTrainingFixture(){
 let r=api({operation:'create',seed:'audit-0'});
 r=run(r,'setup',{species:'vargr',name:'Training regression'});
 r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 r=run(r,'background',{skills:['Admin','Animals','Art']});
 r=run(r,'skip-precareer');r=run(r,'career',{id:'vargr.loner',assignment:'prospector'});
 return run(r,'survival');
}
export function merchantTrainingFixture({advanced=false}={}){
 for(let seed=0;seed<1500;seed++){
  let r=api({operation:'create',seed:'vargr-eligible-'+seed});r=run(r,'setup',{species:'vargr',name:'Training eligibility'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
  if((r.state.character.stats.EDU>=8)!==advanced)continue;
  r=run(r,'background',{skills:['Admin','Animals','Art','Athletics','Carouse'].slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:'vargr.merchant',assignment:'free'});
  if(r.state.stage!=='survival')continue;r=run(r,'survival');
  if(r.state.stage==='skill-choice'&&r.state.pendingChoice.scope==='eligible-career')return r;
 }
 throw Error('No public eligible-career fixture found.');
}
