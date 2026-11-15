import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {vargrFailedSpacer} from './vargr-fallback-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),server=createServer(),out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1',checks=[],errors=[];
await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{
 for(const species of ['vargr','aezorgh'])for(const assignment of ['corsair','explorer','navy'])for(const width of [1440,390,320])for(const http of [false,true]){
  const r=vargrFailedSpacer(assignment,species),raw=exportSession(r.session),src='./assets/crow-'+(assignment==='corsair'?'corsair':'navy')+'.png',p=await browser.newPage({viewport:{width,height:1000}});
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await p.goto('http://127.0.0.1:'+server.address().port+'/'+(http?'?api=local':''));await p.waitForFunction(()=>!document.querySelector('#export').disabled);
  const portrait=p.locator('#workspace .career-pilot-guidance img');assert.equal(await portrait.count(),1);assert.equal(await portrait.getAttribute('src'),src);await portrait.evaluate(n=>n.decode());
  const values=r.log.at(-1).rolls.find(x=>x.label==='Qualification').values;assert.ok((await p.locator('.army-dice-faces').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')))).includes('Recorded dice: '+values.join(', ')));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const actions=await p.locator('#qualification-fallback [data-action]').evaluateAll(ns=>ns.map(n=>({action:n.dataset.action,disabled:n.disabled})));
  const info=p.locator('.career-crow-heading [aria-controls="army-rule-information"]');await info.focus();await p.keyboard.press('Enter');const dialog=p.locator('#army-rule-information[open]');await dialog.waitFor();assert.equal(await dialog.locator('.army-rule-header img').getAttribute('src'),src);
  await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);
  if(!http&&species==='vargr'&&assignment==='corsair'&&width!==320){await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:new URL('corsair-fallback-crow-'+width+'.png',out).pathname,fullPage:true});}
  await p.reload();await p.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await p.locator('#workspace .career-pilot-guidance img').getAttribute('src'),src);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);
  assert.deepEqual(await p.locator('#qualification-fallback [data-action]').evaluateAll(ns=>ns.map(n=>({action:n.dataset.action,disabled:n.disabled}))),actions);
  checks.push({species,assignment,width,http,picture:src,actualDice:true,unchangedSave:true,unchangedActionAvailability:true,focusRestored:true,reloaded:true});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('corsair-fallback-crow-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
