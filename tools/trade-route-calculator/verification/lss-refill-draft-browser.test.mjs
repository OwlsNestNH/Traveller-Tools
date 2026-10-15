// Synthetic draft preview only; does not certify application payment integration.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=new URL('../',import.meta.url),artifacts=new URL('../verification-artifacts/',import.meta.url);
await mkdir(artifacts,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root);if(!url.href.startsWith(root.href))throw Error('Outside fixture');const bytes=await readFile(url);res.setHeader('Content-Type',url.pathname.endsWith('.mjs')?'text/javascript':'text/html');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,channel:process.env.TRAVELLER_BROWSER_CHANNEL||'msedge'});
 for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/verification/lss-refill-preview.html`);
  await page.locator('#lss-internal').waitFor();
  const slider=await page.locator('#lss-internal').elementHandle(),bounds=await slider.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.21,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height/2,{steps:15});await page.mouse.up();
  assert.equal(await slider.evaluate(el=>el.isConnected),true,'Dragging retains the active slider');assert.ok(Number(await slider.inputValue())>500,'Pointer drag reaches the requested region');
  await page.locator('[data-refill-action="cancel"]').last().click();
  await page.locator('[data-refill-action="fill-cargo"]').click();
  assert.equal(await page.locator('#lss-internal').inputValue(),'165');assert.equal(await page.locator('#lss-cargo').inputValue(),'6000');
  await page.locator('#lss-internal').fill('400');
  assert.equal(await page.locator('#lss-cargo').inputValue(),'6000');
  await page.locator('[data-refill-action="minus"]').click();assert.equal(await page.locator('#lss-cargo').inputValue(),'5999');
  assert.equal(await page.locator('[data-refill-action="confirm"]').isDisabled(),true);assert.equal(await page.locator('[data-refill-action="gm"]').isDisabled(),true);
  await page.locator('[data-refill-action="audit"]').click();assert.equal(await page.locator('details').getAttribute('open'),'');
  await page.locator('[data-refill-action="cancel"]').last().click();assert.equal(await page.locator('#lss-internal').inputValue(),'165');assert.equal(await page.locator('#lss-cargo').inputValue(),'0');
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:fileURLToPath(new URL(`lss-refill-draft-${width}.png`,artifacts)),fullPage:true});assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS synthetic refill draft at ${width}px: independent controls, Cancel, no writes, disabled accounting, no horizontal overflow.`);
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
