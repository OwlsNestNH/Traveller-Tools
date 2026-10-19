import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const zoom=app.slice(app.indexOf('function zoomMap('),app.indexOf('\nfunction makeCurrentWorld('));
const paint=app.slice(app.indexOf('function paintMap('),app.indexOf('\nfunction requestMapAreas('));
for(const owner of ['cargo','sale','time','settings','none'])test('queued zoom respects '+owner+' publication boundary',()=>{
 const frames=[],calls={replacements:0,status:0,zoomLabel:null,levelLabel:null},old={replaceWith(){calls.replacements++;}},status={set textContent(v){calls.status++;}};
 const context={mapZoom:1,mapPan:{x:0,y:0},mapZoomFrame:0,worldNearbyRequest:null,mapDrag:null,tab:'Overview',cargoRemoval:{pending:false},saleWriteOperation:null,timeWriteOperation:null,settingsOperation:null,passengerWriteOperation:null,contractLifecycleWriteOperation:null,contractOfferWriteOperation:null,contactSearchWriteOperation:null,insuranceWriteOperation:null,purchaseWriteOperation:null,worldWriteOperation:null,undoOperation:null,replacementReview:null,expenseServices:{publicationDeferred:()=>false},accountsBusy:()=>false,plannedRoutePresentationHeld:()=>false,clearRoutePresentationHeld:()=>false,viewed:()=>({}),scheduleMapAreas(){},nextMapZoom:(z,f)=>z*f,requestAnimationFrame:fn=>(frames.push(fn),1),captureMapFocus:()=>null,restoreMapFocus(){},mapPanel:()=>'',mapLevel:()=> 'world',mapAreas:{},mapOverview:{},showTerritories:false,showUwp:true,showSubsectorNames:()=>false,$:id=>id==='map-load-status'?status:null,document:{querySelector:selector=>selector==='.world-map'?old:selector==='.map-zoom-controls'?{querySelector:selector=>selector==='.help'?{set textContent(v){calls.zoomLabel=v;}}:{set textContent(v){calls.levelLabel=v;}}}:null,createElement:()=>({querySelector:()=>({})})}};
 vm.createContext(context);vm.runInContext(zoom+'\n'+paint+'\nzoomMap(1.2);',context);assert.equal(frames.length,1);
 if(owner==='cargo')context.cargoRemoval.pending=true;if(owner==='sale')context.saleWriteOperation={pending:true};if(owner==='time')context.timeWriteOperation={publicationDeferred:true};if(owner==='settings')context.settingsOperation={pending:true};
 frames.shift()();assert.equal(calls.replacements,owner==='none'?1:0);assert.equal(calls.status,owner==='none'?1:0);assert.equal(calls.zoomLabel,owner==='none'?'120%':null);assert.equal(calls.levelLabel,owner==='none'?'Worlds':null);
});
