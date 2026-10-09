// Real-browser synthetic verification for mortgage and maintenance configuration,
// shared Ship Expenses previews/commits, persistence, Undo and ownership loss.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {recordedPaymentDate} from '../js/payment-schedule.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const mortgage={originalAmount:'24000000',payment:'100001',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
const maintenance={payment:'2001',nextDueDate:'015-1105',paidSinceTracking:'0'};
let activeContext,activePage;
async function start(viewport,configured=true){
 const fixture=guiFixture();fixture.state.settings.creditStep=100;
 if(configured){fixture.state.ship.mortgage=structuredClone(mortgage);fixture.state.ship.maintenance=structuredClone(maintenance);}
 validate(fixture.state);fixture.bytes=JSON.stringify(fixture.state);
 const context=activeContext=await browser.newContext({viewport,acceptDownloads:true});context.setDefaultTimeout(10000);
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes,origin})=>{if(location.origin===origin&&!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:fixture.bytes,origin:new URL(base).origin});
 const errors=[],unexpected=[];context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&/invalid form control.*not focusable/i.test(e.text()))errors.push(e.text());});});
 await context.route('https://travellermap.com/api/**',route=>{
  const url=new URL(route.request().url());assert.equal(url.searchParams.get('milieu'),'M1105');
  if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
  if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
  if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
  if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:fixture.apiWorlds}});
  unexpected.push(url.href);return route.abort();
 });
 const page=activePage=await context.newPage();await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),read=async()=>JSON.parse(await raw());
 const tab=async name=>{await page.locator('#tabs [data-arg="'+name+'"]').click();};
 const modal=()=>page.locator('#modal'),field=name=>page.locator('#modal [name="'+name+'"]');
 const cancel=async()=>{await page.locator('#modal-cancel').click();await modal().waitFor({state:'hidden'});};
 async function expenses({mortgageCount,maintenanceCount}={}){
  await tab('Accounts');await page.locator('#main [data-action="ship-expenses"]').click();await page.getByRole('heading',{name:'Ship expenses',exact:true}).waitFor();
  for(const control of await page.locator('#modal input[name^="include-"]').all())await control.uncheck();
  if(mortgageCount!==undefined){await field('include-mortgage').check();await field('mortgagePayments').fill(String(mortgageCount));}
  if(maintenanceCount!==undefined){await field('include-maintenance').check();await field('maintenancePayments').fill(String(maintenanceCount));}
 }
 const preview=async()=>{await page.locator('#modal-submit').click();await page.getByRole('heading',{name:'Confirm ship expenses',exact:true}).waitFor();};
 async function setting(name,value){const control=page.locator('#settings-form [name="'+name+'"]');for(const details of await control.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();await control.fill(String(value));}
 async function finish(label){assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.tracing.stop({path:artifacts+'/mortgage-'+label+'-trace.zip'});await context.close();activeContext=null;activePage=null;}
 return {page,context,fixture,raw,read,tab,field,cancel,expenses,preview,setting,finish};
}
try{
 for(const viewport of [{width:1440,height:1100},{width:390,height:844},{width:320,height:740}]){
  const h=await start(viewport),{page,raw,read,tab,field,cancel,expenses,preview}=h;
  const before=await raw();await expenses({mortgageCount:2,maintenanceCount:3});
  assert.match(await page.locator('#expense-estimate').textContent(),/Cr 206,005/);
  assert.equal(await raw(),before);await cancel();assert.equal(await raw(),before,'Closing a draft never pays');
  await expenses({mortgageCount:361});assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await raw(),before);
  await field('mortgagePayments').fill('2');await preview();assert.equal(await raw(),before);await cancel();assert.equal(await raw(),before,'Cancelling confirmation never pays');
  await expenses({mortgageCount:2,maintenanceCount:3});await preview();
  const mortgageAudit=page.locator('#modal details').filter({has:page.locator('summary', {hasText:'Mortgage payment calculation and rules'})}).first();
  await mortgageAudit.locator(':scope > summary').click();const covered=mortgageAudit.locator('.covered-payments');await covered.locator(':scope > summary').click();
  await covered.locator('tbody tr').nth(1).waitFor();assert.equal(await covered.locator('tbody tr').count(),2);assert.match(await covered.textContent(),/029-1105/);assert.match(await covered.textContent(),/057-1105/);
  assert.match(await page.locator('#modal-body').textContent(),/Cash remaining after payment/);
  await page.locator('#modal-submit').evaluate(button=>{button.click();button.click();});await page.locator('#modal').waitFor({state:'hidden'});
  const paid=await read();assert.equal(paid.revision,JSON.parse(before).revision+1,'Repeated submit commits once');
  assert.equal(paid.bank,String(BigInt(JSON.parse(before).bank)-206005n));assert.equal(paid.ship.mortgage.payment,'100001');
  assert.equal(paid.ship.mortgage.originalAmount,'24000000');assert.equal(paid.ship.mortgage.remainingPayments,358);assert.equal(paid.ship.mortgage.totalPaid,'12200002');
  assert.equal(paid.ship.mortgage.nextDueDate,'085-1105');assert.equal(paid.ship.mortgage.lastPaidDueDate,'057-1105');
  assert.equal(paid.ship.maintenance.nextDueDate,'099-1105');assert.equal(paid.ship.maintenance.paidSinceTracking,'6003');
  assert.equal(paid.ledger.length,JSON.parse(before).ledger.length+2);assert.equal(paid.ledger.at(-1).batchId,paid.ledger.at(-2).batchId);validate(paid);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(),paid);
  await tab('Accounts');const payment=page.locator('#main tr').filter({hasText:'Mortgage payment'});await payment.locator('[data-action="ledger-audit"]').click();
  assert.match(await page.locator('#modal-body').textContent(),/Original mortgage amount/);assert.match(await page.locator('#modal-body').textContent(),/24000000/);assert.match(await page.locator('#modal-body').textContent(),/085-1105/);await cancel();
  const downloadPromise=page.waitForEvent('download');await page.locator('#main [data-action="export"]').click();const download=await downloadPromise;const bytes=await readFile(await download.path(),'utf8');assert.deepEqual(JSON.parse(bytes),paid);
  await tab('History');await page.locator('#main [data-action="undo"]').click();const undone=await read();
  for(const key of ['bank','ship','ledger','hours'])assert.deepEqual(undone[key],JSON.parse(before)[key],'Undo restores all payment state: '+key);
  // Importing a paid backup preserves the exact count, totals and payment dates.
  await page.locator('#import-file').setInputFiles({name:'synthetic-mortgage.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await page.locator('#modal [name="backed"]').check();await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
  const imported=await read();assert.deepEqual(imported.ship,paid.ship);assert.equal(imported.bank,paid.bank);assert.deepEqual(imported.ledger,paid.ledger);
  await expenses({mortgageCount:1});await preview();assert.match(await page.locator('#modal-body').textContent(),/085-1105/);assert.match(await page.locator('#modal-body').textContent(),/113-1105/);
  const previewBytes=await raw();
  // Ownership loss invalidates the open confirmation; it cannot charge later.
  const other=await h.context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  await other.locator('#takeover').click();await other.getByText('Editing in this tab',{exact:true}).waitFor();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
  assert.equal(await page.locator('#modal-submit').isDisabled(),true);await page.locator('#modal-form').evaluate(form=>form.requestSubmit());assert.equal(await raw(),previewBytes);await cancel();
  await page.locator('#takeover').click();await page.getByText('Editing in this tab',{exact:true}).waitFor();await other.close();
  await tab('Settings');await h.setting('mortgagePayment','100001');await h.setting('maintenancePayment','2001');
  assert.equal(await page.locator('#settings-form [name="mortgagePaid"]').inputValue(),'12200002');assert.equal(await page.locator('#settings-form [name="mortgageDueDate"]').inputValue(),'085-1105');
  assert.match(await page.locator('#mortgage-settings-summary').textContent(),/Cr 35,800,358/);
  await page.screenshot({path:artifacts+`/mortgage-settings-${viewport.width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page-width overflow');
  const paidDate=recordedPaymentDate(imported,imported.ledger.find(e=>e.expense?.kind==='mortgage'));
  const time=page.locator('#main [data-action="time"]');for(const details of await time.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();await time.click();
  await page.locator('#modal [name="date"]').fill('001-1106');await page.locator('#modal [name="reason"]').fill('Verify frozen payment receipt dates');await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
  await tab('Accounts');const historical=page.locator('#main tr').filter({hasText:'Mortgage payment'});assert.match(await historical.textContent(),new RegExp(paidDate));await historical.locator('[data-action="ledger-audit"]').click();assert.ok((await page.locator('#modal-body').textContent()).includes(paidDate));await cancel();
  await h.finish(String(viewport.width));console.log(`PASS: ${viewport.width}px exact fixed amounts, preview/cancel, bounded periods, repeated submit, combined payments, reload/import, audit/Undo and ownership loss.`);
 }
 const h=await start({width:1440,height:1100},false),{page,raw,read,tab}=h;await tab('Settings');const before=await raw();
 const fields={mortgageOriginal:'24000000',mortgagePayment:'100001',mortgageRemaining:'360',mortgagePaid:'12000000',mortgageDueDate:'029-1105',maintenancePayment:'2001',maintenanceDueDate:'015-1105'};
 for(const [name,value]of Object.entries(fields))await h.setting(name,value);
 assert.equal(await raw(),before);await page.locator('#settings-reset').click();assert.equal(await raw(),before);
 for(const [name,value]of Object.entries(fields))await h.setting(name,value);
 await page.locator('#settings-save').click();const configured=await read();assert.deepEqual(configured.ship.mortgage,mortgage);assert.deepEqual(configured.ship.maintenance,maintenance);
 assert.equal(configured.bank,JSON.parse(before).bank);assert.deepEqual(configured.ledger,JSON.parse(before).ledger);
 // An unrelated save retains prepaid dates and original values, without rerounding.
 await h.setting('name','Mortgage settings round-trip');await page.locator('#settings-save').click();assert.deepEqual((await read()).ship.mortgage,mortgage);
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab('History');await page.locator('#main [data-action="undo"]').click();await page.locator('#main [data-action="undo"]').click();
 assert.equal(Object.hasOwn((await read()).ship,'mortgage'),false);assert.equal(Object.hasOwn((await read()).ship,'maintenance'),false);
 await h.finish('setup');console.log('PASS: optional legacy settings, full configuration/revert, no setup charge, exact amounts despite Cr100 mode, further save/reload and Undo to absent records.');
}catch(error){if(activePage)await activePage.screenshot({path:artifacts+'/mortgage-failure.png',fullPage:true}).catch(()=>{});if(activeContext)await activeContext.tracing.stop({path:artifacts+'/mortgage-failure-trace.zip'}).catch(()=>{});throw error;}
finally{await browser.close();}
