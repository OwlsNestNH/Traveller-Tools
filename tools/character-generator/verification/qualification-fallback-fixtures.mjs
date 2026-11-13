import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
export {run,force};
const catalog=api({operation:'catalog'}),cache=new Map();
function completeArmyTerm(r){
 r=settleAssignment(r);r=force(r,'survival-check',{},[6,6]);r=settleAssignment(force(r,'career-event',{},[4,5]));r=settleAssignment(force(r,'advancement',{},[4,5]));
 if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));
 assert.equal(r.state.stage,'term-end');r=run(r,'leave-career');
 for(let n=0;r.state.stage==='benefits'&&n<12;n++)r=settleAssignment(force(r,'benefit',{cash:false},[2]));
 assert.equal(r.state.stage,'career');assert.equal(r.state.character.terms,1);return r;
}
export function qualificationFixture(id='core.army',{later=false,used=false}={}){
 const key=JSON.stringify([id,later,used]);if(cache.has(key))return structuredClone(cache.get(key));
 const career=catalog.careers.find(c=>c.id===id);
 for(let seed=0;seed<80;seed++){
  let r=run(assignmentSetup('qualification-fallback-'+id+'-'+seed),'skip-precareer');
  if(used){r=force(r,'career',{id:'core.army',assignment:'support'},[1,1]);r=force(r,'fallback',{draft:true},[2]);r=completeArmyTerm(r);}
  else if(later)r=completeArmyTerm(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));
  r=run(r,'career',{id,assignment:career.assignments[0].id});if(r.state.stage!=='failed-entry')continue;
  assert.equal(r.state.fallbackOptions.draft.available,!used);cache.set(key,structuredClone(r));return r;
 }
 throw Error('No synthetic failed qualification found for '+id);
}
