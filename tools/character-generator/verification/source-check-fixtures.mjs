import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
export {run};
const cache=new Map();
export function sourceCheckFixture({career='core.citizen',assignment='worker'}={}){
 const key=career+'/'+assignment;if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<100;seed++){
  let r=api({operation:'create',seed:'source-check-'+seed});r=run(r,'setup',{species:career.startsWith('vargr.')?'vargr':'human',gender:'female'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
  for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:12,reason:'Source check regression'});
  r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:career,assignment});
  if(r.state.stage==='career')continue;
  while(r.state.stage==='skill-choice'){const name=r.state.pendingChoice.allowed?.[0];r=run(r,'choose-skill',{name:name==='Profession'?'Profession (construction)':name});}
  if(r.state.stage!=='survival')continue;
  r=run(r,'survival');if(r.log.at(-1).rolls[1]?.label!==(career==='core.citizen'?'Event table':'Mishap table'))continue;
  r=run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:career==='core.citizen'?[1,2]:[career==='core.navy'?3:5],reason:'Source row fixture'});
  assert.equal(r.state.stage,'effect-choice');cache.set(key,r);return structuredClone(r);
 }
 throw Error('No qualifying fixture');
}
