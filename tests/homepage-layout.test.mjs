import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const browser = await chromium.launch({headless:true, ...(process.env.HOME_BROWSER_CHANNEL ? {channel:process.env.HOME_BROWSER_CHANNEL} : {})});
try {
 const page = await browser.newPage();
 // The homepage is static. Serve only its own files and stub remote badges, so tests never increment production counters.
 await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'homepage.test') {
   const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
   try { await route.fulfill({body:await readFile(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript'}); }
   catch { await route.fulfill({status:404,body:'Not found'}); }
  } else if (url.hostname === 'img.shields.io') {
   await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20"><rect width="80" height="20" fill="#2b4cff"/></svg>'});
  } else await route.abort();
 });
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for (const width of [2560,2048,1920,1831,1440,1024,768,600,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('http://homepage.test/');
  await page.locator('.tool-visits img').first().waitFor();
  const rows=await page.locator('.tool-card').evaluateAll(cards=>cards.map(card=>{
   const rect=n=>{const b=n.getBoundingClientRect(); return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,height:b.height};};
   return {card:rect(card),visits:rect(card.querySelector('.tool-visits')),buttons:[...card.querySelectorAll('a')].map(a=>({...rect(a),text:a.textContent,clipped:a.scrollWidth>a.clientWidth||a.scrollHeight>a.clientHeight}))};
  }));
  assert.equal(rows.length,8);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+': page overflow');
  for (const r of rows) {
   for (const b of r.buttons) { assert.ok(!b.clipped,width+': clipped '+b.text); assert.ok(b.x>=r.card.x&&b.right<=r.card.right&&b.bottom<=r.card.bottom,width+': button outside card'); }
   const peers=rows.filter(p=>Math.abs(p.card.y-r.card.y)<1);
   for(const p of peers) {
    assert.ok(Math.abs(p.visits.y-r.visits.y)<1,width+': visit baseline');
    for(let i=0;i<Math.min(p.buttons.length,r.buttons.length);i++) {
     assert.ok(Math.abs(p.buttons[i].y-r.buttons[i].y)<1,width+': action baseline');
     assert.ok(Math.abs(p.buttons[i].height-r.buttons[i].height)<1,width+': action height');
    }
   }
  }
  if(process.env.HOME_SCREENSHOT_DIR && [2048,390].includes(width)) {
   await mkdir(process.env.HOME_SCREENSHOT_DIR,{recursive:true});
   await page.screenshot({path:path.join(process.env.HOME_SCREENSHOT_DIR,'home-'+width+'.png'),fullPage:true});
  }
  console.log('PASS aligned homepage cards at '+width+'px');
 }
 const char=page.locator('.tool-card').nth(3);
 assert.equal(await char.locator('a').first().getAttribute('href'),'tools/character-generator/');
 assert.equal(await char.locator('a').nth(1).getAttribute('href'),'changes/character.html');
 for(let n=0;n<2;n++){
  await char.locator('a').nth(1).click();
  assert.match(page.url(),/changes\/character.html$/);
  await page.goBack();
 }
 await char.locator('a').first().focus();
 assert.equal(await char.locator('a').first().evaluate(a=>getComputedStyle(a).outlineStyle),'solid');
 assert.deepEqual(errors,[]);
 console.log('PASS repeat changelog navigation, Back, focus and unchanged launch destination');
} finally {await browser.close();}

