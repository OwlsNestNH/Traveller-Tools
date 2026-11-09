// Run in browser CI only; local Chromium is not required for engine verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {wagerFixture} from './benefit-wager-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const apiMode of [false,true])for(const width of [320,1440])for(const career of ['core.merchant','core.rogue','aslan.manager'])for(const decline of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   const fixture=wagerFixture({career,terms:decline?0:1});await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();
   await page.getByRole('button',{name:'Decline wager',exact:true}).waitFor();assert.match(await page.locator('#workspace').innerText(),/Unfinished-term and future rank/);await page.reload();
   if(decline){assert.equal(await page.locator('#wager-stake').count(),0);await page.getByRole('button',{name:'Decline wager',exact:true}).click();}
   else{await page.locator('#wager-stake').fill('1');await page.locator('#wager-skill').selectOption(career==='core.rogue'?'Gambler':'Broker');await page.getByRole('button',{name:'Roll benefit wager',exact:true}).click();}
   await page.waitForFunction(()=>!document.querySelector('#new').disabled&&!document.querySelector('[data-action=resolve-benefit-wager]'));
   const before=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));assert.equal(before.state.character.benefitWagers.length,1);assert.equal(before.state.character.benefitWagers[0].status,decline?'declined':'completed');assert.equal(before.state.stage,'advancement');
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))),before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name='benefit-wager-'+career+'-'+width+(apiMode?'-http':'-static')+(decline?'-decline':'-roll');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('benefit-wagers-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
