import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {optionalBenefitFixture} from './optional-benefit-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,checks=[],errors=[];let browser;
async function loaded(page){await page.waitForFunction(()=>document.querySelector('#new')&&!document.querySelector('#new').disabled);}
async function saved(page){return project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const width of [1440,320])for(const http of [false,true])for(const vargr of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   const fixture=optionalBenefitFixture(vargr),credit=fixture.state.benefitCreditOptions[0].id;
   await page.goto(origin+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('[name=benefit-credit]').waitFor();
   assert.equal(await page.locator('[name=benefit-credit]').isChecked(),false);assert.equal(await page.locator('[name=benefit-credit]').locator('..').innerText(),fixture.state.benefitCreditOptions[0].label);
   await page.locator('[data-action=cash-benefit]').click();const held=run(fixture,'benefit',{cash:true,creditIds:[],lifeBonusIds:[]});
   await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).events.length===revision,{key,revision:held.revision});await loaded(page);
   assert.deepEqual((await saved(page)).state,held.state);assert.equal(held.state.character.benefitCredits[0].status,'available');
   await page.reload();await page.locator('[name=benefit-credit]').waitFor();await page.locator('[name=benefit-credit]').check();
   const name='optional-benefit-'+(vargr?'vargr':'core')+'-'+width+'-'+(http?'http':'static');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('#workspace').screenshot({path:new URL(name+'-selected.png',out).pathname});
   await page.locator('[data-action=cash-benefit]').click();const used=run(held,'benefit',{cash:true,creditIds:[credit],lifeBonusIds:[]});
   await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).events.length===revision,{key,revision:used.revision});await loaded(page);
   assert.deepEqual((await saved(page)).state,used.state);assert.equal(used.state.character.benefitCredits[0].status,'consumed');assert.equal(await page.locator('[name=benefit-credit]').count(),0);
   await page.reload();await loaded(page);assert.deepEqual((await saved(page)).state,used.state);checks.push({name,passed:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('optional-benefit-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
