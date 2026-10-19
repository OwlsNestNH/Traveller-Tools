import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_EXECUTABLE?{executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE}:{})});
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url)); await mkdir(artifacts,{recursive:true});
const context=await browser.newContext({viewport:{width:1100,height:900}}), page=await context.newPage(), requests=[];
await context.addInitScript(()=>{for(const method of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[method]=()=>{throw Error('Map touched storage');};indexedDB.open=()=>{throw Error('Map touched database');};});
// A tiny test response exercises image loading only; it is not a map or visual evidence.
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
let mode='success';
await context.route('https://travellermap.com/**',async route=>{
 const url=new URL(route.request().url()); requests.push(url);
 if(mode==='failure')return route.abort('failed');
 if(url.pathname==='/api/jumpmap')return route.fulfill({contentType:'image/png',body:pixel});
 return route.fulfill({contentType:'application/json',body:JSON.stringify({Worlds:[{Hex:'1910',UWP:'A788899-C',Bases:'NS',Allegiance:'ImDd',PBG:'703',Name:'<img src=x>'}]})});
});
try {
 await page.goto(new URL('player-map-preview.html',base).href); await page.getByText('Reference map loaded · radius 2.',{exact:true}).waitFor();
 await page.getByText(/Hex 1910 · UWP A788899-C/).waitFor();
 for(const radius of [0,1,2,3,4,5,2]) {
  await page.locator('#radius').fill(String(radius)); await page.locator('#radius').dispatchEvent('change');
  await page.getByText('Reference map loaded · radius '+radius+'.',{exact:true}).waitFor();
  const request=new URL(await page.locator('#map-frame img').getAttribute('src')); assert.equal(request.searchParams.get('jump'),String(radius));assert.equal(request.searchParams.get('scale'),radius<=3?'128':'48');assert.equal(request.searchParams.get('hex'),'1910');
  assert.equal(await page.locator('#map-frame img').count(),1); assert.equal(new URL(page.url()).hash,'');
 }
 mode='failure'; await page.goto('about:blank'); await page.goto(new URL('player-map-preview.html',base).href);
 await page.getByText(/Reference map unavailable/).waitFor(); await page.getByText(/System details unavailable/).waitFor(); assert.equal(await page.locator('#map-frame img').count(),0);
 await page.screenshot({path:artifacts+'player-map-failure-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:artifacts+'player-map-failure-phone.png',fullPage:true});
 mode='success'; await page.getByRole('button',{name:'Retry map and details'}).click();await page.getByText('Reference map loaded · radius 2.',{exact:true}).waitFor();
 await page.reload();await page.getByText('Reference map loaded · radius 2.',{exact:true}).waitFor();assert.equal(await page.locator('#radius').inputValue(),'2');
 console.log('Map preview controls 0–5, reference isolation, bounded failure/retry and mobile layout passed. Mocked transport; no live map readability claim.');
} finally {await browser.close();}
