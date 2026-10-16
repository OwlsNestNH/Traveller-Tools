import test from 'node:test';
import assert from 'node:assert/strict';
import {hexGrid,positions,distance} from '../js/map-adapter.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const center of [{x:0,y:0},{x:1,y:5},{x:-1,y:-8},{x:-119,y:-29}])for(let radius=1;radius<=4;radius++){
 test(`parsec hex geometry at ${center.x},${center.y}, radius ${radius}`,()=>{
  const cells=hexGrid(center,radius);assert.equal(cells.length,1+3*radius*(radius+1));
  const worlds=positions(cells.map(c=>c.world),center,radius);assert.equal(worlds.length,cells.length);
  for(const [i,cell] of cells.entries()){
   near(cell.x,worlds[i].x);near(cell.y,worlds[i].y);assert.ok(distance(center,cell.world)<=radius);
   for(let j=0;j<6;j++){
    const a=cell.vertices[j],b=cell.vertices[(j+1)%6];near(Math.hypot(a[0]-b[0],a[1]-b[1]),54/Math.sqrt(3));
    assert.ok(a.every(v=>v>=0&&v<=500),'grid stays within viewport');
   }
   for(const other of cells.filter(c=>distance(cell.world,c.world)===1)){
    near(Math.hypot(cell.x-other.x,cell.y-other.y),54);
    assert.equal(cell.vertices.filter(a=>other.vertices.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8)).length,2,'neighbors share an edge');
   }
  }
 });
}
test('grid rejects unsupported radii',()=>{for(const radius of [0,5,1.5])assert.throws(()=>hexGrid({x:0,y:0},radius),/radius/);});
