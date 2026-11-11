import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run,force,rejected} from './zhodani-reeducation-fixtures.mjs';
export {run,force,rejected};
export function settleOrigin(r,{until='precareer',familyDie=6,birthDice=[1,2],clanDice=[3,3],prideDice=[3,4],riteDice=[2,3],sourceDecisions={}}={}){
 for(let n=0;n<35;n++){
  const s=r.state;if(s.stage===until)return r;
  if(s.stage==='aslan-family'){if(!s.currentAslanOrigin.gender)break;r=run(r,'roll-aslan-family');if(r.log.at(-1).rolls.length)r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[familyDie],reason:'Recorded source family fixture die'});}
  else if(s.stage==='aslan-family-result')r=run(r,'acknowledge-aslan-family');
  else if(s.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
  else if(s.stage==='skill-choice'){const e=s.pendingChoice;const base=e.allowed?.[0];if(!base)break;r=run(r,'choose-skill',{name:base+' (source fixture)'});}
  else if(s.stage==='aslan-birth-result')r=run(r,'acknowledge-aslan-birth-order');
  else if(s.stage==='aslan-birth-order')r=force(r,'roll-aslan-birth-order',{},birthDice);
  else if(s.stage==='aslan-estate'){if(s.currentAslanOrigin.estateOptions.requiresRefereeBaseline){if(!sourceDecisions.estate)break;r=run(r,'resolve-aslan-estate',sourceDecisions.estate);}else r=run(r,'resolve-aslan-estate',{method:'printed-minimum'});}
  else if(s.stage==='aslan-clan-result')r=run(r,'acknowledge-aslan-clan');
  else if(s.stage==='aslan-clan')r=force(r,'roll-aslan-clan',{},clanDice);
  else if(s.stage==='aslan-pride-result')r=run(r,'acknowledge-aslan-pride');
  else if(s.stage==='aslan-pride')r=force(r,'roll-aslan-pride',{},prideDice);
  else if(s.stage==='background')r=run(r,'background',{skills:s.backgroundOptions.filter(name=>!Object.hasOwn(s.character.skills,name)).slice(0,s.backgroundRemaining)});
  else if(s.stage==='aslan-rite')r=force(r,'roll-aslan-rite',{},riteDice);
  else if(s.stage==='book-step'&&s.pending.kind==='aslan-origin-source'){
   const decision=sourceDecisions[s.pending.decision];if(!decision)break;r=run(r,'resolve-aslan-origin-source',decision);
  }else break;
 }
 return r;
}
export function buildAslanOriginFixture({seed='aslan-origin-fixture',gender='male',familySOC=8,soc=familySOC,stage='aslan-family',boons=0,allocation=true,rulesRevision,...options}={}){
 let r=api({operation:'create',seed});if(rulesRevision)r.session.rulesRevision=rulesRevision;r=run(r,'setup',{species:'aslan',gender});r=run(r,'configure',{boons,allocation});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5?soc:8,reason:'Source-origin boundary fixture'});
 r=run(r,'accept-statistics');r=settleOrigin(r,{...options,until:stage});assert.equal(r.state.stage,stage,'Origin fixture did not reach '+stage);return r;
}
