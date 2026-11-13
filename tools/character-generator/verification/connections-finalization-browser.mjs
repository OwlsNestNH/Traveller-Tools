import {dismissTechnicalError} from './technical-error-browser-assertions.mjs';
// Temporary contexts and synthetic command histories only; never touches a user's browser draft.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {finalSheetFixture,run} from './final-sheet-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url),checks=[],errors=[];
await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const stored=page=>page.evaluate(key=>localStorage.getItem(key),key);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
async function changed(page,n){await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length>n&&!document.querySelector('#export').disabled,{key,n});}
async function assertGate(page,finalizing){
 assert.equal(await page.locator('#connection-person').count(),Number(finalizing));
 assert.equal(await page.locator('[data-action="connection"]').count(),Number(finalizing));
 assert.equal(await page.locator('#notes-connections > summary').textContent(),finalizing?'Notes & connections':'Background notes');
 assert.equal(await page.locator('#character-notes').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}
const career=run(finalSheetFixture({finish:false}),'connection',{person:'Synthetic earlier Traveller',skill:'Admin',note:'Preserve this existing record.'});
const legacyRaw=exportSession(career.session);
try{
 for(const transport of ['static','http'])for(const width of [1440,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),label=transport+'-'+width;
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.locator('#setup-form').waitFor();await ready(page);await assertGate(page,false);
   const untouched=await stored(page);
   await page.evaluate(()=>{const button=document.createElement('button');button.id='synthetic-stale-connection';button.dataset.action='connection';button.textContent='Synthetic stale connection';document.querySelector('#sheet').append(button);});
   await page.locator('#synthetic-stale-connection').click();assert.match(await page.locator('#message').innerText(),/Connections are available at finalization/);assert.equal(await stored(page),untouched);await dismissTechnicalError(page);await page.locator('#synthetic-stale-connection').evaluate(button=>button.remove());
   await page.locator('#completion-notes > summary, #notes-connections > summary:visible').first().focus();await page.keyboard.press('Enter');
   await page.locator('#character-notes').fill('Synthetic opening draft '+label);
   await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('[data-action="roll-statistics"]').waitFor();await ready(page);
   await assertGate(page,false);assert.equal(await page.locator('#character-notes').inputValue(),'Synthetic opening draft '+label);
   await page.locator('[data-action="save-notes"]').click();await page.waitForFunction(()=>document.querySelector('#notes-status').textContent.includes('saved with'));await ready(page);
   const notesSave=await stored(page);await page.reload();await page.locator('[data-action="roll-statistics"]').waitFor();await ready(page);await assertGate(page,false);assert.equal(await stored(page),notesSave);
   const panel=page.locator('#notes-connections');await panel.locator('summary').click();await page.screenshot({path:fileURLToPath(new URL('connections-'+label+'-early.png',out)),fullPage:true});
   // Import a historically valid connection made before finishing. UI gating must not rewrite it.
   page.once('dialog',d=>d.accept());await page.locator('#import').setInputFiles({name:'synthetic-existing.json',mimeType:'application/json',buffer:Buffer.from(legacyRaw)});
   await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Character loaded.'));await ready(page);
   assert.equal(await stored(page),legacyRaw);await assertGate(page,false);
   assert.deepEqual(project(JSON.parse(await stored(page))).state.connections,career.state.connections);
   assert.ok((await page.locator('.print-only').textContent()).includes('Synthetic earlier Traveller'));
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('.print-only').isVisible(),true);await page.emulateMedia({media:'screen'});
   await page.getByRole('button',{name:'Finish character',exact:true}).click();await page.locator('[data-action="open-character-sheet"]').waitFor();await ready(page);await assertGate(page,true);
   if(!await page.locator('#notes-connections').evaluate(details=>details.open))await page.locator('#completion-notes > summary, #notes-connections > summary:visible').first().click();await page.locator('#connection-person').fill('Synthetic final Traveller');await page.locator('#connection-skill').fill('Admin');await page.locator('#connection-note').fill('Recorded only at finalization.');
   const before=JSON.parse(await stored(page)),skillBefore=project(before).state.character.skills.Admin;
   await page.locator('[data-action="connection"]').evaluate(button=>{button.click();button.click();});await changed(page,before.events.length);
   const after=JSON.parse(await stored(page)),state=project(after).state;
   assert.equal(after.events.length,before.events.length+1);assert.deepEqual(after.events.slice(0,before.events.length),before.events);
   assert.equal(state.connections.length,2);assert.equal(state.character.skills.Admin,skillBefore+1);assert.deepEqual(state.connections[0],career.state.connections[0]);await assertGate(page,true);
   await page.screenshot({path:fileURLToPath(new URL('connections-'+label+'-final.png',out)),fullPage:true});
   const raw=await stored(page),downloaded=page.waitForEvent('download');await page.locator('#export').click();assert.equal(await readFile(await (await downloaded).path(),'utf8'),raw);
   await page.reload();await page.locator('[data-action="open-character-sheet"]').waitFor();await ready(page);await assertGate(page,true);assert.equal(await stored(page),raw);
   // Opening and closing the disclosure must not generate new records.
   await page.locator('#completion-notes > summary, #notes-connections > summary:visible').first().focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');assert.equal(await stored(page),raw);
   checks.push(label+' early gate, notes, legacy import/print, final entry, repeated click, export and reload');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('connections-finalization-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
