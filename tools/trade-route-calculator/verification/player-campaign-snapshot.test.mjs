import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign,core,S,harness} from './app-harness.mjs';
import {campaignPlayerSnapshot,playerSnapshotForVisit} from '../js/player-campaign-snapshot.mjs';
import {playerSnapshotUrl} from '../js/player-snapshot-link.mjs';
import {decodeSnapshotLink,PROPOSED_PREFIX,prepareSnapshotForLink} from '../js/player-snapshot-codec.mjs';
const clock={capturedAt:'2026-10-19T00:00:00.000Z'};
function fresh(){return S.transition(S.initial(),'Campaign setup',s=>{Object.assign(s,campaign());s.route=['0,0','1,0','0,0','1,0'];s.ship.fuel={displacementTons:200,capacityTons:60,aboardTons:60};s.ledger=[{id:S.uid(),type:'Opening bank',amount:s.bank,hours:0,world:s.actual}];});}
function jump(s){const p=S.prepareJump(s,()=>({dice:[1,1,1,1,1,1],total:6}));return S.transition(p.state,'Jump: test',next=>S.commitJump(next,{attemptId:p.attempt.id,elapsed:154,playerSnapshot:campaignPlayerSnapshot(next,core,clock)}));}
function lot(id='lot'){return {id,commodity:'11',description:'GM SECRET cargo description',quantity:'2',basis:'1250',goodsValue:'1250',audit:{price:{unitPrice:'625',audit:{basePrice:'1000',percent:99,reason:'GM SECRET'}}}};}

test('real campaign projection and full-path encoding preserve explicit public data only',()=>{
 const s=fresh();s.lots=[lot()];s.settings.secret='GM SECRET';s.ship.secret='GM SECRET';s.worlds[s.actual].notes='GM SECRET';
 const before=JSON.stringify(s),data=campaignPlayerSnapshot(s,core,clock),url=playerSnapshotUrl(data,'https://owlsnestnh.github.io/Traveller-Tools/tools/trade-route-calculator/?private=secret#old');
 assert.equal(JSON.stringify(s),before);assert.equal(data.cargo[0].purchase.percent,'62.50');assert.equal(data.cargo[0].purchase.paidTotal,'1250');assert.equal(data.ship.fuel.current,'60');
 assert.equal(data.expenses.berth.paid,'0');assert.equal(data.expenses.berth.expected,null);assert.ok(!JSON.stringify(data).includes('GM SECRET'));assert.ok(!url.includes('private'));
 assert.deepEqual(decodeSnapshotLink(PROPOSED_PREFIX+new URL(url).hash.slice(1)),prepareSnapshotForLink(data));assert.ok(url.length<8192);
});
test('repeated world departures retain distinct immutable figures and pre-jump fuel',()=>{
 let s=fresh();s=jump(s);const first=playerSnapshotForVisit(s,core,0);assert.equal(first.ship.fuel.current,'60');assert.equal(s.ship.fuel.aboardTons,40);
 s=jump(s);s=S.transition(s,'Changed cargo',x=>{x.lots=[lot()];});s=jump(s);
 assert.deepEqual(playerSnapshotForVisit(s,core,0),first);assert.equal(playerSnapshotForVisit(s,core,2).cargo.length,1);assert.equal(playerSnapshotForVisit(s,core,2).ship.fuel.current,'20');assert.equal(first.cargo.length,0);
});
test('Undo retains old audit events but removes capture; recommit replaces the visit',()=>{
 let s=jump(fresh());const old=s.playerDepartures[0].eventId;s=S.undo(s);assert.ok(s.events.some(e=>e.id===old));assert.equal(s.playerDepartures,undefined);
 s=jump(s);assert.notEqual(s.playerDepartures[0].eventId,old);assert.equal(playerSnapshotForVisit(s,core,0).world.name,'Origin');
 const broken=structuredClone(s);broken.ledger=broken.ledger.filter(e=>e.eventId!==s.playerDepartures[0].eventId);assert.throws(()=>playerSnapshotForVisit(broken,core,0),/No complete departure/);
});
test('clear/recreate an identical route does not reuse old visits; Undo clear restores captures',()=>{
 let s=jump(jump(fresh())),old=structuredClone(s.playerDepartures);const cleared=S.transition(s,'Cleared planned route',x=>{x.route=[x.actual];x.routeIndex=0;});
 assert.deepEqual(S.undo(cleared).playerDepartures,old);
 s=S.transition(cleared,'Route planned',x=>{x.route=['0,0','1,0'];});s=jump(s);assert.equal(s.playerDepartures.length,1);assert.notEqual(s.playerDepartures[0].eventId,old[0].eventId);assert.equal(playerSnapshotForVisit(s,core,0).ship.fuel.current,'20');
});
test('future replanning keeps completed prefix; old/future/missing visits are explicit',()=>{
 let s=jump(fresh());s=S.transition(s,'Route planned',x=>{x.route=['0,0','1,0','0,0'];});assert.equal(playerSnapshotForVisit(s,core,0).world.name,'Origin');assert.throws(()=>playerSnapshotForVisit(s,core,2),/not happened/);
 delete s.playerDepartures;assert.throws(()=>playerSnapshotForVisit(s,core,0),/Older visits cannot/);assert.throws(()=>playerSnapshotForVisit(s,core,null),/Select/);
});
test('expired/rejected buy prices and stale sale quotes are excluded',()=>{
 let s=fresh();s.snapshots=[{id:'supplier',kind:'supplier',worldId:s.actual,party:'dealer',offers:[{commodity:'11',remaining:'2',unitPrice:'625'},{commodity:'12',remaining:'2',unitPrice:'500',expired:true}]}];s.events.push({id:'contact',label:'Contact search audit',world:s.actual,snapshotId:'supplier',hours:0});s.lots=[lot()];
 let data=campaignPlayerSnapshot(s,core,{...clock,saleQuotes:new Map([['lot',{revision:s.revision,worldId:s.actual,unitPrice:'700',audit:{reason:'GM SECRET'}}]])});assert.equal(data.buy.offers.length,1);assert.equal(data.sell.offers.length,1);
 s.cooldowns.dealer=100;data=campaignPlayerSnapshot(s,core,{...clock,saleQuotes:new Map([['lot',{revision:s.revision-1,worldId:s.actual,unitPrice:'700'}]])});assert.equal(data.buy.offers.length,0);assert.equal(data.sell.status,'not-checked');
});
test('malicious or incompatible stored snapshots are revalidated and allowlisted',()=>{
 const s=jump(fresh());s.playerDepartures[0].snapshot={...s.playerDepartures[0].snapshot,gmSecret:'secret'};assert.ok(!JSON.stringify(playerSnapshotForVisit(s,core,0)).includes('secret'));
 s.playerDepartures[0].snapshot.version=999;assert.throws(()=>playerSnapshotForVisit(s,core,0),/Unsupported/);
});
test('unsupported quantities and oversized URLs fail without changing source or blocking jumps',()=>{
 const s=fresh();s.lots=[{...lot(),quantity:'1.5'}];const before=JSON.stringify(s);assert.throws(()=>campaignPlayerSnapshot(s,core,clock),/whole tons/);assert.equal(JSON.stringify(s),before);
 const p=S.prepareJump(s,()=>({dice:[1,1,1,1,1,1],total:6}));const next=S.transition(p.state,'Jump: test',x=>S.commitJump(x,{attemptId:p.attempt.id,elapsed:154,playerSnapshot:{version:999}}));assert.equal(next.routeIndex,1);assert.equal(next.playerDepartures[0].snapshot,null);
 const data=campaignPlayerSnapshot(fresh(),core,clock);assert.throws(()=>playerSnapshotUrl(data,'https://example.org/tools/',{maxUrlLength:100}),/No link generated/);
});
test('production Copy Player Link exports saved state without any campaign write',async()=>{
 const copied=[],h=harness(fresh(),[],{navigator:{clipboard:{writeText:async x=>copied.push(x)}}}),before=JSON.stringify(h.persisted());
 await h.api.actions['player-link']();assert.equal(copied.length,1);assert.equal(h.calls.saves,0);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(decodeSnapshotLink(PROPOSED_PREFIX+new URL(copied[0]).hash.slice(1)).ship.cashCredits,'100000');
 assert.match(h.dom.ids.get('player-link-share').innerHTML,/Copy Player Link/);
});
test('clipboard failure offers manual URL copying, with no saved-state mutation',async()=>{
 const h=harness(fresh(),[],{navigator:{clipboard:{writeText:async()=>{throw Error('denied');}}}}),before=JSON.stringify(h.persisted());await h.api.actions['player-link']();assert.match(h.dom.ids.get('modal-body').innerHTML,/player-link-output/);assert.match(h.dom.ids.get('modal-body').innerHTML,/player-snapshot-preview.html#/);assert.equal(h.calls.saves,0);assert.equal(JSON.stringify(h.persisted()),before);
});

test('unknown crew complement never infers days from occupied low berths alone',()=>{
 const s=fresh();s.ship.lifeSupport={capacityHours:672,stockUnits:'100'};s.ship.accommodation={rooms:{low:2,middle:0,high:0},occupiedLowBerths:2};
 const data=campaignPlayerSnapshot(s,core,clock);assert.equal(data.ship.lifeSupport.current,'100');assert.equal(data.ship.lifeSupport.daysRemaining,null);assert.equal(data.ship.lifeSupport.daysCapacity,null);
});

test('saved active offers remain available on return, matching existing buy workflow',()=>{
 const s=fresh();s.snapshots=[{id:'older',kind:'supplier',worldId:s.actual,party:'dealer',offers:[{commodity:'11',remaining:'2',unitPrice:'625'}]}];
 const data=campaignPlayerSnapshot(s,core,clock);assert.equal(data.buy.status,'available');assert.equal(data.buy.offers[0].creditsPerTon,'625');
});
test('known life-support internal stock, reserve and days use actual complement',()=>{
 const s=fresh();s.ship.lifeSupport={capacityHours:672,stockUnits:'1000'};s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:3,high:0},crew:{low:0,middle:1,high:0}};
 const support=campaignPlayerSnapshot(s,core,clock).ship.lifeSupport;assert.equal(support.current,'800');assert.equal(support.cargoLss,'200');assert.equal(support.cargoReservedTons,'2');assert.equal(support.daysRemaining,'200');
});
test('recorded paid categories include trade fees without exposing their GM reasons',()=>{
 const s=fresh();s.ledger.push({id:'fee',type:'Broker fee',amount:'-51',world:s.actual,hours:0,reason:'GM SECRET'},{id:'fuel',type:'Ship expense · Fuel',amount:'-1000',world:s.actual,hours:0,expense:{kind:'fuel',notes:'GM SECRET'}});s.bank='98949';
 const data=campaignPlayerSnapshot(s,core,clock);assert.equal(data.expenses.fuel.paid,'1000');assert.equal(data.expenses.incidentals.paid,'51');assert.ok(!JSON.stringify(data).includes('GM SECRET'));
});

test('headless jumps without capture invalidate old archive after identical route restart',()=>{
 let s=jump(jump(fresh()));s=S.transition(s,'Clear and replan',x=>{x.route=['0,0','1,0'];x.routeIndex=0;});
 const p=S.prepareJump(s,()=>({dice:[1,1,1,1,1,1],total:6}));s=S.transition(p.state,'Jump: headless',x=>S.commitJump(x,{attemptId:p.attempt.id,elapsed:154}));
 assert.equal(s.playerDepartures.length,1);assert.equal(s.playerDepartures[0].snapshot,null);assert.throws(()=>playerSnapshotForVisit(s,core,0),/No complete departure/);
});
test('an older application retaining unknown archive fields cannot resurrect a prior journey',()=>{
 let s=jump(jump(fresh()));const old=structuredClone(s.playerDepartures);s=S.transition(s,'Clear and replan',x=>{x.route=['0,0','1,0'];x.routeIndex=0;});
 const p=S.prepareJump(s,()=>({dice:[1,1,1,1,1,1],total:6}));s=S.transition(p.state,'Jump: legacy caller',x=>S.commitJump(x,{attemptId:p.attempt.id,elapsed:154}));
 s.playerDepartures=old;assert.throws(()=>playerSnapshotForVisit(s,core,0),/No complete departure/);
});

for(const numerator of ['2400000001','2700000001'])test(`fractional life-support reserve ${numerator}/3000000 refuses understated cargo space`,()=>{
 const s=fresh();s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator,denominator:'3000000'}};
 S.validate(s);const before=JSON.stringify(s);
 assert.throws(()=>campaignPlayerSnapshot(s,core,clock),/life-support reserve cannot be represented accurately/);
 assert.equal(JSON.stringify(s),before);
});
