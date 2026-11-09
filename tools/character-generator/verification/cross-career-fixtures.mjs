// Preserved full-engine development regression, including deferred Zhodani.

import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {setupZhodani,run,rejected,force} from './zhodani-reeducation-fixtures.mjs';
import {settle} from './career-transfer-fixtures.mjs';
export {run,rejected,force};
const cache=new Map();
function replay(r,revision,index,values){return run(r,'gm-replay',{revision,rollIndex:index,values,reason:'Verified borrowed-career source fixture'});}
export function buildAgentUndercoverFixture({success=true,borrowedEvent=3,borrowedMishap=3,end=8}={}){
 const key=JSON.stringify(['agent',success,borrowedEvent,borrowedMishap,end]);if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<400;seed++){
  let r=setupZhodani('undercover-'+seed,9,8);if(end!==8)r=run(r,'gm-override',{field:'stat.END',value:end,reason:'Borrowed treatment END boundary fixture'});r=settle(force(r,'career',{id:'zhodani.agent',assignment:'informant'},[6,6]));
  r=run(r,'survival');const route=r.state.character.crossCareerRoutes?.at(-1);if(!route||route.check.success!==success)continue;
  const revision=r.revision;
  for(let attempt=0;attempt<60;attempt++){
   r=replay(r,revision,3,success?[Math.max(1,borrowedEvent-6),Math.min(6,borrowedEvent-1)]:[borrowedMishap]);
   const latest=r.state.character.crossCareerRoutes.at(-1);
   if(success&&borrowedEvent===2&&latest.tables.at(-1)?.row!==borrowedMishap)continue;
   assert.equal(latest.originCareerId,'zhodani.agent');cache.set(key,structuredClone(r));return r;
  }
 }
 throw Error('No public undercover fixture found.');
}
function governmentSetup(seed,gambler=false){
 let r=api({operation:'create',seed});r=run(r,'configure',{extras:['WLT']});r=run(r,'setup',{species:'zhodani'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5?11:8,reason:'Advisory source fixture'});
 r=force(r,'accept-statistics',{},[4,5]);r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');
 if(r.state.stage==='background')r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 r=run(r,'skip-precareer');if(gambler)r=run(r,'connection',{person:'Fixture Traveller',skill:'Gambler',note:'Recorded source-earned connection skill.'});return settle(force(r,'career',{id:'zhodani.government',assignment:'administration'},[6,6]));
}
function advisoryEvent(r,row=4){
 for(let i=0;i<30;i++){
  const before=r.revision;r=run(r,'survival');
  if(r.log.at(-1).rolls[1]?.label==='Event table')return replay(r,r.revision,1,[Math.max(1,row-6),Math.min(6,row-1)]);
  r=run(r,'restore',{revision:before});
 }
 throw Error('No public advisory Event fixture found.');
}
export function buildGovernmentAdvisoryFixture({cashRolls=0,gambler=false,withBenefitModifier=false}={}){
 const key=JSON.stringify(['government',cashRolls,gambler,withBenefitModifier]);if(cache.has(key))return structuredClone(cache.get(key));
 let r=governmentSetup('government-advisory',gambler);
 if(withBenefitModifier){r=advisoryEvent(r,5);r=run(r,'advancement');if(r.log.at(-1).rolls.length)r=replay(r,r.revision,0,[4,5]);r=settle(r);if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));}
 for(let i=0;i<cashRolls;i++){
  r=advisoryEvent(r);r=settle(force(r,'advisory-career',{careerId:'zhodani.prole'},[1]));r=force(r,'advisory-cash',{},[1]);
  r=run(r,'advancement');if(r.log.at(-1).rolls.length)r=replay(r,r.revision,0,[4,5]);r=settle(r);if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
  if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'term-end');
  r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
 }
 r=advisoryEvent(r);cache.set(key,structuredClone(r));return r;
}

export function buildBenefitCreditFixture({credits=1,careerScoped=false,advisory=false}={}){
 const key=JSON.stringify(['credits',credits,careerScoped,advisory]);if(cache.has(key))return structuredClone(cache.get(key));
 let r=settle(force(setupZhodani('benefit-credits',9,8),'career',{id:'zhodani.prole',assignment:'worker'},[6,6]));
 for(let term=0;term<credits;term++){
  let found=false;
  for(let attempt=0;attempt<40;attempt++){const before=r.revision;r=run(r,'survival');if(r.log.at(-1).rolls[1]?.label==='Event table'){r=replay(r,r.revision,1,careerScoped?[1,3]:[1,2]);found=true;break;}r=run(r,'restore',{revision:before});}
  assert.ok(found);r=run(r,'advancement');if(r.log.at(-1).rolls.length)r=replay(r,r.revision,0,[4,5]);r=settle(r);
  if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[2]));
  if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
  if(term<credits-1){r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[2]));}
 }
 r=run(r,'leave-career');assert.equal(r.state.stage,'benefits');
 if(advisory){
  while(r.state.stage==='benefits')r=force(r,'benefit',{cash:false},[2]);
  r=settle(force(r,'career',{id:'zhodani.government',assignment:'administration'},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'service'},[1]));
  r=advisoryEvent(r);r=settle(force(r,'advisory-career',{careerId:'zhodani.prole'},[1]));
 }
 cache.set(key,structuredClone(r));return r;
}
export function buildAdvisoryCashSourceFixture(){
 let r=buildBenefitCreditFixture({credits:2,advisory:true});return force(r,'advisory-cash',{creditIds:r.state.benefitCreditOptions.map(c=>c.id)},[6]);
}
export function buildAdvisorySkillCapFixture(){
 let r=governmentSetup('advisory-skill-cap');
 r=run(r,'gm-override',{field:'stat.INT',value:0,reason:'Explicit skill-limit boundary fixture'});r=run(r,'gm-override',{field:'stat.EDU',value:0,reason:'Explicit skill-limit boundary fixture'});
 r=advisoryEvent(r);return force(r,'advisory-career',{careerId:'zhodani.prole'},[2]);
}
