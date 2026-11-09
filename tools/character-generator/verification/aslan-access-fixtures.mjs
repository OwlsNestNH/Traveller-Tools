import assert from 'node:assert/strict';
import {aslanSetup,aslanEvent,aslanEndTerm,aslanBenefits,run,force,settle,rejected} from './aslan-officer-fixtures.mjs';
export {run,force,settle,rejected,aslanEvent,aslanEndTerm,aslanBenefits};
const cache=new Map();
export const accessDestination='Recorded human-space destination';
export function activateAccess(r,id){const option=id??r.state.aslanAccessOptions.find(o=>o.available)?.id;assert.ok(option,'An available source route is required.');return run(r,'activate-aslan-access',{routeId:option,destination:accessDestination,confirmed:true});}
export function buildAslanAccessFixture({route='scientist-scholar',ready=true,activated=false,forcedStay=false,gender=route==='scientist-scholar'?'female':'male',cashRolls=0,terms=1,protectedStay=false}={}){
 const key=JSON.stringify({route,ready,activated,forcedStay,gender,cashRolls,terms,protectedStay});if(cache.has(key))return structuredClone(cache.get(key));
 let r=aslanSetup(route==='scientist-scholar'?'read-only-scientist-scholar':'aslan-access-'+route,gender,true);
 if(route==='scientist-scholar'){
  r=settle(force(r,'career',{id:'aslan.scientist',assignment:'researcher'},[6,6]));
  for(let n=0;n<60;n++){const before=r.revision;if(protectedStay){const next=aslanEvent(r,2);if(next.state.pendingChoice?.options?.[0]?.label==='Continue in human space'){r=next;break;}r=run(next,'restore',{revision:before});}else{const next=run(r,'survival');if(next.log.at(-1).rolls[1]?.label==='Mishap table'){r=run(next,'gm-replay',{revision:next.revision,rollIndex:1,values:[6],reason:'Verified Scientist mishap6 source fixture.'});break;}r=run(next,'restore',{revision:before});}}
  assert.equal(r.state.stage,'effect-choice');r=run(r,'choose-effect',{index:0});if(protectedStay)r=aslanEndTerm(settle(r));assert.equal(r.state.stage,'term-end');
 }else if(route==='outside-outcast'){
  r=settle(force(r,'career',{id:'aslan.envoy',assignment:'duellist'},[6,6]));for(let n=0;n<40;n++){const before=r.revision,next=run(r,'survival');if(next.log.at(-1).rolls[1]?.label==='Mishap table'){r=run(next,'gm-replay',{revision:next.revision,rollIndex:1,values:[2],reason:'Envoy source dishonour fixture'});break;}r=run(next,'restore',{revision:before});}assert.equal(r.state.stage,'term-end');
 }else if(route==='outside-failed-entry'){
  r=force(r,'career',{id:'aslan.military-officer',assignment:gender==='male'?'leader':'executive'},[1,1]);assert.equal(r.state.stage,'failed-entry');
 }else{
  const id=route==='outside-history'?'aslan.outlaw':'aslan.outcast',assignment=id==='aslan.outlaw'?'raider':'labourer';r=id==='aslan.outlaw'?settle(force(r,'career',{id,assignment},[6,6])):settle(run(r,'career',{id,assignment}));for(let term=1;term<terms;term++){r=aslanEndTerm(settle(aslanEvent(r,6)));r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));}r=settle(aslanEvent(r,route==='outcast-expedition'?9:6));if(route==='outcast-expedition')assert.ok(r.state.character.aslanCareerAccess?.length);
  r=aslanEndTerm(r,forcedStay?[6,6]:[4,5]);
 }
 if(ready&&r.state.stage==='term-end'&&!forcedStay&&!protectedStay){r=run(r,'leave-career');for(let i=0;i<cashRolls;i++){assert.equal(r.state.stage,'benefits');r=settle(force(r,'benefit',{cash:true},[1]));}r=aslanBenefits(r);assert.equal(r.state.stage,'career');}
 if(activated)r=activateAccess(r);cache.set(key,structuredClone(r));return r;
}

export function finishAccessCoreTerm(r,{event=9,advancement=[4,5]}={}){if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));r=settle(aslanEvent(r,event));return aslanEndTerm(r,advancement);}
