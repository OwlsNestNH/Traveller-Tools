import assert from 'node:assert/strict';
import {settle} from './career-transfer-fixtures.mjs';
import {setupZhodani,buildPsionicAgeingFixture,run,rejected,force} from './zhodani-reeducation-fixtures.mjs';
export {run,rejected,force};
function selectRow(r,{row,event=false,protectedStay=false}){
 const rolled=run(r,'survival'),table=rolled.log.at(-1).rolls[1];
 if(event||protectedStay){
  if(table?.label!=='Event table')return null;
  return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:protectedStay?[1,1]:[1,row-1],reason:'Verified source event fixture'});
 }
 if(table?.label!=='Mishap table')return null;
 return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[row],reason:'Verified source mishap fixture'});
}
export function buildProleLossFixture({withRelationships=true,protectedStay=false}={}){
 for(let seed=0;seed<160;seed++){
  let r=settle(force(setupZhodani('prole-loss-'+withRelationships+'-'+protectedStay+'-'+seed),'career',{id:'zhodani.prole',assignment:'worker'},[6,6]));
  if(withRelationships){
   r=selectRow(r,{event:true,row:5});if(!r)continue;
   r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
   if(r.state.stage!=='term-end')continue;r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
  }
  r=selectRow(r,{row:5,protectedStay});if(!r||r.state.stage!=='relationship-loss')continue;
  assert.equal(r.state.relationshipLossOptions.length>0,withRelationships);return r;
 }
 throw Error('No public Prole relationship-loss fixture found.');
}
export function buildScholarChoiceFixture({soc=9,secret=true,protectedStay=false,event=false}={}){
 for(let seed=0;seed<160;seed++){
  let r=settle(force(setupZhodani('scholar-choice-'+soc+'-'+protectedStay+'-'+event+'-'+seed,soc,soc>=10?9:8),'career',{id:'zhodani.scholar',assignment:'field'},[6,6]));
  r=selectRow(r,{row:3,event,protectedStay});if(!r||r.state.stage!=='effect-choice')continue;
  const labels=r.state.pendingChoice.options?.map(o=>o.label)??[];
  if(!labels.includes(event?'Accept':'Secret research'))continue;
  r=run(r,'choose-effect',{index:event?0:secret?1:0});assert.equal(r.state.stage,'skill-choice');return r;
 }
 throw Error('No public Scholar choice fixture found.');
}
export function buildGovernmentCheckFixture({protectedStay=false}={}){
 for(let seed=0;seed<160;seed++){
  let r=settle(force(setupZhodani('government-check-'+protectedStay+'-'+seed,10,9),'career',{id:'zhodani.government',assignment:'administration'},[6,6]));
  r=selectRow(r,{row:4,protectedStay});if(!r||r.state.stage!=='effect-choice')continue;
  if(r.state.pendingChoice.options?.map(o=>o.label).join(',')!=='PSI,Melee,Recon')continue;
  return r;
 }
 throw Error('No public Government check fixture found.');
}

export function buildGovernmentLostPsiFixture(){
 let r=buildPsionicAgeingFixture();r=run(r,'choose-effect',{index:3});r=run(r,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:'Referee selected PSI for the ageing loss.'});
 r=force(r,'ageing',{},[6,6]);r=run(r,'leave-career');while(r.state.stage==='benefits')r=force(r,'benefit',{cash:false},[2]);
 r=settle(force(r,'career',{id:'zhodani.government',assignment:'administration'},[6,6]));
 if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 for(let attempt=0;attempt<30;attempt++){
  const before=r,rolled=run(r,'survival');
  if(rolled.log.at(-1).rolls[1]?.label==='Mishap table'){
   r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:1,values:[4],reason:'Government defence after permanent PSI loss fixture'});return r;
  }
  r=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values:[1,1],reason:'Failed survival after permanent PSI loss fixture'});
  if(r.state.stage==='effect-choice'&&r.state.pendingChoice.guard==='zhodani-government-defence')return r;
  r=run(r,'restore',{revision:before.revision});
 }
 throw Error('No Government defence after public permanent-loss history found.');
}
