import assert from'node:assert/strict';
import{createSession,execute}from'../engine/session.mjs';
import{statisticsTotalOutcome,statisticsTagline}from'../gui/outcome-taglines.mjs';
import{buildAslanOriginFixture,force}from'./aslan-origin-fixtures.mjs';
import{assignmentSetup,settleAssignment,run}from'./assignment-fixtures.mjs';
import{aslanTemplateEntry}from'./aslan-template-fixtures.mjs';
import{vargrTemplateStart}from'./vargr-template-fixtures.mjs';
import{graduationFixture}from'./education-result-fixtures.mjs';
function stats(outcome,species='human',culture){
 for(let i=0;i<2000;i++){
  const before=execute(createSession('crow-commentary-'+(species==='human'?'':species+'-'+culture+'-')+i),{type:'setup',payload:{species,...(culture?{aezorghCulture:culture}:{})}},{id:'synthetic-setup'}).session;
  let r=execute(before,{type:'roll-statistics'},{id:'synthetic-statistics'});
  if(statisticsTotalOutcome(r.log.at(-1),r.state)!==outcome)continue;
  if(outcome==='statistics.high')for(let id=0;id<100;id++){r=execute(before,{type:'roll-statistics'},{id:'synthetic-statistics-'+id});if(statisticsTagline(r.log.at(-1),r.state)==='Somewhere, a referee is adding another turret.')return r;}
  else return r;
 }
 throw Error('No deterministic synthetic statistics fixture');
}
export function crowCommentaryFixtures(){
 const fixtures=[{name:'statistics-high',r:stats('statistics.high'),scope:'#workspace',corrected:true},{name:'statistics-low',r:stats('statistics.low'),scope:'#workspace',corrected:true},{name:'statistics-aezorgh-imperial-high',r:stats('statistics.high','aezorgh','imperial'),scope:'#workspace',corrected:true},{name:'statistics-aezorgh-vargr-low',r:stats('statistics.low','aezorgh','vargr'),scope:'#workspace',corrected:true}];
 for(const[name,start,command]of[
  ['family','aslan-family','roll-aslan-family'],['birth','aslan-birth-order','roll-aslan-birth-order'],['clan','aslan-clan','roll-aslan-clan'],['pride','aslan-pride','roll-aslan-pride'],['rite','aslan-rite','roll-aslan-rite']
 ])fixtures.push({name:'aslan-'+name,r:run(buildAslanOriginFixture({stage:start,familySOC:name==='rite'?4:9}),command),scope:'#aslan-family-dialog',corrected:true});
 fixtures.push({name:'aslan-estate',r:buildAslanOriginFixture({stage:'aslan-estate',familySOC:9}),scope:'#aslan-family-dialog',corrected:true});
 fixtures.push({name:'education',r:graduationFixture(),scope:'#workspace',corrected:false});
 let core=run(assignmentSetup('crow-army'),'skip-precareer');core=settleAssignment(force(core,'career',{id:'core.army',assignment:'support'},[6,6]));assert.equal(core.state.stage,'survival');fixtures.push({name:'core-career',r:run(core,'survival-check'),scope:'#workspace',corrected:false});
 const aslan=aslanTemplateEntry('aslan.envoy','duellist');assert.equal(aslan.state.stage,'survival');fixtures.push({name:'aslan-career',r:run(aslan,'survival-check'),scope:'#workspace',corrected:false});
 let vargr=settleAssignment(force(vargrTemplateStart(),'career',{id:'vargr.spacer',assignment:'corsair'},[6,6]));assert.equal(vargr.state.stage,'survival');fixtures.push({name:'vargr-career',r:run(vargr,'survival-check'),scope:'#workspace',corrected:false});
 return fixtures;
}
