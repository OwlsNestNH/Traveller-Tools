import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {overviewGeometry} from './overview-layout.mjs';
import {worldReadability,resourceBarGeometry} from './world-readability.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const f=guiFixture(12),current=f.state.worlds[f.state.actual],selected=f.state.worlds[f.state.route[2]];
Object.assign(current,{name:'Verification Harbor',overrideUWP:'B777777-A'});
Object.assign(current.raw,{Name:current.name,UWP:'C774622-5',PBG:'303',Bases:'NS',Zone:'A',SubsectorName:'Verification',Allegiance:'Im',AllegianceName:'Third Imperium'});
Object.assign(selected.raw,{Bases:null,PBG:'30?',Zone:'?',SubsectorName:'Verification',Allegiance:'Long',AllegianceName:'ExtraordinarilyLongUnbrokenAllegianceNameForNarrowViewportVerification'});
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
const labelReports=[],readabilityReports=[],resourceReports=[];
async function labelFitsCell(id){
 await page.waitForFunction(()=>{const svg=document.querySelector('.world-map');if(!svg)return false;const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return b.width>0&&b.height>0&&Math.abs(v.width-b.width*440/b.height)<.15;});
 const label=page.locator('svg [data-action="map-world"][data-arg="'+id+'"] .world-name');
 const q=await label.evaluate(text=>{
  const svg=text.ownerSVGElement,group=text.parentElement,circle=group.querySelector('circle'),uwp=group.querySelector('.world-uwp');
  const cx=Number(circle.getAttribute('cx')),cy=Number(circle.getAttribute('cy'));
  const pointsOf=p=>Array.from({length:p.points.numberOfItems},(_,i)=>{const q=p.points.getItem(i);return {x:q.x,y:q.y};});
  const cell=[...svg.querySelectorAll('.hex-grid polygon')].find(p=>{const points=pointsOf(p);return Math.abs(points.reduce((n,p)=>n+p.x,0)/points.length-cx)<.01&&Math.abs(points.reduce((n,p)=>n+p.y,0)/points.length-cy)<.01;});
  if(!cell)throw Error('Closest-zoom label has no matching hex polygon');
  const b=text.getBBox(),m=text.getScreenCTM(),screen=text.getBoundingClientRect(),points=pointsOf(cell);
  const stroke=parseFloat(getComputedStyle(text).strokeWidth)||0,top=b.y-stroke/2,bottom=b.y+b.height+stroke/2;
  // A hex narrows above/below its center. Test the whole painted label against
  // its actual polygon at both text edges and every intervening vertex, rather
  // than using the polygon's wider bounding box or a fixed screen-pixel limit.
  const levels=[top,bottom,...points.map(p=>p.y).filter(y=>y>top&&y<bottom)];
  const bands=levels.map(y=>{
   const intersections=[];
   for(let i=0;i<points.length;i++){
    const a=points[i],z=points[(i+1)%points.length];
    if(y<Math.min(a.y,z.y)-.001||y>Math.max(a.y,z.y)+.001)continue;
    if(Math.abs(z.y-a.y)<.001){if(Math.abs(y-a.y)<.001)intersections.push(a.x,z.x);}
    else intersections.push(a.x+(y-a.y)*(z.x-a.x)/(z.y-a.y));
   }
   if(intersections.length<2)throw Error('Painted world label extends outside its own hex vertically');
   return {left:Math.min(...intersections),right:Math.max(...intersections)};
  });
  const left=Math.max(...bands.map(b=>b.left)),right=Math.min(...bands.map(b=>b.right));
  const scaleX=Math.hypot(m.a,m.b),scaleY=Math.hypot(m.c,m.d),font=parseFloat(getComputedStyle(text).fontSize),uwpFont=parseFloat(getComputedStyle(uwp).fontSize);
  return {viewport:innerWidth,text:text.textContent,title:group.querySelector('title').textContent,logical:{x:b.x,width:b.width,left:b.x-stroke/2,right:b.x+b.width+stroke/2,cellLeft:left,cellRight:right,cellBandWidth:right-left,font,uwpFont},screen:{left:screen.left-stroke/2*scaleX,right:screen.right+stroke/2*scaleX,width:screen.width,cellLeft:left*m.a+m.e,cellRight:right*m.a+m.e,font:font*scaleY,uwpFont:uwpFont*scaleY},matrix:{a:m.a,b:m.b,c:m.c,d:m.d,scaleX,scaleY}};
 });
 const diagnostic=JSON.stringify(q);
 assert.match(q.text,/…$/,'Long names retain visible ellipsis');assert.match(q.title,/ExtraordinarilyLong/,'The title retains the full world name');
 assert.equal(q.logical.font,14,'Closest-zoom world names retain 14-unit type');assert.equal(q.logical.uwpFont,10,'UWP retains 10-unit type');
 assert.ok(q.screen.font>=12&&q.screen.uwpFont>=9,'Rendered closest-zoom world/UWP text remains readable: '+diagnostic);
 assert.ok(q.logical.width<=88.5,'Long labels respect their 88-unit logical truncation budget: '+diagnostic);
 assert.ok(q.logical.left>=q.logical.cellLeft-.1&&q.logical.right<=q.logical.cellRight+.1,'Painted label fits the actual hex across its full height: '+diagnostic);
 assert.ok(Math.abs(q.matrix.b)<.001&&Math.abs(q.matrix.c)<.001&&Math.abs(q.matrix.scaleX-q.matrix.scaleY)<.001,'Cell and text share the same uniform map projection');
 assert.ok(q.screen.left>=q.screen.cellLeft-.5&&q.screen.right<=q.screen.cellRight+.5,'Rendered label stays inside its own projected hex cell: '+diagnostic);
 labelReports.push(q);
}

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
 readabilityReports.push(await worldReadability(page,{oneLineFacts:true}));
 resourceReports.push(await resourceBarGeometry(page));
 await overviewGeometry(page);
 await closeZoom();const marker=page.locator('svg [data-action="map-world"][data-arg="'+current.id+'"]');
 for(const cls of ['symbol-starport','symbol-gas-giant','symbol-naval','symbol-scout','zone-amber','symbol-selection','symbol-ship'])assert.equal(await marker.locator('.'+cls).count(),1,cls);
 assert.equal(await marker.locator('.symbol-starport').textContent(),'C','Port symbol uses published UWP');
 assert.equal(await marker.locator('.world-uwp').textContent(),'B777777-A','Existing effective-UWP labels are retained');
 await page.screenshot({path:artifacts+'/world-screen-desktop.png',fullPage:true});
 const long=page.locator('svg [data-action="map-world"][data-arg="'+selected.id+'"]');assert.match(await long.locator('.world-name').textContent(),/…$/);assert.match(await long.locator('title').textContent(),/ExtraordinarilyLong/);
 await labelFitsCell(selected.id);
 await long.focus();await page.keyboard.press('Enter');await frame();
 assert.equal(await screen.locator('.screen-title strong').textContent(),selected.name);
 assert.match(await screen.locator('.world-facts').first().textContent(),/ExtraordinarilyLongUnbrokenAllegianceNameForNarrowViewportVerification/);
 readabilityReports.push(await worldReadability(page));
 await page.screenshot({path:artifacts+'/world-screen-long-desktop.png',fullPage:true});
 assert.equal(await screen.locator('.screen-title .tag').textContent(),'Not supplied');
 assert.match(await screen.locator('.screen-system').textContent(),/Gas giantsNot suppliedBasesNot supplied/);
 assert.equal(await page.locator('.symbol-selection').count(),2,'One selected bracket plus the legend example');
 assert.equal(await raw(),f.bytes,'Selecting a world leaves every saved byte unchanged');
 // Browse back to ship without moving it; an API-zero lookup is only allowed
 // when opening existing full Planet information explicitly.
 await click('world',current.id);await frame();
 assert.equal(requests.filter(url=>new URL(url).searchParams.get('jump')==='0').length,0,'Panel and symbols add no per-world requests');
 await click('planet-info');await page.getByText('Loaded from Traveller Map.',{exact:true}).waitFor();await page.locator('#modal-close').click();
 for(const width of [2160,1280,1100,1099,768,620,390,320]){
  await page.setViewportSize({width,height:844});await frame();
  const b=await page.evaluate(()=>{const map=document.querySelector('.navigation-panel').getBoundingClientRect(),screen=document.querySelector('.world-screen').getBoundingClientRect();return {mapBottom:map.bottom,screenTop:screen.top,left:screen.left,right:screen.right,overflow:document.documentElement.scrollWidth-innerWidth};});
  if(width<1100)assert.ok(b.screenTop>=b.mapBottom,'Stacked world data follows the map');
  assert.ok(b.left>=0&&b.right<=width&&b.overflow<=1,'The world data has no page overflow');
  await overviewGeometry(page);
  readabilityReports.push(await worldReadability(page,{oneLineFacts:width>=1280}));
  resourceReports.push(await resourceBarGeometry(page));
  assert.equal(await screen.locator('.screen-uwp tbody tr').count(),8);
  const tableScroll=screen.getByRole('region',{name:'Decoded World Profile table'});
  const scrollable=await tableScroll.evaluate(el=>el.scrollWidth>el.clientWidth+1);
  if(scrollable){
   await tableScroll.focus();await page.keyboard.press('ArrowRight');
   await page.waitForFunction(()=>document.querySelector('.screen-uwp-scroll').scrollLeft>0);
   await tableScroll.evaluate(el=>el.scrollLeft=0);await frame();
  }
  if(width===320)assert.ok(scrollable,'The narrowest UWP table scrolls internally to keep whole words readable');
  await page.screenshot({path:artifacts+'/world-screen-'+width+'.png',fullPage:true});await labelFitsCell(selected.id);
  // Stress only rendered text, then restore it: no campaign mutation is needed
  // to prove that content-sized tracks handle wrapped labels, values and notes.
  const originals=await page.locator('#summary').evaluate(summary=>{
   const replacements=[['.fuel-counter .label','Jump fuel including reserve tanks'],['.fuel-counter .value','999999 / 999999 t · EMPTY'],['.life-support-counter .label','Life support'],['.life-support-counter .help','12345678 LSS aboard · 123456-day standard refill target']];
   return replacements.map(([selector,text])=>{const el=summary.querySelector(selector),before=el.textContent;el.textContent=text;return [selector,before];});
  });
  await frame();const stressed=await resourceBarGeometry(page),beforeStress=resourceReports.at(-1);resourceReports.push(stressed);
  for(const kind of ['fuel','support']){assert.equal(stressed[kind].fill,beforeStress[kind].fill);assert.equal(stressed[kind].max,beforeStress[kind].max);}
  await page.locator('#summary').screenshot({path:artifacts+'/summary-wrapped-'+width+'.png'});
  await page.locator('#summary').evaluate((summary,originals)=>originals.forEach(([selector,text])=>summary.querySelector(selector).textContent=text),originals);await frame();
  if(width<=390){
   await click('world',selected.id);await frame();readabilityReports.push(await worldReadability(page));
   await page.screenshot({path:artifacts+'/world-screen-long-'+width+'.png',fullPage:true});
   await click('world',current.id);await frame();
  }
 }
 assert.equal(await raw(),f.bytes,'Reading controls and viewport changes do not change saves or Undo');
 assert.deepEqual(errors,[]);
 await writeFile(artifacts+'/world-screen-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,viewports:[1440,2160,1280,1100,1099,768,620,390,320],readability:readabilityReports,resourceBars:resourceReports,labelGeometry:labelReports,apiZeroLookups:requests.filter(url=>new URL(url).searchParams.get('jump')==='0').length,errors},null,2));
 console.log('PASS: selected world screen, published eight-row UWP, override distinction, data absence, closest symbols, long names, keyboard browsing, 14px readout, aligned summary bars, desktop/mobile, unchanged campaign and Undo, no added per-world API requests.');
}finally{await context.tracing.stop({path:artifacts+'/world-screen-trace.zip'});await browser.close();}
