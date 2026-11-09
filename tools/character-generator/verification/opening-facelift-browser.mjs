import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
await mkdir(new URL('./artifacts/',import.meta.url),{recursive:true});const errors=[];
try{for(const width of [1440,768,390,320]){
const page=await browser.newPage({viewport:{width,height:1100}});page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#setup-form').waitFor();
assert.equal(await page.locator('#setup-gm-settings').getAttribute('open'),'');
assert.equal(await page.locator('[name=allocation]').isChecked(),true);assert.equal(await page.locator('[name=minimumReroll]').isChecked(),true);
assert.deepEqual(await page.locator('#setup-gm-controls>details>summary').allTextContents(),['GM Settings',(await page.locator('#setup-optional-settings>summary').textContent()),'House Rules']);
assert.equal(await page.locator('[name=extras]').count(),6);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
const boxes=await page.locator('.toolbar>*').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height}}));assert.ok(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))<2);assert.ok(Math.max(...boxes.map(b=>b.height))-Math.min(...boxes.map(b=>b.height))<2);
await page.screenshot({path:new URL('./artifacts/opening-'+width+'.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
await page.locator('#setup-optional-settings>summary').click();await page.locator('[name=extras][value=LCK]').check();await page.locator('[name=gm]').check();await page.locator('#setup-house-rules>summary').click();await page.locator('[name=academyServiceSkill]').check();
await page.locator('[name=name]').fill('Opening regression');await page.locator('#setup-form button[type=submit]').click();await page.getByRole('heading',{name:'Roll your characteristics',exact:true}).waitFor();assert.equal(await page.locator('body').getAttribute('data-stage'),'statistics');await page.close();
}assert.deepEqual(errors,[]);console.log('Opening layout checks passed');}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
