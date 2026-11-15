import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {educationReady,forceEducation,command} from './education-result-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const key='traveller-character-generator.v1';
try{for(const id of ['core.academy-army','core.academy-marine','core.academy-navy'])for(const width of [1440,390])for(const success of [true,false])for(const legacy of [false,true]){
 let ready=educationReady(id),r;
 if(legacy){ready=command(ready,'gm-override',{field:'stat.SOC',value:success?40:0,reason:'Synthetic legacy boundary'});r=forceEducation(ready,'education-event',{},[2,6]);if(r.legacyPoliticalEventView.childRolls[0].check.success!==success)continue;}else {r=forceEducation(ready,'education-event',{separateAcademyPoliticalRoll:true},[2,6]);r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},success?[6,6]:[1,1]);}
 const raw=exportSession(r.session),context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key,raw});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/');
 await p.locator('.education-political-result').waitFor();
 assert.equal(await p.locator('[data-action="education-graduation"]').count(),0);
 assert.equal(await p.locator('.education-political-result .crow-speaking-panel').count(),1);
 assert.match(await p.locator('.education-political-result').innerText(),success?/Gain 1 Ally\. Gain 1 Enemy\./:/No Ally or Enemy gained\./);
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
 if(success){
 const inputs=p.locator('[data-education-relationship]');assert.equal(await inputs.count(),2);assert.equal(await inputs.first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 44, 61)');
 await inputs.nth(0).fill('Political ally');await inputs.nth(0).press('Tab');
 await p.waitForFunction(()=>!document.querySelector('#export').disabled&&JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.at(-1).command.type.includes('political-relationships')||!document.querySelector('#export').disabled&&JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.at(-1).command.type==='name-education-relationships');
 await inputs.nth(1).fill('Political enemy');await inputs.nth(1).press('Tab');
 await p.waitForFunction(()=>!document.querySelector('#export').disabled&&JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.at(-1).command.payload.names.some(n=>n.name==='Political enemy'));
 await p.reload();await p.locator('.education-political-result').waitFor();
 assert.equal(await inputs.nth(0).inputValue(),'Political ally');assert.equal(await inputs.nth(1).inputValue(),'Political enemy');
 r=project(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(r.state.character.relationships.length,2);
 assert.match(await p.locator('#precareer-rail').textContent(),/Political ally/);assert.match(await p.locator('#precareer-rail').textContent(),/Political enemy/);
 }
 if(id==='core.academy-army'&&!legacy)await p.screenshot({path:fileURLToPath(new URL('army-political-readable-'+(success?'success':'failure')+'-'+width+'.png',out)),fullPage:true});
 await p.locator('[data-action="'+(legacy?'acknowledge-legacy-political-event':'acknowledge-education-event')+'"]').click();await p.locator('[data-action="education-graduation"]').waitFor();
 assert.equal(await p.locator('.education-political-result').count(),0);
 const after=project(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(after.state.rng,r.state.rng);assert.deepEqual(after.state.character.relationships,r.state.character.relationships);if(!legacy)assert.deepEqual(after.state.character,r.state.character);
 if(id==='core.academy-army'&&success&&!legacy)await p.screenshot({path:fileURLToPath(new URL('army-graduation-separated-'+width+'.png',out)),fullPage:true});
 checks.push({id,width,success,legacy});await context.close();
}
for(const id of ['core.academy-army','core.academy-marine','core.academy-navy']){
 const ready=educationReady(id),raw=exportSession(ready.session),c=await browser.newContext();await c.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});const p=await c.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.locator('[data-action="education-event"]').click();await p.waitForFunction(()=>!document.querySelector('#export').disabled&&JSON.parse(localStorage.getItem('traveller-character-generator.v1')).events.at(-1).command.type==='education-event');const saved=JSON.parse(await p.evaluate(k=>localStorage.getItem(k),key));assert.deepEqual(saved.events.at(-1).command.payload,{separateAcademyWarRolls:true,separateAcademyPoliticalRoll:true});await c.close();checks.push({id,actualEventButton:true});
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));}finally{await browser.close();await new Promise(r=>server.close(r));}
