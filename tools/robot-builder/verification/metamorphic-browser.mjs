import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.ROBOT_TEST_URL||'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS||'verification-artifacts/robot');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const check=(label,value)=>{assert.ok(value,label);checks.push(label);};
const click=async loc=>{await loc.click();await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const stage=async index=>click(page.locator('#stage-nav button').nth(index-1));
const status=async expected=>page.waitForFunction(s=>document.querySelector('#design-status')?.textContent===s,expected);
const draft=async()=>{const p=page.waitForEvent('download');await click(page.locator('#export-design'));return JSON.parse(await fs.readFile(await (await p).path(),'utf8'));};
const load=async d=>{await page.locator('#import-file').setInputFiles({name:'metamorphic-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await page.getByText('Design imported. Save it to keep it in this browser.',{exact:true}).waitFor();};
try{
 await page.goto(base);await page.locator('#stage-nav button').first().waitFor();
 await page.locator('#robot-tl').selectOption('19');await page.locator('#robot-kind').selectOption('metamorphic');await status('Provisional assumptions');
 const tier='#field-chassis-metamorphicTier',convention='#field-chassis-metamorphicConvention';
 check('distinct provisional kind with ordinary chassis control',await page.locator('#field-chassis-size').isVisible());
 check('fixed convention selectable but not editable source numbers',await page.locator(convention+' option').evaluateAll(options=>options.filter(option=>option.value).length)===1&&await page.locator(convention).inputValue()==='provisional-base-slots-standard-v1');
 await page.locator(tier).selectOption('advanced');await status('Provisional assumptions');
 check('advanced exact price',await page.locator('#summary-metrics').textContent().then(s=>s.includes('Cr 3,212,000')));
 await page.locator('#robot-name').fill('Metamorphic browser fixture');await page.locator('#robot-name').press('Tab');
 const original=await draft();check('JSON retains explicit convention and tier',original.special.metamorphicConvention==='provisional-base-slots-standard-v1'&&original.special.metamorphicTier==='advanced');
 await stage(6);const review=await page.locator('.robot-review').textContent();
 for(const label of ['Metamorphic body (provisional)','0 additional reserved Slots','No android construction multiplier','Standard Size / STR / DEX / Slots / prices','1D seconds','Superior android','Application convention','Size and locomotion fixed','Extra attacks not granted'])check('review label '+label,review.includes(label));
 check('valid assumption review does not invent unresolved errors',!review.includes('unresolved errors')&&!review.includes('correct outstanding errors'));
 check('only selected source tier facts shown',!review.includes('1D minutes')&&!review.includes('1D rounds'));
 check('source tables absent',await page.locator('table,.source-reference').count()===0);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await stage(1);check('metamorphic controls no overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await stage(6);check('metamorphic review no overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'robot-metamorphic-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.print=()=>{};});await click(page.locator('#print-design'));
 await page.emulateMedia({media:'print'});const printed=await page.locator('#print-output').textContent();
 for(const label of ['Provisional construction assumptions','0 additional reserved Slots','No android construction multiplier','1D seconds'])check('print label '+label,printed.includes(label));
 check('print output visible',await page.locator('#print-output').isVisible());await page.screenshot({path:path.join(out,'robot-metamorphic-print.png'),fullPage:true});await page.emulateMedia({media:'screen'});
 await click(page.locator('#save-design'));await page.getByText('Design saved.',{exact:true}).waitFor();await page.reload();await page.locator('#saved-design').selectOption({index:1});await click(page.locator('#load-design'));await status('Provisional assumptions');check('saved reload preserves provisional source/convention',JSON.stringify((await draft()).special)===JSON.stringify(original.special));
 const invalid=structuredClone(original);invalid.techLevel=18;await load(invalid);await status('Needs correction');await stage(1);
 check('below-TL selected tier retained visibly',await page.locator(tier).inputValue()==='advanced');check('invalid tier present in export',(await draft()).special.metamorphicTier==='advanced');
 await page.locator(tier).selectOption('improved');await status('Provisional assumptions');check('repair only tier produces source price',await page.locator('#summary-metrics').textContent().then(s=>s.includes('Cr 1,612,000')));
 const crowded=await draft();crowded.selections.physical.options=['storage-compartment'];crowded.selections.physical.optionParameters={'storage-compartment':{quantity:17}};await load(crowded);await status('Needs correction');await stage(3);await page.locator('#physical-category').selectOption('slot-cost-options');
 const slots='#field-physical-optionParameters-slot-cost-options-storage-compartment-quantity';check('overcapacity remains repairable',await page.locator(slots).inputValue()==='17');await page.locator(slots).selectOption('2');await status('Provisional assumptions');
 await stage(6);await stage(1);await stage(6);check('repeated stage changes preserve tier',(await draft()).special.metamorphicTier==='improved');
 await page.locator('#robot-kind').selectOption('standard');await status('Subset checked');check('switching back isolates ordinary construction',!(await draft()).special.metamorphicTier);await stage(6);check('ordinary review has no metamorphic body assumptions',!(await page.locator('.robot-review').textContent()).includes('0 additional reserved Slots'));
 check('no browser runtime errors',errors.length===0);await fs.writeFile(path.join(out,'metamorphic-browser-report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' metamorphic browser checks');
}catch(error){await page.screenshot({path:path.join(out,'metamorphic-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'metamorphic-browser-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));throw error;}finally{await context.close();await browser.close();}
