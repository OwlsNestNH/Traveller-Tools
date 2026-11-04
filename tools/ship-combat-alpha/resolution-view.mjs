import {nextGunner} from './gunnery.mjs';
import {directFireQueue} from './direct-fire-profile.mjs';
import {missileQueue} from './missiles.mjs';
import {arrivals} from './missile-impact.mjs';

// Presentation only: the two guarded transactions remain in the existing engine.
export function resolutionView(state){
 const workflow=state.workflow;
 if(workflow?.phase!=='attacks'||nextGunner(state))return {available:false,results:[],needsDirect:false,needsImpacts:false,manual:false};
 const record=state.combatHistory?.find(item=>item.id===workflow.resolutionId)??null;
 const impact=state.missileCombat?.impacts.find(item=>item.round===state.round)??null;
 const needsDirect=!record&&(directFireQueue(state).length+missileQueue(state).length+arrivals(state).length)>0;
 const needsImpacts=!!record&&arrivals(state).length>0&&!impact;
 const manual=!!record&&((record.pending??[]).some(item=>item.action==='attack')||record.results.some(item=>item.status==='manual')||impact?.results.some(item=>item.status==='manual'));
 return {available:true,record,impact,results:[...(record?.results??[]),...(impact?.results??[])],needsDirect,needsImpacts,manual};
}
