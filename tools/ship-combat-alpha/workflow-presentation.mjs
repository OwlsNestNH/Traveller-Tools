// Read-only presentation of the existing workflow; no new phase or turn state.
import {nextGunner} from './gunnery.mjs';
export function workflowPresentation(state,selected){
 const phase=state.workflow?.phase,order=phase==='thrust'?state.acceleration?.order:phase==='attacks'?state.workflow.gunnery.order:[],current=phase==='thrust'?order?.[state.acceleration.declared.length]:phase==='attacks'?nextGunner(state):null;
 const index=order?.indexOf(current)??-1;
 return {phase:phase==='thrust'||phase==='movement'?'Manoeuvre':phase==='attacks'?'Attack':phase==='crew'?'Actions':'Setup',step:phase==='thrust'?'Plot ships':phase==='movement'?'Move all ships':phase==='attacks'?(current?'Declare attacks':'Resolve attacks'):phase==='crew'?'Crew stations':'Captain initiative',current,next:current?order[index+1]??null:null,selected};
}
// Manual entries are free text. Only known spelling aliases are coalesced;
// hit history is never counted as additional current damage.
const key=value=>String(value).trim().toLowerCase().replace(/[\s-]+/g,' ');
const aliases={'m drive':'manoeuvre drive','maneuver drive':'manoeuvre drive','manoeuver drive':'manoeuvre drive','j drive':'jump drive','power':'power plant'};
export function criticalSummary(ship,condition=ship.condition){
 const systems=new Set(),canonical=value=>aliases[key(value)]??key(value);
 for(const [system,severity] of Object.entries(ship.combatDamage?.severities??{}))if(severity>0)systems.add(canonical(system));
 for(const record of condition.criticals??[])if(record.status!=='resolved')systems.add(canonical(record.system));
 return {count:systems.size,unknown:condition.criticals==null};
}
