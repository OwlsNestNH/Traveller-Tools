// Informational only. Exact skill records are evidence, never new awards.
export function recordedSkillKnowledge(name,skills={}){
 if(typeof name!=='string')return [];
 return Object.entries(skills).filter(([held,level])=>Number.isInteger(level)&&level>=0&&(held===name||!name.includes(' (')&&held.startsWith(name+' (')&&held.endsWith(')'))).map(([held,level])=>held+' '+level);
}
export function knownSkillOptions(options,skills={}){
 return [...new Set((options??[]).flatMap(name=>recordedSkillKnowledge(name,skills)))];
}
export function skillKnowledgeLabel(name,skills={}){
 const known=recordedSkillKnowledge(name,skills);return name+(known.length?' — already known: '+known.join('; '):'');
}
