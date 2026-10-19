import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.TRAVELLER_BROWSER_EXECUTABLE ? {executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE} : {})});
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
await mkdir(artifacts, {recursive:true});
const context = await browser.newContext({viewport:{width:1440,height:1100}});
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const url = new URL('player-snapshot-preview.html', base).href;
try {
  await page.goto(url); await page.getByRole('heading', {name:'Planetary information'}).waitFor();
  // Set synthetic sentinel storage once; then throw on all reads/writes by the viewer.
  await page.evaluate(() => {localStorage.setItem('traveller-trade-route-calculator:v1', 'synthetic-sentinel'); sessionStorage.setItem('sentinel', 'unchanged');});
  await context.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) Storage.prototype[method] = () => {throw Error('Viewer touched storage');};
    indexedDB.open = () => {throw Error('Viewer opened database');};
  });
  await page.reload(); await page.getByRole('heading', {name:'Cargo aboard'}).waitFor();
  assert.equal(await page.locator('button,input,select,textarea,form').count(), 0);
  assert.equal(await page.locator('meter').count(), 2);
  assert.equal(await page.locator('details').getAttribute('open'), null);
  await page.getByText('Cr 40,250', {exact:true}).waitFor();
  await page.getByText('Cr 26,750', {exact:true}).waitFor();
  await page.screenshot({path:artifacts + 'player-snapshot-desktop-collapsed.png', fullPage:true});
  const toggle = page.locator('summary'); await toggle.focus(); await page.keyboard.press('Enter');
  await page.getByText('One scheduled 28-day installment paid here', {exact:true}).waitFor();
  await toggle.evaluate(element => element.blur());
  await page.screenshot({path:artifacts + 'player-snapshot-desktop.png', fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:artifacts + 'player-snapshot-mobile.png', fullPage:true});
  await toggle.click(); await page.getByText('Cr 40,250', {exact:true}).waitFor(); await toggle.click();
  for (const width of [320, 390, 700, 701, 1440]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow at ' + width);
  }
  await page.setViewportSize({width:320,height:844});
  await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const data = structuredClone(playerSnapshotFixture);
    data.world.name = data.cargo[0].name = data.buy.offers[0].name = 'W'.repeat(240);
    data.cargo[0].tons = data.buy.offers[0].creditsPerTon = data.ship.cashCredits = data.expenses.fuel.expected = '999999999999999.999999';
    data.expenses.fuel.basis = 'W'.repeat(240);
    renderPlayerSnapshot(document.getElementById('snapshot'), data); document.querySelector('details').open = true;
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Maximum fields at 320px');
  // Restore the fixture before same-document hash navigation (which does not rerun modules).
  await page.reload(); await page.getByText('Port Meridian', {exact:true}).waitFor();
  // Navigation and malformed/oversized fragments never load or import URL state in stage one.
  await page.goto(url + '#invalid=%ZZ'); await page.getByText('Port Meridian', {exact:true}).waitFor();
  await page.goto(url + '#snapshot=' + 'x'.repeat(16000)); await page.getByText('Port Meridian', {exact:true}).waitFor();
  await page.goBack(); await page.goForward(); await page.reload();
  await page.getByText('Port Meridian', {exact:true}).waitFor();
  const results = await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const root = document.getElementById('snapshot');
    const input = structuredClone(playerSnapshotFixture); input.world.name = '<img src=x onerror="window.compromised=true"> 雪 🚀';
    renderPlayerSnapshot(root, input);
    const literal = root.textContent.includes(input.world.name), injected = root.querySelectorAll('img,script').length;
    for (let i=0;i<5;i++) renderPlayerSnapshot(root, playerSnapshotFixture);
    const sections = root.querySelectorAll('section').length;
    renderPlayerSnapshot(root, {...input, version:3}); const rejected = root.querySelector('[role=alert]')?.textContent.includes('Unsupported');
    const stale = root.textContent.includes('Port Meridian');
    input.buy = {status:'not-checked', offers:[]}; input.sell = {status:'expired', offers:[]}; input.cargo = [];
    renderPlayerSnapshot(root, input);
    return {literal, injected, sections, rejected, stale, empty:root.textContent.includes('No cargo aboard.'), unchecked:root.textContent.includes('Not checked.'), expired:root.textContent.includes('Expired.')};
  });
  assert.deepEqual(results, {literal:true,injected:0,sections:7,rejected:true,stale:false,empty:true,unchecked:true,expired:true});
  const unknowns = await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const data = structuredClone(playerSnapshotFixture);
    data.ship.cashCredits = null; data.ship.fuel.current = '0'; data.ship.fuel.capacity = '0.000000'; data.ship.lifeSupport.capacity = null;
    for (const kind of ['berth', 'fuel', 'salary', 'mortgage', 'lss', 'incidentals']) data.expenses[kind].expected = null;
    renderPlayerSnapshot(document.getElementById('snapshot'), data);
    return {meters:document.querySelectorAll('meter').length, expected:document.querySelector('.expense-totals strong').textContent, detailOpen:document.querySelector('details').open, zeroCapacity:document.body.textContent.includes('No capacity configured.')};
  });
  assert.deepEqual(unknowns, {meters:0, expected:'Unknown', detailOpen:false, zeroCapacity:true});
  assert.deepEqual(errors, []);
  assert.ok(requests.every(request => new URL(request).origin === new URL(base).origin));
  // A separate page without access traps confirms saved bytes remain intact.
  const checker = await context.newPage(); await checker.goto(url);
  assert.deepEqual(await checker.evaluate(() => ({local:localStorage['traveller-trade-route-calculator:v1'], session:sessionStorage.sentinel})), {local:'synthetic-sentinel',session:undefined});
  assert.equal(await page.evaluate(() => sessionStorage.sentinel), 'unchanged');
  console.log('Player snapshot browser checks passed: desktop/mobile, inert markup, versions, repeated rendering, navigation, storage isolation.');
} finally { await browser.close(); }
