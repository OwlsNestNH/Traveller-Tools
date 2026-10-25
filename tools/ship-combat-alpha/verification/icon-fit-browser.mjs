import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function verifyIconFit(page,width,artifacts){
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker='state=createState(),selected=',cameraMarker='camera=fitShipsCamera(state.ships),drag=null',records=[];
 assert.equal(source.split(marker).length,2);assert.equal(source.split(cameraMarker).length,2);
 const icons=['launch','pinnace','fighter','research','harrier','corsair','other','subsidised-merchant'],ships=icons.map((icon,i)=>({id:'fit-'+i,name:icon,appearance:{icon,side:i%2?'B':'A',heading:i*43-150},capabilities:{thrust:1},motion:{position:{q:(i%4)*2-3,r:i<4?-1:1},velocity:{q:0,r:0},impulse:{q:0,r:0}}}));
 for(const zoom of [.33,1,2]){
  const p=await page.context().newPage();p.setDefaultTimeout(15000);await p.setViewportSize({width,height:width<500?700:982});
  // Synthetic initial encounter/camera only; production sizing and interaction paths are untouched.
  await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace(marker,'state=createState({ships:'+JSON.stringify(ships)+'}),selected=').replace(cameraMarker,'camera={x:0,y:0,zoom:'+zoom+'},drag=null')}));
  try{
   await p.goto(page.url(),{waitUntil:'domcontentloaded'});await p.locator('.ship-node').first().waitFor();
   const revision=await p.locator('#map').getAttribute('data-revision');
   for(const expanded of [false,true]){
    if(expanded)await p.locator('#expand-map').click();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const measurements=await p.locator('.ship-node').evaluateAll(nodes=>nodes.map(node=>{
     const art=node.querySelector('.ship-art'),b=art.getBBox(),m=art.getScreenCTM(),n=node.getScreenCTM(),center=new DOMPoint(0,0).matrixTransform(n),world=document.querySelector('#scene').getScreenCTM(),apothem=26*Math.sqrt(3)/2*Math.hypot(world.a,world.b),hit=node.querySelector('.ship-hit').getBoundingClientRect(),image=art.querySelector('image');
     return {icon:node.dataset.icon,maxRadius:Math.max(...[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return Math.hypot(p.x-center.x,p.y-center.y);})),apothem,hitWidth:hit.width,hitHeight:hit.height,aspect:image?.preserveAspectRatio.baseVal.align,rotation:node.querySelector('.ship-glyph').getAttribute('transform')};
    }));
    for(const m of measurements){assert.ok(m.maxRadius<=.9*m.apothem+.01,JSON.stringify(m));assert.ok(m.hitWidth>=44&&m.hitHeight>=44,'unchanged usable hit target');assert.ok(Math.abs(m.hitWidth-50)<1&&Math.abs(m.hitHeight-50)<1);if(m.aspect!==undefined)assert.equal(m.aspect,6,'artwork preserves its native aspect ratio');}
    // Exercise real pointer/touch and keyboard selection without modifying encounter state.
    const target=p.locator('[data-ship="fit-7"] .ship-hit');if(width<500)await target.tap();else await target.click();assert.equal(await p.locator('[data-select="fit-7"]').getAttribute('aria-pressed'),'true');await p.locator('[data-ship="fit-0"]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-select="fit-0"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#map').getAttribute('data-revision'),revision);
    records.push({width,zoom,expanded,measurements});if(zoom===1||width===1876)await p.screenshot({path:artifacts+'icon-fit-'+Math.round(zoom*100)+'-'+(expanded?'expanded-':'normal-')+width+'.png'});
   }
   if(await p.evaluate(()=>Array.isArray(window.__storageAccesses)))assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);
  }finally{await p.close();}
 }
 await writeFile(artifacts+'icon-fit-'+width+'.json',JSON.stringify(records,null,2));
}

