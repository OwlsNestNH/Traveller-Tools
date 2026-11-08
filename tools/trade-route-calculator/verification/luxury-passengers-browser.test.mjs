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
async function finish(ctx,name){cases.push(name);await ctx.tracing.stop({path:join(artifacts,'luxury-'+name+'.zip')});await ctx.close();activeContext=null;activePage=null;}
try{
 for(const width of [1440,390]){
  const {ctx,page}=await start(width);await tab(page,'Settings').click();
  const middlePeople=page.locator('#settings-form [name="people-middle"]');await reveal(middlePeople);await middlePeople.fill('0');
  await reveal(page.locator('#accommodation-estimate'));assert.match(await page.locator('#accommodation-estimate').innerText(),/Cabin charges: Cr 0 \/ month.*Combined: Cr 0 \/ month/,'Empty-ship Settings estimate agrees with the zero-cost engine');await middlePeople.fill('2');
  for(const [name,value]of [['rooms-luxury','1'],['people-luxury','1']]){const input=page.locator('#settings-form [name="'+name+'"]');await reveal(input);await input.fill(value);}
  assert.equal(await page.locator('#settings-form [name="refillRate-luxury"]').inputValue(),'5000');
  await page.locator('#settings-form button[type="submit"]').click();let baseline=await read(page);assert.equal(baseline.ship.accommodation.passengers.luxury,1);assert.equal(baseline.ship.accommodation.rooms.luxury,1);assert.equal(baseline.ship.accommodation.luggageTons,'2');assert.equal(units(baseline),112);
  await page.screenshot({path:join(artifacts,'luxury-settings-'+width+'.png'),fullPage:true});
  await tab(page,'Contracts').click();await capacity(page);baseline=await read(page);
  async function preview(){await action(page,'contract-manual').click();await field(page,'kind').selectOption('passenger');await page.getByRole('heading',{name:'Manual passenger contract',exact:true}).waitFor();await field(page,'passageClass').selectOption('luxury');await field(page,'count').fill('2');await field(page,'fare').fill('27000');await field(page,'cabinMode').selectOption('shared');await field(page,'serviceConfirmed').check();await field(page,'reason').fill('Synthetic agreed single-jump fare: room 36000 plus half for the second occupant, divided between two people.');await submit(page);await page.getByRole('heading',{name:'Confirm manual passenger booking',exact:true}).waitFor();}
  await preview();assert.deepEqual(await read(page),baseline);await page.keyboard.press('Escape');await closed(page);assert.deepEqual(await read(page),baseline);
  await preview();await page.screenshot({path:join(artifacts,'luxury-booking-'+width+'.png'),fullPage:true});await submit(page);await closed(page);const aboard=await read(page),booking=aboard.contracts.at(-1);assert.equal(booking.passageClass,'luxury');assert.equal(booking.payment,'54000');assert.equal(aboard.ship.accommodation.passengers.luxury,1,'Booked people do not overwrite baseline');assert.equal(units(aboard),112);assert.equal(aboard.bank,baseline.bank);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab(page,'Contracts').click();assert.match(await page.locator('.passenger-panel').textContent(),/Luxury/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await tab(page,'Overview').click();await action(page,'day-forward').click();assert.equal(units(await read(page)),107,'Five awake people consume five LSS');
  await tab(page,'History').click();await action(page,'undo').click();assert.equal(units(await read(page)),112);
  await tab(page,'Overview').click();await action(page,'refill-support').click();const beforeRefill=await read(page);
  await page.locator('#service-form [name="internal"]').fill('117');await page.locator('#service-form [name="internal"]').blur();
  assert.match(await page.locator('.lss-total').innerText(),/786/);assert.deepEqual(await read(page),beforeRefill);
  await page.screenshot({path:join(artifacts,'luxury-combined-refill-'+width+'.png'),fullPage:true});
  await action(page,'service-confirm').click();await page.waitForFunction(({key,bank})=>JSON.parse(localStorage.getItem(key)).bank===String(BigInt(bank)-786n),{key:campaignKey,bank:beforeRefill.bank});
  const refill=await read(page);assert.equal(units(refill),117);assert.equal(refill.ledger.at(-1).expense.cabinMonthly,'5000');assert.equal(refill.ledger.at(-1).expense.peopleMonthly,'17000');assert.equal(refill.ledger.at(-1).expense.dailyCredits,'786');assert.equal(refill.ledger.at(-1).roundingStep,1);
  await tab(page,'History').click();await action(page,'undo').click();assert.equal(units(await read(page)),112);assert.equal((await read(page)).bank,beforeRefill.bank);
  // Explicit docking is per ship, persistent and reversible, with no hidden
  // refill or station charge. Browsing remains unrelated to the switch.
  await tab(page,'Overview').click();const beforeDock=await read(page);
  const station=action(page,'station-life-support');assert.equal(await station.getAttribute('aria-checked'),'false');
  await station.click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).ship.stationLifeSupport===true,campaignKey);
  const docked=await read(page);assert.equal(docked.bank,beforeDock.bank);assert.deepEqual(docked.ledger,beforeDock.ledger);assert.equal(units(docked),112);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab(page,'Overview').click();assert.equal(await station.getAttribute('aria-checked'),'true');assert.match(await page.locator('.life-support-counter').innerText(),/Station supply/);
  await action(page,'day-forward').click();assert.equal(units(await read(page)),112,'A docked day uses station supplies');
  await station.click();await action(page,'day-forward').click();assert.equal(units(await read(page)),107,'Undocking resumes onboard consumption');
  await tab(page,'History').click();await action(page,'undo').click();assert.equal(units(await read(page)),112);
  // Cr100 allowance is included once in the expense, not a separate charge.
  await tab(page,'Settings').click();const rounding=page.locator('#settings-form [name="creditStep"]');await reveal(rounding);
  const roundingInfo=rounding.locator('xpath=..').locator('[data-rule-info="rounding"]');assert.equal(await roundingInfo.count(),1);await roundingInfo.click();
  const info=page.locator('#rule-reference-popup');await info.waitFor({state:'visible'});assert.match(await info.innerText(),/small taxes|tips/);assert.match(await info.innerText(),/already (included|in)|not.*extra|not.*separate|not an additional/i);await page.keyboard.press('Escape');await info.waitFor({state:'hidden'});
  await rounding.selectOption('100');await page.locator('#settings-form button[type="submit"]').click();await tab(page,'Overview').click();const beforeRounded=await read(page);
  await action(page,'refill-support').click();await page.locator('#service-form [name="internal"]').fill('117');await page.locator('#service-form [name="internal"]').blur();assert.match(await page.locator('.lss-total').innerText(),/800/);
  await action(page,'service-confirm').click();await page.waitForFunction(({key,bank})=>JSON.parse(localStorage.getItem(key)).bank===String(BigInt(bank)-800n),{key:campaignKey,bank:beforeRounded.bank});
  const rounded=await read(page);assert.equal(rounded.ledger.length,beforeRounded.ledger.length+1);assert.equal(rounded.ledger.at(-1).amount,'-800');assert.equal(rounded.ledger.at(-1).roundingStep,100);assert.equal(rounded.ledger.at(-1).expense.dailyCredits,'786');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:join(artifacts,'luxury-station-rounded-'+width+'.png'),fullPage:true});
  await finish(ctx,'manual-'+width);
 }
 assert.deepEqual(errors,[]);console.log('PASS: Luxury Settings, source-aware manual booking, Cancel, exact baseline/stock preservation, reload, consumption, combined refill price, station switch, Cr100 popup/debit, Undo and desktop/mobile layout');
}finally{await browser.close();}
