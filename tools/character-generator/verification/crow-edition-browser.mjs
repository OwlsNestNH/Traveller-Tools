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
 const makeFixture=success=>p.evaluate(async success=>{
  const {call}=await import('./gui/crow-edition-client.mjs');
  for(let i=0;i<30;i++){let r=await call({operation:'create',seed:'skills-browser-'+i}),n=0;
   const send=async(type,payload={})=>{r=await call({operation:'command',session:r.session,id:'fixture-'+(++n),expectedRevision:r.revision,command:{type,payload}});if(!r.ok)throw Error(r.error.message);};
   await send('setup',{species:'human',name:'University review',gender:'male'});await send('roll-statistics');const statistics=r.session;await send('accept-statistics');const background=r.session;await send('background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
   const before=r.session;await send('precareer',{id:'core.university'});if((r.state.stage==='education-skill')===success)return {before,after:r.session,statistics,background,dice:r.educationResultView.dice};
  }throw Error('No admission fixture');
 },success);
 const fixture=await makeFixture(true);
 const early=await b.newPage({viewport:{width,height:1000}});await early.goto(base+'crow-edition.html'+mode);await early.locator('#setup-form').waitFor();
 const aligned=async page=>{if(width===1440){const left=await page.locator('#workspace').boundingBox(),right=await page.locator(await page.locator('#background-rail').count()?'#background-rail':'#sheet').boundingBox();assert.ok(Math.abs(left.height-right.height)<1,'Record column matches workspace: '+await page.locator('body').getAttribute('data-stage')+' '+JSON.stringify({left,right}));}};await aligned(early);
 for(const stage of ['statistics','background']){
  await early.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:fixture[stage]});await early.reload();await early.locator('#workspace>.crow-speaking-panel').waitFor();await aligned(early);
  const readable=await early.locator('#workspace>.crow-speaking-panel blockquote').first().evaluate(e=>{
   const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const surfaces=[[13,48,66],[7,30,45]].map(rgb=>rgb.map((v,i)=>v*.92+[255,211,75][i]*.08));
   return [...e.querySelectorAll('p,strong')].every(el=>{const rgb=getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number);return surfaces.every(bg=>(Math.max(lum(rgb),lum(bg))+.05)/(Math.min(lum(rgb),lum(bg))+.05)>=4.5);});
  });assert.equal(readable,true,'Neutral dialogue contrast meets 4.5:1');
  assert.equal(await early.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(!mode)await early.screenshot({path:out+'patina-'+stage+'-'+width+'.png',fullPage:true});
 }
 await early.close();
 if(width===1440&&!mode){
  const failure=await makeFixture(false),failed=await b.newPage();await failed.goto(base+'crow-edition.html');
  await failed.evaluate(({key,failure})=>localStorage.setItem(key,JSON.stringify(failure.before)),{key,failure});await failed.reload();
  await failed.locator('[data-action=precareer][data-id="core.university"]').click();await failed.locator('#precareer-admission-roll').evaluate(e=>{e.click();e.click();});
  await failed.locator('[data-phase=accepted]').waitFor({state:'attached'});assert.equal(await failed.locator('[data-recorded-dice]').getAttribute('data-recorded-dice'),failure.dice.join(','));
  await failed.locator('.pilot-admission-boundary').waitFor();assert.deepEqual(await failed.locator('.education-result-roll svg').evaluateAll(es=>es.map(e=>e.querySelectorAll('circle').length)),failure.dice);
  assert.equal(await failed.locator('.education-result-tagline .pilot-message-region blockquote').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(48, 10, 18)');
  await failed.screenshot({path:out+'failure.png',fullPage:true});const beforeReload=await failed.evaluate(k=>localStorage.getItem(k),key);await failed.reload();await failed.locator('.pilot-admission-boundary').waitFor();assert.equal(await failed.evaluate(k=>localStorage.getItem(k),key),beforeReload);await failed.close();

  const original=await b.newPage({viewport:{width,height:1000}});await original.goto(base);
  await original.evaluate(session=>localStorage.setItem('traveller-character-generator.v1',JSON.stringify(session)),fixture.after);await original.reload();await original.locator('.education-result-study').waitFor();
  await original.screenshot({path:out+'original-university.png',fullPage:true});await original.close();
 }
 if(width===1440){
  const reloadPage=await b.newPage();await reloadPage.goto(base+'crow-edition.html'+mode);
  await reloadPage.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture.before)),{key,fixture});await reloadPage.reload();
  await reloadPage.locator('[data-action=precareer][data-id="core.university"]').click();await reloadPage.locator('#precareer-admission-roll').click();
  await reloadPage.locator('[data-phase=rolling]').waitFor({state:'attached'});await reloadPage.reload();await reloadPage.locator('.pilot-study-guidance').waitFor();
  assert.equal(await reloadPage.locator('[data-phase=rolling]').count(),0);
  assert.equal(await reloadPage.evaluate(k=>JSON.parse(localStorage.getItem(k)).events.filter(e=>e.command.type==='precareer').length,key),1);
  await reloadPage.close();
  const reduced=await b.newPage({reducedMotion:'reduce'});await reduced.goto(base+'crow-edition.html'+mode);await reduced.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture.before)),{key,fixture});await reduced.reload();
  await reduced.locator('[data-action=precareer][data-id="core.university"]').click();await reduced.locator('#precareer-admission-roll').click();await reduced.locator('[data-phase=accepted]').waitFor({state:'attached'});assert.equal(await reduced.locator('[data-recorded-dice]').getAttribute('data-recorded-dice'),fixture.dice.join(','));await reduced.locator('.pilot-study-guidance').waitFor();await reduced.close();
 }
 if(width===1440&&mode){
  const pairPage=await b.newPage();await pairPage.goto(base+'crow-edition.html'+mode);
  await pairPage.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture.after)),{key,fixture});await pairPage.reload();
  const draft=await pairPage.evaluate(k=>localStorage.getItem(k),key);
  const fillPair=async()=>{await pairPage.locator('#pilot-education-choice-2').selectOption('Animals (training)');await pairPage.locator('#pilot-education-choice').selectOption('__custom:Science');await pairPage.locator('#education-skill').fill('Science (physics)');};await fillPair();
  let requests=0;
  await pairPage.route('**/api/v1',async route=>{const q=route.request().postDataJSON();if(q.operation==='command'&&q.command?.type==='education-skill'&&++requests===2)return route.fulfill({json:{ok:false,error:{message:'Simulated second subject interruption'}}});return route.continue();});
  await pairPage.locator('.education-study-continue').click();await pairPage.locator('#crow-error-detail').waitFor();assert.equal(await pairPage.locator('#crow-error-detail').textContent(),'Simulated second subject interruption');await pairPage.locator('#crow-error-close').click();
  assert.equal(await pairPage.evaluate(k=>localStorage.getItem(k),key),draft);assert.equal(await pairPage.locator('#pilot-education-choice-2').inputValue(),'Animals (training)');
  await pairPage.unrouteAll();let release;const held=new Promise(resolve=>{release=resolve;});let reached;const secondReached=new Promise(resolve=>{reached=resolve;});requests=0;
  await pairPage.route('**/api/v1',async route=>{const q=route.request().postDataJSON();if(q.operation==='command'&&q.command?.type==='education-skill'&&++requests===2){reached();await held;return route.abort().catch(()=>{});}return route.continue();});
  await pairPage.locator('.education-study-continue').click();await secondReached;assert.equal(await pairPage.evaluate(k=>localStorage.getItem(k),key),draft);
  const reload=pairPage.reload();release();await reload;await pairPage.unrouteAll();await pairPage.locator('#pilot-education-choice-2').waitFor();assert.equal(await pairPage.evaluate(k=>localStorage.getItem(k),key),draft);
  await fillPair();await pairPage.locator('.education-study-continue').click();await pairPage.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.filter(e=>e.command.type==='education-skill').length===2,key);await pairPage.close();
 }
 await p.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture.before));localStorage.setItem('traveller-character-generator.v1','ORIGINAL');},{key,fixture});await p.reload();await p.locator('[data-action=precareer][data-id="core.university"]').waitFor();
 assert.equal(await p.locator('#precareer-standard .precareer-intro').textContent(),'Option to attempt a Pre-Career?');
 const neutral=await p.locator('#precareer-standard .pilot-message-region blockquote').first().evaluate(e=>({fill:getComputedStyle(e).backgroundImage,radius:getComputedStyle(e).borderRadius,tail:getComputedStyle(e,'::before').content}));assert.match(neutral.fill,/rgba\(255, 211, 75, 0.08\)/);assert.match(neutral.fill,/rgb\(13, 48, 66\), rgb\(7, 30, 45\)/);assert.equal(neutral.radius,'12px');assert.equal(neutral.tail,'none');
 if(width===1440){const left=await p.locator('#precareer-dialog').boundingBox(),right=await p.locator('#precareer-rail').boundingBox();assert.ok(Math.abs(left.height-right.height)<1,'Pre-career columns align');}
 if(!mode)await p.screenshot({path:out+'precareer-'+width+'.png',fullPage:true});
 await p.locator('[data-action=precareer][data-id="core.university"]').click();
 assert.equal(await p.locator('.pilot-admission-boundary').count(),0);
 const beforeDice=await p.locator('.education-pending-dice svg').first().boundingBox();
 const beforeHeading=await p.locator('#precareer-admission .education-result-heading').textContent();
 if(!mode)await p.screenshot({path:out+'pending-'+width+'.png',fullPage:true});
 await p.locator('#precareer-admission-roll').evaluate(e=>{e.click();e.click();});
 await p.locator('[data-phase=rolling]').waitFor({state:'attached'});assert.equal(await p.locator('#pilot-forward').isDisabled(),true);
 const moving=await p.locator('.education-pending-dice svg').first().boundingBox();assert.equal(moving.x,beforeDice.x);assert.equal(moving.y,beforeDice.y);
 assert.equal(await p.locator('.education-pending-dice svg').first().evaluate(e=>getComputedStyle(e).transform),'none');
 await p.locator('[data-phase=accepted]').waitFor({state:'attached'});assert.equal(await p.locator('[data-recorded-dice]').getAttribute('data-recorded-dice'),fixture.dice.join(','));
 assert.deepEqual(await p.locator('[data-phase=accepted] svg').evaluateAll(es=>es.map(e=>e.querySelectorAll('circle').length)),fixture.dice);
 const acceptedDice=await p.locator('[data-phase=accepted] svg').first().boundingBox();assert.equal(acceptedDice.width,beforeDice.width);assert.equal(acceptedDice.x,beforeDice.x);assert.equal(acceptedDice.y,beforeDice.y);
 let saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(saved.events.filter(e=>e.command.type==='precareer').length,1);
 await p.locator('.pilot-study-guidance').waitFor();assert.equal(await p.locator('.education-result:not(#precareer-admission) > .education-result-heading').textContent(),beforeHeading);assert.equal((await p.locator('.education-result-roll svg').first().boundingBox()).width,beforeDice.width);
 assert.equal(await p.locator('#education-subject').isVisible(),false);assert.equal(await p.locator('#pilot-education-choice').isVisible(),true);assert.equal(await p.locator('#education-skill').isVisible(),false);
 assert.equal(await p.locator('.education-result-roll').isVisible(),true);assert.deepEqual(await p.locator('.education-result-roll svg').evaluateAll(es=>es.map(e=>e.querySelectorAll('circle').length)),fixture.dice);
 assert.match(await p.locator('.pilot-study-guidance').textContent(),/Two different subjects: first at level 0, second at level 1/);
 const choiceY=(await p.locator('#pilot-education-choice').boundingBox()).y;
 await p.locator('.pilot-study-guidance .pilot-message-controls button').last().click();assert.equal((await p.locator('#pilot-education-choice').boundingBox()).y,choiceY);assert.equal(await p.locator('.education-result-roll').isVisible(),true);
 const expanded=await p.locator('.pilot-study-guidance .pilot-message-region blockquote').last().evaluate(e=>{const before=e.parentElement.getBoundingClientRect().height,extra=document.createElement('p');extra.textContent='Long source explanation. '.repeat(80);e.append(extra);const after=e.parentElement.getBoundingClientRect().height,uncropped=e.scrollHeight<=e.clientHeight+1;extra.remove();return {before,after,uncropped};});assert.ok(expanded.after>expanded.before);assert.equal(expanded.uncropped,true);
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);await p.locator('.pilot-study-guidance .pilot-message-controls button').first().click();
 if(!mode)await p.screenshot({path:out+'university-'+width+'.png',fullPage:true});
 assert.equal(await p.locator('#pilot-education-choice option[value="Animals (riding)"]').count(),0);
 assert.equal(await p.locator('#pilot-education-choice option[value="__custom:Animals"]').count(),0);
 await p.locator('#pilot-education-choice').selectOption('__custom:Science');assert.equal(await p.locator('#pilot-education-choice').isVisible(),false);
 await p.locator('.pilot-skill-list').first().click();assert.equal(await p.locator('#pilot-forward').isDisabled(),true);
 await p.locator('#pilot-education-choice-2').selectOption('Animals (training)');
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 await p.locator('#pilot-education-choice').selectOption('Animals (veterinary)');assert.equal(await p.locator('#pilot-forward').isDisabled(),true);
 await p.locator('#pilot-education-choice').selectOption('__custom:Science');await p.locator('#education-skill').fill('Science (xenobotany)');
 await p.locator('#precareer-dismiss').click();await p.waitForFunction(()=>document.getElementById('pilot-forward').disabled);await p.locator('#precareer-resume').click();
 assert.equal(await p.locator('#pilot-education-choice-2').inputValue(),'Animals (training)');assert.equal(await p.locator('#pilot-forward').isEnabled(),true);
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 assert.equal(await p.locator('.education-study-continue').textContent(),'Confirm both subjects');
 await p.locator('.education-study-continue').evaluate(e=>{e.click();e.click()});
 await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.filter(e=>e.command.type==='education-skill').length===2,key);
 saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);await p.reload();await p.locator('.pilot-skills-boundary').waitFor();
 assert.equal(await p.locator('body').getAttribute('data-support-shell'),'true');assert.equal(await p.locator('body').evaluate(e=>getComputedStyle(e).colorScheme),'dark');
 if(width===1440){const left=await p.locator('#workspace').boundingBox(),right=await p.locator('#sheet').boundingBox();assert.ok(Math.abs(left.height-right.height)<1,'Stop-screen columns align');}
 if(!mode)await p.screenshot({path:out+'stop-'+width+'.png',fullPage:true});
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 assert.equal(await p.locator('[data-action=education-event]:visible').count(),0);
 await p.locator('#pilot-back').click();await p.locator('[data-review-current]').click();
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved);
 assert.equal(await p.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),'ORIGINAL');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 console.log('PASS',mode||'static',width);await p.close();
}}finally{await b.close();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exit(1)});
