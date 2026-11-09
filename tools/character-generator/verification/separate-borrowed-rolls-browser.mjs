import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession,project,RULES_REVISION} from '../engine/session.mjs';
import {agentCoverFixture,run,forceAt} from './agent-cover-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.CHARACTER_BROWSER_CHANNEL||'msedge'});
const key='traveller-character-generator.v1',errors=[];
const read=async page=>{const raw=await page.evaluate(key=>localStorage.getItem(key),key);return {raw,...project(JSON.parse(raw))};};
const ready=page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
let cover=agentCoverFixture({rulesRevision:RULES_REVISION});cover=run(cover,'cross-career-cover',{careerId:'core.rogue'});cover=forceAt(cover,cover.revision,0,[1,1]);
let betrayal=run(cover,'roll-borrowed-event',{pendingId:cover.state.pendingBorrowedRoll.id});betrayal=forceAt(betrayal,betrayal.revision,0,[3]);
const random=run(betrayal,'resolve-relationship-event',{role:'Enemy',confirmed:true});
const roll=(r,values)=>{let next=run(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id});return forceAt(next,next.revision,0,values);};
let success=agentCoverFixture({rulesRevision:RULES_REVISION});success=run(success,'cross-career-cover',{careerId:'core.rogue'});success=forceAt(success,success.revision,0,[6,6]);
const check=roll(success,[3,6]),injury=roll(check,[1,1]),severity=roll(injury,[1]),life=roll(success,[3,4]),unusual=roll(life,[6,6]);
try{
 for(const http of [false,true])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));
   await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   for(const fixture of [cover,betrayal,random,check,injury,severity,life,unusual]){
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await ready(page);
    const before=await read(page);assert.equal(before.revision,fixture.revision);await page.reload();await ready(page);assert.equal((await read(page)).raw,before.raw);
    if(fixture===betrayal){
     assert.match(await page.locator('#last-action-result').innerText(),/Betrayal/);
     await page.locator('#relationship-event-role').selectOption('Enemy');
     await page.locator('#relationship-event-confirm').check();
    }else{assert.match(await page.locator('#workspace').innerText(),/This step has not been rolled yet/);}
    const action=fixture===betrayal?'resolve-relationship-event':'roll-borrowed-event';
    await page.locator('[data-action='+action+']').evaluate(b=>{b.click();b.click();});
    await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key)).events.length===revision+1,{key,revision:before.revision});await ready(page);
    const after=await read(page);assert.equal(after.revision,before.revision+1);assert.equal(after.log.at(-1).rolls.length,fixture===betrayal?0:1);
    if(fixture===betrayal)assert.equal(after.state.stage,'borrowed-event-roll');
    const text=await page.locator('#last-action-result').innerText();await page.reload();await ready(page);assert.equal((await read(page)).raw,after.raw);assert.equal(await page.locator('#last-action-result').innerText(),text);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);console.log('Separate borrowed rolls including injury/severity and Life/Unusual: static/HTTP, 320/1440, double-click, reload, narrative and zero-dice relationship checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
