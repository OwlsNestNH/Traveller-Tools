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
// Statistics mechanics belong in Full Log. Keep the recorded choice, dice and
// final awards here, without consulting today's character or mutating history.
const readableKey=key=>String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ');
function decisionText(value){
 if(Array.isArray(value))return value.length?value.map(decisionText).join('; '):'none';
 if(value&&typeof value==='object')return Object.entries(value).map(([key,item])=>readableKey(key)+': '+decisionText(item)).join('; ');
 return value===true?'yes':value===false?'no':value===null?'none':String(value);
}
// A sanitized generic result title can discard a person's name or a source
// decision. Retain that prose and render embedded JSON as readable fields.
// This is plain text, assigned through textContent by the log viewer.
function choiceSummary(summary){
 let text='',start=0;
 while(start<summary.length){
  const next=summary.slice(start).search(/[\[{]/);
  if(next<0){text+=summary.slice(start);break;}
  const from=start+next;text+=summary.slice(start,from);let parsed=false;
  for(let end=from+1;end<summary.length;end++){
   if(!'}]'.includes(summary[end]))continue;
   try{const value=JSON.parse(summary.slice(from,end+1));text+=decisionText(value);start=end+1;parsed=true;break;}catch{}
  }
  if(!parsed){text+=summary[from];start=from+1;}
 }
 return text;
}
function simpleTitle(event,result){
 if(event.type==='roll-statistics')return event.summary?.startsWith('Rerolled')?'Rerolled statistics.':'Rolled statistics.';
 if(event.type==='accept-statistics')return 'Accepted statistics.';
 if(['swap-statistics','gm-override'].includes(event.type))return (event.summary??'').split(' Optional Aezorgh placement')[0].split(' Final displayed score;')[0];
 const generic=readableKey(event.type)+' result.';
 return event.summary&&(!result?.title||result.title===generic)?choiceSummary(event.summary):result?.title??event.summary;
}
export function simpleActionLog(log){
 return (log??[]).filter(event=>event.rolls?.length||(event.summary&&event.type!=='notes')||['restore','gm-replay'].includes(event.type)).map(event=>{
  if(['enter-physical-statistic','gm-physical-dice'].includes(event.type))return 'Action '+event.number+': '+event.summary;
  if(['restore','gm-replay'].includes(event.type))return 'Action '+event.number+': '+(event.type==='restore'?'GM restored an earlier step.':'GM replaced a roll and replayed an earlier step.')+' See Full Log for retained original and replacement history.';
  const lines=(event.rolls??[]).map(roll=>{
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
  return 'Action '+event.number+'\n'+lines.join('\n')+'\n'+[simpleTitle(event,result),...outcomes,...effects].filter(Boolean).join('\n');
 }).join('\n\n');
}


