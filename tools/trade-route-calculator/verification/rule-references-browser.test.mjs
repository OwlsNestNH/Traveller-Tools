// Actual Chromium checks: grouped source controls, nested dialog focus, touch,
// interrupted forms and unchanged saved bytes. Synthetic campaigns only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
import {RULE_REFERENCES} from '../js/rule-references.mjs';
import {configureMortgage} from '../js/mortgage.mjs';
import {configureMaintenance} from '../js/maintenance.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const report={commit:process.env.TRAVELLER_COMMIT||null,viewports:[]};
let context,page;
try{
 for(const viewport of [{width:1440,height:1100},{width:1100,height:900},{width:390,height:844},{width:320,height:740}]){
  const fixture=guiFixture(),s=fixture.state;
  s.ship.mortgage=configureMortgage({originalAmount:'24000000',payment:'100000',remainingPayments:480,totalPaid:'0',nextDueDate:'029-1105'});
  s.ship.maintenance=configureMaintenance({payment:'1000',nextDueDate:'029-1105'});
  s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'28',denominator:'1'}};
  context=await browser.newContext({viewport,hasTouch:viewport.width<500,serviceWorkers:'block'});context.setDefaultTimeout(15000);
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes:JSON.stringify(s)});
  await context.route('https://travellermap.com/api/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/universe'))return route.fulfill({json:fixture.universe});
   if(url.pathname.endsWith('/metadata'))return route.fulfill({json:fixture.metadata});
   if(url.pathname.endsWith('/sec'))return route.fulfill({json:fixture.sec});
   if(url.pathname.endsWith('/jumpworlds'))return route.fulfill({json:{Worlds:fixture.apiWorlds}});
   throw Error('Unexpected map request: '+url);
  });
  page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const saved=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey);
  const tab=name=>page.locator('#tabs [data-arg="'+name+'"]').click();
  const popup=page.locator('#rule-reference-popup');
  const closeModal=async()=>{await page.locator('#modal-cancel').click();await page.locator('#modal').waitFor({state:'hidden'});};
  async function info(button,id,{method='click',screenshot=null,close='escape'}={}){
   const before=await saved(),dialogBefore=await page.locator('#modal').evaluate(el=>({open:el.open,title:el.querySelector('h2').textContent,inputs:[...el.querySelectorAll('input,select')].map(x=>[x.name,x.value,x.checked,x.disabled])}));
   await button.scrollIntoViewIfNeeded();
   if(method==='tap')await button.tap();else if(['Enter','Space'].includes(method)){await button.focus();await page.keyboard.press(method);}else await button.click();
   await popup.waitFor({state:'visible'});assert.equal(await popup.getAttribute('data-reference'),id);
   assert.ok(await popup.getByRole('heading',{name:RULE_REFERENCES[id].title[0].toUpperCase()+RULE_REFERENCES[id].title.slice(1),exact:true}).count());
   assert.equal(await saved(),before,'Viewing a source never writes campaign bytes');
   const geometry=await popup.evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.rule-reference-body');return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],scrollWidth:body.scrollWidth,clientWidth:body.clientWidth};});
   assert.ok(geometry.x>=0&&geometry.y>=0&&geometry.right<=viewport.width+1&&geometry.bottom<=viewport.height+1,JSON.stringify(geometry));
   assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,'Reference paragraphs wrap without horizontal scrolling');
   const focus=await popup.locator('.rule-reference-close').evaluate(el=>el===document.activeElement);assert.equal(focus,true);
   for(const key of ['Tab','Tab','Shift+Tab','Shift+Tab']){await page.keyboard.press(key);assert.equal(await popup.evaluate(el=>el.contains(document.activeElement)),true,'Native dialog keeps keyboard focus inside');}
   if(screenshot)await page.screenshot({path:artifacts+`/rule-info-${screenshot}-${viewport.width}.png`});
   if(close==='button')await popup.getByRole('button',{name:'Close rules reference',exact:true}).click();else if(close==='double')await popup.getByRole('button',{name:'Close rules reference',exact:true}).dblclick();else await page.keyboard.press('Escape');
   await popup.waitFor({state:'hidden'});
   assert.equal(await button.evaluate(el=>el===document.activeElement),true,'Closing returns focus to this exact opener');
   assert.equal(await saved(),before);
   assert.deepEqual(await page.locator('#modal').evaluate(el=>({open:el.open,title:el.querySelector('h2').textContent,inputs:[...el.querySelectorAll('input,select')].map(x=>[x.name,x.value,x.checked,x.disabled])})),dialogBefore,'Underlying transaction and all draft inputs survive');
  }
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  const original=await saved();
  // Every entry is reachable through Rules & Notes, including non-book policies.
  await page.locator('#notes').click();
  const ids=Object.keys(RULE_REFERENCES);
  for(let i=0;i<ids.length;i++){
   const id=ids[i];await info(page.locator('.rule-reference-index [data-rule-info="'+id+'"]'),id,{method:i%4===0?'Enter':i%4===1?'Space':viewport.width<500?'tap':'click',close:i%7===0?'button':'escape',screenshot:['contact-search','tax'].includes(id)?id:null});
  }
  const noteText=await page.locator('#modal-body').textContent();assert.doesNotMatch(noteText,/198 passing|Application 0\.1\.0/);assert.match(noteText,/table p\.87/);
  assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return new Set(ids).size===ids.length;}),true,'Repeated source buttons create no duplicate IDs');
  await closeModal();assert.equal(await saved(),original);
  // Closed Settings summaries expose their source controls without changing
  // their disclosure state, values or the draft. Save and Revert remain intact.
  await tab('Settings');await page.locator('[name="ship"]').fill('Unsaved info-popup draft');
  const mortgageGroup=page.locator('[data-settings-group="mortgage"]');assert.equal(await mortgageGroup.evaluate(el=>el.open),false);
  await info(mortgageGroup.locator('summary [data-rule-info="mortgage"]'),'mortgage',{method:viewport.width<500?'tap':'Enter'});
  assert.equal(await mortgageGroup.evaluate(el=>el.open),false);assert.equal(await page.locator('[name="ship"]').inputValue(),'Unsaved info-popup draft');
  await info(page.locator('[data-settings-group="fuel"] > summary [data-rule-info="bladders"]'),'bladders',{screenshot:'settings'});
  await page.locator('[name="capacity"]').fill('121.2');
  await info(page.locator('#settings-rounding-note [data-rule-info="rounding"]'),'rounding',{method:viewport.width<500?'tap':'click'});
  assert.equal(await page.locator('[name="capacity"]').inputValue(),'122','Ordinary blur normalization retains its existing whole-ton rule');
  await page.locator('#settings-reset').click();assert.equal(await saved(),original);
  // A source popup over a supplier form leaves its exact inputs and its normal
  // revision/submit boundary intact. Escape closes only the topmost dialog.
  await tab('Trade');await page.locator('#main [data-action="search"]').click();
  await page.locator('#modal [name="party"]').fill('Uncommitted search draft');
  await info(page.locator('#modal [data-rule-info="contact-search"]'),'contact-search',{method:'Space',close:'double'});
  assert.equal(await page.locator('#modal [name="party"]').inputValue(),'Uncommitted search draft');
  await info(page.locator('#modal [data-rule-info="broker"]'),'broker',{close:'button'});await closeModal();assert.equal(await saved(),original);
  // Generated and legacy audits retain all evidence; the reference does not
  // create faces, values or extra controls when historical data is missing.
  await page.locator('#main [data-action="offer-audit"][data-arg="offer-recorded"]').click();
  await info(page.locator('#modal [data-rule-info="trade-price"]').first(),'trade-price',{screenshot:'price'});
  await info(page.locator('#modal [data-rule-info="commodity"]').first(),'commodity');assert.match(await page.locator('#modal-body').textContent(),/Quantity dice/);await closeModal();
  await page.locator('#main [data-action="offer-audit"][data-arg="offer-legacy"]').click();
  assert.match(await page.locator('#modal-body').textContent(),/individual dice not recorded/);await info(page.locator('#modal [data-rule-info="trade-price"]').first(),'trade-price');await closeModal();
  // Real Tab from an edited field into the dynamically refreshed rounding note.
  await tab('Accounts');await page.locator('#main [data-action="expense"]').click();
  const roundingMarker=await page.locator('#rounding-input-note [data-rule-info="rounding"]').elementHandle();
  await page.locator('#modal [name="amount"]').fill('12.4');await page.keyboard.press('Tab');
  assert.equal(await roundingMarker.evaluate(el=>el.isConnected),true,'Numeric blur retains the original reference node');
  assert.equal(await page.locator('#modal [name="amount"]').inputValue(),'13');
  await page.locator('#modal [name="reason"]').fill('Uncommitted expense note');
  await page.keyboard.press('Tab');assert.equal(await roundingMarker.evaluate(el=>el===document.activeElement&&el.isConnected),true);
  await page.keyboard.press('Enter');await popup.waitFor({state:'visible'});assert.equal(await popup.getAttribute('data-reference'),'rounding');
  await page.keyboard.press('Escape');assert.equal(await roundingMarker.evaluate(el=>el===document.activeElement),true);assert.equal(await saved(),original);
  // Pointer activation also survives blur normalizing a dirty amount.
  await page.locator('#modal [name="amount"]').fill('14.4');await page.locator('#rounding-input-note [data-rule-info="rounding"]').click();
  await popup.waitFor({state:'visible'});assert.equal(await page.locator('#modal [name="amount"]').inputValue(),'15');await page.keyboard.press('Escape');
  await closeModal();assert.equal(await saved(),original);
  // Manual contracts show Referee terms rather than invented generated rolls.
  await tab('Contracts');await page.locator('#main [data-action="contract-audit"][data-arg="contract-fixture"]').click();
  await info(page.locator('#modal [data-rule-info="booking"]').first(),'booking');assert.match(await page.locator('#modal-body').textContent(),/no generated availability or quantity rolls/);await closeModal();
  await page.locator('#main [data-action="passenger-search"]').click();await info(page.locator('#modal [data-rule-info="passengers"]'),'passengers');await closeModal();
  // Service calculation summaries remain closed, and source Escape does not
  // invoke the host's own Escape-to-cancel service navigation.
  await tab('Overview');await page.locator('#ship-actions [data-action="refuel"]').click();
  await page.locator('#service-form [name="fuelTons"]').fill('3');
  const fuelAudit=page.locator('#service-panel .service-audit');
  assert.equal(await fuelAudit.evaluate(el=>el.open),false);await info(fuelAudit.locator('[data-rule-info="refuel"]'),'refuel');
  assert.equal(await fuelAudit.evaluate(el=>el.open),false);assert.equal(await page.locator('#service-form [name="fuelTons"]').inputValue(),'3');
  await page.locator('#service-panel [data-action="service-cancel"]').click();assert.equal(await saved(),original);
  await page.locator('#ship-actions [data-action="refill-support"]').click();
  await info(page.locator('#service-panel [data-rule-info="lss"]'),'lss');await info(page.locator('#service-panel [data-rule-info="support-pricing"]'),'support-pricing');
  await page.locator('#service-panel [data-action="service-back"]').click();
  await page.locator('#ship-actions [data-action="ship-expenses"]').click();await page.locator('#expense-panel [data-action="expense-open"][data-arg$=":mortgage"]').click();
  await info(page.locator('#expense-panel [data-rule-info="mortgage"]'),'mortgage');await page.locator('#expense-panel [data-action="expense-cancel"]').click();await page.locator('#expense-panel [data-action="expense-close"]').click();
  // Expanded-map state is view-only and must survive reference Escape.
  await page.locator('#main [data-action="map-expand"]').click();
  assert.equal(await page.locator('#main').evaluate(el=>!!el.querySelector('.navigation-layout.map-expanded')),true);
  await page.locator('#main [data-action="jump"]').click();
  await page.locator('#modal [name="hours"]').fill('177');const prepared=await saved();
  await info(page.locator('#modal [data-rule-info="jump-duration"]'),'jump-duration',{method:'Enter',screenshot:'jump'});
  await info(page.locator('#modal [data-rule-info="jump-fuel"]'),'jump-fuel');await closeModal();assert.equal(await saved(),prepared);
  assert.equal(await page.locator('#main').evaluate(el=>!!el.querySelector('.navigation-layout.map-expanded')),true);
  // A same-origin read-only tab can inspect sources without gaining a writer.
  const readOnly=await context.newPage();await readOnly.goto(base);await readOnly.getByText('Read-only: campaign open in another tab.',{exact:true}).waitFor();
  await readOnly.locator('#notes').click();await readOnly.locator('.rule-reference-index [data-rule-info="insurance"]').click();assert.equal(await readOnly.locator('#rule-reference-popup').isVisible(),true);await readOnly.keyboard.press('Escape');await readOnly.locator('#modal-cancel').click();
  // An editing handoff rerenders Settings while its source popup is open.
  // Closing must find the replacement marker instead of dropping focus to body.
  await tab('Settings');const replacementSelector='[data-settings-group="fuel"] > summary [data-rule-info="bladders"]';
  const oldMarker=await page.locator(replacementSelector).elementHandle();await page.locator(replacementSelector).click();
  await readOnly.locator('#takeover').click();await readOnly.getByText('Editing in this tab',{exact:true}).waitFor();
  await page.getByText('Read-only: editing transferred to another tab.',{exact:true}).waitFor();
  assert.equal(await oldMarker.evaluate(el=>el.isConnected),false);assert.equal(await popup.isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator(replacementSelector).evaluate(el=>el===document.activeElement),true);
  await readOnly.close();
  assert.equal(await saved(),prepared);assert.deepEqual(errors,[]);
  report.viewports.push({width:viewport.width,catalogue:ids.length,keyboard:true,touch:viewport.width<500,draftsPreserved:true,readOnly:true,noPopupWrites:true});
  await context.tracing.stop({path:artifacts+`/rule-info-${viewport.width}-trace.zip`});await context.close();context=null;
  console.log(`PASS: ${viewport.width}px; all 29 sources, nested dialogs, Enter/Space/Escape, focus, touch, double close, closed summaries, saved/legacy audits, services, map and read-only access.`);
 }
}catch(error){if(context){await page?.screenshot({path:artifacts+'/rule-info-failure.png',fullPage:true}).catch(()=>{});await context.tracing.stop({path:artifacts+'/rule-info-failure-trace.zip'}).catch(()=>{});}throw error;
}finally{await writeFile(artifacts+'/rule-info-report.json',JSON.stringify(report,null,2));await browser.close();}
