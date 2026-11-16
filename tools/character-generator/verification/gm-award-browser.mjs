import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/gm-award-preview/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(8786,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',fixture=exportSession(finalSheetFixture().session),results=[];
try{
 for(const {width,transport} of [{width:1440,transport:''},{width:390,transport:''},{width:320,transport:''},{width:390,transport:'?api=local'}]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,fixture);},{key,fixture});
  await page.goto('http://127.0.0.1:8786/'+transport);
  await page.locator('#connection-person').waitFor();

  await page.locator('[data-action="completion-step"][data-step="group"]').click();
  const panel=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Custom GM award$/})});
  await panel.locator('summary').click();
  await page.locator('#gm-award-skill').selectOption('custom:Science');await page.locator('#gm-award-skill-custom').fill('xenobotany');
  await page.locator('#gm-award-level').selectOption('2');await page.locator('#gm-award-reason').fill('GM-approved campaign training.');
  assert.equal(await page.locator('#gm-award-skill option[value="custom:Engineer"]').count(),0);
  assert.equal(await page.locator('#gm-award-skill option[value="Independence"]').count(),0);
  assert.equal(await page.locator('#gm-award-skill option[value="Jack-of-all-Trades"]').count(),1);
  await page.screenshot({path:fileURLToPath(new URL('gm-award-'+width+'.png',out)),fullPage:true});
  const before=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));
  await page.locator('[data-action="record-gm-skill"]').evaluate(el=>{el.click();el.click();});
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.some(e=>e.command.type==='gm-skill-award'),key);
  await page.reload();await page.locator('[data-action="add-group-skill"]').waitFor({state:'attached'});
  const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),state=project(after).state;
  assert.equal(state.gmSkillAwards.length,1);assert.equal(state.character.skills['Science (xenobotany)'],2);assert.equal(state.groupSkills,undefined);
  assert.deepEqual(after.events.slice(0,before.events.length),before.events);assert.equal(state.rng,project(before).state.rng);
  await panel.locator('summary').click();await page.screenshot({path:fileURLToPath(new URL('gm-award-recorded-'+width+'.png',out)),fullPage:true});
  assert.equal(await page.locator('#gm-award-skill').inputValue(),'');
  assert.equal(await page.locator('#gm-award-reason').inputValue(),'');
  await page.locator('#gm-award-skill').selectOption('Medic');await page.locator('#gm-award-level').selectOption('2');await page.locator('#gm-award-reason').fill('Second GM award.');
  await page.locator('[data-action="record-gm-skill"]').click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.filter(e=>e.command.type==='gm-skill-award').length===2,key);
  assert.equal(await panel.evaluate(n=>n.open),false,'GM panel closes after recording');
  await panel.locator('summary').click();assert.equal(await page.locator('#gm-award-skill').inputValue(),'');assert.equal(await page.locator('#gm-award-level').inputValue(),'1');assert.equal(await page.locator('#gm-award-reason').inputValue(),'');
  await page.reload();await page.locator('[data-action="add-group-skill"]').waitFor({state:'attached'});
  const repeated=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state;
  assert.equal(repeated.gmSkillAwards.length,2);assert.equal(repeated.character.skills['Science (xenobotany)'],2);assert.equal(repeated.character.skills.Medic,2);
  const preserved=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('[data-screen-review-back]').click();await page.locator('#screen-review-dialog').waitFor({state:'visible'});await page.locator('[data-review-current]').click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),preserved);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
  results.push({width,transport:transport?"http":"static",passed:true,errors});await context.close();
 }
 await writeFile(new URL('browser-results.json',out),JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
