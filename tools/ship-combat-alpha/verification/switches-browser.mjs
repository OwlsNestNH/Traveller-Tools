import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function verifySwitches(page,width,artifacts){
 const p=await page.context().newPage(),inventory=[];
 // Use current catalogue samples, independently of the parent suite's legacy movement fixture.
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source}));
 const capture=async name=>{if(![1440,320].includes(width))return;for(const before of [true,false]){await p.locator('link[href="switches.css"]').evaluate((e,disabled)=>e.sheet.disabled=disabled,before);await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('image')].map(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode().catch(()=>{});}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await p.screenshot({path:artifacts+'switches-'+name+'-'+(before?'before':'after')+'-'+width+'.png'});}};
 const inspect=async context=>{
  const rows=await p.locator('input[type=checkbox]').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),knob=getComputedStyle(e,'::after');return {id:e.id||e.outerHTML,appearance:s.appearance,width:s.width,height:s.height,radius:s.borderRadius,knob:knob.width,left:knob.left,checked:e.checked,disabled:e.disabled};}));
  for(const row of rows){assert.equal(row.appearance,'none');assert.equal(row.width,'42px');assert.equal(row.height,'24px');assert.equal(row.radius,'24px');assert.equal(row.knob,'16px');assert.equal(row.left,row.checked?'21px':'3px');}inventory.push({context,rows});
 };
 try{
  await p.goto(page.url());await p.locator('.ship-node').first().waitFor();await inspect('map');
  await p.locator('.map-footer').evaluate(e=>e.open=true);const grid=p.locator('#grid-toggle'),initial=await grid.isChecked();await grid.focus();await p.keyboard.press('Space');assert.equal(await grid.isChecked(),!initial);await p.keyboard.press('Space');assert.equal(await grid.isChecked(),initial);await p.keyboard.press('Tab');assert.equal(await p.locator('#ranges-toggle').evaluate(e=>e===document.activeElement),true);
  await grid.locator('..').click({position:{x:55,y:22}});assert.equal(await grid.isChecked(),!initial);await grid.locator('..').click({position:{x:55,y:22}});
  if(width<701)await p.locator('.mobile-stations').evaluate(e=>e.open=true);
  await p.locator((width<701?'.mobile-stations ':'.station-regions ')+'[data-console-station=engineer]').click();await inspect('engineer');
  const sw=p.locator('[data-station-system=drive]').first();
  const target=await sw.count()?sw:p.locator('[data-station-system][type=checkbox]').first(),checked=await target.isChecked();
  if(width<500)await target.tap();else{await target.focus();await p.keyboard.press('Space');}assert.equal(await target.isChecked(),!checked);await inspect('engineer draft');await p.locator('[data-station-cancel]').first().click();assert.equal(await target.isChecked(),checked);
  await p.locator('.engineer-row').nth(1).scrollIntoViewIfNeeded();await capture('engineer');
  await p.locator('[data-station-advanced]').click();await inspect('advanced systems');await p.locator('#extra-systems').evaluate(e=>e.open=true);await p.locator('#add-installed-system').click();await inspect('additional installed equipment');await p.locator('#cancel-systems').click();
  await p.locator('#add-ship-main').click();await inspect('add ship and detailed crew');
  await p.locator('#add-sand').scrollIntoViewIfNeeded();await capture('add');
  await p.locator('#cancel-setup').click();await p.locator('#open-setup').click();await inspect('loaded design, synthetic movement and crew');await p.locator('#cancel-setup').click();
  await p.locator('#selected-identity').evaluate(e=>e.open=true);await p.locator('[data-console-condition]').click();await inspect('current condition critical status');await p.locator('#cancel-condition').click();
  await p.locator('[data-details]').first().click();await p.locator('#sheet-crew').click();await p.locator('[data-edit-crew=pilot]').click();await inspect('details crew');await p.locator('#cs-cancel').click();await p.locator('#sheet-close').click();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await writeFile(artifacts+'switches-checks-'+width+'.json',JSON.stringify({width,passed:true,inventory},null,2));
 }finally{await p.close();}
}
