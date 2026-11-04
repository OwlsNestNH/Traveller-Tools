import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {gunneryFixture} from './gunnery-fixture.mjs';
import {openStation} from './console-navigation.mjs';

const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/';
const out=new URL('../verification-artifacts/attack-mfd/',import.meta.url);await mkdir(out,{recursive:true});
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.SHIP_COMBAT_CHROMIUM?{executablePath:process.env.SHIP_COMBAT_CHROMIUM}:{})});
try{
 for(const width of [1815,1440,1100,701,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1815?866:700}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nstate=${JSON.stringify(gunneryFixture())};selected='low';render();window.__attackState=()=>structuredClone(state);`}));
  try{
   await page.goto(new URL('tools/ship-combat-alpha/',root).href);
   const state=()=>page.evaluate(()=>window.__attackState()),initial=await state(),row=page.locator('[data-gunnery-index="0"]');
   const status=await page.locator('#selected-workspace').boundingBox(),actions=await page.locator('.attack-action-row').boundingBox();
   assert.ok(status.y+status.height<=actions.y+1,'Ship Status precedes Attack actions');
   if(width<700)assert.ok((await page.locator('[data-attack-gunnery] [data-gunnery=info]').boundingBox()).height>=44,'Rules remains a phone touch target');
   const capture=[1815,390,320].includes(width);await row.waitFor();if(capture)await page.screenshot({path:new URL(`viewport-${width}.png`,out).pathname});
   await row.scrollIntoViewIfNeeded();if(capture)await page.screenshot({path:new URL(`form-${width}.png`,out).pathname});
   if(width<700)await page.screenshot({path:new URL(`full-${width}.png`,out).pathname,fullPage:true});
   assert.deepEqual(await row.locator('[data-gunnery-field=weapon] option').allTextContents(),['Select weapon','Pulse laser','Missile rack','Sandcaster']);
   await row.locator('[data-gunnery-field=weapon]').selectOption('Missile rack');
   assert.equal(await row.locator('[data-gunnery-field=action] option[value=point-defense]').count(),0,'missiles cannot reserve a defence');
   await row.locator('[data-gunnery-field=weapon]').selectOption('Sandcaster');
   assert.equal(await row.locator('[data-gunnery-field=action] option[value=attack]').count(),0,'sand cannot attack');
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
   const second=page.locator('[data-gunnery-index="1"]');
   await second.locator('[data-gunnery-field=weapon]').selectOption('Beam laser');
   await second.locator('[data-gunnery-field=action]').selectOption('point-defense');
   if(capture)await page.screenshot({path:new URL(`populated-${width}.png`,out).pathname,fullPage:width<700});
   await page.locator('[data-mfd-phase=Opening]').click();
   assert.deepEqual(await state(),initial,'phase inspection does not commit');
   await page.locator('[data-mfd-phase=Attack]').click();
   assert.equal(await row.locator('[data-gunnery-field=target]').inputValue(),'high','draft survives phase inspection');
   await page.locator('[data-attack-commit]').dblclick();
   await page.keyboard.press('Enter');
   const committed=await state();assert.equal(committed.workflow.gunnery.declarations.length,1);
   assert.equal(committed.workflow.gunnery.declarations[0].mounts[0].targetId,'high');
   assert.equal(committed.workflow.gunnery.declarations[0].mounts[1].action,'point-defense');
   assert.deepEqual(committed.ships,initial.ships,'declaration does not fire or spend resources');
   await page.locator('[data-select=low]').click();
   assert.equal(await row.locator('[data-gunnery-field=weapon]').isDisabled(),true,'committed ship is locked');
   if(capture)await page.screenshot({path:new URL(`locked-${width}.png`,out).pathname,fullPage:width<700});
   await page.reload();
   await page.locator('[data-attack-gunnery] [data-station-ammunition]').click();
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-attack-gunnery] [data-station-ammunition]'));
   await openStation(page,'gunnery');
   await page.locator('[data-gunnery=commit]').dblclick();
   await page.keyboard.press('Enter');
   assert.equal((await state()).workflow.gunnery.declarations.length,1,'station repeat activation commits only once');
   const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,scrollX,body:document.body.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,className:typeof e.className==='string'?e.className:'',right:r.right,absoluteRight:r.right+scrollX,width:r.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflow:s.overflowX};}).filter(x=>x.absoluteRight>innerWidth+1||x.scrollWidth>x.clientWidth+1&&x.overflow==='visible').slice(0,30)}));
   assert.ok(overflow.scroll<=overflow.viewport+1,JSON.stringify(overflow));
   assert.deepEqual(errors,[]);console.log('PASS Attack MFD '+width);
  }finally{await context.close();}
 }
 await writeFile(new URL('manifest.json',out),JSON.stringify({commit:process.env.SHIP_COMBAT_COMMIT??null,fixture:'Synthetic gunneryFixture',viewports:[{width:1815,height:866},{width:390,height:700},{width:320,height:700}],images:['viewport-1815.png','form-1815.png','populated-1815.png','locked-1815.png','viewport-390.png','form-390.png','full-390.png','populated-390.png','locked-390.png','viewport-320.png','form-320.png','full-320.png','populated-320.png','locked-320.png']},null,2));
}finally{await browser.close();}
