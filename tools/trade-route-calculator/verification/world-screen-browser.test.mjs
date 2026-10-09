import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const f=guiFixture(12),current=f.state.worlds[f.state.actual],selected=f.state.worlds[f.state.route[2]];
Object.assign(current,{name:'Verification Harbor',overrideUWP:'B777777-A'});
Object.assign(current.raw,{Name:current.name,UWP:'C774622-5',PBG:'303',Bases:'NS',Zone:'A',SubsectorName:'Verification',Allegiance:'Im',AllegianceName:'Third Imperium'});
Object.assign(selected.raw,{Bases:null,PBG:'30?',Zone:'?',SubsectorName:'Verification'});
f.bytes=JSON.stringify(f.state);
for(const w of [current,selected])Object.assign(f.apiWorlds.find(raw=>raw.WorldX===w.x&&raw.WorldY===w.y),w.raw);
const context=await browser.newContext({viewport:{width:1440,height:1100}}),errors=[],requests=[];
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:f.bytes});
await context.route('https://travellermap.com/api/**',async route=>{
 const u=new URL(route.request().url());requests.push(u.href);assert.equal(u.searchParams.get('milieu'),'M1105');
 if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
 if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
 if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
 if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
 throw Error('Unexpected request '+u.href);
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const click=(action,arg)=>page.locator('[data-action="'+action+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const screen=page.getByRole('complementary',{name:'Selected world data'});
const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function closeZoom(){for(let i=0;i<6;i++){await click('map-zoom-in');await frame();}await page.locator('.map-zoom-controls .help').getByText('240%',{exact:true}).waitFor();}
try{
 await page.goto(process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/');await page.getByText('Editing in this tab',{exact:true}).waitFor();await frame();
 assert.equal(await screen.locator('.screen-title strong').textContent(),current.name);
 assert.equal(await screen.locator('.screen-uwp tbody tr').count(),8);
 assert.equal(await screen.locator('.screen-section-heading .mono').textContent(),'C774622-5');
 assert.match(await screen.locator('.screen-override').textContent(),/B777777-A/);
 assert.match(await screen.locator('.world-facts').first().textContent(),/3,000,000/);
 assert.match(await screen.locator('.screen-system').textContent(),/Naval Base.*Scout Base/);
 assert.equal(await page.locator('.map-key li').count(),8);
 assert.equal(await page.locator('.world-info').count(),1,'Selected-world strip is moved, not duplicated');
 const layout=await page.evaluate(()=>{const a=document.querySelector('.navigation-panel').getBoundingClientRect(),b=document.querySelector('.world-screen').getBoundingClientRect();return {a:{right:a.right,top:a.top},b:{left:b.left,top:b.top}};});
 assert.ok(layout.b.left>layout.a.right&&Math.abs(layout.b.top-layout.a.top)<2,'Desktop has adjacent, top-aligned screens');
 await closeZoom();const marker=page.locator('svg [data-action="map-world"][data-arg="'+current.id+'"]');
 for(const cls of ['symbol-starport','symbol-gas-giant','symbol-naval','symbol-scout','zone-amber','symbol-selection','symbol-ship'])assert.equal(await marker.locator('.'+cls).count(),1,cls);
 assert.equal(await marker.locator('.symbol-starport').textContent(),'C','Port symbol uses published UWP');
 assert.equal(await marker.locator('.world-uwp').textContent(),'B777777-A','Existing effective-UWP labels are retained');
 await page.screenshot({path:artifacts+'/world-screen-desktop.png',fullPage:true});
 const long=page.locator('svg [data-action="map-world"][data-arg="'+selected.id+'"]');assert.match(await long.locator('.world-name').textContent(),/…$/);assert.match(await long.locator('title').textContent(),/ExtraordinarilyLong/);
 const bounds=await long.locator('.world-name').boundingBox();assert.ok(bounds.width<110,'Long names stay within a single closest-zoom cell');
 await long.focus();await page.keyboard.press('Enter');await frame();
 assert.equal(await screen.locator('.screen-title strong').textContent(),selected.name);
 assert.equal(await screen.locator('.screen-title .tag').textContent(),'Not supplied');
 assert.match(await screen.locator('.screen-system').textContent(),/Gas giantsNot suppliedBasesNot supplied/);
 assert.equal(await page.locator('.symbol-selection').count(),2,'One selected bracket plus the legend example');
 assert.equal(await raw(),f.bytes,'Selecting a world leaves every saved byte unchanged');
 // Browse back to ship without moving it; an API-zero lookup is only allowed
 // when opening existing full Planet information explicitly.
 await click('world',current.id);await frame();
 assert.equal(requests.filter(url=>new URL(url).searchParams.get('jump')==='0').length,0,'Panel and symbols add no per-world requests');
 await click('planet-info');await page.getByText('Loaded from Traveller Map.',{exact:true}).waitFor();await page.locator('#modal-close').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await frame();
  const b=await page.evaluate(()=>{const map=document.querySelector('.navigation-panel').getBoundingClientRect(),screen=document.querySelector('.world-screen').getBoundingClientRect();return {mapBottom:map.bottom,screenTop:screen.top,left:screen.left,right:screen.right,overflow:document.documentElement.scrollWidth-innerWidth};});
  assert.ok(b.screenTop>=b.mapBottom,'Mobile world data follows the map');assert.ok(b.left>=0&&b.right<=width&&b.overflow<=1,'Mobile has no page overflow');
  assert.equal(await screen.locator('.screen-uwp tbody tr').count(),8);
  await page.screenshot({path:artifacts+'/world-screen-'+width+'.png',fullPage:true});
 }
 assert.equal(await raw(),f.bytes,'Reading controls and viewport changes do not change saves or Undo');
 assert.deepEqual(errors,[]);
 await writeFile(artifacts+'/world-screen-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,viewports:[1440,390,320],apiZeroLookups:requests.filter(url=>new URL(url).searchParams.get('jump')==='0').length,errors},null,2));
 console.log('PASS: selected world screen, published eight-row UWP, override distinction, data absence, closest symbols, long names, keyboard browsing, desktop/mobile, unchanged campaign and Undo, no added per-world API requests.');
}finally{await context.tracing.stop({path:artifacts+'/world-screen-trace.zip'});await browser.close();}
