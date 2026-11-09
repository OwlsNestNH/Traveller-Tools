import test from 'node:test';
import assert from 'node:assert/strict';
import {aslanOriginView, aslanOriginSourceView, aslanOriginSheet} from '../gui/aslan-origin-view.mjs';
import {characterChanges} from '../engine/audit.mjs';
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const context = {esc, button: (label, action, cls = '', attributes = '') => '<button data-action="' + action + '" ' + attributes + '>' + label + '</button>', sourceLabel: (id, page) => id + ' p. ' + page};
const state = (stage, origin = {}) => ({stage, config: {gm: false}, currentAslanOrigin: {familySOC: 9, ...origin}});
test('family and birth rolls have separate large-control actions, never a manual birth default', () => {
  assert.match(aslanOriginView(state('aslan-family'), context), /roll-aslan-family/);
  assert.match(aslanOriginView(state('aslan-family'), context), /separately from the ordinary background/);
  const blank = aslanOriginView(state('aslan-family', {canRollGender: true}), context);
  assert.match(blank, /aliens p. 16/); assert.match(blank, /roll-aslan-gender/); assert.doesNotMatch(blank, /roll-aslan-family/);
  const birth = aslanOriginView(state('aslan-birth-order'), context);
  assert.match(birth, /roll-aslan-birth-order/); assert.doesNotMatch(birth, /<select|first-son| checked/);
});
test('printed estate baseline needs no GM, arbitrary estate input or ownership grant', () => {
  const html = aslanOriginView(state('aslan-estate', {estateOptions: {printedMinimumAvailable: true}}), context);
  assert.match(html, /data-method="printed-minimum"/); assert.match(html, /does not grant land, cash or present ownership/);
  assert.doesNotMatch(html, / disabled|type="number"|roll-aslan-estate/);
});
test('out-of-table estate fields are blank and GM-gated', () => {
  const html = aslanOriginView(state('aslan-estate', {estateOptions: {printedMinimumAvailable: false, requiresRefereeBaseline: true}}), context);
  assert.match(html, /id="aslan-estate-parcels"[^>]* disabled/); assert.match(html, /data-method="referee-baseline" disabled/);
  assert.doesNotMatch(html, /value="0"/);
  assert.doesNotMatch(aslanOriginView(state('aslan-estate'), context), /<button/);
});
test('clan offers a normal roll and distinct GM selection with constrained descriptive fields', () => {
  const html = aslanOriginView(state('aslan-clan'), context);
  assert.match(html, /roll-aslan-clan/); assert.match(html, /id="aslan-clan-name" maxlength="80" disabled/);
  assert.match(html, /id="aslan-clan-scope" maxlength="160" disabled/); assert.match(html, /data-action="choose-aslan-clan"  disabled/);
  assert.doesNotMatch(html, /Imperial|<table/);
});
test('clan name is descriptive and pride and rite remain separate actions', () => {
  const html = aslanOriginView(state('aslan-pride', {clan: {name: '<A Clan>'}}), context);
  assert.match(html, /&lt;A Clan&gt;/); assert.doesNotMatch(html, /<A Clan>/);
  assert.match(html, /name-aslan-clan/); assert.match(html, /roll-aslan-pride/);
  assert.match(aslanOriginView(state('aslan-rite'), context), /Background skills are recorded/);
  assert.match(aslanOriginView(state('aslan-rite'), context), /roll-aslan-rite/);
});
test('family source decision uses only projected options and has no default', () => {
  const s = {...state('book-step', {sourceDecision: {kind: 'family-band', options: [{id: 'lower', name: '<Lower>'}]}}), pending: {kind: 'aslan-origin-source'}};
  const html = aslanOriginSourceView(s, context);
  assert.match(html, /value=""/); assert.match(html, /&lt;Lower&gt;/);
  assert.doesNotMatch(html, /value="higher"| selected|effect-list/);
});
test('female Independence conflict is a deliberate GM exception or omission, never a substitute', () => {
  const s = {...state('book-step', {sourceDecision: {kind: 'female-independence'}}), pending: {kind: 'aslan-origin-source'}};
  const html = aslanOriginSourceView(s, context);
  assert.match(html, /grant-level-zero/); assert.match(html, /GM exception/); assert.match(html, /value="omit"/);
  assert.doesNotMatch(html, / selected|Mechanic|effect-list/);
});
test('mechanical gender branch preserves identity and uses projected decisions', () => {
  const s = {...state('book-step', {sourceDecision: {kind: 'gender', options: [{id: 'female', name: 'Female rules branch'}]}}), pending: {kind: 'aslan-origin-source'}};
  const html = aslanOriginSourceView(s, context);
  assert.match(html, /Your chosen gender stays unchanged/); assert.match(html, /value="female"/);
  assert.doesNotMatch(html, /value="male"| selected|roll-aslan-gender/);
});
test('missing and unsupported source projection fail closed', () => {
  assert.doesNotMatch(aslanOriginView({}, context), /<button/);
  assert.doesNotMatch(aslanOriginView(state('unexpected'), context), /<button/);
  assert.doesNotMatch(aslanOriginSourceView({...state('book-step'), pending: {kind: 'aslan-origin-source', decision: 'unknown'}}, context), /<button/);
});
test('origin sheet keeps family minimum and inheritance separate from present assets', () => {
  const html = aslanOriginSheet({character: {aslanOrigin: {familySOC: 9, family: {label: '<Family>'}, birthOrder: {id: 'first-son'}, estate: {minimumParcels: 10, inheritance: 'first-son'}, clan: {name: '<Clan>'}, pride: {name: '<Pride>'}}}}, context);
  assert.match(html, /Family SOC at creation/); assert.match(html, /10 parcels. Personal ownership: unestablished/);
  assert.match(html, /inheritance position/); assert.match(html, /&lt;Family&gt;/); assert.doesNotMatch(html, /<Clan>|<Pride>/);
  assert.equal(aslanOriginSheet({character: {}}, context), '');
});
test('origin audit includes immutable family snapshot and separate identity without rules internals', () => {
  const before = {aslanOrigin: {familySOC: 9, initialStats: {SOC: 9}, status: 'family'}};
  const after = {identityGender: 'other', gender: 'female', aslanOrigin: {...before.aslanOrigin, gender: {mode: 'referee', reason: 'Source branch'}, estate: {minimumParcels: 10, ownership: 'unestablished'}, status: 'clan', internal: {queue: ['secret']}, sourceDecision: {options: ['table-row']}}};
  const changes = characterChanges(before, after);
  assert.ok(changes.some(c => c.path === 'identityGender' && c.after === 'other'));
  assert.ok(changes.some(c => c.path === 'aslanOrigin.estate' && c.after.ownership === 'unestablished'));
  assert.ok(!changes.some(c => c.path === 'aslanOrigin.familySOC'));
  assert.doesNotMatch(JSON.stringify(changes), /internal|secret|queue|table-row/);
  changes.find(c => c.path === 'aslanOrigin.estate').after.minimumParcels = 999;
  assert.equal(after.aslanOrigin.estate.minimumParcels, 10);
});
