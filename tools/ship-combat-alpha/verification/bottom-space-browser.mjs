import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyBottomSpace(page,width,artifacts){
 const original=page.viewportSize();
 await page.setViewportSize({width,height:width===1876?982:width<500?700:1000});
 if(width===1876){await page.reload();await page.locator('.ship-node').first().waitFor();}
 await page.evaluate(()=>scrollTo(0,0));
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const settle=async()=>{await paint();if(width>700&&await page.evaluate(()=>document.querySelector('#console-frame').getBoundingClientRect().top>=0&&!document.body.classList.contains('map-expanded')))await page.waitForFunction(()=>Math.abs(document.querySelector('#map').getBoundingClientRect().bottom+scrollY-(visualViewport?.height??innerHeight))<=1.5);};await settle();
 // Browser zoom remains 100%; reproduce the reference's separate 33% map zoom.
 if(width===1876){const box=await page.locator('#map').boundingBox();for(let i=0;i<11;i++)await page.locator('#map').dispatchEvent('wheel',{deltaY:100,clientX:box.x+box.width/2,clientY:box.y+box.height/2});await settle();assert.equal(await page.locator('#zoom-level').textContent(),'33%');}
 const metrics=()=>page.evaluate(()=>{const map=document.querySelector('#map'),frame=document.querySelector('#console-frame'),right=document.querySelector('#combat-right'),r=map.getBoundingClientRect(),f=frame.getBoundingClientRect(),b=right.getBoundingClientRect(),m=map.getScreenCTM();return{map:{top:r.top,bottom:r.bottom,height:r.height},frame:{top:f.top,bottom:f.bottom,height:f.height},rightBottom:b.bottom,extra:Number(frame.dataset.heightExtension),scale:m.a,scaleY:m.d,viewHeight:map.viewBox.baseVal.height,camera:document.querySelector('#scene').getAttribute('transform'),zoom:document.querySelector('#zoom-level').textContent};});
 let after=await metrics();
 if(width<=700){
  // Normal mobile pages scroll: the persistent phase strip adds vertical space.
  // Verify the usable map can be revealed unobstructed, rather than shrinking it.
  const before=after,revision=await page.locator('#map').getAttribute('data-revision');
  await page.locator('#map').scrollIntoViewIfNeeded();await paint();after=await metrics();
  const strip=await page.locator('#workflow-strip').boundingBox();
  assert.ok(after.map.top>=strip.y+strip.height-1,'map is reachable below the persistent strip');
  assert.equal(after.camera,before.camera);assert.equal(after.zoom,before.zoom);assert.equal(after.map.height,before.map.height);assert.equal(await page.locator('#map').getAttribute('data-revision'),revision);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await writeFile(artifacts+'bottom-space-metrics-'+width+'.json',JSON.stringify({before,after,strip},null,2));
 }
 assert.ok(after.map.bottom<=page.viewportSize().height+1);assert.ok(after.map.height>=200);assert.ok(Math.abs(after.scale-after.scaleY)<1e-7);
 if(width>700&&after.extra){
  const style=await page.addStyleTag({content:'.station-console:not(.map-expanded) .console-frame{height:'+(after.frame.height-after.extra)+'px!important}'});await paint();const before=await metrics();await style.evaluate(e=>e.remove());await settle();const restored=await metrics();assert.ok(restored.map.height>before.map.height);assert.ok(restored.viewHeight>before.viewHeight);assert.ok(Math.abs(restored.scale-before.scale)<.001);assert.equal(restored.camera,before.camera);assert.equal(restored.zoom,before.zoom);
  await writeFile(artifacts+'bottom-space-metrics-'+width+'.json',JSON.stringify({before,after:restored},null,2));
 }
 if(width>700){assert.ok(after.extra>0,'desktop uses additional bottom space');assert.ok(Math.abs(after.map.bottom-page.viewportSize().height)<=1.5,'actual map bottom fills visible viewport');}
 const revision=await page.locator('#map').getAttribute('data-revision');await page.locator('input[name=range-mode][value=on]').check();await settle();assert.equal(await page.locator('.range-band-fill').count(),4);assert.equal(await page.locator('#map').getAttribute('data-revision'),revision);
 if(width===1876){
  // Reproduce the previous release's fixed wrapper footprint for a paired visual
  // comparison. Actual live PR151 before measurements are captured independently.
  const help=await page.locator('.map-footer summary').boundingBox(),frameWidth=await page.locator('#console-frame').evaluate(e=>e.parentElement.clientWidth),priorBase=Math.max(240,Math.min(frameWidth,page.viewportSize().height-after.frame.top-help.height)),priorHeight=Math.max(priorBase,Math.min(page.viewportSize().height-after.frame.top,after.rightBottom-after.frame.top));
  const previous=await page.addStyleTag({content:'.station-console:not(.map-expanded) .console-frame{height:'+priorHeight+'px!important}'});await paint();const beforeTop=await metrics();await page.screenshot({path:artifacts+'viewport-pr151-footprint-before-top.png'});await page.evaluate(()=>scrollTo(0,80));await paint();const beforeScrolled=await metrics();await page.screenshot({path:artifacts+'viewport-pr151-footprint-before-scrolled.png'});await previous.evaluate(e=>e.remove());await settle();await page.evaluate(()=>scrollTo(0,0));await settle();await writeFile(artifacts+'viewport-pr151-footprint-before.json',JSON.stringify({beforeTop,beforeScrolled},null,2));
 }
 await page.screenshot({path:artifacts+'bottom-space-'+width+'.png'});
 if(width>700){
  const top=await metrics(),revisionBefore=await page.locator('#map').getAttribute('data-revision');
  await page.evaluate(()=>scrollTo(0,80));await settle();const scrolled=await metrics();assert.ok(Math.abs(scrolled.map.bottom+80-page.viewportSize().height)<=1.5,'scroll leaves document-space map bottom fixed');assert.equal(scrolled.camera,top.camera);assert.equal(scrolled.zoom,top.zoom);assert.ok(Math.abs(scrolled.scale-top.scale)<.001);assert.equal(scrolled.viewHeight,top.viewHeight);assert.equal(scrolled.map.height,top.map.height);
  const heading=await page.locator('.map-heading').boundingBox();assert.ok(scrolled.map.top>=heading.y+heading.height,'map stays below controls');for(const label of await page.locator('.station-regions text').all()){const box=await label.boundingBox();assert.ok(box.y>=scrolled.frame.top&&box.y+box.height<=scrolled.frame.bottom,'station label stays inside fixed frame');}
  await page.screenshot({path:artifacts+'viewport-bottom-scrolled-'+width+'.png'});
  const size=page.viewportSize();await page.setViewportSize({width,height:size.height-60});await settle();const resized=await metrics();assert.ok(Math.abs(resized.map.bottom+80-page.viewportSize().height)<=1.5);assert.equal(resized.camera,top.camera);assert.equal(resized.zoom,top.zoom);assert.ok(Math.abs(resized.scale-top.scale)<.001,'resize reveals world at unchanged pixel scale');await page.setViewportSize(size);await settle();
  assert.equal(await page.locator('#map').getAttribute('data-revision'),revisionBefore);await writeFile(artifacts+'viewport-bottom-'+width+'.json',JSON.stringify({viewport:size,top,scrolled,resized},null,2));
 }
 // Scroll beyond the map top before visiting the below-fold controls. They must
 // become reachable, rather than be pushed away by indefinite scroll compensation.
 for(let i=0;i<3;i++){await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await paint();}
 const endHeight=await page.evaluate(()=>document.documentElement.scrollHeight);await paint();assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),endHeight,'scroll compensation reaches a finite end');
 for(const selector of ['.map-footer summary','.assumptions summary','body>footer']){await page.locator(selector).scrollIntoViewIfNeeded();await paint();const box=await page.locator(selector).boundingBox();assert.ok(box.y>=-1&&box.y+box.height<=page.viewportSize().height+1,'below-fold control is scroll reachable '+JSON.stringify({selector,box,viewport:page.viewportSize()}));}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await settle();
}
