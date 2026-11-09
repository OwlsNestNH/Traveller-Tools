// Read-only labels in the implemented table order. Never copy rule prose or dice weights.
export function trainingInformation(rows,conditionMatches=()=>null){
 const skills=new Set(),characteristics=new Set(),other=new Set();
 function visit(effects){for(const effect of effects??[]){
  if(effect.kind==='skill'||effect.kind==='psionic-talent')skills.add(effect.name);
  else if(effect.kind==='stat')characteristics.add(effect.name);
  else if(effect.kind==='choice')for(const option of effect.options??[])visit(option.effects);
  else if(effect.kind==='conditional'){
   const matches=conditionMatches(effect.condition);
   if(matches!==false)visit(effect.then);
   if(matches!==true)visit(effect.otherwise);
  }else if(effect.kind==='skill-choice'){
   if(effect.allowed?.length)effect.allowed.forEach(name=>skills.add(name));
   else other.add(effect.scope==='psionic-talents'?'Psionic talent choice':'Skill choice');
  }else if(effect.kind==='independence')other.add('Independence');
  else other.add('Source-assisted outcome');
 }}
 for(const row of rows??[])visit(row);
 function rowLabels(effects){return (effects??[]).flatMap(effect=>{
  if(effect.kind==='skill'||effect.kind==='psionic-talent')return [effect.name];
  if(effect.kind==='stat')return [effect.name+(typeof effect.value==='number'?' '+(effect.value>=0?'+':'')+effect.value:'')];
  if(effect.kind==='choice')return [(effect.options??[]).map(option=>rowLabels(option.effects).join(', ')).filter(Boolean).join(' or ')];
  if(effect.kind==='conditional'){
   const matches=conditionMatches(effect.condition);
   return matches===true?rowLabels(effect.then):matches===false?rowLabels(effect.otherwise):[...rowLabels(effect.then),...rowLabels(effect.otherwise)].filter(Boolean).join(' or ');
  }
  if(effect.kind==='skill-choice')return [effect.allowed?.length?'Choose '+effect.allowed.join(' or '):effect.scope==='psionic-talents'?'Psionic talent choice':'Skill choice'];
  return [effect.kind==='independence'?'Independence':'Source-assisted outcome'];
 });}
 const entries=(rows??[]).map(row=>rowLabels(row).filter(Boolean).join(', ')||'No listed skill or characteristic change');
 const sorted=values=>[...values].sort((a,b)=>a.localeCompare(b,'en'));
 return {skills:sorted(skills),characteristics:sorted(characteristics),other:sorted(other),entries};
}
