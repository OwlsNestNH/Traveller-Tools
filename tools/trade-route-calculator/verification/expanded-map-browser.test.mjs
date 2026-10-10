// Real Chromium regression coverage. Synthetic campaigns and map responses only.
// Run: node verification/expanded-map-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {campaignKey} from './fixtures/gui-parity.mjs';
import {serviceNavigationFixture} from './service-navigation-browser.test.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';

const widths=[1440,1100,390,320];
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const receiptRouteKey='traveller-expense-receipt-route';
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const action=(page,name)=>page.locator('[data-action="'+name+'"]:visible').first();
const header=(page,name)=>page.locator('#ship-actions > .ship-actions > [data-action="'+name+'"]');
const click=(page,name)=>action(page,name).click();
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const field=(page,name)=>page.locator('#service-form [name="'+name+'"],#expense-form [name="'+name+'"]');

// Dense synthetic geography ensures even the narrowest viewport exposes more
// actual worlds when it becomes taller. API-only worlds never alter seed bytes.
// Importing this file validates fixtures without loading or launching Chromium.
export function expandedMapFixture(){
 const f=serviceNavigationFixture();
 const grid=Array.from({length:32*26},(_,i)=>({
  Name:'Expansion survey '+i,Hex:String(1+i%32).padStart(2,'0')+String(1+Math.floor(i/32)).padStart(2,'0'),
  UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-128+i%32,WorldY:-79+Math.floor(i/32),Sector:'Verification Reach'
 }));
 f.apiWorlds=[...new Map([...grid,...f.apiWorlds].map(w=>[w.WorldX+','+w.WorldY,w])).values()];
 f.sec='Hex\tName\n'+f.apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n');
 return f;
}

function sameCamera(actual,expected,label){
 // Expansion intentionally changes only dimensions. Compare the real projected
 // geographic center, scale, world spacing/offsets, zoom and nonzero pan.
 assertMapCameraUnchanged({...actual,width:expected.width,height:expected.height},expected,label);
}
function sameDimensions(actual,expected,label){
 for(const key of ['width','height'])assert.ok(Math.abs(actual[key]-expected[key])<.2,label+': normal map '+key+' restored');
}
async function mode(page,expanded){
 await page.waitForFunction(value=>document.querySelector('[data-action="map-expand"]')?.getAttribute('aria-expanded')===String(value),expanded);
 await frame(page);
 const button=action(page,'map-expand');
 assert.equal(await button.textContent(),expanded?'Restore panels':'Expand map');
 assert.equal(await button.getAttribute('aria-controls'),'overview-navigation');
 assert.equal(await page.locator('#overview-navigation').count(),1,'The expanded-state control identifies one complete navigation panel');
 assert.equal(await page.locator('.navigation-layout > .world-screen:visible').count(),expanded?0:1,'Expanded mode hides the right screen; normal mode restores exactly one');
 assert.equal(await page.locator('#modal').isVisible(),false,'Layout-only toggles have no remaining modal');
 const missing=await page.evaluate(()=>[...document.querySelectorAll('[aria-controls]')].flatMap(el=>el.getAttribute('aria-controls').trim().split(/\s+/).filter(id=>!document.getElementById(id)).map(id=>({control:el.dataset.action||el.id,id}))));
 assert.deepEqual(missing,[],'Every emitted aria-controls reference resolves in '+(expanded?'expanded':'normal')+' mode');
 await overviewGeometry(page,{markers:true,columns:!expanded});
}
async function focusedAfterPaint(page,label){
 await page.waitForLoadState('networkidle');await frame(page);
 assert.equal(await action(page,'map-expand').evaluate(el=>el===document.activeElement),true,label+': toggle keeps focus after geometry and map-data repaint');
}
async function visibleWorlds(page){
 return page.locator('.world-map').evaluate(svg=>{
  const b=svg.getBoundingClientRect();
  return [...svg.querySelectorAll('[data-action="map-world"] > circle')].filter(circle=>{
   const p=new DOMPoint(circle.cx.baseVal.value,circle.cy.baseVal.value).matrixTransform(circle.getScreenCTM());
   return p.x>b.left+4&&p.x<b.right-4&&p.y>b.top+4&&p.y<b.bottom-4;
  }).map(circle=>circle.parentElement.dataset.arg).sort();
 });
}
async function fullNavigation(page,expanded){
 await overviewGeometry(page,{markers:true,columns:!expanded});
 const measured=await page.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const nav=document.querySelector('#overview-navigation');
  return {nav:box(nav),layout:box(nav.parentElement),parts:[...nav.querySelectorAll('.planned-route,.route-heading,.route-list,.map-caption,.map-viewport,.map-toolbar,.route-draft,.map-hint')].map(el=>({name:el.className,...box(el)})),controls:[...nav.querySelectorAll('button,input,summary')].filter(el=>el.getClientRects().length).map(el=>({name:el.dataset.action||el.id||el.textContent.trim(),...box(el)}))};
 });
 if(expanded){
  assert.ok(Math.abs(measured.nav.width-measured.layout.width)<1,'The entire navigation block spans the full layout width');
  assert.ok(Math.abs(measured.nav.left-measured.layout.left)<1,'Expanded navigation begins at the layout edge');
 }
 for(const part of [...measured.parts,...measured.controls]){
  assert.ok(part.left>=measured.nav.left-1&&part.right<=measured.nav.right+1,'Navigation child stays within its panel: '+part.name);
  assert.ok(part.top>=measured.nav.top-1&&part.bottom<=measured.nav.bottom+1,'Navigation child stays vertically inside its panel: '+part.name);
 }
 return measured;
}
async function reachable(page,selector){
 const control=page.locator(selector).first();await control.scrollIntoViewIfNeeded();await control.focus();await frame(page);
 const result=await control.evaluate(el=>{
  const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
  return {focused:document.activeElement===el,visible:x>=0&&x<innerWidth&&y>=0&&y<innerHeight,hit:!!hit&&(hit===el||el.contains(hit))};
 });
 assert.ok(result.focused&&result.visible&&result.hit,'Control remains keyboard reachable and unobscured: '+selector+' '+JSON.stringify(result));
}
async function primeCamera(page,ids){
 const original=await mapCameraSnapshot(page,ids);await click(page,'map-zoom-in');
 await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');
 const zoomed=await mapCameraSnapshot(page,ids);
 assert.ok(zoomed.spacing>original.spacing*1.19,'Positive control: explicit zoom increases real world spacing');
 const start=await page.locator('.world-map').evaluate(svg=>{
  svg.scrollIntoView({block:'center',behavior:'instant'});const r=svg.getBoundingClientRect();
  return {x:r.left+r.width*.65,y:r.top+r.height*.5,pan:svg.querySelector('.map-content').getAttribute('transform')};
 });
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+24,start.y+16,{steps:6});await page.mouse.up();
 await page.waitForFunction(before=>document.querySelector('.map-content')?.getAttribute('transform')!==before,start.pan);
 const panned=await mapCameraSnapshot(page,ids);
 assert.notEqual(panned.pan,'translate(0 0)');
 assert.ok(Math.hypot(panned.center.x-zoomed.center.x,panned.center.y-zoomed.center.y)>.1,'Positive control: dragging moves the geographic center');
 return panned;
}
async function draftSnapshot(page){
 return page.evaluate(()=>{
  const panel=document.querySelector('#service-panel,#expense-panel'),form=panel.querySelector('form');
  return {panel:panel.id,form:form?.id??null,token:form?.dataset.serviceToken??form?.dataset.expenseSession??null,
   fields:form?[...form.elements].map(el=>({name:el.name,value:el.value,checked:el.checked,disabled:el.disabled})):[],
   quote:panel.querySelector('#service-quote,#expense-quote')?.textContent??'',
   disclosures:[...panel.querySelectorAll('details')].map(el=>({label:el.querySelector('summary')?.textContent,open:el.open})),
   actions:[...panel.querySelectorAll('[data-action]')].map(el=>({...el.dataset}))};
 });
}
async function staleCommitHandlers(page){
 return page.evaluate(()=>({
  buttons:[...document.querySelectorAll('#service-panel [data-action="service-confirm"],#service-panel [data-action="service-review"],#expense-panel [data-action="expense-pay"]')].map(el=>({...el.dataset})),
  forms:[...document.querySelectorAll('#service-form,#expense-form')].map(el=>el.outerHTML)
 }));
}
async function replayHandlers(page,saved){
 await page.evaluate(async saved=>{
  for(const data of saved.buttons){const button=document.createElement('button');Object.assign(button.dataset,data);document.body.append(button);button.click();await new Promise(resolve=>setTimeout(resolve,0));button.remove();}
  for(const html of saved.forms){const template=document.createElement('template');template.innerHTML=html;const form=template.content.firstElementChild;form.hidden=true;document.body.append(form);form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));form.remove();}
 },saved);await frame(page);
}
async function openDraft(page,name){
 const stock=name.startsWith('support');await header(page,stock?'refill-support':name==='mortgage'?'ship-expenses':'refuel').click();
 if(name==='mortgage'){
  await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();await field(page,'payments').fill('3');
  await page.locator('.covered-payments > summary').click();await page.locator('.covered-payments tbody tr').nth(2).waitFor();
 }else if(stock){
  await click(page,'service-adjust');await field(page,'extraDays').fill('14');
  await page.locator('.service-comfort > summary').click();await field(page,'comfortCredits').fill('1000');await field(page,'comfortNote').fill('Keep this unsaved reserve');
  if(name==='support-review')await click(page,'service-review');
 }else{
  await field(page,'fuelTons').fill('7.25');await field(page,'fuelType').selectOption('custom');
  await field(page,'customFuelRate').fill('101.25');await field(page,'expenseNotes').fill('Keep this unsaved fuel draft');
 }
}
async function defaultDraft(page,name){
 await header(page,name.startsWith('support')?'refill-support':name==='mortgage'?'ship-expenses':'refuel').click();
 if(name==='mortgage'){await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();assert.equal(await field(page,'payments').inputValue(),'1');}
 else if(name.startsWith('support')){await click(page,'service-adjust');assert.equal(await field(page,'extraDays').inputValue(),'0');assert.equal(await field(page,'comfortCredits').inputValue(),'0');assert.equal(await field(page,'comfortNote').inputValue(),'');}
 else{assert.equal(await field(page,'fuelTons').inputValue(),'23');assert.equal(await field(page,'fuelType').inputValue(),'refined');assert.equal(await field(page,'expenseNotes').inputValue(),'');}
}
async function routeSnapshot(page){
 return page.evaluate(()=>({
  text:document.querySelector('.route-draft')?.textContent,
  stops:[...document.querySelectorAll('.route-list [data-action="world"]')].map(el=>el.dataset.arg),
  path:document.querySelector('.world-map polyline')?.getAttribute('points'),
  unavailable:document.querySelector('[data-action="route-save"]')?.disabled
 }));
}

async function runWidth(browser,width,report){
 const f=expandedMapFixture(),context=await browser.newContext({viewport:{width,height:1100}}),errors=[];
 const result={width,pass:false,checks:[]};report.results.push(result);context.setDefaultTimeout(12000);
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
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const unchanged=async(label,bytes=f.bytes)=>assert.equal(await raw(page),bytes,label+' preserves exact campaign bytes, ledger, stocks and Undo');
 const shot=label=>page.locator('.navigation-layout').screenshot({path:artifacts+'/expanded-map-'+label+'-'+width+'.png'});
 let viewedId=f.state.actual;
 const camera=async()=>{
  const snapshot=await mapCameraSnapshot(page,f.cameraIds);
  assert.equal(await page.locator('.world-map .selected-world').getAttribute('data-arg'),viewedId,'Map layout retains the selected viewed world without moving the ship');
  return snapshot;
 };
 const check=label=>result.checks.push(label);
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
  await mode(page,false);await unchanged('Initial load');
  if(width===1440){
   viewedId=f.state.route[0];await page.locator('.route-list [data-action="world"][data-arg="'+viewedId+'"]').click();
   assert.notEqual(viewedId,f.state.actual,'Desktop positive control browses a world other than the ship location');
  }
  let normal=await primeCamera(page,f.cameraIds),preserved=normal;
  const initialWorlds=await visibleWorlds(page);await shot('normal');
  await click(page,'map-expand');await mode(page,true);const expanded=await camera(),expandedWorlds=await visibleWorlds(page);
  sameCamera(expanded,preserved,'Expand zoomed and panned map');
  assert.ok(expanded.height>normal.height+100,'Expansion gives a taller viewport at every tested width');
  if(width>=1100)assert.ok(expanded.width>normal.width*1.4,'Desktop expansion increases viewport width substantially');
  else assert.ok(expanded.width>=normal.width-.2,'Mobile expansion never reduces map width');
  assert.ok(expanded.width*expanded.height>normal.width*normal.height*1.2,'Larger viewport reveals greater geographic area at constant scale');
  assert.ok(expandedWorlds.length>initialWorlds.length,'More real projected world centers are visible, not merely larger markers');
  assert.ok(initialWorlds.every(id=>expandedWorlds.includes(id)),'Expanded bounds retain all previously visible worlds');
  result.geometry={normal,expanded,normalWorldCount:initialWorlds.length,expandedWorldCount:expandedWorlds.length};
  await fullNavigation(page,true);assert.equal(await action(page,'jump').isEnabled(),true,'Jump remains enabled in expanded mode');
  for(const selector of ['[data-action="map-expand"]','#route-menu > summary','[data-action="map-zoom-in"]','.route-jump [data-action="jump"]'])await reachable(page,selector);
  await unchanged('Expanded controls');await shot('expanded');
  await click(page,'map-expand');await mode(page,false);sameCamera(await camera(),preserved,'Restore zoomed and panned map');sameDimensions(await camera(),normal,'Restore');
  check('Larger full navigation at unchanged scale, center, zoom, pan and world spacing; bounded accessible controls');

  // Standard keyboard actions retain focus even when the button is rerendered.
  await action(page,'map-expand').focus();
  for(let i=0;i<3;i++){
   await page.keyboard.press('Enter');await mode(page,true);
   assert.equal(await action(page,'map-expand').evaluate(el=>el===document.activeElement),true,'Expansion retains keyboard focus');
   await page.keyboard.press('Space');await mode(page,false);
   assert.equal(await action(page,'map-expand').evaluate(el=>el===document.activeElement),true,'Restoration retains keyboard focus');
   sameCamera(await camera(),preserved,'Repeated keyboard toggle '+i);sameDimensions(await camera(),normal,'Repeated keyboard toggle');
  }
  await click(page,'map-expand');await mode(page,true);await focusedAfterPaint(page,'Expanded keyboard control');await page.keyboard.press('Escape');await mode(page,false);await focusedAfterPaint(page,'Escape restoration');
  await unchanged('Keyboard and Escape restoration');check('Repeated Enter/Space and Escape restore the original map and focus');

  // A real browser viewport resize updates both map dimensions and its live
  // geometry without turning the selected zoom into an implicit fit-to-screen.
  await click(page,'map-expand');await mode(page,true);
  await page.setViewportSize({width,height:900});await mode(page,true);
  sameCamera(await camera(),preserved,'Resize while expanded');await fullNavigation(page,true);
  await page.setViewportSize({width,height:1100});await mode(page,true);
  await page.locator('#tabs [data-arg="Trade"]').click();await page.locator('.navigation-layout').waitFor({state:'detached'});
  await page.locator('#tabs [data-arg="Overview"]').click();await mode(page,false);
  sameCamera(await camera(),preserved,'Return after another main tab');sameDimensions(await camera(),normal,'Main-tab exit');
  await unchanged('Resizing and main-tab navigation');check('Live resizing retains camera; another main tab exits expansion');

  // Normal informational panels return to their previous screen without a
  // confirmation. Opening a service from expanded mode exits expansion.
  for(const [name,selector] of [['cargo-hold','#cargo-hold-panel'],['ship-expenses','.expense-table']]){
   await header(page,name).click();await page.locator(selector).waitFor();
   await click(page,'map-expand');await mode(page,true);await unchanged('Expand '+name);
   await click(page,'map-expand');await mode(page,false);await page.locator(selector).waitFor();
   assert.equal(await header(page,name).getAttribute('aria-pressed'),'true','Restored panel remains selected');
   sameCamera(await camera(),preserved,'Restore '+name);sameDimensions(await camera(),normal,'Restore '+name);
   await header(page,name).click();await page.locator('.world-screen.world-info').waitFor();
  }
  for(const name of ['refuel','refill-support','cargo-hold','ship-expenses']){
   await click(page,'map-expand');await mode(page,true);await header(page,name).click();await mode(page,false);
   assert.equal(await header(page,name).getAttribute('aria-pressed'),'true','Opening '+name+' exits expanded mode');
   await header(page,name).click();await page.locator('.world-screen.world-info').waitFor();await unchanged('Open '+name+' from expansion');
   sameCamera(await camera(),preserved,'Service exit '+name);sameDimensions(await camera(),normal,'Service exit '+name);
  }
  check('Cargo Hold and Expenses summary restore; all four service shortcuts exit expansion');

  // Route drafts are view state too: keep a chosen stop and its usable Save /
  // Cancel controls through both layouts, then add/remove a stop while expanded.
  await page.locator('#route-menu > summary').click();await click(page,'route-build');
  await page.locator('.world-map [data-action="map-world"][data-arg="'+f.state.route[2]+'"] > circle').click();
  await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);
  const planned=await routeSnapshot(page),routeCamera=await camera();
  await click(page,'map-expand');await mode(page,true);const expandedPlan=await routeSnapshot(page);
  assert.deepEqual({...expandedPlan,path:planned.path},planned,'Expansion preserves route draft text, selected worlds and validity');
  sameCamera(await camera(),routeCamera,'Expand route draft');await fullNavigation(page,true);
  for(const name of ['route-save','route-cancel','route-last'])await reachable(page,'[data-action="'+name+'"]');
  await page.locator('.world-map [data-action="map-world"][data-arg="'+f.state.route[0]+'"] > circle').click();
  await page.waitForFunction(()=>document.querySelectorAll('.route-draft > ol > li').length===2);
  await click(page,'route-last');await page.waitForFunction(()=>document.querySelectorAll('.route-draft > ol > li').length===1);
  await click(page,'map-expand');await mode(page,false);assert.deepEqual(await routeSnapshot(page),planned,'Restored route draft keeps the original path');
  await click(page,'route-cancel');await unchanged('Route planning in both layouts');sameCamera(await camera(),preserved,'Cancel route draft');
  check('Unconfirmed route draft and Save/Cancel controls survive both modes; map stop selection works expanded');

  // Stock edits/review and expense edits require explicit discard. Cancel and
  // Escape retain the same session token, every typed value and disclosure.
  for(const name of ['fuel','support-edit','support-review','mortgage']){
   await openDraft(page,name);const draft=await draftSnapshot(page),stale=await staleCommitHandlers(page);
   for(const dismiss of ['cancel','escape']){
    await click(page,'map-expand');await page.locator('#modal[open]').waitFor();
    assert.equal(await page.locator('#modal-title').textContent(),'Expand map?');
    assert.match(await page.locator('#modal-body').textContent(),/discard.*unsaved/i);
    assert.match(await page.locator('#modal-body').textContent(),/No payment will be made/i);
    assert.equal(await page.locator('#modal-submit').textContent(),'Discard draft and expand');
    assert.equal(await action(page,'map-expand').getAttribute('aria-expanded'),'false','Draft remains open until explicit confirmation');
    await unchanged(name+' before discard');
    if(dismiss==='cancel')await page.locator('#modal-cancel').click();else await page.keyboard.press('Escape');
    await mode(page,false);await focusedAfterPaint(page,name+' '+dismiss);assert.deepEqual(await draftSnapshot(page),draft,name+' '+dismiss+' keeps draft untouched');
    sameCamera(await camera(),preserved,name+' '+dismiss);await unchanged(name+' '+dismiss);
   }
   await click(page,'map-expand');await page.locator('#modal[open]').waitFor();await page.locator('#modal-submit').click();await mode(page,true);
   await focusedAfterPaint(page,name+' discard confirmation');
   assert.equal(await page.locator('#service-form,#expense-form').count(),0,'Confirmed discard unmounts unpaid form');
   await replayHandlers(page,stale);await unchanged(name+' discarded/stale callbacks');sameCamera(await camera(),preserved,name+' confirmed expansion');
   await click(page,'map-expand');await mode(page,false);await page.locator('.world-screen.world-info').waitFor();
   await defaultDraft(page,name);await replayHandlers(page,stale);await unchanged(name+' fresh draft rejects old tokens');
   await header(page,name.startsWith('support')?'refill-support':name==='mortgage'?'ship-expenses':'refuel').click();
   await page.locator('.world-screen.world-info').waitFor();
  }
  check('Fuel/support/edit-review/expense drafts require explicit discard; Cancel/Escape preserve them; stale commits stay inert');

  // Reload never restores the expanded flag or writes any campaign field.
  await click(page,'map-expand');await mode(page,true);await page.reload();viewedId=f.state.actual;
  await page.getByText('Editing in this tab',{exact:true}).waitFor();await mode(page,false);await page.locator('.world-screen.world-info').waitFor();
  await unchanged('Expanded reload');sameDimensions(await camera(),normal,'Reload from expansion');
  preserved=await primeCamera(page,f.cameraIds);normal=await camera();check('Expansion is session-only; reload returns to normal dimensions and World data');

  await header(page,'ship-expenses').click();await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();await field(page,'payments').fill('2');
  const obsolete=await staleCommitHandlers(page);
  // Real same-frame UI race: duplicate Pay and an expansion request may finish
  // as a receipt or expand after saving, but may never lose/replay the payment.
  // The native controller suite separately holds a deterministic busy interval.
  await page.evaluate(()=>{const pay=document.querySelector('[data-action="expense-pay"]');pay.click();pay.click();document.querySelector('[data-action="map-expand"]').click();});
  await page.waitForFunction(()=>document.querySelector('.expense-receipt')||document.querySelector('[data-action="map-expand"]')?.getAttribute('aria-expanded')==='true');await frame(page);
  assert.equal(await page.locator('#modal').isVisible(),false,'The Pay/expand race never discards an already saving payment');
  if(await action(page,'map-expand').getAttribute('aria-expanded')==='true')await click(page,'map-expand');
  await mode(page,false);await page.locator('.expense-receipt').waitFor();
  const paidBytes=await raw(page),paid=JSON.parse(paidBytes),receiptId=paid.ledger[0].id;
  assert.equal(paid.bank,'4800000');assert.equal(paid.revision,f.state.revision+1);assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);
  assert.equal(paid.ship.mortgage.remainingPayments,358);assert.equal(paid.ship.mortgage.nextDueDate,'085-1105');
  for(const key of ['actual','hours','route','routeIndex','lots','contracts'])assert.deepEqual(paid[key],f.state[key],'Payment leaves '+key+' unchanged');
  assert.deepEqual(paid.ship.fuel,f.state.ship.fuel,'Payment does not change fuel');
  const receiptText=await page.locator('.expense-receipt').textContent(),receiptPreference=await page.evaluate(key=>sessionStorage.getItem(key),receiptRouteKey);
  assert.equal(JSON.parse(receiptPreference).receiptId,receiptId,'Receipt reload preference names the actual ledger payment');
  for(let i=0;i<2;i++){
   await click(page,'map-expand');await mode(page,true);sameCamera(await camera(),preserved,'Expand paid receipt');
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),receiptRouteKey),receiptPreference,'Expansion retains paid receipt reload preference');
   await replayHandlers(page,obsolete);await unchanged('Expanded paid receipt stale callbacks',paidBytes);
   await click(page,'map-expand');await mode(page,false);await page.locator('.expense-receipt').waitFor();
   assert.equal(await page.locator('.expense-receipt').getAttribute('data-receipt-id'),receiptId);assert.equal(await page.locator('.expense-receipt').textContent(),receiptText);
   sameCamera(await camera(),preserved,'Restore paid receipt');sameDimensions(await camera(),normal,'Restore paid receipt');await unchanged('Restored paid receipt',paidBytes);
  }
  await shot('receipt');await click(page,'map-expand');await mode(page,true);await page.reload();
  await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('.expense-receipt').waitFor();await mode(page,false);
  assert.equal(await page.locator('.expense-receipt').getAttribute('data-receipt-id'),receiptId);assert.equal(await page.locator('.expense-receipt').textContent(),receiptText);
  sameDimensions(await camera(),normal,'Reload from expanded receipt');await unchanged('Expanded paid receipt reload',paidBytes);
  check('Paid receipt expands directly, restores identically and reloads normally without ledger replay or preference loss');

  // A genuine local JSON import can invalidate the saved receipt while its MFD
  // is hidden. Restoring must consult the current ledger, never replay payment.
  await click(page,'map-expand');await mode(page,true);
  const replacement=structuredClone(f.state);replacement.name='Synthetic replacement without the old payment';
  await page.locator('#import-file').setInputFiles({name:'synthetic-expanded-replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
  await page.locator('#modal[open]').waitFor();await page.locator('#modal-form [name="backed"]').check();await page.locator('#modal-submit').click();
  await page.locator('#modal').waitFor({state:'hidden'});const replacedBytes=await raw(page),replaced=JSON.parse(replacedBytes);
  assert.equal(replaced.name,replacement.name);assert.deepEqual(replaced.ledger,[]);assert.equal(replaced.bank,replacement.bank);
  await mode(page,true);await click(page,'map-expand');await mode(page,false);
  assert.equal(await page.locator('.expense-receipt').count(),0,'Removed ledger receipt is never resurrected');
  assert.equal(await page.locator('[data-action="expense-pay"]').count(),0,'Restoring a missing receipt never starts a new payment');
  assert.match(await page.locator('#expense-panel').textContent(),/no longer in the ledger/);
  assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),receiptRouteKey),null,'Missing receipt preference is retired');
  await replayHandlers(page,obsolete);await unchanged('Replacement receipt restoration and stale callbacks',replacedBytes);
  check('Campaign replacement while expanded invalidates the old receipt without recreating payment or mutating the replacement');
  assert.deepEqual(errors,[],'No uncaught browser errors');result.pass=true;
  console.log('PASS: expanded map geometry, camera, drafts, navigation and paid receipts at '+width+'px');
 }catch(error){result.error=String(error.stack||error);await shot('failure').catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/expanded-map-'+width+'-trace.zip'});await context.close();}
}

async function main(){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(process.env.TRAVELLER_COMMIT)assert.equal(commit,process.env.TRAVELLER_COMMIT,'Test the exact requested PR head');
 await mkdir(artifacts,{recursive:true});
 const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
 const report={pass:false,commit,requestedCommit:process.env.TRAVELLER_COMMIT||null,browser:browser.version(),widths,results:[]};
 try{for(const width of widths)await runWidth(browser,width,report);report.pass=true;console.log('PASS: expanded Overview navigation at four widths, preserved camera/routes, explicit unpaid discard and immutable paid receipts.');}
 finally{await writeFile(artifacts+'/expanded-map-report.json',JSON.stringify(report,null,2));await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
