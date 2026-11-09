// Read-only presentation metadata. Never expose row order, dice, weights or effects.
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
 const sorted=values=>[...values].sort((a,b)=>a.localeCompare(b,'en'));
 return {skills:sorted(skills),characteristics:sorted(characteristics),other:sorted(other)};
}
