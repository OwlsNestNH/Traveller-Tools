// Focused local UI checks. Synthetic campaign and intercepted Traveller Map data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const report={commit:process.env.TRAVELLER_COMMIT||'local candidate',results:[]};
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const action=(page,name)=>page.locator('[data-action="'+name+'"]');
async function openBuild(page){await page.locator('#route-menu>summary').click();await action(page,'route-build').click();}
async function choose(page,id,key='Enter'){const world=page.locator('svg [data-action="map-world"][data-arg="'+id+'"]');await world.focus();assert.equal(await page.evaluate(id=>document.activeElement?.dataset.action==='map-world'&&document.activeElement?.dataset.arg===id,id),true,'Selected world owns keyboard focus');await page.keyboard.press(key);}
async function ready(page,count){await page.waitForFunction(count=>document.querySelectorAll('.route-draft>ol>li').length===count&&!document.querySelector('[data-action="route-save"]')?.disabled,count);}
try{
 for(const width of [1440,390,320]){
  const f=guiFixture();f.state.ship.fuel=configureFuel(200,80,60,0,2);
  f.state.policies=[{id:'correction-policy',lotId:'lot-opening',claims:[],status:'active',initialQuantity:'2',remainingQuantity:'2',insuredValue:'2000',remainingValue:'2000',coverage:70,route:f.state.route.slice(f.state.routeIndex),routeProgress:0,destination:f.state.route.at(-1)}];
  const prepared=S.prepareJump(f.state,()=>({dice:Array(6).fill(3),total:18}));
  f.state=S.transition(prepared.state,'Saved jump',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}));
  f.bytes=JSON.stringify(f.state);
  const ctx=await browser.newContext({viewport:{width,height:1100}});ctx.setDefaultTimeout(15000);
  await ctx.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
  let releaseStartup,markStartup;const startupResponse=new Promise(resolve=>releaseStartup=resolve),startupRequested=new Promise(resolve=>markStartup=resolve);let startupHeld=false;
  await ctx.route('https://travellermap.com/api/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
   if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
   if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
   if(u.pathname.endsWith('/jumpworlds')&&u.searchParams.get('jump')!=='0'&&!startupHeld){startupHeld=true;markStartup();await startupResponse;}
   if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
   return route.fulfill({json:{Sectors:[]}});
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const screenshot=label=>page.locator('.navigation-layout').screenshot({path:artifacts+'/route-editor-'+label+'-'+width+'.png'});
  try{
   await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
   const before=await read(page),bytes=await raw(page),ids=[before.actual,before.route[before.routeIndex+1]];
   await startupRequested;
   const startupWorld=page.locator('svg [data-action="map-world"][data-arg="'+ids[1]+'"]');
   await startupWorld.focus();await page.evaluate(()=>globalThis.focusedMapBeforeRefresh=document.activeElement);releaseStartup();
   await page.waitForFunction(()=>!globalThis.focusedMapBeforeRefresh.isConnected);
   assert.equal(await page.evaluate(id=>document.activeElement?.dataset.arg===id,ids[1]),true,'Startup nearby refresh preserves world keyboard focus');
   // Geometry-driven background paint replaces only the SVG, not the page.
   await startupWorld.focus();await page.evaluate(()=>globalThis.focusedMapBeforePaint=document.activeElement);
   await page.setViewportSize({width:width+10,height:1100});
   await page.waitForFunction(()=>!globalThis.focusedMapBeforePaint.isConnected);
   assert.equal(await page.evaluate(id=>document.activeElement?.dataset.arg===id,ids[1]),true,'Map repaint preserves world keyboard focus');
   await page.setViewportSize({width,height:1100});
   const camera=await mapCameraSnapshot(page,ids);await openBuild(page);
   await choose(page,ids[1]);await ready(page,1);await choose(page,before.route[before.routeIndex+2],' ');await ready(page,2);
   const order=await page.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect();return {previewTop:box('.planned-route').top,editorTop:box('.route-draft').top,editorBottom:box('.route-draft').bottom,controlsBottom:box('.world-correction').bottom};});
   assert.ok(order.editorBottom<=order.previewTop+.1,'Build Route precedes the separate Route Preview');assert.ok(order.controlsBottom<=order.editorTop+.1,'Editor follows map controls');assert.ok(await page.locator('.planned-route').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.world-correction').getBoundingClientRect().bottom-.1));
   assert.equal(await page.locator('.overview-cargo').count(),0);
   assert.match(await page.locator('.route-edit-stops button').first().textContent(),/Remove stop/);assert.ok(await page.locator('.route-world-details').first().textContent());
   assert.equal(await page.locator('.route-edit-origin button').count(),0,'Current origin cannot be removed');
   assert.match(await page.locator('.route-edit-origin').textContent(),/Current.*Fixed origin/);
   const rows=await page.locator('.route-edit-stops>li').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,width:r.width}}));
   assert.ok(rows[0].bottom<=rows[1].top+.1,'Future stops stack vertically');
   assert.ok(Math.abs(rows[0].left-rows[1].left)<.1&&Math.abs(rows[0].width-rows[1].width)<.1,'Rows fill the same width');
   assert.equal(await page.locator('.route-edit-stops [data-action="route-remove"]').first().getAttribute('data-arg'),'0');
   assert.equal(await page.locator('.route-edit-stops [data-action="route-remove"]').last().getAttribute('data-arg'),'1');
   assert.ok(await page.locator('.route-edit-stops .route-uwp').first().textContent());
   assert.ok(await page.locator('.route-edit-stops button').first().evaluate(el=>el.getBoundingClientRect().height>=44),'Remove stop remains a touch-sized action');
   assert.equal(await page.locator('.world-correction [data-action="route-clear"]').textContent(),'Clear Route');
   assert.match(await page.locator('.route-draft h3').textContent(),/Build route.*Planning active/);
   assert.equal(await page.locator('.route-draft>ol>li').count(),2);
   for(const name of ['route-remove','route-save','route-last','route-cancel'])assert.ok(await page.locator('.route-draft [data-action="'+name+'"]').count());
   const remove=page.locator('.route-draft>ol>li').last().locator('button');await remove.focus();await remove.press('Enter');await ready(page,1);
   await action(page,'route-last').click();assert.equal(await page.locator('.route-draft>ol>li').count(),0);
   await choose(page,ids[1]);await ready(page,1);await screenshot('planning');
   assertMapCameraUnchanged(await mapCameraSnapshot(page,ids),camera,'Planning retains fixed map geometry');
   // Many repeated occurrences and long synthetic names must remain full rows.
   for(let i=0;i<12;i++){await choose(page,ids[i%2]);await ready(page,i+2);}
   const many=await page.locator('.route-edit-stops>li').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width}}));
   for(let i=1;i<many.length;i++)assert.ok(many[i-1].bottom<=many[i].top+.1,'Many stops retain vertical order');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Long names and many rows do not widen the page');
   const previewBefore=await page.locator('.planned-route [data-action="world"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.arg));
   await page.locator('.route-edit-stops [data-action="route-remove"]').nth(3).click();await ready(page,12);
   assert.deepEqual(await page.locator('.planned-route [data-action="world"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.arg)),previewBefore.filter((_,index)=>index!==4),'Remove selects the exact repeated occurrence');
   await screenshot('many-stops');
   await action(page,'map-expand').click();await screenshot('planning-expanded');
   assert.equal(await page.locator('.route-edit-origin button').count(),0);assert.equal(await page.locator('.route-edit-stops>li').count(),12);
   await action(page,'map-expand').click();
   await action(page,'route-cancel').focus();await action(page,'route-cancel').press('Enter');assert.equal(await raw(page),bytes);
   await openBuild(page);await choose(page,ids[1]);await ready(page,1);await action(page,'route-save').click();await page.locator('#modal-submit').click();await closed(page);
   const planned=await read(page);assert.deepEqual(planned.route.slice(planned.routeIndex),[before.actual,ids[1]]);assert.equal(planned.actual,before.actual);
   await choose(page,ids[1]);const correction=action(page,'make-current-world');assert.equal(await correction.isDisabled(),false);
   await correction.focus();await correction.press('Enter');
   assert.equal(await page.locator('#modal-title').textContent(),'Make current world');
   assert.match(await page.locator('#modal-body').textContent(),new RegExp(f.state.worlds[ids[1]].hex));
   assert.match(await page.locator('#modal-body').textContent(),/planned route will be cleared/);
   await page.screenshot({path:artifacts+'/route-editor-confirmation-'+width+'.png',fullPage:true});
   await page.locator('#modal-cancel').click();assert.deepEqual(await read(page),planned);
   await correction.click();await page.locator('#modal-submit').click();assert.match(await page.locator('#modal-error').textContent(),/reason/);assert.deepEqual(await read(page),planned);
   await page.locator('[name="reason"]').fill('Synthetic GM location correction');await page.locator('#modal-submit').click();await closed(page);
   const corrected=await read(page);assert.equal(corrected.actual,ids[1]);assert.deepEqual(corrected.route,[ids[1]]);assert.equal(corrected.routeIndex,0);
   for(const key of ['hours','bank','lots','contracts','ledger','snapshots'])assert.deepEqual(corrected[key],planned[key],key);
   assert.deepEqual(corrected.ship.fuel,planned.ship.fuel);assert.equal(corrected.policies[0].status,'amendment-required');
   assert.ok(planned.events.every(e=>corrected.events.some(x=>x.id===e.id)));assert.ok(corrected.jumpAttempts.every(a=>a.closed));
   await screenshot('corrected');await action(page,'tab').filter({hasText:'History'}).click();await action(page,'undo').click();
   await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:campaignKey,revision:corrected.revision+1});
   const undone=await read(page);
   for(const key of ['actual','route','routeIndex','mandatoryStops','policies','hours','bank','lots','contracts','ledger','snapshots'])assert.deepEqual(undone[key],planned[key],key);
   assert.deepEqual(undone.jumpAttempts,corrected.jumpAttempts);assert.ok(undone.events.some(e=>e.label==='Starting-world / location correction'));
   await action(page,'tab').filter({hasText:'Overview'}).click();
   const restored=await mapCameraSnapshot(page,ids);await action(page,'map-expand').click();await overviewGeometry(page,{columns:false});await screenshot('expanded');
   assert.equal(await action(page,'map-expand').getAttribute('aria-expanded'),'true');await action(page,'map-expand').click();
   assertMapCameraUnchanged(await mapCameraSnapshot(page,ids),restored,'Restore panels retains map geometry');
   const frame=await page.locator('.navigation-layout').boundingBox();for(const name of ['refuel','refill-support','cargo-hold','ship-expenses']){await page.locator('#ship-actions [data-action="'+name+'"]').click();assertMapCameraUnchanged(await mapCameraSnapshot(page,ids),restored,'Fixed MFD '+name);const next=await page.locator('.navigation-layout').boundingBox();assert.ok(Math.abs(next.width-frame.width)<.2&&Math.abs(next.height-frame.height)<.2,'MFD frame stable');await page.locator('#ship-actions [data-action="'+name+'"]').click();}
   await screenshot('restored');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual((await read(page)).route,planned.route);
   const clear=page.locator('.world-correction [data-action="route-clear"]'),beforeClear=await read(page);
   await clear.click();assert.equal(await page.locator('#modal-title').textContent(),'Clear planned route');
   await page.locator('#modal-cancel').click();assert.deepEqual(await read(page),beforeClear);
   await clear.click();await page.locator('#modal-submit').click();await closed(page);
   const cleared=await read(page);assert.deepEqual(cleared.route,[beforeClear.actual]);assert.equal(cleared.actual,beforeClear.actual);
   for(const key of ['bank','hours','lots','ledger','contracts'])assert.deepEqual(cleared[key],beforeClear[key]);
   await action(page,'tab').filter({hasText:'History'}).click();await action(page,'undo').click();
   await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:campaignKey,revision:cleared.revision+1});
   assert.deepEqual((await read(page)).route,beforeClear.route);
   assert.deepEqual(errors,[]);report.results.push({width,pass:true,checks:['preview/editor/map order','keyboard add/remove/cancel','route save','correction confirmation/cancel/reason/save','state preservation','History Undo restores route/location/insurance','mulligan remains closed','fixed MFD','explicit map expansion/restoration','reload']});
  }catch(error){await screenshot('failure').catch(()=>{});throw error;}finally{await ctx.close();}
 }
 console.log('PASS: focused route editor and GM correction desktop/mobile checks at 1440, 390 and 320px.');
}finally{await writeFile(artifacts+'/route-editor-current-world-report.json',JSON.stringify(report,null,2));await browser.close();}
