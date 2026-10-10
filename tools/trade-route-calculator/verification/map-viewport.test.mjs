import test from 'node:test';
import assert from 'node:assert/strict';
import {camera,viewportTiles,MapAreaCache} from '../js/map-viewport.mjs';
import {distance} from '../js/map.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('viewport loads cover visible hexes across parity, zoom and distant panning',()=>{
 for(const anchor of [{x:0,y:0},{x:-111,y:-70}])for(const zoom of [.2,1,2.4,2.88]){
  const pan={x:-1234,y:456},c=camera(anchor,pan,zoom),tiles=viewportTiles(anchor,pan,zoom);
  assert.ok(tiles.length<=24);
  for(let x=Math.floor(c.x-260/(50*zoom*.866));x<=Math.ceil(c.x+260/(50*zoom*.866));x++)for(let y=Math.floor(c.y-160/(50*zoom));y<=Math.ceil(c.y+160/(50*zoom));y++)assert.ok(tiles.some(t=>distance(t,{x,y})<=12));
 }
});
test('two concurrent requests, superseded queues dropped, failures retry and cache is bounded',async()=>{
 let active=0,peak=0,fail=true;const pending=[],calls=[];
 const cache=new MapAreaCache(t=>new Promise((resolve,reject)=>{calls.push(t.key);peak=Math.max(peak,++active);pending.push(()=>{active--;if(t.key==='bad'&&fail){fail=false;reject(Error('offline'));}else resolve([{id:t.key}]);});}),()=>{});
 const tiles=n=>Array.from({length:n},(_,i)=>({key:String(i),x:i*16,y:0}));
 cache.request(tiles(8));await tick();assert.equal(active,2);
 cache.request([{key:'bad',x:900,y:0}]);pending.splice(0).forEach(f=>f());await tick();assert.deepEqual(calls,['0','1','bad']);pending.splice(0).forEach(f=>f());await tick();assert.equal(cache.error,'offline');
 cache.request([{key:'bad',x:900,y:0}]);await tick();pending.splice(0).forEach(f=>f());await tick();assert.equal(cache.error,undefined);assert.equal(cache.pending,false);
 for(let i=10;i<50;i++){cache.request([{key:String(i),x:i*16,y:0}]);await tick();pending.splice(0).forEach(f=>f());await tick();}
 assert.equal(peak,2);assert.ok(cache.cache.size<=32);assert.deepEqual(Object.keys(cache.worlds),['49']);
});
