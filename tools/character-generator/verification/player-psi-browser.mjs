// CI-only: serve candidate files, exercise player PSI, never contact live services.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const origin='https://player-psi.test',url=origin+'/tools/character-generator/';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const httpOrigin='http://127.0.0.1:'+server.address().port;
const errors=[];let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const http of [false,true])for(const width of [1440,390])for(const initial of [true,false]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  try{
   await context.route('**/*',async route=>{
    const request=new URL(route.request().url());
    if(http&&request.origin===httpOrigin)return route.continue();
    if(request.origin!==origin)return route.abort();
    if(request.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
    const file=path.resolve(root,'.'+decodeURIComponent(request.pathname)+(request.pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep))return route.abort();
    return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});
   });
   const page=await context.newPage(),engineRequests=[],apiRequests=[];page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{if(request.url().includes('/engine/'))engineRequests.push(request.url());if(new URL(request.url()).pathname==='/api/v1')apiRequests.push(request.url());});
   await page.goto(http?httpOrigin+'/?api=local':url);await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   await page.locator('#setup-optional-settings>summary').click();
   const psi=page.locator('[name=extras][value=PSI]'),gm=page.locator('[name=gm]');
   assert.equal(await psi.isEnabled(),true);assert.equal(await gm.isChecked(),false);
   if(initial){await psi.check();await gm.check();await gm.uncheck();assert.equal(await psi.isChecked(),true);assert.match(await page.locator('#setup-optional-summary').textContent(),/PSI.*GM changes off/);}
   await page.getByRole('button',{name:'Begin character',exact:true}).click();
   await page.getByRole('button',{name:'Roll six characteristics',exact:true}).click();
   await page.getByRole('button',{name:'Keep these characteristics',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#sheet .stat')&&document.querySelector('#step-title')?.textContent!=='Roll and place characteristics');
   if(!initial){
    const extras=page.locator('#sheet details').filter({has:page.locator('summary',{hasText:'Add another characteristic'})}).first();
    await extras.locator('summary').click();
    await extras.locator('select').selectOption('PSI');
    await extras.getByRole('button',{name:'Add this characteristic',exact:true}).click();
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('#sheet .stat')].some(el=>el.textContent.includes('PSI')));
   assert.equal(await page.locator('#gm-toggle').isChecked(),false);
   assert.equal(await page.locator('[data-action=gm-override]').count(),0);assert.equal(await page.locator('[data-action=gm-replay]').count(),0);
   assert.equal(await page.locator('[data-action=learn-talent]').count(),0);
   await page.reload();await page.locator('#gm-toggle').waitFor({state:'attached'});
   assert.equal(await page.locator('#gm-toggle').isChecked(),false);assert.equal(await page.locator('[data-action=gm-override]').count(),0);
   assert.equal(await page.locator('#sheet .stat').filter({hasText:'PSI'}).count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(http){assert.ok(apiRequests.length>0,'HTTP mode must call the rules API');assert.deepEqual(engineRequests,[],'HTTP mode must not import the engine into the browser');}
   else {assert.equal(apiRequests.length,0);assert.ok(engineRequests.length>0);}
   console.log('PASS player PSI '+(initial?'at setup':'added later')+' width '+width+(http?' HTTP':' static')+'; GM off across reload');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
