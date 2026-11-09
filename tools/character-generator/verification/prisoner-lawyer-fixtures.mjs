import assert from 'node:assert/strict';
import {lifeFixture,run,rejected} from './core-life-event-fixtures.mjs';
export {run,rejected};
export function lawyerFixture({cash=25000,parole,assignment='inmate'}={}){
 let r=lifeFixture({row:11});r=run(r,'resolve-life-event',{confirmed:true,reason:'Sentenced by source crime event.',outcome:'prisoner'});r=run(r,'advancement');
 while(['training','skill-choice','effect-choice'].includes(r.state.stage))r=r.state.stage==='effect-choice'?run(r,'choose-effect',{index:0}):r.state.stage==='training'?run(r,'training',{table:'personal'}):run(r,'choose-skill',{name:r.state.pendingChoice.allowed[0]});
 r=run(r,'leave-career');
 while(r.state.stage==='benefits')r=run(r,'benefit',{cash:true});
 assert.equal(r.state.stage,'career');r=run(r,'career',{id:'core.prisoner',assignment});
 if(parole!==undefined)r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[parole-2],reason:'Exercise a printed initial parole threshold.'});
 while(['training','skill-choice','effect-choice'].includes(r.state.stage))r=r.state.stage==='effect-choice'?run(r,'choose-effect',{index:0}):r.state.stage==='training'?run(r,'training',{table:'personal'}):run(r,'choose-skill',{name:r.state.pendingChoice.allowed[0]});
 r=run(r,'gm-override',{field:'cash',value:cash,reason:'Recorded cash before the lawyer opportunity.'});
 r=run(r,'survival');
 r=run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:[4,5],reason:'Exercise Prisoner Event 9.'});
 assert.equal(r.state.pending?.kind,'prisoner-lawyer');return r;
}
