// CI-only browser coverage of the actual release files and their navigation.
// Requests are fulfilled from the candidate checkout; no live user data or
// external counters are touched, including in the simulated published origin.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url))),out=new URL('./artifacts/',import.meta.url);
await mkdir(out,{recursive:true});
const types={'.png':'image/png','.svg':'image/svg+xml','.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_CHANNEL?{channel:process.env.CHARACTER_BROWSER_CHANNEL}:{})});
const checks=[],errors=[],unexpected=[],layoutMetrics=[],startupDiagnostics=[],requestFailures=[];
const check=(label,value)=>{assert.ok(value,label);checks.push(label);};
async function waitForCharacter(page,label){
 // Surface startup errors before a missing-heading timeout. In particular,
 // routed fixture origins still obey the browser's secure-context rules.
 const inspect=()=>page.evaluate(()=>({url:location.href,secureContext:window.isSecureContext,randomUUID:typeof globalThis.crypto?.randomUUID,message:document.querySelector('#message')?.textContent??'',messageIsError:document.querySelector('#message')?.classList.contains('error')??false,step:document.querySelector('#step-title')?.textContent??'',scripts:[...document.scripts].map(script=>script.src)}));
 try{
  await page.waitForURL(/\/tools\/character-generator\/$/);await page.waitForLoadState('domcontentloaded');
  const capability=await inspect();
  assert.equal(capability.secureContext,true,label+' requires a secure browser origin');
  assert.equal(capability.randomUUID,'function',label+' requires the real browser crypto.randomUUID');
  await page.waitForFunction(()=>document.querySelector('#step-title')||document.querySelector('#message')?.classList.contains('error'));
  const state=await inspect();startupDiagnostics.push({label,...state});
  assert.equal(state.messageIsError,false,label+' startup failed: '+state.message);
  await page.getByRole('heading',{name:'Start your Traveller',exact:true}).waitFor();
 }catch(error){
  startupDiagnostics.push({label,failure:error.message,...await inspect().catch(()=>({inspectionUnavailable:true}))});
  await page.screenshot({path:fileURLToPath(new URL('release-presentation-'+label+'-startup-failure.png',out)),fullPage:true}).catch(()=>{});
  throw error;
 }
}
try{
 for(const width of [1440,320])for(const published of [false,true]){
  const origin=published?'https://owlsnestnh.github.io':'https://character-beta.test',site=origin+'/Traveller-Tools/',tool=site+'tools/character-generator/',notesURL=site+'changes/character.html';
  const name=(published?'published':'preview')+'-'+width,hits=[],context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  context.on('requestfailed',request=>requestFailures.push({case:name,url:request.url(),error:request.failure()?.errorText}));
  context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===origin&&url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
   if(url.hostname==='img.shields.io')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20"/>'});
   if(url.hostname==='hits.sh'){hits.push(url.href);return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});}
   if(url.origin!==origin||!url.pathname.startsWith('/Traveller-Tools/')){unexpected.push(url.href);return route.abort();}
   const relative=decodeURIComponent(url.pathname.slice('/Traveller-Tools/'.length)),file=path.resolve(root,relative+(relative.endsWith('/')||!relative?'index.html':''));
   if(!file.startsWith(root+path.sep)){unexpected.push(url.href);return route.abort();}
   try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{unexpected.push(url.href);return route.fulfill({status:404,body:'Missing candidate file'});}
  });
  try{
   const page=await context.newPage();await page.goto(site);
   assert.deepEqual(await page.locator('main .tool-card h2').allTextContents(),['Nav Calculator','Traveller Tool Locker','Traveller Ship Operations — Beta','Character Generator - Beta','Traveller Vehicle Builder','Robot Builder - Beta','Ship Combat Alpha','Ship’s Log & Ledger']);
   const card=page.locator('.tool-card').filter({has:page.getByRole('heading',{name:'Character Generator - Beta',exact:true})});
   check(name+' home fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const launch=page.waitForEvent('popup');await card.getByRole('link',{name:'Open Character Generator',exact:true}).click();const editor=await launch;
   await waitForCharacter(editor,name+'-launch');assert.equal(editor.url(),tool);
   assert.equal(await editor.locator('#release-version').textContent(),'Beta 0.1');
   assert.deepEqual(await editor.locator('[name=species] option').evaluateAll(nodes=>nodes.map(node=>node.value)),['human','aslan','vargr','aezorgh']);
   const optional=editor.locator('#setup-optional-settings'),optionalSummary=optional.locator('summary');
   assert.equal(await optional.getAttribute('open'),null);assert.equal(await editor.locator('[name=extras][value=LCK]').isVisible(),false);assert.equal(await editor.locator('[name=gm]').isVisible(),true);
   assert.equal(await editor.locator('[name=boons]').inputValue(),'0');assert.equal(await editor.locator('[name=allocation]').isChecked(),true);assert.equal(await editor.locator('[name=minimumReroll]').isChecked(),true);
   assert.match(await optionalSummary.textContent(),/No optional extras · GM changes off/);check(name+' Begin remains visible with options closed',await editor.getByRole('button',{name:'Begin character',exact:true}).isVisible());
   const metrics=await editor.evaluate(()=>({stepTop:Math.round(document.querySelector('#workspace').getBoundingClientRect().top+scrollY),bodyFont:parseFloat(getComputedStyle(document.body).fontSize),toolbar:[...document.querySelectorAll('.toolbar>*')].map(el=>({height:el.getBoundingClientRect().height,font:parseFloat(getComputedStyle(el).fontSize)}))}));
   layoutMetrics.push({name,...metrics});assert.equal(metrics.bodyFont,18);assert.equal(metrics.toolbar.length,6);assert.ok(metrics.toolbar.every(control=>control.height>=54&&control.font>=16));if(width===320)assert.ok(metrics.stepTop<700,name+' first step starts before 700px');
   check(name+' optional disclosure large target',await optionalSummary.evaluate(el=>el.getBoundingClientRect().height>=44));
   await editor.screenshot({path:fileURLToPath(new URL('gui-simplicity-'+name+'-default.png',out)),fullPage:true});
   await optionalSummary.focus();await optionalSummary.press('Enter');assert.notEqual(await optional.getAttribute('open'),null);
   await editor.locator('#setup-gm-settings').evaluate(el=>el.open=true);await editor.locator('[name=gm]').check();assert.equal(await editor.locator('[name=extras][value=PSI]').isEnabled(),true);await editor.locator('#setup-optional-settings').evaluate(el=>el.open=true);await editor.locator('[name=extras][value=LCK]').check();
   assert.match(await optionalSummary.textContent(),/Optional extras: LCK · GM changes on/);
   await optionalSummary.press('Enter');assert.equal(await optional.getAttribute('open'),null);assert.equal(await editor.locator('[name=extras][value=LCK]').isChecked(),true);assert.equal(await editor.locator('[name=gm]').isChecked(),true);
   await optionalSummary.press('Enter');assert.notEqual(await optional.getAttribute('open'),null);assert.equal(await editor.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await editor.locator('#workspace').screenshot({path:fileURLToPath(new URL('gui-simplicity-'+name+'-options.png',out))});
   await editor.locator('#setup-optional-settings').evaluate(el=>el.open=true);await editor.locator('[name=extras][value=LCK]').uncheck();await editor.locator('#setup-gm-settings').evaluate(el=>el.open=true);await editor.locator('[name=gm]').uncheck();await optionalSummary.press('Enter');assert.match(await optionalSummary.textContent(),/No optional extras · GM changes off/);
   await editor.locator('[name=name]').fill('Unsaved release check '+width);
   const limits=editor.locator('#automation-limits'),summary=limits.locator('summary');await summary.focus();await summary.press('Enter');
   check(name+' limitations open with keyboard',await limits.getAttribute('open')!==null);
   assert.match(await limits.textContent(),/Notes do not automate future modifiers/);assert.match(await limits.textContent(),/Zhodani are deferred/);
   await summary.press('Enter');check(name+' limitations close with keyboard',await limits.getAttribute('open')===null);await summary.press('Enter');
   check(name+' editor fits',await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await editor.screenshot({path:fileURLToPath(new URL('release-presentation-'+name+'-editor.png',out)),fullPage:true});
   const open=editor.waitForEvent('popup');await editor.getByRole('link',{name:'Character Generator changelog (opens in a new tab)',exact:true}).click();const notes=await open;
   await notes.getByRole('heading',{name:'Character Generator changelog',exact:true}).waitFor();assert.equal(notes.url(),notesURL);
   assert.match(await notes.locator('#release-beta-0-1').textContent(),/Beta 0.1/);
   for(const heading of ['Beta coverage and limitations','Save compatibility and privacy','Sources and attribution'])check(name+' '+heading,await notes.getByRole('heading',{name:heading,exact:true}).isVisible());
   assert.match(await notes.locator('main').textContent(),/unverified, read-only recorded history/);
   const home=notes.getByRole('link',{name:'Traveller Tools',exact:true});await home.focus();check(name+' focus visible',await home.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'));
   check(name+' navigation touch targets',await notes.locator('nav a').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44)));
   check(name+' notes fit',await notes.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await notes.screenshot({path:fileURLToPath(new URL('release-presentation-'+name+'-notes.png',out)),fullPage:true});
   await notes.getByRole('link',{name:'Open Character Generator',exact:true}).click();await waitForCharacter(notes,name+'-changelog-return');assert.equal(notes.url(),tool);
   await notes.goBack();await notes.getByRole('heading',{name:'Character Generator changelog',exact:true}).waitFor();assert.equal(notes.url(),notesURL);
   await notes.close();assert.equal(await editor.locator('[name=name]').inputValue(),'Unsaved release check '+width);
   const repeat=editor.waitForEvent('popup');await editor.getByRole('link',{name:'Character Generator changelog (opens in a new tab)',exact:true}).press('Enter');const reopened=await repeat;
   await reopened.getByRole('heading',{name:'Character Generator changelog',exact:true}).waitFor();await reopened.close();assert.equal(await editor.locator('[name=name]').inputValue(),'Unsaved release check '+width);
   await card.getByRole('link',{name:'Character Generator Changelog',exact:true}).click();await page.getByRole('heading',{name:'Character Generator changelog',exact:true}).waitFor();assert.equal(page.url(),notesURL);
   await page.getByRole('link',{name:'Copyright & usage notice',exact:true}).click();check(name+' copyright return',await page.locator('#copyright-notice').isVisible());
   if(published){check(name+' shared counter ran',hits.length>=1);assert.ok(hits.every(url=>url==='https://hits.sh/owlsnestnh.github.io/Traveller-Tools/tools/character-generator.svg'));}else assert.deepEqual(hits,[]);
   checks.push(name+' repeated changelog, Back navigation and closing retain unsaved editor');
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await writeFile(new URL('release-presentation-browser-results.json',out),JSON.stringify({checks,errors,unexpected,layoutMetrics,startupDiagnostics,requestFailures},null,2));console.log(JSON.stringify({checks,errors,unexpected,layoutMetrics,startupDiagnostics,requestFailures}));
}catch(error){await writeFile(new URL('release-presentation-browser-failure.json',out),JSON.stringify({message:error.message,checks,errors,unexpected,layoutMetrics,startupDiagnostics,requestFailures},null,2));throw error;}finally{await browser.close();}
