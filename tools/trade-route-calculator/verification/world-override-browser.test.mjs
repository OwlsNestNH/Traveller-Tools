import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const reports=[],base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
try{
 for(const width of [1440,390])for(const browsed of [false,true]){
  const f=guiFixture(),actual=f.state.worlds[f.state.actual],selected=f.state.worlds[f.state.route[2]],target=browsed?selected:actual;
  actual.name='Verification Harbor';selected.name='Verification Destination';
  for(const w of [actual,selected]){w.raw={...w.raw,Name:w.name,UWP:w.uwp,PBG:'703',Bases:'NS',Zone:'',Allegiance:'Im',SubsectorName:'Fixture'};Object.assign(f.apiWorlds.find(r=>r.WorldX===w.x&&r.WorldY===w.y),w.raw);}
  const context=await browser.newContext({viewport:{width,height:1000}}),errors=[];
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:JSON.stringify(f.state)});
  await context.route('https://travellermap.com/api/**',route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
   if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
   if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
   if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>w.Hex===u.searchParams.get('hex')):f.apiWorlds}});
   throw Error('Unexpected API route '+u.href);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const action=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),campaignKey);
  const panel=page.locator('#world-information-panel'),profile=panel.locator('.screen-section-heading .mono');
  const ready=()=>page.getByText('Editing in this tab',{exact:true}).waitFor();
  const close=()=>page.locator('#modal').waitFor({state:'hidden'});
  const selectTarget=async()=>{if(browsed)await action('map-world',target.id);};
  const edit=async(uwp='B563456-8',reason='Campaign survey verified')=>{await action('override',target.id);await page.locator('[name="uwp"]').fill(uwp);await page.locator('[name="reason"]').fill(reason);};
  await page.goto(base);await ready();await selectTarget();const before=await read();
  assert.equal(await panel.locator('.screen-title strong').textContent(),target.name);
  await edit();assert.deepEqual(await read(),before);await page.locator('#modal-cancel').click();await close();assert.deepEqual(await read(),before);assert.equal(await profile.textContent(),target.uwp);
  await edit('bad','Invalid entry');await page.locator('#modal-submit').click();assert.match(await page.locator('#modal-error').textContent(),/UWP/);assert.deepEqual(await read(),before);await page.locator('#modal-cancel').click();
  await edit();await page.locator('#modal-submit').click();await close();
  const after=await read();assert.equal(after.revision,before.revision+1);assert.equal(after.worlds[target.id].overrideUWP,'B563456-8');
  assert.equal(await profile.textContent(),'B563456-8');
  assert.deepEqual(await panel.locator('.screen-uwp tbody tr td:nth-child(2)').allTextContents(),['B','5','6','3','4','5','6','8']);
  assert.match(await panel.locator('.world-facts').first().textContent(),/7 × 10\^4 = 70,000/);
  assert.match(await panel.locator('.screen-override').textContent(),/Published UWP: A788899-C.*Reason: Campaign survey verified/);
  for(const key of ['actual','bank','hours','route','ship','lots','contracts','ledger','snapshots'])assert.deepEqual(after[key],before[key]);
  assert.deepEqual(after.worlds[target.id].raw,before.worlds[target.id].raw);
  for(let i=0;i<6;i++)await action('map-zoom-in');
  const marker=page.locator('svg [data-action="map-world"][data-arg="'+target.id+'"]');
  assert.equal(await marker.locator('.world-uwp').textContent(),'B563456-8');assert.equal(await marker.locator('.symbol-starport').textContent(),'A');
  await panel.locator('.screen-section-heading').scrollIntoViewIfNeeded();await page.screenshot({path:artifacts+`/world-override-${width}-${browsed?'selected':'actual'}-profile.png`,fullPage:true});
  await panel.locator('.screen-override').scrollIntoViewIfNeeded();await page.screenshot({path:artifacts+`/world-override-${width}-${browsed?'selected':'actual'}-reference.png`,fullPage:true});
  assert.ok(await panel.locator('.screen-override').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Reference does not overflow');
  await action('planet-info',target.id);await page.getByText('Loaded from Traveller Map.',{exact:true}).waitFor();
  assert.match(await page.locator('#planet-information').textContent(),/Universal World Profile · A788899-C/);await page.locator('#modal-close').click();assert.deepEqual(await read(),after);
  await page.reload();await ready();await selectTarget();assert.equal(await profile.textContent(),'B563456-8');assert.match(await panel.locator('.screen-override').textContent(),/Reason: Campaign survey verified/);assert.deepEqual(await read(),after);
  await action('tab','History');await action('undo');await action('tab','Overview');await selectTarget();
  const undone=await read();assert.deepEqual(undone.worlds[target.id],before.worlds[target.id]);assert.equal(await profile.textContent(),target.uwp);assert.equal(await panel.locator('.screen-override').count(),0);
  for(const key of ['actual','bank','hours','route','ship','lots','contracts','ledger','snapshots'])assert.deepEqual(undone[key],before[key]);
  assert.deepEqual(errors,[]);reports.push({width,browsed,save:true,cancel:true,invalid:true,reload:true,undo:true,publishedReference:true,publishedDialog:true,unchangedEconomics:true,errors});await context.close();
 }
 await writeFile(artifacts+'/world-override-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,pass:true,cases:reports},null,2));
 console.log('PASS: effective UWP and eight decoded MFD rows, effective population, published reference/dialog/symbols, current and browsed worlds, cancel/invalid/save/reload/Undo, desktop/mobile, unchanged campaign economics.');
}finally{await browser.close();}
