import {liveRecordText} from './journey-browser-helpers.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {equipmentFixture} from './equipment-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})}),errors=[];
try{
 for(const width of [1280,320])for(const transport of ['','?api=local']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.evaluate(raw=>localStorage.setItem('traveller-character-generator.v1',raw),exportSession(equipmentFixture().session));await page.reload();
  await page.locator('#benefit-item-id').selectOption('core.autopistol');assert.equal(await page.locator('#benefit-item-name').inputValue(),'Autopistol');assert.equal(await page.locator('#benefit-item-cost').inputValue(),'200');
  await page.locator('#book-confirm').check();await page.locator('#benefit-item-id').selectOption('');assert.equal(await page.locator('#book-confirm').isChecked(),false);assert.equal(await page.locator('#benefit-item-name').getAttribute('readonly'),null);
  await page.locator('#benefit-item-id').selectOption('core.rifle');await page.locator('#book-note').fill('Selected source-backed Rifle.');await page.locator('#book-confirm').check();await page.getByRole('button',{name:'Record outcome and continue'}).click();
  await page.getByRole('heading',{name:'Assets & benefits',exact:true}).waitFor();const sheet=await liveRecordText(page);assert.match(sheet,/Rifle/);assert.match(sheet,/126/);assert.match(sheet,/Gun Combat \(slug\)/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.reload();await page.getByRole('heading',{name:'Assets & benefits',exact:true}).waitFor();assert.match(await liveRecordText(page),/Rifle/);
  await context.close();console.log('PASS equipment picker '+width+' '+(transport||'static'));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
