import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession} from '../engine/session.mjs';
import {buildMaleShareAssetsFixture} from './clan-share-assets-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),checks=[],errors=[],key='traveller-character-generator.v1';
try{
 for(const width of [1440,390,320])for(const transport of ['static','http']){
  const fixture=buildMaleShareAssetsFixture(),raw=exportSession(fixture.session),context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(transport==='http'?'/?api=local':'/'));
   const panel=page.locator('#clan-share-panel');await panel.locator(':scope > summary').click();
   const before=await page.evaluate(key=>localStorage.getItem(key),key);
   const contrast=async locator=>locator.evaluate(el=>{
    const s=getComputedStyle(el),rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number),lum=v=>rgb(v).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
    const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });
   assert.ok(await contrast(page.locator('#clan-share-kind'))>=4.5);
   assert.ok(await contrast(page.locator('#clan-share-quantity'))>=4.5);
   assert.equal(await page.locator('#clan-share-quantity').isDisabled(),true);
   await page.locator('#clan-share-kind').selectOption('art');
   const lot=fixture.state.clanShareOptions.choices.find(c=>c.id==='art').lotIds[0];
   await page.locator('#clan-share-lot').selectOption(lot);
   await page.locator('#clan-art-name').fill('Carved stone figure');
   for(const id of ['clan-share-kind','clan-share-lot','clan-share-quantity','clan-art-name'])assert.ok(await contrast(page.locator('#'+id))>=4.5,id);
   await page.locator('#clan-art-name').focus();
   assert.equal(await page.locator('#clan-art-name').evaluate(el=>getComputedStyle(el).outlineColor),'rgb(255, 211, 75)');
   assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await panel.screenshot({path:fileURLToPath(new URL('clan-share-contrast-'+transport+'-'+width+'.png',out))});
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
   checks.push({width,transport,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(new URL('clan-share-contrast-results.json',out),JSON.stringify({checks,errors},null,2));await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
