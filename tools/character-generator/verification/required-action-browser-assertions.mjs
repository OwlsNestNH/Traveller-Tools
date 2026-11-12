import assert from 'node:assert/strict';
// Assert the new accessible warning contract, not the old global transport notice.
export async function assertRequiredWarning(page,selector,detail){
 const warning=page.locator('.required-action-warning:visible');await warning.waitFor();
 assert.match(await warning.innerText(),detail);assert.equal(await warning.getAttribute('role'),'alert');
 const control=page.locator(selector).first();assert.equal(await control.getAttribute('aria-invalid'),'true');
 assert.equal(await control.evaluate(n=>n===document.activeElement),true);
 assert.ok((await control.getAttribute('aria-describedby')).split(/\s+/).includes(await warning.getAttribute('id')));
 if(await page.locator('dialog[open]').count())assert.equal(await warning.evaluate(n=>!!n.closest('dialog[open]')),true);
}
