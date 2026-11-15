import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession,project,importSession} from '../engine/session.mjs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload}),key='traveller-character-generator.v1';
let r=run(createSession('payment-paths'),'setup',{name:'Training example',species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-psi-testing',{enabled:true});r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'Known potential'});r=run(r,'gm-override',{field:'cash',value:120000,reason:'Funding test'});r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true}),errors=[],checks=[];
try{for(const width of [1440,390])for(const api of [false,true])for(const mode of ['cash','provided','decline','psion']){
 const c=await browser.newContext({viewport:{width,height:1000}});await c.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:exportSession(r.session)});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+(api?'/?api=local':'/'));
 const raw=await p.evaluate(k=>localStorage.getItem(k),key);
 if(mode==='psion'){
  await p.locator('[data-action="select-career"][data-id="core.psion"]').click();
  for(let attempt=0;attempt<2;attempt++){
   await p.locator('[data-action="career"]').click();
   await p.locator('#crow-error-dialog[open]').waitFor();
   await p.waitForFunction(()=>!document.getElementById('export').disabled);
   assert.match(await p.locator('#crow-error-detail').innerText(),/Complete separate psionic training/);
   assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
   await p.locator('#crow-error-close').click();await p.locator('#crow-error-dialog[open]').waitFor({state:'hidden'});
  }
  await p.locator('[data-action="career-list"]').click();
 }
 await p.getByRole('button',{name:'Psi Training',exact:true}).click();await p.locator('#psionic-course-dialog[open]').waitFor();
 if(mode==='decline')await p.locator('#psionic-course-decline').click();
 else{
  await p.locator('#psionic-course-funding').selectOption(mode==='cash'?'cash':'provided');await p.locator('#psionic-course-access').check();await p.locator('#psionic-course-note').fill('Institute access and four months confirmed');await p.locator('#psionic-course-accept').click();
 }
 await p.waitForFunction(expected=>document.body.dataset.stage===expected,mode==='decline'?'career':'psionic-training');
 const after=project(importSession(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(after.state.character.cash,mode==='cash'?20000:120000);assert.equal(after.state.character.debt,0);assert.equal(after.state.character.careers.length,0);assert.equal(after.state.rng,r.state.rng);
 if(mode!=='decline'){await p.locator('[data-action="learn-talent"][data-talent="Telepathy"]').click();await p.locator('[data-action="finish-psionic-training"]').click();await p.waitForFunction(()=>document.body.dataset.stage==='career');const finished=project(importSession(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(finished.state.character.careers.length,0);assert.equal(finished.state.character.skills.Telepathy,0);assert.equal(finished.state.character.age,18);
  if(mode==='psion'){await p.locator('[data-action="select-career"][data-id="core.psion"]').click();assert.equal(await p.locator('[data-action="career"]').isEnabled(),true);}
 }
 checks.push({width,api,mode});await c.close();
}assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
