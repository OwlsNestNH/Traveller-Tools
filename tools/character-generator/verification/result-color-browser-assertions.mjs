import assert from 'node:assert/strict';
export async function assertResultColor(page,status,{message=false}={}){
 const panel=page.locator('#last-action-result');
 assert.equal(await panel.getAttribute('data-result-status'),status);
 assert.equal(await panel.locator('.result-status').textContent(),{success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'}[status]);
 const lightExpected={success:'rgb(39, 99, 58)',failure:'rgb(164, 46, 46)',pending:'rgb(96, 116, 134)',info:'rgb(96, 116, 134)'}[status];
 const darkLaterScreen=await page.evaluate(()=>matchMedia('screen').matches&&!['identity','statistics','background'].includes(document.body.dataset.stage));
 const expected=darkLaterScreen?{success:'rgb(126, 198, 154)',failure:'rgb(238, 155, 155)',pending:'rgb(141, 170, 185)',info:'rgb(141, 170, 185)'}[status]:lightExpected;
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftColor),expected);
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftWidth),'8px');
 if(message)assert.equal(await page.locator('#message').evaluate(el=>getComputedStyle(el).borderLeftColor),lightExpected);
}
