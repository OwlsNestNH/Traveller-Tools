import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';import {exportSession,execute,project} from '../engine/session.mjs';import {checkpointFixtures} from './education-event-gui-fixtures.mjs';import {educationCheckpointModel,educationAppliedLines} from '../gui/education-event-checkpoint-view.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;const checks=[],errors=[];
const ready=p=>p.waitForFunction(()=>document.body.dataset.stage&&!document.querySelector('#export').disabled),saved=p=>p.evaluate(k=>localStorage.getItem(k),key);
async function verifyEvidence(p,model){
 const before=await saved(p),details=p.locator('.education-checkpoint-details'),summary=details.locator('summary');const hasDetail=(model.childRolls?.length??0)>0||[...(model.appliedChanges??[]),...(model.appliedStateChanges??[])].some(group=>group.changes?.length);assert.equal(await details.count(),hasDetail?1:0);if(!hasDetail){assert.deepEqual(await p.locator('[data-recorded-face]').evaluateAll(ns=>ns.map(n=>Number(n.dataset.recordedFace))),model.eventDice);assert.equal(await saved(p),before);return;}assert.ok(await summary.evaluate(el=>el.getBoundingClientRect().height>=44));await summary.click();assert.equal(await details.getAttribute('open'),'');assert.equal(await details.locator('[data-action]').count(),0);
 const rolls=model.childRolls??[],expected=rolls.length?[...rolls.at(-1).values,...model.eventDice,...rolls.slice(0,-1).flatMap(r=>r.values)]:model.eventDice;assert.deepEqual(await p.locator('[data-recorded-face]').evaluateAll(ns=>ns.map(n=>Number(n.dataset.recordedFace))),expected);assert.equal(await saved(p),before);await summary.click();assert.equal(await saved(p),before);await p.locator('#precareer-dialog').evaluate(el=>el.scrollTop=0);
}
async function capture(p,label){await p.locator('#precareer-dialog').evaluate(el=>el.scrollTop=0);await p.screenshot({path:fileURLToPath(new URL('education-checkpoint-'+label+'.png',out))});const needs=await p.locator('#precareer-dialog').evaluate(el=>el.scrollHeight>el.clientHeight+2);if(needs){await p.locator('#precareer-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await p.screenshot({path:fileURLToPath(new URL('education-checkpoint-'+label+'-continued.png',out))});await p.locator('#precareer-dialog').evaluate(el=>el.scrollTop=0);}}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const transport of ['static','http'])for(const width of [1499,390,320]){
  const context=await browser.newContext({viewport:{width,height:1049}}),p=await context.newPage(),engine=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.includes('/engine/'))engine.push(r.url());});
  try{await p.goto(origin+(transport==='http'?'/?api=local':''));await ready(p);
   for(const f of checkpointFixtures()){
    await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(f.result.session)});await p.reload();await ready(p);await p.locator('.education-checkpoint').waitFor();const before=await saved(p),model=educationCheckpointModel(f.result);assert.equal(await p.locator('#step-title').innerText(),'Pre-Career');assert.equal(await p.locator('#precareer-dismiss').innerText(),'Close');
    await verifyEvidence(p,model);for(const line of educationAppliedLines(model.appliedChanges,model.appliedStateChanges))assert.ok((await p.locator('.education-checkpoint').innerText()).includes(line));
    const count=model.mode==='roll'?(model.roll.dice==='2D'?2:1):model.mode==='existing-choice'?(model.row===10||!Object.hasOwn(f.result.state.character.stats,'PSI')?2:0):0;assert.equal(await p.locator('.education-pending-dice .aslan-family-mystery').count(),count);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await p.locator('#precareer-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await p.locator('#precareer-dismiss').click();await p.locator('#precareer-dialog').waitFor({state:'hidden'});assert.equal(await saved(p),before);await p.locator('#precareer-resume').click();await p.locator('#precareer-rules-open').click();assert.equal(await p.locator('#precareer-information [data-action]').count(),0);await p.locator('#precareer-information-close').click();assert.equal(await saved(p),before);await p.reload();await ready(p);await p.locator('.education-checkpoint').waitFor();assert.equal(await saved(p),before);
    if(width===1499&&model.mode==='roll')assert.ok(await p.locator('[data-action=roll-education-event-step]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Pending roll must be visible before scrolling on desktop');
    if(f.capture)await capture(p,f.label+'-'+transport+'-'+width);
    let command,button;
    if(model.mode==='roll'){command={type:'roll-education-event-step',payload:{pendingId:model.pendingId}};button=p.locator('[data-action=roll-education-event-step]');}
    else if(model.mode==='result'){command={type:'acknowledge-education-event',payload:{pendingId:model.pendingId}};button=p.locator('[data-action=acknowledge-education-event]');}
    else if(model.row===10){const select=p.locator('#education-check-skill');assert.equal(await select.inputValue(),'');await select.selectOption('Medic');command={type:'education-check',payload:{name:'Medic'}};button=p.locator('[data-action=education-check]');}
    else{command={type:'choose-effect',payload:{index:0}};button=p.locator('[data-action=choose-effect][data-index="0"]');}
    assert.ok(await button.evaluate(el=>el.getBoundingClientRect().height>=44));await button.evaluate(el=>{el.click();el.click();});await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).events.length===n+1&&!document.querySelector('#export').disabled,{key,n:f.result.session.events.length});const afterRaw=await saved(p),after=JSON.parse(afterRaw);assert.deepEqual(after.events.at(-1).command,command);assert.equal(afterRaw,exportSession(execute(f.result.session,command,{id:after.events.at(-1).id,expectedRevision:f.result.session.events.length}).session));if(model.mode==='result'){assert.equal(project(after).state.rng,f.result.state.rng);assert.deepEqual(project(after).state.character,f.result.state.character);}
    if(f.capture&&model.mode==='roll'){
     const afterModel=educationCheckpointModel(project(after));
     if(afterModel){await p.locator('.education-checkpoint').waitFor();await verifyEvidence(p,afterModel);assert.equal(await p.locator('.education-pending-dice .aslan-family-mystery').count(),afterModel.mode==='roll'?(afterModel.roll.dice==='2D'?2:1):0);await capture(p,f.label+'-after-'+transport+'-'+width);}
    }
    checks.push({transport,width,label:f.label});
   }
   if(transport==='http')assert.deepEqual(engine,[]);
  }catch(error){await p.screenshot({path:fileURLToPath(new URL('education-checkpoint-failure-'+transport+'-'+width+'.png',out)),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('education-checkpoint-browser.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
