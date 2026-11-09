// Short, original summaries of implemented effects, not reproduced book prose.
const signed=n=>(n>=0?'+':'')+n;
const words=s=>String(s??'').replaceAll('-',' ');
export function careerOutcomeSummary(effects=[]){
 return effects.map(effect=>{
  switch(effect.kind){
   case 'choice':return 'Choose: '+effect.options.map(o=>o.label).join(' or ')+'.';
   case 'skill':return effect.name+(effect.mode==='set'?' at least level '+effect.value:' '+signed(effect.value??1))+'.';
   case 'skill-choice':return 'Choose '+(effect.count??1)+' skill'+((effect.count??1)>1?'s':'')+(effect.allowed?.length?' from '+effect.allowed.join(', '):effect.scope==='existing'?' you already have':'')+'.';
   case 'stat':return effect.name+' '+signed(effect.value)+'.';
   case 'note':return effect.text??effect.note??effect.label??'Record the event note.';
   case 'modifier':return words(effect.target)+' DM '+signed(effect.value)+'.';
   case 'relationship':return 'Gain '+(effect.count??effect.dice??1)+' '+words(effect.type)+'.';
   case 'table-roll':return 'Resolve the '+words(effect.table)+' table.';
   case 'check':return 'Resolve '+(effect.stat??effect.skills?.join(' or ')??'the event check')+' '+effect.target+'+ and its consequences.';
   case 'benefit-rolls':return effect.value!==undefined?signed(effect.value)+' Benefit rolls.':'Resolve the Benefit-roll consequence.';
   case 'career-status':return effect.action==='exit'?'Leave this career as directed by the event.':effect.action==='stay'?'Remain in this career.':'Resolve the career change.';
   case 'source-required':case 'unsupported':return effect.reason??'Consult the source for this outcome.';
   default:return effect.label??effect.reason??'Resolve '+words(effect.kind)+'.';
  }
 }).join(' ');
}
