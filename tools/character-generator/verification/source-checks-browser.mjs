import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {sourceCheckFixture,run} from './source-check-fixtures.mjs';
import {military,pack} from './alien-source-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const cases=[{},{career:'core.navy',assignment:'crew'},{career:'core.navy',assignment:'technical'},{career:'core.navy',assignment:'flight'},{career:'vargr.intermediary',assignment:'arbitrator'}].map(args=>sourceCheckFixture(args));cases.push(military(),pack());
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const apiMode of [false,true])for(const width of [320,1440])for(const fixture of cases){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('[data-action=choose-effect]').first().waitFor();
   assert.equal(await page.locator('[data-action=choose-effect]').count(),fixture.state.pendingChoice.options.length);
   for(const option of fixture.state.pendingChoice.options)assert.ok((await page.locator('#workspace').innerText()).includes(option.label));
   // Interrupted reload must retain both the choice and the unrolled check.
   await page.reload();await page.locator('[data-action=choose-effect]').first().waitFor();
   assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state,fixture.state);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('[data-action=choose-effect]').first().click();
   const expected=run(fixture,'choose-effect',{index:0});await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).events.length===revision,{key,revision:expected.revision});
   assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state,expected.state);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#new')&&!document.querySelector('#new').disabled);
   assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state,expected.state);
   assert.equal(await page.locator('[data-action=choose-effect]').count(),0);
   checks.push({career:fixture.state.character.careers[0].id,assignment:fixture.state.character.careers[0].assignment,apiMode,width,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('source-checks-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
