import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {trainingFixture,run} from './training-information-fixtures.mjs';
const fixture=run(trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate',rulesRevision:'character-preview-2026-11-09.18'}),'training',{table:'advanced'});
assert.equal(fixture.state.character.deferredSkillAwards.at(-1).name,'Electronics');
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],key='traveller-character-generator.v1';
try{for(const http of [false,true])for(const width of [320,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();
  await page.getByRole('button',{name:'Allocate specializations now'}).click();await page.locator('#award-base').waitFor();
  assert.equal(await page.locator('#award-base').inputValue(),'Electronics');
  const options=await page.locator('#award-speciality option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));
  assert.deepEqual(options,['Electronics (comms)','Electronics (computers)','Electronics (remote ops)','Electronics (sensors)']);
  await page.reload();await page.locator('#award-speciality').waitFor();await page.locator('#award-speciality').selectOption('Electronics (computers)');
  assert.equal(await page.locator('#award-skill').inputValue(),'Electronics (computers)');await page.getByRole('button',{name:'Accept skill',exact:true}).click();
  await page.waitForFunction(({key})=>{const raw=localStorage.getItem(key);return raw&&JSON.parse(raw).events.at(-1)?.command.type==='choose-skill';},{key});
  const raw=await page.evaluate(key=>localStorage.getItem(key),key),result=project(JSON.parse(raw));
  assert.equal(result.state.character.skills['Electronics (computers)'],1);assert.equal(result.state.stage,fixture.state.stage);assert.equal(result.state.character.deferredSkillAwards.at(-1).status,'allocated');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS deferred allocation '+(http?'HTTP':'static')+' '+width);
 }finally{await context.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
