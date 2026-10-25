import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createState,normalizeState} from '../engine.mjs';
export async function verifySamples(page,width,artifacts){
 const p=await page.context().newPage(),source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),expected=createState(),records=[];p.setDefaultTimeout(15000);
 await p.setViewportSize({width,height:width<500?700:982});
 // Read-only test inspector; initial state, reset and all UI paths use unchanged production code.
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+'\nwindow.__readSample=()=>structuredClone(state);'}));
 try{
  await p.goto(page.url(),{waitUntil:'domcontentloaded'});await p.locator('.ship-node').first().waitFor();assert.deepEqual(await p.evaluate(()=>window.__readSample()),expected);
  const symbols={merchant:['trader','free_trader.webp'],courier:['corvette','patrol_corvette.webp'],scout:['scout','scout.webp'],fighter:['fighter','light_fighter.webp'],escort:['harrier','harrier-custom.svg']};
  for(const [id,[icon,file]]of Object.entries(symbols)){const node=p.locator('[data-ship="'+id+'"]');assert.equal(await node.getAttribute('data-icon'),icon);assert.equal(await node.locator('.ship-silhouette').getAttribute('href'),'assets/ships/'+file);if(id!=='escort')assert.match(await node.getAttribute('aria-description'),/representative/i);else assert.match(await node.getAttribute('aria-description'),/custom simplified reference-derived/);}
  await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ship-silhouette')].map(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode();}));});
  assert.equal(await p.locator('.ship-choice').count(),5);assert.equal(await p.locator('#status-hull-current').textContent(),'80');
  for(const s of expected.ships){await p.locator('[data-details="'+s.id+'"]').click();const sheet=await p.locator('#ship-sheet').textContent();assert.ok(sheet.includes(s.template.source.book));assert.ok(sheet.includes(String(s.template.source.page)));assert.ok(sheet.includes(String(s.template.record.ratedPower)));assert.ok(sheet.includes(String(s.template.thrust)));await p.locator('#sheet-close').click();}
  await p.locator('[data-select="merchant"]').click();
  for(const expanded of [false,true]){
   if(expanded)await p.locator('#expand-map').click();await p.evaluate(()=>{scrollTo(0,0);document.querySelector('#combat-right').scrollTop=0;});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const bounds=await p.evaluate(()=>{const map=document.querySelector('#map'),b=map.getBoundingClientRect();return {map:{x:b.x,y:b.y,width:b.width,height:b.height},zoom:map.dataset.zoom,ships:[...document.querySelectorAll('.ship-node')].map(n=>{const m=n.getScreenCTM(),p=new DOMPoint(0,0).matrixTransform(m);return{id:n.dataset.ship,x:p.x,y:p.y};})};});
   for(const s of bounds.ships){assert.ok(s.x>bounds.map.x+10&&s.x<bounds.map.x+bounds.map.width-10,'initial ship visible horizontally '+JSON.stringify(s));assert.ok(s.y>bounds.map.y+10&&s.y<bounds.map.y+bounds.map.height-10,'initial ship visible vertically '+JSON.stringify(s));}
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));records.push({width,expanded,...bounds});await p.screenshot({path:artifacts+'sample-encounter-'+(expanded?'expanded-':'normal-')+width+'.png'});
  }
  await p.locator('#expand-map').click();await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();await p.waitForFunction(()=>document.querySelector('#zoom-level').textContent==='100%');await p.screenshot({path:artifacts+'sample-silhouettes-100-normal-'+width+'.png'});await p.locator('#expand-map').click();await p.screenshot({path:artifacts+'sample-silhouettes-100-expanded-'+width+'.png'});
  await p.locator('#expand-map').click();await p.locator('#open-setup').click();await p.locator('#ship-name').fill('Uncommitted sample edit');await p.locator('#reset').evaluate(e=>e.click());assert.equal(await p.locator('#setup-dialog').isVisible(),false);assert.deepEqual(await p.evaluate(()=>window.__readSample()),expected);
  await p.locator('#advance').click();assert.equal((await p.evaluate(()=>window.__readSample())).round,1);await p.locator('#reset').click();assert.deepEqual(await p.evaluate(()=>window.__readSample()),expected);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(expected))),expected);
  assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);await writeFile(artifacts+'sample-encounter-'+width+'.json',JSON.stringify({head:process.env.SHIP_COMBAT_COMMIT??null,ships:expected.ships.map(s=>({id:s.id,name:s.name,source:s.template.source,position:s.motion.position,velocity:s.motion.velocity,thrust:s.capabilities.thrust,hull:s.condition.hull,ratedPower:s.template.record.ratedPower,appearance:s.appearance})),views:records},null,2));
 }finally{await p.close();}
}
