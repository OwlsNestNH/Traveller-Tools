import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {qualificationFixture} from './qualification-fallback-fixtures.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright'),key='traveller-character-generator.v1',fixture=qualificationFixture(),raw=exportSession(fixture.session),errors=[],checks=[];
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390,320])for(const api of [false,true])for(const assignment of ['barbarian','wanderer','scavenger']){
 const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key,raw});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+(api?'/?api=local':'/'));
 await p.getByRole('button',{name:'Enter Drifter',exact:true}).click();await p.locator('#army-career-dialog[open]').waitFor();assert.equal(await p.locator('[data-action="confirm-drifter-fallback"]').isDisabled(),true);assert.equal(await p.locator('[data-army-specialty][aria-checked=true]').count(),0);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
 assert.equal(await p.locator('#drifter-fallback-dialog').count(),0);assert.equal(await p.locator('#army-career-dialog').getAttribute('data-career-template'),'core.drifter');
 if(assignment==='barbarian'&&!api){await p.screenshot({path:fileURLToPath(new URL('./artifacts/drifter-choice-'+width+'.png',import.meta.url))});}
 await p.locator('#cancel-character').click();assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);await p.reload();await p.getByRole('button',{name:'Enter Drifter',exact:true}).click();
 await p.locator('[data-army-specialty="'+assignment+'"]').focus();await p.keyboard.press('Space');assert.equal(await p.locator('[data-action="confirm-drifter-fallback"]').isEnabled(),true);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
 assert.ok(await p.locator('#army-career-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 if(assignment==='wanderer'&&!api)await p.screenshot({path:fileURLToPath(new URL('./artifacts/drifter-wanderer-'+width+'.png',import.meta.url))});
 await p.locator('[data-action="confirm-drifter-fallback"]').click();await p.waitForFunction(()=>!document.querySelector('[data-action=confirm-drifter-fallback]')&&!document.getElementById('export').disabled);
 const result=project(importSession(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(result.state.character.careers.at(-1).assignment,assignment);assert.equal(result.state.rng,fixture.state.rng);assert.deepEqual(result.log.at(-1).rolls,[]);assert.equal(result.state.draftUsed,fixture.state.draftUsed);assert.equal(result.revision,fixture.revision+1);
 await p.reload();assert.equal(project(importSession(await p.evaluate(k=>localStorage.getItem(k),key))).state.character.careers.at(-1).assignment,assignment);checks.push({width,api,assignment});await context.close();
}assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
