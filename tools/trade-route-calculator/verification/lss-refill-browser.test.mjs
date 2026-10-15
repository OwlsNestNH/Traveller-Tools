import {existingSell} from './trade-ui.mjs';
// Real Chromium, deterministic map responses, synthetic campaigns only.
// Run: node verification/service-panels-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {configureSupport} from '../js/life-support.mjs';
import {overviewGeometry} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const results=[],frameEvidence=[];
function fixture({port='A',hydro='8',aboard=20,bank='100000',frozen=0,awake=4,stockUnits=null,cargoUnits=null}={}){
 const f=guiFixture(12),s=f.state;
 s.name='Service screen verification';s.ship.name='Synthetic service trader';s.bank=bank;s.hours=48;
 s.ship.fuel=configureFuel(200,43,aboard,0,2);
 s.ship.accommodation={occupiedLowBerths:frozen,rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:awake,high:0}};
 // Deliberately legacy inventory: reading/browsing must not serialize migration.
 s.ship.lifeSupport=stockUnits===null?{capacityHours:672,remainingHours:336,elapsedHours:0}:configureSupport(s.ship,{targetDays:28,stockUnits});
 if(cargoUnits!==null)s.ship.lifeSupport.cargoUnits={numerator:String(Math.round(cargoUnits*10)),denominator:'10'};
 s.lots=[];s.contracts=[];s.snapshots=[];s.ledger=[];s.events=[];s.undo=[];s.jumpAttempts=[];
 s.route=[s.actual,s.route[3]];s.routeIndex=0;
 const w=s.worlds[s.actual];w.name='Actual Service Harbor';w.uwp=port+'77'+hydro+'777-A';Object.assign(w.raw,{Name:w.name,UWP:w.uwp});
 const remote=s.worlds[s.route[1]];remote.name='Browsed Dry Outpost';remote.uwp='X700000-0';Object.assign(remote.raw,{Name:remote.name,UWP:remote.uwp,PBG:'000'});remote.gasGiants=0;
 for(const world of [w,remote])Object.assign(f.apiWorlds.find(raw=>raw.WorldX===world.x&&raw.WorldY===world.y),world.raw);
 f.sec='Hex\tName\n'+f.apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n');
 validate(s);f.bytes=JSON.stringify(s);return f;
}
async function checkMfdLabels(page){
 const labels=await page.locator('#service-panel .mfd-title>[data-action="service-audit"],#service-panel [data-action="service-confirm"]').evaluateAll(buttons=>buttons.map(button=>{const range=document.createRange();range.selectNodeContents(button);return {label:button.textContent.trim(),lines:[...range.getClientRects()].filter(r=>r.width&&r.height).length};}));
 for(const label of labels)assert.equal(label.lines,1,'Audit and confirmation labels stay on one rendered line: '+JSON.stringify(label));
 if(await page.evaluate(()=>innerWidth>=1100)){
  const jump=page.locator('.navigation-panel .route-next>button');
  assert.ok((await jump.boundingBox()).width>=130,'The unchanged desktop navigation retains a usable Jump control width');
 }
}
async function checkRefillTypography(page){
 const boxes=await page.locator('.lss-top button,.lss-total strong').evaluateAll(nodes=>nodes.map(el=>{const range=document.createRange();range.selectNodeContents(el);const rects=[...range.getClientRects()].filter(r=>r.width&&r.height),box=el.getBoundingClientRect();return {text:el.textContent,lines:new Set(rects.map(r=>Math.round(r.top))).size,clipped:rects.some(r=>r.left<box.left-1||r.right>box.right+1)};}));
 for(const box of boxes){assert.equal(box.lines,1,'Refill label/value stays on one line: '+JSON.stringify(box));assert.equal(box.clipped,false,'Refill label/value fits its control: '+JSON.stringify(box));}
 const gap=await page.locator('#lss-comfort-note').evaluate(el=>el.nextElementSibling.getBoundingClientRect().top-el.getBoundingClientRect().bottom);assert.ok(gap>=10,'Comfort note focus outline clears its explanatory text');
}
async function frameBoxes(page){
 await overviewGeometry(page);
 return page.evaluate(()=>Object.fromEntries(Object.entries({map:'.world-map',navigation:'.navigation-panel',right:'.navigation-layout>.world-screen',layout:'.navigation-layout',bezel:'.mfd-frame',screen:'.mfd-screen'}).map(([name,selector])=>{const r=document.querySelector(selector).getBoundingClientRect();return [name,{width:r.width,height:r.height}];})));
}
async function fixedFrame(page,before,label){const after=await frameBoxes(page);frameEvidence.push({label,before,after});for(const name of Object.keys(before))for(const dimension of ['width','height'])assert.ok(Math.abs(after[name][dimension]-before[name][dimension])<=1,label+': '+name+' '+dimension+' remains static ('+before[name][dimension]+' -> '+after[name][dimension]+')');}
async function run(name,options,test){
 const f=fixture(options),context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true}),errors=[];
 context.setDefaultTimeout(12000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
 await context.route('https://travellermap.com/api/**',async route=>{
  const u=new URL(route.request().url());assert.equal(u.searchParams.get('milieu'),'M1105');
  if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
  if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
  if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
  if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
  throw Error('Unexpected API request '+u.href);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const action=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
 const click=async(name,arg)=>{if(name==='search')await page.locator('[data-action="trade-side"][data-arg="buy"]').click();if(['buyer-search','sale'].includes(name))await existingSell(page);if(name==='service-cancel'&&!await action(name).count())name='service-back';return action(name,arg).click();};
 const field=name=>page.locator('#service-form [name="'+name+'"]');
 const fill=(name,value)=>field(name).fill(String(value));
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
 const read=async()=>JSON.parse(await raw());
 const unchanged=async(label,expected=f.bytes)=>assert.equal(await raw(),expected,label+' must preserve every saved campaign byte');
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const closed=()=>page.locator('#service-panel').waitFor({state:'hidden'});
 const saved=()=>page.locator('#service-panel.service-saved').waitFor({state:'visible'});
 const open=async(type='refuel')=>{await click(type);await page.locator('#service-panel').waitFor({state:'visible'});assert.equal(await page.locator('#modal').isVisible(),false,'Service uses the right screen, not a blocking dialog');};
 const undo=async()=>{await click('tab','History');await click('undo');await click('tab','Overview');};
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await test({f,context,page,action,click,field,fill,raw,read,unchanged,frames,closed,saved,open,undo});
  assert.deepEqual(errors,[],name+' has no uncaught browser errors');results.push(name);console.log('PASS: '+name);
 }catch(error){await page.screenshot({path:artifacts+'/service-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-failure.png',fullPage:true}).catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/service-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-trace.zip'});await context.close();}
}

try{
 for(const width of [1440,390,320])await run('independent paid refill '+width,{awake:1,stockUnits:'12.8',frozen:1},async h=>{
  const {page,click,fill,read,unchanged}=h;await page.setViewportSize({width,height:1000});await h.open('refill-support');
  assert.equal(await page.locator('[data-action="service-review"]').count(),0);await fill('cargo',100);assert.equal(await h.field('internal').inputValue(),'12');await unchanged('Editing cargo');
  assert.equal(await h.action('service-confirm').isEnabled(),true);assert.match(await page.locator('.lss-total').innerText(),/3,572/);
  await click('service-audit');assert.equal(await page.locator('.lss-audit').getAttribute('open'),'');await click('service-cancel');await unchanged('Cancel');
  await h.open('refill-support');await fill('cargo',100);await page.locator('.lss-comfort summary').click();await fill('comfortCredits',777);assert.equal(await h.action('service-confirm').isDisabled(),true);await fill('comfortNote','Fresh provisions');
  assert.match(await page.locator('.lss-total').innerText(),/4,349/);assert.equal(await page.locator('.lss-aboard strong').innerText(),'112');await h.frames();await page.locator('#service-panel').evaluate(p=>p.scrollTop=0);await page.screenshot({path:artifacts+'/lss-integrated-top-'+width+'.png',fullPage:true});await page.locator('.lss-cargo').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:artifacts+'/lss-integrated-middle-'+width+'.png',fullPage:true});await page.locator('.lss-total').scrollIntoViewIfNeeded();await checkRefillTypography(page);await page.screenshot({path:artifacts+'/lss-integrated-total-'+width+'.png',fullPage:true});
  await click('service-confirm');await h.saved();const paid=await read();assert.equal(paid.bank,'95651');assert.deepEqual(paid.ship.lifeSupport.stockUnits,{numerator:'564',denominator:'5'});assert.deepEqual(paid.ship.lifeSupport.cargoUnits,{numerator:'100',denominator:'1'});assert.equal(paid.ledger.length,1);
  await click('service-new');assert.equal(await h.action('service-confirm').isDisabled(),true);await fill('cargo',0);assert.equal(await h.action('service-confirm').isDisabled(),true);assert.equal(await h.action('service-gm').isEnabled(),true);await click('service-gm');await h.saved();const adjusted=await read();assert.equal(adjusted.bank,paid.bank);assert.deepEqual(adjusted.ship.lifeSupport.stockUnits,{numerator:'64',denominator:'5'});assert.equal(adjusted.ledger.length,1);
 });
 await run('retained fractions and validity restoration',{awake:1,stockUnits:'16.2',cargoUnits:3.4},async h=>{
  await h.open('refill-support');await h.fill('internal',13);await h.fill('internal',12);await h.page.locator('.lss-comfort summary').click();await h.fill('comfortCredits',777);await h.fill('comfortNote','Comfort only');
  assert.match(await h.page.locator('.lss-aboard').innerText(),/16/);await h.fill('cargo',100000);assert.equal(await h.action('service-confirm').isDisabled(),true);await h.fill('cargo',3);assert.equal(await h.field('cargo').evaluate(e=>e.validity.valid),true);assert.equal(await h.action('service-confirm').isEnabled(),true);await h.click('service-cancel');await h.unchanged('Restored invalid target and Cancel');
 });
 await run('settings rates preserve exact compartment inventory',{awake:1,stockUnits:'12.8'},async h=>{
  const {page,click,fill,read}=h;await h.open('refill-support');await fill('cargo',10);await click('service-gm');await h.saved();const before=await read();await click('tab','Settings');
  await page.locator('[data-settings-group="support"] > summary').click();await page.locator('[name="refillRate-middle"]').fill('2000');await page.locator('[name="refillRate-high"]').fill('6000');
  await page.locator('#settings-save').click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).ship.accommodation.refillRates?.middle==='2000',campaignKey);const after=await read();assert.deepEqual(after.ship.lifeSupport,before.ship.lifeSupport);assert.equal(after.ship.accommodation.refillRates.high,'6000');
  await click('tab','Overview');await h.open('refill-support');await fill('cargo',38);assert.match(await page.locator('.lss-total').innerText(),/2,000/);
 });
}finally{await browser.close();}
