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
const click=async label=>{const modal=page.locator('#modal[open]');const target=modal.getByRole('button',{name:label,exact:true});if(await target.count())return target.click();return page.getByRole('button',{name:label,exact:true}).click();};
const fill=(name,value)=>page.locator('[name="'+name+'"]').fill(String(value));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
const checkLedgerDetails=async()=>{
 const before=await read();await click('Accounts');
 for(const entry of before.ledger){
  await page.locator('[data-action="ledger-audit"][data-arg="'+entry.id+'"]').click();
  assert.equal(await page.locator('#modal-body pre, #modal-body code').count(),0);
  const text=await page.locator('#modal-body').textContent();assert.match(text,/Bank change/);assert.doesNotMatch(text,/undefined|NaN|\[object Object\]/);
  if(entry.type==='Sale'){assert.match(text,/Realized profit/);assert.match(text,/3D price roll/);await page.screenshot({path:join(artifacts,'ledger-sale-details.png')});}
  if(entry.type==='Purchase'&&entry.purchase){assert.match(text,/Tons purchased/);assert.match(text,/Total price DM/);}
  if(entry.type==='Profit adjustment')assert.match(text,/Positive profit retained/);
  if(entry.type==='Insurance premium')assert.match(text,/Merchant Prince/);
  await click('Close');
 }
 assert.deepEqual(await read(),before);
};
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await fill('bank','1000000');await click('Start campaign');await closed();
 assert.equal((await read()).bank,'1000000');
 await click('Find supplier');await fill('dice',12);await click('Preview search');await click('Commit search');await closed();
 assert.ok((await read()).snapshots[0].offers.length>=6);
 assert.deepEqual(await page.locator('.purchase-table th').allTextContents(),['Commodity','Available','Retail','Price %','Purchase Price','Offer Status','Actions']);
 const assertGrid=async selector=>{const cells=await page.locator(selector).evaluate(table=>[...table.querySelectorAll('thead th')].map((h,i)=>{const d=table.querySelector('tbody tr').children[i],a=h.getBoundingClientRect(),b=d.getBoundingClientRect();return {left:Math.abs(a.left-b.left),width:Math.abs(a.width-b.width),align:getComputedStyle(h).textAlign,cellAlign:getComputedStyle(d).textAlign};}));assert.ok(cells.every(c=>c.left<1&&c.width<1));assert.ok(cells.slice(1,5).every(c=>c.align==='right'&&c.cellAlign==='right'));};
 await assertGrid('.purchase-table');
 const initialOffer=(await read()).snapshots[0].offers[0];
 assert.equal(await page.locator('.purchase-table tbody tr').first().locator('td').nth(3).textContent(),initialOffer.audit.percent+'%');
 await page.screenshot({path:join(artifacts,'purchase-table.png'),fullPage:true});
 const offerId=(await read()).snapshots[0].offers[0].id;await page.locator('[data-expire="'+offerId+'"]').click();assert.equal((await read()).snapshots[0].offers.filter(o=>o.expired).length,1);await page.locator('#market-filter').selectOption('all');const expired=page.locator('.expired-row');assert.equal(await expired.getByRole('button',{name:'Buy',exact:true}).isDisabled(),true);assert.equal(await expired.getByRole('button',{name:'Audit',exact:true}).isEnabled(),true);await expired.getByRole('button',{name:'Audit',exact:true}).click();await page.getByRole('heading',{name:/Commodity audit/}).waitFor();assert.equal(await page.locator('#modal-body pre').count(),0);assert.match(await page.locator('#modal-body').textContent(),/Signed contribution/);assert.match(await page.locator('#modal-body').textContent(),/Quantity dice/);assert.equal(await page.locator('#trade-rule-2').count(),1);await page.screenshot({path:join(artifacts,'readable-purchase-audit.png')});await click('Close');await page.locator('[data-expire="'+offerId+'"]').click();assert.equal((await read()).snapshots[0].offers.filter(o=>o.expired).length,0);
 await page.getByRole('button',{name:'Buy',exact:true}).first().click();
 assert.equal(await page.getByRole('group',{name:'Optional',exact:true}).count(),1);
 assert.equal(await page.locator('[name="purchaseTax"]').count(),0);assert.equal(await page.locator('[name="insure"]').isChecked(),false);
 await page.locator('[name="insure"]').check();assert.equal(await page.locator('#purchase-insurance-options').isVisible(),true);await page.locator('[name="insure"]').uncheck();
 await fill('quantity','0.5');await click('Preview purchase');
 await click('Cancel');assert.equal((await read()).settings.tax,false);assert.equal((await read()).lots.length,0);
 await page.getByRole('button',{name:'Buy',exact:true}).first().click();await page.screenshot({path:join(artifacts,'purchase-optional.png')});await fill('quantity','0.5');await click('Preview purchase');await click('COMMIT PURCHASE');await closed();
 let saved=await read();assert.equal(saved.settings.tax,false);assert.equal(saved.settings.insurance,false);assert.equal(saved.lots[0].quantity,'1');const afterBuy=saved.bank;
 assert.deepEqual(await page.locator('.cargo-table th').allTextContents(),['Commodity','Tons Held','Retail','Price %','Sale Price','Lot / Description','Actions']);
 await assertGrid('.cargo-table');assert.match(await page.locator('.cargo-table tbody').textContent(),/Not negotiated/);
 await page.locator('.cargo-table [data-action="lot-correct"]').first().click();await fill('description','Independent cargo lot');await fill('reason','Table edit verification');await click('Save');await closed();assert.equal((await read()).lots[0].description,'Independent cargo lot');
 // Browsing a real map node changes neither location nor economic state.
 await page.locator('svg [data-arg="-111,-70"]').click();assert.equal((await read()).actual,'-110,-70');assert.equal((await read()).bank,afterBuy);
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="tax"]') .check();await click('Save');await closed();await click('Overview');await click('Current system');await page.locator('[data-lot]').first().check();await click('Preview sale');
 await fill('dice',12);await click('Preview search');await click('Commit search');
 await page.getByRole('heading',{name:/Prepare sale/}).waitFor();
 const saleLot=(await read()).lots[0],quotedPrice=await page.locator('[name="price_'+saleLot.id+'"]').inputValue();
 assert.equal(await page.locator('.cargo-table tbody tr td').nth(4).textContent(),'Cr '+quotedPrice.replace(/\B(?=(\d{3})+(?!\d))/g,',')+' / t');
 assert.match(await page.locator('.cargo-table tbody tr td').nth(3).textContent(),/^\d+%$/);
 await click('Cancel');await page.locator('.cargo-table [data-action="lot-audit"]').first().click();assert.match(await page.locator('#modal-body').textContent(),/Current sale quote/);assert.match(await page.locator('#modal-body').textContent(),/Table lookup result/);assert.match(await page.locator('#modal-body').textContent(),/Total price DM/);assert.equal(await page.locator('#modal-body pre').count(),0);assert.equal(await page.locator('#trade-rule-1').count(),1);await page.screenshot({path:join(artifacts,'readable-cargo-audit.png')});await click('Close');
 const displayedQuote=await page.locator('.cargo-table tbody tr td').nth(4).textContent();await click('Cargo');assert.equal(await page.locator('.cargo-table tbody tr td').nth(4).textContent(),displayedQuote);
 await page.locator('.cargo-table [data-action="lot-sell"]').first().click();await click('Negotiate sale');await fill('price_'+saleLot.id,'100000');await fill('fee','1');await fill('reason','Verify readable sale fees, tax and profit adjustment');await click('Preview sale');await page.getByRole('heading',{name:'Confirm sale'}).waitFor();assert.equal(await page.locator('#modal-body pre').count(),0);assert.match((await page.locator('.rule-footnote').allTextContents()).join(' '),/MGT 1st Edition, Book 7: Merchant Prince, p. 86/);await click('COMMIT SALE');await closed();assert.equal((await read()).lots.length,0);await checkLedgerDetails();
 await click('History');await click('Undo latest change');assert.equal((await read()).lots.length,1);
 await click('Overview');await click('Plot route');await page.locator('#route-destination').getByLabel('Subsector',{exact:true}).selectOption('C');await page.locator('#route-destination').getByLabel('World',{exact:true}).selectOption('1810');await click('Calculate route');await click('Save route');await closed();assert.equal((await read()).route.length,2);
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="insurance"]').uncheck();await page.locator('[name="tax"]').check();await click('Save');await closed();
 const insuranceRoute=await read();insuranceRoute.route=[insuranceRoute.actual,'-111,-70','-111,-71'];insuranceRoute.revision++;await page.evaluate(s=>localStorage.setItem('traveller-trade-route-calculator:v1',JSON.stringify(s)),insuranceRoute);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Cargo');const beforeHeldInsurance=await read();await page.locator('[data-action="lot-insure"]').first().click();assert.match(await page.locator('#insurance-estimate').textContent(),/Projected insurance premium/);
 await page.locator('[name="coverage"]').selectOption('100');await page.locator('[name="insuranceLegs"]').selectOption('1');await page.screenshot({path:join(artifacts,'held-insurance.png')});await click('Preview insurance');await click('COMMIT INSURANCE');await closed();
 const heldInsured=await read(),heldPolicy=heldInsured.policies.at(-1);assert.equal(heldInsured.lots[0].quantity,beforeHeldInsurance.lots[0].quantity);assert.equal(BigInt(beforeHeldInsurance.bank)-BigInt(heldInsured.bank),BigInt(heldPolicy.premium));
 await click('Policy audit');assert.equal(await page.locator('#modal-body pre').count(),0);assert.match(await page.locator('#modal-body').textContent(),/Original premium calculation/);assert.match((await page.locator('.rule-footnote').allTextContents()).join(' '),/MGT 1st Edition, Book 7: Merchant Prince, p. 83/);await page.screenshot({path:join(artifacts,'readable-policy.png')});await click('Close');
 await click('History');await click('Undo latest change');assert.equal((await read()).bank,beforeHeldInsurance.bank);assert.equal((await read()).policies.length,0);
 await click('Overview');await page.getByRole('button',{name:'Buy',exact:true}).first().click();await fill('quantity','1');await page.locator('[name="insure"]').check();const projected=await page.locator('#insurance-estimate dd').first().textContent();await fill('quantity','2');const doubled=await page.locator('#insurance-estimate dd').first().textContent();assert.equal(Number(doubled.replace(/[^0-9]/g,'')),2*Number(projected.replace(/[^0-9]/g,'')));await fill('quantity','2');assert.equal(await page.locator('[name="insuranceLegs"]').inputValue(),'2');assert.equal(await page.locator('[name="insuranceDistance"]').inputValue(),'2');await page.locator('[name="insuranceLegs"]').selectOption('1');assert.equal(await page.locator('[name="insuranceDistance"]').inputValue(),'1');await fill('insuranceDistance','2');await click('Preview purchase');await page.locator('#modal-error').getByText('Add a reason for overriding the planned distance',{exact:true}).waitFor();await fill('distanceReason','Referee insured distance');await click('Preview purchase');assert.match(await page.locator('#modal-body').textContent(),/over 2 parsecs/);await click('COMMIT PURCHASE');await closed();assert.equal((await read()).policies.length,1);assert.equal((await read()).policies[0].destination,'-111,-70');assert.deepEqual((await read()).policies[0].route,['-110,-70','-111,-70']);assert.equal((await read()).policies[0].zones.includes('Amber'),false);assert.equal((await read()).policies[0].distance,2);assert.equal((await read()).policies[0].plannedDistance,1);assert.equal((await read()).policies[0].distanceOverrideReason,'Referee insured distance');assert.equal((await read()).settings.insurance,true);
 await click('Cargo');await click('Loss / claim');await fill('quantity','1');await fill('reason','Referee-confirmed partial loss');await page.locator('[name="approved"]').check();await click('Preview claim');await click('Commit loss & claim');await closed();assert.equal((await read()).policies[0].remainingQuantity,'1');await checkLedgerDetails();
 await click('Contracts');await click('Find contracts');await fill('dice',12);await page.getByText('Override freight / mail dice',{exact:true}).click();await fill('diceSequence',Array(300).fill(6).join(','));await click('Generate offers');await closed();
 const freight=page.locator('.freight-table').first();assert.deepEqual(await freight.locator('th').allTextContents(),['Freight Lot / Description','Tons','Destination','Rate / ton','Total Revenue','Due / Delivery Date','Status','Actions']);
 await freight.getByRole('button',{name:'Edit',exact:true}).first().click();await fill('description','Referee freight lot');await fill('quantity','0.5');await fill('payment','900');await fill('due','');await fill('reason','Freight table edit');await click('Save');await closed();
 assert.match(await freight.locator('tbody tr').first().textContent(),/Referee freight lot/);assert.match(await freight.locator('tbody tr').first().textContent(),/No due date/);
 await freight.getByRole('button',{name:'Audit/View',exact:true}).first().click();assert.match(await page.locator('#modal-body').textContent(),/Freight table edit/);await click('Close');
 await page.screenshot({path:join(artifacts,'freight-table.png'),fullPage:true});
 await freight.getByRole('button',{name:'Accept',exact:true}).first().click();await click('Accept whole contract');await closed();assert.equal((await read()).contracts.at(-1).description,'Referee freight lot');
 await click('History');await click('Undo latest change');assert.equal((await read()).contracts.length,0);
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
 let many=await read();const seed=many.lots[0];many.lots=Array.from({length:15},(_,i)=>({...seed,id:'fixture-'+i,quantity:'0.5',basis:String(100+i),goodsValue:'100',description:'Fixture cargo '+(i+1)}));many.policies=[];many.undo=[];many.revision++;
 await page.evaluate(s=>localStorage.setItem('traveller-trade-route-calculator:v1',JSON.stringify(s)),many);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 await click('Cargo');assert.equal(await page.locator('[data-lot]').count(),15);assert.match(await page.locator('.cargo-table tbody').textContent(),/Cost basis: Cr 114/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(artifacts,'mobile-preview.png'),fullPage:true});
 assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth)<=410);
 await page.setViewportSize({width:1440,height:1100});await click('Overview');await page.screenshot({path:join(artifacts,'desktop-preview.png'),fullPage:true});
 await click('Settings');const downloadPromise=page.waitForEvent('download');await click('Save campaign (JSON)');const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.json'));
 const beforeReport=await read(),reportDownload=page.waitForEvent('download');await click('Export report (TXT)');const reportFile=await reportDownload;
 assert.ok(reportFile.suggestedFilename().endsWith('.txt'));const reportText=await readFile(await reportFile.path(),'utf8');
 assert.match(reportText,/TRAVELLER - TRADE ROUTE REPORT/);assert.match(reportText,/Remaining total cost basis/);assert.match(reportText,/COMPLETED CARGO SALES/);assert.match(reportText,/Realized trading profit \/ loss/);assert.doesNotMatch(reportText,/\[object Object\]|undefined|NaN/);assert.deepEqual(await read(),beforeReport);
 await reportFile.saveAs(join(artifacts,'campaign-summary.txt'));

 await click('Reset campaign');await click('Cancel');assert.equal((await read()).lots.length,15);
 const beforeBadImport=(await read()).bank;await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#message.error').waitFor();assert.equal((await read()).bank,beforeBadImport);
 const restore=await read();await page.locator('#import-file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restore))});await page.getByRole('heading',{name:'Load campaign (JSON)'}).waitFor();await page.locator('[name="backed"]').check();await click('Replace campaign');await closed();assert.equal((await read()).lots.length,15);
 // A failed browser save must leave the prior stored campaign intact.
 await click('Accounts');await click('Record expense');await fill('amount','3');await fill('reason','Quota failure check');const bankBeforeFailure=(await read()).bank;
 await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError');};});await click('Save');await page.locator('#modal-error').getByText('Storage full',{exact:true}).waitFor();assert.equal((await read()).bank,bankBeforeFailure);await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;});await click('Cancel');


 // Combined expenses, stateroom setup, weekly refills, preview cancellation and batch undo.
 await click('Settings');await click('Ship, trader & options');await fill('staterooms','10');await fill('lowBerths','4');await fill('passengers-high','1');await fill('crew-middle','4');assert.match(await page.locator('#accommodation-estimate').textContent(),/Passenger luggage: 1 t/);await page.screenshot({path:join(artifacts,'ship-berths-settings.png')});await click('Save');await closed();assert.equal((await read()).ship.staterooms,10);
 const openExpenses=()=>page.locator('#tabs').getByRole('button',{name:'Ship expenses',exact:true}).click();
 await click('Cargo');assert.match(await page.locator('#main').textContent(),/Passenger luggage reserved: 1 t/);
 await click('Settings');await click('Ship, trader & options');await page.setViewportSize({width:390,height:844});await page.locator('[name="passengers-high"]').scrollIntoViewIfNeeded();await page.screenshot({path:join(artifacts,'ship-berths-mobile.png')});assert.ok(await page.locator('#modal-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.setViewportSize({width:1440,height:1100});await fill('passengers-high','0');await click('Save');await closed();await click('Cargo');assert.match(await page.locator('#main').textContent(),/Passenger luggage reserved: 0 t/);await click('History');await click('Undo latest change');assert.equal((await read()).ship.accommodation.passengers.high,1);
 // Actual luggage and service cost adjustments are independent and reversible.
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="actualLuggage"]').check();await fill('luggageTons','0');await page.getByText('Life-support service levels and custom rates',{exact:true}).click();await page.locator('[name="passengersService-high"]').selectOption('custom');await fill('passengersCustom-high','3500');await page.locator('[name="crewService-middle"]').selectOption('high');await page.screenshot({path:join(artifacts,'passenger-adjustments.png')});await click('Save');await closed();
 assert.equal((await read()).ship.accommodation.luggageTons,'0');await click('Cargo');assert.match(await page.locator('#main').textContent(),/Passenger luggage reserved: 0 t/);
 await openExpenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-passengerSupport"]').check();assert.match(await page.locator('#expense-estimate').textContent(),/Cr 3,875/);await click('Preview expenses');await click('Pay Cr 3,875');await closed();
 assert.equal((await read()).ledger.at(-1).expense.amount,'3875');assert.equal((await read()).ship.accommodation.passengers.high,1);await click('History');await click('Undo latest change');await click('Undo latest change');assert.equal((await read()).ship.accommodation.luggageTons,null);
 const expenseBank=(await read()).bank;
 const fillExpenses=async()=>{await click('Select all expenses');await fill('weeks','2');await fill('fuelTons','12.5');await page.locator('[name="fuelType"]').selectOption('unrefined');await fill('stateroomsUnits','2');await fill('passengerSupportUnits','1');await fill('salary','6000');await fill('salaryMonths','2');};
 await openExpenses();await fillExpenses();await click('Roll & save starport rate');assert.equal(await page.locator('[name="salary"]').inputValue(),'6000');assert.match(await page.locator('[data-expense-kind="passengerSupport"]').textContent(),/3,000/);assert.equal(await page.locator('[name="passengers-high"]').count(),0);
 const savedDie=(await read()).worlds[(await read()).actual].berthingRate.die;
 const expenseTotal=String(savedDie*200+1300+5000+1750+12000);
 await page.screenshot({path:join(artifacts,'combined-ship-expenses.png')});
 await click('Preview expenses');await click('Cancel');assert.equal((await read()).bank,expenseBank);
 await openExpenses();await fillExpenses();assert.equal(await page.getByRole('button',{name:'Roll & save starport rate',exact:true}).count(),0);
 await click('Preview expenses');await click('Pay Cr '+Number(expenseTotal).toLocaleString('en-US'));await closed();
 const paid=await read();assert.equal(paid.bank,String(BigInt(expenseBank)-BigInt(expenseTotal)));assert.equal(new Set(paid.ledger.slice(-5).map(e=>e.batchId)).size,1);assert.equal(paid.ship.supportOccupants.passengers.high,1);assert.equal(paid.ship.expenses.salary,'6000');
 await click('Settings');await click('Ship, trader & options');await click('Save');await closed();assert.equal((await read()).ship.expenses.salary,'6000');
 await openExpenses();await page.locator('[name="include-passengerSupport"]').check();assert.match(await page.locator('[data-expense-kind="passengerSupport"]').textContent(),/3,000/);assert.equal(await page.locator('[name="passengers-high"]').count(),0);await click('Cancel');
 await click('History');await click('Undo latest change');await click('Undo latest change');assert.equal((await read()).bank,expenseBank);
 await openExpenses();await page.locator('[name="include-berthing"]').uncheck();assert.equal(await page.locator('#modal-submit').isDisabled(),true);await page.locator('[name="include-fuel"]').check();await fill('fuelTons','12.5');await click('Preview expenses');await click('Pay Cr 1,300');await closed();assert.equal((await read()).ledger.at(-1).expense.kind,'fuel');
 await click('Undo latest change');assert.equal((await read()).bank,expenseBank);
 await openExpenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-fuel"]').check();await page.locator('[name="fuelType"]').selectOption('water');await fill('fuelTons','20');
 assert.equal(await page.locator('#modal-submit').isDisabled(),false);await click('Preview expenses');assert.match(await page.locator('#modal-body').textContent(),/Free water collection/);await click('Pay Cr 0');await closed();
 assert.equal((await read()).bank,expenseBank);assert.equal((await read()).ledger.at(-1).expense.amount,'0');await click('Undo latest change');

 await page.locator('#notes').click();await page.getByRole('heading',{name:'INT-018 · Criminal-market exemption'}).waitFor();await click('Close');
 // Whole-ton luggage field and previewed bulk rounding preserve history and undo.
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="actualLuggage"]').check();await fill('luggageTons','0.01');await page.locator('[name="passengers-high"]').click();assert.equal(await page.locator('[name="luggageTons"]').inputValue(),'1');assert.equal(await page.locator('[name="luggageTons"]').getAttribute('step'),'1');assert.match(await page.locator('#rounding-input-note').textContent(),/0.01 → 1/);await click('Save');await closed();assert.equal((await read()).ship.accommodation.luggageTons,'1');
 const beforeRound=await read();await click('Round up Credits to 100 & tons to whole');await page.getByRole('heading',{name:'Preview rounding'}).waitFor();await page.screenshot({path:join(artifacts,'rounding-preview.png')});await click('Cancel');assert.equal((await read()).bank,beforeRound.bank);
 await click('Round up Credits to 100 & tons to whole');await click('Apply rounding');await closed();const rounded=await read();assert.equal(rounded.settings.creditStep,100);assert.equal(BigInt(rounded.bank)%100n,0n);assert.ok(rounded.lots.every(l=>!l.quantity.includes('.')));assert.deepEqual(rounded.ledger.slice(0,beforeRound.ledger.length),beforeRound.ledger);
 await openExpenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-salary"]').check();await fill('salary','149');await fill('salaryMonths','1');await page.locator('[name="expenseNotes"]').click();assert.equal(await page.locator('[name="salary"]').inputValue(),'200');assert.equal(await page.locator('[name="salaryMonths"]').inputValue(),'1');await click('Preview expenses');assert.match(await page.locator('#modal-body').textContent(),/Cr 200/);await click('Cancel');
 await click('History');await click('Undo latest change');assert.equal((await read()).bank,beforeRound.bank);assert.deepEqual((await read()).lots,beforeRound.lots);
 const recoveryCopy=await read();await page.evaluate(()=>localStorage.setItem('traveller-trade-route-calculator:v1','{corrupt'));await page.reload();await page.getByRole('heading',{name:'Recover saved campaign'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-trade-route-calculator:v1')),'{corrupt');await page.locator('#import-file').setInputFiles({name:'recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recoveryCopy))});await page.getByRole('heading',{name:'Load campaign (JSON)'}).waitFor();await page.locator('[name="backed"]').check();await click('Replace campaign');await closed();assert.equal((await read()).lots.length,15);
 assert.deepEqual(errors,[]);console.log('PASS: browser purchase/sale/undo, browsing, route/jump, insurance/partial claim, late freight delivery, two-tab transfer/stale preview, 15 cargo rows, mobile layout, backup/import/reset cancellation, quota failure and notes. API responses stubbed from live sample.');
}finally{await browser.close();}
