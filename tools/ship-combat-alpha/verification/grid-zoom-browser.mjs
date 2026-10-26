import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {visibleGrid,GRID_LIMIT,GRID_LIMIT_AT_100} from '../geometry.mjs';
export async function verifyGridZoom(page,width,artifacts){
 const records=[],source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker='camera=fitShipsCamera(state.ships),drag=null';assert.equal(source.split(marker).length,2);
 for(const zoom of [.99,1,1.01]){
  const p=await page.context().newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.setViewportSize({width,height:width===1876?982:width<500?700:1000});
  // Fixture changes only the initial view camera, because the public controls use
  // multiplicative steps and cannot select an exact numerical 100% value.
  // The production renderer, geometry, engine and controls remain unmodified.
  await p.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:source.replace(marker,'camera={x:0,y:0,zoom:'+zoom+'},drag=null')}));
  try{
   await p.goto(page.url(),{waitUntil:'domcontentloaded'});await p.locator('.ship-node').first().waitFor();
   for(const expanded of [false,true]){
    if(expanded)await p.locator('#expand-map').click();await p.waitForFunction(z=>Number(document.querySelector('#map').dataset.zoom)===z,zoom);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const m=await p.locator('#map').evaluate(e=>({zoom:Number(e.dataset.zoom),grid:e.dataset.gridVisible==='true',width:e.viewBox.baseVal.width,height:e.viewBox.baseVal.height,cells:e.querySelectorAll('.cell').length,revision:e.dataset.revision})),expected=visibleGrid({x:0,y:0,zoom},m.width,m.height),limit=zoom>=1?GRID_LIMIT_AT_100:GRID_LIMIT;
    assert.equal(m.grid,!expected.limited);assert.equal(m.cells,expected.cells.length);assert.ok(m.cells<=limit);if(zoom>=1)assert.ok(m.grid&&m.cells>0,'100% and above remain visible in supported viewports');assert.equal(await p.locator('#zoom-level').textContent(),Math.round(zoom*100)+'%');
    if(zoom===1||width===1876)await p.screenshot({path:artifacts+'grid-'+Math.round(zoom*100)+'-'+(expanded?'expanded-':'normal-')+width+'.png'});
    let timings=[];if(zoom===1){timings=await p.evaluate(async()=>{const svg=document.querySelector('#map'),scene=document.querySelector('#scene'),times=[];for(let i=0;i<6;i++){const start=performance.now();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{observer.disconnect();reject(Error('Grid pan failed to render within 2 seconds'));},2000),observer=new MutationObserver(()=>{observer.disconnect();requestAnimationFrame(()=>{clearTimeout(timer);times.push(performance.now()-start);resolve();});});observer.observe(scene,{childList:true});svg.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight',bubbles:true}));});}return times;});assert.equal(await p.locator('#map').getAttribute('data-revision'),m.revision);assert.ok(await p.locator('.cell').count()<=limit);}
    const bounds=await p.locator('#map').boundingBox();if(width>700&&!expanded)assert.ok(Math.abs(bounds.y+bounds.height-p.viewportSize().height)<=1.5);if(width>700){const card=await p.locator('#ship-rail').boundingBox();assert.ok(Math.abs(card.y-bounds.y)<=1.5);}assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    records.push({width,expanded,...m,limit,panMilliseconds:timings});
   }
   assert.deepEqual(errors,[]);if(await p.evaluate(()=>Array.isArray(window.__storageAccesses)))assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);
  }finally{await p.close();}
 }
 await writeFile(artifacts+'grid-zoom-'+width+'.json',JSON.stringify(records,null,2));
}
