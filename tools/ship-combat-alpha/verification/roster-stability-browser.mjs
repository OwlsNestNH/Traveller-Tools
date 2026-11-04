import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:700},hasTouch:true});
  await page.goto(new URL('tools/ship-combat-alpha/',root).href);await page.locator('[data-select=scout]').waitFor();
  const measure=()=>page.evaluate(()=>{const r=document.querySelector('#map').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollY,transform:document.querySelector('#scene').getAttribute('transform'),zoom:document.querySelector('#map').dataset.zoom};});
  for(const id of ['scout','merchant']){const before=await measure();await page.locator('[data-select='+id+']').evaluate(e=>e.click());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const after=await measure();for(const k of ['x','y','width','height'])assert.ok(Math.abs(after[k]-before[k])<=.1,`${width} ${id} ${k}: ${JSON.stringify({before,after})}`);for(const k of ['scrollY','transform','zoom'])assert.equal(after[k],before[k]);}
  await page.close();console.log(`PASS roster stability ${width}`);
 }
}finally{await browser.close();}
