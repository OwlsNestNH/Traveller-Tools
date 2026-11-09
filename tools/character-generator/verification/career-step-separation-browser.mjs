import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {api} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',checks=[],errors=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
let fixture=run(assignmentSetup('separate-term-steps'),'skip-precareer');fixture=settleAssignment(force(fixture,'career',{id:'core.army',assignment:'support'},[6,6]));
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
try{
 for(const http of [false,true])for(const width of [320,1440])for(const failed of [false,true]){
  const initial=failed?force(fixture,'survival-check',{},[1,1]):fixture;
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Hold the HTTP survival response to exercise an in-flight command without
  // using sleeps. A click completes before the asynchronous command commits.
  let releaseSurvival,receivedSurvival;
  const survivalReady=new Promise(resolve=>receivedSurvival=resolve);
  const survivalGate=new Promise(resolve=>releaseSurvival=resolve);
  if(http&&!failed)await page.route('**/api/v1',async route=>{
   if(route.request().postDataJSON()?.command?.type!=='survival-check')return route.continue();
   const response=await route.fetch();receivedSurvival();await survivalGate;await route.fulfill({response});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:JSON.stringify(initial.session)});await page.reload();
  if(!failed){
   await page.locator('[data-action=survival-check]').click();
   if(http){await survivalReady;assert.deepEqual(await saved(page),initial.session);releaseSurvival();}
  }
  await page.locator('[data-action=career-event], [data-action=career-mishap]').waitFor();
  await page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).events.length===count,{key,count:initial.session.events.length+(failed?0:1)});
  const afterCheck=await saved(page),projection=api({operation:'import',raw:JSON.stringify(afterCheck)});assert.equal(projection.ok,true);
  assert.ok(['career-event','career-mishap'].includes(projection.state.stage));
  assert.equal(afterCheck.events.length,initial.session.events.length+(failed?0:1));assert.equal(afterCheck.events.at(-1).rolls.length,1);
  const step=projection.state.stage;await page.locator('[data-action='+step+']').waitFor();
  assert.doesNotMatch(await page.locator('#last-action-result').innerText(),/Career event rolled:|Mishap rolled:/);
  assert.equal(await page.locator('[data-action=advancement]').count(),0);
  await page.reload();await page.locator('[data-action='+step+']').waitFor();assert.deepEqual(await saved(page),afterCheck);
  await page.screenshot({path:fileURLToPath(new URL('separate-step-'+width+'-'+http+'-'+failed+'-checkpoint.png',out)),fullPage:true});
  await page.locator('[data-action='+step+']').dblclick();
  await page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).events.length===count,{key,count:afterCheck.events.length+1});
  await page.locator('#last-action-result').filter({hasText:'Table outcome:'}).waitFor();
  const afterEvent=await saved(page);assert.equal(afterEvent.events.at(-1).command.type,step);assert.equal(afterEvent.events.length,afterCheck.events.length+1);
  assert.equal(await page.locator('[data-action='+step+']').count(),0);
  const result=await page.locator('#last-action-result').innerText();assert.match(result,/Table outcome:/);assert.match(result,/Roll \[[1-6](, [1-6])?\] = [0-9]+/);
  await page.reload();await page.locator('#last-action-result').filter({hasText:'Table outcome:'}).waitFor();assert.deepEqual(await saved(page),afterEvent);assert.match(await page.locator('#last-action-result').innerText(),/Table outcome:/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:fileURLToPath(new URL('separate-step-'+width+'-'+http+'-'+failed+'-outcome.png',out)),fullPage:true});checks.push({http,width,step,pass:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('career-step-separation-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
