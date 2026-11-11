import {openLiveRecord} from './journey-browser-helpers.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,project,exportSession} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1',checks=[],errors=[];
await mkdir(out,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const saved=p=>p.evaluate(key=>localStorage.getItem(key),key),ready=p=>p.waitForFunction(()=>!document.querySelector('#export').disabled);
function fixture(){let s=createSession('optional-cha-browser');for(const[type,payload]of [['setup',{species:'aezorgh',name:'Synthetic Aezorgh preview'}],['roll-statistics',{}],['accept-statistics',{}],['background',{skills:['Admin']}]])s=execute(s,{type,payload}).session;return s;}
try{
 for(const transport of ['static','http'])for(const width of [1440,320]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:exportSession(fixture())});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:'+server.address().port+'/'+(transport==='http'?'?api=local':''));await ready(p);
   assert.equal(project(JSON.parse(await saved(p))).state.character.stats.CHA,undefined);assert.equal(await p.locator('#sheet .code').filter({hasText:/^CHA$/}).count(),0);
   await openLiveRecord(p);await p.locator('#additional-characteristics').evaluate(el=>el.open=true);await p.locator('#extra-stat').selectOption('CHA');const before=await saved(p);
   await p.locator('#additional-characteristics > summary').click();assert.equal(await saved(p),before);await p.locator('#additional-characteristics > summary').click();
   if(transport==='static')await p.locator('#additional-characteristics').screenshot({path:fileURLToPath(new URL('aezorgh-optional-cha-before-'+width+'.png',out))});
   await p.getByRole('button',{name:'Add this characteristic',exact:true}).click();await p.waitForFunction(({key,before})=>localStorage.getItem(key)!==before,{key,before});await ready(p);
   const after=await saved(p),r=project(JSON.parse(after));assert.equal(r.state.character.stats.CHA,Math.floor(r.state.character.stats.SOC/2));assert.deepEqual(r.log.at(-1).rolls,[]);assert.equal(await p.locator('#extra-stat option[value=CHA]').count(),0);assert.equal(await p.locator('#sheet .code').filter({hasText:/^CHA$/}).count(),1);
   await p.reload();await ready(p);assert.equal(await saved(p),after);assert.equal(project(JSON.parse(after)).state.character.stats.CHA,r.state.character.stats.CHA);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(transport==='static')await p.screenshot({path:fileURLToPath(new URL('aezorgh-optional-cha-after-'+width+'.png',out)),fullPage:true});checks.push({transport,width});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('aezorgh-optional-cha-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
