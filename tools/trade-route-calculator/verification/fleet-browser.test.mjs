// Synthetic actual-browser multi-ship regression. No live campaign data.
// Serve tools/trade-route-calculator, then:
// node verification/fleet-browser.test.mjs [absolute-playwright-module]
// Optional: TRAVELLER_TEST_URL, TRAVELLER_BROWSER_CHANNEL; --fixtures-only needs no browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey as KEY} from './fixtures/gui-parity.mjs';
import {validate} from '../js/state.mjs';
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const f=guiFixture();
function fixture(){
 const a=structuredClone(f.state),b=structuredClone(f.state);
 a.name='Synthetic Alpha campaign';a.ship.name='Alpha';
 b.name='Synthetic Beta campaign';b.ship.name='Beta';b.bank='432100';b.hours=120;b.routeIndex=2;b.actual=b.route[2];
 b.lots=b.lots.map(l=>({...l,id:'beta-'+l.id}));b.contracts=[];b.snapshots=[];
 return {fleetVersion:1,activeShipId:'synthetic-alpha',ships:[{id:'synthetic-alpha',campaign:validate(a)},{id:'synthetic-beta',campaign:validate(b)}]};
}
const raw=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
const read=async p=>JSON.parse(await raw(p));
const active=fleet=>fleet.ships.find(s=>s.id===fleet.activeShipId).campaign;
const tick=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const action=(p,name)=>p.locator(`[data-action="${name}"]`).filter({visible:true}).first();
const tab=(p,name)=>p.locator(`#tabs [data-arg="${name}"]`).click();
const closed=p=>p.locator('#modal').waitFor({state:'hidden'});
async function switchShip(p,id){await p.locator('#ship-select').selectOption(id);await p.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).activeShipId===id,{key:KEY,id});await tick(p);}
async function importFile(p,value){
 const chooser=p.waitForEvent('filechooser');await action(p,'import').click();
 await(await chooser).setFiles(value===null?[]:{name:'synthetic-fleet.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});await tick(p);
}
async function confirmImport(p){await p.locator('#modal [name=backed]').check();await p.locator('#modal-submit').click();await closed(p);}
async function openDeposit(p){await tab(p,'Accounts');await action(p,'deposit').click();await p.locator('#modal [name=amount]').fill('123');await p.locator('#modal [name=reason]').fill('Synthetic fleet isolation');}
async function forceSwitch(p,id){await p.evaluate(id=>{const s=document.querySelector('#ship-select');s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));},id);await tick(p);}
async function settingsDraft(p){await tab(p,'Settings');const input=p.locator('#settings-form [name=name]');await input.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await input.fill('Unsaved synthetic setting');return input;}
async function noLoss(p,fn){const before=await raw(p);await fn();await tick(p);assert.equal(await raw(p),before,'Rejected or cancelled operation must preserve exact saved fleet bytes');}
async function blockedDelete(p){
 const before=await p.locator('#modal').evaluate(d=>({open:d.open,title:document.querySelector('#modal-title').textContent}));
 await noLoss(p,()=>p.locator('[data-action=ship-delete]').evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true}))));
 assert.deepEqual(await p.locator('#modal').evaluate(d=>({open:d.open,title:document.querySelector('#modal-title').textContent})),before,'Guarded delete cannot replace the current dialog or open a new one');
}
async function contextFor(browser,seed,width){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];
 context.on('page',p=>{p.on('pageerror',e=>errors.push(String(e)));});
 await context.addInitScript(({key,bytes,origin})=>{
  if(location.origin!==origin)return;
  // Once per context origin: never overwrite an edited fleet on reload or in a second tab.
  if(localStorage.getItem(key)===null)localStorage.setItem(key,bytes);
  const native=Storage.prototype.setItem;
  globalThis.fleetTest={failNext:false,writes:0};
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key){if(fleetTest.failNext){fleetTest.failNext=false;throw new DOMException('Synthetic fleet quota rejection','QuotaExceededError');}fleetTest.writes++;}return Reflect.apply(native,this,[k,v]);};
  addEventListener('unhandledrejection',e=>{globalThis.fleetUnhandled=(globalThis.fleetUnhandled||[]).concat(String(e.reason));});
 },{key:KEY,bytes:JSON.stringify(seed),origin:new URL(base).origin});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===new URL(base).origin)return r.continue();if(u.origin==='https://travellermap.com')return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds},headers:{'Access-Control-Allow-Origin':'*'}});return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 return {context,page,errors};
}
const cases=[
 ['legacy migration and add',async p=>{
  assert.equal(await p.locator('#ship-select option').count(),1);
  const before=await read(p),legacy=before.fleetVersion?active(before):before;
  await action(p,'ship-add').click();await p.locator('#modal [name=name]').fill('New synthetic ship');
  assert.equal(await p.locator('#modal-submit').textContent(),'Add ship');await p.locator('#modal-submit').click();await closed(p);
  const fleet=await read(p);assert.equal(fleet.fleetVersion,1);assert.equal(fleet.ships.length,2);
  assert.equal(active(fleet).initialized,false,'Adding must not clone initialized ship state');
  assert.deepEqual(fleet.ships.find(s=>s.id!==fleet.activeShipId).campaign,legacy,'Migration/add preserves original campaign');
  for(const key of ['lots','contracts','snapshots'])assert.deepEqual(active(fleet)[key],[],'New ship has no old '+key);
  const bytes=await raw(p);await p.reload();await p.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(p),bytes);
 }],
 ['edits switch reload and backup',async p=>{
  const seed=await read(p);await openDeposit(p);await p.locator('#modal-submit').click();await p.getByRole('heading',{name:'Confirm deposit',exact:true}).waitFor();await p.locator('#modal-submit').click();await closed(p);
  let fleet=await read(p);assert.equal(active(fleet).bank,String(Number(active(seed).bank)+123));assert.deepEqual(fleet.ships[1],seed.ships[1]);
  const edited=structuredClone(fleet.ships[0].campaign);await switchShip(p,'synthetic-beta');assert.deepEqual(active(await read(p)),seed.ships[1].campaign);
  await switchShip(p,'synthetic-alpha');assert.deepEqual(active(await read(p)),edited);
  await p.reload();await p.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await p.locator('#ship-select').inputValue(),'synthetic-alpha');assert.deepEqual(active(await read(p)),edited);
  const bytes=await raw(p),download=p.waitForEvent('download');await action(p,'export').click();assert.equal(await readFile(await(await download).path(),'utf8'),bytes,'Backup exports saved entire group');
 }],
 ['import cancel malformed legacy and fleet',async p=>{
  await noLoss(p,()=>importFile(p,null));
  for(const value of ['not JSON','{}',{...fixture(),activeShipId:'missing'},{...fixture(),ships:[]}])await noLoss(p,async()=>{await importFile(p,value);await p.locator('#message.error').waitFor();assert.equal(await p.locator('#modal').evaluate(d=>d.open),false);});
  const original=await read(p),incoming=structuredClone(f.state);incoming.name='Imported legacy synthetic';incoming.ship.name='Legacy replacement';
  await noLoss(p,async()=>{await importFile(p,incoming);await p.locator('#modal-submit').click();await p.locator('#modal-error').filter({hasText:/backup|proceed/i}).waitFor();await p.locator('#modal-cancel').click();});
  await importFile(p,incoming);await confirmImport(p);let fleet=await read(p);assert.equal(fleet.ships.length,2);assert.equal(fleet.activeShipId,original.activeShipId);assert.deepEqual(fleet.ships[1],original.ships[1]);assert.equal(active(fleet).name,incoming.name);
  const replacement=fixture();replacement.ships[0].id='replacement-alpha';replacement.ships[1].id='replacement-beta';replacement.activeShipId='replacement-beta';
  await noLoss(p,async()=>{await importFile(p,replacement);await p.locator('#modal-cancel').click();});
  await importFile(p,replacement);await confirmImport(p);fleet=await read(p);assert.match(await p.locator('#message').textContent(),/replaced/i);assert.equal(await p.locator('#ship-select').inputValue(),replacement.activeShipId);assert.deepEqual(fleet.ships.map(s=>s.id),replacement.ships.map(s=>s.id));assert.equal(fleet.activeShipId,replacement.activeShipId);
  for(let i=0;i<2;i++){const actual={...fleet.ships[i].campaign},expected={...replacement.ships[i].campaign};delete actual.revision;delete expected.revision;assert.deepEqual(actual,expected);}
 }],
 ['modal guard stale dialog and quota',async p=>{
  await openDeposit(p);await blockedDelete(p);await noLoss(p,()=>forceSwitch(p,'synthetic-beta'));assert.equal(await p.locator('#ship-select').inputValue(),'synthetic-alpha');assert.equal(await p.locator('#modal').evaluate(d=>d.open),true);await p.locator('#modal-cancel').click();
  await action(p,'ship-add').click();await p.locator('#modal [name=name]').fill('Quota synthetic');
  await noLoss(p,async()=>{await p.evaluate(()=>{fleetTest.failNext=true;});await p.locator('#modal-submit').click();await p.locator('#modal-error').filter({hasText:/quota|storage|save/i}).waitFor();});await p.locator('#modal-cancel').click();
  await noLoss(p,async()=>{await p.evaluate(()=>{fleetTest.failNext=true;});await forceSwitch(p,'synthetic-beta');});assert.equal(await p.locator('#ship-select').inputValue(),'synthetic-alpha');
  await importFile(p,fixture());await p.locator('#modal [name=backed]').check();
  await p.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);
  await noLoss(p,async()=>{await p.locator('#modal-form').evaluate(form=>form.requestSubmit());});
  assert.equal(await p.locator('#modal-submit').isDisabled(),true,'Foreign publication invalidates stale fleet import confirmation');
 }],
 ['settings switch confirmation',async p=>{
  await settingsDraft(p);const before=await raw(p);await forceSwitch(p,'synthetic-beta');await p.locator('#modal-cancel').click();assert.equal(await raw(p),before);assert.equal(await p.locator('#settings-form [name=name]').inputValue(),'Unsaved synthetic setting');
  await forceSwitch(p,'synthetic-beta');await p.locator('#modal-submit').click();await closed(p);assert.equal((await read(p)).activeShipId,'synthetic-beta');assert.equal(active(await read(p)).name,fixture().ships[1].campaign.name);
 }],
 ['read-only takeover',async(p,context)=>{
  const peer=await context.newPage();await peer.goto(base);await peer.getByText(/Read-only/).first().waitFor();
  assert.equal(await action(peer,'ship-add').isDisabled(),true);assert.equal(await peer.locator('#ship-select').isDisabled(),true);
  await noLoss(peer,()=>forceSwitch(peer,'synthetic-beta'));
  await peer.locator('#takeover').click();await peer.getByText('Editing in this tab',{exact:true}).waitFor();await p.getByText(/Read-only/).first().waitFor();
  await switchShip(peer,'synthetic-beta');assert.equal((await read(p)).activeShipId,'synthetic-beta');assert.equal(await action(p,'ship-add').isDisabled(),true);
  await peer.close();
 }],
 ['session offers clear on switch',async p=>{
  await tab(p,'Contracts');await action(p,'mail-check').click();await p.locator('#modal').getByText('Manual mail rolls (optional)',{exact:true}).click();
  for(const [name,value]of Object.entries({dice:'8',skill:'0',characteristic:'0',mailAvailability:'12',mailContainers:'3'})){const input=p.locator(`#modal [name="${name}"]`);if(await input.count())await input.fill(value);}
  await p.locator('#modal-submit').click();await closed(p);assert.ok(await p.locator('[data-action="contract-accept"]').count()>0);
  await switchShip(p,'synthetic-beta');assert.equal(await p.locator('[data-action="contract-accept"]').count(),0);
  await switchShip(p,'synthetic-alpha');assert.equal(await p.locator('[data-action="contract-accept"]').count(),0,'Old session offers cannot revive when switching back');
 }],
 ['supplier input stays with source ship',async p=>{
  const seed=await read(p);assert.equal(seed.ships[0].campaign.actual,seed.ships[1].campaign.actual,'Exercise same-world draft restoration');
  await tab(p,'Trade');await action(p,'search').click();
  await p.locator('#supplier-form [name=party]').fill('Alpha private synthetic supplier');
  await p.locator('#supplier-form [name=counterparty]').fill('5');
  await p.locator('#supplier-form [name=method]').selectOption('blackMarket');
  await p.locator('#supplier-form .supplier-overrides').evaluate(el=>{el.open=true;});
  await p.locator('#supplier-form [name=dice]').fill('11');
  await forceSwitch(p,'synthetic-beta');await p.getByRole('heading',{name:'Switch ships?',exact:true}).waitFor();
  await p.locator('#modal-submit').click();await closed(p);assert.equal((await read(p)).activeShipId,'synthetic-beta');
  await tab(p,'Trade');await action(p,'search').click();assert.notEqual(await p.locator('#supplier-form [name=party]').inputValue(),'Alpha private synthetic supplier');
  assert.equal(await p.locator('#supplier-form [name=counterparty]').inputValue(),'2');assert.equal(await p.locator('#supplier-form [name=dice]').inputValue(),'');
  assert.notEqual(await p.locator('#supplier-form [name=method]').inputValue(),'blackMarket');
 }],
 ['open service blocks switch',async p=>{
  await tab(p,'Overview');await action(p,'refuel').click();await p.locator('#service-panel').waitFor();await blockedDelete(p);
  await noLoss(p,()=>forceSwitch(p,'synthetic-beta'));assert.equal(await p.locator('#ship-select').inputValue(),'synthetic-alpha');assert.equal(await p.locator('#service-panel').isVisible(),true);
  assert.match(await p.locator('#message').textContent(),/service|finish|close/i);
 }],
 ['route draft blocks switch',async p=>{
  await tab(p,'Overview');await p.locator('#route-menu > summary').click();await action(p,'route-build').click();await action(p,'route-cancel').waitFor();await blockedDelete(p);
  await noLoss(p,()=>forceSwitch(p,'synthetic-beta'));assert.equal(await p.locator('#ship-select').inputValue(),'synthetic-alpha');assert.match(await p.locator('#message').textContent(),/route draft/i);
  await action(p,'route-cancel').click();await switchShip(p,'synthetic-beta');
 }],
 ['keyboard switch retains focus',async p=>{
  await p.locator('#ship-select').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
  await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).activeShipId==='synthetic-beta',KEY);await tick(p);
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'ship-select','Focus returns to replacement select after render');
  await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).activeShipId==='synthetic-alpha',KEY);await tick(p);
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'ship-select');
 }],
 ['delete success reload backup and duplicate submit',async p=>{
  const original=await read(p),remaining=original.ships.filter(s=>s.id!==original.activeShipId),removed=active(original);
  await action(p,'ship-delete').click();await p.getByRole('heading',{name:'Delete ship?',exact:true}).waitFor();
  assert.ok((await p.locator('#modal-body').textContent()).includes(removed.ship.name),'Selected ship name is rendered literally');
  assert.equal(await p.locator('#modal-body img').count(),0,'Ship name cannot inject markup');
  assert.match(await p.locator('#modal-body').textContent(),/cannot be undone|not undoable|can.t be undone/i);
  await p.locator('#modal [name=backed]').check();
  const writes=await p.evaluate(()=>fleetTest.writes);
  await p.locator('#modal-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await closed(p);
  let fleet=await read(p);assert.deepEqual(fleet.ships,remaining,'Every surviving campaign and its order remain byte-for-byte equivalent');assert.equal(fleet.activeShipId,remaining[0].id);assert.equal(await p.evaluate(()=>fleetTest.writes),writes+1,'Duplicate submit deletes only once');
  assert.equal(await p.locator('#ship-select option').count(),remaining.length);assert.equal(await p.locator('#ship-select').inputValue(),remaining[0].id);
  const bytes=await raw(p);await p.reload();await p.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await raw(p),bytes);assert.equal(await p.locator('#ship-select').inputValue(),remaining[0].id);
  const [download]=await Promise.all([p.waitForEvent('download'),action(p,'export').click()]);assert.equal(await readFile(await download.path(),'utf8'),bytes,'Backup contains all survivors and no deleted campaign');
 }],
 ['delete cancel close escape and missing acknowledgement',async p=>{
  for(const cancel of ['cancel','close','escape'])await noLoss(p,async()=>{await action(p,'ship-delete').click();await p.getByRole('heading',{name:'Delete ship?',exact:true}).waitFor();assert.equal(await p.locator('#modal [name=backed]').isChecked(),false);await p.locator('#modal-submit').click();assert.equal(await p.locator('#modal').evaluate(d=>d.open),true);assert.match(await p.locator('#modal-error').textContent(),/backup|acknowledge|confirm|proceed/i);if(cancel==='escape')await p.keyboard.press('Escape');else await p.locator('#modal-'+cancel).click();await closed(p);});
 }],
 ['delete only ship blocked',async p=>{
  assert.equal(await action(p,'ship-delete').isDisabled(),true);assert.ok((await p.locator('body').textContent()).includes('Keep at least one ship. Use Reset campaign to clear its data.'));
  await noLoss(p,async()=>{await p.locator('[data-action=ship-delete]').evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));});assert.equal(await p.locator('#modal').evaluate(d=>d.open),false);assert.equal((await read(p)).ships.length,1);
 }],
 ['delete quota preserves group and retries',async p=>{
  const original=await read(p);await action(p,'ship-delete').click();await p.locator('#modal [name=backed]').check();
  await noLoss(p,async()=>{await p.evaluate(()=>{fleetTest.failNext=true;});await p.locator('#modal-submit').click();await p.locator('#modal-error').filter({hasText:/quota|storage|save/i}).waitFor();});
  assert.equal(await p.locator('#ship-select').inputValue(),original.activeShipId);await p.locator('#modal-submit').click();await closed(p);assert.deepEqual((await read(p)).ships,original.ships.filter(s=>s.id!==original.activeShipId));
 }],
 ['delete stale publication denied',async p=>{
  await action(p,'ship-delete').click();await p.locator('#modal [name=backed]').check();
  await p.evaluate(key=>dispatchEvent(new StorageEvent('storage',{key,newValue:localStorage.getItem(key)})),KEY);await tick(p);
  await noLoss(p,()=>p.locator('#modal-form').evaluate(form=>form.requestSubmit()));assert.equal(await p.locator('#modal-submit').isDisabled(),true);assert.equal((await read(p)).ships.length,2);
 }],
 ['delete readonly takeover retires review',async(p,context)=>{
  await action(p,'ship-delete').click();await p.locator('#modal [name=backed]').check();
  const peer=await context.newPage();await peer.goto(base);await peer.getByText(/Read-only/).first().waitFor();assert.equal(await action(peer,'ship-delete').isDisabled(),true);
  await peer.locator('#takeover').click();await peer.getByText('Editing in this tab',{exact:true}).waitFor();await p.getByText(/Read-only/).first().waitFor();
  await noLoss(p,()=>p.locator('#modal-form').evaluate(form=>form.requestSubmit()));assert.equal(await p.locator('#modal-submit').isDisabled(),true);
  const original=await read(peer);await action(peer,'ship-delete').click();await peer.locator('#modal [name=backed]').check();await peer.locator('#modal-submit').click();await closed(peer);assert.deepEqual((await read(peer)).ships,original.ships.filter(s=>s.id!==original.activeShipId));await peer.close();
 }],
 ['delete warns of settings and supplier drafts',async p=>{
  await settingsDraft(p);await noLoss(p,async()=>{await action(p,'ship-delete').click();assert.match(await p.locator('#modal-body').textContent(),/unconfirmed|unsaved|draft/i);await p.locator('#modal-cancel').click();await closed(p);});assert.equal(await p.locator('#settings-form [name=name]').inputValue(),'Unsaved synthetic setting');
  await tab(p,'Trade');await action(p,'search').click();await p.locator('#supplier-form [name=party]').fill('Synthetic unsaved supplier');
  await noLoss(p,async()=>{await action(p,'ship-delete').click();assert.match(await p.locator('#modal-body').textContent(),/supplier/i);await p.locator('#modal-cancel').click();await closed(p);});assert.equal(await p.locator('#supplier-form [name=party]').inputValue(),'Synthetic unsaved supplier');
 }],
 ['selected export and selected import preserve other ships',async p=>{
  const original=await read(p);assert.equal(await action(p,'export-ship').textContent(),'Export this ship');assert.equal(await action(p,'export').textContent(),'Backup all ships');
  const bytes=await raw(p),[download]=await Promise.all([p.waitForEvent('download'),action(p,'export-ship').click()]);const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(exported,active(original),'Selected export contains exactly one campaign, no fleet wrapper or inactive data');assert.equal(await raw(p),bytes);
  await switchShip(p,'synthetic-beta');await importFile(p,exported);assert.equal(await p.locator('#modal-submit').textContent(),'Replace selected ship');assert.match(await p.locator('#modal-body').textContent(),/single|selected/i);await confirmImport(p);
  const fleet=await read(p);assert.deepEqual(fleet.ships[0],original.ships[0]);assert.equal(fleet.activeShipId,'synthetic-beta');const actual={...active(fleet)},expected={...exported};delete actual.revision;delete expected.revision;assert.deepEqual(actual,expected);
  await importFile(p,original);assert.equal(await p.locator('#modal-submit').textContent(),'Replace all ships');assert.match(await p.locator('#modal-body').textContent(),/group|all ships/i);await p.locator('#modal-cancel').click();
 }],
 ['selected export works readonly',async(p,context)=>{
  const peer=await context.newPage();await peer.goto(base);await peer.getByText(/Read-only/).first().waitFor();const bytes=await raw(peer);assert.equal(await action(peer,'export-ship').isEnabled(),true);
  const [download]=await Promise.all([peer.waitForEvent('download'),action(peer,'export-ship').click()]);assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),active(JSON.parse(bytes)));assert.equal(await raw(peer),bytes);await peer.close();
 }],
 ['selected export fails closed in recovery',async p=>{
  const corrupt='{synthetic unreadable fleet';await p.evaluate(({key,corrupt})=>localStorage.setItem(key,corrupt),{key:KEY,corrupt});await p.reload();await p.getByRole('heading',{name:'Recover saved campaign',exact:true}).waitFor();
  const downloads=[];p.on('download',d=>downloads.push(d));const control=p.locator('[data-action=export-ship]').filter({visible:true});
  if(await control.count()&&await control.first().isEnabled()){await control.first().click();await tick(p);assert.match(await p.locator('#message').textContent(),/recover|corrupt|restore|read|saved/i);}
  assert.equal(await raw(p),corrupt);assert.equal(downloads.length,0,'Recovery must not export an invented initial or partial selected campaign');
  await importFile(p,fixture().ships[0].campaign);assert.equal(await p.locator('#modal-submit').textContent(),'Replace all ships');await p.locator('#modal-cancel').click();assert.equal(await raw(p),corrupt);
 }],
 ['compact responsive controls',async(p,_context,width)=>{
  const select=p.locator('#ship-select');assert.equal(await select.count(),1);assert.equal(await p.getByLabel('Ship',{exact:true}).count(),1);
  for(const control of [select,action(p,'ship-add'),action(p,'ship-delete')]){const r=await control.boundingBox();assert.ok(r&&r.x>=0&&r.x+r.width<=width+1,'Ship control fits viewport');assert.ok(r.height>=44,'Ship control has touch target');}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No viewport overflow');
  await switchShip(p,'synthetic-beta');assert.equal(await select.inputValue(),'synthetic-beta');
  const dir=new URL('../verification-artifacts/',import.meta.url);await mkdir(dir,{recursive:true});await p.screenshot({path:fileURLToPath(new URL(`fleet-${width}.png`,dir)),fullPage:false});
 }]
];
if(process.argv.includes('--fixtures-only')){
 const fleet=fixture();assert.equal(new Set(fleet.ships.map(s=>s.id)).size,2);for(const ship of fleet.ships)validate(ship.campaign);
 assert.notEqual(fleet.ships[0].campaign.bank,fleet.ships[1].campaign.bank);assert.notEqual(fleet.ships[0].campaign.actual,fleet.ships[1].campaign.actual);
 console.log(`PASS synthetic fleet fixtures; ${cases.length*3} browser cases declared. Chromium not launched.`);
}else{
 const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});const failures=[];
 try{for(const width of [1440,390,320])for(const[name,run]of cases){if(process.env.TRAVELLER_CASE_FILTER&&!name.includes(process.env.TRAVELLER_CASE_FILTER))continue;let env;try{env=await contextFor(browser,name.startsWith('legacy')?f.state:(()=>{const seed=fixture();if(name.startsWith('delete only'))seed.ships=seed.ships.slice(0,1);if(name.startsWith('delete success')){seed.ships.push({id:'synthetic-gamma',campaign:structuredClone(seed.ships[1].campaign)});seed.activeShipId='synthetic-beta';seed.ships[1].campaign.ship.name='<img src=x> Beta & Test';}if(name.startsWith('supplier input')){seed.ships[1].campaign.actual=seed.ships[0].campaign.actual;seed.ships[1].campaign.routeIndex=seed.ships[0].campaign.routeIndex;}return seed;})(),width);await run(env.page,env.context,width);assert.deepEqual(env.errors,[]);for(const p of env.context.pages())assert.deepEqual(await p.evaluate(()=>globalThis.fleetUnhandled||[]),[]);console.log(`PASS ${name} ${width}`);}catch(error){failures.push(`${name} ${width}: ${error.stack||error}`);console.error(failures.at(-1));if(env)console.error('UI error:',await env.page.locator('#modal-error').textContent(),await env.page.locator('#message').textContent());}finally{await env?.context.close();}}}finally{await browser.close();}
 assert.deepEqual(failures,[],`${failures.length} fleet browser cases failed`);
}
