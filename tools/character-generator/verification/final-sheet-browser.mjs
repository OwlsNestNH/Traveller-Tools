import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);
await mkdir(out,{recursive:true});
const raw=exportSession(finalSheetFixture().session),unfinished=exportSession(finalSheetFixture({finish:false}).session);
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const checks=[],errors=[];
try{
 for(const width of [1440,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),label=transport+'-'+width;
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw:unfinished});
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));
   await page.getByRole('button',{name:'Finish character',exact:true}).waitFor();
   assert.equal(await page.locator('[data-action=open-character-sheet]').count(),0);
   await page.getByRole('button',{name:'Finish character',exact:true}).click();
   const open=page.getByRole('button',{name:'Open your character sheet',exact:true});await open.waitFor();
   assert.ok(await open.evaluate(el=>el.getBoundingClientRect().height>=72));
   await page.locator('#completion-notes > summary').click();
   await page.locator('#character-notes').fill('Unsaved biography '+label+' <img src=x>');
   await open.focus();await open.press('Enter');
   const dialog=page.getByRole('dialog',{name:'Character sheet',exact:true});await dialog.waitFor();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'final-sheet-title');
   const content=dialog.locator('#final-sheet-content');
   assert.match(await content.textContent(),new RegExp('Unsaved biography '+label));
   assert.match(await content.textContent(),/Source-confirmed synthetic treatment note/);
   assert.match(await content.textContent(),/Term 1 · Intermediary \/ Arbitrator/);
   assert.match(await content.textContent(),/Cr20,000/);assert.match(await content.textContent(),/Injury table: \[2\] = 2/);
   assert.equal(await content.locator('input,button,select,textarea,datalist').count(),0);
   assert.equal(await content.locator('img,script').count(),0);
   assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
   assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const saved=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(JSON.parse(saved).events.at(-1).command.type,'notes');
   await page.screenshot({path:fileURLToPath(new URL('final-sheet-'+label+'-opened.png',out)),fullPage:true});
   // Modal keyboard focus stays inside and Escape returns to the new opener
   // after the save above rerendered the underlying editor.
   for(const key of ['Tab','Shift+Tab'])for(let i=0;i<12;i++){await page.keyboard.press(key);assert.ok(await page.evaluate(()=>document.activeElement.closest('#final-character-sheet')!==null));}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'open-character-sheet');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('final-sheet-open')),false);
   await open.dblclick();await dialog.waitFor();assert.equal(await page.locator('dialog:modal').count(),1);assert.equal(await page.locator('#completion-dialog[open]').count(),1);
   await content.evaluate(el=>{const details=document.createElement('details');details.id='synthetic-print-disclosure';details.innerHTML='<summary>Synthetic read-only details</summary><p>Recorded source decision</p>';el.append(details);});
   await page.evaluate(()=>{window.__sheetPrints=0;window.print=()=>{window.__sheetPrints++;window.dispatchEvent(new Event('beforeprint'));window.__detailsPrinted=document.getElementById('synthetic-print-disclosure').open;window.dispatchEvent(new Event('afterprint'));};});
   await dialog.locator('.final-sheet-export summary').click();
   await dialog.getByRole('button',{name:'Print this sheet',exact:true}).click();assert.equal(await page.evaluate(()=>window.__sheetPrints),1);
   assert.equal(await page.evaluate(()=>window.__detailsPrinted),true);assert.equal(await page.locator('#synthetic-print-disclosure').getAttribute('open'),null);await page.locator('#synthetic-print-disclosure').evaluate(el=>el.remove());
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('.layout').isVisible(),false);assert.equal(await page.locator('.log-section').isVisible(),false);
   assert.equal(await content.isVisible(),true);assert.equal(await content.getByRole('heading',{name:'Results & decisions'}).isVisible(),true);
   assert.equal(await dialog.getByRole('button',{name:'Close sheet',exact:true}).isVisible(),false);
   await page.emulateMedia({media:'screen'});
   const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'Save character & log',exact:true}).click();
   const download=await downloading;assert.equal(await readFile(await download.path(),'utf8'),saved);
   await page.screenshot({path:fileURLToPath(new URL('final-sheet-'+label+'.png',out)),fullPage:true});
   const logDownloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download full log',exact:true}).click();
   const logDownload=await logDownloading;assert.equal(logDownload.suggestedFilename(),'traveller-action-log.txt');
   const logText=await readFile(await logDownload.path(),'utf8');assert.match(logText,/ACTION 1/);assert.match(logText,/Source-confirmed synthetic treatment note/);
   assert.equal(await dialog.isVisible(),true);assert.equal(await page.locator('.log-section').count(),0);
   await dialog.getByRole('button',{name:'Close sheet',exact:true}).click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'open-character-sheet');
   // A cancelled replacement cannot discard or invalidate the finished sheet.
   page.once('dialog',d=>d.dismiss());await page.locator('#new').click();await open.waitFor();
   await open.click();await dialog.waitFor();await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
   checks.push(label+' finish, notes, current history, modal keyboard, double activation, print, export and cancelled replacement');
  }catch(error){await page.screenshot({path:fileURLToPath(new URL('final-sheet-'+label+'-failure.png',out)),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
 }
 // Imported finalized saves expose the same entry point in both transports.
 for(const transport of ['static','http']){
  const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   await page.locator('#import').setInputFiles({name:'synthetic-finished.json',mimeType:'application/json',buffer:Buffer.from(raw)});
   await page.getByRole('button',{name:'Open your character sheet',exact:true}).click();await page.getByRole('dialog',{name:'Character sheet',exact:true}).waitFor();
   await page.reload();await page.getByRole('button',{name:'Open your character sheet',exact:true}).waitFor();
   assert.equal(await page.locator('dialog:modal').count(),0);assert.equal(await page.locator('#completion-dialog[open]').count(),1);assert.equal(await page.evaluate(()=>document.body.classList.contains('final-sheet-open')),false);
   checks.push(transport+' finalized import and reload');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('final-sheet-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){await writeFile(new URL('final-sheet-browser-failure.json',out),JSON.stringify({checks,errors,error:error.message,stack:error.stack},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
