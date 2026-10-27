// Companion 2024 pp.174–175 / Core 2022 pp.165–166.
// Phase acknowledgements do not resolve attacks or crew actions.
export const PHASES=Object.freeze(['thrust','movement','attacks','crew']);
export const PHASE_LABELS=Object.freeze({thrust:'Thrust',movement:'Movement',attacks:'Attacks',crew:'Crew Actions'});
export function normalizeWorkflow(value,ships,acceleration){
 if(value==null)return null;
 if(value.version!==1||!PHASES.includes(value.phase)||!Array.isArray(value.initiatives)||value.initiatives.length!==ships.length||!ships.length)throw Error('Invalid battle workflow.');
 const ids=new Set();
 const initiatives=value.initiatives.map(entry=>{const ship=ships.find(s=>s.id===entry.shipId);if(!ship||ids.has(ship.id)||!Number.isSafeInteger(entry.initiative)||entry.initiative!==ship.flight.initiative||entry.tie!==ship.flight.tie)throw Error('Battle initiative must match its confirmed ship record.');ids.add(ship.id);return {shipId:ship.id,initiative:entry.initiative,tie:entry.tie};});
 if(['thrust','movement'].includes(value.phase)){
  if(!acceleration||(value.phase==='movement')!==(acceleration.declared.length===ships.length))throw Error('Workflow and acceleration declarations disagree.');
 }else if(acceleration)throw Error('Movement must finish before attacks or crew actions.');
 return {version:1,phase:value.phase,initiatives};
}
export function workflowRound(state){return state.round+(state.workflow&&['attacks','crew'].includes(state.workflow.phase)?0:1);}
export function canPlanWorkflow(state){return !state.workflow||state.workflow.phase==='thrust';}
