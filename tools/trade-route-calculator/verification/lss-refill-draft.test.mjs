import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefillDraft,editRefillDraft,refillDraftTotals,renderRefillDraft,wholeSupport,nearestSupportTon} from '../js/lss-refill-draft.mjs';
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
