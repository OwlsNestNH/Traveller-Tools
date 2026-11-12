import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {createServer} from '../server.mjs';import {project,exportSession} from '../engine/session.mjs';
import {aslanSetup,aslanEvent,run,force,settle} from './aslan-officer-fixtures.mjs';import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url))),staticOrigin='https://aslan-events.test',key='traveller-character-generator.v1';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
function career(id,assignment,seed=''){let r=aslanSetup('event-outcomes-'+id+seed);r=settle(id==='aslan.outcast'?run(r,'career',{id,assignment}):force(r,'career',{id,assignment},[6,6]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));return r;}
function life(row){for(let seed=0;seed<100;seed++){const r=aslanEvent(career('aslan.military','warrior',seed),7);if(r.log.at(-1).rolls.find(x=>x.label.startsWith('aslan.life-events'))?.total===row)return r;}throw Error('No life event fixture');}
const fixtures=[
 {name:'dishonoured',r:life(11),action:'resolve-aslan-dishonoured',selector:'[data-skill="Advocate"]',check:s=>assert.equal(s.character.aslanDefences.length,1)},
 {name:'territory',r:life(4),action:'resolve-aslan-territory',prepare:async page=>{await page.locator('#aslan-territory-skill').selectOption('Diplomat');await page.locator('#aslan-territory-landless').check();},check:s=>assert.equal(s.character.aslanTerritoryChallenges[0].skill,'Diplomat')},
 {name:'outcast',r:aslanEvent(career('aslan.outcast','labourer'),10),action:'record-aslan-outcast-opportunity',check:s=>{assert.equal(s.character.aslanOutcastOpportunities.length,1);assert.equal(s.forcedCareer,null);}},
 {name:'secret',r:run(aslanEvent(career('aslan.guardian','priest'),3),'choose-effect',{index:1}),action:'retain-aslan-secret',check:s=>{assert.equal(s.character.aslanSecrets.length,1);assert.equal(s.character.aslanSecrets[0].spendable,false);}},
 {name:'wanderer',r:aslanEvent(career('aslan.wanderer','scout'),12),action:'award-aslan-wanderer-land',check:s=>{assert.equal(s.character.aslanLandholds.length,1);assert.equal(s.character.aslanLandholds[0].detailsStatus,'pending');}},
 {name:'rite',r:force(buildAslanOriginFixture({gender:'male',stage:'aslan-rite'}),'roll-aslan-rite',{},[2,2]),action:'record-aslan-rite-equipment',check:s=>{assert.equal(s.character.equipmentCredits[0].remaining,5000);assert.equal(s.character.cash,0);}}
];
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const httpOrigin='http://127.0.0.1:'+server.address().port;
const errors=[];let browser;
const out=fileURLToPath(new URL('./artifacts/',import.meta.url));await mkdir(out,{recursive:true});
async function current(page){return project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)));}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const http of [false,true])for(const width of [1440,390])for(const f of fixtures){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  try{
   await context.route('**/*',async route=>{const u=new URL(route.request().url());if(http&&u.origin===httpOrigin)return route.continue();if(u.origin!==staticOrigin)return route.abort();if(u.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});const file=path.resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))return route.abort();return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});});
   const page=await context.newPage(),engineRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/engine/'))engineRequests.push(r.url());});
   await page.goto(http?httpOrigin+'/?api=local':staticOrigin+'/tools/character-generator/');await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(f.r.session)});await page.reload();
   const selector=f.name==='rite'?'#aslan-family-continue':'[data-action="'+f.action+'"]'+(f.selector??'');await page.locator(selector).waitFor();
   // Source review is reversible, presentation-only, and cannot hide the typed controls after reload.
   const before=await current(page);await page.locator('[data-action=aslan-source-review]').click();await page.locator('[data-action=aslan-event-choices]').click();assert.equal((await current(page)).revision,before.revision);await page.locator(selector).waitFor();
   await page.locator('[data-action=aslan-source-review]').click();await page.reload();await page.locator(selector).waitFor();
   if(f.prepare)await f.prepare(page);if(f.name==='rite')await page.locator(selector).evaluate(button=>{button.click();button.click();});else await page.locator(selector).dblclick();
   await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)>revision,before.revision);
   const after=await current(page);assert.equal(after.revision,before.revision+1);f.check(after.state);if(f.name==='rite'){assert.equal(after.state.stage,'aslan-rite-result');assert.equal(after.state.character.equipmentCredits.length,1);assert.match(await page.locator(selector).innerText(),/Continue to pre-career/);}else assert.equal(await page.locator(selector).count(),0);
   await page.reload();await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)===revision,after.revision);assert.deepEqual((await current(page)).state,after.state);
   if(f.name==='secret'){const panel=page.locator('#sheet .sheet-section').filter({has:page.getByRole('heading',{name:'Future conditions to review',exact:true})});await panel.waitFor({state:'visible'});assert.match(await panel.innerText(),/If you expose the secret, gain 1 Enemy/);assert.doesNotMatch(await panel.innerText(),/conditional-future|expose-secret|[{}]/);await panel.screenshot({path:out+'aslan-family-player-context-secret-'+width+'-'+(http?'http':'static')+'.png'});assert.deepEqual((await current(page)).state,after.state);}
   if(f.name==='rite'){await page.locator(selector).evaluate(button=>{button.click();button.click();});await page.waitForFunction(revision=>Number(document.querySelector('#workspace')?.dataset.revision)===revision,after.revision+1);const done=await current(page);assert.equal(done.state.stage,'precareer');assert.deepEqual(done.state.character.equipmentCredits,after.state.character.equipmentCredits);assert.equal(done.state.character.cash,0);assert.deepEqual(done.log.at(-1).rolls,[]);await page.locator('#precareer-dialog[open]').waitFor();}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,f.name+' overflow');if(http)assert.deepEqual(engineRequests,[],'HTTP must not import engine');
   console.log('PASS '+f.name+' '+width+' '+(http?'HTTP':'static')+' click/double-click/reload/source-back');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
