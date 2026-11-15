import{aslanTemplateEntry,force,run}from'./aslan-template-fixtures.mjs';import{careerInfoFixture}from'./career-info-fixtures.mjs';import{settleAssignment}from'./assignment-fixtures.mjs';
export function speciesChoiceFixture(species){
 let r=species==='aslan'?aslanTemplateEntry('aslan.military','warrior','male'):settleAssignment(force(run(careerInfoFixture('vargr'),'gm-mode',{enabled:true}),'career',{id:'vargr.military',assignment:'army'},[6,6]));
 if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},species==='aslan'?[5,6]:[4,5]);return run(r,'choose-effect',{index:0});
}
