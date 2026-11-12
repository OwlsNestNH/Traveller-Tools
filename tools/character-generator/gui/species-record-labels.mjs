// UI labels only. Stable record identifiers remain in controls, saves and logs.
export function shareAwardLabel(lot,state){
 const label=lot.label;
 if(label&&!label.includes(lot.id))return label;
 const lots=state.character?.clanShareLots??state.clanShareOptions?.lots??[];
 const index=lots.findIndex(item=>item.id===lot.id);
 return 'Clan Share award'+(index>=0?' '+(index+1):'');
}

const prose=value=>typeof value==='string'&&value.trim()?value:null;
export function readableFutureCondition(condition){
 if(typeof condition==='string')return condition;
 if(!condition||typeof condition!=='object')return 'Future consequence recorded. Review it with your referee.';
 for(const field of ['text','reason','label'])if(prose(condition[field]))return condition[field];
 const effects=condition.effects;
 if(condition.trigger==='expose-secret'&&Array.isArray(effects)&&effects.length===1){
  const effect=effects[0];
  if(effect.kind==='relationship'&&(effect.type??effect.role)==='Enemy'&&effect.count===1&&!effect.dice)return 'If you expose the secret, gain 1 Enemy. This consequence has not been applied yet.';
 }
 return 'A future consequence is recorded. Review it with your referee; its full record is in the Full Log.';
}
export function readableTrait(trait){
 if(typeof trait==='string')return trait;
 if(!trait||typeof trait!=='object')return 'Recorded trait';
 const name=prose(trait.name),description=prose(trait.description)??prose(trait.text);
 return name&&description&&name!==description?name+': '+description:name??description??'Recorded trait; review the Full Log for details.';
}
