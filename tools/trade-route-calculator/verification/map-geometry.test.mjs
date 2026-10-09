import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MAP_GEOMETRY,setMapGeometry,visibleMapWorlds} from '../js/map-geometry.mjs?v=map-first-1';
import {camera,viewportTiles} from '../js/map-viewport.mjs';
import {visibleSectors,overviewMarkup} from '../js/map-overview.mjs';
import {readFile} from 'node:fs/promises';
const golden=JSON.parse(await readFile(new URL('./fixtures/map-geometry-baseline.json',import.meta.url),'utf8'));
const anchors=[{x:0,y:0},{x:-110,y:-70},{x:-111,y:-70}];
const pans=[{x:0,y:0},{x:-1234,y:456},{x:519,y:-321}];
const sectors=Array.from({length:81},(_,i)=>({name:'Sector '+i,x:i%9-8,y:Math.floor(i/9)-4}));
// Independent baseline equations, including original overscan and tile order.
function baselineTiles(anchor,pan,zoom){
 const scale=50*zoom,c={x:anchor.x-pan.x/(scale*Math.sqrt(3)/2),y:anchor.y+((anchor.x%2+2)%2)*.5-pan.y/scale};
 const rx=260/(scale*Math.sqrt(3)/2)+1,ry=160/scale+1,out=[];
 for(let x=Math.floor((c.x-rx+8)/16)*16;x<=Math.floor((c.x+rx+8)/16)*16;x+=16)
  for(let y=Math.floor((c.y-ry+8)/16)*16;y<=Math.floor((c.y+ry+8)/16)*16;y+=16)out.push({x,y,key:x+','+y});
 return out.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
}
test('shared logical viewport keeps the original dimensions and asymmetric projection center',()=>{
 assert.deepEqual(MAP_GEOMETRY,{width:520,height:320,halfWidth:260,halfHeight:160,originX:260,originY:158});
 assert.ok(Object.isFrozen(MAP_GEOMETRY));
});
test('visible-area tile loads retain exact bounds and ordering across parity, zoom and pan',()=>{
 for(const anchor of anchors)for(const pan of pans)for(const zoom of [.2,1,2.4])assert.deepEqual(viewportTiles(anchor,pan,zoom),baselineTiles(anchor,pan,zoom));
});
test('overview load radii remain the original viewport plus 20 logical pixels',()=>{
 for(const anchor of anchors)for(const pan of pans)for(const zoom of [.06,.16,.2,1,2.4]){
  const c=camera(anchor,pan,zoom),rx=280/(50*zoom*Math.sqrt(3)/2),ry=180/(50*zoom);
  const expected=sectors.filter(s=>32*s.x-.5<c.x+rx&&32*s.x+31.5>c.x-rx&&40*s.y-39.5<c.y+ry&&40*s.y+.5>c.y-ry).sort((a,b)=>Math.hypot(32*a.x+15.5-c.x,40*a.y-19.5-c.y)-Math.hypot(32*b.x+15.5-c.x,40*b.y-19.5-c.y));
  assert.deepEqual(visibleSectors(sectors,anchor,pan,zoom),expected);
 }
});
test('overview projection and label clipping match exact pre-preparation SVG snapshots',()=>{
 const {sectors,catalogs,scenarios}=golden;
 for(const scenario of scenarios){
  const svg=overviewMarkup({...scenario,sectors,catalogs:new Map(catalogs),measure:(text,size)=>text.length*size*.55});
  assert.equal(createHash('sha256').update(svg).digest('hex'),scenario.sha256,JSON.stringify(scenario));
 }
});

test('expanded Overview geometry drives tile loads, projection and clipping together',()=>{
 try{
  assert.equal(setMapGeometry(1000,440),true);
  assert.deepEqual(MAP_GEOMETRY,{width:1000,height:440,halfWidth:500,halfHeight:220,originX:500,originY:218});
  for(const anchor of anchors)for(const pan of pans)for(const zoom of [.2,1,2.4]){
   const tiles=viewportTiles(anchor,pan,zoom),c=camera(anchor,pan,zoom),scale=50*zoom;
   for(const dx of [-500,500])for(const dy of [-220,220]){
    const x=c.x+dx/(scale*Math.sqrt(3)/2),y=c.y+dy/scale;
    assert.ok(tiles.some(t=>Math.abs(x-t.x)<=8&&Math.abs(y-t.y)<=8),'All visible corners have a loaded area tile');
   }
  }
  const sample=golden.scenarios[0];
  const svg=overviewMarkup({...sample,sectors:golden.sectors,catalogs:new Map(golden.catalogs),measure:(text,size)=>text.length*size*.55});
  assert.notEqual(createHash('sha256').update(svg).digest('hex'),sample.sha256,'Expanded geometry changes projection or clipping instead of only CSS');
  assert.equal(setMapGeometry(1000,440),false,'Unchanged resize is a no-op');
  setMapGeometry(320,440);assert.equal(MAP_GEOMETRY.originX,160);assert.equal(MAP_GEOMETRY.height/50,8.8);
  assert.throws(()=>setMapGeometry(0,440),/Invalid/);
 }finally{setMapGeometry(520,320);}
});

test('expanded 20% viewport keeps every visible marker above the former 1500-world cap',()=>{
 const worlds=[];for(let x=-67;x<=67;x++)for(let y=-21;y<=21;y++)if((x+y)%3===0)worlds.push({id:x+','+y,x,y});
 try{
  setMapGeometry(1200,440);
  const visible=visibleMapWorlds(worlds,{x:0,y:0},10);
  assert.ok(visible.length>1500);assert.equal(visible.length,worlds.length);
  assert.ok(visible.some(w=>w.id===worlds.at(-1).id),'The last loaded visible world remains selectable');
  assert.equal(visibleMapWorlds([...worlds,{id:'outside',x:1000,y:0}],{x:0,y:0},10).length,visible.length,'Offscreen worlds are still culled');
 }finally{setMapGeometry(520,320);}
});

test('measured CSS-pixel bounds preserve spacing and panned center while expanding real visible geography',()=>{
 const anchor={x:-123,y:-70},neighbor={x:-124,y:-70},pan={x:37,y:-23},zoom=1.2,scale=50*zoom;
 const project=w=>({x:MAP_GEOMETRY.originX+pan.x+(w.x-anchor.x)*scale*Math.sqrt(3)/2,y:MAP_GEOMETRY.originY+pan.y+(w.y+((w.x%2+2)%2)*.5-anchor.y-((anchor.x%2+2)%2)*.5)*scale});
 const originalCamera=camera(anchor,pan,zoom);let first=null;
 try{
  for(const [width,height] of [[800,400],[800,1150],[800,610],[320,400],[1170,720]]){
   setMapGeometry(width,height);
   const a=project(anchor),b=project(neighbor),measurement={dx:b.x-a.x,dy:b.y-a.y,offsetX:a.x-width/2,offsetY:a.y-height/2};
   if(!first)first=measurement;else for(const key of Object.keys(first))assert.ok(Math.abs(measurement[key]-first[key])<1e-10,key+' is independent of the panel dimensions');
   assert.deepEqual(camera(anchor,pan,zoom),originalCamera,'The geographic center remains on the same panned coordinates');
   const tiles=viewportTiles(anchor,pan,zoom);
   for(const dx of [-width/2,width/2])for(const dy of [-height/2,height/2]){
    const x=originalCamera.x+dx/(scale*Math.sqrt(3)/2),y=originalCamera.y+dy/scale;
    assert.ok(tiles.some(t=>Math.abs(x-t.x)<=8&&Math.abs(y-t.y)<=8),'Every resized viewport corner is covered by requested map data');
   }
  }
  const distant={id:'-123,-62',x:-123,y:-62};
  setMapGeometry(800,400);assert.deepEqual(visibleMapWorlds([distant],originalCamera,scale),[]);
  setMapGeometry(800,1150);assert.deepEqual(visibleMapWorlds([distant],originalCamera,scale),[distant],'Extra vertical space reveals actual geography rather than magnifying the same viewport');
 }finally{setMapGeometry(520,320);}
});
