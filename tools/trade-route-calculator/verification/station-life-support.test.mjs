import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';
import {stationSupportAvailable} from '../js/station-life-support.mjs';
import {consumeSupport,supportAmount,refillQuote} from '../js/life-support.mjs';
import {campaignRefillDraft,editRefillDraft} from '../js/lss-refill-draft.mjs';
import {compartmentRefillQuote} from '../js/lss-refill-transaction.mjs';
import {withCampaign,validateImport} from '../js/fleet.mjs';
const world=(x,port='A')=>({id:x+',0',x,y:0,name:'Synthetic port '+x,sector:'Test',hex:'0'+(x+1)+'01',uwp:port+'788999-C',zone:'Safe'});
function base(){const s=S.initial();Object.assign(s,{initialized:true,bank:'1000',actual:'0,0',worlds:{'0,0':world(0),'1,0':world(1)},route:['0,0','1,0']});s.ship.capacity='50';s.ship.fuel={displacementTons:200,capacityTons:40,aboardTons:40};s.ship.accommodation={rooms:{low:0,middle:1,high:0},passengers:{low:0,middle:1,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageTons:'0'};s.ship.lifeSupport={capacityHours:672,stockUnits:A.auditNumber(28)};return S.validate(s);}
const enabled=s=>S.transition(s,'Station on',n=>S.setStationLifeSupport(n,true));
const units=s=>supportAmount(s.ship.lifeSupport.stockUnits);

test('old saves default off without mutation and toggling does not refill, bill or alter old receipts',()=>{
 const s=base(),bytes=JSON.stringify(s);assert.equal(s.ship.stationLifeSupport,undefined);S.validate(s);assert.equal(JSON.stringify(s),bytes);
 const n=enabled(s);assert.equal(n.ship.stationLifeSupport,true);assert.deepEqual(n.ship.lifeSupport,s.ship.lifeSupport);assert.equal(n.bank,s.bank);assert.deepEqual(n.ledger,s.ledger);assert.deepEqual(S.undo(n).ship,s.ship);
 assert.deepEqual(S.validate(JSON.parse(JSON.stringify(n))),n);
});
test('station covers elapsed days and searches including frozen occupants; undocking resumes exact use',()=>{
 let s=base();s.ship.accommodation.occupiedLowBerths=1;s=enabled(s);const n=S.transition(s,'Port search',v=>v.hours+=49);assert.equal(A.cmp(units(n),28),0);assert.equal(n.bank,s.bank);
 const u=S.transition(n,'Undock',v=>S.setStationLifeSupport(v,false)),t=S.transition(u,'One hour',v=>v.hours++);assert.equal(A.cmp(units(t),A.sub(28,A.rat(11,240))),0);assert.deepEqual(S.undo(t).ship,u.ship);
 const direct=structuredClone(s.ship);consumeSupport(direct,24);assert.deepEqual(direct.lifeSupport,s.ship.lifeSupport);
});
test('jump disables station supplies before consuming travel LSS and Undo restores both',()=>{
 const s=enabled(base()),p=S.prepareJump(s,()=>({dice:[2,2,2,2,2,2],total:12}));
 const n=S.transition(p.state,'Jump: ports',v=>S.commitJump(v,{attemptId:p.attempt.id,elapsed:24}));assert.equal(n.ship.stationLifeSupport,false);assert.equal(A.cmp(units(n),27),0);assert.equal(n.actual,'1,0');
 const u=S.undoJump(n);assert.equal(u.ship.stationLifeSupport,true);assert.equal(A.cmp(units(u),28),0);assert.equal(u.actual,s.actual);assert.equal(u.bank,s.bank);
});
test('moving actual location clears docking; changing the browsed view cannot change persisted state',()=>{
 const s=enabled(base()),n=S.transition(s,'Location correction',v=>v.actual='1,0');assert.equal(n.ship.stationLifeSupport,false);assert.equal(A.cmp(units(n),28),0);assert.equal(S.undo(n).ship.stationLifeSupport,true);
 const bytes=JSON.stringify(s);stationSupportAvailable(s);assert.equal(JSON.stringify(s),bytes);
});
test('station toggle rejects absent ports and invalid imported values without mutation',()=>{
 for(const variant of ['X','?', 'empty']){const s=base();if(variant==='empty')s.worlds[s.actual].emptySpace=true;else s.worlds[s.actual].uwp=variant+'788999-C';const bytes=JSON.stringify(s);assert.equal(stationSupportAvailable(s),false);assert.throws(()=>S.setStationLifeSupport(s,true),/port/);assert.equal(JSON.stringify(s),bytes);}
 for(const value of ['true',1,null]){const s=base();s.ship.stationLifeSupport=value;assert.throws(()=>S.validate(s),/on or off/);}
});
test('each ship retains its own station switch across fleet selection and import',()=>{
 const first=base(),other=base(),fleet={fleetVersion:1,activeShipId:'first',ships:[{id:'first',campaign:first},{id:'other',campaign:other}]};const n=withCampaign(fleet,enabled(first));assert.equal(n.ships[0].campaign.ship.stationLifeSupport,true);assert.equal(n.ships[1].campaign.ship.stationLifeSupport,undefined);assert.deepEqual(validateImport(n),n);
});
test('Cr100 allowance is in the ledger expense, not an extra fee or unexplained balance adjustment',()=>{
 const s=base();s.settings.creditStep=100;s.ship.lifeSupport.stockUnits=A.auditNumber(0);const d=editRefillDraft(campaignRefillDraft(s).draft,'internal',1),q=compartmentRefillQuote(s,d);assert.equal(q.dailyCredits,'72');assert.equal(q.amount,'100');
 const n=S.transition(s,'Refill',v=>S.refillCompartments(v,d,{expectedQuote:q}));assert.equal(n.bank,'900');assert.equal(n.ledger.length,1);assert.equal(n.ledger[0].amount,'-100');assert.equal(n.ledger[0].roundingStep,100);assert.equal(n.ledger[0].expense.roundingStep,100);assert.equal(A.cmp(units(n),1),0);assert.equal(S.undo(n).bank,'1000');
 const legacy=refillQuote(s,{addDays:'1'});assert.equal(legacy.dailyCredits,'72');assert.equal(legacy.amount,'100');s.settings.creditStep=1;assert.equal(refillQuote(s,{addDays:'1'}).amount,'72');
});
