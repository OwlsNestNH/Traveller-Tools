import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {directFireFixture} from './direct-fire-fixture.mjs';
import {missileFixture} from './missile-fixture.mjs';
import {applyCommand} from '../engine.mjs';
import {prepareDirectFireCommand} from '../direct-fire-resolution.mjs';
import {prepareImpacts} from '../missile-impact.mjs';
import {holdMounts} from '../gunnery.mjs';
import {openWorkflowInfo} from './console-navigation.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/',out=new URL('../verification-artifacts/resolution-mfd/',import.meta.url);await mkdir(out,{recursive:true});
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),browser=await chromium.launch({headless:true,...(process.env.SHIP_COMBAT_CHROMIUM?{executablePath:process.env.SHIP_COMBAT_CHROMIUM}:{})});
try{for(const width of [1815,1440,1100,701,390,320]){
 const context=await browser.newContext({viewport:{width,height:width===1815?866:700}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__resolutionDice=0;Math.random=()=>{window.__resolutionDice++;return .34;};});
 let separated=directFireFixture({high:[['mixed:1','Pulse laser','low']],third:[['second:1','Beam laser','low']]});separated.ships.find(s=>s.id==='high').motion.position={q:3,r:-3};separated.ships.find(s=>s.id==='third').motion.position={q:7,r:4};
 await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nimport {normalizeState as restoreResolution} from './engine.mjs';state=restoreResolution(${JSON.stringify(separated)});selected='low';camera=fitShipsCamera(state.ships);render();window.__resolutionState=()=>structuredClone(state);`}));
 try{
  await page.goto(new URL('tools/ship-combat-alpha/',root).href);const state=()=>page.evaluate(()=>window.__resolutionState()),initial=await state();
  await page.locator('[data-resolution=resolve]').waitFor();if([1815,1440,1100,390,320].includes(width))await page.screenshot({path:new URL(`pending-${width}.png`,out).pathname});
  await page.locator('[data-resolution=resolve]').dblclick();await page.keyboard.press('Enter');
  const saved=await state(),dice=await page.evaluate(()=>window.__resolutionDice);assert.equal(saved.combatHistory.length,1);assert.notDeepEqual(saved,initial);assert.equal(await page.locator('[data-resolution=resolve]').count(),0);
  if(width===1815){const zoom=Number(await page.locator('#map').getAttribute('data-zoom'));await page.locator('#zoom-in').dblclick();await page.waitForFunction(old=>Number(document.querySelector('#map').dataset.zoom)>old*1.9,zoom);await page.locator('#fit').click();await page.waitForFunction(old=>Number(document.querySelector('#map').dataset.zoom)<=old+0.01,zoom);}
  assert.match(await page.locator('.resolution-summary').innerText(),/Attack roll|Hull damage/);
  if([1815,1440,1100,390,320].includes(width)){await page.screenshot({path:new URL(`saved-${width}.png`,out).pathname});if(width<700)await page.screenshot({path:new URL(`full-${width}.png`,out).pathname,fullPage:true});}
  await page.locator('[data-resolution=replay]').click();assert.equal(await page.locator('#resolution-replay').count(),1);if(width===1815){await page.waitForTimeout(500);await page.screenshot({path:new URL('replay-1815.png',out).pathname});}
  await page.locator('[data-resolution=next]').dblclick();await page.keyboard.press('Enter');assert.equal(await page.locator('#resolution-replay').count(),0);assert.match(await page.locator('.resolution-screen').innerText(),/Saved attack 2 of 2/);
  await page.locator('[data-resolution=log]').click();if([1815,390,320].includes(width))await page.screenshot({path:new URL(`log-${width}.png`,out).pathname,fullPage:width<700});await page.locator('[data-resolution-index="0"]').dblclick();await page.keyboard.press('Enter');assert.match(await page.locator('.resolution-screen').innerText(),/Saved attack 1 of 2/);
  assert.deepEqual(await state(),saved);assert.equal(await page.evaluate(()=>window.__resolutionDice),dice);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  separated=JSON.parse(JSON.stringify(saved));await page.reload();assert.deepEqual(await state(),saved,'serialized results survive a real reload');assert.equal(await page.evaluate(()=>window.__resolutionDice),0,'reload does not roll again');assert.match(await page.locator('.resolution-screen').innerText(),/Saved attack 1 of 2/);assert.deepEqual(errors,[]);console.log('PASS Resolution MFD '+width);
 }finally{await context.close();}
 }
 const separate=s=>{s.ships.find(ship=>ship.id==='high').motion.position={q:3,r:-3};s.ships.find(ship=>ship.id==='third').motion.position={q:7,r:4};return s;};
 const base=separate(directFireFixture()),miss=applyCommand(base,prepareDirectFireCommand(base,()=>0)),manualInput=separate(directFireFixture()),holdInput=separate(directFireFixture());manualInput.ships.find(s=>s.id==='high').condition.powerOutput=null;holdInput.ships.find(s=>s.id==='low').condition.hull=0;
 const manual=applyCommand(manualInput,prepareDirectFireCommand(manualInput,()=>.5)),missileInput=separate(missileFixture()),launch=applyCommand(missileInput,prepareDirectFireCommand(missileInput,()=>.9));
 let impact=applyCommand(launch,{type:'next-battle-phase',phase:'attacks'});impact=applyCommand(impact,{type:'next-battle-phase',phase:'crew'});
 for(const shipId of [...impact.acceleration.order])impact=applyCommand(impact,{type:'declare-acceleration',shipId});impact=applyCommand(impact,{type:'advance-round'});
 for(const shipId of impact.workflow.gunnery.order){const rows=holdMounts(impact.ships.find(s=>s.id===shipId));if(shipId==='low')Object.assign(rows[0],{action:'point-defense',weapon:'Pulse laser',targetId:null});impact=applyCommand(impact,{type:'declare-gunnery',shipId,mounts:rows});}
 const arrivalPending=structuredClone(impact);impact=applyCommand(impact,prepareDirectFireCommand(impact,()=>.9));impact=applyCommand(impact,prepareImpacts(impact,()=>.9));
 const hold=applyCommand(holdInput,prepareDirectFireCommand(holdInput,()=>.5));
 for(const [name,fixture] of [['miss',miss],['hold',hold],['manual',manual],['launch',launch],['impact-pd',impact]])for(const width of [1815,320]){
  const context=await browser.newContext({viewport:{width,height:width===1815?866:700}}),page=await context.newPage();
  try{await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nstate=${JSON.stringify(fixture)};selected='low';camera=fitShipsCamera(state.ships);render();`}));await page.goto(new URL('tools/ship-combat-alpha/',root).href);await page.locator('.resolution-summary').waitFor();await page.locator('.resolution-details summary').click();await page.screenshot({path:new URL(`${name}-${width}.png`,out).pathname,fullPage:width<700});if(width===1815&&['miss','launch'].includes(name)){await page.locator('[data-resolution=replay]').click();await page.waitForTimeout(500);await page.screenshot({path:new URL(`${name}-replay-${width}.png`,out).pathname});}if(name==='hold')assert.equal(await page.locator('[data-resolution=replay]').isDisabled(),true);}finally{await context.close();}
 }
 for(const [name,fixture,width] of [['arrival',arrivalPending,701],['manual',manual,390],['all-hold',directFireFixture({}),320]]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();await page.addInitScript(()=>{window.__resolutionDice=0;Math.random=()=>{window.__resolutionDice++;return .9;};});
  try{await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nstate=${JSON.stringify(fixture)};selected='low';render();window.__resolutionState=()=>structuredClone(state);`}));await page.goto(new URL('tools/ship-combat-alpha/',root).href);const state=()=>page.evaluate(()=>window.__resolutionState()),before=await state();
   if(name==='arrival'){await page.locator('[data-resolution=resolve]').dblclick();await page.keyboard.press('Enter');assert.equal((await state()).missileCombat.impacts.length,0);assert.equal(await page.evaluate(()=>window.__resolutionDice),0);await page.locator('[data-resolution=impacts]').dblclick();await page.keyboard.press('Enter');assert.equal((await state()).missileCombat.impacts.length,1);const saved=await state(),dice=await page.evaluate(()=>window.__resolutionDice);await page.locator('[data-resolution=log]').click();await page.locator('[data-resolution-index="0"]').click();assert.deepEqual(await state(),saved);assert.equal(await page.evaluate(()=>window.__resolutionDice),dice);}
   if(name==='manual'){await page.locator('[data-resolution=complete]').click();assert.deepEqual(await state(),before,'manual completion requires a note');await openWorkflowInfo(page);await page.locator('[data-manual-attacks]').fill('Synthetic manual handling');await page.keyboard.press('Escape');}
   await page.locator('[data-resolution=complete]').click({clickCount:3});const afterClicks=await state();await page.keyboard.press('Enter');const completed=await state();assert.equal(completed.workflow?.phase,'crew',JSON.stringify({name,afterClicks:afterClicks.workflow,afterEnter:completed.workflow,active:await page.evaluate(()=>document.activeElement?.outerHTML)}));if(name==='all-hold')assert.deepEqual(completed.ships,before.ships);if(name==='manual')assert.equal(completed.workflow.manualResolution,'Synthetic manual handling');console.log('PASS Resolution '+name);
  }finally{await context.close();}
 }
 await writeFile(new URL('manifest.json',out),JSON.stringify({commit:process.env.SHIP_COMBAT_COMMIT??null,fixture:'Synthetic directFireFixture and missileFixture',widths:[1815,1440,1100,390,320],states:['pending','saved hit','attack log','replay','miss','hold','manual','missile launch','missile impact and point defence','phone full page']},null,2));
}finally{await browser.close();}
