import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../../../' + file, import.meta.url), 'utf8');
const home = read('index.html');
const tool = read('tools/robot-builder/index.html');
const changesPath = 'changes/robot.html';
const changes = () => read(changesPath);
const version = html => html.match(/<meta name="application-version" content="([^"]+)"/i)?.[1];

test('Robot Builder release is reachable from the homepage without displacing existing tools', () => {
  const card = home.match(/<section class="tool-card">\s*<h2>Robot Builder - Beta<\/h2>[\s\S]*?<\/section>/)?.[0];
  assert.ok(card, 'Robot Builder has its own beta tool card');
  assert.match(card, /href="tools\/robot-builder\/"/);
  assert.match(card, /href="changes\/robot.html"/);
  for (const route of ['nav-calculator', 'traveller_ship_logger_v2', 'traveller_tools_buttons', 'trade-route-calculator', 'ship-combat-alpha', 'vehicle-builder']) assert.ok(home.includes('href="tools/' + route + '/"'));
  assert.match(home, /href="changes\/trade.html"/);
  assert.match(read('changes/trade.html'), /id="release-whole-day-lss"/);
  assert.match(read('changes/trade.html'), /id="release-luxury-lss"/);
});

test('release version is consistent and changelog opens separately from the draft', () => {
  assert.equal(version(tool), '0.1.0-beta.1');
  assert.equal(version(changes()), version(tool));
  assert.match(tool, /id="release-version">Beta 0\.1<\/span>/);
  assert.match(tool, /<a[^>]*href="\.\.\/\.\.\/changes\/robot.html"[^>]*target="_blank"[^>]*rel="noopener"[^>]*aria-label="[^"]*new tab[^"]*"[^>]*>Changelog<\/a>/);
  assert.match(changes(), /id="release-beta-0-1"/);
  assert.match(changes(), /Beta 0\.1/);
  assert.match(read('tools/robot-builder/README.md'), /0\.1\.0-beta\.1/);
});

test('changelog keeps accessible site navigation, feedback and usage notice', () => {
  const html = changes();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /nav aria-label="Page navigation"/);
  assert.match(html, /href="\.\.\/tools\/robot-builder\/"/);
  assert.match(html, /href="\.\.\/#copyright-notice"/);
  assert.match(home, /id="copyright-notice"/);
  const feedback = read('changes/vehicle.html').match(/href="(mailto:[^"]+)"/)[1];
  assert.ok(html.includes('href="' + feedback + '"'));
  assert.match(html, /a:focus-visible/);
  assert.match(html, /min-height:44px/);
  assert.match(html, /<time datetime="2026-11-08">November 8, 2026<\/time>/);
  assert.match(html, /Dates shown in UTC/);
  assert.doesNotMatch(html, /<table|C:[\\/]|robot-builder-inputs|release-audit\.md|<script/i);
});

test('beta scope distinguishes construction checks from source and external dependencies', () => {
  const html = changes();
  for (const phrase of ['Six independent construction stages', 'Save a copy', 'JSON', 'printable statblock', 'source references', 'referee', 'Metamorphic: provisional', 'Host legality not checked', 'Recipient record required', 'Acquisition only', 'every legal Robot Handbook design']) assert.ok(html.includes(phrase), phrase);
  assert.match(html, /does not certify every legal Robot Handbook design/);
  assert.match(html, /Combat, treatment, maintenance and factory operation remain separate/);
  assert.match(html, /Selected external equipment/);
  assert.doesNotMatch(html, /whole-book certified|all legal robots|fully implements the Robot Handbook/i);
});

const counterCode = read('assets/js/tool-visits.js');
function count(pathname, hostname = 'owlsnestnh.github.io', visibilityState = 'visible') {
  const requests = [], events = {};
  const document = {visibilityState, body: {appendChild() {}}, addEventListener: (name, callback) => events[name] = callback, removeEventListener: name => delete events[name]};
  const context = vm.createContext({location: {hostname, pathname, search: '?design=private', hash: '#private'}, window: {}, document, Image: class {set src(value) {requests.push(value);} remove() {}}});
  vm.runInContext(counterCode, context);
  vm.runInContext(counterCode, context);
  return {requests, events, document};
}

test('robot uses one canonical shared visit counter without sending draft, query or fragment', () => {
  assert.equal((tool.match(/src="\.\.\/\.\.\/assets\/js\/tool-visits.js"/g) || []).length, 1);
  const hit = 'https://hits.sh/owlsnestnh.github.io/Traveller-Tools/tools/robot-builder.svg';
  for (const suffix of ['', 'index.html']) assert.deepEqual(count('/Traveller-Tools/tools/robot-builder/' + suffix).requests, [hit]);
  for (const pathname of ['/Traveller-Tools/', '/Traveller-Tools/changes/robot.html', '/Traveller-Tools/tools/robot-builder/js/app.mjs', '/Traveller-Tools/tools/robot-builder/verification/']) assert.deepEqual(count(pathname).requests, []);
  assert.deepEqual(count('/Traveller-Tools/tools/robot-builder/', 'localhost').requests, []);
  assert.deepEqual(count('/Traveller-Tools/tools/robot-builder/', '127.0.0.1').requests, []);
  const hidden = count('/Traveller-Tools/tools/robot-builder/', undefined, 'hidden');
  assert.deepEqual(hidden.requests, []);
  hidden.document.visibilityState = 'visible';
  hidden.events.visibilitychange();
  assert.deepEqual(hidden.requests, [hit]);
  assert.equal(hidden.events.visibilitychange, undefined);
  assert.equal((home.match(/img.shields.io\/badge\/dynamic\/json/g) || []).length, 7);
  assert.match(home, /tools%2Frobot-builder&amp;query=%24.total/);
  assert.doesNotMatch(home, /<script[^>]*tool-visits.js/);
});
