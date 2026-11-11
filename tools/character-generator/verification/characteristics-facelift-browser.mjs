// Presentation regressions use temporary browser contexts and synthetic saves only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession, execute, exportSession, project} from '../engine/session.mjs';
import {simpleActionLog} from '../gui/simple-log.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';

const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const key = 'traveller-character-generator.v1';
const out = new URL('./artifacts/', import.meta.url);
await mkdir(out, {recursive: true});
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({headless: true,
  ...(process.env.CHARACTER_BROWSER_CHANNEL ? {channel: process.env.CHARACTER_BROWSER_CHANNEL} : {})});
const checks = [], errors = [];
const saved = page => page.evaluate(key => localStorage.getItem(key), key);
const ready = page => page.waitForFunction(() => !document.querySelector('#export').disabled);
const count = async page => JSON.parse(await saved(page)).events.length;
const projection = async page => project(JSON.parse(await saved(page)));
const screenshot = (page, name) => page.screenshot({path: fileURLToPath(new URL(name + '.png', out)), fullPage: true});

async function changed(page, before) {
  await page.waitForFunction(({key, before}) =>
    JSON.parse(localStorage.getItem(key)).events.length > before && !document.querySelector('#export').disabled,
  {key, before});
}

async function doubleActivate(page, action) {
  const before = await count(page);
  await page.locator('[data-action="' + action + '"]').evaluate(button => { button.click(); button.click(); });
  await changed(page, before);
  assert.equal(await count(page), before + 1, action + ' must record only one repeated activation');
}

async function noOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, label);
  assert.deepEqual(await page.locator('#workspace .stats > .stat:not([data-optional-stat])').evaluateAll(cards => cards.flatMap(card => {
    const bounds = card.getBoundingClientRect();
    return [...card.children].filter(child => child.getBoundingClientRect().right > bounds.right + 1)
      .map(child => child.textContent);
  })), [], label + ' score card contents');
}

async function statisticsOrder(page) {
  const result = await page.evaluate(() => {
    const selectors = ['#workspace > .stats', '.statistics-swap', '.statistics-summary', '.statistics-actions', '#statistics-gm-controls'];
    const nodes = selectors.map(selector => document.querySelector(selector)).filter(Boolean);
    const bounds = nodes.map(node => {const r=node.getBoundingClientRect(); return {top:r.top,bottom:r.bottom};});
    const total = document.querySelector('.statistics-total-value');
    return {bounds, last: document.querySelector('#workspace').lastElementChild.id,
      totalFont:parseFloat(getComputedStyle(total).fontSize), labelFont:parseFloat(getComputedStyle(total.parentElement).fontSize),
      order:nodes.every((node,index) => !index || !!(nodes[index-1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))};
  });
  assert.equal(result.order, true, 'DOM and keyboard order follows the requested sequence');
  assert.equal(result.last, 'statistics-gm-controls', 'GM controls are at the very bottom');
  for (let i=1;i<result.bounds.length;i++) assert.ok(result.bounds[i].top >= result.bounds[i-1].bottom-1, 'visual order follows DOM order');
  assert.ok(result.totalFont >= 36 && result.totalFont >= result.labelFont*2, 'raw total number is prominent');
}

async function compactRollDetails(page, rerolled) {
  const before = await saved(page), log = await downloadedActionLog(page), current = await projection(page);
  const text = rerolled ? 'Six characteristics rerolled.' : 'Six characteristics rolled.';
  const panel = page.locator('#last-action-result');
  assert.ok((await panel.innerText()).includes(text));
  assert.doesNotMatch(await panel.innerText(), /previous|Base total|STR:/);
  assert.equal(await page.locator('#message').textContent(), text);
  const trigger = page.locator('[data-action="statistics-roll-details"]');
  await trigger.focus(); await trigger.press('Enter');
  assert.equal(await page.locator('#simple-action-log').evaluate(node=>node.open), true);
  assert.equal(await page.locator('#simple-log-title').evaluate(node=>node===document.activeElement), true);
  assert.equal(await page.locator('#simple-log-content').textContent(), simpleActionLog(current.log));
  assert.match(await page.locator('#simple-log-content').innerText(), /STR: \[/);
  if(rerolled) assert.match(await page.locator('#simple-log-content').innerText(), /Rerolled statistics; previous/);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#simple-log-content').evaluate(node=>node===document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-simple-log-close]').evaluate(node=>node===document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(node=>node===document.activeElement), true);
  await trigger.evaluate(button=>{button.click();button.click();});
  await page.locator('[data-simple-log-close]').click();
  assert.equal(await page.locator('#simple-action-log').evaluate(node=>node.open), false);
  assert.equal(await trigger.evaluate(node=>node===document.activeElement), true);
  assert.equal(await saved(page), before, 'roll details cannot mutate saved state');
  assert.equal(await downloadedActionLog(page), log, 'roll details cannot mutate the full log');
  await statisticsOrder(page);
}

async function headerStyle(page) {
  return page.evaluate(() => {
    const styles = selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return [style.color, style.backgroundColor, style.backgroundImage, style.fontFamily];
    };
    return {body: styles('body'), header: styles('header'), title: styles('header h1'),
      titleText: document.querySelector('header h1').textContent,
      leadText: document.querySelector('header .lead').textContent};
  });
}

async function generationHelp(page) {
  const before = await saved(page), log = await downloadedActionLog(page);
  const trigger = page.locator('#workspace [data-opening-help="generation"]');
  await trigger.focus();
  await trigger.press('Enter');
  assert.equal(await page.locator('#opening-help-dialog').evaluate(dialog => dialog.open), true);
  assert.equal(await page.locator('#opening-help-title').evaluate(node => node === document.activeElement), true);
  assert.match(await page.locator('#opening-help-copy').innerText(), /six raw scores|six-score/);
  await noOverflow(page, 'generation help');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-opening-help-close]').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('[data-opening-help-close]').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#opening-help-dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  await trigger.click();
  await page.locator('[data-opening-help-close]').click();
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  assert.equal(await saved(page), before, 'help must not alter the save');
  assert.equal(await downloadedActionLog(page), log, 'help must not alter the audit log');
}

async function verifyCards(page, state) {
  assert.equal(await page.locator('#workspace .stats > .stat:not([data-optional-stat])').count(), 6);
  assert.equal(await page.locator('#workspace .stat-empty').count(), 0);
  for (const [index, score] of state.pool.entries()) {
    const card = page.locator('#workspace .stats > .stat:not([data-optional-stat])').nth(index);
    assert.equal(await card.locator('.code').textContent(), score.key);
    assert.equal(await card.locator('strong').textContent(), String(score.value));
    const text = await card.innerText();
    assert.ok(text.includes((score.divisor === 2 ? 'Raw ' : 'Base ') + score.base));
    assert.match(text, new RegExp((score.adjustment >= 0 ? '\\+' : '') + score.adjustment + ' species'));
    assert.ok(text.includes(score.count + 'D'));
    assert.equal(text.includes('+ boon'), score.boon);
    if (score.divisor === 2) assert.match(text, /round up/);
  }
  assert.match((await page.locator('.total').innerText()).replace(/\s+/g, ' '), new RegExp('Raw total: ' + state.rollTotal));
  assert.equal(await page.getByRole('button', {name: 'Reroll this set', exact: true}).isEnabled(), state.statisticsCanReroll);
  assert.equal(await page.locator('#swap-a').count(), Number(state.config.allocation || state.config.gm));
}

async function withPage(transport, width, label, raw, work) {
  const context = await browser.newContext({viewport: {width, height: 1100}});
  const page = await context.newPage(), requests = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(label + ': ' + error.message));
  page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(origin + (transport === 'http' ? '/?api=local' : '/'));
    await page.locator('#setup-form').waitFor();
    if (raw) {
      await page.evaluate(({key, raw}) => localStorage.setItem(key, raw), {key, raw});
      await page.reload();
      await page.locator('body[data-stage="statistics"]').waitFor();
    }
    await work(page);
    await noOverflow(page, label);
    if (transport === 'http') {
      assert.ok(requests.some(url => url.includes('/api/v1')));
      assert.ok(!requests.some(url => /\/engine\//.test(url)), 'HTTP UI must not import the engine');
    }
    checks.push(label);
  } finally {
    await context.close();
  }
}

function fixture({species = 'human', total = 43, allocation = true, minimumReroll = true,
  gm = false, aezorghTwoDice = false, minimumTotal} = {}) {
  const seed = ['characteristics', species, total, +allocation, +minimumReroll, +gm, +aezorghTwoDice, minimumTotal ?? 'default'].join('-');
  let result = {session: createSession(seed)};
  const run = (type, payload = {}) => result = execute(result.session, {type, payload});
  run('configure', {allocation, minimumReroll, aezorghTwoDice, ...(minimumTotal === undefined ? {} : {minimumTotal})});
  run('setup', {species, name: 'Synthetic characteristic regression'});
  run('gm-mode', {enabled: true});
  run('roll-statistics');
  const bases = species === 'aezorgh' && !aezorghTwoDice ? [4, 7, 4, 7, 4, 4] : [7, 7, 7, 7, 7, 8];
  bases[0] += total - bases.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < bases.length; index++) {
    run('gm-override', {field: 'pool', index, value: bases[index], reason: 'Synthetic threshold fixture'});
  }
  if (!gm) run('gm-mode', {enabled: false});
  return exportSession(result.session);
}


const primaryCards = '#workspace .stats > .stat:not([data-optional-stat])';
const pendingCards = '#workspace [data-optional-stat]';

function optionalFixture(extras, {species = 'human', culture} = {}) {
  let session = createSession('optional-presentation-' + species + '-' + (culture || 'default') + '-' + extras.join('-'));
  session = execute(session, {type: 'configure', payload: {extras, minimumTotal: 72}}).session;
  session = execute(session, {type: 'setup', payload: {species, ...(culture ? {culture} : {}), name: 'Synthetic optional preview'}}).session;
  return exportSession(session);
}

async function pendingLayout(page, extras, width, label) {
  assert.equal(await page.locator(primaryCards).count(), 6, label + ' preserves six primary cards');
  assert.deepEqual((await page.locator(pendingCards).evaluateAll(nodes => nodes.map(node => node.dataset.optionalStat))).sort(),
    [...extras].sort(), label + ' displays only enabled, applicable extras');
  const displayed = await page.locator(pendingCards).evaluateAll(nodes => nodes.map(node => ({
    code: node.dataset.optionalStat, text: node.textContent,
    values: [...node.querySelectorAll('strong')].map(value => value.textContent),
  })));
  for (const card of displayed) {
    assert.match(card.text, card.code === 'PSI' ? /Untested/ : /Pending|After Keep/i, label + ' has explicit pending status');
    assert.ok(card.values.every(value => !/\d/.test(value)), label + ' does not invent numeric extra values');
  }
  const grouped = extras.some(code => code !== 'PSI');
  const lonePsi = extras.length === 1 && extras[0] === 'PSI';
  assert.equal(await page.locator('#workspace .statistics-extras').count(), Number(grouped));
  assert.equal(await page.locator('#workspace .stats.statistics-psi-inline').count(), Number(lonePsi));
  if (grouped) {
    assert.equal(await page.locator('#workspace .stats [data-optional-stat]').count(), extras.length, label + ' all extras share the primary grid');
    assert.equal(await page.locator('#workspace .stats > .statistics-extras [data-optional-stat]').count(), extras.length);
  }
  const geometry = await page.evaluate(({primaryCards, pendingCards}) => {
    const bounds = node => { const r = node.getBoundingClientRect(), heading = node.querySelector('.code').getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height, headingTop:heading.top-r.top}; };
    return {primary: [...document.querySelectorAll(primaryCards)].map(bounds),
      extra: [...document.querySelectorAll(pendingCards)].map(bounds)};
  }, {primaryCards, pendingCards});
  if (lonePsi && width === 1440) {
    assert.ok(geometry.primary.every(card => Math.abs(card.top - geometry.primary[0].top) < 2), label + ' desktop primary row');
    assert.ok(Math.abs(geometry.extra[0].top - geometry.primary[0].top) < 2, label + ' lone PSI shares desktop row');
  }
  if (lonePsi && width < 400) assert.ok(geometry.extra[0].top > geometry.primary[0].top, label + ' PSI wraps on mobile');
  if (grouped) for (const card of geometry.extra) {
    assert.ok(card.top >= Math.max(...geometry.primary.map(card => card.bottom)) - 1, label + ' optional group is below all six primary cards');
  }
  for (const card of geometry.extra) {
    assert.ok(Math.abs(card.width - geometry.primary[0].width) <= 1, label + ' optional card matches primary width: ' + JSON.stringify(geometry));
    assert.ok(Math.abs(card.height - geometry.primary[0].height) <= 1, label + ' optional card matches primary height: ' + JSON.stringify(geometry));
    assert.ok(Math.abs(card.headingTop - geometry.primary[0].headingTop) <= 1, label + ' optional header is top-aligned with primary headers: ' + JSON.stringify(geometry));
  }
  await noOverflow(page, label);
  const overflowing = await page.locator(pendingCards).evaluateAll(nodes => nodes.flatMap(node => {
    const bounds = node.getBoundingClientRect();
    return [...node.children].filter(child => child.getBoundingClientRect().right > bounds.right + 1 || child.getBoundingClientRect().left < bounds.left - 1)
      .map(child => child.textContent);
  }));
  assert.deepEqual(overflowing, [], label + ' optional text stays inside cards');
  const targets = await page.locator('#workspace .statistics-actions button, #workspace [data-opening-help], #workspace .statistics-swap select, #workspace .statistics-swap button')
    .evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
      const r = node.getBoundingClientRect(); return {text: node.getAttribute('aria-label') || node.textContent, width:r.width, height:r.height};
    }));
  for (const target of targets) assert.ok(target.width >= 43.5 && target.height >= 43.5, label + ' minimum 44px target: ' + JSON.stringify(target));
  return geometry;
}

async function optionalHelp(page, label) {
  const triggers = page.locator('#workspace [data-opening-help="extras"]');
  if (!(await triggers.count())) return;
  const before = await saved(page), log = await downloadedActionLog(page);
  for (let index = 0; index < await triggers.count(); index++) {
    const trigger = triggers.nth(index);
    await trigger.focus();
    await trigger.press('Enter');
    assert.equal(await page.locator('#opening-help-dialog').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('#opening-help-title').evaluate(node => node === document.activeElement), true);
    assert.match(await page.locator('#opening-help-copy').innerText(), /potential|six-score/i);
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, label + ' Escape returns extra-help focus');
    await trigger.click();
    await page.locator('[data-opening-help-close]').click();
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, label + ' Close returns extra-help focus');
  }
  assert.equal(await saved(page), before, label + ' extra help cannot mutate saved state');
  assert.equal(await downloadedActionLog(page), log, label + ' extra help cannot mutate audit log');
}

try {
  for (const width of [1440, 390, 320]) for (const transport of ['static', 'http']) {
    const label = 'characteristics-' + transport + '-' + width;
    await withPage(transport, width, label + '-interactive', null, async page => {
      assert.equal(await page.locator('#setup-gm-controls').evaluate(details => details.open), false);
      assert.equal(await page.locator('#setup-gm-controls #setup-gm-settings [name=boons]').count(), 1);
      assert.deepEqual(await page.locator('[name=boons] option').evaluateAll(options => options.map(option => option.value)),
        ['0', '1', '2', '3', '4', '5', '6']);
      assert.equal(await page.locator('[name=boons]').isVisible(), false);
      const openingHeader = await headerStyle(page);
      await page.locator('#opening-gm-title').click();
      await page.locator('[name=boons]').selectOption('3');
      await page.locator('#minimum-total').fill('72');
      await page.locator('#setup-optional-settings > summary').click();
      await page.locator('[name=extras][value=LCK]').check();
      await page.locator('[name=extras][value=PSI]').check();
      await page.locator('[name=name]').fill('Characteristic presentation fixture');
      await page.getByRole('button', {name: 'Begin character', exact: true}).click();
      await page.getByRole('button', {name: 'Roll six characteristics', exact: true}).waitFor();
      await ready(page);
      assert.deepEqual(await headerStyle(page), openingHeader, 'opening header styling continues through statistics');
      assert.equal(await page.locator('#workspace .stats .stat-empty').count(), 6);
      assert.equal(await page.locator('#workspace .stats > .stat:not([data-optional-stat])').count(), 6);
      assert.deepEqual(await page.locator('#workspace .stats > .stat:not([data-optional-stat]) .code').allTextContents(), ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC']);
      assert.ok((await page.locator('#workspace .stats > .stat:not([data-optional-stat]) strong').allTextContents()).every(value => !/\d/.test(value)));
      assert.equal(await page.locator('#statistics-gm-controls #gm-controls').count(), 1);
      assert.equal(await page.locator('#gm-controls').evaluate(details => details.open), false);
      assert.equal(await page.locator('#gm-toggle').count(), 1);
      assert.equal(await page.locator('#sheet #gm-controls').count(), 0);
      assert.equal(await page.locator('[name=boons]').count(), 0, 'statistics boon count is read-only');
      assert.match(await page.locator('#statistics-gm-controls').innerText(), /3/);
      const initial = await saved(page);
      await generationHelp(page);
      await page.reload();
      await page.getByRole('button', {name: 'Roll six characteristics', exact: true}).waitFor();
      assert.equal(await saved(page), initial, 'unrolled statistics reload retains exact save');
      await statisticsOrder(page);
      await screenshot(page, label + '-before');
      await doubleActivate(page, 'roll-statistics');
      await compactRollDetails(page, false);
      await screenshot(page, label + '-layout-first-roll');
      let current = await projection(page);
      await verifyCards(page, current.state);
      assert.deepEqual(current.log.at(-1).rolls.map(roll => roll.values.length), [3, 3, 3, 2, 2, 2]);
      assert.deepEqual([...current.state.config.extras].sort(), ['LCK', 'PSI']);
      assert.deepEqual(await headerStyle(page), openingHeader);
      await generationHelp(page);
      const firstRoll = JSON.parse(await saved(page));
      await page.locator('#swap-a').selectOption('0');
      await page.locator('#swap-b').selectOption('1');
      await doubleActivate(page, 'swap-statistics');
      const swapped = await projection(page);
      assert.equal(swapped.state.pool[0].base, current.state.pool[1].base);
      assert.equal(swapped.state.pool[1].base, current.state.pool[0].base);
      assert.equal(swapped.state.rollTotal, current.state.rollTotal);
      assert.deepEqual(JSON.parse(await saved(page)).events.slice(0, firstRoll.events.length), firstRoll.events);
      await doubleActivate(page, 'roll-statistics');
      current = await projection(page);
      await verifyCards(page, current.state);
      await compactRollDetails(page, true);
      await screenshot(page, label + '-layout-reroll');
      await page.locator('#gm-controls > summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#gm-controls').evaluate(details => details.open), true);
      let before = await count(page);
      await page.locator('#gm-toggle').check();
      await changed(page, before);
      assert.equal(await page.locator('#gm-toggle').count(), 1);
      assert.equal(await page.locator('#gm-controls').evaluate(details => details.open), true);
      before = await count(page);
      await page.locator('#gm-toggle').uncheck();
      await changed(page, before);
      await page.locator('#gm-controls > summary').click();
      await screenshot(page, label + '-rolled');
      const exported = page.waitForEvent('download');
      await page.locator('#export').click();
      const downloaded = await exported;
      const raw = await readFile(await downloaded.path(), 'utf8');
      assert.deepEqual(JSON.parse(raw), JSON.parse(await saved(page)));
      const stableLog = await downloadedActionLog(page);
      await page.reload();
      await page.getByRole('button', {name: 'Keep these characteristics', exact: true}).waitFor();
      await ready(page);
      assert.deepEqual(JSON.parse(await saved(page)), JSON.parse(raw));
      assert.equal(await downloadedActionLog(page), stableLog);
      assert.equal(await page.locator('#gm-controls').evaluate(details => details.open), false);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#import').setInputFiles({name: 'characteristics.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
      await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Character loaded.'));
      await ready(page);
      assert.deepEqual(JSON.parse(await saved(page)), JSON.parse(raw));
      await verifyCards(page, (await projection(page)).state);
      await doubleActivate(page, 'accept-statistics');
      await page.locator('#background-form').waitFor();
      assert.equal((await projection(page)).state.stage, 'background');
      assert.equal(await page.locator('#statistics-gm-controls').count(), 0);
      assert.equal(await page.locator('#sheet #gm-controls').count(), 1);
      assert.equal(await page.locator('#gm-toggle').count(), 1);
      assert.equal(await page.locator('header h1').textContent(), 'CHARACTER BUILDER');
      assert.equal(await page.locator('header .lead').textContent(), 'TRAVELLER RPG');
      assert.ok(Object.hasOwn((await projection(page)).state.character.stats, 'LCK'));
      assert.equal((await projection(page)).state.character.stats.PSI, undefined);
      await page.locator('#background-record > summary').click();
      assert.match(await page.locator('#psi-choice-sheet').innerText(), /Untested/);
      await screenshot(page, label + '-background');
      const background = (await projection(page)).state;
      for (let i = 0; i < background.backgroundRemaining; i++) await page.locator('#background-form [name=skills]').nth(i).check();
      await page.getByRole('button', {name: 'Accept background skills', exact: true}).click();
      await page.getByRole('heading', {name: 'Before your career', exact: true}).waitFor();
      assert.equal(await page.locator('header h1').textContent(), 'CHARACTER BUILDER');
      assert.deepEqual(await headerStyle(page), openingHeader, 'later stages retain the shared theme');
    });

    const scenarios = [
      {name: 'human-below', total: 42, reroll: true},
      {name: 'human-at-threshold', total: 43, reroll: false},
      {name: 'minimum-disabled', total: 42, minimumReroll: false, reroll: false},
      {name: 'allocation-disabled', total: 43, allocation: false, reroll: false},
      {name: 'gm-exception', total: 43, allocation: false, minimumReroll: false, gm: true, reroll: true},
      {name: 'vargr-social-key', species: 'vargr', total: 43, reroll: false},
      {name: 'aezorgh-below', species: 'aezorgh', total: 29, reroll: true},
      {name: 'aezorgh-at-threshold', species: 'aezorgh', total: 30, reroll: false},
      {name: 'aezorgh-optional-below', species: 'aezorgh', aezorghTwoDice: true, total: 42, reroll: true},
      {name: 'aezorgh-optional-at-threshold', species: 'aezorgh', aezorghTwoDice: true, total: 43, reroll: false},
    ];
    for (const scenario of scenarios) {
      await withPage(transport, width, label + '-' + scenario.name, fixture(scenario), async page => {
        await ready(page);
        const initial = await projection(page), raw = await saved(page);
        await verifyCards(page, initial.state);
        await statisticsOrder(page);
        assert.equal(await page.getByRole('button', {name: 'Reroll this set', exact: true}).isEnabled(), scenario.reroll);
        if (scenario.species === 'vargr') assert.equal(await page.locator('#workspace .code').last().textContent(), 'CHA');
        if (scenario.species === 'aezorgh' && !scenario.aezorghTwoDice) {
          await page.locator('#swap-a').selectOption('0');
          await page.locator('#swap-b').selectOption('1');
          await page.getByRole('button', {name: 'Swap scores', exact: true}).click();
          await ready(page);
          assert.match(await page.locator('#message').innerText(), /GM|group|formula/i);
          assert.equal(await saved(page), raw, 'rejected cross-group swap is atomic');
          await page.locator('#swap-b').selectOption('5');
          await doubleActivate(page, 'swap-statistics');
          assert.equal((await projection(page)).state.rollTotal, initial.state.rollTotal);
        }
        if (scenario.aezorghTwoDice) {
          await page.locator('#swap-a').selectOption('0');
          await page.locator('#swap-b').selectOption('1');
          await doubleActivate(page, 'swap-statistics');
          const current = await projection(page);
          assert.equal(current.state.pool[0].base, initial.state.pool[1].base);
          assert.equal(current.state.pool[0].divisor, 2);
          assert.equal(current.state.pool[0].derivedBase, Math.ceil(initial.state.pool[1].base / 2));
          assert.equal(current.state.pool[1].divisor, 1);
          await verifyCards(page, current.state);
        }
        const stable = await saved(page);
        await page.reload();
        await page.getByRole('button', {name: 'Keep these characteristics', exact: true}).waitFor();
        await ready(page);
        assert.equal(await saved(page), stable);
        assert.equal(await page.getByRole('button', {name: 'Reroll this set', exact: true}).isEnabled(), scenario.reroll);
      });
    }
  }

  const optionalScenarios = [
    {name: 'none', extras: []},
    {name: 'psi-only', extras: ['PSI']},
    {name: 'psi-luck', extras: ['PSI', 'LCK']},
    {name: 'luck-only', extras: ['LCK']},
    {name: 'all-extras', extras: ['PSI', 'LCK', 'MRL', 'STY', 'WLT', 'CHA']},
  ];
  for (const width of [1440, 390, 320]) for (const transport of ['static', 'http']) for (const scenario of optionalScenarios) {
    const label = 'optional-characteristics-' + transport + '-' + width + '-' + scenario.name;
    await withPage(transport, width, label, optionalFixture(scenario.extras), async page => {
      await ready(page);
      const initialSave = await saved(page);
      const initial = await projection(page);
      assert.equal(initial.state.pool.length, 0);
      assert.deepEqual(initial.state.character.stats, {});
      await pendingLayout(page, scenario.extras, width, label + '-before');
      await generationHelp(page);
      await optionalHelp(page, label);
      assert.equal(await saved(page), initialSave);
      await statisticsOrder(page);
      await screenshot(page, label + '-before');
      await doubleActivate(page, 'roll-statistics');
      const rolled = await projection(page);
      assert.equal(rolled.state.pool.length, 6);
      assert.equal(rolled.log.at(-1).rolls.length, 6);
      assert.deepEqual(rolled.log.at(-1).rolls.map(roll => roll.label), ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC']);
      assert.deepEqual(rolled.state.character.stats, {}, 'selected extras are not rolled before Keep');
      await verifyCards(page, rolled.state);
      await pendingLayout(page, scenario.extras, width, label + '-rolled');
      for (const selector of ['#swap-a', '#swap-b']) {
        assert.deepEqual(await page.locator(selector + ' option').evaluateAll(options => options.map(option => option.value)), ['0', '1', '2', '3', '4', '5']);
      }
      await page.locator('#swap-a').selectOption('0');
      await page.locator('#swap-b').selectOption('5');
      await doubleActivate(page, 'swap-statistics');
      const swapped = await projection(page);
      assert.equal(swapped.state.pool[5].base, rolled.state.pool[0].base);
      assert.equal(swapped.state.rollTotal, rolled.state.rollTotal);
      assert.deepEqual(swapped.state.character.stats, {});
      await generationHelp(page);
      await optionalHelp(page, label);
      await screenshot(page, label + '-rolled');
      const raw = await saved(page), log = await downloadedActionLog(page);
      await page.reload();
      await page.getByRole('button', {name: 'Keep these characteristics', exact: true}).waitFor();
      await ready(page);
      assert.equal(await saved(page), raw, label + ' exact reload');
      assert.equal(await downloadedActionLog(page), log);
      await pendingLayout(page, scenario.extras, width, label + '-reload');
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#import').setInputFiles({name: 'optional-characteristics.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
      await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Character loaded.'));
      await ready(page);
      assert.deepEqual(JSON.parse(await saved(page)), JSON.parse(raw), label + ' exact import');
      await pendingLayout(page, scenario.extras, width, label + '-import');
      await doubleActivate(page, 'accept-statistics');
      await page.locator('#background-form').waitFor();
      const accepted = await projection(page);
      const expected = project(execute(JSON.parse(raw), {type: 'accept-statistics', payload: {}}, {id: accepted.log.at(-1).id}).session);
      assert.deepEqual(accepted.state, expected.state, label + ' Keep retains exact existing engine state');
      assert.deepEqual(accepted.log, expected.log, label + ' Keep retains exact existing audit and dice');
      assert.deepEqual(Object.keys(accepted.state.character.stats).sort(), ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC', ...scenario.extras.filter(code => code !== 'PSI')].sort());
      assert.deepEqual(accepted.log.at(-1).rolls.map(roll => roll.label), scenario.extras.filter(code => !['WLT', 'PSI'].includes(code)));
      if (scenario.extras.includes('WLT')) assert.equal(accepted.state.character.stats.WLT, swapped.state.pool[5].value);
      for (const roll of accepted.log.at(-1).rolls) assert.equal(roll.values.length, 2, 'each rolled optional extra uses existing 2D method');
      const kept = await saved(page);
      await page.reload();
      await page.locator('#background-form').waitFor();
      await ready(page);
      assert.equal(await saved(page), kept, label + ' accepted extras persist through reload');
    });
  }
  for (const transport of ['static', 'http']) for (const speciesCase of [
    {species: 'vargr', culture: 'native', baseKey: 'CHA'},
    {species: 'vargr', culture: 'imperial', baseKey: 'SOC'},
    {species: 'aezorgh', baseKey: 'SOC'},
  ]) {
    const label = 'optional-species-' + transport + '-' + speciesCase.species + '-' + (speciesCase.culture || 'default');
    await withPage(transport, 320, label, optionalFixture(['CHA', 'PSI'], speciesCase), async page => {
      await ready(page);
      assert.deepEqual(await page.locator(primaryCards + ' .code').allTextContents(), ['STR', 'DEX', 'END', 'INT', 'EDU', speciesCase.baseKey]);
      const extras = (speciesCase.species === 'aezorgh' || speciesCase.species === 'vargr' && speciesCase.culture === 'imperial') ? ['CHA', 'PSI'] : ['PSI'];
      await pendingLayout(page, extras, 320, label + '-before');
      await doubleActivate(page, 'roll-statistics');
      await verifyCards(page, (await projection(page)).state);
      await pendingLayout(page, extras, 320, label + '-rolled');
      const raw = await saved(page);
      await doubleActivate(page, 'accept-statistics');
      const actual = await projection(page);
      const expected = project(execute(JSON.parse(raw), {type: 'accept-statistics', payload: {}}, {id: actual.log.at(-1).id}).session);
      assert.deepEqual(actual.state, expected.state);
      assert.deepEqual(actual.log, expected.log);
      assert.ok(Object.hasOwn(actual.state.character.stats, 'CHA'), label + ' required or explicitly selected CHA remains');
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('characteristics-facelift-browser-results.json', out), JSON.stringify({checks, errors}, null, 2));
  console.log(JSON.stringify({checks, errors}, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
