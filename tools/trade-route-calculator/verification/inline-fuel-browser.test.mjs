// Deterministic Chromium coverage. Synthetic campaigns and intercepted map data only.
// Run: node verification/inline-fuel-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {validate} from '../js/state.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const report={pass:false,commit:process.env.TRAVELLER_COMMIT||null,widths:[320,390,1100,1440],scenarios:[]};
function fixture({port='A',hydro='8',aboard=20,bladders=0,cargo='120',bank='100000',creditStep=1,frozen=0,fullSupport=false,fixedExpenses=false}={}){
 const f=guiFixture(12),s=f.state;
 Object.assign(s,{name:'Inline fuel verification',bank,hours:48,lots:[],contracts:[],snapshots:[],ledger:[],events:[],undo:[],jumpAttempts:[]});
 s.ship.name='Synthetic inline fuel trader';s.ship.capacity=cargo;s.ship.fuel=configureFuel(200,43,aboard,bladders*40,2);s.settings.creditStep=creditStep;
 s.ship.accommodation={occupiedLowBerths:frozen,rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:4,high:0}};
 // Keep a legacy representation to prove opening or editing never saves migration.
 s.ship.lifeSupport={capacityHours:672,remainingHours:fullSupport?672:336,elapsedHours:0};
 if(fixedExpenses){s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};s.ship.maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};s.ship.expenses={salary:'12000'};}
 s.route=[s.actual,s.route[3]];s.routeIndex=0;
 const actual=s.worlds[s.actual],remote=s.worlds[s.route[1]];
 actual.name='Actual Fuel Harbor';actual.uwp=port+'77'+hydro+'777-A';Object.assign(actual.raw,{Name:actual.name,UWP:actual.uwp});if(fixedExpenses)actual.berthingRate={port,die:2};
 remote.name='Browsed Dry Outpost';remote.uwp='X700000-0';remote.gasGiants=0;Object.assign(remote.raw,{Name:remote.name,UWP:remote.uwp,PBG:'000'});
 for(const world of [actual,remote])Object.assign(f.apiWorlds.find(raw=>raw.WorldX===world.x&&raw.WorldY===world.y),world.raw);
 f.sec='Hex\tName\n'+f.apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n');validate(s);f.bytes=JSON.stringify(s);return f;
}
async function run(name,options,test){
 const width=options.width||1440,f=fixture(options),id=name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+width;
 const context=await browser.newContext({viewport:{width,height:1100}}),errors=[];
 context.setDefaultTimeout(12000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
 await context.route('https://travellermap.com/api/**',async route=>{
  const u=new URL(route.request().url());assert.equal(u.searchParams.get('milieu'),'M1105');
  if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
  if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
  if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
  if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
  throw Error('Unexpected deterministic API request '+u.href);
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const action=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
 const click=(name,arg)=>action(name,arg).click();
 const field=name=>page.locator('#service-form [name="'+name+'"]');
 const fill=(name,value)=>field(name).fill(String(value));
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),read=async()=>JSON.parse(await raw());
 const unchanged=async(label,expected=f.bytes)=>assert.equal(await raw(),expected,label+' preserves all saved campaign bytes');
 const closed=()=>page.locator('#service-panel').waitFor({state:'hidden'});
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const screenshot=label=>page.screenshot({path:artifacts+'/inline-fuel-'+label+'-'+width+'.png',fullPage:true});
 const remember=selector=>page.locator(selector).evaluate(el=>({...el.dataset}));
 const replay=data=>page.evaluate(data=>{const button=document.createElement('button');Object.assign(button.dataset,data);document.body.append(button);button.click();button.remove();},data);
 const open=async()=>{await click('refuel');await page.locator('#service-form').waitFor();assert.equal(await page.locator('#modal').isVisible(),false);assert.equal(await action('service-adjust').count(),0);assert.equal(await action('service-review').count(),0);assert.equal(await field('fuelTons').getAttribute('step'),'any');};
 const undo=async()=>{await click('tab','History');await click('undo');await click('tab','Overview');};
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await unchanged('Initial load');
  await test({f,page,context,width,action,click,field,fill,raw,read,unchanged,closed,frames,screenshot,remember,replay,open,undo});
  assert.deepEqual(errors,[],name+' has no uncaught browser errors');report.scenarios.push({name,width,pass:true});console.log('PASS: '+name+' at '+width+'px');
 }catch(error){report.scenarios.push({name,width,pass:false,error:String(error.stack||error)});await screenshot('failure-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()).catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/inline-fuel-trace-'+id+'.zip'});await context.close();}
}
async function checkControls(page){
 const layout=await page.locator('#service-panel').evaluate(panel=>({overflow:panel.scrollWidth-panel.clientWidth,viewport:innerWidth,controls:[...panel.querySelectorAll('input,select,textarea,button')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>{
  const label=el.type==='checkbox'?[...(el.labels||[])].find(label=>label.getBoundingClientRect().width):null,r=(label||el).getBoundingClientRect();
  return {name:el.name||el.dataset.action,label:el.tagName==='BUTTON'||!!el.labels?.length||!!el.getAttribute('aria-label'),left:r.left,right:r.right,height:r.height};
 })}));
 assert.ok(layout.overflow<=2,'Inline panel has no horizontal overflow');
 for(const control of layout.controls){assert.ok(control.label,'Accessible label: '+control.name);assert.ok(control.left>=-1&&control.right<=layout.viewport+1,'Control fits viewport: '+JSON.stringify(control));assert.ok(control.height>=24,'Control has usable hit target: '+JSON.stringify(control));}
 await overviewGeometry(page,{markers:true});
}
try{
 for(const width of report.widths)await run('inline inputs navigation and camera',{width},async h=>{
  const {f,page,action,click,field,fill,unchanged,frames,screenshot,remember,replay,open,closed}=h;
  const ids=f.state.route,camera=()=>mapCameraSnapshot(page,ids);
  await click('map-zoom-in');await frames();
  const panMap=async()=>{
   const drag=await page.locator('.world-map').evaluate(map=>{map.scrollIntoView({block:'center',behavior:'instant'});const r=map.getBoundingClientRect();return {x:r.left+r.width*.65,y:r.top+r.height*.5,pan:map.querySelector('.map-content').getAttribute('transform')};});
   await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.x+24,drag.y+15,{steps:8});await page.mouse.up();
   await page.waitForFunction(before=>document.querySelector('.map-content').getAttribute('transform')!==before,drag.pan);
  };
  await panMap();let initialCamera=await camera();assert.notEqual(initialCamera.zoom,'100%');assert.notEqual(initialCamera.pan,'translate(0 0)');
  const sameCamera=async label=>assertMapCameraUnchanged(await camera(),initialCamera,label);
  await open();await sameCamera('Open inline fuel');await unchanged('Open inline fuel');
  assert.equal(await field('fuelTons').inputValue(),'23');assert.deepEqual(await field('fuelType').locator('option').evaluateAll(els=>els.map(el=>el.value)),['refined','unrefined','water','custom']);
  assert.match(await page.locator('#service-panel').textContent(),/20 \/ 43 t/);assert.equal(await action('service-confirm').isEnabled(),true);
  await checkControls(page);await screenshot('initial');
  for(const expected of ['13','3','0','0']){await click('service-fuel-step','-10');assert.equal(await field('fuelTons').inputValue(),expected);await unchanged('Minus ten');}
  assert.equal(await action('service-confirm').isDisabled(),true);
  for(const expected of ['10','20','23','23']){await click('service-fuel-step','10');assert.equal(await field('fuelTons').inputValue(),expected);await unchanged('Plus ten');}
  await fill('fuelTons','1.25');await click('service-fuel-step','10');assert.equal(await field('fuelTons').inputValue(),'11.25');
  await click('service-fuel-step','-10');assert.equal(await field('fuelTons').inputValue(),'1.25');
  await click('service-fuel-topoff');assert.equal(await field('fuelTons').inputValue(),'23');await click('service-fuel-next');assert.equal(await field('fuelTons').inputValue(),'20');
  await fill('fuelTons','2.25');await field('fuelType').selectOption('custom');await field('customFuelType').selectOption('unrefined');await fill('customFuelRate','101.25');await fill('expenseNotes','Negotiated local price');
  assert.match(await page.locator('#service-quote').textContent(),/Entered 2\.25 t → 3 t/);assert.match(await page.locator('#service-quote .service-total strong').textContent(),/Cr 304/);await unchanged('All draft inputs');await sameCamera('Custom fields');await checkControls(page);await screenshot('custom');
  const values=async()=>Object.fromEntries(await Promise.all(['fuelTons','fuelType','customFuelType','customFuelRate','expenseNotes'].map(async name=>[name,await field(name).inputValue()]))),draft=await values();
  await click('map-world',f.state.route[1]);await frames();assert.deepEqual(await values(),draft);assert.match(await page.locator('#service-panel h3').textContent(),/Actual Fuel Harbor/);assert.equal(await action('service-confirm').isEnabled(),true);await unchanged('Browse dry remote world');
  // Explicit world selection intentionally recenters the existing map. Re-pan
  // afterward so navigation checks still exercise a nonzero camera offset.
  assert.equal((await camera()).zoom,initialCamera.zoom);assert.equal((await camera()).pan,'translate(0 0)');await panMap();initialCamera=await camera();assert.notEqual(initialCamera.pan,'translate(0 0)');
  const beforeNearby=await camera(),response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/jumpworlds'));await click('nearby');await response;await frames();assert.deepEqual(await values(),draft);assertMapCameraUnchanged(await camera(),beforeNearby,'Nearby refresh');await unchanged('Nearby refresh');
  const oldConfirm=await remember('#service-panel [data-action="service-confirm"]');await click('service-back');await closed();await unchanged('Back');await sameCamera('Back');
  await open();await replay(oldConfirm);assert.equal(await field('fuelTons').inputValue(),'23');await unchanged('Detached confirm after reopen');
  for(const dismiss of ['service-cancel','service-back','Escape']){
   await fill('fuelTons','7.5');if(dismiss==='Escape')await page.keyboard.press('Escape');else await click(dismiss);await closed();await unchanged(dismiss);await sameCamera(dismiss);await open();
  }
  // All reachable support modes remain in the existing service browser suite.
  for(const target of ['refill-support','ship-expenses','cargo-hold']){
   await fill('fuelTons','7.5');const old=await remember('#service-panel [data-action="service-confirm"]');await click(target);await replay(old);await unchanged('Switch to '+target);await sameCamera('Switch to '+target);await open();assert.equal(await field('fuelTons').inputValue(),'23');
  }
  for(const tab of ['Trade','Accounts','History','Settings']){
   await fill('fuelTons','4.75');const old=await remember('#service-panel [data-action="service-confirm"]');await click('tab',tab);await replay(old);await closed();await unchanged('Tab '+tab);await click('tab','Overview');await open();assert.equal(await field('fuelTons').inputValue(),'23');
  }
  await fill('fuelTons','4.75');await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await closed();await unchanged('Reload abandons draft');
  await open();await field('fuelType').focus();await page.keyboard.press('u');await page.keyboard.press('Tab');await fill('fuelTons','2');await action('service-cancel').focus();await page.keyboard.press('Enter');await closed();await unchanged('Keyboard cancellation');
 });
 for(const [source,grade,amount]of [['refined',null,'1500'],['unrefined',null,'300'],['water',null,'0'],['custom','refined','304'],['custom','unrefined','304']])await run('commit '+source+(grade?' '+grade:''),{},async h=>{
  const {f,page,click,field,fill,read,raw,unchanged,open,closed,remember,replay,undo}=h;
  await open();await fill('fuelTons','2.25');await field('fuelType').selectOption(source);
  if(grade){await field('customFuelType').selectOption(grade);await fill('customFuelRate','101.25');assert.equal(await h.action('service-confirm').isEnabled(),true,'Custom price note is optional at standard supply');}
  await fill('expenseNotes','Recorded '+source+' purchase');await unchanged('Before one explicit confirmation');
  const token=await remember('#service-panel [data-action="service-confirm"]');await page.locator('#service-panel [data-action="service-confirm"]').evaluate(button=>{button.click();button.click();});await closed();
  const paid=await read(),paidBytes=await raw();assert.equal(paid.ship.fuel.aboardTons,23);assert.equal(paid.bank,String(100000n-BigInt(amount)));assert.equal(paid.revision,f.state.revision+1);assert.equal(paid.undo.length,1);assert.equal(paid.ledger.length,1);assert.equal(paid.actual,f.state.actual);assert.equal(paid.hours,f.state.hours);
  const expense=paid.ledger[0].expense,details=Object.fromEntries(expense.details);assert.equal(expense.amount,amount);assert.equal(expense.notes,'Recorded '+source+' purchase');assert.equal(details['Entered fuel tons'],'2.25');assert.equal(details['Fuel tons'],'3');assert.equal(details['Fuel type'],(grade||source)==='refined'?'Refined':'Unrefined');if(grade)assert.equal(details['Rate · Cr/ton'],'101.25');
  await replay(token);await unchanged('Repeated detached confirm',paidBytes);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(),paid);
  await undo();const undone=await read();for(const key of ['ship','bank','ledger','actual','hours'])assert.deepEqual(undone[key],f.state[key],'Undo restores '+key);
 });
 for(const port of ['A','X'])for(const width of report.widths)await run('fully full '+port+' still editable',{width,aboard:43,port,hydro:'0'},async h=>{
  const {page,action,field,fill,click,open,unchanged,screenshot}=h;await open();assert.equal(await field('fuelTons').inputValue(),'0');assert.equal(await action('service-confirm').isDisabled(),true);assert.equal(await action('service-fuel-correct').isEnabled(),true);assert.match(await page.locator('#service-panel').textContent(),/43 \/ 43 t/);await click('map-world',h.f.state.route[1]);assert.match(await page.locator('#service-panel h3').textContent(),/Actual Fuel Harbor/);
  for(const [source,rate]of [['refined','500'],['unrefined','100'],['water','0'],['custom','125.5']]){
   await field('fuelType').selectOption(source);if(source==='custom')await fill('customFuelRate',rate);
   assert.equal(await action('service-confirm').isDisabled(),true);assert.match(await page.locator('#service-quote').textContent(),new RegExp('Cr '+rate.replace('.','\\.')));assert.equal((await page.locator('#service-quote .service-total strong').textContent()).trim(),'Cr 0');await unchanged('Full tank source '+source);
  }
  await click('service-fuel-topoff');assert.equal(await field('fuelTons').inputValue(),'0');await checkControls(page);await screenshot(port==='A'?'full':'full-x-no-supplier');await unchanged('Full tank form');
 });
 for(const [aboard,bladders,cargo,maximum,label]of [[42,0,'120',1,'near-full odd tank'],[43,1,'120',40,'full fixed tank empty bladder'],[40,1,'0',3,'no spare cargo'],[43,1,'0',0,'bladder blocked by cargo'],[40,1,'5.2',8,'fractional cargo limit']])for(const width of (label==='full fixed tank empty bladder'?report.widths:[1440]))await run(label,{width,aboard,bladders,cargo},async h=>{
  const {page,field,fill,click,action,open,unchanged,read,screenshot}=h;await open();assert.equal(await field('fuelTons').inputValue(),String(maximum));assert.equal(await action('service-fuel-topoff').textContent(),'Top off · '+maximum+' t');
  await click('service-fuel-step','10');assert.equal(await field('fuelTons').inputValue(),String(maximum));await fill('fuelTons',maximum+.01);assert.equal(await action('service-confirm').isDisabled(),true);assert.match(await page.locator('#service-quote').textContent(),/tank or cargo space/);await unchanged('Overfill is rejected');
  await click('service-fuel-topoff');await field('fuelType').selectOption('water');await screenshot(label.replace(/ /g,'-'));await unchanged('Physical maximum top-off');
  if(maximum){await fill('fuelTons',maximum-.25);assert.equal(await action('service-confirm').isEnabled(),true);await click('service-confirm');assert.equal((await read()).ship.fuel.aboardTons,aboard+maximum);}else assert.equal(await action('service-confirm').isDisabled(),true);
 });
 await run('invalid numbers and insufficient funds',{bank:'99'},async h=>{
  const {page,field,fill,action,click,open,unchanged}=h;await open();await fill('fuelTons','1');await field('fuelType').selectOption('unrefined');assert.match(await page.locator('#service-quote').textContent(),/Insufficient funds/);assert.equal(await action('service-confirm').isDisabled(),true);
  await field('fuelType').selectOption('water');
  for(const value of ['','-0.5','23.01','9007199254740992']){await fill('fuelTons',value);assert.equal(await action('service-confirm').isDisabled(),true,'Invalid fuel '+value);await unchanged('Invalid quantity '+value);}
  // Native number inputs sanitize nonfinite strings to empty. Dispatch the
  // actual browser events, then verify both the DOM value and disabled gate.
  for(const value of ['NaN','Infinity','1e309']){await field('fuelTons').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(await field('fuelTons').inputValue(),'');assert.equal(await action('service-confirm').isDisabled(),true);await unchanged('Nonfinite quantity '+value);}
  await fill('fuelTons','1');await field('fuelType').selectOption('custom');
  for(const value of ['','-0.5','NaN','Infinity','1e309']){await field('customFuelRate').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(await action('service-confirm').isDisabled(),true);await unchanged('Invalid custom price '+value);}
  await fill('customFuelRate','0');assert.equal(await action('service-confirm').isEnabled(),true,'Zero-price purchased grade remains explicit');await click('service-cancel');await unchanged('Cancel invalid draft');
 });
 await run('custom price Cr100 rounding',{creditStep:100},async h=>{await h.open();await h.fill('fuelTons','2.25');await h.field('fuelType').selectOption('custom');await h.fill('customFuelRate','101.25');assert.equal((await h.page.locator('.service-total strong').textContent()).trim(),'Cr 400');await h.unchanged('Cr100 quote');await h.click('service-confirm');assert.equal((await h.read()).bank,'99600');});
 for(const port of ['C','X'])await run('actual grade supply at port '+port,{port,hydro:'0'},async h=>{
  const {page,field,fill,action,click,open,unchanged,read}=h;await open();await fill('fuelTons','3');await field('fuelType').selectOption('custom');await field('customFuelType').selectOption('refined');await fill('customFuelRate','25.5');assert.equal(await action('service-confirm').isDisabled(),true);
  await field('customFuelType').selectOption('unrefined');assert.equal(await action('service-confirm').isEnabled(),port==='C','Underlying unrefined availability is unchanged');
  await field('customFuelType').selectOption('refined');await field('otherSupplier').check();assert.equal(await action('service-confirm').isDisabled(),true,'Override still needs source note');await fill('expenseNotes','Referee-confirmed fuel cache');assert.equal(await action('service-confirm').isEnabled(),true);await fill('expenseNotes','');assert.equal(await action('service-confirm').isDisabled(),true);
  await field('fuelType').selectOption('water');assert.match(await page.locator('#fuel-availability').textContent(),/advisory only/);assert.equal(await action('service-confirm').isEnabled(),true);await unchanged('Water advisory never gates free collection');await click('service-confirm');assert.equal((await read()).bank,'100000');assert.equal((await read()).ship.fuel.aboardTons,23);
 });
 await run('manual correction retains its separate review',{},async h=>{
  await h.open();await h.click('service-fuel-correct');assert.equal(await h.action('service-confirm').count(),0);await h.fill('fuelRemaining','21');assert.equal(await h.action('service-review').isDisabled(),true);await h.fill('fuelRemaining','13');await h.fill('fuelReason','Recorded seven-ton leak');await h.unchanged('Manual correction draft');await h.click('service-review');await h.unchanged('Manual correction review');await h.click('service-confirm');const paid=await h.read();assert.equal(paid.ship.fuel.aboardTons,13);assert.equal(paid.bank,'100000');assert.equal(paid.ledger.length,0);assert.equal(paid.events.find(event=>event.fuelCorrection).fuelCorrection.reason,'Recorded seven-ton leak');await h.undo();assert.deepEqual((await h.read()).ship,h.f.state.ship);
 });
 await run('stale saves and editing ownership',{},async h=>{
  const {context,page,click,fill,action,open,remember,replay,unchanged}=h;await open();await fill('fuelTons','7');const token=await remember('#service-panel [data-action="service-confirm"]');
  const changed=await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.revision++;s.bank='99999';const bytes=JSON.stringify(s);localStorage.setItem(key,bytes);return bytes;},campaignKey);
  await click('service-confirm');await unchanged('Stale persisted revision',changed);await replay(token);await unchanged('Repeated stale confirmation',changed);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await open();const old=await remember('#service-panel [data-action="service-confirm"]');
  const other=await context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();assert.equal(await other.locator('[data-action="refuel"]').isDisabled(),true);await other.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
  assert.equal(await page.locator('#service-panel [data-action="service-confirm"]:not(:disabled)').count(),0);await replay(old);await unchanged('Lost ownership callback',changed);await other.close();await page.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Editing in this tab',{exact:true}).waitFor();
  if(await action('service-cancel').count())await click('service-cancel');await open();await replay(old);await unchanged('Ownership restored does not revive stale token',changed);
 });

 for(const width of report.widths)for(const kind of ['extra reserve','comfort only'])await run('full LSS '+kind,{width,fullSupport:true,frozen:2},async h=>{
  const {page,click,field,fill,action,unchanged,read,raw,screenshot,undo}=h;
  await click('refill-support');await page.locator('#service-form').waitFor();assert.equal(await field('extraDays').inputValue(),'0');assert.equal(await action('service-review').isDisabled(),true);assert.equal(await action('service-confirm').count(),0);
  assert.match(await page.locator('#service-quote').textContent(),/Standard top-up/);assert.equal((await page.locator('#service-quote .service-total strong').textContent()).trim(),'Cr 0');await unchanged('Full LSS opens controls with zero baseline');
  if(kind==='extra reserve'){
   await fill('extraDays','14');assert.match(await page.locator('#service-quote').textContent(),/Cr 2,100/);assert.match(await page.locator('#service-quote').textContent(),/176\.4 LSS aboard/);
  }else{
   await page.locator('.service-comfort > summary').click();await fill('comfortCredits','2000');assert.equal(await action('service-review').isDisabled(),true);await fill('comfortNote','Better meals only');assert.match(await page.locator('#service-quote').textContent(),/Cr 2,000/);assert.match(await page.locator('#service-quote').textContent(),/117\.6 LSS aboard/);
  }
  await checkControls(page);await screenshot('full-lss-'+kind.replace(/ /g,'-'));await unchanged('Full LSS extra draft');await click('service-review');await unchanged('Full LSS review');await click('service-confirm');await h.closed();
  const paid=await read(),paidBytes=await raw(),stock=paid.ship.lifeSupport.stockUnits;assert.equal(Number(stock.numerator)/Number(stock.denominator),kind==='extra reserve'?176.4:117.6);assert.equal(paid.bank,kind==='extra reserve'?'97900':'98000');assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);assert.equal(paid.hours,h.f.state.hours);
  await click('refill-support');await page.locator('#service-form').waitFor();assert.equal(await action('service-review').isDisabled(),true,'Reopening full baseline cannot double-charge');await click('service-cancel');await unchanged('Cancel after paid LSS',paidBytes);await undo();for(const key of ['bank','ship','ledger'])assert.deepEqual((await read())[key],h.f.state[key]);
 });
 for(const width of report.widths)await run('six compact expense buttons',{width,fixedExpenses:true},async h=>{
  const {page,click,unchanged,screenshot}=h;await click('ship-expenses');await page.locator('.expense-table').waitFor();
  const buttons=page.locator('.expense-table [data-action="expense-open"]');assert.equal(await buttons.count(),6);
  const labels=await buttons.allTextContents();assert.deepEqual(labels,['Mortgage ›','Monthly maintenance ›','Crew salaries ›','Life support ›','Fuel ›','Port costs ›']);
  const appearance=await buttons.evaluateAll(els=>els.map(el=>{const style=getComputedStyle(el),r=el.getBoundingClientRect(),rgb=style.backgroundColor.match(/[\d.]+/g).map(Number);return {name:el.textContent,tag:el.tagName,background:style.backgroundColor,border:style.borderStyle,rgb,height:r.height,width:r.width,left:r.left,right:r.right,viewport:innerWidth};}));
  // Allow one tenth of a pixel for Chromium's fractional line-box rounding.
  for(const item of appearance){assert.equal(item.tag,'BUTTON');assert.ok(item.rgb.length===3||item.rgb[3]>0,'Visible button fill: '+JSON.stringify(item));assert.ok(item.rgb[2]>item.rgb[0]&&item.rgb[2]>=item.rgb[1]&&item.rgb[2]>=160,'Light-blue fill: '+JSON.stringify(item));assert.notEqual(item.border,'none');assert.ok(item.height>=24&&item.height<=56.1&&item.left>=-1&&item.right<=item.viewport+1,'Compact in-viewport button: '+JSON.stringify(item));}
  await overviewGeometry(page);await screenshot('expense-buttons');await unchanged('Expense buttons overview');
  for(const [label,fieldName]of [['Mortgage','payments'],['Monthly maintenance','payments'],['Crew salaries','payments'],['Life support',null],['Fuel','fuelTons'],['Port costs','weeks']]){
   await page.getByRole('button',{name:label+' ›',exact:true}).click();
   if(label==='Life support'){await page.locator('#service-panel').waitFor();await click('service-adjust');assert.equal(await page.locator('#service-form [name="extraDays"]').isEditable(),true);}
   else assert.equal(await page.locator((label==='Fuel'?'#service-form':'#expense-form')+' [name="'+fieldName+'"]').isEditable(),true,label+' opens working controls');
   assert.equal(await page.locator('#modal').isVisible(),false);await unchanged('Expense destination '+label);if(await page.locator('#expense-panel').count())await click('expense-back');else await click('ship-expenses');
  }
 });
 for(const kind of ['mortgage','maintenance'])await run('unconfigured '+kind+' settings route',{},async h=>{
  await h.click('ship-expenses');await h.page.getByRole('button',{name:kind==='mortgage'?'Mortgage ›':'Monthly maintenance ›',exact:true}).click();assert.match(await h.page.locator('#expense-panel').textContent(),/is not configured/);assert.equal(await h.page.locator('#expense-form').count(),0);await h.unchanged('Unconfigured '+kind);await h.click('expense-settings');
  await h.page.locator('#settings-form').waitFor();assert.equal(await h.page.locator('[data-settings-group="'+kind+'"]').evaluate(el=>el.open),true);assert.equal(await h.page.locator('#settings-form [name="'+(kind==='mortgage'?'mortgagePayment':'maintenancePayment')+'"]').isEditable(),true);assert.equal(await h.page.locator('#modal').isVisible(),false);await h.unchanged('Open settings for '+kind);await h.click('tab','Overview');await h.unchanged('Leave configuration');
 });
 report.pass=true;console.log('PASS: all inline fuel browser scenarios.');
}finally{await writeFile(artifacts+'/inline-fuel-report.json',JSON.stringify(report,null,2));await browser.close();}
