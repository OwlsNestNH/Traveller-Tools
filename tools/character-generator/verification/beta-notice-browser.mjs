// Header beta notice is read-only and usable on every character stage.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const checks=[],errors=[];
const expected=[
 'Source-assisted beta. Some outcomes need your books and referee.',
 'Beta limits & referee steps',
 'Build with the implemented rules and keep unsupported consequences with your referee. Some steps require your books and explicit source confirmation. This is not a fully automated or independently rules-certified generator.',
 'Human, Aslan, Vargr and Aezorgh choices are available. Zhodani are deferred. A listed career does not mean every event or benefit is automated.',
 'Some Companion buyouts, Aslan career permissions, clan or land awards, unusual Vargr psionic access and specialist benefits still stop for a source decision.',
 'Cross-book eligibility, unprinted outcomes, existing history, equipment details and some Aezorgh social-statistic consequences need a referee ruling.',
 'A manual source step applies only the supported effects you enter. Notes do not automate future modifiers, permissions or other unimplemented consequences. Keep those separately with your referee.',
 'You can save the character and its full action log at a stop. Export backups before updating: older rules revisions can be recovered unchanged and read only, but cannot continue under changed rules.'
];
const snapshot=page=>page.evaluate(()=>({storage:JSON.stringify({...localStorage}),url:location.href,history:history.length,stage:document.body.dataset.stage,form:document.querySelector('#setup-form')?[...new FormData(document.querySelector('#setup-form'))]:null,workspace:document.querySelector('#workspace').textContent}));
const screenshot=(page,name)=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});
try{
 for(const transport of ['static','http'])for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));let apiRequests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/v1')apiRequests++;});
  const url=process.env.CHARACTER_BETA_URL||'http://127.0.0.1:'+server.address().port+'/';
  if(process.env.CHARACTER_BETA_URL&&transport==='http'){await page.close();continue;}
  await page.goto(url+(transport==='http'?'?api=local':''));await page.locator('#setup-form').waitFor();
  const trigger=page.locator('#beta-notice-open'),dialog=page.locator('#beta-notice'),close=page.locator('#beta-notice-close');
  assert.equal(await page.locator('header #beta-notice-open').count(),1);assert.equal(await page.locator('body>.notice[role=note]').count(),0);assert.equal(await dialog.isVisible(),false);
  const target=await trigger.boundingBox();assert.ok(target.width>=44&&target.height>=44);assert.ok(target.x>=0&&target.x+target.width<=width);
  await page.locator('[name=name]').fill('Unsaved beta check');await page.locator('[name=homeworld]').fill('Test homeworld');
  for(const stage of ['identity','statistics']){
   if(stage==='statistics'){await page.getByRole('button',{name:'Begin character',exact:true}).click();await page.locator('body[data-stage=statistics]').waitFor();}
   const before=await snapshot(page),requestsBefore=apiRequests;
   for(const dismiss of ['escape','close','escape']){
    await trigger.focus();await trigger.press(dismiss==='close'?'Space':'Enter');await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.getAttribute('aria-labelledby'),'beta-notice-title');assert.equal(await page.locator('#beta-notice-title').evaluate(n=>n===document.activeElement),true);
    assert.deepEqual(await page.locator('#beta-notice-copy>p,#beta-notice-copy>h3,#beta-notice-copy li').allTextContents(),expected);
    assert.equal(await page.locator('#beta-notice details').count(),0,'All notice content is expanded');
    const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);assert.ok(b.y>=0&&b.y+b.height<=900);assert.ok(Math.abs(b.x+b.width/2-width/2)<2);assert.ok(Math.abs(b.y+b.height/2-450)<2);
    assert.equal(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
    await page.keyboard.press('Tab');assert.equal(await close.evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await close.evaluate(n=>n===document.activeElement),true);
    await dialog.evaluate(n=>n.scrollTop=n.scrollHeight);assert.equal(await page.locator('#beta-notice-copy>p:last-child').evaluate(n=>{const r=n.getBoundingClientRect(),d=n.closest('dialog').getBoundingClientRect();return r.bottom<=d.bottom&&r.top>=d.top;}),true);
    const cb=await close.boundingBox();assert.ok(cb.y>=b.y&&cb.y+cb.height<=b.y+b.height,'Close remains accessible when notice scrolls');
    if(transport==='static'&&[1440,390,320].includes(width)&&dismiss==='close'){await dialog.evaluate(n=>n.scrollTop=0);await screenshot(page,'beta-notice-'+stage+'-dialog-'+width);}
    if(dismiss==='escape')await page.keyboard.press('Escape');else await close.click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!document.body.classList.contains('beta-notice-open'));
    assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');assert.deepEqual(await snapshot(page),before);assert.equal(apiRequests,requestsBefore,'Notice makes no rules API requests');
   }
   if(transport==='static'&&[1440,390,320].includes(width)){await page.evaluate(()=>scrollTo(0,0));await screenshot(page,'beta-notice-'+stage+'-closed-'+width);}
  }
  const saved=await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1'));await page.reload();await page.locator('body[data-stage=statistics]').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('traveller-character-generator.v1')),saved);assert.equal(await dialog.isVisible(),false);
  // A later, light-themed generation stage retains the same header information.
  await page.locator('[data-action=roll-statistics]').click();await page.locator('[data-action=accept-statistics]').waitFor();await page.locator('[data-action=accept-statistics]').click();await page.waitForFunction(()=>document.body.dataset.stage!=='statistics');
  const laterBefore=await snapshot(page);const colors=await trigger.evaluate(n=>({color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor}));assert.notEqual(colors.color,colors.background,'Beta trigger remains legible on light-themed stages');await trigger.click();await dialog.waitFor({state:'visible'});
  await page.emulateMedia({media:'print'});assert.equal(await dialog.isVisible(),false);await page.emulateMedia({media:'screen'});await dialog.waitFor({state:'visible'});await close.click();await page.waitForFunction(()=>!document.body.classList.contains('beta-notice-open'));assert.deepEqual(await snapshot(page),laterBefore);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(apiRequests>0,transport==='http');checks.push({transport,width,stages:['identity','statistics','later'],keyboard:true,contentPreserved:true,noMutation:true,saveReload:true});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('beta-notice-results.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
