// Deterministic Chromium interaction coverage for global browsing. All worlds
// and API responses are synthetic; this is not a live Traveller Map API check.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(process.env.TRAVELLER_COMMIT)assert.equal(testedCommit,process.env.TRAVELLER_COMMIT,'Test the exact requested PR head');
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
context.setDefaultTimeout(15000);
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const f=guiFixture(12),actual=f.state.worlds[f.state.actual];
// The baseline includes travelled route progress, bank/time, loaded cargo,
// accepted freight, offer audits, events, ledger and an existing Undo entry.
// Byte equality protects all campaign fields, including ones added in future.
f.state.undo.push({label:'Synthetic existing history',inverse:[{path:['hours'],value:24}]});
validate(f.state);f.bytes=JSON.stringify(f.state);
assert.ok(f.state.route.length>1&&f.state.routeIndex>0&&f.state.hours>0);
for(const name of ['lots','contracts','ledger','snapshots','events','undo'])assert.ok(f.state[name].length>0,'Nonempty '+name+' fixture');

const subsector=hex=>String.fromCharCode(65+Math.floor((Number(hex.slice(0,2))-1)/8)+4*Math.floor((Number(hex.slice(2))-1)/10));
function planet(name,sector,hex,sx,sy,subsectorName){
 const x=sx*32+Number(hex.slice(0,2))-1,y=sy*40+Number(hex.slice(2))-40;
 return {name,sector,hex,sx,sy,x,y,id:x+','+y,subsectorName,
  search:{World:{Name:name,Sector:sector,HexX:Number(hex.slice(0,2)),HexY:Number(hex.slice(2)),SectorX:sx,SectorY:sy}},
  raw:{Name:name,Sector:sector,Hex:hex,WorldX:x,WorldY:y,UWP:'B777777-A',PBG:'703',Zone:''}};
}
const haven=planet('Haven','Far Meridian','1910',7,4,'Meridian Crown');
const otherHaven=planet('Haven','Silent Expanse','0821',-8,6,'Quiet Horizon');
const sameSectorHaven=planet('Haven','Far Meridian','0901',7,4,'Meridian Rim');
const old=planet('Old Beacon','Former Reach','1115',13,2,'Former Lantern');
const latest=planet('Latest Beacon','New Reach','2422',11,-2,'New Lantern');
const missing=planet('Missing Atlas','Broken Atlas','1910',14,4,'Recovered Crown');
const unnamed=planet('Unnamed Atlas','Unnamed Expanse','1910',15,4,'Subsector C (name unavailable)');
const long=planet('ExtraordinarilyLongUnbrokenPlanetNameForNarrowViewportVerificationAndCompleteReadableSearchResults',
 'ExtraordinarilyLongUnbrokenSectorNameForNarrowViewportVerification','3109',17,3,
 'ExtraordinarilyLongUnbrokenSubsectorNameForNarrowViewportVerification');
const allPlanets=[haven,otherHaven,sameSectorHaven,old,latest,missing,unnamed,long];
const neighbors=allPlanets.map(w=>({...w.raw,Name:w.name+' Neighbor',Hex:String(Number(w.hex.slice(0,2))+1).padStart(2,'0')+w.hex.slice(2),WorldX:w.x+1}));
const apiWorlds=[...f.apiWorlds,...allPlanets.map(w=>w.raw),...neighbors];
const sectors=[...new Map(allPlanets.map(w=>[w.sector,{Names:[{Text:w.sector}],X:w.sx,Y:w.sy,Milieu:'M1105'}])).values()];
const universe={Sectors:[...f.universe.Sectors,...sectors]};
const label=(w,name=w.subsectorName)=>[w.name,name,w.sector,w.hex].join(' — ');
const response=worlds=>({json:{Results:{Count:worlds.length,Items:worlds.map(w=>w.search)}}});
const failure={status:503,body:'Synthetic Traveller Map outage'};
const checks=[],errors=[],apiRequests=[],geometry=[];
let searchHandler=null,metadataHandler=null,jumpHandler=null;
const openGates=new Set();
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function gate(answer){
 const started=deferred(),released=deferred(),done=deferred();
 const g={claimed:false,started:started.promise,done:done.promise,release:()=>released.resolve(),
  async handle(route){assert.equal(g.claimed,false,'Only the intended request claims this gate');g.claimed=true;g.request=route.request();started.resolve();await released.promise;
   try{await route.fulfill(answer);}finally{done.resolve();openGates.delete(g);}
  }};openGates.add(g);return g;
}
async function bounded(promise,description){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Timed out: '+description)),15000))]);}finally{clearTimeout(timer);}
}
function searchRows(query){
 if(query==='Haven')return [otherHaven,sameSectorHaven,haven];
 if(query==='Old')return [old];
 if(query==='Latest')return [latest];
 if(query==='Missing')return [missing];
 if(query==='Unnamed')return [unnamed];
 if(query==='Long')return [long];
 if(query==='Retry')return [haven];
 if(query==='No match')return [];
 throw Error('Unexpected search query '+JSON.stringify(query));
}
function metadataSector(url){
 const byName=url.searchParams.get('sector');
 return byName||sectors.find(s=>String(s.X)===url.searchParams.get('sx')&&String(s.Y)===url.searchParams.get('sy'))?.Names[0].Text;
}
function metadataFor(sector){
 if(sector==='Verification Reach')return f.metadata;
 return {Subsectors:sector===unnamed.sector?[]:allPlanets.filter(w=>w.sector===sector).map(w=>({Index:subsector(w.hex),Name:w.subsectorName}))};
}
function jumpResponse(url){
 const p=url.searchParams,zero=p.get('jump')==='0';
 if(zero){const rows=p.has('sector')?apiWorlds.filter(w=>w.Sector===p.get('sector')&&w.Hex===p.get('hex')):apiWorlds.filter(w=>w.WorldX===Number(p.get('x'))&&w.WorldY===Number(p.get('y')));return {json:{Worlds:rows}};}
 const selected=allPlanets.find(w=>w.x===Number(p.get('x'))&&w.y===Number(p.get('y')));
 return {json:{Worlds:selected?[selected.raw,neighbors[allPlanets.indexOf(selected)]]:f.apiWorlds}};
}
await context.route('https://travellermap.com/api/**',async route=>{
 const url=new URL(route.request().url()),kind=url.pathname.split('/').at(-1);apiRequests.push(url.href);
 try{
  assert.equal(url.searchParams.get('milieu'),'M1105','Every world request uses M1105');
  if(kind==='search'){
   assert.equal(url.searchParams.get('types'),'worlds');
   assert.equal(url.searchParams.has('sector'),false,'Global search has no current-sector restriction');
   if(searchHandler&&await searchHandler(route,url))return;
   return await route.fulfill(response(searchRows(url.searchParams.get('q'))));
  }
  if(kind==='universe')return await route.fulfill({json:universe});
  if(kind==='metadata'){
   if(metadataHandler&&await metadataHandler(route,url))return;
   return await route.fulfill({json:metadataFor(metadataSector(url))});
  }
  if(kind==='sec')return await route.fulfill({json:'Hex\tName\n'+apiWorlds.filter(w=>w.Sector===url.searchParams.get('sector')).map(w=>w.Hex+'\t'+w.Name).join('\n')});
  if(kind==='jumpworlds'){
   if(jumpHandler&&await jumpHandler(route,url))return;
   return await route.fulfill(jumpResponse(url));
  }
  throw Error('Unexpected API request '+url.href);
 }catch(error){errors.push(error.stack||String(error));await route.abort().catch(()=>{});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(({key,bytes,origin})=>{
 if(location.origin!==origin)return;
 if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
 window.qaSearchRejections=[];
 window.addEventListener('unhandledrejection',event=>window.qaSearchRejections.push(String(event.reason?.stack||event.reason)));
},{key:campaignKey,bytes:f.bytes,origin:new URL(base).origin});
const host=page.locator('#global-world-search'),input=host.getByLabel('Planet name',{exact:true});
const status=()=>host.getByRole('status');
const result=(w,name)=>host.getByRole('button',{name:label(w,name),exact:true});
const results=()=>host.locator('.planet-search-results button');
const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const selectedName=()=>page.locator('.world-screen .screen-title strong').textContent();
const searchRequests=()=>apiRequests.filter(url=>new URL(url).pathname.endsWith('/search'));
const zeroRequests=()=>apiRequests.filter(url=>new URL(url).pathname.endsWith('/jumpworlds')&&new URL(url).searchParams.get('jump')==='0');
async function preserved(name){
 assert.equal(await raw(),f.bytes,name+': campaign must stay byte-identical');
 assert.deepEqual(await page.evaluate(()=>window.qaSearchRejections),[],name+': no unhandled rejection');
 assert.deepEqual(errors,[],name+': no browser/API fixture errors');checks.push(name);
}
async function settle(){await page.waitForLoadState('networkidle');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function open(){await page.getByRole('button',{name:'Find world',exact:true}).click();await input.waitFor({state:'visible'});}
async function begin(){
 searchHandler=null;metadataHandler=null;jumpHandler=null;
 assert.equal(openGates.size,0,'Previous scenario must release every held request');
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await settle();
 assert.equal(await selectedName(),actual.name);await preserved('Scenario starts at actual ship with intact campaign');await open();
}
async function search(query,method='Enter'){
 await input.fill(query);
 if(method==='Enter')await input.press('Enter');else if(method==='button')await host.getByRole('button',{name:'Search planets',exact:true}).click();
}
async function finish(g){g.release();await bounded(g.done,'held response completion');await settle();}
// Drain this one response while another deliberately held request is still
// pending. networkidle would deadlock here and hide the important ordering.
async function finishWhilePending(g){
 g.release();await bounded(g.done,'obsolete response completion');
 const reply=await bounded(g.request.response(),'obsolete browser response');
 if(reply)await bounded(reply.finished(),'obsolete response body');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
function heldWorld(w,phase){
 const g=gate({json:{Worlds:phase==='world'?[w.raw]:allPlanets.includes(w)?[w.raw,neighbors[allPlanets.indexOf(w)]]:f.apiWorlds}});
 return {g,async match(route,url){const p=url.searchParams;
  const matches=phase==='world'?p.get('jump')==='0'&&p.get('sector')===w.sector&&p.get('hex')===w.hex:p.get('jump')==='12'&&p.get('x')===String(w.x)&&p.get('y')===String(w.y);
  if(!matches||g.claimed)return false;await g.handle(route);return true;
 }};
}
async function chooseCascade(w){
 const picker=page.locator('#find-world');
 await picker.getByLabel('Sector',{exact:true}).selectOption(w.sector);
 await picker.getByLabel('Subsector',{exact:true}).selectOption(subsector(w.hex));
 await picker.getByLabel('World',{exact:true}).selectOption(w.hex);
}
async function dismiss(method='cancel'){
 if(method==='escape')await page.keyboard.press('Escape');else await page.locator(method==='close'?'#modal-close':'#modal-cancel').click();
 await page.locator('#modal').waitFor({state:'hidden'});
}
async function tabTo(target){
 await input.focus();
 for(let i=0;i<15;i++){
  await page.keyboard.press('Tab');
  if(await target.evaluate(el=>el===document.activeElement))return i+1;
 }
 assert.fail('Result is not reachable with the real Tab key');
}
async function browsed(w){
 await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('.world-screen .screen-title strong').filter({hasText:w.name}).waitFor();
 assert.equal(await selectedName(),w.name);
 const marker=page.locator('svg .selected-world[data-arg="'+w.id+'"]');await marker.waitFor();
 assert.equal(await page.locator('svg .selected-world').count(),1);
 assert.match(await page.locator('.map-caption').textContent(),new RegExp(w.hex));
 const neighbor=neighbors[allPlanets.indexOf(w)];await page.locator('svg [data-action="map-world"][data-arg="'+neighbor.WorldX+','+neighbor.WorldY+'"]').waitFor();
 await preserved('Browsing '+w.sector+' '+w.hex+' loads selected world and nearby without changing campaign');
}
async function current(){
 await page.locator('.map-toolbar').getByRole('button',{name:'Current system',exact:true}).click();
 await page.locator('.world-screen .screen-title strong').filter({hasText:actual.name}).waitFor();
 assert.equal(await selectedName(),actual.name);await preserved('Current system returns to actual ship without changing route or time');
}
async function screenshot(name){await page.screenshot({path:join(artifacts,'global-search-'+name+'.png'),fullPage:true});}
async function measure(width){
 const report=await host.evaluate(el=>{
  const box=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {left:r.left,right:r.right,width:r.width,height:r.height,client:node.clientWidth,scroll:node.scrollWidth,lineHeight:parseFloat(s.lineHeight),whiteSpace:s.whiteSpace,textOverflow:s.textOverflow,overflowWrap:s.overflowWrap};};
  const dialog=el.closest('dialog'),list=el.querySelector('.planet-search-results');
  return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:box(dialog),host:box(el),input:box(el.querySelector('input')),list:box(list),results:[...list.querySelectorAll('button')].map(box)};
 });
 assert.equal(report.width,width);assert.ok(report.pageOverflow<=1,'No page overflow: '+JSON.stringify(report));
 for(const key of ['dialog','host','input','list']){
  const b=report[key];assert.ok(b.left>=-1&&b.right<=width+1,key+' stays inside viewport: '+JSON.stringify(report));
  assert.ok(b.scroll<=b.client+2,key+' has no clipped horizontal content: '+JSON.stringify(report));
 }
 for(const b of report.results){
  assert.ok(b.scroll<=b.client+2,'Long result has no horizontal clipping');
  assert.equal(b.whiteSpace,'normal','Complete labels wrap');assert.notEqual(b.textOverflow,'ellipsis');
  if(width<=390)assert.ok(b.height>b.lineHeight*2,'Long names visibly span multiple lines');
 }
 geometry.push(report);
}
try{
 // The real input debounce makes one request after a typing burst. Pausing the
 // browser clock avoids relying on a fast/slow CI machine for a 300 ms boundary.
 await begin();await page.clock.install({time:new Date('2026-10-09T12:00:00Z')});
 await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
 let before=searchRequests().length;
 await input.fill('H');await page.clock.fastForward(1000);assert.equal(searchRequests().length,before,'One character does not issue a search');
 await input.fill('Ha');await page.clock.fastForward(200);await input.fill('Haven');await page.clock.fastForward(299);
 assert.equal(searchRequests().length,before,'Typing resets the 300 ms debounce');
 await page.clock.fastForward(1);await page.clock.resume();await result(haven).waitFor();
 assert.equal(searchRequests().length,before+1,'Typing burst issues one global request');
 assert.deepEqual(new Set(await results().allTextContents()),new Set([label(haven),label(otherHaven),label(sameSectorHaven)]));
 await screenshot('duplicates-desktop');await preserved('Duplicate names expose distinct subsectors, sectors and hexes');

 // Enter is the actual input key event, not form.submit()/evaluate(). It must
 // search without submitting the still-present cascade Browse world form.
 before=searchRequests().length;const exactBefore=zeroRequests().length;
 await input.press('Enter');await result(otherHaven).waitFor();await settle();
 assert.equal(searchRequests().length,before+1);assert.equal(zeroRequests().length,exactBefore,'Enter does not accidentally browse cascade selection');
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
 const tabCount=await tabTo(result(otherHaven));assert.ok(tabCount>=2);await page.keyboard.press('Space');await browsed(otherHaven);
 await screenshot('browsed-desktop');await current();

 // Searching from sector/subsector scale returns to a useful world view.
 await begin();await dismiss();
 for(let i=0;i<20&&await page.locator('.world-map').getAttribute('data-map-level')!=='sector';i++)await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 assert.equal(await page.locator('.world-map').getAttribute('data-map-level'),'sector');await open();await search('Haven');await result(haven).waitFor();await result(haven).click();await browsed(haven);
 assert.equal(await page.locator('.world-map').getAttribute('data-map-level'),'world');
 assert.equal(await page.locator('.map-zoom-controls > .help').textContent(),'100%');await screenshot('from-sector-zoom');await current();

 // A click selection must wait for both exact world data and the new nearby
 // map before it changes the view. Failed nearby loads can retry safely.
 for(const phase of ['world','nearby']){
  await begin();await search('Haven','button');await result(haven).waitFor();
  const hold=gate(phase==='world'?{json:{Worlds:[haven.raw]}}:{json:{Worlds:[haven.raw,neighbors[0]]}});
  jumpHandler=async(route,url)=>{const p=url.searchParams,match=phase==='world'?p.get('jump')==='0'&&p.get('sector')===haven.sector&&p.get('hex')===haven.hex:p.get('jump')==='12'&&p.get('x')===String(haven.x)&&p.get('y')===String(haven.y);if(!match||hold.claimed)return false;await hold.handle(route);return true;};
  await result(haven).click();await bounded(hold.started,'pending '+phase+' selection');
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await selectedName(),actual.name);
  await preserved('Pending '+phase+' load does not change view or saved state');
  await finish(hold);await browsed(haven);await current();
 }
 await begin();await search('Haven');await result(haven).waitFor();let failedNearby=false;
 jumpHandler=async(route,url)=>{const p=url.searchParams;if(!failedNearby&&p.get('jump')==='12'&&p.get('x')===String(haven.x)&&p.get('y')===String(haven.y)){failedNearby=true;await route.fulfill(failure);return true;}return false;};
 await result(haven).click();await status().filter({hasText:/Could not browse.*503/}).waitFor();assert.equal(await selectedName(),actual.name);
 await preserved('Nearby API error leaves original view and campaign intact');
 await result(haven).click();await browsed(haven);await current();

 // Request order, not transport timing, decides which result remains visible.
 for(const answer of [response([old]),failure]){
  await begin();const hold=gate(answer);
  searchHandler=async(route,url)=>{if(url.searchParams.get('q')!=='Old')return false;await hold.handle(route);return true;};
  await search('Old');await bounded(hold.started,'old search');await search('Latest');await result(latest).waitFor();
  await finish(hold);assert.deepEqual(await results().allTextContents(),[label(latest)]);assert.doesNotMatch(await status().textContent(),/503|Could not/);
  await preserved('Late '+(answer.status?'failed':'successful')+' search cannot overwrite newer results');await dismiss();
 }

 // Editing the query invalidates a selected result at either async stage.
 for(const phase of ['world','nearby']){
  await begin();await search('Haven');await result(haven).waitFor();
  const hold=gate(phase==='world'?{json:{Worlds:[haven.raw]}}:{json:{Worlds:[haven.raw,neighbors[0]]}});
  jumpHandler=async(route,url)=>{const p=url.searchParams,match=phase==='world'?p.get('jump')==='0'&&p.get('sector')===haven.sector&&p.get('hex')===haven.hex:p.get('jump')==='12'&&p.get('x')===String(haven.x)&&p.get('y')===String(haven.y);if(!match||hold.claimed)return false;await hold.handle(route);return true;};
  await result(haven).click();await bounded(hold.started,'query-change '+phase+' selection');assert.equal(await input.isEnabled(),true);
  await search('Latest');await result(latest).waitFor();await finish(hold);
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.equal(await selectedName(),actual.name);assert.deepEqual(await results().allTextContents(),[label(latest)]);
  await preserved('Query change invalidates pending '+phase+' selection');await result(latest).click();await browsed(latest);await current();
 }

 await begin();let retryCount=0;
 searchHandler=async(route,url)=>{if(url.searchParams.get('q')!=='Retry')return false;await route.fulfill(++retryCount===1?failure:response([haven]));return true;};
 await search('Retry');await status().filter({hasText:/Could not search.*503/}).waitFor();assert.equal(await results().count(),0);
 await host.getByRole('button',{name:'Search planets',exact:true}).click();await result(haven).waitFor();assert.equal(retryCount,2);
 await search('No match');await status().filter({hasText:/No planets found/}).waitFor();assert.equal(await results().count(),0);
 await preserved('Search API error retries and empty results replace prior results');await dismiss();

 await begin();let metadataAttempts=0;
 metadataHandler=async(route,url)=>{if(metadataSector(url)!==missing.sector)return false;metadataAttempts++;await route.fulfill(metadataAttempts===1?failure:{json:metadataFor(missing.sector)});return true;};
 await search('Missing');await result(missing,'Subsector C (name unavailable)').waitFor();await status().filter({hasText:/subsector names are unavailable/i}).waitFor();
 assert.equal(metadataAttempts,1);await screenshot('metadata-unavailable');
 await host.getByRole('button',{name:'Search planets',exact:true}).click();await result(missing).waitFor();assert.equal(metadataAttempts,2,'Retry refetches failed metadata');
 await preserved('Failed metadata keeps explicit indexed fallback and retries names');await dismiss();
 await begin();await search('Unnamed');await result(unnamed).waitFor();await status().filter({hasText:/subsector names are unavailable/i}).waitFor();
 await result(unnamed).click();await browsed(unnamed);await current();

 // No dismissed request may populate or close the replacement dialog. Cover
 // all native dismissal methods and both successful and failed late searches.
 for(const method of ['cancel','close','escape']){
  await begin();const hold=gate(method==='close'?failure:response([old]));
  searchHandler=async(route,url)=>{if(url.searchParams.get('q')!=='Old')return false;await hold.handle(route);return true;};
  await search('Old');await bounded(hold.started,'dismissed search');await dismiss(method);await open();
  await search('Latest');await result(latest).waitFor();await finish(hold);
  assert.equal(await page.locator('#modal-title').textContent(),'Find a world');assert.deepEqual(await results().allTextContents(),[label(latest)]);assert.equal(await selectedName(),actual.name);
  assert.equal(await page.locator('#modal-error').textContent(),'');assert.doesNotMatch(await status().textContent(),/503|Could not/);
  await preserved(method+' then reopen ignores late search');await dismiss();
 }
 for(const phase of ['world','nearby']){
  await begin();await search('Haven');await result(haven).waitFor();
  const hold=gate(phase==='world'?{json:{Worlds:[haven.raw]}}:{json:{Worlds:[haven.raw,neighbors[0]]}});
  jumpHandler=async(route,url)=>{const p=url.searchParams,match=phase==='world'?p.get('jump')==='0'&&p.get('sector')===haven.sector&&p.get('hex')===haven.hex:p.get('jump')==='12'&&p.get('x')===String(haven.x)&&p.get('y')===String(haven.y);if(!match||hold.claimed)return false;await hold.handle(route);return true;};
  await result(haven).click();await bounded(hold.started,'dismissed '+phase+' selection');await dismiss('close');await open();
  await search('Latest');await result(latest).waitFor();await finish(hold);
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);assert.deepEqual(await results().allTextContents(),[label(latest)]);assert.equal(await selectedName(),actual.name);
  await preserved('Close/reopen ignores pending '+phase+' browse completion');await dismiss();
 }

 // Competing controls share one browsing intent. Hold both requests and
 // release the older one FIRST, while the newer request is unresolved; merely
 // releasing after the new dialog closes would miss a same-modal race.
 const cascadeTarget=f.state.worlds[f.state.route[3]];
 for(const legacy of ['browse','starting-world'])for(const direction of ['global-first','legacy-first'])for(const phase of ['world','nearby']){
  await begin();await chooseCascade(cascadeTarget);await search('Haven');await result(haven).waitFor();
  const globalPending=heldWorld(haven,phase),legacyPending=heldWorld(cascadeTarget,legacy==='starting-world'?'world':phase);
  jumpHandler=async(route,url)=>await globalPending.match(route,url)||await legacyPending.match(route,url);
  const clickLegacy=()=>page.locator(legacy==='browse'?'#modal-submit':'#choose-starting-world').click();
  const first=direction==='global-first'?globalPending.g:legacyPending.g,second=direction==='global-first'?legacyPending.g:globalPending.g;
  if(direction==='global-first'){await result(haven).click();await bounded(first.started,'older global selection');await clickLegacy();}
  else{await clickLegacy();await bounded(first.started,'older legacy selection');await result(haven).click();}
  await bounded(second.started,'newer competing selection');await finishWhilePending(first);
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),true,'Obsolete completion must not close the shared dialog');
  assert.equal(await page.locator('#modal-title').textContent(),'Find a world','Obsolete completion must not open a location confirmation');
  assert.equal(await selectedName(),actual.name,'Obsolete completion must not change the viewed world');
  assert.equal(await page.locator('#modal-error').textContent(),'');
  await preserved(direction+' '+legacy+' '+phase+': older response loses while newer selection is pending');
  await finish(second);
  if(direction==='legacy-first')await browsed(haven);
  else if(legacy==='browse'){
   await page.locator('#modal').waitFor({state:'hidden'});assert.equal(await selectedName(),cascadeTarget.name);
   await page.locator('svg .selected-world[data-arg="'+cascadeTarget.id+'"]').waitFor();
   await preserved('Newer legacy Browse alone selects '+cascadeTarget.hex);
  }else{
   await page.getByRole('heading',{name:'Set ship location',exact:true}).waitFor();
   assert.match(await page.locator('#modal-body').textContent(),new RegExp(cascadeTarget.name));
   assert.doesNotMatch(await page.locator('#modal-body').textContent(),/Far Meridian|Haven/);
   assert.equal(await selectedName(),actual.name);await preserved('Only newer starting-world target reaches its confirmation');
   await dismiss();await preserved('Cancelling latest starting-world confirmation preserves the complete campaign');
  }
  await current();
 }

 // Even an edit too short to start a search retires an in-flight legacy
 // selection immediately, without relying on a later debounce to invalidate it.
 for(const legacy of ['browse','starting-world']){
  await begin();await chooseCascade(cascadeTarget);const pending=heldWorld(cascadeTarget,'world');jumpHandler=pending.match;
  await page.locator(legacy==='browse'?'#modal-submit':'#choose-starting-world').click();await bounded(pending.g.started,'legacy request before query edit');
  const searches=searchRequests().length;await input.fill('X');await finish(pending.g);
  assert.equal(searchRequests().length,searches);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
  assert.equal(await page.locator('#modal-title').textContent(),'Find a world');assert.equal(await selectedName(),actual.name);
  await status().filter({hasText:/at least 2 characters/}).waitFor();await preserved('Query edit alone invalidates pending legacy '+legacy);await dismiss();
 }

 // The legacy selector and its separate location confirmation are still
 // usable. Opening then cancelling that confirmation must not move the ship.
 await begin();const picker=page.locator('#find-world'),cascade=f.state.worlds[f.state.route[3]];
 await picker.getByLabel('Sector',{exact:true}).selectOption('Verification Reach');await picker.getByLabel('Subsector',{exact:true}).selectOption(subsector(cascade.hex));
 await picker.getByLabel('World',{exact:true}).selectOption(cascade.hex);await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
 assert.equal(await selectedName(),cascade.name);await preserved('Existing sector/subsector/world cascade still browses');await current();await open();
 await picker.getByLabel('World',{exact:true}).selectOption(cascade.hex);await page.locator('#choose-starting-world').click();await page.getByRole('heading',{name:'Set ship location',exact:true}).waitFor();
 await dismiss();await preserved('Use as starting world retains its independent confirmation');

 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width===1440?1100:844});await begin();await search('Long');await result(long).waitFor();
  assert.equal(await result(long).textContent(),label(long),'Complete long identity remains readable');await measure(width);await screenshot('long-'+width);
  if(width===320){await tabTo(result(long));await page.keyboard.press('Space');}else await result(long).click();
  await browsed(long);await screenshot('selected-'+width);await current();
 }
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await settle();
 assert.equal(await selectedName(),actual.name);await preserved('Reload restores actual ship and every original campaign byte');
 assert.ok(searchRequests().length>0);assert.equal(openGates.size,0);
 console.log('PASS: '+checks.join('; ')+'.');
}catch(error){
 errors.push(error.stack||String(error));await screenshot('failure').catch(()=>{});throw error;
}finally{
 for(const pending of openGates)pending.release();
 await writeFile(join(artifacts,'global-search-report.json'),JSON.stringify({testedCommit,requestedCommit:process.env.TRAVELLER_COMMIT||null,browser:browser.version(),liveAPI:false,checks,geometry,apiRequests,errors},null,2));
 await context.tracing.stop({path:join(artifacts,'global-search-trace.zip')});await browser.close();
}
