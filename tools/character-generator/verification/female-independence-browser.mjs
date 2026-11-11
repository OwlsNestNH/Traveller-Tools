import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,project,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {aslanSetup,aslanEvent,aslanEndTerm,run,force,settle} from './aslan-officer-fixtures.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
let family;for(let n=0;n<60;n++){const before=buildAslanOriginFixture({seed:'female-reroll-'+n,gender:'female',familySOC:2}),after=run(before,'roll-aslan-family');if(after.log.at(-1).rolls[0].values[0]===4){family={before,after};break;}}assert.ok(family,'Find deterministic public family replacement');
let choice=aslanSetup('female-browser-choice','female');choice=settle(run(choice,'career',{id:'aslan.outcast',assignment:'labourer'}));choice=aslanEndTerm(settle(aslanEvent(choice,6)),[1,1]);choice=run(choice,'leave-career');choice=force(choice,'benefit',{cash:false},[4]);assert.equal(choice.state.stage,'effect-choice');
const rawChoice=exportSession(choice.session),rejected=api({operation:'command',session:choice.session,command:{type:'choose-effect',payload:{index:0}}});assert.equal(rejected.ok,false);assert.equal(exportSession(choice.session),rawChoice);
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url),checks=[],errors=[];await mkdir(out,{recursive:true});
const saved=async page=>{const session=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));return {session,...project(session)};};
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#new').disabled);}
try{
 for(const http of [false,true])for(const width of [320,1440])for(const scenario of ['family','choice']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   const fixture=scenario==='family'?family.before:choice;await page.goto('http://127.0.0.1:'+server.address().port+(http?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await ready(page);assert.deepEqual((await saved(page)).state,fixture.state);
   if(scenario==='family'){
    await page.locator('#aslan-family-roll').evaluate(button=>{button.click();button.click();});await ready(page);const result=await saved(page);assert.equal(result.revision,fixture.revision+1);assert.deepEqual(result.state,family.after.state);
    const rolls=result.log.at(-1).rolls,history=result.state.currentAslanOrigin.family.rerolls;assert.ok(rolls.length>1);assert.equal(rolls[0].values[0],4);assert.notEqual(result.state.currentAslanOrigin.family.die,4);assert.deepEqual(history.map(r=>r.die),rolls.map(r=>r.values[0]));assert.ok(history.every(r=>r.source&&r.band==='outcast'));assert.equal(result.state.character.skills.Independence,undefined);assert.equal(result.state.backgroundRemaining,fixture.state.backgroundRemaining);await page.locator('#aslan-family-continue').click();await ready(page);await page.locator('#aslan-family-continue').click();await ready(page);assert.equal((await saved(page)).state.stage,'aslan-clan');assert.match(await downloadedActionLog(page),/female Independence reroll/);
   }else{
    assert.match(await page.locator('#workspace').innerText(),/Independence is male-only/);assert.equal(await page.locator('[data-action=choose-effect][data-index="0"]').count(),0);const legal=page.locator('[data-action=choose-effect][data-index="1"]');assert.match(await legal.innerText(),/Streetwise/);await page.reload();await ready(page);assert.deepEqual((await saved(page)).state,fixture.state);await page.locator('[data-action=choose-effect][data-index="1"]').evaluate(button=>{button.click();button.click();});await ready(page);const result=await saved(page);assert.equal(result.revision,fixture.revision+1);assert.equal(result.session.events.at(-1).command.payload.index,1);assert.deepEqual(result.log.at(-1).rolls,[]);assert.equal(result.state.character.skills.Independence,undefined);assert.equal(result.state.character.skills.Streetwise,(fixture.state.character.skills.Streetwise??0)+1);assert.equal(result.state.character.careers[0].benefitRolls,fixture.state.character.careers[0].benefitRolls-1);assert.equal(result.state.character.careers[0].totalBenefits,fixture.state.character.careers[0].totalBenefits+1);assert.ok(result.log.some(e=>e.rolls.some(r=>r.label==='Material benefit'&&r.total===4)));assert.match(await downloadedActionLog(page),/Streetwise/);
   }
   const result=await saved(page),raw=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await ready(page);assert.deepEqual((await saved(page)).state,result.state);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);const name='female-independence-'+scenario+'-'+width+'-'+(http?'http':'static');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('female-independence-browser-results.json',out),JSON.stringify({checks,errors,materialRerollCoverage:'Engine-only: female Wanderer is not a public eligible career.'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
