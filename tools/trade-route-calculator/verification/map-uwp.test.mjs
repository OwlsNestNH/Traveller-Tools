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
 
 const initial=await read();
 assert.equal(await page.locator('#map-uwp').isChecked(),true);
 assert.equal(await page.locator('.world-uwp').count(),0);
 for(let i=0;i<6;i++){await click('+');await page.waitForTimeout(60);}
 await page.locator('.map-zoom-controls').getByText('288%',{exact:true}).waitFor();
 const marker=page.locator('svg [data-action="map-world"]').filter({has:page.locator('.world-name',{hasText:'Regina'})});
 assert.equal(await marker.locator('.world-uwp').textContent(),'A788899-C');
 const positions=await marker.evaluate(el=>({name:JSON.parse(JSON.stringify(el.querySelector('.world-name').getBoundingClientRect())),uwp:JSON.parse(JSON.stringify(el.querySelector('.world-uwp').getBoundingClientRect())),cy:el.querySelector('circle').getBoundingClientRect().top+7}));
 assert.ok(positions.name.y+positions.name.height<positions.uwp.y);
 assert.ok(positions.name.y>positions.cy+7,'Closest-zoom names appear below the world marker');
 assert.ok(await page.locator('.hex-grid text').count()>0);
 await page.screenshot({path:join(artifacts,'map-uwp-desktop.png'),fullPage:true});
 await page.locator('#map-uwp').uncheck();assert.equal(await page.locator('.world-uwp').count(),0);
 await page.locator('#map-uwp').check();await click('−');assert.equal(await page.locator('.world-uwp').count(),0);
 assert.deepEqual(await read(),initial);
 // Verify effective world overrides without changing the user's campaign.
 await page.evaluate(()=>{const key='traveller-trade-route-calculator:v1',s=JSON.parse(localStorage.getItem(key));s.worlds[s.actual].overrideUWP='B777777-A';localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();
 for(let i=0;i<6;i++){await click('+');await page.waitForTimeout(60);}
 assert.equal(await page.locator('svg [data-action="map-world"] .world-uwp').first().textContent(),'B777777-A');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(artifacts,'map-uwp-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: maximum-zoom UWP, default checkbox, toggle, zoom hiding, name/UWP/marker separation, visible hexes, effective override, no campaign mutation.');
}finally{await browser.close();}


