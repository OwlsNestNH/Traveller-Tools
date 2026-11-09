import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
import {advancementResult} from '../gui/advancement-result.mjs';
import {advancementFixture} from './advancement-result-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const key='traveller-character-generator.v1',checks=[],errors=[],out=new URL('./artifacts/',import.meta.url);
const fixtures=[false,true].map(success=>({success,...advancementFixture(success)}));
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 await mkdir(out,{recursive:true});
 for(const http of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),engineRequests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/engine/'))engineRequests.push(request.url());});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));
   await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   for(const {success,before,after} of fixtures){
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(before.session)});await page.reload();
    await page.locator('[data-action="advancement"]').waitFor();
    assert.ok(await page.locator('#last-action-result').count()<=1);
    // Repeated clicks must not roll advancement twice or erase its notice.
    await page.locator('[data-action="advancement"]').evaluate(button=>{button.click();button.click();});
    await page.locator('#last-action-result').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#new').disabled);
    const expected=advancementResult(after.log.at(-1));
    assert.equal(await page.locator('#last-action-result h3').innerText(),expected.title);
    assert.equal(await page.locator('#sheet .career-rank-value').innerText(),'Rank '+after.state.character.careers[after.state.active].rank);
    assert.equal(await page.locator('#sheet .career-rank-summary').evaluate(el=>el.compareDocumentPosition(document.querySelector('#sheet .stats')) & Node.DOCUMENT_POSITION_FOLLOWING),4);
    for(const detail of expected.details)assert.ok((await page.locator('#last-action-result').innerText()).includes(detail),detail);
    assert.ok((await page.locator('#message').innerText()).includes(expected.title));
    assert.ok((await page.locator('#action-log').innerText()).includes(after.log.at(-1).summary));
    const raw=await page.evaluate(key=>localStorage.getItem(key),key),saved=importSession(raw);
    assert.equal(saved.events.length,before.revision+1);assert.equal(exportSession(saved),raw);
    assert.equal(project(saved).log.at(-1).summary,after.log.at(-1).summary);
    await page.reload();await page.locator('#last-action-result').waitFor();
    assert.equal(await page.locator('#last-action-result h3').innerText(),expected.title);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const name=(success?'success':'failure')+'-'+width+(http?'-http':'-static');
    await page.screenshot({path:fileURLToPath(new URL('advancement-result-'+name+'.png',out)),fullPage:true});
    // The result remains until a real next step, then leaves the workspace
    // while its human-readable history remains in the log.
    // A failed advancement can force career exit, so do not assume that
    // continuing is legal. Exercise an enabled next step from the actual UI.
    const nextAction=page.locator(success?'[data-action="training"]:enabled':'[data-action="continue-career"]:enabled, [data-action="leave-career"]:enabled, [data-action="retire-career"]:enabled').first();
    assert.equal(await nextAction.count(),1,'An eligible next career action must be available.');
    await nextAction.click();
    await page.waitForFunction(revision=>JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.length===revision+2&&!document.querySelector('#new').disabled,before.revision);
    assert.notEqual(await page.locator('#last-action-result h3').innerText(),expected.title);
    assert.ok((await page.locator('#action-log').innerText()).includes(after.log.at(-1).summary));
    await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled);
    assert.ok(await page.locator('#last-action-result').count()<=1);
    checks.push({name,passed:true});
   }
   if(http)assert.deepEqual(engineRequests,[]);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('advancement-result-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
