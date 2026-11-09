import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {agentCoverFixture,coverResult} from './agent-cover-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const read=async page=>project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));
const ready=page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
const specialties={Animals:'Animals (handling)',Athletics:'Athletics (dexterity)',Electronics:'Electronics (sensors)',Engineer:'Engineer (power)',Profession:'Profession (construction)',Science:'Science (physics)',Language:'Language (Vilani)',Drive:'Drive (wheeled)',Flyer:'Flyer (grav)',Melee:'Melee (blade)',Pilot:'Pilot (spacecraft)','Gun Combat':'Gun Combat (slug)'};
try{
 for(const apiMode of [false,true])for(const width of [320,1440])for(const vargr of [false,true])for(const step of ['cover','training','failure','wager']){
  if(vargr&&step==='wager')continue;
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(apiMode?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   const fixture=step==='wager'?coverResult({careerId:'core.rogue',row:10}):step==='cover'?agentCoverFixture({vargr}):coverResult({vargr,success:step!=='failure',row:step==='failure'?2:5});
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await ready(page);
   if(step==='cover'){
    await page.getByRole('heading',{name:'Choose your cover career'}).waitFor();assert.equal(await page.locator('[data-action=cross-career-cover]').count(),vargr?9:2);assert.equal(await page.locator('[data-career^="zhodani."]').count(),0);
    await page.reload();await ready(page);await page.locator('[data-action=cross-career-cover][data-career="'+(vargr?'vargr.citizen':'core.citizen')+'"]').click();await ready(page);
    assert.equal((await read(page)).state.character.crossCareerRoutes.at(-1).coverCareerId,vargr?'vargr.citizen':'core.citizen');
   }else if(step==='training'){
    await page.getByRole('heading',{name:'Choose your extra training'}).waitFor();assert.equal(await page.locator('[data-action=cross-career-training]').count(),3);await page.reload();await ready(page);
    await page.locator('[data-action=cross-career-training][data-assignment=worker]').click();await ready(page);
    for(let i=0;i<8;i++){const p=await read(page);if(p.state.stage!=='skill-choice')break;const base=p.state.pendingChoice.allowed[0];await page.locator('#award-skill').fill(specialties[base]??base);await page.locator('[data-action=choose-skill]').click();await ready(page);}
    const p=await read(page);assert.equal(p.state.stage,'advancement');assert.equal(p.state.character.crossCareerRoutes.at(-1).status,'completed');assert.equal(p.state.character.crossCareerRoutes.at(-1).training.assignment,'worker');assert.equal(p.state.character.terms,0);assert.equal(p.state.character.careers.length,1);assert.match(await page.locator('#sheet').innerText(),/Deception check/);
   }else if(step==='wager'){
    await page.locator('[data-action=resolve-benefit-wager][data-decline=true]').waitFor();const pending=await read(page);assert.equal(pending.state.character.benefitWagers.at(-1).sourceCareerId,'core.rogue');assert.equal(pending.state.character.benefitWagers.at(-1).careerId,'core.agent');
    await page.locator('[data-action=resolve-benefit-wager][data-decline=true]').click();await ready(page);assert.equal((await read(page)).state.stage,'cross-career-training');
   }else {const p=await read(page);assert.equal(p.state.stage,'term-end');assert.equal(p.state.character.crossCareerRoutes.at(-1).training,null);assert.equal(await page.locator('[data-action=cross-career-training]').count(),0);}
   const before=await read(page);await page.reload();await ready(page);assert.deepEqual(await read(page),before);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name='agent-cover-'+(vargr?'vargr':'core')+'-'+step+'-'+width+(apiMode?'-http':'-static');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('agent-cover-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
