import {openStation,closeStation,workflowAction} from './console-navigation.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function verifyWorkflow(page,width,artifacts){
 const p=await page.context().newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace('state=applyCommand(state,{...command,','if(window.__failWorkflow)throw Error("Injected command failure");state=applyCommand(state,{...command,')+'\nwindow.__workflowState=()=>structuredClone(state);'}));
 const state=()=>p.evaluate(()=>window.__workflowState()),click=action=>workflowAction(p,action);
 const geometry=()=>p.locator('#map').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,transform:document.querySelector('#scene').getAttribute('transform')}));
 const choose=role=>openStation(p,role);
 try{
  await p.goto(page.url());await p.locator('.ship-node').first().waitFor();const original=await state(),map=await geometry();
  assert.equal(await p.locator('[data-workflow=start]').isDisabled(),true);
  await choose('pilot');await p.locator('#round-planning').evaluate(e=>e.open=true);await p.locator('#initiative-editor').evaluate(e=>e.open=true);await p.locator('#initiative-0').fill('20');await closeStation(p);await p.locator('[data-select=scout]').click();await choose('pilot');assert.equal(await p.locator('#initiative-0').inputValue(),'20');assert.deepEqual(await state(),original);
  await p.locator('#cancel-initiative-draft').click();assert.equal(await p.locator('#initiative-0').inputValue(),'');
  for(let i=0;i<5;i++)await p.locator('#initiative-'+i).fill(String(i+1));
  await p.evaluate(()=>window.__failWorkflow=true);await p.locator('#initiative-form button').click();assert.match(await p.locator('#error').textContent(),/Injected/);assert.deepEqual(await state(),original);assert.equal(await p.locator('#initiative-4').inputValue(),'5');
  await p.evaluate(()=>window.__failWorkflow=false);await p.locator('#initiative-form button').click();
  await p.locator('#initiative-editor').evaluate(e=>e.open=false);await p.locator('#round-planning').evaluate(e=>e.open=false);
  await click('start');assert.equal((await state()).workflow.phase,'thrust');assert.match(await p.locator('#workflow-strip').textContent(),/Acting: Armed Trader.*Next: Hunting Ship/);assert.equal(await p.locator('#advance').isDisabled(),true);
  assert.equal(await p.locator('[data-pilot-commit]').isVisible(),false);assert.equal(await p.locator('#begin-acceleration').isVisible(),false);
  await choose('gunnery');assert.match(await p.locator('#station-records').textContent(),/Resolve committed attacks through Battle workflow/);await choose('pilot');
  if(await p.locator('[data-workflow=select]').count())await click('select');await closeStation(p);await p.locator('[data-workflow=plot]').evaluate(e=>{e.click();e.click();});
  assert.match(await p.locator('#workflow-strip').textContent(),/Acting: Hunting Ship/);assert.equal(await p.locator('[data-select=courier]').getAttribute('aria-pressed'),'true');
  const once=await state();await p.keyboard.press('Enter');assert.deepEqual(await state(),once);assert.deepEqual(once.acceleration.declared,['merchant']);assert.deepEqual(once.ships.map(s=>s.motion),original.ships.map(s=>s.motion));
  await p.locator('#battle-workflow details').evaluate(e=>e.open=true);await click('reopen');assert.deepEqual((await state()).acceleration.declared,[]);
  // Existing Engineer draft survives navigation and blocks workflow mutation until Cancel.
  await choose('engineer');await p.locator('[data-station-system=basic]').selectOption('50');const pending=await state();assert.equal(await p.locator('[data-workflow=plot]').isDisabled(),true);
  await choose('sensors');assert.deepEqual(await state(),pending);await p.locator('[data-station-cancel]').first().click();await choose('pilot');
  await p.locator('#command-bar').screenshot({path:artifacts+'workflow-thrust-'+width+'.png'});
  for(let i=0;i<5;i++){if(await p.locator('[data-workflow=select]').count())await click('select');await click('plot');}
  assert.equal((await state()).workflow.phase,'movement');assert.deepEqual((await state()).ships.map(s=>s.motion.position),original.ships.map(s=>s.motion.position));
  await p.locator('#command-bar').screenshot({path:artifacts+'workflow-movement-'+width+'.png'});
  await p.evaluate(()=>window.__failWorkflow=true);const beforeMove=await state();await click('move');assert.deepEqual(await state(),beforeMove);await p.evaluate(()=>window.__failWorkflow=false);
  await p.locator('[data-workflow=move]').evaluate(e=>{e.click();e.click();});assert.equal((await state()).round,1);assert.equal((await state()).workflow.phase,'attacks');
  await click('gunnery');assert.equal(await p.locator('#station-pane').getAttribute('data-station'),'gunnery');
  await p.locator('#command-bar').screenshot({path:artifacts+'workflow-attacks-'+width+'.png'});
  while((await state()).workflow.gunnery.declarations.length<(await state()).workflow.gunnery.order.length){await click('gunnery');await p.locator('[data-gunnery=commit]').click();}
  await click('next');assert.equal((await state()).workflow.phase,'crew');
  await p.locator('#command-bar').screenshot({path:artifacts+'workflow-crew-'+width+'.png'});
  await click('round-review');await p.locator('[data-report=advance]').click();const second=await state();assert.equal(second.workflow.phase,'thrust');assert.equal(await p.locator('#open-setup').isDisabled(),true);assert.equal(await p.locator('#add-ship-main').isDisabled(),false);assert.equal(second.round,1);assert.deepEqual(second.workflow.initiatives,beforeMove.workflow.initiatives);assert.equal(await p.locator('#round').textContent(),'Round 2');
  assert.equal(await p.locator('#station-pane').getAttribute('data-station'),'pilot');assert.equal(await p.locator('[data-select=merchant]').getAttribute('aria-pressed'),'true');
  await closeStation(p);await p.locator('#command-bar').scrollIntoViewIfNeeded();const stripBox=await p.locator('#workflow-strip').boundingBox();assert.ok(stripBox.y>=-1&&stripBox.y<1000);
  const after=await geometry();assert.equal(after.width,map.width);assert.equal(after.height,map.height);assert.equal(after.transform,map.transform);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:artifacts+'workflow-page-'+width+'.png',fullPage:true});
  await p.locator('#battle-workflow details').evaluate(e=>e.open=true);await click('leave');assert.equal((await state()).workflow,null);assert.deepEqual((await state()).ships,second.ships);
  await click('start');assert.equal((await state()).workflow.phase,'thrust');assert.deepEqual((await state()).workflow.initiatives,second.workflow.initiatives);
  assert.deepEqual(errors,[]);await writeFile(artifacts+'workflow-checks-'+width+'.json',JSON.stringify({width,passed:true,mapBefore:map,mapAfter:after,recordedInitiatives:second.workflow.initiatives},null,2));
 }finally{await p.close();}
}
