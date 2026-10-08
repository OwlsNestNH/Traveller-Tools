import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {borderGeometry,sectorFootprint,territoryMarkup} from '../js/map-territory.mjs';

const origin={name:'Core',x:0,y:0},spin={name:'Spinward Marches',x:-4,y:-1};
const identity=(x,y)=>[x,y];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
const pointKey=p=>p.map(v=>Math.round(v*6)).join(',');
const edgeKey=(a,b)=>[pointKey(a),pointKey(b)].sort().join('|');
const polygonEdges=points=>points.map((point,i)=>[point,points[(i+1)%points.length]]);
const strokeEdges=geometry=>geometry.strokes.flatMap(points=>points.slice(1).map((p,i)=>[points[i],p]));
function contains(points,[x,y]){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function markup(Borders,other={},sector=origin,project=identity){
 return territoryMarkup({sectors:[sector],metadata:new Map([[sector.name,{Borders,...other}]]),project});
}
function hexCorners(x,y,sector=origin){
 const wx=32*sector.x+x-1,wy=40*sector.y+y-40+(x%2===0?.5:0);
 return [[-1/3,.5],[-2/3,0],[-1/3,-.5],[1/3,-.5],[2/3,0],[1/3,.5]].map(([a,b])=>[wx+a,wy+b]);
}
function outsideEdges(sector){
 // Independent oracle: cancel shared sides of all 1,280 individual hexes.
 const edges=new Map();
 for(let x=1;x<=32;x++)for(let y=1;y<=40;y++)for(const edge of polygonEdges(hexCorners(x,y,sector))){
  const k=edgeKey(...edge);if(edges.has(k))edges.delete(k);else edges.set(k,edge);
 }
 return edges;
}
function bufferLoop(){
 const hex=(x,y)=>String(x).padStart(2,'0')+String(y).padStart(2,'0'),path=[];
 for(let x=0;x<=33;x++)path.push(hex(x,0));
 for(let y=1;y<=41;y++)path.push(hex(33,y));
 for(let x=32;x>=0;x--)path.push(hex(x,41));
 for(let y=40;y>=0;y--)path.push(hex(0,y));
 return path.join(' ');
}

// Exact public M1105 metadata samples retrieved 2026-10-08. These deliberately
// retain repeated hexes and Deneb's missing repeated start; do not simplify.
const SWORD_PATH='0620 0720 0820 0921 1021 1121 1221 1322 1421 1522 1523 1524 1525 1526 1626 1627 1628 1529 1528 1427 1327 1227 1128 1129 1130 1129 1028 0928 0927 0926 0925 0924 0923 0922 0921 0820 0720 0620';
const DENEB_PATH='0001 0102 0201 0302 0402 0502 0602 0603 0604 0705 0805 0906 1006 1107 1206 1306 1405 1505 1605 1706 1805 1905 2005 2105 2205 2306 2405 2506 2606 2706 2805 2905 3005 3105 3204 3304 3303 3304 3305 3306 3307 3308 3309 3310 3311 3312 3313 3314 3315 3316 3317 3318 3319 3219 3119 3019 2920 2820 2721 2621 2522 2523 2423 2424 2425 2326 2226 2227 2228 2129 2130 2131 2031 1932 1933 1833 1834 1835 1736 1737 1637 1638 1639 1640 1541 1441 1341 1241 1141 1041 0941 0841 0741 0641 0541 0441 0341 0241 0141 0041 0040 0039 0038 0037 0036 0035 0034 0033 0032 0031 0030 0029 0028 0027 0026 0025 0024 0023 0022 0021 0020 0019 0018 0017 0016 0015 0014 0013 0012 0011 0010 0009 0008 0007 0006 0005 0004 0003 0002';
const STREND_PATH='0403 0503 0504 0505 0504 0403';

test('a single boundary hex renders its six actual corners and a complete six-edge stroke',()=>{
 const geometry=borderGeometry('0101',origin);
 assert.deepEqual(geometry.fill,hexCorners(1,1));
 assert.equal(geometry.fill.length,6);assert.equal(strokeEdges(geometry).length,6);close(area(geometry.fill),1);
 assert.ok(contains(geometry.fill,[0,-39]));
 assert.equal(pointKey(geometry.strokes[0][0]),pointKey(geometry.strokes[0].at(-1)));
 const svg=markup([{Path:'0101',Allegiance:'ImDd'}]);
 assert.match(svg,/<g class="map-territories" aria-hidden="true" pointer-events="none">/);
 assert.match(svg,/class="territory-fill"[^>]+fill="#e32736"[^>]+stroke="none"/);
 assert.match(svg,/class="territory-border"[^>]+vector-effect="non-scaling-stroke"/);
 assert.doesNotMatch(svg,/data-action|tabindex|<text|NaN|undefined/);
});

test('world projection preserves both parities and negative sector positions',()=>{
 for(const sector of [origin,spin,{name:'Negative',x:-1,y:-2},{name:'Positive',x:3,y:2}])for(const [x,y] of [[1,1],[2,1],[18,10],[19,10],[32,40]]){
  const path=String(x).padStart(2,'0')+String(y).padStart(2,'0');
  const polygon=borderGeometry(path,sector).fill,expected=hexCorners(x,y,sector);
  polygon.forEach((p,i)=>p.forEach((n,j)=>close(n,expected[i][j])));
 }
 const regina=borderGeometry('1910',spin).fill;
 close(regina.reduce((sum,p)=>sum+p[0],0)/6,-110);close(regina.reduce((sum,p)=>sum+p[1],0)/6,-70);
 const projection=(x,y)=>[260+(x+110)*43.30127018922193,158+(y+70)*50];
 const svg=markup([{Path:'1910'}],{},spin,projection);
 assert.doesNotMatch(svg,/NaN|Infinity/);assert.match(svg,/M245\.566243,183/);
});

test('sector clip exactly equals the outer edges of 1,280 hexes, never a rectangle',()=>{
 for(const sector of [origin,spin,{x:1,y:1}]){
  const polygon=sectorFootprint(sector),actual=new Set(polygonEdges(polygon).map(edge=>edgeKey(...edge))),expected=outsideEdges(sector);
  assert.equal(polygon.length,286);assert.deepEqual(actual,new Set(expected.keys()));close(area(polygon),1280);
 }
 const svg=markup([{Path:bufferLoop()}]);
 assert.match(svg,/<clipPath[^>]+clipPathUnits="userSpaceOnUse"><path d="/);
 assert.doesNotMatch(svg,/<rect|class="territory-border"/);
 assert.equal((svg.match(/stroke="none"/g)||[]).length,1);
});

test('repeated, retraced and unclosed paths stay ordered rather than being deduplicated or discarded',()=>{
 assert.deepEqual(borderGeometry('0101 0201',origin),borderGeometry('0101 0201 0101',origin));
 for(const path of [SWORD_PATH,DENEB_PATH,STREND_PATH,'3200 3300 3301 3201 3200 3200']){
  const geometry=borderGeometry(path,origin);assert.ok(geometry);assert.ok(area(geometry.fill)>0);
  assert.ok(geometry.fill.every(p=>p.every(Number.isFinite)));
  if(path!== '3200 3300 3301 3201 3200 3200')assert.notDeepEqual(geometry,borderGeometry([...new Set(path.split(' '))].join(' '),origin));
  for(const [a,b] of strokeEdges(geometry)){
   const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1]);
   assert.ok((Math.abs(dx-2/3)<1e-9&&dy===0)||(Math.abs(dx-1/3)<1e-9&&dy===.5),'only real hex edges may be stroked');
  }
 }
 const strend=borderGeometry(STREND_PATH,origin);
 assert.equal(strend.fill.length,16);close(area(strend.fill),4);
 assert.ok(contains(strend.fill,[4,-35])); // Retraced spur at 0505 is still enclosed.
 assert.equal(borderGeometry('0930',spin).fill.length,6); // Spinward's single-hex Imperial enclave.
 const deneb=borderGeometry(DENEB_PATH,{x:-3,y:-1});
 assert.ok(contains(deneb.fill,[-91,-49.5])); // Hex 0630, well inside the Imperial region.
 assert.ok(deneb.strokes.length>0);
});

test('buffer closure fills reach sector seams without creating seam strokes',()=>{
 const geometry=borderGeometry(bufferLoop(),origin);
 assert.equal(geometry.strokes.length,0);
 for(const x of [1,2,16,31,32])for(const y of [1,20,40]){
  const corners=hexCorners(x,y),center=[corners.reduce((s,p)=>s+p[0],0)/6,corners.reduce((s,p)=>s+p[1],0)/6];
  assert.ok(contains(geometry.fill,center));
 }
 const west={name:'West',x:-1,y:-1},east={name:'East',x:0,y:-1};
 const westPath='3110 3210 3310 3311 3312 3313 3213 3113 3112 3111 3110';
 const eastPath='0010 0110 0210 0211 0212 0213 0113 0013 0012 0011 0010';
 const a=borderGeometry(westPath,west),b=borderGeometry(eastPath,east);
 const westClip=outsideEdges(west),eastClip=outsideEdges(east),shared=new Set([...westClip.keys()].filter(k=>eastClip.has(k)));
 assert.ok(shared.size>0);
 for(const edge of [...strokeEdges(a),...strokeEdges(b)]){
  // At the top/bottom the political border itself crosses the zigzag seam.
  // Inside the continuous region there must be no sector-edge outline.
  const middle=(edge[0][1]+edge[1][1])/2;
  if(middle>-69.5&&middle<-67)assert.ok(!shared.has(edgeKey(...edge)),'a continuous region has no interior seam stroke');
 }
 assert.ok(contains(a.fill,[-1,-67.5]));assert.ok(contains(b.fill,[0,-68]));
 const svg=territoryMarkup({sectors:[west,east],metadata:new Map([[west.name,{Borders:[{Path:westPath}]}],[east.name,{Borders:[{Path:eastPath}]}]]),project:identity});
 assert.equal((svg.match(/<clipPath /g)||[]).length,2);
 assert.equal((svg.match(/class="territory-fill"/g)||[]).length,2);
 assert.equal((svg.match(/class="territory-border"/g)||[]).length,2);
});

test('hex footprints share exactly matching boundaries horizontally and vertically',()=>{
 const west=outsideEdges({x:-1,y:-1}),east=outsideEdges({x:0,y:-1}),south=outsideEdges({x:-1,y:0});
 const horizontal=[...west.keys()].filter(k=>east.has(k)),vertical=[...west.keys()].filter(k=>south.has(k));
 assert.equal(horizontal.length,79);assert.equal(vertical.length,63);
 for(const key of horizontal)assert.deepEqual(west.get(key).map(pointKey).sort(),east.get(key).map(pointKey).sort());
 for(const key of vertical)assert.deepEqual(west.get(key).map(pointKey).sort(),south.get(key).map(pointKey).sort());
});

test('official allegiance colors, exact-code stylesheet precedence and explicit border styles are supported safely',()=>{
 let svg=markup([{Path:'0101',Allegiance:'ImDd'},{Path:'0202',Allegiance:'DaCf'},{Path:'0303',Allegiance:'SwCf'}],{Stylesheet:'border { color: pink; } border.DaCf { color: lightblue; style: dashed; } route.SwCf { color: red; } border.SwCf { color: blue; style: dotted; }'});
 assert.match(svg,/data-allegiance="ImDd"[^>]+fill="#e32736"/);
 assert.match(svg,/data-allegiance="DaCf"[^>]+fill="lightblue"/);
 assert.match(svg,/data-allegiance="SwCf"[^>]+fill="blue"/);
 assert.match(svg,/stroke-dasharray="4 3"/);assert.match(svg,/stroke-dasharray="0.8 2.4"/);
 svg=markup([{Path:'0101',Allegiance:'ImDd',Color:'OliveDrab',Style:'None'}],{Stylesheet:'border.ImDd { color: blue; style: dashed; }'});
 assert.match(svg,/fill="olivedrab"/);assert.doesNotMatch(svg,/class="territory-border"/);
 svg=markup([{Path:'0101',Allegiance:'X'}],{Stylesheet:'/* ignored */ border.X, border.Y { color: #abcdef; } border.X { color: #123456; STYLE: DaShEd; }'});
 assert.match(svg,/fill="#123456"/);assert.match(svg,/stroke-dasharray="4 3"/);
 svg=markup([{Path:'0101',Allegiance:'As'},{Path:'0202',Allegiance:'ZhIN'},{Path:'0303',Allegiance:'Unknown'}]);
 assert.match(svg,/data-allegiance="As"[^>]+fill="yellow"/);assert.match(svg,/data-allegiance="ZhIN"[^>]+fill="blue"/);assert.match(svg,/data-allegiance="Unknown"[^>]+fill="gray"/);
});

test('untrusted metadata is escaped, raw CSS never emitted, and Regions never become territory',()=>{
 const sector={...origin,name:'A "><script>alert(1)</script>&\''};
 const svg=markup([{Path:'0101',Allegiance:'"><image href="evil"/>',Color:'url(https://evil.invalid/x)',Style:'dashed" onload="evil'}],{
  Stylesheet:'@import "evil"; border { color: url(https://evil.invalid); style: dotted; background-image: url(evil); } border.X { color: red" onload="evil; }',
  Regions:[{Path:'0202',Color:'red'}]
 },sector);
 assert.match(svg,/&lt;script&gt;/);assert.match(svg,/&lt;image/);
 assert.doesNotMatch(svg,/<script|<image|<style| style="| href="|https:|@import|background-image| onload="/);
 assert.match(svg,/fill="gray"/);assert.equal((svg.match(/class="territory-fill"/g)||[]).length,1);
 assert.equal(markup([],{Regions:[{Path:'0101',Color:'red'}]}),'');
 for(const path of ['',null,'0930 934','0101 <script>','3401','0142','13227'])assert.equal(borderGeometry(path,origin),null);
 assert.equal(markup([{Path:'0101'}],{},origin,()=>['0" onload="evil',0]),'');
 assert.equal(markup([{Path:'0101'}],{},origin,()=>[NaN,Infinity]),'');
 assert.equal(territoryMarkup({sectors:[],metadata:new Map(),project:identity}),'');
 assert.equal(markup([{Path:'0101'}],{},{name:'No position'}),'');
});

test('all captured M1105 borders render finite edge geometry, including Spinward, Deneb and Trojan',async t=>{
 const live=JSON.parse(await readFile(new URL('./fixtures/map-overview.json',import.meta.url),'utf8'));
 const sectors=[],metadata=new Map();let count=0;
 for(const [name,{metadata:data}] of Object.entries(live.catalogs)){
  const position=live.universe.Sectors.find(s=>s.Names[0].Text===name);
  const sector={name,x:position.X,y:position.Y};sectors.push(sector);metadata.set(name,data);
  for(const border of data.Borders){
   const geometry=borderGeometry(border.Path,sector);assert.ok(geometry,`${name}: ${border.Path}`);count++;
   assert.ok(geometry.fill.every(p=>p.every(Number.isFinite)));
   for(const [a,b] of strokeEdges(geometry)){
    const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1]);
    assert.ok((Math.abs(dx-2/3)<1e-9&&dy===0)||(Math.abs(dx-1/3)<1e-9&&dy===.5),`${name}: a false stroke chord`);
   }
  }
 }
 assert.equal(sectors.length,12);assert.equal(count,79);
 assert.equal(metadata.get('Spinward Marches').Borders.find(b=>b.Allegiance==='SwCf').Path,SWORD_PATH);
 assert.equal(metadata.get('Deneb').Borders.find(b=>b.Allegiance==='ImDd').Path,DENEB_PATH);
 assert.equal(metadata.get('Trojan Reach').Borders.find(b=>b.Allegiance==='StCl').Path,STREND_PATH);
 const svg=territoryMarkup({sectors,metadata,project:identity});
 assert.equal((svg.match(/class="territory-fill"/g)||[]).length,count);
 assert.equal((svg.match(/<clipPath /g)||[]).length,12);
 assert.doesNotMatch(svg,/NaN|Infinity|undefined|<text/);
 t.diagnostic(`Verified ${count} border walks across ${sectors.length} live M1105 sectors.`);
});
