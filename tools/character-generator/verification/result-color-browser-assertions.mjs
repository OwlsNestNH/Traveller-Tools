import assert from 'node:assert/strict';
export async function assertResultColor(page,status,{message=false}={}){
 const panel=page.locator('#last-action-result');
 assert.equal(await panel.getAttribute('data-result-status'),status);
 assert.equal(await panel.locator('.result-status').innerText(),{success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'}[status]);
 const expected={success:'rgb(39, 99, 58)',failure:'rgb(164, 46, 46)',pending:'rgb(96, 116, 134)',info:'rgb(96, 116, 134)'}[status];
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftColor),expected);
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftWidth),'8px');
 if(message)assert.equal(await page.locator('#message').evaluate(el=>getComputedStyle(el).borderLeftColor),expected);
}
