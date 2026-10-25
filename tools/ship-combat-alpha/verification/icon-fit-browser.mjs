import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {ICON_RADII,iconRadius} from '../icon-bounds.mjs';
import {ICONS} from '../appearance.mjs';
export async function verifyIconFit(page,width,artifacts){
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker='state=createState(),selected=',cameraMarker='camera=fitShipsCamera(state.ships),drag=null',records=[];
 assert.equal(source.split(marker).length,2);assert.equal(source.split(cameraMarker).length,2);
 const icons=['ifteaa','frontiersman','far-scout','free-smuggler','harrier','research','other','volitant-far-trader'],ships=icons.map((icon,i)=>({id:'fit-'+i,name:icon,appearance:{icon,side:i%2?'B':'A',heading:i*43-150},capabilities:{thrust:1},motion:{position:{q:i===7?0:(i%4)*2-3,r:i===7?0:i<4?-1:1},velocity:{q:0,r:0},impulse:{q:0,r:0}}}));
 const p=await page.context().newPage();p.setDefaultTimeout(15000);await p.setViewportSize({width,height:width<500?700:982});
  // Synthetic encounter and view-camera adapter only; production sizing and interaction paths are untouched.
  await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace(marker,'state=createState({ships:'+JSON.stringify(ships)+'}),selected=').replace(cameraMarker,'camera={x:0,y:0,zoom:.33},drag=null')+"\nwindow.__iconFitZoom=z=>{camera={...camera,zoom:z};scheduleMap();};"}));
  try{
   await p.goto(page.url(),{waitUntil:'domcontentloaded'});await p.locator('.ship-node').first().waitFor();
   // Keep one initialized viewport/projection basis for the entire growth sequence.
   for(const zoom of [.33,1,2,4]){
    if(await p.locator('body').evaluate(e=>e.classList.contains('map-expanded')))await p.locator('#expand-map').click();
    await p.evaluate(z=>window.__iconFitZoom(z),zoom);await p.waitForFunction(z=>Number(document.querySelector('#map').dataset.zoom)===z,zoom);
   if(width===1876&&zoom===.33){
    const assetBounds=await p.evaluate(async files=>{const result=[];for(const file of files){const img=new Image();img.src=new URL('assets/ships/'+file,location.href).href;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=480;const c=canvas.getContext('2d'),f=480/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*f,h=img.naturalHeight*f;c.drawImage(img,(480-w)/2,(480-h)/2,w,h);const a=c.getImageData(0,0,480,480).data;let radius=0,count=0;for(let y=0;y<480;y++)for(let x=0;x<480;x++)if(a[(y*480+x)*4+3]){count++;for(const [dx,dy]of [[0,0],[1,0],[0,1],[1,1]])radius=Math.max(radius,Math.hypot((x+dx-240)/10,(y+dy-240)/10));}result.push({file,radius,count});}return result;},Object.keys(ICON_RADII));
    for(const a of assetBounds){assert.ok(a.count>0);assert.ok(a.radius<=ICON_RADII[a.file]+.15,'asset alpha remains within declared radius '+JSON.stringify(a));}await writeFile(artifacts+'icon-fit-source-alpha.json',JSON.stringify(assetBounds,null,2));
   }
   const revision=await p.locator('#map').getAttribute('data-revision');
   for(const expanded of [false,true]){
    if(expanded)await p.locator('#expand-map').click();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const measurements=await p.locator('.ship-node').evaluateAll(async nodes=>Promise.all(nodes.map(async node=>{
     const id=node.dataset.ship,art=node.querySelector('.ship-art'),image=art.querySelector('image'),canvas=document.createElement('canvas');canvas.width=canvas.height=480;const c=canvas.getContext('2d'),img=new Image();let blob;
     if(image)img.src=new URL(image.getAttribute('href'),location.href).href;else{blob=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 48 48" width="480" height="480">'+art.innerHTML+'</svg>'],{type:'image/svg+xml'}));img.src=blob;}
     await img.decode();const factor=480/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*factor,h=img.naturalHeight*factor;c.drawImage(img,(480-w)/2,(480-h)/2,w,h);if(blob)URL.revokeObjectURL(blob);const pixels=c.getImageData(0,0,480,480).data;let localRadius=0,count=0;
     // Independently inspect rendered alpha, not the transparent enclosing image box.
     for(let y=0;y<480;y++)for(let x=0;x<480;x++)if(pixels[(y*480+x)*4+3]){count++;for(const [dx,dy]of [[0,0],[1,0],[0,1],[1,1]])localRadius=Math.max(localRadius,Math.hypot((x+dx-240)/10,(y+dy-240)/10));}
     const current=document.querySelector('[data-ship="'+id+'"]'),m=current.querySelector('.ship-art').getScreenCTM(),world=document.querySelector('#scene').getScreenCTM(),apothem=26*Math.sqrt(3)/2*Math.hypot(world.a,world.b),hit=current.querySelector('.ship-hit').getBoundingClientRect();
     return {icon:current.dataset.icon,localRadius,opaquePixels:count,maxRadius:localRadius*Math.hypot(m.a,m.b),apothem,hitWidth:hit.width,hitHeight:hit.height,aspect:image?.preserveAspectRatio.baseVal.align,rotation:current.querySelector('.ship-glyph').getAttribute('transform')};
    })));
    for(const m of measurements){assert.ok(m.opaquePixels>0,'actual artwork decoded');assert.ok(m.localRadius<=iconRadius(m.icon,ICONS[m.icon].file)+.15,'conservative source radius '+JSON.stringify(m));assert.ok(m.maxRadius< m.apothem,'visible artwork strictly inside hex at rotation '+JSON.stringify(m));assert.ok(m.maxRadius<=.91*m.apothem+.01,JSON.stringify(m));assert.ok(m.hitWidth>=44&&m.hitHeight>=44,'unchanged usable hit target');assert.ok(Math.abs(m.hitWidth-50)<1&&Math.abs(m.hitHeight-50)<1);if(m.aspect!==undefined)assert.equal(m.aspect,6,'artwork preserves its native aspect ratio');}
    // Exercise real pointer/touch and keyboard selection without modifying encounter state.
    const target=p.locator('[data-ship="fit-7"] .ship-hit');if(width<500)await target.tap();else await target.click();assert.equal(await p.locator('[data-select="fit-7"]').getAttribute('aria-pressed'),'true');await p.locator('[data-ship="fit-0"]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-select="fit-0"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#map').getAttribute('data-revision'),revision);
    records.push({width,zoom,expanded,measurements});if(zoom>=1&&(width===1876||width===320))await p.screenshot({path:artifacts+'icon-fit-'+Math.round(zoom*100)+'-'+(expanded?'expanded-':'normal-')+width+'.png'});
   }
   if(await p.evaluate(()=>Array.isArray(window.__storageAccesses)))assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);
   }
 await writeFile(artifacts+'icon-fit-'+width+'.json' ,JSON.stringify(records,null,2));
 for(const expanded of [false,true])for(const icon of icons){const samples=records.filter(r=>r.expanded===expanded).map(r=>({zoom:r.zoom,...r.measurements.find(m=>m.icon===icon)}));for(let i=1;i<samples.length;i++){assert.ok(samples[i].maxRadius>samples[i-1].maxRadius,'icons visibly grow beyond old cap');assert.ok(Math.abs(samples[i].maxRadius/samples[i-1].maxRadius-samples[i].zoom/samples[i-1].zoom)<.02,'uniform zoom-proportional growth '+JSON.stringify({width,expanded,icon,before:samples[i-1],after:samples[i]}));}}
  }finally{await p.close();}
}

