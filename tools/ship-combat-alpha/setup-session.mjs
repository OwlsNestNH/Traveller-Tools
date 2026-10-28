import {normalizeOverrides} from './setup.mjs';
import {softwareSetupSystems} from './software-setup.mjs';
// Explicit draft transaction: live state is untouched until a guarded Save.
import {normalizeState,applyCommand} from './engine.mjs';
const EDITS=new Set(['add-ship','remove-ship','clear-ships','edit-ship','set-design','set-crew','set-condition','set-appearance','set-systems']);
export function beginSetup(live){const draft=normalizeState(live);return {baseRevision:live.revision,draft};}
export function editSetup(session,command){if(!EDITS.has(command?.type))throw Error('Movement commands cannot run inside setup.');return {...session,draft:applyCommand(session.draft,{...command,expectedRevision:session.draft.revision})};}
export function saveSetup(live,session){if(!Number.isSafeInteger(session?.baseRevision))throw Error('Open a setup draft before saving.');return applyCommand(live,{type:'replace-ships',ships:session.draft.ships,expectedRevision:session.baseRevision});}

// Validate related capacity/current edits together, never against an intermediate draft.
export function applySetupFields(state,shipId,{design,condition,basic,softwareEdits,sensorMode},expectedRevision=state.revision){
 const original=state.ships.find(s=>s.id===shipId);if(!original)throw Error('Selected ship is no longer present.');
 const ship=structuredClone(original);
 if(design){ship.systems=softwareSetupSystems(original,design,softwareEdits);if(ship.template)ship.designOverrides=normalizeOverrides(design,ship.template);else{ship.template=design;ship.designOverrides=null;}}
 if(condition)ship.condition=condition;
 if(sensorMode!=null)ship.systems={...ship.systems,sensorMode};
 if(basic!=null)ship.systems={...ship.systems,basic};
 if(JSON.stringify(ship)===JSON.stringify(original))return state;
 return applyCommand(state,{type:'replace-ships',ships:state.ships.map(s=>s.id===shipId?ship:s),expectedRevision});
}
