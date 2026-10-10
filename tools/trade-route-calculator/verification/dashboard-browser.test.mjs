// Real Chromium, fresh synthetic campaigns and deterministic Traveller Map data.
// Run against a local static server: node verification/dashboard-browser.test.mjs [playwright-module]
// Optional TRAVELLER_BROWSER_EXECUTABLE_PATH selects an already-installed browser.
// --fixtures-only validates the independent economic expectations without Chromium.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as S from '../js/state.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';
import {formatCreditsText} from '../js/display.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const origin=new URL(base).origin,KEY='traveller-trade-route-calculator:v1',LOCK=KEY+':writer';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const report={suite:'Read-only Dashboard and persistent financial baseline',commit:process.env.TRAVELLER_COMMIT||null,cases:[],errors:[],scope:'Actual rendered Dashboard, campaign setup/import, localStorage and Web Locks in disposable synthetic contexts. All external requests intercepted; no live campaigns or network data.'};
const apiWorld={Name:'Dashboard Origin',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:0,WorldY:0,Sector:'Spinward Marches'};
const worlds={
 '0,0':{id:'0,0',x:0,y:0,name:'Dashboard Origin',sector:'Spinward Marches',hex:'1910',uwp:'A788899-C',zone:'Safe',raw:apiWorld},
 '1,0':{id:'1,0',x:1,y:0,name:'Dashboard Destination',sector:'Spinward Marches',hex:'2010',uwp:'A788899-C',zone:'Safe'}
};
function initialized(bank='100000'){
 const s=S.initial();Object.assign(s,{initialized:true,name:'Disposable Dashboard verification',bank,dateLabel:'101-1105',actual:'0,0',worlds:structuredClone(worlds),route:['0,0','1,0']});return s;
}
function oldCampaign(){
 const s=initialized();s.hours=48;
 s.ledger=[{id:'old-opening',type:'Opening bank',amount:'110000',hours:0,world:'0,0'},{id:'old-invoice',type:'Manual expense',amount:'-10000',hours:24,world:'0,0',reason:'Invoice before dashboard tracking'}];
 return S.transition(s,'Old deposit before Dashboard',next=>S.deposit(next,'250','Legacy deposit'));
}
function openingCampaign(bank='100000'){
 return S.transition(S.initial(),'Campaign setup',s=>{Object.assign(s,initialized(bank));s.ledger.push({id:'opening-balance',type:'Opening bank',amount:bank,hours:0,world:'0,0'});});
}
const transactions=[
 ['invoice','Manual expense','-1200',{reason:'Synthetic port invoice'}],
 ['deposit','Manual deposit','900',{reason:'Synthetic owner contribution'}],
 ['purchase','Purchase','-10000'],
 ['sale','Sale','16000',{audit:{adjusted:'5000',basis:'10000',gross:'16000',fee:'500',tax:'500',adjustment:'0'}}],
 ['broker','Broker fee','-500'],['tax','Tax','-500'],
 ['jump','Jump','0',{from:'0,0',to:'1,0'}],
 ['freight','Freight delivery','2000'],['mail','Mail delivery','1000'],['passengers','Passenger delivery','3000'],
 ['fuel','Ship expense: Fuel','-200',{expense:{kind:'fuel',label:'Fuel'}}]
];
function activityCampaign(bank='100000'){
 return S.transition(openingCampaign(bank),'Synthetic recorded activity',s=>{
  let jumped=false;for(const [id,type,amount,detail={}]of transactions){if(type==='Jump')jumped=true;s.ledger.push({id,type,amount,hours:jumped?184:24,world:jumped?'1,0':'0,0',...detail});s.bank=String(BigInt(s.bank)+BigInt(amount));}
  s.hours=184;s.actual='1,0';s.routeIndex=1;
 });
}
function verifyFixtures(){
 const legacy=oldCampaign();assert.equal(legacy.dashboardBaseline,undefined);assert.equal(legacy.bank,'100250');assert.equal(legacy.undo.length,1);
 for(const bank of ['100000','900719925474099312345']){
  const setup=openingCampaign(bank),s=activityCampaign(bank),data=dashboardData(s);S.validate(s);
  assert.deepEqual(setup.dashboardBaseline,{version:1,origin:'opening',bank,dateLabel:'101-1105',hours:0,excludedLedgerIds:['opening-balance']});
  assert.equal(data.currentBank,String(BigInt(bank)+10500n));assert.equal(data.operatingResult,'9600');assert.equal(data.otherInflows,'900');assert.equal(data.adjustment,'0');
  assert.equal(data.cashPoints.length,11);assert.deepEqual(data.visits.map(v=>v.result),['3800','5800']);
 }
}
verifyFixtures();
if(process.argv.includes('--fixtures-only')){console.log('PASS: Dashboard synthetic baseline, exact cash and independent operating-result expectations.');process.exit(0);}
const modulePath=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'playwright';
const {chromium}=createRequire(import.meta.url)(modulePath);
await mkdir(artifacts,{recursive:true});
let browser;
try{browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{}),...(process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH}:{})});}
catch(error){report.pass=false;report.blocker='Browser launch failed before any test case executed';report.errors.push(error.stack||String(error));await writeFile(artifacts+'/dashboard-report.json',JSON.stringify(report,null,2));throw error;}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY),read=async page=>JSON.parse(await raw(page));
const action=(page,name)=>page.locator('[data-action="'+name+'"]').filter({visible:true}).first();
const tab=(page,name)=>page.locator('#tabs').getByRole('button',{name,exact:true}).click();
const closed=page=>page.locator('#modal').waitFor({state:'hidden'});
const editing=page=>page.getByText('Editing in this tab',{exact:true}).waitFor();
const writes=page=>page.evaluate(()=>dashboardStorage.writes);
const card=(page,id)=>page.locator('.dashboard-card[aria-labelledby="dashboard-'+id+'-heading"]');
async function contextFor(result,state,{noLocks=false,failBaseline=false}={}){
 const context=await browser.newContext({viewport:result.viewport,serviceWorkers:'block'});context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>page.on('pageerror',error=>result.pageErrors.push(error.stack||String(error))));
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,bytes,origin,noLocks,failBaseline})=>{
  if(location.origin!==origin)return;
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  const nativeSet=Storage.prototype.setItem;
  globalThis.dashboardStorage={attempts:0,writes:0,fail:failBaseline};
  Storage.prototype.setItem=function(name,value){
   if(this!==localStorage||name!==key)return Reflect.apply(nativeSet,this,[name,value]);
   dashboardStorage.attempts++;
   if(dashboardStorage.fail)throw Error('Synthetic Dashboard baseline storage failure');
   const valueWritten=Reflect.apply(nativeSet,this,[name,value]);dashboardStorage.writes++;return valueWritten;
  };
  if(noLocks)Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
 },{key:KEY,bytes:JSON.stringify(state),origin,noLocks,failBaseline});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.href===new URL('verification/dashboard-lock-peer.html',base).href)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable lock peer</title><p>Synthetic native Web Lock holder</p>'});
  if(url.origin===origin)return route.continue();
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
   const json=url.pathname.endsWith('/jumpworlds')?{Worlds:[apiWorld]}:url.pathname.endsWith('/universe')?{Sectors:[{Names:[{Text:'Spinward Marches'}],X:0,Y:0,Milieu:'M1105'}]}:url.pathname.endsWith('/metadata')?{Subsectors:[]} :url.pathname.endsWith('/sec')?'Hex\tName\n1910\tDashboard Origin':'';
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  }
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });return context;
}
async function capture(page,result,label){const name='dashboard-'+result.id+'-'+label+'.png';await page.screenshot({path:artifacts+'/'+name,fullPage:true});result.screenshots.push(name);}
async function layout(page,result){
 const geometry=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,cards:[...document.querySelectorAll('.dashboard-card')].map(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width};})}));
 result.layout=geometry;assert.ok(geometry.overflow<=2,'No horizontal page overflow');for(const box of geometry.cards)assert.ok(box.left>=-1&&box.right<=geometry.width+1,'Every financial card stays inside the viewport');
}
async function dataRows(page,id){
 return card(page,id).locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>{const copy=cell.cloneNode(true);copy.querySelectorAll('.dashboard-row-note,.dashboard-key').forEach(el=>el.remove());return copy.textContent.trim();})));
}
async function showTables(page){for(const summary of await page.locator('.dashboard-data:not([open]) > summary').all())await summary.click();}
async function deposit(page,amount='600'){
 await tab(page,'Accounts');await action(page,'deposit').click();await page.locator('#modal [name="amount"]').fill(amount);await page.locator('#modal [name="reason"]').fill('Synthetic Dashboard refresh');await page.locator('#modal-submit').click();await page.getByRole('heading',{name:'Confirm deposit',exact:true}).waitFor();await page.locator('#modal-submit').click();await closed(page);
}
async function run(id,state,fn,options={}){
 const result={id,viewport:{width:options.width||1440,height:options.width&&options.width<500?900:1050},pageErrors:[],unexpectedRequests:[],screenshots:[],pass:false};report.cases.push(result);
 const context=await contextFor(result,state,options);let page;
 try{page=await context.newPage();await fn({context,page,result});assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unexpectedRequests,[]);result.pass=true;console.log('PASS: '+id);}
 catch(error){result.error=error.stack||String(error);report.errors.push(result.error);if(page)await capture(page,result,'failure').catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:artifacts+'/dashboard-'+id+'-trace.zip'}).catch(()=>{});await context.close();}
}
try{
 for(const width of [1440,390,320])await run('financial-cards-'+width,activityCampaign(width===320?'900719925474099312345':'100000'),async({page,result})=>{
  await page.goto(base);await editing(page);const before=await raw(page),state=await read(page);assert.equal(await writes(page),0,'An existing opening baseline needs no migration write');
  await tab(page,'Dashboard');assert.equal(await page.locator('#tabs [aria-current="page"]').textContent(),'Dashboard');assert.equal(await page.locator('.dashboard-card').count(),4);assert.equal(await page.locator('.dashboard-card svg[role="img"]').count(),4);
  for(const svg of await page.locator('.dashboard-card svg').all()){assert.ok((await svg.getAttribute('aria-label'))?.length>10);assert.ok(await svg.locator('title').count());assert.doesNotMatch(await svg.innerHTML(),/NaN|Infinity/);}
  await capture(page,result,'charts');await showTables(page);assert.equal(await page.getByRole('table').count(),4,'Each populated chart has an exact-value accessible table');
  for(const table of await page.getByRole('table').all()){assert.equal(await table.locator('caption').count(),1);assert.ok(await table.locator('th[scope="col"]').count());assert.ok(await table.locator('th[scope="row"]').count());}
  let bank=BigInt(state.dashboardBaseline.bank);const expectedCash=[['Starting balance',formatCreditsText(bank)]];for(const [,type,amount]of transactions)if(amount!=='0'){bank+=BigInt(amount);expectedCash.push([type,formatCreditsText(bank)]);}
  assert.deepEqual(await dataRows(page,'cash'),expectedCash,'Cash table retains every exact balance, including amounts above Number precision');
  assert.deepEqual(await dataRows(page,'result'),[['Starting visit','Cr 5,000','Cr 0','Cr 1,200','Cr 3,800'],['Jump 1 · Dashboard Origin → Dashboard Destination · ongoing','Cr 0','Cr 6,000','Cr 200','Cr 5,800']]);
  assert.deepEqual(await dataRows(page,'income'),[['Cargo sales','Cr 16,000'],['Passengers','Cr 3,000'],['Freight','Cr 2,000'],['Mail','Cr 1,000']]);
  assert.deepEqual(await dataRows(page,'expenses'),[['Cargo purchases','Cr 10,000'],['Manual expenses','Cr 1,200'],['Broker fees','Cr 500'],['Sale taxes','Cr 500'],['Fuel','Cr 200']]);
  assert.match(await card(page,'result').textContent(),/Cr 9,600/);assert.match(await page.locator('.dashboard-method').textContent(),/inflows Cr 900; outflows Cr 0/);await layout(page,result);await capture(page,result,'exact-tables');
  for(const name of ['Accounts','History','Cargo','Dashboard'])await tab(page,name);assert.equal(await raw(page),before);assert.equal(await writes(page),0,'Viewing or switching financial tabs never writes');
  await page.reload();await editing(page);await tab(page,'Dashboard');assert.equal(await raw(page),before);await showTables(page);assert.deepEqual(await dataRows(page,'cash'),expectedCash,'Reload retains baseline and exact graph data');
 },{width});
 await run('legacy-baseline-refresh-undo',oldCampaign(),async({page,result})=>{
  await page.goto(new URL('verification/dashboard-lock-peer.html',base).href);const seeded=await read(page),bytes=await raw(page);await page.goto(base);await editing(page);
  const migrated=await read(page),{dashboardBaseline:baseline,...retained}=migrated;assert.deepEqual(retained,seeded,'First writer only adds metadata; it preserves revision, ledger, events, Undo and economics');
  assert.deepEqual(baseline,{version:1,origin:'current',bank:'100250',dateLabel:'101-1105',hours:48,excludedLedgerIds:seeded.ledger.map(e=>e.id)});assert.equal(await writes(page),1);
  await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 100,250']]);assert.match(await card(page,'cash').textContent(),/103-1105/);assert.match(await page.locator('.dashboard-period').textContent(),/Earlier history is not reconstructed/);
  await capture(page,result,'first-writer');await deposit(page);const paid=await read(page);assert.deepEqual(paid.dashboardBaseline,baseline);assert.equal(paid.bank,'100850');await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 100,250'],['Manual deposit','Cr 100,850']]);assert.match(await card(page,'result').textContent(),/Cr 0/);
  await page.reload();await editing(page);assert.deepEqual(await read(page),paid);await tab(page,'History');await action(page,'undo').click();await action(page,'undo').click();const undone=await read(page);assert.equal(undone.bank,'100000');assert.deepEqual(undone.dashboardBaseline,baseline);assert.deepEqual(undone.ledger,seeded.ledger.slice(0,-1));
  await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 100,250'],['Earlier-history / balance adjustment','Cr 100,000']]);assert.match(await page.locator('.dashboard-warning').textContent(),/Cr -250.*excluded from profit/);assert.match(await card(page,'result').textContent(),/Cr 0/);await capture(page,result,'earlier-history-undo');
  await deposit(page,'25');await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 100,250'],['Earlier-history / balance adjustment','Cr 100,000'],['Manual deposit','Cr 100,025']]);assert.deepEqual((await read(page)).dashboardBaseline,baseline,'New ledger IDs survive the crossed-baseline Undo boundary');
  assert.notEqual(await raw(page),bytes);
 });
 await run('real-setup-opening-balance',S.initial(),async({page,result})=>{
  await page.goto(base);await editing(page);assert.equal(await writes(page),0);await action(page,'setup').click();await page.locator('#modal [name="bank"]').fill('654321');await page.locator('#modal [name="date"]').fill('200-1105');
  await page.waitForFunction(()=>document.querySelector('#setup-world select[aria-label="World"]')?.value==='1910');await page.locator('#modal-submit').click();await closed(page);
  const state=await read(page);assert.equal(state.initialized,true);assert.equal(state.bank,'654321');assert.equal(state.ledger.length,1);assert.equal(state.ledger[0].type,'Opening bank');assert.deepEqual(state.dashboardBaseline,{version:1,origin:'opening',bank:'654321',dateLabel:'200-1105',hours:0,excludedLedgerIds:[state.ledger[0].id]});
  await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 654,321']],'Opening bank appears exactly once');assert.match(await card(page,'income').textContent(),/No recorded cash income/);await capture(page,result,'opening');
  await deposit(page,'10');await tab(page,'Dashboard');await showTables(page);assert.deepEqual(await dataRows(page,'cash'),[['Starting balance','Cr 654,321'],['Manual deposit','Cr 654,331']]);assert.deepEqual((await read(page)).dashboardBaseline,state.dashboardBaseline);
  await page.reload();await editing(page);assert.equal((await read(page)).dashboardBaseline.origin,'opening');assert.equal(await writes(page),0);
 });
 await run('import-retains-baseline',activityCampaign(),async({page,result})=>{
  await page.goto(base);await editing(page);const imported=activityCampaign('700000'),baseline=structuredClone(imported.dashboardBaseline),revision=(await read(page)).revision;
  await page.locator('#import-file').setInputFiles({name:'synthetic-dashboard-campaign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();await page.locator('#modal [name="backed"]').check();await page.locator('#modal-submit').click();await closed(page);
  const saved=await read(page);assert.deepEqual(saved,{...imported,revision:revision+1});assert.deepEqual(saved.dashboardBaseline,baseline);await tab(page,'Dashboard');await showTables(page);assert.equal((await dataRows(page,'cash'))[0][1],'Cr 700,000');assert.equal((await dataRows(page,'cash')).at(-1)[1],'Cr 710,500');await capture(page,result,'imported');
  await page.reload();await editing(page);assert.deepEqual(await read(page),saved);assert.equal(await writes(page),0);
 });
 await run('read-only-before-first-writer',oldCampaign(),async({context,page,result})=>{
  await page.goto(new URL('verification/dashboard-lock-peer.html',base).href);const bytes=await raw(page);await page.evaluate(async lock=>{await new Promise(resolve=>{navigator.locks.request(lock,async()=>{resolve();await new Promise(release=>{globalThis.releaseDashboardTestLock=release;});});});},LOCK);
  const reader=await context.newPage();await reader.goto(base);await reader.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await tab(reader,'Dashboard');assert.equal(await raw(reader),bytes);assert.equal(await writes(reader),0);assert.match(await reader.locator('.dashboard').textContent(),/No saved financial baseline yet/);await capture(reader,result,'read-only');
  await reader.locator('#takeover').click();assert.equal(await raw(reader),bytes,'Queued takeover cannot initialize before the native writer lock is granted');await page.evaluate(()=>releaseDashboardTestLock());await editing(reader);assert.equal(await writes(reader),1);assert.equal((await read(reader)).dashboardBaseline.bank,'100250');await showTables(reader);assert.deepEqual(await dataRows(reader,'cash'),[['Starting balance','Cr 100,250']]);
 });
 await run('real-tab-takeover',activityCampaign(),async({context,page,result})=>{
  await page.goto(base);await editing(page);await tab(page,'Dashboard');const bytes=await raw(page),other=await context.newPage();await other.goto(base);await other.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await tab(other,'Dashboard');assert.equal(await raw(other),bytes);assert.equal(await writes(other),0);
  await other.locator('#takeover').click();await editing(other);await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();assert.equal(await raw(other),bytes);assert.equal(await writes(other),0,'Takeover retains the saved baseline without writing');
  await deposit(other,'15');await page.waitForFunction(()=>document.querySelector('.dashboard-card[aria-labelledby="dashboard-cash-heading"]')?.textContent.includes('Cr 110,515'));assert.equal((await read(page)).bank,'110515');await capture(page,result,'reader-refreshed');
 });
 await run('no-web-locks',oldCampaign(),async({page,result})=>{
  await page.goto(base);await page.getByText('This browser lacks safe editing locks. Use a current browser.',{exact:true}).waitFor();const before=await raw(page);assert.equal((await read(page)).dashboardBaseline,undefined);await tab(page,'Dashboard');assert.match(await page.locator('.dashboard').textContent(),/No saved financial baseline yet/);assert.equal(await writes(page),0);assert.equal(await raw(page),before);await tab(page,'Accounts');assert.equal(await action(page,'deposit').isDisabled(),true);await capture(page,result,'safe-read-only');
 },{noLocks:true});
 await run('baseline-storage-failure',oldCampaign(),async({page,result})=>{
  await page.goto(new URL('verification/dashboard-lock-peer.html',base).href);const bytes=await raw(page);await page.goto(base);await page.getByText('Synthetic Dashboard baseline storage failure',{exact:true}).waitFor();assert.equal(await raw(page),bytes,'A failed metadata write leaves the original valid campaign byte-for-byte intact');S.validate(await read(page));assert.equal((await read(page)).dashboardBaseline,undefined);assert.equal(await writes(page),0);assert.equal(await page.evaluate(()=>dashboardStorage.attempts),1);
  await tab(page,'Accounts');assert.equal(await action(page,'deposit').isDisabled(),true);assert.equal(await action(page,'expense').isDisabled(),true);await tab(page,'Dashboard');assert.match(await page.locator('.dashboard').textContent(),/No saved financial baseline yet/);await capture(page,result,'failure-safe');
  await page.evaluate(()=>{dashboardStorage.fail=false;});await page.locator('#takeover').click();await editing(page);assert.equal(await writes(page),1);assert.equal((await read(page)).dashboardBaseline.bank,'100250');assert.equal((await read(page)).revision,JSON.parse(bytes).revision);await capture(page,result,'retry-recovered');
 },{failBaseline:true});
 report.pass=true;console.log('PASS: Dashboard exact accessible financial charts, responsive layouts, opening/current baselines, native storage/locks, setup/import, reload, transaction refresh and crossed-history Undo.');
}finally{await writeFile(artifacts+'/dashboard-report.json',JSON.stringify(report,null,2));await browser.close();}
