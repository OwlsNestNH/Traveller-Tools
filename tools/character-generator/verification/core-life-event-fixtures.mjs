import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
export function run(r,type,payload={},options={}){const next=api({operation:'command',session:r.session,command:{type,payload},...options});assert.equal(next.ok,true,type+': '+next.error?.message);return next;}
export function rejected(r,type,payload={},pattern=/./){const before=exportSession(r.session),next=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(next.ok,false);assert.match(next.error.message,pattern);assert.equal(exportSession(r.session),before);return next;}
export function lifeFixture({row,unusual,seed='audit-1',career='core.citizen',assignment='worker',rulesRevision}={}){
 let r=api({operation:'create',seed});if(rulesRevision)r.session.rulesRevision=rulesRevision;r=run(r,'setup',{species:'human',gender:'female'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:12,reason:'Stable source procedure regression'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:career,assignment});
 while(r.state.stage==='skill-choice'){const name=r.state.pendingChoice.allowed?.[0];r=run(r,'choose-skill',{name:name==='Profession'?'Profession (construction)':name});}
 r=run(r,'survival');const original=r.revision;
 assert.equal(r.log.at(-1).rolls[1]?.total,7,'Seed must roll Event 7');
 if(row!==undefined&&unusual===undefined){r=run(r,'gm-replay',{revision:original,rollIndex:2,values:row<=7?[1,row-1]:[6,row-6],reason:'Exercise a specific life event row'});}
 if(unusual!==undefined){assert.equal(r.log.at(-1).rolls[2]?.total,12,'Seed must roll unusual event');r=run(r,'gm-replay',{revision:r.revision,rollIndex:3,values:[unusual],reason:'Exercise a specific unusual event row'});}
 return r;
}
