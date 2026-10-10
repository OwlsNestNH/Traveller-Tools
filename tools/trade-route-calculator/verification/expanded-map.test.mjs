import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {MAP_GEOMETRY,setMapGeometry,visibleMapWorlds} from '../js/map-geometry.mjs?v=map-first-1';
import {camera,viewportTiles} from '../js/map-viewport.mjs';

const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function setMapExpanded('),app.indexOf('// Top-level service navigation'));
function harness({kind=null,route=null,cargo=false,busy=false}={}){
 const state={revision:17,actual:'0,0',route:['0,0','1,0'],bank:'10000',ledger:[{id:'paid-once'}]},bytes=JSON.stringify(state);
 const h={renders:0,closes:0,opens:[],focus:0,frames:[],geometry:0,areas:0,dialog:null,active:!!kind,kind,route,busy,preference:route?.receiptId?route:null};
 const context={state,mapExpanded:false,mapRestorePanel:null,cargoHoldOpen:cargo,tab:'Overview',mapZoom:1.2,mapPan:{x:24,y:16},mapAnchor:'1,0',view:'1,0',routeDraft:{mode:'manual',stops:['1,0'],path:['0,0','1,0']},
  services:{committing:()=>h.busy,active:()=>h.active,route:()=>h.route,close(options){assert.equal(options.render,false);h.closes++;h.active=false;h.route=null;h.preference=null;},open(kind,options){h.opens.push({kind,...options});h.active=true;h.route={kind,...options};h.preference=h.route;api.showOverviewPanels();h.renders++;}},
  rememberExpenseRoute:route=>h.preference=route,render:()=>h.renders++,queueMapGeometry:()=>h.geometry++,scheduleMapAreas:()=>h.areas++,requestAnimationFrame:callback=>h.frames.push(callback),document:{querySelector:()=>({focus:options=>{assert.equal(options.preventScroll,true);h.focus++;}})},
  modal:(title,body,submit,label,mutates,options)=>h.dialog={title,body,submit,label,mutates,options}
 };
 const api=runInNewContext(app.match(/^function showOverviewPanels\(.*$/m)[0]+'\n'+source+'\n({setMapExpanded,toggleMapExpanded,showOverviewPanels});',context);
 h.api=api;h.context=context;h.stable=()=>{assert.equal(JSON.stringify(state),bytes);assert.equal(context.mapZoom,1.2);assert.deepEqual(context.mapPan,{x:24,y:16});assert.equal(context.mapAnchor,'1,0');assert.equal(context.view,'1,0');assert.deepEqual(context.routeDraft,{mode:'manual',stops:['1,0'],path:['0,0','1,0']});};
 return h;
}

test('expansion is reversible view state, retaining map camera, selection, route draft and campaign',()=>{
 const h=harness();
 for(let i=0;i<5;i++){
  h.api.toggleMapExpanded();assert.equal(h.context.mapExpanded,true);assert.equal(h.dialog,null);h.stable();
  h.api.toggleMapExpanded();assert.equal(h.context.mapExpanded,false);h.stable();
 }
 h.frames.forEach(run=>run());assert.equal(h.focus,10);assert.equal(h.geometry,10);assert.equal(h.areas,10);
 const renders=h.renders;h.api.setMapExpanded(false);assert.equal(h.renders,renders,'Repeated explicit restore is inert');
});

test('unpaid stock and expense drafts require an explicit discard; Cancel leaves the live form untouched',()=>{
 for(const options of [{kind:'fuel'},{kind:'support'},{kind:'expenses',route:{kind:'mortgage'}},{kind:'expenses',route:{kind:'salary'}}]){
  const h=harness(options);h.api.toggleMapExpanded();
  assert.equal(h.context.mapExpanded,false);assert.equal(h.active,true);assert.equal(h.closes,0);assert.equal(h.renders,0);
  assert.equal(h.dialog.title,'Expand map?');assert.match(h.dialog.body,/discards its unsaved changes/);assert.match(h.dialog.body,/No payment/);
  assert.equal(h.dialog.label,'Discard draft and expand');assert.equal(h.dialog.mutates,false);assert.equal(h.dialog.options.retainRounding,true);assert.equal(h.dialog.options.annotateRounding,false);
  // Dismissal invokes no submit function, and opening the question has not
  // re-rendered/normalized the form or invalidated its service generation.
  h.stable();h.dialog.submit();assert.equal(h.closes,1);assert.equal(h.active,false);assert.equal(h.context.mapExpanded,true);
  h.api.toggleMapExpanded();assert.equal(h.context.mapExpanded,false);assert.equal(h.opens.length,0,'Discarded drafts are not silently recreated');h.stable();
 }
});

test('a payment still saving blocks direct and confirmed expansion',()=>{
 const h=harness({kind:'fuel',busy:true});
 assert.throws(()=>h.api.toggleMapExpanded(),/finish saving/);assert.throws(()=>h.api.setMapExpanded(true),/finish saving/);
 assert.equal(h.closes,0);assert.equal(h.context.mapExpanded,false);assert.equal(h.dialog,null);
 h.busy=false;h.api.toggleMapExpanded();h.busy=true;
 assert.throws(()=>h.dialog.submit(),/finish saving/);assert.equal(h.active,true);assert.equal(h.closes,0);h.stable();
});

test('paid expense receipt restores the same ledger ID and keeps its reload preference',()=>{
 const route={kind:'mortgage',receiptId:'paid-once'},h=harness({kind:'expenses',route});
 h.api.toggleMapExpanded();assert.equal(h.dialog,null);assert.equal(h.active,false);assert.deepEqual(h.preference,route);h.stable();
 h.api.toggleMapExpanded();assert.equal(h.context.mapExpanded,false);assert.deepEqual(h.opens,[{kind:'mortgage',receiptId:'paid-once'}]);assert.equal(h.preference.receiptId,'paid-once');h.stable();
});

test('Cargo Hold and expense overview can return without a draft or campaign mutation',()=>{
 const cargo=harness({cargo:true});cargo.api.toggleMapExpanded();assert.equal(cargo.context.cargoHoldOpen,false);cargo.api.toggleMapExpanded();assert.equal(cargo.context.cargoHoldOpen,true);cargo.stable();
 const expenses=harness({kind:'expenses',route:{kind:'expenses'}});expenses.api.toggleMapExpanded();assert.equal(expenses.dialog,null);expenses.api.toggleMapExpanded();assert.equal(expenses.opens[0].kind,'expenses');expenses.stable();
});

test('explicit service navigation restores normal layout and abandons the prior panel destination',()=>{
 const h=harness({cargo:true});h.api.toggleMapExpanded();h.context.tab='Trade';h.api.showOverviewPanels();
 assert.equal(h.context.mapExpanded,false);assert.equal(h.context.mapRestorePanel,null);assert.equal(h.context.tab,'Overview');h.stable();
});

test('full-unit expansion stays separate from campaign storage and keeps existing service guards',()=>{
 assert.match(app,/let mapExpanded=false,mapRestorePanel=null/);
 assert.match(app,/id="overview-navigation" class="panel navigation-panel"/);
 assert.match(app,/btn\(mapExpanded\?'Restore panels':'Expand map','map-expand'/);
 assert.match(app,/aria-expanded="'\+mapExpanded\+'" aria-controls="overview-navigation"/);
 assert.match(app,/mapExpanded\?'':services\.active\(\)\?services\.panel\(\)/);
 assert.match(app,/if\(services\.active\(\)&&!services\.committing\(\)\)throw Error\('Finish or cancel/);
 assert.match(css,/\.navigation-layout\.map-expanded\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/height:clamp\(620px,80svh,1100px\)/);assert.match(css,/height:clamp\(540px,80svh,1100px\)/);
 assert.doesNotMatch(source,/saveCampaign|act\(|localStorage|state\.[\w]+\s*=/);
});

test('larger geometry reveals more map at fixed camera, zoom and projected world spacing',()=>{
 const anchor={x:-111,y:-70},pan={x:137,y:-91},zoom=1.2,scale=50*zoom;
 const worlds=[];for(let x=-145;x<=-75;x++)for(let y=-110;y<=-30;y++)worlds.push({id:x+','+y,x,y});
 try{
  setMapGeometry(620,400);const center=camera(anchor,pan,zoom),normal=visibleMapWorlds(worlds,center,scale),tiles=viewportTiles(anchor,pan,zoom);
  const offset=world=>({x:(world.x-anchor.x)*scale*Math.sqrt(3)/2+pan.x,y:((world.y+((world.x%2+2)%2)*.5)-(anchor.y+((anchor.x%2+2)%2)*.5))*scale+pan.y-2});
  const before=normal.slice(0,2).map(offset);setMapGeometry(1100,800);
  assert.deepEqual(camera(anchor,pan,zoom),center);assert.deepEqual(normal.slice(0,2).map(offset),before);
  assert.ok(visibleMapWorlds(worlds,center,scale).length>normal.length);assert.ok(viewportTiles(anchor,pan,zoom).length>=tiles.length);
  assert.equal(MAP_GEOMETRY.originX,550);assert.equal(MAP_GEOMETRY.originY,398);
  setMapGeometry(620,400);assert.deepEqual(visibleMapWorlds(worlds,center,scale),normal);assert.deepEqual(viewportTiles(anchor,pan,zoom),tiles);
 }finally{setMapGeometry(520,320);}
});


test('Ship services advertise only mounted panel targets in each map mode',()=>{
 const code=app.slice(app.indexOf('function shipActions(){'),app.indexOf('function refuelShortcut('));
 for(const expanded of [false,true]){
  const html=runInNewContext(code+'\nshipActions();',{state:{initialized:true},tab:'Overview',mapExpanded:expanded,cargoHoldOpen:false,services:{selected:()=>null},campaignTimeCounter:()=>'',btn:(label,action)=>'<button data-action="'+action+'">'+label+'</button>'});
  assert.equal((html.match(/aria-pressed="false"/g)||[]).length,4);
  if(expanded)assert.doesNotMatch(html,/aria-controls=/);
  else assert.equal((html.match(/aria-controls="world-information-panel"/g)||[]).length,4);
 }
});
