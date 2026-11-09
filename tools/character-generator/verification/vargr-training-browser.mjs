import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {lonerTrainingFixture} from './vargr-training-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const apiMode of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(lonerTrainingFixture().session)});await page.reload();await page.locator('#training-award-options').waitFor();
   assert.match(await page.locator('#workspace').innerText(),/p. 195/);assert.match(await page.locator('#training-award-options').innerText(),/Profession \(belter\)/);
   assert.equal(await page.locator('#award-skill').getAttribute('list'),'award-skill-options');
   const values=await page.locator('#award-skill-options option').evaluateAll(nodes=>nodes.map(n=>n.value));assert.ok(values.includes('Engineer (power)'));assert.ok(!values.includes('Medic'));
   const name='vargr-training-'+width+(apiMode?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL(name+'-pending.png',out)),fullPage:true});
   await page.locator('#award-skill').fill('Medic');await page.locator('[data-action=choose-skill]').click();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.equal(await page.locator('#training-award-options').count(),1);
   await page.locator('[data-action=skill-award-source]').click();await page.locator('[data-action=retry-skill-choice]').waitFor();await page.locator('[data-action=retry-skill-choice]').click();await page.locator('#training-award-options').waitFor();
   await page.locator('#award-skill').fill('Engineer (power)');await page.locator('[data-action=choose-skill]').click();await page.locator('[data-action=advancement]').waitFor();
   const before=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));assert.equal(before.state.character.skills['Engineer (power)'],1);await page.reload();await page.locator('[data-action=advancement]').waitFor();assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))),before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<43).map(n=>n.textContent)),[]);await page.screenshot({path:fileURLToPath(new URL(name+'-complete.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('vargr-training-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
