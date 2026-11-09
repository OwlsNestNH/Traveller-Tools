import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {awardFixture,coreGenericFixture} from './constrained-award-fixtures.mjs';
const cases=[['truther-new',()=>awardFixture(),'Science (physics)',1],['truther-two',()=>awardFixture('companion.truther',9),'Medic',2],['vargr-non-psi',()=>awardFixture('vargr.psion',6),'Medic',1],['vargr-new-talent',()=>awardFixture('vargr.psion',8),'Teleportation',0],['core-any-talent',coreGenericFixture,'Teleportation',null]];
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const apiMode of [false,true])for(const width of [320,1440])for(const [scenario,fixture,skill,level] of cases){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture().session)});await page.reload();await page.locator('#award-skill').waitFor();
   const name='constrained-awards-'+scenario+'-'+width+(apiMode?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL(name+'-pending.png',out)),fullPage:true});
   await page.locator('#award-skill').fill('Technopathy');await page.locator('[data-action=choose-skill]').click();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.equal(await page.locator('#award-skill').count(),1);
   await page.locator('[data-action=skill-award-source]').click();await page.locator('[data-action=retry-skill-choice]').waitFor();await page.locator('[data-action=retry-skill-choice]').click();await page.locator('#award-skill').waitFor();
   if(scenario==='vargr-non-psi'){
    await page.locator('#award-skill').fill('Science (Telepathy)');await page.locator('[data-action=choose-skill]').click();await page.waitForFunction(()=>!document.querySelector('#new').disabled);assert.equal(await page.locator('#award-skill').count(),1);
    await page.locator('#award-skill').fill('Science (unclassified field)');await page.locator('[data-action=choose-skill]').click();await page.locator('[data-action=retry-skill-choice]').waitFor();
    const paused=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));assert.equal(paused.state.character.skills['Science (unclassified field)'],undefined);assert.equal(paused.state.pending.effect.scope,'non-psionic');
    await page.reload();await page.locator('[data-action=retry-skill-choice]').click();await page.locator('#award-skill').waitFor();
   }
   await page.locator('#award-skill').fill(skill);await page.locator('[data-action=choose-skill]').click();await page.waitForFunction(()=>!document.querySelector('#new').disabled&&!document.querySelector('#award-skill'));
   const before=project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));if(level===null){assert.equal(before.state.stage,'psionic-training');assert.equal(before.state.psionicTraining.talent,skill);}else assert.equal(before.state.character.skills[skill],level);
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#new').disabled&&!document.querySelector('#award-skill'));assert.deepEqual(project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))),before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<43).map(n=>n.textContent)),[]);await page.screenshot({path:fileURLToPath(new URL(name+'-complete.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('constrained-awards-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
