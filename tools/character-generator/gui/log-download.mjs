// Keep the complete technical history out of the character presentation.
const value=v=>v===null?'absent':typeof v==='object'?JSON.stringify(v):String(v);
export function fullActionLog(log){
 return log.map(event=>'ACTION '+event.number+' · '+event.summary+'\n'+event.rolls.map(roll=>roll.label+': '+roll.values.join(', ')+'; kept '+roll.kept.join(', ')+'; total '+roll.total).join('\n')+'\n'+(event.changes??[]).map(change=>change.path+': '+value(change.before)+' -> '+value(change.after)).join('\n')).join('\n\n');
}
