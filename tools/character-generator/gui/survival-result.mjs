// Display only: read the validated check, actual table roll and current modifiers.
// Do not change the detailed log, saved summaries, dice or rules.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function survivalResult(event,state={}){
 if(!event||typeof event.summary!=='string')return null;
 if(event.summary==='Survival check requires source resolution for the absent characteristic.')return {title:'Survival needs source resolution.',details:['No survival result yet.'],text:'Survival needs source resolution. No survival result yet.',status:'pending'};
 const match=event.summary.match(event.type==='gm-replay'?/\bSurvival: (\{[^{}]*\})\.$/:/^Survival: (\{[^{}]*\})\.$/);if(!match)return null;
 let check;try{check=JSON.parse(match[1]);}catch{return null;}
 if(!check||Array.isArray(check)||typeof check.success!=='boolean'||!finite(check.total)||!finite(check.target))return null;
 const title=check.success?'Survival succeeded.':'Survival failed.';
 const details=['Check total '+check.total+' against target '+check.target+'+.'];
 const roll=event.rolls?.find(r=>r.label===(check.success?'Event table':'Mishap table'));
 if(roll&&Number.isInteger(roll.total)&&roll.total>=(check.success?2:1)&&roll.total<=(check.success?12:6))details.push((check.success?'Career event':'Mishap')+' rolled: '+roll.total+'.');
 for(const change of event.changes??[])if(/^historyNotes\.\d+$/.test(change.path)&&typeof change.after==='string'&&change.after!==change.before)details.push(change.after);
 // This is the available total, not a claim that every modifier came from this event.
 if(check.success&&state.stage==='advancement'){
  const careerId=state.character?.careers?.[state.active]?.id;
  const modifiers=careerId?(state.modifiers??[]).filter(m=>m.target==='advancement'&&(m.careerId==='any'||m.careerId===careerId)&&finite(m.value)):[];
  const modifier=modifiers.reduce((sum,m)=>sum+m.value,0);
  if(modifier)details.push('Available advancement DM: '+(modifier>0?'+':'')+modifier+'.');
 }
 return {title,details,text:[title,...details].join(' '),status:check.success?'success':'failure'};
}
