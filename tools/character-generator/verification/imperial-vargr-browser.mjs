import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url),checks=[],errors=[];await mkdir(out,{recursive:true});
const saved=p=>p.evaluate(key=>localStorage.getItem(key),key);
const ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
const state=async p=>project(JSON.parse(await saved(p))).state;
const noOverflow=async p=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
async function activate(p,action){const before=JSON.parse(await saved(p)).events.length;await p.locator('[data-action="'+action+'"]').evaluate(b=>{b.click();b.click();});await p.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length===before+1&&!document.querySelector('#export').disabled,{key,before});}
try{
 for(const http of [false,true])for(const width of [1440,320])for(const culture of ['imperial','native'])for(const enabled of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1050}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await p.locator('#setup-form').waitFor();
   await p.locator('[name=name]').fill('Synthetic Vargr CHA check');await p.locator('[name=species]').selectOption('vargr');await p.locator('[name=culture]').selectOption(culture);
   await p.locator('#setup-gm-controls > summary').click();await p.locator('#setup-optional-settings > summary').click();
   const checkbox=p.locator('[name=extras][value=CHA]');assert.equal(await checkbox.isChecked(),false);if(enabled){await checkbox.focus();await checkbox.press('Space');}
   const raw=await saved(p);await p.locator('#setup-optional-settings [data-opening-help=extras]').click();assert.match(await p.locator('#opening-help-copy').innerText(),/New Imperial Vargr keep SOC/);assert.match(await p.locator('#opening-help-copy').innerText(),/1D6 \+ 2/);await p.keyboard.press('Escape');assert.equal(await saved(p),raw);
   await p.getByRole('button',{name:'Begin character',exact:true}).evaluate(b=>{b.click();b.click();});await p.locator('[data-action=roll-statistics]').waitFor();await ready(p);
   assert.equal((await state(p)).config.gm,false);assert.deepEqual((await state(p)).config.extras,enabled?['CHA']:[]);
   assert.equal(await p.locator('[data-optional-stat=CHA]').count(),culture==='imperial'&&enabled?1:0);
   if(culture==='imperial'&&enabled){assert.match(await p.locator('[data-optional-stat=CHA]').innerText(),/Pending/);const before=await saved(p);await p.locator('[data-optional-stat=CHA]').click();await p.keyboard.press('Escape');assert.equal(await saved(p),before);assert.equal(await p.locator('[data-optional-stat=CHA]').evaluate(n=>n===document.activeElement),true);}
   await activate(p,'roll-statistics');const rolled=await saved(p),s=await state(p);assert.equal(s.pool.length,6);assert.deepEqual(s.pool.map(x=>x.key),['STR','DEX','END','INT','EDU',culture==='imperial'?'SOC':'CHA']);await noOverflow(p);
   if(culture==='imperial'&&enabled&&!http)await p.screenshot({path:fileURLToPath(new URL('imperial-vargr-selected-'+width+'.png',out)),fullPage:true});
   await p.reload();await ready(p);assert.equal(await saved(p),rolled);
   const download=p.waitForEvent('download');await p.locator('#export').click();const file=await download,bytes=await readFile(await file.path(),'utf8');assert.deepEqual(JSON.parse(bytes),JSON.parse(rolled));p.once('dialog',d=>d.accept());await p.locator('#import').setInputFiles({name:'synthetic-vargr.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await ready(p);assert.equal(await saved(p),rolled);
   await activate(p,'accept-statistics');let after=await state(p),events=JSON.parse(await saved(p)).events,rolls=events.at(-1).rolls;
   if(culture==='imperial'){assert.equal(after.character.stats.SOC,s.pool[5].value);if(enabled){assert.equal(rolls.length,1);assert.equal(rolls[0].label,'Imperial Vargr CHA');assert.equal(rolls[0].values.length,1);assert.equal(after.character.stats.CHA,rolls[0].total+2);}else{assert.equal(after.character.stats.CHA,undefined);assert.deepEqual(rolls,[]);}}
   else{assert.equal(after.character.stats.CHA,s.pool[5].value);assert.equal(after.character.stats.SOC,undefined);assert.deepEqual(rolls,[]);}
   const accepted=await saved(p);await p.reload();await ready(p);assert.equal(await saved(p),accepted);assert.deepEqual(await state(p),after);await noOverflow(p);
   if(culture==='imperial'&&!enabled){await p.locator('#background-record > summary').click();await p.locator('#additional-characteristics > summary').click();await p.locator('#extra-stat').selectOption('CHA');await activate(p,'add-extra');after=await state(p);rolls=JSON.parse(await saved(p)).events.at(-1).rolls;assert.equal(rolls.length,1);assert.equal(rolls[0].values.length,1);assert.equal(after.character.stats.CHA,rolls[0].total+2);assert.equal(await p.locator('#extra-stat option[value=CHA]').count(),0);}
   checks.push({http,width,culture,enabled,passed:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('imperial-vargr-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
