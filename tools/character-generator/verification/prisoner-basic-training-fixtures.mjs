import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {run} from './core-life-event-fixtures.mjs';
export {run};
export function prisonerBasicTrainingFixture(){
 let r=api({operation:'create',seed:'prison-basic-training-22'});
 r=run(r,'configure',{aezorghTwoDice:true});
 r=run(r,'setup',{species:'aezorgh',name:'Training regression',gender:'male'});
 r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:[10,9,10,12,9,7][i],reason:'Stable Aezorgh training regression'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:['Electronics']});r=run(r,'skip-precareer');
 r=run(r,'career',{id:'core.rogue',assignment:'thief'});
 const firstCareer=r;assert.equal(r.state.stage,'survival');
 r=run(r,'survival');assert.equal(r.state.pendingChoice.options[0].label,'Self-represent');
 r=run(r,'choose-effect',{index:0});assert.equal(r.state.character.sentenced,true);
 r=run(r,'leave-career');while(r.state.stage==='benefits')r=run(r,'benefit',{cash:true});
 r=run(r,'career',{id:'core.prisoner',assignment:'fixer'});
 assert.equal(r.state.stage,'effect-choice');assert.equal(r.state.effectNext,'new-career-training');
 return {firstCareer,basic:r};
}
