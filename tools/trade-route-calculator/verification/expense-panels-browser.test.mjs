// Deterministic Chromium checks against synthetic local campaigns only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const results=[],cameraReports=[];
try{
 for(const width of [1440,390,320]){
  const f=guiFixture(12),s=f.state;s.bank='765432';s.hours=48;s.dateLabel='001-1105';s.lots=[];s.contracts=[];s.snapshots=[];s.ledger=[];s.events=[];s.undo=[];
  // Keep the route compact so different right screens genuinely resize the
  // flex-grown map slot; GUI parity separately covers 12/30-stop layouts.
  s.route=s.route.slice(0,3);
  s.ship.fuel=configureFuel(200,43,20,0,2);s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:0};s.ship.expenses={salary:'12000'};
  s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
  s.ship.maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};
  s.worlds[s.actual].berthingRate={port:s.worlds[s.actual].uwp[0],die:2};validate(s);
  const bytes=JSON.stringify(s),context=await browser.newContext({viewport:{width,height:1100}}),errors=[];context.setDefaultTimeout(12000);
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:f.apiWorlds}});throw Error('Unexpected API '+u.href);});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const button=name=>page.locator('[data-action="'+name+'"]:visible').first(),click=name=>button(name).click();
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),read=async()=>JSON.parse(await raw());
  const openExpense=async label=>{await click('ship-expenses');await page.getByRole('button',{name:label+' ›',exact:true}).click();};
  const remember=selector=>page.locator(selector).evaluate(el=>{window.detachedServiceAction={...el.dataset};});
  const replay=()=>page.evaluate(()=>{const b=document.createElement('button');Object.assign(b.dataset,window.detachedServiceAction);document.body.append(b);b.click();b.remove();});
  try{
   await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
   assert.equal(await page.locator('#ship-actions > .ship-actions > button').count(),4);assert.equal(await page.locator('[data-action="port-costs"]').count(),0);
   const worldIds=[s.actual,s.route[0]],camera=()=>mapCameraSnapshot(page,worldIds),originalCamera=await camera();
   const panMap=async()=>{
    const start=await page.locator('.world-map').evaluate(svg=>{
     svg.scrollIntoView({block:'center',behavior:'instant'});const b=svg.getBoundingClientRect();
     return {x:b.left+b.width*.6,y:b.top+b.height*.5,pan:svg.querySelector('.map-content').getAttribute('transform')};
    });
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+30,start.y+20,{steps:8});await page.mouse.up();
    await page.waitForFunction(before=>document.querySelector('.map-content')?.getAttribute('transform')!==before,start.pan);
   };
   // Positive controls: explicit zoom changes real pixel spacing, pan changes
   // the geographic center, and Reset restores both before testing navigation.
   await click('map-zoom-in');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');const zoomed=await camera();
   assert.ok(zoomed.spacing>originalCamera.spacing*1.19,'Explicit Zoom in enlarges rendered world spacing');
   await panMap();const panned=await camera();assert.notEqual(panned.pan,zoomed.pan);
   assert.ok(Math.hypot(panned.center.x-zoomed.center.x,panned.center.y-zoomed.center.y)>.1,'Dragging moves the geographic viewport center');
   await click('map-zoom-reset');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%');assertMapCameraUnchanged(await camera(),originalCamera,'Explicit Reset restores zoom and center');
   await click('map-zoom-in');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');await panMap();const preservedCamera=await camera(),mapHeights=[preservedCamera.height];let cameraChecks=0;
   assert.notEqual(preservedCamera.zoom,'100%');assert.notEqual(preservedCamera.pan,'translate(0 0)');
   const sameCamera=async label=>{const measured=await camera();assertMapCameraUnchanged(measured,preservedCamera,label);mapHeights.push(measured.height);cameraChecks++;};
   await click('ship-expenses');await sameCamera('Open Ship expenses');assert.equal(await page.locator('.expense-table tbody tr').count(),6);assert.match(await page.locator('.expense-table tfoot').textContent(),/Cr 122,000/);assert.equal(await raw(),bytes);
   await page.screenshot({path:artifacts+`/expenses-summary-${width}.png`,fullPage:true});await overviewGeometry(page);
   // Every remaining top-level service switches directly in every stock mode.
   for(const from of ['refuel','refill-support'])for(const mode of ['summary','adjust','review'])for(const to of ['refuel','refill-support','ship-expenses']){
    await click(from);await sameCamera('Open '+from+' for '+mode);
    if(mode!=='summary'){await click('service-adjust');await sameCamera(from+' Adjust');}
    if(mode==='review'){await click('service-review');await sameCamera(from+' Review');}
    await remember('[data-action="'+(mode==='adjust'?'service-review':'service-confirm')+'"]');await click(to);await replay();assert.equal(await raw(),bytes,from+'/'+mode+' → '+to+' and old callback are inert');
    await sameCamera(from+'/'+mode+' → '+to);
   }
   for(const [service,dismiss] of [['refuel','service-back'],['refill-support','service-cancel']]){
    await click(service);await click('service-adjust');await sameCamera(service+' before dismissal');
    await click(dismiss);await sameCamera(service+' '+dismiss);assert.equal(await raw(),bytes);
   }
   for(const label of ['Mortgage','Monthly maintenance','Crew salaries','Port costs']){
    await openExpense(label);assert.equal(await page.locator('#modal').isVisible(),false);assert.equal(await raw(),bytes);await sameCamera('Open '+label);
    await click('expense-back');await sameCamera(label+' Back');await page.getByRole('button',{name:label+' ›',exact:true}).click();
    await remember('[data-action="expense-back"]');await click('refuel');await replay();assert.equal(await raw(),bytes,label+' switch never changes campaign');await sameCamera(label+' → Refuel');
   }
   await openExpense('Mortgage');await page.locator('#expense-form [name="payments"]').fill('2');
   const quote=page.locator('#expense-quote');assert.match(await quote.textContent(),/Cr 200,000/);assert.match(await quote.textContent(),/Cash remaining after payment/);assert.match(await quote.textContent(),/Cr 565,432/);
   await page.locator('#expense-panel .covered-payments > summary').click();await page.locator('#expense-panel .covered-payments tbody tr').nth(1).waitFor();assert.equal(await page.locator('#expense-panel .covered-payments tbody tr').count(),2);assert.match(await quote.textContent(),/029-1105/);assert.match(await quote.textContent(),/057-1105/);
   await sameCamera('Expanded Mortgage preview');await click('expense-cancel');assert.match(await page.locator('#expense-panel').textContent(),/Regular 4-week total/);assert.equal(await raw(),bytes);await sameCamera('Mortgage Cancel');
   await openExpense('Mortgage');await page.locator('#expense-form [name="payments"]').fill('2');await remember('[data-action="expense-pay"]');
   await page.screenshot({path:artifacts+`/expenses-mortgage-preview-${width}.png`,fullPage:true});
   await sameCamera('Mortgage before Pay');await button('expense-pay').evaluate(b=>{b.click();b.click();});await page.locator('.expense-receipt').waitFor();await sameCamera('Mortgage Pay → receipt');
   const heightRange=Math.max(...mapHeights)-Math.min(...mapHeights);if(width>=1100)assert.ok(heightRange>10,'Desktop service screens actually resize the map viewport, exercising scale preservation');
   cameraReports.push({width,checks:cameraChecks,heightRange,baseline:preservedCamera});
   const paid=await read();assert.equal(paid.bank,'565432');assert.equal(paid.ship.mortgage.remainingPayments,358);assert.equal(paid.ship.mortgage.nextDueDate,'085-1105');assert.equal(paid.ship.mortgage.totalPaid,'12200000');assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);
   assert.match(await page.locator('.expense-receipt').textContent(),/003-1105/);assert.equal(await page.locator('[data-action="expense-pay"],[data-action="expense-cancel"]').count(),0);
   await replay();assert.deepEqual(await read(),paid);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('.expense-receipt').waitFor();assert.deepEqual(await read(),paid);
   await page.screenshot({path:artifacts+`/expenses-mortgage-receipt-${width}.png`,fullPage:true});
   await click('refill-support');assert.deepEqual(await read(),paid);await openExpense('Mortgage');await click('expense-receipt');await page.locator('.expense-receipt').waitFor();assert.deepEqual(await read(),paid);
   await page.locator('#tabs [data-arg="History"]').click();await click('undo');const undone=await read();for(const key of ['bank','ship','ledger','hours'])assert.deepEqual(undone[key],s[key]);
   await page.locator('#tabs [data-arg="Overview"]').click();await openExpense('Monthly maintenance');await page.locator('#expense-form [name="payments"]').fill('3');await click('expense-pay');await page.locator('.expense-receipt').waitFor();
   const maintenance=await read();assert.equal(maintenance.bank,'759432');assert.equal(maintenance.ship.maintenance.nextDueDate,'099-1105');assert.equal(maintenance.ship.maintenance.paidSinceTracking,'6000');assert.deepEqual(maintenance.ship.mortgage,s.ship.mortgage);
   await click('expense-back');await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();
   const beforeOwnership=await raw(),other=await context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await other.locator('#takeover').click();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
   assert.equal(await button('expense-pay').isDisabled(),true);assert.equal(await raw(),beforeOwnership);await other.close();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal page overflow');assert.deepEqual(errors,[]);results.push(width);
  }catch(error){await page.screenshot({path:artifacts+`/expenses-failure-${width}.png`,fullPage:true}).catch(()=>{});throw error;}
  finally{await context.tracing.stop({path:artifacts+`/expenses-${width}-trace.zip`});await context.close();}
 }
 await writeFile(artifacts+'/expense-panels-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,widths:results,camera:cameraReports},null,2));
 console.log('PASS: compact Expenses, direct service switches, final payment receipts and History Undo.');
}finally{await browser.close();}
