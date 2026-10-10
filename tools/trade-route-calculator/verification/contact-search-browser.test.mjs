// Real Chromium interaction coverage. Only the initial synthetic legacy save is
// seeded; subsequent searches, cancellation, time correction, import/export and
// Undo use the rendered app. External map data is deterministic.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {contactSearchStatus} from '../js/contact-search.mjs';
import {displayDate} from '../js/calendar.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
let context;
try{
 for(const viewport of [{width:1440,height:1100},{width:390,height:844},{width:320,height:740}]){
  const fixture=guiFixture(),s=fixture.state;s.hours=671;s.snapshots[0].startedHours=0;s.snapshots[0].hours=1;
  s.snapshots.push({id:'legacy-buyer',kind:'buyer',worldId:s.actual,party:s.actual+'|old buyer',partyName:'Old buyer',startedHours:650,hours:651,offers:[],success:false,search:{previous:99,total:-91}});
  const beforeSnapshots=structuredClone(s.snapshots),errors=[];
  context=await browser.newContext({viewport,acceptDownloads:true,serviceWorkers:'block'});context.setDefaultTimeout(15000);
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:JSON.stringify(s)});
  await context.route('https://travellermap.com/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
   if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
   if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
   if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:fixture.apiWorlds}});
   throw Error('Unexpected map request: '+url);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const tab=name=>page.locator('#tabs [data-arg="'+name+'"]').click();
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),read=async()=>JSON.parse(await raw());
  const title=text=>page.getByRole('heading',{name:text,exact:true}).waitFor();
  const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
  const cancel=async()=>{await page.locator('#modal-cancel').click();await closed();};
  const open=async kind=>{await tab('Trade');await page.locator('#main [data-action="'+(kind==='buyer'?'buyer-search':'search')+'"]').click();await title('Find a '+kind);};
  const preview=async(kind,method='online')=>{
   await page.locator('[name="party"]').fill('Contact '+method+' '+kind);
   await page.locator('[name="method"]').selectOption(method);
   await page.locator('[name="dice"]').fill('12');await page.locator('[name="duration"]').fill('1');
   await page.locator('#modal-submit').click();await title('Review '+kind+' search');
  };
  const commit=async()=>{
   await page.locator('#modal-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
   await closed();assert.equal(await page.locator('#modal-error').textContent(),'');
  };
  const undo=async()=>{await tab('History');await page.getByRole('button',{name:'Undo latest change',exact:true}).click();};
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  const initial=await raw();assert.deepEqual((await read()).snapshots,beforeSnapshots,'Loading does not rewrite legacy snapshots');
  for(const kind of ['supplier','buyer']){
   await open(kind);assert.match(await page.locator('#modal-body').textContent(),/previous attempts in this period: 2 \(DM −2\)/);
   assert.ok((await page.locator('#modal-body').textContent()).includes(displayDate(s.dateLabel,672)));
   await page.locator('#modal-body summary').filter({hasText:'Home Rule'}).click();assert.match(await page.locator('#modal-body').textContent(),/same month/);
   await preview(kind);assert.equal(await raw(),initial);await cancel();assert.equal(await raw(),initial);
   await open(kind);await page.keyboard.press('Escape');await closed();assert.equal(await raw(),initial);
  }
  await open('buyer');await preview('buyer');await commit();
  const atBoundary=await read();assert.equal(atBoundary.snapshots.length,3);assert.equal(atBoundary.hours,672);assert.equal(atBoundary.snapshots.at(-1).search.previous,2);assert.equal(contactSearchStatus(atBoundary).previous,0);assert.deepEqual(atBoundary.snapshots.slice(0,2),beforeSnapshots);
  await open('supplier');assert.match(await page.locator('#modal-body').textContent(),/All penalties cleared/);assert.match(await page.locator('#modal-body').textContent(),/previous attempts in this period: 0/);await preview('supplier','normal');await commit();
  const nextPeriod=await read();assert.equal(nextPeriod.hours,696);assert.equal(nextPeriod.snapshots.at(-1).search.contactPeriod.startedHours,672);assert.equal(nextPeriod.snapshots.at(-1).search.contactPeriod.resetsHours,1344);
  await open('buyer');assert.match(await page.locator('#modal-body').textContent(),/previous attempts in this period: 1/);await preview('buyer','blackMarket');await commit();
  const after=await read();assert.equal(after.hours,720);assert.equal(after.snapshots.at(-1).search.previous,1);assert.equal(contactSearchStatus(after).previous,2);assert.deepEqual(after.snapshots.slice(0,2),beforeSnapshots);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(),after);
  await open('supplier');assert.match(await page.locator('#modal-body').textContent(),/previous attempts in this period: 2/);await page.screenshot({path:artifacts+`/contact-search-period-${viewport.width}.png`});await cancel();
  const audit=after.events.findLast(e=>e.contactSearch);await tab('History');await page.locator('[data-action="event-audit"][data-arg="'+audit.id+'"]').click();await title('History entry');
  assert.match(await page.locator('#modal-body').textContent(),/Home Rule \/ campaign interpretation/);assert.match(await page.locator('#modal-body').textContent(),/same month/);assert.ok((await page.locator('#modal-body').textContent()).includes(displayDate(s.dateLabel,1344)));await cancel();
  // Export and re-import through the real browser file controls, then Undo.
  await tab('Settings');const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Save campaign (JSON)',exact:true}).click();
  const download=await downloading,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.deepEqual(JSON.parse(bytes.toString()),after);
  await page.locator('#import-file').setInputFiles({name:'contact-search-periods.json',mimeType:'application/json',buffer:bytes});await title('Load campaign (JSON)');await page.locator('[name="backed"]').check();await page.locator('#modal-submit').click();await closed();
  assert.deepEqual((await read()).snapshots,after.snapshots);assert.equal(contactSearchStatus(await read()).previous,2);
  await undo();const undone=await read();assert.deepEqual(undone.snapshots,nextPeriod.snapshots);assert.equal(undone.hours,nextPeriod.hours);assert.equal(contactSearchStatus(undone).previous,1);
  await undo();assert.deepEqual((await read()).snapshots,atBoundary.snapshots);assert.equal(contactSearchStatus(await read()).previous,0);
  await undo();assert.deepEqual((await read()).snapshots,beforeSnapshots);assert.equal((await read()).hours,671);assert.equal(contactSearchStatus(await read()).previous,2);
  // Editing ownership is still required for the same grouped-count action.
  const readonly=await context.newPage();await readonly.goto(base);await readonly.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await readonly.locator('#tabs [data-arg="Trade"]').click();assert.equal(await readonly.locator('#main [data-action="search"]').isDisabled(),true);await readonly.close();
  assert.deepEqual(errors,[]);await context.tracing.stop({path:artifacts+`/contact-search-${viewport.width}-trace.zip`});await context.close();context=null;
  console.log(`PASS: ${viewport.width}px grouped boundary, legacy migration, shared buyer/supplier/method count, preview/cancel, duplicate submit, reset dates, saved audit, reload/import, Undo and read-only.`);
 }
}catch(error){if(context){await context.pages()[0]?.screenshot({path:artifacts+'/contact-search-failure.png',fullPage:true}).catch(()=>{});await context.tracing.stop({path:artifacts+'/contact-search-failure-trace.zip'}).catch(()=>{});}throw error;
}finally{await browser.close();}
