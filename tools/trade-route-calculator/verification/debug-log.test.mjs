import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_BUILD, createDebugLog} from '../js/debug-log.mjs';

const NOW = '2026-10-11T18:00:00.000Z';
const log = options => createDebugLog({now:() => NOW, ...options});
const notCommitted = cause => Object.assign(new Error('write failed', {cause}), {code:'SAVE_NOT_COMMITTED', committed:false});
const publicationFailed = revision => Object.assign(new Error('publication failed'), {code:'SAVE_COMMITTED_PUBLICATION_FAILED', committed:true, revision});

test('retains the newest 50 entries and clear preserves the array while resetting deduplication', () => {
  const diagnostics = log(), entries = diagnostics.entries;
  const first = new Error('first');
  diagnostics.record(first);
  for (let i = 1; i <= 55; i++) diagnostics.record(new Error(String(i)));
  assert.equal(entries.length, 50);
  assert.equal(entries[0].message, '6');
  assert.equal(entries.at(-1).message, '55');
  const retained = new Error('retained');
  const old = diagnostics.record(retained);
  diagnostics.clear();
  assert.equal(diagnostics.entries, entries);
  assert.deepEqual(entries, []);
  assert.notEqual(diagnostics.record(retained), old);
  assert.equal(entries.length, 1);
  const smaller = log({limit:2});
  for (let i = 0; i < 3; i++) smaller.record(String(i));
  assert.deepEqual(smaller.entries.map(entry => entry.message), ['1', '2']);
  const capped = log({limit:100});
  for (let i = 0; i < 51; i++) capped.record(String(i));
  assert.equal(capped.entries.length, 50);
});

test('safe reports accept only explicit typed save outcomes and validated durable revisions', () => {
  const diagnostics = log();
  diagnostics.record(notCommitted(new Error('private cause')), 'expense-save', {screen:'Overview'});
  diagnostics.record(publicationFailed(17), 'settings-save', {screen:'Settings'});
  const report = diagnostics.safeReport();
  assert.deepEqual(report, {
    formatVersion:1, build:APP_BUILD, generatedAt:NOW,
    events:[
      {time:NOW, action:'expense-save', screen:'Overview', code:'SAVE_NOT_COMMITTED', outcome:'not-committed', committed:false},
      {time:NOW, action:'settings-save', screen:'Settings', code:'SAVE_COMMITTED_PUBLICATION_FAILED', outcome:'committed-publication-failed', committed:true, revision:17},
    ],
  });
  for (const error of [
    new Error('SAVE_NOT_COMMITTED'),
    {code:'SAVE_NOT_COMMITTED', committed:true},
    {code:'SAVE_COMMITTED_PUBLICATION_FAILED', committed:false, revision:17},
    publicationFailed('17'), publicationFailed(-1), publicationFailed(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    const entry = diagnostics.record(error);
    assert.deepEqual([entry.code, entry.outcome, entry.committed], ['unknown', 'unknown', null]);
    assert.equal(Object.hasOwn(entry, 'revision'), false);
  }
});

test('deduplicates reported error identities and later wrappers without merging independent Store attempts', () => {
  const diagnostics = log(), root = new Error('same raw cause');
  const first = notCommitted(root), second = notCommitted(root);
  const initial = diagnostics.record(first, 'modal-submit');
  assert.equal(diagnostics.record(first, 'runtime'), initial);
  const wrapper = new Error('outer fallback', {cause:first});
  assert.equal(diagnostics.record(wrapper, 'unhandled-rejection'), initial);
  assert.equal(diagnostics.record(new Error('next wrapper', {cause:wrapper})), initial);
  assert.notEqual(diagnostics.record(second), initial);
  assert.equal(diagnostics.entries.length, 2);
  diagnostics.record(new Error('same raw cause'));
  diagnostics.record(new Error('same raw cause'));
  assert.equal(diagnostics.entries.length, 4);
});

test('explicit new occurrences preserve separate attempts even when the same error is reused', () => {
  const diagnostics = log(), error = notCommitted(new Error('reused'));
  const first = diagnostics.record(error);
  const second = diagnostics.record(error, 'modal-submit', {newOccurrence:true, action:'cargo-add', screen:'Cargo'});
  assert.notEqual(second, first);
  assert.equal(diagnostics.record(error), second);
  assert.equal(diagnostics.record(new Error('fallback', {cause:error})), second);
  const third = diagnostics.record(new Error('new attempt', {cause:error}), 'modal-submit', {newOccurrence:true});
  assert.notEqual(third, second);
  assert.equal(diagnostics.entries.length, 3);
});

test('a later authoritative wrapper upgrades a deduplicated occurrence without changing its original location', () => {
  const diagnostics = log(), error = new Error('initial publication failure');
  const original = diagnostics.record(error, 'modal-submit', {action:'deposit-save', screen:'Accounts'});
  const wrapper = publicationFailed(12);
  wrapper.cause = error;
  assert.equal(diagnostics.record(wrapper, 'runtime', {screen:'Unknown'}), original);
  assert.equal(diagnostics.entries.length, 1);
  assert.deepEqual(diagnostics.safeReport().events[0], {
    time:NOW, action:'deposit-save', screen:'Accounts', code:'SAVE_COMMITTED_PUBLICATION_FAILED',
    outcome:'committed-publication-failed', committed:true, revision:12,
  });
  diagnostics.record(notCommitted(wrapper));
  diagnostics.record(error);
  assert.equal(original.committed, true);
  assert.equal(original.revision, 12);
});

test('safe output contains only allowlisted metadata and no private diagnostic or campaign sentinels', () => {
  const diagnostics = log();
  const secret = 'PRIVATE_CAMPAIGN_SENTINEL';
  const error = Object.assign(new Error(secret, {cause:new Error(secret)}), {
    name:secret, stack:'https://private.example/' + secret, code:secret,
    revision:secret, campaign:{name:secret}, id:secret,
  });
  const entry = diagnostics.record(error, secret, {action:secret, screen:secret, campaign:secret});
  assert.equal(entry.context, secret);
  assert.equal(entry.message, secret);
  assert.ok(entry.stack.includes(secret));
  entry.unknown = secret;
  entry.outcome = secret;
  const report = diagnostics.safeReport();
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.deepEqual(Object.keys(report), ['formatVersion', 'build', 'generatedAt', 'events']);
  assert.deepEqual(report.events[0], {time:NOW, action:'unknown', screen:'Unknown', code:'unknown', outcome:'unknown', committed:null});
  diagnostics.record(new Error('internal'), 'dynamic private context', {action:'rounding-apply', screen:'Dashboard'});
  assert.equal(diagnostics.safeReport().events[1].action, 'rounding-apply');
  assert.equal(diagnostics.safeReport().events[1].screen, 'Dashboard');
  const invalidClock = log({now:() => secret});
  invalidClock.record(error);
  assert.equal(JSON.stringify(invalidClock.safeReport()).includes(secret), false);
});

test('unknown metadata is discarded without coercion and detailed strings are bounded', () => {
  const diagnostics = log(), hostileValue = {toString(){throw Error('must not coerce safe metadata');}};
  const entry = diagnostics.record({message:'m'.repeat(5000), stack:'s'.repeat(5000), code:hostileValue}, 'c'.repeat(5000), {action:hostileValue, screen:hostileValue});
  assert.deepEqual([entry.message.length, entry.stack.length, entry.context.length], [4000, 4000, 4000]);
  assert.equal(entry.action, 'unknown');
  assert.equal(entry.screen, 'Unknown');
  assert.equal(entry.code, 'unknown');
  diagnostics.entries.push({time:'private timestamp', action:'private action', screen:'private screen', committed:true, revision:4, code:'private code'});
  assert.deepEqual(diagnostics.safeReport().events.at(-1), {time:null, action:'unknown', screen:'Unknown', code:'unknown', outcome:'unknown', committed:null});
});

test('logging never throws for hostile getters, causes, cycles, clocks or failed entry storage', () => {
  const diagnostics = log({now:() => {throw Error('clock unavailable');}});
  const hostile = new Proxy({}, {get(){throw Error('getter unavailable');}});
  assert.doesNotThrow(() => diagnostics.record(hostile, hostile, hostile));
  assert.equal(diagnostics.entries.length, 1);
  assert.equal(diagnostics.entries[0].time, null);
  const cyclic = new Error('cycle');
  cyclic.cause = cyclic;
  assert.doesNotThrow(() => diagnostics.record(cyclic));
  let causeReads = 0;
  const chain = () => Object.defineProperty({}, 'cause', {get(){causeReads++; return chain();}});
  assert.doesNotThrow(() => diagnostics.record(chain()));
  assert.ok(causeReads <= 16);
  Object.freeze(diagnostics.entries);
  assert.doesNotThrow(() => diagnostics.record(new Error('storage unavailable')));
  assert.equal(diagnostics.record(new Error('still unavailable')), undefined);
});
