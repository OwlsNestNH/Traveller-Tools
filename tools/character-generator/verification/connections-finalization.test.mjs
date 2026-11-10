import test from 'node:test';
import assert from 'node:assert/strict';
import {notesConnectionsView} from '../gui/notes-connections-view.mjs';
import {finalSheetFixture,run} from './final-sheet-fixtures.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const button=(label,action)=>'<button data-action="'+action+'">'+label+'</button>';
const fixture=finalSheetFixture({finish:false});
for(const stage of ['identity','statistics','background','precareer','career','term-end','retirement','equipment-finalization','book-step','skill-choice','benefits','finish','deceased']){
 test('connection entry is finalization-only at '+stage,()=>{
  const state=structuredClone(fixture.state);state.stage=stage;const before=JSON.stringify(state);
  const html=notesConnectionsView(state,{esc,button},'Draft <note>');
  assert.equal(html.includes('id="connection-person"'),stage==='finish');
  assert.equal(html.includes('data-action="connection"'),stage==='finish');
  assert.equal(html.includes('<summary>Notes & connections</summary>'),stage==='finish');
  assert.ok(html.includes('id="character-notes"'));assert.ok(html.includes('Draft &lt;note>'));assert.ok(html.includes('Unsaved notes.'));
  assert.equal(JSON.stringify(state),before);
 });
}
test('historical pre-finalization connections remain byte-identical and retain their skills',()=>{
 const r=run(fixture,'connection',{person:'Synthetic existing Traveller',skill:'Admin',note:'Previously recorded connection.'});
 const raw=exportSession(r.session),restored=importSession(raw),before=JSON.stringify(r.state);
 assert.equal(exportSession(restored),raw);
 assert.deepEqual(project(restored).state.connections,r.state.connections);
 assert.deepEqual(project(restored).state.character.skills,r.state.character.skills);
 assert.ok(!notesConnectionsView(r.state,{esc,button}).includes('id="connection-person"'));
 assert.equal(JSON.stringify(r.state),before);
 const final=run(r,'finish');assert.ok(notesConnectionsView(final.state,{esc,button}).includes('id="connection-person"'));
 assert.deepEqual(final.state.connections,r.state.connections);
});
