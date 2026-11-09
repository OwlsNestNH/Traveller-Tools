import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {lifeFixture,run,rejected} from './core-life-event-fixtures.mjs';
import {settleAssignment as settle} from './assignment-fixtures.mjs';
import {aslanSetup} from './aslan-officer-fixtures.mjs';
export {run,rejected};
export function force(r,type,payload,values,index=0){const x=run(r,type,payload);if(!x.log.at(-1).rolls.length)return x;return run(x,'gm-replay',{revision:x.revision,rollIndex:index,values,reason:'Source relationship regression'});}
export function table(r,row,event=false){
 for(let n=0;n<120;n++){
  const before=r.revision,x=run(r,'survival');
  if(x.log.at(-1).rolls[1]?.label===(event?'Event table':'Mishap table'))return run(x,'gm-replay',{revision:x.revision,rollIndex:1,values:event?[Math.max(1,row-6),Math.min(6,row-1)]:[row],reason:'Source relationship row'});
  r=run(x,'restore',{revision:before});
 }
 throw Error('No matching survival branch.');
}
export function relationshipFixture({career='core.entertainer',people=0}={}){
 const aslan=career.startsWith('aslan.');let r;
 if(aslan)r=aslanSetup('relationship-'+career+'-'+people,'male');
 else{
 r=api({operation:'create',seed:'relationship-'+career+'-'+people});r=run(r,'setup',{species:'human',gender:'female'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:8,reason:'Stable relationship source fixture'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
 }
 const assignment={'core.entertainer':'artist','core.drifter':'wanderer','core.rogue':'thief','aslan.outcast':'labourer','aslan.outlaw':'raider'}[career];
 r=settle(force(r,'career',{id:career,assignment},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 for(let i=0;i<people;i++){
  if(aslan||career==='core.entertainer')r=table(r,6,true);
  else if(career==='core.rogue'){r=table(r,6,true);r=run(r,'choose-effect',{index:1});}
  else{
   let found=false;
   for(let n=0;n<120;n++){const before=r.revision,x=run(r,'survival');if(x.log.at(-1).rolls[1]?.label==='Event table'&&x.log.at(-1).rolls[1].total===7){r=run(x,'gm-replay',{revision:x.revision,rollIndex:2,values:[1,6],reason:'Earn a Contact from Core life event seven'});found=true;break;}r=run(x,'restore',{revision:before});}
   assert.ok(found);
  }
  assert.equal(r.state.stage,'advancement');r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));assert.equal(r.state.stage,'term-end');r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));
 }
 r=table(r,{'core.entertainer':4,'core.drifter':5,'core.rogue':3,'aslan.outcast':2,'aslan.outlaw':5}[career]);assert.equal(r.state.stage,'relationship-event');return r;
}

export function psionRelationshipFixture({people=0,event=true}={}){
 let r=lifeFixture({seed:'life-566',unusual:1});r=run(r,'resolve-life-event',{confirmed:true,reason:'Source-provided testing opportunity',outcome:'test',funding:'provided',cost:0,timingConfirmed:true});
 r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));r=run(r,'leave-career');while(r.state.stage==='benefits')r=settle(force(r,'benefit',{cash:true},[1]));
 r=settle(force(r,'career',{id:'core.psion',assignment:'adept'},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 if(r.state.pending?.kind==='psionic-training-terms')r=run(r,'resolve-book',{confirmed:true,note:'Referee approved institute-provided training within the career timeline.',psionicApproved:true,psionicTimingConfirmed:true,psionicFunding:'provided',psionicCost:0});
 if(r.state.stage==='psionic-training'){r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');}
 r=settle(r);if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));

 if(r.state.stage==='career')r=settle(force(r,'career',{id:'core.psion',assignment:'adept'},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 for(let i=0;i<people;i++){r=table(r,6,true);r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));}
 return table(r,event?3:6,event);
}
