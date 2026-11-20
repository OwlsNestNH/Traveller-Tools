// Complete event wording supplied by Jay for this informational.
export const ROGUE_MISHAP_THREE_TEXT='Betrayed by a friend. One of your Contacts or Allies betrays you, ending your career. That Contact or Ally becomes a Rival or Enemy. If you have no Contacts or Allies, then you are betrayed by someone you never saw coming and still gain a Rival or Enemy. In addition, roll 2D. If you roll 2, you must take the Prisoner career in your next term.';
// Core Update 2022 pp.23,41; printed source independently checked by parent.
// Presentation of recorded actions only: never rolls or changes character state.
export function undercoverEventProgression(projection,event){
 const events=event.eventResults??[],parent=events.find(r=>r.table==='core.agent.events'&&r.row===8),mishap=events.find(r=>r.table==='core.rogue.mishaps'&&r.row===3),prison=events.at(-1);
 if(!parent||!mishap||prison?.table!==null||!prison?.roll)return null;
 const route=projection.state.character.crossCareerRoutes?.findLast(r=>r.originCareerId==='core.agent'&&r.coverCareerId==='core.rogue'&&r.check?.success===false&&r.tables?.some(t=>t.table==='mishap'&&t.row===3));
 if(!route)return null;
 return [
  {title:'Undercover assignment',label:'Agent event 8 · Core p.23',description:'You go undercover in another career. You chose Rogue as your cover.',total:parent.roll?.total,results:['Cover career: Rogue.']},
  {title:'Your cover fails',label:'Deception check · recorded result',description:'Your undercover Deception check failed, so you had to resolve a mishap from your cover career.',total:route.check.natural,results:['Deception total '+route.check.total+' against '+route.check.target+'+: failed.','Resolve a Rogue mishap.']},
  {title:'Betrayed by a friend',label:'Rogue mishap 3 · Core p.41',description:'A friend betrays you, ending your career. A Contact or Ally turns against you; if you have neither, you gain a new Rival or Enemy.',total:mishap.roll.total,relationshipStep:true,information:ROGUE_MISHAP_THREE_TEXT},
  {title:'Prison check',label:'Rogue mishap 3 · separate 2D check',description:'The betrayal may also send you to prison. Only a total of 2 means imprisonment next term.',information:ROGUE_MISHAP_THREE_TEXT,total:prison.roll.total,results:[prison.roll.total===2?'Prison next term.':'No prison: your roll was '+prison.roll.total+'.']}
 ];
}
