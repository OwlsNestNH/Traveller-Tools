import {rollResult,characterEffectDetails} from './roll-result-view.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const signed=n=>(n>=0?'+':'')+n;
const primary={career:'Qualification','change-assignment':'Assignment qualification',survival:'Survival','survival-check':'Survival',advancement:'Advancement',commission:'Commission','preterm-commission':'Education commission',precareer:'Education entry','companion-entry':'Companion education entry','education-graduation':'Graduation'};
// Link only known engine summaries to their named roll. Never read a current
// character's modifiers as if they had applied to an earlier roll.
function checkFor(event,roll){
 const summary=event.summary??'';
 if(primary[event.type]===roll.label){
  const json=summary.match(/: (\{.*\})(?:\.|$)/);
  if(json){try{const check=JSON.parse(json[1]);if(finite(check.total)&&typeof check.success==='boolean'&&(!finite(check.natural)||check.natural===roll.total))return check;}catch{}}
  const numeric=summary.match(/(?:modified total|total) (-?\d+) against (-?\d+)/);
  if(numeric)return {total:+numeric[1],target:+numeric[2],success:+numeric[1]>=+numeric[2]};
 }
 if(event.type==='education-check'&&roll.label.startsWith('Education skill check: ')){
  const m=summary.match(/^Education .+ check (-?\d+) against (-?\d+)\.$/);if(m)return {total:+m[1],target:+m[2],success:+m[1]>=+m[2]};
 }
 if(event.type==='learn-talent'&&roll.label.startsWith('Acquire ')){
  const m=summary.match(/^Psionic acquisition .+: (-?\d+) against 8;/);if(m)return {total:+m[1],target:8,success:+m[1]>=8};
 }
 if(event.type==='prisoner-escape'&&roll.label==='Skill check'){
  const m=summary.match(/^Prisoner escape using (?:Stealth|Deception): (-?\d+) against 10\+;/);if(m)return {total:+m[1],target:10,success:+m[1]>=10};
 }
 if(event.type==='benefit'&&/^(Cash benefit|Material benefit|Repeated ship: material benefit)(?: \(|$)/.test(roll.label)){
  const m=summary.match(/^Rolled (?:cash|material) benefit -?\d+ \(DM (-?\d+)\)\./);if(m)return {total:roll.total+Number(m[1])};
 }
 if(event.type==='training'&&roll.label.startsWith('Training: ')&&roll===event.rolls.filter(r=>r.label.startsWith('Training: ')).at(-1)){
  const m=summary.match(/^Training .+ result (-?\d+)\.$/);if(m)return {total:+m[1]};
 }
 return null;
}
export function simpleActionLog(log){
 return (log??[]).filter(event=>event.rolls?.length||['restore','gm-replay','enter-physical-statistic','gm-physical-dice'].includes(event.type)).map(event=>{
  if(['enter-physical-statistic','gm-physical-dice'].includes(event.type))return 'Action '+event.number+': '+event.summary;
  if(['restore','gm-replay'].includes(event.type))return 'Action '+event.number+': '+(event.type==='restore'?'GM restored an earlier step.':'GM replaced a roll and replayed an earlier step.')+' See Full Log for retained original and replacement history.';
  const lines=event.rolls.map(roll=>{
   const check=checkFor(event,roll),kept=roll.kept??roll.values??[],raw=kept.reduce((a,b)=>a+b,0);
   const selection=JSON.stringify(kept)!==JSON.stringify(roll.values)?' → kept/converted ['+kept.join(', ')+']':'';
   let text=roll.label+': ['+(roll.values??[]).join(', ')+']'+selection;
   if(check){
    text+='; DM '+signed(check.total-raw);
    if(finite(check.dm)&&finite(check.modifier))text+=' ('+(check.stat??'characteristic')+' '+signed(check.dm)+', other '+signed(check.modifier)+')';
    return text+' = '+check.total+(finite(check.target)?' vs '+check.target+'+':'')+(typeof check.success==='boolean'?'; '+(check.success?'success':'failure'):'')+'.';
   }
   // Mechanical expressions explicitly record modifiers. Ordinary raw totals
   // do not prove DM 0, so do not invent it for unstructured historical checks.
   text+=(finite(roll.modifier)?'; DM '+signed(roll.modifier):'')+' = '+roll.total;
   return text+'.';
  });
  const result=rollResult(event,{},{});
  const outcomes=(event.eventResults??[]).map(r=>r.title+(r.summary?': '+r.summary:''));
  const effects=characterEffectDetails({...event,changes:(event.changes??[]).filter(c=>/^(skills\.|stats\.|cash$|debt$|benefits\.\d+$|assets\.\d+$)/.test(c.path))},{});
  return 'Action '+event.number+'\n'+lines.join('\n')+'\n'+[result?.title,...outcomes,...effects].filter(Boolean).join('\n');
 }).join('\n\n');
}


