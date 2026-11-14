import assert from 'node:assert/strict';
// Read the career record as a player does: one exclusive section at a time.
// Other stages keep their existing disclosure/navigation requirements.
export async function readRecordSections(page){
 const sheet=page.locator('#sheet'),bars=sheet.locator(':scope > details.army-record-section');
 if(!await bars.count())return sheet.innerText();
 const before=await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1'));
 const focused=await page.evaluateHandle(()=>document.activeElement);
 const original=await bars.evaluateAll(ns=>ns.findIndex(n=>n.open)),scroll=await page.evaluate(()=>({x:scrollX,y:scrollY})),text=[await sheet.innerText()];
 for(let i=0;i<await bars.count();i++){
  const bar=bars.nth(i);if(!await bar.evaluate(n=>n.open))await bar.locator(':scope > summary').click();
  assert.equal(await bar.isVisible(),true,'Record disclosure is visible after opening');
  assert.equal(await bars.evaluateAll(ns=>ns.filter(n=>n.open).length),1,'Record remains exclusive');
  text.push(await bar.innerText());
 }
 const open=await bars.evaluateAll(ns=>ns.findIndex(n=>n.open));
 if(original!==open){if(open>=0)await bars.nth(open).locator(':scope > summary').click();if(original>=0)await bars.nth(original).locator(':scope > summary').click();}
 await focused.evaluate(n=>{if(n?.isConnected)n.focus({preventScroll:true});});await focused.dispose();
 await page.evaluate(({x,y})=>scrollTo(x,y),scroll);
 assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),before,'Reading record sections preserves the saved session');
 return text.join('\n');
}
export async function openRecordSection(page,target){
 const before=await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1'));
 const bar=target.locator('xpath=ancestor-or-self::details[contains(concat(" ",normalize-space(@class)," ")," army-record-section ")]');
 if(await bar.count()&&!await bar.evaluate(n=>n.open))await bar.locator(':scope > summary').click();
 assert.equal(await target.isVisible(),true,'Requested record content is visible');
 assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),before,'Opening a record section preserves the saved session');
}
