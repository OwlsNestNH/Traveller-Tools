import {openLiveRecord} from './journey-browser-helpers.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {createSession,execute,project,exportSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const force=(r,type,payload,values)=>{r=run(r,type,payload);return run(r,'gm-replay',{revision:r.revision,rollIndex:0,values,reason:'Academy browser source fixture'});};
function academy(service='army',revision='19'){
 const session=createSession('academy-gm');session.rulesRevision='character-preview-2026-11-09.'+revision;
 let r=run(session,'setup',{name:'Synthetic Academy browser fixture',species:'human',gender:'female'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});
 for(const stat of ['STR','DEX','END','INT','EDU','SOC'])r=run(r,'gm-override',{field:'stat.'+stat,value:7,reason:'Academy source fixture'});
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=force(r,'precareer',{id:'core.academy-'+service},[5,5]);
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 r=force(r,'education-event',{},[2,3]);return force(r,'education-graduation',{},[5,6]);
}
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',errors=[],checks=[],out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
async function load(page,r){await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(r.session)});await page.reload();await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)===revision,r.revision);}
async function replay(page){const before=await saved(page);await page.reload();await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)===revision,before.events.length);assert.deepEqual(await saved(page),before);}
async function choices(page){for(let n=0;n<25;n++){await ready(page);const s=project(await saved(page)).state;
 if(s.stage==='preterm-commission')await page.locator('[data-action=skip-education-commission]').click();
 else if(s.stage==='effect-choice')await page.locator('[data-action=choose-effect]').last().click();
 else if(s.stage==='education-service'){const names=s.pendingChoice.options.filter(n=>!s.pendingChoice.picked.includes(n)),name=['Recon','Athletics','Gun Combat'].find(n=>names.includes(n))??names[0];await page.locator('[data-action=education-service][data-name="'+name+'"]').click();}
 else if(s.stage==='skill-choice'){assert.equal(s.character.deferredSkillAwards,undefined);const suggestions=s.skillChoiceSuggestions;assert.ok(suggestions.length);await page.locator('#award-skill').fill(suggestions[0]);await page.getByRole('button',{name:'Accept skill',exact:true}).click();}
 else return s;
 }throw Error('Academy browser choices exceeded bound');}
try{for(const http of [false,true])for(const width of [320,1440]){
 const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
 for(const [service,enabled] of [['army',false],['army',true],['marine',true],['navy',true]]){
  const fixture=academy(service);await load(page,fixture);assert.equal(fixture.session.rulesRevision,'character-preview-2026-11-09.19');await openLiveRecord(page);await page.locator('#gm-controls > summary').click();const toggle=page.locator('#gm-academy-training');assert.equal(await toggle.isChecked(),false);assert.equal(await toggle.isEnabled(),true);
  if(enabled){await toggle.check();await ready(page);assert.equal(project(await saved(page)).state.config.academyServiceSkill,true);await openLiveRecord(page);await toggle.uncheck();await ready(page);assert.equal(project(await saved(page)).state.config.academyServiceSkill,false);await openLiveRecord(page);await toggle.check();await ready(page);}
  await replay(page);assert.equal(await toggle.isChecked(),enabled);
  await page.locator('[data-action=select-career][data-id="core.'+service+'"]').click();await page.locator('#career-assignment').selectOption(service==='navy'?'crew':'support');await page.getByRole('button',{name:'Attempt this career',exact:true}).click();
  let state=await choices(page);assert.equal(state.stage,enabled?'training':'survival');assert.equal(await toggle.isDisabled(),true);
  if(enabled){assert.deepEqual(state.trainingOptions.map(t=>t.id),['service']);assert.deepEqual(await page.locator('[data-action=training]').evaluateAll(ns=>ns.map(n=>n.dataset.table)),['service']);assert.match(await page.locator('#workspace').innerText(),/GM option|not the default Core rule/i);
   await replay(page);const before=await saved(page),expected=run({session:before},'training',{table:'service'});
   await page.locator('[data-action=training][data-table=service]').evaluate(b=>{b.click();b.click();});await ready(page);const rolled=await saved(page);assert.equal(rolled.events.length,before.events.length+1);assert.equal(rolled.events.at(-1).rolls.length,1);assert.deepEqual(project(rolled).state,expected.state);
   state=await choices(page);assert.equal(state.stage,'survival');assert.equal(state.character.careers[0].academyServiceTraining,'completed');assert.equal(state.character.deferredSkillAwards,undefined);assert.equal(await page.locator('[data-action=training]').count(),0);
  }else{assert.equal(state.character.careers[0].academyServiceTraining,undefined);assert.equal(state.character.skills['Vacc Suit'],0);}
  await replay(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks.push({http,width,service,enabled,pass:true});
 }
 for(const revision of ['16','17','18']){const fixture=academy('army',revision);await load(page,fixture);await replay(page);assert.deepEqual(project(await saved(page)).state,fixture.state);assert.equal((await saved(page)).rulesRevision,'character-preview-2026-11-09.'+revision);assert.equal(await page.locator('#gm-academy-training').isChecked(),false);checks.push({http,width,legacy:revision,pass:true});}
 }finally{await context.close();}
}assert.deepEqual(errors,[]);await writeFile(new URL('academy-gm-option-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
