import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession} from '../engine/session.mjs';

// Independent review regressions. Uses only fresh temporary browser contexts.
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1';
const server=createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const checks=[],pageErrors=[];
const origin='http://127.0.0.1:'+server.address().port;
function savedCharacter(name='Imported Traveller') {
 return exportSession(execute(createSession('review-import-'+name),{type:'setup',payload:{name,species:'human'}}).session);
}
async function fresh(run,{transport='http'}={}) {
 const context=await browser.newContext({viewport:{width:1100,height:850}});
 const page=await context.newPage();page.setDefaultTimeout(7000);
 page.on('pageerror',error=>pageErrors.push(error.message));
 try {await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await run(page);}
 finally {await context.close();}
}
async function check(name,run,options) {
 try {await fresh(run,options);checks.push({name,pass:true});}
 catch(error){checks.push({name,pass:false,error:error.message});}
}
async function begin(page,name='Review Traveller') {
 await page.locator('[name=name]').fill(name);
 await page.getByRole('button',{name:'Begin character',exact:true}).click();
 await page.getByRole('button',{name:'Roll six characteristics',exact:true}).waitFor();
}
async function stored(page) {return page.evaluate(key=>localStorage.getItem(key),key);}
async function importFile(page,contents,name='review.json') {
 await page.locator('#import').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(contents)});
}
try {
 browser=await chromium.launch({headless:true,channel:process.env.CHARACTER_BROWSER_CHANNEL||'msedge'});
 await check('invalid import preserves live character, saved bytes and action log',async page=>{
  await begin(page);const before=await stored(page),count=await page.locator('#action-log li').count();
  await importFile(page,'{"format":"invalid"}');
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Could not load'));
  assert.equal(await stored(page),before);assert.equal(await page.locator('#action-log li').count(),count);
  assert.equal(await page.locator('#sheet h2').textContent(),'Review Traveller');
 });
 await check('cancelled valid import preserves character and re-enables controls',async page=>{
  await begin(page);const before=await stored(page);page.once('dialog',dialog=>dialog.dismiss());
  await importFile(page,savedCharacter());
  await page.waitForFunction(()=>!document.querySelector('#import').disabled);
  assert.equal(await stored(page),before);assert.equal(await page.locator('#sheet h2').textContent(),'Review Traveller');
 });
 await check('unreadable stored draft survives new edits and can be downloaded intact',async page=>{
  const raw='{"format":"unknown-old-format","important":"original data"}';
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();
  await page.locator('#recovery-save').waitFor();await begin(page,'Recovery candidate');
  assert.equal(await stored(page),raw);
  const downloadPromise=page.waitForEvent('download');await page.locator('#recovery-save').click();
  const download=await downloadPromise;assert.equal(await readFile(await download.path(),'utf8'),raw);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#recovery-replace').click();
  assert.equal(await stored(page),raw);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#recovery-replace').click();
  assert.equal(JSON.parse(await stored(page)).events.at(-1).command.payload.name,'Recovery candidate');
  assert.equal(await page.locator('#recovery').isVisible(),false);
 });
 await check('same-stage keyboard action retains meaningful focus',async page=>{
  await begin(page);await page.getByRole('button',{name:'Roll six characteristics',exact:true}).focus();
  await page.keyboard.press('Enter');await page.getByRole('button',{name:'Keep these characteristics'}).waitFor();
  assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  assert.equal(await page.evaluate(()=>document.activeElement.closest('#workspace')!==null),true);
 });
 await check('in-flight command blocks New and Load without losing its audit record',async page=>{
  await begin(page);
  let release,started;const gate=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>started=resolve);
  const operations=[];
  await page.route('**/api/v1',async route=>{
   const request=route.request().postDataJSON();operations.push(request.operation);
   if(request.operation==='command'&&request.command.type==='notes'){started();await gate;}
   await route.continue();
  });
  await page.locator('summary').filter({hasText:'Notes & connections'}).click();
  await page.locator('#character-notes').fill('Retain this pending action');
  await page.getByRole('button',{name:'Save notes',exact:true}).click();await pending;
  try {
   assert.equal(await page.locator('#new').isDisabled(),true);assert.equal(await page.locator('#import').isDisabled(),true);
   await page.evaluate(()=>document.querySelector('#new').onclick());
   await importFile(page,savedCharacter('Should not replace'));
   assert.deepEqual(operations,['command']);
  } finally {release();}
  await page.waitForFunction(()=>!document.querySelector('#new').disabled);
  assert.equal(await page.locator('#sheet h2').textContent(),'Review Traveller');
  const record=JSON.parse(await stored(page));assert.equal(record.events.at(-1).command.type,'notes');
  assert.equal(record.events.at(-1).command.payload.text,'Retain this pending action');
 });
 await check('Aslan family choices include both son paths and retain selected value',async page=>{
  await page.locator('[name=species]').selectOption('aslan');await page.locator('[name=gender]').selectOption('male');
  await begin(page);await page.getByRole('button',{name:'Roll six characteristics',exact:true}).click();
  await page.getByRole('button',{name:'Keep these characteristics'}).click();await page.locator('#birth-order').waitFor();
  assert.deepEqual(await page.locator('#birth-order option').evaluateAll(nodes=>nodes.map(node=>node.value)),['','first-son','second-son','daughter']);
  await page.locator('#birth-order').selectOption('second-son');await page.locator('#book-confirm').check();
  await page.getByRole('button',{name:'Record outcome and continue'}).click();
  await page.getByRole('heading',{name:'Choose background skills'}).waitFor();
  assert.equal(JSON.parse(await stored(page)).events.at(-1).command.payload.birthOrder,'second-son');
 });
 await check('failed setup configuration stops before later setup actions',async page=>{
  const commands=[];
  await page.route('**/api/v1',async route=>{
   const request=route.request().postDataJSON();
   if(request.operation==='command')commands.push(request.command.type);
   if(request.command?.type==='configure')await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Injected configuration failure'}})});
   else await route.continue();
  });
  await page.locator('[name=name]').fill('Keep my input');await page.locator('[name=boons]').selectOption('6');
  await page.getByRole('button',{name:'Begin character',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Injected configuration failure'));
  assert.deepEqual(commands,['configure']);assert.equal(await page.locator('[name=name]').inputValue(),'Keep my input');
  assert.equal(await page.locator('[name=boons]').inputValue(),'6');assert.equal(await stored(page),null);
 });
 await check('failed New request retains current draft',async page=>{
  await begin(page);const before=await stored(page);page.once('dialog',dialog=>dialog.accept());
  await page.route('**/api/v1',route=>{
   const request=route.request().postDataJSON();
   return request.operation==='create'?route.fulfill({status:503,contentType:'text/plain',body:'Temporary test outage'}):route.continue();
  });
  await page.locator('#new').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Could not start a new character'));
  assert.equal(await stored(page),before);assert.equal(await page.locator('#sheet h2').textContent(),'Review Traveller');
  assert.equal(await page.locator('#new').isDisabled(),false);
 });
 await check('storage write failures remain visible after New and Import',async page=>{
  await begin(page);
  await page.evaluate(()=>Object.defineProperty(Storage.prototype,'setItem',{configurable:true,value(){throw new DOMException('test quota','QuotaExceededError');}}));
  page.on('dialog',dialog=>dialog.accept());await page.locator('#new').click();
  await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  assert.match(await page.locator('#message').textContent(),/could not save/);
  await importFile(page,savedCharacter());
  await page.waitForFunction(()=>document.querySelector('#sheet h2').textContent==='Imported Traveller');
  assert.match(await page.locator('#message').textContent(),/could not save/);
 });
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({checks,pageErrors},null,2));
 assert.ok(checks.every(check=>check.pass),'Independent browser regression failures: '+checks.filter(check=>!check.pass).map(check=>check.name).join('; '));
} finally {
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
