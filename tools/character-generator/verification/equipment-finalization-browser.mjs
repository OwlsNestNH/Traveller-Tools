import {assertRequiredWarning} from './required-action-browser-assertions.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {linkedFixture,awardedEquipmentFixture,artefactFinalizationFixture} from './equipment-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})}),errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});const key='traveller-character-generator.v1';
try{
 for(const width of [1280,320])for(const transport of ['','?api=local']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.locator('#import').setInputFiles({name:'generic-weapon.json',mimeType:'application/json',buffer:Buffer.from(exportSession(awardedEquipmentFixture().session))});
  await page.getByRole('heading',{name:'What you take with you',exact:true}).waitFor();assert.equal(await page.locator('dialog:modal').count(),0);assert.equal(await page.locator('#equipment-dialog').count(),0);assert.equal(await page.locator('#army-career-dialog').evaluate(n=>n.open&&!n.matches(':modal')),true);assert.match(await page.locator('#sheet').innerText(),/Weapon.*award-1/);assert.equal(await page.locator('#benefit-item-name').count(),0);
  await page.locator('#import').setInputFiles({name:'linked-weapon.json',mimeType:'application/json',buffer:Buffer.from(exportSession(linkedFixture().session))});await page.getByRole('heading',{name:'Choose your next career',exact:true}).waitFor();
  await page.getByRole('button',{name:'Finish character',exact:true}).click();await page.getByRole('heading',{name:'Assets & benefits',exact:true}).waitFor();
  const first=page.locator('[data-action="choose-deferred-equipment"][data-id="equipment-1"]');await first.click();const dialog=page.locator('#equipment-dialog');await dialog.waitFor({state:'visible'});assert.equal(await dialog.getAttribute('aria-labelledby'),'equipment-dialog-title');
  await page.locator('#benefit-item-id').selectOption('core.rifle');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await first.evaluate(e=>e===document.activeElement),true);assert.equal(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state.character.assets,undefined);
  await first.click();await page.locator('#benefit-item-id').selectOption('core.rifle');await page.locator('#book-confirm').check();await page.getByRole('button',{name:'Record outcome and continue'}).click();await assertRequiredWarning(page,'#book-note',/equipment source decision/);assert.equal(await dialog.isVisible(),true);assert.equal(await page.locator('#benefit-item-id').inputValue(),'core.rifle');
  await page.locator('#book-note').fill('Verified Core p. 126 Rifle and award limits.');await page.locator('#book-confirm').check();
  const controls=dialog.locator('button,input,select,textarea').filter({visible:true});await dialog.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await dialog.locator(':focus').count(),1);
  await page.screenshot({path:new URL('equipment-popup-'+width+'-'+(transport?'http':'static')+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  await page.getByRole('button',{name:'Record outcome and continue'}).evaluate(e=>{e.click();e.click();});await dialog.waitFor({state:'detached'});assert.equal(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state.character.assets.length,1);
  await page.locator('[data-action="choose-deferred-equipment"][data-id="equipment-2"]').click();await dialog.waitFor({state:'visible'});assert.match(await dialog.innerText(),/Gun Combat/);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('#cancel-character-dialog').isVisible(),false);await page.reload();await page.getByRole('heading',{name:'Assets & benefits',exact:true}).waitFor();
  const saved=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));assert.equal(project(saved).state.character.deferredEquipment[1].status,'pending');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.emulateMedia({media:'print'});assert.match(await page.locator('#sheet').innerText(),/Rifle/);await page.emulateMedia({media:'screen'});
  await page.locator('#import').setInputFiles({name:'artefact.json',mimeType:'application/json',buffer:Buffer.from(exportSession(artefactFinalizationFixture().session))});await page.getByRole('heading',{name:'Choose your next career',exact:true}).waitFor();await page.getByRole('button',{name:'Finish character',exact:true}).click();await page.locator('[data-action="choose-deferred-equipment"][data-id="equipment-1"]').click();await page.locator('#artefact-name').waitFor();await page.locator('#artefact-description').fill('<Unidentified> metal object');await page.getByRole('button',{name:'Save details',exact:true}).click();await page.locator('#equipment-dialog').waitFor({state:'detached'});assert.match(await page.locator('#sheet').innerText(),/<Unidentified> metal object/);await page.getByRole('button',{name:'Finish character',exact:true}).click();await page.getByRole('heading',{name:'Your Traveller is ready to review',exact:true}).waitFor();
  checks.push({width,transport:transport?'http':'static',result:'pass'});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('equipment-finalization-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
