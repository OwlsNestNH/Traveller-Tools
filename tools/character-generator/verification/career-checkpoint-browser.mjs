import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {eventCheckpointFixture,laterBasicFixture,requiredAwardFixture,run,force} from './career-checkpoint-fixtures.mjs';
import {awardedEquipmentFixture} from './equipment-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/',key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url),checks=[],errors=[],images=[];
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});
const saved=p=>p.evaluate(k=>localStorage.getItem(k),key),idle=p=>p.waitForFunction(()=>!document.getElementById('new').disabled);
async function load(p,r,http){await p.goto(base+(http?'?api=local':''));await p.locator('#setup-form').waitFor();await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(r.session)});await p.reload();await idle(p);}
async function shot(p,name,width,http){if(http)return;assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.locator('img:visible').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode().catch(()=>{}))));const filename='career-checkpoint-review-'+name+'-'+(width>800?'desktop':'mobile')+'.png';await p.screenshot({path:new URL(filename,out).pathname});images.push(filename);}
try{
 for(const http of [false,true])for(const width of [1440,390]){
  for(const [id,row] of [['core.army',8],['core.navy',5],['core.scout',8]]){
   const r=eventCheckpointFixture(id,row),p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));await load(p,r,http);const raw=await saved(p),before=JSON.parse(raw),pending=r.state.pendingBorrowedRoll;
   const roll=p.locator('[data-action=roll-borrowed-event]');await roll.waitFor();assert.match(await roll.innerText(),/check/i);assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.log.at(-1).rolls[0].label,'Event table');
   if(id==='core.army'){const box=await roll.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000,'Pending roll is visible before scrolling');await shot(p,'01-army-check',width,http);await p.locator('#army-career-close').click();assert.equal(await saved(p),raw);await p.locator('#army-career-resume').click();await p.locator('#step-title').focus();await p.keyboard.press('Escape');assert.equal(await saved(p),raw);await p.locator('#army-career-resume').click();}
   await p.reload();await idle(p);assert.equal(await saved(p),raw);
   const expected=run(r,'roll-borrowed-event',{pendingId:pending.id});await p.locator('[data-action=roll-borrowed-event]').evaluate(n=>{n.click();n.click();});await idle(p);
   const after=JSON.parse(await saved(p)),actual=api({operation:'import',raw:JSON.stringify(after)});assert.equal(after.events.length,before.events.length+1);assert.deepEqual(actual.state.character,expected.state.character);assert.equal(actual.state.rng,expected.state.rng);assert.equal(actual.log.at(-1).rolls.length,1);assert.equal(actual.log.at(-1).rolls[0].label,pending.kind==='check'&&pending.label==='EDU check'?'EDU check':'Skill check');
   const accepted=await saved(p);await p.reload();await idle(p);assert.equal(await saved(p),accepted);if(id==='core.army')await shot(p,'02-army-result',width,http);checks.push({name:id,width,http,separate:true,repeated:true,reload:true});await p.close();
  }
  {
   const r=laterBasicFixture(),p=await browser.newPage({viewport:{width,height:1000}});await load(p,r,http);assert.match(await p.locator('#workspace').innerText(),/Choose a basic-training skill/);await shot(p,'03-later-basic',width,http);
   const raw=await saved(p);await p.locator('[data-action=choose-effect][data-index="4"]').evaluate(n=>{n.click();n.click();});await idle(p);const after=api({operation:'import',raw:await saved(p)});assert.equal(after.state.stage,'survival');assert.equal(after.state.character.skills.Investigate,0);assert.equal(after.session.events.length,JSON.parse(raw).events.length+1);assert.deepEqual(after.log.at(-1).rolls,[]);assert.equal(await p.locator('[data-action=training]').count(),0);await shot(p,'04-later-survival',width,http);checks.push({name:'later-basic',width,http,noExtraRoll:true});await p.close();
  }
  {
   const r=requiredAwardFixture(),p=await browser.newPage({viewport:{width,height:1000}});await load(p,r,http);const raw=await saved(p);await p.locator('#book-confirm').check();await p.locator('[data-action=resolve-book]').click();await p.locator('#book-note[aria-invalid=true]').waitFor();assert.equal(await saved(p),raw);await shot(p,'05-required-award',width,http);
   await p.locator('[data-action=retry-skill-choice]').click();await idle(p);await p.locator('#award-skill').fill('Gun Combat (slug)');await p.locator('[data-action=choose-skill]').click();await idle(p);const after=api({operation:'import',raw:await saved(p)});assert.equal(after.state.character.skills['Gun Combat (slug)'],1);assert.equal(after.state.stage,'survival');checks.push({name:'required-rank-award',width,http,guard:true,retry:true});await p.close();
  }
  {
   let r=awardedEquipmentFixture();while(r.state.stage==='benefits')r=force(r,'benefit',{cash:true},[1]);r=run(r,'finish');const p=await browser.newPage({viewport:{width,height:1000}});await load(p,r,http);await shot(p,'06-equipment-checklist',width,http);assert.equal(await p.getByRole('button',{name:'Finish character',exact:true}).isDisabled(),true);
   const raw=await saved(p);await p.locator('[data-action=choose-deferred-equipment]').click();await p.locator('#equipment-dialog').waitFor({state:'visible'});await p.keyboard.press('Escape');await idle(p);assert.equal(api({operation:'import',raw:await saved(p)}).state.character.assets,undefined);await p.reload();await idle(p);await p.locator('[data-action=choose-deferred-equipment]').click();await p.locator('#benefit-item-id').selectOption('core.rifle');await p.locator('#book-note').fill('Synthetic source-confirmed item within the award limits.');await p.locator('#book-confirm').check();await shot(p,'07-weapon-selection',width,http);await p.locator('[data-action=resolve-book]').evaluate(n=>{n.click();n.click();});await idle(p);let after=api({operation:'import',raw:await saved(p)});assert.equal(after.state.character.assets.length,1);assert.equal(after.state.character.deferredEquipment[0].status,'resolved');await p.getByRole('button',{name:'Finish character',exact:true}).click();await idle(p);after=api({operation:'import',raw:await saved(p)});assert.equal(after.state.stage,'finish');assert.equal(after.state.character.assets.length,1);assert.equal(after.state.character.benefitRollHistory.length,r.state.character.benefitRollHistory.length);assert.ok(JSON.parse(await saved(p)).events.length>JSON.parse(raw).events.length);await shot(p,'08-finished',width,http);checks.push({name:'deferred-weapon-finish',width,http,cancel:true,reload:true,finished:true});await p.close();
  }
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('career-checkpoint-results.json',out),JSON.stringify({checks,errors,images},null,2));console.log(JSON.stringify({checks,errors,images}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
