import test from 'node:test';
import assert from 'node:assert/strict';
import {MIN_MAP_ZOOM,mapLevel,nextMapZoom,sectorBounds,visibleSectors,MapOverviewCache,overviewMarkup,overviewLabelLayout} from '../js/map-overview.mjs';
import {camera} from '../js/map-viewport.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const spin={name:'Spinward Marches',x:-4,y:-1},regina={x:-110,y:-70};
const sectors=Array.from({length:81},(_,i)=>({name:'Sector '+i,x:i%9-8,y:Math.floor(i/9)-4}));
const measure=(text,size)=>text.length*size*.55;

test('new layers live below the preserved world range and stop at a readable widest scale',()=>{
 assert.equal(MIN_MAP_ZOOM,.06);
 for(const zoom of [.2,.5,1,2.4])assert.equal(mapLevel(zoom),'world');
 assert.equal(mapLevel(.199),'subsector');assert.equal(mapLevel(.16),'subsector');assert.equal(mapLevel(.159),'sector');
 assert.equal(nextMapZoom(.21,1/1.2),.2);assert.equal(nextMapZoom(.19,1.2),.2);
 assert.equal(nextMapZoom(.2,1/1.2),.2/1.2);assert.equal(nextMapZoom(.061,.1),.06);assert.equal(nextMapZoom(2.3,1.2),2.4);
 for(const zoom of [.2,.16])for(const anchor of [regina,{x:-111,y:-70}]){
  const pan={x:90,y:-40},next=nextMapZoom(zoom,1/1.2);
  const before=camera(anchor,pan,zoom),after=camera(anchor,{x:pan.x*next/zoom,y:pan.y*next/zoom},next);
  assert.ok(Math.abs(before.x-after.x)<1e-10&&Math.abs(before.y-after.y)<1e-10);
 }
});
test('official sector rectangles join across zero and negative coordinates',()=>{
 assert.deepEqual(sectorBounds(spin),{x:-128.5,y:-79.5,width:32,height:40});
 assert.deepEqual(sectorBounds({x:0,y:0}),{x:-.5,y:-39.5,width:32,height:40});
 for(let x=-2;x<2;x++)for(let y=-2;y<2;y++){
  const b=sectorBounds({x,y}),right=sectorBounds({x:x+1,y}),bottom=sectorBounds({x,y:y+1});
  assert.equal(b.x+b.width,right.x);assert.equal(b.y+b.height,bottom.y);
 }
 assert.ok(visibleSectors([spin],regina,{x:0,y:0},.16).includes(spin));
 assert.equal(visibleSectors([spin],regina,{x:10000,y:0},.16).length,0);
 assert.equal(visibleSectors([{name:'Missing coordinates'}],regina,{x:0,y:0},.06).length,0);
});
test('overview uses catalog names and exact world hex coordinates, then letters at sector scale',()=>{
 const catalogs=new Map([[spin.name,{subsectors:[{index:'C',mapName:'Regina'},{index:'J',mapName:'Sword Worlds'}],worlds:[{hex:'1910'},{hex:'1810'},{hex:'0101'},{hex:'3240'}]}]]);
 const svg=overviewMarkup({anchor:regina,pan:{x:0,y:0},zoom:.16,sectors:[spin],catalogs,measure});
 assert.match(svg,/class="subsector-name"/);assert.match(svg,/>Regina</);assert.match(svg,/cx="260" cy="158"/);
 assert.match(svg,/cx="253.0717967697245" cy="162"/); // odd negative x gets the +.5 stagger
 assert.equal((svg.match(/r=".8"/g)||[]).length,4);
 assert.doesNotMatch(svg,/data-action|tabindex|NaN|undefined|Subsector A/);
 const far=overviewMarkup({anchor:regina,pan:{x:0,y:0},zoom:.06,sectors:[spin],catalogs,measure});
 assert.match(far,/class="sector-name"/);assert.match(far,/Spinward/);assert.match(far,/Marches/);
 assert.equal((far.match(/class="subsector-letter"/g)||[]).length,16);assert.doesNotMatch(far,/r=".8"/);
 const hostile=overviewMarkup({anchor:regina,pan:{x:0,y:0},zoom:.06,sectors:[{...spin,name:'<img onload="evil">'}],catalogs,measure});
 assert.doesNotMatch(hostile,/<img/);assert.match(hostile,/&lt;img/);
});
test('overview fetches only relevant layers, drops stale queues and caps catalog concurrency/retention',async()=>{
 let active=0,peak=0;const calls=[],pending=[];
 const cache=new MapOverviewCache(async()=>sectors,name=>new Promise(resolve=>{
  calls.push(name);peak=Math.max(peak,++active);pending.push(()=>{active--;resolve({subsectors:[],worlds:[]});});
 }),()=>{});
 cache.request(regina,{x:0,y:0},1);await tick();assert.equal(cache.sectors,null);
 cache.request(regina,{x:0,y:0},.06);await tick();assert.equal(calls.length,0);assert.ok(cache.visible.length);
 cache.request(regina,{x:0,y:0},.16);await tick();assert.equal(active,2);
 cache.request(regina,{x:0,y:0},1);pending.splice(0).forEach(f=>f());await tick();assert.equal(calls.length,2);assert.equal(cache.pending,false);
 for(const s of sectors){
  cache.request({x:32*s.x+16,y:40*s.y-20},{x:0,y:0},.19);
  while(cache.pending){await tick();pending.splice(0).forEach(f=>f());await tick();}
 }
 assert.equal(peak,2);assert.ok(cache.cache.size<=48);
});
test('failures are visible and retryable; late universe response uses the latest view',async()=>{
 let resolveUniverse,fail=true;const names=[];
 const cache=new MapOverviewCache(()=>new Promise(resolve=>{resolveUniverse=resolve;}),async name=>{names.push(name);if(fail)throw Error('offline');return {subsectors:[],worlds:[]};},()=>{});
 cache.request(regina,{x:0,y:0},.16);await tick();cache.request(regina,{x:0,y:0},.06);
 resolveUniverse([spin]);await tick();assert.equal(names.length,0);
 cache.request(regina,{x:0,y:0},.16);await tick();assert.equal(cache.error,'offline');assert.equal(cache.pending,false);
 fail=false;cache.request(regina,{x:0,y:0},.16);await tick();assert.equal(cache.error,undefined);assert.equal(cache.pending,false);
 const bad=new MapOverviewCache(async()=>[{name:'No coordinates'}],async()=>{},()=>{});
 bad.request(regina,{x:0,y:0},.06);await tick();assert.match(bad.error,/coordinates/);assert.equal(bad.pending,false);
});
test('M1105 universe positions and genuine metadata names survive API parsing',async()=>{
 const original=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{urls.push(new URL(url));const path=new URL(url).pathname;return {ok:true,json:async()=>path.endsWith('/universe')?{Sectors:[{X:-4,Y:-1,Names:[{Text:'Spinward Marches'}],Milieu:'M1105'},{X:-4,Y:-1,Names:[{Text:'Future'}],Milieu:'M1120'}]}:path.endsWith('/metadata')?{Subsectors:[{Index:'C',Name:'Regina'}]}:'Hex\tName\n1910\tRegina\n'};};
 try{
  const m=await import('../js/map.mjs?overview-test');
  const list=await m.sectors();assert.equal(list.length,1);assert.deepEqual({x:list[0].x,y:list[0].y},{x:-4,y:-1});
  const data=await m.sectorOverview('Spinward Marches');assert.equal(data.subsectors[2].mapName,'Regina');assert.equal(data.subsectors[0].mapName,null);assert.equal(data.worlds[0].hex,'1910');
  assert.ok(urls.every(url=>url.searchParams.get('milieu')==='M1105'));
 }finally{globalThis.fetch=original;}
});

test('45-degree names fit their cells and preserve upright letter-only labels',()=>{
 for(const zoom of [.16,.18,.199]){
  const width=8*50*zoom*Math.sqrt(3)/2-8,size=Math.min(12,Math.max(9,(width+8)/4.8));
  for(const name of ['Regina','Sword Worlds','Ksits Usathu Odzuetarug','The Borderland']){
   const l=overviewLabelLayout(name,width,size,measure);assert.equal(l.angle,-45);
   assert.ok((l.width+l.height)/Math.SQRT2<=width+.01);assert.ok(l.size>=7.5);
  }
 }
 const letter=overviewLabelLayout('A',32,10,measure,0);assert.equal(letter.angle,0);
 const svg=overviewMarkup({anchor:regina,pan:{x:0,y:0},zoom:.06,sectors:[spin],catalogs:new Map(),measure});
 assert.match(svg,/class="sector-name"[^>]*transform="rotate\(-45 /);
 assert.doesNotMatch(svg,/class="subsector-letter"[^>]*transform=/);
});

test('one territory toggle loads metadata at close/sector zoom and upgrades only for subsector dots',async()=>{
 const calls=[],metadata={Borders:[{Allegiance:'ImDd',Path:'1910'}],Subsectors:[{Index:'C',Name:'Regina'}]};
 const cache=new MapOverviewCache(async()=>[spin],async(name,options)=>{
  calls.push({name,...options});return {metadata,subsectors:[],...(options.includeWorlds?{worlds:[]}:{} )};
 },()=>{});
 cache.request(regina,{x:0,y:0},2.4);await tick();assert.equal(cache.sectors,null);
 cache.request(regina,{x:0,y:0},2.4,true);await tick();await tick();
 assert.equal(calls.length,1);assert.equal(calls[0].includeWorlds,false);assert.equal(cache.pending,false);
 cache.request(regina,{x:0,y:0},.06,true);await tick();assert.equal(calls.length,1);
 cache.request(regina,{x:0,y:0},.17,true);await tick();
 assert.equal(calls.length,2);assert.equal(calls[1].includeWorlds,true);assert.equal(calls[1].metadata,metadata);
 assert.ok(Array.isArray(cache.cache.get(spin.name).worlds));assert.equal(cache.pending,false);
 cache.request(regina,{x:0,y:0},1,false);assert.equal(cache.wanted.length,0);
});

test('a failed obsolete world-table upgrade does not mask already loaded close-view borders',async()=>{
 let rejectUpgrade;const metadata={Borders:[]};
 const cache=new MapOverviewCache(async()=>[spin],async(name,{includeWorlds})=>includeWorlds?new Promise((resolve,reject)=>{rejectUpgrade=reject;}):{metadata,subsectors:[]},()=>{});
 cache.request(regina,{x:0,y:0},1,true);await tick();await tick();
 cache.request(regina,{x:0,y:0},.17,true);await tick();
 cache.request(regina,{x:0,y:0},1,true);rejectUpgrade(Error('world table offline'));await tick();
 assert.equal(cache.satisfied(spin.name),true);assert.equal(cache.error,undefined);assert.equal(cache.pending,false);
});

test('fresh border metadata survives an optional world-table failure and retries without refetching metadata',async()=>{
 const original=globalThis.fetch;let metadataCalls=0,tableCalls=0,rejectTable;
 globalThis.fetch=async url=>{
  if(new URL(url).pathname.endsWith('/metadata')){metadataCalls++;return {ok:true,json:async()=>({Subsectors:[{Index:'C',Name:'Regina'}],Borders:[{Allegiance:'ImDd',Path:'1910'}]})};}
  tableCalls++;if(tableCalls===1)return new Promise((resolve,reject)=>{rejectTable=reject;});
  return {ok:true,json:async()=>'Hex\tName\n1910\tRegina\n'};
 };
 try{
  const m=await import('../js/map.mjs?partial-metadata-test');
  const cache=new MapOverviewCache(async()=>[spin],(name,options)=>m.sectorOverview(name,options),()=>{});
  cache.request(regina,{x:0,y:0},.17,true);await tick();await tick();
  assert.equal(cache.cache.get(spin.name).metadata.Borders.length,1);assert.equal(cache.pending,true);
  cache.request(regina,{x:0,y:0},1,true);rejectTable(Error('World table offline'));await tick();
  assert.equal(cache.error,undefined);assert.equal(cache.pending,false);assert.equal(metadataCalls,1);
  cache.request(regina,{x:0,y:0},.17,true);await tick();
  assert.equal(metadataCalls,1);assert.equal(tableCalls,2);assert.equal(cache.cache.get(spin.name).worlds.length,1);assert.equal(cache.pending,false);
 }finally{globalThis.fetch=original;}
});
