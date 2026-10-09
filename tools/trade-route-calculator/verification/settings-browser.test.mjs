// Standalone deterministic Chromium regression for the compact Settings page.
// TRAVELLER_TEST_URL=http://127.0.0.1:8765/ node verification/settings-browser.test.mjs [playwright-module]
// Only synthetic campaigns and intercepted Traveller Map responses are used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';

const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const fieldNames=[
 'name','ship','capacity','jump','broker','streetwise','admin','characteristic','rank','soc','mode','custom',
 'shipTons','fuelCapacity','bladderJumps','fuelAboard',
 'rooms-low','roomService-low','roomCustom-low','rooms-middle','roomService-middle','roomCustom-middle','rooms-high','roomService-high','roomCustom-high',
 'people-middle','people-high','occupiedLowBerths','luggageOverride','luggageTons','supportCapacity','supportRemaining','supportUnits',
 'creditStep','scoops','armed','reducedProfitLimitsEnabled','minPurchasePercent','maxSalePercent',
 'maxBaseRetailEnabled','maxBaseRetail','useRawIllegalPrices','tax','insurance'
];
assert.equal(fieldNames.length,44);
assert.equal(new Set(fieldNames).size,44);
const draft={
 name:'Compact Settings verification',ship:'Synthetic Settings Trader',capacity:'160',jump:'3',
 broker:'3',streetwise:'2',admin:'1',characteristic:'-1',rank:'4',soc:'2',mode:'custom',custom:'62.5',
 shipTons:'300',fuelCapacity:'60',bladderJumps:'1',fuelAboard:'65',
 'rooms-low':'1','roomService-low':'custom','roomCustom-low':'200',
 'rooms-middle':'5','roomService-middle':'custom','roomCustom-middle':'1300',
 'rooms-high':'2','roomService-high':'custom','roomCustom-high':'1700',
 'people-middle':'6','people-high':'3',occupiedLowBerths:'2',luggageOverride:true,luggageTons:'7',supportCapacity:'35',supportRemaining:'13.75',supportUnits:'',
 creditStep:'100',scoops:false,armed:true,reducedProfitLimitsEnabled:true,minPurchasePercent:'90',maxSalePercent:'110',
 maxBaseRetailEnabled:true,maxBaseRetail:'50000',useRawIllegalPrices:true,tax:true,insurance:true
};
assert.deepEqual(Object.keys(draft).sort(),[...fieldNames].sort(),'Every preserved setting has an explicit edited value');
let activeContext=null,activePage=null;

async function start(size,{untrackedFuel=false}={}){
 const fixture=guiFixture();
 // Six used hours are part of the next whole supply day, not six extra days.
 fixture.state.ship.lifeSupport.elapsedHours=6;
 if(untrackedFuel)delete fixture.state.ship.fuel;
 validate(fixture.state);fixture.bytes=JSON.stringify(fixture.state);
 const context=activeContext=await browser.newContext({viewport:size,acceptDownloads:true});
 context.setDefaultTimeout(10000);
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes,origin})=>{
  // Blank/download documents have opaque origins and no localStorage access.
  // Seed only the served application, while retaining all application errors.
  if(location.origin===origin&&!localStorage.getItem(key))localStorage.setItem(key,bytes);
 },{key:campaignKey,bytes:fixture.bytes,origin:new URL(base).origin});
 const errors=[],unexpected=[];
 await context.route('https://travellermap.com/api/**',route=>{
  const url=new URL(route.request().url());
  assert.equal(url.searchParams.get('milieu'),'M1105');
  if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
  if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
  if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
  if(url.pathname.endsWith('/jumpworlds')){
   const worlds=url.searchParams.get('jump')==='0'?fixture.apiWorlds.filter(w=>url.searchParams.has('hex')?w.Hex===url.searchParams.get('hex'):w.WorldX===Number(url.searchParams.get('x'))&&w.WorldY===Number(url.searchParams.get('y'))):fixture.apiWorlds;
   return route.fulfill({json:{Worlds:worlds}});
  }
  unexpected.push(url.href);return route.abort();
 });
 context.on('page',page=>{
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{
   if(message.type()==='error'&&/invalid form control.*not focusable/i.test(message.text()))errors.push(message.text());
  });
 });
 const page=activePage=await context.newPage();
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
 const read=async()=>JSON.parse(await raw());
 const tab=name=>page.locator('#tabs [data-action="tab"][data-arg="'+name+'"]').click();
 const field=name=>page.locator('#settings-form [name="'+name+'"]');
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const values=()=>page.locator('#settings-form [name]').evaluateAll(fields=>Object.fromEntries(fields.map(el=>[el.name,el.type==='checkbox'?el.checked:el.value])));
 async function reveal(target){
  // Native disclosure clicks, outside-in, exercise the same affordance as a user.
  for(const detail of await target.locator('xpath=ancestor::details').all()){
   if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
  }
 }
 async function set(name,value){
  const el=field(name);await reveal(el);
  if(typeof value==='boolean')await el.setChecked(value);
  else if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(value);
  else await el.fill(value);
 }
 async function setDraft(){for(const [name,value]of Object.entries(draft))await set(name,value);}
 async function openAll(){
  for(const detail of await page.locator('#settings-form details').all()){
   if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
  }
 }
 async function unchanged(bytes,label){assert.equal(await raw(),bytes,label+' must not write campaign bytes');}
 async function action(name){const target=page.locator('#main [data-action="'+name+'"]').first();await reveal(target);await target.click();}
 async function dismiss(){await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});}
 async function finish(label){
  assert.deepEqual(errors,[],'No runtime errors or unfocusable invalid controls');
  assert.deepEqual(unexpected,[],'All map requests use explicit fixtures');
  await context.tracing.stop({path:artifacts+'/settings-'+label+'-trace.zip'});
  await context.close();activeContext=null;activePage=null;
 }
 return {fixture,context,page,raw,read,tab,field,frames,values,reveal,set,setDraft,openAll,unchanged,action,dismiss,finish};
}

async function layout(page,label){
 const boxes=await page.evaluate(()=>{
  const form=document.querySelector('#settings-form');
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  return {viewport:innerWidth,page:document.documentElement.scrollWidth-innerWidth,
   boxes:[form,...form.querySelectorAll('.settings-section,.setting-row,.settings-number,input,select,button')].filter(visible).map(el=>{
    const box=el.getBoundingClientRect();return {name:el.name||el.id||el.className,left:box.left,right:box.right,width:box.width,
     overflow:el.matches('input,select,button')?0:el.scrollWidth-el.clientWidth};
   })};
 });
 assert.ok(boxes.page<=2,label+': page has no horizontal overflow');
 for(const box of boxes.boxes){
  assert.ok(box.width>0,`${label}: ${box.name} is not collapsed to zero width`);
  assert.ok(box.left>=-1&&box.right<=boxes.viewport+1,`${label}: ${box.name} stays within the viewport`);
  assert.ok(box.overflow<=2,`${label}: ${box.name} has no clipped horizontal content`);
 }
}

function savedValues(state,before){
 assert.equal(state.name,draft.name);assert.equal(state.ship.name,draft.ship);
 assert.equal(state.ship.capacity,draft.capacity);assert.equal(state.ship.jump,Number(draft.jump));
 assert.deepEqual(state.trader,{broker:3,streetwise:2,admin:1,characteristic:-1,rank:4,soc:2});
 assert.deepEqual(state.ship.fuel,configureFuel(300,60,65,1,3));
 assert.equal(state.ship.staterooms,8);
 assert.deepEqual(state.ship.accommodation,{
  passengers:{low:0,middle:6,high:3},crew:{low:0,middle:0,high:0},combinedPeople:true,
  rooms:{low:1,middle:5,high:2},roomService:{low:{level:'custom',monthly:'200'},middle:{level:'custom',monthly:'1300'},high:{level:'custom',monthly:'1700'}},
  luggageMode:'manual',luggageTons:'7',occupiedLowBerths:2
 });
 assert.deepEqual(state.ship.lifeSupport,{capacityHours:35*24,stockUnits:{numerator:'55',denominator:'2'}},'Unchanged recorded endurance preserves 27.5 LSS despite a larger complement');
 assert.equal(state.ship.scoops,false);assert.equal(state.ship.armed,true);assert.equal(state.ship.roundTons,true);
 assert.deepEqual(state.settings,{
  ...before.settings,profit:62.5,creditStep:100,reducedProfitLimitsEnabled:true,minPurchasePercent:90,maxSalePercent:110,
  maxBaseRetailEnabled:true,maxBaseRetail:'50000',useRawIllegalPrices:true,tax:true,insurance:true
 });
 for(const key of ['bank','hours','dateLabel','actual','route','routeIndex','lots','contracts','policies','snapshots','ledger','cooldowns']){
  assert.deepEqual(state[key],before[key],'Settings preserve existing '+key);
 }
 assert.equal(state.revision,before.revision+1,'Save creates one revision');
 assert.equal(state.undo.length,before.undo.length+1,'Save creates one undo entry');
 assert.equal(state.undo.at(-1).label,'Ship / trader settings');
}

async function auxiliary(h){
 const {page,raw,unchanged,action,dismiss,reveal}=h,before=await raw();
 await action('settings-edit');await page.getByRole('heading',{name:'Ship, trader & options',exact:true}).waitFor();
 assert.deepEqual((await page.locator('#modal [name]').evaluateAll(fields=>fields.map(el=>el.name))).sort(),[...fieldNames].sort(),'The optional dialog has the same 44 fields');
 await page.locator('#modal [name="mode"]').selectOption('custom');
 assert.equal(await page.locator('#modal [name="custom"]').isDisabled(),false,'Modal mode changes update the modal control');
 assert.equal(await page.locator('#settings-form').count(),0,'The inline form is detached while the optional dialog is open');
 assert.equal(await page.locator('[name="mode"]').count(),1,'No duplicate named controls exist while a modal is open');
 await dismiss();await unchanged(before,'Optional settings dialog cancellation');
 assert.equal(await page.locator('#settings-form [name="custom"]').isDisabled(),true,'Cancelling restores the unchanged inline mode');
 for(const [name,title]of [['time','Campaign time'],['rounding-preview','Preview rounding'],['notes','Rules & Notes']]){
  await action(name);await page.getByRole('heading',{name:title,exact:true}).waitFor();
  if(name==='time'){
   await page.locator('#modal [name="hours"]').fill('96');
   await page.locator('#modal [name="reason"]').fill('Cancelled synthetic time correction');
  }
  await unchanged(before,title+' preview');await dismiss();await unchanged(before,title+' cancellation');
 }
 // Download contents prove both existing backup/report actions remain reachable.
 for(const name of ['export','report']){
  const downloadPromise=page.waitForEvent('download');await action(name);const download=await downloadPromise;
  const path=await download.path();assert.ok(path,name+' creates a local browser download');
  const contents=await readFile(path,'utf8');
  if(name==='export')assert.equal(contents,before,'JSON backup is exactly the stored campaign');
  else{assert.match(download.suggestedFilename(),/\.txt$/);assert.ok(contents.includes(JSON.parse(before).name),'TXT report includes the campaign name');}
  await unchanged(before,name+' download');
 }
 const importButton=page.locator('#main [data-action="import"]');await reveal(importButton);
 const choose=page.waitForEvent('filechooser');await importButton.click();
 await (await choose).setFiles({name:'synthetic-settings-backup.json',mimeType:'application/json',buffer:Buffer.from(before)});
 await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();
 await unchanged(before,'Import preview');await dismiss();await unchanged(before,'Import cancellation');
 await action('reset');await page.getByRole('heading',{name:'Reset campaign',exact:true}).waitFor();
 assert.equal(await page.locator('#modal [name="backed"]').isChecked(),false);
 await dismiss();await unchanged(before,'Reset cancellation');
}

async function staleDraft(h){
 const {page,raw,read,field,set,action,frames,unchanged}=h;
 for(const kind of ['time','settings-edit']){
  const before=await read(),draftName='Unsaved inline draft before '+kind;
  await set('name',draftName);await action(kind);
  assert.equal(await page.locator('#settings-form').count(),0,'A modal detaches the dirty inline form');
  if(kind==='time'){
   await page.locator('#modal [name="hours"]').fill(String(before.hours+24));
   await page.locator('#modal [name="reason"]').fill('Synthetic committed time correction');
  }else{
   await page.locator('#modal [name="name"]').fill('Newer campaign name from the optional dialog');
   await page.locator('#modal [name="ship"]').fill('Newer ship name from the optional dialog');
  }
  await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
  const committed=await read(),bytes=await raw();
  assert.equal(committed.revision,before.revision+1,kind+' commits exactly one new revision');
  assert.equal(committed.name,kind==='time'?before.name:'Newer campaign name from the optional dialog');
  assert.equal(committed.hours,kind==='time'?before.hours+24:before.hours);
  if(kind==='settings-edit')assert.equal(committed.ship.name,'Newer ship name from the optional dialog');
  assert.equal(await field('name').inputValue(),draftName,'The old draft is preserved for review rather than silently overwritten');
  await page.locator('#settings-save').click();await frames();
  assert.match(await page.locator('#settings-error').textContent(),/Campaign changed.*Revert changes/i,'A stale inline draft requires an explicit reload');
  await unchanged(bytes,'Rejected stale draft after '+kind);
  await page.locator('#settings-reset').click();
  assert.equal(await field('name').inputValue(),committed.name,'Revert loads the newer campaign name');
  assert.equal(await field('ship').inputValue(),committed.ship.name,'Revert loads the newer ship name');
  await unchanged(bytes,'Reverting a stale draft');
  const freshName='Rebased settings after '+kind;await set('name',freshName);await page.locator('#settings-save').click();
  const fresh=await read();assert.equal(fresh.revision,committed.revision+1,'A reverted form can commit against the current revision');
  assert.equal(fresh.name,freshName);assert.equal(fresh.hours,committed.hours);assert.equal(fresh.ship.name,committed.ship.name);
  for(const key of ['bank','lots','contracts','snapshots','ledger'])assert.deepEqual(fresh[key],committed[key],'Rebased settings preserve '+key);
  assert.equal(await page.locator('#settings-error').textContent(),'');
 }
}

try{
 for(const size of [{width:1440,height:1100},{width:390,height:844},{width:320,height:740}]){
  const h=await start(size),{fixture,page,context,raw,read,tab,field,frames,values,reveal,set,setDraft,openAll,unchanged}=h;
  await tab('Settings');await page.locator('#settings-form').waitFor();
  assert.equal(await page.locator('#modal[open]').count(),0,'Settings are inline, not a compulsory modal');
  const inventory=await page.locator('#settings-form [name]').evaluateAll(fields=>fields.map(el=>({name:el.name,label:[...(el.labels||[])].map(label=>label.textContent.trim()).join(' '),row:!!el.closest('.setting-row')})));
  assert.deepEqual(inventory.map(x=>x.name).sort(),[...fieldNames].sort(),'All 44 existing fields appear exactly once');
  assert.ok(inventory.every(x=>x.label&&x.row),'Every field has a label and a compact setting row');
  assert.ok(await page.locator('#settings-form .settings-section').count()>1,'Settings are grouped into sections');
  const advanced=page.locator('#settings-form details').filter({has:page.locator('[name]')});
  assert.ok(await advanced.count()>0,'Advanced groups use native details');
  assert.ok((await advanced.evaluateAll(details=>details.map(el=>el.open))).every(open=>!open),'Advanced groups start collapsed');
  const first=advanced.first();await first.locator(':scope > summary').focus();await page.keyboard.press('Enter');
  assert.equal(await first.evaluate(el=>el.open),true,'Advanced controls reveal by keyboard');
  await page.keyboard.press('Enter');assert.equal(await first.evaluate(el=>el.open),false,'Native disclosure closes by keyboard');
  await unchanged(fixture.bytes,'Initial settings and disclosure toggles');
  await layout(page,'collapsed '+size.width);await page.screenshot({path:artifacts+`/settings-collapsed-${size.width}.png`,fullPage:true});
  await openAll();const original=await values();
  for(const name of ['custom','luggageTons','roomCustom-low','roomCustom-middle','roomCustom-high']){
   assert.equal(await field(name).isDisabled(),true,name+' is disabled when its mode is inactive');
   const buttons=field(name).locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," setting-row ")][1]').locator('[data-setting-step]');
   assert.equal(await buttons.count(),2,name+' has a pair of compact steppers');
   assert.ok((await buttons.evaluateAll(nodes=>nodes.map(el=>el.disabled))).every(Boolean),name+' steppers share its disabled state');
  }
  for(const name of ['minPurchasePercent','maxSalePercent'])assert.equal(await field(name).isDisabled(),false,'Price-limit values remain editable while the option is off');
  const switches=page.locator('#settings-form .settings-switch input[type="checkbox"],#settings-form input.settings-switch[type="checkbox"]');
  assert.equal(await switches.count(),8,'All eight boolean options retain native checkbox switches');
  await setDraft();assert.deepEqual(await values(),draft,'All 44 draft controls accept their intended input types');
  // Explicit arrow buttons must preserve direct typing, signed values and the
  // fractional custom profit. A +1 / -1 round trip never silently saves.
  for(const number of await page.locator('#settings-form input[type="number"]').all()){
   if(await number.isDisabled())continue;
   const name=await number.getAttribute('name'),before=Number(await number.inputValue());
   const row=number.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," setting-row ")][1]');
   assert.equal(await row.locator('[data-setting-step]').count(),2,name+' has both step controls');
   await row.locator('[data-setting-step="1"]').click();assert.equal(Number(await number.inputValue()),before+1,name+' increments by one');
   await row.locator('[data-setting-step="-1"]').click();assert.equal(Number(await number.inputValue()),before,name+' decrements by one');
  }
  await unchanged(fixture.bytes,'Typing, switches, selects and every numeric stepper');
  await layout(page,'expanded '+size.width);await page.screenshot({path:artifacts+`/settings-expanded-${size.width}.png`,fullPage:true});
  await page.locator('#settings-reset').click();assert.deepEqual(await values(),original,'Revert restores every control');
  await unchanged(fixture.bytes,'Revert changes');
  await set('name','This draft must not be saved by navigation');await tab('Overview');await tab('Settings');
  await unchanged(fixture.bytes,'Leaving Settings with an uncommitted draft');
  // Prepare a complete valid draft, then prove each invalid path is atomic.
  await setDraft();
  for(const [name,bad]of [['jump','0'],['rooms-middle','1.5'],['minPurchasePercent',''],['minPurchasePercent','90.5'],['maxSalePercent','401'],['maxBaseRetail','0'],['supportRemaining','-1'],['occupiedLowBerths','1.5'],['supportUnits','-1'],['fuelAboard','151'],['shipTons',''],['capacity','1']]){
   await set(name,bad);await page.locator('#settings-save').click();await frames();
   await unchanged(fixture.bytes,'Invalid '+name+' = '+JSON.stringify(bad));
   await set(name,draft[name]);
  }
  // Chromium cannot focus a hidden native-invalid input. The submit path must
  // open its disclosure first, then focus that exact field without a write.
  const hiddenInvalid=field('minPurchasePercent');await set('minPurchasePercent','401');
  const detail=hiddenInvalid.locator('xpath=ancestor::details[1]');assert.equal(await detail.count(),1,'Price limits live in an advanced disclosure');
  await detail.locator(':scope > summary').click();assert.equal(await detail.evaluate(el=>el.open),false);
  await page.locator('#settings-save').click();await frames();
  assert.equal(await detail.evaluate(el=>el.open),true,'Invalid advanced field is revealed');
  assert.equal(await hiddenInvalid.evaluate(el=>document.activeElement===el),true,'The precise invalid field receives focus');
  await unchanged(fixture.bytes,'Collapsed advanced invalid submission');await set('minPurchasePercent',draft.minPurchasePercent);
  await page.locator('#settings-save').click();
  await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision,{key:campaignKey,revision:fixture.state.revision+1});
  let saved=await read();savedValues(saved,fixture.state);
  assert.equal(await page.locator('#modal[open]').count(),0,'Inline save needs no modal');
  const savedBytes=await raw();await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await tab('Settings');
  assert.deepEqual(await values(),{...draft,supportRemaining:'2.98913'},'Saved controls reload while endurance reflects the new 9.2-person-equivalent complement');
  await unchanged(savedBytes,'Reloading the saved settings');
  // Explicitly changing endurance replaces physical stock at the current
  // complement; Undo restores the exact, fractional stock balance.
  await set('supportRemaining','13');await page.locator('#settings-save').click();
  assert.deepEqual((await read()).ship.lifeSupport,{capacityHours:35*24,stockUnits:{numerator:'598',denominator:'5'}});
  await tab('History');await page.locator('#main [data-action="undo"]').click();
  assert.deepEqual((await read()).ship.lifeSupport,saved.ship.lifeSupport,'Undo restores exact partial-day physical supplies');
  await page.locator('#main [data-action="undo"]').click();
  const undone=await read();
  for(const key of ['name','ship','trader','settings','bank','hours','actual','route','lots','contracts','snapshots','ledger'])assert.deepEqual(undone[key],fixture.state[key],'Undo restores original '+key);
  await tab('Settings');assert.deepEqual(await values(),original,'Undo restores all 44 displayed values');
  const beforeReadOnly=await raw(),other=await context.newPage();await other.goto(base);
  await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  await other.locator('#tabs [data-arg="Settings"]').click();
  assert.equal(await other.locator('#settings-save').isDisabled(),true,'Read-only tabs cannot save');
  assert.ok((await other.locator('#settings-form [name]').evaluateAll(fields=>fields.map(el=>el.disabled))).every(Boolean),'Every settings field respects the editing lock');
  assert.ok((await other.locator('#settings-form [data-setting-step]').evaluateAll(buttons=>buttons.map(el=>el.disabled))).every(Boolean),'Read-only steppers cannot edit drafts');
  await other.locator('#settings-form').evaluate(form=>form.requestSubmit());await unchanged(beforeReadOnly,'Programmatic submit in a read-only tab');
  await h.action('settings-edit');assert.equal(await page.locator('#settings-form').count(),0);
  await other.locator('#takeover').click();await other.getByText('Editing in this tab',{exact:true}).waitFor();
  await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
  assert.equal(await page.locator('#modal-submit').isDisabled(),true,'Losing editing ownership cancels an open mutating modal');
  await h.dismiss();
  assert.equal(await page.locator('#settings-save').isDisabled(),true,'The restored settings page is read-only after modal interruption and takeover');
  assert.equal(await page.locator('#settings-reset').isDisabled(),true,'Restored Revert follows the same visible editing lock');
  assert.ok((await page.locator('#settings-form [name]').evaluateAll(fields=>fields.map(el=>el.disabled))).every(Boolean),'Suspended fields regain the correct read-only state');
  await page.locator('#takeover').click();await page.getByText('Editing in this tab',{exact:true}).waitFor();await other.close();
  await unchanged(beforeReadOnly,'Editing ownership transfer');
  if(size.width===1440){await auxiliary(h);await staleDraft(h);}
  await h.finish(String(size.width));
  console.log(`PASS: ${size.width}px exact 44-field parity, compact controls, draft/revert, validation/reveal/focus, atomic save/reload/Undo, partial-day stock and editing locks.`);
 }
 // Same-session blank saves must not produce undefined inverse values that
 // only become invalid when the campaign reaches localStorage or an export.
 for(const size of [{width:1440,height:1100},{width:390,height:844}]){
  const h=await start(size,{untrackedFuel:true}),{page,read,tab,set,field}=h;
  await tab('Settings');
  for(const name of ['shipTons','fuelCapacity','fuelAboard'])assert.equal(await field(name).inputValue(),'');
  const save=async()=>{
   const revision=(await read()).revision;
   await page.locator('#settings-save').click();
   await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).revision===revision+1,{key:campaignKey,revision});
   const state=await read();validate(state);return state;
  };
  const blank=await save();assert.equal(Object.hasOwn(blank.ship,'fuel'),false);
  await set('shipTons','200');await set('fuelCapacity','40');await set('fuelAboard','20');
  const configured=await save();assert.deepEqual(configured.ship.fuel,configureFuel(200,40,20,0,2));
  assert.ok(configured.undo.at(-1).inverse.some(op=>op.path.join('.')==='ship.fuel'&&op.remove===true),'First configuration undoes to absent fuel');
  // A further save catches the previously poisoned Store.read before reload.
  await set('name','Fuel history stays editable');const edited=await save();
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
  assert.equal((await read()).name,edited.name);
  await tab('History');await page.locator('#main [data-action="undo"]').click();
  assert.equal((await read()).name,configured.name);
  await page.locator('#main [data-action="undo"]').click();
  assert.deepEqual((await read()).ship,blank.ship,'Undo after reload restores the complete blank-fuel ship');
  await tab('Settings');
  await set('shipTons','200');await set('fuelCapacity','40');await set('fuelAboard','20');
  const restored=await save();
  for(const name of ['shipTons','fuelCapacity','fuelAboard'])await set(name,'');
  const cleared=await save();assert.equal(Object.hasOwn(cleared.ship,'fuel'),false);
  await set('shipTons','200');await set('fuelCapacity','40');await set('fuelAboard','30');
  await save();
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await tab('History');await page.locator('#main [data-action="undo"]').click();
  assert.deepEqual((await read()).ship,cleared.ship);
  await page.locator('#main [data-action="undo"]').click();
  const undone=await read();assert.deepEqual(undone.ship,restored.ship);
  for(const key of ['bank','hours','lots','contracts','policies','ledger'])assert.deepEqual(undone[key],blank[key],'Fuel edits and Undo preserve '+key);
  await h.finish('fuel-history-'+size.width);
  console.log(`PASS: ${size.width}px blank fuel save/configure, further edit, reload, clear/reconfigure and complete Undo.`);
 }
 // The pre-existing modal is still needed by unconfigured refuelling. It must
 // use the same commit semantics without duplicate inline-form IDs or fields.
 const fallback=await start({width:1440,height:1100},{untrackedFuel:true});
 await fallback.page.locator('#ship-actions [data-action="refuel"]').click();
 await fallback.page.getByRole('heading',{name:'Ship, trader & options',exact:true}).waitFor();
 assert.deepEqual((await fallback.page.locator('#modal [name]').evaluateAll(fields=>fields.map(el=>el.name))).sort(),[...fieldNames].sort(),'Fallback modal retains the same complete settings inventory');
 await fallback.page.locator('#modal [name="shipTons"]').fill('200');
 await fallback.page.locator('#modal [name="fuelCapacity"]').fill('40');
 await fallback.page.locator('#modal [name="fuelAboard"]').fill('20');
 await fallback.page.locator('#modal-submit').click();await fallback.page.locator('#modal').waitFor({state:'hidden'});
 assert.deepEqual((await fallback.read()).ship.fuel,configureFuel(200,40,20,0,2));
 assert.deepEqual((await fallback.read()).ship.lifeSupport.stockUnits,{numerator:'55',denominator:'2'},'Fallback save also preserves 27.5 LSS with six used hours');
 await fallback.finish('fallback');
 console.log('PASS: time/rounding/rules previews, exact JSON/TXT downloads, import/reset cancellation stale-draft rejection/revert and legacy refuel-settings modal.');
}catch(error){
 if(activeContext){
  await activePage?.screenshot({path:artifacts+'/settings-failure.png',fullPage:true}).catch(()=>{});
  await activeContext.tracing.stop({path:artifacts+'/settings-failure-trace.zip'}).catch(()=>{});
 }
 throw error;
}finally{await browser.close();}
