import {downloadedActionLog} from './download-log-browser.mjs';
import {assertResultColor} from './result-color-browser-assertions.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,exportSession,importSession} from '../engine/session.mjs';
import {survivalResult} from '../gui/survival-result.mjs';
import {laterTermVargrFixture,run} from './survival-result-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);
const cases=laterTermVargrFixture().slice(2).map((after,index)=>{
 const revision=after.session.events.at(-1).command.payload.revision;
 const session={...after.session,events:after.session.events.slice(0,revision-1)};
 return {term:index+3,before:{session,...project(session)},after};
});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});await mkdir(out,{recursive:true});
 for(const http of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),engineRequests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/engine/'))engineRequests.push(request.url());});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   for(const {term,before,after} of cases){
    // Actual later-term survival clicks must leave a visible result, not a generic notice.
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(before.session)});await page.reload();
    await page.locator('[data-action=survival]').waitFor();
    const natural=run(before,'survival'),expected=survivalResult(natural.log.at(-1),natural.state);
    await page.locator('[data-action=survival]').evaluate(button=>{button.click();button.click();});
    await page.locator('#last-action-result').waitFor();await page.waitForFunction(()=>!document.querySelector('#new').disabled);
    await assertResultColor(page,expected.status,{message:true});
    const resultText=await page.locator('#last-action-result').innerText();
    assert.ok(resultText.includes(expected.title));
    assert.ok(resultText.includes(expected.details.find(detail=>detail.startsWith('Career event rolled:'))));
    assert.match(await page.locator('#message').innerText(),/Survival succeeded/);
    if(term===3)assert.match(await page.locator('#sheet').innerText(),/Contact/);
    else assert.match(resultText,/EDU check/);
    const raw=await page.evaluate(key=>localStorage.getItem(key),key),saved=importSession(raw);
    assert.equal(saved.events.length,before.revision+1);assert.equal(exportSession(saved),raw);
    assert.ok((await downloadedActionLog(page)).includes(natural.log.at(-1).summary));
    await page.reload();await page.locator('#last-action-result').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
    assert.ok((await page.locator('#last-action-result').innerText()).includes(expected.title));
    // Targeted regression outcomes must also persist on reload without replaying dice.
    const targetedRaw=exportSession(after.session);
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:targetedRaw});await page.reload();await page.locator('#last-action-result').waitFor();
    const targeted=survivalResult(after.log.at(-1),after.state),visible=await page.locator('#last-action-result').innerText();
    await assertResultColor(page,targeted.status);
    for(const detail of targeted.details)assert.ok(visible.includes(detail),detail);
    const sheet=await page.locator('#sheet').innerText();assert.match(sheet,/Ally/);
    if(term===3)assert.match(sheet,/A new romantic relationship begins/);
    else assert.match(sheet,/advancement[^\n]*\+4|\+4[^\n]*advancement/i);
    assert.ok((await downloadedActionLog(page)).includes(after.log.at(-1).summary));
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),targetedRaw);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const name='term-'+term+'-'+width+(http?'-http':'-static');
    await page.screenshot({path:fileURLToPath(new URL('survival-result-'+name+'.png',out)),fullPage:true});checks.push({name,passed:true});
   }
   const r=cases[0].after,revision=r.session.events.findIndex(e=>e.command.type==='survival')+1;
   const failed=run(r,'gm-replay',{revision,rollIndex:0,values:[1,1],reason:'Verify failed survival color'}),raw=exportSession(failed.session);
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await page.locator('#last-action-result').waitFor();
   await assertResultColor(page,'failure');assert.match(await page.locator('#last-action-result').innerText(),/Survival failed/);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
   if(http)assert.deepEqual(engineRequests,[]);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('survival-result-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
