import assert from 'node:assert/strict';
import {buildClanSharesFixture,run,force,rejected} from './clan-shares-fixtures.mjs';
import {settle} from './aslan-officer-fixtures.mjs';
export {run,force,rejected};
export const verifiedWeapons={items:[{name:'Broadsword',quantity:20,unitCost:500,tl:2,sourceReference:'Core Rulebook Update2022 p124'}],sourceConfirmed:true,sourceReason:'Referee confirmed the listed weapon, quantity, price, TL and total against the cited entry.'};
export function buildMaleShareAssetsFixture(options={}){return buildClanSharesFixture({...options,gender:'male'});}
export function maleAssetPayload(r,kind='art',quantity=1,extra={}){return {kind,inputs:[{lotId:r.state.character.clanShareLots.find(l=>l.available>0).id,quantity}],...(kind==='art'?{name:'Engraved family sculpture'}:verifiedWeapons),...structuredClone(extra)};}
export function buildMaleShareMedicalFixture(){
 let r=buildMaleShareAssetsFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));
 for(let attempt=0;attempt<100;attempt++){
  const before=r.revision,rolled=run(r,'survival'),table=rolled.log.at(-1).rolls[1];
  if(table?.label==='Mishap table'&&table.total===6){r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:2,values:[5],reason:'Source injury result for non-cash medical settlement fixture.'});r=run(r,'injury-loss',{index:0});r=run(r,'injury-treatment',{restore:r.state.injuryRestorable,inService:false});r=run(r,'leave-career');assert.equal(r.state.stage,'career');assert.equal(r.state.character.medicalBills[0].personalCost,5000);return r;}
  r=run(rolled,'restore',{revision:before});
 }
 throw Error('A public native Aslan injury fixture was not found.');
}
