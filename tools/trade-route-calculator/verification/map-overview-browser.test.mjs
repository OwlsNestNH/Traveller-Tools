import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {overviewGeometry} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const fixtures=JSON.parse(await readFile(new URL('./fixtures/map-overview.json',import.meta.url),'utf8'));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
let failSector=true,requests=0,denebTableAttempts=0;
await context.route('https://travellermap.com/api/**',async route=>{
 const url=new URL(route.request().url()),name=url.searchParams.get('sector');
 assert.equal(url.searchParams.get('milieu'),'M1105');
 if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixtures.universe});
 if(url.pathname.endsWith('/metadata')){
  requests++;
  return route.fulfill({json:fixtures.catalogs[name]?.metadata||{Subsectors:[]}});
 }
 if(url.pathname.endsWith('/sec')){
  if(name==='Deneb')denebTableAttempts++;
  if(name==='Deneb'&&failSector){failSector=false;return route.fulfill({status:503,body:'Temporary map failure'});}
  return route.fulfill({json:fixtures.catalogs[name]?.sec||'Hex\tName\n'});
 }
 if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:fixtures.worlds}});
 throw Error('Unexpected API request: '+url);
});
// Capture the page, not a retained SVG element: async map redraws replace that
// element while screenshots wait for fonts/layout. Assertions still inspect
// the live map immediately before each capture.
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
async function click(name){
 const before=['+','−'].includes(name)?await page.locator('.map-zoom-controls .help').textContent():null;
 await page.getByRole('button',{name:name==='+'?'Zoom in':name==='−'?'Zoom out':name,exact:true}).click();
 // Zoom/reset intentionally paints on requestAnimationFrame. Observe that
 // frame's result before continuing instead of asserting the previous DOM.
 if(name==='Reset view')await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%'&&document.querySelector('.map-content')?.getAttribute('transform')==='translate(0 0)');
 else if(before&&before!==(name==='+'?'288%':'6%'))await page.waitForFunction(previous=>document.querySelector('.map-zoom-controls .help')?.textContent!==previous,before);
}
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const zoom=()=>page.locator('.map-zoom-controls .help').textContent();
const level=()=>page.locator('.world-map').getAttribute('data-map-level');
const transform=()=>page.locator('.map-content').getAttribute('transform');
async function geometry(){return overviewGeometry(page);}

async function reach(target){for(let i=0;i<30&&await zoom()!==target;i++)await click(target==='240%'?'+':'−');assert.equal(await zoom(),target);}
async function drag(){
 // Raw mouse coordinates do not auto-scroll like locator.click(). The map can
 // be below the viewport after toolbar actions or full-page screenshots.
 // Metadata may replace the SVG while Playwright waits for element stability.
 // Read the current node, scroll and measure in one synchronous browser task;
 // the drag itself still uses real mouse input and must change the live map.
 const {before,b}=await page.evaluate(()=>{
  const map=document.querySelector('.world-map');if(!map)throw Error('Map missing before drag');
  map.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});
  const box=map.getBoundingClientRect();
  return {before:map.querySelector('.map-content')?.getAttribute('transform'),b:{x:box.x,y:box.y,width:box.width,height:box.height}};
 });
 assert.ok(before&&b.width>0&&b.height>0,'A rendered live map is required before dragging');
 const viewport=page.viewportSize();
 const x=b.x+b.width*.6,y=b.y+b.height*.5;
 assert.ok(x>=0&&y>=0&&x+60<viewport.width&&y+30<viewport.height,'Drag coordinates must be inside the visible browser viewport');
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+60,y+30,{steps:8});await page.mouse.up();
 await page.waitForFunction(previous=>document.querySelector('.map-content')?.getAttribute('transform')!==previous,before);
}
try{
 await page.goto(process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/');
 await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();
 await click('Start campaign');await page.locator('#modal').waitFor({state:'hidden'});
 const before=await read();assert.equal(await level(),'world');await geometry(320);
 const origin=await page.evaluate(()=>{const svg=document.querySelector('.world-map'),circle=svg.querySelector('[data-action="map-world"][data-arg="-110,-70"] circle');return {cx:Number(circle.getAttribute('cx')),cy:Number(circle.getAttribute('cy')),width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height};});assert.ok(Math.abs(origin.cx-origin.width/2)<.001);assert.equal(origin.cy,origin.height/2-2);
 assert.equal(await page.getByLabel('Political territory',{exact:true}).isChecked(),true);
 await page.locator('.territory-fill').first().waitFor({state:'attached'});
 await page.getByLabel('Political territory',{exact:true}).uncheck();
 assert.equal(await page.locator('.map-territories').count(),0);
 const plainWorlds=await page.locator('.world-name').allTextContents();
 await page.getByLabel('Political territory',{exact:true}).check();
 await page.locator('.territory-fill').first().waitFor({state:'attached'});
 assert.deepEqual(await page.locator('.world-name').allTextContents(),plainWorlds);assert.deepEqual(await read(),before);
 await reach('240%');await geometry(320);assert.ok(await page.locator('.world-uwp').count()>0);
 assert.ok(await page.locator('.territory-fill').count()>0);
 await page.screenshot({fullPage:true,path:artifacts+'/map-world-uwp.png'});
 await page.getByLabel('Political territory',{exact:true}).uncheck();assert.equal(await page.locator('.map-territories').count(),0);
 assert.ok(await page.locator('.world-uwp').count()>0);
 await page.getByLabel('Political territory',{exact:true}).check();
 await click('Reset view');assert.equal(await zoom(),'100%');assert.equal(await page.locator('.world-uwp').count(),0);
 assert.ok(await page.locator('.world-name').count()>0);await page.screenshot({fullPage:true,path:artifacts+'/map-worlds.png'});
 await reach('20%');assert.equal(await level(),'world');assert.ok(await page.locator('.world-name').count()>0);
 await click('−');assert.equal(await level(),'subsector');await geometry(320);
 await page.locator('.subsector-label[data-sector="Spinward Marches"][data-subsector="C"] .subsector-name').getByText('Regina',{exact:true}).waitFor();
 await page.locator('#map-load-status').getByText(/could not load/).waitFor();
 const beforeRetry=denebTableAttempts;
 const retryResponse=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname.endsWith('/sec')&&url.searchParams.get('sector')==='Deneb'&&response.status()===200;});
 await click('Refresh nearby');
 const recovered=await retryResponse;await recovered.finished();
 assert.ok(denebTableAttempts>beforeRetry,'Refresh must retry the failed Deneb world table');
 // render() temporarily clears the status before the scheduled retry begins.
 // Wait for the response and its painted frame, not that transient empty text.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.waitForFunction(()=>document.querySelector('#map-load-status').textContent==='');
 assert.ok(await page.locator('.overview-worlds circle').count()>0);
 assert.equal(await page.locator('.world-name,.world-uwp,.hex-grid').count(),0);
 assert.equal(await page.locator('.overview-labels [data-action]').count(),0);
 await page.screenshot({fullPage:true,path:artifacts+'/map-subsectors.png'});
 await drag();assert.notEqual(await transform(),'translate(0 0)');assert.deepEqual(await read(),before);
 const pan=await transform();assert.equal(await page.locator('#map-hexes').count(),0,'The visible hex toggle is intentionally removed');await page.getByLabel('Show UWP',{exact:true}).uncheck();assert.equal(await transform(),pan);await page.getByLabel('Show UWP',{exact:true}).check();assert.equal(await transform(),pan);
 await reach('6%');assert.equal(await level(),'sector');await geometry(320);
 assert.ok(await page.locator('.sector-name').count()>0);assert.ok(await page.locator('.subsector-letter').count()>0);
 assert.equal(await page.locator('.overview-worlds circle').count(),0);
 const name=page.locator('.sector-label[data-sector="Spinward Marches"]');assert.equal(await name.count(),1);
 await page.screenshot({fullPage:true,path:artifacts+'/map-sectors.png'});
 await page.getByLabel('Political territory',{exact:true}).uncheck();
 await page.waitForTimeout(300);const count=requests;await click('−');await click('−');assert.equal(await zoom(),'6%');
 await drag();assert.deepEqual(await read(),before);await page.waitForTimeout(400);assert.equal(requests,count);
 await page.getByLabel('Political territory',{exact:true}).check();
 await page.locator('.world-map').dispatchEvent('pointerdown',{pointerId:51,pointerType:'touch',isPrimary:true,button:0,clientX:220,clientY:220});
 await page.locator('.world-map').dispatchEvent('pointercancel',{pointerId:51,pointerType:'touch',isPrimary:true});
 await click('Reset view');assert.equal(await zoom(),'100%');assert.equal(await transform(),'translate(0 0)');
 assert.equal(await level(),'world');await page.locator('svg [data-arg="-111,-70"]').click();
 assert.equal(await page.locator('.world-info strong').first().textContent(),'Jenghe');assert.deepEqual(await read(),before);
 await click('Current system');await reach('6%');await page.setViewportSize({width:390,height:844});await geometry(300);
 assert.ok(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth+2));
 await drag();assert.deepEqual(await read(),before);await page.screenshot({fullPage:true,path:artifacts+'/map-sectors-mobile.png'});
 await click('Reset view');assert.equal(await level(),'world');assert.deepEqual(await read(),before);
 assert.deepEqual(errors,[]);
 console.log('PASS: default-on and all-zoom territory toggle, preserved world/UWP layers, subsectors and dots, sector names/letters, API retry, bounded requests, pan/cancel/reset, mobile and campaign immutability.');
}finally{await context.tracing.stop({path:artifacts+'/map-overview-trace.zip'});await browser.close();}
