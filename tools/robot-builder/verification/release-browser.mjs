import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.argv[2] || 'playwright');
const root = process.env.ROBOT_TEST_URL || 'http://127.0.0.1:8778/tools/robot-builder/';
const site = new URL('../../', root).href;
const changelog = new URL('changes/robot.html', site).href;
const out = path.resolve(process.env.ROBOT_ARTIFACTS || 'verification-artifacts/robot');
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({headless: true, ...(process.env.ROBOT_BROWSER_CHANNEL ? {channel: process.env.ROBOT_BROWSER_CHANNEL} : {})});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
const errors = [], hits = [], checks = [];
const check = (label, condition) => {assert.ok(condition, label); checks.push(label);};
context.on('page', page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text());});
});
context.on('request', request => {if (new URL(request.url()).hostname === 'hits.sh') hits.push(request.url());});
// Badges are read-only site decoration. Keep smoke tests offline and deterministic.
await context.route('https://img.shields.io/**', route => route.fulfill({status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20"><rect width="90" height="20" fill="#2b4cff"/><text x="4" y="14" fill="white" font-size="12">visits: fixture</text></svg>'}));
const page = await context.newPage();
const layout = async (target, label) => {
  check(label + ' has no horizontal overflow', await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
};
try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 1000});
    await page.goto(site);
    const card = page.locator('.tool-card').filter({has: page.getByRole('heading', {name: 'Robot Builder - Beta', exact: true})});
    check('homepage beta card ' + width, await card.count() === 1);
    check('seven retained tool cards ' + width, await page.locator('.tool-card').count() === 7);
    await layout(page, 'homepage ' + width);
    const launch = page.waitForEvent('popup');
    await card.getByRole('link', {name: 'Open Robot Builder', exact: true}).click();
    const editor = await launch;
    await editor.setViewportSize({width, height: 1000});
    await editor.locator('#stage-nav button').first().waitFor();
    check('homepage launch resolves ' + width, editor.url() === root);
    check('beta version visible ' + width, await editor.locator('#release-version').isVisible() && await editor.locator('#release-version').textContent() === 'Beta 0.2');
    check('six construction stages ' + width, await editor.locator('#stage-nav button').count() === 6);
    await editor.locator('#robot-name').fill('Release smoke ' + width);
    await editor.locator('#robot-name').press('Tab');
    await layout(editor, 'editor ' + width);
    await editor.screenshot({path: path.join(out, 'release-editor-' + width + '.png'), fullPage: true});
    const popup = editor.waitForEvent('popup');
    await editor.getByRole('link', {name: 'Robot Builder changelog (opens in a new tab)', exact: true}).click();
    const notes = await popup;
    await notes.setViewportSize({width, height: 1000});
    await notes.getByRole('heading', {name: 'Robot Builder changelog', exact: true}).waitFor();
    check('editor changelog resolves ' + width, notes.url() === changelog);
    check('release entry ' + width, (await notes.locator('#release-beta-0-1').textContent()).includes('Beta 0.1'));
    check('source boundary visible ' + width, await notes.getByRole('heading', {name: 'Beta coverage', exact: true}).isVisible());
    check('scope qualification retained ' + width, (await notes.locator('main').textContent()).includes('does not certify every legal Robot Handbook design'));
    check('feedback matches existing site ' + width, await notes.locator('a[href="mailto:bows_cosmic.7e@icloud.com"]').count() === 1);
    check('no reference tables ' + width, await notes.locator('table').count() === 0);
    await notes.getByRole('link', {name: 'Traveller Tools', exact: true}).focus();
    check('keyboard focus indication ' + width, await notes.getByRole('link', {name: 'Traveller Tools', exact: true}).evaluate(element => getComputedStyle(element).outlineStyle !== 'none'));
    check('navigation touch targets ' + width, await notes.locator('nav a').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 44)));
    await layout(notes, 'changelog ' + width);
    await notes.screenshot({path: path.join(out, 'release-changelog-' + width + '.png'), fullPage: true});
    await notes.getByRole('link', {name: 'Open Robot Builder', exact: true}).click();
    await notes.locator('#stage-nav button').first().waitFor();
    check('changelog return to tool ' + width, notes.url() === root);
    await notes.goBack();
    await notes.getByRole('heading', {name: 'Robot Builder changelog', exact: true}).waitFor();
    check('back to changelog ' + width, notes.url() === changelog);
    await notes.getByRole('link', {name: 'Copyright & usage notice', exact: true}).click();
    check('usage notice resolves ' + width, new URL(notes.url()).hash === '#copyright-notice' && await notes.locator('#copyright-notice').isVisible());
    await notes.close();
    check('closing changelog preserves unsaved editor ' + width, await editor.locator('#robot-name').inputValue() === 'Release smoke ' + width);
    const repeated = editor.waitForEvent('popup');
    await editor.getByRole('link', {name: 'Robot Builder changelog (opens in a new tab)', exact: true}).press('Enter');
    const repeatedNotes = await repeated;
    await repeatedNotes.getByRole('heading', {name: 'Robot Builder changelog', exact: true}).waitFor();
    check('keyboard reopen ' + width, repeatedNotes.url() === changelog);
    await repeatedNotes.close();
    check('repeated changelog access preserves draft ' + width, await editor.locator('#robot-name').inputValue() === 'Release smoke ' + width);
    await editor.close();
    await card.getByRole('link', {name: 'Robot Builder Changelog', exact: true}).click();
    await page.getByRole('heading', {name: 'Robot Builder changelog', exact: true}).waitFor();
    check('homepage changelog resolves ' + width, page.url() === changelog);
    await page.getByRole('link', {name: 'Traveller Tools', exact: true}).click();
    check('changelog homepage return ' + width, page.url() === site);
    await page.goBack();
    await page.getByRole('heading', {name: 'Robot Builder changelog', exact: true}).waitFor();
    check('back navigation restores changelog ' + width, page.url() === changelog);
  }
  check('preview never increments published visits', hits.length === 0);
  check('no browser errors', errors.length === 0);
  await fs.writeFile(path.join(out, 'release-browser.json'), JSON.stringify({checks, errors, hits}, null, 2));
  console.log('PASS ' + checks.length + ' Robot Builder release integration browser checks');
} catch (error) {
  await fs.writeFile(path.join(out, 'release-browser-failure.json'), JSON.stringify({message: error.message, checks, errors, hits}, null, 2));
  throw error;
} finally {
  await browser.close();
}
