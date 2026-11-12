import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../server.mjs';
import {exportSession,project} from '../engine/session.mjs';
import {sourceEducationFixture} from './education-result-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHARACTER_BROWSER_EXECUTABLE?{executablePath:process.env.CHARACTER_BROWSER_EXECUTABLE}:{})});
const fixture=sourceEducationFixture('vargr'),key='traveller-character-generator.v1',errors=[];
try{
 for(const width of [1440,390])for(const transport of ['static','http'])for(const correction of ['remove','change']){
  const p=await browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw:exportSession(fixture.session)});
  await p.goto(`http://127.0.0.1:${server.address().port}/${transport==='http'?'?api=local':''}`);await p.locator('[data-action=add-effect]').waitFor();
  const raw=await p.evaluate(k=>localStorage.getItem(k),key);await p.locator('[data-action=add-effect]').click();await p.locator('#book-confirm').check();
  await p.locator('[data-action=resolve-book]').click();await p.locator('.required-action-warning:visible').waitFor();assert.equal(await p.locator('[data-field=name]').getAttribute('aria-invalid'),'true');
  if(correction==='remove')await p.locator('[data-action=remove-effect]').click();else await p.locator('[data-field=kind]').selectOption('cash');
  assert.equal(await p.locator('.required-action-warning:visible').count(),0);assert.equal(await p.locator('[aria-invalid=true]').count(),0);assert.equal(await p.locator('[aria-describedby*="required-action-warning-"]').count(),0);assert.equal(await p.locator('#book-confirm').isChecked(),true);
  assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
  await p.locator('[data-action=resolve-book]').click();await p.locator('body[data-stage=career]').waitFor();
  const result=project(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),key)));assert.equal(result.revision,fixture.revision+1);assert.equal(result.state.character.cash,fixture.state.character.cash+(correction==='change'?1:0));await p.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: 8 real source-screen regressions: remove/change deficient effect, clear orphan alert and ARIA state, preserve confirmation and save, continue once; static/HTTP desktop/mobile.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
