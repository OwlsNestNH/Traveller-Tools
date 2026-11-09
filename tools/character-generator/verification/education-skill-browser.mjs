import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession,project} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
let r=run(createSession('university-ui'),'setup',{name:'University test',species:'human',gender:'female'});
r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.EDU',value:12,reason:'Test admission'});r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'precareer',{id:'core.university'});
if(r.state.stage!=='education-skill')r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[6,6],reason:'Test admission'});
assert.equal(r.state.stage,'education-skill');
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],key='traveller-character-generator.v1';
try{
 for(const http of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(r.session)});await page.reload();
   await page.getByRole('heading',{name:'University skill 1 of 2: level 0'}).waitFor();
   await page.locator('#education-subject').selectOption('Animals');assert.deepEqual(await page.locator('#education-skills option').evaluateAll(os=>os.map(o=>o.value)),['Animals (training)','Animals (veterinary)']);
   await page.locator('#education-skill').fill('Animals (training)');await page.locator('#education-subject').selectOption('Engineer');assert.equal(await page.locator('#education-skill').inputValue(),'');assert.equal(await page.locator('#education-skills option[value="Animals (training)"]').count(),0);
   await page.locator('#education-subject').selectOption('Science');await page.locator('#education-skill').fill('Science (physics)');await page.getByRole('button',{name:'Record level 0 and choose level 1'}).click();
   await page.getByRole('heading',{name:'University skill 2 of 2: level 1'}).waitFor();assert.equal(await page.locator('#education-subject option[value=Science]').count(),0);
   await page.reload();await page.getByRole('heading',{name:'University skill 2 of 2: level 1'}).waitFor();await page.locator('#education-subject').selectOption('Animals');await page.locator('#education-skill').fill('Animals (veterinary)');
   await page.getByRole('button',{name:'Record study skill',exact:true}).evaluate(button=>{button.click();button.click();});await page.getByRole('heading',{name:'Your education term'}).waitFor();
   const raw=await page.evaluate(key=>localStorage.getItem(key),key),result=project(JSON.parse(raw));assert.equal(result.state.character.skills.Science,0);assert.equal(result.state.character.skills['Animals (veterinary)'],1);assert.equal(result.revision,r.revision+2);
   await page.reload();await page.getByRole('heading',{name:'Your education term'}).waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   console.log('University controls passed '+width+' '+(http?'HTTP':'static'));
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
