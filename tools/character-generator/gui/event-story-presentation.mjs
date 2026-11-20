import {lifeEventIdentity} from './life-event-presentation.mjs';
// Short descriptive headings derived from recorded event narratives, not new rule outcomes.
const headings={'core.army.events:4':'Urban combat','core.entertainer.mishaps:4':'Betrayed by a colleague','core.rogue.mishaps:3':'Criminal betrayal','core.psion.events:3':'Distrust of your powers'};
export function eventStoryIdentity(result,context=[]){
 const identity=lifeEventIdentity(result?.table,result?.row);
 const narrative=result?.description?result:[...context].reverse().find(r=>r.description)??result;
 return {name:identity?.name??headings[narrative?.table+':'+narrative?.row]??narrative?.title??'Event result',label:identity?.title??(result?.title?.startsWith('Event random result')?'Follow-up roll '+result.row:result?.title)??'Recorded event',description:narrative?.description??''};
}
