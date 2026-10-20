import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign,core,S,harness} from './app-harness.mjs';
import {campaignPlayerSnapshot} from '../js/player-campaign-snapshot.mjs';
import {projectPlayerSnapshot,summarizePlayerExpenses,SNAPSHOT_VERSION} from '../js/player-snapshot.mjs';
import {encodeSnapshotLink,decodeSnapshotLink,measureSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
import {playerSnapshotFixture} from '../js/player-snapshot-fixture.mjs';
const fixture=()=>structuredClone(playerSnapshotFixture);
test('existing maintenance receipt is separate, single-counted, and read-only in Accounts and snapshot',()=>{
 let s=S.transition(S.initial(),'Campaign setup',x=>{Object.assign(x,campaign());x.ledger=[{id:'opening',type:'Opening bank',amount:x.bank,hours:0,world:x.actual}];x.ship.maintenance={payment:'1200',nextDueDate:'001-1105',paidSinceTracking:'0'};});
 s=S.transition(s,'Paid maintenance',x=>S.shipExpense(x,{kind:'maintenance',recurringShip:x.ship,maintenancePayments:2}));
 s=S.transition(s,'Paid incidental',x=>S.expense(x,'300','Synthetic incidental'));
 const before=structuredClone(s),data=campaignPlayerSnapshot(s,core);assert.equal(data.expenses.maintenance.paid,'2400');assert.equal(data.expenses.incidentals.paid,'300');assert.equal(summarizePlayerExpenses(data.expenses).paid.knownTotal,'2700');assert.equal(s.bank,'97300');assert.equal(s.ship.maintenance.nextDueDate,'057-1105');
 const h=harness(s);h.api.setTab('Accounts');h.api.render();assert.match(h.dom.ids.get('main').innerHTML,/Ship Maintenance/);assert.match(h.dom.ids.get('main').innerHTML,/Cr 2,400/);assert.match(h.dom.ids.get('main').innerHTML,/data-rule-info="maintenance"/);assert.deepEqual(h.persisted(),before);assert.equal(h.calls.saves,0);assert.deepEqual(s,before);
 const decoded=decodeSnapshotLink(encodeSnapshotLink(data));assert.equal(decoded.expenses.maintenance.paid,'2400');assert.equal(decoded.expenses.incidentals.paid,'300');
});
test('version4 snapshots and codec1–5 links preserve combined incidentals without inventing maintenance',()=>{
 const old=fixture();old.version=4;delete old.expenses.maintenance;old.expenses.incidentals.paid='3100';const copy=structuredClone(old),up=projectPlayerSnapshot(old);assert.equal(up.version,SNAPSHOT_VERSION);assert.equal(up.expenses.maintenance.paid,null);assert.equal(up.expenses.incidentals.paid,'3100');assert.deepEqual(old,copy);
 for(const codecVersion of [1,2,3,4,5]){const input=structuredClone(up);if(codecVersion<4)input.world.mapReference=null;if(codecVersion<3)for(const k of ['daysRemaining','daysCapacity','cargoReservedTons'])input.ship.lifeSupport[k]=null;
 const packet=measureSnapshotLink(input,{codecVersion}),decoded=decodeSnapshotLink(PROPOSED_PREFIX+packet.payload);assert.equal(decoded.expenses.maintenance.paid,null);assert.equal(decoded.expenses.incidentals.paid,'3100');assert.equal(measureSnapshotLink(decoded,{codecVersion}).payload,packet.payload);}
});
test('maintenance validates hostile data and legacy down-conversion cannot lose a separate amount',()=>{
 for(const value of ['-1','NaN',{},undefined]){const s=fixture();s.expenses.maintenance.paid=value;assert.throws(()=>projectPlayerSnapshot(s));}
 const s=fixture();s.expenses.maintenance={expected:'200',paid:'100',basis:'<script>malicious</script>',gm:'secret'};const projected=projectPlayerSnapshot(s);assert.equal(projected.expenses.maintenance.gm,undefined);assert.throws(()=>measureSnapshotLink(s,{codecVersion:5}),/separate maintenance/);assert.equal(decodeSnapshotLink(encodeSnapshotLink(s)).expenses.maintenance.paid,'100');delete s.expenses.maintenance;assert.throws(()=>projectPlayerSnapshot(s));
});
