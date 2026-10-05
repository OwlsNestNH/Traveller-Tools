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

 const initial=await read();await click('Auto plot');await choose('-111,-70');await ready();await click('Save planned route');await click('Save route');await closed();
 await click('COMMIT JUMP → Jenghe');await click('COMMIT JUMP');await closed();const jumped=await read();assert.equal(jumped.bank,initial.bank);assert.equal(jumped.ledger.at(-1).amount,'0');
 await click('History');let row=page.locator('.bank-ledger tbody tr').first();assert.equal(await row.locator('td').nth(1).textContent(),'Jenghe');assert.equal(await row.locator('td').nth(6).textContent(),'Regina → Jenghe');assert.equal(await row.locator('td').nth(3).textContent(),'—');assert.equal(await row.locator('td').nth(4).textContent(),'—');assert.equal(await row.locator('td').nth(5).textContent(),'Cr 100,000');assert.equal(await page.locator('.bank-ledger tbody tr').count(),2);
 await row.getByRole('button',{name:'Details'}).click();assert.ok((await page.locator('#modal-body').textContent()).includes('Jump duration'));await click('Close');
 await click('Undo latest change');assert.equal(await page.locator('.bank-ledger tbody tr').count(),1);assert.equal((await read()).actual,initial.actual);
 // Emulate a pre-feature saved jump; then ensure undo history suppresses it.
 await page.evaluate(s=>{s.ledger=s.ledger.filter(l=>l.type!=='Jump');localStorage.setItem('traveller-trade-route-calculator:v1',JSON.stringify(s));},jumped);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('History');assert.equal(await page.locator('.bank-ledger tbody tr').count(),2);assert.equal(await page.locator('.bank-ledger tbody tr').first().locator('td').nth(5).textContent(),'—');
 assert.deepEqual(errors,[]);console.log('PASS: zero-cost jump, destination and origin note, unchanged bank, one row per jump, jump details, undo removes row, legacy jump displays without invented balance.');
}finally{await browser.close();}

