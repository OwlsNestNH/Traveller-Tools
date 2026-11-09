import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
export {run};
export function trainingFixture({species='human',career='core.drifter',assignment='wanderer',seedStart=0}={}){
 for(let seed=seedStart;seed<seedStart+100;seed++){
  let r=api({operation:'create',seed:'training-information-'+seed});r=run(r,'setup',{species,gender:'male'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
  for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:12,reason:'Training presentation regression'});
  r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:career,assignment});
  for(let step=0;step<12;step++){
   if(r.state.stage==='training')return r;
   if(r.state.stage==='survival')r=run(r,'survival');
   else if(r.state.stage==='advancement')r=run(r,'advancement');
   else if(r.state.stage==='term-end'&&r.state.exitOptions.canContinue)r=run(r,'continue-career');
   else break;
  }
 }
 throw Error('No training presentation fixture');
}
