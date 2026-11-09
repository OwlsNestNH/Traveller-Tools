import test from 'node:test';
import assert from 'node:assert/strict';
import { eventNarrative } from '../engine/event-narratives.mjs';
import { alienEventNarrative, alienEventNarrativeTables } from '../engine/alien-event-narratives.mjs';
import { EXPANSION_PACK, EXPANSION_TABLES } from '../engine/expansion-pack.mjs';
const releasedAlien = id => /^(aslan|vargr)\./.test(id);
test('every released alien career event and mishap has source context', () => {
 let careers = 0, count = 0;
 for (const [id, career] of Object.entries(EXPANSION_PACK).filter(([id]) => releasedAlien(id))) {
  careers++;
  for (const kind of ['events', 'mishaps']) for (const row of Object.keys(career[kind])) {
   const table = `${id}.${kind}`;
   const context = eventNarrative(table, row);
   assert.equal(typeof context, 'string', `${table} ${row}`);
   assert.ok(context.length > 10 && context.length < 200, `${table} ${row}`);
   assert.equal(context, alienEventNarrative(table, row));
   count++;
  }
 }
 assert.equal(careers, 20);
 assert.equal(count, 340);
});
test('all released alien shared event and rite rows have source context', () => {
 let count = 0;
 for (const [id, table] of Object.entries(EXPANSION_TABLES).filter(([id]) => releasedAlien(id))) {
  for (const row of Object.keys(table.results)) {
   assert.ok(eventNarrative(id, row), `${id} ${row}`);
   count++;
  }
 }
 assert.equal(count, 52);
 assert.equal(alienEventNarrativeTables.length, 47);
});
test('narrative access leaves rules and source objects unchanged', () => {
 const before = JSON.stringify([EXPANSION_PACK, EXPANSION_TABLES]);
 for (const table of alienEventNarrativeTables) for (let row = 1; row <= 12; row++) eventNarrative(table, row);
 assert.equal(JSON.stringify([EXPANSION_PACK, EXPANSION_TABLES]), before);
});
test('unknown tables and non-existent results do not invent alien context', () => {
 for (const table of ['invented.events','zhodani.agent.events','toString','constructor','__proto__']) assert.equal(alienEventNarrative(table, 3), null);
 assert.equal(eventNarrative('aslan.rite-doubles', 3), null);
 assert.equal(eventNarrative('vargr.agent.events', 1), null);
 assert.equal(eventNarrative('aslan.envoy.mishaps', 7), null);
});
test('context preserves distinct source situations without guessing choices', () => {
 assert.match(eventNarrative('aslan.manager.events', 3), /workplace.*attack/);
 assert.match(eventNarrative('aslan.scientist.events', 9), /race.*sabotage.*stand aside/);
 assert.match(eventNarrative('vargr.loner.mishaps', 6), /cannot remember/);
 assert.match(eventNarrative('vargr.merchant.events', 6), /clear your business/);
 assert.match(eventNarrative('aslan.rite-doubles', 10), /scar/);
});
