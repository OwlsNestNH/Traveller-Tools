import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Execute the complete production paintMap body. DOM/map dependencies are
// spies, not copied guards; the companion browser suite owns real callbacks,
// node identity, SVG markup and candidate-specific map semantics.
const app = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
const start = app.indexOf('function paintMap(){');
const end = app.indexOf('\nfunction requestMapAreas(){', start);
assert.ok(start >= 0 && end > start, 'Unique production paintMap extraction boundary');
assert.equal(app.indexOf('function paintMap(){', start + 1), -1);
const source = app.slice(start, end);

function harness(owners = {}) {
 const calls = [], replacement = {kind: 'new map'}, status = {textContent: 'Original status'};
 const old = {replaceWith(node) {assert.equal(node, replacement); calls.push('replace');}};
 const holder = {set innerHTML(html) {assert.equal(html, '<section>Candidate map</section>'); calls.push('markup');},
  querySelector(selector) {assert.equal(selector, '.world-map'); return replacement;}};
 const context = vm.createContext({
  worldWriteOperation: null, undoOperation: null, replacementReview: null, settingsOperation: null,
  mapDrag: null, tab: 'Overview', mapZoom: 1, showTerritories: false,
  mapAreas: {error: null, pending: false}, mapOverview: {error: null, pending: false},
  document: {querySelector(selector) {assert.equal(selector, '.world-map'); calls.push('query'); return old;},
   createElement(tag) {assert.equal(tag, 'div'); calls.push('holder'); return holder;}},
  viewed() {calls.push('viewed'); return {id: 'candidate-world'};},
  mapPanel() {calls.push('panel'); return '<section>Candidate map</section>';},
  mapLevel() {calls.push('level'); return 'world';},
  $(id) {assert.equal(id, 'map-load-status'); calls.push('status'); return status;},
  ...owners
 });
 vm.runInContext(source + '\nglobalThis.paint = paintMap;', context, {filename: 'production paintMap'});
 return {context, calls, status, paint: () => context.paint()};
}
function assertFrozen(h) {
 h.paint(); assert.deepEqual(h.calls, [], 'Deferred current owner stops before any DOM or map dependency');
 assert.equal(h.status.textContent, 'Original status');
}
function assertPainted(h) {
 h.paint(); assert.deepEqual(h.calls, ['query', 'viewed', 'holder', 'panel', 'markup', 'replace', 'level', 'status']);
 assert.equal(h.status.textContent, '', 'Normal painting resumes with current cache status');
}

for (const owner of ['undoOperation', 'replacementReview']) {
 for (const pending of [false, true]) for (const publicationDeferred of [false, true]) for (const invalidated of [false, true]) {
  test(`${owner}: pending=${pending}, publicationDeferred=${publicationDeferred}, invalidated=${invalidated}`, () => {
   const h = harness({[owner]: {pending, publicationDeferred, invalidated}});
   if (pending && publicationDeferred && !invalidated) assertFrozen(h); else assertPainted(h);
  });
 }
 for (const absent of [null, undefined]) test(`${owner}: absent ${absent} owner permits painting`, () => assertPainted(harness({[owner]: absent})));
 for (const release of ['settled', 'cleared', 'invalidated', 'publication released']) test(`${owner}: ${release} resumes the same production painter`, () => {
  const h = harness({[owner]: {pending: true, publicationDeferred: true, invalidated: false}});
  assertFrozen(h);
  if (release === 'settled') h.context[owner].pending = false;
  else if (release === 'cleared') h.context[owner] = null;
  else if (release === 'invalidated') h.context[owner].invalidated = true;
  else h.context[owner].publicationDeferred = false;
  assertPainted(h);
 });
 test(`${owner}: pending before owned publication permits normal old-state cache paints`, () => assertPainted(harness({[owner]: {pending: true}})));
}

for (const pending of [false, true]) for (const publicationDeferred of [false, true]) for (const invalidated of [false, true]) {
 test(`existing world owner retains semantics: pending=${pending}, publicationDeferred=${publicationDeferred}, invalidated=${invalidated}`, () => {
  const h = harness({worldWriteOperation: {pending, publicationDeferred, invalidated}});
  if (publicationDeferred && !invalidated) assertFrozen(h); else assertPainted(h);
 });
}
for (const pending of [false, true]) for (const publicationDeferred of [false, true]) for (const invalidated of [false, true]) {
 test(`non-target Settings remains paintable: pending=${pending}, publicationDeferred=${publicationDeferred}, invalidated=${invalidated}`, () => {
  assertPainted(harness({settingsOperation: {pending, publicationDeferred, invalidated}}));
 });
}
test('invalidated owners allow authoritative foreign state to paint even with stale pending/deferred flags', () => {
 const invalid = {pending: true, publicationDeferred: true, invalidated: true};
 assertPainted(harness({undoOperation: {...invalid}, replacementReview: {...invalid}, worldWriteOperation: {...invalid}}));
});
for (const owner of ['undoOperation', 'replacementReview', 'worldWriteOperation']) test(`a current ${owner} still freezes when the other owners are invalidated`, () => {
 const invalid = {pending: true, publicationDeferred: true, invalidated: true};
 assertFrozen(harness({undoOperation: {...invalid}, replacementReview: {...invalid}, worldWriteOperation: {...invalid}, [owner]: {...invalid, invalidated: false}}));
});
test('preexisting drag and non-Overview exits remain intact', () => {
 assertFrozen(harness({mapDrag: {id: 1}})); assertFrozen(harness({tab: 'History'}));
});
test('Undo and replacement paint guards exactly match their render ownership predicates', () => {
 const render = app.slice(app.indexOf('function render(){'), app.indexOf('\nfunction mapHexGrid('));
 for (const owner of ['undoOperation', 'replacementReview']) {
  const guard = `if(${owner}?.pending&&${owner}.publicationDeferred&&!${owner}.invalidated)return;`;
  assert.ok(source.includes(guard)); assert.ok(render.includes(guard));
 }
});
