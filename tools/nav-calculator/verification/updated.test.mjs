import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const server=createServer(async(req,res)=>{try{
 const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(path.relative(root,target).startsWith('..'))throw Error();
 const file=(await stat(target)).isDirectory()?path.join(target,'index.html'):target;
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.NAV_BROWSER_CHANNEL?{channel:process.env.NAV_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.randomCalls=0;Math.random=()=>{window.randomCalls++;return .5;};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/nav-calculator/');
 const snapshot=()=>page.evaluate(()=>({input:readNavInput(),result:navResult,brief:lastBrief,mode:calculationMode,calls:randomCalls}));
 await page.fill('#thrust','1');await page.selectOption('#distMode','au');await page.fill('#distanceAu','1.893');
 await page.check('#use100d');await page.check('#useAstro');await page.fill('#effect','2');
 await page.getByRole('button',{name:'Solve Route',exact:true}).click();
 const original=await snapshot();assert.equal(original.calls,2);
 await page.click('#updatedView');await page.waitForTimeout(50);
 assert.deepEqual(await snapshot(),original);assert.equal(await page.textContent('#uTime'),await page.textContent('#mainTime'));
 assert.equal(await page.textContent('#uSpeed'),'0.00 km/s');
 assert.equal(await page.textContent('#uConsoleProfile'),'BURN / FLIP / BRAKE');
 assert.equal(await page.locator('#uArrivalRing').isVisible(),true);assert.equal(await page.locator('#uArrivalPlanet').isVisible(),true);assert.equal(await page.locator('#uClearanceEnd').isVisible(),false);
 assert.equal(await page.textContent('#uBurnDistance'),'(0.947 AU)');
 assert.equal(await page.locator('.u-details').getAttribute('open'),'');
 assert.equal(await page.locator('.u-clearance').isVisible(),true);
 assert.match(await page.textContent('#uClearance'),/kkm/);
 const clearanceRect=await page.locator('.u-clearance .u-ring').boundingBox(), flightRect=await page.locator('.u-flight').boundingBox();
 assert.ok(clearanceRect.x < flightRect.x+60 && clearanceRect.y > flightRect.y+100,'100D readout stays at lower left');


 await page.click('#legacyView');assert.deepEqual(await snapshot(),original);
 await page.click('#updatedView');await page.click('#planRoute');
 assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),false);
 assert.deepEqual(await snapshot(),original);
 await page.click('#planRoute');await page.click('#computePlan');
 const updated=await snapshot();assert.deepEqual(updated.result,original.result);assert.equal(updated.brief,original.brief);assert.equal(updated.calls,4);
 assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),false);
 const shots=process.env.NAV_SCREENSHOT_DIR;
 if(shots){await mkdir(shots,{recursive:true});await page.screenshot({path:path.join(shots,'nav-updated-desktop.png'),fullPage:true});await page.locator('#updatedDashboard').screenshot({path:path.join(shots,'nav-reference-panel-desktop.png')});await page.click('#planRoute');await page.screenshot({path:path.join(shots,'nav-plan-route-desktop.png')});await page.click('#closePlan');}
 // Profiles, stale results, errors, 100D-only and repeated close/reopen.
 await page.click('#planRoute');await page.selectOption('#profile','const');
 assert.equal((await snapshot()).result.profile,'const');await page.click('#computePlan');
 assert.equal(await page.textContent('#uConsoleProfile'),'CONSTANT THRUST');assert.equal(await page.locator('#uFlip').isVisible(),false);assert.match(await page.textContent('#uSpeed'),/km\/s/);
 await page.click('#planRoute');await page.fill('#thrust','0');await page.click('#computePlan');
 assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),true);assert.match(await page.textContent('#planError'),/positive/);
 assert.equal(await page.evaluate(()=>navResult),null);
 await page.fill('#thrust','2');await page.selectOption('#planKind','clearance');
 assert.equal(await page.locator('#distanceAu').isVisible(),false);
 await page.selectOption('#profile','flip');await page.click('#computePlan');
 const clearance=await snapshot();assert.equal(clearance.mode,'clearance');assert.equal(clearance.result.timeSelectedMin,clearance.result.timeFlipMin);
 assert.equal(await page.textContent('#uTimeLabel'),'100D TIME');assert.equal(await page.locator('#uArrivalRing').isVisible(),false);assert.equal(await page.locator('#uArrivalPlanet').isVisible(),false);assert.equal(await page.locator('#uClearanceEnd').isVisible(),true);
 await page.click('#legacyView');assert.deepEqual(await snapshot(),clearance);
 await page.click('#updatedView');assert.deepEqual(await snapshot(),clearance);
 if(shots) await page.screenshot({path:path.join(shots,'nav-100d-only-desktop.png'),fullPage:true});
 await page.click('#clearUpdated');assert.equal(await page.evaluate(()=>navResult),null);
 await page.click('#planRoute');assert.equal(await page.inputValue('#planKind'),'route');
 await page.fill('#thrust','1');await page.selectOption('#distMode','au');await page.fill('#distanceAu','1.893');await page.check('#use100d');await page.click('#computePlan');
 for(const width of [320,375,768,1024,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);
  await page.click('#planRoute');assert.ok(await page.locator('#planDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'dialog overflow '+width);
  await page.click('#closePlan');
 }
 await page.setViewportSize({width:390,height:844});
 if(shots){await page.screenshot({path:path.join(shots,'nav-updated-mobile.png'),fullPage:true});await page.click('#planRoute');await page.screenshot({path:path.join(shots,'nav-plan-route-mobile.png')});await page.click('#closePlan');}
 // All reference-style controls invoke real existing workflows.
 assert.equal(await page.locator('.u-actions button').count(),6);
 for(const id of ['routeSummary','driveSummary']){
  const before=await snapshot();await page.click('#'+id);
  assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),true);
  await page.click('#closePlan');assert.deepEqual(await snapshot(),before);
 }
 const beforeLegacy=await snapshot();await page.click('#legacyUpdated');assert.equal(await page.locator('#updatedDashboard').isVisible(),false);assert.deepEqual(await snapshot(),beforeLegacy);
 await page.click('#updatedView');await page.click('#clearanceUpdated');
 assert.equal(await page.inputValue('#planKind'),'clearance');assert.equal(await page.locator('#planDialog').evaluate(e=>e.open),true);
 await page.click('#computePlan');assert.equal((await snapshot()).mode,'clearance');
 assert.deepEqual(errors,[]);
 console.log('Updated UI: shared-state/dice parity, compute, modal Escape/close/errors, profiles, 100D-only, reset, and five responsive widths passed.');
}finally{await browser.close();server.close();}

