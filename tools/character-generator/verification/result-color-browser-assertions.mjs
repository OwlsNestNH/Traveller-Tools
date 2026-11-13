import assert from 'node:assert/strict';
export async function assertResultColor(page,status,{message=false}={}){
 const panel=page.locator('#last-action-result');
 assert.equal(await panel.getAttribute('data-result-status'),status);
 assert.equal(await panel.locator('.result-status').innerText(),{success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'}[status]);
 // The shared failed-qualification window uses the approved dark career palette.
 // Keep exact color checks for both that shell and the legacy result surface.
 const dark=await page.locator('body').getAttribute('data-career-template')==='core.army';
 const expected=(dark?{success:'rgb(136, 217, 162)',failure:'rgb(255, 89, 100)',pending:'rgb(255, 211, 75)',info:'rgb(121, 167, 187)'}:{success:'rgb(39, 99, 58)',failure:'rgb(164, 46, 46)',pending:'rgb(96, 116, 134)',info:'rgb(96, 116, 134)'})[status];
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftColor),expected);
 const popup=await panel.evaluate(el=>Boolean(el.closest('#army-career-dialog')));
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderLeftWidth),popup?'0px':'8px');
 if(popup&&['success','failure'].includes(status))assert.equal(await panel.locator('.result-status').evaluate(el=>getComputedStyle(el).color),status==='success'?'rgb(180, 239, 188)':'rgb(255, 123, 133)');
 if(message)assert.equal(await page.locator('#message').evaluate(el=>getComputedStyle(el).borderLeftColor),expected);
}
