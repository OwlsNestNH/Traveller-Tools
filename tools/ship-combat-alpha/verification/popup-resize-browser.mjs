import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyPopupResize(browser,source,root,out){
 const context=await browser.newContext({viewport:{width:1876,height:1000}}),page=await context.newPage(),errors=[],records=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await context.addInitScript(()=>{for(const method of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[method]=()=>{throw Error('Popup test touched storage');};indexedDB.open=()=>{throw Error('Popup test touched database');};});
 await page.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:source+'\nwindow.__resizeState=()=>structuredClone(state);'}));
 const state=()=>page.evaluate(()=>window.__resizeState());
 const bounds=async id=>{
  await page.waitForFunction(id=>{const modal=document.getElementById(id),els=[modal,...modal.querySelectorAll('.dialog-header button,.dialog-footer button')];return modal.open&&els.every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;});},id).catch(async error=>{console.error(JSON.stringify(await page.locator('#'+id).evaluate(e=>({viewport:[innerWidth,innerHeight],elements:[e,...e.querySelectorAll('.dialog-header button,.dialog-footer button')].map(n=>({id:n.id,box:n.getBoundingClientRect().toJSON()}))}))));throw error;});
  return page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
 };
 try{
  await page.goto(new URL('tools/ship-combat-alpha/',root).href);
  for(const spec of [{id:'condition-dialog-popup',open:'[data-console-condition]',field:'#current-hull',value:'79',cancel:'#cancel-condition',save:'#save-condition'}, {id:'systems-dialog-popup',open:'#open-systems',field:'#basic-mode',value:'50',cancel:'#cancel-systems',save:'#commit-systems'}]){
   const before=await state();
   for(const commit of [false,true]){
    await page.setViewportSize({width:1876,height:1000});await page.locator(spec.open).evaluate(e=>e.click());await page.locator('#'+spec.id).waitFor();
    if(spec.field==='#basic-mode')await page.locator(spec.field).selectOption(spec.value);else await page.locator(spec.field).fill(spec.value);
    for(const [width,height] of [[900,600],[700,500],[390,600],[320,568],[1876,1000],[900,600]]){
     await page.setViewportSize({width,height});records.push({popup:spec.id,commit,...await bounds(spec.id)});assert.equal(await page.locator(spec.field).inputValue(),spec.value);assert.deepEqual(await state(),before);
    }
    const oldWidth=await page.locator('#'+spec.id).evaluate(e=>e.getBoundingClientRect().width);await page.locator('#console-frame').evaluate(e=>e.style.width='70%');await page.waitForFunction(({id,oldWidth})=>document.getElementById(id).getBoundingClientRect().width<oldWidth-1,{id:spec.id,oldWidth});records.push({popup:spec.id,frameResize:true,...await bounds(spec.id)});assert.equal(await page.locator(spec.field).inputValue(),spec.value);assert.deepEqual(await state(),before);await page.locator('#console-frame').evaluate(e=>e.style.removeProperty('width'));
    await page.screenshot({path:out+spec.id+'-resized.png'});await page.locator(commit?spec.save:spec.cancel).click();await page.locator('#'+spec.id).waitFor({state:'hidden'});
    if(!commit)assert.deepEqual(await state(),before);else{const after=await state();assert.equal(after.revision,before.revision+1);assert.deepEqual(after.ships.slice(1),before.ships.slice(1));if(spec.field==='#basic-mode')assert.equal(after.ships[0].systems.basic,50);else assert.equal(after.ships[0].condition.hull,79);}
   }
  }
  assert.deepEqual(errors,[]);await writeFile(out+'popup-resize-report.json',JSON.stringify({passed:true,records,draftsPreserved:true,cancelUnchanged:true,explicitSaveOnce:true},null,2));console.log('PASS open popup resize: Condition and Power, desktop/mobile/frame, cancel and save');
 }finally{await context.close();}
}
