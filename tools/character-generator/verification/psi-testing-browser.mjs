import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,createSession,execute,exportSession} from '../engine/session.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright'),key='traveller-character-generator.v1',errors=[],checks=[];
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const run=(r,type,payload={})=>execute(r.session??r,{type,payload}),saved=p=>p.evaluate(k=>localStorage.getItem(k),key),ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
function fixture({gm=false,option=true,accepted=true}={}){let r=run(createSession('psi-browser-24'),'configure',{extras:['PSI'],psiTestingWithoutEvent:option});r=run(r,'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'cash',value:120000,reason:'Synthetic test funds'});r=run(r,'gm-mode',{enabled:gm});r=run(r,'roll-statistics');if(accepted){r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});}return r.session;}
async function changed(p,n){await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n});}
async function load(session,width,transport){const c=await browser.newContext({viewport:{width,height:1000}}),raw=exportSession(session);await c.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw});const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+(transport==='http'?'/?api=local':'/'));await ready(p);return {c,p,raw};}
try{
 for(const width of [1440,320])for(const transport of ['static','http']){
  const session=fixture(),{c,p,raw}=await load(session,width,transport);
  try{
   const card=p.locator('.stat-psi').first();assert.equal(await card.locator('.stat-psi-heading button').count(),1);assert.equal(await card.locator('.stat-psi-score button').count(),0);
   await card.locator('.stat-psi-heading button').click();await p.locator('dialog[open]').waitFor();assert.match(await p.locator('dialog[open]').innerText(),/Optional characteristics/);await p.keyboard.press('Escape');assert.equal(await saved(p),raw);
   await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-edit').isVisible(),false);assert.equal(await p.locator('#psi-choice-test').isEnabled(),true);await p.locator('#psi-choice-test').click();await p.locator('#psi-testing-confirm').click();assert.equal(await saved(p),raw);
   await p.locator('#psi-testing-back').click();await p.locator('#psi-choice-close').click();assert.equal(await saved(p),raw);assert.equal(await p.evaluate(()=>document.activeElement.id),'psi-choice-sheet');
   await p.locator('#psi-choice-sheet').click();await p.locator('#psi-choice-test').click();await p.locator('#psi-testing-access').check();await p.locator('#psi-testing-timing').check();await p.locator('#psi-testing-reason').fill('Referee-approved teacher and two-week interval');await p.locator('#psi-testing-cost').fill('4999');await p.locator('#psi-testing-confirm').click();assert.equal(await saved(p),raw);await p.locator('#psi-testing-cost').fill('5000');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.screenshot({path:new URL('psi-testing-'+transport+'-'+width+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
   await p.evaluate(()=>{const f=document.querySelector('#psi-testing-form');f.requestSubmit();f.requestSubmit();});await changed(p,session.events.length);let current=JSON.parse(await saved(p)),s=project(current).state;assert.equal(s.character.cash,115000);assert.equal(s.character.psionics.tests.length,1);assert.equal(s.character.psionics.training.length,0);assert.deepEqual(s.character.skills,project(session).state.character.skills);assert.equal(s.config.gm,false);
   await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-test').isVisible(),false);assert.equal(await p.locator('#psi-choice-training').isVisible(),true);await p.emulateMedia({media:'print'});assert.equal(await p.locator('#psi-choice-dialog').isVisible(),false);assert.equal(await p.locator('#psi-choice-sheet strong').isVisible(),true);await p.emulateMedia({media:'screen'});await p.locator('#psi-choice-close').click();const final=await saved(p);await p.reload();await ready(p);assert.equal(await saved(p),final);checks.push(transport+' '+width+' heading info, cancel, valid payment, no training, no repeat, reload');
  }finally{await c.close();}
 }
 for(const option of [false,true]){
  const session=fixture({gm:true,option,accepted:false}),{c,p,raw}=await load(session,320,'static');try{await p.locator('#psi-choice-optional').click();assert.equal(await p.locator('#psi-choice-test').isDisabled(),true);await p.locator('#psi-choice-edit').click();await p.locator('#statistic-editor-value').fill('9');await p.locator('#statistic-editor-reason').fill('Explicit GM final potential');await p.locator('#statistic-editor-save').click();await changed(p,session.events.length);await p.getByRole('button',{name:'Keep these characteristics',exact:true}).click();await ready(p);const s=project(JSON.parse(await saved(p))).state;assert.equal(s.character.stats.PSI,9);assert.equal(s.character.psionics.tests.length,0);checks.push('GM initial PSI retained, option '+option);}finally{await c.close();}
 }
 const {c,p,raw}=await load(fixture({option:false}),320,'http');try{await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-test').isDisabled(),true);await p.keyboard.press('Escape');assert.equal(await saved(p),raw);checks.push('Without-event option off blocks voluntary test');}finally{await c.close();}
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(new URL('psi-testing-results.json',out),JSON.stringify({checks,errors},null,2));}
console.log(JSON.stringify({checks,errors},null,2));
