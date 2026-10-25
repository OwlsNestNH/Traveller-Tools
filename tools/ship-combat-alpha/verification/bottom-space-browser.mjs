import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyBottomSpace(page,width,artifacts){
 const original=page.viewportSize();
 await page.setViewportSize({width,height:width===1876?982:width<500?700:1000});
 await page.evaluate(()=>scrollTo(0,0));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();
 // Browser zoom remains 100%; reproduce the reference's separate 33% map zoom.
 if(width===1876){const box=await page.locator('#map').boundingBox();for(let i=0;i<11;i++)await page.locator('#map').dispatchEvent('wheel',{deltaY:100,clientX:box.x+box.width/2,clientY:box.y+box.height/2});await settle();assert.equal(await page.locator('#zoom-level').textContent(),'33%');}
 const metrics=()=>page.evaluate(()=>{const map=document.querySelector('#map'),frame=document.querySelector('#console-frame'),right=document.querySelector('#combat-right'),r=map.getBoundingClientRect(),f=frame.getBoundingClientRect(),b=right.getBoundingClientRect(),m=map.getScreenCTM();return{map:{top:r.top,bottom:r.bottom,height:r.height},frame:{top:f.top,bottom:f.bottom,height:f.height},rightBottom:b.bottom,extra:Number(frame.dataset.heightExtension),scale:m.a,scaleY:m.d,viewHeight:map.viewBox.baseVal.height,camera:document.querySelector('#scene').getAttribute('transform'),zoom:document.querySelector('#zoom-level').textContent};});
 const after=await metrics();assert.ok(after.map.bottom<=page.viewportSize().height+1);assert.ok(after.map.height>=200);assert.ok(Math.abs(after.scale-after.scaleY)<1e-7);
 if(width>700&&after.extra){
  const style=await page.addStyleTag({content:'.station-console:not(.map-expanded) .console-frame{height:'+(after.frame.height-after.extra)+'px!important}'});await settle();const before=await metrics();await style.evaluate(e=>e.remove());await settle();const restored=await metrics();assert.ok(restored.map.height>before.map.height);assert.ok(restored.viewHeight>before.viewHeight);assert.ok(Math.abs(restored.scale-before.scale)<.001);assert.equal(restored.camera,before.camera);assert.equal(restored.zoom,before.zoom);
  await writeFile(artifacts+'bottom-space-metrics-'+width+'.json',JSON.stringify({before,after:restored},null,2));
 }
 if(width===1876){assert.ok(after.extra>0,'requested desktop uses additional bottom space');assert.ok(Math.abs(after.frame.bottom-Math.min(page.viewportSize().height,after.rightBottom))<2,'console bottom aligns with the visible right pane');}
 const revision=await page.locator('#map').getAttribute('data-revision');await page.locator('input[name=range-mode][value=on]').check();await settle();assert.equal(await page.locator('.range-band-fill').count(),4);assert.equal(await page.locator('#map').getAttribute('data-revision'),revision);
 await page.screenshot({path:artifacts+'bottom-space-'+width+'.png'});
 for(const selector of ['.map-footer summary','.assumptions summary','body>footer']){await page.locator(selector).scrollIntoViewIfNeeded();assert.equal(await page.locator(selector).isVisible(),true);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await settle();
}
