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
test('archived version4 departure remains readable with unknown separate maintenance',()=>{
 const s=structuredClone(jump(fresh()));const record=s.playerDepartures[0];record.snapshot.version=4;delete record.snapshot.expenses.maintenance;
 const before=structuredClone(s),view=playerSnapshotForVisit(s,core,0,clock);assert.equal(view.version,8);assert.equal(view.expenses.maintenance.paid,null);assert.equal(view.expenses.incidentals.paid,record.snapshot.expenses.incidentals.paid);assert.deepEqual(s,before);
});

test('Broker commission comes only from recorded original purchase, never basis differences or default rates',()=>{
 const s=fresh();s.lots=[lot('paid'),lot('free'),lot('unknown')];
 s.lots[0].audit.fee='125';s.lots[0].audit.premium='40';s.lots[0].basis='1415';
 s.lots[1].audit.fee='0';s.lots[2].basis='1500';
 s.snapshots=[{kind:'supplier',worldId:s.actual,party:'dealer',options:{local:true},offers:[{commodity:'11',remaining:'2',unitPrice:'625'}]}];
 const session={...clock,saleQuotes:new Map([['paid',{revision:s.revision,worldId:s.actual,unitPrice:'700',audit:{localDM:2}}]])};
 const before=structuredClone(s),view=campaignPlayerSnapshot(s,core,session);
 assert.deepEqual(view.cargo.map(x=>x.purchase.originalBrokerCommission),['125','0',null]);
 assert.equal(view.cargo[0].purchase.percent,'62.50');assert.equal(view.cargo[0].purchase.paidTotal,'1250');
 assert.deepEqual(view.buy.offers,[{name:'Common Electronics',tons:'2',creditsPerTon:'625',retailPerTon:null}]);
 assert.deepEqual(view.sell.offers,[{name:'Common Electronics',tons:'2',creditsPerTon:'700',retailPerTon:null}]);assert.deepEqual(s,before);
 // Partial sales/losses reduce goods aboard, not the recorded original fee.
 s.lots[0].quantity='1';s.lots[0].goodsValue='625';s.lots[0].basis='708';
 const partial=campaignPlayerSnapshot(s,core,clock).cargo[0];assert.equal(partial.purchase.originalBrokerCommission,'125');assert.equal(partial.purchase.paidTotal,'625');
 for(const value of [undefined,null,'-1','not money',{},false]){s.lots[0].audit.fee=value;assert.equal(campaignPlayerSnapshot(s,core,clock).cargo[0].purchase.originalBrokerCommission,null);}
});

// Exact campaign LSS may terminate beyond the link's six-place decimal format.
// Projection must be conservative without changing campaign values or the codec.
for(const [stock,current,reserve,reserved] of [
 ['123.1234567','123.123456','0','0'],
 ['900.1234567','800','100.123456','2'],
 ['0.0000001','0','0','0'],
 ['123.123456','123.123456','0','0']
])test(`high precision LSS ${stock} exports conservatively and remains unchanged`,async()=>{
 const s=fresh();s.ship.lifeSupport={capacityHours:672,stockUnits:stock};S.validate(s);const before=JSON.stringify(s);
 const data=campaignPlayerSnapshot(s,core,clock),support=data.ship.lifeSupport;
 assert.equal(support.current,current);assert.equal(support.cargoLss,reserve);assert.equal(support.cargoReservedTons,reserved);
 const url=playerSnapshotUrl(data,'https://example.org/tools/trade-route-calculator/');assert.deepEqual(decodeSnapshotLink(PROPOSED_PREFIX+new URL(url).hash.slice(1)),prepareSnapshotForLink(data));
 const copied=[],h=harness(s,[],{navigator:{clipboard:{writeText:async x=>copied.push(x)}}});await h.api.actions['player-link']();await h.api.actions['player-link']();assert.equal(copied.length,2);assert.equal(h.calls.saves,0);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(JSON.stringify(s),before);
});
test('normal exact consumption and duration division can produce more than six terminating places',async()=>{
 const {configureSupport,consumeSupport}=await import('../js/life-support.mjs');
 const s=fresh();s.ship.accommodation={rooms:{low:0,middle:128,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:128,high:0}};
 s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'123'});consumeSupport(s.ship,3);S.validate(s);
 const before=JSON.stringify(s),support=campaignPlayerSnapshot(s,core,clock).ship.lifeSupport;
 assert.equal(support.current,'107');assert.equal(support.daysRemaining,'0.835937'); // exact 107/128 = 0.8359375
 assert.equal(support.daysCapacity,'6.25');assert.equal(JSON.stringify(s),before);
 // An ordinary integer capacity divided by a tenths-based complement can do it too.
 s.ship.fuel.displacementTons=201;s.ship.accommodation.crew.middle=102;s.ship.accommodation.occupiedLowBerths=4;S.validate(s);
 assert.equal(campaignPlayerSnapshot(s,core,clock).ship.lifeSupport.daysCapacity,'7.851562'); // 804/102.4 = 7.8515625
});
test('offer retail basis comes from saved quote audit, independent of current caps or map focus',()=>{
 const s=fresh();s.lots=[lot()];s.snapshots=[{id:'supplier',kind:'supplier',worldId:s.actual,party:'p',offers:[{id:'offer',commodity:'11',remaining:'2',unitPrice:'850',audit:{basePrice:'1000',secret:'GM SECRET'}}]}];
 const saleQuotes=new Map([['lot',{revision:s.revision,worldId:s.actual,unitPrice:'17000',audit:{basePrice:'20000'}}]]);
 const before=JSON.stringify(s),view=campaignPlayerSnapshot(s,core,{...clock,saleQuotes});
 assert.equal(view.buy.offers[0].retailPerTon,'1000');assert.equal(view.sell.offers[0].retailPerTon,'20000');assert.equal(JSON.stringify(s),before);assert.ok(!JSON.stringify(view).includes('GM SECRET'));
 for(const value of [undefined,'0','-1','1/3','9999999999999999']){s.snapshots[0].offers[0].audit.basePrice=value;assert.equal(campaignPlayerSnapshot(s,core,clock).buy.offers[0].retailPerTon,null);}
});
test('market handouts remain available with legacy fractional cargo or negative cash',async()=>{
 const {campaignPlayerMarketSnapshot}=await import('../js/player-campaign-snapshot.mjs');const s=fresh();s.lots=[lot()];s.lots[0].quantity='1.5';s.bank='-100';const before=JSON.stringify(s),market=campaignPlayerMarketSnapshot(s,core,clock);assert.equal(market.world.name,s.worlds[s.actual].name);assert.ok(!('cargo' in market));assert.ok(!('ship' in market));assert.equal(JSON.stringify(s),before);
});
