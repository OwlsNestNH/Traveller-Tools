import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const ctx=await browser.newContext();
const sample=[{Name:'Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},{Name:'Jenghe',Hex:'1810',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'},{Name:'Ruie',Hex:'1809',UWP:'C776977-7',PBG:'701',Zone:'A',WorldX:-111,WorldY:-71,Sector:'Spinward Marches'}];
await ctx.route('https://travellermap.com/api/universe?*',route=>route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin'},{Names:[{Text:'Empty Sector'}]},{Names:[{Text:'Broken Sector'}]},{Names:[{Text:'Trojan Reach'}],Milieu:'M1105'},{Names:[{Text:'Trojan Reach'}],Milieu:'M1120'},{Names:[{Text:'Trojan Reach'}],Milieu:'M1201'},{Names:[{Text:'Trojan Reach'}],Milieu:'M1248'},{Names:[{Text:'Trojan Reach'}],Milieu:'M1105'}]}}));
let broken=true;
await ctx.route('https://travellermap.com/api/metadata?*',async route=>{const name=new URL(route.request().url()).searchParams.get('sector');if(name==='Broken Sector'&&broken){broken=false;return route.fulfill({status:503,body:'unavailable'});}if(name==='Empty Sector')await new Promise(r=>setTimeout(r,300));await route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'},{Index:'A',Name:'Cronor'}]}});});
await ctx.route('https://travellermap.com/api/sec?*',route=>route.fulfill({json:'Hex\tName\r\n'+(new URL(route.request().url()).searchParams.get('sector')==='Empty Sector'?'':sample.map(w=>w.Hex+'\t'+w.Name).join('\r\n'))}));
const distant={Name:'Far Haven',Hex:'0101',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-128,WorldY:-79,Sector:'Spinward Marches'};
const explored={...sample[0],Name:'Beyond the old map',Hex:'1910',WorldX:-78};
const neighbor={...distant,Name:'Far Neighbor',Hex:'0201',WorldX:-127};
sample.push(distant);
let failNearby=true;
await ctx.route('https://travellermap.com/api/jumpworlds?*',route=>{
 const u=new URL(route.request().url());assert.equal(u.searchParams.get('jump')==='0'||u.searchParams.get('jump')==='12',true);const zero=u.searchParams.get('jump')==='0',far=u.searchParams.get('x')==='-128';
 if(!zero&&u.searchParams.get('x')==='-80')return route.fulfill({json:{Worlds:[explored]}});
 if(!zero&&far&&failNearby){failNearby=false;return route.fulfill({status:503,body:'Temporary map failure'});}
 return route.fulfill({json:{Worlds:zero?sample.filter(w=>w.Hex===u.searchParams.get('hex')):far?[distant,neighbor]:sample.filter(w=>w!==distant)}});
});
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const click=name=>page.getByRole('button',{name,exact:true}).click();
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const choose=async(host,hex)=>{await host.getByLabel('Subsector',{exact:true}).selectOption('C');await host.getByLabel('World',{exact:true}).selectOption(hex);};
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Set up campaign');
 await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await click('Start campaign');await page.locator('#modal').waitFor({state:'hidden'});
 const before=await read();
 assert.ok(await page.locator('.hex-grid polygon').count()>0);assert.ok(await page.locator('.hex-grid polygon').count()<=469);
 const aligned=await page.evaluate(()=>{const polygon=document.querySelector('.hex-grid [data-hex="1910"]');const points=Array.from(polygon.points);const x=points.reduce((n,p)=>n+p.x,0)/6,y=points.reduce((n,p)=>n+p.y,0)/6;const circle=document.querySelector('svg [data-arg="-110,-70"] circle');return Math.abs(x-Number(circle.getAttribute('cx')))<0.01&&Math.abs(y-Number(circle.getAttribute('cy')))<0.01;});assert.ok(aligned);
 await page.getByLabel('Show hexes',{exact:true}).uncheck();assert.equal(await page.locator('.hex-grid').count(),0);await page.getByLabel('Show hexes',{exact:true}).check();
 await page.locator('svg [data-arg="-111,-70"]').click();assert.deepEqual(await read(),before);await click('Current ship');
 const map=page.locator('.world-map');

 // Dragging pans the shared world/route/grid layer without browsing or mutating the campaign.
 const transform=()=>page.locator('.map-content').getAttribute('transform');
 const worldBefore=await page.locator('.world-info strong').first().textContent();
 const dot=await page.locator('svg [data-arg="-111,-70"] circle').boundingBox();
 await page.mouse.move(dot.x+dot.width/2,dot.y+dot.height/2);await page.mouse.down();await page.mouse.move(dot.x+90,dot.y+45,{steps:8});await page.mouse.up();
 assert.notEqual(await transform(),'translate(0 0)');assert.equal(await page.locator('.world-info strong').first().textContent(),worldBefore);assert.deepEqual(await read(),before);
 const pan=await transform();await page.getByLabel('Show hexes',{exact:true}).uncheck();assert.equal(await transform(),pan);await page.getByLabel('Show hexes',{exact:true}).check();
 await click('Reset view');await page.waitForFunction(()=>document.querySelector('.map-content').getAttribute('transform')==='translate(0 0)');
 // Touch pointer cancellation releases the drag, and the next ordinary world click still works.
 await map.dispatchEvent('pointerdown',{pointerId:41,pointerType:'touch',isPrimary:true,button:0,clientX:200,clientY:200});
 await map.dispatchEvent('pointercancel',{pointerId:41,pointerType:'touch',isPrimary:true});
 await page.locator('svg [data-arg="-111,-70"]').click();assert.equal(await page.locator('.world-info strong').first().textContent(),'Jenghe');assert.equal(await transform(),'translate(0 0)');assert.deepEqual(await read(),before);await click('Current ship');
 const separation=()=>page.evaluate(()=>{const a=document.querySelector('svg [data-arg="-110,-70"] circle'),b=document.querySelector('svg [data-arg="-111,-70"] circle');return Math.abs(Number(a.getAttribute('cx'))-Number(b.getAttribute('cx')));});
 assert.equal(await page.evaluate(async()=>{const m=await import('./js/map.mjs');return m.distance({x:0,y:0},{x:12,y:6});}),12);
 const initialSpacing=await separation();await map.hover();const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-150);await page.waitForFunction(()=>document.querySelector('.map-zoom-controls span').textContent!=='100%');assert.ok(await separation()>initialSpacing);assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
 await page.mouse.wheel(0,150);await page.waitForFunction(()=>document.querySelector('.map-zoom-controls span').textContent==='100%');
 await click('+');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls span').textContent==='120%');
 for(let i=0;i<15;i++)await click('−');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls span').textContent==='20%');assert.equal(await page.locator('.hex-grid polygon').count(),0);assert.equal(await page.locator('.hex-grid text').count(),0);

 // At 20% zoom drag 32 parsecs east; an uncached world must load beyond the old radius.
 await map.waitFor({state:'visible'});const box=await page.evaluate(()=>{const r=document.querySelector('.world-map').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}),startX=box.x+box.width*.85,startY=box.y+box.height*.5;
 await page.mouse.move(startX,startY);await page.mouse.down();await page.mouse.move(startX-32*10*Math.sqrt(3)/2*box.width/520,startY,{steps:10});await page.mouse.up();
 await page.locator('svg [data-arg="-78,-70"]').waitFor();assert.deepEqual(await read(),before);assert.equal((await read()).worlds['-78,-70'],undefined);
 assert.equal(await page.locator('svg [data-arg="-78,-70"] text').count(),1);
 await click('Reset view');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls span').textContent==='100%');assert.deepEqual(await read(),before);
 await click('Find world');const picker=page.locator('#find-world');await picker.locator('.picker-selection').getByText(/Hex 1910/).waitFor();
 assert.equal(await picker.getByLabel('Sector',{exact:true}).locator('option').filter({hasText:'Trojan Reach'}).count(),1);
 await picker.getByLabel('Search worlds',{exact:true}).fill('jeng');await picker.getByLabel('World',{exact:true}).selectOption('1810');assert.match(await picker.locator('.picker-selection').textContent(),/Hex 1810/);
 await click('Browse world');await page.locator('#modal').waitFor({state:'hidden'});assert.deepEqual(await read(),before);
 await click('Find world');await picker.locator('.picker-selection').getByText(/Hex 1810/).waitFor();
 assert.equal(await picker.getByLabel('Recent worlds',{exact:true}).locator('option').count(),3);
 await picker.getByLabel('Recent worlds',{exact:true}).selectOption('1');await picker.locator('.picker-selection').getByText(/Hex 1910/).waitFor();
 await picker.getByLabel('Recent worlds',{exact:true}).selectOption('0');await picker.locator('.picker-selection').getByText(/Hex 1810/).waitFor();
 // Filtering away a parent selection clears all its descendants and prevents stale submission.
 await picker.getByLabel('Search sectors',{exact:true}).fill('Empty');assert.equal(await picker.getByLabel('World',{exact:true}).inputValue(),'');await click('Browse world');await page.locator('#modal-error').getByText('Choose a sector, subsector and world.',{exact:true}).waitFor();
 await picker.getByLabel('Search sectors',{exact:true}).fill('');await picker.getByLabel('Sector',{exact:true}).selectOption('Empty Sector');await picker.getByLabel('Sector',{exact:true}).selectOption('Spinward Marches');await choose(picker,'1809');await page.waitForTimeout(400);assert.equal(await picker.getByLabel('World',{exact:true}).inputValue(),'1809');
 await picker.getByLabel('Sector',{exact:true}).selectOption('Broken Sector');await picker.getByRole('button',{name:'Retry loading'}).waitFor();await picker.getByRole('button',{name:'Retry loading'}).click();await choose(picker,'1810');
 await picker.getByLabel('Sector',{exact:true}).selectOption('Empty Sector');await picker.getByLabel('Subsector',{exact:true}).selectOption('C');assert.match(await picker.getByLabel('World',{exact:true}).textContent(),/No worlds/);
 await page.locator('#modal-cancel').click();await click('Plot route');assert.match(await page.locator('.route-origin').textContent(),/Regina/);
 const dest=page.locator('#route-destination');await choose(dest,'1809');await click('Add stop');await choose(page.locator('.route-stop').nth(0),'1810');await click('Add stop');await choose(page.locator('.route-stop').nth(1),'1910');
 await page.locator('.route-stop').nth(1).getByRole('button',{name:'Move up'}).click();assert.match(await page.locator('.route-stop').nth(0).locator('.picker-selection').textContent(),/Regina/);
 await page.locator('.route-stop').nth(0).getByRole('button',{name:'Remove stop'}).click();await click('Calculate route');await page.getByRole('heading',{name:'Review route',exact:true}).waitFor();await click('Save route');await page.locator('#modal').waitFor({state:'hidden'});
 const after=await read();assert.equal(after.actual,before.actual);assert.equal(after.hours,before.hours);assert.equal(after.bank,before.bank);assert.deepEqual(after.mandatoryStops,['-111,-70','-111,-71']);
 await click('Plot route');await dest.locator('.picker-selection').getByText(/Hex 1809/).waitFor();assert.match(await page.locator('.route-stop .picker-selection').textContent(),/Hex 1810/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth+2));
 await page.locator('#modal-cancel').click();await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Find world');
 assert.ok(await page.locator('#find-world').getByLabel('Recent worlds',{exact:true}).locator('option').count()>=3);
 await page.evaluate(async()=>{const {rememberWorld}=await import('./js/world-picker.mjs');for(let i=1;i<=12;i++)rememberWorld({name:'Recent '+i,sector:'Spinward Marches',hex:String(i).padStart(2,'0')+'01'});rememberWorld({name:'Recent 12',sector:'Spinward Marches',hex:'1201'});});
 const recent=await page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:recent-worlds:v1')));
 assert.equal(recent.length,10);assert.equal(recent[0].hex,'1201');assert.equal(new Set(recent.map(w=>w.hex)).size,10);
 await page.locator('#modal-cancel').click();await click('Find world');await page.locator('#find-world').getByLabel('Subsector',{exact:true}).selectOption('C');await page.locator('#find-world').getByLabel('World',{exact:true}).selectOption('1810');
 const beforeLocation=await read();await page.locator('#choose-starting-world').click();await page.getByRole('heading',{name:'Set ship location',exact:true}).waitFor();await page.locator('#modal-cancel').click();assert.deepEqual(await read(),beforeLocation);
 await click('Find world');await page.locator('#find-world').getByLabel('Subsector',{exact:true}).selectOption('C');await page.locator('#find-world').getByLabel('World',{exact:true}).selectOption('1810');await page.locator('#choose-starting-world').click();await page.getByRole('heading',{name:'Set ship location',exact:true}).waitFor();await click('Confirm starting world');await page.locator('#modal').waitFor({state:'hidden'});
 const moved=await read();assert.equal(moved.actual,'-111,-70');assert.deepEqual(moved.route,['-111,-70']);assert.equal(moved.routeIndex,0);assert.equal(moved.bank,beforeLocation.bank);assert.equal(moved.hours,beforeLocation.hours);assert.deepEqual(moved.lots,beforeLocation.lots);assert.deepEqual(moved.contracts,beforeLocation.contracts);
 await click('History');await click('Undo latest change');const undone=await read();assert.equal(undone.actual,beforeLocation.actual);assert.deepEqual(undone.route,beforeLocation.route);
 await click('Overview');await click('Find world');await page.locator('#find-world').getByLabel('Subsector',{exact:true}).selectOption('A');await page.locator('#find-world').getByLabel('World',{exact:true}).selectOption('0101');await page.locator('#choose-starting-world').click();await page.getByRole('heading',{name:'Set ship location',exact:true}).waitFor();
 const beforeFar=await read();await click('Confirm starting world');await page.locator('#modal-error').getByText(/503/).waitFor();assert.deepEqual(await read(),beforeFar);
 await click('Confirm starting world');await page.locator('#modal').waitFor({state:'hidden'});
 assert.equal((await read()).actual,'-128,-79');await page.getByRole('button',{name:'Browse Far Neighbor',exact:true}).waitFor();assert.ok((await read()).worlds['-127,-79']);
 // A previously saved location with no cached neighborhood loads it on reopening.
 await page.evaluate(()=>{const key='traveller-trade-route-calculator:v1',s=JSON.parse(localStorage.getItem(key));delete s.worlds['-127,-79'];localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await page.getByRole('button',{name:'Browse Far Neighbor',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: cascading search, derived hex, browsing invariants, parent reset, loading race, retry, empty sector, actual origin, stop reorder/removal, route persistence, recent-world persistence/deduplication, hex alignment/toggle/clicking and mobile width.');
}catch(error){console.log(errors);console.log((await page.locator('#main').innerHTML()).slice(0,1500));throw error;}finally{await browser.close();}
