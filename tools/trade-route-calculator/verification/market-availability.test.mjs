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
const sample=[{Name:'Regina',Hex:'1910',UWP:'A788899-C',PBG:'703',Zone:'',WorldX:-110,WorldY:-70,Sector:'Spinward Marches'},{Name:'Jenghe',Hex:'1810',UWP:'C799663-9',PBG:'323',Zone:'',WorldX:-111,WorldY:-70,Sector:'Spinward Marches'},{Name:'Ruie',Hex:'1809',UWP:'C776977-7',PBG:'701',Zone:'A',WorldX:-112,WorldY:-70,Sector:'Spinward Marches'}];
await ctx.route('https://travellermap.com/api/jumpworlds?*',async route=>{const u=new URL(route.request().url());const rows=u.searchParams.get('jump')==='0'?sample.filter(w=>w.Hex===(u.searchParams.get('hex')||'1910')):sample;await route.fulfill({json:{Worlds:rows},headers:{'Access-Control-Allow-Origin':'*'}});});
await ctx.route('https://travellermap.com/api/universe?*',route=>route.fulfill({json:{Sectors:[{Names:[{Text:'Spinward Marches'}],Abbreviation:'Spin'},{Names:[{Text:'Empty Sector'}]}]}}));
await ctx.route('https://travellermap.com/api/metadata?*',route=>route.fulfill({json:{Subsectors:[{Index:'C',Name:'Regina'},{Index:'A',Name:'Cronor'}]}}));
await ctx.route('https://travellermap.com/api/sec?*',route=>route.fulfill({json:'Hex\tName\r\n'+sample.map(w=>w.Hex+'\t'+w.Name).join('\r\n')}));
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=async label=>{const modal=page.locator('#modal[open]');const target=modal.getByRole('button',{name:label,exact:true});if(await target.count())return target.click();return page.getByRole('button',{name:label,exact:true}).click();};
const fill=(name,value)=>page.locator('[name="'+name+'"]').fill(String(value));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')));
const closed=()=>page.locator('#modal').waitFor({state:'hidden'});
const choose=id=>page.locator('svg [data-action="map-world"][data-arg="'+id+'"]').click();
const ready=()=>page.getByRole('button',{name:'Save planned route',exact:true}).waitFor({state:'visible'}).then(()=>page.waitForFunction(()=>!document.querySelector('[data-action="route-save"]').disabled));
try{
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await fill('jump',1);await click('Start campaign');await closed();

 assert.equal(await page.getByRole('button',{name:'Availability audit',exact:true}).isDisabled(),true);
 await click('Find supplier');await page.locator('[name="success"]').check();await click('Preview search');await click('Commit search');await closed();
 const initial=await read(),snap=initial.snapshots.at(-1);
 assert.equal(snap.availability.draws.length,8);
 assert.ok(snap.availability.defaults.some(g=>g.reason.includes('Common goods')));
 assert.equal(await page.getByRole('button',{name:'Availability audit',exact:true}).isDisabled(),false);
 await click('Availability audit');await page.getByRole('heading',{name:'Market availability audit',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Default goods and why they qualify',exact:true}).waitFor();
 assert.ok((await page.locator('#modal-body').textContent()).includes('Additional rolls recorded'));
 await click('Close');assert.deepEqual(await read(),initial);
 // Historical snapshot remains tied to the saved world, including legacy records.
 await page.evaluate(()=>{const k='traveller-trade-route-calculator:v1',s=JSON.parse(localStorage.getItem(k));delete s.snapshots[0].availability;s.worlds[s.actual].overrideUWP='B777777-A';localStorage.setItem(k,JSON.stringify(s));});
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Availability audit');
 assert.ok((await page.locator('#modal-body').textContent()).includes('Older snapshot'));
 assert.ok((await page.locator('#modal-body').textContent()).includes('A788899-C'));
 await page.screenshot({path:join(artifacts,'market-availability.png'),fullPage:true});
 await click('Close');
 await click('Find supplier');await page.locator('[name="method"]').selectOption('blackMarket');await page.locator('[name="success"]').check();await click('Preview search');await click('Commit search');await closed();
 const black=(await read()).snapshots.at(-1);assert.ok(black.availability.draws.every(id=>id.startsWith('6')));assert.ok(black.availability.defaults.some(g=>g.reason.includes('Common goods')));
 await click('Availability audit');assert.ok((await page.locator('#modal-body').textContent()).includes('Black market (includes common legal goods'));
 assert.deepEqual(errors,[]);console.log('PASS: disabled/active audit, saved defaults and population draws, read-only display, legacy snapshot and original UWP, black-market common stock and illegal draws.');
}finally{await browser.close();}

