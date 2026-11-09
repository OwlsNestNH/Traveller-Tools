import {api} from '../engine/session.mjs';
import {aslanSetup,aslanEvent,force,settle} from './aslan-officer-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
export function military(){let r=aslanSetup('aslan-military-skill-check');r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));return aslanEvent(r,5);}
let packCache;
export function pack(){
 if(packCache)return structuredClone(packCache);
 for(let seed=0;seed<1500;seed++){
  let r=api({operation:'create',seed:'pack-source-'+seed});r=run(r,'setup',{species:'vargr'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=settle(run(r,'career',{id:'vargr.loner',assignment:'wanderer'}));if(r.state.stage!=='survival')continue;r=run(r,'survival');
  if(r.state.stage==='effect-choice'&&JSON.stringify(r.state.pendingChoice.options.map(x=>x.label))===JSON.stringify(['Leadership','CHA'])){packCache=r;return structuredClone(r);}
 }
 throw Error('No public pack leadership fixture found.');
}
