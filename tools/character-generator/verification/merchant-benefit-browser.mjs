import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
import {merchantBenefitFixture} from './merchant-benefit-fixtures.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',fixture=merchantBenefitFixture();
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});const checks=[],errors=[];
try{
 for(const width of [1440,390,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),name=transport+'-'+width;
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));
   await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   const raw=exportSession(fixture.before.session);
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();
   await page.locator('[data-action=career-event]').waitFor();
   const logBefore=await downloadedActionLog(page);
   await page.locator('[data-action=career-event]').click();
   const panel=page.locator('#last-action-result');
   await panel.getByRole('heading',{name:'A profitable deal lets you live well for a few years.',exact:true}).waitFor();
   const text=await panel.innerText();assert.match(text,/\+1 to one future Benefit roll\./);assert.doesNotMatch(text,/neither money nor an extra roll|Advancement below|p\. 35/);
   assert.doesNotMatch(text,/Resolve benefit credit|Benefit credit value|Benefit credit: available/);
   assert.equal(await panel.locator('.crow-assistance-image').count(),0);
   assert.equal(await panel.locator('details').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const saved=await page.evaluate(key=>localStorage.getItem(key),key);
   const expected=JSON.parse(exportSession(fixture.after.session));expected.events.at(-1).id=JSON.parse(saved).events.at(-1).id;
   assert.deepEqual(JSON.parse(saved),expected);
   const fullLog=await downloadedActionLog(page);assert.ok(fullLog.startsWith(logBefore));assert.match(fullLog,/Resolve benefit credit/);
   await page.locator('#army-career-dialog').screenshot({path:fileURLToPath(new URL('merchant-benefit-revised-'+name+'.png',out))});
   const trigger=panel.locator('[data-result-information]'),info=page.locator('#opening-help-dialog');
   await trigger.focus();await trigger.press('Enter');await info.waitFor({state:'visible'});
   assert.match(await info.innerText(),/Resolve benefit credit/);assert.match(await info.innerText(),/Benefit credit value: 1/);assert.match(await info.innerText(),/Bonuses for this roll/);assert.match(await info.innerText(),/neither money nor an extra roll/);assert.equal(await info.locator('img').count(),1);
   assert.ok(await info.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await info.screenshot({path:fileURLToPath(new URL('merchant-benefit-revised-information-'+name+'.png',out))});
   await info.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
   await trigger.click();await info.waitFor({state:'visible'});await page.keyboard.press('Escape');await info.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
   await page.reload();await panel.getByRole('heading',{name:'A profitable deal lets you live well for a few years.',exact:true}).waitFor();
   assert.equal(await info.isVisible(),false);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
   assert.deepEqual(project(importSession(saved)).log,project(importSession(JSON.stringify(expected))).log);
   const advancement=page.locator('[data-action=advancement]');await advancement.click();
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.at(-1).command.type==='advancement',key);
   const continued=await page.evaluate(key=>localStorage.getItem(key),key),state=project(importSession(continued)).state;
   assert.equal(state.character.benefitCredits[0].status,'available');assert.equal(JSON.parse(continued).events.length,fixture.after.revision+1);
   await page.reload();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.at(-1).command.type==='advancement',key);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),continued);
   checks.push({name,detailsToggle:true,unchangedSave:true,fullLog:true,reload:true,advancement:true,overflow:false});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('merchant-benefit-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
