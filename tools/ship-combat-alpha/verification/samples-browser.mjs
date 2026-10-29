import {advanceMovement} from './console-navigation.mjs';
import {assertSampleEquivalent} from './sample-equivalence.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createState,normalizeState} from '../engine.mjs';
export async function verifySamples(page,width,artifacts){
 const p=await page.context().newPage(),source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),expected=createState(),records=[],paintChecks=[];p.setDefaultTimeout(15000);
 await p.setViewportSize({width,height:width<500?700:982});
 await p.addInitScript(()=>{
  window.__sampleImageLoads=new WeakMap();let serial=0;
  const track=e=>{if(!e.matches?.('image.ship-silhouette')||window.__sampleImageLoads.has(e))return;const state={instance:++serial,loaded:false,error:false,href:e.href.baseVal};window.__sampleImageLoads.set(e,state);e.addEventListener('load',()=>{state.loaded=true;state.loadedAt=performance.now();});e.addEventListener('error',()=>{state.error=true;});};
  new MutationObserver(records=>{for(const record of records)for(const n of record.addedNodes){track(n);n.querySelectorAll?.('image.ship-silhouette').forEach(track);}}).observe(document,{subtree:true,childList:true});
 });
 const painted=async step=>{
  await p.evaluate(()=>document.fonts.ready);
  const deadline=Date.now()+15000;let images=null;
  while(Date.now()<deadline){
   await p.waitForFunction(()=>{const nodes=[...document.querySelectorAll('.ship-silhouette')];return nodes.length===5&&nodes.every(e=>e.isConnected&&window.__sampleImageLoads.get(e)?.loaded&&!window.__sampleImageLoads.get(e)?.error);},null,{timeout:Math.max(1,deadline-Date.now())});
   images=await p.evaluate(async()=>{
    const nodes=[...document.querySelectorAll('.ship-silhouette')];for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));const current=[...document.querySelectorAll('.ship-silhouette')];if(!nodes.every((e,i)=>e===current[i]&&e.isConnected&&window.__sampleImageLoads.get(e)?.loaded))return null;
    return nodes.map(e=>{const b=e.getBoundingClientRect();return {id:e.closest('.ship-node').dataset.ship,connected:e.isConnected,...window.__sampleImageLoads.get(e),paintedAt:performance.now(),bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};});
   });if(images)break;
  }
  assert.ok(images,'current image cohort did not settle within 15 seconds');for(const image of images){assert.equal(image.loaded,true);assert.equal(image.error,false);assert.ok(image.bounds.width>0&&image.bounds.height>0);assert.ok(image.paintedAt>=image.loadedAt);}paintChecks.push({step,images});return images;
 };
 const capture=async path=>{
  // Resize/scroll can replace image nodes between commands. Accept only a capture
  // whose exact loaded-and-painted node cohort survives the screenshot interval.
  for(let attempt=1;attempt<=3;attempt++){
   const images=await painted(path.split(/[\\/]/).at(-1));await p.screenshot({path});const after=await p.locator('.ship-silhouette').evaluateAll(nodes=>nodes.map(e=>({instance:window.__sampleImageLoads.get(e)?.instance,loaded:window.__sampleImageLoads.get(e)?.loaded,error:window.__sampleImageLoads.get(e)?.error})));
   const stable=after.length===images.length&&after.every((e,i)=>e.instance===images[i].instance&&e.loaded&&!e.error);Object.assign(paintChecks.at(-1),{captureAttempt:attempt,captureStable:stable,after});if(stable)return;
  }
  assert.fail('Map image nodes kept changing during bounded screenshot capture: '+path);
 };
 // Read-only test inspector; initial state, reset and all UI paths use unchanged production code.
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+'\nwindow.__readSample=()=>structuredClone(state);'}));
 try{
  await p.goto(page.url(),{waitUntil:'domcontentloaded'});await p.locator('.ship-node').first().waitFor();await painted('initial');assertSampleEquivalent(await p.evaluate(()=>window.__readSample()),expected);
  const symbols={merchant:['armed-trader','armed-trader.svg'],courier:['hunting-ship','hunting-ship.svg'],scout:['stealth-scout','stealth-scout.svg'],fighter:['kashu-fighter','kashu-fighter.svg'],escort:['harrier','harrier-custom.svg']};
  for(const [id,[icon,file]]of Object.entries(symbols)){const node=p.locator('[data-ship="'+id+'"]');assert.equal(await node.getAttribute('data-icon'),icon);assert.equal(await node.locator('.ship-silhouette').getAttribute('href'),'assets/ships/'+file);if(id!=='escort')assert.match(await node.getAttribute('aria-description'),/interpreted deckplan/i);else assert.match(await node.getAttribute('aria-description'),/custom simplified reference-derived/);}
  await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ship-silhouette')].map(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode();}));});
  assert.equal(await p.locator('.ship-choice').count(),5);assert.equal(await p.locator('#status-hull-current').textContent(),'80');
  for(const s of expected.ships){await p.locator('[data-details="'+s.id+'"]').click();const sheet=await p.locator('#ship-sheet').textContent();assert.ok(sheet.includes(s.template.source.book));assert.ok(sheet.includes(String(s.template.source.page)));assert.ok(sheet.includes(String(s.template.record.ratedPower)));assert.ok(sheet.includes(String(s.template.thrust)));await p.locator('#sheet-close').click();}
  await p.locator('[data-select="merchant"]').click();
  for(const expanded of [false,true]){
   if(expanded)await p.locator('#expand-map').click();await p.evaluate(()=>{scrollTo(0,0);document.querySelector('#combat-right').scrollTop=0;});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await painted(expanded?'fit-expanded':'fit-normal');
   const bounds=await p.evaluate(()=>{const map=document.querySelector('#map'),b=map.getBoundingClientRect();return {map:{x:b.x,y:b.y,width:b.width,height:b.height},zoom:map.dataset.zoom,ships:[...document.querySelectorAll('.ship-node')].map(n=>{const m=n.getScreenCTM(),p=new DOMPoint(0,0).matrixTransform(m);return{id:n.dataset.ship,x:p.x,y:p.y};})};});
   for(const s of bounds.ships){assert.ok(s.x>bounds.map.x+10&&s.x<bounds.map.x+bounds.map.width-10,'initial ship visible horizontally '+JSON.stringify(s));assert.ok(s.y>bounds.map.y+10&&s.y<bounds.map.y+bounds.map.height-10,'initial ship visible vertically '+JSON.stringify(s));}
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));records.push({width,expanded,...bounds});await capture(artifacts+'sample-encounter-'+(expanded?'expanded-':'normal-')+width+'.png');
  }
  await p.locator('#expand-map').click();await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();await p.waitForFunction(()=>document.querySelector('#zoom-level').textContent==='100%');await painted('100-normal');await capture(artifacts+'sample-silhouettes-100-normal-'+width+'.png');await p.locator('#expand-map').click();await painted('100-expanded');await capture(artifacts+'sample-silhouettes-100-expanded-'+width+'.png');
  await p.locator('#expand-map').click();await p.locator('#open-setup').click();await p.locator('#ship-name').fill('Uncommitted sample edit');await p.locator('#reset').evaluate(e=>e.click());assert.equal(await p.locator('#setup-dialog').isVisible(),false);assertSampleEquivalent(await p.evaluate(()=>window.__readSample()),expected);
  await advanceMovement(p);assert.equal((await p.evaluate(()=>window.__readSample())).round,1);await p.locator('#reset').click();assertSampleEquivalent(await p.evaluate(()=>window.__readSample()),expected);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(expected))),expected);await painted('reset');
  assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);await writeFile(artifacts+'sample-encounter-'+width+'.json',JSON.stringify({head:process.env.SHIP_COMBAT_COMMIT??null,ships:expected.ships.map(s=>({id:s.id,name:s.name,source:s.template.source,position:s.motion.position,velocity:s.motion.velocity,thrust:s.capabilities.thrust,hull:s.condition.hull,ratedPower:s.template.record.ratedPower,appearance:s.appearance})),views:records,paintChecks},null,2));
 }finally{await p.close();}
}
