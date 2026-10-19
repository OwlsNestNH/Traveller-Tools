import assert from 'node:assert/strict';
import {legacyPackets} from './player-snapshot-legacy-fixtures.mjs';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium} = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.TRAVELLER_BROWSER_EXECUTABLE ? {executablePath:process.env.TRAVELLER_BROWSER_EXECUTABLE} : {})});
const artifacts = fileURLToPath(new URL('../verification-artifacts/', import.meta.url));
await mkdir(artifacts, {recursive:true});
const context = await browser.newContext({viewport:{width:1440,height:1100}});
await context.route('https://travellermap.com/**',route=>route.abort('failed'));
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
const base = process.env.TRAVELLER_TEST_URL || 'http://127.0.0.1:8765/';
const url = new URL('player-snapshot-preview.html', base).href;
try {
  await page.goto(url); await page.getByRole('heading', {name:'Planetary information'}).waitFor();
  // Set synthetic sentinel storage once; then throw on all reads/writes by the viewer.
  await page.evaluate(() => {localStorage.setItem('traveller-trade-route-calculator:v1', 'synthetic-sentinel'); sessionStorage.setItem('sentinel', 'unchanged');});
  await context.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) Storage.prototype[method] = () => {throw Error('Viewer touched storage');};
    indexedDB.open = () => {throw Error('Viewer opened database');};
  });
  await page.reload(); await page.getByRole('heading', {name:'Cargo aboard'}).waitFor();
  assert.equal(await page.locator('select,textarea,form,input').count(), 0);
  assert.equal(await page.getByRole('button', {name:/Edit local details/}).count(), 4);
  assert.equal(await page.locator('meter').count(), 2);
  await page.getByText('21 days / 100 days capacity',{exact:true}).waitFor();
  const mapLink=new URL(await page.getByRole('link',{name:'Open nearby-world reference'}).getAttribute('href'));assert.equal(mapLink.searchParams.get('sector'),'Spinward Marches');assert.equal(mapLink.searchParams.get('hex'),'1910');
  await page.getByText('Life support overflow · reserved space',{exact:true}).waitFor();
  await page.getByText(/150 LSS of reserve stock/).waitFor();
  const cargoInfo=page.getByRole('button',{name:'About cargo values and reserve supplies',exact:true});
  assert.equal(await page.getByText('Retail is the recorded base price per ton.',{exact:false}).count(),0,'Technical explanation starts hidden');
  await cargoInfo.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Cargo values and reserve supplies'}).waitFor();await page.getByText('Retail is the recorded base price per ton.',{exact:false}).waitFor();
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await cargoInfo.evaluate(e=>document.activeElement===e),true);
  await page.setViewportSize({width:320,height:844});await cargoInfo.click();const infoDialog=page.getByRole('dialog',{name:'Cargo values and reserve supplies'});assert.equal(await infoDialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:artifacts+'player-cargo-information-mobile.png',fullPage:false});await infoDialog.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await cargoInfo.evaluate(e=>document.activeElement===e),true);await page.setViewportSize({width:1440,height:1100});
  // Presentation rounding cannot alter exact source quantities or meter ratios.
  const displayChecks=await page.evaluate(async()=>{
    const {renderPlayerSnapshot}=await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');
    const root=document.getElementById('snapshot'),data=structuredClone(playerSnapshotFixture);
    data.ship.fuel={current:'31.5',capacity:'40.25'};data.ship.lifeSupport.cargoLss='150.75';
    data.buy.offers[0].tons='0.000001';data.sell.offers[0].tons='8.5';
    const before=JSON.stringify(data);renderPlayerSnapshot(root,data);
    const unchanged=before===JSON.stringify(data),text=root.textContent,meter=root.querySelector('meter'),exact={value:meter.value,max:meter.max};
    const tonCells=[...root.querySelectorAll('section')].filter(s=>/^(Cargo aboard|Buy offers|Sell offers)/.test(s.querySelector('h2').textContent)).map(s=>[...s.querySelectorAll('tbody tr')].map(row=>row.children[1].textContent));
    const values=[];
    for(const fuel of [{current:'0.0',capacity:'0'},{current:'32.000000',capacity:'40'},{current:null,capacity:null}]){
      data.ship.fuel=fuel;renderPlayerSnapshot(root,data);values.push(root.textContent);
    }
    renderPlayerSnapshot(root,playerSnapshotFixture);
    return {text,exact,values,unchanged,tonCells};
  });
  assert.deepEqual(displayChecks.tonCells,[['12','8','4','6'],['1','13','30'],['9','9','6']]);assert.equal(displayChecks.unchanged,true);assert.deepEqual(displayChecks.exact,{value:31.5,max:40.25});
  assert.match(displayChecks.text,/31 t \/ 40 t capacity/);assert.match(displayChecks.text,/150 LSS of reserve stock/);assert.doesNotMatch(displayChecks.text,/31\.5 t|40\.25 t|150\.75 LSS|3\.5 t/);
  assert.match(displayChecks.text,/Planned 3 t refined top-up at Cr500\/t/);assert.match(displayChecks.text,/21 days \/ 100 days capacity/);assert.match(displayChecks.text,/Display rounding may make amounts differ/);
  assert.match(displayChecks.values[0],/0 t \/ 0 t capacity/);assert.match(displayChecks.values[1],/32 t \/ 40 t capacity/);assert.match(displayChecks.values[2],/Unknown \/ Unknown capacity/);assert.doesNotMatch(displayChecks.values[2],/Unknown t/);
  // Whole completed days are labels only, including sub-day and unknown states.
  await page.setViewportSize({width:320,height:844});
  const dayChecks=await page.evaluate(async()=>{
    const {renderPlayerSnapshot}=await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');
    const root=document.getElementById('snapshot'),results=[];
    for(const days of ['133.333333','0.999999','0',null]){
      const data=structuredClone(playerSnapshotFixture);data.ship.cashCredits='4565913';data.ship.lifeSupport.daysRemaining=days;data.ship.lifeSupport.daysCapacity=days===null?null:'133.333333';
      const before=JSON.stringify(data);renderPlayerSnapshot(root,data);const card=[...root.querySelectorAll('.resource')].find(e=>e.querySelector('h3').textContent.includes('days remaining')),meter=card.querySelector('meter');
      results.push({label:card.querySelector('strong').textContent,meter:meter?{value:meter.value,max:meter.max}:null,unchanged:before===JSON.stringify(data),fits:document.documentElement.scrollWidth<=innerWidth,cash:root.textContent.includes('Cr 4,565,913')});
    }
    renderPlayerSnapshot(root,playerSnapshotFixture);return results;
  });
  assert.deepEqual(dayChecks.map(x=>x.label),['133 days / 133 days capacity','0 days / 133 days capacity','0 days / 133 days capacity','Unknown / Unknown capacity']);
  assert.deepEqual(dayChecks.map(x=>x.meter),[{value:133.333333,max:133.333333},{value:0.999999,max:133.333333},{value:0,max:133.333333},null]);
  for(const check of dayChecks){assert.equal(check.unchanged,true);assert.equal(check.fits,true);assert.equal(check.cash,true);}
  for(const width of [1440,900,701,390,320]){
    await page.setViewportSize({width,height:1100});
    const alignment=await page.evaluate(async()=>{
      const {renderPlayerSnapshot}=await import('./js/player-snapshot-view.mjs');const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');
      const root=document.getElementById('snapshot'),data=structuredClone(playerSnapshotFixture);data.ship.lifeSupport.daysRemaining='999999999999.333333';data.ship.lifeSupport.daysCapacity='999999999999.333333';renderPlayerSnapshot(root,data);
      const cards=[...root.querySelectorAll('.resource')],meters=[...root.querySelectorAll('meter')];return {tops:meters.map(e=>e.getBoundingClientRect().top),values:cards.slice(1).map(e=>e.querySelector('strong').getBoundingClientRect().height),fits:document.documentElement.scrollWidth<=innerWidth};
    });
    assert.equal(alignment.fits,true);if(width>700){assert.ok(Math.abs(alignment.tops[0]-alignment.tops[1])<=1,'Bars share baseline even with long wrapped values at '+width);assert.equal(alignment.values[0],alignment.values[1]);}
  }
  await page.evaluate(async()=>{const {renderPlayerSnapshot}=await import('./js/player-snapshot-view.mjs');const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');renderPlayerSnapshot(document.getElementById('snapshot'),playerSnapshotFixture);});
  await page.setViewportSize({width:1440,height:1100});
  assert.equal(await page.locator('details').getAttribute('open'), null);
  await page.getByText('Cr 40,250', {exact:true}).waitFor();
  await page.getByText('Cr 26,750', {exact:true}).waitFor();
  await page.screenshot({path:artifacts + 'player-snapshot-desktop-collapsed.png', fullPage:true});
  const toggle = page.locator('summary'); await toggle.focus(); await page.keyboard.press('Enter');
  await page.getByText('One scheduled 28-day installment paid here', {exact:true}).waitFor();
  await toggle.evaluate(element => element.blur());
  await page.screenshot({path:artifacts + 'player-snapshot-desktop.png', fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:artifacts + 'player-snapshot-mobile.png', fullPage:true});
  await toggle.click(); await page.getByText('Cr 40,250', {exact:true}).waitFor(); await toggle.click();
  for (const width of [320, 390, 700, 701, 1440]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow at ' + width);
  }
  await page.setViewportSize({width:320,height:844});
  await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const data = structuredClone(playerSnapshotFixture);
    data.world.name = data.cargo[0].name = data.buy.offers[0].name = 'W'.repeat(240);
    data.cargo[0].tons = '999999999999999'; data.buy.offers[0].creditsPerTon = data.ship.cashCredits = data.expenses.fuel.expected = '999999999999999.999999';
    data.expenses.fuel.basis = 'W'.repeat(240);
    renderPlayerSnapshot(document.getElementById('snapshot'), data); document.querySelector('details').open = true;
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Maximum fields at 320px');
  for(const payload of legacyPackets.fractional) {
    await page.goto(url+'#'+payload);await page.getByRole('alert').filter({hasText:'No inventory was rounded or changed'}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Cargo aboard',exact:true}).count(),0);
  }
  await page.goto(url+'#'+legacyPackets.whole[1]);await page.getByText(/Days unknown: duration/).waitFor();
  assert.equal(await page.locator('meter').count(),1);
  await page.goto(url);
  // Restore the fixture before same-document hash navigation (which does not rerun modules).
  await page.reload(); await page.getByText('Regina', {exact:true}).waitFor();
  // Invalid/oversize links replace stale data, then back/forward restores snapshots.
  await page.goto(url+'#invalid=%ZZ');await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Regina',{exact:true}).count(),0);
  await page.goto(url+'#'+'x'.repeat(16000));await page.getByRole('alert').waitFor();
  await page.goto(url);await page.getByText('Regina',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit local details for cargo lot 2'}).click();
  await page.getByLabel('Name unknown',{exact:true}).uncheck();await page.getByLabel('Local goods name',{exact:true}).fill('<img src=x onerror=alert(1)>');
  await page.getByLabel('Base price unknown',{exact:true}).uncheck();await page.getByLabel('Local estimated base price',{exact:true}).fill('0');
  await page.getByRole('button',{name:'Save local details'}).click();await page.getByText('Local base: Cr 0 / t · player estimate',{exact:true}).waitFor();assert.equal(await page.locator('img').count(),0);
  await page.getByRole('button',{name:'Edit local details for cargo lot 3'}).click();assert.equal(await page.getByLabel('Name unknown',{exact:true}).isChecked(),true);assert.equal(await page.getByLabel('Base price unknown',{exact:true}).isChecked(),true);await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Edit local details for cargo lot 2'}).click();assert.equal(await page.getByLabel('Local goods name',{exact:true}).inputValue(),'<img src=x onerror=alert(1)>');await page.getByLabel('Name unknown',{exact:true}).check();await page.getByLabel('Base price unknown',{exact:true}).check();await page.getByRole('button',{name:'Save local details'}).click();assert.equal(await page.getByText('Local base: Cr 0 / t · player estimate',{exact:true}).count(),0);
  await page.reload();await page.getByRole('button',{name:'Edit local details for cargo lot 2'}).click();assert.equal(await page.getByLabel('Name unknown',{exact:true}).isChecked(),true);await page.keyboard.press('Escape');
  const results = await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const root = document.getElementById('snapshot');
    const input = structuredClone(playerSnapshotFixture); input.world.name = '<img src=x onerror="window.compromised=true"> 雪 🚀';
    renderPlayerSnapshot(root, input);
    const literal = root.textContent.includes(input.world.name), injected = root.querySelectorAll('img,script').length;
    for (let i=0;i<5;i++) renderPlayerSnapshot(root, playerSnapshotFixture);
    const sections = root.querySelectorAll('section').length;
    renderPlayerSnapshot(root, {...input, version:5}); const rejected = root.querySelector('[role=alert]')?.textContent.includes('Unsupported');
    const stale = root.textContent.includes('Regina');
    input.buy = {status:'not-checked', offers:[]}; input.sell = {status:'expired', offers:[]}; input.cargo = [];
    renderPlayerSnapshot(root, input);
    return {literal, injected, sections, rejected, stale, empty:root.textContent.includes('No cargo aboard.'), unchecked:root.textContent.includes('Not checked.'), expired:root.textContent.includes('Expired.')};
  });
  assert.deepEqual(results, {literal:true,injected:0,sections:8,rejected:true,stale:false,empty:true,unchecked:true,expired:true});
  const unknowns = await page.evaluate(async () => {
    const {renderPlayerSnapshot} = await import('./js/player-snapshot-view.mjs');
    const {playerSnapshotFixture} = await import('./js/player-snapshot-fixture.mjs');
    const data = structuredClone(playerSnapshotFixture);
    data.ship.cashCredits = null; data.ship.fuel.current = '0'; data.ship.fuel.capacity = '0.000000'; data.ship.lifeSupport.capacity = null; data.ship.lifeSupport.daysRemaining = null; data.ship.lifeSupport.daysCapacity = null;
    for (const kind of ['berth', 'fuel', 'salary', 'mortgage', 'lss', 'incidentals']) data.expenses[kind].expected = null;
    renderPlayerSnapshot(document.getElementById('snapshot'), data);
    return {meters:document.querySelectorAll('meter').length, expected:document.querySelector('.expense-totals strong').textContent, detailOpen:document.querySelector('details').open, zeroCapacity:document.body.textContent.includes('No capacity configured.')};
  });
  assert.deepEqual(unknowns, {meters:0, expected:'Unknown', detailOpen:false, zeroCapacity:true});
  await page.goto(new URL('player-snapshot-generator.html',base).href);
  assert.equal(await page.locator('#budget').inputValue(),'8192');
  for(const count of [10,12]) {
    await page.locator('#cargo-lots').selectOption(String(count));await page.getByRole('button',{name:'Generate snapshot'}).click();
    const exampleLink=await page.locator('#link').inputValue();assert.ok(exampleLink.length>200 && exampleLink.length<=8192);
    await page.getByRole('link',{name:'Open player snapshot'}).click();
    await page.getByText('Cr 127,450',{exact:true}).waitFor();
    assert.equal(await page.locator('section').filter({has:page.getByRole('heading',{name:'Cargo aboard',exact:true})}).locator('tbody tr').count(),count);
    await page.goBack();
  }
  await page.locator('#budget').selectOption('200');await page.getByRole('button',{name:'Generate snapshot'}).click();await page.getByText(/No link generated and no data omitted/).waitFor();assert.equal(await page.locator('#link').inputValue(),'');
  await page.locator('#budget').selectOption('500');await page.getByRole('button',{name:'Generate snapshot'}).click();const limited=await page.locator('#link').inputValue();if(!limited)await page.getByText(/No link generated and no data omitted/).waitFor();else assert.ok(limited.length<=500);await page.locator('#budget').selectOption('8192');await page.getByRole('button',{name:'Generate snapshot'}).click();const generated=await page.locator('#link').inputValue();assert.ok(generated.length<=8192);assert.ok(generated.startsWith(url+'#'));
  await page.getByRole('link',{name:'Open player snapshot'}).click();await page.getByText('Cr 127,450',{exact:true}).waitFor();await page.getByText('Cr 40,300',{exact:true}).waitFor();
  await page.goto(url+'#bad');await page.getByRole('alert').waitFor();await page.goBack();await page.getByText('Cr 127,450',{exact:true}).waitFor();await page.goForward();await page.getByRole('alert').waitFor();await page.goBack();await page.reload();await page.getByText('Cr 127,450',{exact:true}).waitFor();
  assert.deepEqual(errors, []);
  assert.ok(requests.every(request => new URL(request).origin === new URL(base).origin || new URL(request).origin==='https://travellermap.com'));
  // A separate page without access traps confirms saved bytes remain intact.
  const checker = await context.newPage(); await checker.goto(url);
  assert.deepEqual(await checker.evaluate(() => ({local:localStorage['traveller-trade-route-calculator:v1'], session:sessionStorage.sentinel})), {local:'synthetic-sentinel',session:undefined});
  assert.equal(await page.evaluate(() => sessionStorage.sentinel), 'unchanged');
  // Separate context permits only recipient namespace writes; campaign bytes remain unchanged.
  const persistent=await browser.newContext();
  await persistent.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(!key.startsWith('traveller-player-snapshot:v1:'))throw Error('Unexpected storage write: '+key);return original.call(this,key,value);};});
  const recipient=await persistent.newPage();await recipient.goto(generated);await recipient.getByRole('button',{name:'Edit local details for cargo lot 2'}).click();
  await recipient.getByLabel('Name unknown',{exact:true}).uncheck();await recipient.getByLabel('Local goods name',{exact:true}).fill('Retained lot');await recipient.getByLabel('Base price unknown',{exact:true}).uncheck();await recipient.getByLabel('Local estimated base price',{exact:true}).fill('0');await recipient.getByRole('button',{name:'Save local details'}).click();
  await recipient.reload();await recipient.getByText('Retained lot',{exact:true}).waitFor();await recipient.getByText('Local base: Cr 0 / t · player estimate',{exact:true}).waitFor();
  const nextLink=await recipient.evaluate(async()=>{const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');const {measureSnapshotLink}=await import('./js/player-snapshot-codec.mjs');const data=structuredClone(playerSnapshotFixture);data.capturedAt='Different retained snapshot';data.ship.cashCredits='123';return location.href.split('#')[0]+'#'+measureSnapshotLink(data).payload;});
  await recipient.goto(nextLink);await recipient.getByText('Cr 123',{exact:true}).waitFor();assert.equal(await recipient.getByText('Retained lot',{exact:true}).count(),0);
  await recipient.goto(generated);await recipient.getByText('Retained lot',{exact:true}).waitFor();await recipient.getByRole('button',{name:'Edit local details for cargo lot 3'}).click();assert.equal(await recipient.getByLabel('Name unknown',{exact:true}).isChecked(),true);await recipient.keyboard.press('Escape');
  await recipient.goto(url);await recipient.getByText('Retained lot',{exact:true}).waitFor();
  const priorStorage=await recipient.evaluate(()=>JSON.stringify({...localStorage}));
  await recipient.goto(url+'#'+legacyPackets.fractional[1]);await recipient.getByRole('alert').filter({hasText:'whole tons'}).waitFor();
  assert.equal(await recipient.evaluate(()=>JSON.stringify({...localStorage})),priorStorage);
  await persistent.close();
  // Cargo prices are per-lot transmitted provenance, independent of local estimates.
  await page.goto(url);
  const cargoInput=await page.evaluate(async()=>{
    const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');const {measureSnapshotLink}=await import('./js/player-snapshot-codec.mjs');
    const data=structuredClone(playerSnapshotFixture);data.cargo=[
      {name:'Advanced Electronics',tons:'2',purchase:{retailPerTon:'1000',percent:'62.5',paidPerTon:'625'}},
      {name:'Advanced Electronics',tons:'3',purchase:{retailPerTon:'1000',percent:'80',paidPerTon:'800'}},
      {name:'Other',tons:'1',purchase:{retailPerTon:null,percent:null,paidPerTon:'0'}},
      {name:'Other',tons:'4'}];
    return location.href.split('#')[0]+'#'+measureSnapshotLink(data).payload;
  });await page.goto(cargoInput);await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();
  const cargoRows=page.locator('.cargo-section tbody tr');
  assert.deepEqual(await cargoRows.nth(0).locator('td').allTextContents(),['Advanced Electronics','2','Cr 1,000','62.5%','Cr 700','Cr 1,300']);
  assert.deepEqual((await cargoRows.nth(1).locator('td').allTextContents()).slice(2),['Cr 1,000','80%','Cr 800','Cr 2,400']);
  assert.deepEqual((await cargoRows.nth(2).locator('td').allTextContents()).slice(2),['Unknown','Unknown','Cr 0','Cr 0']);
  assert.deepEqual((await cargoRows.nth(3).locator('td').allTextContents()).slice(2),['Unknown','Unknown','Unknown','Unknown']);
  const valuesBefore=await cargoRows.nth(2).locator('td').allTextContents();
  await page.getByRole('button',{name:'Edit local details for cargo lot 3',exact:true}).click();
  await page.getByLabel('Base price unknown',{exact:true}).uncheck();await page.getByRole('textbox',{name:'Local estimated base price'}).fill('999');await page.getByRole('button',{name:'Save local details',exact:true}).click();
  assert.deepEqual((await cargoRows.nth(2).locator('td').allTextContents()).slice(2),valuesBefore.slice(2));assert.equal(page.url(),cargoInput);
  for(const width of [320,390,700,701,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Cargo values overflow at '+width);assert.equal(await cargoRows.nth(0).locator('td').nth(4).getAttribute('data-label'),'Paid / ton');if(width===390||width===1440)await page.locator('.cargo-section').screenshot({path:artifacts+'cargo-purchase-'+width+'.png'});}
  const older=await page.evaluate(async()=>{const {playerSnapshotFixture}=await import('./js/player-snapshot-fixture.mjs');const {measureSnapshotLink}=await import('./js/player-snapshot-codec.mjs');return location.href.split('#')[0]+'#'+measureSnapshotLink(playerSnapshotFixture,{codecVersion:4}).payload;});
  await page.goto(older);await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();assert.deepEqual((await page.locator('.cargo-section tbody tr').first().locator('td').allTextContents()).slice(2),['Unknown','Unknown','Unknown','Unknown']);
  await page.goBack();await page.getByRole('heading',{name:'Cargo aboard',exact:true}).waitFor();assert.equal(await page.locator('.cargo-section tbody tr').first().locator('td').nth(3).textContent(),'62.5%');
  console.log('Player snapshot browser checks passed: desktop/mobile, inert markup, versions, repeated rendering, navigation, storage isolation.');
} finally { await browser.close(); }
