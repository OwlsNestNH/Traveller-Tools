import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {project} from '../engine/session.mjs';
import {simpleActionLog} from '../gui/simple-log.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[];
try{
 for(const width of [320,1440])for(const api of [false,true]){
  const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+(api?'/?api=local':'/'));
  const trigger=page.locator('#simple-log-view'),dialog=page.locator('#simple-action-log');
  await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await trigger.click();assert.equal(await page.locator('#simple-log-content').textContent(),'No dice rolls recorded yet.');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Begin character',exact:true}).click();
  await page.getByRole('button',{name:'Roll six characteristics'}).click();await page.getByRole('button',{name:'Keep these characteristics'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#export').disabled);
  const before=await page.evaluate(key=>localStorage.getItem(key),key),log=project(JSON.parse(before)).log;
  for(const close of ['escape','button','escape']){
   await trigger.focus();await trigger.press('Enter');assert.equal(await dialog.evaluate(el=>el.open),true);
   assert.equal(await page.locator('#simple-log-content').textContent(),simpleActionLog(log));assert.equal(await page.evaluate(()=>document.activeElement.id),'simple-log-title');
   await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'simple-log-content');
   await page.keyboard.press('Tab');assert.equal(await page.locator('[data-simple-log-close]').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(close==='button')await page.locator('[data-simple-log-close]').click();else await page.keyboard.press('Escape');
   assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
  }
  await page.locator('#log-view').click();assert.equal(await page.locator('#full-log-content').textContent(),fullActionLog(log));await page.keyboard.press('Escape');
  await page.reload();await page.getByRole('button',{name:'Keep these characteristics'}).waitFor();await trigger.click();assert.equal(await page.locator('#simple-log-content').textContent(),simpleActionLog(log));await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Simple Log desktop/mobile static/HTTP, focus, repeated dismissal, replay, unchanged Full Log passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
