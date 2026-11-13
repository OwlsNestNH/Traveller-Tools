import assert from 'node:assert/strict';
import {buildMaleShareAssetsFixture,run,force,rejected} from './clan-share-assets-fixtures.mjs';
import {aslanEvent,settle} from './aslan-officer-fixtures.mjs';
export {run,force,rejected};
export const landWorld={name:'Source fixture world',location:'Fixture sector / 0101',reference:'Referee-selected campaign world'};
export function landPayload(r,{shares=3,world=landWorld,parcelRuling}={}){return {kind:'land',inputs:[{lotId:r.state.character.clanShareLots.find(l=>l.available>0).id,quantity:shares}],world:{...world},...(parcelRuling===undefined?{}:{parcelRuling})};}
const cache=new Map();
function trainIndependence(r){r=force(r,'training',{table:'personal'},[4]);assert.equal(r.state.stage,'effect-choice');if(r.state.aslanRollCheckpoints){r=run(r,'choose-effect',{index:0});assert.equal(r.state.stage,'borrowed-event-roll');return force(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id},[6,6]);}return force(r,'choose-effect',{index:0},[6,6]);}
export function buildLandClaimFixture({soc=9,shares=3,die=1,mature=false,relative=false,gm=true,parcelRuling,stage='precareer'}={}){
 const key=JSON.stringify({soc,shares,die,mature,relative,gm,parcelRuling,stage});if(cache.has(key))return structuredClone(cache.get(key));
 let r=buildMaleShareAssetsFixture({stage});r=run(r,'gm-override',{field:'stat.SOC',value:soc,reason:'Recorded current-SOC land redemption boundary.'});r=force(r,'redeem-clan-shares',landPayload(r,{shares,parcelRuling}),[die]);
 if(relative){if(r.state.stage==='precareer')r=run(r,'skip-precareer');r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));
  for(let term=0;term<2;term++){r=settle(aslanEvent(r,8));r=settle(force(r,'advancement',{},[4,5]));assert.equal(r.state.stage,'training');r=trainIndependence(r);assert.equal(r.state.stage,'term-end');if(term===0){r=run(r,'continue-career');r=trainIndependence(r);assert.equal(r.state.stage,'survival');}}
  assert.equal(r.state.character.skills.Independence,3);
 }
 if(mature&&r.state.character.age<r.state.character.landClaims[0].eligibleAge)r=run(r,'gm-override',{field:'age',value:r.state.character.landClaims[0].eligibleAge,reason:'Referee recorded elapsed chronological age for the mature-claim fixture; no career term is invented.'});
 if(!gm)r=run(r,'gm-mode',{enabled:false});cache.set(key,structuredClone(r));return r;
}
export const landResolution={mode:'personal-return',claimEstablished:true,reason:'Referee confirms the actual return and completed claim on the recorded world; this action does not simulate travel.'};
