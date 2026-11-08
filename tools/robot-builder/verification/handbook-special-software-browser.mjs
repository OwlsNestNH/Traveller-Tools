import {createDesign,updateDesign} from '../engine/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const root=process.env.ROBOT_TEST_URL||'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS||'verification-artifacts/robot');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
const click=async locator=>{await locator.click();await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const stage=async index=>click(page.locator('#stage-nav button').nth(index));
const exportDraft=async()=>{const promise=page.waitForEvent('download');await click(page.locator('#export-design'));return JSON.parse(await fs.readFile(await (await promise).path(),'utf8'));};
const importDraft=async design=>{await page.locator('#import-file').setInputFiles({name:'special-software.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});await page.waitForTimeout(100);await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const fixture=(special={},kind='microbot',techLevel=14)=>updateDesign(createDesign({kind,techLevel}),{name:'Handbook special software fixture',special});
const printSnapshot=async(name,required=[],excluded=[])=>{
 await page.evaluate(()=>{window.__specialPrintCalls=0;window.print=()=>window.__specialPrintCalls++;});await click(page.locator('#print-design'));
 const output=page.locator('#print-output'),text=await output.locator('pre').textContent();
 check(name+' invokes real Print handler',await page.evaluate(()=>window.__specialPrintCalls===1)&&text.length>200&&!text.includes('Statblock unavailable.'));
 check(name+' includes required facts',required.every(t=>text.includes(t)));check(name+' excludes unsupported facts',excluded.every(t=>!text.includes(t)));
 await page.emulateMedia({media:'print'});check(name+' visible print output',await output.isVisible());check(name+' print width fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});await fs.writeFile(path.join(out,name+'.txt'),text);await page.emulateMedia({media:'screen'});
};
try{
 await page.goto(root);await page.locator('#stage-nav button').first().waitFor();
 await importDraft(fixture({brain:'basic',corePackage:'basic-none'}));await stage(4);
 const packages=page.locator('#field-skills-packages');await packages.selectOption('admin-1');await click(packages.locator('..').getByRole('button',{name:'Add',exact:true}));
 check('Basic none accepts Admin1 through editor',await page.locator('#design-status').textContent()==='Subset checked'&&(await exportDraft()).special.packages[0]==='admin-1');
 await stage(5);check('review displays installed and INT-adjusted level',await page.locator('.review-skills').textContent().then(t=>t.includes('Admin')&&t.includes('Installed level 1')&&t.includes('Effective 0')));
 await printSnapshot('micro-basic-print',['Admin','Installed level 1','Effective 0','Cr 5,500']);
 await stage(4);await page.locator('#field-skills-corePackage').selectOption('basic-locomotion');check('retained inapplicable software stays visible and invalid',(await exportDraft()).special.packages[0]==='admin-1'&&await page.locator('#design-status').textContent()==='Needs correction');
 await click(page.getByRole('button',{name:'Remove Admin 1',exact:true}));check('removal repairs fixed package',await page.locator('#design-status').textContent()==='Subset checked');
 await stage(5);await printSnapshot('micro-locomotion-print',['Vehicle Walker','Athletics Dexterity','Installed level 0','Effective 0']);
 await stage(4);await page.locator('#field-skills-corePackage').selectOption('basic-servant');await page.locator('#field-skills-servantProfession').selectOption('domestic-cleaner');
 check('servant selector persists selected source profession',(await exportDraft()).special.servantProfession==='domestic-cleaner');await stage(5);await printSnapshot('micro-servant-print',['Profession Domestic Cleaner','Installed level 2']);
 await importDraft(fixture({corePackage:'primitive-homing'}));await stage(4);check('unselected weapon blocks homing',await page.locator('#design-status').textContent()==='Rules incomplete');
 await page.locator('#field-skills-coreWeapon').selectOption('melee:unarmed');check('source weapon choice repairs homing',await page.locator('#design-status').textContent()==='Subset checked');
 await stage(5);await printSnapshot('micro-homing-print',['Melee (unarmed)','Installed level 1','Effective 1'],['Weapon: Installed level']);
 await importDraft(fixture({brain:'basic',corePackage:'basic-none'}));await stage(4);
 const prefix='#field-skills-customPackages-new-';await page.locator(prefix+'skill').selectOption('profession');await page.locator(prefix+'speciality').fill('Swarm gardener');await page.locator(prefix+'level').selectOption('1');await click(page.getByRole('button',{name:'Add custom package',exact:true}));
 check('custom micro package uses special schema',(await exportDraft()).special.customPackages[0].speciality==='Swarm gardener');
 await click(page.locator('#save-design'));await page.getByText('Design saved.',{exact:true}).waitFor();await page.reload();await page.locator('#saved-design').selectOption({index:1});await click(page.locator('#load-design'));
 check('saved custom micro package reloads',(await exportDraft()).special.customPackages[0].speciality==='Swarm gardener');
 await stage(5);await printSnapshot('micro-custom-print',['Profession (swarm-gardener)','Installed level 1']);
 const before=await exportDraft(),forged=structuredClone(before);forged.special.customPackages[0].cost=0;await importDraft(forged);check('invalid custom import leaves draft unchanged',JSON.stringify(await exportDraft())===JSON.stringify(before));
 const blocked=fixture({brain:'advanced',corePackage:'none',packages:['admin-1'],customPackages:[{id:'c',skill:'science',speciality:'Marine ecology',level:1}]});await importDraft(blocked);await stage(5);await printSnapshot('micro-blocked-print',['Admin 1','Marine ecology','Not calculated'],['Effective 1']);
 await importDraft(fixture({brain:'none',corePackage:'none'}));await stage(2);const hw='#field-physical-optionInstances-new-';
 for(const option of ['drone-interface','wireless']){await page.locator(hw+'optionId').selectOption(option);await click(page.getByRole('button',{name:'Add separate installation',exact:true}));}
 check('instance-only brainless drone verifies Cr610',await page.locator('#design-status').textContent()==='Subset checked'&&await page.locator('#summary-metrics').textContent().then(t=>t.includes('610')));
 const instances=await exportDraft();check('instance-only editor does not copy into legacy list',instances.special.options.length===0&&instances.special.optionInstances.length===2);await stage(5);await printSnapshot('micro-instances-print',['Cr 610','Drone Interface','Wireless']);
 const legacy=fixture({brain:'none',corePackage:'none',options:['drone-interface','wireless']});for(const field of ['customPackages','coreWeapon','servantProfession'])delete legacy.special[field];await importDraft(legacy);check('legacy backup migrates without changing price',await page.locator('#design-status').textContent()==='Subset checked'&&await page.locator('#summary-metrics').textContent().then(t=>t.includes('610')));
 for(const [type,tl,price] of [['construction-enhanced',18,'20,000'],['construction-advanced',20,'40,000']]){
  await importDraft(fixture({packageType:type,packages:2},'nanorobot',tl));await stage(3);check(type+' controller selector visible',await page.locator('#field-brain-controllerMaxTasks').count()===1);
  await page.locator('#field-brain-controllerMaxTasks').selectOption('2');check(type+' controller repair verifies',await page.locator('#design-status').textContent()==='Subset checked');
  check(type+' controller survives export',(await exportDraft()).special.controllerMaxTasks===2);await stage(5);await printSnapshot(type+'-print',['Cr '+price,'Controller Max Tasks: 2','per litre']);
 }
 await importDraft(fixture({packageType:'distributed-conscious',environment:'corrosive'},'nanorobot',22));await stage(5);await printSnapshot('distributed-protection-print',['Cr 400,000','Protection Multiplier: 2','per package','Life Hours: Not calculated'],['INT: 0','Bandwidth: 0']);
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});await stage(2);check('nano editor fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await stage(5);await printSnapshot('distributed-protection-print-'+width,['Cr 400,000','Protection Multiplier: 2']);}
 await importDraft(before);await stage(4);check('custom micro editor fits320',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'micro-custom-editor-320.png'),fullPage:true});
 check('no browser runtime errors',errors.length===0);await fs.writeFile(path.join(out,'handbook-special-software-report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' handbook special software browser checks');
}catch(error){await page.screenshot({path:path.join(out,'handbook-special-software-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'handbook-special-software-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));throw error;}finally{await context.close();await browser.close();}

