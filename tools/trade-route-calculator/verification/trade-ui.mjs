// Compatibility helpers for regression suites exercising the existing engines.
// Navigation and the single Buy review are separately asserted in buy-page-browser.
// Each helper uses real UI controls; no application/state mutation is injected.
export async function tradeLabel(page,label){
 if(label==='Preview sale'||label==='Edit quantities / fees'){
  await page.locator('#sale-live-preview').waitFor();await page.evaluate(()=>document.activeElement?.blur());
  const roll=page.locator('#sale-tax-action [data-action="sale-tax-roll"]');if(await roll.isVisible())await roll.click();return true;
 }
 if(label==='Preview purchase'){
  await page.locator('#purchase-totals').waitFor();await page.evaluate(()=>document.activeElement?.blur());return true;
 }
 if(label==='Preview search'){
  const inline=page.locator('#supplier-form');
  if(await inline.count())await inline.locator('button[type="submit"]').click();else await page.locator('#modal-submit').click();
  return true;
 }
 if(label==='Find buyer'||label==='Get sale offers'){
  const sell=page.locator('.trade-subtabs [data-action="trade-side"][data-arg="sell"]');
  if(await sell.count()&&!await sell.evaluate(el=>el.classList.contains('active')))await sell.click();
  if(label==='Get sale offers'){await page.locator('[data-action="sale"]').filter({visible:true}).first().click();return true;}
 }
 if(label==='Find supplier'&&await page.locator('#supplier-form').count())return true;
 if(['Cancel','Close'].includes(label)&&!await page.locator('#modal').evaluate(el=>el.open)&&await page.locator('#supplier-form').count()){
  await page.locator('[data-action="supplier-cancel"]').click();return true;
 }
 return false;
}
export async function tradeField(page,name){
 const modal=page.locator('#modal[open] [name="'+name+'"]');
 const target=await modal.count()?modal:page.locator('#supplier-form [name="'+name+'"]');
 for(const details of await target.locator('xpath=ancestor::details').all())if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
 return target;
}
export async function existingSell(page){
 if(!await page.locator('.trade-subtabs').count())await page.locator('#tabs [data-arg="Trade"]').click();
 const sell=page.locator('.trade-subtabs [data-action="trade-side"][data-arg="sell"]');
 if(await sell.count()&&!await sell.evaluate(el=>el.classList.contains('active')))await sell.click();
}
export function purchaseTitle(text){return text==='Confirm purchase'?/^Review purchase/:typeof text==='string'&&text.startsWith('Purchase · ')?text.replace('Purchase · ','Review purchase · '):text;}
