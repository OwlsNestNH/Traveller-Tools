import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {expandedMapFixture} from './expanded-map-browser.test.mjs';
import {campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const snapshot=page=>page.evaluate(()=>{const map=document.querySelector('.map-viewport').getBoundingClientRect();return {scrollY,top:map.top,left:map.left,width:map.width,height:map.height,zoom:document.querySelector('.map-zoom-controls .help').textContent,pan:document.querySelector('.map-content').getAttribute('transform')};});
try{for(const width of [320,390,768,820,1024,1440]){
 const f=expandedMapFixture(),context=await browser.newContext({viewport:{width,height:900},hasTouch:true,isMobile:width<1100});
 await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:f.bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
 for(const expanded of [false,true]){
  if(expanded){await page.locator('[data-action="map-expand"]').tap();await settle(page);}
  await page.evaluate(()=>{const b=document.querySelector('.map-zoom-controls').getBoundingClientRect();scrollTo(0,scrollY+b.top-600);});await settle(page);
  const original=await snapshot(page);assert.ok(original.scrollY>0,'Scrolled positive control '+width);
  for(const name of ['map-zoom-in','map-zoom-in','map-zoom-out','map-zoom-out','map-zoom-reset']){
   const before=await snapshot(page),control=page.locator('[data-action="'+name+'"]');await page.evaluate(name=>{window.__zoomControl=document.querySelector('[data-action="'+name+'"]');window.__zoomViewport=document.querySelector('.map-viewport');},name);await control.tap();await settle(page);await page.waitForTimeout(60);const after=await snapshot(page);const expected=name==='map-zoom-reset'?'100%':String(Math.round(Number(before.zoom.slice(0,-1))*(name==='map-zoom-in'?1.2:1/1.2)))+'%';assert.equal(after.zoom,expected,'Zoom updates the displayed scale');
   assert.equal(await page.evaluate(name=>window.__zoomControl===document.querySelector('[data-action="'+name+'"]')&&window.__zoomViewport===document.querySelector('.map-viewport'),name),true,'Zoom retains the touched control and map viewport DOM');
   for(const key of ['top','left','width','height','scrollY'])assert.ok(Math.abs(after[key]-before[key])<=2,'Zoom keeps '+key+' at '+width+' '+name+': '+before[key]+' -> '+after[key]);
  }
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),f.bytes,'Zoom is display-only');
  await page.locator('.navigation-panel').screenshot({path:artifacts+'map-zoom-scroll-'+width+'-'+expanded+'.png'});
 }
 assert.deepEqual(errors,[]);report.push({width,touch:true,normalAndExpanded:true,stableViewport:true,unchangedCampaign:true});await context.close();
}await writeFile(artifacts+'map-zoom-scroll-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,report},null,2));console.log(JSON.stringify(report));}finally{await browser.close();}
