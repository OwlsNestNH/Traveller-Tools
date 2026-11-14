import {armyRecordedDice} from './career-template.mjs';
import {isSupportStage} from './support-record.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function matches(roll,natural){return roll?.values?.length===2&&roll.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&roll.values.reduce((a,b)=>a+b,0)===roll.total&&roll.total===natural;}
// Read accepted evidence only. Never calculate a new game roll or infer a
// result from a referee note, a replay, or an unchanged historical record.
export function recordedSupportChecks(event,state){
 if(event?.type==='learn-talent'){
  const records=(event.changes??[]).filter(c=>/^psionics\.attempts\.\d+$/.test(c.path)&&c.before==null&&c.after?.automatic!==true);
  if(records.length!==1)return [];const c=records[0].after,label='Acquire '+c.talent,rolls=(event.rolls??[]).filter(r=>r.label===label);
  if(rolls.length!==1||typeof c.talent!=='string'||![c.natural,c.psiDM,c.learningDM,c.previousChecks,c.total,c.target].every(finite)||typeof c.success!=='boolean'||c.total!==c.natural+c.psiDM+c.learningDM-c.previousChecks||c.success!==(c.total>=c.target)||!matches(rolls[0],c.natural))return [];
  return [{kind:'psionic',label,talent:c.talent,level:c.level,natural:c.natural,total:c.total,target:c.target,success:c.success}];
 }
 if(event?.type==='companion-entry'){
  const label='Companion education entry',rolls=(event.rolls??[]).filter(r=>r.label===label);if(rolls.length!==1)return [];
  const indices=[...new Set((event.changes??[]).map(c=>c.path.match(/^educations\.(\d+)\.entry(?:\.|$)/)?.[1]).filter(x=>x!==undefined))];
  if(indices.length===1){
   const index=indices[0],c=state?.character?.educations?.[Number(index)]?.entry,prefix='educations.'+index+'.entry';
   const added=(event.changes??[]).some(x=>x.path===prefix&&x.before==null&&JSON.stringify(x.after)===JSON.stringify(c))||['total','target','success'].every(key=>(event.changes??[]).some(x=>x.path===prefix+'.'+key&&x.before==null&&x.after===c?.[key]));
   if(added&&c?.automatic===false&&[c.roll,c.characteristicDM,c.thresholdModifier,c.speciesModifier,c.total,c.target].every(finite)&&typeof c.success==='boolean'&&c.total===c.roll+c.characteristicDM+c.thresholdModifier+c.speciesModifier&&c.success===(c.total>=c.target)&&matches(rolls[0],c.roll))return [{kind:'admission',label,natural:c.roll,total:c.total,target:c.target,success:c.success}];
  }
  // Failed admission makes no education record. This exact, replay-validated
  // engine summary is the retained target/modified total, not free-form notes.
  const m=event.summary?.match(/^Companion education entry failed: total (-?\d+) against (\d+)\. No term was consumed\.$/);
  if(m&&Number(m[1])<Number(m[2])&&matches(rolls[0],rolls[0].total))return [{kind:'admission',label,natural:rolls[0].total,total:Number(m[1]),target:Number(m[2]),success:false}];
 }
 return [];
}
export function mountSupportDice(document,state,{event,esc,history=[]}){
 if(isSupportStage(state.stage)&&event?.type==='notes')event=history.findLast(e=>e.type!=='notes')??event;
 if(!event?.rolls?.length||!isSupportStage(state.stage)&&event.type!=='companion-entry')return;
 const result=document.getElementById('last-action-result');if(!result)return;
 const html=armyRecordedDice(event,{esc,checks:recordedSupportChecks(event,state)});if(!html)return;
 result.querySelectorAll('.army-recorded-dice').forEach(n=>n.remove());result.insertAdjacentHTML('beforeend',html);
}
