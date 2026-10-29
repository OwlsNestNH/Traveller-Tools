import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function verifyStationPane(page,width,artifacts){
 const p=await page.context().newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker="onCommit:next=>{state=next;render();feedback('Engineer systems committed";
 assert.equal(source.split(marker).length,2);
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace(marker,"onCommit:next=>{if(window.__failStationSave)throw Error('Injected save failure');state=next;render();feedback('Engineer systems committed")+"\nwindow.__stationState=()=>structuredClone(state);"}));
 try{
  await p.goto(page.url());await p.locator('.ship-node').first().waitFor();const state=()=>p.evaluate(()=>window.__stationState()),initial=await state();
  const choose=async id=>{if(width<701)await p.locator('.mobile-stations').evaluate(e=>e.open=true);const b=p.locator((width<701?'.mobile-stations ':'.station-regions ')+'[data-console-station='+id+']');await b.focus();await p.keyboard.press('Enter');};
  assert.equal(await p.locator('#coordinate-fallback').evaluate(e=>e.open),false);assert.equal(await p.locator('#target-q').isVisible(),false);
  await choose('engineer');assert.equal(await p.locator('#selected-controls').isVisible(),false);assert.equal(await p.locator('#ships').isVisible(),true);assert.match(await p.locator('#station-records').textContent(),/Weapons/);
  const basic=p.locator('[data-station-system=basic]');await basic.selectOption('50');assert.deepEqual(await state(),initial);assert.match(await p.locator('#station-pending').textContent(),/Pending Engineer/);
  await choose('sensors');assert.match(await p.locator('#station-records').textContent(),/Missiles · Sensors.*General ship-contact detection remains manual/);assert.deepEqual(await state(),initial);
  await p.locator('[data-select=scout]').click();await choose('engineer');assert.equal(await basic.isDisabled(),true);await p.locator('[data-station-return]').click();assert.equal(await basic.inputValue(),'50');await p.locator('[data-station-cancel]').first().click();assert.deepEqual(await state(),initial);
  for(const v of ['0','50','100']){await basic.selectOption(v);assert.deepEqual(await state(),initial);}await basic.selectOption('50');
  const weapons=p.locator('.engineer-row').filter({has:p.getByText('Weapons',{exact:true})}).getByRole('switch');assert.equal(await weapons.isChecked(),false);if(width<500)await weapons.tap();else await weapons.check();assert.deepEqual(await state(),initial);
  await p.evaluate(()=>window.__failStationSave=true);await p.locator('[data-station-commit]').click();assert.match(await p.locator('#station-error').textContent(),/Injected save failure/);assert.deepEqual(await state(),initial);await p.evaluate(()=>window.__failStationSave=false);await p.locator('[data-station-commit]').evaluate(e=>{e.click();e.click();});
  const committed=await state();assert.equal(committed.revision,initial.revision+1);assert.equal(committed.ships[0].systems.basic,50);assert.deepEqual(committed.ships[0].template,initial.ships[0].template);assert.equal(committed.ships[0].condition.powerUsed,initial.ships[0].condition.powerUsed);assert.deepEqual(committed.ships[1],initial.ships[1]);
  // Engineer completion immediately releases console locks, with no unrelated repaint.
  assert.equal(await p.locator('[data-range=hull]').isDisabled(),false);
  for(const key of ['hull','fuel','powerOutput']){
   await p.locator('[data-open-stat="'+key+'"]').click();await p.locator('[data-value="'+key+'"]').fill('0');
   assert.equal(await basic.isDisabled(),true);assert.deepEqual(await state(),committed);
   await p.locator('#console-cancel').click();assert.equal(await basic.isDisabled(),false);
  }
  const unknown=p.locator('#ship-console [data-unknown-value]').first();if(await unknown.count()){assert.equal(await unknown.isDisabled(),false);await unknown.evaluate(e=>{for(let d=e.closest('details');d;d=d.parentElement.closest('details'))d.open=true;});await unknown.click();await p.locator('#unknown-value-dialog').getByRole('button',{name:'Cancel',exact:true}).click();}
  await choose('pilot');await p.locator('[data-open-stat=hull]').click();await p.locator('[data-value=hull]').fill('0');await choose('engineer');assert.equal(await basic.isDisabled(),true);await p.locator('#console-cancel').click();assert.equal(await basic.isDisabled(),false);assert.deepEqual(await state(),committed);
  await p.locator('[data-station-advanced]').click();assert.equal(await p.locator('#systems-dialog').isVisible(),true);await p.locator('#cancel-systems').click();assert.equal(await basic.isDisabled(),false);assert.deepEqual(await state(),committed);
  if([1440,320].includes(width)){await p.locator('#station-pane-title').scrollIntoViewIfNeeded();await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ship-node image')].map(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode();}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await p.screenshot({path:artifacts+'station-engineer-'+width+'.png'});}
  await choose('pilot');assert.equal(await p.locator('#selected-controls').isVisible(),true);assert.equal(await p.locator('#coordinate-fallback').evaluate(e=>e.open),false);await p.locator('#coordinate-fallback summary').click();await p.locator('#target-q').focus();assert.equal(await p.locator('#target-q').evaluate(e=>e===document.activeElement),true);
  await p.locator('[data-pilot-action=coast]').click();assert.equal((await state()).ships[0].flight.braking,false);await p.locator('[data-pilot-action=brake]').click();assert.equal((await state()).ships[0].flight.braking,true);
  await p.locator('#coordinate-fallback summary').click();if([1440,320].includes(width)){await p.locator('#station-pane-title').scrollIntoViewIfNeeded();await p.screenshot({path:artifacts+'station-pilot-'+width+'.png'});}
  for(const role of ['captain','comms','astrogator','damage','gunnery']){await choose(role);assert.ok((await p.locator('#station-records').textContent()).length>50);}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);
  await writeFile(artifacts+'station-checks-'+width+'.json',JSON.stringify({width,passed:true,pendingShipIsolation:true,failedSaveRetry:true,oneCommit:true,templatePreserved:true,storageAccesses:[]},null,2));
 }finally{await p.close();}
}
