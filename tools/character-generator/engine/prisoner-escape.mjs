import {CORE_PACK} from './core-pack.mjs';
// Match the actual pending escape effects, never the ambiguous Accept label.
// Keep the original table and choose-effect command intact for .16 replays.
export function prisonerEscapePending(state){
 return state.stage==='effect-choice'&&state.character?.careers?.[state.active]?.id==='core.prisoner'&&
  JSON.stringify(state.pendingChoice)===JSON.stringify(CORE_PACK['core.prisoner'].events[3][0]);
}
