import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession} from '../engine/session.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const raw=exportSession(execute(createSession('deferred-browser'),{type:'setup',payload:{species:'zhodani',name:'Preserved old Traveller'}}).session);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;const checks=[],errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const width of [1440,320])for(const transport of ['', '?api=local']){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   assert.deepEqual(await page.locator('[name=species] option').evaluateAll(options=>options.map(o=>o.value)),['human','aslan','vargr','aezorgh']);assert.equal(await page.locator('[name=zhodaniPsi]').count(),0);
   await page.locator('#setup-optional-settings>summary').click();await page.locator('[name=gm]').check();assert.equal(await page.locator('[name=extras][value=PSI]').isEnabled(),true);
   await page.locator('[name=species]').selectOption('vargr');await page.locator('[name=species]').selectOption('human');assert.equal(await page.locator('[name=zhodaniPsi]').count(),0);
   // Both transports reject tampered persisted current-revision Zhodani saves,
   // retain their original bytes through reload, and expose only read-only history.
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await page.locator('#recovery-inspect').waitFor();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);await page.locator('#recovery-inspect').click();assert.equal(await page.locator('#legacy-actions>li').count(),1);
   const pending=page.waitForEvent('download');await page.locator('#recovery-save').click();const download=await pending,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.deepEqual(Buffer.concat(chunks),Buffer.from(raw));
   await page.reload();await page.locator('#recovery-inspect').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name='release-scope-'+width+(transport?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('release-scope-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
