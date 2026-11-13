import assert from 'node:assert/strict';
import {api,exportSession,project,RULES_REVISION} from '../engine/session.mjs';
import {aslanSetup,run,force,settle} from './aslan-officer-fixtures.mjs';
export {run,force};
export const aslanTemplateCatalog=api({operation:'catalog'});
const cache=new Map();
export function aslanTemplateStart(gender='male'){if(!cache.has(gender))cache.set(gender,aslanSetup('aslan-template-'+gender,gender,false,{},RULES_REVISION));return structuredClone(cache.get(gender));}
export function settleTemplate(r){
 for(let n=0;n<35;n++){
  if(r.state.stage==='borrowed-event-roll'){const p=r.state.pendingBorrowedRoll;const skill=p.skillOptions?.[0]?.id??p.skillOptions?.[0]?.name;const payload={pendingId:p.id,...(skill?{skill}:{})};r=force(r,'roll-borrowed-event',payload,Array(Number(String(p.dice??'2D').match(/\d+/)?.[0])||2).fill(6));}
  else if(r.state.stage==='effect-choice'&&r.state.character.gender==='male'&&r.state.pendingChoice?.options?.[0]?.label==='Science')r=run(r,'choose-effect',{index:1});
  else if(['effect-choice','skill-choice'].includes(r.state.stage))r=settle(r);
  else return r;
 }throw Error('Aslan template fixture exceeded bounded choices.');
}
export function aslanTemplateEntry(id,assignment,gender='male'){
 let r=aslanTemplateStart(gender);r=id==='aslan.outcast'?run(r,'career',{id,assignment}):force(r,'career',{id,assignment},[6,6]);return settleTemplate(r);
}
export function aslanTemplateEvent(r,result=6){r=force(r,'survival-check',{},[6,6]);return force(r,'career-event',{},[Math.max(1,result-6),Math.min(6,result-1)]);}
export function aslanTemplateTerm(r){
 if(r.state.stage==='training')r=settleTemplate(force(r,'training',{table:'personal'},[1]));
 assert.equal(r.state.stage,'survival');r=settleTemplate(aslanTemplateEvent(r));assert.equal(r.state.stage,'advancement');r=settleTemplate(force(r,'advancement',{},[4,4]));if(r.state.stage==='training')r=settleTemplate(force(r,'training',{table:'personal'},[1]));if(r.state.stage==='ageing')r=settleTemplate(force(r,'ageing',{},[6,6]));assert.equal(r.state.stage,'term-end');return r;
}
export function aslanTemplateAllSpecialties(){
 const rows=[];
 for(const career of aslanTemplateCatalog.careers.filter(c=>c.group==='aslan'))for(const assignment of career.assignments){
  const gender=['male','female'].find(g=>{const c=aslanTemplateStart(g).state.careerChoices.find(c=>c.id===career.id);return !c.disabled&&!c.assignments.find(a=>a.id===assignment.id).disabled;});assert.ok(gender,career.id+'/'+assignment.id+' has a source-permitted sex');rows.push({career,assignment,gender});
 }
 return rows;
}
export function assertTemplateReplay(r){const raw=exportSession(r.session),loaded=project(JSON.parse(raw));assert.deepEqual(loaded.state,r.state);assert.equal(exportSession(JSON.parse(raw)),raw);return raw;}
