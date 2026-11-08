import {settle} from './career-transfer-fixtures.mjs';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
export function run(r,type,payload={},options={}){const out=api({operation:'command',session:r.session,command:{type,payload},...options});assert.equal(out.ok,true,type+': '+out.error?.message);return out;}
export function rejected(r,type,payload={},pattern=/./){const before=exportSession(r.session),out=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(out.ok,false);assert.match(out.error.message,pattern);assert.equal(exportSession(r.session),before);return out;}
export function force(r,type,payload,values,index=0){const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Verified Zhodani source regression fixture'});}
export function setupZhodani(seed='reeducation',soc=9,psi=8){
 let r=api({operation:'create',seed});r=run(r,'setup',{species:'zhodani'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5?soc:8,reason:'Fixed source regression characteristics'});
 r=force(r,'accept-statistics',{},psi===8?[4,4]:psi===9?[4,5]:[3,3]);
 if(r.state.stage==='psionic-training'){r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');}
 if(r.state.stage==='background')r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 return run(r,'skip-precareer');
}
export function buildReeducationFixture({protectedStay=false,explicitDischarge=false,age=18,end=8,soc=9,cash=0,termsBefore=0}={}){
 seedLoop:for(let seed=0;seed<100;seed++){
  let r=setupZhodani('reeducation-'+protectedStay+'-'+explicitDischarge+'-'+seed,soc,soc>=10?9:8);
  if(age!==18)r=run(r,'gm-override',{field:'age',value:age,reason:'Ageing-boundary regression fixture'});
  if(end!==8)r=run(r,'gm-override',{field:'stat.END',value:end,reason:'END boundary regression fixture'});
  if(cash)r=run(r,'gm-override',{field:'cash',value:cash,reason:'Available fine funding fixture'});
  const id=explicitDischarge?'zhodani.agent':'zhodani.prole',assignment=explicitDischarge?'informant':'worker';
  r=settle(force(r,'career',{id,assignment},[6,6]));
  for(let term=0;term<termsBefore;term++){
   const survived=run(r,'survival');if(survived.log.at(-1).rolls[1]?.label!=='Event table')continue seedLoop;
   r=run(survived,'gm-replay',{revision:survived.revision,rollIndex:1,values:[4,5],reason:'Ordinary source career event fixture'});
   r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
   if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
   assert.equal(r.state.stage,'term-end');r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
  }
  const before=r,rolled=run(r,'survival'),logs=rolled.log.at(-1).rolls;
  if(protectedStay){
   if(logs[1]?.label!=='Event table')continue;
   r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[1,1],reason:'Protected disaster fixture'});
   if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
   if(r.state.stage!=='reeducation-roll')continue;
  }else{
   if(logs[1]?.label!=='Mishap table')continue;
   r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[4],reason:'Re-education mishap fixture'});
  }
  assert.equal(r.state.stage,'reeducation-roll');assert.equal(r.state.character.age,before.state.character.age);return r;
 }
 throw new Error('No public re-education seed found.');
}
export const chronology=mode=>({mode,reason:'Referee determined the treatment position within the source chronology.'});
export function rolledReeducation(r,row,anagathicTerms=0){return force(r,'reeducation-roll',{anagathicTerms,...(anagathicTerms?{anagathicsReason:'Verified referee history for this modifier.'}:{})},[row]);}

export function forceReeducationTerm(r){
 for(let attempt=0;attempt<30;attempt++){
  const before=r,rolled=run(r,'survival');
  if(rolled.log.at(-1).rolls[1]?.label==='Mishap table')return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[4],reason:'Source mishap regression fixture'});
  r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values:[1,1],reason:'Source failed-survival regression fixture'});
  if(r.state.stage==='reeducation-roll')return r;
  r=run(r,'restore',{revision:before.revision});
 }
 throw Error('Unable to construct a public re-education continuation.');
}
export function buildPsionicAgeingFixture(){
 let r=buildReeducationFixture({termsBefore:3});
 const survival=r.log.findLast(e=>e.type==='survival');
 r=run(r,'restore',{revision:survival.number-1});
 r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'Verified career PSI elevation for ageing regression'});
 r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');
 r=run(r,'gm-override',{field:'stat.PSI',value:1,reason:'Recorded low PSI before age-related loss'});
 for(let episode=0;episode<3;episode++){
  r=forceReeducationTerm(r);r=rolledReeducation(r,2);r=run(r,'resolve-reeducation',{chronology:chronology('before-resume')});
  if(episode===2){r=force(r,'ageing',{},[1,1]);assert.equal(r.state.stage,'effect-choice');return r;}
  while(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
  assert.equal(r.state.stage,'term-end');r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
 }
}
