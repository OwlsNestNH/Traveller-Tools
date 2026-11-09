// Bounded training awards, Aliens of Charted Space 2026 pp. 189–205.
// Only skill entries count; characteristic increases are not skill awards.
export const VARGR_TRAINING_PAGES = Object.freeze({'vargr.agent':189,'vargr.intermediary':193,'vargr.loner':195,'vargr.merchant':197,'vargr.scientist':203,'vargr.spacer':205});
function names(effects) {
 return effects.flatMap(e=>e.kind==='skill'?[e.name]:e.kind==='choice'?e.options.flatMap(o=>names(o.effects)):[]);
}
export function vargrTrainingChoice({careerId,assignment,pack,eligibleTables,effect}) {
 if(!VARGR_TRAINING_PAGES[careerId]||!['assignment','eligible-career'].includes(effect.scope))return null;
 if((effect.scope==='assignment')!==(careerId==='vargr.loner'))return null;
 const tables=effect.scope==='assignment'?['assignment']:eligibleTables;
 const tableSkills=[...new Set(tables.flatMap(id=>names((id==='assignment'?pack.training.assignments[assignment]:pack.training[id]??[]).flat())))];
 return {...effect,tableSkills,trainingContext:{careerId,assignment,tables:[...tables]},source:{id:'aliens',page:VARGR_TRAINING_PAGES[careerId]},label:'Choose a skill from '+(effect.scope==='assignment'?'your assignment table':'your eligible career tables')};
}
export function tableSkillAllowed(name,tableSkills) {
 return tableSkills.some(entry=>entry===name||!entry.includes(' (')&&name.startsWith(entry+' ('));
}
