// Derived presentation evidence. Nothing in these maps is a rule, saved field,
// characteristic change, or random draw. Replay rebuilds it from its producers.
const origins=new WeakMap(),applied=new WeakMap();
const object=value=>value!==null&&typeof value==='object';

export function inheritAwardOrigin(from,to){
 const origin=object(from)&&origins.get(from);
 if(origin&&object(to))origins.set(to,origin);
 return to;
}
export function copyWithAwardProvenance(value){
 const clone=structuredClone(value),seen=new WeakSet();
 function transfer(from,to){
  if(!object(from)||!object(to)||seen.has(from))return;
  seen.add(from);inheritAwardOrigin(from,to);
  for(const key of Object.keys(from))transfer(from[key],to[key]);
 }
 transfer(value,clone);return clone;
}
export function markAwardEffects(effects,origin){
 const evidence=Object.freeze(structuredClone(origin));
 function mark(value){
  if(!object(value))return;
  if(typeof value.kind==='string')origins.set(value,evidence);
  for(const child of Object.values(value))mark(child);
 }
 mark(effects);return effects;
}
export function awardOrigin(effect){return object(effect)?origins.get(effect)??null:null;}
export function beginAwardAction(state){applied.set(state,[]);}
export function recordSkillAward(state,effect,name,before,after){
 const origin=awardOrigin(effect);if(!origin)return;
 const entries=applied.get(state);if(!entries)return;
 entries.push({origin:structuredClone(origin),name,before:before??null,after,mode:effect.mode??'increase',value:effect.value??1,changed:before!==after});
}
export function appliedSkillAwards(state){return structuredClone(applied.get(state)??[]);}
