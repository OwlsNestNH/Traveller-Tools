import assert from 'node:assert/strict';
import {settle} from './career-transfer-fixtures.mjs';
import {setupZhodani,run,rejected,force} from './zhodani-reeducation-fixtures.mjs';
export {run,rejected,force};
// Source-earned fixtures only: public setup, qualification, seeded survival and audited replay.
export function buildMerchantFineFixture({cash=0,soc=9,protectedStay=false}={}){
 for(let seed=0;seed<120;seed++){
  let r=setupZhodani('merchant-fine-'+protectedStay+'-'+seed,soc,soc>=10?9:8);
  if(cash)r=run(r,'gm-override',{field:'cash',value:cash,reason:'Verified available cash fixture'});
  r=settle(force(r,'career',{id:'zhodani.merchant',assignment:'broker'},[6,6]));
  const rolled=run(r,'survival'),entry=rolled.log.at(-1),table=entry.rolls[1];
  if(protectedStay){
   if(table?.label!=='Event table')continue;
   r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[1,1],reason:'Protected Merchant disaster fixture'});
  }else{
   if(table?.label!=='Mishap table')continue;
   r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[3],reason:'Merchant paperwork fine source fixture'});
  }
  if(r.state.stage!=='merchant-fine-roll')continue;
  assert.equal(r.state.currentMerchantFine.origin.protectedStay??false,protectedStay);
  return r;
 }
 throw Error('No public Merchant fine seed found.');
}
export function rolledMerchantFine(r,die){return force(r,'merchant-fine-roll',{},[die]);}
