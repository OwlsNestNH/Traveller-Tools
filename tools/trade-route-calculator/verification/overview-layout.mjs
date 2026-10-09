import assert from 'node:assert/strict';

// Measure the live SVG after ResizeObserver/requestAnimationFrame have settled.
// Height is intentionally not pinned: the map now balances the real right panel.
export async function overviewGeometry(page,{markers=false,columns=true}={}){
 await page.waitForFunction(()=>{
  const svg=document.querySelector('.world-map');if(!svg)return false;
  const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;
  return b.width>0&&b.height>0&&v.height===440&&Math.abs(v.width-b.width*440/b.height)<.15;
 });
 const result=await page.evaluate(()=>{
  const svg=document.querySelector('.world-map'),b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,m=svg.getScreenCTM();
  const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,overflow:el.scrollWidth-el.clientWidth};};
  const nav=document.querySelector('.navigation-panel'),right=document.querySelector('#service-panel')||document.querySelector('.world-screen'),toolbar=document.querySelector('.map-toolbar');
  return {map:box(svg),nav:box(nav),right:box(right),toolbar:box(toolbar),toolbarChildren:[...toolbar.querySelectorAll('button,summary,input,.map-zoom-hint')].map(box),logicalWidth:v.width,logicalHeight:v.height,backgroundWidth:Number(svg.querySelector(':scope > rect').getAttribute('width')),backgroundHeight:Number(svg.querySelector(':scope > rect').getAttribute('height')),scaleX:Math.hypot(m.a,m.b),scaleY:Math.hypot(m.c,m.d),circles:[...svg.querySelectorAll('[data-action="map-world"] circle')].map(box),viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.equal(result.logicalHeight,440,'The map retains its 440-unit logical height');
 assert.equal(result.backgroundHeight,440);
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
