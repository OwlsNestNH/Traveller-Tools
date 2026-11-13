import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,execute,exportSession,project} from '../engine/session.mjs';
import {aslanTrainingTagline,restoredAslanTrainingTagline} from '../gui/aslan-training-tagline.mjs';
import {aslanTaglineFixtures,run} from './aslan-tagline-fixtures.mjs';
import {downloadedActionLog} from './download-log-browser.mjs';
const fixtures=aslanTaglineFixtures();
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const origin='http://127.0.0.1:'+server.address().port,key='traveller-character-generator.v1',checks=[],errors=[];
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
async function load(page,session){await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(session)});await page.reload();await ready(page);}
async function changed(page,before){await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).events.length>before&&!document.querySelector('#export').disabled,{key,before});}
const cases=[
 {name:'direct',before:fixtures.direct.before,command:{type:'training',payload:{table:'assignment'}},expected:true},
 {name:'ordinary',before:fixtures.ordinary.before,command:{type:'training',payload:{table:'assignment'}},expected:false},
 {name:'pending-specialty',before:fixtures.specialty.before,command:{type:'training',payload:{table:'assignment'}},expected:false},
 ...['comms','computers','remote ops','sensors'].map(subject=>({name:subject.replaceAll(' ','-'),before:fixtures.specialty.after,command:{type:'choose-skill',payload:{name:'Electronics ('+subject+')'}},expected:subject!=='sensors'})),
 {name:'historical-allocation',before:fixtures.delayed.before,command:{type:'choose-skill',payload:{name:'Electronics (computers)'}},expected:true},
];
try{
 for(const transport of ['static','http'])for(const width of [1440,390,320])for(const item of cases){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),requests=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  try{
   await page.goto(origin+(transport==='http'?'/?api=local':'/'));await page.locator('#setup-form').waitFor();await ready(page);
   await load(page,item.before.session);const count=item.before.session.events.length;
   if(item.command.type==='training')await page.locator('[data-action="training"][data-table="assignment"]').evaluate(b=>{b.click();b.click();});
   else{await page.locator('#award-speciality').selectOption(item.command.payload.name);await page.getByRole('button',{name:'Accept skill',exact:true}).evaluate(b=>{b.click();b.click();});}
   await changed(page,count);
   const raw=await saved(page),session=JSON.parse(raw),current=project(session),event=current.log.at(-1);
   assert.equal(session.events.length,count+1,'repeated click applies once');
   assert.deepEqual(current.state,execute(item.before.session,item.command,{id:event.id}).state,'state and future RNG unchanged');
   const text=aslanTrainingTagline(event,current.state,{previousState:item.before.state,command:item.command}),tag=page.locator('#last-action-result .outcome-tagline');
   assert.equal(!!text,item.expected);assert.equal(await tag.count(),item.expected?1:0);
   if(text){assert.equal(await tag.locator('img').count(),1);assert.match(await tag.locator('blockquote > strong').innerText(),/Crow says/);assert.equal(await tag.locator('blockquote > p').first().innerText(),text);assert.ok(!(await page.locator('#message').innerText()).includes(text));assert.equal(await tag.getAttribute('aria-live'),null);assert.equal(await tag.getAttribute('tabindex'),null);}
   assert.equal(await page.locator('dialog[open]').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const fullLog=await downloadedActionLog(page);if(text)assert.ok(!fullLog.includes(text));
   if(text){
    const ratio=await tag.evaluate(root=>{const n=root.querySelector('blockquote > p');
     const rgb=c=>c.match(/\d+/g).slice(0,3).map(Number),lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     let p=n,bg;while(p){const c=getComputedStyle(p).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=rgb(c);break;}p=p.parentElement;}
     const [a,b]=[lum(rgb(getComputedStyle(n).color)),lum(bg)].sort((a,b)=>b-a);return(a+.05)/(b+.05);
    });assert.ok(ratio>=4.5,'normal text contrast');
   }
   await page.locator('#cancel-character').click();await page.locator('#cancel-character-dialog[open]').waitFor();await page.keyboard.press('Escape');
   assert.equal(await saved(page),raw);if(text)assert.equal(await tag.locator('blockquote > p').first().innerText(),text);
   await page.reload();await ready(page);assert.equal(await tag.count(),text?1:0);if(text)assert.equal(await tag.locator('blockquote > p').first().innerText(),text);assert.equal(await saved(page),raw);
   assert.equal(await restoredAslanTrainingTagline(session,current,async request=>api(request)),text);
   // Real file import, not only localStorage restore. Identity and provenance
   // are replayed through the same public static/HTTP JSON contract.
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('#import').setInputFiles({name:'synthetic-aslan.json',mimeType:'application/json',buffer:Buffer.from(raw)});
   await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Character loaded.'));await ready(page);
   assert.equal(await saved(page),raw);assert.equal(await downloadedActionLog(page),fullLog);if(text)assert.equal(await tag.locator('blockquote > p').first().innerText(),text);
   if(transport==='static'&&['direct','computers','historical-allocation'].includes(item.name))await page.screenshot({path:fileURLToPath(new URL('aslan-training-tagline-'+item.name+'-'+width+'.png',out)),fullPage:true});
   // A later unrelated action removes, rather than rerolls, the previous line.
   await load(page,run({...current,session},'notes',{text:'Synthetic review note'}).session);assert.equal(await tag.count(),0);
   if(transport==='http')assert.ok(!requests.some(url=>/\/engine\//.test(url)),'HTTP UI stays independent of engine modules');
   checks.push(transport+'/'+width+'/'+item.name);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('aslan-training-tagline-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
