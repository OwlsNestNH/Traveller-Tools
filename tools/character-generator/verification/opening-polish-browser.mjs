import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession,project} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const ready=page=>page.waitForFunction(()=>document.body.dataset.stage&&!document.querySelector('#export').disabled);
const errors=[],checks=[];
function fixture(stage){let s=createSession('opening-polish-regression');if(stage==='identity')return s;for(const command of [{type:'setup',payload:{name:'Your Traveller',species:'human',gender:'female'}},...(stage==='unrolled'?[]:[{type:'roll-statistics'}]),...(stage==='background'?[{type:'accept-statistics'}]:[])])s=execute(s,command).session;return s;}
try{
 for(const width of [1440,390,320])for(const stage of ['identity','unrolled','statistics','background']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),session=fixture(stage),raw=exportSession(session);
  page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key,raw});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await ready(page);
  const saved=()=>page.evaluate(key=>localStorage.getItem(key),key),before=await saved();assert.equal(before,raw,'render does not mutate the save');
  const heading=page.locator('#step-title');assert.equal(await heading.evaluate(n=>getComputedStyle(n).color),'rgb(245, 247, 250)');assert.ok(await heading.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=26));
  if(stage==='statistics'||stage==='unrolled')assert.equal(await heading.evaluate(n=>{const info=n.parentElement.querySelector('.opening-info-trigger').getBoundingClientRect(),range=document.createRange();for(const child of n.childNodes)if(child.nodeType===Node.TEXT_NODE){range.selectNodeContents(child);for(const text of range.getClientRects())if(text.left<info.right&&text.right>info.left&&text.top<info.bottom&&text.bottom>info.top)return false;}return true;}),true,'heading text cannot overlap its information control');
  const speakers=page.locator('#workspace :is(.crow-speaking-panel,#crow-introduction)');assert.equal(await speakers.count(),1,'one contextual pictured Crow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow: '+stage+' at '+width);
  const primary=page.locator(stage==='identity'?'#setup-form [type=submit]':stage==='background'?'#background-form [type=submit]':'.statistics-primary');
  assert.ok(await primary.evaluate(n=>n.getBoundingClientRect().height>=60));await primary.focus();assert.equal(await primary.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
  if(stage==='statistics'){
   const state=project(session).state;assert.equal(await page.locator('.statistics-total-value').textContent(),String(state.rollTotal));assert.deepEqual(await page.locator('#workspace>.stats>.stat>strong').allTextContents(),state.pool.map(p=>String(p.value)));
   const select=page.locator('#swap-a');await select.selectOption('1');assert.equal(await saved(),before,'placement draft cannot change accepted rolls');await select.selectOption('0');
   await page.locator('[data-action=statistics-roll-details]').click();await page.locator('#simple-action-log').waitFor({state:'visible'});assert.match(await page.locator('#simple-log-content').textContent(),/rolled statistics/i);await page.keyboard.press('Escape');assert.equal(await saved(),before);
   const reroll=page.locator('[data-action=roll-statistics]');assert.equal(await reroll.isEnabled(),state.statisticsCanReroll);
  }
  if(stage==='background'){
   const boxes=page.locator('#background-form [name=skills]');await boxes.first().focus();await page.keyboard.press('Space');assert.equal(await boxes.first().isChecked(),true);assert.equal(await saved(),before,'preview cannot grant a skill');assert.match(await page.locator('#background-selected-summary').textContent(),/0/);
  }
  if(stage==='unrolled')assert.equal(await page.locator('.statistics-total-value').textContent(),'—','unrolled state does not invent a score');
  await heading.scrollIntoViewIfNeeded();await page.screenshot({path:new URL('opening-polish-'+stage+'-'+width+'.png',out).pathname,fullPage:true});
  // Capture comparison with exactly the same state and controls, only the new stylesheet removed.
  await page.locator('link[href="./gui/opening-polish.css"]').evaluate(n=>n.disabled=true);await page.screenshot({path:new URL('opening-polish-before-'+stage+'-'+width+'.png',out).pathname,fullPage:true});assert.equal(await saved(),before);
  await page.reload();await ready(page);assert.equal(await saved(),before,'reload preserves recorded state');checks.push({stage,width});await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
