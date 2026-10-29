import {workflowAction} from './console-navigation.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {applyCommand,normalizeState} from '../engine.mjs';
import {directFireFixture} from './direct-fire-fixture.mjs';
export async function verifyCombatReports(browser,source,root,out){
 const fixture=applyCommand(directFireFixture({}),{type:'next-battle-phase',phase:'attacks'}),report=[];
 for(const width of [1876,1440,1100,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<500}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  await context.addInitScript(()=>{window.print=()=>{window.__printed=true;};Math.random=()=>{throw Error('Unexpected report dice');};for(const k of ['getItem','setItem','removeItem','clear'])Storage.prototype[k]=()=>{throw Error('Storage touched');};});
  await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nimport {normalizeState as restoreReport} from './engine.mjs';window.__reportState=()=>structuredClone(state);window.__reportLoad=s=>{state=restoreReport(s);selected=state.ships[0].id;stationPane.choose('captain');render();};window.__reportLoad(${JSON.stringify(fixture)});`}));
  const state=()=>p.evaluate(()=>window.__reportState()),click=a=>p.locator('[data-report="'+a+'"]').click();
  try{
   await p.goto(new URL('tools/ship-combat-alpha/',root).href);const initial=await state();await p.locator('[data-workflow=round-review]').click();assert.match(await p.locator('#combat-report').textContent(),/full next round/);await p.keyboard.press('Escape');assert.deepEqual(await state(),initial);
   await p.locator('[data-workflow=round-review]').click();await p.locator('[data-report=advance]').evaluate(e=>{e.click();e.click();});assert.equal((await state()).workflow.phase,'thrust');assert.equal((await state()).revision,initial.revision+1);await p.evaluate(s=>window.__reportLoad(s),initial);
   await workflowAction(p,'end-combat');await p.locator('[data-ending-note]').fill('Synthetic ceasefire');await p.setViewportSize({width:320,height:320});const b=await p.locator('#combat-report').boundingBox(),close=await p.locator('[data-report=close]').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=321&&b.y+b.height<=321);assert.ok(close.y>=0&&close.y+close.height<=320);assert.equal(await p.locator('[data-ending-note]').inputValue(),'Synthetic ceasefire');await click('close');assert.deepEqual(await state(),initial);await p.setViewportSize({width,height:1000});
   await workflowAction(p,'end-combat');await p.locator('[data-ending-note]').fill('Synthetic ceasefire');await p.locator('[data-report=confirm]').evaluate(e=>{e.click();e.click();});const ended=await state();assert.equal(ended.workflow,null);assert.equal(ended.completedCombats.length,1);assert.deepEqual(ended.completedCombats[0].snapshot,initial);await click('next');await click('previous');assert.deepEqual(await state(),ended);
   const htmlDownload=p.waitForEvent('download');await click('save');const html=await readFile(await (await htmlDownload).path(),'utf8');assert.match(html,/Synthetic ceasefire/);for(const ship of initial.ships)assert.ok(html.includes(ship.name));assert.match(html,/Unknown/);assert.doesNotMatch(html,/<script/);
   const jsonDownload=p.waitForEvent('download');await click('snapshot');const exported=JSON.parse(await readFile(await (await jsonDownload).path(),'utf8'));assert.deepEqual(normalizeState(exported),ended);
   await click('print');await p.waitForFunction(()=>document.querySelector('.report-print-frame')?.contentWindow.__printed===true);assert.equal(await p.locator('.report-print-frame').evaluate(e=>e.contentDocument.querySelectorAll('.condition-report').length),initial.ships.length);
   await p.setViewportSize({width:320,height:320});await p.waitForFunction(()=>[...document.querySelectorAll('#combat-report footer button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));if(width===320)await p.screenshot({path:out+'after-action-tiny-320.png'});const reportClose=await p.locator('[data-report=close]').boundingBox();assert.ok(reportClose.y>=0&&reportClose.y+reportClose.height<=320);await p.setViewportSize({width,height:1000});await p.screenshot({path:out+'after-action-'+width+'.png'});assert.ok(await p.locator('#combat-report').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await click('close');await p.evaluate(s=>window.__reportLoad(s),JSON.parse(JSON.stringify(ended)));await workflowAction(p,'report');assert.match(await p.locator('#combat-report').textContent(),/Synthetic ceasefire/);await p.keyboard.press('Escape');assert.deepEqual(await state(),ended);assert.deepEqual(errors,[]);
   if(width===1876){const printPage=await context.newPage();await printPage.setContent(html);await printPage.emulateMedia({media:'print'});await printPage.screenshot({path:out+'after-action-print.png',fullPage:true});await printPage.pdf({path:out+'after-action-synthetic.pdf',format:'A4'});await printPage.close();}
   report.push({width,passed:true});console.log('PASS round review/end/cancel/snapshot/print/save '+width);
  }finally{await context.close();}
 }
 await writeFile(out+'combat-report-checks.json',JSON.stringify(report,null,2));
}
