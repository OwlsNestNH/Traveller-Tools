import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as A from '../js/amounts.mjs';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {campaignReport} from '../js/report.mjs';

const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const world=(x=0,uwp='C000500-8',zone='Safe')=>({id:x+',0',x,y:0,name:'Port '+x,sector:'Test',hex:'010'+(x+1),uwp,zone});
const context=(uwp='C000500-8',zone='Safe')=>R.context(world(0,uwp,zone),core);
const neutral=context();
const noRoll=()=>assert.fail('A manual result must not consume an automatic die');
function dice(...values){let calls=0;const rng=()=>{assert.ok(calls<values.length,'Unexpected extra die roll');return values[calls++];};rng.calls=()=>calls;return rng;}
function offer(options={},rng=noRoll,{origin=neutral,destination=neutral,distance=1,effect=0,ship={},crew={}}={}){
 return R.mailOffer(origin,destination,distance,effect,ship,crew,core,rng,options);
}
function campaign(){
 const s=S.initial();s.initialized=true;s.bank='100000';s.actual='0,0';
 s.worlds=Object.fromEntries([0,1,2].map(x=>{const w=world(x);return [w.id,w];}));
 s.route=['0,0','1,0','2,0'];return s;
}
function consignment(count=2,extra={}){
 return {...offer({availabilityTotal:12,containerRoll:count}),offerId:'mail-offer',origin:'0,0',destination:'2,0',dueHours:null,...extra};
}
const ownedLot={id:'owned',commodity:'11',description:'Owned goods',quantity:'7',basis:'60000',goodsValue:'60000'};

test('mail freight traffic bands include both sides of every RAW boundary',()=>{
 for(const [traffic,expected]of [[-30,-2],[-11,-2],[-10,-2],[-9,-1],[-5,-1],[-4,0],[0,0],[4,0],[5,1],[9,1],[10,2],[11,2],[30,2]]){
  const m=offer({availabilityTotal:12,containerRoll:3},noRoll,{effect:traffic});
  assert.equal(m.audit.dm.total,traffic,'Freight traffic '+traffic);
  assert.equal(m.audit.modifiers.freight,expected,'Mail DM at traffic '+traffic);
  assert.equal(m.audit.total,12+expected);
  assert.equal(m.available,expected>=0);
 }
});

test('freight audit records both endpoint components without changing existing totals',()=>{
 const origin=context('A788800-9','Amber'),destination=context('E000100-6','Red');
 const dm=R.freightDM(origin,destination,3,3,core);
 assert.deepEqual(dm.components,{
  origin:{population:4,starport:2,techLevel:2,zone:-2},
  destination:{population:-4,starport:-1,techLevel:-1,zone:-6}
 });
 assert.deepEqual({origin:dm.origin,destination:dm.destination,distance:dm.distance,effect:dm.effect,total:dm.total},{origin:6,destination:-12,distance:-2,effect:3,total:-5});
 const m=offer({availabilityTotal:8,containerRoll:4},noRoll,{origin,destination,distance:3,effect:3,ship:{armed:true},crew:{rank:2,soc:1}});
 assert.deepEqual(m.audit.dm,dm);
 assert.deepEqual(m.audit.modifiers,{freight:-1,armed:2,lowTech:0,rank:2,soc:1});
 assert.equal(m.audit.modifierTotal,4);assert.equal(m.audit.total,12);
 assert.equal(m.quantity,'20');assert.equal(m.payment,'100000');assert.equal(m.audit.sourcePage,241);
});

test('endpoint population, starport, TL and zone boundaries apply independently at both ends',()=>{
 const cases=[
  ...[[0,-4],[1,-4],[2,0],[5,0],[6,2],[7,2],[8,4],[9,4]].map(([pop,dm])=>['C000'+pop+'00-8','Safe','population',dm]),
  ...[['A',2],['B',1],['C',0],['D',0],['E',-1],['X',-3]].map(([port,dm])=>[port+'000500-8','Safe','starport',dm]),
  ...[[5,-1],[6,-1],[7,0],[8,0],[9,2]].map(([tl,dm])=>['C000500-'+tl,'Safe','techLevel',dm]),
  ...[['Safe',0],['Amber',-2],['Red',-6]].map(([zone,dm])=>['C000500-8',zone,'zone',dm])
 ];
 for(const [uwp,zone,component,expected]of cases){
  const ctx=context(uwp,zone),dm=R.freightDM(ctx,ctx,1,0,core);
  assert.equal(dm.components.origin[component],expected,uwp+' '+zone+' origin '+component);
  assert.equal(dm.components.destination[component],expected,uwp+' '+zone+' destination '+component);
  assert.equal(dm.total,expected*2);
 }
});

test('availability succeeds at exactly 12 and failure at 11 never rolls containers',()=>{
 const failedDice=dice(5,6),failed=offer({},failedDice);
 assert.equal(failed.available,false);assert.equal(failed.audit.total,11);
 assert.equal(failedDice.calls(),2);assert.equal('count'in failed.audit,false);
 assert.equal('quantity'in failed,false);assert.equal('payment'in failed,false);
 const successDice=dice(6,6,3),success=offer({},successDice);
 assert.equal(success.available,true);assert.equal(success.audit.total,12);
 assert.deepEqual(success.audit.dice,{dice:[6,6],total:12});
 assert.deepEqual(success.audit.count,{dice:[3],total:3});
 assert.equal(successDice.calls(),3);assert.equal(success.quantity,'15');assert.equal(success.payment,'75000');
});

test('the eighth-argument RNG remains backward compatible',()=>{
 const rng=dice(6,6,2),m=R.mailOffer(neutral,neutral,1,0,{}, {},core,rng);
 assert.equal(m.available,true);assert.equal(m.quantity,'10');assert.equal(m.payment,'50000');assert.equal(rng.calls(),3);
});

test('manual availability and container results each bypass only their own dice',()=>{
 const countDice=dice(4),manualAvailability=offer({availabilityTotal:12},countDice);
 assert.deepEqual(manualAvailability.audit.dice,{dice:null,total:12,manual:true});
 assert.deepEqual(manualAvailability.audit.count,{dice:[4],total:4});assert.equal(countDice.calls(),1);
 const availabilityDice=dice(6,6),manualContainers=offer({containerRoll:5},availabilityDice);
 assert.deepEqual(manualContainers.audit.dice,{dice:[6,6],total:12});
 assert.deepEqual(manualContainers.audit.count,{dice:null,total:5,manual:true});assert.equal(availabilityDice.calls(),2);
 const both=offer({availabilityTotal:'12',containerRoll:'6'});
 assert.deepEqual(both.audit.dice,{dice:null,total:12,manual:true});
 assert.deepEqual(both.audit.count,{dice:null,total:6,manual:true});
 assert.equal(both.quantity,'30');assert.equal(both.payment,'150000');
 const failed=offer({availabilityTotal:11,containerRoll:6});
 assert.equal(failed.available,false);assert.equal('count'in failed.audit,false);
 const manualFailure=offer({availabilityTotal:2});
 assert.equal(manualFailure.available,false);assert.equal('count'in manualFailure.audit,false);
});

test('null, omitted and empty manual inputs retain automatic rolls',()=>{
 for(const value of [undefined,null,'']){
  const rng=dice(6,6,1),m=offer({availabilityTotal:value,containerRoll:value},rng);
  assert.equal(m.quantity,'5');assert.equal(m.payment,'25000');assert.equal(rng.calls(),3);
  assert.notEqual(m.audit.dice.manual,true);assert.notEqual(m.audit.count.manual,true);
 }
});

test('manual dice enforce their separate whole-number ranges before consuming RNG',()=>{
 for(const value of [-1,0,1,13,2.5,NaN,Infinity,'invalid',' ','2.5',true,{},[]]){
  assert.throws(()=>offer({availabilityTotal:value,containerRoll:1}),/availability.*whole number from 2 to 12/i,String(value));
 }
 for(const value of [-1,0,7,1.5,NaN,Infinity,'invalid',' ','1.5',true,{},[]]){
  assert.throws(()=>offer({availabilityTotal:12,containerRoll:value}),/container.*whole number from 1 to 6/i,String(value));
  assert.throws(()=>offer({availabilityTotal:2,containerRoll:value}),/container.*whole number from 1 to 6/i,'Unavailable mail must still reject invalid input');
 }
 for(const availabilityTotal of [2,12])for(const containerRoll of [1,6]){
  const m=offer({availabilityTotal,containerRoll},noRoll,{crew:{rank:10}});
  assert.equal(m.available,true);assert.equal(m.quantity,String(containerRoll*5));assert.equal(m.payment,String(containerRoll*25000));
 }
});

test('mail uses armed +2, highest-rank input, signed SOC DM and origin-only low-TL penalty',()=>{
 const m=offer({availabilityTotal:8,containerRoll:1},noRoll,{ship:{armed:true},crew:{rank:3,soc:-1}});
 assert.deepEqual(m.audit.modifiers,{freight:0,armed:2,lowTech:0,rank:3,soc:-1});
 assert.equal(m.audit.total,12);assert.equal(m.available,true);
 const unarmed=offer({availabilityTotal:8,containerRoll:1},noRoll,{crew:{rank:3,soc:-1}});
 assert.equal(unarmed.audit.total,10);assert.equal(unarmed.available,false);
 for(const [tl,penalty]of [[0,-4],[5,-4],[6,0]]){
  const lowOrigin=offer({availabilityTotal:12,containerRoll:1},noRoll,{origin:context('C000500-'+tl),effect:1});
  assert.equal(lowOrigin.audit.modifiers.freight,0);assert.equal(lowOrigin.audit.modifiers.lowTech,penalty);
  assert.equal(lowOrigin.audit.total,12+penalty);assert.equal(lowOrigin.available,penalty===0);
 }
 const lowDestination=offer({availabilityTotal:12,containerRoll:1},noRoll,{destination:context('C000500-5'),effect:1});
 assert.equal(lowDestination.audit.modifiers.freight,0);assert.equal(lowDestination.audit.modifiers.lowTech,0);assert.equal(lowDestination.available,true);
});

test('mail preview is deterministic and unknown endpoint data fails before rolling',()=>{
 const before=structuredClone(neutral),a=R.mailModifiers(neutral,neutral,2,1,{armed:true},{rank:2,soc:1},core);
 assert.equal(a.dm.distance,-1);assert.equal(a.dm.effect,1);assert.equal(a.dm.total,0);
 assert.equal(a.modifierTotal,5);assert.equal(a.distance,2);assert.equal(a.sourcePage,241);
 assert.equal('dice'in a,false);assert.deepEqual(neutral,before);
 for(const uwp of ['?000500-8','C000?00-8','C000500-?']){
  assert.throws(()=>offer({},noRoll,{origin:context(uwp)}),/known port, population and TL/);
  assert.throws(()=>offer({},noRoll,{destination:context(uwp)}),/known port, population and TL/);
 }
});

test('standalone mail supports zero and long distances while freight keeps its table restriction',()=>{
 for(const distance of [0,1,6,7,12]){
  const m=offer({availabilityTotal:12,containerRoll:4},noRoll,{distance,crew:{rank:2}});
  assert.equal(m.available,true);assert.equal(m.quantity,'20');assert.equal(m.payment,'100000');
  assert.equal(m.audit.dm.distance,-Math.max(0,distance-1));assert.equal(m.audit.distance,distance);
 }
 for(const distance of [0,7,12])assert.throws(()=>R.freightOffers(neutral,neutral,distance,0,core,noRoll),/table range.*manual contract/);
 assert.ok(Array.isArray(R.freightOffers(neutral,neutral,6,0,core,()=>1)));
});

test('old campaigns and old mail audits still round-trip without migration or accounting changes',()=>{
 for(const audit of [undefined,{dice:{dice:[6,6],total:12},dm:{origin:0,destination:0,distance:0,effect:0,total:0},modifiers:{freight:0,armed:0,lowTech:0,rank:0,soc:0},total:12,count:{dice:[2],total:2},sourcePage:241}]){
  const s=campaign();delete s.ship.staterooms;
  const contract={id:'legacy-mail',offerId:'legacy-offer',kind:'mail',status:'accepted',origin:'0,0',destination:'2,0',quantity:'10',payment:'50000',dueHours:null};
  if(audit)contract.audit=audit;s.contracts=[contract];
  const saved=JSON.parse(JSON.stringify(s)),restored=S.validate(saved);
  assert.deepEqual(restored,s);assert.equal(A.decimal(S.used(restored)),'10');
  assert.equal(restored.schema,1);assert.equal(restored.bank,'100000');
  assert.deepEqual(JSON.parse(JSON.stringify(restored)),s);
 }
});

test('accepting mail reserves the whole consignment against goods, freight, mail, luggage and bladders',()=>{
 const s=campaign();s.ship.capacity='30';s.lots=[structuredClone(ownedLot)];
 s.ship.accommodation={lowBerths:0,passengers:{low:0,middle:0,high:0},crew:{low:0,middle:0,high:0},luggageMode:'manual',luggageTons:'2'};
 s.ship.fuel=configureFuel(200,40,43,1,s.ship.jump);
 s.contracts=[
  {id:'freight',offerId:'freight-offer',kind:'freight',status:'accepted',origin:'0,0',destination:'1,0',quantity:'4',payment:'4000',dueHours:null},
  {id:'mail',offerId:'other-mail-offer',kind:'mail',status:'accepted',origin:'0,0',destination:'1,0',quantity:'5',payment:'25000',dueHours:null},
  {id:'past-mail',offerId:'past-mail-offer',kind:'mail',status:'delivered',origin:'0,0',destination:'1,0',quantity:'50',payment:'250000',dueHours:null}
 ];
 assert.equal(A.decimal(S.used(s)),'21');const before=structuredClone(s),mail=consignment(2);
 assert.throws(()=>S.transition(s,'Accept mail',x=>S.acceptContract(x,mail)),/whole contract/);
 assert.deepEqual(s,before);
 s.ship.capacity='31';const accepted=S.transition(s,'Accept mail',x=>S.acceptContract(x,mail));
 assert.equal(A.decimal(S.used(accepted)),'31');assert.equal(accepted.contracts.length,4);
 assert.equal(accepted.contracts.at(-1).quantity,'10');assert.deepEqual(accepted.contracts.at(-1).audit,mail.audit);
 assert.equal(accepted.bank,s.bank);assert.deepEqual(accepted.ledger,s.ledger);assert.deepEqual(accepted.lots,s.lots);assert.deepEqual(accepted.ship,s.ship);
 const undone=S.undo(accepted);assert.deepEqual(undone.contracts,s.contracts);assert.equal(A.decimal(S.used(undone)),'21');assert.equal(undone.bank,s.bank);
});

test('mail acceptance requires actual origin and rejects the same offer twice without changing state',()=>{
 const s=campaign(),mail=consignment(),before=structuredClone(s);s.actual='1,0';
 assert.throws(()=>S.transition(s,'Accept mail',x=>S.acceptContract(x,mail)),/must be at this world/);
 assert.equal(s.contracts.length,0);s.actual=before.actual;
 const accepted=S.transition(s,'Accept mail',x=>S.acceptContract(x,mail)),saved=structuredClone(accepted);
 assert.throws(()=>S.transition(accepted,'Accept again',x=>S.acceptContract(x,mail)),/already accepted/);
 assert.deepEqual(accepted,saved);
});

test('mail pays exactly once only on explicit destination delivery, releases hold and undoes atomically',()=>{
 const s=campaign();s.lots=[structuredClone(ownedLot)];
 const accepted=S.transition(s,'Accept mail',x=>S.acceptContract(x,consignment(4))),id=accepted.contracts[0].id;
 assert.equal(accepted.bank,'100000');assert.equal(A.decimal(S.used(accepted)),'27');
 assert.throws(()=>S.transition(accepted,'Deliver at origin',x=>S.deliver(x,id)),/must be at this world/);
 const intermediate=S.transition(accepted,'Arrive at intermediate port',x=>{x.actual='1,0';x.hours+=168;x.routeIndex=1;});
 assert.equal(intermediate.bank,'100000');assert.equal(intermediate.contracts[0].status,'accepted');
 assert.throws(()=>S.transition(intermediate,'Deliver at intermediate port',x=>S.deliver(x,id)),/must be at this world/);
 const arrived=S.transition(intermediate,'Arrive at destination',x=>{x.actual='2,0';x.hours+=168;x.routeIndex=2;});
 assert.equal(arrived.bank,'100000');assert.equal(arrived.contracts[0].status,'accepted');assert.equal(A.decimal(S.used(arrived)),'27');assert.deepEqual(arrived.ledger,[]);
 const delivered=S.transition(arrived,'Deliver mail',x=>S.deliver(x,id,6));
 assert.equal(delivered.bank,'200000');assert.equal(A.decimal(S.used(delivered)),'7');
 assert.equal(delivered.contracts[0].status,'delivered');assert.equal(delivered.contracts[0].payout,'100000');
 assert.equal(delivered.contracts[0].late,false);assert.equal(delivered.contracts[0].penaltyDie,null);assert.equal(delivered.contracts[0].deliveredHours,336);
 assert.deepEqual(delivered.contracts[0].audit,accepted.contracts[0].audit);assert.deepEqual(delivered.lots,arrived.lots);
 assert.equal(delivered.ledger.length,1);assert.equal(delivered.ledger[0].type,'Mail delivery');assert.equal(delivered.ledger[0].amount,'100000');assert.equal(delivered.ledger[0].contractId,id);
 const saved=structuredClone(delivered);assert.throws(()=>S.transition(delivered,'Deliver twice',x=>S.deliver(x,id)),/not awaiting delivery/);assert.deepEqual(delivered,saved);
 const restored=S.validate(JSON.parse(JSON.stringify(delivered))),undone=S.undo(restored);
 assert.equal(undone.bank,arrived.bank);assert.deepEqual(undone.contracts,JSON.parse(JSON.stringify(arrived.contracts)));assert.deepEqual(undone.ledger,arrived.ledger);assert.deepEqual(undone.lots,arrived.lots);assert.equal(A.decimal(S.used(undone)),'27');
});

test('mail income bypasses trading profit reduction, tax and freight lateness without changing sale accounting',()=>{
 for(const profit of [0,75,100]){
  const s=campaign();Object.assign(s.settings,{profit,tax:true,insurance:true});
  s.lots=[{...ownedLot,quantity:'1'}];
  const saleOptions={percent:profit,feePercent:0,taxEnabled:true,government:'4',criminal:false};
  const lines=[{lotId:'owned',quantity:1,unitPrice:80000,benchmarkPrice:70000}];
  const before=R.salePreview(s.lots,lines,saleOptions,core,mp),settings=structuredClone(s.settings);
  S.acceptContract(s,consignment(2,{dueHours:1}));s.actual='2,0';s.hours=1000;S.deliver(s,s.contracts[0].id,6);
  assert.equal(s.bank,'150000');assert.equal(s.contracts[0].payout,'50000');assert.equal(s.contracts[0].late,false);
  assert.deepEqual(s.settings,settings);assert.deepEqual(s.ledger.map(e=>[e.type,e.amount]),[['Mail delivery','50000']]);
  assert.deepEqual(R.salePreview(s.lots,lines,saleOptions,core,mp),before);assert.equal(before.tax.amount,'800');assert.equal(before.lines[0].afterTax,'19200');
  const report=campaignReport(s,core,{exportedAt:new Date('2026-10-08T00:00:00Z')});
  assert.match(report,/Realized trading profit \/ loss:\s+Cr 0/);assert.match(report,/Freight \/ mail income:\s+Cr 50,000/);
 }
});

test('new mail audits snapshot endpoint inputs without later world edits changing their source',()=>{
 const origin=context('A788800-9','Amber'),destination=context('E000100-6','Red');
 const m=offer({availabilityTotal:12,containerRoll:2},noRoll,{origin,destination,effect:12});
 const expected={origin:{name:'Port 0',population:8,starport:'A',techLevel:9,zone:'Amber'},destination:{name:'Port 0',population:1,starport:'E',techLevel:6,zone:'Red'}};
 assert.deepEqual(m.audit.worldInputs,expected);
 origin.world.name='Renamed';origin.uwp.population=0;origin.uwp.techLevel=1;origin.zone='Safe';destination.uwp.starport='A';
 assert.deepEqual(m.audit.worldInputs,expected);
 assert.deepEqual(JSON.parse(JSON.stringify(m)).audit.worldInputs,expected);
});
