import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';

// Real Chromium integration tests. Seed only a fresh synthetic campaign before
// boot; every subsequent campaign change goes through the rendered application.
// The only doubles are the external map API and the browser's random-die source.
const require = createRequire(import.meta.url);
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const KEY = 'traveller-trade-route-calculator:v1';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const origin = {id:'-110,-70', x:-110, y:-70, name:'Mail Origin', sector:'Spinward Marches', hex:'1910', uwp:'A788899-C', zone:'Safe'};
const destination = {...origin, id:'-111,-70', x:-111, name:'Mail Destination', hex:'1810'};
const worlds = [origin, destination];
const mapWorlds = worlds.map(w => ({Name:w.name, Hex:w.hex, UWP:w.uwp, PBG:'703', Zone:'', WorldX:w.x, WorldY:w.y, Sector:w.sector}));
const summary = {
  suite:'Mail real-browser verification', startedAt:new Date().toISOString(),
  baseURL:base, node:process.version, githubSHA:process.env.GITHUB_SHA || null,
  requestedCommit:process.env.TRAVELLER_COMMIT || null, browser:null,
  fixtures:'Synthetic campaigns, intercepted Traveller Map API, automatic dice fixed to 3',
  cases:[], errors:[],
};
let browser;
await mkdir(artifacts, {recursive:true});

function campaign({capacity='60', configured=true}={}) {
  const state = S.initial();
  state.initialized = true;
  state.name = 'Disposable Mail browser verification';
  state.bank = '100000';
  state.actual = origin.id;
  state.worlds = Object.fromEntries(worlds.map(w => [w.id, structuredClone(w)]));
  state.route = worlds.map(w => w.id);
  state.ship.capacity = capacity;
  state.ship.armed = configured;
  state.trader.rank = configured ? 2 : 0;
  state.trader.soc = configured ? 1 : 0;
  return S.validate(state);
}
const errorText = error => error?.stack || String(error);
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const mail = page => page.locator('.mail-card');
const modal = page => page.locator('#modal[open]');
const fill = (page, name, value) => modal(page).locator('[name="'+name+'"]').fill(String(value));
const tab = (page, name) => page.locator('#tabs').getByRole('button', {name, exact:true}).click();
const moneyState = state => ({bank:state.bank, hours:state.hours, lots:state.lots, contracts:state.contracts, ledger:state.ledger});
const latestSearch = state => state.events.filter(e => Array.isArray(e.offers)).at(-1);
const freightRows = page => page.locator('#main tbody tr').filter({hasText:'Freight contract'}).allTextContents();

async function submit(page, name) {
  await modal(page).getByRole('button', {name, exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('#modal').open || !!document.querySelector('#modal-error').textContent);
  assert.equal(await page.locator('#modal-error').textContent(), '', 'The UI commit must not report an error');
  await page.locator('#modal').waitFor({state:'hidden'});
}
async function cancel(page) {
  await modal(page).getByRole('button', {name:'Cancel', exact:true}).click();
  await page.locator('#modal').waitFor({state:'hidden'});
}
async function closeAudit(page) {
  await modal(page).getByRole('button', {name:'Close', exact:true}).click();
  await page.locator('#modal').waitFor({state:'hidden'});
}
async function openCheck(page, {combined=false}={}) {
  if (combined) await page.getByRole('button', {name:'Find contracts', exact:true}).click();
  else await mail(page).getByRole('button', {name:'Check for mail', exact:true}).click();
  await modal(page).locator('[name="destination"]').selectOption(destination.id);
}
async function checkMail(page, {combined=false, dice=8, availability=12, containers=3, days=17}={}) {
  await openCheck(page, {combined});
  // null keeps the actual automatic search roll. Empty strings keep automatic
  // mail availability/container rolls independently of the search roll.
  if (dice !== null) await fill(page, 'dice', dice);
  await fill(page, 'skill', 0);
  await fill(page, 'characteristic', 0);
  await modal(page).getByText('Manual mail rolls (optional)', {exact:true}).click();
  await fill(page, 'mailAvailability', availability);
  await fill(page, 'mailContainers', containers);
  if (combined) {
    await fill(page, 'days', days);
    await modal(page).getByText('Override freight / mail dice', {exact:true}).click();
    await fill(page, 'diceSequence', Array(256).fill(3).join(','));
  }
  await submit(page, combined ? 'Generate offers' : 'Check for mail');
  return latestSearch(await read(page));
}
async function undo(page) {
  await tab(page, 'History');
  await page.getByRole('button', {name:'Undo latest change', exact:true}).click();
  await tab(page, 'Contracts');
}
async function acceptMail(page) {
  await mail(page).getByRole('button', {name:'Accept whole mail consignment', exact:true}).click();
  assert.match(await modal(page).textContent(), /does not pay you yet/);
  await submit(page, 'Accept whole contract');
}
async function historyAudit(page, id) {
  await tab(page, 'History');
  await page.locator('[data-action="event-audit"][data-arg="'+id+'"]').click();
  assert.equal(await modal(page).locator('[data-action="contract-accept"]').count(), 0);
  assert.equal(await page.locator('#modal-submit').isVisible(), false, 'Historical offers are read-only');
}
async function screenshot(page, result, filename, target=page) {
  await target.screenshot({path:join(artifacts, filename), ...(target === page ? {fullPage:true} : {})});
  result.screenshots.push(filename);
}
async function runCase(id, options, body) {
  const result = {id, status:'running', startedAt:new Date().toISOString(), screenshots:[], errors:[], pageErrors:[], unexpectedRequests:[]};
  summary.cases.push(result);
  let context;
  let traceStarted = false;
  try {
    context = await browser.newContext({viewport:{width:1440, height:1100}, serviceWorkers:'block'});
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(20000);
    context.on('page', page => page.on('pageerror', error => result.pageErrors.push(errorText(error))));
    await context.tracing.start({screenshots:true, snapshots:true, sources:true});
    traceStarted = true;
    const initial = campaign(options);
    await context.addInitScript(({key, initial, appOrigin}) => {
      if (location.origin !== appOrigin) return;
      // A guard is essential: reload and second-tab checks must retain the
      // campaign written by real UI actions instead of silently reseeding it.
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
      const nativeRandom = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = function(array) {
        if (array instanceof Uint32Array && array.length === 1) { array[0] = 2; return array; }
        return nativeRandom(array);
      };
    }, {key:KEY, initial, appOrigin:new URL(base).origin});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.origin === 'https://travellermap.com' && url.pathname.startsWith('/api/')) {
        const headers = {'Access-Control-Allow-Origin':'*'};
        if (url.pathname.endsWith('/jumpworlds')) return route.fulfill({json:{Worlds:mapWorlds}, headers});
        if (url.pathname.endsWith('/universe')) return route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}], Abbreviation:'Spin', X:-4, Y:-1}]}, headers});
        if (url.pathname.endsWith('/metadata')) return route.fulfill({json:{Subsectors:[{Index:'C', Name:'Regina'}]}, headers});
        if (url.pathname.endsWith('/sec')) return route.fulfill({json:'Hex\tName\r\n'+mapWorlds.map(w => w.Hex+'\t'+w.Name).join('\r\n'), headers});
      }
      result.unexpectedRequests.push(url.href);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await page.goto(base);
    await page.getByText('Editing in this tab', {exact:true}).waitFor();
    await tab(page, 'Contracts');
    await body(page, context, result, initial);
    assert.deepEqual(result.pageErrors, [], 'No uncaught browser errors');
    assert.deepEqual(result.unexpectedRequests, [], 'No live external network dependencies');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.errors.push(errorText(error));
    for (const [index, page] of (context?.pages() || []).entries()) {
      if (page.isClosed()) continue;
      try { await screenshot(page, result, 'mail-'+id+'-failure-'+(index+1)+'.png'); }
      catch (captureError) { result.errors.push('Failure screenshot: '+errorText(captureError)); }
    }
  } finally {
    if (traceStarted) {
      result.trace = 'mail-'+id+'-trace.zip';
      try { await context.tracing.stop({path:join(artifacts, result.trace)}); }
      catch (error) { result.status='failed'; result.errors.push('Trace save: '+errorText(error)); }
    }
    if (context) {
      try { await context.close(); }
      catch (error) { result.status='failed'; result.errors.push('Context close: '+errorText(error)); }
    }
    result.finishedAt = new Date().toISOString();
    console.log(result.status.toUpperCase()+': '+id);
    for (const error of result.errors) console.error(error);
  }
}

try {
  summary.testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'}).trim();
  if (summary.requestedCommit) assert.equal(summary.testedCommit, summary.requestedCommit, 'Test the exact requested PR head');
  const playwright = require(process.argv[2] || 'playwright');
  browser = await playwright.chromium.launch({headless:true, ...(process.env.TRAVELLER_BROWSER_CHANNEL ? {channel:process.env.TRAVELLER_BROWSER_CHANNEL} : {})});
  summary.browser = {name:'Chromium', version:browser.version(), channel:process.env.TRAVELLER_BROWSER_CHANNEL || 'bundled', headless:true};

  await runCase('settings-and-independent-rolls', {configured:false}, async (page, context, result, initial) => {
    assert.match(await mail(page).textContent(), /No mail check in this session/);
    assert.match(await mail(page).textContent(), /session-only; previous checks remain read-only in History/);
    assert.match(await mail(page).textContent(), /armed ship No \(\+0\)/);
    assert.deepEqual(await read(page), initial);
    await mail(page).getByRole('button', {name:'Edit mail settings', exact:true}).click();
    assert.equal(await page.locator('#modal-title').textContent(), 'Ship, trader & options');
    await modal(page).locator('[name="armed"]').check();
    await fill(page, 'rank', 2);
    await fill(page, 'soc', 1);
    await submit(page, 'Save');
    assert.match(await mail(page).textContent(), /armed ship Yes \(\+2\).*Naval \/ Scout rank 2.*SOC DM \+1/);
    await tab(page, 'Settings');
    await page.getByRole('button', {name:'Ship, trader & options', exact:true}).click();
    assert.equal(await modal(page).locator('[name="armed"]').isChecked(), true);
    assert.equal(await modal(page).locator('[name="rank"]').inputValue(), '2');
    assert.equal(await modal(page).locator('[name="soc"]').inputValue(), '1');
    await cancel(page);
    await tab(page, 'Contracts');
    const beforeChecks = moneyState(await read(page));

    // An interrupted check records nothing and consumes no session offer.
    const beforeCancel = await read(page);
    await openCheck(page);
    assert.equal(await modal(page).locator('[name="days"], [name="diceSequence"]').count(), 0);
    const preview = await page.locator('#mail-dm-preview').textContent();
    await fill(page, 'skill', 2);
    assert.notEqual(await page.locator('#mail-dm-preview').textContent(), preview);
    const manualSummary = modal(page).getByText('Manual mail rolls (optional)', {exact:true});
    await manualSummary.focus();
    await manualSummary.press('Enter');
    assert.equal(await manualSummary.evaluate(el => el.parentElement.open), true, 'Mail roll details open with the keyboard');
    await fill(page, 'mailAvailability', 13);
    assert.equal(await modal(page).locator('[name="mailAvailability"]').evaluate(el => el.validity.rangeOverflow), true);
    await modal(page).getByRole('button', {name:'Check for mail', exact:true}).click();
    assert.equal(await modal(page).count(), 1, 'Native number validity blocks an invalid submission');
    assert.deepEqual(await read(page), beforeCancel);
    await fill(page, 'mailAvailability', 2.5);
    assert.equal(await modal(page).locator('[name="mailAvailability"]').evaluate(el => el.validity.stepMismatch), true);
    await fill(page, 'mailAvailability', 12);
    await fill(page, 'mailContainers', 0);
    assert.equal(await modal(page).locator('[name="mailContainers"]').evaluate(el => el.validity.rangeUnderflow), true);
    await fill(page, 'mailContainers', 7);
    assert.equal(await modal(page).locator('[name="mailContainers"]').evaluate(el => el.validity.rangeOverflow), true);
    await cancel(page);
    assert.deepEqual(await read(page), beforeCancel);

    let audit = await checkMail(page, {dice:null, availability:'', containers:''});
    assert.deepEqual(audit.searchDice, {dice:[3,3], total:6});
    assert.deepEqual(audit.mailAudit.dice, {dice:[3,3], total:6});
    assert.deepEqual(audit.mailAudit.count, {dice:[3], total:3});
    assert.equal(audit.mailAudit.total, 13);
    audit = await checkMail(page, {availability:12, containers:''});
    assert.deepEqual(audit.mailAudit.dice, {dice:null, total:12, manual:true});
    assert.deepEqual(audit.mailAudit.count, {dice:[3], total:3});
    audit = await checkMail(page, {availability:'', containers:5});
    assert.deepEqual(audit.mailAudit.dice, {dice:[3,3], total:6});
    assert.deepEqual(audit.mailAudit.count, {dice:null, total:5, manual:true});
    audit = await checkMail(page);
    assert.deepEqual(audit.searchDice, {dice:null, total:8, manual:true});
    assert.deepEqual(audit.generatedSearchDice, {dice:[3,3], total:6});
    assert.deepEqual(audit.mailAudit.dice, {dice:null, total:12, manual:true});
    assert.deepEqual(audit.mailAudit.count, {dice:null, total:3, manual:true});
    assert.deepEqual(audit.mailAudit.modifiers, {freight:2, armed:2, lowTech:0, rank:2, soc:1});
    assert.equal(audit.offers.length, 1);
    assert.equal(audit.offers[0].dueHours, null);
    assert.deepEqual(moneyState(await read(page)), beforeChecks, 'Checking creates only history, never income or accepted cargo');
    assert.match(await mail(page).textContent(), /Mail available/);
    assert.match(await mail(page).textContent(), /15 t/);
    assert.match(await mail(page).textContent(), /Cr 75,000/);
    await screenshot(page, result, 'mail-desktop-available.png');
    await mail(page).getByText('How was this calculated?', {exact:true}).click();
    const details = await mail(page).locator('details').innerText();
    for (const label of ['Origin world DM','Destination world DM','Distance DM','Search Effect','Population DM','Starport DM','Technology DM','Travel-zone DM','Availability 2D roll','Freight-band DM','Armed ship DM','Low technology DM','Naval / Scout rank DM','Social Standing DM','Final availability result','Container-count die','Manual roll total: 12','Manual roll total: 3','INT-002','INT-004','no automatic deadline or late penalty']) assert.ok(details.includes(label), label);
    await screenshot(page, result, 'mail-desktop-details.png');
    await page.setViewportSize({width:390, height:844});
    const bounds = await mail(page).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 392, 'Mail card fits a 390px mobile viewport');
    assert.ok(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'Main content does not overflow on mobile');
    const labelWidths = await mail(page).locator('.preview dt').evaluateAll(labels => labels.map(label => label.getBoundingClientRect().width));
    assert.ok(labelWidths.every(width => width >= 90), 'Mail audit labels retain readable columns instead of wrapping one character per line');
    await screenshot(page, result, 'mail-mobile-details.png');
  });

  await runCase('unavailable-and-undo-check', {}, async (page, context, result, initial) => {
    const audit = await checkMail(page, {dice:2, availability:2, containers:6});
    assert.match(await mail(page).textContent(), /No mail available/);
    assert.match(await mail(page).textContent(), /No containers or payment offered/);
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0);
    assert.equal(audit.offers.length, 0);
    assert.equal('count' in audit.mailAudit, false, 'An unavailable check never rolls containers');
    assert.deepEqual(moneyState(await read(page)), moneyState(initial));
    await mail(page).getByText('How was this calculated?', {exact:true}).click();
    assert.match(await mail(page).locator('details').innerText(), /Not rolled: no mail available/);
    await screenshot(page, result, 'mail-desktop-unavailable.png');
    await undo(page);
    assert.match(await mail(page).textContent(), /No mail check in this session/);
    assert.deepEqual(moneyState(await read(page)), moneyState(initial));
  });

  await runCase('whole-consignment-capacity', {capacity:'14'}, async page => {
    await checkMail(page);
    assert.match(await mail(page).textContent(), /Does not fit.*14 t free/s);
    assert.match(await mail(page).textContent(), /partial acceptance is not available/);
    assert.equal(await mail(page).getByRole('button', {name:'Accept whole mail consignment', exact:true}).isDisabled(), true);
    // The generic contracts table is a second route to acceptance. It must not
    // bypass the same whole-consignment capacity rule.
    const before = await read(page);
    await page.locator('#main tbody tr').filter({hasText:'Mail contract'}).getByRole('button', {name:'Accept', exact:true}).click();
    await modal(page).getByRole('button', {name:'Accept whole contract', exact:true}).click();
    await page.locator('#modal-error').getByText('Not enough capacity for the whole contract', {exact:true}).waitFor();
    assert.deepEqual(await read(page), before);
    assert.equal(await modal(page).locator('[name="quantity"]').count(), 0);
    await cancel(page);
    await mail(page).getByRole('button', {name:'Edit mail settings', exact:true}).click();
    await fill(page, 'capacity', 15);
    await submit(page, 'Save');
    assert.equal(await mail(page).getByRole('button', {name:'Accept whole mail consignment', exact:true}).isDisabled(), false);
    await acceptMail(page);
    const accepted = await read(page);
    assert.equal(accepted.contracts.length, 1);
    assert.equal(accepted.contracts[0].quantity, '15');
    assert.equal(accepted.bank, before.bank);
    assert.match(await mail(page).textContent(), /15 t reserved/);
  });

  await runCase('accept-jump-deliver-and-undo', {}, async page => {
    await checkMail(page);
    const checked = await read(page);
    await mail(page).getByRole('button', {name:'Accept whole mail consignment', exact:true}).click();
    await cancel(page);
    assert.deepEqual(await read(page), checked);
    await acceptMail(page);
    assert.equal((await read(page)).bank, '100000');
    assert.equal((await read(page)).contracts[0].status, 'accepted');
    assert.match(await page.locator('#hold-summary .value').textContent(), /15 \/ 60 t/);
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0);
    await undo(page);
    assert.deepEqual(moneyState(await read(page)), moneyState(checked));
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0, 'Undo acceptance does not revive a session offer');
    await checkMail(page);
    await acceptMail(page);
    const accepted = await read(page);
    const contractId = accepted.contracts[0].id;
    await tab(page, 'Overview');
    await page.locator('[data-action="jump"]').click();
    await fill(page, 'hours', 168);
    await submit(page, 'COMMIT JUMP');
    await tab(page, 'Contracts');
    const arrived = await read(page);
    assert.equal(arrived.actual, destination.id);
    assert.equal(arrived.routeIndex, 1);
    assert.equal(arrived.hours, 168);
    assert.equal(arrived.bank, accepted.bank, 'Arrival never auto-pays mail');
    assert.equal(arrived.contracts[0].status, 'accepted');
    assert.match(await page.locator('#hold-summary .value').textContent(), /15 \/ 60 t/);
    assert.equal(arrived.ledger.filter(e => e.contractId === contractId).length, 0);
    assert.match(await mail(page).textContent(), /At destination/);
    assert.match(await mail(page).textContent(), /15 t reserved/);
    await page.getByRole('button', {name:'Deliver', exact:true}).click();
    await cancel(page);
    assert.deepEqual(await read(page), arrived);
    await page.getByRole('button', {name:'Deliver', exact:true}).click();
    await submit(page, 'Commit delivery & payout');
    let delivered = await read(page);
    assert.equal(delivered.bank, '175000');
    assert.equal(delivered.contracts[0].status, 'delivered');
    assert.equal(delivered.contracts[0].payout, '75000');
    assert.equal(delivered.contracts[0].late, false);
    assert.equal(delivered.contracts[0].penaltyDie, null);
    assert.equal(delivered.ledger.filter(e => e.contractId === contractId).length, 1);
    assert.match(await mail(page).textContent(), /Mail delivered/);
    assert.match(await mail(page).textContent(), /Released after delivery/);
    assert.match(await page.locator('#hold-summary .value').textContent(), /0 \/ 60 t/);
    assert.equal(await page.locator('[data-action="deliver"]').count(), 0, 'A delivered contract has no second payout action');
    await undo(page);
    assert.deepEqual(moneyState(await read(page)), moneyState(arrived));
    assert.match(await mail(page).textContent(), /15 t reserved/);
    assert.match(await page.locator('#hold-summary .value').textContent(), /15 \/ 60 t/);
    await page.getByRole('button', {name:'Deliver', exact:true}).click();
    await submit(page, 'Commit delivery & payout');
    delivered = await read(page);
    assert.equal(delivered.bank, '175000');
    assert.equal(delivered.ledger.filter(e => e.contractId === contractId && e.type === 'Mail delivery').length, 1);
    await page.reload();
    await page.getByText('Editing in this tab', {exact:true}).waitFor();
    await tab(page, 'Contracts');
    assert.deepEqual(await read(page), delivered);
    assert.equal(await page.locator('[data-action="deliver"], [data-action="contract-accept"]').count(), 0);
  });

  await runCase('combined-freight-and-referee-edit', {}, async page => {
    const combined = await checkMail(page, {combined:true, containers:2});
    const freight = combined.offers.filter(c => c.kind === 'freight');
    assert.ok(freight.length > 0, 'Combined Find contracts still generates freight');
    assert.ok(freight.every(c => c.dueHours === 17*24));
    assert.equal(combined.offers.find(c => c.kind === 'mail').dueHours, null);
    const beforeRows = await freightRows(page);
    assert.equal(beforeRows.length, freight.length);
    const beforeMoney = moneyState(await read(page));
    const originalAudit = structuredClone(combined);
    await checkMail(page, {containers:1});
    assert.deepEqual(await freightRows(page), beforeRows, 'Standalone Mail retains exact visible freight offers');
    assert.deepEqual((await read(page)).events.find(e => e.id === combined.id), originalAudit);
    assert.deepEqual(moneyState(await read(page)), beforeMoney);
    await undo(page);
    assert.deepEqual(await freightRows(page), beforeRows, 'Undo Mail check retains existing freight');
    assert.match(await mail(page).textContent(), /No mail check in this session/);
    assert.equal(await page.locator('#main tbody tr').filter({hasText:'Mail contract'}).count(), 0);
    await undo(page);
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0, 'Undo combined search removes every actionable offer');

    const search = await checkMail(page, {combined:true});
    const searchBeforeEdit = structuredClone(search);
    await mail(page).getByRole('button', {name:'Edit / referee override', exact:true}).click();
    await fill(page, 'description', 'Priority dispatch');
    await fill(page, 'quantity', 10);
    await fill(page, 'payment', 60000);
    await fill(page, 'due', '');
    await fill(page, 'reason', 'Referee replaces one container');
    await submit(page, 'Save');
    assert.match(await mail(page).textContent(), /10 t/);
    assert.match(await mail(page).textContent(), /Cr 60,000/);
    assert.match(await mail(page).textContent(), /Referee-edited terms/);
    const edited = await read(page);
    assert.deepEqual(edited.events.find(e => e.id === search.id), searchBeforeEdit, 'Editing never rewrites original history');
    assert.equal(edited.events.find(e => e.label === 'Contract offer edit').offer.overrides.length, 1);
    assert.deepEqual(moneyState(edited), beforeMoney);
    await page.locator('#main tbody tr').filter({hasText:'Mail contract'}).getByRole('button', {name:'Audit/View', exact:true}).click();
    for (const text of ['Referee replaces one container','Manual roll total: 3','Cr 75,000','Cr 60,000']) assert.ok((await modal(page).textContent()).includes(text), text);
    await closeAudit(page);
    await undo(page);
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0, 'Undo referee edit discards stale session offers');
    assert.match(await mail(page).textContent(), /No mail check in this session/);
    assert.deepEqual(moneyState(await read(page)), beforeMoney);
  });

  await runCase('reload-and-read-only-history', {}, async (page, context) => {
    const audit = await checkMail(page);
    const saved = await read(page);
    assert.equal(Object.hasOwn(saved, 'mailCheck'), false);
    assert.equal(Object.hasOwn(saved, 'contractDrafts'), false);
    await page.reload();
    await page.getByText('Editing in this tab', {exact:true}).waitFor();
    await tab(page, 'Contracts');
    assert.match(await mail(page).textContent(), /No mail check in this session/);
    assert.equal(await page.locator('[data-action="contract-accept"]').count(), 0);
    assert.deepEqual(await read(page), saved);
    await historyAudit(page, audit.id);
    await modal(page).getByText('Mail search result', {exact:true}).click();
    assert.match(await modal(page).innerText(), /Mail available/);
    assert.match(await modal(page).innerText(), /Manual roll total: 12/);
    await closeAudit(page);
    assert.deepEqual(await read(page), saved);

    // The same real browser storage and navigator.locks make this tab read-only.
    const reader = await context.newPage();
    await reader.goto(base);
    await reader.getByText('Read-only: campaign open in another tab.', {exact:true}).waitFor();
    await tab(reader, 'Contracts');
    for (const name of ['Check for mail','Edit mail settings']) assert.equal(await mail(reader).getByRole('button', {name, exact:true}).isDisabled(), true);
    await historyAudit(reader, audit.id);
    await modal(reader).getByText('Mail search result', {exact:true}).click();
    assert.match(await modal(reader).innerText(), /Mail available/);
    assert.deepEqual(await read(reader), saved);
    await closeAudit(reader);
  });
} catch (error) {
  summary.errors.push(errorText(error));
  console.error(errorText(error));
} finally {
  if (browser) {
    try { await browser.close(); }
    catch (error) { summary.errors.push('Browser close: '+errorText(error)); }
  }
  summary.finishedAt = new Date().toISOString();
  summary.passed = summary.errors.length === 0 && summary.cases.length === 6 && summary.cases.every(c => c.status === 'passed');
  await writeFile(join(artifacts, 'mail-browser-summary.json'), JSON.stringify(summary, null, 2)+'\n');
}
if (!summary.passed) throw new Error('Mail browser verification failed. See verification-artifacts/mail-browser-summary.json and per-case traces/screenshots.');
console.log('PASS: all 6 Mail browser scenarios; desktop/mobile screenshots, per-case Playwright traces and commit-tagged JSON summary saved.');
