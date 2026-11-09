import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSession,execute,exportSession,project} from '../engine/session.mjs';
import {buildScholarChoiceFixture} from './zhodani-choice-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const key='traveller-character-generator.v1',out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const old=execute(createSession('old-zhodani-browser'),{type:'setup',payload:{species:'zhodani',name:'Preserved old Traveller'}}).session;
const raw=JSON.stringify({...old,rulesRevision:'character-preview-2026-11-09.17'});
// Choose an unmodified deterministic seed with native childhood training.
let seed;for(let i=0;i<100;i++){let r={session:createSession('public-native-'+i)};for(const type of ['setup','roll-statistics','accept-statistics'])r=execute(r.session,{type,payload:type==='setup'?{species:'zhodani'}:{}});if(r.state.stage==='psionic-training'){seed='public-native-'+i;break;}}assert.ok(seed);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;const checks=[],errors=[];
const state=async page=>project(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key))).state;
const ready=page=>page.waitForFunction(()=>!document.querySelector('#new').disabled);
async function reload(page){await ready(page);const before=await state(page),saved=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#workspace')?.dataset.revision??0)>0);await ready(page);assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
 for(const width of [1440,320])for(const transport of ['', '?api=local'])for(const optional of [false,true]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/'+transport);await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(createSession(seed))});await page.reload();await page.getByRole('heading',{name:'Start your Traveller'}).waitFor();
   assert.equal(await page.locator('[name=species] option').count(),5);await page.locator('[name=species]').selectOption('zhodani');
   await page.locator('#setup-optional-settings>summary').click();assert.equal(await page.locator('[name=zhodaniPsi]').count(),1);
   if(optional){await page.locator('[name=zhodaniPsi]').check();await page.getByRole('button',{name:'Begin character',exact:true}).click();assert.match(await page.locator('#message').innerText(),/needs GM mode/);await page.locator('[name=gm]').check();}
   await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.getByRole('button',{name:'Roll six characteristics'}).click();await page.getByRole('button',{name:'Keep these characteristics'}).click();await page.getByRole('heading',{name:'Explore your psionic talents'}).waitFor();
   let s=await state(page);assert.equal(s.character.species,'zhodani');assert.equal(s.config.zhodaniPsi,optional);assert.equal(s.config.gm,optional);assert.equal(typeof s.character.stats.PSI,'number');if(optional)assert.ok(s.character.stats.PSI>=9);assert.equal(await page.locator('#sheet .stat').filter({hasText:'PSI'}).count(),1);
   await page.locator('[data-action=learn-talent][data-talent=Telepathy]').click();await ready(page);await reload(page);await page.locator('[data-action=learn-talent][data-talent=Clairvoyance]').click();await ready(page);await page.getByRole('button',{name:'Finish this training period'}).click();await page.getByRole('heading',{name:'Before your career'}).waitFor();await reload(page);
   // Actual public transport resumes a source-earned speciality choice mid-award.
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(buildScholarChoiceFixture().session)});await page.reload();await page.locator('#award-skill').waitFor();await page.locator('#award-skill').fill('Science (physics)');await page.locator('[data-action=choose-skill]').click();await ready(page);await reload(page);
   await page.locator('#award-skill').fill('Science (PHYSICS)');await page.locator('[data-action=choose-skill]').click();await ready(page);assert.match(await page.locator('#message').innerText(),/different|distinct|already/i);
   await page.locator('#award-skill').fill('Science (biology)');await page.locator('[data-action=choose-skill]').click();await ready(page);s=await state(page);assert.ok(s.character.skills['Science (physics)']>=1);assert.ok(s.character.skills['Science (biology)']>=1);await reload(page);
   // Old Zhodani histories stay byte-identical and read only in both transports.
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await page.locator('#recovery-inspect').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);await page.locator('#recovery-inspect').click();assert.equal(await page.locator('#legacy-actions>li').count(),1);
   const pending=page.waitForEvent('download');await page.locator('#recovery-save').click();const download=await pending,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.deepEqual(Buffer.concat(chunks),Buffer.from(raw));
   await page.reload();await page.locator('#recovery-inspect').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const name='release-scope-'+width+(transport?'-http':'-static')+(optional?'-gm':'-native');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});checks.push({name,pass:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('release-scope-browser-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
