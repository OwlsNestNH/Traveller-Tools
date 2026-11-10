// Cancel replaces only the active draft after explicit confirmation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const key='traveller-character-generator.v1',checks=[],errors=[];
const origin=process.env.CHARACTER_CANCEL_URL||'http://127.0.0.1:'+server.address().port+'/';
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const stored=page=>page.evaluate(key=>localStorage.getItem(key),key);
const snapshot=page=>page.evaluate(()=>({storage:JSON.stringify({...localStorage}),url:location.href,history:history.length,stage:document.body.dataset.stage,fields:[...document.querySelectorAll('#workspace input,#workspace select,#sheet textarea')].map(n=>({name:n.name,id:n.id,value:n.value,checked:n.checked})),workspace:document.querySelector('#workspace').textContent}));
async function show(page){await page.locator('#cancel-character').click();await page.locator('#cancel-character-dialog').waitFor({state:'visible'});}
async function airlock(page){await show(page);await page.locator('#cancel-character-confirm').click();await ready(page);await page.locator('#setup-form').waitFor();await page.waitForFunction(()=>!document.body.classList.contains('cancel-character-open'));}
async function quietSuccess(page){
 const notice=page.locator('#message');assert.equal(await notice.textContent(),'New character started.');assert.equal(await notice.getAttribute('role'),'status');assert.equal(await notice.getAttribute('aria-live'),'polite');assert.equal(await notice.getAttribute('aria-hidden'),null);
 const style=await notice.evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {position:s.position,clip:s.clipPath,width:r.width,height:r.height,display:s.display,visibility:s.visibility};});
 assert.equal(style.position,'absolute');assert.equal(style.clip,'inset(50%)');assert.ok(style.width<=4&&style.height<=4,'Clipped live-region box does not occupy banner space');assert.notEqual(style.display,'none');assert.notEqual(style.visibility,'hidden');
}
async function visibleNotice(page){const notice=page.locator('#message');assert.equal(await notice.evaluate(n=>n.classList.contains('action-announcement')),false);const box=await notice.boundingBox();assert.ok(box&&box.width>1&&box.height>1);}
async function toolbarNew(page){page.once('dialog',dialog=>dialog.accept());await page.locator('#new').click();await ready(page);await page.locator('#setup-form').waitFor();}
async function fresh(page){await quietSuccess(page);assert.equal(await page.locator('[name=name]').inputValue(),'');assert.equal(await page.locator('[name=homeworld]').inputValue(),'');assert.equal(await page.locator('[name=species]').inputValue(),'human');assert.equal(await page.locator('#character-notes').inputValue(),'');assert.equal(await page.locator('#workspace').getAttribute('data-revision'),'0');assert.equal(await page.locator('#step-title').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('#cancel-character-dialog').isVisible(),false);const session=JSON.parse(await stored(page));assert.deepEqual(session.events,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-saved-record')),'preserve me');return session;}
try{
 for(const transport of ['static','http'])for(const width of [1440,390,320]){
  if(process.env.CHARACTER_CANCEL_URL&&transport==='http')continue;
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(origin+(transport==='http'?'?api=local':''));await page.locator('#setup-form').waitFor();await ready(page);
  await page.evaluate(()=>localStorage.setItem('unrelated-saved-record','preserve me'));
  await page.locator('[name=name]').fill('Airlock test Traveller');await page.locator('[name=homeworld]').fill('Test homeworld');
  await page.locator('#notes-connections > summary').click();await page.locator('#character-notes').fill('Unsaved notes survive dismissal');
  assert.equal(await page.locator('#setup-form > .actions #cancel-character').count(),1);
  if(width===1440){const primary=await page.locator('#setup-form button[type=submit]').boundingBox(),cancel=await page.locator('#cancel-character').boundingBox();assert.ok(Math.abs(primary.y-cancel.y)<2,'Cancel sits beside the main action');assert.ok(cancel.width<primary.width,'Cancel is visually secondary');}
  const before=await snapshot(page);
  for(const dismiss of ['escape','keep','escape']){
   await show(page);const dialog=page.locator('#cancel-character-dialog'),keep=page.locator('#cancel-character-keep'),confirm=page.locator('#cancel-character-confirm');
   assert.equal(await page.locator('#cancel-character-title').textContent(),'Are you sure? This will airlock your character.');
   assert.equal(await dialog.getAttribute('aria-labelledby'),'cancel-character-title');assert.equal(await keep.evaluate(n=>n===document.activeElement),true);
   const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=900);assert.ok(Math.abs(b.x+b.width/2-width/2)<2&&Math.abs(b.y+b.height/2-450)<2);
   assert.equal(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await page.keyboard.press('Shift+Tab');assert.equal(await confirm.evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await keep.evaluate(n=>n===document.activeElement),true);
   for(const button of [keep,confirm]){const r=await button.boundingBox();assert.ok(r.height>=44&&r.width>=44);}
   if(dismiss==='keep'&&transport==='static'){await page.screenshot({path:fileURLToPath(new URL('cancel-character-dialog-'+width+'.png',out)),fullPage:false});await page.emulateMedia({media:'print'});assert.equal(await dialog.isVisible(),false);await page.emulateMedia({media:'screen'});}
   if(dismiss==='escape')await page.keyboard.press('Escape');else await keep.click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!document.body.classList.contains('cancel-character-open'));
   assert.equal(await page.locator('#cancel-character').evaluate(n=>n===document.activeElement),true);assert.deepEqual(await snapshot(page),before);
  }
  await airlock(page);await fresh(page);await toolbarNew(page);const initial=await fresh(page);
  if(transport==='static')await page.screenshot({path:fileURLToPath(new URL('new-character-quiet-'+width+'.png',out)),fullPage:false});
  await page.locator('[name=name]').fill('Rolled Traveller');await page.getByRole('button',{name:'Begin character',exact:true}).click();await ready(page);
  assert.equal(await page.locator('.statistics-actions #cancel-character').count(),1);
  await page.locator('[data-action=roll-statistics]').click();await ready(page);await page.locator('[data-action=accept-statistics]').waitFor();
  const rolled=await stored(page);await show(page);await page.locator('#cancel-character-keep').click();await page.waitForFunction(()=>!document.body.classList.contains('cancel-character-open'));assert.equal(await stored(page),rolled);
  await page.locator('[data-action=accept-statistics]').click();await ready(page);await page.waitForFunction(()=>document.body.dataset.stage!=='statistics');
  // Later light-themed pages have the same safe exit.
  await show(page);const color=await page.locator('#cancel-character-confirm').evaluate(n=>({fg:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor}));assert.notEqual(color.fg,color.bg);
  await page.locator('#cancel-character-confirm').evaluate(n=>{n.click();n.click();});await ready(page);await page.locator('#setup-form').waitFor();await page.waitForFunction(()=>!document.body.classList.contains('cancel-character-open'));
  const reset=await fresh(page);assert.notEqual(reset.seed,initial.seed);assert.notEqual(reset.seed,JSON.parse(rolled).seed);
  await page.reload();await page.locator('#setup-form').waitFor();await ready(page);assert.equal(await stored(page),JSON.stringify(reset,null,2));assert.equal(await page.locator('[name=name]').inputValue(),'');
  // The saved file still imports after cancellation; no exported record is changed.
  await page.locator('#import').setInputFiles({name:'saved-character.json',mimeType:'application/json',buffer:Buffer.from(rolled)});await ready(page);await page.locator('body[data-stage=statistics]').waitFor();assert.equal(await stored(page),rolled);assert.match(await page.locator('#message').textContent(),/Character loaded/);await visibleNotice(page);
  await airlock(page);await fresh(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.goto('about:blank');await page.goBack();await page.locator('#setup-form').waitFor();assert.equal(await page.locator('[name=name]').inputValue(),'');
  checks.push({transport,width,dismissalPreserves:true,reset:true,toolbarReset:true,quietSuccess:true,accessibleStatus:true,reload:true,back:true,exportImport:true});await page.close();
 }
 if(!process.env.CHARACTER_CANCEL_URL){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'?api=local');await page.locator('#setup-form').waitFor();
  await page.locator('[name=name]').fill('Retained on failure');await page.getByRole('button',{name:'Begin character',exact:true}).click();await ready(page);const old=await stored(page);
  await page.route('**/api/v1',async route=>{const body=route.request().postDataJSON();if(body.operation==='create')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Synthetic create failure'}})});else await route.continue();});
  await show(page);await page.locator('#cancel-character-confirm').click();await ready(page);assert.equal(await stored(page),old);assert.match(await page.locator('#message').textContent(),/Could not start a new character/);await visibleNotice(page);assert.equal(await page.locator('body').getAttribute('data-stage'),'statistics');
  await page.unroute('**/api/v1');
  let release;const blocked=new Promise(r=>release=r);let creates=0;await page.route('**/api/v1',async route=>{if(route.request().postDataJSON().operation==='create'){creates++;await blocked;}await route.continue();});
  await show(page);await page.locator('#cancel-character-confirm').evaluate(n=>{n.click();n.click();});await page.waitForFunction(()=>document.querySelector('#cancel-character').disabled);assert.equal(await stored(page),old);release();await ready(page);await page.locator('#setup-form').waitFor();assert.equal(creates,1);await page.close();
  for(const transport of ['static','http']){
   const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+(transport==='http'?'?api=local':''));await p.locator('#setup-form').waitFor();await p.evaluate(key=>{localStorage.setItem(key,'{protected unreadable draft');localStorage.setItem('other-tool','original');},key);await p.reload();await p.locator('#recovery').waitFor();await ready(p);
   await p.locator('[name=name]').fill('Temporary active Traveller');await p.getByRole('button',{name:'Begin character',exact:true}).click();await ready(p);await airlock(p);assert.equal(await stored(p),'{protected unreadable draft');assert.equal(await p.locator('#recovery').isVisible(),true);assert.equal(await p.evaluate(()=>localStorage.getItem('other-tool')),'original');assert.equal(await p.locator('[name=name]').inputValue(),'');assert.match(await p.locator('#message').textContent(),/unreadable stored draft is preserved/);await visibleNotice(p);await p.close();
  }
  for(const transport of ['static','http'])for(const action of ['toolbar','cancel']){
   const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+(transport==='http'?'?api=local':''));await p.locator('#setup-form').waitFor();await ready(p);
   await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Synthetic storage failure','QuotaExceededError');};});
   if(action==='toolbar')await toolbarNew(p);else await airlock(p);
   assert.match(await p.locator('#message').textContent(),/This browser could not save the draft/);await visibleNotice(p);await p.close();
  }
  checks.push({failedResetAtomic:true,duplicateConfirmGuard:true,protectedRecovery:true,storageWarningsVisible:true,loadNoticeUnchanged:true});
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('cancel-character-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}

