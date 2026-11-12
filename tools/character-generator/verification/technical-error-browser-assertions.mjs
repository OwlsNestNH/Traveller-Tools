import assert from 'node:assert/strict';
export async function dismissTechnicalError(page){
 const popup=page.locator('#crow-error-dialog[open]');await popup.waitFor();
 const detail=await popup.locator('#crow-error-detail').innerText();assert.ok(detail.length);
 assert.equal(detail,await page.locator('#message').innerText(),'Crow retains the exact reported diagnostic');
 assert.equal(await popup.locator('#crow-error-title').evaluate(n=>n===document.activeElement),true);
 assert.equal(await popup.locator('[role=alert]').count(),1);
 assert.doesNotMatch(await popup.innerText(),/DUMMY|SPACE HORSES|NOT SO FAST/);
 await popup.getByRole('button',{name:'Close',exact:true}).click();
}
