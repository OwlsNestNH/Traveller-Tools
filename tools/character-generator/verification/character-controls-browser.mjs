// Candidate-only browser checks. Temporary profiles; no live services or saved user data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project} from '../engine/session.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',errors=[],checks=[];
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const count=async page=>JSON.parse(await saved(page)).events.length;
async function changed(page,before){await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length>before&&!document.querySelector('#export').disabled,{key,before});}
try{
 for(const width of [1440,320])for(const transport of ['static','http']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const label=transport+'-'+width,requests=[];page.on('request',request=>requests.push(request.url()));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   assert.equal(await page.locator('#extra-stat').count(),0);assert.equal(await page.locator('#gm-toggle').count(),0);
   await page.locator('#setup-optional-settings > summary').click();await page.locator('[name=extras][value=LCK]').check();await page.locator('[name=name]').fill('Controls browser fixture');
   await page.screenshot({path:new URL('character-controls-'+label+'-setup.png',out).pathname,fullPage:true});
   await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.getByRole('button',{name:'Roll six characteristics',exact:true}).click();await page.getByRole('button',{name:'Keep these characteristics',exact:true}).waitFor();await ready(page);
   assert.equal(await page.locator('#extra-stat').count(),0);assert.equal(await page.locator('#gm-controls').getAttribute('open'),null);
   await page.locator('#gm-controls > summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#gm-value-form').count(),0);
   let before=await count(page);await page.locator('#gm-toggle').check();await changed(page,before);
   assert.equal(await page.locator('#gm-value-form').isVisible(),true);assert.equal(await page.locator('#gm-roll-form').isVisible(),false);
   assert.equal(await page.locator('#gm-index,#gm-roll-action,#gm-roll-index').count(),0);
   const initial=project(JSON.parse(await saved(page)));await page.locator('#gm-field').selectOption('pool.1');assert.equal(await page.locator('#gm-value').inputValue(),String(initial.state.pool[1].base));
   before=await count(page);await page.locator('#gm-value').fill('11');await page.getByRole('button',{name:'Save correction',exact:true}).click();assert.equal(await count(page),before); // reason required
   await page.locator('#gm-reason').fill('Correct the named DEX raw score');await page.getByRole('button',{name:'Save correction',exact:true}).click();await changed(page,before);
   let current=project(JSON.parse(await saved(page)));assert.equal(current.state.pool[1].base,11);assert.equal(current.state.pool[0].base,initial.state.pool[0].base);assert.equal(current.log.at(-1).type,'gm-override');assert.match(current.log.at(-1).summary,/pool\[1\]/);
   await page.getByRole('button',{name:'Keep these characteristics',exact:true}).click();await page.getByRole('heading',{name:'Choose background skills',exact:true}).waitFor();await ready(page);
   assert.equal(await page.locator('#additional-characteristics').getAttribute('open'),null);assert.notEqual(await page.locator('#gm-controls').getAttribute('open'),null); // disclosure state follows identity, not position
   assert.equal(await page.locator('#extra-stat option[value=LCK]').count(),0);assert.equal(await page.locator('#sheet .stat').filter({hasText:'LCK'}).count(),1);
   await page.locator('#additional-characteristics > summary').click();await page.locator('#extra-stat').selectOption('MRL');before=await count(page);await page.getByRole('button',{name:'Add this characteristic',exact:true}).click();await changed(page,before);
   assert.equal(await page.locator('#extra-stat option[value=MRL]').count(),0);assert.equal(await page.locator('#sheet .stat').filter({hasText:'MRL'}).count(),1);
   await page.locator('#gm-field').selectOption('age');assert.equal(await page.locator('#gm-value').inputValue(),'18');await page.locator('#gm-value').fill('45');await page.locator('#gm-reason').fill('A fixture chronology correction');before=await count(page);
   await page.evaluate(()=>{const form=document.querySelector('#gm-value-form');form.requestSubmit();form.requestSubmit();});await changed(page,before);assert.equal(await count(page),before+1);assert.equal(project(JSON.parse(await saved(page))).state.character.age,45);
   await page.locator('#gm-controls').screenshot({path:new URL('character-controls-'+label+'-value.png',out).pathname});
   await page.locator('#gm-task').selectOption('roll');assert.equal(await page.locator('#gm-value-form').isVisible(),false);assert.equal(await page.locator('#gm-roll-form').isVisible(),true);
   const old=JSON.parse(await saved(page)),revision=old.events.findIndex(e=>e.command.type==='roll-statistics')+1;await page.locator('#gm-roll-choice').selectOption(revision+':0');assert.equal(await page.locator('[data-gm-die]').count(),2);
   const info=page.locator('#gm-replay-explanation > summary');assert.equal(await info.locator('[aria-hidden=true]').textContent(),'ⓘ');await info.focus();await page.keyboard.press('Enter');assert.notEqual(await page.locator('#gm-replay-explanation').getAttribute('open'),null);await page.keyboard.press('Enter');
   await page.locator('[data-gm-die]').nth(0).fill('7');await page.locator('[data-gm-die]').nth(1).fill('6');await page.locator('#gm-roll-reason').fill('Correct the recorded STR dice');before=await count(page);await page.getByRole('button',{name:'Replace this roll',exact:true}).click();assert.equal(await count(page),before);
   await page.locator('[data-gm-die]').nth(0).fill('6');const unchanged=await saved(page);page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Replace this roll',exact:true}).click();assert.equal(await saved(page),unchanged);assert.equal(await page.locator('#gm-roll-reason').inputValue(),'Correct the recorded STR dice');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('#gm-controls').screenshot({path:new URL('character-controls-'+label+'-roll.png',out).pathname});
   page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Replace this roll',exact:true}).click();await changed(page,before);
   const replaced=JSON.parse(await saved(page));current=project(replaced);assert.equal(current.state.stage,'statistics');assert.equal(current.state.pool[0].base,12);assert.equal(current.state.character.age,18);assert.deepEqual(replaced.events.slice(0,old.events.length),old.events);assert.equal(current.log.at(-1).type,'gm-replay');assert.equal(current.log.at(-1).rolls[0].total,12);
   assert.equal(await page.locator('#extra-stat').count(),0);assert.equal(await page.locator('#gm-roll-form').isVisible(),true);assert.equal(await page.locator('#action-log > li').count(),replaced.events.length);assert.match(await page.locator('#action-log').textContent(),/A fixture chronology correction/);assert.equal(await page.locator('#last-action-result').isVisible(),true);
   await page.reload();await page.getByRole('button',{name:'Keep these characteristics',exact:true}).waitFor();assert.deepEqual(JSON.parse(await saved(page)),replaced);assert.equal(await page.locator('#gm-controls').getAttribute('open'),null);
   if(transport==='http'){assert.ok(requests.some(url=>url.includes('/api/v1')));assert.ok(!requests.some(url=>/\/engine\//.test(url)));}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks.push(label+' contextual extras, current values, guarded corrections, roll picker, cancellation, audit and reload');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('character-controls-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
