import {api} from '../engine/session.mjs';
import {run,rejected} from './core-life-event-fixtures.mjs';
export {run,rejected};
const cache=new Map();
export function agentCoverFixture({vargr=false,end=9}={}){
 const key=JSON.stringify({vargr,end});if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<100;seed++){
  let r=api({operation:'create',seed:'cover-'+seed});r=run(r,'setup',{species:vargr?'vargr':'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
  for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===2?end:9,reason:'Undercover source regression'});
  r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');r=run(r,'career',{id:vargr?'vargr.agent':'core.agent',assignment:vargr?'spy':'intelligence'});
  if(r.state.stage!=='survival')continue;r=run(r,'survival');if(r.log.at(-1).rolls[1]?.label!=='Event table')continue;
  r=forceAt(r,r.revision,1,vargr?[3,6]:[2,6]);if(r.state.stage==='cross-career-cover'){cache.set(key,r);return structuredClone(r);}
 }
 throw Error('No undercover fixture');
}
export function forceAt(r,revision,rollIndex,values){return run(r,'gm-replay',{revision,rollIndex,values,reason:'Source-route boundary regression'});}
export function coverResult({vargr=false,careerId=vargr?'vargr.citizen':'core.citizen',success=true,row=5,end=9}={}){
 let pending=agentCoverFixture({vargr,end});
 for(let attempt=0;attempt<100;attempt++){
  let r=run(pending,'cross-career-cover',{careerId});
  if(r.state.character.crossCareerRoutes.at(-1).check.success===success){
   if(!vargr||!success)r=forceAt(r,r.revision,1,success?[Math.max(1,row-6),Math.min(6,row-1)]:[row]);return r;
  }
  pending=run(r,'restore',{revision:pending.revision});
 }
 throw Error('No cover check fixture');
}
export function finishSkill(r){
 const names={Language:'Language (Vilani)',Profession:'Profession (construction)',Electronics:'Electronics (sensors)',Gunner:'Gunner (turret)',Pilot:'Pilot (spacecraft)',Engineer:'Engineer (power)',Science:'Science (physics)','Gun Combat':'Gun Combat (slug)',Flyer:'Flyer (grav)',Melee:'Melee (blade)',Athletics:'Athletics (dexterity)',Animals:'Animals (handling)'};
 while(r.state.stage==='skill-choice'){const base=r.state.pendingChoice.allowed[0];r=run(r,'choose-skill',{name:names[base]??base});}return r;
}
