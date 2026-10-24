import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function verifyWideConsole(page,width,artifacts){
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const metrics=()=>page.evaluate(()=>{const map=document.getElementById('map'),m=map.getScreenCTM(),b=map.getBoundingClientRect(),v=map.viewBox.baseVal;return {width:b.width,height:b.height,worldWidth:v.width,worldHeight:v.height,scaleX:m.a,scaleY:m.d,zoom:map.dataset.zoom,transform:document.getElementById('scene').getAttribute('transform'),selected:document.querySelector('.ship-choice[aria-pressed=true]')?.dataset.select,revision:map.dataset.revision};});
 await page.locator('#reset').click();await page.evaluate(()=>scrollTo(0,0));await settle();
 const frame=await page.locator('#console-frame').boundingBox(),left=await page.locator('.tactical-column').boundingBox(),right=await page.locator('#combat-right').boundingBox();
 assert.ok(Math.abs(frame.width-left.width)<=1,'normal console fills the left workspace');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width>700)assert.ok(right.x>=frame.x+frame.width,'right pane retains its separate space');
 let reference=null,wide=await metrics();assert.ok(Math.abs(wide.scaleX-wide.scaleY)<1e-8,'map axes retain equal scale, so hexes/art are not stretched');
 if(width===1876){
  assert.ok(frame.width>frame.height*1.5,'wide desktop must reveal lateral space');
  // Reconstruct the old square-width constraint without changing game state or zoom.
  const style=await page.addStyleTag({content:'.station-console:not(.map-expanded) .console-frame{width:var(--console-size)!important}'});await settle();const square=await metrics();reference=square;await style.evaluate(e=>e.remove());await settle();wide=await metrics();
  assert.ok(wide.worldWidth>square.worldWidth*1.5,'wider screen shows more world left and right');assert.ok(Math.abs(wide.worldHeight-square.worldHeight)<1,'vertical world extent stays fixed');assert.ok(Math.abs(wide.scaleX-square.scaleX)<.001,'existing content retains the same pixel scale');assert.equal(wide.zoom,square.zoom);assert.equal(wide.transform,square.transform);assert.equal(wide.selected,square.selected);assert.equal(wide.revision,square.revision);
 }
 await writeFile(artifacts+'wide-metrics-'+width+'.json',JSON.stringify({width,referenceSquare:reference,wide},null,2));await page.screenshot({path:artifacts+'wide-console-'+width+'.png'});
 const before=await metrics();await page.locator('#expand-map').click();await settle();assert.equal(await page.locator('#combat-right').isVisible(),true);const expanded=await metrics();assert.ok(Math.abs(expanded.scaleX-expanded.scaleY)<1e-8);assert.equal(expanded.zoom,before.zoom);assert.equal(expanded.selected,before.selected);await page.screenshot({path:artifacts+'wide-expanded-'+width+'.png'});await page.locator('#expand-map').click();await settle();assert.equal((await metrics()).transform,before.transform);assert.equal((await metrics()).zoom,before.zoom);
}
