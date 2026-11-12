import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {REQUIRED_HEADLINES} from '../gui/required-action.mjs';
import {headlineFixture} from './required-headline-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})}),key='traveller-character-generator.v1',errors=[];
try{
 for(const width of [1440,390])for(const transport of ['static','http']){
  for(const headline of REQUIRED_HEADLINES.starting){
   const fixture=headlineFixture('starting',headline),p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key,raw:exportSession(fixture.session)});await p.goto(`http://127.0.0.1:${server.address().port}/${transport==='http'?'?api=local':''}`);await p.locator('#crow-introduction').waitFor();await p.locator('#setup-species').selectOption('aslan');await p.locator('[name=name]').fill('Kept draft name');
   const before=await p.evaluate(k=>localStorage.getItem(k),key),begin=p.getByRole('button',{name:'Begin character',exact:true});
   for(let n=0;n<2;n++){await begin.click();assert.equal(await p.locator('.crow-speech strong').innerText(),headline);assert.equal(await p.locator('.crow-assistance:visible').count(),1);assert.equal(await p.locator('#crow-introduction').isVisible(),false);assert.equal(await p.locator('#setup-gender').getAttribute('aria-invalid'),'true');}
   const info=p.locator('.required-action-warning .crow-assistance-info');await info.click();await p.locator('#crow-introduction-dialog[open]').waitFor();assert.match(await p.locator('#crow-introduction-dialog').innerText(),/Ling Standard Products/);await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);assert.equal(await p.locator('#crow-introduction').isVisible(),false);
   await p.locator('#setup-gender').selectOption('female');assert.equal(await p.locator('#crow-introduction').isVisible(),true);assert.equal(await p.locator('.required-action-warning:visible').count(),0);assert.equal(await p.locator('.crow-assistance:visible').count(),1);assert.equal(await p.locator('[name=name]').inputValue(),'Kept draft name');assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),before);await p.close();
  }
 }
 // Trigger every approved bank through the actual production warning renderer,
 // using keys derived from real public-created sessions, not headline overrides.
 const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.locator('#setup-gender').waitFor();const raw=await p.evaluate(k=>localStorage.getItem(k),key);
 for(const [type,bank] of Object.entries(REQUIRED_HEADLINES))for(const headline of bank){
  const fixture=headlineFixture(type,headline);await p.evaluate(async({type,key})=>{const module=await import('./gui/required-action.mjs');module.showRequiredAction(document,{control:document.getElementById('setup-gender'),type,key,detail:'Choose Male or Female physical sex.'});},{type,key:fixture.key});assert.equal(await p.locator('.crow-speech strong').innerText(),headline);assert.equal(await p.locator('.required-action-warning').getAttribute('role'),'alert');assert.equal(await p.locator('.crow-assistance:visible').count(),1);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
 }
 await p.close();assert.deepEqual(errors,[]);console.log('PASS: all 48 approved headlines triggered via production renderer; all six starting headlines triggered by real invalid submissions in 24 static/HTTP desktop/mobile flows; one Crow entry, accessible history, restored intro and retained draft.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
