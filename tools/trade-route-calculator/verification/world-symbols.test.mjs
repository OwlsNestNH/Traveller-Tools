import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {worldMapFacts,worldSymbols,selectedWorldHex,mapKeyMarkup} from '../js/world-symbols.mjs';
import {planetInformation} from '../js/planet-info.mjs';
const make=(raw={})=>({name:'Test',sector:'Test',hex:'0101',uwp:'C774622-5',zone:'Safe',gasGiants:3,raw});
test('published symbol data preserves unknown, explicit absence, and eHex counts',()=>{
 const missing=worldMapFacts(make());assert.equal(missing.gasGiants,null);assert.equal(missing.bases,null);assert.equal(missing.zone,null);assert.equal(missing.naval,null);
 const none=worldMapFacts(make({Bases:'',PBG:'000',Zone:''}));assert.equal(none.gasGiants,0);assert.equal(none.naval,false);assert.equal(none.scout,false);assert.equal(none.zone,'');
 assert.equal(worldMapFacts(make({PBG:'10J'})).gasGiants,18);
 assert.equal(worldMapFacts(make({UWP:'XXXXXXX-X'})).starport,null);
 assert.equal(worldMapFacts(make({UWP:'???????-?'})).starport,null);
 assert.equal(worldMapFacts(make({UWP:'X000000-0'})).starport,'X');
 assert.equal(planetInformation(make({UWP:'XXXXXXX-X',PBG:'000'})).summary.find(r=>r[0]==='Population')[1],'Not supplied');
 for(const value of [undefined,null,'?'])assert.equal(planetInformation(make({Bases:value})).system.find(r=>r[0]==='Bases')[1],'Not supplied');
 for(const value of ['',' ','-'])assert.equal(planetInformation(make({Bases:value})).system.find(r=>r[0]==='Bases')[1],'None recorded');
});
test('modern base codes do not conflate way stations, depots, or legacy codes',()=>{
 for(const bases of ['N','K','NS'])assert.equal(worldMapFacts(make({Bases:bases})).naval,true);
 for(const bases of ['D','O','A','B','F','H'])assert.equal(worldMapFacts(make({Bases:bases})).naval,false);
 assert.equal(worldMapFacts(make({Bases:'NS'})).scout,true);
 assert.equal(worldMapFacts(make({Bases:'KM',Allegiance:'ZhCo'})).naval,false);
 for(const bases of ['NW','W','V'])assert.equal(worldMapFacts(make({Bases:bases})).scout,false);
});
test('published starport and zones remain separate from effective calculator overrides',()=>{
 const world={...make({UWP:'C774622-5',Zone:'A',Bases:'NS',PBG:'101'}),overrideUWP:'X000000-0',zone:'Red'};
 const before=structuredClone(world),facts=worldMapFacts(world);assert.equal(facts.starport,'C');assert.equal(facts.zone,'A');
 const close=worldSymbols(world,100,200,{close:true,selected:true,actual:true,scale:120});
 for(const cls of ['symbol-starport','symbol-gas-giant','symbol-naval','symbol-scout','zone-amber','symbol-selection','symbol-ship'])assert.ok(close.includes(cls),cls);
 assert.ok(!worldSymbols(world,100,200,{close:false,scale:50}).includes('symbol-starport'));
 for(const [zone,expect] of [['U','A'],['F','R'],['G',''],['-',''],['?',null]])assert.equal(worldMapFacts(make({Zone:zone})).zone,expect);
 assert.deepEqual(world,before);assert.match(mapKeyMarkup(),/Political borders show allegiance territory, not travel zones/);
});

test('selected blue hex matches the approved paints and remains inset from the cell boundary',()=>{
 for(const scale of [10,24,40,50,120]){
  const x=132.5,y=-82.25,svg=selectedWorldHex(x,y,scale),factor=Math.min(1,scale/50);
  assert.match(svg,/class="selected-world-hex" aria-hidden="true"/);
  assert.match(svg,/fill="#245d94" fill-opacity="0\.42" stroke="none"/);
  assert.match(svg,/fill="none" stroke="#80beff"/);
  const polygons=[...svg.matchAll(/<polygon[^>]+points="([^"]+)"[^>]+>/g)];
  assert.equal(polygons.length,2);
  for(let layer=0;layer<2;layer++){
   const points=polygons[layer][1].split(' ').map(p=>p.split(',').map(Number));
   assert.equal(points.length,6);
   assert.ok(Math.abs(points.reduce((n,p)=>n+p[0],0)/6-x)<1e-9);
   assert.ok(Math.abs(points.reduce((n,p)=>n+p[1],0)/6-y)<1e-9);
   const radius=scale/Math.sqrt(3)-(layer===0?2:3)*factor;
   for(const [px,py] of points)assert.ok(Math.abs(Math.hypot(px-x,py-y)-radius)<1e-9);
   assert.ok(points[0][0]>x&&points[0][1]===y,'The hex uses the same flat-top projection as the map grid');
  }
  const stroke=Number(polygons[1][0].match(/stroke-width="([^"]+)"/)[1]);
  assert.equal(stroke,2*factor);
  assert.ok(3*factor*Math.sqrt(3)/2-stroke/2>0,'The whole outline, including its stroke, is inside the original cell');
  assert.doesNotMatch(svg,/data-action|tabindex|symbol-ship|symbol-starport/,'The highlight is decorative, separate from interactive worlds and symbols');
 }
 for(const args of [[NaN,0,50],[0,Infinity,50],[0,0,NaN],[0,0,0],[0,0,-10]])assert.equal(selectedWorldHex(...args),'');
});

test('map key explains the blue browsing hex separately from the actual cyan ship',()=>{
 const key=mapKeyMarkup();
 assert.match(key,/key-selected-world/);
 assert.match(key,/fill="#245d94" fill-opacity="0\.42" stroke="#80beff"/);
 assert.match(key,/blue hex marks the selected world; the cyan ship marks your actual location/);
 assert.match(key,/Browsing never moves the ship/);
 assert.equal((key.match(/<li>/g)||[]).length,8);
 assert.doesNotMatch(key,/symbol-selection/,'The selected-world legend uses the blue hex');
});

test('actual map rendering keeps the selection below routes, on the browsed world, and out of overview layers',async()=>{
 const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 const selected={...make({UWP:'C774622-5',Bases:'NS',PBG:'101'}),id:'1,1',x:1,y:1};
 const ship={...make(),name:'Ship world',id:'0,1',x:0,y:1};
 const state={actual:ship.id,worlds:{[selected.id]:selected,[ship.id]:ship},route:[ship.id,selected.id]};
 const before=structuredClone(state);
 const context={state,known:{},view:selected.id,showHexes:true,showUwp:true,showTerritories:true,mapZoom:2.4,mapPan:{x:0,y:0},mapAnchor:selected.id,routeDraft:null,
  core:{},world:id=>state.worlds[id],viewed:()=>state.worlds[context.view],actual:()=>ship,
  MAP_GEOMETRY:{width:520,height:440,halfWidth:260,halfHeight:220,originX:260,originY:218},
  mapAreas:{worlds:{}},mapOverview:{sectors:[],cache:new Map()},
  queueMapGeometry(){},updateMapGeometry(){},scheduleMapAreas(){},camera:()=>({x:1,y:1}),visibleMapWorlds:worlds=>worlds,
  mapLevel:zoom=>zoom<.2?'sector':'world',overviewMarkup:()=>'<g class="overview-grid"></g>',mapTerritories:()=>'<g class="map-territories"></g>',
  esc:value=>String(value),mapLabelMeasure:{font:'',measureText:text=>({width:text.length*7})},R:{context:world=>({uwp:{raw:world.uwp}})},
  worldSymbols,selectedWorldHex,mapRouteControls:()=>'',routeJumpControl:()=>'',routeStops:()=>'',routeFuelAlert:()=>'',btn:()=>'<button></button>'
 };
 const code=app.slice(app.indexOf('function mapHexGrid('),app.indexOf('const mapLabelMeasure='))+
  app.slice(app.indexOf('function mapWorldLabel('),app.indexOf('function worldScreen('))+
  app.slice(app.indexOf('function mapPanel('),app.indexOf('// Keep one logical map unit'));
 vm.createContext(context);vm.runInContext(code,context);
 const render=()=>vm.runInContext('mapPanel()',context);
 const svg=render(),highlight=svg.indexOf('class="selected-world-hex"'),route=svg.indexOf('<polyline'),marker=svg.indexOf('role="button"');
 assert.ok(svg.indexOf('class="map-territories"')<highlight);
 assert.ok(highlight<svg.indexOf('class="hex-grid"'),'The highlight does not dim hex-number labels');
 assert.ok(highlight>0&&highlight<route&&route<marker,'Selection paints below the route and every world marker');
 assert.equal((svg.match(/class="selected-world-hex"/g)||[]).length,1);
 assert.match(svg,/<g class="selected-world" role="button"[^>]*data-arg="1,1"/);
 assert.match(svg,/<g class="" role="button"[^>]*data-arg="0,1"[^]*?fill="#62d3dd"/);
 assert.equal((svg.match(/class="symbol-ship"/g)||[]).length,1);
 context.view=ship.id;
 const returned=render();
 assert.match(returned,/<g class="selected-world" role="button"[^>]*data-arg="0,1"/);
 assert.equal((returned.match(/class="symbol-ship"/g)||[]).length,1);
 context.mapZoom=.16;
 assert.doesNotMatch(render(),/class="selected-world-hex"/,'Sector overview keeps its own location treatment');
 assert.deepEqual(state,before,'Browsing, selecting the current world and overview zoom never mutate campaign state');
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/\.world-map \.selected-world-hex,\.world-map \.selected-world-hex \*\{pointer-events:none;cursor:inherit\}/);
 assert.match(css,/\.world-map \.selected-world \.world-name,\.world-map \.selected-world \.world-uwp\{fill:#fff\}/);
 assert.match(css,/\.world-map \.world-name,\.world-map \.world-uwp\{paint-order:stroke;stroke:#091b2a;stroke-width:2\.5px;stroke-linejoin:round\}/);
});
