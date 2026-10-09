// Real Chromium regression for optional imported insurance amendment history.
// Only the initial synthetic campaign is seeded. Policy purchases, JSON downloads and
// file imports, claims, policy changes, settings and Undo use the rendered app.
// External Traveller Map responses are deterministic; no player data is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as S from '../js/state.mjs';

const require=createRequire(import.meta.url);
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const KEY='traveller-trade-route-calculator:v1';
const origin={id:'-110,-70',x:-110,y:-70,name:'Insurance Origin',sector:'Spinward Marches',hex:'1910',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'-111,-70',x:-111,name:'Insurance Destination',hex:'1810'};
const extension={...origin,id:'-110,-69',y:-69,name:'Insurance Extension',hex:'1911'};
const worlds=[origin,destination,extension];
const mapWorlds=worlds.map(w=>({Name:w.name,Hex:w.hex,UWP:w.uwp,PBG:'703',Zone:'',WorldX:w.x,WorldY:w.y,Sector:w.sector}));
const expectedCases=['amend-desktop','close-desktop','amend-mobile','close-mobile','malformed-history-import','invalid-numeric-import','arrived-cargo-correction','freight-audit-dice','cancel-and-read-only'];
const summary={suite:'Insurance real-browser verification',startedAt:new Date().toISOString(),baseURL:base,node:process.version,requestedCommit:process.env.TRAVELLER_COMMIT||null,githubSHA:process.env.GITHUB_SHA||null,cases:[],errors:[],expectedCases};
let browser;
await mkdir(artifacts,{recursive:true});

function campaign(){
 const state=S.initial();
 Object.assign(state,{initialized:true,name:'Disposable insurance browser verification',bank:'1000000',actual:origin.id,worlds:Object.fromEntries(worlds.map(w=>[w.id,structuredClone(w)])),route:[origin.id,destination.id]});
 state.lots=[{id:'insured-lot',commodity:'11',description:'Synthetic insured goods',quantity:'10',basis:'110000',goodsValue:'100000'}];
 return S.validate(state);
}
const errorText=error=>error?.stack||String(error);
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
const modal=page=>page.locator('#modal[open]');
const tab=(page,name)=>page.locator('#tabs').getByRole('button',{name,exact:true}).click();
const fill=(page,name,value)=>modal(page).locator('[name="'+name+'"]').fill(String(value));
const campaignData=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','undo'].includes(key)));
function restored(actual,expected){
 assert.deepEqual(campaignData(actual),campaignData(expected),'Undo restores all campaign fields except its append-only audit metadata');
 assert.deepEqual(actual.undo,expected.undo,'Undo restores the complete prior undo stack');
}
async function submit(page,label,nextTitle=null){
 await modal(page).getByRole('button',{name:label,exact:true}).click();
 await page.waitForFunction(next=>{
  const dialog=document.querySelector('#modal');
  return !dialog.open||Boolean(document.querySelector('#modal-error').textContent)||(next&&document.querySelector('#modal-title').textContent===next);
 },nextTitle);
 assert.equal(await page.locator('#modal-error').textContent(),'','The actual UI callback must finish without an error');
 if(nextTitle)await page.getByRole('heading',{name:nextTitle,exact:true}).waitFor();
 else await page.locator('#modal').waitFor({state:'hidden'});
}
async function cancel(page){await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});}
async function closeAudit(page){await modal(page).getByRole('button',{name:'Close',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});}
async function undo(page){await tab(page,'History');await page.getByRole('button',{name:'Undo latest change',exact:true}).click();await tab(page,'Cargo');}
async function reload(page){await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Recover saved campaign',exact:true}).count(),0);await tab(page,'Cargo');}
async function insure(page){
 await tab(page,'Cargo');const before=await read(page);
 await page.locator('[data-action="lot-insure"][data-arg="insured-lot"]').click();
 await modal(page).locator('[name="coverage"]').selectOption('70');
 await submit(page,'Preview insurance','Confirm cargo insurance');
 await page.getByRole('dialog',{name:'Confirm cargo insurance',exact:true}).waitFor();
 assert.deepEqual(await read(page),before,'Insurance preview does not persist a debit');
 await submit(page,'COMMIT INSURANCE');
 const after=await read(page),policy=after.policies[0];
 assert.equal(policy.status,'active');assert.equal(policy.coverage,70);
 assert.equal(after.bank,String(BigInt(before.bank)-BigInt(policy.premium)));
 assert.equal(after.lots[0].basis,String(BigInt(before.lots[0].basis)+BigInt(policy.premium)));
 assert.equal(after.lots[0].goodsValue,before.lots[0].goodsValue);assert.equal(after.lots[0].quantity,before.lots[0].quantity);
 return after;
}
async function exported(page){
 await tab(page,'Settings');
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Save campaign (JSON)',exact:true}).click();
 const download=await downloaded,stream=await download.createReadStream();
 assert.ok(stream,'Export creates a real JSON download');
 const chunks=[];for await(const chunk of stream)chunks.push(chunk);
 assert.equal(await download.failure(),null);
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function importFile(page,state,name='synthetic-insurance-backup.json'){
 await page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
}
async function imported(page,state){
 S.validate(structuredClone(state));
 await importFile(page,state);
 await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();
 await modal(page).locator('[name="backed"]').check();await submit(page,'Replace campaign');
 await tab(page,'Cargo');
}
async function importedWithoutHistory(page,{extendRoute=false}={}){
 await insure(page);const source=await exported(page);delete source.policies[0].amendments;
 // A longer planned route may extend beyond this policy's original destination.
 // The amendment must adopt that route while retaining original terms in audit.
 if(extendRoute)source.route.push(extension.id);
 await imported(page,source);const before=await read(page);
 assert.equal(Object.hasOwn(before.policies[0],'amendments'),false,'Import preserves the omitted optional member');
 assert.deepEqual(before.policies,source.policies);assert.equal(before.bank,source.bank);
 await reload(page);assert.deepEqual(await read(page),before,'Accepted imported policy reloads without rewriting it');
 return before;
}
async function openAmend(page,mode,adjustment){
 await tab(page,'Cargo');await page.locator('[data-action="amend"]').click();
 await modal(page).locator('[name="mode"]').selectOption(mode);
 await fill(page,'adjustment',adjustment);await fill(page,'reason','Approved imported-policy '+mode);
 await modal(page).locator('[name="approved"]').check();
}
async function claim(page,quantity){
 await tab(page,'Cargo');await page.locator('[data-action="claim"]').click();
 await fill(page,'quantity',quantity);await fill(page,'reason','Synthetic approved loss');
 await modal(page).locator('[name="approved"]').check();
 const before=await read(page);await submit(page,'Preview claim','Confirm loss and claim');
 assert.deepEqual(await read(page),before,'Claim preview does not remove cargo or pay');
 await submit(page,'Commit loss & claim');
 const after=await read(page),policy=after.policies[0];
 assert.equal(policy.claims.at(-1).payout,String(quantity*7000));
 assert.equal(after.bank,String(BigInt(before.bank)+BigInt(quantity*7000)));
 assert.equal(policy.remainingQuantity,String(Number(before.policies[0].remainingQuantity)-quantity));
 assert.equal(after.ledger.at(-1).type,'Insurance claim');
 return after;
}
async function insuranceSetting(page,enabled){
 await tab(page,'Settings');const input=page.locator('#settings-form [name="insurance"]');
 for(const details of await input.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
 await input.setChecked(enabled);await page.locator('#settings-save').click();
 await page.waitForFunction(({key,enabled})=>JSON.parse(localStorage.getItem(key)).settings.insurance===enabled,{key:KEY,enabled});
 assert.equal(await page.locator('#settings-error').textContent(),'');
}
async function screenshot(page,result,name){await page.screenshot({path:join(artifacts,name),fullPage:true});result.screenshots.push(name);}
async function runCase(id,viewport,body){
 const result={id,status:'running',startedAt:new Date().toISOString(),errors:[],pageErrors:[],unexpectedRequests:[],screenshots:[]};summary.cases.push(result);
 let context,traceStarted=false;
 try{
  context=await browser.newContext({viewport,acceptDownloads:true,serviceWorkers:'block'});context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(20000);
  context.on('page',page=>page.on('pageerror',error=>result.pageErrors.push(errorText(error))));
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});traceStarted=true;
  await context.addInitScript(({key,state,appOrigin})=>{
   if(location.origin===appOrigin&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
  },{key:KEY,state:campaign(),appOrigin:new URL(base).origin});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
   if(url.origin==='https://travellermap.com'&&url.pathname.startsWith('/api/')){
    const headers={'Access-Control-Allow-Origin':'*'};
    if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:mapWorlds},headers});
    if(url.pathname.endsWith('/universe'))return route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin',X:-4,Y:-1}]},headers});
    if(url.pathname.endsWith('/metadata'))return route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'}],Borders:[]},headers});
    if(url.pathname.endsWith('/sec'))return route.fulfill({json:'Hex\tName\r\n'+mapWorlds.map(w=>w.Hex+'\t'+w.Name).join('\r\n'),headers});
   }
   result.unexpectedRequests.push(url.href);return route.abort('blockedbyclient');
  });
  const page=await context.newPage();await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  await body(page,context,result);
  assert.deepEqual(result.pageErrors,[],'No uncaught browser errors');assert.deepEqual(result.unexpectedRequests,[],'No live external network dependencies');
  result.status='passed';
 }catch(error){
  result.status='failed';result.errors.push(errorText(error));
  for(const [index,page]of(context?.pages()||[]).entries())if(!page.isClosed())try{await screenshot(page,result,'insurance-'+id+'-failure-'+index+'.png');}catch(captureError){result.errors.push(errorText(captureError));}
 }finally{
  if(traceStarted){result.trace='insurance-'+id+'-trace.zip';try{await context.tracing.stop({path:join(artifacts,result.trace)});}catch(error){result.status='failed';result.errors.push(errorText(error));}}
  if(context)try{await context.close();}catch(error){result.status='failed';result.errors.push(errorText(error));}
  result.finishedAt=new Date().toISOString();console.log(result.status.toUpperCase()+': '+id);for(const error of result.errors)console.error(error);
 }
}

try{
 summary.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(summary.requestedCommit)assert.equal(summary.testedCommit,summary.requestedCommit,'Test the exact requested PR head');
 const {chromium}=require(process.argv[2]||'playwright');
 browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
 summary.browser={name:'Chromium',version:browser.version(),channel:process.env.TRAVELLER_BROWSER_CHANNEL||'bundled'};
 for(const [size,viewport]of [['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}]]){
  for(const mode of ['amend','close'])await runCase(mode+'-'+size,viewport,async(page,context,result)=>{
   const before=await importedWithoutHistory(page,{extendRoute:mode==='amend'}),original=before.policies[0];
   // A claim on the omitted-field import must also round-trip independently.
   if(mode==='amend'){
    const claimed=await claim(page,2);assert.equal(Object.hasOwn(claimed.policies[0],'amendments'),false);
    await reload(page);assert.deepEqual(await read(page),claimed);await undo(page);restored(await read(page),before);
   }
   const adjustment=mode==='amend'?1234:-1234;
   await openAmend(page,mode,adjustment);await submit(page,'Save');
   const after=await read(page),policy=after.policies[0];
   assert.equal(after.bank,String(BigInt(before.bank)-BigInt(adjustment)));
   assert.equal(after.lots[0].basis,String(BigInt(before.lots[0].basis)+BigInt(adjustment)));
   assert.equal(after.lots[0].quantity,before.lots[0].quantity);assert.equal(after.lots[0].goodsValue,before.lots[0].goodsValue);
   for(const key of ['premium','insuredValue','initialQuantity','coverage'])assert.equal(policy[key],original[key],key+' retains original terms');
   assert.equal(policy.amendments.length,1);assert.deepEqual(policy.amendments[0],{hours:before.hours,reason:'Approved imported-policy '+mode,previous:{route:original.route,destination:original.destination,status:original.status},adjustment:String(adjustment)});
   assert.equal(policy.status,mode==='close'?'closed':'active');
   assert.equal(policy.remainingQuantity,mode==='close'?'0':original.remainingQuantity);assert.equal(policy.remainingValue,mode==='close'?'0':original.remainingValue);
   assert.equal(after.ledger.length,before.ledger.length+1);assert.equal(after.ledger.at(-1).type,'Insurance amendment');assert.equal(after.ledger.at(-1).amount,String(-BigInt(adjustment)));
   if(mode==='amend'){assert.deepEqual(policy.route,before.route);assert.equal(policy.destination,extension.id);assert.equal(policy.routeProgress,0);}
   const backup=await exported(page);assert.deepEqual(backup,after);S.validate(backup);
   await reload(page);assert.deepEqual(await read(page),after,'Amended/closed state and undo survive reload');
   // Imported backups must retain the same undo capability as a plain reload.
   await imported(page,backup);assert.deepEqual(campaignData(await read(page)),campaignData(after));
   if(mode==='amend'){
    const claimed=await claim(page,2);assert.equal(claimed.policies[0].remainingQuantity,'8');assert.equal(claimed.lots[0].goodsValue,'80000');
    await reload(page);assert.deepEqual(await read(page),claimed);await undo(page);restored(await read(page),after);
   }else{
    assert.equal(await page.locator('[data-action="amend"]').count(),0,'Closed policy leaves active controls');
    await insuranceSetting(page,false);await tab(page,'History');
    await page.getByRole('heading',{name:'Closed cargo insurance',exact:true}).waitFor();
    await page.locator('[data-action="policy-audit"]').click();assert.equal(await page.locator('#modal-submit').isVisible(),false);
    assert.match(await modal(page).innerText(),/Approved imported-policy close/);assert.match(await modal(page).innerText(),/Previous destination/);
    await screenshot(page,result,'insurance-closed-audit-'+size+'.png');await closeAudit(page);
    await undo(page);restored(await read(page),after);
   }
   await undo(page);const undone=await read(page);restored(undone,before);
   assert.equal(Object.hasOwn(undone.policies[0],'amendments'),false,'Undo removes the newly introduced optional field');
   await reload(page);assert.deepEqual(await read(page),undone,'The original omitted-field state remains loadable after Undo');
   await screenshot(page,result,'insurance-restored-'+mode+'-'+size+'.png');
  });
 }
 await runCase('malformed-history-import',{width:1440,height:1100},async page=>{
  await insure(page);const valid=await exported(page),before=await raw(page);
  for(const [index,value]of[null,{},'invalid',0,false].entries()){
   const bad=structuredClone(valid);bad.policies[0].amendments=value;
   assert.throws(()=>S.validate(bad),/Invalid policy amendments/);
   // Watch for a new status mutation: the identical previous error text must
   // not let a later asynchronous file import pass before its callback runs.
   await page.evaluate(()=>{
    globalThis.insuranceImportReported=false;
    const status=document.querySelector('#message');
    const observer=new MutationObserver(()=>{
     if(status.textContent.includes('Invalid policy amendments')){observer.disconnect();globalThis.insuranceImportReported=true;}
    });
    observer.observe(status,{childList:true,characterData:true,subtree:true});
   });
   await importFile(page,bad,'invalid-insurance-'+index+'.json');
   await page.waitForFunction(()=>globalThis.insuranceImportReported);
   await page.locator('#message').filter({hasText:'Invalid policy amendments'}).waitFor();
   assert.equal(await page.locator('#modal[open]').count(),0,'Invalid import never offers replacement');
   assert.equal(await raw(page),before,'Malformed amendment history does not change stored data');
  }
  await reload(page);assert.equal(await raw(page),before);
 });
 await runCase('invalid-numeric-import',{width:1440,height:1100},async(page,context,result)=>{
  await insure(page);const valid=await exported(page),before=await raw(page);
  for(const [index,change]of [
   s=>{s.policies[0].premium='not a number';},
   s=>{s.policies[0].premium='12.5';},
   s=>{s.policies[0].rate='unknown';},
   s=>{s.lots[0].audit={price:{audit:{quantityRolls:[{dice:[2,4],populationDM:'three',multiplier:10,tons:90}]}}};},
  ].entries()){
   const bad=structuredClone(valid);change(bad);assert.throws(()=>S.validate(bad));
   await page.locator('#message').evaluate(el=>el.textContent='');
   await importFile(page,bad,'invalid-numeric-'+index+'.json');
   await page.waitForFunction(()=>Boolean(document.querySelector('#message').textContent));
   assert.equal(await page.locator('#modal[open]').count(),0);
   assert.equal(await raw(page),before,'Rejected numeric import never replaces saved bytes');
  }
  await reload(page);assert.equal(await raw(page),before);
  await page.locator('[data-action="policy-audit"]').click();
  await page.getByRole('dialog',{name:'Insurance policy',exact:true}).waitFor();
  await screenshot(page,result,'audit-named-insurance-dialog.png');await closeAudit(page);
 });
 await runCase('arrived-cargo-correction',{width:390,height:844},async(page,context,result)=>{
  await insure(page);await tab(page,'Overview');await page.locator('[data-action="jump"]').click();
  await fill(page,'hours',0);await submit(page,'COMMIT JUMP');
  const arrived=await read(page),original=arrived.policies[0];assert.equal(original.status,'arrived');
  for(const remaining of [5,0]){
   if(remaining===0)await imported(page,arrived);
   const before=await read(page);await tab(page,'Cargo');await page.locator('[data-action="lot-correct"]').click();
   await fill(page,'quantity',remaining);await fill(page,'basis',remaining?50000:0);await fill(page,'goods',remaining?50000:0);await fill(page,'reason','Uninsured loss after coverage ended');await submit(page,'Save');
   const after=await read(page),policy=after.policies[0];assert.equal(policy.remainingQuantity,String(remaining));assert.equal(policy.remainingValue,String(remaining?50000:0));assert.equal(policy.status,remaining?'arrived':'closed');
   for(const key of ['premium','coverage','initialQuantity','insuredValue','claims','amendments'])assert.deepEqual(policy[key],original[key]);
   assert.equal(after.bank,before.bank);assert.deepEqual(after.ledger,before.ledger);
   await reload(page);assert.deepEqual(await read(page),after);await undo(page);restored(await read(page),before);
  }
  await screenshot(page,result,'audit-arrived-policy-correction-mobile.png');
 });
 await runCase('freight-audit-dice',{width:1440,height:1100},async(page,context,result)=>{
  for(const die of [1,2,3,4,5,6]){
   const start=campaign();start.actual=destination.id;start.hours=11;
   start.contracts=[{id:'audit-freight',kind:'freight',status:'accepted',origin:origin.id,destination:destination.id,quantity:'1',payment:'10000',dueHours:10}];
   await imported(page,start);await tab(page,'Contracts');await page.locator('[data-action="deliver"]').click();await fill(page,'die',die);await submit(page,'Commit delivery & payout');
   const paid=await read(page),entry=paid.ledger.at(-1);assert.equal(entry.penaltyDie,die);assert.equal(entry.amount,String(10000*(6-die)/10));
   await tab(page,'Accounts');await page.locator('[data-action="ledger-audit"][data-arg="'+entry.id+'"]').click();
   await page.getByRole('dialog',{name:'Freight delivery details',exact:true}).waitFor();
   const roll=modal(page).locator('dt').filter({hasText:/^Late-penalty roll$/}).locator('xpath=following-sibling::dd[1]');assert.equal(await roll.textContent(),String(die));
   if(die===2)await screenshot(page,result,'audit-freight-penalty-details.png');await closeAudit(page);
   if(die===2){
    for(const recorded of [true,false]){
     const older=structuredClone(paid);delete older.ledger.at(-1).penaltyDie;if(!recorded)delete older.contracts[0].penaltyDie;
     await imported(page,older);await tab(page,'Accounts');await page.locator('[data-action="ledger-audit"][data-arg="'+entry.id+'"]').click();
     assert.equal(await modal(page).locator('dt').filter({hasText:/^Late-penalty roll$/}).locator('xpath=following-sibling::dd[1]').textContent(),recorded?'2':'Not recorded');await closeAudit(page);
    }
   }
  }
 });
 await runCase('cancel-and-read-only',{width:1440,height:1100},async(page,context)=>{
  const before=await importedWithoutHistory(page),bytes=await raw(page);
  await openAmend(page,'close',1234);await cancel(page);assert.equal(await raw(page),bytes,'Cancel leaves the optional field absent');
  await page.locator('[data-action="claim"]').click();await fill(page,'quantity',2);await fill(page,'reason','Cancelled synthetic claim');await modal(page).locator('[name="approved"]').check();
  await submit(page,'Preview claim','Confirm loss and claim');await cancel(page);assert.equal(await raw(page),bytes);
  const reader=await context.newPage();await reader.goto(base);await reader.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await tab(reader,'Cargo');
  for(const action of ['amend','claim'])assert.equal(await reader.locator('[data-action="'+action+'"]').isDisabled(),true,'Read-only '+action+' remains disabled');
  await reader.locator('[data-action="policy-audit"]').click();await reader.getByRole('dialog',{name:'Insurance policy',exact:true}).waitFor();assert.equal(await reader.locator('#modal-submit').isVisible(),false);assert.match(await modal(reader).innerText(),/No amendments recorded/);await closeAudit(reader);
  assert.deepEqual(await read(reader),before);
 });
}catch(error){summary.errors.push(errorText(error));console.error(errorText(error));}
finally{
 if(browser)try{await browser.close();}catch(error){summary.errors.push(errorText(error));}
 summary.finishedAt=new Date().toISOString();summary.passed=summary.errors.length===0&&summary.cases.length===expectedCases.length&&expectedCases.every(id=>summary.cases.some(c=>c.id===id&&c.status==='passed'));
 await writeFile(join(artifacts,'insurance-browser-summary.json'),JSON.stringify(summary,null,2)+'\n');
}
if(!summary.passed)throw Error('Insurance browser verification failed. See verification-artifacts/insurance-browser-summary.json and per-case traces/screenshots.');
console.log('PASS: all '+expectedCases.length+' insurance scenarios; desktop/mobile file imports, amendments/close, claims, reload, complete Undo and strict malformed-history rejection.');
