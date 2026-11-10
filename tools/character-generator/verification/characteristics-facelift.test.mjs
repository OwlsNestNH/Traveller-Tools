import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {catalog, createSession, execute, project} from '../engine/session.mjs';
import {emptyStatisticsView, statisticsSummaryView, statisticsControlsView, statisticsCardsView, statisticsRollFeedback, statisticsRollFeedbackView} from '../gui/characteristics-presentation.mjs';
import {gmControlsView} from '../gui/character-controls.mjs';
import {openingInfoButton} from '../gui/opening-help.mjs';

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
    emptyStatisticsView, statisticsSummaryView, statisticsControlsView, statisticsCardsView, openingInfoButton,
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
    assert.match(html, /Raw total: <strong class="statistics-total-value">[\u2014-]<\/strong>/);
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


const optionalCases = [[], ['PSI'], ['PSI', 'LCK'], ['LCK'], ['PSI', 'LCK', 'MRL', 'STY', 'WLT', 'CHA']];
function optionalFixture(extras, rolled = false, species = 'human', culture) {
  let session = execute(createSession('optional-statistics-view-' + species + '-' + extras.join('-')),
    {type: 'configure', payload: {extras}}).session;
  session = execute(session, {type: 'setup', payload: {species, ...(culture ? {culture} : {})}}).session;
  if (rolled) session = execute(session, {type: 'roll-statistics'}).session;
  return {session, projection: project(session)};
}

for (const extras of optionalCases) for (const rolled of [false, true]) {
  test('enabled extras ' + (extras.join('+') || 'none') + ' stay pending ' + (rolled ? 'after' : 'before') + ' six-score roll', () => {
    const {session, projection} = optionalFixture(extras, rolled);
    const before = JSON.stringify(projection), save = JSON.stringify(session), html = render(projection);
    const displayed = [...html.matchAll(/data-optional-stat="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(displayed.sort(), [...extras].sort());
    assert.equal(html.includes('statistics-psi-inline'), extras.length === 1 && extras[0] === 'PSI');
    assert.equal(/class="[^"]*\bstatistics-extras\b/.test(html), extras.some(code => code !== 'PSI'));
    if (extras.includes('PSI')) assert.match(html, /Untested/);
    for (const code of extras) assert.equal(Object.hasOwn(projection.state.character.stats, code), false);
    assert.equal(projection.state.pool.length, rolled ? 6 : 0);
    if (rolled) {
      assert.equal(projection.log.at(-1).rolls.length, 6);
      assert.deepEqual(projection.log.at(-1).rolls.map(roll => roll.label), projection.state.pool.map(score => score.key));
      assert.equal((html.match(/<option value="[0-5]"/g) ?? []).length, 12);
    }
    assert.equal(JSON.stringify(projection), before);
    assert.equal(JSON.stringify(session), save);
  });
}

for (const culture of ['native', 'imperial']) test('Vargr ' + culture + ' six-score placeholders match rolled keys without optional CHA duplication', () => {
  for (const rolled of [false, true]) {
    const {projection} = optionalFixture(['CHA', 'PSI'], rolled, 'vargr', culture);
    const html = render(projection);
    const primary = [...html.matchAll(/<div class="stat(?: stat-empty)?"><span class="code">([^<]+)/g)].map(match => match[1]);
    assert.deepEqual(primary, ['STR', 'DEX', 'END', 'INT', 'EDU', culture === 'imperial' ? 'SOC' : 'CHA']);
    assert.equal((html.match(/data-optional-stat="CHA"/g) ?? []).length, culture === 'imperial' ? 1 : 0, 'only Imperial CHA is optional');
    assert.equal((html.match(/data-optional-stat="PSI"/g) ?? []).length, 1);
  }
});

test('Aezorgh required Charisma is not duplicated as a selected house extra', () => {
  for (const rolled of [false, true]) {
    const {projection} = optionalFixture(['CHA', 'PSI'], rolled, 'aezorgh');
    const html = render(projection);
    assert.equal((html.match(/data-optional-stat="CHA"/g) ?? []).length, 0);
    assert.equal((html.match(/data-optional-stat="PSI"/g) ?? []).length, 1);
  }
});

test('pending extras do not widen swaps, alter reroll total, or change existing Keep timing', () => {
  const extras = ['PSI', 'LCK', 'MRL', 'STY', 'WLT', 'CHA'];
  let {session, projection} = optionalFixture(extras, true);
  const before = JSON.stringify(session);
  assert.throws(() => execute(session, {type: 'swap-statistics', payload: {a: 0, b: 6}}), /0.*5/);
  assert.equal(JSON.stringify(session), before);
  session = execute(session, {type: 'swap-statistics', payload: {a: 0, b: 5}}).session;
  projection = project(session);
  assert.equal(projection.state.pool.length, 6);
  assert.equal(projection.state.rollTotal, projection.state.pool.reduce((sum, score) => sum + score.base, 0));
  const finalSoc = projection.state.pool.find(score => score.key === 'SOC').value;
  const result = execute(session, {type: 'accept-statistics'});
  const accepted = project(result.session);
  assert.deepEqual(Object.keys(accepted.state.character.stats).sort(), ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC', ...extras].sort());
  assert.equal(accepted.state.character.stats.WLT, finalSoc);
  assert.deepEqual(accepted.log.at(-1).rolls.map(roll => roll.label), ['PSI', 'LCK', 'MRL', 'STY', 'CHA']);
  for (const roll of accepted.log.at(-1).rolls) {
    assert.equal(roll.values.length, 2);
    assert.equal(accepted.state.character.stats[roll.label], roll.values.reduce((sum, value) => sum + value, 0));
  }
});

for (const rolled of [false, true]) for (const allocation of [false, true]) test('statistics order keeps the summary by actions and GM controls last: '+rolled+'/'+allocation, () => {
  const projection = fixture('human', rolled);
  projection.state.config.allocation = allocation;
  const html = render(projection);
  const markers = ['class="stats', ...(rolled && allocation ? ['class="statistics-swap"'] : []), 'class="statistics-summary"', 'class="actions statistics-actions"', 'id="statistics-gm-controls"'];
  const positions = markers.map(marker => html.indexOf(marker));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a,b) => a-b));
  assert.ok(html.endsWith(statisticsControlsView(projection.state, gmControlsView(projection.state, projection.log, {esc, options}), {esc})));
});

test('prominent raw total remains the projected six-only total with every extra selected', () => {
  const {projection} = optionalFixture(['PSI', 'LCK', 'MRL', 'STY', 'WLT', 'CHA'], true);
  const before = JSON.stringify(projection);
  const html = statisticsSummaryView(projection.state, {esc});
  assert.ok(html.includes('<strong class="statistics-total-value">'+projection.state.pool.reduce((sum, score) => sum+score.base, 0)+'</strong>'));
  assert.equal(JSON.stringify(projection), before);
});

test('compact roll feedback is statistics-only and preserves the complete result and history', () => {
  let session = execute(createSession('compact-roll-feedback'), {type:'configure', payload:{minimumTotal:72}}).session;
  session = execute(session, {type:'setup', payload:{species:'human'}}).session;
  for (const text of ['Six characteristics rolled.', 'Six characteristics rerolled.']) {
    session = execute(session, {type:'roll-statistics'}).session;
    const projection = project(session), before = JSON.stringify(projection), event = projection.log.at(-1);
    assert.equal(statisticsRollFeedback(event, projection.state), text);
    const html = statisticsRollFeedbackView(event, projection.state, {esc});
    assert.ok(html.includes(text));
    assert.match(html, /aria-controls="simple-action-log"/);
    assert.doesNotMatch(html, /previous|Base total|STR:/);
    assert.match(event.summary, /Base total/);
    assert.equal(event.rolls.length, 6);
    assert.equal(JSON.stringify(projection), before);
    assert.equal(statisticsRollFeedbackView(event, {...projection.state, stage:'background'}, {esc}), null);
    assert.equal(statisticsRollFeedbackView({...event, type:'gm-override'}, projection.state, {esc}), null);
  }
});
