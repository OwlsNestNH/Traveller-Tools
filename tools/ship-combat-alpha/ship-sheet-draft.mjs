import {applyCommand,getShip} from './engine.mjs';
import {effectiveDesign} from './setup.mjs';
import {applySetupFields} from './setup-session.mjs';
// One existing-ship transaction. Preview and Cancel only inspect or discard this copy.
export function beginShipSheet(state,shipId){
 const ship=getShip(state,shipId);
 return {shipId,baseRevision:state.revision,values:{name:ship.name,side:ship.appearance.side,identity:structuredClone(ship.identity),design:structuredClone(effectiveDesign(ship)),condition:structuredClone(ship.condition),basic:ship.systems.basic},crew:structuredClone(ship.crew),situational:structuredClone(ship.situational)};
}
export function commitShipSheet(state,draft,selectedId=draft.shipId){
 if(selectedId!==draft.shipId)throw Error('Return to the sheet ship or cancel.');
 if(state.revision!==draft.baseRevision)throw Error('State changed; close and reopen this sheet.');
 const ship=getShip(state,draft.shipId),v=draft.values;
 const designChanged=JSON.stringify(v.design)!==JSON.stringify(effectiveDesign(ship));
 const conditionChanged=JSON.stringify(v.condition)!==JSON.stringify(ship.condition);
 const crewChanged=JSON.stringify(draft.crew)!==JSON.stringify(ship.crew)||JSON.stringify(draft.situational)!==JSON.stringify(ship.situational);
 if(state.acceleration&&(designChanged||conditionChanged||v.basic!==ship.systems.basic||crewChanged))throw Error('Ship setup is locked during thrust declarations.');
 let next=state;
 if(!state.acceleration)next=applySetupFields(next,ship.id,{design:v.design,condition:v.condition,basic:v.basic,softwareEdits:draft.softwareEdits},draft.baseRevision);
 if(crewChanged)next=applyCommand(next,{type:'set-crew',shipId:ship.id,crew:draft.crew,situational:draft.situational,expectedRevision:next.revision});
 return applyCommand(next,{type:'set-identity',shipId:ship.id,name:v.name,identity:v.identity,side:v.side,expectedRevision:next.revision});
}
