import {preCareerEventName} from '../shared/precareer-event-presentation.mjs';
// Event text and the table's possible effects are distinct from actual gains below.
export function eventResultDetails(event){
 return (event?.eventResults??[]).flatMap(result=>[
  result.title+(result.table==='core.pre-career-events'&&preCareerEventName(result.row)?' · '+preCareerEventName(result.row):'')+(result.description?': '+result.description:'.'),
  'Roll ['+(result.roll.values??[]).join(', ')+'] = '+result.roll.total+'.',
  'Table outcome: '+result.summary,
  result.source?'Source: '+(result.source.title??result.source.id)+(result.source.pages?.length?' pp. '+result.source.pages.join(', '):result.source.page?' p. '+result.source.page:'')+'.':null
 ]).filter(Boolean);
}

