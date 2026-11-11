// Isolated browser contexts and synthetic characters only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,RULES_REVISION} from '../engine/session.mjs';

const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);
await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=p=>p.evaluate(k=>localStorage.getItem(k),key);
const ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
const state=async p=>project(JSON.parse(await saved(p))).state;
async function action(p,fn){const before=JSON.parse(await saved(p)).events.length;await fn();await p.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length>before&&!document.querySelector('#export').disabled,{key,before});}
async function reveal(p,selector){await p.locator(selector).evaluate(el=>{for(let n=el.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});}
async function isolated(p){assert.equal((await state(p)).config.gm,false);assert.equal(await p.locator('#gm-toggle').isChecked(),false);assert.equal(await p.locator('#gm-task,#gm-value-form,#gm-roll-form,#gm-restore-form').count(),0);assert.equal(await p.locator('[data-edit-stat]:not([data-edit-stat="PSI"])').count(),0);}
async function openEditor(p,trigger){await p.locator(trigger).focus();await p.keyboard.press('Enter');await p.locator('#psi-choice-edit').click();await p.locator('#statistic-editor[open]').waitFor();}
async function setPsi(p,trigger,value){await openEditor(p,trigger);await p.locator('#statistic-editor-value').fill(String(value));await p.locator('#statistic-editor-reason').fill('Synthetic referee-approved potential');await action(p,()=>p.evaluate(()=>{const f=document.querySelector('#statistic-editor-form');f.requestSubmit();f.requestSubmit();}));}
async function continuity(p){await reveal(p,'#export');const pending=p.waitForEvent('download');await p.locator('#export').click();const raw=await readFile(await(await pending).path(),'utf8');assert.deepEqual(JSON.parse(raw),JSON.parse(await saved(p)));await p.reload();await ready(p);assert.deepEqual(JSON.parse(await saved(p)),JSON.parse(raw));p.once('dialog',d=>d.accept());await reveal(p,'#import');await p.locator('#import').setInputFiles({name:'synthetic-psi.json',mimeType:'application/json',buffer:Buffer.from(raw)});await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Character loaded.'));await ready(p);assert.deepEqual(JSON.parse(await saved(p)),JSON.parse(raw));}
try{
 for(const width of [1440,320])for(const transport of ['static','http'])for(const setupEnabled of [false,true]){
  const c=await browser.newContext({viewport:{width,height:1000}}),p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  const label=transport+' '+width+' setup PSI-only '+setupEnabled;
  try{
   await p.goto(origin+(transport==='http'?'/?api=local':'/'));await p.locator('#setup-form').waitFor();await ready(p);
   assert.equal(await p.locator('[name="psiGm"]').isChecked(),false);assert.equal(await p.locator('[name="gm"]').isChecked(),false);assert.equal(await p.locator('[name="psiTestingWithoutEvent"]').isChecked(),false);
   await reveal(p,'[name="extras"][value="PSI"]');await p.locator('[name="extras"][value="PSI"]').check();await p.locator('[name="extras"][value="LCK"]').check();
   if(setupEnabled){await reveal(p,'[name="psiGm"]');await p.locator('[name="psiGm"]').check();}
   await p.getByRole('button',{name:'Begin character',exact:true}).click();await p.locator('[data-action="roll-statistics"]').waitFor();await ready(p);await action(p,()=>p.locator('[data-action="roll-statistics"]').click());
   let initial=await state(p);assert.equal(JSON.parse(await saved(p)).rulesRevision,RULES_REVISION);assert.equal(initial.character.stats.PSI,undefined);assert.equal(!!initial.config.psiGm,setupEnabled);assert.equal(!!initial.config.psiTestingWithoutEvent,false);await isolated(p);
   if(setupEnabled){await setPsi(p,'#psi-choice-optional',9);assert.equal((await state(p)).character.stats.PSI,9);}
   await action(p,()=>p.getByRole('button',{name:'Keep these characteristics',exact:true}).click());await reveal(p,'#psi-choice-sheet');await p.locator('#psi-choice-sheet').waitFor();await isolated(p);
   assert.equal((await state(p)).character.stats.PSI,setupEnabled?9:undefined);
   if(!setupEnabled){assert.match(await p.locator('#psi-choice-sheet').innerText(),/Untested/);await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-edit').isVisible(),false);await p.keyboard.press('Escape');await reveal(p,'#gm-psi-mode');await action(p,()=>p.locator('#gm-psi-mode').check());assert.equal((await state(p)).character.stats.PSI,undefined);}
   await isolated(p);await reveal(p,'#gm-psi-testing');assert.equal(await p.locator('#gm-psi-testing').isChecked(),false);const untouchedPsi=(await state(p)).character.stats.PSI;await action(p,()=>p.locator('#gm-psi-testing').check());assert.equal((await state(p)).character.stats.PSI,untouchedPsi);assert.equal((await state(p)).config.psiGm,true);await isolated(p);await action(p,()=>p.locator('#gm-psi-testing').uncheck());assert.equal((await state(p)).character.stats.PSI,untouchedPsi);const before=await saved(p),beforeState=await state(p);
   await openEditor(p,'#psi-choice-sheet');await p.locator('#statistic-editor-value').fill('12');await p.locator('#statistic-editor-reason').fill('Cancelled edit');await p.locator('#statistic-editor-cancel').click();assert.equal(await saved(p),before);assert.equal(await p.evaluate(()=>document.activeElement.id),'psi-choice-sheet');
   await openEditor(p,'#psi-choice-sheet');await p.keyboard.press('Escape');assert.equal(await saved(p),before);assert.equal(await p.evaluate(()=>document.activeElement.id),'psi-choice-sheet');
   const n=JSON.parse(before).events.length;await setPsi(p,'#psi-choice-sheet',10);let current=await state(p);assert.equal(JSON.parse(await saved(p)).events.length,n+1,'repeated submit creates one edit');assert.equal(current.character.stats.PSI,10);assert.equal(current.character.psionics.tests.length,0);assert.equal(current.character.psionics.training.length,0);assert.deepEqual(current.character.skills,beforeState.character.skills);for(const [code,value]of Object.entries(beforeState.character.stats))if(code!=='PSI')assert.equal(current.character.stats[code],value);await isolated(p);
   await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-edit').isVisible(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.emulateMedia({media:'print'});assert.equal(await p.locator('#psi-choice-dialog').isVisible(),false);assert.equal(await p.locator('#psi-choice-sheet strong').isVisible(),true);await p.emulateMedia({media:'screen'});await p.keyboard.press('Escape');
   await continuity(p);await isolated(p);await reveal(p,'#gm-psi-mode');await action(p,()=>p.locator('#gm-psi-mode').uncheck());assert.equal((await state(p)).character.stats.PSI,10);await p.locator('#psi-choice-sheet').click();assert.equal(await p.locator('#psi-choice-edit').isVisible(),false);await p.keyboard.press('Escape');await isolated(p);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await p.screenshot({path:fileURLToPath(new URL('psi-activation-'+transport+'-'+width+'-'+setupEnabled+'.png',out)),fullPage:true});await continuity(p);assert.equal((await state(p)).character.stats.PSI,10);checks.push(label+': setup, Keep, isolated permission, cancel/focus, repeated save, no invented training, reload/export/import, toggle off, print, overflow');
  }finally{await c.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(new URL('psi-activation-results.json',out),JSON.stringify({checks,errors},null,2));}
console.log(JSON.stringify({checks,errors},null,2));

