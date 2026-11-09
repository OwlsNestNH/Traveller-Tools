import {downloadedActionLog} from './download-log-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,api} from '../engine/session.mjs';
import {trainingFixture,run} from './training-information-fixtures.mjs';
import {sourceTrainingFixture} from './source-training-fixtures.mjs';
import {coverResult} from './agent-cover-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const ordinary=trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate'}),navy=run(sourceTrainingFixture(),'choose-effect',{index:0}),borrowed=coverResult({vargr:true,careerId:'vargr.citizen'});
try{
 for(const apiMode of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   for(const [kind,fixture,action] of [['ordinary',ordinary,'training'],['source',navy,'choose-effect'],['borrowed',borrowed,'cross-career-training']]){
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.locator('.training-info-trigger').first().waitFor();
    const before=await page.evaluate(key=>localStorage.getItem(key),key),trigger=page.locator('.training-info-trigger').first(),popup=page.locator('.training-information:popover-open');
    const options=kind==='ordinary'?fixture.state.trainingOptions:kind==='source'?fixture.state.pendingChoice.options:fixture.state.currentCrossCareerTraining.options;
    await trigger.focus();await trigger.press('Enter');await popup.waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
    assert.deepEqual(await popup.locator('li').allTextContents(),options[0].information.entries);
    assert.ok((await trigger.boundingBox()).width<=44);assert.equal(await popup.getAttribute('role'),'dialog');
    await page.keyboard.press('Escape');assert.equal(await popup.count(),0);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await trigger.click();await popup.waitFor();await popup.locator('.training-info-close').click();assert.equal(await popup.count(),0);
    await trigger.click();await popup.waitFor();await page.mouse.click(2,2);assert.equal(await popup.count(),0);
    await trigger.click();await popup.waitFor();await page.reload();await page.locator('.training-info-trigger').first().waitFor();assert.equal(await popup.count(),0);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
    const choices=page.locator('[data-action='+action+']');assert.ok(await choices.count()>1);
    await page.locator('.training-info-trigger').first().click();await popup.waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const name=kind+'-'+width+(apiMode?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL('training-information-'+name+'.png',out)),fullPage:true});
    await page.keyboard.press('Escape');
    // The popup must never select a table, and rapid repeated selection
    // must still execute one command only.
    await choices.first().evaluate(button=>{button.click();button.click();});
    await page.waitForFunction(revision=>{const session=JSON.parse(localStorage.getItem('traveller-character-generator.v1'));return session.events.length===revision+1&&!document.querySelector('#new').disabled;},fixture.revision);
    let r=api({operation:'project',session:JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))});
    const notice=await page.locator('#message').innerText();assert.match(notice,/Skill |Pending:|choose|Choose|source|Strength|Dexterity|Endurance|Intellect|Education|Charisma|Social standing|Gambler/);
    for(const change of r.log.at(-1).changes.filter(c=>c.path.startsWith('skills.')&&typeof c.after==='number'&&(c.before===null||c.after>c.before)))assert.ok(notice.includes(change.path.slice(7)));
    await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)).events.length,fixture.revision+1);
    checks.push({name,pass:true});
   }
   // An awarded base skill must not offer unrelated skills in its suggestions.
   const specialty=run(ordinary,'training',{table:'advanced'});assert.deepEqual(specialty.state.pendingChoice.allowed,['Electronics']);
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(specialty.session)});await page.reload();await page.locator('#award-skill').waitFor();
   assert.deepEqual(await page.locator('#award-skill-options option').evaluateAll(options=>options.map(option=>option.value)),specialty.state.skillChoiceSuggestions);
   assert.match(await page.locator('#workspace').innerText(),/Awarded base skill: Electronics/);
   const specialtySave=await page.evaluate(key=>localStorage.getItem(key),key);await page.locator('#award-skill').fill('Admin');await page.locator('[data-action=choose-skill]').click();await page.locator('#message.error').waitFor();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),specialtySave);await page.reload();await page.locator('#award-skill').fill('Electronics (computers)');await page.locator('[data-action=choose-skill]').click();
   await page.waitForFunction(()=>document.querySelector('#message')?.textContent.includes('Skill Electronics (computers): untrained → 1'));
   assert.match(await downloadedActionLog(page),/Electronics \(computers\)/);checks.push({name:'specialty-'+width+(apiMode?'-http':'-static'),pass:true});
   for(const [base,die,selected] of [['Drive',1,'Drive (wheel)'],['Melee',6,'Melee (blade)']]){
    let offered=run(ordinary,'training',{table:'personal'});offered=run(offered,'gm-replay',{revision:offered.revision,rollIndex:0,values:[die],reason:'Speciality dropdown regression'});
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(offered.session)});await page.reload();await page.locator('#award-skill').waitFor();
    const values=await page.locator('#award-skill-options option').evaluateAll(options=>options.map(option=>option.value));assert.ok(values.includes(selected));assert.ok(values.every(value=>value.startsWith(base+' (')));assert.ok(!values.includes(base));
    await page.locator('#award-skill').fill(selected);await page.locator('[data-action=choose-skill]').click();await page.waitForFunction(()=>!document.querySelector('#award-skill')&&!document.querySelector('#new').disabled);
    const accepted=api({operation:'project',session:JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))});assert.equal(accepted.state.character.skills[selected],1);assert.notEqual(accepted.state.stage,'book-step');checks.push({name:base+'-specialty-'+width+(apiMode?'-http':'-static'),pass:true});
   }
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('training-information-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
