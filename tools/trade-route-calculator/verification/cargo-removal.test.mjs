import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';
import {createCargoRemoval,setCargoRemaining,cargoRemovalSummary,cargoNumber} from '../js/cargo-removal.mjs';
import {createCargoRemovalSession} from '../js/cargo-removal-session.mjs';
import {cargoManagementPanel} from '../js/cargo-management.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import {supportAmount,consumeSupport,supportCargo} from '../js/life-support.mjs';
import {supportCompartments} from '../js/lss-compartments.mjs';
import {passengerShip,luggageSources} from '../js/passengers.mjs';
import {passengerLuggage} from '../js/accommodation.mjs';
import {SaveNotCommittedError} from '../js/persistence.mjs';
const fixture=()=>{const s=guiFixture().state;s.ship.roundTons=false;s.ship.lifeSupport={capacityHours:672,stockUnits:'901.5'};s.ship.accommodation.luggageTons='0.125';s.lots[0].quantity='2.25';s.contracts[0].quantity='3.125';return s;};
const commit=(s,d=createCargoRemoval(s))=>S.transition(s,'Cargo removal',n=>S.removeCargo(n,d));
const luggage=s=>passengerLuggage(passengerShip(s));

test('normalization is explicit, upward, conservative for supplies, reversible and idempotent',()=>{
 const s=fixture(),bytes=JSON.stringify(s),d=createCargoRemoval(s),summary=cargoRemovalSummary(d);
 assert.equal(d.remaining['lot:lot-recorded'],'3');assert.equal(d.remaining['contract:contract-fixture'],'4');assert.equal(d.remaining.luggage,'1');assert.equal(d.remaining.support,'2');
 assert.equal(JSON.stringify(s),bytes);assert.equal(summary.removed,'0');
 const n=commit(s,d);assert.equal(n.lots[0].quantity,'3');assert.equal(n.contracts[0].quantity,'4');assert.equal(luggage(n),'1');assert.equal(A.decimal(supportCargo(n.ship)),'2');
 assert.equal(A.cmp(supportAmount(n.ship.lifeSupport.stockUnits),'901.5'),0);assert.equal(A.cmp(supportAmount(supportCompartments(n.ship).internal),'800'),0);
 assert.deepEqual(n.ledger,s.ledger);assert.equal(n.bank,s.bank);assert.equal(n.lots[0].basis,s.lots[0].basis);assert.deepEqual(n.lots[0].audit,s.lots[0].audit);
 assert.equal(cargoRemovalSummary(createCargoRemoval(n)).changed,false);assert.throws(()=>commit(n),/No cargo changes/);
 assert.deepEqual(S.undo(n).ship,s.ship);assert.deepEqual(S.undo(n).lots,s.lots);assert.deepEqual(S.undo(n).contracts,s.contracts);
});
test('one-ton edits cap at original, pending zero stays visible, restoring preserves costs',()=>{
 const s=fixture(),d=createCargoRemoval(s),zero=setCargoRemaining(d,'lot:lot-recorded','0');
 assert.throws(()=>setCargoRemaining(d,'lot:lot-recorded','4'),/Remaining cargo/);for(const x of ['-1','.5','1.1','',NaN])assert.throws(()=>setCargoRemaining(d,'lot:lot-recorded',x));
 assert.ok(cargoManagementPanel(s,{commodities:[]},{removal:zero}).includes('data-management-lot="lot-recorded"'));
 const restored=setCargoRemaining(zero,'lot:lot-recorded','3'),n=commit(s,restored);assert.equal(n.lots[0].basis,s.lots[0].basis);assert.equal(n.lots[0].goodsValue,s.lots[0].goodsValue);
 const removed=commit(s,zero);assert.equal(removed.lots.some(l=>l.id==='lot-recorded'),false);assert.deepEqual(removed.ledger,s.ledger);
});
test('partial speculative loss allocates remaining cost and insurance without selling or claiming',()=>{
 const s=fixture();s.settings.insurance=true;s.lots[0].basis='101';s.lots[0].goodsValue='99';
 s.policies=[{id:'policy-test',lotId:s.lots[0].id,status:'active',remainingQuantity:'2.25',initialQuantity:'2.25',remainingValue:'99',insuredValue:'99',coverage:100,claims:[]}];
 const n=commit(s,setCargoRemaining(createCargoRemoval(s),'lot:lot-recorded','2'));
 assert.equal(n.lots[0].basis,'68');assert.equal(n.lots[0].goodsValue,'66');assert.equal(n.policies[0].remainingQuantity,'1.25');assert.deepEqual(n.policies[0].claims,[]);assert.deepEqual(n.ledger,s.ledger);
 assert.equal(n.lots[0].audit.price.unitPrice,s.lots[0].audit.price.unitPrice);S.validate(n);
});
for(const kind of ['freight','mail'])for(const remaining of ['2','0'])test(kind+' '+remaining+' t loss blocks ordinary delivery/payment and preserves audit',()=>{
 const s=fixture(),c=s.contracts[0];c.kind=kind;if(kind==='mail'){c.firstDeparture=null;c.dueHours=null;}
 const n=commit(s,setCargoRemaining(createCargoRemoval(s),'contract:'+c.id,remaining)),lost=n.contracts[0];
 assert.equal(lost.status,remaining==='0'?'lost':'accepted');assert.equal(lost.quantity,remaining);assert.equal(lost.payment,c.payment);assert.equal(lost.cargoLosses[0].removed,remaining==='0'?'4':'2');
 n.actual=c.destination;assert.throws(()=>S.deliver(n,c.id),/Cargo loss/);assert.deepEqual(n.ledger,s.ledger);assert.equal(n.bank,s.bank);S.validate(n);
 if(kind==='mail')assert.equal(S.mailCancellationEligibility(n,c.id).allowed,false);
});
test('capacity increase is shown and rejected without mutating the original',()=>{
 const s=fixture();s.ship.capacity=A.decimal(S.used(s));const bytes=JSON.stringify(s),d=createCargoRemoval(s);
 assert.equal(cargoRemovalSummary(d).overCapacity,true);assert.throws(()=>commit(s,d),/exceeds hold capacity/);assert.equal(JSON.stringify(s),bytes);
 let less=setCargoRemaining(d,'contract:contract-fixture','0');assert.equal(cargoRemovalSummary(less).overCapacity,false);S.validate(commit(s,less));
});
test('recurring hourly LSS remains exact and can render, normalize and lose only cargo supplies',()=>{
 const s=fixture();consumeSupport(s.ship,1);const before=supportCompartments(s.ship),d=createCargoRemoval(s);
 assert.doesNotThrow(()=>cargoManagementPanel(s,{commodities:[]}));const n=commit(s,setCargoRemaining(d,'support','1')),after=supportCompartments(n.ship);
 assert.equal(A.cmp(supportAmount(after.internal),supportAmount(before.internal)),0);assert.equal(A.cmp(supportAmount(after.cargo),100),0);assert.equal(A.cmp(supportAmount(after.total),A.add(supportAmount(before.internal),100)),0);
 assert.equal(cargoRemovalSummary(createCargoRemoval(n)).changed,false,'All fractional cargo normalizes only once, alongside support');
});
test('luggage loss preserves baseline people, persists after reload and retains future allowances',()=>{
 const s=fixture();s.ship.accommodation.luggageMode='auto';s.ship.accommodation.combinedPeople=true;s.ship.accommodation.passengers.high=2;delete s.ship.accommodation.luggageTons;
 const before=structuredClone(s.ship.accommodation),n=commit(s,setCargoRemaining(createCargoRemoval(s),'luggage','0'));
 assert.deepEqual(n.ship.accommodation.passengers,before.passengers);assert.deepEqual(n.ship.accommodation.crew,before.crew);assert.equal(luggage(n),'0');assert.equal(luggage(JSON.parse(JSON.stringify(n))),'0');
 n.ship.accommodation.passengers.high=3;assert.equal(luggage(n),'1','A later added person retains their new allowance');assert.equal(n.ship.accommodation.luggageMode,'auto');
});
test('booking-associated rounding leaves with booking and new bookings do not inherit loss',()=>{
 const s=fixture();s.ship.accommodation.luggageMode='auto';s.ship.accommodation.combinedPeople=true;delete s.ship.accommodation.luggageTons;
 // Exercise baggage derivation independently of generated-offer history.
 const booking={id:'old-booking',kind:'passenger',status:'accepted',passageClass:'basic',count:1};s.contracts=[booking];
 assert.equal(luggage(s),'0.01');
 const d=createCargoRemoval(s);S.removeCargo(s,d);assert.equal(luggage(s),'1');assert.equal(booking.cargoLuggageRounding,'0.99');
 booking.status='delivered';assert.equal(luggage(s),'0','No phantom rounding after delivery');
 const next={...booking,id:'new-booking',status:'accepted'};delete next.cargoLuggageRounding;s.contracts.push(next);assert.equal(luggage(s),'0.01');
 const loss=setCargoRemaining(createCargoRemoval(s),'luggage','0');S.removeCargo(s,loss);assert.equal(next.status,'accepted');assert.equal(luggage(s),'0');
 s.contracts.push({...next,id:'later-booking',cargoLuggageLost:'0',cargoLuggageRounding:'0'});assert.equal(luggage(s),'0.01');
});
test('stale preview and malformed remainder cannot change cargo',()=>{
 const s=fixture(),d=createCargoRemoval(s);s.revision++;assert.throws(()=>S.removeCargo(s,d),/Cargo changed/);s.revision--;d.remaining.luggage='99';assert.throws(()=>commit(s,d),/Remaining cargo/);
});

function sessionHarness(mode='success'){
 let state=fixture(),saved=structuredClone(state),release,writes=0,completed=0,failed=0,unknown=0;
 const session=createCargoRemovalSession({getState:()=>state,readSaved:()=>saved,save:async draft=>{writes++;await new Promise(r=>release=r);if(mode==='rejected')throw new SaveNotCommittedError(Error('Quota exceeded'));if(mode==='unknown')throw Error('Provider disconnected');const candidate=commit(state,draft);saved=candidate;state=candidate;session.observe(candidate,true);if(mode==='publication-failed')throw Error('Publication failed');return candidate;},onComplete:()=>completed++,onFailure:()=>failed++,onUnknown:()=>unknown++});
 return {session,get state(){return state;},get writes(){return writes;},get completed(){return completed;},get failed(){return failed;},get unknown(){return unknown;},release:()=>release()};
}
test('save owner rejects repeated clicks and navigation/cancel while saving',async()=>{
 const h=sessionHarness();h.session.set('lot:lot-recorded','0');const first=h.session.confirm();assert.equal(h.session.pending,true);assert.equal(h.session.cancel(),false);assert.equal(h.session.set('luggage','0'),false);assert.equal(await h.session.confirm(),false);assert.equal(h.writes,1);h.release();assert.equal(await first,true);assert.equal(h.completed,1);assert.equal(h.session.current(),null);assert.equal(h.state.lots.some(l=>l.id==='lot-recorded'),false);
});
for(const mode of ['rejected','unknown','publication-failed'])test('save '+mode+' distinguishes safe retry from reload required',async()=>{
 const h=sessionHarness(mode),before=JSON.stringify(h.state);h.session.set('luggage','0');const pending=h.session.confirm();h.release();assert.equal(await pending,false);assert.equal(h.session.pending,false);
 if(mode==='rejected'){assert.equal(h.failed,1);assert.equal(h.unknown,0);assert.ok(h.session.current());assert.equal(JSON.stringify(h.state),before);}
 else{assert.equal(h.unknown,1);assert.equal(h.completed,0);assert.equal(h.session.current(),null);}
});
test('cancel discards every preview change without writing',()=>{const h=sessionHarness(),before=JSON.stringify(h.state);h.session.set('luggage','0');h.session.cancel();assert.equal(h.writes,0);assert.equal(h.session.current(),null);assert.equal(JSON.stringify(h.state),before);});

test('valid legacy days overflow requires physical-stock confirmation instead of an endless stale retry',()=>{
 const s=guiFixture().state;s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};s.ship.accommodation.passengers.middle=28;s.ship.accommodation.crew.middle=2;
 S.validate(s);const before=JSON.stringify(s),d=createCargoRemoval(s);assert.match(d.precondition,/Confirm physical supplies.*0.4 t/);
 const requested=setCargoRemaining(d,'lot:lot-recorded','3');assert.throws(()=>commit(s,requested),/Confirm physical supplies in Life Support settings/);assert.equal(JSON.stringify(s),before);
 const html=cargoManagementPanel(s,{commodities:[]});assert.match(html,/Confirm physical supplies/);assert.match(html,/data-action="cargo-confirm" data-mutate disabled data-unavailable/);assert.doesNotMatch(html,/Cargo changed/);
 const confirmed=structuredClone(s);confirmed.ship.lifeSupport={capacityHours:672,stockUnits:'840'};S.validate(confirmed);assert.equal(createCargoRemoval(confirmed).precondition,undefined);assert.doesNotThrow(()=>commit(confirmed,setCargoRemaining(createCargoRemoval(confirmed),'lot:lot-recorded','3')));
});
