import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
import {armyEntryAward,run,force} from './rank-award-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
import {laterTermVargrFixture} from './survival-result-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);
const vargrAfter=laterTermVargrFixture()[2],revision=vargrAfter.session.events.at(-1).command.payload.revision;
const vargrSession={...vargrAfter.session,events:vargrAfter.session.events.slice(0,revision-1)};
const cases=[['army-survival',force(settleAssignment(armyEntryAward()),'survival-check',{},[6,6])],['vargr-survival',run({session:vargrSession,...project(vargrSession)},'survival-check')],['rank-source',armyEntryAward()]];
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),checks=[],errors=[];await mkdir(out,{recursive:true});
try{for(const http of [false,true])for(const width of [1440,390,320]){
 const p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 const idle=()=>p.waitForFunction(()=>!document.querySelector('#export').disabled),saved=()=>p.evaluate(k=>localStorage.getItem(k),key),dice=()=>p.locator('.army-dice-faces').evaluateAll(ns=>ns.map(n=>n.innerHTML).join(''));
 await p.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await idle();
 for(const [name,fixture] of cases){
  await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await p.reload();await idle();
  const beforeText=await p.locator('#last-action-result').innerText(),beforeDice=await dice(),before=project(importSession(await saved()));
  if(name!=='rank-source')assert.ok(beforeDice?.includes('svg'),'Accepted Survival faces are visible');
  for(const text of ['Synthetic review note','Revised synthetic review note']){
   const notes=p.locator('#notes-connections');if(!await notes.evaluate(n=>n.open))await notes.locator(':scope > summary').click();
   await p.locator('#character-notes').fill(text);const count=JSON.parse(await saved()).events.length;
   await p.locator('[data-action=save-notes]').evaluate(n=>{n.click();n.click();});
   await p.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).events.length===count+1,{key,count});await idle();
   assert.equal(await p.locator('#last-action-result').innerText(),beforeText);
   assert.equal(await dice(),beforeDice);
   const accepted=await saved(),after=project(importSession(accepted));assert.equal(after.state.stage,before.state.stage);assert.deepEqual(after.state.rng,before.state.rng);
   const expected=structuredClone(before.state.character);expected.notes=text;assert.deepEqual(after.state.character,expected);
   assert.equal(after.log.at(-1).type,'notes');assert.deepEqual(after.log.at(-1).rolls,[]);
   await p.reload();await idle();assert.equal(await saved(),accepted);assert.equal(await p.locator('#last-action-result').innerText(),beforeText);assert.equal(await dice(),beforeDice);
  }
  const info=p.locator('[data-result-information]');if(await info.count()){const accepted=await saved();await info.click();await p.locator('#opening-help-dialog[open]').waitFor();await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);assert.equal(await saved(),accepted);}
  await p.locator('#workspace').evaluate(n=>n.scrollIntoView({block:'start'}));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(!http&&width!==320)await p.screenshot({path:new URL('notes-retained-'+name+'-'+width+'.png',out).pathname});
  if(name!=='rank-source'){const count=JSON.parse(await saved()).events.length;await p.locator('[data-action=career-event]').click();await p.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).events.length===count+1,{key,count});await idle();assert.notEqual(await p.locator('#last-action-result').innerText(),beforeText);assert.equal(project(importSession(await saved())).log.at(-1).type,'career-event');}
  checks.push({http,width,name,notesOnly:true,facesRetained:true,reload:true,repeatClick:true});
 }
 await p.close();}
 assert.deepEqual(errors,[]);await writeFile(new URL('notes-result-browser-status.json',out),JSON.stringify({checks,errors},null,2));console.log(checks.length,'notes-result checks passed');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
