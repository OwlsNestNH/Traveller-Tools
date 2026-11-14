import assert from 'node:assert/strict';
import {api,project,RULES_REVISION} from '../engine/session.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
export function run(r,type,payload={}){const next=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(next.ok,true,type+': '+next.error?.message);return next;}
export function vargrFailedQualification(revision=RULES_REVISION,seed='career-info-vargr-native'){
 let r=api({operation:'create',seed});r.session.rulesRevision=revision;r={...r,...project(r.session)};
 for(const [t,p] of [['setup',{species:'vargr',gender:'female',culture:'native',name:'Synthetic Vargr fallback'}],['gm-mode',{enabled:true}],['roll-statistics',{}],['accept-statistics',{}]])r=run(r,t,p);
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:'vargr.intermediary',assignment:'arbitrator'});assert.equal(r.state.stage,'failed-entry');return r;
}
export function force(r,type,payload,values){const next=run(r,type,payload);return next.log.at(-1).rolls.length?run(next,'gm-replay',{revision:next.revision,rollIndex:0,values,reason:'Synthetic Vargr source-route coverage'}):next;}
export function completeVargrSourceTerm(r,event=12){
 r=settleAssignment(r);if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));assert.equal(r.state.stage,'survival');r=force(r,'survival-check',{},[6,6]);r=settleAssignment(force(r,'career-event',{},event===11?[5,6]:[6,6]));if(r.state.stage==='advancement')r=settleAssignment(force(r,'advancement',{},[4,4]));if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);if(r.state.stage==='term-end')r=run(r,'leave-career');for(let i=0;i<15&&r.state.stage==='benefits';i++)r=settleAssignment(force(r,'benefit',{cash:false},[2]));assert.ok(['career','failed-entry'].includes(r.state.stage),r.state.stage);return r;
}
