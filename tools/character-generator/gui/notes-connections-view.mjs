// Presentation-only gating. Historical connection events still replay unchanged.
export function notesConnectionsView(state,{esc,button},notesDraft=null){
 const c=state.character,finalizing=state.stage==='finish';
 const notes='<label>Background notes<textarea id="character-notes" rows="5" maxlength="10000">'+esc(notesDraft??c.notes)+'</textarea></label><p id="notes-status" class="tiny">'+(notesDraft!==null&&notesDraft!==c.notes?'Unsaved notes. Save notes, save the character or print to record them.':'Notes are saved with the action log.')+'</p>'+button('Save notes','save-notes','quiet');
 const connection=finalizing?'<h3>Add a connection</h3><label>Other Traveller<input id="connection-person" maxlength="80"></label><label>Skill<input id="connection-skill" list="all-skills" maxlength="80"></label><label>What happened?<input id="connection-note" maxlength="300"></label>'+button('Record connection','connection','quiet'):'';
 return '<details id="notes-connections"><summary>'+(finalizing?'Notes & connections':'Background notes')+'</summary>'+notes+connection+'</details>';
}
