import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
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
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=async label=>{const modal=page.locator('#modal[open]');const target=modal.getByRole('button',{name:label,exact:true});if(await target.count())return target.click();return page.getByRole('button',{name:label,exact:true}).click();};
const fill=(name,value)=>page.locator('[name="'+name+'"]').fill(String(value));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Set up campaign');await fill('bank','1000000');await click('Start campaign');await closed();
 assert.equal((await read()).bank,'1000000');
 await click('Find supplier');await fill('dice',12);await click('Preview search');await click('Commit search');await closed();
 assert.ok((await read()).snapshots[0].offers.length>=6);
 const offerId=(await read()).snapshots[0].offers[0].id;await page.locator('[data-expire="'+offerId+'"]').click();assert.equal((await read()).snapshots[0].offers.filter(o=>o.expired).length,1);await page.locator('#market-filter').selectOption('all');await page.locator('[data-expire="'+offerId+'"]').click();assert.equal((await read()).snapshots[0].offers.filter(o=>o.expired).length,0);
 await page.getByRole('button',{name:'Buy',exact:true}).first().click();await fill('quantity','0.5');await click('Preview purchase');await click('COMMIT PURCHASE');await closed();
 let saved=await read();assert.equal(saved.lots[0].quantity,'0.5');const afterBuy=saved.bank;
 // Browsing a real map node changes neither location nor economic state.
 await page.locator('svg [data-arg="-111,-70"]').click();assert.equal((await read()).actual,'-110,-70');assert.equal((await read()).bank,afterBuy);
 await click('Current ship');await page.locator('[data-lot]').first().check();await click('Preview sale');
 await fill('dice',12);await click('Preview search');await click('Commit search');
 await page.getByRole('heading',{name:/Prepare sale/}).waitFor();await click('Preview sale');await page.getByRole('heading',{name:'Confirm sale'}).waitFor();await click('COMMIT SALE');await closed();assert.equal((await read()).lots.length,0);
 await click('History');await click('Undo latest change');assert.equal((await read()).lots.length,1);
 await click('Overview');await click('Plot route');await fill('stops','Spinward Marches | 1810');await click('Calculate route');await click('Save route');await closed();assert.equal((await read()).route.length,2);
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="insurance"]').check();await page.locator('[name="tax"]').check();await click('Save');await closed();
 await click('Overview');await page.getByRole('button',{name:'Buy',exact:true}).first().click();await fill('quantity','1');await page.locator('[name="insure"]').check();await click('Preview purchase');await click('COMMIT PURCHASE');await closed();assert.equal((await read()).policies.length,1);
 await click('Cargo');await click('Loss / claim');await fill('quantity','0.25');await fill('reason','Referee-confirmed partial loss');await page.locator('[name="approved"]').check();await click('Preview claim');await click('Commit loss & claim');await closed();assert.equal((await read()).policies[0].remainingQuantity,'0.75');
 await click('Contracts');await click('Manual contract');await page.locator('[name="destination"]').selectOption('-111,-70');await fill('quantity','1');await fill('payment','1000');await fill('days','0');await fill('reason','Browser verification delivery');await click('Save');await closed();
 await click('Overview');await click('COMMIT JUMP → Jenghe');await fill('hours','160');await click('COMMIT JUMP');await closed();assert.equal((await read()).actual,'-111,-70');assert.equal((await read()).policies[0].status,'arrived');
 await click('Contracts');const beforeDelivery=BigInt((await read()).bank);await click('Deliver');await fill('die','2');await click('Commit delivery & payout');await closed();assert.equal(BigInt((await read()).bank)-beforeDelivery,400n);
 await click('Overview');
 // A second tab cannot overwrite state, and explicit transfer hands off the lock.
 await click('Accounts');await click('Record expense');await fill('amount','1');await fill('reason','Stale preview must not commit');
 const second=await ctx.newPage();await second.goto(base);await second.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
 assert.equal(await second.getByRole('button',{name:'Find supplier',exact:true}).isDisabled(),true);
 await second.getByRole('button',{name:'Take over editing',exact:true}).click();await second.getByText('Editing in this tab',{exact:true}).waitFor();await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
 await second.getByRole('button',{name:'Accounts',exact:true}).click();await second.getByRole('button',{name:'Record expense',exact:true}).click();await second.locator('[name="amount"]').fill('2');await second.locator('[name="reason"]').fill('Second-tab change');await second.locator('#modal-submit').click();await second.locator('#modal').waitFor({state:'hidden'});
 const bankAfterOtherTab=(await read()).bank;await click('Save');await page.locator('#modal-error').getByText(/Campaign changed/).waitFor();assert.equal((await read()).bank,bankAfterOtherTab);await click('Cancel');
 await second.close();await page.getByRole('button',{name:'Take over editing',exact:true}).click();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 // Long-list layout and safe import/export round-trip use a valid expanded campaign fixture.
 let many=await read();const seed=many.lots[0];many.lots=Array.from({length:15},(_,i)=>({...seed,id:'fixture-'+i,quantity:'0.5',basis:'100',goodsValue:'100',description:'Fixture cargo '+(i+1)}));many.policies=[];many.undo=[];many.revision++;
 await page.evaluate(s=>localStorage.setItem('traveller-trade-route-calculator:v1',JSON.stringify(s)),many);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Cargo');assert.equal(await page.locator('[data-lot]').count(),15);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(artifacts,'mobile-preview.png'),fullPage:true});
 assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth)<=410);
 await page.setViewportSize({width:1440,height:1100});await click('Overview');await page.screenshot({path:join(artifacts,'desktop-preview.png'),fullPage:true});
 await click('Settings');const downloadPromise=page.waitForEvent('download');await click('Export backup');const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.json'));
 await click('Reset campaign');await click('Cancel');assert.equal((await read()).lots.length,15);
 const beforeBadImport=(await read()).bank;await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#message.error').waitFor();assert.equal((await read()).bank,beforeBadImport);
 const restore=await read();await page.locator('#import-file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restore))});await page.getByRole('heading',{name:'Import campaign'}).waitFor();await page.locator('[name="backed"]').check();await click('Replace campaign');await closed();assert.equal((await read()).lots.length,15);
 // A failed browser save must leave the prior stored campaign intact.
 await click('Accounts');await click('Record expense');await fill('amount','3');await fill('reason','Quota failure check');const bankBeforeFailure=(await read()).bank;
 await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError');};});await click('Save');await page.locator('#modal-error').getByText('Storage full',{exact:true}).waitFor();assert.equal((await read()).bank,bankBeforeFailure);await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;});await click('Cancel');
 await page.locator('#notes').click();await page.getByRole('heading',{name:'INT-018 · Criminal-market exemption'}).waitFor();await click('Close');
 const recoveryCopy=await read();await page.evaluate(()=>localStorage.setItem('traveller-trade-route-calculator:v1','{corrupt'));await page.reload();await page.getByRole('heading',{name:'Recover saved campaign'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-trade-route-calculator:v1')),'{corrupt');await page.locator('#import-file').setInputFiles({name:'recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recoveryCopy))});await page.getByRole('heading',{name:'Import campaign'}).waitFor();await page.locator('[name="backed"]').check();await click('Replace campaign');await closed();assert.equal((await read()).lots.length,15);
 assert.deepEqual(errors,[]);console.log('PASS: browser purchase/sale/undo, browsing, route/jump, insurance/partial claim, late freight delivery, two-tab transfer/stale preview, 15 cargo rows, mobile layout, backup/import/reset cancellation, quota failure and notes. API responses stubbed from live sample.');
}finally{await browser.close();}
