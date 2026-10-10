import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cargoManifest,cargoHoldPanel,purchaseFacts} from '../js/cargo-hold.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import * as A from '../js/amounts.mjs';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {configureSupport} from '../js/life-support.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const fixture=()=>guiFixture(12).state;
test('manifest uses exact hold accounting once and excludes delivered/cancelled cargo',()=>{
 const s=fixture();s.ship.capacity='200';s.ship.fuel=configureFuel(200,40,45,40,2);
 s.ship.accommodation.passengers.high=2;s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'901.5'});
 const contract=s.contracts[0];s.contracts.push({...contract,id:'mail',kind:'mail',quantity:'10',payment:'50000'},{...contract,id:'delivered',status:'delivered',quantity:'99'},{...contract,id:'cancelled',status:'cancelled',quantity:'88'});
 const q=cargoManifest(s);assert.equal(A.decimal(q.goods),'9');assert.equal(A.decimal(q.freight),'5');assert.equal(A.decimal(q.mail),'10');assert.equal(q.luggage,'2');assert.equal(q.bladders,5);assert.equal(A.decimal(q.support),'1.015');assert.equal(A.decimal(q.other),'8.015');assert.equal(A.decimal(q.occupied),'32.015');assert.equal(A.decimal(q.free),'167.985');assert.equal(q.contracts.length,2);assert.equal(A.cmp(q.occupied,S.used(s)),0);
});
test('separate lots retain frozen actual purchase rate and historical base after settings edits',()=>{
 const s=fixture(),a=s.lots[0];a.audit.price.unitPrice='12000';a.audit.price.audit.basePrice='20000';a.audit.price.audit.percent=55;
 const b={...structuredClone(a),id:'separate-lot',audit:{price:{unitPrice:'16000',audit:{basePrice:'20000',percent:60}}}};s.lots.push(b);s.settings.maxBaseRetailEnabled=true;s.settings.maxBaseRetail='100';
 assert.deepEqual(purchaseFacts(a),{unitPrice:'12000',base:'20000',percent:'60% of base'});assert.equal(purchaseFacts(b).percent,'80% of base');
 const html=cargoHoldPanel(s,core);assert.match(html,/60% of base/);assert.match(html,/80% of base/);assert.equal((html.match(/data-cargo-lot=/g)||[]).length,4);assert.doesNotMatch(html,/55%|12000%/);
 a.quantity='1';a.basis='1';a.goodsValue='1';assert.equal(purchaseFacts(a).unitPrice,'12000','Partial sale/cost correction cannot reprice original purchase');
});
test('unknown or corrupt purchase audit values stay unknown and never infer current retail',()=>{
 for(const lot of [{quantity:'2',goodsValue:'2000'},{audit:{price:{unitPrice:'1000',audit:{percent:50}}}},{audit:{price:{unitPrice:'not a price',audit:{basePrice:'2000'}}}},{audit:{price:{unitPrice:'1000',audit:{basePrice:0}}}}])assert.equal(purchaseFacts(lot).percent,null);
 assert.equal(purchaseFacts({}).unitPrice,null);assert.equal(purchaseFacts({audit:{price:{unitPrice:'0',audit:{basePrice:'20000'}}}}).percent,'0% of base');
 assert.equal(purchaseFacts({audit:{price:{unitPrice:'1',audit:{basePrice:'3'}}}}).percent,'≈ 33.33% of base');
});
test('cargo investment is remaining basis including recorded costs, never contract income',()=>{
 const s=fixture();s.lots[0].basis='9007199254740993000';s.lots[1].basis='47';s.lots[2].basis='19';s.contracts[0].payment='999999999999999999';
 const q=cargoManifest(s);assert.equal(q.investment,'9007199254740993066');assert.match(cargoHoldPanel(s,core),/Cr 9,007,199,254,740,993,066/);assert.doesNotMatch(cargoHoldPanel(s,core),/999,999,999,999,999,999/);
});
test('panel is read-only, escaped and destination-free for owned goods',()=>{
 const s=fixture();s.ship.name='<script>bad</script>';s.lots[0].id='lot-"unsafe';s.lots[0].description='description';s.contracts[0].description='<img src=x onerror=alert(1)>';const before=JSON.stringify(s),html=cargoHoldPanel(s,core);
 assert.equal(JSON.stringify(s),before);assert.doesNotMatch(html,/data-mutate|<script>|<img src=x/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.match(html,/lot-&quot;unsafe/);assert.doesNotMatch(html.split('cargo-consignments')[0],/Destination/);assert.match(html,/data-action="cargo-hold-tab" data-arg="Cargo"/);assert.match(html,/data-action="cargo-hold-tab" data-arg="Contracts"/);
 const scroll=html.indexOf('cargo-goods-scroll'),footer=html.indexOf('class="cargo-investment"'),freight=html.indexOf('class="cargo-consignments"');assert.ok(scroll<footer&&footer<freight);assert.match(html.slice(scroll,footer),/<\/tbody><\/table><\/div><div $/);assert.match(html,/tabindex="0" role="region" aria-label="Speculative goods/);
});
test('empty and large manifests retain every lot and independent scroll region',()=>{
 const s=fixture();s.lots=[];s.contracts=[];let html=cargoHoldPanel(s,core);assert.match(html,/No owned trade goods aboard/);assert.match(html,/No accepted freight or mail aboard/);assert.match(html,/Cr 0/);assert.doesNotMatch(html,/cargo-goods-scroll/);
 const lot=fixture().lots[0];s.lots=Array.from({length:1000},(_,i)=>({...structuredClone(lot),id:'lot-'+i}));s.ship.capacity='10000';html=cargoHoldPanel(s,core);assert.equal((html.match(/data-cargo-lot=/g)||[]).length,1000);assert.match(html,/1000 separate lots/);assert.equal((html.match(/class="cargo-investment"/g)||[]).length,1);
});
test('legacy LSS uses recorded zero cargo reservation and explicitly explains uncertainty',()=>{
 const s=fixture();delete s.ship.accommodation;const q=cargoManifest(s);assert.equal(A.decimal(q.support),'0');assert.match(q.supportNote,/Legacy life support/);assert.match(cargoHoldPanel(s,core),/recorded capacity accounting is preserved/);
});

test('historic decimal purchase display groups only integer digits and missing price is not missing base',()=>{
 const s=fixture();s.lots[0].audit.price.unitPrice='1234.56789';s.lots[0].audit.price.audit.basePrice='20000';let html=cargoHoldPanel(s,core);assert.match(html,/Cr 1,234\.56789/);assert.doesNotMatch(html,/1,234\.56,789/);
 delete s.lots[0].audit.price.unitPrice;html=cargoHoldPanel(s,core);const row=html.match(/<tr data-cargo-lot="lot-recorded">([\s\S]*?)<\/tr>/)[1];assert.match(row,/Not recorded/);assert.match(row,/Percentage unavailable/);assert.doesNotMatch(row,/Base not recorded/);
});


test('Basic fitted passenger space appears only when occupied and never becomes freight',()=>{
 const s=fixture();assert.doesNotMatch(cargoHoldPanel(s,core),/<dt>Basic passenger accommodation/);
 s.contracts.push({id:'basic-display',kind:'passenger',status:'accepted',passageClass:'basic',count:2,cabinMode:'cargo'});
 const before=JSON.stringify(s),q=cargoManifest(s),html=cargoHoldPanel(s,core);assert.equal(A.decimal(q.passengerAccommodation),'4');assert.equal(q.contracts.length,1);assert.match(html,/<dt>Basic passenger accommodation<\/dt><dd>4 t<\/dd>/);assert.doesNotMatch(html,/data-cargo-contract="basic-display"/);assert.equal(JSON.stringify(s),before);
});
