import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,exportSession,createSession,execute} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url),checks=[],errors=[];await mkdir(out,{recursive:true});
const saved=p=>p.evaluate(key=>localStorage.getItem(key),key);
const ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
const state=async p=>project(JSON.parse(await saved(p))).state;
const screenshot=(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});
const noOverflow=async p=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
async function activate(p,action){const before=JSON.parse(await saved(p)).events.length;await p.locator('[data-action="'+action+'"]').evaluate(b=>{b.click();b.click();});await p.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length===before+1&&!document.querySelector('#export').disabled,{key,before});}
try{
 for(const http of [false,true])for(const width of [1440,390,320])for(const enabled of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1050}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await p.locator('#setup-form').waitFor();
   await p.locator('[name=name]').fill('Luck house-rule preview');
   await p.locator('#setup-gm-controls > summary').click();await p.locator('#setup-house-rules > summary').click();
   const toggle=p.locator('[name=flatLuck]');assert.equal(await toggle.isChecked(),false);assert.equal(await toggle.isEnabled(),true);
   const before=await saved(p);await toggle.focus();await toggle.press('Space');assert.equal(await toggle.isChecked(),true);assert.equal(await p.locator('[name=extras][value=LCK]').isChecked(),true);assert.match(await p.locator('#setup-optional-summary').innerText(),/LCK/);await toggle.press('Space');assert.equal(await toggle.isChecked(),false);assert.equal(await p.locator('[name=extras][value=LCK]').isChecked(),true);if(enabled)await toggle.check();assert.equal(await saved(p),before,'unsubmitted setup choices do not mutate the save');
   const help=p.locator('#flat-luck-house-rule [data-opening-help=flatLuck]');await help.focus();await help.press('Enter');assert.match(await p.locator('#opening-help-copy').innerText(),/Turning the house rule off leaves Luck selected/);await p.keyboard.press('Escape');assert.equal(await help.evaluate(n=>n===document.activeElement),true);assert.equal(await saved(p),before);await noOverflow(p);if(enabled&&!http&&[1440,390].includes(width))await screenshot(p,'flat-luck-house-rule-'+width);
   await p.locator('#setup-optional-settings > summary').click();await p.locator('[name=extras][value=LCK]').check();
   await p.getByRole('button',{name:'Begin character',exact:true}).evaluate(b=>{b.click();b.click();});await p.locator('[data-action=roll-statistics]').waitFor();await ready(p);
   assert.equal(!!(await state(p)).config.flatLuck,enabled);assert.equal((await state(p)).config.gm,false);
   let card=p.locator('[data-optional-stat=LCK]');assert.match(await card.innerText(),/Pending/);assert.equal((await card.innerText()).includes('6 after Keep (house rule)'),enabled);
   const unrolled=await saved(p);await card.click();assert.match(await p.locator('#opening-help-copy').innerText(),/Start Luck at 6 house rule/);await p.keyboard.press('Escape');assert.equal(await saved(p),unrolled);
   await activate(p,'roll-statistics');await noOverflow(p);
   if(enabled&&!http&&[1440,390,320].includes(width))await screenshot(p,'flat-luck-statistics-'+width);
   const rolled=await saved(p);await p.reload();await ready(p);assert.equal(await saved(p),rolled);
   const downloaded=p.waitForEvent('download');await p.locator('#export').click();const file=await downloaded;const bytes=await readFile(await file.path(),'utf8');assert.deepEqual(JSON.parse(bytes),JSON.parse(rolled));
   p.once('dialog',d=>d.accept());await p.locator('#import').setInputFiles({name:'flat-luck.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await ready(p);assert.equal(await saved(p),rolled);
   await activate(p,'accept-statistics');let s=await state(p),raw=JSON.parse(await saved(p));
   if(enabled){assert.equal(s.character.stats.LCK,6);assert.equal(raw.events.at(-1).rolls.some(r=>r.label==='LCK'),false);}else{assert.equal(raw.events.at(-1).rolls.find(r=>r.label==='LCK').values.length,2);}
   const accepted=await saved(p);await p.reload();await ready(p);assert.equal(await saved(p),accepted);assert.deepEqual(await state(p),s);await noOverflow(p);
   checks.push({http,width,enabled,passed:true});
  }finally{await context.close();}
 }
 // A configuration saved before setup finishes must keep selected and deliberately absent Luck.
 for(const http of [false,true])for(const extras of [['LCK','MRL'],['MRL']]){
  const context=await browser.newContext({viewport:{width:390,height:1050}}),p=await context.newPage();
  try{await p.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await p.locator('#setup-form').waitFor();
   const fixture=execute(createSession('interrupted-luck'),{type:'configure',payload:{flatLuck:true,extras}}),raw=exportSession(fixture.session);
   await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await p.reload();await p.locator('#setup-form').waitFor();await ready(p);assert.equal(await saved(p),raw);await p.locator('#setup-gm-controls > summary').click();
   assert.equal(await p.locator('[name=flatLuck]').isChecked(),true);assert.equal(await p.locator('[name=extras][value=LCK]').isChecked(),extras.includes('LCK'));assert.equal(await p.locator('[name=extras][value=MRL]').isChecked(),true);assert.equal((await p.locator('#setup-optional-summary').innerText()).includes('LCK'),extras.includes('LCK'));
   p.once('dialog',d=>d.accept());await p.locator('#import').setInputFiles({name:'interrupted-luck.json',mimeType:'application/json',buffer:Buffer.from(raw)});await ready(p);assert.equal(await saved(p),raw);
   await p.getByRole('button',{name:'Begin character',exact:true}).click();await p.locator('[data-action=roll-statistics]').waitFor();assert.deepEqual((await state(p)).config.extras,extras);assert.equal((await state(p)).config.flatLuck,true);checks.push({http,interruptedExtras:extras,passed:true});
  }finally{await context.close();}
 }
 // Unselected Luck remains absent, and its later-add route obeys the saved choice.
 for(const http of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();
  try{await p.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await p.locator('#setup-form').waitFor();await p.locator('#setup-gm-controls > summary').click();await p.locator('#setup-house-rules > summary').click();await p.locator('[name=flatLuck]').check();assert.equal(await p.locator('[name=extras][value=LCK]').isChecked(),true);await p.locator('#setup-optional-settings > summary').click();await p.locator('[name=extras][value=LCK]').uncheck();await p.getByRole('button',{name:'Begin character',exact:true}).click();await p.locator('[data-action=roll-statistics]').waitFor();await activate(p,'roll-statistics');await activate(p,'accept-statistics');assert.equal((await state(p)).character.stats.LCK,undefined);
   await p.locator('#background-record > summary').click();await p.locator('#additional-characteristics > summary').click();assert.match(await p.locator('#additional-characteristics').innerText(),/adding Luck starts it at 6/);await p.locator('#extra-stat').selectOption('LCK');await activate(p,'add-extra');assert.equal((await state(p)).character.stats.LCK,6);assert.deepEqual(JSON.parse(await saved(p)).events.at(-1).rolls,[]);checks.push({http,laterAdd:true,passed:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('flat-luck-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
