import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {configureSupport} from '../js/life-support.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})}),report=[];
const oldApp=execFileSync('git',['show','cd1291f1d02519bc976012171b14c21c8347b728:tools/trade-route-calculator/js/app.mjs'],{encoding:'utf8',maxBuffer:2e6});
const oldStyle=execFileSync('git',['show','cd1291f1d02519bc976012171b14c21c8347b728:tools/trade-route-calculator/style.css'],{encoding:'utf8',maxBuffer:2e6});
const footprint=page=>page.locator('#summary>.stat').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height};}));
try{for(const width of [1440,1100,1099,768,390,320])for(const [mode,aboard,bladders,hold]of [['zero',0,20,65],['none',41,0,65],['empty',41,20,65],['one',42,20,65],['full',61,20,65]]){
 const f=guiFixture();f.state.ship.fuel={displacementTons:200,baseCapacityTons:41,aboardTons:aboard,bladderTons:bladders,capacityTons:41+bladders};f.state.ship.capacity=String(hold);f.state.lots=[{id:'status-cargo',description:'Synthetic status cargo',commodity:'11',quantity:'6',basis:'0',goodsValue:'0'}];f.state.contracts=[];
 const lss={zero:['0',0],none:['27.96',27],empty:['0.99',0],one:['28',28],full:['40.7',40]}[mode];
 f.state.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:1,high:0}};
 f.state.ship.lifeSupport=configureSupport(f.state.ship,{stockUnits:lss[0],targetDays:28});
 const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(({key,bytes})=>{localStorage.setItem(key,bytes);globalThis.diceCalls=0;const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1)diceCalls++;return original(array);};},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const support=page.locator('.status-lss-gauge>progress');
 assert.match(await page.locator('.life-support-counter>.value').textContent(),new RegExp('^'+lss[1]+' days'));
 assert.equal(await support.getAttribute('value'),String(lss[1]));assert.equal(await support.getAttribute('max'),String(Math.max(28,lss[1])));
 assert.equal(await support.evaluate(el=>el.position),lss[1]/Math.max(28,lss[1]),'Gauge scale includes all displayed whole days');
 const above=page.locator('.status-lss-above');assert.equal(await above.count(),lss[1]>28?1:0);if(lss[1]>28){assert.equal(await above.getAttribute('aria-hidden'),'true');assert.match(await above.getAttribute('style'),/width:30%/);assert.match(await support.getAttribute('aria-valuetext'),/40 whole days onboard; 28-day target; 12 days above target. Scale: 0 to 40 days./);assert.match(await page.locator('.life-support-counter>.help').textContent(),/28d target.*12d above/);}
 const wide=width>=1100,bladderFuel=Math.max(0,aboard-41);assert.equal(await page.locator('.status-bladder-gauge').count(),bladderFuel>=1?1:0);assert.equal(await page.locator('.status-cargo-bladder').count(),bladderFuel>=1?1:0);
 assert.equal(await page.locator('.status-main-fuel').getAttribute('max'),'41');assert.equal(await page.locator('.status-main-fuel').getAttribute('value'),String(Math.min(41,aboard)));
 assert.match(await page.locator('#hold-summary>details>summary').textContent(),new RegExp((6+bladderFuel)+' / '+hold+' t'));
 const visibility=await page.locator('#summary progress,#summary .status-lss-gauge,#summary .status-cargo-gauge').evaluateAll(nodes=>nodes.map(el=>!!el.getClientRects().length));assert.ok(visibility.every(v=>v===wide),'Gauge visibility follows available strip width');
 if(wide){const edges=await page.locator('.status-main-fuel,.status-lss-gauge,.status-cargo-gauge').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().bottom));assert.ok(Math.max(...edges)-Math.min(...edges)<1,'Primary bars share baseline');}
 else{assert.equal(await page.locator('.status-fuel-numbers').isVisible(),true);assert.match(await page.locator('.status-fuel-numbers').textContent(),new RegExp('Main fuel '+Math.min(41,aboard)+'t.*Bladder fuel '+bladderFuel+'t'));}
 if(wide&&lss[1]>28){const geometry=await above.evaluate(el=>({width:el.getBoundingClientRect().width,total:el.parentElement.getBoundingClientRect().width,color:getComputedStyle(el).backgroundColor}));assert.ok(Math.abs(geometry.width/geometry.total-.3)<.01,'Above-target segment occupies 12 of40 displayed days');assert.equal(geometry.color,'rgb(242, 188, 87)');}
 if(mode==='overloaded')assert.equal(await page.locator('.cargo-overcapacity').textContent(),'Over capacity by 1 t');
 if(mode==='full'){
  const dimensions=await footprint(page);await context.route('**/js/app.mjs*',r=>r.fulfill({body:oldApp,contentType:'text/javascript'}));await context.route('**/style.css*',r=>r.fulfill({body:oldStyle,contentType:'text/css'}));
  const baseline=await context.newPage();await baseline.goto(base);await baseline.locator('#summary .fuel-counter').waitFor();if(wide)assert.deepEqual(dimensions,await footprint(baseline),'Wide fields retain released dimensions');await baseline.close();await context.unroute('**/js/app.mjs*');await context.unroute('**/style.css*');
 }
 await page.locator('#summary').screenshot({path:artifacts+'status-gauges-'+mode+'-'+width+'.png'});
 await page.locator('#hold-summary summary').click();assert.match(await page.locator('.hold-breakdown').textContent(),new RegExp('Fuel in bladders: '+bladderFuel+' t'));await page.locator('#hold-summary summary').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.equal(await page.evaluate(key=>localStorage.getItem(key),campaignKey),bytes);assert.equal(await page.evaluate(()=>diceCalls),0);assert.deepEqual(errors,[]);
 report.push({width,mode,lssStock:lss[0],lssDays:lss[1],unchanged:true,wide,baseline:wide?'aligned':'numbers only'});await context.close();
 }await writeFile(artifacts+'status-gauges-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,cases:report},null,2));console.log('PASS: '+report.length+' status-strip responsive cases');}finally{await browser.close();}
