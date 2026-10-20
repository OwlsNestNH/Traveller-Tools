// Synthetic source-data parity plus preserved main-tool interactions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_EXECUTABLE?{executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE}:{})});
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const f=guiFixture(12),home=f.state.worlds[f.state.actual],rows=Object.values(f.state.worlds);
const source=[{UWP:'C200423-7',Bases:'D',Zone:'F',PBG:'000',Allegiance:'Na',Remarks:''},{UWP:'A788899-C',Bases:'NS',Zone:'',PBG:'703',Allegiance:'ImDd',Remarks:'Ri Cp'},{UWP:'A000000-0',Bases:'KM',Zone:'U',PBG:'001',Allegiance:'ZhCo',Remarks:''},{UWP:'???????-?',Bases:'?',Zone:'?',PBG:'???',Allegiance:'?',Remarks:''}];
for(let i=0;i<source.length;i++){const w=rows[i];Object.assign(w.raw,source[i]);w.uwp=source[i].UWP;w.name=['Dry Harbour','Water Capital','Belt Station','Unknown World'][i];w.raw.Name=w.name;Object.assign(f.apiWorlds.find(r=>r.WorldX===w.x&&r.WorldY===w.y),w.raw);}
home.overrideUWP='B777777-A';f.bytes=JSON.stringify(f.state);
f.metadata.Borders=[{Allegiance:'ImDd',Path:'0510 0610 0611 0511'}];f.metadata.Allegiances=[{Code:'ImDd',Name:'Third Imperium'}];
let failure=false;const errors=[],results=[];
const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:f.bytes});
await context.route('https://travellermap.com/api/**',async route=>{const u=new URL(route.request().url());assert.equal(u.searchParams.get('milieu'),'M1105');if(failure)return route.abort('failed');
 if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
 if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===+u.searchParams.get('x')&&w.WorldY===+u.searchParams.get('y')):f.apiWorlds}});throw Error('Unexpected request '+u.href);
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const marker=id=>page.locator('[data-action="map-world"][data-arg="'+id+'"]');
const click=action=>page.locator('[data-action="'+action+'"]').filter({visible:true}).first().click();
const setZoom=async value=>{await page.locator('#map-zoom-range').fill(String(value));await page.locator('#map-zoom-range').dispatchEvent('input');await frame();};
const stored=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frame();
 const planned=()=>page.locator('.planned-route-line').getAttribute('points');const original=await planned();assert.ok(original.split(' ').length===12);
 assert.equal(await marker(home.id).locator('.water-disc').count(),1);assert.equal(await page.locator('.symbol-ship').count(),1);
 await setZoom(240);
 const reference=await context.newPage();await reference.goto(new URL('player-map-preview.html?sector=Verification+Reach&hex='+home.hex,base).href);await reference.getByText(/Reference map loaded/).waitFor();
 for(const w of rows.slice(0,3)){
  const main=marker(w.id),player=reference.locator('[data-world="'+w.id+'"]');
  for(const cls of ['water-disc','dry-disc','world-belt','symbol-naval','symbol-scout','gas-giant','zone-A','zone-R'])assert.equal(await main.locator('.'+cls).count(),await player.locator('.'+cls).count(),w.name+' '+cls);
  assert.equal(await main.locator('.allegiance-label').textContent(),await player.locator('.allegiance-label').textContent());
 }
 assert.equal(await marker(home.id).locator('.world-uwp').textContent(),'B777777-A');assert.equal(await marker(home.id).locator('.symbol-starport').textContent(),'A');
 assert.equal(await reference.locator('[data-world="'+home.id+'"] .world-uwp').textContent(),'A788899-C');await reference.close();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await frame();await setZoom(240);
  const routeBefore=await planned();await page.getByRole('switch',{name:'Political territory',exact:true}).uncheck();await frame();assert.equal(await planned(),routeBefore);assert.equal(await page.locator('.territory-border').count(),0);
  await page.getByRole('switch',{name:'Political territory',exact:true}).check();await frame();assert.equal(await planned(),routeBefore);
  await page.getByRole('switch',{name:'Show UWP',exact:true}).uncheck();assert.equal(await page.locator('.world-uwp').count(),0);assert.equal(await planned(),routeBefore);await page.getByRole('switch',{name:'Show UWP',exact:true}).check();
  await marker(rows[0].id).press('Enter');await frame();assert.equal(await page.locator('.selected-world').getAttribute('data-arg'),rows[0].id);assert.equal(await marker(home.id).locator('.symbol-ship').count(),1);assert.equal(await marker(rows[0].id).locator('.dry-disc').count(),1);
  const geometry=await page.evaluate(()=>{const slider=document.querySelector('.map-zoom-slider').getBoundingClientRect(),map=document.querySelector('.map-viewport').getBoundingClientRect();return {sliderAbove:slider.bottom<=map.top,overflow:document.documentElement.scrollWidth-innerWidth};});assert.equal(geometry.sliderAbove,true);assert.ok(geometry.overflow<=1);
  await page.locator('.map-viewport').screenshot({path:artifacts+'main-map-parity-'+width+'.png'});
  await page.locator('#route-menu > summary').click();await click('route-build');await frame();assert.ok((await planned()).split(' ').length===12,'Saved route stays visible during a draft');assert.equal(await page.locator('.draft-route-line').count(),1);await click('route-cancel');await frame();assert.equal(await page.locator('.draft-route-line').count(),0);
  await click('map-expand');await frame();assert.equal(await page.locator('.map-zoom-slider').count(),1);assert.ok(await planned());await click('map-expand');await click('world');await frame();
  assert.equal(await stored(),f.bytes);results.push({width,pass:true});
 }
 failure=true;await click('nearby');await frame();assert.equal(await marker(home.id).locator('.water-disc').count(),1,'Saved source data still renders when refreshing fails');assert.ok(await planned());assert.equal(await stored(),f.bytes);assert.deepEqual(errors,[]);
 await writeFile(artifacts+'main-map-parity-report.json',JSON.stringify({pass:true,results,source:'Synthetic M1105 API fixtures; no live API claim'},null,2));console.log('PASS: shared player/main glyphs, source/effective data, saved route and draft separation, political/UWP filters, keyboard selection, slider location, expansion, mobile and campaign isolation.');
}finally{await browser.close();}
