import {contrastRatio} from './crow-contrast.mjs';
// Focused real-screen review; separate from the full release regression rollout.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {studyFixture} from './education-result-fixtures.mjs';
import {lawyerFixture} from './prisoner-lawyer-fixtures.mjs';
import {CROW_ASSISTANCE_IMAGE} from '../gui/crow-assistance.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});const errors=[],checks=[],contrast=[];
async function checkContrast(page){
 const colors=await page.locator('.required-action-warning:visible').evaluate(panel=>{const speech=panel.querySelector('.crow-speech'),heading=speech.querySelector('strong'),body=speech.querySelector('p'),info=panel.querySelector('.crow-assistance-info');return {panel:getComputedStyle(panel).backgroundColor,border:getComputedStyle(panel).borderTopColor,speech:getComputedStyle(speech).backgroundColor,heading:getComputedStyle(heading).color,body:getComputedStyle(body).color,infoText:getComputedStyle(info).color,infoBackground:getComputedStyle(info).backgroundColor};});
 const ratios={heading:contrastRatio(colors.heading,colors.speech),body:contrastRatio(colors.body,colors.speech),border:contrastRatio(colors.border,colors.panel),info:contrastRatio(colors.infoText,colors.infoBackground)};for(const key of ['heading','body','info'])assert.ok(ratios[key]>=4.5,key+' contrast '+ratios[key]);assert.ok(ratios.border>=3,'warning boundary contrast');assert.equal(colors.panel,'rgb(59, 11, 19)');contrast.push(ratios);
}

try{
 for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.locator('#crow-introduction').waitFor();
  assert.equal(await p.locator('#crow-introduction').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(10, 38, 52)');
  await p.locator('#setup-species').selectOption('aslan');
  if(CROW_ASSISTANCE_IMAGE){await p.locator('#crow-introduction .crow-assistance-image').waitFor();await p.locator('#crow-introduction .crow-assistance-image').evaluate(n=>n.tagName==='IMG'?n.decode():Promise.resolve());assert.equal(await p.locator('#crow-introduction .crow-assistance-image').evaluate(n=>n.tagName==='IMG'?n.complete&&n.naturalWidth>0:getComputedStyle(n).backgroundImage!=='none'),true);}
  await p.screenshot({path:new URL('crow-review-opening-'+width+'.png',out).pathname,fullPage:true});
  const info=p.locator('#crow-introduction').getByRole('button',{name:"About Crow's assistance"});await info.click();await p.locator('#crow-introduction-dialog[open]').waitFor();
  assert.equal(await p.locator('#crow-introduction-dialog').evaluate(n=>n.scrollTop),0);assert.equal(await p.locator('#crow-introduction-dialog').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(6, 32, 45)');assert.doesNotMatch(await p.locator('#crow-introduction-dialog').innerText(),/Flort|Wages of Sin/);
  await p.screenshot({path:new URL('crow-review-information-'+width+'.png',out).pathname,fullPage:false});if(width===390){await p.locator('#crow-introduction-dialog').evaluate(n=>n.scrollTop=n.scrollHeight);await p.screenshot({path:new URL('crow-review-information-bottom-'+width+'.png',out).pathname,fullPage:false});}await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);
  const key='traveller-character-generator.v1',before=await p.evaluate(k=>localStorage.getItem(k),key);await p.getByRole('button',{name:'Begin character',exact:true}).click();
  await p.locator('.required-action-warning').waitFor();assert.equal(await p.locator('#setup-gender').getAttribute('aria-invalid'),'true');assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),before);
  await checkContrast(p);await p.screenshot({path:new URL('crow-review-warning-'+width+'.png',out).pathname,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  for(const [name,fixture,prepare,trigger] of [
   ['professor',studyFixture(),async()=>{},'[data-action=education-skill]'],
   ['referee',lawyerFixture({cash:0}),async()=>{await p.locator('#lawyer-outcome').selectOption('hire');await p.locator('#lawyer-level').fill('0');},'[data-action=resolve-prisoner-lawyer]']
  ]){
   await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await p.reload();await p.locator(trigger).waitFor();await prepare();await p.locator(trigger).click();await p.locator('.required-action-warning:visible').waitFor();
   await checkContrast(p);const portrait=p.locator('.required-action-warning .crow-assistance-image');await portrait.evaluate(n=>n.decode());assert.match(await portrait.getAttribute('src'),new RegExp('crow-'+name+'\\.png$'));assert.equal(await p.locator('.required-action-warning .crow-speech').count(),1);await p.screenshot({path:new URL('crow-review-'+name+'-'+width+'.png',out).pathname,fullPage:true});
  }
  checks.push({width,opening:true,information:true,warning:true,professor:true,referee:true,imageMaterialized:!!CROW_ASSISTANCE_IMAGE});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('crow-review-status.json',out),JSON.stringify({draft:true,imageMaterialized:!!CROW_ASSISTANCE_IMAGE,checks,errors,contrast},null,2));
 await writeFile(new URL('crow-review-README.txt',out),'DRAFT SCREEN REVIEW — unpublished candidate.\n'+(CROW_ASSISTANCE_IMAGE?'The authorized Crow pet sprite is included.':'INCOMPLETE: Actual Crow pet image is not materialized; download blocked by environment network policy. No replacement image is used.')+'\nDesktop 1440px and mobile 390px: technician opening, approved information panel (mobile top/bottom), warning bubble, professor skills warning and referee warning.\n');
 console.log(JSON.stringify({checks,errors,contrast}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
