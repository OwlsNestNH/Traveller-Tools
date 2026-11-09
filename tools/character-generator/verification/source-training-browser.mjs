import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {sourceTrainingFixture,run} from './source-training-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const apiMode of [false,true])for(const width of [320,1440])for(const navy of [true,false]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   let fixture=sourceTrainingFixture({navy});if(navy)fixture=run(fixture,'choose-effect',{index:0});
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();
   if(navy){
    await page.locator('[data-action=choose-effect]').first().waitFor();assert.match(await page.locator('#workspace').innerText(),/Core p. 37/);assert.equal(await page.getByRole('button',{name:/Advanced education/}).count(),0);assert.equal(await page.locator('[data-action=choose-effect]').count(),3);
    await page.reload();await page.locator('[data-action=choose-effect]').first().click();
   }else{
    assert.equal(fixture.state.stage,'skill-choice');assert.equal(fixture.state.character.deferredSkillAwards,undefined);
    await page.locator('#award-skill').waitFor();await page.reload();await page.locator('#award-skill').fill('Language (Vilani)');await page.locator('[data-action=choose-skill]').click();
   }
   await page.waitForFunction(()=>!document.querySelector('#new').disabled&& !document.querySelector('[data-action=choose-effect]')&&!document.querySelector('#award-skill'));
   const before=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));assert.equal(before.state.character.sourceTraining.length,1);assert.equal(before.state.character.sourceTraining[0].status,'completed');assert.equal(before.state.stage,navy?'term-end':'advancement');if(!navy){assert.equal(before.state.character.skills['Language (vilani)'],1);assert.equal(before.state.character.deferredSkillAwards,undefined);}
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))),before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name='source-training-'+(navy?'navy':'citizen')+'-'+width+(apiMode?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('source-training-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
