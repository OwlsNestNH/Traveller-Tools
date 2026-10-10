import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as S from '../js/state.mjs';
import {recordWorldOverride} from '../js/world-change-history.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const root=new URL('../verification-artifacts/',import.meta.url),artifacts=fileURLToPath(root);await mkdir(artifacts,{recursive:true});
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',key='traveller-trade-route-calculator:v1';
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const cases=[],errors=[];let activeContext=null;
function fixture(){
 const s=S.initial(),world=(x,name)=>({id:x+',0',x,y:0,name,sector:'Test',hex:`0${x+1}01`,uwp:'A788899-C',zone:'Safe',raw:{UWP:'A788899-C',Zone:'',PBG:'703'}});
 Object.assign(s,{initialized:true,bank:'100000',actual:'0,0',worlds:Object.fromEntries([world(0,'History Origin'),world(1,'History Destination')].map(w=>[w.id,w])),route:['0,0','1,0']});
 s.snapshots=[{id:'saved-market',kind:'supplier',worldId:'0,0',hours:0,startedHours:0,offers:[{id:'saved-offer',commodity:'11',description:'Historic offer',remaining:'2',unitPrice:'100',expired:false,audit:{frozenUWP:'A788899-C'}}]}];
 let state=S.transition(s,'World override',x=>recordWorldOverride(x,'1,0',{uwp:'A788899-D',zone:'Safe',fuelOverride:null,accessibleWater:false,reason:'TL before jump'},core));
 const source=state.events.find(e=>e.worldChangeAudit),prepared=S.prepareJump(state,()=>({dice:[2,2,2,2,2,2],total:12}));
 state=S.transition(prepared.state,'Jump: History Origin → History Destination',x=>S.commitJump(x,{attemptId:prepared.attempt.id,elapsed:160}));
 state=S.transition(state,'World override',x=>recordWorldOverride(x,'1,0',{uwp:'B788899-D',zone:'Amber',fuelOverride:true,accessibleWater:true,reason:'Later unrelated world fields'},core));
 state=S.transition(state,'Manual deposit',x=>S.deposit(x,10,'Later transaction'));
 return {state,sourceId:source.id};
}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const action=(page,name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first();
const close=page=>page.locator('#modal').waitFor({state:'hidden'});
async function start(state,width=1440){
 const context=activeContext=await browser.newContext({viewport:{width,height:1000}});context.setDefaultTimeout(10000);await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await context.route('https://travellermap.com/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path.endsWith('/jumpworlds')?{Worlds:[]}:path.endsWith('/universe')?{Sectors:[]}:path.endsWith('/metadata')?{Subsectors:[]}:''});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();return {context,page};
}
async function finish(context,name){cases.push(name);await context.tracing.stop({path:artifacts+'/'+name+'.zip'});await context.close();activeContext=null;}
async function history(page){await action(page,'tab','History').click();await action(page,'history-filter','World Changes').click();}
async function details(page,sourceId){await action(page,'event-audit',sourceId).click();}
async function preview(page,sourceId){await details(page,sourceId);await action(page,'world-field-revert',sourceId+'|techLevel').click();await page.getByRole('heading',{name:'Restore previous tech level',exact:true}).waitFor();}
try{
 for(const width of [1440,390,320]){
  const {state,sourceId}=fixture(),{context,page}=await start(state,width),before=await read(page);await history(page);
  assert.equal(await page.locator('.action-history tbody tr').count(),2,'Audit/action pairs show once');assert.match(await page.locator('.action-history').textContent(),/Tech level: C → D/);
  await preview(page,sourceId);assert.match(await page.locator('#modal-body').textContent(),/History Destination/);assert.match(await page.locator('#modal-body').textContent(),/may itself be an override/);assert.deepEqual(await read(page),before);
  await page.locator('#modal-cancel').click();await close(page);assert.deepEqual(await read(page),before);
  await preview(page,sourceId);await page.screenshot({path:artifacts+`/world-history-${width}-preview.png`,fullPage:true});
  await page.locator('#modal-submit').dblclick();await close(page);
  const after=await read(page),world=after.worlds['1,0'];assert.equal(after.revision,before.revision+1,'Repeated click commits once');assert.equal(world.overrideUWP,'B788899-C');assert.equal(world.zone,'Amber');assert.equal(world.fuelOverride,true);assert.equal(world.accessibleWater,true);
  for(const field of ['actual','hours','bank','route','routeIndex','ship','lots','contracts','policies','ledger','snapshots','jumpAttempts'])assert.deepEqual(after[field],before[field],field+' remains unchanged');
  assert.deepEqual(after.events.slice(0,before.events.length),before.events);assert.equal(after.undo.length,before.undo.length+1);assert.equal(after.events.findLast(e=>e.worldChangeAudit).worldChangeAudit.sourceEventId,sourceId);
  await details(page,sourceId);assert.equal(await action(page,'world-field-revert',sourceId+'|techLevel').count(),0);assert.match(await page.locator('#modal-body').textContent(),/later change already updated/);await page.locator('#modal-close').click();await close(page);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.deepEqual(await read(page),after);assert.equal(await page.locator('.screen-section-heading .mono').textContent(),'B788899-C');
  await history(page);assert.equal(await page.locator('.action-history tbody tr').count(),3);await page.screenshot({path:artifacts+`/world-history-${width}-retained.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page remains within viewport');
  await action(page,'undo').click();assert.deepEqual((await read(page)).worlds,before.worlds);assert.equal((await read(page)).events.length,after.events.length+1,'Undo retains both audits');
  await finish(context,'world-history-'+width);
 }
 {
  const {state,sourceId}=fixture(),{context,page}=await start(state);await history(page);await action(page,'undo').click();await action(page,'undo').click();
  const protectedState=await read(page);assert.equal(S.jumpUndoEligibility(protectedState).allowed,false);assert.equal(await action(page,'undo').isDisabled(),false);
  await action(page,'undo').click();assert.match(await page.locator('#message').textContent(),/Cannot undo this protected jump.*later campaign change.*Nothing was changed/);assert.deepEqual(await read(page),protectedState);await page.screenshot({path:artifacts+'/world-history-protected-warning.png',fullPage:true});
  await preview(page,sourceId);await page.locator('#modal-submit').click();await close(page);const corrected=await read(page);assert.equal(corrected.worlds['1,0'].overrideUWP,undefined);assert.equal(corrected.actual,'1,0');assert.deepEqual(corrected.ledger,protectedState.ledger);assert.deepEqual(corrected.jumpAttempts,protectedState.jumpAttempts);
  await finish(context,'world-history-protected-jump');
 }
 {
  const {state,sourceId}=fixture(),{context,page}=await start(state);await history(page);const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto(base);await other.getByText(/Read-only/).first().waitFor();await history(other);await details(other,sourceId);
  assert.match(await other.locator('#modal-body').textContent(),/History Destination/);assert.equal(await action(other,'world-field-revert',sourceId+'|techLevel').isDisabled(),true);assert.deepEqual(await read(other),state);
  await other.locator('#modal-close').click();await preview(page,sourceId);await other.locator('#takeover').click();await other.getByText('Editing in this tab',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#modal-submit').disabled);assert.match(await page.locator('#modal-error').textContent(),/Editing moved/);assert.deepEqual(await read(page),state);
  await page.screenshot({path:artifacts+'/world-history-takeover.png',fullPage:true});await finish(context,'world-history-readonly-takeover');
 }
 {
  const {state}=fixture();state.events.push({id:'old-world-edit',label:'World override',hours:0,world:'0,0'});const {context,page}=await start(state);await history(page);await details(page,'old-world-edit');assert.match(await page.locator('#modal-body').textContent(),/older entry.*Individual restore is unavailable/);assert.equal(await page.locator('[data-action="world-field-revert"]').count(),0);assert.deepEqual(await read(page),state);await finish(context,'world-history-legacy');
 }
 assert.deepEqual(errors,[]);console.log('PASS: World Changes filters, semantic TL restore, later fields/economics/jumps preserved, double click/cancel/reload/Undo, protected warning, read-only/takeover, legacy evidence and responsive history.');
}finally{
 if(activeContext){const page=activeContext.pages()[0];await page?.screenshot({path:artifacts+'/world-history-failure.png',fullPage:true}).catch(()=>{});await activeContext.tracing.stop({path:artifacts+'/world-history-failure.zip'}).catch(()=>{});}
 await writeFile(root.pathname+'world-history-report.json',JSON.stringify({commit:process.env.TRAVELLER_COMMIT||null,cases,errors},null,2));await browser.close();
}
