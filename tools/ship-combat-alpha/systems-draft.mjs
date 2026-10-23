import {applyCommand,getShip} from './engine.mjs';
export function beginSystemsDraft(state,shipId){const ship=getShip(state,shipId);return {shipId,name:ship.name,revision:state.revision,systems:structuredClone(ship.systems)};}
export function commitSystemsDraft(state,draft,selectedId){if(!draft||draft.shipId!==selectedId)throw Error('The systems draft belongs to another ship. Cancel and reopen it.');return applyCommand(state,{type:'set-systems',shipId:draft.shipId,systems:draft.systems,expectedRevision:draft.revision});}
