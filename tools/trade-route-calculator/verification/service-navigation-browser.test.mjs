// Real Chromium regression coverage. All campaigns and Traveller Map responses
// are synthetic. Run: node verification/service-navigation-browser.test.mjs [playwright-module]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {validate} from '../js/state.mjs';
import {overviewGeometry,mapCameraSnapshot,assertMapCameraUnchanged} from './overview-layout.mjs';

const widths=[1440,1100,390,320];
const names=['refuel','refill-support','cargo-hold','ship-expenses'];
const panels={refuel:'#service-panel','refill-support':'#service-panel','cargo-hold':'#cargo-hold-panel','ship-expenses':'#expense-panel',world:'.world-screen.world-info'};
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const action=(page,name)=>page.locator('[data-action="'+name+'"]:visible').first();
const header=(page,name)=>page.locator('#ship-actions > .ship-actions > [data-action="'+name+'"]');
const click=(page,name)=>action(page,name).click();
const raw=page=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
const field=(page,name)=>page.locator('#service-form [name="'+name+'"],#expense-form [name="'+name+'"]');

// Importing this module only validates fixtures; it never launches Chromium.
export function serviceNavigationFixture(){
 const f=guiFixture(12),s=f.state,lot=structuredClone(s.lots[0]);
 Object.assign(s,{name:'Stable service navigation verification',bank:'5000000',hours:48,ledger:[],events:[],undo:[],jumpAttempts:[]});
 s.route=s.route.slice(0,3);s.routeIndex=1;
 s.ship.name='Synthetic navigation and long-manifest trader';
 s.ship.fuel=configureFuel(200,43,20,0,2);
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:4,high:0}};
 // Merely opening/closing a service must not persist even a legacy migration.
 s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:0};
 s.ship.expenses={salary:'12000'};
 s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
 s.ship.maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};
 s.worlds[s.actual].berthingRate={port:'A',die:2};
 s.lots=Array.from({length:48},(_,i)=>({...structuredClone(lot),id:'navigation-long-manifest-lot-'+String(i+1).padStart(3,'0'),quantity:'1',basis:'1000',goodsValue:'1000'}));
 validate(s);f.bytes=JSON.stringify(s);f.cameraIds=[s.actual,s.route[0]];return f;
}

async function selected(page,name){
 await page.locator(panels[name]).waitFor({state:'visible'});
 assert.equal(await page.locator('.navigation-layout > .world-screen').count(),1,'Exactly one right-hand screen is mounted');
 assert.equal(await page.locator('#modal').isVisible(),false,'Service navigation never opens a modal');
 for(const candidate of names){
  const button=header(page,candidate);
  assert.equal(await button.getAttribute('aria-pressed'),String(candidate===name),candidate+' exposes its selected state when '+name+' is open');
  assert.equal(await button.isEnabled(),true,'Another service remains directly reachable: '+candidate);
  const controlled=await button.getAttribute('aria-controls');
  assert.ok(controlled,'Service toggle identifies its controlled screen');
  assert.equal(await page.locator('[id="'+controlled+'"]').count(),1,'aria-controls resolves to the current screen');
 }
 if(name==='refuel')assert.match(await page.locator('#service-panel h2').textContent(),/Refuel|fuel aboard/);
 if(name==='refill-support')assert.match(await page.locator('#service-panel h2').textContent(),/Life support/);
}

async function geometry(page){
 await frame(page);await overviewGeometry(page,{markers:true});
 return page.evaluate(()=>{
  const selectors={map:'.world-map',mapSlot:'.map-viewport',navigation:'.navigation-panel',right:'.navigation-layout > .world-screen',layout:'.navigation-layout',bezel:'.mfd-frame',screen:'.mfd-screen'};
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height};};
  return Object.fromEntries(Object.entries(selectors).map(([name,selector])=>[name,box(document.querySelector(selector))]));
 });
}
function sameGeometry(actual,expected,label,{outer=true}={}){
 const parts=outer?Object.keys(expected):['map','mapSlot','navigation','right','layout'];
 for(const name of parts)for(const dimension of (outer?['left','top','width','height']:['width','height'])){
  assert.ok(Math.abs(actual[name][dimension]-expected[name][dimension])<=1,`${label}: ${name} ${dimension} remains fixed (${expected[name][dimension]} → ${actual[name][dimension]})`);
 }
}

async function primeCamera(page,ids){
 const before=await mapCameraSnapshot(page,ids);
 await click(page,'map-zoom-in');
 await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='120%');
 const zoomed=await mapCameraSnapshot(page,ids);
 assert.ok(zoomed.spacing>before.spacing*1.19,'Positive control: actual world spacing grows when zoom is explicitly changed');
 const start=await page.locator('.world-map').evaluate(svg=>{
  svg.scrollIntoView({block:'center',behavior:'instant'});const r=svg.getBoundingClientRect();
  return {x:r.left+r.width*.7,y:r.top+r.height*.5,pan:svg.querySelector('.map-content').getAttribute('transform')};
 });
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+24,start.y+16,{steps:6});await page.mouse.up();
 await page.waitForFunction(pan=>document.querySelector('.map-content').getAttribute('transform')!==pan,start.pan);
 const after=await mapCameraSnapshot(page,ids);
 assert.notEqual(after.pan,'translate(0 0)');
 assert.ok(Math.hypot(after.center.x-zoomed.center.x,after.center.y-zoomed.center.y)>.1,'Positive control: dragging changes the geographic camera center');
 return after;
}

async function unlocked(page){
 assert.equal(await action(page,'jump').isEnabled(),true,'Dismissal releases the existing next-jump action');
 assert.equal(await action(page,'day-forward').isEnabled(),true,'Dismissal releases campaign day controls');
}

// Save complete token-bearing actions and forms before discarding the session.
// Replaying them through the same delegated DOM handlers must remain inert.
async function staleHandlers(page){
 return page.evaluate(()=>({
  buttons:[...document.querySelectorAll('#service-panel [data-service-token],#expense-panel [data-action]')].filter(el=>el.tagName==='BUTTON').map(el=>({...el.dataset})),
  forms:[...document.querySelectorAll('#service-form,#expense-form')].map(el=>el.outerHTML)
 }));
}
async function replayHandlers(page,saved){
 await page.evaluate(async saved=>{
  for(const data of saved.buttons){
   const b=document.createElement('button');Object.assign(b.dataset,data);document.body.append(b);b.click();
   await new Promise(resolve=>setTimeout(resolve,0));b.remove();
  }
  for(const html of saved.forms){
   const template=document.createElement('template');template.innerHTML=html;
   const form=template.content.firstElementChild;form.hidden=true;document.body.append(form);
   form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(resolve=>setTimeout(resolve,0));form.remove();
  }
 },saved);
 await frame(page);
}

async function openMortgage(page){await page.getByRole('button',{name:'Mortgage ›',exact:true}).click();await page.locator('#expense-form').waitFor();}
async function draft(page,name,{review=false}={}){
 if(name==='refuel'){
  await field(page,'fuelTons').fill('7.25');await field(page,'fuelType').selectOption('custom');
  await field(page,'customFuelRate').fill('101.25');await field(page,'expenseNotes').fill('UnconfirmedLongNavigationDraft'.repeat(8));
 }else if(name==='refill-support'){
  await click(page,'service-adjust');await field(page,'extraDays').fill('14');
  await page.locator('.service-comfort > summary').click();await field(page,'comfortCredits').fill('1000');
  await field(page,'comfortNote').fill('Unconfirmed comfort provisions');
  if(review)await click(page,'service-review');
 }else if(name==='ship-expenses'){
  await openMortgage(page);await field(page,'payments').fill('24');
  await page.locator('.covered-payments > summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#expense-panel .covered-payments tbody tr').length===24);
 }
}

async function defaultDraft(page,name){
 if(name==='refuel'){
  assert.equal(await field(page,'fuelTons').inputValue(),'23');assert.equal(await field(page,'expenseNotes').inputValue(),'');
  assert.equal(await field(page,'fuelType').inputValue(),'refined');
 }else if(name==='refill-support'){
  await click(page,'service-adjust');assert.equal(await field(page,'extraDays').inputValue(),'0');assert.equal(await field(page,'comfortCredits').inputValue(),'0');
 }else if(name==='ship-expenses'){
  await openMortgage(page);assert.equal(await field(page,'payments').inputValue(),'1');
 }
}

async function controls(page){
 const result=await page.locator('.navigation-layout > .world-screen').evaluate(panel=>({
  overflow:panel.scrollWidth-panel.clientWidth,
  items:[...panel.querySelectorAll('button,input,select,textarea,summary')].filter(el=>el.getClientRects().length&&!el.closest('.cargo-manifest-scroll')).map(el=>{
   const label=el.type==='checkbox'?[...(el.labels||[])].find(label=>label.getClientRects().length):null,target=label||el,r=target.getBoundingClientRect(),p=panel.getBoundingClientRect();
   return {name:el.name||el.dataset.action||el.textContent.trim().slice(0,50),disclosure:el.tagName==='SUMMARY',label:el.matches('button,summary')||!!el.labels?.length||!!el.getAttribute('aria-label'),font:parseFloat(getComputedStyle(el).fontSize),height:r.height,fits:r.left>=p.left-1&&r.right<=p.right+1};
  })
 }));
 assert.ok(result.overflow<=2,'The right screen has no horizontal overflow; tables own their horizontal scroll');
 for(const item of result.items){
  assert.ok(item.label,'Control has an accessible name: '+item.name);assert.ok(item.fits,'Control fits its screen: '+item.name);
  assert.ok(item.height>=(item.disclosure?15:24),'Control has a usable target: '+JSON.stringify(item));assert.ok(item.font>=11,'Control text remains readable: '+JSON.stringify(item));
 }
 return result;
}

async function reachable(page,selector){
 const control=page.locator(selector).filter({visible:true}).first();
 await control.scrollIntoViewIfNeeded();await control.focus();await frame(page);
 const point=await control.evaluate(el=>{
  const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
  return {focused:document.activeElement===el,inViewport:x>=0&&x<=innerWidth&&y>=0&&y<=innerHeight,hit:!!hit&&(el===hit||el.contains(hit))};
 });
 assert.ok(point.focused&&point.inViewport&&point.hit,'Control is keyboard reachable and not clipped/covered: '+selector+' '+JSON.stringify(point));
}

async function internalScroll(page,name){
 const panel=page.locator('.navigation-layout > .world-screen');
 const before=await panel.evaluate(el=>({height:el.clientHeight,content:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
 assert.match(before.overflow,/auto|scroll/,'Every screen has an internal vertical scroll container');
 if(name==='refuel'||name==='refill-support'){
  assert.ok(before.content>before.height+20,'Expanded service content exceeds the fixed screen and must scroll');
  await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  assert.ok(await panel.evaluate(el=>el.scrollTop>0),'The expanded service really scrolls internally');
  await reachable(page,name==='refuel'?'#service-panel [data-action="service-confirm"]':'#service-panel [data-action="service-review"]');
 }else if(name==='cargo-hold'){
  const goods=page.locator('.cargo-goods-scroll');
  assert.ok(await goods.evaluate(el=>el.scrollHeight>el.clientHeight+100),'The long manifest scrolls inside its own region');
  await goods.scrollIntoViewIfNeeded();await goods.focus();await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>document.querySelector('.cargo-goods-scroll').scrollTop>0);
  await reachable(page,'#cargo-hold-panel [data-action="cargo-hold-tab"]');
 }else if(name==='ship-expenses'){
  assert.ok(await page.locator('.covered-payments-scroll').evaluate(el=>el.scrollHeight>el.clientHeight),'Expanded mortgage dates own a scroll region');
  await reachable(page,'#expense-panel [data-action="expense-pay"]');
 }
 await panel.evaluate(el=>{el.scrollTop=0;});return before;
}

async function runWidth(browser,width,report){
 const f=serviceNavigationFixture(),context=await browser.newContext({viewport:{width,height:1100}}),errors=[];
 const result={width,pass:false,checks:[],scroll:[]};report.results.push(result);
 context.setDefaultTimeout(12000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:f.bytes});
 await context.route('https://travellermap.com/api/**',async route=>{
  const u=new URL(route.request().url());assert.equal(u.searchParams.get('milieu'),'M1105');
  if(u.pathname.endsWith('/universe'))return route.fulfill({json:f.universe});
  if(u.pathname.endsWith('/metadata'))return route.fulfill({json:f.metadata});
  if(u.pathname.endsWith('/sec'))return route.fulfill({json:f.sec});
  if(u.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:u.searchParams.get('jump')==='0'?f.apiWorlds.filter(w=>u.searchParams.has('hex')?w.Hex===u.searchParams.get('hex'):w.WorldX===Number(u.searchParams.get('x'))&&w.WorldY===Number(u.searchParams.get('y'))):f.apiWorlds}});
  throw Error('Unexpected deterministic map request '+u.href);
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const unchanged=async(label,bytes=f.bytes)=>assert.equal(await raw(page),bytes,label+' preserves campaign bytes, transactions, stocks and Undo');
 const screenshot=async label=>{await page.locator('.navigation-layout').screenshot({path:artifacts+'/service-navigation-'+label+'-'+width+'.png'});};
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await selected(page,'world');await unchanged('Initial load');
  let camera=await primeCamera(page,f.cameraIds),baseline=await geometry(page);
  const stable=async(label,{bytes=f.bytes}={})=>{
   const measured=await geometry(page);sameGeometry(measured,baseline,label);
   assertMapCameraUnchanged(await mapCameraSnapshot(page,f.cameraIds),camera,label);
   await unchanged(label,bytes);result.checks.push({label,mapHeight:measured.map.height,rightHeight:measured.right.height,bezelHeight:measured.bezel.height});
  };
  await screenshot('world');

  // All sixteen source/target pairs, with unconfirmed edits before switching.
  // Same-button clicks close to World data; different buttons replace directly.
  for(const from of names)for(const to of names){
   await header(page,from).click();await selected(page,from);await draft(page,from,{review:to==='refill-support'});
   await stable(from+' prepared before '+to);const stale=await staleHandlers(page);
   await header(page,to).click();const target=from===to?'world':to;await selected(page,target);
   await replayHandlers(page,stale);await selected(page,target);await stable(from+' → '+target+' with stale actions/forms');
   if(target!=='world'){await header(page,to).click();await selected(page,'world');}
   await unlocked(page);await stable('Returned to World data from '+from+'/'+to);
   if(from!=='cargo-hold'){
    await header(page,from).click();await defaultDraft(page,from);await header(page,from).click();await selected(page,'world');
    await stable('Reopened '+from+' starts a clean draft');
   }
  }

  // Subscreen growth, audit disclosure, internal scroll and reachable actions.
  for(const name of names){
   await header(page,name).click();await selected(page,name);await draft(page,name);
   if(name==='refuel'){await page.locator('.service-audit > summary').click({position:{x:8,y:8}});assert.equal(await page.locator('.service-audit').evaluate(el=>el.open),true);}
   assert.equal(await page.locator('#rule-reference-popup').isVisible(),false,'Disclosure clicks do not activate the separate source button');
   await controls(page);result.scroll.push({name,...await internalScroll(page,name)});
   await stable('Expanded and scrolled '+name);await screenshot(name+'-expanded');
   await header(page,name).click();await selected(page,'world');await unlocked(page);
  }

  // Back and Escape keep their established semantics; expense Back returns to
  // Expenses, while the header always toggles the complete expense screen off.
  for(const name of ['refuel','refill-support'])for(const mode of ['edit','review']){
   await header(page,name).click();
   if(name==='refuel'&&mode==='review'){
    await click(page,'service-fuel-correct');await field(page,'fuelRemaining').fill('13');await field(page,'fuelReason').fill('Unconfirmed leak');await click(page,'service-review');
   }else await draft(page,name,{review:mode==='review'});
   const stale=await staleHandlers(page);await click(page,'service-back');await selected(page,'world');
   await replayHandlers(page,stale);await unlocked(page);await stable(name+' '+mode+' Back');
  }
  for(const review of [false,true]){
   await header(page,'refuel').click();await click(page,'service-fuel-correct');
   await field(page,'fuelRemaining').fill('13');await field(page,'fuelReason').fill('Discarded inventory correction');
   if(review)await click(page,'service-review');
   const stale=await staleHandlers(page);await header(page,'refuel').click();await selected(page,'world');
   await replayHandlers(page,stale);await stable('Fuel correction '+(review?'review':'edit')+' header toggle');await unlocked(page);
  }
  await header(page,'ship-expenses').click();await draft(page,'ship-expenses');
  const oldExpense=await staleHandlers(page);await click(page,'expense-back');await selected(page,'ship-expenses');
  assert.equal(await page.locator('.expense-table').count(),1,'Payment Back retains the Expenses summary');
  await replayHandlers(page,oldExpense);await stable('Expense Back discards unconfirmed payment');
  await click(page,'expense-close');await selected(page,'world');await unlocked(page);
  for(const name of names){
   await header(page,name).click();await draft(page,name);await page.keyboard.press('Escape');await selected(page,'world');
   await stable('Escape from '+name);await unlocked(page);
  }

  // The new controls remain standard keyboard buttons, including repeat Enter
  // and Space after a rerender, without accidentally confirming a payment.
  for(const name of names){
   await header(page,name).focus();await page.keyboard.press('Enter');await selected(page,name);
   assert.equal(await header(page,name).evaluate(el=>el===document.activeElement),true,'Keyboard toggle keeps focus after opening '+name);
   await page.keyboard.press('Space');await selected(page,'world');
   assert.equal(await header(page,name).evaluate(el=>el===document.activeElement),true,'Keyboard toggle keeps focus after closing '+name);
   await stable('Keyboard Enter/Space '+name);
  }
  // Same-frame repeated clicks exercise the asynchronous delegated handler and
  // fresh render selectors; never reuse a detached, unconnected header button.
  const sequences=[['refuel','refuel'],['cargo-hold','cargo-hold','cargo-hold','cargo-hold'],['refuel','refill-support','ship-expenses','cargo-hold','cargo-hold'],['ship-expenses','ship-expenses','refill-support','refill-support']];
  for(const sequence of sequences){
   await page.evaluate(async sequence=>{for(const name of sequence){document.querySelector('#ship-actions [data-action="'+name+'"]').click();await Promise.resolve();await Promise.resolve();}},sequence);
   await frame(page);await selected(page,'world');await unlocked(page);await stable('Rapid clicks '+sequence.join('/'));
  }

  // Every unconfirmed form is ephemeral across reload. Rebaseline the camera:
  // reload is allowed to restore the application's normal initial map view.
  for(const name of names){
   await header(page,name).click();await draft(page,name,{review:name==='refill-support'});await page.reload();
   await page.getByText('Editing in this tab',{exact:true}).waitFor();await selected(page,'world');await unlocked(page);await unchanged('Reload abandons '+name);
   sameGeometry(await geometry(page),baseline,'Reload of '+name);camera=await mapCameraSnapshot(page,f.cameraIds);
   await header(page,name).click();await defaultDraft(page,name);await header(page,name).click();await stable('Reloaded '+name+' has default values');
  }

  // A saved mortgage payment stays a ledger-backed receipt. Closing, directly
  // switching, stale callbacks and reload may not refund it or charge it twice.
  await header(page,'ship-expenses').click();await openMortgage(page);await field(page,'payments').fill('2');
  const paidHandlers=await staleHandlers(page),beforePay=await geometry(page);
  // The receipt intentionally keeps a working Back action in this session;
  // only obsolete commit buttons/form submissions should be replayed here.
  paidHandlers.buttons=paidHandlers.buttons.filter(data=>data.action==='expense-pay');
  await action(page,'expense-pay').evaluate(button=>{button.click();button.click();});await page.locator('.expense-receipt').waitFor();
  const paidBytes=await raw(page),paid=JSON.parse(paidBytes);
  assert.equal(paid.bank,'4800000');assert.equal(paid.revision,f.state.revision+1);assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);
  assert.equal(paid.ship.mortgage.remainingPayments,358);assert.equal(paid.ship.mortgage.nextDueDate,'085-1105');
  assert.equal(paid.hours,f.state.hours);assert.deepEqual(paid.ship.fuel,f.state.ship.fuel);assert.deepEqual(paid.lots,f.state.lots);
  await selected(page,'ship-expenses');sameGeometry(await geometry(page),beforePay,'Payment replaces form with receipt',{outer:false});
  // A real save adds the global status banner, so establish its new outer-shell
  // baseline; later service-only navigation must preserve it exactly.
  baseline=await geometry(page);camera=await mapCameraSnapshot(page,f.cameraIds);
  await replayHandlers(page,paidHandlers);await stable('Repeated saved payment callbacks',{bytes:paidBytes});await screenshot('paid-receipt');
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('.expense-receipt').waitFor();
  await selected(page,'ship-expenses');await unchanged('Receipt reload',paidBytes);sameGeometry(await geometry(page),baseline,'Receipt reload screen dimensions',{outer:false});
  baseline=await geometry(page);camera=await mapCameraSnapshot(page,f.cameraIds);
  await header(page,'ship-expenses').click();await selected(page,'world');await unlocked(page);await stable('Paid receipt toggles to World data',{bytes:paidBytes});
  for(const name of names){
   await header(page,name).click();await selected(page,name);await stable('Paid campaign opens '+name,{bytes:paidBytes});
   await header(page,name).click();await selected(page,'world');await stable('Paid campaign closes '+name,{bytes:paidBytes});
  }
  await header(page,'ship-expenses').click();await openMortgage(page);await click(page,'expense-receipt');await page.locator('.expense-receipt').waitFor();
  assert.equal(await page.locator('.expense-receipt').getAttribute('data-receipt-id'),paid.ledger[0].id,'Original paid receipt is still available');
  await header(page,'refuel').click();await selected(page,'refuel');await replayHandlers(page,paidHandlers);await stable('Paid receipt switches directly to fuel',{bytes:paidBytes});
  await header(page,'refuel').click();await selected(page,'world');await unlocked(page);
  assert.deepEqual(errors,[],'No uncaught browser errors');result.pass=true;console.log('PASS: fixed service navigation, draft lifecycle and paid receipts at '+width+'px');
 }catch(error){result.error=String(error.stack||error);await screenshot('failure').catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/service-navigation-'+width+'-trace.zip'});await context.close();}
}

async function main(){
 await mkdir(artifacts,{recursive:true});
 const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
 const report={pass:false,commit:process.env.TRAVELLER_COMMIT||null,widths,results:[]};
 try{for(const width of widths)await runWidth(browser,width,report);report.pass=true;console.log('PASS: stable Map/MFD frames, direct and repeated navigation, accessible toggles, internal scrolling, abandoned drafts and immutable confirmed payments.');}
 finally{await writeFile(artifacts+'/service-navigation-report.json',JSON.stringify(report,null,2));await browser.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
