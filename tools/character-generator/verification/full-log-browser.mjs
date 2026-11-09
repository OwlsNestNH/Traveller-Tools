import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {project} from '../engine/session.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[];
try{
 for(const width of [320,1440])for(const api of [false,true]){
  const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+(api?'/?api=local':'/'));
  const trigger=page.locator('#log-view'),dialog=page.locator('#full-action-log');
  await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await trigger.click();assert.equal(await page.locator('#full-log-content').textContent(),'No actions recorded yet.');await page.keyboard.press('Escape');
  await page.locator('[name=name]').fill('<script>full log fixture</script>');await page.getByRole('button',{name:'Begin character',exact:true}).click();
  await page.getByRole('button',{name:'Roll six characteristics'}).click();await page.getByRole('button',{name:'Keep these characteristics'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#export').disabled);
  const before=await page.evaluate(key=>localStorage.getItem(key),key),expected=fullActionLog(project(JSON.parse(before)).log);
  for(const close of ['escape','button','escape']){
   await trigger.focus();await trigger.press('Enter');assert.equal(await dialog.evaluate(el=>el.open),true);
   assert.equal(await page.locator('#full-log-content').textContent(),expected);assert.equal(await page.evaluate(()=>document.activeElement.id),'full-log-title');
   await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'full-log-content');
   await page.keyboard.press('Tab');assert.equal(await page.locator('[data-log-close]').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(close==='button')await page.locator('[data-log-close]').click();else await page.keyboard.press('Escape');
   assert.equal(await dialog.evaluate(el=>el.open),false);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  }
  assert.equal(await downloadedActionLog(page),expected);
  await trigger.click();const downloadPromise=page.waitForEvent('download');await page.locator('[data-log-download]').click();const modalDownload=await downloadPromise;assert.equal(modalDownload.suggestedFilename(),'traveller-action-log.txt');assert.equal(await readFile(await modalDownload.path(),'utf8'),expected);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
  await page.reload();await page.getByRole('button',{name:'Keep these characteristics'}).waitFor();assert.equal(await dialog.evaluate(el=>el.open),false);
  await trigger.click();assert.equal(await page.locator('#full-log-content').textContent(),expected);await page.keyboard.press('Escape');
  await context.close();console.log('PASS full log '+width+' '+(api?'http':'static'));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
