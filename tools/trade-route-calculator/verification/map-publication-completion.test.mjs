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
const focusHelpers=app.slice(app.indexOf('function captureMapFocus(){'),app.indexOf('function render(){'));
assert.ok(focusHelpers.includes('function restoreMapFocus('),'Load actual map focus dependencies');
const accountsGuard = app.match(/^function accountsBusy\(\).*$/m)?.[0];
assert.ok(accountsGuard, 'Include the actual Accounts ownership predicate, not a false stub');
const clearRouteGuards=['clearRouteBusy','clearRoutePresentationHeld','plannedRouteBusy','plannedRoutePresentationHeld'].map(name=>{
 const source=app.match(new RegExp('^function '+name+'\\(\\).*$', 'm'))?.[0];
 assert.ok(source,'Include actual '+name+' predicate');return source;
}).join('\n');

function harness(owners = {}) {
 const calls = [], replacement = {kind: 'new map'}, status = {textContent: 'Original status'};
 const old = {replaceWith(node) {assert.equal(node, replacement); calls.push('replace');}};
 const holder = {set innerHTML(html) {assert.equal(html, '<section>Candidate map</section>'); calls.push('markup');},
  querySelector(selector) {assert.equal(selector, '.world-map'); return replacement;}};
 // This extraction isolates the existing owners; the expense browser/native
 // suites exercise the real expense controller's publication guard.
 // Insurance adds one lexical owner to the production painter; keep every
 // existing body/spy/assertion intact while supplying its absent default.
 const context = vm.createContext({
  accountsWriteOperation: null,
  clearRouteWriteOperation: null, clearRouteSaveOperation: null, plannedRouteWriteOperation: null, plannedRouteSaveOperation: null,
  expenseServices: {publicationDeferred: () => false},
  worldWriteOperation: null, undoOperation: null, replacementReview: null, settingsOperation: null, purchaseWriteOperation: null, insuranceWriteOperation: null, contactSearchWriteOperation: null, contractOfferWriteOperation: null, contractLifecycleWriteOperation: null, passengerWriteOperation: null,
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
 vm.runInContext(accountsGuard + '\n' + clearRouteGuards + '\n' + focusHelpers + '\n' + source + '\nglobalThis.paint = paintMap;', context, {filename: 'production paintMap'});
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

// Purchase holds prewrite presentation too. Only supply the new lexical
// dependency here: the extracted production painter and old assertions remain.
for (const pending of [false, true]) for (const publicationDeferred of [false, true]) for (const invalidated of [false, true]) {
 test(`purchase: pending=${pending}, publicationDeferred=${publicationDeferred}, invalidated=${invalidated}`, () => {
  const h = harness({purchaseWriteOperation: {pending, publicationDeferred, invalidated}});
  if (pending && !invalidated) assertFrozen(h); else assertPainted(h);
 });
}
for (const absent of [null, undefined]) test(`purchase: absent ${absent} owner permits painting`, () => assertPainted(harness({purchaseWriteOperation: absent})));
for (const release of ['settled', 'cleared', 'invalidated']) test(`purchase: ${release} resumes the same production painter`, () => {
 const h = harness({purchaseWriteOperation: {pending: true, publicationDeferred: true, invalidated: false}}); assertFrozen(h);
 if (release === 'settled') h.context.purchaseWriteOperation.pending = false;
 else if (release === 'cleared') h.context.purchaseWriteOperation = null;
 else h.context.purchaseWriteOperation.invalidated = true;
 assertPainted(h);
});
test('purchase paint guard exactly matches its render ownership predicate', () => {
 const render = app.slice(app.indexOf('function render(){'), app.indexOf('\nfunction mapHexGrid('));
 const guard = 'if(purchaseWriteOperation?.pending&&!purchaseWriteOperation.invalidated)return;';
 assert.ok(source.includes(guard)); assert.ok(render.includes(guard));
});

// Contract generation and draft editing now share a prewrite-presentation owner.
// Add its absent binding without changing the old owners or assertions above.
for (const pending of [false, true]) for (const publicationDeferred of [false, true]) for (const invalidated of [false, true]) {
 test(`contract offers: pending=${pending}, publicationDeferred=${publicationDeferred}, invalidated=${invalidated}`, () => {
  const h = harness({contractOfferWriteOperation: {pending, publicationDeferred, invalidated}});
  if (pending && !invalidated) assertFrozen(h); else assertPainted(h);
 });
}
for (const absent of [null, undefined]) test(`contract offers: absent ${absent} owner permits painting`, () => assertPainted(harness({contractOfferWriteOperation: absent})));
for (const release of ['settled', 'cleared', 'invalidated']) test(`contract offers: ${release} resumes the same production painter`, () => {
 const h = harness({contractOfferWriteOperation: {pending: true, publicationDeferred: true, invalidated: false}}); assertFrozen(h);
 if (release === 'settled') h.context.contractOfferWriteOperation.pending = false;
 else if (release === 'cleared') h.context.contractOfferWriteOperation = null;
 else h.context.contractOfferWriteOperation.invalidated = true;
 assertPainted(h);
});
test('contract-offer paint guard exactly matches its render ownership predicate', () => {
 const render = app.slice(app.indexOf('function render(){'), app.indexOf('\nfunction mapHexGrid('));
 const guard = 'if(contractOfferWriteOperation?.pending&&!contractOfferWriteOperation.invalidated)return;';
 assert.ok(source.includes(guard)); assert.ok(render.includes(guard));
});

// Execute the real predicate with each active retained-form phase. This is not
// an absent-owner stub: pending and handoff must stop the complete painter.
for(const flag of ['pending','constructing','handoff','recovering','updating'])for(const active of [false,true])for(const invalidated of [false,true])test(`Accounts map: ${flag}=${active}, invalidated=${invalidated}`,()=>{
 const h=harness({accountsWriteOperation:{[flag]:active,invalidated}});
 if(active&&!invalidated)assertFrozen(h);else assertPainted(h);
});
for(const absent of [null,undefined])test(`Accounts map: absent ${absent} owner permits existing painter`,()=>assertPainted(harness({accountsWriteOperation:absent})));
for(const flag of ['pending','constructing','handoff','recovering','updating'])test(`Accounts map: clearing ${flag} resumes the same production painter`,()=>{
 const owner={[flag]:true,invalidated:false},h=harness({accountsWriteOperation:owner});assertFrozen(h);owner[flag]=false;assertPainted(h);
});

// Branch coverage executes the new real predicates in the existing complete
// paintMap extraction, not a neutral false-returning compatibility stub.
for(const flag of ['constructing','pending','recovering'])for(const active of [false,true])for(const invalidated of [false,true])for(const presenting of [false,true])test(`clear route map: ${flag}=${active}, invalidated=${invalidated}, presenting=${presenting}`,()=>{
 const h=harness({clearRouteWriteOperation:{[flag]:active,invalidated,presenting}});
 if(flag==='recovering'&&active||!invalidated&&!presenting)assertFrozen(h);else assertPainted(h);
});
for(const recovering of [false,true])test(`clear route map: detached save recovery=${recovering}`,()=>{
 const h=harness({clearRouteWriteOperation:{invalidated:true},clearRouteSaveOperation:{attempt:{recovering}}});
 if(recovering)assertFrozen(h);else assertPainted(h);
});
