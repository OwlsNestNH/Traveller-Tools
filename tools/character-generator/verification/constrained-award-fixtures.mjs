import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
export {run};
export function force(r,type,payload,values,rollIndex=0){r=run(r,type,payload);return run(r,'gm-replay',{revision:r.revision,rollIndex,values,reason:'Constrained award source regression'});}
const cache=new Map();
export function awardFixture(career='companion.truther',event=5){
 const key=career+event;if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<100;seed++){
 // These source-award seeds retain the pre-.24 initial-PSI sequence.
 let r=api({operation:'create',seed:'award-source-'+seed});r.session.rulesRevision='character-preview-2026-11-09.23';r=run(r,'setup',{species:career.startsWith('vargr')?'vargr':'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:12,reason:'Stable award regression'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
 if(career.includes('psion')){r=run(r,'add-extra',{id:'PSI'});r=run(r,'gm-override',{field:'stat.PSI',value:15,reason:'Verified psionic potential fixture'});}
 if(career.includes('psion')){
  r=run(r,'begin-psionic-training');r=run(r,'resolve-book',{confirmed:true,note:'Referee confirms training',psionicApproved:true,psionicCost:0,psionicFunding:'provided',psionicTimingConfirmed:true});
  r=run(r,'learn-talent',{talent:'Telepathy'});for(const talent of ['Clairvoyance','Awareness'])r=force(r,'learn-talent',{talent},[6,6]);r=run(r,'finish-psionic-training');
 }
 const assignment=career==='core.psion'?'adept':r.state.careerChoices.find(c=>c.id===career).assignments[0].id;
 r=run(r,'career',{id:career,assignment});if(r.state.stage==='failed-entry')continue;
 while(r.state.stage==='skill-choice')r=run(r,'choose-skill',{name:'Telepathy'});while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});if(r.state.stage!=='survival')continue;
 r=run(r,'survival');if(r.log.at(-1).rolls[1]?.label!=='Event table')continue;r=run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:event<=7?[1,event-1]:[6,event-6],reason:'Source event selection'});
 if(career==='vargr.psion'&&r.state.stage!=='skill-choice')continue;
 if(career==='companion.truther'&&event===9){r=run(r,'choose-effect',{index:0});r=run(r,'choose-effect',{index:2});}
 cache.set(key,r);return structuredClone(r);
 }throw Error('No constrained award fixture '+key);
}
export function coreGenericFixture(){
 let r=awardFixture('core.psion',10);r=force(r,'advancement',{},[1,1]);
 if(r.state.stage!=='term-end')throw Error('Unexpected Core term end '+r.state.stage);
 r=run(r,'continue-career');return force(r,'training',{table:'service'},[6]);
}
