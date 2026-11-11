// Actual UI checks and review screenshots. Synthetic characters only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,project,exportSession} from '../engine/session.mjs';
import {statisticsTotalOutcome,statisticsTagline,outcomeTaglines} from '../gui/outcome-taglines.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';

const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const key='traveller-character-generator.v1',checks=[],errors=[];
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const snapshot=async page=>project(JSON.parse(await saved(page)));
async function changed(page,before){await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length>before&&!document.querySelector('#export').disabled,{key,before});}
async function load(page,session){await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(session)});await page.reload();await ready();await page.locator('body[data-stage="statistics"]').waitFor();}
async function screenshot(page,name){await page.screenshot({path:fileURLToPath(new URL('outcome-taglines-'+name+'.png',out)),fullPage:true});}

function fixture(species,config,outcome){
 for(let index=0;index<2000;index++){
  let session=createSession('tagline-review-'+species+'-'+JSON.stringify(config)+'-'+index);
  session=execute(session,{type:'configure',payload:config}).session;
  session=execute(session,{type:'setup',payload:{species,name:'Review Traveller'}}).session;
  const result=execute(session,{type:'roll-statistics'});
  if(statisticsTotalOutcome(result.log.at(-1),result.state)===outcome)return {before:session,after:result.session};
 }
 throw Error('No fixture for '+species+' '+outcome);
}
const cases=[
 ['human-low','human',{},'statistics.low'],['human-high','human',{},'statistics.high'],['human-ordinary','human',{},null],
 ['boon-low','human',{boons:6},'statistics.low'],['boon-high','human',{boons:6},'statistics.high'],
 ['aslan-high','aslan',{},'statistics.high'],['vargr-low','vargr',{},'statistics.low'],
 ['aezorgh-low','aezorgh',{},'statistics.low'],['aezorgh-high','aezorgh',{},'statistics.high'],
 ['aezorgh-boon-low','aezorgh',{boons:3},'statistics.low'],['aezorgh-two-dice-high','aezorgh',{aezorghTwoDice:true,boons:2},'statistics.high'],
].map(([name,species,config,outcome])=>({name,species,config,outcome,...fixture(species,config,outcome)}));
try{
 for(const transport of ['static','http'])for(const width of [1440,390,320])for(const item of cases){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),requests=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.locator('#setup-form').waitFor();await ready();
   // Exercise the real button and repeated-click guard, rather than inserting a result into the DOM.
   await load(page,item.before);assert.equal(await page.locator('.outcome-tagline').count(),0);
   const beforeCount=item.before.events.length;
   await page.locator('[data-action="roll-statistics"]').evaluate(button=>{button.click();button.click();});await changed(page,beforeCount);
   const raw=await saved(page),current=await snapshot(page),event=current.log.at(-1);
   assert.equal(JSON.parse(raw).events.length,beforeCount+1);
   assert.equal(statisticsTotalOutcome(event,current.state),item.outcome);
   const text=statisticsTagline(event,current.state),tag=page.locator('.outcome-tagline');
   assert.equal(await tag.count(),text?1:0);if(text){assert.equal(await tag.innerText(),text);assert.ok(outcomeTaglines[item.outcome].includes(text));}
   assert.match(await page.locator('#last-action-result').innerText(),/Six characteristics rolled\./);
   assert.equal(await page.locator('#message').innerText(),'Six characteristics rolled.');
   assert.equal(await page.locator('.statistics-total-value').innerText(),String(current.state.rollTotal));
   assert.equal(await page.locator('dialog[open]').count(),0,'no automatic popup');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(text){
    const bounds=await tag.boundingBox();assert.ok(bounds.width>0&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
    const contrast=await tag.evaluate(node=>{
     const rgb=getComputedStyle(node).color.match(/\d+/g).slice(0,3).map(Number);
     let ancestor=node,bg;
     while(ancestor){const color=getComputedStyle(ancestor).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent'){bg=color.match(/\d+/g).slice(0,3).map(Number);break;}ancestor=ancestor.parentElement;}
     const luminance=values=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
     const [a,b]=[luminance(rgb),luminance(bg)].sort((a,b)=>b-a);return(a+.05)/(b+.05);
    });assert.ok(contrast>=4.5,'normal-text contrast');
    assert.equal(await tag.getAttribute('tabindex'),null);assert.equal(await tag.getAttribute('aria-live'),null);
   }
   const fullLog=await downloadedActionLog(page);
   if(text)assert.ok(!fullLog.includes(text),'flavour does not enter factual logs');
   const details=page.locator('[data-action="statistics-roll-details"]');await details.focus();await details.press('Enter');
   await page.locator('#simple-action-log[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await details.evaluate(n=>n===document.activeElement),true);
   await page.locator('#cancel-character').click();await page.locator('#cancel-character-dialog[open]').waitFor();await page.keyboard.press('Escape');
   assert.equal(await saved(page),raw);assert.equal(await downloadedActionLog(page),fullLog);if(text)assert.equal(await tag.innerText(),text);
   await page.reload();await ready();if(text)assert.equal(await tag.innerText(),text);else assert.equal(await tag.count(),0);
   assert.equal(await saved(page),raw,'reload does not add a presentation field');
   if(transport==='static'&&['human-low','human-high','aezorgh-low'].includes(item.name))await screenshot(page,item.name+'-'+width);
   // Swapping is a separate factual action: it must not select another joke.
   if(item.species==='aezorgh'&&!item.config.aezorghTwoDice)await page.locator('#swap-b').selectOption('2');
   await page.locator('[data-action="swap-statistics"]').click();await changed(page,beforeCount+1);assert.equal(await tag.count(),0);
   // Accept the same saved rolled set; taglines never follow into the next stage.
   await load(page,JSON.parse(raw));await page.locator('[data-action="accept-statistics"]').click();await changed(page,beforeCount+1);assert.equal(await tag.count(),0);
   assert.deepEqual((await snapshot(page)).state,execute(JSON.parse(raw),{type:'accept-statistics'}).state,'presentation leaves future engine state identical');
   if(transport==='http'){assert.ok(requests.some(url=>url.includes('/api/v1')));assert.ok(!requests.some(url=>/\/engine\//.test(url)),'HTTP UI does not import engine');}
   checks.push(transport+'/'+width+'/'+item.name);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
 await writeFile(new URL('outcome-taglines-results.json',out),JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({passed:checks.length,errors},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
