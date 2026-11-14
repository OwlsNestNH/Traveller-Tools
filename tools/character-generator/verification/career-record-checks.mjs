import assert from 'node:assert/strict';
// Exercise the shared record rail in each real career/specialty browser route.
// UI expansion must neither issue commands nor change the saved character.
export async function checkCareerRecordBars(page){
 const bars=page.locator('#sheet > details.army-record-section'),raw=await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1'));
 const count=await bars.count();assert.ok(count>=3,'Career rail includes Life path as well as Characteristics and Skills');
 const labels=await bars.locator(':scope > summary').allTextContents();assert.ok(labels.includes('Life path'));
 assert.equal(await page.locator('#sheet > .sheet-section').count(),0,'Record sections are not left expanded outside the accordions');
 for(let i=0;i<count;i++){
  const bar=bars.nth(i);await bar.locator(':scope > summary').focus();
  if(!await bar.evaluate(n=>n.open))await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('#sheet > details.army-record-section[open]').length===1);
  assert.equal(await bar.evaluate(n=>n.open),true,'Keyboard opens the chosen record bar');
 }
 assert.equal(await bars.nth(0).evaluate(n=>n.open),false,'Opening Skills closes Characteristics');
 await bars.nth(count-1).locator(':scope > summary').click();
 await page.waitForFunction(()=>document.querySelectorAll('#sheet > details.army-record-section[open]').length===0);
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await bars.evaluateAll(ns=>ns.every(n=>n.open)),true,'Printing includes all record sections');
 // Allow toggle callbacks to run while the print view is active.
 await page.waitForTimeout(30);
 assert.equal(await bars.evaluateAll(ns=>ns.every(n=>n.open)),true,'Screen exclusivity does not hide printed sections');
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.waitForFunction(()=>document.querySelectorAll('#sheet > details.army-record-section[open]').length===0);
 assert.equal(await bars.evaluateAll(ns=>ns.every(n=>n.name==='career-record-bars')),true,'Printing restores screen grouping');
 await bars.nth(0).locator(':scope > summary').click();
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await bars.evaluateAll(ns=>ns.every(n=>n.open)),true);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.deepEqual(await bars.evaluateAll(ns=>ns.map(n=>n.open)),Array.from({length:count},(_,i)=>i===0),'Printing restores the previously expanded section');
 await bars.nth(0).locator(':scope > summary').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),raw,'Record disclosure preserves exact saved bytes');
}
