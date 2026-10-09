// Standalone: TRAVELLER_TEST_URL=http://127.0.0.1:8766/ node verification/gui-parity.test.mjs [playwright-module]
// The API is fully intercepted. All comparisons use the campaign's original
// serialized bytes, so harmless-looking revision/normalization writes fail too.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {overviewGeometry} from './overview-layout.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const tabs=['Overview','Trade','Cargo','Contracts','Accounts','History','Settings'];
// 640×400 additionally checks the CSS space available to a 1280×800 window at
// 200% zoom. This is a reduced-viewport equivalent, not genuine browser zoom.
const sizes=[{width:1440,height:1100},{width:2160,height:1200},{width:3200,height:1600},{width:1280,height:800},{width:768,height:1024},{width:390,height:844},{width:320,height:740},{width:844,height:390},{width:640,height:400}];
let activeContext=null,releasePending=()=>{};
async function deadline(promise,label){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),10000);})]);}finally{clearTimeout(timer);}
}

async function run(stops){
 const fixture=guiFixture(stops),errors=[],unexpected=[];
 const targetId=fixture.state.route[fixture.state.routeIndex+1];
 const ctx=activeContext=await browser.newContext({viewport:sizes[0]});
 ctx.setDefaultTimeout(10000);
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 await ctx.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:fixture.bytes});
 let gate=null;
 const reply=async route=>{
  const url=new URL(route.request().url());assert.equal(url.searchParams.get('milieu'),'M1105');
  if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
  if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
  if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
  if(url.pathname.endsWith('/jumpworlds')){
   const pending=gate;
   if(pending&&!pending.claimed&&pending.match(url)){
    pending.claimed=true;pending.started();await pending.wait;
    try{await route.fulfill(pending.fail?{status:503,body:'Deterministic late failure'}:{json:{Worlds:fixture.apiWorlds}});}finally{pending.finished();}
    return;
   }
   const worlds=url.searchParams.get('jump')==='0'?fixture.apiWorlds.filter(w=>url.searchParams.has('hex')?w.Hex===url.searchParams.get('hex'):w.WorldX===Number(url.searchParams.get('x'))&&w.WorldY===Number(url.searchParams.get('y'))):fixture.apiWorlds;
   return route.fulfill({json:{Worlds:worlds}});
  }
  unexpected.push(url.href);return route.abort();
 };
 await ctx.route('https://travellermap.com/api/**',reply);
 function holdRequest({fail=false,match=()=>true}={}){
  assert.equal(gate,null,'Only one deliberate request gate at a time');
  let release,started,finished;
  const wait=new Promise(r=>release=r),start=new Promise(r=>started=r),done=new Promise(r=>finished=r);
  gate={wait,started,finished,release,fail,match,claimed:false};releasePending=release;
  return {start:deadline(start,'Expected gated API request'),done,release};
 }
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 const action=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]'));
 const click=async(name,arg)=>action(name,arg).filter({visible:true}).first().click();
 const tab=name=>page.locator('#tabs [data-action="tab"][data-arg="'+name+'"]').click();
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
 let expectedBytes=fixture.bytes;
 const unchanged=async label=>assert.equal(await raw(),expectedBytes,label+' must not write campaign bytes');
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
 async function release(pending){pending.release();await deadline(pending.done,'Gated API response');gate=null;releasePending=()=>{};await frames();}
 const current=async()=>{await click('world',fixture.state.actual);await frames();};
 async function routeMenu(){
  const details=page.locator('details#route-menu');
  assert.equal(await details.count(),1,'Route is a native details disclosure');
  if(!await details.evaluate(el=>el.open)){await details.locator('summary').focus();await page.keyboard.press('Enter');}
  assert.equal(await details.evaluate(el=>el.open),true);
  return details;
 }
 async function geometry(){return overviewGeometry(page,{markers:true});}
 async function shellReadability(){
  const layout=await page.evaluate(()=>{
   const main=document.querySelector('main'),panel=document.querySelector('.navigation-layout'),tabs=document.querySelector('#tabs'),ship=document.querySelector('#ship-actions > .ship-actions');
   const box=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,overflow:el.scrollWidth-el.clientWidth};};
   const style=getComputedStyle(main),contentLeft=main.getBoundingClientRect().left+parseFloat(style.paddingLeft);
   const textSelectors=['.world-info strong','.screen-section-heading>.mono','.screen-title>.tag','.world-info .badge-row span','.world-actions button','.world-actions .help','.jump-bar button','.jump-bar .help','.map-hint summary','.map-hint p'];
   return {viewport:innerWidth,screen:box(document.querySelector('.mfd-screen')),main:box(main),panel:box(panel),tabs:box(tabs),firstTab:box(tabs.querySelector('button')),shipLeft:ship.getBoundingClientRect().left+parseFloat(getComputedStyle(ship).paddingLeft),contentLeft,text:textSelectors.map(selector=>({selector,nodes:[...document.querySelectorAll(selector)].map(el=>({font:parseFloat(getComputedStyle(el).fontSize),...box(el)}))})),blocks:['.world-info','.world-actions','.jump-bar','.map-hint'].map(selector=>({selector,...box(document.querySelector(selector))}))};
  });
  assert.ok(Math.abs(layout.firstTab.left-layout.contentLeft)<1,'Overview tab shares the main content left gutter');
  assert.ok(Math.abs(layout.panel.left-layout.contentLeft)<1,'Map panel shares the main content left gutter');
  assert.ok(Math.abs(layout.shipLeft-layout.contentLeft)<1,'Ship services share the main content left gutter');
  assert.ok(Math.abs(layout.panel.left-(layout.viewport-layout.panel.right))<2,'Navigation layout is centered in the viewport');
  assert.ok(layout.tabs.overflow<=2,'Tabs wrap within the viewport');
  if(layout.viewport>1880){
   assert.ok(Math.abs(layout.main.width-Math.min(1880,layout.screen.width-2))<2,'Overview fills the available bezel content up to the existing 1880px shell');
   assert.ok(Math.abs(layout.panel.left-(layout.viewport-layout.panel.right))<2,'The working screens keep balanced outer gutters inside the bezel');
  }
  const minimums={'.world-info strong':layout.viewport<=620?20:22,'.screen-section-heading>.mono':16,'.screen-title>.tag':14,'.world-info .badge-row span':layout.viewport<=620?14:15,'.world-actions button':13,'.world-actions .help':13,'.jump-bar button':14,'.jump-bar .help':13,'.map-hint summary':13,'.map-hint p':13};
  for(const {selector,nodes}of layout.text){
   assert.ok(nodes.length,selector+' has readable text to check');
   assert.ok(nodes.every(node=>node.font>=minimums[selector]),selector+' retains larger readable type at every width');
  }
  for(const box of layout.blocks){
   assert.ok(box.overflow<=2,box.selector+' wraps without clipping its larger text');
   assert.ok(box.left>=-1&&box.right<=layout.viewport+1,box.selector+' stays within the viewport');
  }
 }
 async function routeLayout(){
  const zoomHint=page.locator('#map-zoom-hint');
  assert.equal(await zoomHint.textContent(),'Ctrl + scroll to zoom.');
  assert.equal(await zoomHint.isVisible(),true,'The zoom gesture is visible at every viewport');
  assert.equal(await page.locator('.world-map').getAttribute('aria-describedby'),'map-zoom-hint');
  const hintBox=await zoomHint.evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,overflow:el.scrollWidth-el.clientWidth,font:parseFloat(getComputedStyle(el).fontSize),width:innerWidth};});
  assert.ok(hintBox.font>=12&&hintBox.overflow<=2&&hintBox.left>=-1&&hintBox.right<=hintBox.width+1,'The short gesture label stays readable and unclipped');
  const jump=page.locator('.route-next [data-action="jump"]');
  assert.equal(await page.locator('[data-action="jump"]').count(),1,'The top action replaces the old duplicate jump control');
  assert.equal(await jump.textContent(),'Jump to '+fixture.state.worlds[targetId].name+' →');
  assert.equal(await jump.isDisabled(),false);
  assert.equal(await page.locator('.next-destination strong').textContent(),fixture.state.worlds[targetId].name);
  const nextLayout=await page.locator('.route-next').evaluate(container=>{
   const box=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,overflow:el.scrollWidth-el.clientWidth};};
   const destination=container.querySelector('.next-destination'),name=destination.querySelector('strong');
   return {viewport:innerWidth,container:box(container),destination:box(destination),name:box(name),jump:box(container.querySelector('[data-action="jump"]'))};
  });
  assert.ok(nextLayout.destination.overflow<=2&&nextLayout.name.overflow<=2,'The full next-world name wraps without horizontal clipping');
  if(nextLayout.viewport>=1100)assert.ok(nextLayout.destination.width>=129,'Desktop next destination keeps at least 130px of readable width');
  if(nextLayout.viewport<=620){
   assert.ok(nextLayout.jump.top>=nextLayout.destination.bottom-1,'Mobile next destination sits above its Jump button');
   assert.ok(Math.abs(nextLayout.destination.width-nextLayout.container.width)<=2,'Mobile next destination uses the full route-control width');
   assert.ok(Math.abs(nextLayout.jump.width-nextLayout.container.width)<=2,'Mobile Jump uses the full route-control width');
  }

  assert.equal(await page.locator('.route-list [aria-current="location"]').getAttribute('data-arg'),fixture.state.actual);
  assert.equal(await page.locator('.route-list button.next').getAttribute('data-arg'),targetId);
  const header=await page.locator('.route-heading').evaluate(el=>{
   const list=el.nextElementSibling,b=el.getBoundingClientRect();
   return {bottom:b.bottom,listTop:list.getBoundingClientRect().top,overflow:el.scrollWidth-el.clientWidth,parts:[...el.querySelectorAll('.route-jump,.route-next,.next-destination,button')].map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,overflow:n.scrollWidth-n.clientWidth};}),width:innerWidth};
  });
  assert.ok(header.bottom<=header.listTop+1,'Next destination and jump sit above the wrapped route');
  assert.ok(header.overflow<=2,'Route heading stays within the panel');
  for(const part of header.parts){assert.ok(part.overflow<=2,'Next-jump content wraps without clipping');assert.ok(part.left>=-1&&part.right<=header.width+1,'Next-jump content stays in the viewport');}
  const items=page.locator('.route-list [data-action="world"]');assert.equal(await items.count(),stops);
  const layout=await page.locator('.route-list').evaluate(list=>{
   const b=list.getBoundingClientRect();
   return {width:b.width,scrollWidth:list.scrollWidth,clientWidth:list.clientWidth,items:[...list.querySelectorAll('[data-action="world"]')].map(button=>{
    const box=button.getBoundingClientRect(),parent=button.parentElement,p=parent.getBoundingClientRect();
    const arrow=[...parent.children].find(el=>el!==button&&/^[›→]$/.test(el.textContent.trim()));
    const a=arrow?.getBoundingClientRect();
    return {text:button.textContent,top:box.top,left:box.left,right:box.right,bottom:box.bottom,scroll:button.scrollWidth,client:button.clientWidth,parentIsList:parent===list,parentTop:p.top,parentBottom:p.bottom,arrow:a?{top:a.top,bottom:a.bottom,left:a.left,right:a.right}:null};
   })};
  });
  assert.ok(layout.scrollWidth<=layout.clientWidth+2,'Saved route wraps within its own available width');
  assert.ok(new Set(layout.items.map(x=>Math.round(x.top))).size>1,'Long routes exercise multiple wrapped rows');
  for(const [index,item]of layout.items.entries()){
   assert.ok(item.text.startsWith((index+1)+'. '),'Route preserves stop numbering');
   assert.ok(item.scroll<=item.client+2,'Long route labels are neither clipped nor horizontally overflowing');
   if(index<stops-1){
    assert.equal(item.parentIsList,false,'A source stop and its outgoing arrow share a wrapping item');
    assert.ok(item.arrow,'Each source except the final stop has its own associated outgoing arrow');
    assert.ok(item.arrow.top<item.bottom&&item.arrow.bottom>item.top,'Arrow stays on the source row');
   }
  }
 }
 async function dismiss(method){
  if(method==='Escape')await page.keyboard.press('Escape');
  else await page.locator(method==='Close'?'#modal-close':'#modal-cancel').click();
  await closed();await unchanged(method+' dialog dismissal');
 }
 async function invalidExpenses(){
  await tab('Accounts');await click('ship-expenses');await page.locator('#modal').waitFor({state:'visible'});
  for(const checkbox of await page.locator('#modal input[name^="include-"]').all())if(await checkbox.isChecked())await checkbox.uncheck();
  assert.equal(await page.locator('#modal-submit').isDisabled(),true,'Invalid replacement expenses cannot submit');
 }
 async function locationPreview(){
  await tab('Overview');await current();
  await action('map-world',targetId).press('Enter');
  await click('set-location');await page.locator('#modal [name="reason"]').fill('Cancelled synthetic parity check');
 }
 try{
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('#tabs [data-action="tab"]').allTextContents(),tabs);
  assert.equal(await page.locator('.overview-cargo').count(),1,'Overview owns the compact cargo table');
  assert.equal(await page.locator('#market-search').count(),0,'Full supplier trading belongs on Trade');
  await unchanged('Initial shell');
  const serviceStyles=await page.locator('.ship-actions > button').evaluateAll(buttons=>buttons.map(button=>{const s=getComputedStyle(button);return {action:button.dataset.action,style:{background:s.background,color:s.color,border:s.borderColor}};}));
  assert.equal(serviceStyles.length,4,'Four direct shortcuts include Cargo Hold; Port costs remains inside Expenses');
  assert.deepEqual(serviceStyles.map(item=>item.action),['refuel','refill-support','cargo-hold','ship-expenses']);
  assert.ok(serviceStyles.filter(item=>item.action!=='cargo-hold').every(item=>JSON.stringify(item.style)===JSON.stringify(serviceStyles[0].style)),'Ship expenses uses the same primary colors as the other ship services');
  const compactRows=await page.locator('.overview-cargo tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(td=>td.textContent)));
  const recordedAudit=fixture.state.lots[0].audit.price.audit;
  const recordedDM=recordedAudit.skill+recordedAudit.localDM-recordedAudit.counterparty+recordedAudit.purchase.selected-recordedAudit.sale.selected;
  assert.deepEqual(compactRows[0].slice(3,7),['lot-recorded','12',(recordedDM>=0?'+':'')+recordedDM,recordedAudit.percent+'%'],'Compact cargo uses the original recorded price total, DM and percent');
  assert.deepEqual(compactRows[1].slice(3,7),['lot-legacy','11','Not recorded','Not recorded'],'Legacy total-only purchase does not gain invented DMs or a percentage');
  assert.deepEqual(compactRows[2].slice(3,7),['lot-opening','Not recorded','Not recorded','Not recorded'],'Opening cargo does not gain invented negotiation inputs');
  for(const size of sizes){
   await page.setViewportSize(size);await geometry();await shellReadability();await routeLayout();
   if(size.width===320){
    const longId=fixture.state.route[2];
    await page.locator('.route-list [data-action="world"][data-arg="'+longId+'"]').click();
    assert.equal(longId,targetId,'The long browsed label also labels the next jump button');
    const overflow=await page.locator('.navigation-layout').evaluate(panel=>{
     const result={page:document.documentElement.scrollWidth-innerWidth};
     for(const selector of ['.world-info','.map-caption','.route-next [data-action="jump"]']){
      const el=panel.querySelector(selector),b=el.getBoundingClientRect();
      result[selector]={excess:el.scrollWidth-el.clientWidth,right:b.right,left:b.left};
     }
     return result;
    });
    assert.ok(overflow.page<=2,'Long browsed world must not widen a 320px page');
    for(const [selector,box]of Object.entries(overflow).filter(([key])=>key!=='page')){
     assert.ok(box.excess<=2,selector+' wraps its full unbroken label');
     assert.ok(box.left>=-1&&box.right<=321,selector+' stays in the viewport');
    }
    await shellReadability();
    await unchanged('Long world browse and next-jump label at 320px');
    await page.screenshot({path:artifacts+`/gui-parity-${stops}-320-long-world.png`,fullPage:true});
    await current();await geometry();
   }
   await page.screenshot({path:artifacts+`/gui-parity-${stops}-${size.width}.png`,fullPage:true});
   await unchanged('Responsive resize '+size.width);
  }
  await page.setViewportSize(sizes[0]);await geometry();
  for(const name of tabs){await tab(name);assert.equal(await page.locator('#tabs [data-action="tab"].active').textContent(),name);assert.equal(await page.locator('#ship-actions [data-action=\"refuel\"]:visible').count(),name==='Overview'?1:0,'Ship services stay on Overview');await unchanged(name+' tab');}
  await tab('Overview');
  const menu=await routeMenu();await page.keyboard.press('Escape');
  assert.equal(await menu.evaluate(el=>el.open),false,'Escape closes the Route disclosure');
  assert.equal(await page.locator('#route-menu summary').evaluate(el=>el===document.activeElement),true,'Escape returns focus to Route');
  await routeMenu();await page.keyboard.press('Space');assert.equal(await menu.evaluate(el=>el.open),false,'Space toggles native summary');
  await unchanged('Route keyboard disclosure');
  for(const selector of ['.hold-details>summary','.map-hint>summary']){
   const summary=page.locator(selector);await summary.press('Enter');
   assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
   await summary.press('Space');assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
   await unchanged(selector+' read-only disclosure');
  }
  assert.equal(await page.locator('[name="quickFuelType"]').count(),0,'Fuel source is selected only in the Refuel screen');
  await click('refuel');await click('service-adjust');
  await page.locator('[name="fuelType"]').selectOption('unrefined');
  await page.locator('[name="fuelType"]').selectOption('refined');
  await unchanged('Fuel-quality screen choice');await click('service-cancel');await page.locator('#service-panel').waitFor({state:'hidden'});await unchanged('Fuel cancellation');
  // The relocated shortcut preserves every existing jump dismissal path and
  // cannot move the ship simply because another route stop is being browsed.
  await click('world',fixture.state.route.at(-1));
  for(const method of ['Cancel','Close','Escape']){
   await click('jump');
   if(method==='Cancel'){const prepared=JSON.parse(await raw());assert.equal(prepared.jumpAttempts.length,1);const material=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['revision','jumpAttempts','events'].includes(k)));assert.deepEqual(material(prepared),material(fixture.state),'Preparing jump saves only its dice and revision');assert.deepEqual(prepared.events.slice(0,-1),fixture.state.events);assert.equal(prepared.events.at(-1).label,'Jump roll prepared');expectedBytes=await raw();}
   assert.equal(await page.locator('#modal-title').textContent(),'Commit jump · '+fixture.state.worlds[fixture.state.actual].name+' → '+fixture.state.worlds[targetId].name);
   assert.equal(await page.locator('#modal-submit').textContent(),'COMMIT JUMP');
   await page.locator('#modal [name="hours"]').fill('160');await dismiss(method);
   assert.ok((await page.locator('.world-info').textContent()).includes(fixture.state.worlds[fixture.state.route.at(-1)].name),'Cancelling keeps the browsed world');
  }
  await current();

  // Browse is not travel. Keyboard activation and the persistent ship position
  // are verified independently; no mutation button is submitted here.
  await action('map-world',targetId).locator('circle').click();await unchanged('Pointer world browsing');await current();
  await action('map-world',targetId).press('Enter');
  await page.waitForFunction(name=>document.querySelector('.world-info')?.textContent.includes(name),fixture.state.worlds[targetId].name);
  assert.ok((await page.locator('#summary').textContent()).includes(fixture.state.worlds[fixture.state.actual].name));
  assert.equal(JSON.parse(await raw()).actual,fixture.state.actual);
  await tab('Trade');assert.equal(await page.locator('.purchase-table tbody tr').count(),0,'Browsing another world does not show the actual world supplier');
  await tab('Overview');await current();
  assert.equal(await page.locator('#map-hexes').count(),0,'Hexes remain available without a toolbar toggle');
  for(const control of ['#map-uwp','#map-territories']){
   const before=await page.locator(control).isChecked();await page.locator(control).setChecked(!before);await page.locator(control).setChecked(before);await unchanged(control+' view filter');
  }
  await click('map-zoom-in');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent!=='100%');
  await click('map-zoom-reset');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%');
  await geometry();
  // Real wheel input: ordinary scrolling leaves map scale alone; Ctrl+wheel
  // zooms only the map without moving the page. Do not synthesize a DOM event.
  await page.setViewportSize({width:1280,height:800});await geometry();
  const hoverMap=async()=>{
   // Scrolling can trigger a map redraw. Locator hover re-resolves a detached
   // SVG rather than sending the wheel to a stale element's zero-size bounds.
   await page.locator('.world-map').hover();await frames();
  };
  await hoverMap();const plainScroll=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,160);
  await page.waitForFunction(before=>scrollY>before,plainScroll);await frames();
  assert.equal(await page.locator('.map-zoom-controls .help').textContent(),'100%','Plain wheel scroll never zooms the map');
  await hoverMap();const ctrlScroll=await page.evaluate(()=>scrollY);
  await page.keyboard.down('Control');
  try{await page.mouse.wheel(0,-150);await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent!=='100%');}finally{await page.keyboard.up('Control');}
  await frames();assert.equal(await page.evaluate(()=>scrollY),ctrlScroll,'Ctrl+wheel zoom leaves page scroll unchanged');
  await unchanged('Plain wheel scroll and intentional Ctrl+wheel map zoom');
  await click('map-zoom-reset');await page.waitForFunction(()=>document.querySelector('.map-zoom-controls .help')?.textContent==='100%');
  await page.setViewportSize(sizes[0]);await geometry();
  const pan=await page.locator('.world-map').evaluate(svg=>{svg.scrollIntoView({block:'center',behavior:'instant'});const b=svg.getBoundingClientRect();return {x:b.x+b.width*.55,y:b.y+b.height*.55,before:svg.querySelector('.map-content').getAttribute('transform')};});
  await page.mouse.move(pan.x,pan.y);await page.mouse.down();await page.mouse.move(pan.x+45,pan.y+25,{steps:8});await page.mouse.up();
  await page.waitForFunction(before=>document.querySelector('.map-content')?.getAttribute('transform')!==before,pan.before);
  await geometry();await unchanged('Map pan');await click('map-zoom-reset');await frames();await current();

  await routeMenu();await click('route-build');
  assert.equal(await action('jump').isDisabled(),true,'Draft planning cannot jump');
  assert.match(await page.locator('#route-jump-help').textContent(),/Finish or cancel route planning/);
  const origin=fixture.state.worlds[fixture.state.actual],emptyId=origin.x+','+(origin.y-2);
  assert.ok(!fixture.apiWorlds.some(w=>w.WorldX===origin.x&&w.WorldY===origin.y-2),'Keyboard empty-hex fixture is genuinely empty');
  await action('map-empty',emptyId).press('Space');
  await page.locator('.route-draft').getByText(/Empty hex/).first().waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);
  await unchanged('Empty-hex keyboard planning');await click('route-cancel');
  await routeMenu();await click('route-build');await action('map-world',emptyId).click();
  await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);await unchanged('Cached empty-space marker remains selectable');await click('route-cancel');
  const pointerEmptyId=origin.x+','+(origin.y-1);
  assert.ok(!fixture.apiWorlds.some(w=>w.WorldX===origin.x&&w.WorldY===origin.y-1),'Pointer empty-hex fixture is genuinely empty');
  await routeMenu();await click('route-build');await action('map-empty',pointerEmptyId).click();
  await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);
  await geometry();await unchanged('Empty-hex pointer planning');await click('route-cancel');
  await routeMenu();await click('route-build');await action('map-world',targetId).press('Space');
  await page.waitForFunction(()=>document.querySelector('[data-action="route-save"]')?.disabled===false);await unchanged('World keyboard planning');await click('route-cancel');

  // The compact cargo links use the same original detailed audit flows. Missing
  // dice are deliberately absent in two fixture lots and must stay absent.
  for(const [id,pattern]of [['lot-recorded',/2 \+ 4 \+ 6 = 12/],['lot-legacy',/Entered total: 11 \(individual dice not recorded\)/],['lot-opening',/no dice or modifiers are inferred from its cost basis/]]){
   await page.locator('.overview-cargo [data-action="lot-audit"][data-arg="'+id+'"]').click();
   const body=await page.locator('#modal-body').textContent();assert.match(body,pattern);
   if(id==='lot-opening')assert.doesNotMatch(body,/3D price roll|2 \+ 4 \+ 6/);
   await dismiss('Close');
  }
  await tab('Trade');assert.equal(await page.locator('#market-search').count(),1);
  await page.locator('#market-search').fill('Legacy');assert.equal(await page.locator('.purchase-table tbody tr').count(),1);
  await page.locator('#market-search').fill('');await page.locator('#market-filter').selectOption('all');
  await page.locator('[data-action="offer-audit"][data-arg="offer-recorded"]').click();assert.match(await page.locator('#modal-body').textContent(),/2 \+ 4 \+ 6 = 12/);await dismiss('Escape');
  await tab('Cargo');await page.locator('#cargo-search').fill('Legacy');assert.equal(await page.locator('.cargo-table tbody tr').count(),1);await page.locator('#cargo-search').fill('');await page.locator('#cargo-sort').selectOption('quantity');
  await tab('History');await click('history-filter','Trade');await click('history-filter','All');await click('event-audit','event-setup');await dismiss('Cancel');
  await tab('Accounts');await click('ledger-audit','ledger-opening');await dismiss('Close');await unchanged('Trading, cargo and history filters and audit views');
  await tab('Overview');await current();

  // Fuel/LSS now own the right screen; accounting retains its modal lifecycle.
  for(const [name,method]of [['refuel','Escape'],['refill-support','Cancel']]){
   await click(name);await page.locator('#service-panel').waitFor({state:'visible'});
   if(method==='Escape')await page.keyboard.press('Escape');else await click('service-back');
   await page.locator('#service-panel').waitFor({state:'hidden'});await unchanged(name+' '+method);
  }
  await click('ship-expenses');await page.locator('#expense-panel').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Port costs ›',exact:true}).click();
  await click('expense-back');await click('expense-close');await unchanged('Expenses and Port costs navigation');
  await tab('Accounts');await click('ship-expenses');await page.locator('#modal').waitFor({state:'visible'});await dismiss('Cancel');await tab('Overview');
  if(stops===12){
   // A delayed nearby response after leaving Overview must not repopulate Trade
   // or retain the old desktop geometry when Overview is mounted again.
   let pending=holdRequest({match:url=>url.searchParams.get('x')===String(origin.x)&&url.searchParams.get('y')===String(origin.y)});
   await click('nearby');await pending.start;await tab('Trade');await page.setViewportSize(sizes.find(size=>size.width===390));await release(pending);
   assert.equal(await page.locator('.world-map').count(),0);await tab('Overview');await geometry();await unchanged('Resize with pending map request and tab round trip');
   await page.setViewportSize(sizes[0]);await geometry();
   for(const method of ['Cancel','Close','Escape']){
    await locationPreview();pending=holdRequest({match:url=>url.searchParams.get('x')===String(fixture.state.worlds[targetId].x)});
    await page.locator('#modal-submit').click();await pending.start;
    assert.equal(await page.locator('#modal-submit').isDisabled(),true);await page.locator('#modal-form').evaluate(form=>form.requestSubmit());
    await dismiss(method);await invalidExpenses();await release(pending);
    assert.equal(await page.locator('#modal-title').textContent(),'Ship expenses');assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.equal(await page.locator('#modal-error').textContent(),'');await dismiss('Cancel');
   }
   await locationPreview();pending=holdRequest({fail:true,match:url=>url.searchParams.get('x')===String(fixture.state.worlds[targetId].x)});
   await page.locator('#modal-submit').click();await pending.start;await dismiss('Cancel');await invalidExpenses();await release(pending);assert.equal(await page.locator('#modal-error').textContent(),'');await dismiss('Cancel');
   await locationPreview();pending=holdRequest({match:url=>url.searchParams.get('x')===String(fixture.state.worlds[targetId].x)});
   await page.locator('#modal-submit').click();await pending.start;
   const second=await ctx.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(base);await second.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await second.locator('#takeover').click();
   await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();assert.equal(await page.locator('#modal-submit').isDisabled(),true);await release(pending);
   assert.equal(await page.locator('#modal-submit').isDisabled(),true);await unchanged('Ownership handoff during modal request');await dismiss('Cancel');
   await tab('Overview');await current();await action('map-world',targetId).press('Enter');await unchanged('Read-only browsing');
   assert.equal(await action('set-location').isDisabled(),true);assert.equal(await action('jump').isDisabled(),true,'Read-only browsing never enables travel');
   await page.locator('.overview-cargo [data-action="lot-audit"]').first().click();await dismiss('Close');
   await second.close();await page.locator('#takeover').click();await page.getByText('Editing in this tab',{exact:true}).waitFor();await unchanged('Editing reacquisition');
  }
  assert.deepEqual(unexpected,[],'No API endpoint is accidentally live');assert.deepEqual(errors,[],'No uncaught browser errors');
  await unchanged('Final GUI parity');
  console.log(`PASS: ${stops}-stop deterministic GUI parity at ultrawide, desktop, tablet, mobile, 320px, landscape and reduced-viewport zoom equivalent; aligned gutters, readable map details, keyboard, map geometry, browsing, audits, filters and modal guards.`);
 }finally{
  gate?.release();await ctx.tracing.stop({path:artifacts+`/gui-parity-${stops}-trace.zip`});await ctx.close();activeContext=null;releasePending=()=>{};
 }
}
try{await run(12);await run(30);}finally{releasePending();await activeContext?.close();await browser.close();}
