import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
const oldApp=execFileSync('git',['show','cd1291f1d02519bc976012171b14c21c8347b728:tools/trade-route-calculator/js/app.mjs'],{encoding:'utf8',maxBuffer:2e6});
const oldStyle=execFileSync('git',['show','cd1291f1d02519bc976012171b14c21c8347b728:tools/trade-route-calculator/style.css'],{encoding:'utf8',maxBuffer:2e6});
const footprint=page=>page.locator('#summary>.stat').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height};}));
try{for(const width of [1440,1100,1099,768,390,320])for(const [mode,aboard,bladders,hold]of [['zero',0,20,65],['none',41,0,65],['empty',41,20,65],['one',42,20,65],['full',61,20,65]]){
 const f=guiFixture();f.state.ship.fuel={displacementTons:200,baseCapacityTons:41,aboardTons:aboard,bladderTons:bladders,capacityTons:41+bladders};f.state.ship.capacity=String(hold);f.state.lots=[{id:'status-cargo',description:'Synthetic status cargo',commodity:'11',quantity:'6',basis:'0',goodsValue:'0'}];f.state.contracts=[];
 const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(({key,bytes})=>{localStorage.setItem(key,bytes);globalThis.diceCalls=0;const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1)diceCalls++;return original(array);};},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const wide=width>=1100,bladderFuel=Math.max(0,aboard-41);assert.equal(await page.locator('.status-bladder-gauge').count(),bladderFuel>=1?1:0);assert.equal(await page.locator('.status-cargo-bladder').count(),bladderFuel>=1?1:0);
 assert.equal(await page.locator('.status-main-fuel').getAttribute('max'),'41');assert.equal(await page.locator('.status-main-fuel').getAttribute('value'),String(Math.min(41,aboard)));
 assert.match(await page.locator('#hold-summary>details>summary').textContent(),new RegExp((6+bladderFuel)+' / '+hold+' t'));
 const visibility=await page.locator('#summary progress,#summary .status-cargo-gauge').evaluateAll(nodes=>nodes.map(el=>!!el.getClientRects().length));assert.ok(visibility.every(v=>v===wide),'Gauge visibility follows available strip width');
 if(wide){const edges=await page.locator('.status-main-fuel,.life-support-counter>progress,.status-cargo-gauge').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().bottom));assert.ok(Math.max(...edges)-Math.min(...edges)<1,'Primary bars share baseline');}
 else{assert.equal(await page.locator('.status-fuel-numbers').isVisible(),true);assert.match(await page.locator('.status-fuel-numbers').textContent(),new RegExp('Main fuel '+Math.min(41,aboard)+'t.*Bladder fuel '+bladderFuel+'t'));}
 if(mode==='overloaded')assert.equal(await page.locator('.cargo-overcapacity').textContent(),'Over capacity by 1 t');
 if(mode==='full'){
  const dimensions=await footprint(page);await context.route('**/js/app.mjs*',r=>r.fulfill({body:oldApp,contentType:'text/javascript'}));await context.route('**/style.css*',r=>r.fulfill({body:oldStyle,contentType:'text/css'}));
  const baseline=await context.newPage();await baseline.goto(base);await baseline.locator('#summary .fuel-counter').waitFor();if(wide)assert.deepEqual(dimensions,await footprint(baseline),'Wide fields retain released dimensions');await baseline.close();await context.unroute('**/js/app.mjs*');await context.unroute('**/style.css*');
 }
 await page.locator('#summary').screenshot({path:artifacts+'status-gauges-'+mode+'-'+width+'.png'});
 await page.locator('#hold-summary summary').click();assert.match(await page.locator('.hold-breakdown').textContent(),new RegExp('Fuel in bladders: '+bladderFuel+' t'));await page.locator('#hold-summary summary').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),bytes);assert.equal(await page.evaluate(()=>diceCalls),0);assert.deepEqual(errors,[]);
 report.push({width,mode,unchanged:true,wide,baseline:wide?'aligned':'numbers only'});await context.close();
 }await writeFile(artifacts+'status-gauges-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,cases:report},null,2));console.log('PASS: '+report.length+' status-strip responsive cases');}finally{await browser.close();}
