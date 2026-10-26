import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyRightPane(page,width,artifacts){
 const original=page.viewportSize(),records=[];
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const metrics=()=>page.evaluate(()=>{const pane=document.querySelector('#combat-right'),card=document.querySelector('#ship-rail'),map=document.querySelector('#map'),p=pane.getBoundingClientRect(),c=card.getBoundingClientRect(),m=map.getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollY,pane:{top:p.top,bottom:p.bottom,width:p.width,scroll:pane.scrollTop,client:pane.clientHeight,content:pane.scrollHeight},card:{top:c.top,bottom:c.bottom},map:{top:m.top,bottom:m.bottom},camera:document.querySelector('#scene').getAttribute('transform'),zoom:map.dataset.zoom,revision:map.dataset.revision};});
 const settle=async()=>{await paint();if(page.viewportSize().width>700)await page.waitForFunction(()=>{const p=document.querySelector('#combat-right'),c=document.querySelector('#ship-rail').getBoundingClientRect(),m=document.querySelector('#map').getBoundingClientRect();return Math.abs(c.top+p.scrollTop-m.top)<=1.5&&p.getBoundingClientRect().bottom<=innerHeight+1.5;});};
 const aligned=m=>{assert.ok(Math.abs(m.card.top+m.pane.scroll-m.map.top)<=1.5,'summary aligns with actual map top');assert.ok(m.pane.bottom<=m.height+1.5,'independent pane ends within viewport');assert.ok(m.pane.client>=200,'usable pane scroll height');};
 const unchanged=(a,b)=>{assert.equal(b.camera,a.camera);assert.equal(b.zoom,a.zoom);assert.equal(b.revision,a.revision);};
 for(const size of width===1876?[original,{width:1528,height:850}]:[original]){
  await page.setViewportSize(size);await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#combat-right').scrollTop=0;});await settle();const normal=await metrics();
  if(width>700){
   aligned(normal);assert.ok(Math.abs(normal.map.bottom-size.height)<=1.5,'normal map still fills visible bottom');await page.screenshot({path:artifacts+'right-pane-normal-'+size.width+'.png'});
   await page.locator('#combat-right').evaluate(p=>p.scrollTop=(p.scrollHeight-p.clientHeight)/2);await paint();const own=await metrics();assert.ok(own.pane.scroll>0);assert.equal(own.scrollY,normal.scrollY,'right pane scroll is independent');unchanged(normal,own);
   await page.setViewportSize({width:size.width,height:size.height-40});await settle();const resized=await metrics();aligned(resized);assert.ok(Math.abs(resized.pane.scroll-own.pane.scroll)<=1,'resize retains pane scroll');unchanged(normal,resized);await page.setViewportSize(size);await settle();await page.locator('#combat-right').evaluate(p=>p.scrollTop=0);await settle();
   await page.locator('#expand-map').click();await settle();const expanded=await metrics();aligned(expanded);unchanged(normal,expanded);await page.screenshot({path:artifacts+'right-pane-expanded-'+size.width+'.png'});await page.locator('#expand-map').click();await settle();const restored=await metrics();aligned(restored);unchanged(normal,restored);
   await page.evaluate(()=>scrollTo(0,60));await settle();const scrolled=await metrics();aligned(scrolled);unchanged(normal,scrolled);assert.ok(Math.abs(scrolled.map.bottom+scrolled.scrollY-size.height)<=1.5);records.push({size,normal,own,resized,expanded,restored,scrolled});await page.evaluate(()=>scrollTo(0,0));await settle();
  }else{
   for(const expanded of [false,true]){if(expanded)await page.locator('#expand-map').click();await page.locator('#selected-workspace').scrollIntoViewIfNeeded();await paint();const m=await metrics();assert.equal(await page.locator('#combat-right').evaluate(p=>getComputedStyle(p).marginTop),'12px','retain the existing mobile stack gap');assert.ok(m.card.top>=m.map.bottom,'phone pane stays stacked after map');assert.ok(m.pane.width<=size.width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));unchanged(normal,m);await page.screenshot({path:artifacts+'right-pane-stacked-'+(expanded?'expanded-':'')+width+'.png'});records.push(m);}await page.locator('#expand-map').click();
  }
 }
 await page.setViewportSize(original);await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#combat-right').scrollTop=0;});await settle();await writeFile(artifacts+'right-pane-metrics-'+width+'.json',JSON.stringify(records,null,2));
}
