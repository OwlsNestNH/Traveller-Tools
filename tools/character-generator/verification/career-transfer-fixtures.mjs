import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
// These fixtures use only public commands, normal seeded dice, and audited GM replay/overrides.
function run(r,type,payload={},options={}){
 const result=api({operation:'command',session:r.session,command:{type,payload},...options});
 assert.equal(result.ok,true,type+': '+result.error?.message);return result;
}
function rejected(r,type,payload={},pattern=/./){
 const before=exportSession(r.session),result=api({operation:'command',session:r.session,command:{type,payload}});
 assert.equal(result.ok,false);assert.match(result.error.message,pattern);assert.equal(exportSession(r.session),before);return result;
}
function force(r,type,payload,values,index=0){
 const rolled=run(r,type,payload);if(type==='career'&&rolled.log.at(-1).rolls.length===0)return rolled;
 if(type==='survival')assert.equal(rolled.log.at(-1).rolls[index]?.label,'Event table','Fixture seed must survive before event replay.');
 return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Source-grounded transfer regression fixture'});
}
const specialties={'Gun Combat':'slug','Melee':'blade','Heavy Weapons':'man portable','Athletics':'dexterity','Electronics':'computers','Drive':'wheel','Flyer':'grav','Pilot':'spacecraft','Engineer':'power','Science':'physics','Profession':'construction'};
function settle(r){
 for(let i=0;i<20;i++){
  if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
  else if(r.state.stage==='skill-choice'){
   const name=r.state.pendingChoice.allowed?.[0]??r.state.pendingChoice.names?.[0];
   assert.ok(name,'Fixture needs an explicit skill scope.');
   r=run(r,'choose-skill',{name:specialties[name]?name+' ('+specialties[name]+')':name});
  }else return r;
 }
 throw new Error('Fixture exceeded bounded choices.');
}
function setup(species,seed){
 let r=api({operation:'create',seed});r=run(r,'setup',{species});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5&&species==='zhodani'?10:15,reason:'Fixed transfer characteristics'});
 r=run(r,'accept-statistics');
 if(species==='zhodani'){r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'Fixed transfer talent requirement'});}
 if(r.state.stage==='background')r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 return run(r,'skip-precareer');
}
const paths={
 'zhodani.army-guard':{from:'zhodani.army',assignment:'support',event:[2,3],target:'zhodani.guard',targetAssignment:'support'},
 'zhodani.guard-agent':{from:'zhodani.guard',assignment:'support',event:[2,3],target:'zhodani.agent',targetAssignment:'tavrchedl'},
 'zhodani.merchant-navy':{from:'zhodani.merchant',assignment:'broker',event:[1,2],target:'zhodani.navy',targetAssignment:'crew'},
 'vargr.loner-spacer':{from:'vargr.loner',assignment:'wanderer',event:[3,3],target:'vargr.spacer',targetAssignment:'corsair'}
};
export function buildTransferFixture(ruleId,{commission=false,seed=0,beforeBenefits=false}={}){
 const path=paths[ruleId];let r=setup(ruleId.startsWith('vargr')?'vargr':'zhodani','transfer-'+ruleId+'-'+seed);
 r=settle(force(r,'career',{id:path.from,assignment:path.assignment},[6,6]));
 if(ruleId!=='vargr.loner-spacer'){
  r=settle(force(r,'survival',{},[5,6],1));
  r=settle(run(r,commission?'commission':'advancement'));
  if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[3]));
  assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].rank,1);
  r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[3]));
 }
 r=settle(force(r,'survival',{},path.event,1));
 if(ruleId==='vargr.loner-spacer'){
  assert.ok(r.state.character.careerTransfers?.length,'The seeded CHA offer check must succeed.');
  r=settle(force(r,'advancement',{},[4,5]));
  if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 }
 assert.equal(r.state.stage,'term-end');
 if(beforeBenefits)return r;
 r=run(r,'leave-career');
 while(r.state.stage==='benefits')r=run(r,'benefit',{cash:true});
 assert.equal(r.state.stage,'career');return r;
}
function fixture(ruleId,options={}){
 // Only input-seed selection is retried, never an unlogged state mutation.
 for(let seed=0;seed<20;seed++){
  try{return buildTransferFixture(ruleId,{...options,seed});}catch(error){
   if(!/Fixture seed must survive|seeded CHA offer check/.test(error.message))throw error;
  }
 }
 throw new Error('No public seeded transfer fixture found.');
}

export {run,rejected,force,settle,fixture};
