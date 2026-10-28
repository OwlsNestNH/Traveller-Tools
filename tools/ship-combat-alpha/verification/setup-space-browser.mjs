import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifySetupSpace(browser,source,root,out){
 const results=[];
 for(const width of [1876,1440,1100,390,320]){
  const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage();
  await context.addInitScript(()=>{for(const k of ['getItem','setItem','clear','removeItem'])Storage.prototype[k]=()=>{throw Error('Storage touched');};});
  await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+'\nwindow.__spaceState=()=>structuredClone(state);window.__spaceThrust=n=>{state.ships[0].capabilities.thrust=n;state.ships[0].condition.hull=Math.min(1,state.ships[0].condition.hull);state.ships[0].flight.evasion=0;state.ships[0].flight.gunners=0;render();};'}));
  const state=()=>p.evaluate(()=>window.__spaceState());
  try{
   await p.goto(new URL('tools/ship-combat-alpha/',root).href);const initial=await state();await p.locator('[data-details]').first().click();await p.locator('#sheet-name').fill('Resize draft');await p.waitForFunction(()=>document.querySelector('#reserved-evasion').disabled);
   for(const w of [width,320,1876,width]){await p.setViewportSize({width:w,height:900});const b=await p.locator('#ship-sheet').boundingBox();assert.ok(b.x>=10&&b.x+b.width<=w-10);if(w>950)assert.ok(b.width>w*.85);const footer=await p.locator('#ship-sheet .dialog-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=900);assert.equal(await p.locator('#sheet-name').inputValue(),'Resize draft');}
   await p.screenshot({path:out+'wide-details-'+width+'.png'});await p.locator('#sheet-done').click();assert.deepEqual(await state(),initial);
   for(const total of [0,1,2,9,30,10000]){
    await p.evaluate(n=>window.__spaceThrust(n),total);await p.locator('[data-pilot-reserve=evasion]').click();const a=p.locator('#reserved-evasion'),b=p.locator('#reserved-gunners');assert.equal(await a.getAttribute('type'),'range');assert.equal(await a.isDisabled(),total===0);assert.equal(await a.getAttribute('max'),String(total));
    const before=await state();if(total){await a.focus();await p.keyboard.press('End');assert.equal(await a.inputValue(),String(total));assert.deepEqual(await state(),before);await b.evaluate(e=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await b.inputValue(),'0');assert.equal(await a.inputValue(),String(total));await a.focus();await p.keyboard.press('Home');await b.focus();await p.keyboard.press('End');assert.equal(await b.inputValue(),String(total));assert.equal(await a.inputValue(),'0');await p.locator('#flight-plan-form button').click();assert.equal((await state()).ships[0].flight.gunners,total);}
    assert.ok((await a.boundingBox()).width<=480);await p.screenshot({path:out+'reservation-'+total+'-'+width+'.png'});const ticks=await p.locator('#flight-plan-form .reservation-ticks').first().locator('span').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right};}));const scale=await p.locator('#flight-plan-form .reservation-ticks').first().boundingBox();assert.ok(ticks.at(-1).right<=scale.x+scale.width+1,'slider labels fit the scale');assert.ok(ticks.every((t,i)=>!i||t.left>=ticks[i-1].right+3),'numbered slider labels need readable gaps');
   }
   await p.locator('[data-select]').nth(1).click();const selected=(await state()).ships[1];assert.equal(await p.locator('#reserved-evasion').inputValue(),String(selected.flight.evasion));assert.equal(await p.locator('#reserved-gunners').inputValue(),String(selected.flight.gunners));results.push({width,resizeDraftCancel:true,sharedBudget:true,keyboard:true,zeroDisabled:true,switching:true,damagedCurrentThrust:true,setupLock:true});console.log('PASS wide setup and reservation sliders '+width);
  }finally{await context.close();}
 }
 await writeFile(out+'setup-space-report.json',JSON.stringify(results,null,2));
}
