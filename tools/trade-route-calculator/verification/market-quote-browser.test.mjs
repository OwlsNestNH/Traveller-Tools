// One preserved supplier quote / changed current retail cap scenario, at two widths.
// Actual Market, Settings, Audit and purchase UI; no rewritten application source.
// CI: node verification/market-quote-browser.test.mjs [existing-playwright-module]
// Safe local check: node verification/market-quote-browser.test.mjs --fixtures-only
// That branch only reads source and validates synthetic data: no Playwright import,
// browser launch, subprocess, HTTP request, artifact write or application boot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validate} from '../js/state.mjs';
import {context as worldContext, quote, effectiveBasePrice} from '../js/rules.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {guiFixture, campaignKey as KEY} from './fixtures/gui-parity.mjs';

const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url), 'utf8'));
const HELP = 'Current retail uses current settings. Price % and Purchase Price use the saved supplier quote and its original retail basis; see Audit for the calculation.';
const OFFER = 'cap-offer', DESCRIPTION = 'Preserved cap offer';
const sizes = [{width: 1440, height: 1100}, {width: 390, height: 844}];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const screenshotOptions = {type: 'jpeg', quality: 82, fullPage: false, scale: 'css'};
const sources = ['index.html', 'style.css', 'dashboard.css', 'rule-references.css', 'lss-refill.css', 'js/app.mjs', 'js/state.mjs', 'js/rules.mjs', 'js/persistence.mjs', 'js/campaign-controller.mjs', 'rules/core-2022.json', 'verification/fixtures/gui-parity.mjs', 'verification/market-quote-browser.test.mjs'];
const report = {suite: 'Market current retail / saved supplier quote', startedAt: new Date().toISOString(), requestedCommit: process.env.TRAVELLER_COMMIT || null, declaredCases: 2, declaredScreenshots: 10, cases: [], errors: [], scope: 'One synthetic preserved-offer/current-cap scenario at 1440px and 390px. Actual Settings save, Market, original Audit, purchase confirmation, native persisted debit and reload. Full viewport images target named visible sections; horizontally clipped tables are never described as full-table evidence. No fault matrix, repricing, layout changes or live API data.'};
let browser;

// Reproduces the reviewed purchase-cap-observation inputs: Cr100,000 original
// effective basis, 85% saved quote, current cap changed to Cr50,000, then 1 ton
// plus a 10% broker fee. The existing fixture supplies deterministic Map replies.
function fixture() {
 const f = guiFixture(), s = f.state;
 Object.assign(s, {name: 'Market quote verification', bank: '1000000', lots: [], contracts: [], policies: [], undo: []});
 s.trader.broker = 6;
 Object.assign(s.settings, {insurance: false, creditStep: 1, reducedProfitLimitsEnabled: true, minPurchasePercent: 85, maxSalePercent: 115, maxBaseRetailEnabled: true, maxBaseRetail: '100000', useRawIllegalPrices: false});
 s.ledger = [{id: 'cap-opening', type: 'Opening bank', amount: '1000000', hours: 0, world: s.actual}];
 const good = core.commodities.find(g => g.baseCreditsPerTon === 1000000 && !g.universallyIllegal);
 assert.ok(good, 'Existing legal Cr1,000,000 base commodity');
 const world = worldContext(s.worlds[s.actual], core), options = {...s.settings, skill: 6, counterparty: 0, local: true, side: 'buy'};
 const savedQuote = quote(good, world, options, core, () => 6);
 s.snapshots = [{id: 'cap-supplier', kind: 'supplier', worldId: s.actual, world, party: 'cap|supplier', partyName: 'Cap supplier', hours: s.hours, startedHours: s.hours, success: true, options, offers: [{...savedQuote, id: OFFER, commodity: good.id, description: DESCRIPTION, remaining: '5', expired: false, illegal: false}]}];
 s.dashboardBaseline = createDashboardBaseline(s);
 validate(s);
 return {...f, state: s, bytes: JSON.stringify(s), good};
}
function assertFixture(f) {
 const offer = f.state.snapshots[0].offers[0];
 validate(JSON.parse(f.bytes));
 assert.equal(offer.audit.rawBasePrice, 1000000); assert.equal(offer.audit.basePrice, 100000);
 assert.equal(offer.audit.percent, 85); assert.equal(offer.unitPrice, '85000');
 assert.deepEqual(offer.audit.dice, {dice: [6, 6, 6], total: 18});
 assert.equal(effectiveBasePrice(f.good, {...f.state.settings, maxBaseRetail: '50000'}).effective, 50000);
 assert.equal(85000n + 8500n, 93500n); assert.equal(1000000n - 93500n, 906500n);
}
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const saved = async page => JSON.parse(await raw(page));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const action = (page, name, arg) => page.locator('[data-action="' + name + '"]' + (arg ? '[data-arg="' + arg + '"]' : ''));
const row = page => page.locator('.purchase-table tbody tr').filter({hasText: DESCRIPTION});
async function facts(page) {return page.locator('#modal-body').evaluate(el => Object.fromEntries([...el.querySelectorAll('dt')].map(dt => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()])));}
async function reveal(locator) {for (const details of await locator.locator('xpath=ancestor::details').all()) if (!await details.evaluate(el => el.open)) await details.locator(':scope > summary').click({position: {x: 8, y: 8}});}
async function closeModal(page) {await page.locator('#modal-cancel').click(); await page.locator('#modal').waitFor({state: 'hidden'});}
async function elementPath(locator, rootId) {
 return locator.evaluate((el, rootId) => {
  const parts = [];
  for (let p = el; p && p.id !== rootId; p = p.parentElement) {const peers = [...p.parentElement.children].filter(s => s.tagName === p.tagName); parts.unshift(p.tagName.toLowerCase() + ':nth-of-type(' + (peers.indexOf(p) + 1) + ')');}
  return '#' + rootId + ' > ' + parts.join(' > ');
 }, rootId);
}
function jpegDimensions(bytes) {
 assert.equal(bytes.readUInt16BE(0), 0xffd8);
 for (let offset = 2; offset + 9 < bytes.length;) {
  assert.equal(bytes[offset], 0xff); const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
  if ([0xc0, 0xc1, 0xc2].includes(marker)) return {width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5)};
  assert.ok(length >= 2); offset += length + 2;
 }
 throw Error('JPEG dimensions missing');
}
// Scroll existing UI only. Neither screenshot content nor production layout is
// edited. On mobile, current retail and saved-price columns need separate frames.
async function frameTargets(page, selectors) {
 await page.locator(selectors[0]).evaluate(el => el.scrollIntoView({block: 'center', inline: 'nearest'}));
 await page.evaluate(selectors => {
  const elements = selectors.map(selector => document.querySelector(selector));
  const scroller = elements[0].closest('.scroll');
  if (scroller) {
   const rects = elements.map(el => el.getBoundingClientRect()), parent = scroller.getBoundingClientRect();
   scroller.scrollLeft += (Math.min(...rects.map(r => r.left)) + Math.max(...rects.map(r => r.right))) / 2 - (parent.left + parent.right) / 2;
  }
 }, selectors);
 await frames(page);
}
async function capture(page, result, label, selectors) {
 await frameTargets(page, selectors);
 const geometry = await page.evaluate(selectors => {
  const rect = r => ({left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height});
  return {pageOverflow: document.documentElement.scrollWidth - innerWidth, targets: selectors.map(selector => {
   const el = document.querySelector(selector), style = getComputedStyle(el), range = document.createRange(); range.selectNodeContents(el);
   const clips = []; for (let p = el.parentElement; p; p = p.parentElement) {const css = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(css.overflowX + css.overflowY)) clips.push(rect(p.getBoundingClientRect()));}
   return {selector, text: el.textContent.trim(), fontSize: parseFloat(style.fontSize), box: rect(el.getBoundingClientRect()), textRects: [...range.getClientRects()].map(rect), clips};
  }), table: (() => {const table = document.querySelector('.purchase-table'), scroller = table?.closest('.scroll'); return scroller ? {scrollLeft: scroller.scrollLeft, clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth, fullTableVisible: scroller.scrollWidth <= scroller.clientWidth + 2} : null;})()};
 }, selectors);
 assert.ok(geometry.pageOverflow <= 2, 'No horizontal document overflow');
 for (const target of geometry.targets) {
  assert.ok(target.fontSize >= (label === 'help' ? 12 : 11), 'Target text keeps its native readable font size');
  assert.ok(target.textRects.length, 'Target has rendered text');
  for (const r of target.textRects) {
   assert.ok(r.left >= -1 && r.right <= result.viewport.width + 1 && r.top >= -1 && r.bottom <= result.viewport.height + 1, label + ' target text is inside the screenshot');
   for (const clip of target.clips) assert.ok(r.left >= clip.left - 2 && r.right <= clip.right + 2 && r.top >= clip.top - 2 && r.bottom <= clip.bottom + 2, label + ' target text is not clipped by a scroll container');
  }
 }
 const name = 'market-quote-' + result.viewport.width + '-' + label + '.jpg', bytes = await page.screenshot(screenshotOptions), dimensions = jpegDimensions(bytes);
 assert.deepEqual(dimensions, result.viewport, 'Original CSS-pixel viewport, no scaling/collage');
 report.imageBytes = (report.imageBytes || 0) + bytes.length; assert.ok(report.imageBytes < 4 * 1024 * 1024, 'Bounded screenshot evidence');
 await writeFile(join(artifacts, name), bytes);
 result.frames.push({name, label, producerCommit: report.testedCommit, producerTree: report.testedTree, sourceSHA256: report.sourceSHA256, runtimeSourceSHA256: result.runtime.sourceSHA256, imageSHA256: hash(bytes), bytes: bytes.length, dimensions, viewport: result.viewport, encoding: screenshotOptions, geometry});
}
async function verifyRuntime(page, result) {
 result.runtime = await page.evaluate(async () => {
  const appURL = [...document.scripts].find(el => el.type === 'module' && /\/app\.mjs(?:\?|$)/.test(el.src))?.src;
  if (!appURL) throw Error('Runtime app module missing');
  const appResponse = await fetch(appURL); if (!appResponse.ok) throw Error('Runtime app source unavailable');
  const app = await appResponse.text(), urls = {'js/app.mjs': appURL, 'index.html': location.href};
  for (const name of ['rules', 'state', 'persistence', 'campaign-controller']) {
   const specifier = app.match(new RegExp("from\\s*['\"]([^'\"]*" + name + "\\.mjs[^'\"]*)['\"]"))?.[1];
   if (!specifier) throw Error('Runtime import missing: ' + name); urls['js/' + name + '.mjs'] = new URL(specifier, appURL).href;
  }
  for (const el of document.querySelectorAll('link[rel="stylesheet"]')) urls[new URL(el.href).pathname.split('/').at(-1)] = el.href;
  urls['rules/core-2022.json'] = new URL('../rules/core-2022.json', appURL).href;
  const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const sourceSHA256 = {};
  for (const [name, url] of Object.entries(urls)) {const response = await fetch(url); if (!response.ok) throw Error('Runtime source unavailable: ' + name); sourceSHA256[name] = await digest(await response.text());}
  return {urls, sourceSHA256, nativeLocks: !!navigator.locks};
 });
 assert.equal(result.runtime.nativeLocks, true);
 for (const [name, sha] of Object.entries(result.runtime.sourceSHA256)) assert.equal(sha, report.sourceSHA256[name], 'Served bytes match exact checked-out source: ' + name);
 for (const name of ['js/app.mjs', 'js/rules.mjs', 'js/state.mjs', 'js/persistence.mjs']) assert.ok(new URL(result.runtime.urls[name]).search, 'Actual version-tagged module: ' + name);
}
async function contextFor(result, f) {
 const context = await browser.newContext({viewport: result.viewport, deviceScaleFactor: 1, serviceWorkers: 'block'});
 context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
 context.on('page', page => {
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', entry => {if (entry.type() === 'error') result.consoleErrors.push(entry.text());});
  page.on('response', response => {if (response.status() >= 400) result.networkErrors.push(response.status() + ' ' + response.url());});
  page.on('requestfailed', request => {if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.networkErrors.push(request.url() + ': ' + request.failure()?.errorText);});
 });
 await context.addInitScript(({key, bytes, origin}) => {
  if (location.origin !== origin) return;
  if (!localStorage.getItem(key)) localStorage.setItem(key, bytes);
  globalThis.marketQuoteProbe = {writes: 0, priceDiceCalls: 0};
  const native = Storage.prototype.setItem;
  Storage.prototype.setItem = function(name, value) {const result = Reflect.apply(native, this, [name, value]); if (this === localStorage && name === key) marketQuoteProbe.writes++; return result;};
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = array => {if (array instanceof Uint32Array && array.length === 1) marketQuoteProbe.priceDiceCalls++; return random(array);};
 }, {key: KEY, bytes: f.bytes, origin: new URL(base).origin});
 await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(base).origin) return route.continue();
  if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
   assert.equal(url.searchParams.get('milieu'), 'M1105'); const headers = {'Access-Control-Allow-Origin': '*'};
   if (url.pathname.endsWith('/jumpworlds')) return route.fulfill({json: {Worlds: f.apiWorlds}, headers});
   if (url.pathname.endsWith('/universe')) return route.fulfill({json: f.universe, headers});
   if (url.pathname.endsWith('/metadata')) return route.fulfill({json: f.metadata, headers});
   if (url.pathname.endsWith('/sec')) return route.fulfill({body: f.sec, headers});
  }
  result.unexpectedRequests.push(url.href); return route.abort('blockedbyclient');
 });
 return context;
}
async function runBody(page, result, f) {
 await page.goto(base); await page.getByText('Editing in this tab', {exact: true}).waitFor(); await verifyRuntime(page, result);
 assert.equal(await raw(page), f.bytes, 'No startup mutation of the migrated synthetic campaign');
 await page.locator('#tabs [data-arg="Trade"]').click();
 assert.equal(await row(page).count(), 1);
 assert.deepEqual(await row(page).locator('td').allTextContents().then(cells => cells.slice(2, 5)), ['Cr 100,000 / t', '85%', 'Cr 85,000 / t']);
 await page.locator('#tabs [data-arg="Settings"]').click();
 const cap = page.locator('#settings-form [name="maxBaseRetail"]'); await reveal(cap); await cap.fill('50000');
 await page.locator('#settings-save').click(); await page.locator('#message').filter({hasText: 'Ship / trader settings saved.'}).waitFor();
 const afterSettings = await saved(page), originalOffer = f.state.snapshots[0].offers[0];
 assert.deepEqual(afterSettings.settings, {...f.state.settings, maxBaseRetail: '50000'});
 for (const name of ['snapshots', 'lots', 'ledger', 'bank']) assert.deepEqual(afterSettings[name], f.state[name], name + ' preserved by Settings save');
 assert.equal(afterSettings.revision, f.state.revision + 1);
 await page.locator('#tabs [data-arg="Trade"]').click();
 assert.deepEqual(await page.locator('.purchase-table th').allTextContents(), ['Commodity', 'Available', 'Current retail', 'Price %', 'Purchase Price', 'Offer Status', 'Actions']);
 assert.deepEqual(await row(page).locator('td').allTextContents().then(cells => cells.slice(2, 5)), ['Cr 50,000 / t', '85%', 'Cr 85,000 / t']);
 const help = page.getByText(HELP, {exact: true}); assert.equal(await help.count(), 1);
 // The helper must sit in the actual Market panel, outside its sideways table.
 assert.equal(await help.evaluate(el => !!el.closest('.panel')?.querySelector('.purchase-table') && !el.closest('.scroll')), true);
 // Locate exact text by its natural element path, without adding a DOM id/style.
 const helperPath = await elementPath(help, 'main');
 await capture(page, result, 'current-retail', ['.purchase-table th:nth-child(3)', '.purchase-table tbody tr:first-child td:nth-child(3)']);
 await capture(page, result, 'saved-price', ['.purchase-table th:nth-child(4)', '.purchase-table th:nth-child(5)', '.purchase-table tbody tr:first-child td:nth-child(4)', '.purchase-table tbody tr:first-child td:nth-child(5)']);
 await capture(page, result, 'help', [helperPath]);
 await action(page, 'offer-audit', OFFER).click(); await page.getByRole('heading', {name: 'Commodity audit · ' + DESCRIPTION, exact: true}).waitFor();
 const audit = await facts(page);
 assert.equal(audit['Effective base retail'], 'Cr 100,000 / ton'); assert.equal(audit['Retail cap'], 'Cr 100,000 / ton');
 assert.equal(audit['3D price roll'], '6 + 6 + 6 = 18'); assert.equal(audit['Effective price percentage before fees'], '85%'); assert.equal(audit['Effective purchase price'], 'Cr 85,000 / ton');
 const basis = await elementPath(page.locator('#modal-body dt').filter({hasText: /^Effective base retail$/}), 'modal-body');
 await capture(page, result, 'original-audit-basis', [basis, basis + ' + dd']);
 await closeModal(page);
 assert.equal(await raw(page), JSON.stringify(afterSettings), 'Audit and Market viewing do not write');
 await action(page, 'buy', OFFER).click(); await page.getByRole('heading', {name: 'Review purchase · ' + DESCRIPTION, exact: true}).waitFor();
 assert.match(await page.locator('#modal-body').textContent(), /Price: Cr 85,000 per ton/);
 await page.locator('#modal [name="quantity"]').fill('1'); await page.locator('#modal [name="fee"]').fill('10');
 await page.locator('#modal [name="fee"]').blur();await page.locator('#purchase-totals').waitFor();assert.equal(await page.locator('#modal [name="quantity"]').inputValue(),'1');
 const confirmation = await facts(page);
 assert.deepEqual(Object.fromEntries(['Goods','Broker fee','Total debit'].map(key=>[key,confirmation[key]])), {Goods: 'Cr 85,000', 'Broker fee': 'Cr 8,500', 'Total debit': 'Cr 93,500'});
 assert.equal(await raw(page), JSON.stringify(afterSettings), 'Purchase preview is nonmutating');
 // The editable fields and totals need separate vertical space on narrow screens.
 // Capture the full financial review, not a title-to-footer span larger than the viewport.
 await capture(page, result, 'purchase-confirmation', ['#purchase-totals']);
 await page.locator('#modal-submit').click(); await page.locator('#modal').waitFor({state: 'hidden'});
 const purchased = await saved(page), lot = purchased.lots[0], entries = purchased.ledger.slice(afterSettings.ledger.length);
 assert.equal(purchased.bank, '906500'); assert.equal(BigInt(afterSettings.bank) - BigInt(purchased.bank), 93500n);
 assert.equal(purchased.revision, afterSettings.revision + 1); assert.equal(purchased.lots.length, 1);
 assert.equal(lot.quantity, '1'); assert.equal(lot.goodsValue, '85000'); assert.equal(lot.basis, '93500'); assert.equal(lot.audit.fee, '8500');
 assert.deepEqual(lot.audit.price, originalOffer, 'Purchased lot retains exact original quote and dice');
 assert.deepEqual(entries.map(e => [e.type, e.amount]), [['Purchase', '-85000'], ['Broker fee', '-8500']]);
 assert.equal(entries[0].purchase.unitPrice, '85000'); assert.deepEqual(entries[0].purchase.priceAudit, originalOffer.audit);
 assert.deepEqual(purchased.snapshots[0].offers[0], {...originalOffer, remaining: '4'}, 'Only offer quantity changes; no repricing or reroll');
 result.probe = await page.evaluate(() => marketQuoteProbe); assert.deepEqual(result.probe, {writes: 2, priceDiceCalls: 0});
 result.evidence = {currentRetail: '50000', originalRetailBasis: '100000', savedPercent: 85, savedUnitPrice: '85000', confirmation, audit, originalQuoteSHA256: hash(JSON.stringify(originalOffer)), persistedDebit: '93500', bankAfter: purchased.bank, remaining: '4'};
 const committedBytes = await raw(page); await page.reload(); await page.getByText('Editing in this tab', {exact: true}).waitFor();
 assert.equal(await raw(page), committedBytes, 'Native persisted purchase survives reload exactly');
 assert.deepEqual(await page.evaluate(() => marketQuoteProbe), {writes: 0, priceDiceCalls: 0}, 'Reload neither purchases again nor rerolls');
}
async function writeReport() {await writeFile(join(artifacts, 'market-quote-report.json'), JSON.stringify(report, null, 2) + '\n');}
async function runCase(viewport) {
 const result = {viewport, status: 'running', frames: [], pageErrors: [], consoleErrors: [], networkErrors: [], unexpectedRequests: [], errors: []}; report.cases.push(result); let context;
 try {
  const f = fixture(); assertFixture(f); result.fixtureSHA256 = hash(f.bytes);
  context = await contextFor(result, f); const page = await context.newPage(); await runBody(page, result, f); await frames(page);
  for (const name of ['pageErrors', 'consoleErrors', 'networkErrors', 'unexpectedRequests']) assert.deepEqual(result[name], [], 'No unexpected ' + name);
  assert.equal(result.frames.length, 5); result.status = 'passed';
 } catch (error) {result.status = 'failed'; result.errors.push(error.stack || String(error));}
 finally {await context?.close(); await writeReport();}
 console.log(result.status.toUpperCase() + ': preserved supplier quote / current cap at ' + viewport.width + 'px');
 for (const error of result.errors) console.error(error);
}

report.sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async path => [path, hash(await readFile(new URL('../' + path, import.meta.url)))])));
if (process.argv.includes('--fixtures-only')) {
 assertFixture(fixture()); assert.deepEqual(sizes.map(v => v.width), [1440, 390]);
 const app = await readFile(new URL('../js/app.mjs', import.meta.url), 'utf8');
 assert.ok(app.includes(HELP)); assert.ok(app.includes("['Commodity','Available','Current retail','Price %','Purchase Price','Offer Status','Actions']"));
 assert.deepEqual(jpegDimensions(Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 100, 0, 200, 1, 1, 17, 0, 255, 217])), {width: 200, height: 100});
 console.log('PASS: one preserved-cap synthetic fixture, saved dice, independent Cr93,500 arithmetic and Market label/help source wiring. Browser UI, geometry, persistence and screenshots remain UNRUN. No browser was imported or launched.');
} else {
 await mkdir(artifacts, {recursive: true});
 try {
  report.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert.ok(report.requestedCommit, 'Set TRAVELLER_COMMIT for exact-head CI evidence'); assert.equal(report.testedCommit, report.requestedCommit);
  report.testedTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {cwd: root, encoding: 'utf8'}).trim();
  report.workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'}).trim();
  assert.equal(report.workingTree, '', 'Browser evidence requires clean exact head');
  const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
  browser = await chromium.launch({headless: true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel: process.env.TRAVELLER_BROWSER_CHANNEL} : {})});
  report.browser = {name: 'Chromium', version: browser.version()};
  for (const viewport of sizes) await runCase(viewport);
 } catch (error) {report.errors.push(error.stack || String(error));}
 finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  report.passed = !report.errors.length && report.cases.length === report.declaredCases && report.cases.every(c => c.status === 'passed') && report.cases.reduce((n, c) => n + c.frames.length, 0) === report.declaredScreenshots;
  await writeReport();
 }
 if (!report.passed) throw Error('Market quote browser check failed; see verification-artifacts/market-quote-report.json');
 console.log('PASS: 2 preserved quote/current cap browser cases, exact persisted Cr93,500 purchase and 10 target-framed original-resolution screenshots.');
}
