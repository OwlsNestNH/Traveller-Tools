import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate,SCHEMA} from '../js/state.mjs';
import {KEY} from '../js/persistence.mjs';

const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mapPanelSource=source.slice(source.indexOf('function mapPanel(){'),source.indexOf('\n// Keep one logical map unit'));

function render(stops,{preview=false}={}){
 const fixture=guiFixture(30),state=fixture.state;
 state.route=state.route.slice(0,stops);state.routeIndex=stops>1?1:0;state.actual=state.route[state.routeIndex]||state.actual;
 validate(state);
 const context={state,known:{},mapAreas:{worlds:{}},mapAnchor:state.actual,mapPan:{x:31,y:17},mapZoom:1.2,routeDraft:preview?{path:state.route}:null,MAP_GEOMETRY:{originX:400,originY:200,width:800,height:400},queueMapGeometry(){},updateMapGeometry(){},viewed:()=>state.worlds[state.actual],actual:()=>state.worlds[state.actual],world:id=>state.worlds[id],visibleMapWorlds:()=>[],camera(){},mapLevel:()=> 'world',showTerritories:false,showUwp:false,selectedWorldHex:()=>'',mapHexGrid:()=>'',mapRouteControls:()=>'<div class="route-draft"></div>',routeJumpControl:()=>'<button data-action="jump">Jump</button><button data-action="jump-undo">Undo Jump</button>',routeStops:()=>state.route.map(id=>'<li>'+escape(state.worlds[id].name)+'</li>').join(''),routeFuelAlert:()=>'',esc:escape,btn:(label,action,arg='')=>'<button data-action="'+action+'" data-arg="'+arg+'">'+escape(label)+'</button>'};
 const before=JSON.stringify(state),html=runInNewContext(mapPanelSource+'\nmapPanel();',context);
 assert.equal(JSON.stringify(state),before,'A route frame is presentation-only');
 assert.deepEqual(context.mapPan,{x:31,y:17},'Existing nonzero pan is untouched');
 return html;
}

test('the single light frame contains route heading, Jump/Undo and exactly the saved stops, excluding map and toolbar',()=>{
 for(const stops of [0,1,5,12,30]){
  const html=render(stops),frame=html.match(/<div class="planned-route"[^>]*>(.*?)<\/ol><\/div>/s)?.[1];
  assert.ok(frame,'One content-sized route frame renders');
  assert.equal((html.match(/class="planned-route"/g)||[]).length,1);
  assert.match(frame,new RegExp('Planned route · '+stops+' '+(stops===1?'stop':'stops')));
  assert.equal((frame.match(/<li>/g)||[]).length,stops);
  assert.match(frame,/data-action="jump"/);assert.match(frame,/data-action="jump-undo"/);
  assert.doesNotMatch(frame,/world-map|map-caption|map-toolbar|route-draft/);
  assert.ok(html.indexOf('class="map-caption"')>html.indexOf('</ol></div>'));
 }
 assert.match(render(5,{preview:true}),/class="planned-route" role="group" aria-label="Route preview"/);
});

test('frame uses normal content height, thin border, no shadow and the preserved desktop/mobile content gutters',()=>{
 const rule=css.match(/\.navigation-panel \.planned-route\{([^}]+)\}/)?.[1];
 assert.match(rule,/border:1px solid var\(--line\)/);assert.match(rule,/border-radius:4px/);
 assert.doesNotMatch(rule,/(?:^|;)(?:height|min-height|max-height|overflow|box-shadow|position):/);
 assert.match(css,/\.navigation-panel>\*\{flex-shrink:0\}/);
 assert.match(css,/\.navigation-panel \.route-heading\{padding:10px 3px;/);
 assert.match(css,/\.navigation-panel \.route-list\{padding:4px 3px 9px;/);
 assert.match(css,/\.navigation-panel \.planned-route\{margin-inline:6px\}/);
 // The new 7px margin + two 1px borders replace nine existing padding pixels.
 assert.equal(7+2+10+10+4+9,14+14+4+10);
 assert.equal(8+1+3,12);assert.equal(6+1+2,9);assert.equal(6+1+1,8);
});

test('long route-planning names wrap in their existing preview without clipping or widening mobile layout',()=>{
 assert.match(css,/\.navigation-panel \.route-draft\{min-width:0;overflow-wrap:anywhere\}/);
 assert.match(css,/\.navigation-panel \.route-draft>ol>li\{min-width:0;max-width:100%\}/);
 assert.doesNotMatch(css.match(/\.navigation-panel \.route-draft\{([^}]+)\}/)?.[1]||'',/overflow:hidden|text-overflow/);
});

test('public name is consistent while URLs, storage keys, schema and fixture identities remain compatible',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const catalog=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
 assert.match(html,/<title>Traveller Ship Operations<\/title>/);
 assert.match(html,/<h1>Traveller Ship Operations<\/h1>/);
 assert.match(catalog,/<h2>Traveller Ship Operations — Alpha<\/h2>/);
 assert.match(catalog,/href="tools\/trade-route-calculator\/"/);
 for(const file of ['README.md','ARCHITECTURE.md','BACKLOG.md','HANDOFF.md','REQUIREMENTS.md','RULES_VERIFICATION.md']){
  const text=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.match(text,/^# Traveller Ship Operations/);
 }
 assert.match(await readFile(new URL('../js/report.mjs',import.meta.url),'utf8'),/TRAVELLER SHIP OPERATIONS - CAMPAIGN REPORT/);
 assert.equal(KEY,'traveller-trade-route-calculator:v1');assert.equal(campaignKey,KEY);assert.equal(SCHEMA,1);
 const fixture=guiFixture(30),bytes=fixture.bytes;assert.equal(JSON.stringify(validate(JSON.parse(bytes))),bytes,'Old-named campaign fixtures load byte-for-byte');
});
