import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv[2] || 'playwright');
const root=process.env.ROBOT_TEST_URL || 'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS || 'verification-artifacts/robot');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
const errors=[];const checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
page.on('dialog',d=>d.dismiss());
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
try {
 await page.goto(root);await page.locator('#stage-nav button').first().waitFor();
 check('six stages',await page.locator('#stage-nav button').count()===6);
 check('initial shell usable',await page.locator('#stage-title').textContent()==='Chassis Size');
 check('ordinary type first',await page.locator('#robot-kind').inputValue()==='standard');
 await page.locator('#robot-name').fill('Browser fixture');await page.locator('#robot-name').press('Tab');
 for(let i=0;i<6;i++){await page.locator('#stage-nav button').nth(i).click();check('stage navigation '+i,(await page.locator('#stage-position').textContent()).includes(String(i+1)));}
 await page.locator('#stage-nav button').first().click();
 check('navigation preserves name',await page.locator('#robot-name').inputValue()==='Browser fixture');
 await page.locator('#save-design').click();await page.getByText('Design saved.',{exact:true}).waitFor();
 check('saved list gains entry',await page.locator('#saved-design option').count()===2);
 const saved=await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'));
 check('save schema',JSON.parse(saved).designs[0].design.name==='Browser fixture');
 await page.reload();await page.locator('#stage-nav button').first().waitFor();
 await page.locator('#saved-design').selectOption({index:1});await page.locator('#load-design').click();
 check('saved design reload',await page.locator('#robot-name').inputValue()==='Browser fixture');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-design').click();
 const download=await downloadPromise;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 check('export exact design',exported.name==='Browser fixture');
 await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
 await page.waitForTimeout(100);check('invalid import preserves name',await page.locator('#robot-name').inputValue()==='Browser fixture');
 check('invalid import preserves store',await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'))===saved);
 await page.locator('#stage-nav button').nth(2).click();
 check('seven physical categories',await page.locator('#physical-category option').count()===8);
 for(const category of ['chassis-modifications','locomotive-modifications','manipulator-modification','default-suites','zero-slot-options','slot-cost-options','weapons']) {
  await page.locator('#physical-category').selectOption(category);
  check('bounded dropdowns '+category,await page.locator('#stage-content input[type=number]').count()===0);
 }
 await page.locator('#physical-category').selectOption('default-suites');
 await page.screenshot({path:path.join(out,'robot-desktop-options.png'),fullPage:true});
 for(const width of [1440,1100,768,390,320]) {
  await page.setViewportSize({width,height:1000});
  for(let stage=0;stage<6;stage++){
   await page.locator('#stage-nav button').nth(stage).click();
   const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,offenders:[...document.querySelectorAll('input,select,button')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>el.id||el.textContent)}));
   check('no overflow '+width+'/'+stage,overflow.page<=width+1&&overflow.offenders.length===0);
  }
  await page.locator('#stage-nav button').nth(2).click();
  if(width===390||width===320)await page.screenshot({path:path.join(out,`robot-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#stage-nav button').first().click();
 await page.screenshot({path:path.join(out,'robot-desktop.png'),fullPage:true});
 // Every construction kind must render its own catalogue without falling through to hidden stale controls.
 const kinds=await page.locator('#robot-kind option').evaluateAll(items=>items.map(item=>item.value).filter(Boolean));
 for(const kind of kinds) {
  const probe=await context.newPage();probe.on('pageerror',e=>errors.push(kind+': '+e.message));
  await probe.goto(root);await probe.locator('#robot-kind').selectOption(kind);
  check('type selection '+kind,await probe.locator('#robot-kind').inputValue()===kind);
  for(let stage=0;stage<6;stage++){
   await probe.locator('#stage-nav button').nth(stage).click();
   check('type stage '+kind+'/'+stage,await probe.locator('#stage-title').textContent()!=='');
  }
  await probe.close();
 }

 check('no browser runtime errors',errors.length===0);
 await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({checks,errors},null,2));
 console.log('PASS '+checks.length+' Robot Builder browser checks');
} catch(error) {
 await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});
 await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));
 throw error;
} finally {await context.close();await browser.close();}
