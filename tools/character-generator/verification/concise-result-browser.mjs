import {dismissTechnicalError} from './technical-error-browser-assertions.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {laterCareerFixture,treatmentFixture,equipmentFixture,failedSurvivalFixture} from './concise-result-fixtures.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';
import {assertResultColor} from './result-color-browser-assertions.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),key='traveller-character-generator.v1';
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});const checks=[],errors=[];
const fixtures={career:laterCareerFixture(),treatment:treatmentFixture(),equipment:equipmentFixture(),survival:failedSurvivalFixture()};
try{
 for(const width of [1440,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),name=transport+'-'+width,engineRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.url().includes('/engine/'))engineRequests.push(request.url());});
  const load=async r=>{const raw=exportSession(r.session);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)===revision,r.revision);return raw;};
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   const initial=await load(fixtures.career.before),logBefore=await downloadedActionLog(page);
   await page.locator('[data-action=select-career][data-id="core.rogue"]').click();assert.equal(await page.locator('#last-action-result').count(),0);assert.equal(await page.locator('#career-assignment').isVisible(),true);
   await page.getByRole('button',{name:'Back to career list',exact:true}).click();await page.locator('[data-action=select-career][data-id="core.rogue"]').click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),initial);
   await page.locator('#career-assignment').selectOption('thief');await page.getByRole('button',{name:'Attempt this career',exact:true}).click();await page.getByRole('heading',{name:'Choose a basic-training skill',exact:true}).waitFor();
   const panel=page.locator('#last-action-result');assert.match(await panel.innerText(),/Entered Rogue \/ Thief/);assert.match(await panel.innerText(),/Qualification.*total 11 against 6\+/);assert.doesNotMatch(await panel.innerText(),/none → 0|Officer commission|Pending:/);
   assert.ok(await panel.evaluate(node=>{const copy=node.cloneNode(true);for(const extra of copy.querySelectorAll('.outcome-tagline,.army-dice-result,details'))extra.remove();return copy.textContent.length<250;}),'Mechanical summary stays concise independently of pictured commentary and recorded-dice artwork');assert.equal(await panel.locator('.outcome-tagline').count(),1);assert.equal(await panel.locator('.outcome-tagline .crow-assistance-image').count(),1);assert.equal(await panel.locator('.army-dice-faces svg').count(),2);assert.equal(await page.locator('#message').evaluate(el=>el.classList.contains('action-announcement')),true);
   const saved=await page.evaluate(key=>localStorage.getItem(key),key);const summary=panel.locator('summary');await summary.focus();await summary.press('Enter');assert.match(await panel.innerText(),/Career transition/);await summary.press('Enter');assert.doesNotMatch(await panel.innerText(),/Career transition/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
   await page.reload();await panel.waitFor();assert.equal(await panel.locator('details').getAttribute('open'),null);assert.match(await downloadedActionLog(page),/Entered Rogue/);assert.ok((await downloadedActionLog(page)).startsWith(logBefore));
   await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('concise-career-'+name+'.png',out))});
   await load(fixtures.survival.before);await page.locator('[data-action=survival-check]').evaluate(button=>{button.click();button.click();});await page.locator('[data-action=career-mishap]').waitFor();
   const checkpoint=await page.evaluate(key=>localStorage.getItem(key),key),checkSave=JSON.parse(checkpoint);assert.equal(checkSave.events.length,fixtures.survival.before.revision+1);assert.equal(checkSave.events.at(-1).rolls.length,1);assert.match(await panel.innerText(),/Survival failed/);assert.doesNotMatch(await panel.innerText(),/Mishap rolled:|Rival/);await assertResultColor(page,'failure',{message:true});
   await page.reload();await page.locator('[data-action=career-mishap]').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),checkpoint);
   await page.locator('[data-action=career-mishap]').evaluate(button=>{button.click();button.click();});await page.getByRole('heading',{name:'The end of a term',exact:true}).waitFor();
   const splitRaw=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(JSON.parse(splitRaw).events.length,fixtures.survival.before.revision+2);assert.equal(JSON.parse(splitRaw).events.at(-1).command.type,'career-mishap');assert.match(await panel.innerText(),/Table outcome:/);assert.match(await panel.innerText(),/Roll \[2\] = 2/);assert.match(await panel.innerText(),/Rival/);
   await page.reload();await panel.waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),splitRaw);
   // Retain the historical combined-command concise presentation checks separately.
   await load(fixtures.survival.after);
   const survivalText=await panel.innerText();assert.match(survivalText,/Survival failed/);assert.match(survivalText,/Check \[1, 3\]: total 5 against target 7\+/);assert.match(survivalText,/Mishap rolled: 2/);assert.match(survivalText,/Rival/);assert.doesNotMatch(survivalText,/Age:|Completed terms:|Career terms:|Must leave this career/);assert.match(survivalText,/Table outcome:/);assert.match(survivalText,/Source:/);await assertResultColor(page,'failure');
   assert.equal(await page.getByRole('button',{name:'Leave and take benefits',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'Continue this career',exact:true}).isEnabled(),false);
   const survivalRaw=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(JSON.parse(survivalRaw).events.length,fixtures.survival.before.revision+1);
   await panel.locator('summary').click();assert.match(await panel.innerText(),/Career terms:|Must leave this career/);await panel.locator('summary').click();assert.match(await downloadedActionLog(page),/careers\.0\.forcedExit/);
   await page.reload();await panel.waitFor();assert.equal(await panel.innerText(),survivalText);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),survivalRaw);await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('concise-survival-'+name+'.png',out))});
   for(const kind of ['treatment','equipment']){
    const r=fixtures[kind].after,raw=await load(r),text=await panel.innerText();
    if(kind==='treatment'){assert.match(text,/Medical bill: Cr20,000/);assert.match(text,/Due at the end of character creation/);assert.doesNotMatch(text,/Strength: 7 → 11|Injury loss|Treatment restores|Career terms/);}
    else{assert.match(text,/Received Synthetic weapon/);assert.doesNotMatch(text,/Asset:|Benefit:|Benefit award recorded|Owned by Traveller/);}
    if(kind==='treatment'){const trigger=page.getByRole('button',{name:'About your treatment and medical bill',exact:true});await trigger.click();const info=page.locator('#opening-help-dialog[open]');await info.waitFor();assert.match(await info.innerText(),/Strength: 7 → 11/);assert.match(await info.innerText(),/Injury loss/);await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);}else{await panel.locator('summary').click();assert.ok((await panel.innerText()).length>text.length);await panel.locator('summary').click();}
    const log=await downloadedActionLog(page);assert.ok(log.includes(r.log.at(-1).summary));assert.equal(await page.locator('.log-section,#action-log').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
    await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('concise-'+kind+'-'+name+'.png',out))});
   }
   // Restore is still available with GM enabling, confirmation and unchanged audit history.
   await load(fixtures.career.before);await page.locator('#gm-controls > summary').click();await page.locator('#gm-task').selectOption('restore');
   const revision=String(fixtures.career.before.revision-1);await page.locator('#gm-restore-choice').selectOption(revision);const beforeRestore=await page.evaluate(key=>localStorage.getItem(key),key);
   page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Restore this step',exact:true}).click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),beforeRestore);
   page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore this step',exact:true}).click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.at(-1).command.type==='restore',key);
   assert.equal(await page.locator('#gm-restore-form').isVisible(),true);assert.match(await downloadedActionLog(page),/Restored|restore/i);
   // Storage errors are never cleared or visually suppressed by career navigation.
   await load(fixtures.career.before);await page.locator('#notes-connections').locator('summary').click();await page.locator('#character-notes').fill('Synthetic unsaved storage warning');
   await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('Synthetic storage failure');};});await page.getByRole('button',{name:'Save notes',exact:true}).click();await page.locator('#message.error').waitFor();await dismissTechnicalError(page);await page.locator('[data-action=select-career][data-id="core.rogue"]').click();assert.match(await page.locator('#message.error').innerText(),/could not save/);assert.equal(await page.locator('#message').evaluate(el=>el.classList.contains('action-announcement')),false);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(transport==='http')assert.deepEqual(engineRequests,[]);checks.push(name);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('concise-result-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
