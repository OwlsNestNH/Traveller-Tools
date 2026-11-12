// Focused real-screen review; separate from the full release regression rollout.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {CROW_ASSISTANCE_IMAGE} from '../gui/crow-assistance.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});const errors=[],checks=[];
try{
 for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.locator('#crow-introduction').waitFor();
  await p.locator('#setup-species').selectOption('aslan');
  if(CROW_ASSISTANCE_IMAGE){await p.locator('#crow-introduction .crow-assistance-image').waitFor();assert.equal(await p.locator('#crow-introduction .crow-assistance-image').evaluate(n=>getComputedStyle(n).backgroundImage!=='none'),true);}
  await p.screenshot({path:new URL('crow-review-opening-'+width+'.png',out).pathname,fullPage:true});
  const info=p.locator('#crow-introduction').getByRole('button',{name:"About Crow's assistance"});await info.click();await p.locator('#crow-introduction-dialog[open]').waitFor();
  assert.equal(await p.locator('#crow-introduction-dialog').evaluate(n=>n.scrollTop),0);assert.doesNotMatch(await p.locator('#crow-introduction-dialog').innerText(),/Flort|Wages of Sin/);
  await p.screenshot({path:new URL('crow-review-information-'+width+'.png',out).pathname,fullPage:false});await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);
  const key='traveller-character-generator.v1',before=await p.evaluate(k=>localStorage.getItem(k),key);await p.getByRole('button',{name:'Begin character',exact:true}).click();
  await p.locator('.required-action-warning').waitFor();assert.equal(await p.locator('#setup-gender').getAttribute('aria-invalid'),'true');assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),before);
  await p.screenshot({path:new URL('crow-review-warning-'+width+'.png',out).pathname,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  checks.push({width,opening:true,information:true,warning:true,imageMaterialized:!!CROW_ASSISTANCE_IMAGE});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('crow-review-status.json',out),JSON.stringify({draft:true,imageMaterialized:!!CROW_ASSISTANCE_IMAGE,checks,errors},null,2));
 await writeFile(new URL('crow-review-README.txt',out),'DRAFT SCREEN REVIEW — unpublished candidate.\n'+(CROW_ASSISTANCE_IMAGE?'The authorized Crow pet sprite is included.':'INCOMPLETE: Actual Crow pet image is not materialized; download blocked by environment network policy. No replacement image is used.')+'\nDesktop 1440px and mobile 390px: opening page, approved information panel, required-action warning.\n');
 console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
