// Presentation regressions use temporary browser contexts and synthetic saves only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession, execute, exportSession, project} from '../engine/session.mjs';
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
  assert.deepEqual(await page.locator('#workspace .stats .stat').evaluateAll(cards => cards.flatMap(card => {
    const bounds = card.getBoundingClientRect();
    return [...card.children].filter(child => child.getBoundingClientRect().right > bounds.right + 1)
      .map(child => child.textContent);
  })), [], label + ' score card contents');
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
  assert.equal(await page.locator('#workspace .stats .stat').count(), 6);
  assert.equal(await page.locator('#workspace .stat-empty').count(), 0);
  for (const [index, score] of state.pool.entries()) {
    const card = page.locator('#workspace .stats .stat').nth(index);
    assert.equal(await card.locator('.code').textContent(), score.key);
    assert.equal(await card.locator('strong').textContent(), String(score.value));
    const text = await card.innerText();
    assert.ok(text.includes((score.divisor === 2 ? 'Raw ' : 'Base ') + score.base));
    assert.match(text, new RegExp((score.adjustment >= 0 ? '\\+' : '') + score.adjustment + ' species'));
    assert.ok(text.includes(score.count + 'D'));
    assert.equal(text.includes('+ boon'), score.boon);
    if (score.divisor === 2) assert.match(text, /round up/);
  }
  assert.match(await page.locator('.total').innerText(), new RegExp('Raw total: ' + state.rollTotal));
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
  let result = {session: createSession('characteristics-' + JSON.stringify(arguments[0] ?? {}))};
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

try {
  for (const width of [1440, 320]) for (const transport of ['static', 'http']) {
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
      assert.equal(await page.locator('#workspace .stats .stat').count(), 6);
      assert.deepEqual(await page.locator('#workspace .stats .code').allTextContents(), ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC']);
      assert.ok((await page.locator('#workspace .stats .stat strong').allTextContents()).every(value => !/\d/.test(value)));
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
      await screenshot(page, label + '-before');
      await doubleActivate(page, 'roll-statistics');
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
      assert.equal(await page.locator('header h1').textContent(), 'A life among the stars');
      assert.notDeepEqual(await headerStyle(page), openingHeader, 'later stages keep their previous theme');
      assert.ok(Object.hasOwn((await projection(page)).state.character.stats, 'LCK'));
      assert.ok(Object.hasOwn((await projection(page)).state.character.stats, 'PSI'));
      await screenshot(page, label + '-background');
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
  assert.deepEqual(errors, []);
  await writeFile(new URL('characteristics-facelift-browser-results.json', out), JSON.stringify({checks, errors}, null, 2));
  console.log(JSON.stringify({checks, errors}, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
