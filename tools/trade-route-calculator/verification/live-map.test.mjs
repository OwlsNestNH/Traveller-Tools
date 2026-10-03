import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
try{
 await page.goto(process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/');
 const result=await page.evaluate(async()=>{const r=await fetch('https://travellermap.com/api/jumpworlds?sector=Spinward%20Marches&hex=1910&jump=1',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(String(r.status));const data=await r.json();return {count:data.Worlds.length,names:data.Worlds.map(w=>w.Name)};});
 assert.ok(result.names.includes('Regina'));console.log('PASS: live browser CORS fetch',JSON.stringify(result));
 await page.getByRole('button',{name:'Set up campaign',exact:true}).click();await page.getByRole('button',{name:'Start campaign',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.locator('svg g').nth(5).waitFor();
 await page.screenshot({path:join(artifacts,'live-map-preview.png'),fullPage:true});console.log('PASS: live setup and nearby-world map.');
}finally{await browser.close();}
