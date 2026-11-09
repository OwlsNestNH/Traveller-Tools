import {downloadedActionLog} from './download-log-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,exportSession,project} from '../engine/session.mjs';
import {run} from './vargr-training-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
let fixture=api({operation:'create',seed:'fortune-64'});
fixture=run(fixture,'setup',{species:'vargr'});fixture=run(fixture,'roll-statistics');fixture=run(fixture,'accept-statistics');
fixture=run(fixture,'background',{skills:fixture.state.backgroundOptions.slice(0,fixture.state.backgroundRemaining)});
fixture=run(fixture,'skip-precareer');fixture=run(fixture,'career',{id:'vargr.loner',assignment:'prospector'});
const raw=exportSession(fixture.session),title='Vargr Life Event 10: Good Fortune';
const labels=['Gain 1 Benefit roll in your current career','CHA +1'];
const saved=async page=>JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));
async function assertPending(page){
 await page.locator('#workspace h3').filter({hasText:title}).waitFor();
 assert.equal(await page.locator('#workspace h3').filter({hasText:title}).innerText(),title);
 assert.deepEqual(await page.locator('#workspace [data-action=choose-effect]').allTextContents(),labels);
 assert.match(await page.locator('#workspace').innerText(),/Choose 1 Benefit roll in your current career or CHA \+1\./);
}
try{
 for(const http of [false,true])for(const width of [320,1440])for(const index of [0,1]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),engineRequests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/engine/'))engineRequests.push(request.url());});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();
   await page.locator('#workspace [data-action=survival]').click();await assertPending(page);
   assert.match(await page.locator('#message').innerText(),/Vargr Life Event 10: Good Fortune/);
   assert.match(await page.locator('#message').innerText(),/Benefit roll.*CHA \+1/);
   assert.match(await downloadedActionLog(page),/vargr.life-events/);
   const pending=await saved(page),before=project(pending);
   assert.equal(pending.events.length,fixture.session.events.length+1);
   await page.reload();await assertPending(page);assert.deepEqual(await saved(page),pending);
   const name='life-event-'+width+(http?'-http':'-static')+'-'+(index?'charisma':'benefit');
   await page.screenshot({path:fileURLToPath(new URL(name+'-pending.png',out)),fullPage:true});
   // A single click must resolve once, retire both buttons, and add exactly one command.
   await page.locator('#workspace [data-action=choose-effect][data-index="'+index+'"]').click();
   await page.locator('#workspace [data-action=advancement]').waitFor();
   assert.equal(await page.locator('#workspace [data-action=choose-effect]').count(),0);
   const afterSave=await saved(page),after=project(afterSave);
   assert.equal(afterSave.events.length,pending.events.length+1);
   assert.deepEqual(afterSave.events.at(-1).command,{type:'choose-effect',payload:{index}});
   assert.equal(after.state.character.stats.CHA,before.state.character.stats.CHA+(index===1?1:0));
   assert.equal(after.state.character.careers[0].benefitRolls,before.state.character.careers[0].benefitRolls+(index===0?1:0));
   const effect=index?'Charisma (CHA) +1.':'Gained 1 Benefit roll in the current career.';
   assert.ok((await page.locator('#message').innerText()).includes(title+': '+effect));
   await page.reload();await page.locator('#workspace [data-action=advancement]').waitFor();
   assert.deepEqual(await saved(page),afterSave);assert.equal(await page.locator('#workspace [data-action=choose-effect]').count(),0);
   assert.ok((await downloadedActionLog(page)).includes(after.log.at(-1).summary));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(http)assert.deepEqual(engineRequests,[]);
   await page.screenshot({path:fileURLToPath(new URL(name+'-resolved.png',out)),fullPage:true});checks.push({http,width,index,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('life-event-presentation-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
