import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {catalog, createSession, execute, project} from '../engine/session.mjs';
import {emptyStatisticsView, statisticsSummaryView, statisticsControlsView} from '../gui/characteristics-presentation.mjs';
import {gmControlsView} from '../gui/character-controls.mjs';

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const options = (items, selected) => items.map(item => '<option value="' + esc(item.id) + '"' +
  (item.id === selected ? ' selected' : '') + '>' + esc(item.name) + '</option>').join('');
const button = (label, action, css = '', attrs = '') => '<button data-action="' + action + '" class="' + css + '" ' + attrs + '>' + label + '</button>';
const source = readFileSync(new URL('../gui/app.mjs', import.meta.url), 'utf8');
const statisticsSource = source.slice(source.indexOf('function statCards('), source.indexOf('\nfunction backgroundView('));

function fixture(species = 'human', rolled = false) {
  let session = execute(createSession('characteristics-view-' + species), {type: 'setup', payload: {species}}).session;
  if (rolled) session = execute(session, {type: 'roll-statistics'}).session;
  return project(session);
}

function render(projection) {
  return vm.runInNewContext(statisticsSource + ';statisticsView(projection.state)', {
    projection, catalog: catalog(), esc, options, button, gmControlsView,
    emptyStatisticsView, statisticsSummaryView, statisticsControlsView,
  });
}

for (const species of ['human', 'aslan', 'vargr', 'aezorgh']) {
  test(species + ' unrolled view has six species-correct placeholders without changing the session', () => {
    const projection = fixture(species), before = JSON.stringify(projection);
    const html = render(projection);
    const expected = Object.keys(catalog().species.find(item => item.id === species).dice).slice(0, 6);
    assert.deepEqual([...html.matchAll(/class="code">([^<]+)</g)].map(match => match[1]), expected);
    assert.equal((html.match(/class="stat stat-empty"/g) ?? []).length, 6);
    assert.equal((html.match(/aria-label="Not rolled"/g) ?? []).length, 6);
    assert.match(html, /Raw total: [\u2014-]/);
    assert.match(html, /data-action="roll-statistics"/);
    assert.doesNotMatch(html, /data-action="accept-statistics"|id="swap-a"/);
    assert.equal(JSON.stringify(projection), before);
  });
}

test('rolled view preserves original score, species modifier and dice details without mutating audit history', () => {
  const projection = fixture('aslan', true), before = JSON.stringify(projection), html = render(projection);
  for (const score of projection.state.pool) {
    assert.ok(html.includes('<span class="code">' + score.key + '</span><strong>' + score.value + '</strong>'));
    assert.ok(html.includes('Base ' + score.base));
    assert.ok(html.includes((score.adjustment >= 0 ? '+' : '') + score.adjustment + ' species'));
    assert.ok(html.includes(score.count + 'D'));
  }
  assert.match(html, /Keep these characteristics/);
  assert.match(html, /Species modifiers and extra characteristics are excluded/);
  assert.equal(JSON.stringify(projection), before);
});

test('swap and reroll visibility continue to use the projected rules, not presentation totals', () => {
  for (const allocation of [false, true]) for (const gm of [false, true]) for (const canReroll of [false, true]) {
    const projection = fixture('human', true);
    Object.assign(projection.state.config, {allocation, gm});
    projection.state.statisticsCanReroll = canReroll;
    const html = render(projection);
    assert.equal(html.includes('id="swap-a"'), allocation || gm);
    assert.equal(html.includes('id="swap-b"'), allocation || gm);
    const reroll = html.match(/<button[^>]*data-action="roll-statistics"[^>]*>/)?.[0];
    assert.ok(reroll);
    assert.equal(/\bdisabled\b/.test(reroll), !canReroll);
    assert.equal((html.match(/id="gm-toggle"/g) ?? []).length, 1);
  }
});

test('statistics GM wrapper retains the single controls disclosure and a read-only setup boon count', () => {
  for (const gm of [false, true]) {
    const projection = fixture('human', true);
    Object.assign(projection.state.config, {boons: 4, gm});
    const before = JSON.stringify(projection);
    const original = gmControlsView(projection.state, projection.log, {esc, options});
    const html = statisticsControlsView(projection.state, original, {esc});
    assert.match(html, /^<div id="statistics-gm-controls"><details id="gm-controls">/);
    assert.match(html, /<summary><span>GM Controls<\/span>/);
    assert.match(html, /Setup: 4 boon rolls/);
    assert.ok(html.includes('Corrections ' + (gm ? 'on' : 'off')));
    assert.match(html, /Boon rolls: 4 of six/);
    assert.doesNotMatch(html, /name="boons"/);
    assert.equal((html.match(/id="gm-toggle"/g) ?? []).length, 1);
    assert.equal(JSON.stringify(projection), before);
  }
});

test('minimum total and Aezorgh halving explanations retain the projected threshold and configuration', () => {
  const projection = fixture('aezorgh', true);
  Object.assign(projection.state.config, {minimumReroll: false, aezorghTwoDice: true});
  projection.state.statisticsRerollThreshold = 45;
  const before = JSON.stringify(projection);
  const html = statisticsSummaryView(projection.state, {esc});
  assert.match(html, /Reroll threshold: 45/);
  assert.match(html, /Minimum-total rerolls are off/);
  assert.match(html, /before placement and halving/);
  assert.equal(JSON.stringify(projection), before);
});
