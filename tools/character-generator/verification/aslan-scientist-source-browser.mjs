import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {aslanSetup} from './aslan-officer-fixtures.mjs';
import {exportSession,RULES_REVISION} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer(),out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1',checks=[],errors=[];
await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{
 for(const gender of ['male','female'])for(const width of [1440,390,320])for(const http of [false,true]){
  const r=aslanSetup('scientist-source-'+gender,gender,false,{},RULES_REVISION),raw=exportSession(r.session),p=await browser.newPage({viewport:{width,height:1000}});
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+(http?'?api=local':''));await p.waitForFunction(()=>!document.querySelector('#export').disabled);
  await p.locator('[data-action="select-career"][data-id="aslan.scientist"]').click();await p.locator('[data-army-specialty="healer"]').click();
  const info=p.locator('.career-crow-heading .crow-assistance-info');await info.focus();await p.keyboard.press('Enter');
  const dialog=p.locator('#army-rule-information');await dialog.waitFor({state:'visible'});const text=await dialog.innerText();
  assert.match(text,/summary \(p\. 23\).*Healer for either sex.*EDU 5\+ for Healer and EDU 6\+ for Researcher/s);assert.match(text,/Scientist page \(p\. 34\).*Healer male.*END 5\+ for Healer and END 6\+ for Researcher/s);assert.match(text,/retains Healer access for either sex.*detailed-page Survival checks/s);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth+1),false);
  const close=dialog.getByRole('button',{name:'Close Scientist rule information',exact:true});assert.equal(await close.count(),1);await close.scrollIntoViewIfNeeded();assert.equal(await close.isVisible(),true);
  if(!http&&gender==='female'&&width!==320){await p.evaluate(()=>document.fonts.ready);await p.locator('img:visible').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode().catch(()=>{}))));await p.screenshot({path:new URL('aslan-scientist-source-'+width+'.png',out).pathname,fullPage:true});}
  await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);
  await p.reload();await p.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);
  checks.push({gender,width,http,sourceConflictExplained:true,unchangedSave:true,focusRestored:true});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('aslan-scientist-source-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
