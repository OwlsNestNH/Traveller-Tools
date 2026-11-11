import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,project,exportSession} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{}),...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',origin='http://127.0.0.1:'+server.address().port,out=new URL('./artifacts/',import.meta.url),errors=[];await mkdir(out,{recursive:true});
function fixture(species){let s=createSession('popup-ui-'+species);for(const type of ['setup','roll-statistics','accept-statistics'])s=execute(s,{type,payload:type==='setup'?{species,...(species==='aslan'?{gender:'male'}:{}),name:'Your Traveller'}:{}}).session;return s;}
try{
 for(const width of [1440,800,390,320])for(const http of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture('aezorgh'))});
  await page.goto(origin+(http?'/?api=local':'/'));assert.match(await page.locator('#background-orientation').textContent(),/3 Pre-Career/);const dialog=page.locator('#species-skill-dialog');await dialog.waitFor();assert.equal(await dialog.evaluate(e=>e.matches(':modal')),true);
  const confirm=dialog.getByRole('button',{name:'Confirm',exact:true});assert.equal(await confirm.isDisabled(),true);
  assert.equal(await page.locator('#species-skill-search').evaluate(e=>e===document.activeElement),true);
  assert.equal(await dialog.locator('.species-skill-options').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>760?3:1);if(width>760){assert.equal(await dialog.locator('.species-skill-options').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true);assert.equal(await dialog.evaluate(e=>e.scrollHeight<=e.clientHeight+1),true);}const labels=await dialog.locator('.background-tile span').allTextContents();assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b)));
  for(const name of ['Athletics','Mechanic','Recon','Stealth','Independence','Tolerance','Rites','Jack-of-all-Trades','Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'])assert.ok(!labels.includes(name));
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);
  await page.locator('#species-skill-search').fill('pilot');assert.equal(await dialog.locator('.background-tile:visible').count(),1);await dialog.getByRole('radio',{name:'Pilot',exact:true}).check();assert.equal(await confirm.isEnabled(),true);
  await page.locator('#species-skill-search').fill('zzzz');assert.equal(await page.locator('#species-skill-empty').isVisible(),true);await page.locator('#species-skill-search').fill('');
  await dialog.getByRole('radio',{name:'Admin',exact:true}).check();assert.equal(await dialog.locator('input:checked').count(),1);assert.equal(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state.stage,'background');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.ok((await dialog.locator('.background-tile').first().boundingBox()).height<=46);assert.ok((await dialog.locator('input[type=radio]').first().boundingBox()).height<=22);
  await page.screenshot({path:fileURLToPath(new URL('aezorgh-skill-popup-'+width+'-'+(http?'http':'static')+'.png',out)),fullPage:false});
  if(http){let fail=true;await page.route('**/api/v1',async route=>{if(fail&&route.request().postDataJSON()?.command?.type==='background'){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Synthetic retryable failure'}})});}else await route.continue();});await confirm.click();await page.locator('#species-skill-error').getByText('Synthetic retryable failure').waitFor();assert.equal(await dialog.locator('input:checked').count(),1);await page.unroute('**/api/v1');}
  await confirm.evaluate(button=>{button.form.requestSubmit();button.form.requestSubmit();});await dialog.waitFor({state:'detached'});
  const saved=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));assert.equal(saved.events.filter(e=>e.command.type==='background').length,1);assert.equal(project(saved).state.character.skills.Admin,0);await context.close();
 }
 for(const species of ['human','vargr','aslan']){const context=await browser.newContext(),page=await context.newPage();await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture(species))});await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await page.locator('#species-skill-dialog').count(),0);await context.close();}
 assert.deepEqual(errors,[]);console.log('Aezorgh popup static/HTTP desktop/mobile, search, single selection, Escape, retry, repeated confirm, other species passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
