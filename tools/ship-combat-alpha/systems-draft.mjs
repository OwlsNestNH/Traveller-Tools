import {systemProfile} from './systems.mjs';
import {effectiveDesign} from './setup.mjs';
import {applyCommand,getShip} from './engine.mjs';
export function beginSystemsDraft(state,shipId){const ship=getShip(state,shipId);const systems=structuredClone(ship.systems);for(const l of systemProfile(effectiveDesign(ship)).loads)if(l.id.startsWith('fit-')&&!systems.loads.some(x=>x.id===l.id))systems.loads.push({id:l.id,enabled:false,override:null});return {shipId,name:ship.name,revision:state.revision,systems};}
export function commitSystemsDraft(state,draft,selectedId){if(!draft||draft.shipId!==selectedId)throw Error('The systems draft belongs to another ship. Cancel and reopen it.');return applyCommand(state,{type:'set-systems',shipId:draft.shipId,systems:draft.systems,expectedRevision:draft.revision});}
