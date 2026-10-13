// Bounded Dev Tools checks, run after browser.test.mjs in its existing CI job.
// Synthetic campaigns only. Real Chromium storage, clipboard, dialogs and locks.
// Local source/fixture check: node verification/devtools-browser.test.mjs --fixtures-only
// The fixture-only branch never imports Playwright or launches a browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validate} from '../js/state.mjs';
import {guiFixture,campaignKey as KEY} from './fixtures/gui-parity.mjs';

const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const BUILD='2026.10.13.84',PREFIX='DEVTOOLS_PRIVATE_';
const privateValues={campaign:PREFIX+'CAMPAIGN',ship:PREFIX+'SHIP',cargo:PREFIX+'CARGO',input:PREFIX+'INPUT',window:PREFIX+'WINDOW',rejection:PREFIX+'REJECTION',shared:PREFIX+'SHARED',wrapper:PREFIX+'WRAPPER',storage:PREFIX+'STORAGE',publication:PREFIX+'PUBLICATION',stack:PREFIX+'STACK',denial:PREFIX+'DENIAL'};
const sizes=[{width:1440,height:1100},{width:390,height:844}];
const cases=['runtime-capture','dedupe-clear','sync-failure-retry','committed-publication','safe-copy','clipboard-denial','full-report-disclosure','fatal-startup'];
const expectedActions=['window-error','unhandled-rejection','settings-save','copy-error-report','startup','startup-rules','unknown'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const screenshotOptions={type:'jpeg',quality:78,fullPage:false,scale:'css'};
const report={suite:'Dev Tools diagnostics',startedAt:new Date().toISOString(),requestedCommit:process.env.TRAVELLER_COMMIT||null,declaredCases:cases.length*sizes.length,cases:[],errors:[],scope:'Eight focused scenarios at desktop/mobile widths. Real browser event capture, synchronous storage failure/retry, durable-write publication failure, native clipboard success, deterministic clipboard denial, safe payload, full-report disclosure and startup keyboard access. No campaign or persistence protocol changes; no broad fault matrix.'};
let browser;

function fixture(){const f=guiFixture();f.state.name=privateValues.campaign;f.state.ship.name=privateValues.ship;f.state.lots[0].description=privateValues.cargo;validate(f.state);return {...f,bytes:JSON.stringify(f.state)};}
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const read=async page=>JSON.parse(await raw(page));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const action=(page,name)=>page.locator('[data-action="'+name+'"]');
const date=value=>assert.ok(typeof value==='string'&&new Date(value).toISOString()===value,'Timestamp is an ISO instant');
function safeReport(text){
 assert.ok(!text.includes(PREFIX),'No campaign, input, message, stack, code or URL canary enters the safe copy');
 const value=JSON.parse(text);
 assert.deepEqual(Object.keys(value).sort(),['build','events','formatVersion','generatedAt']);
 assert.equal(value.formatVersion,1);assert.equal(value.build,BUILD);date(value.generatedAt);assert.ok(Array.isArray(value.events)&&value.events.length<=50);
 for(const event of value.events){
  const fields=['time','action','screen','code','outcome','committed',...(Object.hasOwn(event,'revision')?['revision']:[])];
  assert.deepEqual(Object.keys(event).sort(),fields.sort(),'Events contain only approved scalar metadata');date(event.time);
  assert.ok(expectedActions.includes(event.action),'Only fixed action categories used by these scenarios are allowed');
  assert.ok(['Overview','Trade','Cargo','Contracts','Accounts','Dashboard','History','Settings','Startup','Unknown'].includes(event.screen));
  if(event.code==='SAVE_NOT_COMMITTED'){assert.equal(event.outcome,'not-committed');assert.equal(event.committed,false);assert.equal(Object.hasOwn(event,'revision'),false);}
  else if(event.code==='SAVE_COMMITTED_PUBLICATION_FAILED'){assert.equal(event.outcome,'committed-publication-failed');assert.equal(event.committed,true);assert.ok(Number.isSafeInteger(event.revision)&&event.revision>=0);}
  else{assert.equal(event.code,'unknown');assert.equal(event.outcome,'unknown');assert.equal(event.committed,null);assert.equal(Object.hasOwn(event,'revision'),false);}
 }
 return value;
}
async function reveal(locator){for(const details of await locator.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click({position:{x:8,y:8}});}
async function closeModal(page){if(await page.locator('#modal').evaluate(el=>el.open)){await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});}}
async function openDev(page){await closeModal(page);if(!await action(page,'dev-tools').count())await page.locator('#tabs [data-arg="Settings"]').click();const button=action(page,'dev-tools');await reveal(button);await button.click();await page.getByRole('heading',{name:'TEMPORARY DEV TOOLS',exact:true}).waitFor();}
async function copySafe(page,{keyboard=false}={}){
 await page.evaluate(()=>navigator.clipboard.writeText('devtools-clipboard-waiting'));
 const button=page.getByRole('button',{name:'Copy Error Report',exact:true});
 assert.equal(await button.isEnabled(),true);
 if(keyboard){await button.focus();assert.equal(await button.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');}else await button.click();
 await page.waitForFunction(async()=>{try{return JSON.parse(await navigator.clipboard.readText()).formatVersion===1;}catch{return false;}});
 return safeReport(await page.evaluate(()=>navigator.clipboard.readText()));
}
async function copyFull(page){await page.evaluate(()=>navigator.clipboard.writeText('devtools-full-waiting'));await page.getByRole('button',{name:'Copy Debug Report',exact:true}).click();await page.waitForFunction(async()=>{try{return !!JSON.parse(await navigator.clipboard.readText()).campaign;}catch{return false;}});return JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));}
function jpegDimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8,'Screenshot is a JPEG');
 for(let offset=2;offset+9<bytes.length;){
  assert.equal(bytes[offset],0xff);const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);
  if([0xc0,0xc1,0xc2].includes(marker))return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)};
  assert.ok(length>=2);offset+=length+2;
 }
 throw Error('JPEG frame dimensions missing');
}
async function capture(page,result,label){
 await frames(page);const name='devtools-'+result.id+'-'+label+'.jpg';
 const bytes=await page.screenshot(screenshotOptions),dimensions=jpegDimensions(bytes);assert.deepEqual(dimensions,result.viewport,'Keep original-resolution full viewport screenshots');
 report.imageBytes=(report.imageBytes||0)+bytes.length;assert.ok(report.imageBytes<4*1024*1024,'Bound focused screenshot evidence below 4 MiB');await writeFile(join(artifacts,name),bytes);result.screenshots.push(name);
 result.frameProvenance.push({name,label,producerCommit:report.testedCommit,producerTree:report.testedTree,appSHA256:result.runtime?.appSHA256??report.sourceSHA256['app.mjs'],helperSHA256:result.runtime?.helperSHA256??report.sourceSHA256['debug-log.mjs'],gateSHA256:report.sourceSHA256['devtools-browser.test.mjs'],imageSHA256:hash(bytes),bytes:bytes.length,dimensions,viewport:result.viewport,encoding:screenshotOptions});
 const geometry=await page.evaluate(()=>{const dialog=document.querySelector('#modal[open]'),r=dialog?.getBoundingClientRect(),copy=[...document.querySelectorAll('button')].find(el=>el.textContent==='Copy Error Report'&&el.getClientRects().length),b=copy?.getBoundingClientRect();return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,dialog:r?{left:r.left,right:r.right,overflow:dialog.scrollWidth-dialog.clientWidth}:null,copy:b?{width:b.width,height:b.height}:null};});
 result.layouts.push(geometry);assert.ok(geometry.pageOverflow<=2,'No horizontal document overflow');
 if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=geometry.width+1,'Dialog fits original viewport');assert.ok(geometry.dialog.overflow<=2,'Dialog content has no horizontal clipping');}
 if(geometry.copy)assert.ok(geometry.copy.width>=44&&geometry.copy.height>=24,'Copy retains a usable native button target');
}
async function contextFor(result){
 const context=await browser.newContext({viewport:result.viewport,deviceScaleFactor:1,serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
 context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
 context.on('page',page=>{
  page.on('pageerror',error=>result.pageErrors.push(error.message));
  page.on('console',entry=>{if(entry.type()==='error')result.consoleErrors.push(entry.text());});
  page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')result.networkErrors.push(request.url()+': '+request.failure()?.errorText);});
  page.on('response',response=>{if(response.status()>=400)result.httpErrors.push({status:response.status(),pathname:new URL(response.url()).pathname});});
 });
 await context.addInitScript(({key,bytes,origin,storageMessage})=>{
  if(location.origin!==origin)return;
  if(!localStorage.getItem(key))localStorage.setItem(key,bytes);
  const native=Storage.prototype.setItem;
  globalThis.devtoolsStorage={attempts:0,writes:0,failNext:false,error:new DOMException(storageMessage,'QuotaExceededError')};
  Storage.prototype.setItem=function(name,value){
   if(this!==localStorage||name!==key)return Reflect.apply(native,this,[name,value]);
   const fault=devtoolsStorage;fault.attempts++;
   if(fault.failNext){fault.failNext=false;throw fault.error;}
   const result=Reflect.apply(native,this,[name,value]);fault.writes++;return result;
  };
 },{key:KEY,bytes:fixture().bytes,origin:new URL(base).origin,storageMessage:privateValues.storage});
 const map=fixture();
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===new URL(base).origin){
   if(result.name==='fatal-startup'&&url.pathname.endsWith('/rules/core-2022.json'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
   return route.continue();
  }
  if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
   assert.equal(url.searchParams.get('milieu'),'M1105');
   const headers={'Access-Control-Allow-Origin':'*'};
   if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:map.apiWorlds},headers});
   if(url.pathname.endsWith('/universe'))return route.fulfill({json:map.universe,headers});
   if(url.pathname.endsWith('/metadata'))return route.fulfill({json:map.metadata,headers});
   if(url.pathname.endsWith('/sec'))return route.fulfill({body:map.sec,headers});
  }
  result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
 });
 return context;
}
// These are genuine uncaught exceptions / unhandled promise rejections. Each
// intentional browser error must appear exactly once in Playwright's observer.
async function emit(page,result,{kind='throw',message=privateValues.window,reuse=false,wrapper=false}={}){
 const expected=wrapper?privateValues.wrapper:message;result.expectedPageErrors.push(expected);
 const observed=page.waitForEvent('pageerror');
 await page.evaluate(({kind,message,reuse,wrapper,wrapperMessage,stack})=>{
  let error=reuse?globalThis.devtoolsSharedError:null;
  if(!error){error=new Error(message);error.stack='Error: '+message+'\n at '+stack+' (https://private.invalid/'+stack+':1:1)';if(reuse)globalThis.devtoolsSharedError=error;}
  if(wrapper)error=new Error(wrapperMessage,{cause:error});
  // Unsupported metadata must not become a claimed durable result.
  if(!wrapper){error.code='DEVTOOLS_PRIVATE_UNRECOGNIZED_CODE';error.committed=true;error.revision=999;}
  if(kind==='rejection')void Promise.reject(error);else setTimeout(()=>{throw error;},0);
 },{kind,message,reuse,wrapper,wrapperMessage:privateValues.wrapper,stack:privateValues.stack});
 assert.equal((await observed).message,expected);await frames(page);
}
async function prepareSettings(page){await page.locator('#tabs [data-arg="Settings"]').click();const input=page.locator('#settings-form [name="name"]');await reveal(input);await input.fill(privateValues.input);await input.dispatchEvent('change');await page.evaluate(()=>{globalThis.devtoolsSubmittedForm=document.querySelector('#settings-form');});}
async function verifyRuntime(page,result){
 result.runtime=await page.evaluate(async()=>{
  const appURL=[...document.scripts].find(el=>el.type==='module'&&/\/app\.mjs(?:\?|$)/.test(el.src))?.src;if(!appURL)throw Error('Versioned app module missing');
  const appResponse=await fetch(appURL);if(!appResponse.ok)throw Error('App source unavailable');const source=await appResponse.text();
  const specifier=source.match(/import\s*\{[^}]*\bcreateDebugLog\b[^}]*\}\s*from\s*['"]([^'"]*debug-log\.mjs[^'"]*)['"]/u)?.[1];if(!specifier)throw Error('Runtime diagnostic helper import missing');
  const helperURL=new URL(specifier,appURL).href;if(!new URL(appURL).search||!new URL(helperURL).search)throw Error('Expected tagged app/helper modules');
  const helperResponse=await fetch(helperURL);if(!helperResponse.ok)throw Error('Diagnostic helper unavailable');
  const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(value=>value.toString(16).padStart(2,'0')).join('');
  return {appURL,helperURL,appSHA256:await digest(source),helperSHA256:await digest(await helperResponse.text()),nativeLocks:!!navigator.locks};
 });
 assert.equal(result.runtime.appSHA256,report.sourceSHA256['app.mjs']);assert.equal(result.runtime.helperSHA256,report.sourceSHA256['debug-log.mjs']);assert.equal(result.runtime.nativeLocks,true);
}
async function publicationFault(page){
 return page.evaluate(async message=>{
  const appURL=[...document.scripts].find(el=>el.type==='module'&&/\/app\.mjs(?:\?|$)/.test(el.src))?.src;
  if(!appURL)throw Error('Versioned app module missing');
  const response=await fetch(appURL),source=await response.text();
  const specifier=source.match(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]([^'"]*persistence\.mjs[^'"]*)['"]/u)?.[1];
  if(!specifier)throw Error('Runtime Store import missing');
  const storeURL=new URL(specifier,appURL).href;if(!new URL(storeURL).search)throw Error('Expected exact versioned Store');
  const {Store}=await import(storeURL),save=Store.prototype.save;
  globalThis.devtoolsPublication={calls:0,published:[]};
  Store.prototype.save=function(...args){
   devtoolsPublication.calls++;const notify=this.onChange;
   this.onChange=function(...values){const result=Reflect.apply(notify,this,values);devtoolsPublication.published.push(values[0].revision);throw Error(message);};
   try{return Reflect.apply(save,this,args);}finally{this.onChange=notify;}
  };
  return {appURL,storeURL};
 },privateValues.publication);
}
async function runBody(page,result){
 await page.goto(base);await verifyRuntime(page,result);
 if(result.name==='fatal-startup'){
  await page.getByText(/The calculator could not start/).waitFor();
  const copy=page.locator('#main').getByRole('button',{name:'Copy Error Report',exact:true});await copy.waitFor();
  assert.equal(await page.locator('#tabs [data-arg="Settings"]').count(),0,'Copy is reachable before normal app navigation exists');
  const bytes=await raw(page),safe=await copySafe(page,{keyboard:true});assert.equal(safe.events.length,1);assert.match(safe.events[0].action,/^startup(?:-rules)?$/);assert.equal(safe.events[0].screen,'Startup');assert.equal(safe.events[0].committed,null);assert.equal(await raw(page),bytes);assert.equal(await page.evaluate(()=>devtoolsStorage.writes),0);
  result.safeReport=safe;result.checks.push('Failed real rules HTTP request exposes keyboard-operable Copy without a Store or rules data');await capture(page,result,'startup');return;
 }
 await page.getByText('Editing in this tab',{exact:true}).waitFor();await frames(page);
 const original=await raw(page);
 assert.equal(await page.evaluate(()=>devtoolsStorage.writes),0,'Already-migrated synthetic fixture has no startup writes');
 if(result.name==='runtime-capture'){
  await emit(page,result);await emit(page,result,{kind:'rejection',message:privateValues.rejection});await openDev(page);
  const safe=await copySafe(page);assert.equal(safe.events.length,2);assert.deepEqual(safe.events.map(event=>event.action),['window-error','unhandled-rejection']);assert.ok(safe.events.every(event=>event.screen==='Overview'&&event.committed===null));result.safeReport=safe;
  const text=await page.locator('#modal-body').textContent();assert.ok(text.includes(privateValues.window)&&text.includes(privateValues.rejection),'Local recent-error display retains useful raw detail');result.checks.push('Real uncaught/rejection events captured once; unknown metadata stays unknown; local detail remains visible');
 }else if(result.name==='dedupe-clear'){
  await emit(page,result,{message:privateValues.shared,reuse:true});await emit(page,result,{kind:'rejection',message:privateValues.shared,reuse:true});await emit(page,result,{message:privateValues.shared,reuse:true,wrapper:true});await emit(page,result,{message:privateValues.shared});await openDev(page);
  assert.equal((await copySafe(page)).events.length,2,'Same identity and its wrapper dedupe; a distinct Error with the same message is separate');
  await page.getByRole('button',{name:'Clear Error Log',exact:true}).click();assert.equal((await copySafe(page)).events.length,0);await closeModal(page);
  await emit(page,result,{message:privateValues.shared,reuse:true});await openDev(page);result.safeReport=await copySafe(page);assert.equal(result.safeReport.events.length,1,'Clear resets occurrence identity tracking');result.checks.push('Identity/cause dedupe, separate equal-text errors, Clear and post-clear recapture leave campaign bytes unchanged');
 }else if(result.name==='sync-failure-retry'){
  await prepareSettings(page);
  for(let attempt=1;attempt<=2;attempt++){
   await page.evaluate(()=>{devtoolsStorage.failNext=true;});await page.locator('#settings-save').click();await page.locator('#settings-error').filter({hasText:privateValues.storage}).waitFor();
   assert.equal(await raw(page),original);assert.equal(await page.locator('#settings-form [name="name"]').inputValue(),privateValues.input);assert.equal(await page.locator('#settings-form').evaluate(el=>el===devtoolsSubmittedForm),true);assert.equal(await page.locator('#settings-save').isEnabled(),true);
   await openDev(page);const safe=await copySafe(page);assert.equal(safe.events.length,attempt,'One diagnostic per distinct failed save attempt');assert.ok(safe.events.every(event=>event.action==='settings-save'&&event.screen==='Settings'&&event.code==='SAVE_NOT_COMMITTED'&&event.committed===false));result.safeReport=safe;await closeModal(page);
  }
  await page.locator('#settings-save').click();await page.locator('#message').filter({hasText:'Ship / trader settings saved.'}).waitFor();const saved=await read(page),before=JSON.parse(original);assert.equal(saved.name,privateValues.input);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
  for(const key of ['bank','ledger','lots','contracts','policies','snapshots','route','routeIndex','actual','hours','dashboardBaseline'])assert.deepEqual(saved[key],before[key],key+' unchanged by Settings retry');
  assert.deepEqual(await page.evaluate(()=>({attempts:devtoolsStorage.attempts,writes:devtoolsStorage.writes})),{attempts:3,writes:1});await openDev(page);assert.equal((await copySafe(page)).events.length,2);result.checks.push('Two synchronous native setItem failures preserve exact bytes, same form/input and retry; third attempt commits once');
 }else if(result.name==='committed-publication'){
  await prepareSettings(page);Object.assign(result.runtime,await publicationFault(page));await page.locator('#settings-save').click();await page.locator('#save-status').filter({hasText:/Reload/}).waitFor();
  const saved=await read(page),before=JSON.parse(original);assert.equal(saved.revision,before.revision+1);assert.equal(saved.name,privateValues.input);assert.deepEqual(await page.evaluate(()=>({calls:devtoolsPublication.calls,published:devtoolsPublication.published,writes:devtoolsStorage.writes})),{calls:1,published:[saved.revision],writes:1});assert.equal(await page.locator('#takeover').isDisabled(),true);
  const committed=await raw(page);await openDev(page);const safe=await copySafe(page);assert.equal(safe.events.length,1,'Publication failure and reload handling share one occurrence');assert.deepEqual({...safe.events[0],time:undefined},{time:undefined,action:'settings-save',screen:'Settings',code:'SAVE_COMMITTED_PUBLICATION_FAILED',outcome:'committed-publication-failed',committed:true,revision:saved.revision});assert.equal(await raw(page),committed);result.safeReport=safe;result.checks.push('Real Store writes once before actual publication callback throws; safe copy retains authoritative committed revision and reload-only behavior');
 }else if(result.name==='safe-copy'){
  await prepareSettings(page);await emit(page,result);await openDev(page);const safe=await copySafe(page,{keyboard:true});assert.equal(safe.events.length,1);assert.equal(safe.events[0].screen,'Settings');assert.equal(safe.events[0].code,'unknown');result.safeReport=safe;result.checks.push('Native clipboard success and keyboard activation; strict safe schema excludes campaign/input/message/stack/unknown-code sentinels');
 }else if(result.name==='clipboard-denial'){
  await prepareSettings(page);await emit(page,result);await openDev(page);const before=await copySafe(page);
  await page.evaluate(message=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException(message,'NotAllowedError');}}});},privateValues.denial);
  await page.getByRole('button',{name:'Copy Error Report',exact:true}).click();await page.getByRole('heading',{name:'Error report',exact:true}).waitFor();const output=page.locator('#error-report-output');await output.waitFor();
  assert.equal(await output.getAttribute('readonly'),'');const safe=safeReport(await output.inputValue());assert.deepEqual(safe.events,before.events,'Fallback preserves the report requested before clipboard denial');await page.waitForFunction(()=>{const el=document.querySelector('#error-report-output');return el&&el.selectionStart===0&&el.selectionEnd===el.value.length;});assert.equal(await output.evaluate(el=>el===document.activeElement),true,'Fallback text is focused and fully selected for manual copy');result.safeReport=safe;result.checks.push('Deterministic clipboard API denial opens a focused, selected, readonly safe report without raw error or campaign leakage');
 }else if(result.name==='full-report-disclosure'){
  await emit(page,result);await openDev(page);const disclosure=await page.locator('#modal-body').innerText();assert.match(disclosure,/Full Debug Report, Debug Link and Debug JSON include campaign details[\s\S]*raw error text\./);
  for(const name of ['Copy Debug Report','Create Debug Link','Export Debug JSON'])assert.equal(await page.getByRole('button',{name,exact:true}).isVisible(),true);
  const full=await copyFull(page);assert.equal(full.campaign.name,privateValues.campaign);assert.equal(full.ship.name,privateValues.ship);assert.equal(full.cargo[0].description,privateValues.cargo);assert.equal(full.errors.length,1);assert.equal(full.errors[0].message,privateValues.window);assert.ok(full.errors[0].stack.includes(privateValues.stack));result.checks.push('Visible disclosure identifies campaign details and raw error text; all detailed controls remain and full copy preserves those details');
 }else throw Error('Unknown scenario '+result.name);
 if(!['sync-failure-retry','committed-publication'].includes(result.name)){assert.equal(await raw(page),original,'Diagnostic and copy actions do not mutate saved campaign');assert.equal(await page.evaluate(()=>devtoolsStorage.writes),0);}
 await capture(page,result,result.name);
}
async function writeReport(){await writeFile(join(artifacts,'devtools-report.json'),JSON.stringify(report,null,2)+'\n');}
async function runCase(name,viewport){
 const result={id:name+'-'+viewport.width,name,viewport,status:'running',checks:[],screenshots:[],frameProvenance:[],layouts:[],pageErrors:[],expectedPageErrors:[],consoleErrors:[],networkErrors:[],httpErrors:[],unexpectedRequests:[],errors:[]};report.cases.push(result);let context;
 try{
  context=await contextFor(result);const page=await context.newPage();await runBody(page,result);await frames(page);assert.deepEqual(result.pageErrors,result.expectedPageErrors,'Only the exact intentionally injected uncaught errors are allowed');assert.deepEqual(result.networkErrors,[]);assert.deepEqual(result.unexpectedRequests,[]);
  if(name==='fatal-startup'){assert.deepEqual(result.httpErrors,[{status:503,pathname:new URL('rules/core-2022.json',base).pathname}]);assert.equal(result.consoleErrors.length,1);assert.match(result.consoleErrors[0],/^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/);}else{assert.deepEqual(result.httpErrors,[]);assert.deepEqual(result.consoleErrors,[]);}
  result.status='passed';
 }catch(error){result.status='failed';result.errors.push(error.stack||String(error));if(context?.pages()[0])await capture(context.pages()[0],result,'failure').catch(()=>{});}
 finally{await context?.close();await writeReport();}
 console.log(result.status.toUpperCase()+': '+result.id);for(const error of result.errors)console.error(error);
}

report.sourceSHA256=Object.fromEntries(await Promise.all([['app.mjs','../js/app.mjs'],['debug-log.mjs','../js/debug-log.mjs'],['persistence.mjs','../js/persistence.mjs'],['index.html','../index.html'],['devtools-browser.test.mjs','./devtools-browser.test.mjs']].map(async([name,path])=>[name,hash(await readFile(new URL(path,import.meta.url)))])));
if(process.argv.includes('--fixtures-only')){
 const f=fixture();validate(JSON.parse(f.bytes));assert.equal(f.state.name,privateValues.campaign);assert.equal(f.state.dashboardBaseline.version,1);assert.equal(new Set(cases).size,8);assert.equal(sizes.length,2);
 const example={formatVersion:1,build:BUILD,generatedAt:'2026-10-11T00:00:00.000Z',events:[{time:'2026-10-11T00:00:00.000Z',action:'settings-save',screen:'Settings',code:'SAVE_NOT_COMMITTED',outcome:'not-committed',committed:false}]};safeReport(JSON.stringify(example));assert.throws(()=>safeReport(JSON.stringify({...example,message:'unsafe'})));assert.throws(()=>safeReport(JSON.stringify({...example,events:[{...example.events[0],message:'unsafe'}]})));
 const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(app,/dev-copy-errors/);assert.match(app,/Copy Error Report/);assert.match(app,/error-report-output/);assert.match(app,/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*['"]\.\/persistence\.mjs\?[^'"]+['"]/);
 assert.match(app,/import\s*\{[^}]*\bcreateDebugLog\b[^}]*\}\s*from\s*['"]\.\/debug-log\.mjs\?[^'"]+['"]/);assert.deepEqual(jpegDimensions(Buffer.from([255,216,255,192,0,11,8,0,100,0,200,1,1,17,0,255,217])),{width:200,height:100});
 console.log('PASS: synthetic Dev Tools fixtures, strict safe-report assertions, runtime Store discovery and Copy action wiring; 8 scenarios x 2 original viewport sizes. Chromium was not loaded or launched.');
}else{
 await mkdir(artifacts,{recursive:true});
 try{report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.ok(report.requestedCommit,'Set TRAVELLER_COMMIT for exact-head CI evidence');assert.equal(report.testedCommit,report.requestedCommit);report.testedTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();report.workingTree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();assert.equal(report.workingTree,'','Browser evidence requires clean exact head');const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});report.browser={name:'Chromium',version:browser.version()};for(const viewport of sizes)for(const name of cases)await runCase(name,viewport);}
 catch(error){report.errors.push(error.stack||String(error));}
 finally{await browser?.close();report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0&&report.cases.length===report.declaredCases&&report.cases.every(result=>result.status==='passed');await writeReport();}
 if(!report.passed)throw Error('Dev Tools browser checks failed; see verification-artifacts/devtools-report.json');
 console.log('PASS: 16 desktop/mobile Dev Tools checks; bounded JPEG screenshots and exact-head report.');
}
