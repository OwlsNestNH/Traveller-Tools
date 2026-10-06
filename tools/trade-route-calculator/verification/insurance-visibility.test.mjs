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
 await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('Set up campaign');await page.locator('#setup-world .picker-selection').getByText(/Hex 1910/).waitFor();await click('Start campaign');await closed();
 await page.evaluate(()=>{const key='traveller-trade-route-calculator:v1',s=JSON.parse(localStorage.getItem(key));s.settings.insurance=true;s.policies=[{id:'closed-test-policy',status:'closed',lotId:'former-lot',coverage:70,remainingQuantity:'0',remainingValue:'0',initialQuantity:'20',insuredValue:'45000',premium:'3600',destination:s.actual,claims:[]}];s.lots=[{id:'open-lot',commodity:'11',description:'Insured goods',quantity:'1',basis:'10000',goodsValue:'10000'}];s.policies.push({...s.policies[0],id:'open-policy',lotId:'open-lot',status:'active',remainingQuantity:'1',remainingValue:'10000'});localStorage.setItem(key,JSON.stringify(s));});await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();const saved=(await read()).policies;await click('History');assert.equal(await page.getByRole('heading',{name:'Closed cargo insurance',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Loss / claim',exact:true}).count(),0);await click('Cargo');assert.equal(await page.getByRole('button',{name:'Policy audit',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Cargo insurance',exact:true}).count(),1);
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="insurance"]').uncheck();await click('Save');await closed();await click('Cargo');assert.equal(await page.getByRole('heading',{name:'Cargo insurance',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Policy audit',exact:true}).count(),0);assert.deepEqual((await read()).policies,saved);await click('History');assert.equal(await page.getByRole('heading',{name:'Closed cargo insurance',exact:true}).count(),1);
 await click('Settings');await click('Ship, trader & options');await page.locator('[name="insurance"]').check();await click('Save');await closed();await click('Cargo');assert.equal(await page.getByRole('heading',{name:'Cargo insurance',exact:true}).count(),1);assert.deepEqual((await read()).policies,saved);assert.deepEqual(errors,[]);console.log('PASS: insurance panels hide when disabled and return with unchanged policies when enabled.');
}finally{await browser.close();}
