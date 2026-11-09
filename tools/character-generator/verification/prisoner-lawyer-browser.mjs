import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {lawyerFixture} from './prisoner-lawyer-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[];let browser;
const saved=async page=>project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));
const ready=async page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const width of [1440,320])for(const transport of ['', '?api=local'])for(const scenario of ['hire','decline','zero']){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   const fixture=lawyerFixture({cash:scenario==='zero'?0:25000});await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('#prisoner-lawyer').waitFor();
   const before=await saved(page);assert.equal(await page.locator('#lawyer-hire-fields').isVisible(),false);assert.equal(await page.locator('#lawyer-level').isDisabled(),true);assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),false);assert.equal(await page.locator('[data-action=add-effect]').count(),0);await page.locator('[data-action=resolve-prisoner-lawyer]').click();await ready(page);assert.equal((await saved(page)).revision,before.revision);
   await page.reload();await page.locator('#prisoner-lawyer').waitFor();assert.deepEqual((await saved(page)).state,before.state);
   await page.locator('#lawyer-outcome').selectOption(scenario==='decline'?'decline':'hire');
   if(scenario==='hire'){
    await page.locator('#lawyer-level').fill('6');await page.locator('[data-action=resolve-prisoner-lawyer]').click();await ready(page);assert.equal((await saved(page)).revision,before.revision);await page.locator('#lawyer-level').fill('5');assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),false);assert.equal(await page.locator('#lawyer-zero').isDisabled(),true);await page.locator('#lawyer-outcome').selectOption('decline');assert.equal(await page.locator('#lawyer-hire-fields').isVisible(),false);await page.locator('#lawyer-outcome').selectOption('hire');assert.equal(await page.locator('#lawyer-level').inputValue(),'5');
   }
   if(scenario==='zero'){
    await page.locator('#lawyer-level').fill('0');await page.locator('[data-action=resolve-prisoner-lawyer]').click();await ready(page);assert.equal((await saved(page)).revision,before.revision);await page.locator('#lawyer-zero').check();await page.locator('#lawyer-reason').fill('Referee permits a novice at the formula price.');await page.locator('#lawyer-level').fill('1');assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),false);assert.equal(await page.locator('#lawyer-reason').isDisabled(),true);await page.locator('#lawyer-level').fill('0');assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),true);assert.equal(await page.locator('#lawyer-zero').isChecked(),true);assert.equal(await page.locator('#lawyer-reason').inputValue(),'Referee permits a novice at the formula price.');await page.locator('#lawyer-outcome').selectOption('decline');assert.equal(await page.locator('#lawyer-hire-fields').isVisible(),false);await page.locator('#lawyer-outcome').selectOption('hire');assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),true);assert.equal(await page.locator('#lawyer-zero').isChecked(),true);
   }
   assert.equal(await page.locator('#lawyer-hire-fields').isVisible(),scenario!=='decline');assert.equal(await page.locator('#lawyer-zero-fields').isVisible(),scenario==='zero');assert.equal(await page.locator('#lawyer-reason').isDisabled(),scenario!=='zero');assert.ok(await page.locator('[data-action=resolve-prisoner-lawyer]').evaluate(el=>el.getBoundingClientRect().height>=54));
   await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('prisoner-lawyer-'+scenario+'-'+width+'-'+(transport?'http':'static')+'-pending.png',out))});
   await page.locator('[data-action=resolve-prisoner-lawyer]').dblclick();await ready(page);const after=await saved(page);assert.equal(after.revision,before.revision+1);assert.equal(after.state.stage,'advancement');assert.equal(after.state.character.cash,scenario==='decline'?25000:0);assert.equal(after.state.character.prisonerLawyers.at(-1).status,'completed');
   await page.reload();await page.locator('.prisoner-lawyer-ledger').waitFor();assert.deepEqual((await saved(page)).state,after.state);await page.emulateMedia({media:'print'});assert.match(await page.locator('.prisoner-lawyer-ledger').innerText(),/Core p. 57/);await page.emulateMedia({media:'screen'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks.push({scenario,width,transport:transport?'http':'static',passed:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('prisoner-lawyer-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
