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
const sample=[{Name:'Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},{Name:'Jenghe',Hex:'1810',UWP:'X700000-0',PBG:'000',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'},{Name:'Ruie',Hex:'1809',UWP:'C776977-7',PBG:'701',Zone:'A',WorldX:-112,WorldY:-70,Sector:'Spinward Marches'}];
await ctx.route('https://travellermap.com/api/jumpworlds?*',async route=>{const u=new URL(route.request().url());const rows=u.searchParams.get('jump')==='0'?sample.filter(w=>w.Hex===(u.searchParams.get('hex')||'1910')):sample;await route.fulfill({json:{Worlds:rows},headers:{'Access-Control-Allow-Origin':'*'}});});
await ctx.route('https://travellermap.com/api/universe?*',route=>route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin'},{Names:[{Text:'Empty Sector'}]}]}}));
await ctx.route('https://travellermap.com/api/metadata?*',route=>route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'},{Index:'A',Name:'Cronor'}]}}));
await ctx.route('https://travellermap.com/api/sec?*',route=>route.fulfill({json:'Hex\tName\r\n'+sample.map(w=>w.Hex+'\t'+w.Name).join('\r\n')}));
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=async label=>{if(['Plot route','Auto plot','Build route','Clear planned route'].includes(label)&&!await page.locator('#route-menu').evaluate(e=>e.open))await page.locator('#route-menu > summary').click();const modal=page.locator('#modal[open]');const target=modal.getByRole('button',{name:label,exact:true});if(await target.count())return target.click();return page.getByRole('button',{name:label,exact:true}).click();};
const fill=(name,value)=>page.locator('[name="'+name+'"]').fill(String(value));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
const choose=id=>page.locator('svg [data-action="map-world"][data-arg="'+id+'"]').click();
const ready=()=>page.getByRole('button',{name:'Save planned route',exact:true}).waitFor({state:'visible'}).then(()=>page.waitForFunction(()=>!document.querySelector('[data-action="route-save"]').disabled));
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await click('Start campaign');await closed();
 assert.equal(Object.hasOwn((await read()).ship,'fuel'),false,'Blank setup has no serialized fuel property');
 // Configure without reloading the just-created campaign: this used to create
 // a value-less inverse operation and poison subsequent saves and reloads.
 await click('Refuel');await page.getByRole('heading',{name:'Ship, trader & options',exact:true}).waitFor();
 await fill('shipTons',200);await fill('fuelCapacity',40);await fill('fuelAboard',10);await click('Save');await closed();
 await click('History');await click('Undo latest change');assert.equal(Object.hasOwn((await read()).ship,'fuel'),false);
 await click('Overview');await click('Refuel');await fill('shipTons',200);await fill('fuelCapacity',40);await fill('fuelAboard',10);await click('Save');await closed();
 assert.equal((await read()).ship.fuel.displacementTons,200);const initial=await read();
 await click('Auto plot');await choose('-111,-70');await ready();assert.match(await page.locator('#main').textContent(),/Fuel alert/);await click('Save planned route');await click('Save route');await closed();
 await page.locator('[data-action="jump"]').click();assert.match(await page.locator('#modal-body').textContent(),/Insufficient fuel/);await click('COMMIT JUMP');await closed();assert.equal((await read()).ship.fuel.aboardTons,0);await click('History');await click('Undo latest change');await click('Overview');assert.equal((await read()).ship.fuel.aboardTons,10);
 const expenses=async()=>{await click('Accounts');await page.locator('#main').getByRole('button',{name:'Ship expenses',exact:true}).click();};
 const beforeRadio=await read();assert.equal(await page.locator('[name="quickFuelType"]').count(),0);await click('Refuel');await page.locator('#service-panel').waitFor({state:'visible'});assert.equal(await page.locator('#modal').isVisible(),false);await page.locator('[name="fuelType"]').selectOption('unrefined');assert.deepEqual(await read(),beforeRadio);assert.equal(await page.locator('[name="include-berthing"]').count(),0);assert.equal(await page.locator('[name="fuelType"]').inputValue(),'unrefined');assert.equal(await page.locator('[name="fuelTons"]').inputValue(),'30');assert.match(await page.locator('#service-quote').textContent(),/Cr 3,000/);await page.locator('[data-action="service-confirm"]').click();await page.locator('#service-panel').waitFor({state:'hidden'});assert.equal((await read()).bank,'97000');assert.equal((await read()).ship.fuel.aboardTons,40);assert.equal((await read()).ledger.at(-1).expense.kind,'fuel');await click('History');await click('Undo latest change');assert.equal((await read()).bank,beforeRadio.bank);assert.equal((await read()).ship.fuel.aboardTons,beforeRadio.ship.fuel.aboardTons);await click('Overview');

 await expenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-fuel"]').check();assert.equal(await page.locator('[name="fuelTons"]').inputValue(),'10');assert.match(await page.locator('#modal-body').textContent(),/200 tons x 10% x 1 = 20/);
 await fill('fuelTons',31);assert.equal(await page.getByRole('button',{name:'Preview expenses',exact:true}).isDisabled(),true);await click('Fuel for next jump');assert.equal(await page.locator('[name="fuelTons"]').inputValue(),'10');await click('Preview expenses');await click('Cancel');assert.equal((await read()).bank,initial.bank);assert.equal((await read()).ship.fuel.aboardTons,10);
 await expenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-fuel"]').check();await click('Preview expenses');await click('Pay Cr 5,000');await closed();assert.equal((await read()).ship.fuel.aboardTons,20);assert.equal((await read()).bank,'95000');
 await click('Overview');await page.locator('[data-action="jump"]').click();assert.match(await page.locator('#modal-body').textContent(),/Fuel aboard after/);await click('Cancel');assert.equal((await read()).ship.fuel.aboardTons,20);
 await page.locator('[data-action="jump"]').click();await click('COMMIT JUMP');await closed();assert.equal((await read()).ship.fuel.aboardTons,0);assert.equal((await read()).actual,'-111,-70');assert.equal((await read()).bank,'95000');
 await click('History');const audit=page.locator('.action-history tbody tr').filter({hasText:'Jump audit'}).first();await audit.getByRole('button',{name:'Details'}).click();assert.match(await page.locator('#modal-body').textContent(),/Fuel consumed/);await click('Close');assert.equal(await page.getByRole('button',{name:'Undo latest change',exact:true}).isDisabled(),true);assert.match(await page.locator('#main').textContent(),/Mulligan used/);assert.equal((await read()).ship.fuel.aboardTons,0);assert.equal((await read()).actual,'-111,-70');
 await expenses();await page.locator('[name="include-berthing"]').uncheck();await page.locator('[name="include-fuel"]').check();await click('Fill tank');assert.equal(await page.locator('[name="fuelTons"]').inputValue(),'40');await page.locator('[name="fuelType"]').selectOption('water');assert.equal(await page.getByRole('button',{name:'Preview expenses',exact:true}).isEnabled(),true,'Water is selectable at a dry world without a supplier override');await fill('expenseNotes','Referee-confirmed water collection after the final jump');await click('Preview expenses');await click('Pay Cr 0');await closed();assert.equal((await read()).ship.fuel.aboardTons,40);assert.equal((await read()).bank,'95000');
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal((await read()).ship.fuel.aboardTons,40);await click('Settings');await click('Ship, trader & options');assert.equal(await page.locator('[name="fuelAboard"]').inputValue(),'40');await click('Save');await closed();assert.equal((await read()).ship.fuel.aboardTons,40);
 await page.screenshot({path:join(artifacts,'fuel-summary-desktop.png')});await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth)<=410);await page.screenshot({path:join(artifacts,'fuel-mobile.png')});assert.deepEqual(errors,[]);console.log('PASS: fuel setup, required fuel, warned low-fuel jump, purchase/cancel, overfill, jump deduction, audits, free collection, persistence, undo and mobile layout.');
}finally{await browser.close();}
