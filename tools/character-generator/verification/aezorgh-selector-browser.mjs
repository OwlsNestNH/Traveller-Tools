// Actual setup controls, transports and preserved saved histories; screenshots are synthetic previews.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,project,exportSession,importSession,COMPATIBLE_RULES_REVISIONS,RULES_REVISION} from '../engine/session.mjs';
import {OPENING_HELP} from '../gui/opening-help.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1',errors=[],checks=[];
await mkdir(out,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const url=transport=>'http://127.0.0.1:'+server.address().port+'/'+(transport==='http'?'?api=local':'');
const stored=page=>page.evaluate(key=>localStorage.getItem(key),key);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const snapshot=page=>page.evaluate(key=>({raw:localStorage.getItem(key),data:[...new FormData(document.querySelector('#setup-form'))]}),key);
const house=async page=>{await page.locator('#setup-gm-controls').evaluate(n=>n.open=true);await page.locator('#setup-house-rules').evaluate(n=>n.open=true);};
async function fresh(transport,width,work){const page=await browser.newPage({viewport:{width,height:1050}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());try{await page.goto(url(transport));await page.locator('#setup-form').waitFor();await work(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}finally{await page.close();}}
async function exported(page){const event=page.waitForEvent('download');await page.locator('#export').click();return readFile(await(await event).path(),'utf8');}
async function load(page,raw,stage){await page.locator('#import').setInputFiles({name:'synthetic-aezorgh.json',mimeType:'application/json',buffer:Buffer.from(raw)});await ready(page);await page.locator('body[data-stage="'+stage+'"]').waitFor();}
const method=page=>page.locator('[name=aezorghTwoDice]');
const minimum=page=>page.locator('#minimum-total');
try{
 for(const transport of ['static','http'])for(const width of [1440,390,320])for(const chosen of ['house','raw'])await fresh(transport,width,async page=>{
  assert.equal(await page.locator('label[for=setup-aezorgh-method]').textContent(),'Aezorgh: use 2D6 ÷ 2 for Stats');assert.equal(await page.locator('#aezorgh-roll-choice small').count(),0);assert.equal(await method(page).getAttribute('type'),'checkbox');assert.equal(await page.locator('#aezorgh-roll-choice input').count(),1);assert.equal(await page.locator('#aezorgh-roll-choice select,#aezorgh-roll-choice [type=radio]').count(),0);assert.equal(await method(page).isDisabled(),true);await page.locator('[name=species]').selectOption('aezorgh');await house(page);
  assert.equal(await method(page).isChecked(),true);assert.equal(await minimum(page).inputValue(),'43');
  const rows=await page.locator('#setup-house-rules .opening-house-rule:visible').evaluateAll(ns=>ns.map(n=>{const info=n.querySelector('button'),input=n.querySelector('input'),label=n.querySelector('label'),a=info.getBoundingClientRect(),b=input.getBoundingClientRect(),c=label.getBoundingClientRect(),style=getComputedStyle(label);return {infoX:a.left,checkboxX:b.left,labelX:c.left,infoCenter:a.top+a.height/2,checkboxCenter:b.top+b.height/2,labelCenter:c.top+parseFloat(style.paddingTop)+parseFloat(style.lineHeight)/2,infoWidth:a.width,infoHeight:a.height,labelHeight:c.height,associated:label.control===input};}));
  assert.equal(rows.length,3);for(const row of rows){for(const column of ['infoX','checkboxX','labelX'])assert.ok(Math.abs(row[column]-rows[0][column])<1,'House Rules columns align');assert.ok(Math.abs(row.infoCenter-row.checkboxCenter)<1);assert.ok(Math.abs(row.labelCenter-row.checkboxCenter)<1);assert.ok(row.infoWidth>=44&&row.infoHeight>=44&&row.labelHeight>=44);assert.equal(row.associated,true);}
  await page.locator('label[for=setup-aezorgh-method]').click();assert.equal(await method(page).isChecked(),false);await method(page).focus();await method(page).press('Space');assert.equal(await method(page).isChecked(),true);assert.equal(await minimum(page).inputValue(),'43');
  await method(page).uncheck();assert.equal(await minimum(page).inputValue(),'30');
  await page.locator('[name=species]').selectOption('human');assert.equal(await method(page).isDisabled(),true);assert.equal(await minimum(page).inputValue(),'43');
  await page.locator('[name=species]').selectOption('aezorgh');assert.equal(await method(page).isChecked(),false);assert.equal(await minimum(page).inputValue(),'30');
  await method(page).setChecked(chosen==='house');assert.equal(await minimum(page).inputValue(),chosen==='house'?'43':'30');
  const before=await snapshot(page),trigger=page.getByRole('button',{name:'About Aezorgh stat rolls'});
  await trigger.focus();await trigger.press('Enter');assert.equal(await page.locator('#opening-help-title').innerText(),'Aezorgh stat rolls');assert.equal(await page.locator('#opening-help-source').innerText(),OPENING_HELP.aezorgh.source);
  await page.keyboard.press('Tab');assert.equal(await page.locator('[data-opening-help-close]').evaluate(n=>n===document.activeElement),true);
  if(transport==='static'&&width===1440&&chosen==='house')await page.screenshot({path:fileURLToPath(new URL('aezorgh-selector-method-help.png',out))});
  await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);await trigger.click();await page.locator('[data-opening-help-close]').click();assert.deepEqual(await snapshot(page),before);
  if(transport==='static'&&width===320)await page.locator('#setup-house-rules').screenshot({path:fileURLToPath(new URL('aezorgh-selector-320-'+chosen+'.png',out))});
  if(transport==='static'&&chosen==='house'&&[1440,390].includes(width)){
   await page.locator('#opening-portrait img').evaluate(i=>i.decode());await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:fileURLToPath(new URL('aezorgh-selector-'+width+'.png',out)),fullPage:true});
   if(width===390)await page.locator('#setup-house-rules').screenshot({path:fileURLToPath(new URL('aezorgh-selector-phone-control.png',out))});
  }
  await page.locator('#setup-gm-settings').evaluate(n=>n.open=true);await page.locator('[name=boons]').selectOption('3');
  await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage="statistics"]').waitFor();
  let p=project(JSON.parse(await stored(page)));assert.equal(p.state.config.aezorghTwoDice,chosen==='house');assert.equal(p.state.statisticsRerollThreshold,chosen==='house'?43:30);
  assert.equal(JSON.parse(await stored(page)).events[0].command.payload.aezorghTwoDice,chosen==='house');
  await page.getByRole('button',{name:'Roll six characteristics'}).click();await ready(page);p=project(JSON.parse(await stored(page)));
  assert.deepEqual(p.state.pool.map(x=>x.count),chosen==='house'?[2,2,2,2,2,2]:[1,2,1,2,1,1]);
  assert.deepEqual(p.log.at(-1).rolls.map(x=>x.values.length),chosen==='house'?[3,3,3,2,2,2]:[2,3,2,2,1,1]);
  for(const stat of p.state.pool)assert.equal(stat.derivedBase,chosen==='house'?Math.ceil(stat.base/stat.divisor):stat.base);
  const raw=await stored(page);assert.equal(await exported(page),raw);assert.deepEqual(project(importSession(raw)).state,p.state);
  await page.reload();await page.locator('body[data-stage="statistics"]').waitFor();assert.equal(await stored(page),raw);
  await load(page,raw,'statistics');assert.equal(await stored(page),raw);assert.deepEqual(project(JSON.parse(await stored(page))).state,p.state);
  checks.push({transport,width,chosen,defaults:true,retainedRaw:true,help:true,exportImportReload:true});
 });
 for(const transport of ['static','http'])await fresh(transport,390,async page=>{
  await page.locator('[name=species]').selectOption('aezorgh');await page.locator('#setup-gm-controls').evaluate(n=>n.open=true);await minimum(page).fill('30');await minimum(page).press('Tab');
  await house(page);for(const chosen of ['raw','house']){await method(page).setChecked(chosen==='house');assert.equal(await minimum(page).inputValue(),'30');}
  for(const species of ['human','aslan','vargr','aezorgh']){await page.locator('[name=species]').selectOption(species);assert.equal(await minimum(page).inputValue(),'30');}
  await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage="statistics"]').waitFor();const p=project(JSON.parse(await stored(page)));assert.equal(p.state.config.aezorghTwoDice,true);assert.equal(p.state.statisticsRerollThreshold,30);checks.push({transport,customThreshold:30});
 });
 for(const species of ['human','aslan','vargr'])await fresh('static',320,async page=>{
  await page.locator('[name=species]').selectOption('aezorgh');await page.locator('[name=species]').selectOption(species);if(species==='aslan')await page.locator('#setup-gender').selectOption('male');
  await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage="statistics"]').waitFor();assert.equal(project(JSON.parse(await stored(page))).state.config.aezorghTwoDice,false);await page.getByRole('button',{name:'Roll six characteristics'}).click();await ready(page);assert.equal(project(JSON.parse(await stored(page))).state.pool.length,6);checks.push({species,incompatibleFlag:false});
 });
 for(const transport of ['static','http'])for(const revision of COMPATIBLE_RULES_REVISIONS)for(const twoDice of [false,true])await fresh(transport,390,async page=>{
  let r=execute({...createSession('saved-method-'+revision+'-'+twoDice),rulesRevision:revision},{type:'configure',payload:{aezorghTwoDice:twoDice,minimumTotal:37}});
  const identity=exportSession(r.session);await load(page,identity,'identity');assert.equal(await stored(page),identity);
  await page.locator('[name=species]').selectOption('aezorgh');await house(page);assert.equal(await method(page).isChecked(),twoDice);assert.equal(await minimum(page).inputValue(),'37');
  await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage="statistics"]').waitFor();await page.getByRole('button',{name:'Roll six characteristics'}).click();await ready(page);
  const raw=await stored(page),p=project(JSON.parse(raw));assert.equal(JSON.parse(raw).rulesRevision,revision);assert.equal(p.state.config.aezorghTwoDice,twoDice);assert.equal(p.state.statisticsRerollThreshold,37);
  for(const stat of p.state.pool)assert.equal(stat.derivedBase,twoDice?([RULES_REVISION,'character-preview-2026-11-09.30','character-preview-2026-11-09.29','character-preview-2026-11-09.27','character-preview-2026-11-09.25','character-preview-2026-11-09.24','character-preview-2026-11-09.23','character-preview-2026-11-09.22'].includes(revision)?Math.ceil:Math.floor)(stat.base/stat.divisor):stat.base);
  assert.equal(await exported(page),raw);await page.reload();await page.locator('body[data-stage="statistics"]').waitFor();assert.equal(await stored(page),raw);assert.deepEqual(project(importSession(raw)).state,p.state);checks.push({transport,revision,twoDice,savedSetupPreserved:true});
 });
 assert.deepEqual(errors,[]);await writeFile(new URL('aezorgh-selector-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
