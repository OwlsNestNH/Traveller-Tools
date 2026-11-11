import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,createSession,execute,exportSession} from '../engine/session.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',errors=[],checks=[];
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key),ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const changed=async(page,n)=>page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n});
function fixture(species='human',gm=true,accepted=false){let s=createSession('stat-card-'+species);for(const command of [{type:'configure',payload:{extras:['PSI','LCK','WLT']}},{type:'setup',payload:{species,culture:'imperial'}},{type:'gm-mode',payload:{enabled:gm}},{type:'roll-statistics'},...(accepted?[{type:'accept-statistics'}]:[])])s=execute(s,command).session;return s;}
try{
 for(const width of [1440,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:1000}}),session=fixture(),raw=exportSession(session);
  await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw});const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.locator('#stat-edit-pool-STR').waitFor();await ready(page);
   assert.equal(await page.locator('#workspace [data-stat-pool="true"]').count(),6);
   await page.locator('#stat-edit-pool-STR').focus();await page.keyboard.press('Enter');await page.locator('#statistic-editor[open]').waitFor();
   assert.equal(await page.locator('#statistic-editor-value').inputValue(),String(project(session).state.pool[0].value));
   await page.locator('#statistic-editor-value').fill('15');await page.locator('#statistic-editor-reason').fill('Cancel must not change history');
   await page.locator('#statistic-editor-cancel').click();assert.equal(await saved(page),raw);assert.equal(await page.evaluate(()=>document.activeElement.id),'stat-edit-pool-STR');
   await page.locator('#stat-edit-pool-STR').click();await page.keyboard.press('Escape');assert.equal(await saved(page),raw);
   await page.locator('#stat-edit-pool-STR').click();await page.locator('#statistic-editor-value').fill('41');await page.locator('#statistic-editor-reason').fill('Invalid score');await page.locator('#statistic-editor-save').click();assert.equal(await saved(page),raw);
   await page.locator('#statistic-editor-value').fill('11');await page.locator('#statistic-editor-reason').fill('');await page.locator('#statistic-editor-save').click();assert.equal(await saved(page),raw);
   await page.locator('#statistic-editor-reason').fill('Referee sets the score');
   await page.evaluate(()=>{const f=document.querySelector('#statistic-editor-form');f.requestSubmit();f.requestSubmit();});await changed(page,session.events.length);
   let updated=JSON.parse(await saved(page)),p=project(updated);assert.equal(p.state.pool[0].value,11);assert.equal(p.state.pool[0].base,project(session).state.pool[0].base);assert.equal(p.state.rollTotal,project(session).state.rollTotal);assert.equal(p.log.at(-1).type,'gm-override');assert.match(p.log.at(-1).summary,/Referee sets the score/);assert.deepEqual(updated.events.slice(0,session.events.length),session.events);assert.equal(await page.evaluate(()=>document.activeElement.id),'stat-edit-pool-STR');
   await page.locator('#stat-edit-optional-LCK').click();await page.locator('#statistic-editor-value').fill('8');await page.locator('#statistic-editor-reason').fill('Final optional Luck');await page.locator('#statistic-editor-save').click();await changed(page,updated.events.length);
   await page.locator('#stat-edit-optional-WLT').click();await page.locator('#statistic-editor-value').fill('40');await page.locator('#statistic-editor-reason').fill('Final optional Wealth');await page.locator('#statistic-editor-save').click();await changed(page,updated.events.length+1);
   await page.getByRole('button',{name:'Keep these characteristics',exact:true}).click();await page.locator('#background-record > summary').click();await page.locator('#psi-choice-sheet').waitFor();await ready(page);
   const before=JSON.parse(await saved(page));assert.equal(project(before).state.character.stats.LCK,8);assert.equal(project(before).state.character.stats.WLT,40);await page.locator('#character-notes').evaluate(el=>el.closest('details').open=true);await page.locator('#character-notes').fill('Unsaved notes survive stat edit');
   await page.locator('#psi-choice-sheet').click();await page.locator('#psi-choice-edit').click();await page.locator('#statistic-editor-value').fill('10');await page.locator('#statistic-editor-reason').fill('Referee potential');await page.locator('#statistic-editor-save').click();await changed(page,before.events.length);
   assert.equal(project(JSON.parse(await saved(page))).state.character.stats.PSI,10);assert.equal(await page.locator('#character-notes').inputValue(),'Unsaved notes survive stat edit');
   await page.locator('#stat-edit-sheet-WLT').click();await page.locator('#statistic-editor-value').fill('6');await page.locator('#statistic-editor-reason').fill('Referee wealth');await page.locator('#statistic-editor-save').click();await changed(page,before.events.length+1);
   assert.equal(project(JSON.parse(await saved(page))).state.character.stats.WLT,6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('#stat-edit-sheet-LCK').click();await page.screenshot({path:new URL('statistic-editor-'+transport+'-'+width+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});await page.keyboard.press('Escape');
   const final=await saved(page);await page.reload();await ready(page);assert.equal(await saved(page),final);
   checks.push(transport+' '+width+' keyboard/cancel/validation/repeat/audit/PSI/Wealth/notes/reload');
  }finally{await context.close();}
 }
 for(const spec of ['human','aezorgh']){
  const session=fixture(spec,spec==='aezorgh',true),context=await browser.newContext();await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:exportSession(session)});const page=await context.newPage();
  try{await page.goto(origin);await ready(page);if(spec==='human'){assert.equal(await page.locator('[data-edit-stat]').count(),0);}else{await page.getByRole('radio',{name:'Admin',exact:true}).check();await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.locator('#species-skill-dialog').waitFor({state:'detached'});await ready(page);const beforeEdit=JSON.parse(await saved(page)).events.length;await page.locator('#stat-edit-sheet-CHA').click();assert.equal(await page.locator('#statistic-editor-label').textContent(),'New SOC score');await page.locator('#statistic-editor-value').fill('10');await page.locator('#statistic-editor-reason').fill('Derived pair');await page.locator('#statistic-editor-save').click();await changed(page,beforeEdit);const p=project(JSON.parse(await saved(page)));assert.equal(p.state.character.stats.SOC,10);assert.equal(p.state.character.stats.CHA,5);}checks.push(spec+' gating/derived handling');}finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('statistic-editor-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

