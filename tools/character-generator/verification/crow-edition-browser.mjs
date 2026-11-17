import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const out=fileURLToPath(new URL('./artifacts/crow-edition/',import.meta.url));await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

const key='traveller-character-generator.crow-edition.v0.1',base='http://127.0.0.1:'+server.address().port+'/';
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});try{
for(const mode of ['', '?api=local'])for(const width of [1440,390,320]){
 const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'crow-edition.html'+mode);await p.locator('#setup-form').waitFor();
 const fixture=await p.evaluate(async()=>{
  const {call}=await import('./gui/crow-edition-client.mjs');
  for(let i=0;i<30;i++){let r=await call({operation:'create',seed:'skills-browser-'+i}),n=0;
   const send=async(type,payload={})=>{r=await call({operation:'command',session:r.session,id:'fixture-'+(++n),expectedRevision:r.revision,command:{type,payload}});if(!r.ok)throw Error(r.error.message);};
   await send('setup',{species:'human',name:'University review',gender:'male'});await send('roll-statistics');await send('accept-statistics');await send('background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
   const before=r.session;await send('precareer',{id:'core.university'});if(r.state.stage==='education-skill')return {before,dice:r.educationResultView.dice};
  }throw Error('No success fixture');
 });
 if(width===1440){
  const reloadPage=await b.newPage();await reloadPage.goto(base+'crow-edition.html'+mode);
  await reloadPage.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture.before)),{key,fixture});await reloadPage.reload();
  await reloadPage.locator('[data-action=precareer][data-id="core.university"]').click();await reloadPage.locator('#precareer-admission-roll').click();
  await reloadPage.locator('[data-phase=rolling]').waitFor();await reloadPage.reload();await reloadPage.locator('.pilot-study-guidance').waitFor();
  assert.equal(await reloadPage.locator('[data-phase=rolling]').count(),0);
  assert.equal(await reloadPage.evaluate(k=>JSON.parse(localStorage.getItem(k)).events.filter(e=>e.command.type==='precareer').length,key),1);
  await reloadPage.close();
 }
 await p.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture.before));localStorage.setItem('traveller-character-generator.v1','ORIGINAL');},{key,fixture});await p.reload();await p.locator('[data-action=precareer][data-id="core.university"]').waitFor();
 if(!mode)await p.screenshot({path:out+'precareer-'+width+'.png',fullPage:true});
 await p.locator('[data-action=precareer][data-id="core.university"]').click();
 await p.locator('#precareer-admission-roll').evaluate(e=>{e.click();e.click();});
 await p.locator('[data-phase=rolling]').waitFor();assert.equal(await p.locator('#pilot-forward').isDisabled(),true);
 await p.locator('[data-phase=accepted]').waitFor();assert.equal(await p.locator('[data-recorded-dice]').getAttribute('data-recorded-dice'),fixture.dice.join(','));
 let saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(saved.events.filter(e=>e.command.type==='precareer').length,1);
 await p.locator('.pilot-study-guidance').waitFor();
 assert.equal(await p.locator('#education-subject').isVisible(),false);assert.equal(await p.locator('#education-skill').isVisible(),true);
 assert.match(await p.locator('.pilot-study-guidance').textContent(),/Two different subjects: first at level 0, second at level 1/);
 await p.locator('.pilot-study-guidance .pilot-message-controls button').last().click();assert.equal(await p.locator('.education-result-roll').isVisible(),true);
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);await p.locator('.pilot-study-guidance .pilot-message-controls button').first().click();
 if(!mode)await p.screenshot({path:out+'university-'+width+'.png',fullPage:true});
 await p.locator('#education-skill').fill('Animals (riding)');assert.equal(await p.locator('.education-study-continue').isDisabled(),true);
 await p.locator('#education-skill').fill('Science (xenobotany)');await p.locator('#precareer-dismiss').click();await p.waitForFunction(()=>document.getElementById('pilot-forward').disabled);await p.locator('#precareer-resume').click();assert.equal(await p.locator('#pilot-forward').isEnabled(),true);await p.locator('#pilot-forward').click();
 await p.waitForFunction(()=>document.querySelector('#university-skill-title-2')?.parentElement.querySelector('#education-skill'));
 assert.equal(await p.locator('#education-skills option[value^="Science"]').count(),0);
 await p.reload();await p.locator('#education-skill').waitFor();await p.locator('#education-skill').fill('Animals (training)');await p.locator('.education-study-continue').evaluate(e=>{e.click();e.click()});
 await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.filter(e=>e.command.type==='education-skill').length===2,key);
 saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);await p.reload();await p.waitForTimeout(300);
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 assert.equal(await p.locator('[data-action=education-event]:visible').count(),0);
 await p.locator('#pilot-back').click();await p.locator('[data-review-current]').click();
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 assert.equal(await p.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),'ORIGINAL');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 console.log('PASS',mode||'static',width);await p.close();
}}finally{await b.close();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exit(1)});
