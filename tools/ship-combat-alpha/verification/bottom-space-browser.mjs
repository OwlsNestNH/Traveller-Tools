import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyBottomSpace(page,width,artifacts){
 const original=page.viewportSize();
 await page.setViewportSize({width,height:width===1876?982:width<500?700:1000});
 await page.evaluate(()=>scrollTo(0,0));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();
 const metrics=()=>page.evaluate(()=>{const map=document.querySelector('#map'),frame=document.querySelector('#console-frame'),right=document.querySelector('#combat-right'),r=map.getBoundingClientRect(),f=frame.getBoundingClientRect(),b=right.getBoundingClientRect(),m=map.getScreenCTM();return{map:{top:r.top,bottom:r.bottom,height:r.height},frame:{top:f.top,bottom:f.bottom,height:f.height},rightBottom:b.bottom,extra:Number(frame.dataset.heightExtension),scale:m.a,scaleY:m.d,viewHeight:map.viewBox.baseVal.height,camera:document.querySelector('#scene').getAttribute('transform'),zoom:document.querySelector('#zoom-level').textContent};});
 const after=await metrics();assert.ok(after.map.bottom<=page.viewportSize().height+1);assert.ok(after.map.height>=200);assert.ok(Math.abs(after.scale-after.scaleY)<1e-7);
 if(width>700&&after.extra){
  const style=await page.addStyleTag({content:'.station-console:not(.map-expanded) .console-frame{height:'+(after.frame.height-after.extra)+'px!important}'});await settle();const before=await metrics();await style.evaluate(e=>e.remove());await settle();const restored=await metrics();assert.ok(restored.map.height>before.map.height);assert.ok(restored.viewHeight>before.viewHeight);assert.ok(Math.abs(restored.scale-before.scale)<.001);assert.equal(restored.camera,before.camera);assert.equal(restored.zoom,before.zoom);
  await writeFile(artifacts+'bottom-space-metrics-'+width+'.json',JSON.stringify({before,after:restored},null,2));
 }
 if(width===1876){assert.ok(after.extra>0,'requested desktop uses additional bottom space');const help=await page.locator('.map-footer summary').boundingBox();assert.ok(Math.abs(help.y+help.height-after.rightBottom)<2,'left map/help footprint aligns with right pane');}
 await page.screenshot({path:artifacts+'bottom-space-'+width+'.png'});
 for(const selector of ['.map-footer summary','.assumptions summary','body>footer']){await page.locator(selector).scrollIntoViewIfNeeded();assert.equal(await page.locator(selector).isVisible(),true);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await settle();
}
