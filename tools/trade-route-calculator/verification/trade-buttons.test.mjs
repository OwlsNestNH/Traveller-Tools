// Real Chromium coverage for Trade actions after browsing away from the ship.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
let context;
try{
 for(const size of [{width:1440,height:1100},{width:390,height:844},{width:320,height:740}]){
  const fixture=guiFixture(),remote=fixture.state.route[2],actual=fixture.state.actual,errors=[];
  context=await browser.newContext({viewport:size});context.setDefaultTimeout(10000);
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:fixture.bytes});
  await context.route('https://travellermap.com/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
   if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
   if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
   if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:fixture.apiWorlds}});
   throw Error('Unexpected map API request: '+url);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const tab=name=>page.locator('#tabs [data-arg="'+name+'"]').click();
  const action=(name,arg)=>page.locator('#main [data-action="'+name+'"]'+(arg?'[data-arg="'+arg+'"]':''));
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
  const read=async()=>JSON.parse(await raw());
  const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
  const title=async text=>{await page.getByRole('heading',{name:text,exact:true}).waitFor();};
  const dismiss=async()=>{await page.locator('#modal-cancel').click();await closed();};
  const browse=async()=>{await tab('Overview');await page.locator('.route-list [data-action="world"][data-arg="'+remote+'"]').click();await tab('Trade');};
  const preview=async kind=>{
   await page.locator('[name="party"]').fill(kind+' regression');
   await page.locator('[name="method"]').selectOption('online');
   await page.locator('[name="dice"]').fill('12');await page.locator('[name="duration"]').fill('1');
   await page.locator('#modal-submit').click();await title('Review '+kind+' search');
  };
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  for(const [name,kind] of [['search','supplier'],['buyer-search','buyer']]){
   const before=await raw();await browse();await action(name).click();await title('Trade at the current system');
   assert.match(await page.locator('#modal-body').textContent(),/does not move the ship, advance time or spend Credits/);
   assert.ok((await page.locator('#modal-body').textContent()).includes(fixture.state.worlds[actual].name));
   const recoveryLayout=await page.locator('#modal').evaluate(dialog=>{
    const body=dialog.querySelector('#modal-body'),text=dialog.querySelector('.trade-recovery');
    return {dialog:dialog.scrollWidth-dialog.clientWidth,body:body.scrollWidth-body.clientWidth,text:text.scrollWidth-text.clientWidth};
   });
   assert.ok(Object.values(recoveryLayout).every(excess=>excess<=1),'Recovery names and actions wrap without horizontal clipping');
   await page.screenshot({path:artifacts+`/trade-recovery-${kind}-${size.width}.png`});
   // Dismissal/reopening and keyboard activation do not change the campaign.
   await page.keyboard.press('Escape');await closed();assert.equal(await raw(),before);
   await action(name).press('Enter');await title('Trade at the current system');
   await page.locator('#modal-submit').click();await title('Find a '+kind);assert.equal(await raw(),before);
   await preview(kind);assert.equal(await raw(),before);await dismiss();assert.equal(await raw(),before);
   // Repeat the same action at the now-current trading view, then commit once.
   await action(name).click();await title('Find a '+kind);await preview(kind);
   await page.locator('#modal-submit').click();await closed();
   const after=await read(),old=JSON.parse(before),snap=after.snapshots.at(-1);
   assert.equal(after.snapshots.length,old.snapshots.length+1);assert.equal(snap.kind,kind);assert.equal(snap.worldId,actual);
   assert.equal(after.actual,old.actual);assert.equal(after.hours,old.hours+1);assert.equal(after.bank,old.bank);
   assert.deepEqual(after.lots,old.lots);assert.deepEqual(after.route,old.route);assert.deepEqual(after.ledger,old.ledger);
   await page.screenshot({path:artifacts+`/trade-search-${kind}-${size.width}.png`,fullPage:true});
  }
  // Related row/selection paths use the same recovery rather than a hidden error.
  for(const name of ['lot-sell','sale']){
   const before=await raw();await browse();
   if(name==='sale'){await action('sale-all').click();await action('sale').click();}
   else await action(name,'lot-recorded').click();
   await title('Trade at the current system');await page.locator('#modal-submit').click();
   await title('Prepare sale · buyer regression');await dismiss();assert.equal(await raw(),before);
   await action('sale-clear').click();
  }
  // Buy, edit and audit still open against the local saved supplier. Canceling
  // these forms and changing filters/selection does not buy, sell or reroll.
  const beforeControls=await raw();
  await page.locator('#snapshot-select').selectOption('snapshot-recorded');
  for(const [name,expected] of [['buy','Purchase · Recorded electronics'],['offer-edit','Referee market override']]){
   await action(name,'offer-recorded').click();await title(expected);await dismiss();
  }
  await action('offer-audit','offer-recorded').click();await page.locator('#modal[open]').waitFor();await dismiss();
  await page.locator('#market-search').fill('electronics');assert.equal(await page.locator('.purchase-table tbody tr').count(),1);
  await page.locator('#market-search').fill('');await action('sale-all').click();await action('sale-clear').click();
  assert.equal(await raw(),beforeControls);
  assert.deepEqual(errors,[],'No browser runtime errors');
  await context.tracing.stop({path:artifacts+`/trade-buttons-${size.width}-trace.zip`});await context.close();context=null;
  console.log('PASS: '+size.width+'px supplier/buyer recovery, repeated/cancelled previews, exact local commits, Sell/Get sale offers, Buy/Edit/Audit and filters without incidental changes.');
 }
}catch(error){
 if(context){const pages=context.pages();await pages[0]?.screenshot({path:artifacts+'/trade-buttons-failure.png',fullPage:true}).catch(()=>{});await context.tracing.stop({path:artifacts+'/trade-buttons-failure-trace.zip'}).catch(()=>{});}
 throw error;
}finally{await browser.close();}
