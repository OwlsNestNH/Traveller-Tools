import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {lifeFixture,run} from './core-life-event-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[];let browser;
async function saved(page){return project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#new').disabled);}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const width of [1440,320])for(const transport of ['', '?api=local'])for(const scenario of ['narrative','betrayal','artefact','psionics','crime']){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   const fixture=scenario==='artefact'||scenario==='psionics'?lifeFixture({seed:'life-566',unusual:scenario==='artefact'?3:1,...(scenario==='artefact'?{rulesRevision:'character-preview-2026-11-09.20'}:{})}):lifeFixture({row:scenario==='narrative'?3:scenario==='betrayal'?8:11});
   await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('#core-life-decision').waitFor();
   assert.equal(await page.locator('[data-action=add-effect]').count(),0);const before=await saved(page);await page.locator('[data-action=resolve-life-event]').click();await ready(page);assert.equal((await saved(page)).revision,before.revision);
   // Interrupted pending saves replay identically before the user makes a decision.
   await page.reload();await page.locator('#core-life-decision').waitFor();assert.deepEqual((await saved(page)).state,before.state);
   if(scenario==='narrative')await page.locator('#life-outcome').selectOption('birth');
   if(scenario==='betrayal'){await page.locator('#life-role').selectOption('Enemy');await page.locator('#life-name').fill('Former associate');}
   if(scenario==='artefact')await page.locator('#life-name').fill('Uncatalogued device');
   if(scenario==='crime')await page.locator('#life-outcome').selectOption('lose-benefit');
   if(scenario==='psionics'){await page.locator('#life-outcome').selectOption('test');await page.locator('#life-funding').selectOption('provided');assert.equal(await page.locator('#life-cost').inputValue(),'0');await page.locator('#life-referee').check();await page.locator('#life-timing').check();}
   await page.locator('#life-reason').fill('Original source decision for this character.');await page.locator('#life-confirm').check();
   await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('life-'+scenario+'-'+width+'-'+(transport?'http':'static')+'-pending.png',out))});
   await page.locator('[data-action=resolve-life-event]').dblclick();await ready(page);const after=await saved(page);assert.equal(after.revision,before.revision+1);assert.equal(after.state.stage,'advancement');assert.ok(after.state.character.lifeEvents.every(e=>e.status==='completed'));
   assert.match(await page.locator('.core-life-ledger').innerText(),/Original source decision/);assert.ok(after.log.at(-1).changes.some(c=>c.path.startsWith('lifeEvents.')));
   await page.reload();await page.locator('.core-life-ledger').waitFor();assert.deepEqual((await saved(page)).state,after.state);
   await page.emulateMedia({media:'print'});assert.match(await page.locator('.core-life-ledger').innerText(),/Core life events/);await page.emulateMedia({media:'screen'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks.push({scenario,width,transport:transport?'http':'static',passed:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('core-life-events-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
