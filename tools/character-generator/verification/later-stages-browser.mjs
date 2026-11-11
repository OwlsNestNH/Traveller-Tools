// Synthetic public-command saves only. No player/campaign data is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {buildAssignmentFixture,assignmentSetup,run,force} from './assignment-fixtures.mjs';
import {finalSheetFixture} from './final-sheet-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const out=new URL('./artifacts/',import.meta.url),key='traveller-character-generator.v1';
await mkdir(out,{recursive:true});
const fixtures=new Map();
function collect(session){
 for(let i=1;i<=session.events.length;i++){
  const candidate={...session,events:session.events.slice(0,i)},p=api({operation:'project',session:candidate});
  assert.equal(p.ok,true);
  if(!['identity','statistics','background'].includes(p.state.stage)&&!fixtures.has(p.state.stage))fixtures.set(p.state.stage,{session:candidate,state:p.state});
 }
}
const term=buildAssignmentFixture();collect(term.session);collect(run(term,'leave-career').session);
let educated=force(assignmentSetup('later-theme-university'),'precareer',{id:'core.university'},[6,6]);
educated=run(educated,'education-skill',{name:'Admin'});educated=run(educated,'education-skill',{name:'Medic'});
educated=force(educated,'education-event',{},[1,4]);educated=force(educated,'education-graduation',{},[6,6]);collect(educated.session);
collect(finalSheetFixture().session);
collect(force(fixtures.get('survival'),'survival-check',{},[6,6]).session);
collect(force(fixtures.get('survival'),'survival-check',{},[1,1]).session);
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const errors=[],checks=[],ready=page=>page.waitForFunction(()=>document.body.dataset.stage&&!document.querySelector('#export').disabled);
const saved=page=>page.evaluate(key=>localStorage.getItem(key),key);
async function load(page,fixture){await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});await page.reload();await ready(page);}
async function fit(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' page overflow');assert.deepEqual(await page.locator('dialog[open],.training-information:popover-open').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.id)),[],label+' dialog overflow');}
async function dark(page,selector){const c=await page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {scheme:s.colorScheme,background:s.backgroundColor,color:s.color}});assert.equal(c.scheme,'dark',selector+' dark scheme');assert.notEqual(c.background,'rgb(255, 255, 255)',selector+' no white panel');assert.notEqual(c.color,'rgb(21, 44, 66)',selector+' no light-theme ink');}
async function photo(page,name){await page.screenshot({path:fileURLToPath(new URL('later-stages-'+name+'.png',out)),fullPage:true});}
try{
 for(const http of [false,true])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),label=(http?'http':'static')+'-'+width;
  page.on('pageerror',error=>errors.push(label+': '+error.message));page.setDefaultTimeout(15000);
  try{
   await page.goto(origin+(http?'/?api=local':'/'));await ready(page);
   await page.locator('.skip-link').focus();await dark(page,'.skip-link');assert.equal(await page.locator('.skip-link').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(6, 26, 40)');
   for(const [stage,fixture] of fixtures){
    await load(page,fixture);const before=await saved(page);
    assert.equal(await page.locator('header h1').textContent(),'CHARACTER BUILDER');
    assert.equal(await page.locator('header .lead').textContent(),'TRAVELLER RPG');
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).colorScheme),'dark');
    for(const selector of ['header','.toolbar','.layout','footer'])assert.ok(Math.abs((await page.locator(selector).boundingBox()).width-Math.min(1440,width-(width<=760?28:48)))<1,selector+' stable width '+stage+' '+label);
    for(const selector of ['#export','.file-button','#print','#simple-log-view','#log-view','#log-download','#new'])assert.equal(await page.locator(selector).isVisible(),true,selector+' persistent '+stage);
    for(const selector of ['#workspace','#sheet'])await dark(page,selector);
    await fit(page,stage+' '+label);
    await page.locator('#cancel-character').click();await dark(page,'#cancel-character-dialog');await page.keyboard.press('Escape');assert.equal(await saved(page),before);
    assert.equal(await page.locator('#cancel-character').evaluate(el=>document.activeElement===el),true);
    if(http&&[1440,390].includes(width)&&['precareer','career','training','benefits','education-skill','career-event','term-end','book-step','finish'].includes(stage)){await page.locator('h1').click();await photo(page,stage+'-'+width);}
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).colorScheme),'light');
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await page.locator('#sheet').evaluate(el=>getComputedStyle(el).color),'rgb(21, 44, 66)');
    assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(await page.locator('.toolbar').isVisible(),false);
    await page.emulateMedia({media:'screen'});assert.equal(await saved(page),before);
    checks.push(label+' '+stage+' dark/toolbar/cancel/print/state');
   }
   // Read-only overlays, keyboard dismissal and repeated open/close retain the saved character.
   await load(page,fixtures.get('career'));
   const before=await saved(page);
   for(const [trigger,dialog,close] of [['#simple-log-view','#simple-action-log','[data-simple-log-close]'],['#log-view','#full-action-log','[data-log-close]'],['.career-info-trigger','#career-info-dialog','[data-career-info-close]']]){
    const opener=page.locator(trigger).first();await opener.click();await page.locator(dialog).waitFor({state:'visible'});await dark(page,dialog);await fit(page,dialog);
    await page.keyboard.press('Escape');assert.equal(await opener.evaluate(el=>document.activeElement===el),true);
    await opener.click();await page.locator(close).click();assert.equal(await saved(page),before);
   }
   await load(page,fixtures.get('training'));await page.locator('.training-info-trigger').first().click();await dark(page,'.training-information:popover-open');await fit(page,'training information');await page.keyboard.press('Escape');
   await load(page,fixtures.get('finish'));await page.locator('[data-action=open-character-sheet]').click();await dark(page,'#final-character-sheet');await fit(page,'final sheet');
   if(http&&[1440,390].includes(width))await photo(page,'final-sheet-'+width);
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('#final-character-sheet').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');assert.equal(await page.locator('#final-sheet-content').isVisible(),true);await page.emulateMedia({media:'screen'});await page.keyboard.press('Escape');
   // A real stage transition must keep the header/toolbar and reject a repeated command.
   await load(page,fixtures.get('precareer'));await page.locator('[data-action=skip-precareer]').evaluate(el=>{el.click();el.click();});await page.locator('body[data-stage=career]').waitFor();await ready(page);
   assert.equal(JSON.parse(await saved(page)).events.length,fixtures.get('precareer').session.events.length+1);
   const progressed=await saved(page);await page.reload();await ready(page);assert.equal(await saved(page),progressed);await dark(page,'#workspace');
   checks.push(label+' dialogs/final-print/repeated-transition/reload');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('later-stages-results.json',out),JSON.stringify({stages:[...fixtures.keys()],checks,errors},null,2));console.log(JSON.stringify({stages:[...fixtures.keys()],checks:checks.length,errors}));
}catch(error){await writeFile(new URL('later-stages-failure.json',out),JSON.stringify({checks,errors,error:error.message,stack:error.stack},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
