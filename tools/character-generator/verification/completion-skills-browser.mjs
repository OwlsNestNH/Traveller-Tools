import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {project,exportSession} from '../engine/session.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/completion-preview/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(8785,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',fixture=exportSession(finalSheetFixture().session),results=[];
try{
 for(const {width,transport} of [{width:1440,transport:''},{width:390,transport:''},{width:320,transport:''},{width:390,transport:'?api=local'}]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,fixture);},{key,fixture});
  await page.goto('http://127.0.0.1:8785/'+transport);
  await page.locator('#connection-person').waitFor();
  await page.locator('#connection-person').fill('Alex');await page.locator('#connection-note').fill('We survived the survey station evacuation.');
  await page.locator('#connection-skill').selectOption('Engineer (power)');await page.locator('#connection-consent').check();
  await page.screenshot({path:fileURLToPath(new URL('connections-'+width+'.png',out)),fullPage:true});
  await page.locator('[data-action="connection"]').click();await page.getByText('Alex · Engineer (power)',{exact:true}).waitFor();
  await page.locator('[data-action="completion-step"][data-step="group"]').click();
  if(!await page.locator('#group-skills-panel').evaluate(n=>n.open))await page.locator('#group-skills-panel > summary').click();await page.locator('[data-action="add-group-skill"]').click();
  await page.locator('#group-skill').selectOption('custom:Science');
  await page.locator('#group-skill-custom').fill('xenobotany');
  await page.screenshot({path:fileURLToPath(new URL('group-custom-'+width+'.png',out)),fullPage:true});
  await page.locator('[data-action="record-group-skill"]').click();await page.locator('#workspace').getByText('Science (xenobotany) 1',{exact:true}).waitFor({state:'attached'});
  await page.locator('[data-action="add-group-skill"]').click();await page.locator('#group-skill').selectOption('Medic');
  await page.screenshot({path:fileURLToPath(new URL('group-skills-'+width+'.png',out)),fullPage:true});
  await page.locator('[data-action="record-group-skill"]').evaluate(el=>{el.click();el.click();});
  await page.locator('#workspace').getByText('Medic 1',{exact:true}).waitFor();
  let stored=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));const before=project(stored);
  assert.equal(before.state.groupSkills.length,2);
  await page.locator('[data-action="completion-step"][data-step="connections"]').click();
  await page.locator('[data-action="completion-step"][data-step="group"]').click();await page.reload();
  await page.locator('#workspace').getByText('Science (xenobotany) 1',{exact:true}).waitFor({state:'attached'});
  stored=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));assert.equal(project(stored).state.groupSkills.length,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
  const preserved=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('[data-screen-review-back]').click();await page.locator('#screen-review-dialog').waitFor({state:'visible'});
  await page.locator('[data-review-current]').click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),preserved);
  results.push({width,transport:transport?"http":"static",passed:true,errors});await context.close();
 }
 await writeFile(new URL('browser-results.json',out),JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
