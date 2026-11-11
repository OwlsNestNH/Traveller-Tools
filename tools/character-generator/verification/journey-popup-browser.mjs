// Actual working UI, synthetic public-command characters, no campaign data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {trainingFixture} from './training-information-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',checks=[],errors=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const precareer=assignmentSetup('journey-player-review');
const training=trainingFixture({career:'core.drifter',assignment:'wanderer'});
const survival=settleAssignment(force(run(precareer,'skip-precareer'),'career',{id:'core.army',assignment:'support'},[6,6]));
const failed=force(survival,'survival-check',{},[1,1]);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
const ready=page=>page.waitForFunction(()=>document.querySelector('#workspace')?.dataset.revision&&!document.querySelector('#new').disabled);
async function load(page,fixture){await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await ready(page);await page.locator('#journey-dialog[open]').waitFor();}
async function fit(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(await page.locator('#journey-dialog,dialog:modal').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.id)),[]);}
async function photo(page,name){await page.locator('#journey-dialog').scrollIntoViewIfNeeded();await page.locator('#journey-dialog').evaluate(el=>el.scrollTop=0);await page.locator('header h1').evaluate(el=>document.activeElement?.blur());await page.screenshot({path:fileURLToPath(new URL('journey-'+name+'.png',out)),fullPage:false});}
try{
 for(const http of [true,false])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const label=(http?'http':'static')+'-'+width;
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await ready(page);
   await load(page,precareer);let before=await saved(page);
   assert.equal(await page.locator('#journey-dialog').evaluate(el=>el.matches(':modal')),false,'File toolbar stays usable');
   assert.equal(await page.locator('#journey-record').evaluate(el=>el.open),false);
   assert.equal(await page.locator('#journey-dialog [data-action=precareer]:visible').count(),4);
   assert.ok(await page.locator('#step-title').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=30);
   assert.ok(await page.locator('[data-action=precareer]').first().evaluate(el=>el.getBoundingClientRect().height)>=65);
   await fit(page);if(http)await photo(page,'precareer-'+width);
   await page.locator('#simple-log-view').click();await page.locator('#simple-action-log:modal').waitFor();await page.keyboard.press('Escape');assert.equal(await saved(page),before);
   await page.locator('#journey-close').click();assert.equal(await page.locator('#journey-dialog').isVisible(),false);
   await page.locator('#journey-record>summary').click();assert.equal(await page.locator('#sheet').isVisible(),true);
   await page.locator('#journey-reopen').click();assert.equal(await page.locator('#journey-record').evaluate(el=>el.open),false);assert.equal(await saved(page),before);
   await page.locator('#journey-close').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#journey-dialog').isVisible(),false);await page.locator('#journey-reopen').click();
   await page.locator('.journey-education-more>summary').click();assert.equal(await page.locator('#journey-dialog [data-action=precareer]:visible').count(),9);await page.locator('.journey-education-more>summary').click();
   await page.locator('#cancel-character').click();await page.locator('#cancel-character-dialog:modal').waitFor();await page.keyboard.press('Escape');assert.equal(await saved(page),before);
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('#journey-dialog').isVisible(),false);assert.equal(await page.locator('#sheet').isVisible(),true);await page.emulateMedia({media:'screen'});
   await load(page,training);before=await saved(page);await fit(page);if(http)await photo(page,'training-before-'+width);
   await page.locator('.training-info-trigger').first().click();await page.locator('.training-information:popover-open').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#journey-dialog').isVisible(),true,'Nested Escape leaves step open');
   const commandCount=training.session.events.length;
   await page.locator('[data-action=training][data-table=service]').evaluate(el=>{el.click();el.click();});
   await page.waitForFunction(count=>JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.length===count,commandCount+1);await ready(page);
   await page.locator('#journey-result').waitFor();const result=api({operation:'project',session:JSON.parse(await saved(page))});assert.equal(result.ok,true);
   const roll=result.log.at(-1).rolls[0];assert.match(await page.locator('#journey-result').innerText(),new RegExp('Dice total '+roll.total));
   assert.equal(await page.locator('#journey-result').evaluate(el=>document.activeElement===el),true);
   for(const change of result.log.at(-1).changes.filter(c=>c.path.startsWith('skills.')&&typeof c.after==='number')){assert.ok((await page.locator('#journey-result').innerText()).includes(change.path.slice(7)));assert.ok((await page.locator('.journey-record-updates').textContent()).includes(change.path.slice(7)));}
   assert.equal(await page.locator('.journey-record-updates').isVisible(),true);
   await fit(page);if(http)await photo(page,'training-result-'+width);
   const after=await saved(page);await page.locator('#journey-close').click();await page.locator('#journey-record>summary').click();assert.equal(await saved(page),after);
   await page.reload();await ready(page);assert.equal(await saved(page),after);await page.locator('.journey-previous-result>summary').click();assert.equal(await page.locator('#last-action-result').isVisible(),true);
   await load(page,survival);await page.locator('[data-action=survival-check]').click();await page.locator('#journey-result').waitFor();await ready(page);await fit(page);if(http)await photo(page,'survival-result-'+width);
   await load(page,failed);await page.locator('[data-action=career-mishap]').click();await page.locator('#journey-result').waitFor();await ready(page);await fit(page);if(http)await photo(page,'mishap-result-'+width);
   await page.evaluate(()=>document.documentElement.style.fontSize='24px');await fit(page);
   checks.push(label+' popup/toolbar/record/close/escape/nested-info/cancel/print/double-click/results/reload/large-text');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('journey-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){await writeFile(new URL('journey-failure.json',out),JSON.stringify({checks,errors,error:error.message,stack:error.stack},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
