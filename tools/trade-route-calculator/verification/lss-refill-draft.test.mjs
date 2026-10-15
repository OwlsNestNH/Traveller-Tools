import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignRefillDraft,createRefillDraft,editRefillDraft,refillDraftTotals,renderRefillDraft,wholeSupport,nearestSupportTon} from '../js/lss-refill-draft.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';
import {consumeSupport,supportAmount} from '../js/life-support.mjs';
import * as A from '../js/amounts.mjs';
const make=()=>createRefillDraft({internal:'12.8',cargo:'3.4',internalCapacity:'800',cargoCapacity:'603.75',dailyUnits:'4.1'});
test('opening and rendering preserve exact fractions and caller inputs',()=>{
 const draft=make(),bytes=JSON.stringify(draft);renderRefillDraft(draft);refillDraftTotals(draft);
 assert.equal(JSON.stringify(draft),bytes);assert.equal(wholeSupport(draft.internal),'12');assert.equal(wholeSupport(draft.cargo),'3');
});
test('internal slider leaves cargo exact and original draft unchanged',()=>{
 const draft=make(),next=editRefillDraft(draft,'internal','600');
 assert.equal(wholeSupport(next.internal),'600');assert.deepEqual(next.cargo,draft.cargo);assert.equal(next.changed.cargo,false);assert.equal(wholeSupport(draft.internal),'12');
});
test('cargo quantity, both steps and Fill available cargo leave internal exact',()=>{
 for(const [action,value] of [['cargo','500'],['cargo-step',1],['cargo-step',-1],['fill-cargo']]){
  const draft=make(),next=editRefillDraft(draft,action,value);assert.deepEqual(next.internal,draft.internal);assert.equal(next.changed.internal,false);assert.equal(next.changed.cargo,true);
 }
 assert.equal(wholeSupport(editRefillDraft(make(),'fill-cargo').cargo),'603');
});
test('normal storage supports both endpoints and rejects out-of-capacity or invalid edits',()=>{
 for(const n of ['0','800'])assert.equal(wholeSupport(editRefillDraft(make(),'internal',n).internal),n);
 for(const n of ['-1','801','1.5','','NaN','Infinity'])assert.throws(()=>editRefillDraft(make(),'internal',n));
 for(const n of ['604','-1','3.5',''])assert.throws(()=>editRefillDraft(make(),'cargo',n));
});
test('cargo steps clamp to available whole capacity and zero',()=>{
 let draft=editRefillDraft(make(),'cargo','0');draft=editRefillDraft(draft,'cargo-step',-1);assert.equal(wholeSupport(draft.cargo),'0');
 draft=editRefillDraft(draft,'fill-cargo');draft=editRefillDraft(draft,'cargo-step',1);assert.equal(wholeSupport(draft.cargo),'603');
});
test('Fill and plus never reduce an existing fractional cargo balance at capacity',()=>{
 const draft=createRefillDraft({internal:'12.8',cargo:'603.5',internalCapacity:800,cargoCapacity:'603.75',dailyUnits:1});
 assert.deepEqual(editRefillDraft(draft,'fill-cargo'),draft);assert.deepEqual(editRefillDraft(draft,'cargo-step',1),draft);
});
test('display drops LSS and days fractions, and rounds cargo tons without storing rounded values',()=>{
 assert.equal(wholeSupport('0.8'),'0');assert.equal(wholeSupport({numerator:'239',denominator:'24'}),'9');assert.equal(nearestSupportTon('2.49'),'2');assert.equal(nearestSupportTon('2.5'),'3');
 const totals=refillDraftTotals(make());assert.equal(A.cmp(supportAmount(totals.total),'16.2'),0);assert.equal(A.cmp(supportAmount(totals.cargoTons),'0.034'),0);assert.equal(wholeSupport(totals.days),'3');
});
test('single total renders only an adapter-supplied quote and rounds Credits for display',()=>{
 const html=renderRefillDraft(make(),{quote:{amount:'1234.6'},blocked:''});
 assert.equal((html.match(/TOTAL refill cost/g)||[]).length,1);assert.match(html,/Cr 1,235/);assert.doesNotMatch(html,/Review Changes|Middle|High/);
 assert.match(renderRefillDraft(make()),/TOTAL refill cost<\/span><strong>Unavailable/);
});
test('blocked accounting cannot expose active payment or GM actions even with a quote',()=>{
 const html=renderRefillDraft(make(),{quote:{amount:'50'}});assert.match(html,/data-refill-action="confirm" disabled/);assert.match(html,/data-refill-action="gm" disabled/);
});
test('reason and ship labels are escaped; Cancel can discard all draft edits by retaining original',()=>{
 const original=make(),bytes=JSON.stringify(original);let draft=editRefillDraft(original,'fill-cargo');draft=editRefillDraft(draft,'reason','<script>');
 const html=renderRefillDraft(draft,{shipLabel:'<img onerror=bad>'});assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.equal(JSON.stringify(original),bytes);
});
test('unknown days remain unknown with zero consumption; invalid initial allocations fail closed',()=>{
 const draft=createRefillDraft({internal:0,cargo:0,internalCapacity:800,cargoCapacity:0,dailyUnits:0});assert.equal(refillDraftTotals(draft).days,null);
 assert.throws(()=>createRefillDraft({internal:801,cargo:0,internalCapacity:800,cargoCapacity:0,dailyUnits:1}));
});
test('read-only draft rendering does not alter exact hourly travel arithmetic',()=>{
 const ship={fuel:{displacementTons:200},accommodation:{passengers:{low:0,middle:1,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0},lifeSupport:{capacityHours:672,stockUnits:A.auditNumber('12.8')}};
 renderRefillDraft(make());consumeSupport(ship,1);assert.deepEqual(ship.lifeSupport.stockUnits,A.auditNumber(A.sub('12.8',A.rat(1,24))));
});
test('campaign adapter includes fuel, lots, contracts and luggage without any campaign writes',()=>{
 const s=campaignBaseline();s.ship.fuel.aboardTons=45;s.lots=[{quantity:'2.25'}];s.contracts=[{kind:'freight',status:'accepted',quantity:'3.125'}];s.ship.accommodation.luggageMode='manual';s.ship.accommodation.luggageTons='1';
 s.ship.lifeSupport.stockUnits=A.auditNumber('812.8');const bytes=JSON.stringify(s),result=campaignRefillDraft(s);
 // 50 - 5 fuel - 2.25 lots - 3.125 freight - 1 luggage = 38.625 t for all cargo LSS.
 assert.deepEqual(result.draft.cargoCapacity,A.auditNumber('3862.5'));assert.deepEqual(result.draft.cargo,A.auditNumber('12.8'));assert.equal(wholeSupport(result.draft.internal),'800');
 assert.equal(result.revision,s.revision);assert.equal(result.actual,s.actual);assert.equal(JSON.stringify(s),bytes);
});
test('legacy adapter includes booked awake/frozen people once and never migrates the caller',()=>{
 const s=campaignBaseline();s.ship.lifeSupport={capacityHours:672,remainingHours:24};s.contracts=[{kind:'passenger',status:'accepted',passageClass:'middle',count:2,cabinMode:'cargo'},{kind:'passenger',status:'accepted',passageClass:'low',count:3,cabinMode:'low'}];
 const bytes=JSON.stringify(s),{draft}=campaignRefillDraft(s);assert.deepEqual(draft.dailyUnits,A.auditNumber('7.3'));assert.deepEqual(draft.internal,A.auditNumber('7.3'));assert.equal(JSON.stringify(s),bytes);
 // Existing passenger/luggage rules reserve 4 cargo cabin tons and 2 luggage tons.
 assert.equal(wholeSupport(draft.cargoCapacity),'4400');
});
test('campaign adapter preserves repeating exact stock, and draft Cancel cannot affect it',()=>{
 const s=campaignBaseline();s.ship.lifeSupport.stockUnits=A.auditNumber(A.rat(307,24));const bytes=JSON.stringify(s),{draft}=campaignRefillDraft(s);
 assert.deepEqual(draft.internal,s.ship.lifeSupport.stockUnits);editRefillDraft(draft,'fill-cargo');renderRefillDraft(draft);assert.equal(JSON.stringify(s),bytes);
});
test('campaign adapter rejects unknown legacy stock, missing hull and overcommitted holds without writes',()=>{
 for(const change of [s=>{s.ship.lifeSupport={capacityHours:672,remainingHours:24,migrationRequired:true};},s=>{delete s.ship.fuel.displacementTons;},s=>{s.lots=[{quantity:'100'}];}]){
  const s=campaignBaseline();change(s);const bytes=JSON.stringify(s);assert.throws(()=>campaignRefillDraft(s));assert.equal(JSON.stringify(s),bytes);
 }
});
test('comfort spending and its note remain draft-only and never alter supplies or supported days',()=>{
 const draft=make(),totals=refillDraftTotals(draft);let next=editRefillDraft(draft,'comfort-step',1000);next=editRefillDraft(next,'comfortNote','Fresh fruit');
 assert.equal(next.comfortCredits,'1000');assert.equal(next.comfortNote,'Fresh fruit');assert.deepEqual(refillDraftTotals(next),totals);assert.equal(draft.comfortCredits,'0');
 assert.match(renderRefillDraft(next),/<details class="lss-comfort" open>/);assert.match(renderRefillDraft(next),/Extra provisions — comfort spending/);
 assert.equal(editRefillDraft(next,'comfort-step',-1000).comfortCredits,'0');assert.throws(()=>editRefillDraft(next,'comfortCredits','1.5'));assert.throws(()=>editRefillDraft(next,'comfortCredits','-1'));
});
