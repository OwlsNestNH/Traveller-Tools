// Real Chromium coverage of the single approved 240% -> 288% close-zoom step.
// Only Traveller Map responses and a fresh local campaign are synthetic.
// Run: node verification/closer-map-zoom-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {campaignKey} from './fixtures/gui-parity.mjs';
import {expandedMapFixture} from './expanded-map-browser.test.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';

const widths=[1440,1100,390,320];
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const action=(page,name)=>page.locator('[data-action="'+name+'"]:visible').first();
const click=async(page,name)=>{await action(page,name).click();await frame(page);};
const zoom=page=>page.locator('.map-zoom-controls .help').textContent();
const near=(actual,expected,tolerance,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,label+': '+expected+' -> '+actual);
const panValues=camera=>camera.pan.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);

function sameCamera(actual,expected,label,{resized=false}={}){
 // Multiplying pan by 1.2 and its inverse may differ at floating-point epsilon.
 // Keep the shared real-projection checks, while comparing pan numerically.
 panValues(actual).forEach((value,i)=>near(value,panValues(expected)[i],.0001,label+' pan '+i));
 assertMapCameraUnchanged({...actual,pan:expected.pan,...(resized?{width:expected.width,height:expected.height}:{})},expected,label);
}
function centerUnchanged(actual,expected,label){
 for(const axis of ['x','y'])near(actual.center[axis],expected.center[axis],.0001,label+' geographic center '+axis);
 for(const axis of ['scaleX','scaleY'])near(actual[axis],1,.001,label+' unscaled SVG '+axis);
}
function closerCamera(actual,old,label){
 assert.equal(actual.zoom,'288%',label+' has the new maximum');
 near(actual.spacing,old.spacing*1.2,.15,label+' increases real world spacing by exactly one 1.2× step');
 panValues(actual).forEach((value,i)=>near(value,panValues(old)[i]*1.2,.0001,label+' scales nonzero pan '+i));
 centerUnchanged(actual,old,label);
 for(const dimension of ['width','height'])near(actual[dimension],old[dimension],.15,label+' keeps viewport '+dimension);
}
async function mode(page,expanded){
 await page.waitForFunction(value=>document.querySelector('[data-action="map-expand"]')?.getAttribute('aria-expanded')===String(value),expanded);
 await frame(page);await overviewGeometry(page,{markers:true,columns:!expanded});
 assert.equal(await action(page,'map-expand').textContent(),expanded?'Restore panels':'Expand map');
 assert.equal(await page.locator('.navigation-layout > .world-screen:visible').count(),expanded?0:1);
 assert.equal(await page.locator('#modal').isVisible(),false,'Layout and zoom never open a modal');
}
async function reset(page,ids,viewedId){
 await click(page,'map-zoom-reset');
 await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%'&&document.querySelector('.map-content')?.getAttribute('transform')==='translate(0 0)');
 const camera=await mapCameraSnapshot(page,ids),[x,y]=viewedId.split(',').map(Number);
 near(camera.center.x,x,.0001,'Reset recenters the viewed world horizontally');
 near(camera.center.y,y+((x%2+2)%2)*.5,.0001,'Reset recenters the viewed world vertically');
 assert.equal(await page.locator('.world-map .selected-world').getAttribute('data-arg'),viewedId);
 assert.equal(await page.locator('.world-uwp').count(),0,'Reset hides close-detail UWP at 100%');
 return camera;
}
async function oldMaximum(page){
 // Preserve the old reachable boundary instead of skipping straight to 249%.
 for(const expected of ['120%','144%','173%','207%','240%']){
  await click(page,'map-zoom-in');assert.equal(await zoom(page),expected,'The existing button path reaches '+expected);
 }
}
async function drag(page,ids){
 const before=await mapCameraSnapshot(page,ids);
 const point=await page.evaluate(()=>{
  const svg=document.querySelector('.world-map');svg.scrollIntoView({block:'center',behavior:'instant'});
  const b=svg.getBoundingClientRect();return {x:b.left+b.width*.6,y:b.top+b.height*.5};
 });
 await page.mouse.move(point.x,point.y);await page.mouse.down();
 // Pan left so both the browsed world and the adjacent actual ship remain
 // visible even in the 320px screenshot at the new maximum.
 await page.mouse.move(point.x-24,point.y+16,{steps:6});await page.mouse.up();await frame(page);
 const after=await mapCameraSnapshot(page,ids);
 assert.notEqual(after.pan,'translate(0 0)','Positive control: actual pointer dragging produces nonzero pan');
 assert.ok(Math.hypot(after.center.x-before.center.x,after.center.y-before.center.y)>.1,'Dragging really changes the geographic center');
 return after;
}
async function pointAtMap(page){
 const point=await page.evaluate(()=>{
  const svg=document.querySelector('.world-map');svg.scrollIntoView({block:'center',behavior:'instant'});
  const b=svg.getBoundingClientRect();return {x:b.left+b.width*.5,y:b.top+b.height*.5};
 });
 await page.mouse.move(point.x,point.y);
}
async function controlWheel(page,delta){
 await pointAtMap(page);await page.keyboard.down('Control');
 try{await page.mouse.wheel(0,delta);await frame(page);}finally{await page.keyboard.up('Control');}
}
async function pinchWheel(page,delta){
 // Trackpad pinch is delivered as small pixel-mode Ctrl-wheel events. Exercise
 // that browser event contract through the real listener, without inventing
 // touchscreen/two-pointer support or replacing the implementation.
 const cancelled=await page.evaluate(delta=>{
  const svg=document.querySelector('.world-map'),b=svg.getBoundingClientRect();
  const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaMode:0,deltaY:delta,clientX:b.left+b.width/2,clientY:b.top+b.height/2});
  return !svg.dispatchEvent(event)&&event.defaultPrevented;
 },delta);
 assert.equal(cancelled,true,'Intentional trackpad-style Ctrl-wheel is consumed by the map');await frame(page);
}
async function pinchTo(page,ids,target,baseline,result){
 const delta=target==='288%'?-10:10,path=[];
 for(let i=0;i<16&&await zoom(page)!==target;i++){
  const before=await mapCameraSnapshot(page,ids);await pinchWheel(page,delta);
  const after=await mapCameraSnapshot(page,ids);path.push(after.zoom);
  centerUnchanged(after,baseline,'Small-delta Ctrl-wheel');
  assert.ok(after.spacing>=baseline.spacing-.15&&after.spacing<=baseline.spacing*1.2+.15,'Pinch stays within the old/new close-zoom interval');
  assert.ok(delta<0?after.spacing>before.spacing:after.spacing<before.spacing,'Pinch moves monotonically in its requested direction');
 }
 assert.equal(await zoom(page),target,'Small Ctrl-wheel deltas reach the exact '+target+' boundary');
 assert.ok(path.length>1,'Trackpad-style events cover intermediate zoom values');
 result.push({target,path});
}
async function routeView(page){
 return page.evaluate(()=>({
  text:document.querySelector('.planned-route').textContent,
  stops:[...document.querySelectorAll('.route-list [data-action="world"]')].map(el=>el.dataset.arg),
  jump:document.querySelector('.route-jump [data-action="jump"]')?.disabled,
  caption:document.querySelector('.map-caption strong')?.textContent
 }));
}
async function platformFontDiagnostics(page){
 // Diagnostic protocol reads happen after the synchronous live-SVG sample.
 // An async map repaint can detach a node between calls; report that instead
 // of turning optional font identification into a separate flaky test gate.
 const result={capture:'after live readability snapshot',fonts:{},errors:[]};let session;
 try{
  session=await page.context().newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');
  const {root}=await session.send('DOM.getDocument',{depth:0});
  for(const [label,selector]of [['name','.world-map .selected-world .world-name'],['uwp','.world-map .selected-world .world-uwp']]){
   try{
    const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
    if(!nodeId)throw Error('Current text node is unavailable');
    result.fonts[label]=(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
   }catch(error){result.errors.push({label,error:String(error.message||error)});}
  }
 }catch(error){result.errors.push({label:'session',error:String(error.message||error)});}
 finally{if(session)await session.detach().catch(error=>result.errors.push({label:'detach',error:String(error.message||error)}));}
 return result;
}
async function closeReadability(page,f){
 // This settles the document's current font loading/layout. It is not a
 // guarantee that generic family names retain one particular OS font face.
 const fontReadiness=await page.evaluate(async()=>{
  await document.fonts.ready;
  return {status:document.fonts.status,size:document.fonts.size,faces:[...document.fonts].map(font=>({family:font.family,status:font.status}))};
 });await frame(page);
 const viewed=f.state.worlds[f.state.route[0]],actualId=f.state.actual;
 const result=await page.evaluate(({viewedId,actualId})=>{
  const svg=document.querySelector('.world-map'),selected=svg.querySelector('.selected-world'),actual=svg.querySelector('[data-action="map-world"][data-arg="'+actualId+'"]');
  const box=element=>{const b=element.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const measure=element=>{
   const style=getComputedStyle(element),text=element.textContent;
   const typography=Object.fromEntries(['font','fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariantCaps','fontKerning','fontFeatureSettings','fontVariationSettings','letterSpacing','wordSpacing','textRendering','textAnchor','dominantBaseline'].map(key=>[key,style[key]]));
   let intrinsic=null;
   if(element.tagName.toLowerCase()==='text'){
    // Preserve intrinsic metrics as diagnostics, not a cross-sample invariant:
    // observed generic-monospace advances exactly matched DejaVu Sans Mono and
    // Liberation Mono despite identical computed CSS. The face-resolution
    // trigger is unverified. Real SVG bounds and semantic styles below test
    // the product contract without asserting OS font-cache identity.
    if(!style.font)throw Error('A complete computed SVG font is required for intrinsic measurement');
    const context=document.createElement('canvas').getContext('2d');
    context.font=style.font;
    context.fontKerning=style.fontKerning;context.fontStretch=style.fontStretch;context.fontVariantCaps=style.fontVariantCaps;
    context.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
    context.wordSpacing=style.wordSpacing==='normal'?'0px':style.wordSpacing;
    const metrics=context.measureText(text);
    intrinsic={font:context.font,...Object.fromEntries(['width','actualBoundingBoxLeft','actualBoundingBoxRight','actualBoundingBoxAscent','actualBoundingBoxDescent','fontBoundingBoxAscent','fontBoundingBoxDescent'].map(key=>[key,metrics[key]]))};
   }
   const matrix=element.getScreenCTM();
   return {text,font:parseFloat(style.fontSize),fill:style.fill,typography,intrinsic,scaleX:Math.hypot(matrix.a,matrix.b),scaleY:Math.hypot(matrix.c,matrix.d),...box(element)};
  };
  return {selectedId:selected.dataset.arg,actualId:actual.dataset.arg,map:box(svg),marker:box(selected.querySelector(':scope > circle')),
   name:measure(selected.querySelector('.world-name')),uwp:measure(selected.querySelector('.world-uwp')),title:selected.querySelector('title').textContent,
   icons:Object.fromEntries(['symbol-starport','symbol-gas-giant','symbol-naval','symbol-scout','zone-amber','symbol-selection'].map(name=>[name,measure(selected.querySelector('.'+name))])),
   actualFill:actual.querySelector(':scope > circle').getAttribute('fill'),shipFill:actual.querySelector('.symbol-ship').getAttribute('fill'),shipCount:svg.querySelectorAll('.symbol-ship').length,
   selectedFill:svg.querySelector('.selection-hex-fill').getAttribute('fill'),selectedOutline:svg.querySelector('.selection-hex-outline').getAttribute('stroke'),selectedCount:svg.querySelectorAll('.selected-world-hex').length,
   selectedStroke:selected.querySelector(':scope > circle').getAttribute('stroke'),level:svg.dataset.mapLevel,hexes:svg.querySelectorAll('.hex-grid text').length,
   uwpCount:svg.querySelectorAll('.world-uwp').length,nameCount:svg.querySelectorAll('.world-name').length};
 },{viewedId:viewed.id,actualId});
 assert.equal(result.selectedId,viewed.id);assert.notEqual(result.selectedId,result.actualId,'The browsed world remains distinct from the ship');
 assert.equal(result.name.font,14,'Close-zoom names remain 14 CSS pixels');
 assert.equal(result.uwp.font,10,'UWP remains the existing 10 CSS-pixel monospace label');
 assert.equal(result.uwp.text,viewed.overrideUWP,'Close labels retain the effective calculator UWP');
 assert.ok(result.name.width<=90&&result.name.width>0,'Long names remain bounded and measurable');
 assert.ok(result.title.includes(viewed.name),'The full synthetic world name remains available in its title');
 assert.ok(result.name.top>result.marker.bottom,'Name stays below the world marker');
 assert.ok(result.name.bottom<result.uwp.top,'World name and UWP do not overlap');
 for(const text of [result.name,result.uwp]){
  assert.ok(Number.isFinite(text.width)&&Number.isFinite(text.height)&&text.width>0&&text.height>0,'Live name/UWP glyph boxes have finite positive dimensions');
  assert.ok(text.left>=result.map.left&&text.right<=result.map.right&&text.top>=result.map.top&&text.bottom<=result.map.bottom,'The centered selected label stays fully readable inside the map');
 }
 assert.ok(result.name.font*result.name.scaleY>=12&&result.uwp.font*result.uwp.scaleY>=9,'Physical world/UWP type retains the existing 12px/9px readability floors');
 for(const [name,icon]of Object.entries(result.icons))assert.ok(icon.width>0&&icon.height>0,'Existing close-detail icon stays measurable: '+name);
 for(const detail of [result.name,result.uwp,...Object.values(result.icons)])for(const axis of ['scaleX','scaleY'])near(detail[axis],1,.001,'Close labels/icons retain their actual CSS-pixel scale');
 assert.equal(result.icons['symbol-starport'].font,15);assert.equal(result.icons['symbol-naval'].font,12);
 assert.equal(result.icons['symbol-starport'].text,'A','Published starport remains separate from the effective UWP override');
 assert.equal(result.shipCount,1);assert.equal(result.selectedCount,1);
 assert.equal(result.actualFill,'#62d3dd');assert.equal(result.shipFill,'#62d3dd');
 assert.equal(result.selectedFill,'#245d94');assert.equal(result.selectedOutline,'#80beff');assert.equal(result.selectedStroke,'#fff');
 near(result.marker.width,result.marker.height,.1,'World marker remains round');
 assert.equal(result.level,'world');assert.ok(result.hexes>0);assert.equal(result.uwpCount,result.nameCount,'Every rendered world keeps its UWP at close zoom');
 result.fontReadiness=fontReadiness;result.platformFonts=await platformFontDiagnostics(page);
 return result;
}
function sameDetails(actual,expected,label){
 const pairs=[...['name','uwp'].map(name=>[name,actual[name],expected[name]]),...Object.keys(expected.icons).map(name=>[name,actual.icons[name],expected.icons[name]])];
 for(const [name,current,previous]of pairs){
  assert.equal(current.text,previous.text,label+' preserves '+name+' content');
  assert.equal(current.font,previous.font,label+' preserves '+name+' font size');
  assert.equal(current.fill,previous.fill,label+' preserves '+name+' fill');
  assert.deepEqual(current.typography,previous.typography,label+' preserves every measured '+name+' text style');
  if(previous.intrinsic){
   const metrics=current.intrinsic,height=metrics?.actualBoundingBoxAscent+metrics?.actualBoundingBoxDescent;
   assert.ok(metrics&&Number.isFinite(metrics.width)&&metrics.width>0&&Number.isFinite(height)&&height>0,label+' has finite positive '+name+' intrinsic text dimensions');
  }else{
   for(const size of ['width','height'])near(current[size],previous[size],.1,label+' preserves '+name+' '+size);
  }
 }
}
async function screenshot(page,label,width,result){
 await frame(page);
 const clip=await page.evaluate(()=>{
  const map=document.querySelector('.map-viewport').getBoundingClientRect(),toolbar=document.querySelector('.map-toolbar').getBoundingClientRect();
  const x=Math.floor(Math.min(map.left,toolbar.left)+scrollX),y=Math.floor(map.top+scrollY);
  return {x,y,width:Math.ceil(Math.max(map.right,toolbar.right)+scrollX-x),height:Math.ceil(toolbar.bottom+scrollY-y)};
 });
 assert.ok(clip.width<=1440&&clip.height<=1600,'Evidence is bounded to the map and all zoom controls');
 const filename='closer-map-zoom-'+label+'-288-'+width+'.png';
 const buffer=await page.screenshot({path:artifacts+'/'+filename,fullPage:true,clip,animations:'disabled'});
 assert.ok(buffer.length<2*1024*1024,'Each compact PNG is under 2 MiB');
 result.screenshots.push({filename,bytes:buffer.length,clip});
}

async function runWidth(browser,width,report){
 const f=expandedMapFixture(),viewedId=f.state.route[0],viewed=f.state.worlds[viewedId];
 // Add known icon/override cases only to this isolated synthetic seed.
 Object.assign(viewed.raw,{Bases:'NS',Zone:'A'});viewed.zone='Amber';viewed.overrideUWP='B777777-A';
 Object.assign(f.apiWorlds.find(w=>w.WorldX===viewed.x&&w.WorldY===viewed.y),{Bases:'NS',Zone:'A'});
 f.bytes=JSON.stringify(f.state);
 const context=await browser.newContext({viewport:{width,height:1100},deviceScaleFactor:1});context.setDefaultTimeout(12000);
 const result={width,pass:false,checks:[],layouts:[],screenshots:[]};report.results.push(result);
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
 await context.route('https://travellermap.com/api/**',async route=>{
  const url=new URL(route.request().url());assert.equal(url.searchParams.get('milieu'),'M1105');
  if(url.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
  if(url.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
  if(url.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
  if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:url.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>url.searchParams.has('hex')?w.Hex===url.searchParams.get('hex'):w.WorldX===Number(url.searchParams.get('x'))&&w.WorldY===Number(url.searchParams.get('y'))):f.apiWorlds}});
  throw Error('Unexpected deterministic map request '+url.href);
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const camera=()=>mapCameraSnapshot(page,f.cameraIds);
 const unchanged=async label=>{
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),f.bytes,label+' preserves exact campaign bytes, route, actual world, ledger, cargo and Undo');
  assert.equal(await page.locator('.world-map .selected-world').getAttribute('data-arg'),viewedId,label+' preserves the browsed world');
 };
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForLoadState('networkidle');await mode(page,false);
  await page.locator('.route-list [data-action="world"][data-arg="'+viewedId+'"]').click();await frame(page);
  const route=await routeView(page),normal=await camera();assert.notEqual(viewedId,f.state.actual);
  for(const expanded of [false,true]){
   const label=expanded?'expanded':'normal',entry={mode:label,pinchPaths:[]};result.layouts.push(entry);
   if(expanded){const before=await camera();await click(page,'map-expand');await mode(page,true);sameCamera(await camera(),before,'Expand at 288%',{resized:true});}
   await reset(page,f.cameraIds,viewedId);await oldMaximum(page);const old=await drag(page,f.cameraIds);entry.old=old;
   const oldDetails=await closeReadability(page,f);entry.readability={old:oldDetails};
   await click(page,'map-zoom-in');const close=await camera();entry.close=close;closerCamera(close,old,label+' button zoom');
   const details=await closeReadability(page,f);entry.readability.close=details;sameDetails(details,oldDetails,label+' extra close step');
   await overviewGeometry(page,{markers:true,columns:!expanded});await screenshot(page,label,width,result);
   for(let i=0;i<3;i++){await click(page,'map-zoom-in');sameCamera(await camera(),close,label+' repeated maximum click '+i);}
   await click(page,'map-zoom-out');assert.equal(await zoom(page),'240%');sameCamera(await camera(),old,label+' button returns to old maximum');
   await controlWheel(page,-200);await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='288%');closerCamera(await camera(),old,label+' real Ctrl-wheel');
   for(let i=0;i<3;i++){await controlWheel(page,-200);sameCamera(await camera(),close,label+' Ctrl-wheel upper clamp '+i);}
   await controlWheel(page,200);await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='240%');sameCamera(await camera(),old,label+' Ctrl-wheel crosses back to 240%');
   await pinchTo(page,f.cameraIds,'288%',old,entry.pinchPaths);closerCamera(await camera(),old,label+' trackpad-style path');
   for(let i=0;i<3;i++){await pinchWheel(page,-10);sameCamera(await camera(),close,label+' pinch upper clamp '+i);}
   await pinchTo(page,f.cameraIds,'240%',old,entry.pinchPaths);sameCamera(await camera(),old,label+' pinch returns to 240%');
   await click(page,'map-zoom-in');await pointAtMap(page);const beforeScroll=await page.evaluate(()=>scrollY);
   await page.mouse.wheel(0,180);await page.waitForFunction(before=>scrollY>before,beforeScroll);await frame(page);
   sameCamera(await camera(),close,label+' ordinary wheel scroll leaves map camera unchanged');
   assert.deepEqual(await page.evaluate(()=>({width:innerWidth,ratio:devicePixelRatio})),{width,ratio:1},'Map wheel input never zooms the browser page');
   await page.getByLabel('Show UWP',{exact:true}).uncheck();await frame(page);assert.equal(await page.locator('.world-uwp').count(),0);sameCamera(await camera(),close,label+' UWP off');
   await page.getByLabel('Show UWP',{exact:true}).check();await frame(page);entry.readability.restored=await closeReadability(page,f);sameDetails(entry.readability.restored,oldDetails,label+' UWP restored');sameCamera(await camera(),close,label+' UWP on');
   assert.deepEqual(await routeView(page),route,label+' retains saved route stops, controls and browsing caption');await unchanged(label+' input paths');
   await reset(page,f.cameraIds,viewedId);await unchanged(label+' reset to 100%');
   await oldMaximum(page);await drag(page,f.cameraIds);await click(page,'map-zoom-in');assert.equal(await zoom(page),'288%');
   result.checks.push(label+': 240 -> 288 -> 240, repeated clamps, real Ctrl-wheel, small-delta trackpad-style Ctrl-wheel, ordinary page scrolling, readable details and reset');
  }
  const expandedClose=await camera();await click(page,'map-expand');await mode(page,false);sameCamera(await camera(),expandedClose,'Restore at 288%',{resized:true});
  const restored=await camera();near(restored.width,normal.width,.15,'Restore normal width');near(restored.height,normal.height,.15,'Restore normal height');
  await click(page,'map-expand');await mode(page,true);sameCamera(await camera(),restored,'Repeat expansion at 288%',{resized:true});
  await page.keyboard.press('Escape');await mode(page,false);sameCamera(await camera(),restored,'Escape restores the 288% camera');
  assert.deepEqual(await routeView(page),route);await unchanged('Restore and Escape');
  await click(page,'map-expand');await mode(page,true);await page.reload();
  await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForLoadState('networkidle');await mode(page,false);
  const reloaded=await camera();assert.equal(reloaded.zoom,'100%');assert.equal(reloaded.pan,'translate(0 0)');
  assert.equal(await page.locator('.world-map .selected-world').getAttribute('data-arg'),f.state.actual,'Reload returns to actual-world browsing');
  const [actualX,actualY]=f.state.actual.split(',').map(Number);near(reloaded.center.x,actualX,.0001,'Reload actual center x');near(reloaded.center.y,actualY+((actualX%2+2)%2)*.5,.0001,'Reload actual center y');
  near(reloaded.width,normal.width,.15,'Reload normal width');near(reloaded.height,normal.height,.15,'Reload normal height');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),f.bytes,'Reload preserves exact campaign bytes');
  assert.deepEqual((await routeView(page)).stops,route.stops,'Reload keeps the saved route');
  assert.deepEqual(errors,[],'No uncaught browser errors');result.checks.push('Expand/restore/Escape preserve close camera; reload returns to normal 100% at the actual world without campaign writes');result.pass=true;
  console.log('PASS: single closer-map zoom step in normal/expanded layouts at '+width+'px');
 }catch(error){
  result.error=String(error.stack||error);await page.screenshot({path:artifacts+'/closer-map-zoom-failure-'+width+'.png',fullPage:false}).catch(()=>{});throw error;
 }finally{
  // Successful runs retain small visual evidence; traces are diagnostic only.
  await context.tracing.stop(result.pass?{}:{path:artifacts+'/closer-map-zoom-'+width+'-trace.zip'});await context.close();
 }
}

async function main(){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(process.env.TRAVELLER_COMMIT)assert.equal(commit,process.env.TRAVELLER_COMMIT,'Test the exact requested PR head');
 await mkdir(artifacts,{recursive:true});
 const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
 const report={pass:false,commit,requestedCommit:process.env.TRAVELLER_COMMIT||null,browser:browser.version(),widths,oldMaximum:240,newMaximum:288,results:[]};
 try{
  for(const width of widths)await runWidth(browser,width,report);
  report.pngBytes=report.results.flatMap(result=>result.screenshots).reduce((sum,shot)=>sum+shot.bytes,0);assert.ok(report.pngBytes<16*1024*1024,'The complete eight-PNG visual set is under 16 MiB');
  report.pass=true;console.log('PASS: exact-commit 240%/288% browser regression, eight bounded screenshots, unchanged campaign/route and existing map details.');
 }finally{await writeFile(artifacts+'/closer-map-zoom-report.json',JSON.stringify(report,null,2));await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
