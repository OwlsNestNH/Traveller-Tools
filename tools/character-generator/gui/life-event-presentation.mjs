// Presentation only: identities and choice descriptions never alter the replayed rules.
// Good Fortune's Vargr title is verified against Aliens 2026, p. 206.
const tables={
 'core.life-events':'Core Life Event','core.unusual-events':'Core Unusual Event',
 'vargr.life-events':'Vargr Life Event','vargr.unusual-events':'Vargr Unusual Event',
 'vargr.pack-events':'Vargr Pack Event','aslan.life-events':'Aslan Life Event',
 'aslan.unusual-events':'Aslan Unusual Event','zhodani.life-events':'Zhodani Life Event',
 'zhodani.unusual-events':'Zhodani Unusual Event'
};
// Core titles verified against Core Rulebook Update 2022, p. 46.
const names={
 'vargr.life-events':{10:'Good Fortune'},
 'core.life-events':{2:'Sickness or Injury',3:'Birth or Death',4:'Ending of Relationship',5:'Improved Relationship',6:'New Relationship',7:'New Contact',8:'Betrayal',9:'Travel',10:'Good Fortune',11:'Crime',12:'Unusual Event'},
 'core.unusual-events':{1:'Psionics',2:'Aliens',3:'Alien Artefact',4:'Amnesia',5:'Contact with Government',6:'Ancient Technology'}
};
export function lifeEventIdentity(table,row){
 if(!tables[table]||!Number.isInteger(row))return null;
 const name=names[table]?.[row];
 return {table,row,...(name?{name}:{}),title:tables[table]+' '+row+(name?': '+name:'')};
}
export function lifeEventRollLabels(rolls=[]){return rolls.map(roll=>lifeEventIdentity(roll.label?.replace(/ \(.*\)$/, ''),roll.total)?.title).filter(Boolean);}
function rolledEvents(rolls=[]){return rolls.map(roll=>lifeEventIdentity(roll.label?.replace(/ \(.*\)$/, ''),roll.total)).filter(Boolean);}
export function lifeEventLogDetails(event){
 const presentation=event.lifeEventPresentation;
 return [...(presentation?.results??rolledEvents(event.rolls)).map(result=>result.title),...(presentation?.choice?[presentation.choice.title+': '+presentation.choice.effect]:[])];
}
