import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TRAVELLER_BROWSER_CHANNEL?{channel:process.env.TRAVELLER_BROWSER_CHANNEL}:{})});
const report=[];
try{
 for(const width of [1440,1100,390,320]){
  const f=guiFixture();f.state.snapshots[0].options.local=true;f.state.settings.insurance=true;f.state.bank='10000000';f.state.ledger[0].amount=f.state.bank;
  const original=f.state.snapshots[0].offers[0];f.state.snapshots[0].offers=Array.from({length:12},(_,i)=>({...structuredClone(original),id:i?'offer-'+i:original.id,description:'Synthetic commodity lot '+(i+1),unitPrice:i===1?String(Number(original.audit.basePrice)*1.1):original.unitPrice,audit:{...structuredClone(original.audit),basePrice:i===2?null:original.audit.basePrice,percent:i===1?10:i===2?null:90}}));
  for(const [i,price] of [[3,'950'],[4,'950.000001'],[5,'1000']])Object.assign(f.state.snapshots[0].offers[i],{unitPrice:price,audit:{...original.audit,basePrice:'1000',percent:10}});
  const bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:900}}),errors=[];
  await context.addInitScript(({key,bytes})=>{if(!localStorage.getItem(key))localStorage.setItem(key,bytes);},{key:campaignKey,bytes});
  await context.route('https://travellermap.com/api/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),campaignKey),click=(name,arg)=>page.locator('[data-action="'+name+'"]'+(arg===undefined?'':'[data-arg="'+arg+'"]')).filter({visible:true}).first().click();
  const screenshot=async name=>{await page.screenshot({path:artifacts+'buy-'+name+'-'+width+'.png',fullPage:true});};
  await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await click('tab','Trade');

  const toolbar=page.getByRole('group',{name:'Trade actions',exact:true});await toolbar.waitFor();
  for(const action of ['search','market-availability','sale-all','sale-clear','sale','add-lot'])assert.equal(await page.locator('[data-action="'+action+'"]').count(),1,'one global handler/control: '+action);
  const layout=await toolbar.evaluate(el=>({overflow:document.documentElement.scrollWidth-innerWidth,rows:[...el.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top)),bottom:el.getBoundingClientRect().bottom}));assert.ok(layout.overflow<=1);if(width>=1400)assert.equal(new Set(layout.rows).size,1,'desktop controls share one plane');assert.ok(layout.bottom<=(await page.locator('.purchase-table').boundingBox()).y);
  await click('sale-all');assert.match(await toolbar.textContent(),/selected/);await click('sale-clear');assert.match(await toolbar.textContent(),/0 selected/);assert.equal(await raw(),bytes);
  // Map browsing does not redirect trading or require a recovery modal.
  await click('tab','Overview');await click('world',f.state.route[2]);await click('tab','Trade');await click('search');
  assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);await page.locator('#supplier-form').waitFor();assert.equal(await raw(),bytes);await click('supplier-cancel');
  assert.equal(await raw(),bytes);assert.equal(await page.locator('.purchase-table tbody tr').count(),12);assert.equal(await page.locator('.purchase-table input[type=checkbox]').count(),0,'Buy rows have no expiration checkbox');assert.equal(await page.locator('.cargo-table th').nth(4).textContent(),'Price paid / t');
  assert.equal(await page.locator('[data-action="buyer-search"]').count(),0);await screenshot('normal-collapsed');
  const before=await page.locator('.purchase-table').boundingBox();await click('search');await page.locator('#supplier-form').waitFor();
  const after=await page.locator('.purchase-table').boundingBox();assert.ok(after.y>before.y+100,'Inline supplier pushes goods down');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await raw(),bytes);await screenshot('normal-supplier');
  assert.equal(await page.locator('.supplier-overrides').evaluate(el=>el.open),false);assert.ok((await page.locator('.supplier-inline').boundingBox()).width<=820);
  const supplierGeometry=await page.locator('.supplier-inline').evaluate(card=>{const c=card.getBoundingClientRect();return [...card.querySelectorAll('input:not([type="checkbox"]),select')].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().width).map(el=>{const r=el.getBoundingClientRect();return {name:el.name,left:r.left,right:r.right,cardLeft:c.left,cardRight:c.right};});});
  for(const field of supplierGeometry)assert.ok(field.left>=field.cardLeft&&field.right<=field.cardRight-2,'Supplier field fits the card at '+width+': '+field.name);
  await page.locator('#supplier-form [name="party"]').fill('Synthetic review supplier');await page.locator('.supplier-overrides summary').click();await page.locator('#supplier-form [name="dice"]').fill('12');await page.locator('#supplier-form [name="duration"]').fill('1');
  assert.equal(await page.locator('#supplier-form [data-action="supplier-cancel"]').getAttribute('type'),'button');
  await page.locator('#supplier-form [name="party"]').press('Enter');try{await page.getByRole('heading',{name:'Review supplier search',exact:true}).waitFor({timeout:5000});}catch(error){console.log('Supplier error',await page.locator('#supplier-error').textContent(),errors);await screenshot('supplier-error');throw error;}assert.equal(await raw(),bytes);await page.locator('#modal-cancel').click();
  await click('supplier-close');assert.equal(await raw(),bytes);await click('market-expand');await screenshot('expanded-collapsed');
  const scroll=await page.locator('.market-goods .scroll').evaluate(el=>({h:el.clientHeight,full:el.scrollHeight}));assert.ok(scroll.h>=scroll.full-2,'Expanded market exposes all goods');
  await click('search');await screenshot('expanded-supplier');await click('supplier-close');
  await page.locator('#hide-high-prices').check();assert.equal(await page.locator('.purchase-table tbody tr').count(),9,'Above95 including100+ hidden; exact95 and unknown retained');assert.equal(await page.locator('[data-action="buy"][data-arg="offer-3"]').count(),1);assert.equal(await page.locator('[data-action="buy"][data-arg="offer-2"]').count(),1);assert.equal(await page.locator('#hide-high-prices').evaluate(e=>e===document.activeElement),true);assert.equal(await raw(),bytes);await page.locator('#hide-high-prices').uncheck();assert.equal(await page.locator('.purchase-table tbody tr').count(),12);await click('buy','offer-1');await page.getByRole('heading',{name:/Review purchase/}).waitFor();assert.equal(await page.locator('#modal-submit').isEnabled(),true);await page.locator('#modal-close').click();
  await page.locator('[data-action="buy"][data-arg="'+original.id+'"]').dblclick();await page.getByRole('heading',{name:/Review purchase/}).waitFor();assert.equal(await raw(),bytes,'Opening Buy by double-click never commits');await page.locator('#modal [name="quantity"]').fill('2');await page.locator('#modal [name="fee"]').fill('10');
  assert.match(await page.locator('#purchase-totals').textContent(),/Cash after/);assert.match(await page.locator('#purchase-totals').textContent(),/Cargo used \/ capacity after/);assert.equal(await page.locator('#modal button[type="submit"]').count(),1);await screenshot('purchase-review');
  await page.locator('#modal-submit').scrollIntoViewIfNeeded();for(const id of ['modal-cancel','modal-submit']){const r=await page.locator('#'+id).boundingBox();assert.ok(r.y>=0&&r.y+r.height<=900,'Purchase '+id+' reachable in viewport');}await page.screenshot({path:artifacts+'buy-purchase-footer-'+width+'.png'});
  assert.equal(await raw(),bytes);await page.locator('#modal-close').click();
  await click('lot-sell','lot-recorded');assert.equal(await page.locator('.trade-subtabs .active').textContent(),'Sell');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await page.locator('[data-lot="lot-recorded"]').isChecked(),true);assert.equal(await raw(),bytes);await screenshot('sell-navigation');
  await click('buyer-search');await page.getByRole('heading',{name:'Find a buyer',exact:true}).waitFor();assert.equal(await raw(),bytes);await page.locator('#modal-cancel').click();await click('trade-side','buy');
  await click('buy',original.id);await page.locator('#modal [name="quantity"]').fill('1');await page.locator('#modal-submit').dblclick();await page.locator('#modal').waitFor({state:'hidden'});
  const purchased=JSON.parse(await raw());assert.equal(purchased.revision,f.state.revision+1);assert.equal(purchased.lots.length,f.state.lots.length+1);assert.equal(purchased.snapshots[0].offers[0].remaining,'11');
  // A blank local override uses the generated skill in both search and prices;
  // an explicit zero is an override and must remain zero in both places.
  for(const override of ['', '0']){
   if(!await page.locator('#supplier-form').count())await click('search');const form=page.locator('#supplier-form');
   await form.locator('[name="party"]').fill('Synthetic broker '+(override===''?'rolled':'zero'));await form.locator('[name="method"]').selectOption('normal');
   const details=form.locator('details').filter({has:page.getByText('Local broker / fixer (optional)',{exact:true})});if(!await details.evaluate(el=>el.open))await details.locator('summary').click();
   await form.locator('[name="local"]').check();await form.locator('[name="localSkill"]').fill(override);await form.locator('.supplier-overrides').evaluate(el=>el.open=true);await form.locator('[name="dice"]').fill('12');await form.locator('[name="duration"]').fill('1');
   await form.locator('button[type="submit"]').click();await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
   const saved=JSON.parse(await raw()),snap=saved.snapshots.at(-1),expected=override===''?Math.floor(snap.search.localSkillDice.total/3):0;
   assert.equal(snap.search.skill,expected);assert.equal(snap.options.skill,expected);assert.equal(saved.bank,purchased.bank);assert.deepEqual(saved.lots,purchased.lots);
  }
  await click('supplier-cancel');
  await page.locator('#snapshot-select').selectOption(f.state.snapshots[0].id);
  // A provably unwritten failure allows an explicit retry of the same insured
  // inputs, visibly locked; it never accepts a second transaction accidentally.
  await click('buy',original.id);await page.locator('#modal [name="quantity"]').fill('2');await page.locator('#modal [name="fee"]').fill('10');await page.locator('#modal [name="insure"]').check();
  await page.locator('#modal [name="insuranceLegs"]').selectOption('1');await page.locator('#modal [name="manualPremium"]').fill('100');await page.locator('#modal [name="manualPremium"]').blur();
  assert.ok(await page.locator('#insurance-estimate .help').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Long insured destination names wrap within the estimate');
  const insuranceNames=['quantity','fee','description','insure','coverage','insuranceLegs','insuranceDistance','distanceReason','manualPremium'];
  await page.locator('#modal [name="quantity"]').focus();
  for(const name of insuranceNames){
   assert.equal(await page.evaluate(()=>document.activeElement?.name),name,'Tab reaches each purchase and insurance field');
   const bounds=await page.locator('#modal [name="'+name+'"]').boundingBox(),dialog=await page.locator('#modal').boundingBox();
   assert.ok(bounds.x>=dialog.x&&bounds.x+bounds.width<=dialog.x+dialog.width,'Insurance '+name+' fits within the dialog');
   await page.keyboard.press('Tab');
  }
  await screenshot('purchase-insured');await page.locator('#modal-submit').scrollIntoViewIfNeeded();
  for(const id of ['modal-cancel','modal-submit']){const r=await page.locator('#'+id).boundingBox();assert.ok(r.y>=0&&r.y+r.height<=900,'Insured purchase '+id+' reachable in viewport');}
  await page.screenshot({path:artifacts+'buy-purchase-insured-footer-'+width+'.png'});
  const retryBefore=await raw(),totals=await page.locator('#purchase-totals').textContent();
  await page.evaluate(key=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k===key&&fail){fail=false;throw new DOMException('Synthetic known-unwritten failure','QuotaExceededError');}return original.call(this,k,v);};},campaignKey);
  await page.locator('#modal-submit').click();await page.locator('#purchase-accepted-note').waitFor();assert.equal(await raw(),retryBefore);
  for(const name of ['quantity','fee','description','manualPremium'])assert.equal(await page.locator('#modal [name="'+name+'"]').evaluate(el=>el.readOnly),true);
  assert.equal(await page.locator('#modal [name="insure"]').isDisabled(),true);assert.equal(await page.locator('#modal [name="coverage"]').isDisabled(),true);assert.equal(await page.locator('#purchase-totals').textContent(),totals);
  await screenshot('purchase-retry');await page.locator('#modal-submit').dblclick();await page.locator('#modal').waitFor({state:'hidden'});
  const retried=JSON.parse(await raw());assert.equal(retried.revision,JSON.parse(retryBefore).revision+1);assert.equal(retried.lots.at(-1).quantity,'2');assert.equal(retried.policies.at(-1).premium,'100');
  await page.locator('#hide-high-prices').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#hide-high-prices').isChecked(),true);await page.keyboard.press('Space');assert.equal(await page.locator('#hide-high-prices').isChecked(),false);
  const highBefore=JSON.parse(await raw());await click('buy','offer-1');await page.locator('#modal [name="quantity"]').fill('1');await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});const highAfter=JSON.parse(await raw());assert.equal(highAfter.revision,highBefore.revision+1);assert.equal(highAfter.snapshots[0].offers[1].remaining,'11','110% purchase remains allowed with filter off');
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');report.push({width,screenshots:10,revision:retried.revision});await context.close();
 }
 await writeFile(artifacts+'buy-page-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
