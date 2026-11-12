// Actual released GUI screens, public-command fixtures and immutable blocked attempts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession,project} from '../engine/session.mjs';
import {studyFixture} from './education-result-fixtures.mjs';
import {buildAslanOriginFixture,force} from './aslan-origin-fixtures.mjs';
import {buildAslanOfficerFixture} from './aslan-officer-fixtures.mjs';
import {lifeFixture} from './core-life-event-fixtures.mjs';
import {lawyerFixture} from './prisoner-lawyer-fixtures.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function background(species='human'){
 let r=run(createSession('warning-'+species),'setup',{species,gender:'male'});r=run(r,'roll-statistics');return run(r,'accept-statistics');
}
let partial=run(createSession('warning-manual'),'configure',{physicalDice:true});partial=run(partial,'setup',{species:'human'});partial=run(partial,'enter-physical-statistic',{code:'STR',value:7});
const fixtures={human:background(),aezorgh:background('aezorgh'),family:force(buildAslanOriginFixture({familySOC:3}),'roll-aslan-family',{},[1]),aslan:buildAslanOriginFixture({stage:'background'}),study:studyFixture(),officer:buildAslanOfficerFixture(),life:lifeFixture({row:3}),lawyer:lawyerFixture({cash:0}),partial};
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});const key='traveller-character-generator.v1',checks=[],errors=[];
const saved=p=>p.evaluate(k=>localStorage.getItem(k),key);
async function load(p,fixture){await p.evaluate(({key,raw})=>{if(raw)localStorage.setItem(key,raw);else localStorage.removeItem(key);},{key,raw:fixture?exportSession(fixture.session):null});await p.reload();await p.waitForFunction(()=>document.body.dataset.stage&&!document.querySelector('#export').disabled);}
async function blocked(p,button,{type,focus,detail,shot}){
 const raw=await saved(p),state=raw?project(JSON.parse(raw)).state:null;
 assert.equal(await button.isEnabled(),true);await button.click();
 const warning=p.locator('.required-action-warning:visible');await warning.waitFor();assert.match(await warning.innerText(),detail);
 const info=warning.getByRole('button',{name:"About Crow's assistance"});await info.click();if(await info.getAttribute('aria-haspopup')==='dialog'){await p.locator('#crow-introduction-dialog[open]').waitFor();await p.keyboard.press('Escape');assert.equal(await info.evaluate(n=>n===document.activeElement),true);}else{assert.equal(await info.getAttribute('aria-expanded'),'true');assert.match(await warning.locator('.crow-assistance-help').innerText(),/Your selections stay here/);await info.click();assert.equal(await info.getAttribute('aria-expanded'),'false');}assert.match(await warning.innerText(),detail);
 const title=await warning.locator('strong').innerText();await button.click();assert.equal(await warning.locator('strong').innerText(),title);
 assert.equal(await saved(p),raw);if(raw)assert.deepEqual(project(JSON.parse(await saved(p))).state,state);
 const target=p.locator(focus).first();assert.equal(await target.getAttribute('aria-invalid'),'true');assert.equal(await target.evaluate(n=>n===document.activeElement),true);
 assert.equal(await warning.getAttribute('role'),'alert');assert.ok((await target.getAttribute('aria-describedby')).includes(await warning.getAttribute('id')));
 if(await p.locator('dialog[open]').count())assert.equal(await warning.evaluate(n=>!!n.closest('dialog[open]')),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 if(shot)await p.screenshot({path:new URL(shot+'.png',out).pathname,fullPage:true});checks.push({type,shot,stable:true,atomic:true});
}
try{
 for(const width of [1440,390,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/${transport==='http'?'?api=local':''}`);await p.locator('#setup-form').waitFor();
  const shot=name=>transport==='static'&&width!==320?'required-action-'+name+'-'+width:undefined;
  const intro=p.locator('#crow-introduction'),introInfo=intro.getByRole('button',{name:"About Crow's assistance"});
  assert.match(await intro.innerText(),/CROW IS ASSISTING/);const introRaw=await saved(p);await introInfo.click();await p.locator('#crow-introduction-dialog[open]').waitFor();assert.match(await p.locator('#crow-introduction-dialog').innerText(),/Intellect Series 7.4/);assert.match(await p.locator('#crow-introduction-dialog').innerText(),/1078/);assert.match(await p.locator('#crow-introduction-dialog').innerText(),/1079/);assert.doesNotMatch(await p.locator('#crow-introduction-dialog').innerText(),/Flort|Wages of Sin/);
  if(shot('crow-info'))await p.screenshot({path:new URL(shot('crow-info')+'.png',out).pathname,fullPage:true});await p.keyboard.press('Escape');assert.equal(await introInfo.evaluate(n=>n===document.activeElement),true);assert.equal(await saved(p),introRaw);
  await p.locator('#setup-species').selectOption('aslan');await blocked(p,p.getByRole('button',{name:'Begin character',exact:true}),{type:'starting',focus:'#setup-gender',detail:/Choose Male or Female/,shot:shot('starting')});
  await p.locator('#setup-gender').selectOption('female');assert.equal(await p.locator('#setup-gender').getAttribute('aria-invalid'),null);await p.getByRole('button',{name:'Begin character',exact:true}).click();await p.locator('body[data-stage=statistics]').waitFor();
  for(const name of ['human','aezorgh','aslan']){
   await load(p,fixtures[name]);const accept=p.locator('#background-form [type=submit]'),required=fixtures[name].state.backgroundRemaining,boxes=p.locator('[name=skills]');
   await blocked(p,accept,{type:'skills-count-'+name,focus:'[name=skills]',detail:/Choose exactly/,shot:shot('skills-'+name)});
   for(let i=0;i<required;i++)await boxes.nth(i).check();const values=await boxes.evaluateAll(ns=>ns.filter(n=>n.checked).map(n=>n.value));
   if(name!=='aezorgh'&&await boxes.count()>required){await boxes.nth(required).check();const raw=await saved(p);await accept.click();assert.match(await p.locator('.required-action-warning:visible').innerText(),/remove 1/);assert.equal(await saved(p),raw);await boxes.nth(required).uncheck();}
   assert.deepEqual(await boxes.evaluateAll(ns=>ns.filter(n=>n.checked).map(n=>n.value)),values);
   await accept.click();await p.waitForFunction(()=>document.body.dataset.stage!=='background'&&!document.querySelector('#export').disabled);
  }
  await load(p,fixtures.family);await blocked(p,p.locator('#aslan-family-continue'),{type:'family-skill',focus:'[name=aslan-family-choice]',detail:/Choose one/,shot:shot('family')});await p.locator('[name=aslan-family-choice]').first().check();await p.locator('#aslan-family-continue').click();await p.waitForFunction(()=>document.body.dataset.stage==='aslan-birth-order');
  await load(p,fixtures.study);await blocked(p,p.locator('.education-study-continue'),{type:'study',focus:'#education-subject',detail:/study subject/,shot:shot('study')});
  await p.locator('#education-subject').selectOption('Science');await blocked(p,p.locator('.education-study-continue'),{type:'specialisation',focus:'#education-skill',detail:/specialisation/,shot:shot('specialisation')});await p.locator('#education-skill').fill('Science (physics)');await p.locator('.education-study-continue').click();await p.locator('.university-skill-retained').waitFor();
  await load(p,fixtures.partial);await blocked(p,p.locator('[data-action=accept-statistics]'),{type:'rolls',focus:'[data-physical-card=DEX]',detail:/all six valid raw dice/,shot:shot('rolls')});
  await p.locator('[data-physical-card=DEX]').click();await p.locator('[data-physical-stat=DEX]').fill('99');await p.locator('[data-physical-stat=DEX]').press('Enter');assert.match(await p.locator('.required-action-warning:visible').innerText(),/whole raw dice total from 2 to 12/);assert.equal(await saved(p),exportSession(fixtures.partial.session));
  await load(p,fixtures.officer);await blocked(p,p.locator('[data-action=begin-aslan-officer]'),{type:'career',focus:'[data-officer-assignment]',detail:/officer assignment/,shot:shot('career')});await p.locator('[data-officer-assignment]').selectOption({index:1});await p.locator('[data-action=begin-aslan-officer]').click();await p.waitForFunction(()=>!document.querySelector('[data-action=begin-aslan-officer]'));
  await load(p,fixtures.life);await blocked(p,p.locator('[data-action=resolve-life-event]'),{type:'event',focus:'#life-outcome',detail:/life event outcome/,shot:shot('event')});await p.locator('#life-outcome').selectOption('birth');await blocked(p,p.locator('[data-action=resolve-life-event]'),{type:'details',focus:'#life-reason',detail:/decision and its reason/,shot:shot('details')});await p.locator('#life-reason').fill('Original fixture decision.');await p.locator('#life-confirm').check();await p.locator('[data-action=resolve-life-event]').click();await p.locator('body[data-stage=advancement]').waitFor();
  await load(p,fixtures.lawyer);await p.locator('#lawyer-outcome').selectOption('hire');await p.locator('#lawyer-level').fill('0');await blocked(p,p.locator('[data-action=resolve-prisoner-lawyer]'),{type:'referee',focus:'#lawyer-zero',detail:/referee permits/,shot:shot('referee')});await p.locator('#lawyer-zero').check();await p.locator('#lawyer-reason').fill('Referee permits a novice at the formula price.');await p.locator('[data-action=resolve-prisoner-lawyer]').click();await p.locator('body[data-stage=advancement]').waitFor();
  // Affordability failures keep exact factual errors and never gain a playful warning.
  await load(p,fixtures.lawyer);await p.locator('#lawyer-outcome').selectOption('hire');await p.locator('#lawyer-level').fill('10');await p.locator('[data-action=resolve-prisoner-lawyer]').click();await p.locator('#message.error').waitFor();assert.equal(await p.locator('.required-action-warning:visible').count(),0);assert.equal(await saved(p),exportSession(fixtures.lawyer.session));
  if(transport==='http'){
   await load(p,fixtures.human);for(let i=0;i<fixtures.human.state.backgroundRemaining;i++)await p.locator('[name=skills]').nth(i).check();await p.route('**/api/v1',route=>route.request().postDataJSON().operation==='command'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Synthetic connection failure'}})}):route.continue());await p.locator('#background-form [type=submit]').click();await p.getByText('Synthetic connection failure',{exact:true}).waitFor();assert.equal(await p.locator('.required-action-warning:visible').count(),0);await p.unroute('**/api/v1');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('required-action-results.json',out),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.length+' required-action cases; static/HTTP at 1440,390,320; valid continuation, exact-count retention, atomicity, stable alerts, popup focus, affordability/network exclusions.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
