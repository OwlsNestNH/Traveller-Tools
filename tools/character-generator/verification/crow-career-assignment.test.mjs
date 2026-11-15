import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {crowCareerAssignment} from '../gui/crow-career-assignment.mjs';
import {careerTemplateModel,careerCrowType,careerResultCrowType} from '../gui/career-template.mjs';
import {vargrFailedSpacer} from './vargr-fallback-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('failed Spacer specialties retain their recorded outfits without altering outcomes or saves',()=>{
 for(const species of ['vargr','aezorgh'])for(const assignment of ['corsair','navy','explorer']){
  const r=vargrFailedSpacer(assignment,species),event=r.log.at(-1),before=exportSession(r.session),stateBefore=JSON.stringify(r.state);
  const expected=assignment==='corsair'?'corsair':'navy',model=careerTemplateModel(r.state,catalog);
  assert.equal(event.type,'career');assert.equal(crowCareerAssignment(r.state,'vargr.spacer',event),assignment);
  assert.equal(careerCrowType(model),expected);assert.equal(careerResultCrowType(event,{status:'failure'},r.state),expected);
  assert.equal(careerResultCrowType(event,{status:'error'},r.state),'generic');assert.equal(JSON.stringify(r.state),stateBefore);assert.equal(exportSession(r.session),before);
 }
});
test('unknown or unrelated failed-transition specialties never borrow a prior Corsair costume',()=>{
 const r=vargrFailedSpacer(),state=structuredClone(r.state);state.active=0;state.character.careers=[{id:'vargr.spacer',assignment:'corsair',rank:1}];
 for(const transition of [null,{status:'failed',toCareerId:'vargr.military',toAssignment:'corsair'},{status:'entered',toCareerId:'vargr.spacer',toAssignment:'corsair'},{status:'failed',toCareerId:'vargr.spacer'}]){
  state.character.careerTransitions=transition?[transition]:[];const before=JSON.stringify(state);
  assert.equal(crowCareerAssignment(state,'vargr.spacer'),null);assert.equal(careerCrowType(careerTemplateModel(state,catalog)),'navy');assert.equal(JSON.stringify(state),before);
 }
});
test('a failed new non-Corsair attempt overrides the prior active Corsair specialty cosmetically',()=>{
 const state=structuredClone(vargrFailedSpacer('explorer').state);state.active=0;state.character.careers=[{id:'vargr.spacer',assignment:'corsair',rank:1}];
 assert.equal(crowCareerAssignment(state,'vargr.spacer'),'explorer');assert.equal(careerCrowType(careerTemplateModel(state,catalog)),'navy');
});
test('ordinary active and final-benefit specialties keep their recorded costume context',()=>{
 const state={stage:'survival',active:0,character:{careers:[{id:'vargr.spacer',assignment:'corsair'}],careerTransitions:[]}};
 assert.equal(crowCareerAssignment(state,'vargr.spacer'),'corsair');assert.equal(crowCareerAssignment(state,'core.navy'),null);
 state.active=null;state.stage='career';assert.equal(crowCareerAssignment(state,'vargr.spacer',{type:'benefit'}),'corsair');assert.equal(crowCareerAssignment(state,'vargr.spacer'),null);
 assert.equal(careerCrowType({career:{id:'vargr.spacer'},record:{assignment:'corsair'}}),'corsair');
});
