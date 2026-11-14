import assert from 'node:assert/strict';
export async function recordedResultDetails(page){
 const result=page.locator('#last-action-result');await result.waitFor();
 const info=result.locator('[data-result-information]');
 if(!await info.count())return result.innerText();
 const main=await result.innerText();assert.doesNotMatch(main,/Table outcome:|Source:/);
 await info.click();const dialog=page.locator('#opening-help-dialog[open]');await dialog.waitFor();
 assert.equal(await dialog.locator('img').count(),1);
 const text=await dialog.innerText();await dialog.locator('[data-opening-help-close]').click();
 assert.equal(await info.evaluate(n=>n===document.activeElement),true);return text;
}
