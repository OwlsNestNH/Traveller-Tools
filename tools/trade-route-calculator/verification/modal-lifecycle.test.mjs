import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const ctx=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const sample=[{Name:'Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},{Name:'Jenghe',Hex:'1810',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'},{Name:'Ruie',Hex:'1809',UWP:'C776977-7',PBG:'701',Zone:'A',WorldX:-111,WorldY:-71,Sector:'Spinward Marches'}];
await ctx.route('https://travellermap.com/api/jumpworlds?*',async route=>{const u=new URL(route.request().url());const rows=u.searchParams.get('jump')==='0'?sample.filter(w=>w.Hex===(u.searchParams.get('hex')||'1910')):sample;await route.fulfill({json:{Worlds:rows},headers:{'Access-Control-Allow-Origin':'*'}});});
await ctx.route('https://travellermap.com/api/universe?*',route=>route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin'},{Names:[{Text:'Empty Sector'}]}]}}));
await ctx.route('https://travellermap.com/api/metadata?*',route=>route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'},{Index:'A',Name:'Cronor'}]}}));
await ctx.route('https://travellermap.com/api/sec?*',route=>route.fulfill({json:'Hex\tName\r\n'+sample.map(w=>w.Hex+'\t'+w.Name).join('\r\n')}));
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=async label=>{if(['Plot route','Auto plot','Build route','Clear planned route'].includes(label)&&!await page.locator('#route-menu').evaluate(e=>e.open))await page.locator('#route-menu > summary').click();const modal=page.locator('#modal[open]');const target=modal.getByRole('button',{name:label,exact:true});if(await target.count())return target.click();return page.getByRole('button',{name:label,exact:true}).click();};
const fill=(name,value)=>page.locator('[name="'+name+'"]').fill(String(value));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
let gate=null;
await ctx.route('https://travellermap.com/api/jumpworlds?*',async route=>{
 const current=gate;
 if(!current||current.claimed)return route.fallback();
 current.claimed=true;current.started();await current.wait;
 await route.fulfill(current.fail?{status:503,body:'Temporarily unavailable'}:{json:{Worlds:sample}});current.finished();
});
function holdRequest(fail=false){
 let release,started,finished;const wait=new Promise(r=>release=r),start=new Promise(r=>started=r),done=new Promise(r=>finished=r);
 gate={wait,started,finished,release,fail,claimed:false};return {start,done,release};
}
async function finish(pending){pending.release();await pending.done;await page.waitForTimeout(100);gate=null;}
const openLocation=async()=>{await click('Overview');await page.locator('svg [data-arg="-111,-70"]').click();await click('Use as starting world');};
const invalidExpenses=async()=>{await click('Accounts');await page.locator('#main').getByRole('button',{name:'Ship expenses',exact:true}).click();await page.locator('[name="include-berthing"]').uncheck();assert.equal(await page.locator('#modal-submit').isDisabled(),true);};
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await click('Start campaign');await closed();
 const original=await read();
 for(const method of ['Cancel','Close dialog','Escape']){
  await openLocation();const pending=holdRequest();await click('Confirm starting world');await pending.start;
  assert.equal(await page.locator('#modal-submit').isDisabled(),true);
  // Even a second form submission must not start a duplicate request.
  await page.locator('#modal-form').evaluate(form=>form.requestSubmit());
  if(method==='Escape')await page.keyboard.press('Escape');else await click(method);
  await closed();await invalidExpenses();await finish(pending);
  assert.equal(await page.locator('#modal-title').textContent(),'Ship expenses');
  assert.equal(await page.locator('#modal-submit').isDisabled(),true);
  assert.equal(await page.locator('#modal-error').textContent(),'');assert.deepEqual(await read(),original);
  await click('Cancel');
 }
 // Late failures must not put their error into a replacement dialog.
 await openLocation();let pending=holdRequest(true);await click('Confirm starting world');await pending.start;
 await click('Cancel');await invalidExpenses();await finish(pending);
 assert.equal(await page.locator('#modal-error').textContent(),'');assert.equal(await page.locator('#modal-submit').isDisabled(),true);await click('Cancel');
 // A cancelled route lookup must not reopen its review dialog.
 await click('Overview');await click('Plot route');await page.locator('#route-destination').getByLabel('Subsector',{exact:true}).selectOption('C');await page.locator('#route-destination').getByLabel('World',{exact:true}).selectOption('1810');
 pending=holdRequest();await click('Calculate route');await pending.start;await click('Cancel');await invalidExpenses();await finish(pending);
 assert.equal(await page.locator('#modal-title').textContent(),'Ship expenses');assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.deepEqual(await read(),original);await click('Cancel');
 // Losing the editing lock invalidates an in-flight mutation.
 await openLocation();pending=holdRequest();await click('Confirm starting world');await pending.start;
 const second=await ctx.newPage();await second.goto(base);await second.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();await second.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
 assert.equal(await page.locator('#modal-submit').isDisabled(),true);await finish(pending);
 assert.equal(await page.locator('#modal-submit').isDisabled(),true);assert.match(await page.locator('#modal-error').textContent(),/Editing moved/);assert.deepEqual(await read(),original);await click('Cancel');
 // Read-only world browsing still works.
 await click('Find world');await page.locator('#find-world .picker-selection').getByText(/Hex/).waitFor();assert.equal(await page.locator('#modal-submit').isEnabled(),true);await click('Browse world');await closed();assert.deepEqual(await read(),original);
 await second.close();await page.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 // A fresh confirmation after taking over works normally.
 await openLocation();await click('Confirm starting world');await closed();assert.equal((await read()).actual,'-111,-70');
 // The actual app module can use new display wording without losing Credit
 // normalization or the review's accumulated rounding annotations.
 await ctx.route('**/js/app.mjs?*',async route=>{
  const response=await route.fetch();let source=await response.text();
  for(const [before,after]of [["field('amount','Deposit amount - Cr'","field('amount','Amount'"],["modal('Record deposit',","modal('Funds received',"],["modal('Confirm deposit',","modal('Incoming funds review',"]]){
   assert.ok(source.includes(before));source=source.replace(before,after);
  }
  await route.fulfill({response,body:source});
 });
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Accounts');const depositBefore=await read();
 for(const commit of [false,true]){
  await click('Record deposit');assert.equal(await page.locator('#modal-title').textContent(),'Funds received');
  const amount=page.getByLabel('Amount',{exact:true});
  assert.equal(await amount.getAttribute('type'),'number');assert.equal(await amount.getAttribute('data-round'),'credits');
  await amount.fill('10.1');await fill('reason','Renamed display metadata regression');await click('Preview deposit');
  assert.equal(await page.locator('#modal-title').textContent(),'Incoming funds review');
  assert.match(await page.locator('#rounding-input-note').textContent(),/Amount: 10.1 → 11/);
  await page.screenshot({fullPage:true,path:join(artifacts,'renamed-deposit-review.png')});
  if(commit)await page.locator('#modal-submit').click();else await click('Cancel');
  await closed();const after=await read();
  if(commit){
   assert.equal(after.bank,String(BigInt(depositBefore.bank)+11n));
   assert.equal(after.revision,depositBefore.revision+1);
   assert.equal(after.undo.at(-1).label,'Manual deposit');
  }else assert.deepEqual(after,depositBefore);
 }
 await click('History');await click('Undo latest change');
 const undone=await read();assert.equal(undone.bank,depositBefore.bank);assert.deepEqual(undone.ledger,depositBefore.ledger);
 assert.deepEqual(errors,[]);console.log('PASS: Cancel/close/Escape, duplicate submit, late success/error isolation, cancelled route, lock loss during request, read-only browsing fresh confirmation, renamed numeric labels/review titles, cancel/commit and deposit Undo.');
}finally{gate?.release();await browser.close();}

