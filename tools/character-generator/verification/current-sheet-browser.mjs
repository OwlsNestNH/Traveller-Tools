import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
import {educationReady} from './education-result-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const checks=[],errors=[];
try{
 for(const width of [1440,390,320])for(const transport of ['static','http'])for(const [name,fixture] of [['aslan',buildAslanOriginFixture({stage:'precareer'})],['career',finalSheetFixture({finish:false})],['university',educationReady()]]){
  const raw=exportSession(fixture.session),context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),label=transport+'-'+width+'-'+name;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));
   const sidebar=page.locator('[data-action="open-current-character-sheet"]');await sidebar.waitFor();const popup=page.locator('[data-action="open-current-character-sheet-popup"]');const opener=await popup.isVisible()?popup:sidebar;
   const before=await page.evaluate(key=>localStorage.getItem(key),key);
   const stage=await page.locator('#step-title').textContent();await opener.click();
   const dialog=page.locator('#final-character-sheet');await dialog.waitFor();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'final-sheet-title');
   assert.match(await dialog.textContent(),/Current results/);assert.match(await dialog.textContent(),/Results & decisions/);
   if(name==='aslan'){assert.match(await dialog.textContent(),/Before Term 1/);assert.match(await dialog.textContent(),/RITE/);}
   else assert.match(await dialog.textContent(),/Term 1/);
   assert.equal(await dialog.locator('#final-sheet-content input, #final-sheet-content button, #final-sheet-content select, #final-sheet-content textarea').count(),0);
   assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
   assert.equal(await dialog.locator('.final-sheet-export').getAttribute('open'),null);
   await dialog.getByRole('link',{name:'History',exact:true}).click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'traveller-sheet-history');
   assert.ok(await dialog.locator('.traveller-sheet-history').evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog').getBoundingClientRect();return r.top>=d.top&&r.top<d.bottom;}));
   const termGroups=dialog.locator('.traveller-sheet-term');assert.ok(await termGroups.count()>0);assert.equal(await termGroups.evaluateAll(ns=>ns.every(n=>!n.open)),true);
   const firstGroup=termGroups.first(),firstSummary=firstGroup.locator('summary');await firstSummary.focus();await page.keyboard.press('Enter');assert.equal(await firstGroup.evaluate(n=>n.open),true);assert.equal(await firstGroup.locator('.traveller-sheet-timeline').isVisible(),true);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
   await dialog.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'-history-expanded.png',out))});
   await page.keyboard.press('Space');assert.equal(await firstGroup.evaluate(n=>n.open),false);
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await termGroups.evaluateAll(ns=>ns.every(n=>n.open)),true);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await termGroups.evaluateAll(ns=>ns.every(n=>!n.open)),true);
   await dialog.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'-history.png',out))});
   await dialog.getByRole('link',{name:'Current',exact:true}).click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'traveller-sheet-current');
   await dialog.locator('.final-sheet-export summary').click();
   assert.ok(await dialog.locator('[data-final-save]').isVisible());
   await dialog.locator('.final-sheet-export summary').click();
   if(name==='university'){
    const provenance=dialog.locator('.traveller-sheet-acquired').filter({hasText:'University skill'}).first();
    assert.match(await provenance.textContent(),/University skill · Term 1 · (Gained )?Level\//);
    await provenance.scrollIntoViewIfNeeded();
    await dialog.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'-skills.png',out))});
   }
   await dialog.evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'.png',out)),fullPage:true});
   await dialog.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'-dialog.png',out))});
   for(const key of ['Tab','Shift+Tab'])for(let i=0;i<8;i++){await page.keyboard.press(key);assert.ok(await page.evaluate(()=>document.activeElement.closest('#final-character-sheet')!==null));}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.ok(['open-current-character-sheet','open-current-character-sheet-popup'].includes(await page.evaluate(()=>document.activeElement.dataset.action)));
   assert.equal(await page.locator('#step-title').textContent(),stage);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
   // Activate the opener twice, not the Close button that can occupy its old coordinates.
   await opener.evaluate(el=>{el.click();el.click();});await dialog.waitFor();await dialog.getByRole('button',{name:'Close sheet',exact:true}).click();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
   await page.reload();await opener.waitFor();assert.equal(await dialog.isVisible(),false);
   checks.push(label+' current data, chronology, modal focus, read-only, repeat, close, reload');
  }catch(error){await page.screenshot({path:fileURLToPath(new URL('current-sheet-'+label+'-failure.png',out)),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await writeFile(new URL('current-sheet-results.json',out),JSON.stringify({checks,errors},null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
