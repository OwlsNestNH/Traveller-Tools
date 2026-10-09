import assert from 'node:assert/strict';

// Measure the live SVG after ResizeObserver/requestAnimationFrame have settled.
// Height is intentionally not pinned: the map now balances the real right panel.
export async function overviewGeometry(page,{markers=false,columns=true}={}){
 await page.waitForFunction(()=>{
  const svg=document.querySelector('.world-map');if(!svg)return false;
  const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;
  return b.width>0&&b.height>0&&Math.abs(v.width-b.width)<.1&&Math.abs(v.height-b.height)<.1;
 });
 const result=await page.evaluate(()=>{
  const svg=document.querySelector('.world-map'),b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,m=svg.getScreenCTM();
  const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,overflow:el.scrollWidth-el.clientWidth};};
  const nav=document.querySelector('.navigation-panel'),right=document.querySelector('#service-panel')||document.querySelector('.world-screen'),toolbar=document.querySelector('.map-toolbar');
  return {map:box(svg),nav:box(nav),right:box(right),toolbar:box(toolbar),toolbarChildren:[...toolbar.querySelectorAll('button,summary,input,.map-zoom-hint')].map(box),logicalWidth:v.width,logicalHeight:v.height,backgroundWidth:Number(svg.querySelector(':scope > rect').getAttribute('width')),backgroundHeight:Number(svg.querySelector(':scope > rect').getAttribute('height')),scaleX:Math.hypot(m.a,m.b),scaleY:Math.hypot(m.c,m.d),circles:[...svg.querySelectorAll('[data-action="map-world"] circle')].map(box),viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.ok(Math.abs(result.logicalWidth-result.map.width)<.1,'Logical width follows the measured CSS-pixel viewport');
 assert.ok(Math.abs(result.logicalHeight-result.map.height)<.1,'Logical height follows the measured CSS-pixel viewport');
 assert.ok(Math.abs(result.backgroundHeight-result.logicalHeight)<.001,'The background covers the full logical height');
 assert.ok(Math.abs(result.scaleX-1)<.001&&Math.abs(result.scaleY-1)<.001,'Service layout cannot change the map pixel scale');
 assert.ok(Math.abs(result.backgroundWidth-result.logicalWidth)<.001,'The background covers the logical map');
 assert.ok(Math.abs(result.scaleX-result.scaleY)<.001,'Map geography is uniformly scaled');
 assert.ok(Math.abs(result.logicalWidth/result.logicalHeight-result.map.width/result.map.height)<.015,'Logical geometry follows the actual rendered map aspect');
 assert.ok(result.map.height>=299,'The map remains usable at narrow viewport widths');
 assert.ok(result.overflow<=2,'The whole page fits the viewport without horizontal scrolling');
 assert.ok(result.toolbar.top>=result.map.bottom-1,'The entire map toolbar is below the map');
 for(const child of result.toolbarChildren)if(child.width&&child.height){
  assert.ok(child.top>=result.map.bottom-1,'Each visible map control is entirely below the map');
  assert.ok(child.left>=-1&&child.right<=result.viewport+1,'Each map control stays inside the viewport');
 }
 if(markers){
  assert.ok(result.circles.length>=2,'Synthetic nearby worlds are available to check');
  assert.ok(result.circles.every(c=>Math.abs(c.width-c.height)<.1),'All world markers stay round');
 }
 if(columns&&result.right&&result.right.left>=result.nav.right-1){
  const ratio=result.nav.width/result.right.width;
  assert.ok(ratio>=1.4&&ratio<=1.8,`Desktop columns retain the approved map-heavy balance (left/right=${ratio.toFixed(2)})`);
  assert.ok(Math.abs(result.nav.bottom-result.right.bottom)<=2,'Navigation and right screen align along the bottom');
  assert.ok(Math.abs(result.nav.top-result.right.top)<=2,'Navigation and right screen align along the top');
 }
 for(const [name,box]of [['navigation',result.nav],['right screen',result.right],['toolbar',result.toolbar]])if(box){
  assert.ok(box.overflow<=2,name+' wraps inside its column');
  assert.ok(box.left>=-1&&box.right<=result.viewport+1,name+' stays inside the viewport');
 }
 return result;
}

// Use real projected world centers, not only the displayed percentage or the
// map-content transform: both stayed unchanged while the former SVG scale grew.
export async function mapCameraSnapshot(page,worldIds){
 await overviewGeometry(page);
 return page.evaluate(ids=>{
  const svg=document.querySelector('.world-map'),box=svg.getBoundingClientRect(),matrix=svg.getScreenCTM();
  const markers=ids.map(id=>{
   const circle=svg.querySelector('[data-action="map-world"][data-arg="'+id+'"] > circle');
   if(!circle)throw Error('Camera verification world is missing: '+id);
   const p=new DOMPoint(circle.cx.baseVal.value,circle.cy.baseVal.value).matrixTransform(circle.getScreenCTM());
   const [x,y]=id.split(',').map(Number);
   return {id,x,y:y+((x%2+2)%2)*.5,offset:{x:p.x-box.left-box.width/2,y:p.y-box.top-box.height/2}};
  });
  const [a,b]=markers,vector={x:b.offset.x-a.offset.x,y:b.offset.y-a.offset.y};
  const spacing=Math.hypot(vector.x,vector.y),worldSpacing=Math.hypot((b.x-a.x)*Math.sqrt(3)/2,b.y-a.y),pixelsPerParsec=spacing/worldSpacing;
  const scaleX=Math.hypot(matrix.a,matrix.b),scaleY=Math.hypot(matrix.c,matrix.d);
  return {zoom:document.querySelector('.map-zoom-controls .help').textContent,pan:svg.querySelector('.map-content').getAttribute('transform'),scaleX,scaleY,spacing,vector,markers,center:{x:a.x-a.offset.x/(pixelsPerParsec*Math.sqrt(3)/2),y:a.y-(a.offset.y+2*scaleY)/pixelsPerParsec},width:box.width,height:box.height};
 },worldIds);
}

export function assertMapCameraUnchanged(actual,expected,label){
 const near=(a,b,tolerance,detail)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${label}: ${detail} changed (${b} → ${a})`);
 assert.equal(actual.zoom,expected.zoom,label+': selected zoom is preserved');
 assert.equal(actual.pan,expected.pan,label+': nonzero pan is preserved');
 for(const key of ['scaleX','scaleY'])near(actual[key],expected[key],.001,key);
 near(actual.spacing,expected.spacing,.15,'rendered world-to-world pixel distance');
 for(const axis of ['x','y']){
  near(actual.vector[axis],expected.vector[axis],.15,'rendered world separation '+axis);
  near(actual.center[axis],expected.center[axis],.0001,'geographic viewport center '+axis);
 }
 assert.deepEqual(actual.markers.map(m=>m.id),expected.markers.map(m=>m.id));
 actual.markers.forEach((marker,i)=>{
  for(const axis of ['x','y'])near(marker.offset[axis],expected.markers[i].offset[axis],.15,'world '+marker.id+' offset from viewport center '+axis);
 });
}
