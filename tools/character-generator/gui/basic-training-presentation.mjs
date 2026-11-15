// Read-only presentation of the actual queued training effects. Never infer an
// award from the character's rank, current skill level or a matching name.
export function basicTrainingChoiceModel(state,origin,catalog){
 if(origin?.kind!=='basic-training'||state?.stage!=='effect-choice'||state.pendingChoice?.kind!=='choice'||!state.pendingChoice.options?.length)return null;
 const options=state.pendingChoice.options.map((option,index)=>{
  const effects=option.effects??[],awards=effects.filter(e=>e.kind==='skill'&&Number.isInteger(e.value)&&e.mode==='set');
  const exact=awards.length===effects.length&&awards.length>0,label=option.label??'Training option '+(index+1),single=exact&&awards.length===1&&[awards[0].name,awards[0].name+' at least level '+awards[0].value+'.',awards[0].name+'='+awards[0].value].includes(label);
  return {label:single?awards[0].name+' '+awards[0].value:label,detail:exact&&!single?'Awards '+awards.map(e=>e.name+' '+e.value).join('; '):null,names:awards.map(e=>e.name),levels:exact?awards.map(e=>e.value):null,singleAward:exact&&awards.length===1};
 });
 const levels=options.flatMap(o=>o.levels??[]),fixedLevel=options.every(o=>o.levels)&&new Set(levels).size===1?levels[0]:null;
 return {title:fixedLevel!==null&&options.every(o=>o.singleAward)?'Choose a basic training skill':'Choose a basic training option',career:catalog.careers?.find(c=>c.id===origin.careerId)?.name??origin.careerId,instruction:(fixedLevel!==null?(options.every(o=>o.singleAward)?'Choose one skill at level '+fixedLevel+'.':'Choose one training option. Each listed skill is awarded at level '+fixedLevel+'.'):'Choose one basic training option.')+(state.effectNext==='survival'?' Next phase: survival, after any remaining entry awards.':state.effectNext==='new-career-training'?' Complete remaining entry awards before the regular training roll.':''),fixedLevel,options};
}
export function mountBasicTrainingGuidance(document,model){
 if(!model)return;
 const instruction=document.querySelector('#workspace>.basic-training-instruction'),speech=document.querySelector('#workspace .career-crow-speech');
 if(instruction&&speech){speech.textContent=model.instruction;instruction.remove();}
}
