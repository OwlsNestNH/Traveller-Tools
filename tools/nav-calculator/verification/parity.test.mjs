import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Independent browser oracle, never imported from the refactored implementation.
// Fixture: git show ea48ea7d65699f99fd2a2f468c7c887c82695175:tools/nav-calculator/index.html
// Preserve the raw git bytes when regenerating; changing this baseline requires review.
const fixture = await readFile(new URL('./fixtures/pr264.html', import.meta.url));
assert.equal(createHash('sha256').update(fixture).digest('hex'),
  'c6c77d4facbe0c16c8cdd15aa3ae89a96b7a0a2cc58c5e366d9f7ae10934d994', 'PR264 oracle integrity');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    let target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Outside root');
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    res.writeHead(200, {'Content-Type': {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css'}[path.extname(target)] || 'application/octet-stream'});
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const target = process.env.NAV_TEST_URL || new URL('tools/nav-calculator/', base).href;
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
let browser;
let checks = 0;

// Every case starts fresh unless explicitly testing a sequence of transitions.
const cases = [];
const add = (name, values, button = 'Solve Route') => cases.push({name, steps:[{button:'Clear'}, {values:{thrust:1, ...values}}, {button}]});
for (const profile of ['flip', 'const']) {
  for (const mode of ['km', 'au']) for (const distance of ['0.000001', '1', '100000', '150000000', '1e100'])
    add(`${profile}/${mode}/${distance}`, {profile, distMode:mode, [mode === 'km' ? 'distanceKm' : 'distanceAu']:distance});
  for (let whole = 0; whole <= 20; whole++) for (const fraction of [0, .01, .25, .5, .99])
    add(`${profile}/orbit/${whole}/${fraction}`, {profile, distMode:'orbit', orbitStartWhole:whole, orbitStartFrac:fraction, orbitEndWhole:(whole + 7) % 21, orbitEndFrac:.25});
  for (const aMode of ['au', 'orbit']) for (const bMode of ['au', 'orbit'])
    for (const separation of ['same','opp','1','2','3']) for (const safety of ['direct','1.5','2.0','2.5'])
      add(`${profile}/map/${aMode}/${bMode}/${separation}/${safety}`, {profile, distMode:'map', aMode, bMode, au1:1, au2:5, aOrbitWhole:3, aOrbitFrac:.25, bOrbitWhole:12, bOrbitFrac:.99, separation, routeType:safety === 'direct' ? 'direct' : 'trans', safety:safety === 'direct' ? '2.0' : safety});
  for (const body of ['rocky','gg_small','gg_std','gg_large','gg_super'])
    for (const size of body === 'rocky' ? ['0','R','S',...'123456789ABCDEF'] : ['8'])
      for (const button of ['Solve Route','Compute 100D Only'])
        add(`${profile}/100D/${body}/${size}/${button}`, {profile, distanceKm:100000, use100d:true, jumpBodyType:body, sizeCode:size}, button);
  for (const effect of [0,1,3,10,-1,-5,-6,-10]) for (const autoDice of [true,false])
    add(`${profile}/astro/${effect}/${autoDice}`, {profile, distanceKm:100000, useAstro:true, effect, autoDice});
  for (const manualPct of [-100,-20,0,20,99.9,100,150])
    add(`${profile}/manual/${manualPct}`, {profile, distanceKm:100000, useAstro:true, effect:-6, manualPct});
}
for (const thrust of ['',0,-1,'1e-320','1e308']) add(`invalid thrust ${thrust}`, {thrust, distanceKm:100000});
for (const distMode of ['km','au']) for (const value of ['',0,-1,'1e308'])
  add(`invalid ${distMode}/${value}`, {distMode, [distMode === 'km' ? 'distanceKm' : 'distanceAu']:value});
for (const id of ['orbitStartFrac','orbitEndFrac','aOrbitFrac','bOrbitFrac']) for (const value of ['',-5,1,.001])
  add(`invalid fraction ${id}/${value}`, {distMode:id.startsWith('orbit') ? 'orbit' : 'map', aMode:'orbit', bMode:'orbit', [id]:value});
for (const effect of ['',1.5,1000000000,50]) add(`invalid effect ${effect}`, {distanceKm:100000, useAstro:true, autoDice:false, effect});
add('extreme advisory time keeps route usable', {thrust:'1e-308',distanceKm:'1e-310',use100d:true});
add('zero map separation', {distMode:'map',au1:1,au2:1,separation:'same'});
add('zero orbit separation', {distMode:'orbit',orbitStartWhole:3,orbitEndWhole:3});
for (const mode of ['km','au','map','orbit']) cases.push({name:`state transitions/${mode}`, steps:[
  {button:'Clear'}, {values:{thrust:1,distanceKm:100000,distanceAu:1,au1:1,au2:5}}, {button:'Solve Route'},
  {values:{distMode:mode}}, {button:'Solve Route'}, {values:{profile:'const'}}, {values:{profile:'flip'}},
  {button:'Compute 100D Only'}, {values:{thrust:2,profile:'const'}}, {button:'Solve Route'},
  {values:{useAstro:true,effect:-6}}, {button:'Solve Route'}, {button:'Solve Route'}, {values:{useAstro:false}},
  {values:{use100d:true,jumpBodyType:'gg_super'}}, {button:'Compute 100D Only'}, {values:{use100d:false}},
  {button:'Clear'}, {values:{thrust:1,distanceKm:100000,profile:'const'}}, {button:'Clear'}
]});
cases.push({name:'drawer and repeated reset', steps:[{button:'Clear'}, {values:{distMode:'map',routeType:'trans'}}, {button:'Why trans-solar multipliers?'}, {values:{routeType:'direct'}}, {values:{routeType:'trans'}}, {button:'Why trans-solar multipliers?'}, {button:'Clear'}, {button:'Clear'}]});

try {
  browser = await chromium.launch({headless:true, ...(process.env.NAV_BROWSER_CHANNEL ? {channel:process.env.NAV_BROWSER_CHANNEL} : {})});
  // An unrelated, empty consumer imports the ESM API without the Nav UI.
  const consumer = await browser.newPage();
  await consumer.goto(new URL('tools/nav-calculator/engine.js',base).href);
  const consumed = await consumer.evaluate(async () => {
    const api = await import('./engine.mjs');
    const result = api.solveRoute({thrustG:1,distance:{mode:'km',km:100000}});
    return {version:api.API_VERSION,rawKm:result.distance.rawKm,minutes:result.nominalRoutedMin,
      defaultMatches:api.default.solveRoute === api.solveRoute};
  });
  assert.equal(consumed.version,'1.0.0');assert.equal(consumed.rawKm,100000);
  assert.equal(consumed.minutes,2*Math.sqrt(100000000/9.80665)/60);assert.equal(consumed.defaultMatches,true);
  await consumer.close();
  for (const width of [1440,320]) {
    const context = await browser.newContext({viewport:{width,height:900},locale:'en-US'});
    const allowed = new Set([new URL(base).origin,new URL(target).origin]);
    await context.route('**/*', route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    await context.addInitScript(() => {
      window.parityRandomIndex = 0;
      Math.random = () => [0,.999999,.25,.5,.75,.1][window.parityRandomIndex++ % 6];
      window.parityAlerts = [];
      window.parityClipboard = [];
      window.alert = value => window.parityAlerts.push(String(value));
      Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async value => window.parityClipboard.push(value)}});
    });
    const pages = await Promise.all([context.newPage(),context.newPage()]);
    const errors = [];
    pages.forEach((page,i) => page.on('pageerror',error => errors.push(`${i}: ${error.message}`)));
    await Promise.all([pages[0].goto(new URL('tools/nav-calculator/verification/fixtures/pr264.html',base).href),pages[1].goto(target)]);
    for (const page of pages) await page.waitForFunction(() => document.querySelector('#orbitStartWhole')?.options.length === 21);
    for (const scenario of cases) {
      for (const [stepIndex,step] of scenario.steps.entries()) {
        const snapshots = await Promise.all(pages.map(page => page.evaluate(async step => {
          window.parityRandomIndex = 0;
          for (const [id,value] of Object.entries(step.values || {})) {
            const el = document.getElementById(id);
            el.focus();
            if (el.type === 'checkbox') el.checked = value;
            else el.value = String(value);
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
          }
          if (step.button) {
            const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === step.button);
            if (!button) throw Error(`Missing button ${step.button}`);
            button.focus(); button.click();
          }
          const focus = document.activeElement.id || document.activeElement.textContent.trim();
          const ids = 'pillProfile pillDist mainTime mainSub chipStatus statusText rawDistOut distOut arcMultOut jumpOut totalDistOut commOut nominalOut adjustedOut routeLegOut jumpLegOut legsSumOut speedOut assumeOut notesOut errorBox orbitPreview mapAUPreview d100Preview'.split(' ');
          const outputs = Object.fromEntries(ids.map(id => [id,document.getElementById(id).textContent]));
          const state = [...document.querySelectorAll('input,select,[id$="Block"],#multHelp,#multHelpToggle,#lamp')].map(el => ({id:el.id,value:'value' in el ? el.value : null,checked:el.type === 'checkbox' ? el.checked : null,visible:!!el.getClientRects().length,disabled:!!el.disabled,className:el.className,expanded:el.getAttribute('aria-expanded')}));
          const randomCalls = window.parityRandomIndex;
          window.parityAlerts = []; window.parityClipboard = [];
          const copy = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Copy NAV Brief');
          copy.click();
          await new Promise(resolve => setTimeout(resolve,0));
          return {outputs,state,focus,randomCalls,copyAlerts:window.parityAlerts,copiedBrief:window.parityClipboard};
        },step)));
        assert.deepEqual(snapshots[1],snapshots[0],`${width}px ${scenario.name}, step ${stepIndex}: ${JSON.stringify(step)}`);
        checks++;
      }
    }
    assert.deepEqual(errors,[],`${width}px browser exceptions`);
    await context.close();
  }
  console.log(`PASS: ${checks} exact UI/clipboard/state comparisons across ${cases.length} scenarios at desktop and mobile widths against immutable PR264.`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
