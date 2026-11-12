import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {project} from '../engine/session.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});
const out=new URL('./artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const key='traveller-character-generator.v1';
try{
 for(const transport of ['static','http'])for(const width of [1440,390,320])for(const culture of ['native','imperial'])for(const sex of ['male','female']){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}/${transport==='http'?'?api=local':''}`);
  await page.locator('#setup-form').waitFor();
  const species=page.locator('#setup-species'),gender=page.locator('#setup-gender'),begin=page.getByRole('button',{name:'Begin character',exact:true});
  await species.selectOption('aslan');await page.locator('#setup-culture').selectOption(culture);
  const before=await page.evaluate(k=>localStorage.getItem(k),key);
  for(let attempt=0;attempt<2;attempt++){
   await begin.click();assert.equal(await page.locator('body').getAttribute('data-stage'),'identity');
   assert.equal(await gender.evaluate(n=>n.validity.valueMissing),true);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);
  }
  await page.getByRole('button',{name:'About physical sex',exact:false}).click();await page.keyboard.press('Escape');
  for(const other of ['human','vargr','aezorgh']){
   await species.selectOption(other);assert.equal(await gender.getAttribute('required'),null);
   assert.equal(await gender.inputValue(),'');
  }
  await species.selectOption('aslan');await page.locator('#setup-culture').selectOption(culture);
  // A synthetic invalid option must also be rejected by the submit handler before configure.
  await gender.evaluate(n=>{n.add(new Option('Invalid','other'));n.value='other';n.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.match(await page.locator('#message').innerText(),/Choose Male or Female/);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);
  await gender.evaluate(n=>{n.querySelector('[value="other"]').remove();n.selectedIndex=0;});
  if(transport==='static'&&culture==='native'&&sex==='male'&&width!==320){
   await begin.click();await page.screenshot({path:new URL(`aslan-sex-required-${width}.png`,out).pathname,fullPage:true});
  }
  await gender.selectOption(sex);await species.selectOption('human');await species.selectOption('aslan');
  assert.equal(await gender.inputValue(),sex);await page.locator('#setup-culture').selectOption(culture);
  await begin.click();await page.locator('body[data-stage="statistics"]').waitFor();
  const raw=await page.evaluate(k=>localStorage.getItem(k),key);assert.equal(project(JSON.parse(raw)).state.character.gender,sex);
  if(transport==='static'&&culture==='native'&&sex==='male'&&width!==320)await page.screenshot({path:new URL(`aslan-sex-continued-${width}.png`,out).pathname,fullPage:true});
  await page.reload();await page.locator('body[data-stage="statistics"]').waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);
  await page.close();
 }
 for(const species of ['human','vargr','aezorgh']){
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#setup-species').selectOption(species);
  await page.getByRole('button',{name:'Begin character',exact:true}).click();
  await page.locator('body[data-stage="statistics"]').waitFor();await page.close();
 }
 console.log('PASS: 24 Aslan flows; static/HTTP, desktop/phone, both upbringings and sexes, repeat/malformed submissions, help interruption, species switches and saved reload.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
