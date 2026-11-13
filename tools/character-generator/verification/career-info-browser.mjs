import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {api} from '../engine/session.mjs';
import {careerInfoFixture} from './career-info-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const key='traveller-character-generator.v1',origin=process.env.CHARACTER_CAREER_INFO_URL||'http://127.0.0.1:'+server.address().port+'/',errors=[],checks=[],catalog=api({operation:'catalog'});
const ready=page=>page.waitForFunction(()=>!document.querySelector('#export').disabled);
const snapshot=page=>page.evaluate(()=>({storage:JSON.stringify({...localStorage}),url:location.href,history:history.length,revision:document.querySelector('#workspace').dataset.revision,stage:document.body.dataset.stage,notes:document.querySelector('#character-notes')?.value,workspace:document.querySelector('#workspace').innerHTML}));
try{
 for(const transport of ['static','http'])for(const width of [1440,900,320]){
  if(process.env.CHARACTER_CAREER_INFO_URL&&transport==='http')continue;
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload'||dialog.message()==='Load this character in place of the current browser draft? Save your current character first.')await dialog.accept();else{errors.push('Unexpected dialog: '+dialog.message());await dialog.dismiss();}});let requests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/v1')requests++;});
  await page.goto(origin+(transport==='http'?'?api=local':''));await page.locator('#setup-form').waitFor();await ready(page);
  for(const [species,gender,culture] of [['human','female','native'],['aslan','male','native'],['aslan','female','native'],['vargr','female','native'],['aezorgh','female','native']]){
   console.log('Checking career info:',transport,width,species,gender,culture);const fixture=careerInfoFixture(species,gender,culture);
   await page.locator('#import').setInputFiles({name:'career-info.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture.session))});await page.waitForFunction(({key,seed})=>JSON.parse(localStorage.getItem(key)||'null')?.seed===seed,{key,seed:fixture.session.seed});await page.locator('body[data-stage="career"]').waitFor();await ready(page);
   await page.locator('#notes-connections > summary').click();await page.locator('#character-notes').fill('Keep this unsaved note');const before=await snapshot(page),requestsBefore=requests;
   assert.equal(await page.locator('[data-career-info]').count(),fixture.state.careerChoices.length);
   for(const career of fixture.state.careerChoices){
    const trigger=page.locator('[data-career-info="'+career.id+'"]'),choice=page.locator('[data-action="select-career"][data-id="'+career.id+'"]');
    const layout=await trigger.evaluate(n=>{const b=n.getBoundingClientRect(),choice=n.nextElementSibling,c=choice.getBoundingClientRect(),label=choice.querySelector('strong').getBoundingClientRect();return {width:b.width,height:b.height,right:b.right,choiceLeft:c.left,precedes:!!(n.compareDocumentPosition(choice)&Node.DOCUMENT_POSITION_FOLLOWING),inside:b.left>=c.left&&b.right<=c.right&&b.top>=c.top&&b.bottom<=c.bottom,belowLabel:b.top>=label.bottom};});assert.ok(layout.width>=44&&layout.height>=44);assert.equal(layout.precedes,true,'Information precedes its career in keyboard and DOM order');if(species==='human'&&width>=851){assert.equal(layout.inside,true,'Desktop information control stays within its career card');assert.equal(layout.belowLabel,true,'Information never obscures the career name');}else assert.ok(layout.right<=layout.choiceLeft,'Information precedes its career visually');if(species==='human')assert.equal(await choice.locator('strong').evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const text=range.getBoundingClientRect(),button=n.closest('button').getBoundingClientRect();return text.left>=button.left&&text.right<=button.right;}),true,'Career names stay inside their controls at every viewport');assert.equal(await choice.isDisabled(),!!career.disabled);
    await trigger.focus();await trigger.press('Enter');await page.locator('#career-info-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#career-info-title').innerText(),career.name);assert.equal(await page.locator('#career-info-title').evaluate(n=>n===document.activeElement),true);
    assert.deepEqual(await page.locator('#career-info-specialties li').allTextContents(),career.assignments.map(a=>a.name+(a.disabled?' (unavailable)'+(a.reason?': '+a.reason:''):'')));
    assert.equal(await page.locator('#career-info-source').innerText(),catalog.sources[career.source].title+' · p. '+career.page);
    assert.equal(await page.locator('#career-info-availability').textContent(),career.reason??'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.keyboard.press('Tab');assert.equal(await page.locator('[data-career-info-close]').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('[data-career-info-close]').evaluate(n=>n===document.activeElement),true);
    if(transport==='static'&&species==='aslan'&&gender==='female'&&culture==='native'&&career.id==='aslan.spacer')await page.screenshot({path:fileURLToPath(new URL('career-info-dialog-'+width+'.png',out)),fullPage:true});
    await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
    await trigger.press('Space');await page.locator('[data-career-info-close]').click();assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);assert.deepEqual(await snapshot(page),before);
   }
   assert.equal(requests,requestsBefore,'Reading help never calls the rules API');
   if(transport==='static'&&species==='human')await page.screenshot({path:fileURLToPath(new URL('career-info-list-'+width+'.png',out)),fullPage:true});
   // The existing selection/back flow still chooses an assignment without committing an entry.
   const career=fixture.state.careerChoices.find(c=>!c.disabled),assignment=career.assignments.find(a=>!a.disabled);
   await page.locator('[data-action="select-career"][data-id="'+career.id+'"]').click();await page.locator('#career-assignment').selectOption(assignment.id);await page.locator('[data-action="career-list"]').click();assert.equal(await page.locator('[data-career-info]').count(),fixture.state.careerChoices.length);assert.equal(await page.locator('#character-notes').inputValue(),'Keep this unsaved note');
   const saved=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await page.locator('body[data-stage="career"]').waitFor();await ready(page);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);assert.equal(await page.locator('#career-info-dialog').isVisible(),false);
   checks.push({transport,width,species,gender,culture,careers:fixture.state.careerChoices.length,readOnly:true,keyboard:true,selectionBack:true,reload:true});
  }
  assert.equal(requests>0,transport==='http');await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('career-info-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
