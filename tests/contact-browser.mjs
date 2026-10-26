import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.CONTACT_ROOT||'http://127.0.0.1:8780/',baseline=process.env.CONTACT_BASELINE,out=process.env.CONTACT_ARTIFACTS||'/tmp/contact-evidence';
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true}),results=[];
try{for(const width of [1876,1440,1100,390,320])for(const tool of ['ship-combat-alpha','trade-route-calculator']){
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<500});const page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(root).origin?r.continue():r.abort());
 await page.goto(root+'tools/'+tool+'/');const button=page.locator('[data-contact-open]');await button.waitFor();await page.waitForTimeout(300);
 if(tool==='ship-combat-alpha'){const a=await button.boundingBox();for(const selector of ['body>header .back','body>header h1','body>header .eyebrow']){const b=await page.locator(selector).boundingBox();assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Contact button must not overlap '+selector);}}
 const before=await page.evaluate(()=>({storage:{...localStorage},map:document.querySelector('#map')?.getBoundingClientRect().toJSON(),scroll:scrollY}));
 if(tool==='ship-combat-alpha'&&baseline){const other=await context.newPage();await other.goto(baseline+'tools/'+tool+'/');await other.locator('.ship-node').first().waitFor();const box=await other.locator('#map').boundingBox();assert.deepEqual({x:before.map.x,y:before.map.y,width:before.map.width,height:before.map.height},box);await other.close();}
 await button.focus();await page.keyboard.press('Enter');const dialog=page.locator('#contact-me-dialog');await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('#contact-me-note').innerText(),'Feel free to send any Bug Notes, Questions, or Feedback. Thanks!');assert.equal(await dialog.locator('a').getAttribute('href'),'mailto:bows_cosmic.7e@icloud.com');assert.equal(await dialog.locator('a').innerText(),'bows_cosmic.7e@icloud.com');
 assert.equal(await dialog.locator('[data-contact-close]').evaluate(e=>e===document.activeElement),true);
 for(let i=0;i<4;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}
 const bounds=await dialog.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height<=976);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:out+'/'+tool+'-'+width+'.png'});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await button.evaluate(e=>e===document.activeElement),true);
 await button.click();await dialog.locator('[data-contact-close]').click();assert.equal(await dialog.isVisible(),false);assert.equal(await button.evaluate(e=>e===document.activeElement),true);
 const after=await page.evaluate(()=>({storage:{...localStorage},map:document.querySelector('#map')?.getBoundingClientRect().toJSON(),scroll:scrollY}));assert.deepEqual(after,before);
 await page.screenshot({path:out+'/'+tool+'-closed-'+width+'.png'});results.push({tool,width,passed:true,mapUnchanged:true,storageUnchanged:true});await context.close();
}}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({head:process.env.CONTACT_HEAD,results},null,2));}
console.log('PASS contact popup: both tools, five widths, focus/Escape/reopen, layout and storage');
