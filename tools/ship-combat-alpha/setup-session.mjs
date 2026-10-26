// Explicit draft transaction: live state is untouched until a guarded Save.
import {normalizeState,applyCommand} from './engine.mjs';
const EDITS=new Set(['add-ship','remove-ship','clear-ships','edit-ship','set-design','set-crew','set-condition','set-appearance','set-systems']);
export function beginSetup(live){const draft=normalizeState(live);return {baseRevision:live.revision,draft};}
export function editSetup(session,command){if(!EDITS.has(command?.type))throw Error('Movement commands cannot run inside setup.');return {...session,draft:applyCommand(session.draft,{...command,expectedRevision:session.draft.revision})};}
export function saveSetup(live,session){if(!Number.isSafeInteger(session?.baseRevision))throw Error('Open a setup draft before saving.');return applyCommand(live,{type:'replace-ships',ships:session.draft.ships,expectedRevision:session.baseRevision});}
