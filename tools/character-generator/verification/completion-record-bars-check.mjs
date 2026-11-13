import assert from 'node:assert/strict';
// Exercise the same real controls on all three completion stages, both transports,
// desktop and narrow phones. Opening a record never sends a character command.
export async function verifyCompletionRecordBars(page,{stage,width,http,raw,key,out}){
 const bars=page.locator('#sheet > details[data-precareer-bar]');
 const ids=await bars.evaluateAll(nodes=>nodes.map(n=>n.id));
 assert.ok(ids.includes('completion-characteristics')&&ids.includes('completion-skills')&&ids.includes('completion-notes')&&ids.includes('completion-more-record'));
 assert.equal(await bars.filter({has:page.locator(':scope > summary')}).count(),ids.length);
 assert.equal(await page.locator('#sheet > details[data-precareer-bar][open]').count(),0,'Record starts collapsed, like accepted Education');
 const before=await page.locator('#sheet').textContent();let commands=0;
 const request=r=>{if(r.method()==='POST')commands++;};page.on('request',request);
 for(const id of ids){
  const summary=page.locator('#'+id+' > summary');await summary.focus();await summary.press('Enter');
  await page.waitForFunction(id=>document.getElementById(id).open&&document.querySelectorAll('#sheet > details[data-precareer-bar][open]').length===1,id);
  assert.equal(await summary.evaluate(n=>n===document.activeElement),true,'Keyboard focus stays on chosen bar');
  assert.ok((await summary.boundingBox()).height>=44,'Record controls retain touch targets');
  assert.equal(await page.locator('#sheet').textContent(),before,'All original record content is retained');
  if(!http&&width!==320&&['completion-characteristics','completion-skills'].includes(id))await page.screenshot({path:new URL(`imperial-completion-record-bars-${stage}-${id.replace('completion-','')}-${width}.png`,out).pathname,fullPage:true});
 }
 // Older-browser fallback remains exclusive without native named-details support.
 await bars.evaluateAll(nodes=>nodes.forEach(n=>n.removeAttribute('name')));
 for(const id of ids.slice(0,2)){
  const control=page.locator('#'+id+' > summary');if(width<650)await control.tap();else await control.click();
  await page.waitForFunction(id=>document.getElementById(id).open&&document.querySelectorAll('#sheet > details[data-precareer-bar][open]').length===1,id);
 }
 await page.locator('#sheet > details[data-precareer-bar][open] > summary').click();
 await page.waitForFunction(()=>document.querySelectorAll('#sheet > details[data-precareer-bar][open]').length===0);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw,'Expansion preserves exact saved bytes');
 assert.equal(commands,0,'Expansion never sends a command');page.off('request',request);
 await page.evaluate(()=>scrollTo(0,0));
}
