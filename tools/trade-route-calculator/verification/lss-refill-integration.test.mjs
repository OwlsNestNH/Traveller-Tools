import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/amounts.mjs';
import * as S from '../js/state.mjs';
import {supportStock,supportCargo,supportAmount,consumeSupport} from '../js/life-support.mjs';
import {campaignRefillDraft,editRefillDraft} from '../js/lss-refill-draft.mjs';
import {compartmentRefillQuote} from '../js/lss-refill-transaction.mjs';
import {supportCompartments,consumeCompartments} from '../js/lss-compartments.mjs';
import {createServicePanels} from '../js/service-panels.mjs';
import {SaveNotCommittedError} from '../js/persistence.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';
const eq=(actual,expected)=>assert.equal(A.cmp(supportAmount(actual),expected),0);
const campaign=()=>{const s=campaignBaseline();s.ship.lifeSupport={capacityHours:672,stockUnits:A.auditNumber('16.2'),cargoUnits:A.auditNumber('3.4')};return s;};
const draft=s=>campaignRefillDraft(s).draft;
test('cargo-only refill discards only cargo fraction on commit and exactly undoes',()=>{
 const s=campaign(),before=structuredClone(s),d=editRefillDraft(draft(s),'cargo',100),q=compartmentRefillQuote(s,d);
 eq(q.purchasedUnits,97);eq(q.discardedUnits,'0.4');eq(q.compartments.internal.after,'12.8');assert.deepEqual(s,before);
 const n=S.transition(s,'Refilled life support',n=>S.refillCompartments(n,d));eq(n.ship.lifeSupport.stockUnits,'112.8');eq(n.ship.lifeSupport.cargoUnits,100);eq(supportCargo(n.ship),1);assert.equal(n.ledger.length,s.ledger.length+1);assert.deepEqual(S.undo(n).ship,s.ship);
});
test('internal refill preserves fractional cargo and paid reductions require GM',()=>{
 const s=campaign(),d=editRefillDraft(draft(s),'internal',800),q=compartmentRefillQuote(s,d);eq(q.purchasedUnits,788);eq(q.discardedUnits,'0.8');eq(q.afterCargoUnits,'3.4');
 assert.throws(()=>compartmentRefillQuote(s,editRefillDraft(draft(s),'cargo',2)),/GM Adjustment/);
 const same=compartmentRefillQuote(s,editRefillDraft(draft(s),'cargo',3));eq(same.discardedUnits,0);eq(same.afterCargoUnits,'3.4');assert.equal(same.changed,false);
});
test('GM records exact targets without bank charge, retains other compartment and supports Undo',()=>{
 const s=campaign(),d=editRefillDraft(draft(s),'cargo',0);d.reason='Inventory count';
 const n=S.transition(s,'Adjusted life support',n=>S.refillCompartments(n,d,{gm:true}));assert.equal(n.bank,s.bank);assert.equal(n.ledger.length,s.ledger.length);eq(n.ship.lifeSupport.stockUnits,'12.8');eq(n.ship.lifeSupport.cargoUnits,0);assert.ok(n.events.some(e=>e.lifeSupportAdjustment?.reason==='Inventory count'));assert.deepEqual(S.undo(n).ship,s.ship);
});
test('cargo-first hourly consumption stays exact across split and export/import',()=>{
 const s=campaign();s.ship.accommodation.passengers.high=0;s.ship.accommodation.crew.middle=1;
 const allocation=supportCompartments(s.ship),predicted=consumeCompartments(allocation,A.rat(1,24));consumeSupport(s.ship,1);
 assert.deepEqual(supportCompartments(s.ship),predicted);eq(supportStock(s.ship).internalUnits,'12.8');
 for(let i=0;i<95;i++)consumeSupport(s.ship,1);eq(s.ship.lifeSupport.cargoUnits,0);eq(s.ship.lifeSupport.stockUnits,'12.2');assert.deepEqual(S.validate(JSON.parse(JSON.stringify(s))).ship,s.ship);
});
test('allocation validation rejects bad imports; legacy reads never migrate',()=>{
 for(const cargo of ['-1','17']){const s=campaign();s.ship.lifeSupport.cargoUnits=A.auditNumber(cargo);assert.throws(()=>S.validate(s),/allocation/);}
 const s=campaign();s.ship.lifeSupport={capacityHours:672,remainingHours:24};const bytes=JSON.stringify(s);draft(s);assert.equal(JSON.stringify(s),bytes);
});
test('capacity and rates are revalidated against campaign; comfort never discards stock',()=>{
 const s=campaign(),d=editRefillDraft(draft(s),'fill-cargo');s.ship.capacity='1';assert.throws(()=>compartmentRefillQuote(s,d),/capacity/);
 const t=campaign();t.ship.accommodation.refillRates={middle:'2000',high:'6000'};const q=compartmentRefillQuote(t,editRefillDraft(draft(t),'cargo',100));assert.equal(q.monthly,'14000');
 const comfort=editRefillDraft(editRefillDraft(draft(t),'comfortCredits','777'),'comfortNote','Fresh provisions');const c=compartmentRefillQuote(t,comfort);assert.equal(c.amount,'777');eq(c.discardedUnits,0);eq(c.afterStockUnits,'16.2');
});
test('zero-rate paid loading remains a purchase; GM works with no complement or Credits',()=>{
 const s=campaign();s.ship.accommodation.refillRates={middle:'0',high:'0'};s.bank='0';
 const d=editRefillDraft(draft(s),'cargo',100),n=S.transition(s,'Refilled life support',n=>S.refillCompartments(n,d));assert.equal(n.bank,'0');eq(n.ship.lifeSupport.cargoUnits,100);eq(n.ledger.at(-1).expense.discardedUnits,'0.4');assert.equal(n.ledger.at(-1).amount,'0');
 s.ship.accommodation.passengers.high=0;s.ship.accommodation.crew.middle=0;
 const gm=S.transition(s,'Adjusted life support',n=>S.refillCompartments(n,editRefillDraft(draft(s),'cargo',100),{gm:true}));assert.equal(gm.bank,'0');eq(gm.ship.lifeSupport.cargoUnits,100);
});
test('manual and booked frozen occupants both bill once at the Low rate',()=>{
 const s=campaign();s.ship.accommodation.passengers.high=0;s.ship.accommodation.crew.middle=0;s.ship.accommodation.occupiedLowBerths=1;s.contracts=[{kind:'passenger',status:'accepted',passageClass:'low',count:1,cabinMode:'low'}];
 const q=compartmentRefillQuote(s,editRefillDraft(draft(s),'cargo',10));assert.equal(q.low,2);assert.equal(q.monthly,'200');eq(q.dailyUnits,'0.2');assert.equal(q.amount,'250');
});
function harness(){let state=campaign(),form=null,editable=true;const h={commits:0};const document={getElementById:id=>id==='service-form'?form:null,querySelector:()=>null,querySelectorAll:()=>[]};h.services=createServicePanels({document,redesignedSupport:true,getState:()=>state,isEditable:()=>editable,commit(label,fn,revision){assert.equal(revision,state.revision);h.commits++;if(h.save)return h.save(()=>state=S.transition(state,label,fn));state=S.transition(state,label,fn);},render(){form=null;},showOverview(){},message(){},nextJumpFuel:()=>0});h.state=()=>state;h.readOnly=()=>editable=false;h.fill=values=>{form={dataset:{serviceToken:h.services.token()},elements:Object.entries(values).map(([name,value])=>({name,value:String(value)}))};h.services.sync();};h.action=name=>h.services.action(name,'',h.services.token());return h;}
test('integrated controls cancel without writes and GM ignores comfort purchase',async()=>{
 const h=harness(),before=structuredClone(h.state());h.services.open('support');h.fill({cargo:100});assert.match(h.services.panel(),/TOTAL refill cost/);assert.doesNotMatch(h.services.panel(),/Review changes/);await h.action('service-cancel');assert.deepEqual(h.state(),before);assert.equal(h.commits,0);
 h.services.open('support');h.fill({cargo:0,comfortCredits:1000});await h.action('service-gm');assert.equal(h.state().bank,before.bank);eq(h.state().ship.lifeSupport.stockUnits,'12.8');
});
test('pending confirmation freezes controls, blocks cancel and duplicate confirmation',async()=>{
 const h=harness();let finish;h.save=apply=>new Promise(resolve=>finish=()=>{apply();resolve();});h.services.open('support');h.fill({cargo:100});const token=h.services.token(),pending=h.action('service-confirm');assert.equal(h.services.committing(),true);h.fill({cargo:200});await h.action('service-cancel');await h.action('service-confirm');assert.equal(h.commits,1);finish();await pending;eq(h.state().ship.lifeSupport.cargoUnits,100);await h.services.action('service-confirm','',token);assert.equal(h.commits,1);
});
test('definite failure preserves exact fractions and permits retry; uncertain failure latches',async()=>{
 const h=harness(),before=structuredClone(h.state());h.services.open('support');h.fill({cargo:100});h.save=()=>Promise.reject(new SaveNotCommittedError(Error('disk full')));await assert.rejects(h.action('service-confirm'),/disk full/);assert.deepEqual(h.state(),before);h.save=null;await h.action('service-confirm');eq(h.state().ship.lifeSupport.cargoUnits,100);
 const u=harness();u.services.open('support');u.fill({cargo:100});u.save=()=>Promise.reject(Error('unknown'));await assert.rejects(u.action('service-confirm'),/Reload/);await assert.rejects(u.action('service-confirm'),/Reload/);assert.equal(u.commits,1);
});
test('stale token and lost ownership cannot pay a replacement draft',async()=>{
 const h=harness();h.services.open('support');const token=h.services.token();await h.action('service-cancel');h.services.open('support');h.fill({cargo:100});await h.services.action('service-confirm','',token);assert.equal(h.commits,0);h.readOnly();await assert.rejects(h.action('service-confirm'),/ownership/);assert.equal(h.commits,0);
});
