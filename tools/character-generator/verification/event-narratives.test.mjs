import test from 'node:test';
import assert from 'node:assert/strict';
import { eventNarrative } from '../engine/event-narratives.mjs';
import { CORE_PACK } from '../engine/core-pack.mjs';
import { CORE_LIFE_TABLES } from '../engine/core-life-events.mjs';
import { EXPANSION_PACK } from '../engine/expansion-pack.mjs';

test('every Core career event and mishap has concise context', () => {
 for (const [id, career] of Object.entries(CORE_PACK)) {
  for (const kind of ['events', 'mishaps']) {
   for (const row of Object.keys(career[kind])) {
    const context = eventNarrative(`${id}.${kind}`, row);
    assert.equal(typeof context, 'string', `${id}.${kind} ${row}`);
    assert.ok(context.length > 10);
   }
  }
 }
});

test('every Core education, Life and Unusual Event has context', () => {
 for (let row = 2; row <= 12; row++) assert.ok(eventNarrative('core.pre-career-events', row));
 for (const [id, table] of Object.entries(CORE_LIFE_TABLES)) {
  for (const row of Object.keys(table.results)) assert.ok(eventNarrative(id, row), `${id} ${row}`);
 }
 assert.match(eventNarrative('core.pre-career-events', 5), /studies.*parties/);
 assert.notEqual(eventNarrative('core.life-events', 5), eventNarrative('core.life-events', 6));
});

test('both Companion career tables have context for every result', () => {
 for (const id of ['companion.truther', 'companion.believer']) {
  for (const kind of ['events', 'mishaps']) {
   for (const row of Object.keys(EXPANSION_PACK[id][kind])) assert.ok(eventNarrative(`${id}.${kind}`, row));
  }
 }
});

test('unrecognised results remain unknown rather than inventing a story', () => {
 assert.equal(eventNarrative('invented.events', 5), null);
 assert.equal(eventNarrative('core.pre-career-events', 1), null);
 assert.equal(eventNarrative('core.agent.mishaps', 12), null);
});

test('narrative lookup leaves mechanical rules unchanged', () => {
 const before = JSON.stringify(CORE_PACK);
 for (const id of Object.keys(CORE_PACK)) eventNarrative(`${id}.events`, 5);
 assert.equal(JSON.stringify(CORE_PACK), before);
});

test('nested Prison Event and riot context covers each die face', () => {
 for (let row = 1; row <= 6; row++) {
  assert.ok(eventNarrative('core.prisoner.incidents', row));
  assert.ok(eventNarrative('core.prisoner.riot', row));
 }
 assert.match(eventNarrative('core.prisoner.incidents', 4), /transferred/);
 assert.match(eventNarrative('core.prisoner.riot', 1), /injured/);
 assert.match(eventNarrative('core.prisoner.riot', 3), /no additional mechanical effect/);
 assert.match(eventNarrative('core.prisoner.riot', 5), /loot/);
});

test('mishap context does not assert career ejection that protected routes can waive',()=>{
 for(const [id,pack] of Object.entries(CORE_PACK))for(const row of Object.keys(pack.mishaps??{}))assert.doesNotMatch(eventNarrative(id+'.mishaps',+row),/forces you out|career to an end|ends your service|leads to your discharge/);
});
