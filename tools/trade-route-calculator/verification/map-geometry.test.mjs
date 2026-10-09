import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MAP_GEOMETRY} from '../js/map-geometry.mjs';
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
