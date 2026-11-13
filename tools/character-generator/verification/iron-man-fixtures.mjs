import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {assignmentSetup,run,settleAssignment,force} from './assignment-fixtures.mjs';
const catalog=api({operation:'catalog'});
export function ironManReady(id,seed='iron-man-'+id){const career=catalog.careers.find(c=>c.id===id);let r=run(assignmentSetup(seed,10),'skip-precareer');r=run(r,'career',{id,assignment:career.assignments[0].id});if(r.state.stage==='failed-entry')r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[6,6],reason:'Synthetic qualified entry'});r=settleAssignment(r);if(r.state.stage==='preterm-commission')r=run(r,'preterm-commission',{attempt:false});if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:r.state.trainingOptions[0].id},[1]));assert.equal(r.state.stage,'survival');return r;}
