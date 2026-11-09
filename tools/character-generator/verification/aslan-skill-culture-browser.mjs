import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {aslanSetup,aslanEvent,force,settle} from './aslan-officer-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
let fixture=settle(force(aslanSetup('culture-training'),'career',{id:'aslan.military',assignment:'warrior'},[6,6]));if(fixture.state.stage!=='training')fixture=settle(force(settle(aslanEvent(fixture,8)),'advancement',{},[6,6]));
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[];
try{for(const api of [false,true])for(const width of [320,1440]){const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto('http://127.0.0.1:'+server.address().port+(api?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('.training-info-trigger').first().waitFor();const before=await page.evaluate(key=>localStorage.getItem(key),key);
 const triggers=page.locator('.training-info-trigger');for(let i=0;i<await triggers.count();i++){await triggers.nth(i).focus();await triggers.nth(i).press('Enter');const popup=page.locator('.training-information:popover-open');await popup.waitFor();assert.deepEqual(await popup.locator('li').allTextContents(),fixture.state.trainingOptions[i].information.entries);assert.match(await popup.locator('.training-culture-legend').innerText(),/may be learned by other genders/);assert.equal(await popup.getAttribute('role'),'dialog');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.keyboard.press('Escape');}
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);console.log('PASS Aslan cultural table labels '+(api?'HTTP':'static')+' '+width);
 }finally{await context.close();}}assert.deepEqual(errors,[]);}finally{await browser.close();await new Promise(r=>server.close(r));}
