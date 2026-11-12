import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,execute,exportSession,createSession} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],checks=[],ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled),saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
try{
 for(const width of [1440,320])for(const http of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),label=(http?'http':'static')+'-'+width;
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+(http?'/?api=local':'/'));await ready(page);
   const setting=page.locator('[name=physicalDice]');assert.equal(await setting.isChecked(),false);await page.locator('#setup-gm-controls').evaluate(el=>el.open=true);await setting.check();
   await page.getByRole('button',{name:'Begin character',exact:true}).click();await ready(page);
   assert.equal(await page.locator('[data-physical-stat]').count(),0);assert.equal(await page.locator('[data-physical-card]').count(),6);
   await page.getByRole('button',{name:'Roll six characteristics',exact:true}).click();await ready(page);
   const raw=await saved(page),initial=project(JSON.parse(raw)).state;
   for(const p of initial.pool)assert.equal(await page.locator('#physical-card-'+p.key+' strong').textContent(),String(p.value));
   assert.equal(await page.locator('[data-physical-stat]').count(),0);assert.equal(await page.locator('#gm-toggle').isChecked(),false);
   await page.screenshot({path:fileURLToPath(new URL('physical-dice-unchanged-'+label+'.png',out)),fullPage:true});
   await page.locator('#physical-card-STR').click();assert.equal(await page.locator('[data-physical-stat]').count(),1);
   await page.locator('#physical-stat-STR').fill('8');await page.locator('#physical-stat-STR').press('Escape');assert.equal(await saved(page),raw);assert.equal(await page.locator('[data-physical-stat]').count(),0);assert.equal(await page.locator('#physical-card-STR strong').textContent(),String(initial.pool[0].value));
   await page.locator('#physical-card-STR').press('Enter');await page.locator('#physical-stat-STR').fill('13');await page.locator('#physical-stat-STR').press('Enter');assert.equal(await saved(page),raw);assert.equal(await page.locator('#physical-stat-STR').getAttribute('aria-invalid'),'true');
   await page.locator('#physical-stat-STR').press('Escape');await page.locator('#physical-card-STR').click();
   const nextSTR=initial.pool[0].base===8?7:8;await page.locator('#physical-stat-STR').fill(String(nextSTR));
   await page.screenshot({path:fileURLToPath(new URL('physical-dice-inline-'+label+'.png',out)),fullPage:true});
   await page.locator('#physical-stat-STR').press('Tab');await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1,{key,n:JSON.parse(raw).events.length});await ready(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'physical-card-DEX');
   for(const code of ['DEX','END','INT','EDU','SOC']){await page.locator('#physical-card-'+code).click();await page.locator('#physical-stat-'+code).fill(code==='DEX'?'9':'8');await page.locator('#physical-stat-'+code).press('Enter');await ready(page);assert.equal(await page.locator('[data-physical-stat]').count(),0);}
   await page.locator('#physical-card-STR').click();await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.locator('#gm-physical-dice').uncheck();await ready(page);await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.locator('#gm-physical-dice').check();await ready(page);await page.locator('#physical-card-STR').click();await page.locator('#physical-stat-STR').waitFor();await page.locator('#physical-stat-STR').press('Escape');
   const beforeRepeat=await saved(page);await page.locator('#physical-card-SOC').click();await page.locator('#physical-stat-SOC').press('Enter');assert.equal(await saved(page),beforeRepeat);assert.equal(await page.locator('[data-physical-stat]').count(),0);
   await page.locator('#physical-card-STR').click();await page.locator('#physical-stat-STR').fill('10');await page.locator('#physical-card-DEX').click();await page.locator('#physical-stat-DEX').waitFor();await ready(page);assert.equal(project(JSON.parse(await saved(page))).state.pool[0].base,10);await page.locator('#physical-stat-DEX').press('Escape');
   await page.locator('#physical-card-STR').click();await page.locator('#physical-stat-STR').fill('11');await page.locator('h1').click();await ready(page);assert.equal(await page.locator('[data-physical-stat]').count(),0);assert.equal(project(JSON.parse(await saved(page))).state.pool[0].base,11);
   const beforeInvalidBlur=await saved(page);await page.locator('#physical-card-STR').click();await page.locator('#physical-stat-STR').fill('13');await page.locator('h1').click();await ready(page);assert.equal(await saved(page),beforeInvalidBlur);assert.equal(await page.locator('#physical-stat-STR').getAttribute('aria-invalid'),'true');await page.locator('#physical-stat-STR').press('Escape');
   await page.getByRole('button',{name:'Swap scores',exact:true}).click();await ready(page);assert.equal(project(JSON.parse(await saved(page))).state.pool[0].base,9);
   await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.screenshot({path:fileURLToPath(new URL('physical-dice-cards-'+label+'.png',out)),fullPage:true});
   await page.locator('#simple-log-view').click();assert.match(await page.locator('#simple-log-content').textContent(),/physical|manual/i);await page.keyboard.press('Escape');await page.locator('#log-view').click();assert.match(await page.locator('#full-action-log').textContent(),/physical|manual/i);await page.keyboard.press('Escape');
   await page.locator('#gm-physical-dice').uncheck();await ready(page);assert.equal(await page.locator('[data-physical-stat]').count(),0);assert.equal(await page.locator('[data-edit-stat]').count(),0);assert.equal(await page.locator('#sheet .physical-dice-warning').count(),1);
   const beforeReload=await saved(page);await page.reload();await ready(page);assert.equal(await saved(page),beforeReload);
   await page.getByRole('button',{name:'Keep these characteristics',exact:true}).click();await ready(page);
   // Complete a synthetic record through supported engine commands to inspect its real final sheet.
   let session=JSON.parse(await saved(page));let p=project(session);session=execute(session,{type:'background',payload:{skills:p.state.backgroundOptions.slice(0,p.state.backgroundRemaining)}}).session;
   session=execute(session,{type:'skip-precareer'}).session;session=execute(session,{type:'finish'}).session;
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(session)});await page.reload();await ready(page);await page.getByRole('button',{name:'Open your character sheet',exact:true}).click();await page.locator('#final-character-sheet[open]').waitFor();
   assert.equal(await page.locator('#final-sheet-content .physical-dice-warning').count(),1);assert.equal(await page.locator('#final-sheet-content .physical-dice-warning').textContent(),'Manual dice scores');assert.ok(await page.locator('#final-sheet-content .physical-dice-warning').evaluate(el=>el.getBoundingClientRect().height<48));assert.equal(await page.locator('#final-sheet-content .physical-dice-warning').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 218, 88)');await page.screenshot({path:fileURLToPath(new URL('physical-dice-final-'+label+'.png',out)),fullPage:true});
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('#final-sheet-content .physical-dice-warning').isVisible(),true);await page.emulateMedia({media:'screen'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks.push(label+' setup/unchanged-rolled-cards/click-to-edit/Escape/Tab/Enter/validation/repeat/swaps/logs/off/reload/final/print');
  }finally{await context.close();}
 }
 for(const http of [false,true])for(const saveMethod of ['Enter','Tab','outside']){
  const context=await browser.newContext(),page=await context.newPage();try{
   let session=createSession('same-value-physical');for(const command of [{type:'setup',payload:{species:'human'}},{type:'roll-statistics'},{type:'gm-physical-dice',payload:{enabled:true}}])session=execute(session,command).session;
   const original=project(session).state.pool[0].base;await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(session)});await page.goto(origin+(http?'/?api=local':'/'));await ready(page);
   await page.locator('#physical-card-STR').click();if(saveMethod==='outside')await page.locator('h1').click();else await page.locator('#physical-stat-STR').press(saveMethod);await ready(page);const after=JSON.parse(await saved(page));assert.equal(after.events.length,session.events.length+1);assert.equal(project(after).state.pool[0].base,original);assert.equal(project(after).state.character.physicalDiceEntered,true);assert.equal(await page.locator('#sheet .physical-dice-warning').count(),1);checks.push((http?'http':'static')+' same-value manual provenance '+saveMethod);
  }finally{await context.close();}
 }
 for(const http of [false,true]){
  const context=await browser.newContext(),page=await context.newPage();
  try{
   let session=createSession('partial-physical');for(const command of [{type:'setup',payload:{species:'human'}},{type:'gm-physical-dice',payload:{enabled:true}},{type:'enter-physical-statistic',payload:{code:'STR',value:8}}])session=execute(session,command).session;
   await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:exportSession(session)});await page.goto(origin+(http?'/?api=local':'/'));await ready(page);await page.locator('#gm-controls').evaluate(el=>el.open=true);await page.locator('#gm-physical-dice').uncheck();await ready(page);
   assert.equal(await page.getByRole('button',{name:'Swap scores',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Keep these characteristics',exact:true}).isDisabled(),false);await page.getByRole('button',{name:'Roll a computer set',exact:true}).click();await ready(page);assert.equal(project(JSON.parse(await saved(page))).state.statisticsComplete,true);assert.equal(await page.locator('#sheet .physical-dice-warning').count(),1);checks.push((http?'http':'static')+' partial-entry guarded recovery');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('physical-dice-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
