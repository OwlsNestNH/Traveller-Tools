// Presentation-only gating. Historical connection events still replay unchanged.
export function notesConnectionsView(state,{esc,button},notesDraft=null){
 const c=state.character;
 const notes='<label>Background notes<textarea id="character-notes" rows="5" maxlength="10000">'+esc(notesDraft??c.notes)+'</textarea></label><p id="notes-status" class="tiny">'+(notesDraft!==null&&notesDraft!==c.notes?'Unsaved notes. Save notes, save the character or print to record them.':'Notes are saved with the action log.')+'</p>'+button('Save notes','save-notes','quiet');
 return '<details id="notes-connections"><summary>'+'Background notes'+'</summary>'+notes+'</details>';
}
