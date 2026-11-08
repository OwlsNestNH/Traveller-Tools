import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const root=process.env.ROBOT_TEST_URL||'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS||'verification-artifacts/robot');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
const checks=[],errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
const click=async locator=>{await locator.click();await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const stage=async index=>click(page.locator('#stage-nav button').nth(index));
const physical=async()=>{await stage(2);await page.locator('#physical-category').selectOption('slot-cost-options');};
const exportDraft=async()=>{const wait=page.waitForEvent('download');await click(page.locator('#export-design'));const download=await wait;return JSON.parse(await fs.readFile(await download.path(),'utf8'));};
const prefix='#field-physical-verifiedVehicleOptions-slot-cost-options-';
try{
 await page.goto(root);await page.locator('#stage-nav button').first().waitFor();await page.locator('#field-chassis-size').selectOption('size-8');
 await page.locator('#robot-name').fill('Vehicle source fixture');await page.locator('#robot-name').press('Tab');await physical();
 await click(page.locator('summary').filter({hasText:/^Vehicle options \(2026 source\)/}));
 await page.locator(prefix+'new-optionId').selectOption('vh2026-smoke-discharger');
 check('selected source hardware shows fixed facts',await page.locator('#stage-content').textContent().then(text=>text.includes('Cr 1,000 / 64 Slots / Capacity 30')));
 check('no source price/Space override inputs',await page.locator('[id*="verifiedVehicleOptions"][id$="-cost"], [id*="verifiedVehicleOptions"][id$="-spaces"], [id*="verifiedVehicleOptions"][id$="-source"]').count()===0);
 await click(page.getByRole('button',{name:'Add source vehicle option',exact:true}));let draft=await exportDraft(),record=draft.selections.physical.verifiedVehicleOptions[0];
 check('source ID saved without copied editable facts',record.optionId==='vh2026-smoke-discharger'&&Object.keys(record).sort().join(',')==='extraCharges,id,optionId,quantity');
 check('one source device is valid within subset',await page.locator('#design-status').textContent()==='Subset checked');
 const installed=prefix+record.id+'-';await page.locator(installed+'quantity').selectOption('3');
 check('excess aggregate Slots rejected',await page.locator('#design-status').textContent()==='Needs correction');await page.locator(installed+'quantity').selectOption('1');
 await page.locator(installed+'extraCharges').selectOption('1');check('unpriced charge purchase blocks totals',await page.locator('#design-status').textContent()==='Rules incomplete');
 await page.locator(installed+'extraCharges').selectOption('0');await page.locator(installed+'optionId').selectOption('vh2026-prismatic-aerosol-discharger');
 await page.locator('#robot-tl').selectOption('8');check('low-TL retained choice flagged',await page.locator('#issues').textContent().then(text=>text.includes('Vehicle option TL exceeds design')));await page.locator('#robot-tl').selectOption('12');
 await page.locator(installed+'optionId').selectOption('vh2026-smoke-discharger');
 await click(page.getByRole('button',{name:'Add source vehicle option',exact:true}));check('repeat addition preserves independent IDs',(await exportDraft()).selections.physical.verifiedVehicleOptions.length===2);
 await click(page.getByRole('button',{name:'Remove Decoy Dispenser',exact:true}));check('removing repeat leaves first record',(await exportDraft()).selections.physical.verifiedVehicleOptions.length===1);
 await click(page.locator('summary').filter({hasText:/^Vehicle options \(2026 source\)/}));await stage(1);await physical();check('navigation preserves selected source record',(await exportDraft()).selections.physical.verifiedVehicleOptions[0].id===record.id);
 await click(page.locator('#save-design'));await page.getByText('Design saved.',{exact:true}).waitFor();await page.reload();await page.locator('#stage-nav button').first().waitFor();await page.locator('#saved-design').selectOption({index:1});await click(page.locator('#load-design'));await physical();
 check('save reload preserves authoritative catalogue ID',(await exportDraft()).selections.physical.verifiedVehicleOptions[0].optionId==='vh2026-smoke-discharger');
 const before=await exportDraft(),forged=structuredClone(before);forged.selections.physical.verifiedVehicleOptions[0].cost=0;
 await page.locator('#import-file').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});await page.waitForTimeout(100);check('forged source facts rejected without losing draft',JSON.stringify(await exportDraft())===JSON.stringify(before));
 await stage(5);check('source review distinguishes capacity from contents',await page.locator('.review-verified-vehicle-options').textContent().then(text=>text.includes('Initial contents')&&text.includes('Unverified')&&text.includes('Replacement charge price')));
 await physical();for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);check('source editor fits '+width,!overflow);await page.screenshot({path:path.join(out,'vehicle-options-'+width+'.png'),fullPage:true});}
 check('no full source reference table',await page.locator('.source-reference,table').count()===0);check('no browser errors',errors.length===0);
 await fs.writeFile(path.join(out,'vehicle-options-report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' source vehicle option browser checks');
}catch(error){await page.screenshot({path:path.join(out,'vehicle-options-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'vehicle-options-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));throw error;}
finally{await context.close();await browser.close();}
