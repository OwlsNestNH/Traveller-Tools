import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createDesign,updateDesign} from '../engine/index.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv[2]||'playwright');
const base=process.env.ROBOT_TEST_URL||'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS||'verification-artifacts/robot');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const check=(label,ok)=>{assert.ok(ok,label);checks.push(label);};
const click=async locator=>{await locator.click();await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const stage=async n=>click(page.locator('#stage-nav button').nth(n-1));
const status=async(label,value)=>{await page.waitForFunction(v=>document.querySelector('#design-status')?.textContent===v,value);check(label,await page.locator('#design-status').textContent()===value);};
const exportDraft=async()=>{const next=page.waitForEvent('download');await click(page.locator('#export-design'));const download=await next;return JSON.parse(await fs.readFile(await download.path(),'utf8'));};
const importDraft=async(d,name='conditional-melee.json')=>{await page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await page.getByText('Design imported. Save it to keep it in this browser.',{exact:true}).waitFor();};
const weaponRow=label=>page.locator('.review-weapons .review-row').filter({has:page.getByText(label+' (CSC 2023)',{exact:true})});
const ledgerRow=label=>page.locator('.review-ledger .review-row').filter({has:page.getByText(label+' (CSC 2023)',{exact:true})});
const labels={'monofilament-axe':'Monofilament Axe',spear:'Spear',lance:'Lance','piston-spear':'Piston Spear'};
try{
 await page.goto(base);await page.locator('#stage-nav button').first().waitFor();
 const fixture=updateDesign(createDesign({techLevel:16}),{name:'Conditional melee fixture',selections:{chassis:{size:'size-7'}}});
 await importDraft(fixture);await stage(3);await page.locator('#physical-category').selectOption('weapons');
 const add='#field-physical-weapons-weapons-new-';
 for(const [id,label]of Object.entries(labels)){
  await page.locator(add+'weaponId').selectOption('csc-'+id);
  check(label+' has source-labelled choice',await page.locator(add+'weaponId option:checked').textContent()===(label+' (CSC 2023)'));
  await click(page.getByRole('button',{name:'Add weapon',exact:true}));
 }
 let draft=await exportDraft();
 const prefix=id=>'#field-physical-weapons-weapons-'+draft.selections.physical.weapons.find(w=>w.weaponId==='csc-'+id).id+'-';
 for(const id of Object.keys(labels))check(id+' hides fictitious ammunition',await page.locator(prefix(id)+'initialMagazines').count()===0&&await page.locator(prefix(id)+'extraMagazines').count()===0&&await page.locator(prefix(id)+'autoload').count()===0);
 await page.locator(prefix('lance')+'linkedWeapons').selectOption('2');await page.locator(prefix('lance')+'fireControl').selectOption('basic');
 await page.locator(prefix('piston-spear')+'linkedWeapons').selectOption('2');
 await stage(6);await status('conditional hardware remains supported acquisition','Subset checked');
 check('Lance uses two small mounts and one Basic FCS',await ledgerRow('Lance').textContent().then(t=>t.includes('11,500')&&t.includes('3 slots')));
 check('Piston uses two medium mounts without invented supplies',await ledgerRow('Piston Spear').textContent().then(t=>t.includes('2,800')&&t.includes('4 slots')));
 check('Monofilament uses medium mount without inferred power',await ledgerRow('Monofilament Axe').textContent().then(t=>t.includes('4,000')&&t.includes('2 slots')));
 for(const label of ['Lance','Piston Spear']){
  const text=await weaponRow(label).textContent();check(label+' conditional damage headline',text.includes('Conditional damage'));
  check(label+' unresolved current mode and linked damage',text.includes('Current attack mode')&&text.includes('Unresolved')&&text.includes('Linked Damage Bonus')&&text.includes('Not calculated'));
  check(label+' exact Spear fallback',text.includes('2D damage · No AP'));
  check(label+' no guessed power or purchased supplies',!text.includes('Power endurance')&&!text.includes('Initial Ammunition')&&!text.includes('Ammunition Inventory'));
 }
 check('Lance retains only rider-qualified enhanced mode',await weaponRow('Lance').textContent().then(t=>t.includes('Riding fast-moving animal/vehicle')&&t.includes('5D damage · AP 4')&&t.includes('Robot movement / weapon mount insufficient')));
 check('Piston shows per-attack reset and exact ready mode',await weaponRow('Piston Spear').textContent().then(t=>t.includes('3D+2 damage · AP 2')&&t.includes('1 Minor Action after every attack')&&t.includes('Without reset: Spear')));
 check('Spear fragility remains manufacture-qualified',await weaponRow('Spear').textContent().then(t=>t.includes('manufacturing TL unrecorded')&&t.includes('Manufacturing Tech Level')&&t.includes('Not calculated')));
 await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});await click(page.locator('#print-design'));
 check('print uses conditional damage and no-AP fallback',await page.locator('#print-output').textContent().then(t=>t.includes('Conditional damage')&&t.includes('2D damage · No AP')&&t.includes('1 Minor Action after every attack')));
 check('print executed without dialog',await page.evaluate(()=>window.__printed===true));
 check('no full source table exposed',await page.locator('.source-reference,table').count()===0);
 for(const label of ['Lance','Piston Spear'])await click(weaponRow(label).locator('summary').first());
 const resetFact=weaponRow('Piston Spear').locator('dt').filter({hasText:/^Reset$/}).locator('..').locator('dd');await resetFact.waitFor({state:'visible'});
 check('conditional detail facts are visibly reachable',await resetFact.isVisible());
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});check('review fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'robot-conditional-melee-'+width+'.png'),fullPage:true});
  await weaponRow('Piston Spear').screenshot({path:path.join(out,'robot-piston-profile-'+width+'.png')});
 }
 await page.setViewportSize({width:1440,height:1000});await stage(3);await page.locator('#physical-category').selectOption('weapons');
 await page.locator(prefix('spear')+'placement').selectOption('held');await page.locator(prefix('spear')+'manipulatorId').selectOption('base-1');
 await status('held qualified Spear requires second grip','Needs correction');await page.locator(prefix('spear')+'supportManipulatorId').selectOption('base-2');
 await status('two distinct Spear grips restore acquisition','Subset checked');
 await page.locator(prefix('lance')+'linkedWeapons').selectOption('1');await page.locator(prefix('lance')+'placement').selectOption('held');await page.locator(prefix('lance')+'manipulatorId').selectOption('base-2');
 await status('held Lance cannot occupy Spear support grip','Needs correction');await page.locator(prefix('lance')+'placement').selectOption('body');
 await status('returning Lance to mount clears grip conflict','Subset checked');
 await page.locator(prefix('piston-spear')+'weaponId').selectOption('csc-monofilament-axe');
 await page.locator(prefix('piston-spear')+'weaponId').selectOption('csc-piston-spear');
 await stage(6);check('repeated profile changes cannot select a combat mode',await weaponRow('Piston Spear').textContent().then(t=>t.includes('Conditional damage')&&t.includes('Current attack mode')&&t.includes('Unresolved')));
 await stage(3);await page.locator('#physical-category').selectOption('locomotive-modifications');await page.locator('#field-physical-vehicleSpeed-locomotive-modifications').selectOption('true');
 await stage(6);check('robot vehicle speed does not resolve rider condition',await weaponRow('Lance').textContent().then(t=>t.includes('Conditional damage')&&t.includes('Robot movement / weapon mount insufficient')));
 const savedDraft=await exportDraft();await click(page.locator('#save-design'));await page.getByText('Design saved.',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'));
 await page.reload();await page.locator('#stage-nav button').first().waitFor();await page.locator('#saved-design').selectOption({index:1});await click(page.locator('#load-design'));
 check('saved hardware and grips reload exactly',JSON.stringify((await exportDraft()).selections.physical.weapons)===JSON.stringify(savedDraft.selections.physical.weapons));
 await stage(6);check('save does not serialize a resolved attack mode',await weaponRow('Lance').textContent().then(t=>t.includes('Conditional damage')));
 const invalid=structuredClone(savedDraft);invalid.selections.physical.weapons.find(w=>w.weaponId==='csc-piston-spear').extraMagazines=1;
 await importDraft(invalid,'retained-piston-supply.json');await stage(3);await page.locator('#physical-category').selectOption('weapons');await status('unsupported piston supply import stays correctable','Needs correction');
 check('retained spare control remains visible',await page.locator(prefix('piston-spear')+'extraMagazines').inputValue()==='1');
 await page.locator(prefix('piston-spear')+'extraMagazines').selectOption('0');await status('removing invented supply restores hardware','Subset checked');
 check('unsaved imports do not alter named save',await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'))===saved);
 const repaired=await exportDraft();await click(page.locator('#new-design'));await importDraft(repaired);check('JSON round-trip preserves exact weapon records',JSON.stringify((await exportDraft()).selections.physical.weapons)===JSON.stringify(repaired.selections.physical.weapons));
 await stage(6);await status('round-tripped conditional modes remain source-qualified','Subset checked');
 check('no browser runtime errors',errors.length===0);
 await fs.writeFile(path.join(out,'conditional-melee-report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' conditional melee workflow checks');
}catch(error){await page.screenshot({path:path.join(out,'conditional-melee-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'conditional-melee-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));throw error;}
finally{await context.close();await browser.close();}
