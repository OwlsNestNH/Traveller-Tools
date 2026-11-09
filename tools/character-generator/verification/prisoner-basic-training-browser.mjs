import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {prisonerBasicTrainingFixture} from './prisoner-basic-training-fixtures.mjs';
import {assertResultColor} from './result-color-browser-assertions.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const {firstCareer,basic}=prisonerBasicTrainingFixture();
const legacy=JSON.parse(await readFile(new URL('./prisoner-escape-legacy.json',import.meta.url),'utf8'));
const legacyRaw=JSON.stringify(legacy.session,null,2);
try{
 for(const apiMode of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   const url='http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/');
   await page.goto(url);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(firstCareer.session)});await page.reload();
   await page.getByRole('heading',{name:'Will you make it through?'}).waitFor();assert.equal(await page.locator('[data-action=training]').count(),0);
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(basic.session)});await page.reload();
   await page.getByRole('heading',{name:'Choose a basic-training skill'}).waitFor();
   assert.match(await page.locator('#workspace').innerText(),/level 0.*regular training roll/s);
   await page.getByRole('button',{name:'Persuade 0',exact:true}).evaluate(button=>{button.click();button.click();});
   await page.getByRole('heading',{name:'Regular term training'}).waitFor();
   assert.match(await page.locator('#workspace').innerText(),/Basic training is complete.*later career.*p\. 18/s);
   const raw=await page.evaluate(key=>localStorage.getItem(key),key),trained=api({operation:'project',session:JSON.parse(raw)});
   assert.equal(trained.revision,basic.revision+1);assert.equal(trained.state.character.skills.Persuade,0);assert.equal(trained.state.character.skills['Melee (unarmed)'],1);
   await page.reload();await page.getByRole('heading',{name:'Regular term training'}).waitFor();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
   const info=page.getByLabel('View skills and outcomes: Assignment skills');await info.focus();await info.press('Enter');
   assert.equal(await page.locator('.training-information[open], .training-information:popover-open').count(),1);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
   await info.press('Enter');assert.equal(await page.locator('.training-information[open], .training-information:popover-open').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name=width+(apiMode?'-http':'-static');await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('prisoner-basic-training-'+name+'.png',out))});
   await page.getByRole('button',{name:'Assignment skills',exact:true}).evaluate(button=>{button.click();button.click();});
   await page.getByRole('heading',{name:'Will you make it through?'}).waitFor();
   const done=api({operation:'project',session:JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))});
   assert.equal(done.revision,basic.revision+2);assert.equal(done.log.at(-1).rolls.length,1);assert.equal(done.log.at(-1).rolls[0].label,'Training: assignment');assert.equal(done.state.character.skills.Persuade,0);
   await page.reload();await page.getByRole('heading',{name:'Will you make it through?'}).waitFor();assert.equal(await page.locator('[data-action=training]').count(),0);
   checks.push({name,pass:true});
   for(const skill of ['Stealth','Deception',null]){
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:legacyRaw});await page.reload();
    await page.getByRole('heading',{name:'Prisoner Event 3: Escape opportunity'}).waitFor();
    assert.equal(await page.locator('#recovery-panel:visible').count(),0);
    assert.match(await page.locator('#workspace').innerText(),/possible way out.*Success lets you leave prison.*Failure raises your Parole Threshold by 2/s);
    assert.deepEqual(await page.locator('#workspace [data-action=prisoner-escape]').allTextContents(),['Attempt escape using Stealth (10+)','Attempt escape using Deception (10+)']);
    assert.match(await page.locator('#workspace').innerText(),/Stealth 0.*Check DM \+0.*Deception 1.*Check DM \+1/s);
    await page.reload();await page.getByRole('heading',{name:'Prisoner Event 3: Escape opportunity'}).waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),legacyRaw);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('#workspace').screenshot({path:fileURLToPath(new URL('prisoner-escape-'+name+'-'+(skill??'stay')+'.png',out))});
    const button=page.getByRole('button',{name:skill?'Attempt escape using '+skill+' (10+)':'Stay in prison',exact:true});await button.focus();await button.press('Enter');
    await page.waitForFunction(revision=>JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.length===revision+1&&!document.querySelector('#new').disabled,legacy.session.events.length);
    const resolved=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),result=api({operation:'project',session:resolved});
    assert.deepEqual(resolved.events.slice(0,legacy.session.events.length),legacy.session.events);assert.equal(resolved.rulesRevision,'character-preview-2026-11-09.16');
    assert.equal(result.state.prisonerEscape,undefined);assert.equal(await page.locator('#workspace [data-action=prisoner-escape]').count(),0);
    if(skill){assert.deepEqual(resolved.events.at(-1).command,{type:'prisoner-escape',payload:{skill}});assert.match(await page.locator('#message').innerText(),new RegExp('escape using '+skill));assert.equal(result.log.at(-1).rolls.length,1);await assertResultColor(page,'failure',{message:true});}
    else {assert.equal(result.state.stage,'advancement');assert.deepEqual(result.log.at(-1).rolls,[]);}
    await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),resolved);assert.equal(await page.locator('#workspace [data-action=prisoner-escape]').count(),0);
    checks.push({name:'escape-'+name+'-'+(skill??'stay'),pass:true});
   }
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('prisoner-basic-training-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
