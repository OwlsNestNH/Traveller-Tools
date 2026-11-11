import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as buildCurrentAslanOriginFixture,run} from './aslan-origin-fixtures.mjs';
// Preserve coverage of the historical origin UI; new popup has its own browser suite.
const buildAslanOriginFixture=options=>buildCurrentAslanOriginFixture({rulesRevision:'character-preview-2026-11-09.27',...options});
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=fileURLToPath(new URL('./artifacts/',import.meta.url));await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1';
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const checks=[],errors=[];
async function snapshot(page){return project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#new').disabled);}
async function replay(page){const before=await snapshot(page);await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>5);assert.deepEqual(await snapshot(page),before);}
async function shot(page,name){await page.locator('#workspace').screenshot({path:out+name+'.png'});}
async function fresh(name,width,fixture,check,{staticMode=false}={}){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(origin+(staticMode?'/':'/?api=local'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();
  await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>5);await check(page);await ready(page);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');
  assert.deepEqual(await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<(n.closest('.log-switch')?24:43)).map(n=>n.textContent)),[]);
  await shot(page,name);checks.push({name,width,pass:true});
 }finally{await context.close();}
}
try{
 for(const [gender,width] of [['male',1440],['female',390]])await fresh('aslan-origin-family-'+gender,width,run(buildAslanOriginFixture({gender,boons:6}),'gm-mode',{enabled:false}),async page=>{
  const before=await snapshot(page);await shot(page,'aslan-origin-family-'+gender+'-pending');await page.locator('[data-action=roll-aslan-family]').dblclick();await ready(page);
  const after=await snapshot(page);assert.equal(after.revision,before.revision+1);assert.equal(after.state.stage,gender==='male'?'aslan-birth-order':'aslan-estate');
  assert.equal(after.log.at(-1).rolls[0].values.length,1);assert.equal(after.state.backgroundRemaining,before.state.backgroundRemaining);assert.equal(after.state.character.aslanOrigin.familySOC,before.state.character.stats.SOC);
  assert.ok(after.log.at(-1).changes.some(c=>c.path==='aslanOrigin.family'));await replay(page);
 });
 await fresh('aslan-origin-roll-gender',320,run(buildAslanOriginFixture({gender:''}),'gm-mode',{enabled:false}),async page=>{
  assert.equal(await page.locator('[data-action=roll-aslan-family]').count(),0);await page.locator('[data-action=roll-aslan-gender]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.currentAslanOrigin.gender.mode,'rolled');assert.equal(after.state.currentAslanOrigin.gender.dice.length,2);assert.equal(after.state.currentAslanOrigin.identityGender,'');
  assert.equal(await page.locator('[data-action=roll-aslan-family]').count(),1);await replay(page);
 });
 await fresh('aslan-origin-gender-source-static',390,buildAslanOriginFixture({gender:'other',stage:'book-step'}),async page=>{
  const before=await snapshot(page);assert.equal(await page.locator('#aslan-origin-gender').inputValue(),'');await page.locator('[data-action=resolve-aslan-origin-source]').click();await ready(page);assert.equal((await snapshot(page)).revision,before.revision);
  await page.locator('#aslan-origin-gender').selectOption('female');await page.locator('#aslan-origin-reason').fill('Explicit referee source branch; chosen identity stays unchanged.');await shot(page,'aslan-origin-gender-source-pending');await page.locator('[data-action=resolve-aslan-origin-source]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.character.identityGender,'other');assert.equal(after.state.character.gender,'female');assert.match(await page.locator('#sheet .sheet-meta').innerText(),/other/);assert.match(await page.locator('#sheet').innerText(),/Source rules branch: female/);await replay(page);
 },{staticMode:true});
 await fresh('aslan-origin-birth-order',390,run(buildAslanOriginFixture({stage:'aslan-birth-order'}),'gm-mode',{enabled:false}),async page=>{
  await page.locator('[data-action=roll-aslan-birth-order]').click();await ready(page);const after=await snapshot(page),birth=after.state.currentAslanOrigin.birthOrder;
  assert.equal(birth.dice.length,2);assert.equal(birth.id,birth.total>=11?'first-son':'second-son');assert.equal(after.state.character.birthOrder,birth.id);assert.equal(after.state.character.assets?.length??0,0);await replay(page);
 });
 for(const [soc,width] of [[8,320],[9,1440]])await fresh('aslan-origin-estate-'+soc,width,run(buildAslanOriginFixture({familySOC:soc,stage:'aslan-estate'}),'gm-mode',{enabled:false}),async page=>{
  const before=await snapshot(page);assert.equal(await page.locator('[data-method=printed-minimum]').isDisabled(),false);await shot(page,'aslan-origin-estate-'+soc+'-pending');await page.locator('[data-method=printed-minimum]').click();await ready(page);
  const after=await snapshot(page),estate=after.state.character.aslanOrigin.estate;assert.equal(after.log.at(-1).rolls.length,0);assert.equal(estate.minimumParcels,soc===9?10:null);assert.equal(estate.ownership,'unestablished');assert.deepEqual(after.state.character.assets,before.state.character.assets);assert.equal(after.state.character.cash,before.state.character.cash);assert.equal(after.state.stage,'aslan-clan');await replay(page);
 });
 await fresh('aslan-origin-estate-source',390,buildAslanOriginFixture({familySOC:18,stage:'aslan-estate'}),async page=>{
  const before=await snapshot(page);await page.locator('[data-method=referee-baseline]').click();await ready(page);assert.equal((await snapshot(page)).revision,before.revision);
  await page.locator('#aslan-estate-parcels').fill('100');await page.locator('#aslan-estate-increment').fill('20');await page.locator('#aslan-origin-reason').fill('Hypothetical referee baseline outside the printed SOC range, without title.');await shot(page,'aslan-origin-estate-source-pending');await page.locator('[data-method=referee-baseline]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.character.aslanOrigin.estate.minimumParcels,100);assert.equal(after.state.character.aslanOrigin.estate.interpretation,'referee-baseline');assert.equal(after.state.character.aslanOrigin.estate.ownership,'unestablished');assert.equal(after.log.at(-1).rolls.length,0);await replay(page);
 });
 await fresh('aslan-origin-estate-player',320,run(buildAslanOriginFixture({familySOC:18,stage:'aslan-estate'}),'gm-mode',{enabled:false}),async page=>{assert.equal(await page.locator('#aslan-estate-parcels').isDisabled(),true);assert.equal(await page.locator('[data-method=referee-baseline]').isDisabled(),true);await replay(page);});
 await fresh('aslan-origin-family-source',390,buildAslanOriginFixture({familySOC:1,stage:'book-step'}),async page=>{
  assert.equal(await page.locator('#aslan-family-band').inputValue(),'');await page.locator('#aslan-family-band').selectOption('lower');await page.locator('#aslan-origin-reason').fill('Referee chooses a family classification for unprinted SOC1.');await shot(page,'aslan-origin-family-source-pending');await page.locator('[data-action=resolve-aslan-origin-source]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.stage,'aslan-family');assert.equal(after.state.character.aslanOrigin.familySOC,1);assert.equal(after.state.character.aslanOrigin.familyBandDecision.band,'lower');assert.equal(after.log.at(-1).rolls.length,0);await replay(page);
 });
 // Historical saves retain the explicit referee boundary; current rerolls have their own browser suite.
 for(const revision of ['16','17']){
 const legacyOrigin=()=>buildAslanOriginFixture({rulesRevision:'character-preview-2026-11-09.'+revision,gender:'female',familySOC:2,familyDie:4,stage:'book-step'});
 for(const decision of ['omit','grant-level-zero'])await fresh('aslan-origin-independence-legacy-'+revision+'-'+decision,decision==='omit'?320:1440,legacyOrigin(),async page=>{
  const before=await snapshot(page);assert.equal(await page.locator('#aslan-origin-decision').inputValue(),'');assert.equal(await page.locator('[data-action=add-effect]').count(),0);await page.locator('#aslan-origin-decision').selectOption(decision);await page.locator('#aslan-origin-reason').fill('Explicit referee decision for conflicting family and gender rules.');await shot(page,'aslan-origin-independence-'+decision+'-pending');await page.locator('[data-action=resolve-aslan-origin-source]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.character.skills.Independence,decision==='omit'?undefined:0);assert.equal(after.state.backgroundRemaining,before.state.backgroundRemaining);assert.equal(after.state.stage,'aslan-estate');assert.equal(after.state.character.outcast??false,false);assert.equal(after.log.at(-1).rolls.length,0);await replay(page);
 },{staticMode:decision==='grant-level-zero'});
 await fresh('aslan-origin-source-player-legacy-'+revision,320,run(legacyOrigin(),'gm-mode',{enabled:false}),async page=>{assert.equal(await page.locator('#aslan-origin-decision').isDisabled(),true);assert.equal(await page.locator('[data-action=resolve-aslan-origin-source]').isDisabled(),true);await replay(page);});
 }
 await fresh('aslan-origin-clan-roll',1440,run(buildAslanOriginFixture({stage:'aslan-clan',boons:6}),'gm-mode',{enabled:false}),async page=>{
  await shot(page,'aslan-origin-clan-pending');await page.locator('[data-action=roll-aslan-clan]').click();await ready(page);const after=await snapshot(page),clan=after.state.character.aslanOrigin.clan;
  assert.equal(clan.dice.length,2);assert.equal(after.log.at(-1).rolls.length,[3,4,5,10,11].includes(clan.total)?2:1);assert.equal(after.state.stage,'aslan-pride');assert.equal(clan.mode,'rolled');await replay(page);
 });
 await fresh('aslan-origin-clan-referee',390,buildAslanOriginFixture({stage:'aslan-clan'}),async page=>{
  const before=await snapshot(page);await page.locator('summary').filter({hasText:'Referee-selected clan'}).click();await page.locator('[data-action=choose-aslan-clan]').click();await ready(page);assert.equal((await snapshot(page)).revision,before.revision);
  await page.locator('#aslan-clan-name').fill('Synthetic <Clan>');await page.locator('#aslan-clan-scope').fill('One source-approved world');await page.locator('#aslan-origin-reason').fill('Referee selected this synthetic clan for the test.');await shot(page,'aslan-origin-clan-referee-pending');await page.locator('[data-action=choose-aslan-clan]').click();await ready(page);
  const after=await snapshot(page);assert.equal(after.state.character.aslanOrigin.clan.mode,'referee');assert.equal(after.log.at(-1).rolls.length,0);assert.match(await page.locator('#sheet').innerText(),/Synthetic <Clan>/);assert.equal(await page.locator('clan').count(),0);await replay(page);
 });
 await fresh('aslan-origin-clan-name-pride',320,run(buildAslanOriginFixture({stage:'aslan-pride'}),'gm-mode',{enabled:false}),async page=>{
  await page.locator('summary').filter({hasText:'Give the clan a name'}).click();await page.locator('#aslan-clan-name').fill('A long synthetic clan name that should wrap rather than widen a narrow screen');await page.locator('[data-action=name-aslan-clan]').click();await ready(page);
  const named=await snapshot(page);assert.equal(named.log.at(-1).rolls.length,0);await shot(page,'aslan-origin-pride-pending');await page.locator('[data-action=roll-aslan-pride]').click();await ready(page);const after=await snapshot(page);
  assert.equal(after.state.stage,'background');assert.equal(after.state.character.aslanOrigin.pride.dice.length,2);assert.equal(after.state.backgroundRemaining,named.state.backgroundRemaining);await replay(page);
 });
 await fresh('aslan-origin-background-before-rite',390,run(buildAslanOriginFixture({stage:'background',familySOC:2,familyDie:2}),'gm-mode',{enabled:false}),async page=>{
  const before=await snapshot(page);assert.equal(before.state.character.skills['Jack-of-all-Trades'],1);const choices=page.locator('#background-form input[name=skills]');for(let i=0;i<before.state.backgroundRemaining;i++)await choices.nth(i).check();
  await page.getByRole('button',{name:'Accept background skills',exact:true}).click();await ready(page);const after=await snapshot(page);assert.equal(after.state.stage,'aslan-rite');assert.equal(after.state.character.aslanOrigin.background.count,before.state.backgroundRemaining);assert.equal(after.state.character.skills['Jack-of-all-Trades'],1);await replay(page);
 });
 await fresh('aslan-origin-rite',1440,run(buildAslanOriginFixture({stage:'aslan-rite',boons:6}),'gm-mode',{enabled:false}),async page=>{
  const before=await snapshot(page);await shot(page,'aslan-origin-rite-pending');await page.locator('[data-action=roll-aslan-rite]').dblclick();await ready(page);const after=await snapshot(page),rite=after.state.character.aslanOrigin.rite;
  assert.equal(after.revision,before.revision+1);assert.equal(rite.dice.length,2);assert.equal(rite.modifier,['STR','DEX','END','INT','EDU','SOC'].filter(k=>before.state.character.stats[k]>rite.total).length);assert.equal(after.state.character.terms,0);assert.equal(after.state.character.age,before.state.character.age);assert.ok(after.log.at(-1).changes.some(c=>c.path==='aslanOrigin.rite'));await replay(page);
 });
 assert.deepEqual(errors,[]);await writeFile(out+'aslan-origin-browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
