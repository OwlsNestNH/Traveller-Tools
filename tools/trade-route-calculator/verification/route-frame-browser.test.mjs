// Deterministic exact-head browser verification; no user campaigns or live writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const widths=[1440,1100,390,320],counts=[0,1,5,12,30];
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]'));
const click=(page,name,arg)=>action(page,name,arg).filter({visible:true}).first().click();
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
function fixture(count){
 const f=guiFixture(30),all=[...f.state.route];
 f.state.route=all.slice(0,count);f.state.routeIndex=count>1?1:0;f.state.actual=f.state.route[f.state.routeIndex]||f.state.actual;
 validate(f.state);f.bytes=JSON.stringify(f.state);f.cameraIds=[f.state.actual,all.find(id=>id!==f.state.actual)];f.previewIds=[all[2],all[0]];return f;
}
async function geometry(page,count,{preview=false}={}){
 await overviewGeometry(page);
 const g=await page.evaluate(()=>{
  const route=document.querySelector('.planned-route'),style=getComputedStyle(route),box=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height,width:b.width,overflow:el.scrollWidth-el.clientWidth};};
  return {route:box(route),heading:box(route.querySelector('.route-heading')),list:box(route.querySelector('.route-list')),caption:box(document.querySelector('.map-caption')),map:box(document.querySelector('.map-viewport')),border:['Top','Right','Bottom','Left'].map(side=>parseFloat(style['border'+side+'Width'])),borderStyle:style.borderTopStyle,shadow:style.boxShadow,frameOwnsMap:!!route.querySelector('.world-map'),parts:[...route.querySelectorAll('.route-title,.route-jump,.route-next,.next-destination,.route-list,button')].map(box),overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.deepEqual(g.border,[1,1,1,1],'Single subtle one-pixel route border');assert.equal(g.borderStyle,'solid');assert.equal(g.shadow,'none');assert.equal(g.frameOwnsMap,false);
 assert.equal(await page.locator('.planned-route').getAttribute('aria-label'),preview?'Route preview':'Planned route');
 assert.equal(await page.locator('.planned-route .route-list > li').count(),count);
 assert.match(await page.locator('.planned-route .route-title > strong').textContent(),new RegExp((preview?'Route preview':'Planned route')+' · '+count+' '+(count===1?'stop':'stops')));
 assert.equal(await page.locator('.planned-route [data-action="jump"]').count(),1);assert.equal(await page.locator('.planned-route [data-action="jump-undo"]').count(),1);
 assert.ok(g.heading.bottom<=g.list.top+1,'Jump/Undo remain above the stop list');
 assert.ok(g.list.bottom<=g.route.bottom-1+.1&&g.route.bottom-g.list.bottom<=2,'Border ends directly after its content with no vacant height');
 assert.ok(g.caption.top>=g.route.bottom-1&&g.map.top>=g.route.bottom-1,'Caption/map stay outside and below the frame');assert.ok(g.overflow<=2,'Long names never widen the page');
 for(const part of g.parts){assert.ok(part.overflow<=2,'Route text wraps without clipping');assert.ok(part.left>=g.route.left-.1&&part.right<=g.route.right+.1,'Every route control stays inside the frame');}
 return g;
}
async function nameAndCompatibility(page,f){
 assert.equal(await page.title(),'Traveller Ship Operations');assert.equal(await page.locator('header h1').textContent(),'Traveller Ship Operations');assert.equal(await raw(page),f.bytes,'Rename/frame preserve original save bytes');
 const title=await page.locator('header h1').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,right:el.getBoundingClientRect().right,width:innerWidth}));assert.ok(title.overflow<=2&&title.right<=title.width+1,'Longer tool name stays readable on mobile');
}
async function changingContent(page,f,count){
 await click(page,'map-zoom-in');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');
 const start=await page.locator('.world-map').evaluate(svg=>{svg.scrollIntoView({block:'center',behavior:'instant'});const b=svg.getBoundingClientRect();return {x:b.left+b.width*.6,y:b.top+b.height*.5,pan:svg.querySelector('.map-content').getAttribute('transform')};});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+15,start.y+11,{steps:6});await page.mouse.up();await page.waitForFunction(before=>document.querySelector('.map-content')?.getAttribute('transform')!==before,start.pan);
 const baseline=await mapCameraSnapshot(page,f.cameraIds),checks=[];assert.equal(baseline.zoom,'120%');assert.notEqual(baseline.pan,'translate(0 0)');
 const stable=async label=>{const actual=await mapCameraSnapshot(page,f.cameraIds);assertMapCameraUnchanged(actual,baseline,label);checks.push({label,height:actual.height});};
 for(const name of ['cargo-hold','cargo-hold-close','ship-expenses','refuel','refill-support']){await click(page,name);await stable('Route frame with '+name);assert.equal(await raw(page),f.bytes,'Panel switching remains read-only');}
 await click(page,'service-back');await stable('Service closed');const saved=await geometry(page,count);
 await page.locator('#route-menu > summary').click();await click(page,'route-build');await geometry(page,1,{preview:true});await stable('Short draft');
 for(let i=0;i<6;i++){await click(page,'map-world',f.previewIds[i%2]);await page.waitForFunction(()=>!document.querySelector('.route-draft [data-action="route-save"]')?.disabled);}
 const expanded=await geometry(page,7,{preview:true});await stable('Expanded draft');
 for(let i=0;i<6;i++)await click(page,'route-last');
 const contracted=await geometry(page,1,{preview:true});assert.ok(contracted.route.height<expanded.route.height-20,'Removing draft stops shrinks the same live border');await stable('Contracted draft');
 await click(page,'route-cancel');const cancelled=await geometry(page,count);assert.ok(Math.abs(cancelled.route.height-saved.route.height)<1,'Cancel restores the original frame height');await stable('Cancelled draft');assert.equal(await raw(page),f.bytes,'Draft growth/removal/cancel keep save and Undo byte-identical');
 const width=(await page.viewportSize()).width;await page.screenshot({path:artifacts+'/route-frame-'+count+'-'+width+'-camera.png',fullPage:true});
 if(!await page.locator('#route-menu').evaluate(el=>el.open))await page.locator('#route-menu > summary').click();
 await click(page,'route-clear');await page.locator('#modal-cancel').click();await closed(page);assert.equal(await raw(page),f.bytes,'Cancelled clear retains all bytes');
 await click(page,'route-clear');await page.locator('#modal-submit').click();await closed(page);
 const clear=await geometry(page,1);assert.ok(clear.route.height<saved.route.height-20,'Clearing a saved route removes unused frame height');await stable('Cleared saved route');
 const cleared=JSON.parse(await raw(page));assert.deepEqual(cleared.route,[f.state.actual]);for(const key of ['actual','hours','bank','lots','contracts','policies'])assert.deepEqual(cleared[key],f.state[key],'Clear preserves '+key);
 await page.screenshot({path:artifacts+'/route-frame-shrunk-'+count+'-'+width+'.png',fullPage:true});
 await click(page,'tab','History');await click(page,'undo');await click(page,'tab','Overview');
 const restored=JSON.parse(await raw(page));assert.deepEqual(restored.route,f.state.route);assert.equal(restored.actual,f.state.actual);const grown=await geometry(page,count);assert.ok(Math.abs(grown.route.height-saved.route.height)<1,'Undo regrows the frame');await stable('Undo-restored saved route');
 return {baseline,checks,expanded,contracted};
}
await mkdir(artifacts,{recursive:true});const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),results=[];
try{
 for(const width of widths)for(const count of counts){
  const f=fixture(count),context=await browser.newContext({viewport:{width,height:1100}}),errors=[];context.setDefaultTimeout(12000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
  await context.route('https://travellermap.com/api/**',async route=>{
   const url=new URL(route.request().url());assert.equal(url.searchParams.get('milieu'),'M1105');
   if(url.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});if(url.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});if(url.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
   if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:url.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>url.searchParams.has('hex')?w.Hex===url.searchParams.get('hex'):w.WorldX===Number(url.searchParams.get('x'))&&w.WorldY===Number(url.searchParams.get('y'))):f.apiWorlds}});throw Error('Unexpected map request '+url.href);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await nameAndCompatibility(page,f);const initial=await geometry(page,count);
   assert.equal(await action(page,'jump').isDisabled(),count<3,'Jump eligibility follows saved route progress');assert.equal(await action(page,'jump-undo').isDisabled(),true,'A fixture without a jump has no jump Undo');for(const name of ['browse-prev','browse-next'])assert.equal(await action(page,name).count(),1,'Existing browse control remains');
   await page.screenshot({path:artifacts+'/route-frame-'+count+'-'+width+'.png',fullPage:true});
   let changes=null;if(count===30)changes=await changingContent(page,f,count);else{await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await nameAndCompatibility(page,f);await geometry(page,count);}
   assert.deepEqual(errors,[]);results.push({width,count,initial,changes});console.log('PASS: route frame '+count+' stops at '+width+'px');
  }catch(error){await page.screenshot({path:artifacts+'/route-frame-'+count+'-'+width+'-failure.png',fullPage:true}).catch(()=>{});throw error;}
  finally{await context.tracing.stop({path:artifacts+'/route-frame-'+count+'-'+width+'-trace.zip'});await context.close();}
 }
 for(const width of widths){const cases=results.filter(result=>result.width===width);assert.ok(cases.find(result=>result.count===30).initial.route.height>cases.find(result=>result.count===1).initial.route.height+50,'Thirty stops grow beyond a one-stop frame at '+width+'px');}
 await writeFile(artifacts+'/route-frame-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,widths,counts,results},null,2));console.log('PASS: 0/1/5/12/30 stops, mobile/desktop long names, live shrink and Undo growth, compatible saves, display name, controls and 120% nonzero-pan camera.');
}finally{await browser.close();}
