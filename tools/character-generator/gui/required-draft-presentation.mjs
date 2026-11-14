// Display filtering only. The engine's existing eligibility and fixed result
// remain authoritative. A six-faced die need not mean six distinct careers.
export function requiredDraftPresentation(state){
 if(state.stage!=='career'||!state.forcedCareerDraft||typeof state.forcedCareer!=='string'||state.forcedCareer==='draft')return null;
 const record=state.character.educations?.findLast(e=>e.completed&&e.event===11&&['core.university','core.academy-army','core.academy-marine','core.academy-navy'].includes(e.id));
 const ids=['core.army','core.marine','core.navy'];if(!record||!ids.includes(state.forcedCareer))return {requiredId:state.forcedCareer,ids:null};
 return {requiredId:state.forcedCareer,ids,source:{id:'core',page:17},term:state.character.terms+1};
}
export function requiredDraftChoices(state,ordinary){const model=requiredDraftPresentation(state);if(!model)return ordinary;const enabled=state.careerChoices.filter(c=>!c.disabled);if(enabled.some(c=>c.id!==model.requiredId))return ordinary;return state.careerChoices.filter(c=>model.ids?model.ids.includes(c.id):c.id===model.requiredId);}
export function requiredDraftResult(projection,session,currentActions){
 const state=projection.state,model=requiredDraftPresentation(state);if(!model?.ids)return null;
 for(const event of [...projection.log].reverse()){
  if(!currentActions.has(event.number))continue;let command=session.events[event.number-1]?.command;
  for(let depth=0;command?.type==='gm-replay'&&depth<session.events.length;depth++)command=session.events[command.payload.revision-1]?.command;
  if(!['choose-effect','roll-education-event-step'].includes(command?.type)||!(event.eventResults??[]).some(r=>r.table==='core.pre-career-events'&&r.row===11))continue;
  const rolls=event.rolls??[],roll=rolls[0];if(rolls.length!==1||roll.label!=='Event random result (1D)'||roll.values?.length!==1||!Number.isInteger(roll.values[0])||roll.values[0]<1||roll.values[0]>6||roll.total!==roll.values[0]||(roll.modifier??0)!==0)return null;
  const destination=roll.total<=3?'core.army':roll.total<=5?'core.marine':'core.navy';if(destination!==model.requiredId)return null;
  const name=state.careerChoices.find(c=>c.id===destination)?.name??destination,title='Drafted into '+name+' · term '+model.term,details=['Your education term ended without graduation. Select '+name+' to choose your specialty.'];
  return {event,result:{title,status:'failure',details,text:[title,...details].join(' '),compact:true,information:{title:'Your military draft result',label:'About this draft result',contextual:true,retainCrow:true,paragraphs:['Core Rulebook Update 2022 · p. 17. This education event uses Army (1–3), Marine (4–5) and Navy (6). The ordinary six-career draft table is separate.',event.summary,...(event.eventResults??[]).filter(r=>r.table==='core.pre-career-events'&&r.row===11).map(r=>r.summary)]}}};
 }
 return null;
}
