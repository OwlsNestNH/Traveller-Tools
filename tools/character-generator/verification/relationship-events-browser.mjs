import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {relationshipFixture,psionRelationshipFixture} from './relationship-event-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[];let browser;
const saved=async page=>project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));
const ready=async page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 const fixtures=new Map();
 for(const career of ['core.entertainer','core.drifter','core.rogue','core.psion','aslan.outcast','aslan.outlaw'])for(const people of [0,2])fixtures.set(career+people,career==='core.psion'?psionRelationshipFixture({people}):relationshipFixture({career,people}));
 for(const width of [1440,320])for(const transport of ['', '?api=local'])for(const [name,fixture] of fixtures){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>5);await ready(page);
   const before=await saved(page);assert.deepEqual(before.state,fixture.state);await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>5);assert.deepEqual((await saved(page)).state,before.state);
   if(before.state.stage==='relationship-event'){
    const button=page.locator('[data-action=resolve-relationship-event]');await button.click();await ready(page);assert.equal((await saved(page)).revision,before.revision);
    const person=page.locator('#relationship-event-person');if(await person.count())await person.selectOption(before.state.character.relationships[1].id);
    const role=page.locator('#relationship-event-role');if(await role.count())await role.selectOption('Rival');
    await page.locator('#relationship-event-confirm').check();await button.dblclick();await ready(page);
    const after=await saved(page);assert.equal(after.revision,before.revision+1);assert.equal(after.state.character.relationshipEvents.length,1);assert.match(await page.locator('#sheet').innerText(),/Relationship consequences/);
    if(await person.count())throw Error('Completed relationship choice remains visible');
    await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>5);assert.deepEqual((await saved(page)).state,after.state);
   }else{assert.equal(before.state.pending.kind,'native-effect');assert.match(await page.locator('#workspace').innerText(),/no replacement relationship/i);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const label=name+'-'+width+'-'+(transport?'http':'static');await page.screenshot({path:fileURLToPath(new URL('relationship-'+label+'.png',out)),fullPage:true});checks.push({name:label,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('relationship-events-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
