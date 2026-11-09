// Public scope is pinned to the saved rules revision; never reinterpret old histories.
export const ZHODANI_RELEASE_REVISION='character-preview-2026-11-09.19';
const zhodani = id => typeof id === 'string' && (id === 'zhodani' || id.startsWith('zhodani.'));
const message = 'Zhodani generation was deferred in this saved rules revision. Preserve the original save and use read-only history recovery.';
const enabled = session => session?.rulesRevision === ZHODANI_RELEASE_REVISION;
function checkCommand(command) {
 const p=command?.payload;
 if(command?.type==='setup' && zhodani(p?.species) || command?.type==='configure' && p?.zhodaniPsi ||
    command?.type==='career' && zhodani(p?.id)) throw new Error(message);
}
export function assertReleaseRequest(request) {
 if(enabled(request?.session)) return;
 // Include superseded history: restore cannot launder a formerly deferred choice.
 if(Array.isArray(request?.session?.events)) for(const event of request.session.events) checkCommand(event?.command);
 if(request?.operation==='command') checkCommand(request.command);
 // Imports are bounded and replay-validated first, then inspected in releaseResult.
}
export function releaseResult(result,request) {
 if(!result.ok) return result;
 if(result.session) assertReleaseRequest({session:result.session});
 if(result.state && !enabled(result.session??request?.session)) {
  if(zhodani(result.state.character.species) || result.state.config.zhodaniPsi ||
     result.state.character.careers.some(c=>zhodani(c.id))) throw new Error(message);
  result.state.careerChoices=result.state.careerChoices.filter(c=>!zhodani(c.id));
 }
 return result;
}
