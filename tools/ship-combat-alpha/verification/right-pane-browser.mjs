import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyRightPane(page,width,artifacts){
 const original=page.viewportSize(),records=[];
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const metrics=()=>page.evaluate(()=>{const box=id=>{const b=document.querySelector(id).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width};};return {roster:box('#ship-rail'),status:box('#selected-workspace'),commands:box('#movement-workspace'),map:box('#console-frame'),camera:document.querySelector('#scene').getAttribute('transform'),revision:document.querySelector('#map').dataset.revision};});
 for(const size of width===1876?[original,{width:1528,height:850}]:[original]){
  await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));await paint();const initial=await metrics();
  for(const expanded of [false,true]){
   if(expanded)await page.locator('#expand-map').click();await page.evaluate(()=>scrollTo(0,0));await paint();const m=await metrics();
   assert.ok(m.roster.bottom<=m.map.top);assert.ok(m.status.bottom<=m.commands.top);assert.ok(width>700?m.status.left>=m.map.right:m.status.top>=m.map.bottom);if(width>700)assert.ok(Math.abs(m.status.top-m.map.top)<=1.5);
   assert.equal(m.camera,initial.camera);assert.equal(m.revision,initial.revision);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width>700){await page.locator('#movement-workspace').evaluate(e=>e.scrollTop=100);const own=await metrics();assert.deepEqual(own.status,m.status,'station scrolling leaves status fixed');assert.equal(own.camera,m.camera);await page.locator('#movement-workspace').evaluate(e=>e.scrollTop=0);}
   await page.screenshot({path:artifacts+'right-pane-'+(expanded?'expanded-':'normal-')+size.width+'.png'});records.push(m);
  }await page.locator('#expand-map').click();
 }
 await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await paint();await writeFile(artifacts+'right-pane-metrics-'+width+'.json',JSON.stringify(records,null,2));
}
