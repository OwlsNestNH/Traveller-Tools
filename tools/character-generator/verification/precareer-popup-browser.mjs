// Synthetic public-command fixtures only. Capture approved-screen pixels first.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {catalog,exportSession,execute,project,createSession} from '../engine/session.mjs';
import {assignmentSetup} from './assignment-fixtures.mjs';
import {educationEntryCheck} from '../engine/education-pack.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1';await mkdir(out,{recursive:true});
const fixture=assignmentSetup('approved-precareer-synthetic'),raw=exportSession(fixture.session),choices=catalog().precareers;
assert.equal(fixture.state.stage,'precareer');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],checks=[];
const coreChoice=(p,id='core.university')=>p.locator('[data-action=precareer][data-id="'+id+'"]');
const admission=p=>p.locator('#precareer-admission');
async function openAdmission(p,id='core.university'){await coreChoice(p,id).click();await admission(p).waitFor();}
function speciesFixture(species,physical=false){
 let session=createSession('admission-'+species);
 for(const command of [{type:'setup',payload:{species}},...(physical?[{type:'gm-physical-dice',payload:{enabled:true}},...['STR','DEX','END','INT','EDU','SOC'].map(code=>({type:'enter-physical-statistic',payload:{code,value:8}}))]:[{type:'roll-statistics'}]),{type:'accept-statistics'}])session=execute(session,command).session;
 const state=project(session).state;session=execute(session,{type:'background',payload:{skills:state.backgroundOptions.slice(0,state.backgroundRemaining)}}).session;
 assert.equal(project(session).state.stage,'precareer');return session;
}

const ready=p=>p.waitForFunction(()=>document.body.dataset.stage&&!document.querySelector('#export').disabled);
const saved=p=>p.evaluate(k=>localStorage.getItem(k),key);
async function shot(p,label){await p.mouse.move(0,0);await p.screenshot({path:fileURLToPath(new URL('precareer-popup-'+label+'.png',out)),fullPage:false});}
async function fit(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(await p.locator('#precareer-dialog[open],#precareer-information[open]').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.id)),[]);}
async function dismiss(p){if(await p.locator('#precareer-dialog').evaluate(el=>el.open))await p.locator('#precareer-dismiss').click();await p.locator('#precareer-dialog').waitFor({state:'hidden'});}
async function resume(p){await p.locator('#precareer-resume').click();await p.locator('#precareer-dialog').waitFor();}
async function bar(p,id){const d=p.locator('#'+id);if(!await d.evaluate(el=>el.open))await d.locator(':scope > summary').click();await p.waitForFunction(id=>document.querySelector('#'+id).open,id);}
async function closeInfo(p){await p.locator('#precareer-information-close').click();await p.locator('#precareer-information').waitFor({state:'hidden'});}
async function load(p,session=fixture.session){await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(session)});await p.reload();await ready(p);}
try{
 // Screenshot pass comes first so failed later regressions still leave review artifacts.
 for(const width of [1499,390,320]){
  const context=await browser.newContext({viewport:{width,height:1049}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin);await ready(p);await load(p);await p.evaluate(()=>scrollTo(0,0));await shot(p,'standard-'+width);await fit(p);
   await openAdmission(p);await p.evaluate(()=>scrollTo(0,0));await shot(p,'admission-'+width);await fit(p);assert.ok(await p.locator('.admission-formula').evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)+1),'Admission formula must remain on one line');if(width===1499){assert.ok(await p.locator('#precareer-dialog').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Desktop admission panel must fit the review viewport');assert.equal(await p.locator('.admission-source').evaluate(el=>getComputedStyle(el).borderLeftWidth),'0px');}await p.locator('#precareer-admission-back').click();
   await p.locator('#precareer-additional').click();await shot(p,'additional-'+width);await fit(p);await p.locator('#precareer-options-back').click();
   await p.locator('#precareer-rules-open').click();await shot(p,'rules-'+width);await closeInfo(p);
   await dismiss(p);await p.locator('#precareer-previous').click();await shot(p,'previous-readonly-'+width);await closeInfo(p);await shot(p,'cancelled-'+width);
   await bar(p,'precareer-skills');await shot(p,'right-skills-'+width);await resume(p);await shot(p,'restored-'+width);
  }finally{await context.close();}
 }
 console.log('Approved Pre-Career review screenshots captured at 1499, 390 and 320px.');
 for(const transport of ['static','http'])for(const width of [1499,390,320]){
  const context=await browser.newContext({viewport:{width,height:1049}}),p=await context.newPage(),label=transport+'-'+width,commands=[],engineRequests=[];
  p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));p.on('request',r=>{if(new URL(r.url()).pathname.includes('/engine/'))engineRequests.push(r.url());if(r.url().endsWith('/api/v1')){const body=r.postDataJSON();if(body?.operation==='command'||body?.operation==='create')commands.push(body);}});
  try{
   await p.goto(origin+(transport==='http'?'/?api=local':'/'));await ready(p);await load(p);const before=await saved(p),baseline=commands.length;
   assert.equal(await p.locator('#step-title').textContent(),'Pre-Career');assert.equal(await p.locator('header h1').textContent(),'CHARACTER BUILDER');
   assert.deepEqual(await p.locator('#precareer-standard [data-action=precareer]').evaluateAll(ns=>ns.map(n=>n.dataset.id)),choices.filter(x=>x.source==='core').map(x=>x.id));
   assert.equal(await p.locator('#precareer-standard .precareer-art').count(),4);assert.equal(await p.locator('#precareer-extras').isVisible(),false);assert.equal(await p.locator('#cancel-character').count(),0);
   for(const selector of ['#export','#import','#print','#simple-log-view','#log-view','#log-download','#new'])assert.equal(await p.locator(selector).isEnabled(),true);
   assert.deepEqual(await p.locator('.log-switch>.opening-info-trigger').evaluate(el=>{const s=getComputedStyle(el);return [s.width,s.height,s.borderTopWidth,s.borderRadius];}),['28px','28px','1px','50%']);
   await p.locator('#precareer-additional').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#precareer-standard').isVisible(),false);assert.equal(await p.locator('#precareer-extras').isVisible(),true);
   assert.deepEqual(await p.locator('#precareer-extras [data-action=precareer]').evaluateAll(ns=>ns.map(n=>n.dataset.id)),choices.filter(x=>x.source==='companion').map(x=>x.id));assert.equal(await p.locator('#step-title').textContent(),'Additional Careers');
   assert.equal(await p.locator('[data-action=skip-precareer]').isVisible(),false);assert.equal(await p.locator('#precareer-result-open').isVisible(),false);assert.equal(await p.locator('#precareer-rules-open').isVisible(),true);assert.equal(await p.locator('#precareer-dismiss').isVisible(),true);
   assert.equal((await p.locator('#precareer-options-back').innerText()).trim(),'← Back to Pre-Career');
   await p.locator('#precareer-rules-open').click();assert.equal(await p.locator('#precareer-information-title').textContent(),'Education rules and sources');await closeInfo(p);assert.equal(await p.locator('#precareer-extras').isVisible(),true);assert.equal(await p.evaluate(()=>document.activeElement.id),'precareer-rules-open');assert.equal(await saved(p),before);
   await p.locator('#precareer-options-back').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'step-title');assert.equal(await saved(p),before);
   assert.equal(await p.locator('[data-action=skip-precareer]').isVisible(),true);assert.equal(await p.locator('#precareer-result-open').isVisible(),true);assert.equal(await p.locator('#precareer-rules-open').isVisible(),true);assert.equal(await p.locator('#precareer-options-back').isVisible(),false);
   for(const [trigger,title] of [['#precareer-result-open','Previous result'],['#precareer-rules-open','Education rules and sources']]){
    await p.locator(trigger).click();assert.equal(await p.locator('#precareer-information-title').textContent(),title);assert.equal(await p.locator('#precareer-information').evaluate(el=>el.matches(':modal')),true);
    assert.equal(await p.locator('#precareer-information [data-action],#precareer-information input,#precareer-information select,#precareer-information textarea').count(),0);
    await p.keyboard.press('Escape');await p.locator('#precareer-information').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>document.activeElement.id),trigger.slice(1));assert.equal(await saved(p),before);
   }
   await dismiss(p);assert.equal(await p.locator('#cancel-character-dialog').isVisible(),false);assert.equal(await p.evaluate(()=>document.activeElement.id),'precareer-resume');assert.equal(await saved(p),before);
   await p.locator('#precareer-previous').click();assert.match(await p.locator('#precareer-information-previous').innerText(),/Read only|Read-only/i);assert.match(await p.locator('#precareer-information-previous').innerText(),/Background skills/);
   for(const skill of fixture.session.events.at(-1).command.payload.skills)assert.ok((await p.locator('#precareer-information-previous').innerText()).includes(skill));await closeInfo(p);
   for(const id of ['precareer-characteristics','precareer-skills','precareer-notes','precareer-more-record','precareer-skills']){
    await bar(p,id);if(id==='precareer-more-record')assert.equal(await p.locator('#precareer-more-record .sheet-meta').count(),1);assert.deepEqual(await p.locator('#sheet>details[data-precareer-bar][open]').evaluateAll(ns=>ns.map(n=>n.id)),[id]);await fit(p);
   }
   const skillsBar=p.locator('#precareer-skills');await skillsBar.locator(':scope > summary').focus();await p.keyboard.press('Enter');assert.equal(await skillsBar.evaluate(el=>el.open),false);await p.keyboard.press('Space');assert.equal(await skillsBar.evaluate(el=>el.open),true);
   assert.equal(await saved(p),before);assert.equal(commands.length,baseline,'presentation controls must not submit commands');
   await resume(p);await p.locator('#step-title').focus();await p.keyboard.press('Escape');await p.locator('#precareer-dialog').waitFor({state:'hidden'});assert.equal(await saved(p),before);await resume(p);
   await p.locator('#log-view').click();await p.locator('#full-action-log').waitFor();await p.keyboard.press('Escape');assert.equal(await saved(p),before);
   await p.emulateMedia({media:'print'});assert.equal(await p.locator('#precareer-dialog').isVisible(),false);assert.equal(await p.locator('#sheet').isVisible(),true);assert.equal(await p.locator('#sheet').evaluate(el=>getComputedStyle(el).color),'rgb(21, 44, 66)');await p.emulateMedia({media:'screen'});
   await dismiss(p);await bar(p,'precareer-notes');await p.locator('#character-notes').fill('Synthetic saved note <img src=x>');await resume(p);await p.locator('#precareer-additional').click();await dismiss(p);assert.equal(await saved(p),before);assert.equal(await p.locator('#character-notes').inputValue(),'Synthetic saved note <img src=x>');await bar(p,'precareer-notes');await p.locator('[data-action=save-notes]').click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.at(-1).command.type==='notes',key);await ready(p);assert.equal(await p.locator('#precareer-dialog').isVisible(),false,'saving a sidebar edit must preserve dismissed popup');
   await dismiss(p);await p.locator('#precareer-previous').click();assert.match(await p.locator('#precareer-information-previous').innerText(),/Background skills/,'notes are not the previous generation step');assert.equal(await p.locator('#precareer-information img,#precareer-information script').count(),0);await closeInfo(p);
   const afterNotes=await saved(p);await p.reload();await ready(p);assert.equal(await saved(p),afterNotes);assert.equal(await p.locator('#precareer-standard').isVisible(),true);
   await p.locator('[data-action=skip-precareer]').evaluate(el=>{el.click();el.click();});await p.locator('body[data-stage=career]').waitFor();await ready(p);
   const afterSkip=JSON.parse(await saved(p));assert.equal(afterSkip.events.length,JSON.parse(afterNotes).events.length+1);assert.equal(afterSkip.events.at(-1).command.type,'skip-precareer');
   assert.equal(await p.locator('#precareer-dialog,#precareer-context,#precareer-information').count(),0);assert.equal(await p.locator('header h1').textContent(),'A life among the stars');assert.equal(await p.locator('body').evaluate(el=>getComputedStyle(el).colorScheme),'light');assert.equal(await p.locator('#cancel-character').count(),1);
   // Admission is presentation only until the player explicitly presses the dice button.
   await load(p);const previewBefore=await saved(p),previewCommands=commands.length;
   await coreChoice(p).focus();await p.keyboard.press('Enter');await admission(p).waitFor();
   assert.equal(await saved(p),previewBefore);assert.equal(await p.locator('#step-title').textContent(),'Pre-Career');
   assert.match(await admission(p).innerText(),/Admission target: 6\+/);assert.match(await admission(p).innerText(),/EDU 8/);
   for(const selector of ['#precareer-admission-roll','#precareer-admission-back','#precareer-dismiss']){
    assert.ok((await p.locator(selector).boundingBox()).height>=44,selector+' must retain a 44px target');
   }
   await fit(p);await p.locator('#precareer-rules-open').click();await closeInfo(p);assert.equal(await admission(p).isVisible(),true);
   await p.locator('#precareer-admission-back').click();assert.equal(await p.locator('#precareer-standard').isVisible(),true);assert.equal(await coreChoice(p).evaluate(el=>el===document.activeElement),true);assert.equal(await saved(p),previewBefore);
   await openAdmission(p);await dismiss(p);assert.equal(await saved(p),previewBefore);await resume(p);assert.equal(await admission(p).isVisible(),true);
   await p.locator('#step-title').focus();await p.keyboard.press('Escape');await p.locator('#precareer-dialog').waitFor({state:'hidden'});await resume(p);assert.equal(await admission(p).isVisible(),true);
   assert.equal(commands.length,previewCommands);assert.equal(await saved(p),previewBefore);
   await p.reload();await ready(p);assert.equal(await p.locator('#precareer-standard').isVisible(),true);assert.equal(await saved(p),previewBefore);
   // Sheet edits rerender the preview with current modifiers, without making an entry attempt.
   await openAdmission(p);await dismiss(p);await bar(p,'precareer-characteristics');await p.locator('#stat-edit-sheet-EDU').click();
   await p.locator('#statistic-editor-value').fill('12');await p.locator('#statistic-editor-reason').fill('Synthetic admission preview update');await p.locator('#statistic-editor-save').click();
   await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.at(-1).command.type==='gm-override',key);await ready(p);
   assert.equal(await p.locator('#precareer-dialog').isVisible(),false);await resume(p);assert.match(await admission(p).innerText(),/EDU 12/);
   const edited=JSON.parse(await saved(p));assert.deepEqual(project(edited).state.educationAttemptTerms??[],[]);assert.equal(edited.events.length,fixture.session.events.length+1);
   await dismiss(p);await bar(p,'precareer-notes');await p.locator('#character-notes').fill('Admission preview note');await p.locator('[data-action=save-notes]').click();
   await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events.at(-1).command.type==='notes',key);await ready(p);await resume(p);assert.match(await admission(p).innerText(),/EDU 12/);
   const editedWithNotes=JSON.parse(await saved(p));await p.locator('#precareer-admission-roll').click();
   await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n:editedWithNotes.events.length});
   assert.deepEqual(project(JSON.parse(await saved(p))).state,execute(editedWithNotes,{type:'precareer',payload:{id:'core.university'}}).state);
   // Each choice retains exact public-command behavior; no presentation shortcut grants admission.
   for(const choice of choices){
    await load(p);if(choice.source==='companion')await p.locator('#precareer-additional').click();
    const expected=execute(fixture.session,{type:'precareer',payload:{id:choice.id}});
    await p.locator('[data-action=precareer][data-id="'+choice.id+'"]').evaluate(el=>{el.click();el.click();});
    if(choice.source==='core'){
     assert.equal(await saved(p),exportSession(fixture.session),'opening Core preview must not consume RNG, attempts or history');
     assert.equal(await p.locator('#step-title').textContent(),'Pre-Career');
     assert.equal(await admission(p).isVisible(),true);
     assert.match(await admission(p).innerText(),/You choose when to roll/);
     const rule=educationEntryCheck({id:choice.id,term:1,stats:fixture.state.character.stats,roll:2}),text=await admission(p).innerText();
     assert.ok(text.includes('Admission target: '+rule.target+'+'));assert.ok(text.includes(rule.stat+' '+fixture.state.character.stats[rule.stat]));
     if(choice.id==='core.university')assert.ok(text.includes('SOC bonus: '+(rule.thresholdModifier>=0?'+':'')+rule.thresholdModifier));else assert.ok(!text.includes('SOC bonus:'));
     assert.match(text,/Core Rulebook/);
     await p.locator('#precareer-admission-roll').evaluate(el=>{el.click();el.click();});
    }
    await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n:fixture.session.events.length});
    const actual=JSON.parse(await saved(p));assert.deepEqual(actual.events.at(-1).command,{type:'precareer',payload:{id:choice.id}});assert.deepEqual(project(actual).state,expected.state);
   }
   // Physical entry remains an existing statistics option, not a new admission rule.
   const physical=speciesFixture('human',true);
   for(const [kind,session] of [['physical-dice',physical],['native-vargr',speciesFixture('vargr')],['aezorgh',speciesFixture('aezorgh')]]){
    await load(p,session);const old=await saved(p);await openAdmission(p);assert.equal(await saved(p),old);
    if(kind!=='physical-dice'){
     assert.match(await admission(p).innerText(),/source.assisted/i);
     assert.doesNotMatch(await p.locator('#precareer-admission-roll').innerText(),/Roll for Admission/i);
    }
    await p.locator('#precareer-admission-back').click();assert.equal(await saved(p),old);await openAdmission(p);
    await p.locator('#precareer-admission-roll').evaluate(el=>{el.click();el.click();});
    await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n:session.events.length});
    const actual=JSON.parse(await saved(p)),expected=execute(session,{type:'precareer',payload:{id:'core.university'}});assert.deepEqual(project(actual).state,expected.state);
    if(kind!=='physical-dice'){assert.equal(project(actual).state.stage,'book-step');assert.equal(project(actual).log.at(-1).rolls.length,0);}
   }
   if(transport==='http')assert.deepEqual(engineRequests,[],'HTTP preview must not download engine modules');
   const diverged=execute(fixture.session,{type:'skip-precareer'}).session,restored=execute(diverged,{type:'restore',payload:{revision:fixture.session.events.length}}).session;await load(p,restored);const restoredRaw=await saved(p);await dismiss(p);await p.locator('#precareer-previous').click();assert.match(await p.locator('#precareer-information-previous').innerText(),/Background skills/);await closeInfo(p);assert.equal(await saved(p),restoredRaw);
   checks.push(label+' choices/navigation/cancel/back/read-only/accordion/notes/print/scope/repeated-command');
  }catch(error){await shot(p,'failure-'+label).catch(()=>{});throw error;}finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('precareer-popup-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){await writeFile(new URL('precareer-popup-failure.json',out),JSON.stringify({checks,errors,error:error.message,stack:error.stack},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
