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
let failure=false,zeroLookups=0;const errors=[],results=[];
const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes:f.bytes});
await context.route('https://travellermap.com/api/**',async route=>{const u=new URL(route.request().url());assert.equal(u.searchParams.get('milieu'),'M1105');if(failure)return route.abort('failed');
 if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
 if(u.pathname.endsWith('/jumpworlds')&&u.searchParams.get('jump')==='0')zeroLookups++;
 if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===+u.searchParams.get('x')&&w.WorldY===+u.searchParams.get('y')):f.apiWorlds}});throw Error('Unexpected request '+u.href);
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const marker=id=>page.locator('[data-action="map-world"][data-arg="'+id+'"]');
const click=action=>page.locator('[data-action="'+action+'"]').filter({visible:true}).first().click();
const setZoom=async value=>{await page.locator('#map-zoom-range').fill(String(value));await page.locator('#map-zoom-range').dispatchEvent('input');await frame();};
const clickBody=async id=>{const p=await page.evaluate(id=>{const el=document.querySelector('[data-action="map-world"][data-arg="'+id+'"]');const body=el.querySelector('.world-disc,.world-belt'),r=body.getBoundingClientRect();const x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,target=document.elementFromPoint(x,y);return {x,y,target:target?.outerHTML?.slice(0,250),action:target?.closest('[data-action]')?.dataset.action,arg:target?.closest('[data-action]')?.dataset.arg};},id);assert.equal(p.action,'map-world','Body target: '+JSON.stringify(p));assert.equal(p.arg,id);await page.mouse.click(p.x,p.y);await frame();};
const stored=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await frame();
 assert.deepEqual(await page.evaluate(()=>{const el=document.querySelector('.world-map');return {color:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage};}),{color:'rgb(8, 11, 16)',image:'none'});
 const planned=()=>page.locator('.planned-route-line').getAttribute('points');const original=await planned();assert.ok(original.split(' ').length===12);
 assert.equal(await marker(home.id).locator('.water-disc').count(),1);assert.equal(await page.locator('.symbol-ship').count(),1);
 await setZoom(200);
 for(const w of rows.slice(0,3)){await page.locator('.map-viewport').scrollIntoViewIfNeeded();await clickBody(w.id);assert.equal(await page.locator('.selected-world').getAttribute('data-arg'),w.id,'Clicking the visible body browses '+w.name);}
 await click('world');await frame();
 const reference=await context.newPage();await reference.goto(new URL('player-map-preview.html?sector=Verification+Reach&hex='+home.hex,base).href);await reference.getByText(/Reference map loaded/).waitFor();
 for(const w of rows.slice(0,3)){
  const main=marker(w.id),player=reference.locator('[data-world="'+w.id+'"]');
  for(const cls of ['water-disc','dry-disc','world-belt','symbol-naval','symbol-scout','gas-giant','zone-A','zone-R'])assert.equal(await main.locator('.'+cls).count(),await player.locator('.'+cls).count(),w.name+' '+cls);
  assert.equal(await main.locator('.allegiance-label').textContent(),await player.locator('.allegiance-label').textContent());
 }
 assert.equal(await page.evaluate(id=>getComputedStyle(document.querySelector('[data-action="map-world"][data-arg="'+id+'"] .world-name')).fill,home.id),'rgb(255, 48, 69)','Selected capitals retain the player map red name');assert.equal(await marker(home.id).locator('.world-uwp').textContent(),'B777777-A');assert.equal(await marker(home.id).locator('.symbol-starport').textContent(),'A');
 assert.equal(await reference.locator('[data-world="'+home.id+'"] .world-uwp').textContent(),'A788899-C');await reference.close();
 for(const width of [1440,1100,390,320]){
  await page.setViewportSize({width,height:1000});await frame();await setZoom(200);
  for(const expanded of [false,true]){
   if(expanded){await click('map-expand');await frame();}
   for(const zoom of [79,80,99,100,101,139,140,141,199,200,240,288]){
    await setZoom(zoom);assert.equal(await page.locator('.hex-grid text').count()>0,zoom>=100,`${width}/${expanded}/${zoom}: hex visibility`);
    if(zoom>=100){
     const labels=await page.evaluate(({id,hex})=>{const el=[...document.querySelectorAll('.hex-grid text')].find(x=>x.textContent===hex),style=getComputedStyle(el),r=el.getBoundingClientRect(),world=document.querySelector('[data-action="map-world"][data-arg="'+id+'"]');const overlaps=[...world.querySelectorAll('.world-disc,.world-name,.world-uwp,.symbol-starport')].filter(x=>{const b=x.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;}).map(x=>x.getAttribute('class'));return {size:style.fontSize,weight:style.fontWeight,fill:style.fill,stroke:style.stroke,halo:style.strokeWidth,paint:style.paintOrder,pointer:style.pointerEvents,width:r.width,overlaps};},{id:home.id,hex:home.hex});
     assert.equal(labels.size,'10px');assert.equal(labels.weight,'400');assert.equal(labels.fill,'rgb(127, 144, 159)');assert.equal(labels.stroke,'rgb(8, 11, 16)');assert.equal(labels.halo,'2px');assert.equal(labels.paint,'stroke');assert.equal(labels.pointer,'none');assert.ok(labels.width<50*zoom/100*Math.sqrt(3)/2);assert.deepEqual(labels.overlaps,[],`${width}/${expanded}/${zoom}: hex clear of world details`);
     assert.ok((await planned()).split(' ').length===12);assert.equal(await stored(),f.bytes);
     if(zoom===100||zoom===200){
      const routeAtZoom=await planned();
      for(const political of [true,false]){
       const control=page.getByRole('switch',{name:'Political territory',exact:true});await control.setChecked(political);await frame();
       await page.locator('.map-viewport').screenshot({path:artifacts+`hex-tone-${zoom}-${width}-${expanded?'expanded':'normal'}-${political?'political':'plain'}.png`});
       if(width===1440&&!expanded&&zoom===200&&political){const old=await page.addStyleTag({content:'.world-map .hex-grid text{font-size:11px;font-weight:400;fill:#a8b6c5;stroke-width:3px}'});await page.locator('.map-viewport').screenshot({path:artifacts+'hex-tone-before.png'});await old.evaluate(el=>el.remove());}
       assert.equal(await planned(),routeAtZoom);assert.equal(await stored(),f.bytes);
      }
      await page.getByRole('switch',{name:'Political territory',exact:true}).check();await frame();
     }
    }
   }
   for(const zoom of [139,140,141,199,200,201]){
    await setZoom(zoom);const detailed=zoom>=200;
    for(const cls of ['symbol-starport','allegiance-label','world-uwp'])assert.equal(await marker(home.id).locator('.'+cls).count(),detailed?1:0,`${width}/${expanded}/${zoom}: ${cls}`);
    for(const cls of ['symbol-naval','symbol-scout','gas-giant'])assert.equal(await marker(home.id).locator('.'+cls).count(),detailed?1:0);
    assert.equal(await marker(rows[2].id).locator('.zone-A').count(),zoom>=140?1:0);
    assert.equal(await marker(rows[0].id).locator('.zone-R').count(),zoom>=140?1:0);
    assert.equal(await page.locator('.map-level-label').textContent(),detailed?'Worlds + UWP':'Worlds');
    if(zoom>=140&&zoom<200){
     for(const w of [rows[0],rows[2]]){const markerBox=await marker(w.id).evaluate(el=>{const a=el.querySelector('.compact-zone').getBoundingClientRect(),b=el.querySelector('.world-name').getBoundingClientRect();return {clear:a.top>=b.bottom,stroke:getComputedStyle(el.querySelector('.compact-zone')).stroke};});assert.equal(markerBox.clear,true,'Compact travel zone clears world name');}
     const savedRoute=await planned();await page.getByRole('switch',{name:'Political territory',exact:true}).uncheck();await frame();assert.equal(await marker(rows[0].id).locator('.zone-R').count(),1);assert.equal(await marker(rows[2].id).locator('.zone-A').count(),1);assert.equal(await planned(),savedRoute);await page.getByRole('switch',{name:'Political territory',exact:true}).check();await frame();
    }
    if([139,140,141,200].includes(zoom))await page.locator('.map-viewport').screenshot({path:artifacts+`travel-zone-${zoom}-${width}-${expanded?'expanded':'normal'}.png`});

    assert.ok((await planned()).split(' ').length===12);assert.equal(await stored(),f.bytes);
    if(detailed){
     await page.locator('.map-viewport').scrollIntoViewIfNeeded();await clickBody(home.id);
     const layout=await marker(home.id).evaluate(el=>{const box=s=>el.querySelector(s).getBoundingClientRect(),body=box('.world-disc'),name=box('.world-name'),uwp=box('.world-uwp'),port=box('.symbol-starport');return {bodyUwp:body.bottom<=uwp.top,uwpName:uwp.bottom<=name.top,portBody:port.bottom<=body.top};});
     assert.deepEqual(layout,{bodyUwp:true,uwpName:true,portBody:true},`${width}/${expanded}/${zoom}: readable detail rows`);
    }
   }
   await setZoom(200);await page.locator('.map-viewport').screenshot({path:artifacts+`main-map-200-${width}-${expanded?'expanded':'normal'}.png`});
   if(expanded){await click('map-expand');await frame();}
  }
  for(const zoom of [20,80,199,200,201,240,288]){
   await setZoom(zoom);
   await page.waitForFunction(()=>document.querySelector('.territory-fill')&&document.querySelector('.territory-border'));
   const paints=await page.evaluate(()=>{const fill=document.querySelector('.territory-fill'),border=document.querySelector('.territory-border');return {fill:fill&&getComputedStyle(fill).fillOpacity,border:border&&getComputedStyle(border).strokeOpacity,width:border&&getComputedStyle(border).strokeWidth,outline:border&&getComputedStyle(border).filter};});
   assert.equal(paints.fill,'0.24');assert.equal(paints.border,'1');assert.equal(paints.width,'1.8px');assert.match(paints.outline,/drop-shadow/);
   assert.ok((await planned()).split(' ').length===12);
  }
  await setZoom(200);
  const routeBefore=await planned();await page.getByRole('switch',{name:'Political territory',exact:true}).uncheck();await frame();assert.equal(await planned(),routeBefore);assert.equal(await page.locator('.territory-border').count(),0);
  await page.getByRole('switch',{name:'Political territory',exact:true}).check();await frame();assert.equal(await planned(),routeBefore);
  await page.getByRole('switch',{name:'Show UWP',exact:true}).uncheck();assert.equal(await page.locator('.world-uwp').count(),0);assert.equal(await planned(),routeBefore);await page.getByRole('switch',{name:'Show UWP',exact:true}).check();
  await marker(rows[0].id).press('Enter');await frame();assert.equal(await page.locator('.selected-world').getAttribute('data-arg'),rows[0].id);assert.equal(await marker(home.id).locator('.symbol-ship').count(),1);assert.equal(await marker(rows[0].id).locator('.dry-disc').count(),1);
  const geometry=await page.evaluate(()=>{const slider=document.querySelector('.map-zoom-slider').getBoundingClientRect(),map=document.querySelector('.map-viewport').getBoundingClientRect();return {sliderAbove:slider.bottom<=map.top,overflow:document.documentElement.scrollWidth-innerWidth};});assert.equal(geometry.sliderAbove,true);assert.ok(geometry.overflow<=1);
  await page.locator('.map-viewport').screenshot({path:artifacts+'main-map-parity-'+width+'.png'});
  await click('world');await frame();await page.locator('#route-menu > summary').click();await click('route-build');await frame();assert.ok((await planned()).split(' ').length===12,'Saved route stays visible during a draft');assert.equal(await page.locator('.draft-route-line').count(),1);await page.locator('.map-viewport').scrollIntoViewIfNeeded();const beforeLookup=zeroLookups;await clickBody(rows[2].id);assert.equal(zeroLookups,beforeLookup,'Clicking the belt chooses a loaded world, not the underlying empty hex');assert.match(await page.locator('.route-draft').textContent(),/Belt Station/);await click('route-cancel');await frame();assert.equal(await page.locator('.draft-route-line').count(),0);
  await click('map-expand');await frame();assert.equal(await page.locator('.map-zoom-slider').count(),1);assert.ok(await planned());await click('map-expand');await click('world');await frame();
  assert.equal(await stored(),f.bytes);results.push({width,pass:true});
 }
 failure=true;await click('nearby');await frame();assert.equal(await marker(home.id).locator('.water-disc').count(),1,'Saved source data still renders when refreshing fails');assert.ok(await planned());assert.equal(await stored(),f.bytes);assert.deepEqual(errors,[]);
 await writeFile(artifacts+'main-map-parity-report.json',JSON.stringify({pass:true,results,source:'Synthetic M1105 API fixtures; no live API claim'},null,2));console.log('PASS: shared player/main glyphs, source/effective data, saved route and draft separation, political/UWP filters, keyboard selection, slider location, expansion, mobile and campaign isolation.');
}finally{await browser.close();}
