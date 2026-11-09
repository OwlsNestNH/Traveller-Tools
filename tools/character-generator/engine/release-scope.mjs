// Release policy, separate from preserved source-rule implementation and save revision.
const deferred = id => typeof id === 'string' && (id === 'zhodani' || id.startsWith('zhodani.'));
const message = 'Zhodani generation is deferred from this release. Preserve the original save and use read-only history recovery.';
function checkCommand(command) {
 const p=command?.payload;
 if(command?.type==='setup' && deferred(p?.species) || command?.type==='configure' && p?.zhodaniPsi ||
    command?.type==='career' && deferred(p?.id)) throw new Error(message);
}
export function assertReleaseRequest(request) {
 // Check every recorded command, including superseded history before restore/replay.
 // Do not scan prose: names, notes and source references are not generation choices.
 if(Array.isArray(request?.session?.events)) for(const event of request.session.events) checkCommand(event?.command);
 if(request?.operation==='command') checkCommand(request.command);
 // Imports are bounded/parsed and replay-validated by the engine first; inspect the
 // returned session below rather than parsing unbounded JSON here a second time.
}
export function releaseResult(result) {
 if(!result.ok) return result;
 if(result.session) assertReleaseRequest({session:result.session});
 if(result.state) {
  if(deferred(result.state.character.species) || result.state.config.zhodaniPsi ||
     result.state.character.careers.some(c=>deferred(c.id))) throw new Error(message);
  result.state.careerChoices=result.state.careerChoices.filter(c=>!deferred(c.id));
 }
 if(result.species) {
  // Clone because the development catalogue holds shared rule constants.
  result={...result,species:result.species.filter(s=>!deferred(s.id)),careers:result.careers.filter(c=>!deferred(c.id))};
 }
 return result;
}
