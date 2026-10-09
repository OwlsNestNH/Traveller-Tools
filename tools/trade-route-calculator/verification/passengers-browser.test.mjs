// Deterministic real-browser passenger flows with synthetic campaign/API inputs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import * as S from '../js/state.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const errors=[],cases=[];let activeContext,activePage;
const action=(page,name)=>page.locator('[data-action="'+name+'"]');
const tab=(page,name)=>page.locator('#tabs [data-arg="'+name+'"]');
const field=(page,name)=>page.locator('#modal [name="'+name+'"]');
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const submit=page=>page.locator('#modal-submit').click();
const units=s=>Number(s.ship.lifeSupport.stockUnits.numerator)/Number(s.ship.lifeSupport.stockUnits.denominator);
function fixture(legacyLuggage){
 const f=guiFixture(),s=f.state;s.ship.accommodation={combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0'};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}};
 if(legacyLuggage!==undefined){delete s.ship.accommodation.combinedPeople;delete s.ship.accommodation.luggageMode;s.ship.accommodation.passengers.high=2;s.ship.accommodation.luggageTons=legacyLuggage;}
 S.validate(s);return f;
}
async function start(width,legacyLuggage){
 const f=fixture(legacyLuggage),ctx=activeContext=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});ctx.setDefaultTimeout(12000);await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 await ctx.addInitScript(({key,state,origin})=>{if(location.origin===origin&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key:campaignKey,state:f.state,origin:new URL(base).origin});
 await ctx.route('https://travellermap.com/**',route=>{const u=new URL(route.request().url()),path=u.pathname;if(path.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:f.apiWorlds}});if(path.endsWith('/universe'))return route.fulfill({json:f.universe});if(path.endsWith('/metadata'))return route.fulfill({json:f.metadata});if(path.endsWith('/sec'))return route.fulfill({json:f.sec});return route.fulfill({json:{}});});
 const page=activePage=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();return {ctx,page,f};
}
async function capacity(page){await action(page,'passenger-setup').click();await field(page,'reservedCabins').fill('1');await field(page,'installedLowBerths').fill('4');await field(page,'reviewed').check();await submit(page);await closed(page);}
async function search(page){await action(page,'passenger-search').click();await field(page,'dice').fill('12');await field(page,'skill').fill('2');await field(page,'characteristic').fill('1');await field(page,'steward').fill('1');await reveal(field(page,'sequence'));await field(page,'sequence').fill(Array(240).fill(2).join(','));await submit(page);await closed(page);assert.equal(await page.locator('.passenger-offer').count(),4);}
async function boardPreview(page,kind='High',count=2,mode='shared'){
 const offer=page.locator('.passenger-offer').filter({has:page.getByRole('heading',{name:kind,exact:true})});await offer.getByRole('button',{name:'Board passengers',exact:true}).click();await field(page,'count').fill(String(count));await field(page,'cabinMode').selectOption(mode);if(['High','Middle'].includes(kind))await field(page,'serviceConfirmed').check();if(kind==='Basic'&&mode==='cargo')await field(page,'spaceConfirmed').check();await submit(page);await page.getByRole('heading',{name:'Confirm passenger booking',exact:true}).waitFor();}
async function reveal(el){for(const d of await el.locator('xpath=ancestor::details').all())if(!await d.evaluate(e=>e.open))await d.locator(':scope > summary').click();}
async function finish(ctx,name){cases.push(name);await ctx.tracing.stop({path:join(artifacts,'passengers-'+name+'.zip')});await ctx.close();activeContext=null;activePage=null;}
try{
 for(const width of [1440,390]){
  const {ctx,page}=await start(width);await tab(page,'Contracts').click();await capacity(page);const configured=await read(page);await search(page);const searched=await read(page);assert.deepEqual(searched.ship,configured.ship);assert.equal(searched.bank,configured.bank);
  await page.screenshot({path:join(artifacts,`passengers-offers-${width}.png`),fullPage:true});
  await boardPreview(page);assert.deepEqual(await read(page),searched,'Boarding preview is draft-only');await page.keyboard.press('Escape');await closed(page);assert.deepEqual(await read(page),searched);
  await boardPreview(page);await page.screenshot({path:join(artifacts,`passengers-review-${width}.png`),fullPage:true});await submit(page);await closed(page);const aboard=await read(page),booking=aboard.contracts.find(c=>c.kind==='passenger');assert.equal(booking.count,2);assert.equal(booking.cabinMode,'shared');assert.deepEqual(aboard.ship.accommodation.passengers,configured.ship.accommodation.passengers);assert.equal(units(aboard),112);assert.equal(aboard.bank,configured.bank);
  await tab(page,'Settings').click();const name=page.locator('#settings-form [name="name"]');await reveal(name);await name.fill('Passenger settings round-trip');await page.locator('#settings-form button[type="submit"]').click();const saved=await read(page);assert.deepEqual(saved.contracts,aboard.contracts);assert.equal(units(saved),112);assert.deepEqual(saved.ship.accommodation.passengers,aboard.ship.accommodation.passengers);assert.equal(saved.ship.accommodation.passengerCapacity.reservedCabins,1);
  await tab(page,'Overview').click();await action(page,'jump').click();await field(page,'hours').fill('168');await submit(page);await closed(page);const arrived=await read(page);assert.equal(arrived.actual,booking.destination);assert.equal(units(arrived),84,'Four awake people consume28 LSS in seven days');assert.equal(arrived.bank,saved.bank);
  await tab(page,'Contracts').click();await action(page,'passenger-deliver').click();await submit(page);await closed(page);const delivered=await read(page);assert.equal(delivered.contracts.find(c=>c.id===booking.id).status,'delivered');assert.equal(delivered.bank,String(BigInt(arrived.bank)+BigInt(booking.payment)));assert.equal(units(delivered),84);assert.equal(delivered.ledger.filter(e=>e.type==='Passenger delivery').length,1);assert.equal(await action(page,'passenger-deliver').count(),0);
  await page.screenshot({path:join(artifacts,`passengers-delivered-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await tab(page,'History').click();await action(page,'undo').click();const undone=await read(page);assert.equal(undone.contracts.find(c=>c.id===booking.id).status,'accepted');assert.equal(undone.bank,arrived.bank);assert.equal(units(undone),84);
  // A real export/import preserves the contract and History Undo; no offers are revived.
  await tab(page,'Accounts').click();const downloaded=page.waitForEvent('download');await action(page,'export').first().click();const download=await downloaded,path=await download.path(),bytes=await readFile(path,'utf8');assert.equal(JSON.parse(bytes).contracts.find(c=>c.id===booking.id).count,2);
  await page.locator('#import-file').setInputFiles({name:'passenger-backup.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await field(page,'backed').check();await submit(page);await closed(page);await tab(page,'Contracts').click();assert.equal(await action(page,'passenger-board').count(),0);assert.equal((await read(page)).contracts.find(c=>c.id===booking.id).status,'accepted');
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab(page,'Contracts').click();assert.equal(await action(page,'passenger-board').count(),0);assert.match(await page.locator('.passenger-summary').textContent(),/2 booked people aboard/);
  const other=await ctx.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await tab(other,'Contracts').click();assert.equal(await action(other,'passenger-search').isDisabled(),true);assert.equal(await action(other,'passenger-deliver').isDisabled(),true);await other.close();
  await finish(ctx,'lifecycle-'+width);
 }
 for(const value of ['0','7']){
  const {ctx,page}=await start(1440,value),before=await read(page);await tab(page,'Settings').click();const toggle=page.locator('#settings-form [name="luggageOverride"]');await reveal(toggle);assert.equal(await toggle.isChecked(),true);assert.equal(await page.locator('#settings-form [name="luggageTons"]').inputValue(),value);const name=page.locator('#settings-form [name="name"]');await reveal(name);await name.fill('Legacy luggage '+value);await page.locator('#settings-form button[type="submit"]').click();const after=await read(page);assert.equal(after.ship.accommodation.luggageMode,'manual');assert.equal(after.ship.accommodation.luggageTons,value);assert.equal(after.bank,before.bank);assert.deepEqual(after.ship.lifeSupport,before.ship.lifeSupport);await finish(ctx,'legacy-luggage-'+value);
 }
 {
  const {ctx,page}=await start(1440);await tab(page,'Contracts').click();await capacity(page);await search(page);await boardPreview(page,'Low',2,'low');await submit(page);await closed(page);await boardPreview(page,'Basic',2,'cargo');await submit(page);await closed(page);let s=await read(page);assert.equal(s.contracts.filter(c=>c.kind==='passenger').length,2);await tab(page,'Overview').click();await action(page,'day-forward').click();s=await read(page);assert.equal(units(s),107.8);await action(page,'refill-support').click();assert.match(await page.locator('#service-panel').textContent(),/4\.2/);await page.keyboard.press('Escape');await finish(ctx,'low-basic-support');
 }
 assert.deepEqual(errors,[]);console.log('PASS: passenger browser cases: '+cases.join(', '));
}finally{
 if(activeContext){await activePage?.screenshot({path:join(artifacts,'passengers-failure.png'),fullPage:true}).catch(()=>{});await activeContext.tracing.stop({path:join(artifacts,'passengers-failure.zip')}).catch(()=>{});}
 await writeFile(join(artifacts,'passengers-browser-summary.json'),JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,cases,errors},null,2));await browser.close();
}
