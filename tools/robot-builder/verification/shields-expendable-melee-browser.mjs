import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createDesign,updateDesign} from '../engine/index.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const base=process.env.ROBOT_TEST_URL||'http://127.0.0.1:8778/tools/robot-builder/';
const out=path.resolve(process.env.ROBOT_ARTIFACTS||'verification-artifacts/robot');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ROBOT_BROWSER_CHANNEL?{channel:process.env.ROBOT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const check=(label,ok)=>{assert.ok(ok,label);checks.push(label);};
const click=async locator=>{await locator.click();await page.waitForFunction(()=>document.querySelector('#stage-panel')?.getAttribute('aria-busy')==='false');};
const stage=async n=>click(page.locator('#stage-nav button').nth(n-1));
const status=async(label,value)=>{await page.waitForFunction(v=>document.querySelector('#design-status')?.textContent===v,value);check(label,await page.locator('#design-status').textContent()===value);};
const exportDraft=async()=>{const next=page.waitForEvent('download');await click(page.locator('#export-design'));return JSON.parse(await fs.readFile(await (await next).path(),'utf8'));};
const importDraft=async(d,name='shield-expendable.json')=>{await page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await page.getByText('Design imported. Save it to keep it in this browser.',{exact:true}).waitFor();};
const labels={shield:'Shield','riot-shield':'Riot Shield','boarding-shield':'Boarding Shield','anti-armour-flail':'Anti-Armour Flail',garrotte:'Garrotte',blade:'Blade',stunstick:'Stunstick'};
const row=(label,section='weapons')=>page.locator('.review-'+section+' .review-row').filter({has:page.getByText(label+' (CSC 2023)',{exact:true})});
const fact=async(label,key,value)=>check(label+' / '+key,await row(label).locator('dt').filter({hasText:new RegExp('^'+key+'$')}).locator('..').locator('dd').evaluate(el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''))===value);
const print=async()=>{await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;};});await click(page.locator('#print-design'));check('Print statblock invoked',await page.evaluate(()=>window.__printed===true));return page.locator('#print-output').textContent();};
const forbidden=/Ammunition: standard|Auxiliary Loaded:|Integral Loaded:|Loose Grenades:|Ammo Cost:|Autoload Cost:/;
try{
 await page.goto(base);await page.locator('#stage-nav button').first().waitFor();
 const fixture=updateDesign(createDesign({techLevel:16}),{name:'Shields and expendable melee fixture',selections:{chassis:{size:'size-7'}}});
 await importDraft(fixture);await stage(3);await page.locator('#physical-category').selectOption('weapons');
 const add='#field-physical-weapons-weapons-new-';
 for(const [id,label]of Object.entries(labels)){
  await page.locator(add+'weaponId').selectOption('csc-'+id);
  check(label+' source-labelled choice',await page.locator(add+'weaponId option:checked').textContent()===label+' (CSC 2023)');
  await click(page.getByRole('button',{name:'Add weapon',exact:true}));
 }
 const draft=await exportDraft(),prefix=id=>'#field-physical-weapons-weapons-'+draft.selections.physical.weapons.find(w=>w.weaponId==='csc-'+id).id+'-';
 for(const id of Object.keys(labels))for(const field of ['initialMagazines','extraMagazines','autoload'])check(id+' hides '+field,await page.locator(prefix(id)+field).count()===0);
 await page.locator(prefix('anti-armour-flail')+'linkedWeapons').selectOption('2');await page.locator(prefix('anti-armour-flail')+'fireControl').selectOption('basic');
 await stage(6);await status('all hardware acquisition supported','Subset checked');
 check('Flail purchases two complete weapons, two small mounts and one Basic FCS',await row('Anti-Armour Flail','ledger').textContent().then(t=>t.includes('11,500')&&t.includes('3 slots')));
 check('Garrotte mount follows paired grips, not unknown mass',await row('Garrotte','ledger').textContent().then(t=>t.includes('1,010')&&t.includes('2 slots')));
 for(const [key,value]of Object.entries({'Use':'Single use','Acquisition':'One complete weapon','Delay':'1-12 rounds; unresolved','Linked operation':'Unresolved; independent complete weapons'}))await fact('Anti-Armour Flail',key,value);
 for(const [key,value]of Object.entries({'Current attack mode':'Unresolved','Grapple damage':'2D + opposed Melee Effect; conditional','Consecutive successful rounds':'+1D each; unresolved','Source mass':'Unspecified (printed dash)'}))await fact('Garrotte',key,value);
 check('Garrotte conditional headline',await row('Garrotte').textContent().then(t=>t.includes('Conditional damage')));
 await fact('Blade','Ammunition','Not applicable');await fact('Stunstick','Acquisition','Complete weapon hardware; initial charge unspecified');
 check('Flail has no fictitious ammunition or power facts',await row('Anti-Armour Flail').locator('dt').allTextContents().then(a=>!a.some(x=>/Ammunition|Magazine|Power endurance|Recharge/.test(x))));
 check('Flail linked damage is unresolved',await row('Anti-Armour Flail').textContent().then(t=>t.includes('Linked Damage Bonus')&&t.includes('Not calculated')));
 for(const label of Object.values(labels))await click(row(label).locator('summary').first());
 const shieldText=await row('Riot Shield').textContent(),boardingText=await row('Boarding Shield').textContent();
 check('Riot shield retains ranged and frontal Fire conditions',shieldText.includes('Ranged Protection: Protection: 1')&&shieldText.includes('Ranged attacks only; shield use unresolved')&&shieldText.includes('Fire-trait weapon attacks from front only')&&shieldText.includes('Environmental Immunity: No')&&shieldText.includes('Automatic Immunity Applied: No'));
 check('Boarding shield retains cover and no parry',boardingText.includes('Cover: Protection: 8')&&boardingText.includes('Parry: Permitted: No')&&boardingText.includes('Source Supported People: 2')&&!boardingText.includes('Maximum People')&&boardingText.includes('Universal Armour: No')&&boardingText.includes('Automatic Protection Applied: No'));
 check('standard Shield parry does not become body armour or a skill grant',await row('Shield').textContent().then(t=>t.includes('Parry only: Melee +1; unskilled Melee 0')&&t.includes('Body Mounted Defence Granted: No')&&t.includes('Skill Granted: No')&&t.includes('Applies Automatically To Parry: No')));
 const printed=await print();check('print retains single-use, grapple formula and unknown mass',printed.includes('Single use')&&printed.includes('2D + opposed Melee Effect; conditional')&&printed.includes('Unspecified (printed dash)'));check('print omits fabricated ammunition',!forbidden.test(printed));
 check('actual print preserves non-exclusive boarding capacity and unresolved geometry',printed.includes('Source Supported People: 2')&&!printed.includes('Maximum People')&&printed.includes('Geometry Resolved: No')&&printed.includes('Robot Size Fit Resolved: No')&&printed.includes('Automatic Protection Applied: No'));
 check('no full source tables shown',await page.locator('.source-reference,table').count()===0);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({media:'screen'});
  check('review fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'robot-shields-review-'+width+'.png'),fullPage:true});
  await row('Garrotte').screenshot({path:path.join(out,'robot-garrotte-'+width+'.png')});
  await row('Anti-Armour Flail').screenshot({path:path.join(out,'robot-expendable-'+width+'.png')});
  await page.emulateMedia({media:'print'});check('populated statblock visible in print '+width,await page.locator('#print-output').isVisible());
  check('print fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'robot-shields-print-'+width+'.png'),fullPage:true});
 }
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1440,height:1000});await stage(3);await page.locator('#physical-category').selectOption('weapons');
 await page.locator(prefix('garrotte')+'placement').selectOption('held');await page.locator(prefix('garrotte')+'manipulatorId').selectOption('base-1');await status('Garrotte missing support grip diagnosed','Needs correction');
 await page.locator(prefix('garrotte')+'supportManipulatorId').selectOption('base-2');await status('paired Garrotte grips repaired','Subset checked');
 await page.locator(prefix('shield')+'placement').selectOption('held');await page.locator(prefix('shield')+'manipulatorId').selectOption('base-2');await status('Shield conflicts with Garrotte support grip','Needs correction');
 await page.locator(prefix('shield')+'placement').selectOption('body');await status('return Shield to mount repairs conflict','Subset checked');
 for(let i=0;i<2;i++){await page.locator(prefix('anti-armour-flail')+'weaponId').selectOption('csc-blade');await page.locator(prefix('anti-armour-flail')+'weaponId').selectOption('csc-anti-armour-flail');}
 await stage(6);await fact('Anti-Armour Flail','Use','Single use');await fact('Garrotte','Current attack mode','Unresolved');
 const savedDraft=await exportDraft();await click(page.locator('#save-design'));await page.getByText('Design saved.',{exact:true}).waitFor();const saved=await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'));
 await page.reload();await page.locator('#stage-nav button').first().waitFor();await page.locator('#saved-design').selectOption({index:1});await click(page.locator('#load-design'));
 check('explicit save/reload preserves weapon records',JSON.stringify((await exportDraft()).selections.physical.weapons)===JSON.stringify(savedDraft.selections.physical.weapons));
 const invalid=structuredClone(savedDraft),flail=invalid.selections.physical.weapons.find(w=>w.weaponId==='csc-anti-armour-flail');
 Object.assign(flail,{extraMagazines:1,autoload:true,autoloadAllocation:{standard:1,highCapacity:0},ammunitionOverrides:[{copyIndex:2,initialMagazines:1,initialMagazineType:'standard',extraMagazines:1,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}],alternateMagazineSupplies:[{sourceWeaponId:'csc-advanced-rocket-launcher',variant:'standard',extraMagazines:1,autoloadMagazines:0,storageId:'none'}]});
 await importDraft(invalid,'invalid-expendable-supplies.json');await stage(3);await page.locator('#physical-category').selectOption('weapons');await status('invalid spare loader copy and alternate settings diagnosed','Needs correction');
 for(const field of ['autoloadAllocation','ammunitionOverrides-mode']){const control=page.locator(prefix('anti-armour-flail')+field);for(const detail of await control.locator('xpath=ancestor::details').all()){if(!await detail.getAttribute('open').then(v=>v!==null))await detail.locator(':scope > summary').click();}}
 for(const field of ['extraMagazines','autoload','autoloadAllocation','ammunitionOverrides-mode'])check('retained '+field+' repair control available',await page.locator(prefix('anti-armour-flail')+field).isVisible());
 await page.locator(prefix('anti-armour-flail')+'extraMagazines').selectOption('0');await page.locator(prefix('anti-armour-flail')+'autoload').selectOption('false');await page.locator(prefix('anti-armour-flail')+'autoloadAllocation').selectOption('legacy');await page.locator(prefix('anti-armour-flail')+'ammunitionOverrides-mode').selectOption('shared');
 const retained=await exportDraft();check('alternate supply remains serialized until explicitly repaired',retained.selections.physical.weapons.find(w=>w.id===flail.id).alternateMagazineSupplies.length===1);
 check('alternate supply removal control available',await page.locator(prefix('anti-armour-flail')+'alternateMagazineSupplies-0-remove').isVisible());await click(page.locator(prefix('anti-armour-flail')+'alternateMagazineSupplies-0-remove'));await status('all invalid supplies repaired through editor','Subset checked');
 check('unsaved invalid imports leave named save unchanged',await page.evaluate(()=>localStorage.getItem('traveller.robot-builder.designs.v1'))===saved);
 await importDraft(savedDraft,'repaired-expendable.json');await stage(6);await status('clean JSON restores hardware','Subset checked');
 const component=updateDesign(createDesign({kind:'ship-brain',techLevel:16}),{special:{designReferences:[{id:'shield-component',role:'installed-robot',quantity:1,design:savedDraft}]}});
 await importDraft(component,'shield-component.json');await stage(6);const componentText=await print();check('component selected rows retain acquisition and unknown mass',componentText.includes('One complete weapon')&&componentText.includes('Unspecified (printed dash)')&&!forbidden.test(componentText));
 const limbWeapons=savedDraft.selections.physical.weapons.filter(w=>['csc-anti-armour-flail','csc-garrotte'].includes(w.weaponId)).map(w=>{const {manipulatorId,supportManipulatorId,...rest}=w;return {...rest,placement:'arm',parentLimb:'limb',linkedWeapons:1,fireControl:'none'};});
 const limb=updateDesign(createDesign({kind:'cyborg',techLevel:16}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:1}}],augmentWeapons:limbWeapons}});
 await importDraft(limb,'shield-cyberlimb.json');await stage(6);check('cyberlimb selected rows retain scoped hardware',await page.locator('.review-limb-weapons').textContent().then(t=>t.includes('Single use')&&t.includes('Conditional damage')&&t.includes('Unspecified (printed dash)')));
 const limbText=await print();check('cyberlimb print keeps formulas without fake supply',limbText.includes('2D + opposed Melee Effect; conditional')&&!forbidden.test(limbText));
 check('no browser runtime errors',errors.length===0);
 await fs.writeFile(path.join(out,'shields-expendable-melee-report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' shields and expendable melee workflow checks');
}catch(error){await page.screenshot({path:path.join(out,'shields-expendable-melee-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'shields-expendable-melee-report.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));throw error;}
finally{await context.close();await browser.close();}
