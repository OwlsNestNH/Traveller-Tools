import assert from 'node:assert/strict';
import {lifeFixture,run} from './core-life-event-fixtures.mjs';
import {merchantTrainingFixture} from './vargr-training-fixtures.mjs';
function event(vargr=false,row=5){let r=vargr?merchantTrainingFixture():lifeFixture();if(vargr)r=run(r,'gm-mode',{enabled:true});const revision=r.log.findLast(x=>x.command?.type==='survival')?.revision??(vargr?r.revision-1:r.revision);return run(r,'gm-replay',{revision,rollIndex:1,values:[1,row-1],reason:'Verified optional benefit event'});}
export function settle(r){for(let n=0;n<20;n++){if(r.state.stage==='training')r=run(r,'training',{table:'personal'});else if(r.state.stage==='skill-choice'){let name=r.state.pendingChoice.allowed?.[0]??'Admin';if(name==='Profession')name='Profession (construction)';r=run(r,'choose-skill',{name});}else return r;}throw Error('Unsettled fixture');}
export function optionalBenefitFixture(vargr=false){let r=event(vargr,vargr?4:5);r=settle(run(r,'advancement'));assert.equal(r.state.stage,'term-end');r=run(r,'leave-career');assert.equal(r.state.stage,'benefits');return r;}
