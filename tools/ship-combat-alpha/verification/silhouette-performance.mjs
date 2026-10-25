import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker='state=createState(),selected=';
assert.equal(source.split(marker).length,2);
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/';
try{
for(const variant of ['representative','approved'])for(let run=0;run<3;run++){
 const context=await browser.newContext({viewport:{width:1440,height:980}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const icons=variant==='approved'?['armed-trader','stealth-scout','hunting-ship','kashu-fighter','extended-scout']:['trader','scout','corvette','fighter','scout'];
 const ships=Array.from({length:10},(_,i)=>({id:'load-'+i,name:'Synthetic '+i,appearance:{icon:icons[i%5],side:i%2?'B':'A'},capabilities:{thrust:1},motion:{position:{q:(i%5)*3-6,r:Math.floor(i/5)*4-2},velocity:{q:0,r:0},impulse:{q:0,r:0}}}));
 await page.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace(marker,'state=createState({ships:'+JSON.stringify(ships)+'}),selected=')+'\nwindow.__perfZoom=z=>{camera={...camera,zoom:z};scheduleMap();};'}));
 await page.goto(new URL('tools/ship-combat-alpha/',root).href);await page.locator('.ship-node').first().waitFor();await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ship-silhouette')].map(async e=>{const im=new Image();im.src=e.href.baseVal;await im.decode();}));});
 const frames=await page.evaluate(async()=>{const spans=[];for(let i=0;i<90;i++){const t=performance.now();window.__perfZoom(.7+(i%15)*.05);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(i>=15)spans.push(performance.now()-t);}return spans;});
 const revision=await page.locator('#map').getAttribute('data-revision'),before=await page.locator('#scene').getAttribute('transform'),box=await page.locator('#map').boundingBox();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.35);await page.mouse.down();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45,{steps:12});await page.mouse.up();await page.waitForFunction(t=>document.querySelector('#scene').getAttribute('transform')!==t,before);assert.equal(await page.locator('#map').getAttribute('data-revision'),revision);
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/ships/')).map(r=>({file:r.name.split('/').at(-1),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,duration:r.duration})));
 const unique=[...new Set(resources.map(r=>r.file))];assert.equal(unique.length,variant==='approved'?5:4,'only used sprite files loaded');assert.equal(await page.locator('.ship-node').count(),10);assert.deepEqual(errors,[]);
 const sorted=[...frames].sort((a,b)=>a-b);results.push({variant,run,shipCount:10,uniqueFiles:unique,resources,medianTwoFrameMs:sorted[Math.floor(sorted.length*.5)],p95TwoFrameMs:sorted[Math.floor(sorted.length*.95)],maxTwoFrameMs:sorted.at(-1),revisionStableDuringPan:true});if(run===0)await page.screenshot({path:artifacts+'silhouette-performance-'+variant+'.png'});await context.close();
}
await writeFile(artifacts+'silhouette-performance.json',JSON.stringify({environment:'Headless browser, 1440x980, loopback, 10 ships (current supported maximum), three fresh contexts per variant; 75 post-warmup two-frame zoom samples per run. Timing includes frame scheduling and is not a universal FPS benchmark.',head:process.env.SHIP_COMBAT_COMMIT||null,results},null,2));console.log(JSON.stringify(results.map(({resources,...r})=>r),null,2));
}finally{await browser.close();}
