import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
export {run};
const cache=new Map();
export function sourceTrainingFixture({navy=true,advanced=false,nestedMishap=false,assignment=navy?'crew':'corporate'}={}){
 const key=JSON.stringify({navy,advanced,nestedMishap,assignment});if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<500;seed++){
  let r=api({operation:'create',seed:'source-training-'+seed});r=run(r,'setup',{species:navy?'human':'vargr'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
  for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:advanced?12:7,reason:'Source training regression characteristics'});
  r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:navy?'core.navy':'vargr.citizen',assignment});
  if(r.state.stage!=='survival')continue;
  r=run(r,'survival');
  if(navy&&!!r.state.character.careers[0].mishap!==nestedMishap&&r.state.pendingChoice?.options?.[0]?.label==='Responsible'||!navy&&r.state.character.sourceTraining?.length){cache.set(key,r);return structuredClone(r);}
 }
 throw Error('No source training fixture: '+key);
}
