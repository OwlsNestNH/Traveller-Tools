// Production operator flow and isolated recipient, using synthetic data only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as S from '../js/state.mjs';
import {campaignPlayerSnapshot} from '../js/player-campaign-snapshot.mjs';
import {decodeSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/',origin=new URL(base).origin,key='traveller-trade-route-calculator:v1';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const a={id:'0,0',x:0,y:0,name:'ExtraordinarilyLongUnbrokenWorldNameForNarrowViewportVerification',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'},b={...a,id:'1,0',x:1,name:'Synthetic B',hex:'0201'};
let fixture=S.transition(S.initial(),'Campaign setup',s=>{Object.assign(s,{initialized:true,bank:'100000',actual:a.id,worlds:{[a.id]:a,[b.id]:b},route:[a.id,b.id,a.id,b.id]});s.ship.fuel={displacementTons:200,capacityTons:60,aboardTons:60};s.ledger.push({id:'opening',type:'Opening bank',amount:'100000',hours:0,world:a.id});});
for(let i=0;i<2;i++){const p=S.prepareJump(fixture,()=>({dice:[1,1,1,1,1,1],total:6}));fixture=S.transition(p.state,'Jump: synthetic',s=>S.commitJump(s,{attemptId:p.attempt.id,elapsed:154,playerSnapshot:campaignPlayerSnapshot(s,core)}));}
fixture=S.transition(fixture,'Synthetic held cargo',s=>{s.lots=[{id:'held',commodity:'11',description:'GM SECRET',quantity:'2',basis:'1250',goodsValue:'1250',audit:{price:{unitPrice:'625',audit:{basePrice:'1000',reason:'GM SECRET'}}}}];});
const artifacts=new URL('../verification-artifacts/',import.meta.url);await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE_PATH}:{})});
const report=[];
try{
 for(const width of [1440,390,320])for(const mode of ['success','denied']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});context.setDefaultTimeout(15000);
  await context.addInitScript(({key,bytes,mode})=>{if(!sessionStorage.getItem('fixture-seeded')){localStorage.setItem(key,bytes);sessionStorage.setItem('fixture-seeded','1');}globalThis.playerCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(mode==='denied')throw Error('Denied');playerCopies.push(text);}}});},{key,bytes:JSON.stringify(fixture),mode});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({json:{Worlds:[]},headers:{'Access-Control-Allow-Origin':'*'}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();
  // Unbroken public world names must wrap without widening the page.
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  let before=await page.evaluate(key=>localStorage.getItem(key),key);const button=page.getByRole('button',{name:'Copy Player Link',exact:true});
  const bounds=await button.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);assert.equal(await button.getAttribute('data-mutate'),null);
  async function copy(){await button.click();if(mode==='denied'){const output=page.locator('#player-link-output');await output.waitFor();const url=await output.inputValue();assert.equal(await output.evaluate(e=>e.selectionEnd),url.length);await page.locator('#modal-close').click();return url;}await page.waitForFunction(()=>playerCopies.length>0);return page.evaluate(()=>playerCopies.pop());}
  const current=await copy(),data=decodeSnapshotLink(PROPOSED_PREFIX+new URL(current).hash.slice(1));assert.equal(data.cargo.length,1);assert.equal(data.ship.fuel.current,'20');assert.equal(data.cargo[0].purchase.paidTotal,'1300');assert.ok(!JSON.stringify(data).includes('GM SECRET'));
  await page.locator('#tabs').getByRole('button',{name:'Overview',exact:true}).click();await page.locator('[data-player-route-index="0"]').click();
  const past=await copy(),old=decodeSnapshotLink(PROPOSED_PREFIX+new URL(past).hash.slice(1));assert.equal(old.world.name,a.name);assert.equal(old.cargo.length,0);assert.equal(old.ship.fuel.current,'60');
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();const repeated=decodeSnapshotLink(PROPOSED_PREFIX+new URL(await copy()).hash.slice(1));assert.equal(repeated.cargo.length,1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);await page.screenshot({path:new URL('player-link-'+mode+'-'+width+'.png',artifacts).pathname,fullPage:true});
  // A real production jump, not just a preseeded archive, captures before departure.
  await page.locator('[data-action="jump"]').click();await page.locator('#modal').getByRole('button',{name:'COMMIT JUMP',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});
  const departed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(departed.routeIndex,3);assert.equal(departed.playerDepartures[2].snapshot.ship.fuel.current,'20');assert.equal(departed.playerDepartures[2].snapshot.cargo.length,1);
  await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('#tabs').getByRole('button',{name:'Overview',exact:true}).click();await page.locator('[data-player-route-index="2"]').click();const saved=decodeSnapshotLink(PROPOSED_PREFIX+new URL(await copy()).hash.slice(1));assert.equal(saved.ship.fuel.current,'20');assert.equal(saved.cargo.length,1);
  before=await page.evaluate(key=>localStorage.getItem(key),key);
  // Same-origin recipient must never replace the operator's campaign, even across history.
  await page.goto(current);await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
  await page.goto(past);await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();await page.goBack();await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();await page.goForward();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
  assert.deepEqual(errors,[]);report.push({width,mode,pass:true,currentCharacters:current.length,pastCharacters:past.length});await context.close();
 }
 for(const width of [1440,390]){
  const precise=structuredClone(fixture);precise.ship.lifeSupport={capacityHours:672,stockUnits:'900.1234567'};S.validate(precise);const bytes=JSON.stringify(precise);
  const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);globalThis.playerCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>playerCopies.push(text)}});},{key,bytes});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({json:{Worlds:[]},headers:{'Access-Control-Allow-Origin':'*'}}));
  const page=await context.newPage();await page.goto(base+'#not-a-player-snapshot');await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.locator('#message').textContent(),'');
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Copy Player Link',exact:true}).click();await page.getByText(/Player link copied for visit/).waitFor();}
  const links=await page.evaluate(()=>playerCopies);assert.equal(links.length,2);const decoded=decodeSnapshotLink(PROPOSED_PREFIX+new URL(links[0]).hash.slice(1));assert.equal(decoded.ship.lifeSupport.cargoLss,'100.123456');assert.equal(decoded.ship.lifeSupport.cargoReservedTons,'2');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),bytes);await page.reload();await page.getByText('Editing in this tab',{exact:true}).waitFor();assert.equal(await page.locator('#message').textContent(),'');
  await page.goto(links[0]);await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),bytes);await page.goBack();await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.goForward();await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),bytes);
  report.push({width,highPrecisionLss:true,pass:true});await context.close();
 }
 console.log('PASS: production current/completed/repeated visits, clipboard fallback, desktop/mobile and recipient storage isolation.');
}finally{await writeFile(new URL('player-link-report.json',artifacts),JSON.stringify(report,null,2));await browser.close();}
