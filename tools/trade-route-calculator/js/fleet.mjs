import {validate} from './state.mjs?v=luxury-lss-20261108-1';
export const LEGACY_SHIP_ID='legacy-ship';
export const isFleet=value=>value!==null&&typeof value==='object'&&Object.hasOwn(value,'fleetVersion');
// Validate every member before any write. Keep imported fields and histories intact.
export function validateImport(value){
 const copy=structuredClone(value);
 if(!isFleet(copy)){validate(structuredClone(copy));return copy;}
 if(copy.fleetVersion!==1)throw Error('Unsupported fleet version.');
 if(!Array.isArray(copy.ships)||!copy.ships.length)throw Error('A fleet must contain at least one ship.');
 const ids=new Set();
 for(const entry of copy.ships){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.id!=='string'||!/^[A-Za-z0-9_,.:-]{1,100}$/.test(entry.id)||ids.has(entry.id))throw Error('Invalid or duplicate fleet ship ID.');
  ids.add(entry.id);validate(structuredClone(entry.campaign));
 }
 if(typeof copy.activeShipId!=='string'||!ids.has(copy.activeShipId))throw Error('The selected fleet ship is missing.');
 return copy;
}
export function selectedCampaign(value){return isFleet(value)?value.ships.find(entry=>entry.id===value.activeShipId).campaign:value;}
export function shipIdentity(value){return isFleet(value)?value.activeShipId:LEGACY_SHIP_ID;}
export function withCampaign(value,campaign){
 if(!isFleet(value))return campaign;
 return {...value,ships:value.ships.map(entry=>entry.id===value.activeShipId?{...entry,campaign}:entry)};
}
