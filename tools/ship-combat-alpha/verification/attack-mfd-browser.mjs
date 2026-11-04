import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {gunneryFixture} from './gunnery-fixture.mjs';
import {openStation} from './console-navigation.mjs';

const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/';
const out=new URL('../verification-artifacts/attack-mfd/',import.meta.url);await mkdir(out,{recursive:true});
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.SHIP_COMBAT_CHROMIUM?{executablePath:process.env.SHIP_COMBAT_CHROMIUM}:{})});
try{
 for(const width of [1815,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1815?866:700}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nstate=${JSON.stringify(gunneryFixture())};selected='low';render();window.__attackState=()=>structuredClone(state);`}));
  try{
   await page.goto(new URL('tools/ship-combat-alpha/',root).href);
   const state=()=>page.evaluate(()=>window.__attackState()),initial=await state(),row=page.locator('[data-gunnery-index="0"]');
   await row.waitFor();await page.screenshot({path:new URL(`viewport-${width}.png`,out).pathname});
   await row.scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`form-${width}.png`,out).pathname});
   assert.deepEqual(await row.locator('[data-gunnery-field=weapon] option').allTextContents(),['Choose installed weapon','Pulse laser','Missile rack','Sandcaster']);
   await row.locator('[data-gunnery-field=weapon]').selectOption('Pulse laser');
   await row.locator('[data-gunnery-field=action]').selectOption('attack');
   await row.locator('[data-gunnery-field=target]').selectOption('high');
   assert.deepEqual(await state(),initial,'draft does not mutate the encounter');
   await page.locator('[data-attack-hold]').click();
   assert.equal(await row.locator('[data-gunnery-field=action]').inputValue(),'hold');
   assert.deepEqual(await state(),initial,'hold fire changes only the draft');
   await row.locator('[data-gunnery-field=weapon]').selectOption('Pulse laser');
   await row.locator('[data-gunnery-field=action]').selectOption('attack');
   await row.locator('[data-gunnery-field=target]').selectOption('high');
   await page.locator('[data-mfd-phase=Opening]').click();
   assert.deepEqual(await state(),initial,'phase inspection does not commit');
   await page.locator('[data-mfd-phase=Attack]').click();
   assert.equal(await row.locator('[data-gunnery-field=target]').inputValue(),'high','draft survives phase inspection');
   await page.locator('[data-attack-commit]').dblclick();
   await page.keyboard.press('Enter');
   const committed=await state();assert.equal(committed.workflow.gunnery.declarations.length,1);
   assert.equal(committed.workflow.gunnery.declarations[0].mounts[0].targetId,'high');
   assert.deepEqual(committed.ships,initial.ships,'declaration does not fire or spend resources');
   await page.reload();
   await page.locator('[data-attack-gunnery] [data-station-ammunition]').click();
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-attack-gunnery] [data-station-ammunition]'));
   await page.locator('[data-attack-gunnery] [data-gunnery=commit]').dblclick();
   await page.keyboard.press('Enter');
   assert.equal((await state()).workflow.gunnery.declarations.length,1,'MFD repeat activation commits only once');
   await page.reload();
   await openStation(page,'gunnery');
   await page.locator('[data-gunnery=commit]').dblclick();
   await page.keyboard.press('Enter');
   assert.equal((await state()).workflow.gunnery.declarations.length,1,'station repeat activation commits only once');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);console.log('PASS Attack MFD '+width);
  }finally{await context.close();}
 }
}finally{await browser.close();}
