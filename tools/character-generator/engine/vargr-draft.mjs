// Printed outcome labels: Aliens of Charted Space Volume 1 Update 2026 p.186.
// Destination IDs below are bounded interpretation candidates, NOT published errata.
export function vargrDraftLabel(value){return value===1?'Agent':value>=2&&value<=4?'Army':value===5?'Marine':value===6?'Navy':null;}
export function vargrDraftMappings(label,careers){
 const candidates={Agent:[['vargr.agent'],['core.agent']],Army:[['vargr.military','army'],['core.army']],Marine:[['vargr.military','raider'],['core.marine']],Navy:[['vargr.spacer','navy'],['core.navy']]};
 return (candidates[label]??[]).flatMap(([id,assignment])=>{const c=careers.find(c=>c.id===id);return c?c.assignments.filter(a=>!assignment||a.id===assignment).map(a=>({id:c.id+'|'+a.id,careerId:c.id,assignment:a.id,label:c.name+' · '+a.name+' ('+(c.group==='core'?'Core career':'native Vargr')+')',interpretation:c.group==='core'?'literal-Core-destination':'native-equivalent'})):[];});
}
