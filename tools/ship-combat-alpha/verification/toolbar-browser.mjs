import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyToolbar(page,width,artifacts){
 const original=page.viewportSize(),records=[];
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const metrics=()=>page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width,center:r.top+r.height/2};},map=document.querySelector('#map');return{width:innerWidth,height:innerHeight,controls:[...document.querySelectorAll('.map-tools button')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,...rect(e)})),switch:rect(document.querySelector('.range-switch')),label:rect(document.querySelector('.range-inline-label')),map:rect(map),card:rect(document.querySelector('#ship-rail')),camera:document.querySelector('#scene').getAttribute('transform'),zoom:map.dataset.zoom,revision:map.dataset.revision};});
 const settle=async()=>{await paint();if(page.viewportSize().width>700)await page.waitForFunction(()=>Math.abs(document.querySelector('#ship-rail').getBoundingClientRect().top+document.querySelector('#combat-right').scrollTop-document.querySelector('#map').getBoundingClientRect().top)<=1.5);};
 for(const size of width===1876?[original,{width:1528,height:850}]:[original]){
  await page.setViewportSize(size);await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#combat-right').scrollTop=0;});await settle();const start=await metrics();
  for(const expanded of [false,true]){
   if(expanded)await page.locator('#expand-map').click();await settle();const m=await metrics(),expected=width>700?36:44;for(const c of [...m.controls,m.switch])assert.ok(Math.abs(c.height-expected)<=1,'consistent toolbar control height '+JSON.stringify(c));
   assert.ok(Math.abs(m.label.center-m.switch.center)<=1,'inline label is vertically centered');assert.equal(await page.locator('.range-inline-label').textContent(),'Range bands');assert.equal(await page.locator('.range-inline-label').isVisible(),true);
   for(const c of m.controls.filter(c=>Math.abs(c.center-m.switch.center)<expected))assert.ok(Math.abs(c.center-m.switch.center)<=1,'switch aligns with controls sharing its row');
   const zoom=await page.locator('.map-zoom-group').evaluate(e=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return{top:r.top,left:r.left,right:r.right};}));for(let i=1;i<zoom.length;i++){assert.ok(Math.abs(zoom[i].top-zoom[0].top)<=1,'zoom controls stay together');assert.ok(Math.abs(zoom[i].left-zoom[i-1].right-6)<=1,'uniform zoom spacing');}
   assert.deepEqual(await page.locator('.map-action-group button').evaluateAll(es=>es.map(e=>e.id)),['add-ship-main','advance','coast','brake']);assert.equal(await page.getByRole('radiogroup',{name:'Selected ship range bands'}).count(),1);assert.equal(await page.locator('input[name=range-mode]').count(),2);
   assert.equal(m.camera,start.camera);assert.equal(m.zoom,start.zoom);assert.equal(m.revision,start.revision);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width>700){assert.ok(Math.abs(m.card.top-m.map.top)<=1.5);if(!expanded)assert.ok(Math.abs(m.map.bottom-size.height)<=1.5);}
   await page.locator('.map-heading').screenshot({path:artifacts+'toolbar-'+(expanded?'expanded-':'normal-')+size.width+'.png'});await page.screenshot({path:artifacts+'toolbar-layout-'+(expanded?'expanded-':'normal-')+size.width+'.png'});records.push({size,expanded,...m});
  }
  await page.locator('#expand-map').click();await settle();
  await page.locator('#zoom-out').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'zoom-in');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'fit');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'expand-map');
  const prior=await page.locator('input[name=range-mode]:checked').inputValue();await page.locator('input[name=range-mode][value=on]').focus();await page.keyboard.press('ArrowLeft');await paint();assert.equal(await page.locator('input[name=range-mode]:checked').inputValue(),'off');await page.keyboard.press('ArrowRight');await paint();assert.equal(await page.locator('input[name=range-mode]:checked').inputValue(),'on');await page.locator('input[name=range-mode][value='+prior+']').check();
 }
 await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await settle();await writeFile(artifacts+'toolbar-metrics-'+width+'.json',JSON.stringify(records,null,2));
}
