import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cargoManagementPanel} from '../js/cargo-management.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import {configureSupport} from '../js/life-support.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));

test('Cargo retains separate lots, descriptions and actual recorded prices independently of current retail',()=>{
 const s=guiFixture().state,a=s.lots[0];a.audit.price.unitPrice='1234.56789';
 s.lots.push({...structuredClone(a),id:'second-lot',description:'Separate consignment',quantity:'2.25',basis:'5000',audit:{price:{unitPrice:'2000'}}});
 const before=JSON.stringify(s),html=cargoManagementPanel(s,core,{retail:()=>100});
 assert.equal((html.match(/data-management-lot=/g)||[]).length,4);
 assert.doesNotMatch(html,/\ufffd/,'Lot text renders without replacement glyphs');
 assert.match(html,/Recorded electronics/);assert.match(html,/Separate consignment/);
 assert.match(html,/2.25 t/);assert.doesNotMatch(html,/Cr 100 \/ t/);
 assert.match(html,/Cr 1,234.56789 \/ t/);assert.match(html,/Cr 2,000 \/ t/);
 assert.match(html,/Not recorded/);assert.doesNotMatch(html,/type="checkbox"|Sale Price|Not negotiated/);
 assert.equal(JSON.stringify(s),before,'Rendering cannot change quantities, bank, audits or basis');
});

test('exact fractional LSS and luggage stay visible; internal supplies are excluded and zero cargo LSS disappears',()=>{
 const s=guiFixture().state;s.ship.roundTons=false;
 s.ship.accommodation.luggageTons='0.125';s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'901.5'});
 let html=cargoManagementPanel(s,core);
 assert.match(html,/data-management-stock="luggage"[\s\S]*?0.125 t/);
 assert.match(html,/data-management-stock="support"[\s\S]*?1.015 t/);
 assert.doesNotMatch(html,/Life support overflow|LSS overflow|901.5 t/);
 s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'800'});html=cargoManagementPanel(s,core);
 assert.doesNotMatch(html,/data-management-stock="support"/);
});

test('only accepted freight/mail appear, and passenger bookings are never represented as transport cargo',()=>{
 const s=guiFixture().state,c=s.contracts[0];
 s.contracts.push({...c,id:'mail',kind:'mail',description:'Sealed mail',quantity:'3.125'},
 {...c,id:'delivered',status:'delivered'},
 {id:'passengers',kind:'passenger',status:'accepted',passageClass:'high',count:1,cabinMode:'private'});
 const before=JSON.stringify(s),html=cargoManagementPanel(s,core);
 assert.match(html,/data-management-contract="mail"/);assert.match(html,/3.125 t/);
 assert.doesNotMatch(html,/data-management-contract="(?:delivered|passengers)"/);
 assert.doesNotMatch(html,/contract-deliver|passenger-deliver|data-management-stock="accommodation"/);
 assert.equal(JSON.stringify(s),before);
});

test('Sell routes exact lot identity to the existing action; every user-controlled display is escaped',()=>{
 const s=guiFixture().state;s.lots[0].id='lot-"unsafe';s.lots[0].description='<img src=x onerror=alert(1)>';
 const html=cargoManagementPanel(s,core);
 assert.match(html,/data-action="lot-correct" data-arg="lot-&quot;unsafe" data-mutate/);
 assert.match(html,/&lt;img src=x/);assert.doesNotMatch(html,/<img|<script|data-action="sale-commit"/);
});

test('search affects speculative rows only, and empty cargo remains usable',()=>{
 const s=guiFixture().state;
 let html=cargoManagementPanel(s,core,{search:'no such lot'});
 assert.doesNotMatch(html,/data-management-lot=|Speculative goods|No owned/);assert.match(html,/data-management-contract=/);
 s.lots=[];s.contracts=[];html=cargoManagementPanel(s,core);
 assert.doesNotMatch(html,/data-management-|<h3>|cargo-investment|No owned|No other|cargo-search/);
 assert.match(html,/data-action="add-lot"/);
});

test('zero recorded lots and transport cargo have no rows or empty category placeholders',()=>{
 const s=guiFixture().state;s.lots.forEach(l=>l.quantity='0');s.contracts[0].quantity='0';
 const before=JSON.stringify(s),html=cargoManagementPanel(s,core);
 assert.doesNotMatch(html,/data-management-|<h3>|cargo-investment|No owned|No other/);
 assert.equal(JSON.stringify(s),before,'Visibility never deletes stored records');
});

test('Cargo uses only labelled native whole-ton spinners, retaining bounds and busy disablement',()=>{
 const state=guiFixture().state,html=cargoManagementPanel(state,core);
 assert.doesNotMatch(html,/data-action="cargo-step"/);
 const inputs=[...html.matchAll(/<input type="number"[^>]*data-cargo-remaining[^>]*>/g)].map(m=>m[0]);assert.ok(inputs.length>=3);
 for(const input of inputs){assert.match(input,/min="0" max="\d+" step="1"/);assert.match(input,/aria-label="Tons remaining aboard [^"]+"/);}
 const busy=cargoManagementPanel(state,core,{busy:true});for(const input of busy.matchAll(/<input type="number"[^>]*data-cargo-remaining[^>]*>/g))assert.match(input[0],/disabled data-unavailable/);
});
