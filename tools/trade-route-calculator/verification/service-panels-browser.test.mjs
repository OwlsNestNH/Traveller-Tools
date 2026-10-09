// Real Chromium, deterministic map responses, synthetic campaigns only.
// Run: node verification/service-panels-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {overviewGeometry} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const results=[];
function fixture({port='A',hydro='8',aboard=20,bank='100000',frozen=0}={}){
 const f=guiFixture(12),s=f.state;
 s.name='Service screen verification';s.ship.name='Synthetic service trader';s.bank=bank;s.hours=48;
 s.ship.fuel=configureFuel(200,43,aboard,0,2);
 s.ship.accommodation={occupiedLowBerths:frozen,rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:4,high:0}};
 // Deliberately legacy inventory: reading/browsing must not serialize migration.
 s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:0};
 s.lots=[];s.contracts=[];s.snapshots=[];s.ledger=[];s.events=[];s.undo=[];s.jumpAttempts=[];
 s.route=[s.actual,s.route[3]];s.routeIndex=0;
 const w=s.worlds[s.actual];w.name='Actual Service Harbor';w.uwp=port+'77'+hydro+'777-A';Object.assign(w.raw,{Name:w.name,UWP:w.uwp});
 const remote=s.worlds[s.route[1]];remote.name='Browsed Dry Outpost';remote.uwp='X700000-0';Object.assign(remote.raw,{Name:remote.name,UWP:remote.uwp,PBG:'000'});remote.gasGiants=0;
 for(const world of [w,remote])Object.assign(f.apiWorlds.find(raw=>raw.WorldX===world.x&&raw.WorldY===world.y),world.raw);
 f.sec='Hex\tName\n'+f.apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n');
 validate(s);f.bytes=JSON.stringify(s);return f;
}
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
 const click=async(name,arg)=>{if(name==='service-cancel'&&!await action(name).count())name='service-back';return action(name,arg).click();};
 const field=name=>page.locator('#service-form [name="'+name+'"]');
 const fill=(name,value)=>field(name).fill(String(value));
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
 const read=async()=>JSON.parse(await raw());
 const unchanged=async(label,expected=f.bytes)=>assert.equal(await raw(),expected,label+' must preserve every saved campaign byte');
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const closed=()=>page.locator('#service-panel').waitFor({state:'hidden'});
 const open=async(type='refuel')=>{await click(type);await page.locator('#service-panel').waitFor({state:'visible'});assert.equal(await page.locator('#modal').isVisible(),false,'Service uses the right screen, not a blocking dialog');};
 const undo=async()=>{await click('tab','History');await click('undo');await click('tab','Overview');};
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await test({f,context,page,action,click,field,fill,raw,read,unchanged,frames,closed,open,undo});
  assert.deepEqual(errors,[],name+' has no uncaught browser errors');results.push(name);console.log('PASS: '+name);
 }catch(error){await page.screenshot({path:artifacts+'/service-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-failure.png',fullPage:true}).catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/service-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-trace.zip'});await context.close();}
}
try{
 await run('fuel draft controls and navigation',{},async h=>{
  const {f,page,action,click,field,fill,read,unchanged,frames,open,closed}=h;
  await open();await unchanged('Opening the summary');
  assert.equal(await page.locator('#service-form').count(),0,'Summary opens before editing');
  assert.equal(await page.locator('.world-screen:not(#service-panel)').count(),0,'Service replaces the world screen');
  assert.match(await page.locator('#service-panel').textContent(),/Actual Service Harbor/);
  for(const name of ['jump','day-back','day-forward'])assert.equal(await action(name).isDisabled(),true,name+' is frozen while a draft is open');
  for(const name of ['refuel','refill-support','ship-expenses'])assert.equal(await action(name).isEnabled(),true,name+' remains available for direct navigation');
  assert.equal(await page.locator('#ship-actions [data-action="port-costs"]').count(),0);
  await click('service-adjust');assert.equal(await field('fuelTons').inputValue(),'23','Odd tank top-off is exact');
  await click('service-fuel-step','10');assert.equal(await field('fuelTons').inputValue(),'23','+10 clamps at 23 free tons');
  for(const expected of ['13','3','0']){await click('service-fuel-step','-10');assert.equal(await field('fuelTons').inputValue(),expected);}
  await click('service-fuel-step','-10');assert.equal(await field('fuelTons').inputValue(),'0','-10 clamps at zero');
  assert.equal(await action('service-review').isDisabled(),true,'Zero purchase cannot commit');
  await click('service-fuel-topoff');assert.equal(await field('fuelTons').inputValue(),'23');
  await click('service-fuel-next');assert.equal(await field('fuelTons').inputValue(),'20','J2 needs 40 aboard and buys only the missing 20');
  await fill('fuelTons',24);assert.equal(await action('service-review').isDisabled(),true,'Overfill cannot be reviewed');
  await fill('fuelTons',7);await field('fuelType').selectOption('refined');await fill('expenseNotes','Retained draft input');
  const draft=async()=>({tons:await field('fuelTons').inputValue(),source:await field('fuelType').inputValue(),notes:await field('expenseNotes').inputValue()});
  const expected=await draft();
  await click('map-world',f.state.route[1]);await frames();assert.deepEqual(await draft(),expected,'World browse retains unsaved form values');
  assert.match(await page.locator('#service-panel').textContent(),/Actual Service Harbor/,'Service quote remains tied to ship location');
  assert.match(await page.locator('#service-quote').textContent(),/Cr 3,500/,'Browsing X port does not change A-port refined pricing');
  assert.equal(await action('service-review').isEnabled(),true,'Browsed X port does not block actual A-port supply');
  await click('map-zoom-in');await frames();await page.getByLabel('Show UWP',{exact:true}).uncheck();await page.getByLabel('Political territory',{exact:true}).uncheck();
  const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/jumpworlds'));
  await click('nearby');await response;await frames();assert.deepEqual(await draft(),expected,'Zoom, map options and nearby refresh retain draft');
  const drag=await page.evaluate(()=>{const map=document.querySelector('.world-map');map.scrollIntoView({block:'center',behavior:'instant'});const b=map.getBoundingClientRect();return {x:b.x+b.width*.8,y:b.y+b.height*.5,before:map.querySelector('.map-content').getAttribute('transform')};});
  await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.x+35,drag.y+20,{steps:8});await page.mouse.up();
  await page.waitForFunction(before=>document.querySelector('.map-content').getAttribute('transform')!==before,drag.before);assert.deepEqual(await draft(),expected,'Panning retains draft');
  const view=await page.locator('.map-caption').textContent(),zoom=await page.locator('.map-zoom-controls .help').textContent(),pan=await page.locator('.map-content').getAttribute('transform');
  await click('service-review');await unchanged('Review');assert.equal(await page.locator('#service-form').count(),0);
  await click('service-adjust');assert.deepEqual(await draft(),expected,'Review/Adjust round trip retains all fields');
  await click('service-back');await closed();await unchanged('Back from Adjust discards draft');
  assert.equal(await page.locator('.map-caption').textContent(),view,'Cancel preserves browsed world');
  assert.equal(await page.locator('.map-zoom-controls .help').textContent(),zoom,'Cancel preserves zoom');
  assert.equal(await page.locator('.map-content').getAttribute('transform'),pan,'Cancel preserves pan');
  assert.equal((await read()).actual,f.state.actual);assert.equal(await action('jump').isEnabled(),true,'Cancel unfreezes normal actions');
  await open();await click('service-adjust');await fill('fuelTons',9);await click('service-cancel');await closed();await unchanged('Cancel from Adjust');
  await open();await click('service-adjust');await fill('fuelTons',9);await page.keyboard.press('Escape');await closed();await unchanged('Escape');
 });
 await run('leaving services restores current-world Trade controls without applying drafts',{},async h=>{
  const {page,action,click,unchanged,open,closed}=h;
  for(const kind of ['refuel','refill-support'])for(const mode of ['summary','adjust','review']){
   await click('tab','Overview');await open(kind);if(mode!=='summary')await click('service-adjust');if(mode==='review')await click('service-review');
   const old=await action(mode==='adjust'?'service-review':'service-confirm').evaluate(el=>({...el.dataset}));
   await click('tab','Trade');await closed();assert.equal(await action('search').isEnabled(),true);assert.equal(await action('buyer-search').isEnabled(),true);await click('sale');assert.match(await page.locator('#message').textContent(),/Select cargo first/);assert.equal(await page.locator('#modal').isVisible(),false,'No selected cargo still prevents a sale preview');
   await page.evaluate(data=>{const b=document.createElement('button');Object.assign(b.dataset,data);document.body.append(b);b.click();b.remove();},old);await unchanged(kind+' '+mode+' → Trade discards only draft');
   await click('search');await page.getByRole('heading',{name:'Find a supplier',exact:true}).waitFor();await page.locator('#modal-cancel').click();
   await click('buyer-search');await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();await page.locator('#modal-cancel').click();await unchanged('Opening available searches never commits');
  }
  await click('tab','Overview');await click('ship-expenses');await page.locator('#expense-panel').waitFor();await click('tab','Trade');assert.equal(await page.locator('#expense-panel').count(),0);assert.equal(await action('search').isEnabled(),true);assert.equal(await action('buyer-search').isEnabled(),true);await unchanged('Expenses → Trade');
  await click('tab','Overview');await open();await click('service-adjust');await click('tab','Accounts');assert.equal(await action('deposit').isEnabled(),true);assert.equal(await action('ship-expenses').isEnabled(),true);await click('tab','Overview');await closed();await unchanged('Accounts tab discards hidden service draft');
 });
 await run('fuel commit exactly once and Undo',{},async h=>{
  const {f,page,click,field,read,open,closed,undo}=h;
  await open();await click('service-adjust');await field('fuelType').selectOption('unrefined');await click('service-review');
  await page.locator('[data-action="service-confirm"]').evaluate(button=>{button.click();button.click();});await closed();
  const paid=await read();assert.equal(paid.ship.fuel.aboardTons,43);assert.equal(paid.bank,'97700');assert.equal(paid.revision,f.state.revision+1);assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);assert.equal(paid.hours,f.state.hours);
  assert.equal(paid.ledger[0].expense.kind,'fuel');assert.equal(paid.ledger[0].world,f.state.actual);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(),paid,'Confirmed fuel persists');
  await open();assert.equal(await page.locator('[data-action="service-confirm"]').isDisabled(),true,'Full tank summary cannot charge twice');await click('service-cancel');
  await undo();const undone=await read();assert.equal(undone.bank,f.state.bank);assert.deepEqual(undone.ship.fuel,f.state.ship.fuel);assert.deepEqual(undone.ledger,f.state.ledger);
 });
 await run('manual aboard reduction',{},async h=>{
  const {f,page,action,click,fill,read,unchanged,open,closed,undo}=h;
  await open();await click('service-adjust');await click('service-fuel-correct');await fill('fuelRemaining',13);
  await fill('fuelReason','Referee recorded a seven-ton leak');await fill('fuelRemaining',21);
  assert.equal(await action('service-review').isDisabled(),true,'Manual reduction cannot invent additional fuel');
  await fill('fuelRemaining',13);await click('service-review');await unchanged('Manual reduction review');
  await click('service-confirm');await closed();const reduced=await read();
  assert.equal(reduced.ship.fuel.aboardTons,13);assert.equal(reduced.bank,f.state.bank);assert.deepEqual(reduced.ledger,f.state.ledger,'Manual reduction is not a fuel purchase');assert.equal(reduced.hours,f.state.hours);assert.match(JSON.stringify(reduced.events),/seven-ton leak/);
  const entry=reduced.events.find(e=>e.fuelCorrection);assert.ok(entry,'Correction has a recorded audit event');
  await click('tab','History');await click('event-audit',entry.id);
  const audit=page.locator('#modal-body');assert.equal(await audit.getByRole('heading',{name:'Fuel aboard correction',exact:true}).count(),1);
  const facts=await audit.locator('dt').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.textContent,node.nextElementSibling.textContent])));
  assert.equal(facts['Fuel before'],'20 t');assert.equal(facts['Actual fuel remaining'],'13 t');assert.equal(facts['Fuel removed'],'7 t');assert.equal(facts.Reason,'Referee recorded a seven-ton leak');assert.equal(facts['Bank change'],'Cr 0 · no refund');
  assert.doesNotMatch(await audit.textContent(),/Additional inputs were not saved/);
  await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});assert.deepEqual(await read(),reduced,'Reading correction audit does not write campaign state');
  await undo();assert.equal((await read()).ship.fuel.aboardTons,20);assert.equal((await read()).bank,f.state.bank);
 });
 for(const hydro of ['0','?'])await run('water advisory hydro '+hydro,{port:'X',hydro},async h=>{
  const {f,page,action,click,field,fill,read,unchanged,open,closed}=h;
  await open();await click('service-adjust');await fill('fuelTons',3);await field('fuelType').selectOption('unrefined');
  assert.equal(await action('service-review').isDisabled(),true,'Purchased unrefined needs a source at X port');
  await field('otherSupplier').check();assert.equal(await action('service-review').isDisabled(),true,'Override alone is insufficient');
  await fill('expenseNotes','Referee confirmed a local fuel cache');assert.equal(await action('service-review').isEnabled(),true);
  await fill('expenseNotes','');assert.equal(await action('service-review').isDisabled(),true,'Clearing source notes restores the gate');
  await field('otherSupplier').uncheck();await field('fuelType').selectOption('water');
  assert.equal(await page.locator('#fuel-availability').isVisible(),true,'Dry/unknown hydrographics remains visible as an advisory');
  assert.equal(await action('service-review').isEnabled(),true,'Water collection stays selectable with no override or note');
  await click('service-review');await unchanged('Water review');await click('service-confirm');await closed();
  const paid=await read();assert.equal(paid.bank,f.state.bank);assert.equal(paid.ship.fuel.aboardTons,23);assert.equal(paid.ledger.at(-1).expense.amount,'0');
 });
 await run('LSS extra supplies and comfort',{},async h=>{
  const {f,page,click,field,fill,read,unchanged,open,closed,undo}=h;
  await open('refill-support');assert.match(await page.locator('#service-panel').textContent(),/Cr 4,000/,'Normal 14-day top-up retains the existing cabin/person bundle');
  await click('service-adjust');await fill('extraDays',14);await page.locator('.service-comfort > summary').click();await fill('comfortCredits',2000);await fill('comfortNote','Upgraded meals and cabin comforts');
  assert.match(await page.locator('#service-quote').textContent(),/Cr 8,000/);await unchanged('LSS live forecast');
  await click('service-review');assert.match(await page.locator('#service-panel').textContent(),/42/);assert.match(await page.locator('#service-panel').textContent(),/168/);await unchanged('LSS review');
  await click('service-adjust');assert.equal(await field('extraDays').inputValue(),'14');assert.equal(await field('comfortCredits').inputValue(),'2000');assert.equal(await field('comfortNote').inputValue(),'Upgraded meals and cabin comforts');
  await click('service-review');await click('service-confirm');await closed();const paid=await read();
  assert.equal(paid.bank,'92000');assert.equal(paid.hours,f.state.hours);assert.equal(Object.hasOwn(paid.ship.lifeSupport,'remainingHours'),false,'Physical stock replaces legacy hours');
  const stock=paid.ship.lifeSupport.stockUnits;assert.ok(stock,'Physical LSS stock is persisted');assert.equal(Number(stock.numerator)/Number(stock.denominator),168);
  assert.match(JSON.stringify(paid.ledger),/Upgraded meals and cabin comforts/);assert.equal(paid.undo.length,1,'One confirmation has one Undo transaction');
  await undo();const undone=await read();assert.equal(undone.bank,f.state.bank);assert.deepEqual(undone.ship.lifeSupport,f.state.ship.lifeSupport,'Undo restores even legacy inventory representation');assert.deepEqual(undone.ledger,f.state.ledger);
 });
 await run('LSS frozen billing and invalid drafts',{frozen:2},async h=>{
  const {page,action,click,fill,read,unchanged,open,closed}=h;
  await open('refill-support');await click('service-adjust');await fill('extraDays',14);
  assert.match(await page.locator('#service-quote').textContent(),/Cr 6,100/,'Extra billing uses 4.2 person-equivalents, Cr2100 for 14 days');
  await fill('extraDays',10000);assert.equal(await action('service-review').isDisabled(),true,'Cargo-overflow / unaffordable reserve cannot be reviewed');
  await fill('extraDays',14);await page.locator('.service-comfort > summary').click();await fill('comfortCredits',2000);
  assert.equal(await action('service-review').isDisabled(),true,'Paid comfort requires its audit note');
  await fill('comfortNote','Frozen berth pricing verification');await click('service-review');await unchanged('Frozen LSS review');await click('service-confirm');await closed();
  const paid=await read(),stock=paid.ship.lifeSupport.stockUnits;assert.equal(Number(stock.numerator)/Number(stock.denominator),176.4);assert.equal(paid.bank,'91900');
  await open('refill-support');assert.equal(await action('service-confirm').isDisabled(),true,'No-op normal refill does not create another charge');await click('service-cancel');
 });
 await run('unaffordable LSS summary',{bank:'3000'},async h=>{
  await h.open('refill-support');assert.equal(await h.action('service-confirm').isDisabled(),true);assert.match(await h.page.locator('#service-quote').textContent(),/Insufficient/i);await h.click('service-cancel');await h.unchanged('Unaffordable LSS cancellation');
 });
 await run('service refresh import stale and ownership',{},async h=>{
  const {f,context,page,click,fill,read,raw,unchanged,open,closed}=h;
  await open();await click('service-adjust');await fill('fuelTons',8);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await closed();await unchanged('Reload abandons only unsaved draft');
  await open();await click('service-adjust');await fill('fuelTons',9);await click('service-review');
  // A persisted revision can change between rendering and the click even when
  // the storage event has not reached this document. The save must fail closed.
  const changed=await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.revision++;s.bank='99999';const bytes=JSON.stringify(s);localStorage.setItem(key,bytes);return bytes;},campaignKey);
  await click('service-confirm');await unchanged('Stale confirmation',changed);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await open();
  const other=await context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  assert.equal(await other.locator('[data-action="refuel"]').isDisabled(),true,'Read-only tab cannot open mutating service');
  await other.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-action="service-confirm"]:not(:disabled)').count(),0,'Ownership loss removes or disables pending confirmation');
  await unchanged('Ownership transfer',changed);await other.close();await page.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Editing in this tab',{exact:true}).waitFor();
  if(await page.locator('#service-panel').count())await click('service-cancel');
  const imported=structuredClone(f.state);imported.name='Imported service verification';imported.ship.fuel.aboardTons=6;
  await page.locator('#import-file').setInputFiles({name:'synthetic-service-import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();await page.locator('[name="backed"]').check();await page.getByRole('button',{name:'Replace campaign',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).ship.fuel.aboardTons,6);assert.equal((await read()).name,imported.name);const importedBytes=await raw();
  await open();await click('service-adjust');assert.equal(await page.locator('[name="fuelTons"]').inputValue(),'37','Imported campaign starts a new exact draft');await click('service-cancel');await unchanged('Cancelled imported draft',importedBytes);
 });
 await run('service layout and keyboard accessibility',{},async h=>{
  const {page,click,fill,unchanged,frames,open,closed}=h;
  for(const type of ['refuel','refill-support']){
   await open(type);await page.locator('[data-action="service-adjust"]').focus();await page.keyboard.press('Enter');
   if(type==='refuel')await fill('expenseNotes','LongUnbrokenServiceNote'.repeat(12));else{await page.locator('.service-comfort > summary').click();await fill('comfortNote','LongUnbrokenComfortNote'.repeat(12));}
   for(const width of [2160,1440,768,390,320]){
    await page.setViewportSize({width,height:1100});await frames();await overviewGeometry(page);
    const a11y=await page.locator('#service-panel').evaluate(panel=>{
     const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
     return {heading:!!panel.querySelector('h1,h2,h3'),labels:[...panel.querySelectorAll('input:not([type="hidden"]),select,textarea')].map(el=>({name:el.name,label:el.labels?.length||el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')})),bounds:[...panel.querySelectorAll('button,input,select,textarea')].filter(el=>el.getBoundingClientRect().width).map(el=>{
      // A native checkbox is activated by its associated label as well as its
      // small visual box. Measure the real, clickable target, excluding margin.
      const checkbox=el.type==='checkbox',label=checkbox?[...(el.labels||[])].find(label=>label.getBoundingClientRect().width):null;
      return {name:el.name||el.dataset.action||el.id||el.textContent.trim(),type:el.type||el.tagName.toLowerCase(),checkbox,labelTarget:!!label,control:rect(el),target:rect(label||el)};
     }),overflow:panel.scrollWidth-panel.clientWidth,viewport:innerWidth};
    });
    assert.ok(a11y.heading,'Service screen has a heading');for(const input of a11y.labels)assert.ok(input.label,'Accessible label for '+input.name);
    assert.ok(a11y.overflow<=2,'Service screen does not overflow');
    for(const item of a11y.bounds){
     const box=item.target,diagnostic=type+' at '+width+'px: '+JSON.stringify(item);
     if(item.checkbox)assert.ok(item.labelTarget,'Checkbox has a native associated-label hit target: '+diagnostic);
     assert.ok(box.left>=-1&&box.right<=a11y.viewport+1&&box.height>=24,'Controls have usable in-viewport hit targets: '+diagnostic);
    }
    if(type==='refuel'){
     const checkbox=page.locator('#service-form [name="otherSupplier"]'),label=checkbox.locator('xpath=ancestor::label[1]'),b=await label.boundingBox(),before=await checkbox.isChecked();
     // Click away from the checkbox icon to prove the measured label really
     // is part of its target, then restore the original draft value.
     await label.click({position:{x:b.width-4,y:b.height/2}});assert.equal(await checkbox.isChecked(),!before,'Associated-label edge toggles its checkbox');
     await label.click({position:{x:b.width-4,y:b.height/2}});assert.equal(await checkbox.isChecked(),before);
    }
    await unchanged(type+' responsive layout '+width);
    await page.screenshot({path:artifacts+'/service-'+type+'-'+width+'.png',fullPage:true});
   }
   await page.locator('[data-action="service-cancel"]').focus();await page.keyboard.press('Enter');await closed();await unchanged('Keyboard Cancel '+type);
   await page.setViewportSize({width:1440,height:1100});
  }
 });
 await writeFile(artifacts+'/service-panels-report.json',JSON.stringify({pass:true,commit:process.env.TRAVELLER_COMMIT||null,scenarios:results},null,2));
 console.log('PASS: all service panel scenarios; exact-head evidence and screenshots written.');
}finally{await browser.close();}
