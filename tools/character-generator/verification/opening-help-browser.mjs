// Opening help stays presentation-only for both static and HTTP transports.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {project} from '../engine/session.mjs';
import {OPENING_HELP} from '../gui/opening-help.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const errors=[],checks=[];
const snapshot=page=>page.evaluate(()=>({raw:localStorage.getItem('traveller-character-generator.v1'),revision:document.querySelector('#workspace').dataset.revision,data:[...new FormData(document.querySelector('#setup-form'))]}));
const screenshot=(page,name)=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});
try{
 for(const transport of ['static','http'])for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1100}});page.on('pageerror',e=>errors.push(e.message));let apiRequests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/v1')apiRequests++;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+(transport==='http'?'?api=local':''));await page.locator('#setup-form').waitFor();
  for(const species of ['human','aslan','vargr','aezorgh','vargr']){
   await page.locator('[name=species]').selectOption(species);
   assert.equal(await page.locator('#setup-gender').inputValue(),'','Species changes must not assign physical sex');
   assert.deepEqual(await page.locator('#setup-gender option:not(:disabled)').allTextContents(),['Female','Male']);
   assert.equal(await page.locator('label[for=setup-gender]').innerText(),'Physical sex');
   assert.equal(await page.locator('#culture-choice').isVisible(),['aslan','vargr'].includes(species));
   assert.equal(await page.locator('[name=culture]').isEnabled(),['aslan','vargr'].includes(species));
   assert.equal(await page.locator('#variant-choice').isVisible(),species==='vargr');
   assert.equal(await page.locator('[name=variant]').isEnabled(),species==='vargr');
  }
  await page.locator('[name=name]').fill('Opening help regression');await page.locator('[name=homeworld]').fill('Test homeworld');await page.locator('[name=gender]').selectOption('female');await page.locator('[name=culture]').selectOption('imperial');
  await page.locator('#setup-gm-controls').evaluate(el=>el.open=true);await page.locator('#setup-gm-settings').evaluate(el=>el.open=true);await page.locator('[name=boons]').selectOption('2');
  const before=await snapshot(page);
  for(const id of ['species','upbringing','strain','gender','generation','extras','academy','logs']){
   if(['generation','extras','academy'].includes(id))await page.locator('#setup-gm-controls').evaluate(el=>el.open=true);
   if(id==='generation')await page.locator('#setup-gm-settings').evaluate(n=>n.open=true);
   if(id==='extras')await page.locator('#setup-optional-settings').evaluate(n=>n.open=true);
   if(id==='academy')await page.locator('#setup-house-rules').evaluate(n=>n.open=true);
   const trigger=page.locator('[data-opening-help="'+id+'"]');
   if(['species','upbringing','strain','gender','generation'].includes(id)){
    const layout=await trigger.evaluate(n=>{const label=n.nextElementSibling,b=n.getBoundingClientRect(),l=label.getBoundingClientRect(),field=n.closest('.opening-info-field'),control=field.querySelector('select');return {button:{left:b.left,right:b.right,width:b.width,height:b.height},label:{left:l.left},associated:label.control===control,height:field.getBoundingClientRect().height,controlHeight:control.getBoundingClientRect().height};});
    assert.ok(layout.button.right<=layout.label.left, id+' icon leads its label');assert.ok(layout.button.width>=44&&layout.button.height>=44,id+' has a 44px target');assert.equal(layout.associated,true,id+' retains a programmatic label');
    if(width===1440)assert.ok(layout.height<=Math.max(layout.controlHeight,46)+1,id+' stays in one compact row');
   }
   await trigger.focus();await trigger.press('Enter');assert.equal(await page.locator('#opening-help-dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#opening-help-title').evaluate(n=>n===document.activeElement),true);
   assert.equal(await page.locator('#opening-help-title').innerText(),OPENING_HELP[id].title);assert.deepEqual(await page.locator('#opening-help-copy p').allTextContents(),OPENING_HELP[id].paragraphs);assert.equal(await page.locator('#opening-help-copy .crow-speaking-panel img').count(),1);await page.locator('#opening-help-copy img').evaluate(n=>n.decode());await page.locator('#opening-help-dialog').evaluate(n=>n.scrollTop=n.scrollHeight);const closeBox=await page.locator('[data-opening-help-close]').boundingBox();assert.ok(closeBox.y>=0&&closeBox.y+closeBox.height<=1100&&closeBox.x>=0&&closeBox.x+closeBox.width<=width,'Close stays visible after scrolling help');assert.equal(await page.locator('#opening-help-dialog').evaluate(n=>n.scrollWidth>n.clientWidth+1),false,'Help does not clip its content horizontally');await page.locator('#opening-help-dialog').evaluate(n=>n.scrollTop=0);assert.equal(await page.locator('#opening-help-source').innerText(),OPENING_HELP[id].source);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.keyboard.press('Tab');assert.equal(await page.locator('[data-opening-help-close]').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('[data-opening-help-close]').evaluate(n=>n===document.activeElement),true);
   if(transport==='static'&&width===1440&&id==='strain')await screenshot(page,'opening-informationals-strain-dialog');
   if(transport==='static'&&width===390&&id==='generation')await screenshot(page,'opening-informationals-mobile-dialog');
   await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
   await trigger.press('Space');await page.locator('[data-opening-help-close]').click();assert.equal(await page.locator('#opening-help-dialog').evaluate(d=>d.open),false);assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
   assert.deepEqual(await snapshot(page),before,id+' does not mutate a form or character');
  }
  assert.equal(await page.locator('#setup-form>.form-grid small,.gm-boons small,.gm-boons h3').count(),0,'Moved helper copy and duplicate Boon heading no longer use vertical space');
  await page.locator('#setup-gm-controls').evaluate(el=>el.open=true);await page.locator('#setup-gm-settings').evaluate(n=>n.open=true);assert.equal(await page.locator('#setup-gm-settings [name=boons]').count(),1);
  await page.evaluate(()=>scrollTo(0,0));if(transport==='static'&&[1440,390].includes(width))await screenshot(page,'opening-informationals-gm-'+width);
  await page.locator('#setup-gm-controls').evaluate(n=>n.open=false);await page.locator('#opening-portrait img').evaluate(img=>img.decode());await page.evaluate(()=>scrollTo(0,0));
  if(transport==='static'){await screenshot(page,'opening-informationals-'+width);if(width===390)await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('opening-informationals-mobile-form.png',out))});}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage="statistics"]').waitFor();
  const saved=await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1'));const state=project(JSON.parse(saved)).state;
  assert.equal(state.character.name,'Opening help regression');assert.equal(state.character.homeworld,'Test homeworld');assert.equal(state.character.species,'vargr');assert.equal(state.character.culture,'imperial');assert.equal(state.character.gender,'female');assert.equal(state.config.boons,2);
  await page.reload();await page.locator('body[data-stage="statistics"]').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),saved);
  assert.equal(apiRequests>0,transport==='http','HTTP runs must exercise the API transport');checks.push({transport,width,apiRequests,dialogs:8,keyboard:true,noMutation:true,leadingIcons:true,saveReload:true});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('opening-informationals-results.json',out),JSON.stringify({checks,errors},null,2));
 console.log('Eight opening dialogs passed with static/HTTP transport at 1440/768/390/320: leading 44px icons, compact rows, source copy, keyboard, dismissal, focus restoration, unchanged form/save and setup/reload continuity.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
