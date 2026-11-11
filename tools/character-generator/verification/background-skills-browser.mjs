import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,execute,exportSession,createSession} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],checks=[],ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
function fixture(){let s=createSession('background-ui-human');for(const command of [{type:'setup',payload:{name:'Your Traveller',species:'human',gender:'male'}},{type:'roll-statistics'},{type:'accept-statistics'}])s=execute(s,command).session;return s;}
try{
 for(const width of [1440,390,320])for(const http of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),label=(http?'http':'static')+'-'+width,session=fixture(),required=project(session).state.backgroundRemaining;
  page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
  try{
   await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:exportSession(session)});await page.goto(origin+(http?'/?api=local':'/'));await ready(page);
   const boxes=page.locator('#background-form [name=skills]'),accept=page.locator('#background-form [type=submit]');assert.equal(await accept.isDisabled(),true);
   await boxes.nth(0).focus();await page.keyboard.press('Space');assert.equal(await boxes.nth(0).isChecked(),true);assert.equal(await boxes.nth(0).evaluate(el=>getComputedStyle(el.closest('label')).outlineStyle),'solid');assert.equal(await page.locator('.background-chips li').count(),1);assert.equal(await accept.isDisabled(),required!==1);
   await page.locator('#cancel-character').click();await page.getByRole('button',{name:'Keep character',exact:true}).click();assert.equal(await boxes.nth(0).isChecked(),true);
   assert.equal(await page.locator('#last-action-result').count(),0);assert.equal(await page.locator('#background-record').getAttribute('open'),null);if(width===1440){assert.ok((await page.locator('.background-tile').first().boundingBox()).height<=55);assert.ok((await page.locator('#workspace').boundingBox()).height<850);}await page.locator('#background-full-log').click();await page.locator('#full-action-log').waitFor({state:'visible'});assert.match(await page.locator('#full-action-log').textContent(),/accept-statistics|Accepted statistics/i);await page.keyboard.press('Escape');await page.locator('#full-action-log').waitFor({state:'hidden'});await page.locator('h1').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:fileURLToPath(new URL('background-skills-'+label+'.png',out)),fullPage:true});
   // A real command rerenders the UI; pending selections remain separate from the saved record.
   await page.locator('#background-record').evaluate(el=>el.open=true);await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.locator('#gm-toggle').check();await ready(page);assert.equal(await boxes.nth(0).isChecked(),true);
   for(let i=1;i<required;i++)await boxes.nth(i).check();assert.equal(await accept.isEnabled(),true);
   await boxes.nth(required).check();assert.equal(await accept.isDisabled(),true);assert.match(await page.locator('#background-status').textContent(),/Remove 1/);await boxes.nth(required).uncheck();assert.equal(await accept.isEnabled(),true);
   await boxes.nth(0).uncheck();assert.equal(await accept.isDisabled(),true);await boxes.nth(0).check();
   assert.equal(await page.locator('.background-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width===1440?3:1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('#gm-controls').evaluate(el=>el.open=false);await page.locator('#background-record').evaluate(el=>el.open=false);
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('#background-preview').isVisible(),false);assert.equal(await page.locator('#sheet h2').isVisible(),true);assert.equal(await page.locator('#sheet .stats').isVisible(),true);if(width===1440)await page.screenshot({path:fileURLToPath(new URL('background-skills-print-'+label+'.png',out)),fullPage:true});await page.emulateMedia({media:'screen'});
   const raw=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(project(JSON.parse(raw)).state.stage,'background');
   await page.reload();await ready(page);assert.equal(await page.locator('#background-form [name=skills]:checked').count(),0);
   for(let i=0;i<required;i++)await boxes.nth(i).check();
   page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await page.locator('#background-actions').evaluate(el=>el.open=true);await page.locator('#import').setInputFiles({name:'cancel-import.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(()=>document.querySelector('#import').value==='');await ready(page);assert.equal(await page.locator('#background-form [name=skills]:checked').count(),required);page.on('dialog',d=>d.accept());
   await page.locator('#import').setInputFiles({name:'synthetic-background.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Character loaded.'));await ready(page);assert.equal(await page.locator('#background-form [name=skills]:checked').count(),0);
   for(let i=0;i<required;i++)await boxes.nth(i).check();
   if(http){let failed=false;await page.route('**/api/v1',async route=>{const request=route.request().postDataJSON();if(!failed&&request.command?.type==='background'){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Synthetic retryable failure'}})});}else await route.continue();});await accept.click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Synthetic retryable failure'));await ready(page);assert.equal(await page.locator('#background-form [name=skills]:checked').count(),required);assert.equal(await accept.isEnabled(),true);await page.unroute('**/api/v1');}
   await page.locator('#background-record').evaluate(el=>el.open=true);await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.locator('#gm-task').selectOption('restore');await page.locator('#gm-restore-choice').selectOption('3');await page.locator('#gm-restore-step').click();await page.waitForFunction(()=>document.querySelector('#background-count').textContent.startsWith('0 /'));await ready(page);assert.equal(await page.locator('#background-form [name=skills]:checked').count(),0);for(let i=0;i<required;i++)await boxes.nth(i).check();await accept.evaluate(el=>{el.form.requestSubmit();el.form.requestSubmit();});await page.waitForFunction(()=>document.body.dataset.stage!=='background');await ready(page);
   assert.equal(await page.locator('#background-rail').count(),0);assert.equal(await page.locator('#background-utilities').count(),0);assert.equal(await page.locator('.toolbar').isVisible(),true);assert.equal(await page.locator('#sheet h2').isVisible(),true);const saved=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));assert.equal(saved.events.filter(e=>e.command.type==='background').length,1);checks.push(label+' partial/exact/over/deselect/cancel/rerender/reload/import/repeat/responsive');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('background-skills-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
