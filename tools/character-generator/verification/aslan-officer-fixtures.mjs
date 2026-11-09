import {settleOrigin} from './aslan-origin-fixtures.mjs';

import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {findCareer} from '../engine/catalog.mjs';
import {run,force,rejected} from './zhodani-reeducation-fixtures.mjs';
import {settleAssignment as settle} from './assignment-fixtures.mjs';
export {run,force,rejected,settle};
const cache=new Map();
export function aslanSetup(seed='aslan-officer',gender='male',riteShares=false,config={}){
 let r=api({operation:'create',seed});r=run(r,'setup',{species:'aslan',gender});if(Object.keys(config).length)r=run(r,'configure',config);r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:8,reason:'Officer opportunity source fixture'});
 r=run(r,'accept-statistics');r=settleOrigin(r,{riteDice:riteShares?[1,1]:[2,3]});assert.equal(r.state.stage,'precareer');return run(r,'skip-precareer');
}
export function aslanEvent(r,result){
 for(let n=0;n<40;n++){const before=r.revision,x=run(r,'survival');if(x.log.at(-1).rolls[1]?.label==='Event table')return run(x,'gm-replay',{revision:x.revision,rollIndex:1,values:[Math.max(1,result-6),Math.min(6,result-1)],reason:'Aslan source officer event'});r=run(x,'restore',{revision:before});}
 throw Error('Could not find a surviving Aslan fixture term.');
}
export function aslanEndTerm(r,values=[4,5]){
 r=settle(force(r,'advancement',{},values));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));if(r.state.stage==='ageing')r=settle(force(r,'ageing',{},[6,6]));assert.equal(r.state.stage,'term-end');return r;
}
export function aslanBenefits(r){while(r.state.stage==='benefits')r=settle(force(r,'benefit',{cash:false},[1]));return r;}
export function buildAslanOfficerFixture({origin='military',gender='male',termsBefore=0,eventResult=10,forcedStay=false,forcedExit=false,riteShares=false,ready=false,assignment,historical=false}={}){
 const key=JSON.stringify({origin,gender,termsBefore,eventResult,forcedStay,forcedExit,riteShares,ready,assignment,historical});if(cache.has(key))return structuredClone(cache.get(key));
 let r=aslanSetup('officer-'+origin+'-'+gender+'-'+termsBefore,gender,riteShares),careerId='aslan.'+origin,from=origin==='military'?(gender==='male'?'warrior':'support'):(gender==='male'?'gunner':'engineer');
 if(historical){r=buildAslanRestorationFixture({gender});r=run(r,'resolve-aslan-restoration',{accept:true,originalSOC:8,originalSOCConfirmed:true,statusTiming:'on-successful-entry',reason:'Verified initial family SOC8 and the source-earned next-term restoration.'});r=aslanEndTerm(settle(r));r=aslanBenefits(run(r,'leave-career'));}
 r=settle(force(r,'career',{id:careerId,assignment:from},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 for(let i=0;i<termsBefore;i++){r=aslanEndTerm(settle(aslanEvent(r,8)));r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));}
 r=settle(aslanEvent(r,eventResult));assert.equal(r.state.character.aslanOfficerOffers.length,1);assert.equal(r.state.stage,'advancement');
 if(forcedExit){const stat=findCareer(careerId).assignments.find(a=>a.id===from).advancement.stat;r=run(r,'gm-override',{field:'stat.'+stat,value:3,reason:'Low advancement characteristic for a source-earned discharge'});}
 r=aslanEndTerm(r,forcedStay?[6,6]:forcedExit?[1,1]:[4,5]);
 if(forcedExit)assert.equal(r.state.character.careers.at(-1).forcedExit,true);
 if(ready){const offer=r.state.aslanOfficerOptions[0],selected=assignment??offer.assignments.find(a=>a.available).id;r=aslanBenefits(run(r,'begin-aslan-officer',{offerId:offer.id,assignment:selected}));assert.equal(r.state.stage,'aslan-officer-entry');}
 cache.set(key,structuredClone(r));return r;
}

export function buildAslanRestorationFixture({gender='male',voluntary=false,seed='aslan-earned-restoration'}={}){
 let r=aslanSetup(seed,gender,true);
 if(voluntary)r=settle(run(r,'career',{id:'aslan.outcast',assignment:'labourer'}));
 else{r=force(r,'career',{id:'aslan.military-officer',assignment:gender==='male'?'leader':'executive'},[1,1]);assert.equal(r.state.stage,'failed-entry');r=settle(run(r,'fallback',{draft:false}));}
 assert.equal(r.state.character.outcast,true);r=settle(aslanEvent(r,11));assert.equal(r.state.pending.kind,'aslan-restoration');return r;
}

export function buildAslanOutlawRestorationFixture({gender='male',boons=0,age=null}={}){
 let r=aslanSetup('aslan-outlaw-restoration-'+gender,gender,true,boons?{boons}:{});
 r=force(r,'career',{id:'aslan.military-officer',assignment:gender==='male'?'leader':'executive'},[1,1]);r=settle(run(r,'fallback',{draft:false}));
 r=aslanBenefits(run(aslanEndTerm(settle(aslanEvent(r,6))),'leave-career'));
 r=settle(force(r,'career',{id:'aslan.outlaw',assignment:'raider'},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 if(age!==null)r=run(r,'gm-override',{field:'age',value:age,reason:'Source restoration ageing boundary fixture'});
 r=settle(aslanEvent(r,11));assert.equal(r.state.pending.kind,'aslan-outlaw-restoration');return r;
}
