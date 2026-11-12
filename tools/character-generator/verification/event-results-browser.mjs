import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {assignmentSetup,run,force} from './assignment-fixtures.mjs';
import {exportSession} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
let r=force(assignmentSetup('event-display-browser'),'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});r=force(r,'education-event',{},[2,3]);
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',raw=exportSession(r.session),errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const http of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await page.getByRole('heading',{name:'University graduation',exact:true}).waitFor();
  async function verifyPreviousResult(){
   await page.locator('#precareer-result-open').click();await page.locator('#precareer-information').waitFor({state:'visible'});await page.locator('#last-action-result').waitFor({state:'visible'});
   const text=await page.locator('#last-action-result').innerText();assert.match(text,/part/i);assert.match(text,/Carouse at least level 1/);assert.match(text,/Roll \[2, 3\] = 5/);assert.match(text,/Skill Carouse/);
   assert.equal(await page.locator('#precareer-information input,#precareer-information select,#precareer-information [data-action]').count(),0,'History must remain read-only');
   await page.locator('#precareer-information-close').click();await page.locator('#precareer-information').waitFor({state:'hidden'});assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
  }
  await verifyPreviousResult();
  await page.locator('#precareer-dismiss').click();await page.locator('#precareer-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
  await page.getByRole('button',{name:'Full Log',exact:true}).click();await page.locator('#full-action-log').waitFor({state:'visible'});assert.match(await page.locator('#full-log-content').innerText(),/part/i);await page.keyboard.press('Escape');await page.locator('#full-action-log').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);await page.reload();await page.getByRole('heading',{name:'University graduation',exact:true}).waitFor();await verifyPreviousResult();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:fileURLToPath(new URL('event-result-'+http+'-'+width+'.png',out)),fullPage:true});checks.push({http,width,pass:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('event-results-browser.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
