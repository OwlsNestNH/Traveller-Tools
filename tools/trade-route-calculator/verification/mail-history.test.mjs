import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {latestMailCheck,recordMailCheck,mailCheckHistoryStatus,validateMailHistory} from '../js/mail-history.mjs';
import {Store,KEY} from '../js/persistence.mjs';

const origin={id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Destination',hex:'0201'};
function campaign(){const s=S.initial();Object.assign(s,{initialized:true,actual:origin.id,bank:'100000',route:[origin.id,destination.id],worlds:{[origin.id]:origin,[destination.id]:destination}});return S.validate(s);}
function prepared(s,{id=S.uid(),available=true,combined=false}={}){
 const mailAudit={dice:{dice:[6,6],total:12},modifiers:{freight:1,armed:0,lowTech:0,rank:0,soc:0},total:available?13:7,target:12,...(available?{count:{dice:[3],total:3}}:{})};
 const terms={origin:s.actual,destination:destination.id,quantity:'15',payment:'75000',dueHours:null};
 return {id,label:combined?'Contract search audit':'Mail check audit',hours:s.hours,world:s.actual,destination:destination.id,mailOnly:!combined,searchDice:{dice:null,total:8,manual:true},generatedSearchDice:{dice:[3,3],total:6},effectiveSearchDice:8,searchSkill:0,searchCharacteristic:0,effect:0,manualDice:[6,6,3],manualDiceConsumed:available?3:2,mailAudit,offers:[...(combined?[{...terms,kind:'freight',offerId:id+'-freight',audit:{dice:{dice:[3],total:3}}}]:[]),...(available?[{...terms,kind:'mail',offerId:id+'-mail',audit:structuredClone(mailAudit)}]:[])]};
}
function check(s,options={}){return S.transition(s,options.combined?'Contract search':'Mail check',x=>recordMailCheck(x,prepared(x,options)));}
function old(s){s=structuredClone(s);delete s.latestMailCheckId;for(const e of s.events)delete e.supersedesMailCheckId;for(const u of s.undo)u.inverse=u.inverse.filter(op=>op.path[0]!=='latestMailCheckId');return s;}
const roundtrip=s=>S.validate(JSON.parse(JSON.stringify(s)));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const part of Object.values(value))freeze(part);}return value;}

test('fresh campaigns have one empty latest reference and no historical Mail',()=>{
 const s=campaign();assert.equal(s.latestMailCheckId,null);assert.equal(latestMailCheck(s),null);assert.deepEqual(mailCheckHistoryStatus(s,'missing'),{status:'historical'});
 assert.equal(validateMailHistory(s),s);assert.equal(latestMailCheck(old(s)),null);
});

test('repeated available and unavailable checks replace one reference and retain every frozen roll',()=>{
 for(const available of [true,false]){
  let s=check(campaign(),{id:'first'});const first=JSON.stringify(latestMailCheck(s));
  s=check(s,{id:'second',available});assert.equal(s.latestMailCheckId,'second');assert.equal(latestMailCheck(s).id,'second');assert.equal(latestMailCheck(s).supersedesMailCheckId,'first');assert.equal(JSON.stringify(s.events.find(e=>e.id==='first')),first);
  assert.equal(latestMailCheck(s).offers.length,available?1:0);assert.equal(s.events.filter(e=>e.label==='Mail check audit').length,2);
  assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'superseded',supersededById:'second'});assert.deepEqual(mailCheckHistoryStatus(s,'second'),{status:'latest'});
  s=check(s,{id:'third'});assert.equal(latestMailCheck(s).supersedesMailCheckId,'second');assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'superseded',supersededById:'second'});assert.deepEqual(mailCheckHistoryStatus(s,'second'),{status:'superseded',supersededById:'third'});
 }
});

test('recording clones prepared audits without mutating previous audits, inputs, freight or finances',()=>{
 const s=check(campaign(),{id:'combined',combined:true});
 s.contracts.push({id:'accepted-freight',offerId:'saved-freight',kind:'freight',status:'accepted',origin:origin.id,destination:destination.id,quantity:'5',payment:'5000',dueHours:null});
 const previous=freeze(s.events.find(e=>e.id==='combined')),before=JSON.stringify(previous),material=JSON.stringify({contracts:s.contracts,bank:s.bank,ledger:s.ledger,lots:s.lots});
 const input=freeze(prepared(s,{id:'next',available:false})),inputJSON=JSON.stringify(input),saved=recordMailCheck(s,input);
 assert.notEqual(saved,input);assert.notEqual(saved.mailAudit,input.mailAudit);assert.equal(JSON.stringify(input),inputJSON);assert.equal(JSON.stringify(previous),before);assert.equal(JSON.stringify({contracts:s.contracts,bank:s.bank,ledger:s.ledger,lots:s.lots}),material);
 assert.equal(saved.supersedesMailCheckId,previous.id);assert.equal(previous.offers[0].kind,'freight');assert.equal(previous.offers.length,2);assert.equal(s.events.at(-1),saved);
});

test('combined searches participate in the same Mail chain and keep freight results untouched',()=>{
 let s=check(campaign(),{id:'mail'});s=check(s,{id:'combined',combined:true});const combined=JSON.stringify(latestMailCheck(s));
 assert.equal(latestMailCheck(s).supersedesMailCheckId,'mail');assert.deepEqual(latestMailCheck(s).offers.map(o=>o.kind),['freight','mail']);
 s=check(s,{id:'no-mail',available:false});assert.equal(latestMailCheck(s).supersedesMailCheckId,'combined');assert.equal(JSON.stringify(s.events.find(e=>e.id==='combined')),combined);
 assert.deepEqual(mailCheckHistoryStatus(s,'combined'),{status:'superseded',supersededById:'no-mail'});
});

test('Undo restores only the previous read-only reference, never offers or contracts',()=>{
 const first=check(campaign(),{id:'first'});let s=check(first,{id:'second',combined:true});const history=JSON.stringify(s.events);
 assert.deepEqual(s.undo.at(-1).inverse,[{path:['latestMailCheckId'],value:'first'}]);
 s=S.undo(s);assert.equal(s.latestMailCheckId,'first');assert.equal(latestMailCheck(s).id,'first');assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'latest'});assert.deepEqual(mailCheckHistoryStatus(s,'second'),{status:'historical'});
 assert.equal(JSON.stringify(s.events.slice(0,-1)),history);assert.deepEqual(s.contracts,[]);assert.equal(Object.hasOwn(s,'contractDrafts'),false);assert.equal(s.bank,first.bank);assert.deepEqual(s.ledger,first.ledger);
 s=S.undo(s);assert.equal(s.latestMailCheckId,null);assert.equal(latestMailCheck(s),null);assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'historical'});assert.equal(s.events.filter(e=>e.offers).length,2);
});

test('a fresh check after Undo excludes the abandoned branch and Undo returns to the surviving check',()=>{
 let s=check(check(campaign(),{id:'first'}),{id:'undone'});s=S.undo(s);s=check(s,{id:'replacement',available:false});
 assert.equal(latestMailCheck(s).supersedesMailCheckId,'first');assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'superseded',supersededById:'replacement'});assert.deepEqual(mailCheckHistoryStatus(s,'undone'),{status:'historical'});
 s=S.undo(s);assert.equal(latestMailCheck(s).id,'first');assert.deepEqual(mailCheckHistoryStatus(s,'replacement'),{status:'historical'});
});

test('unrelated actions, acceptance and cancellation do not replace the latest check',()=>{
 let s=check(campaign(),{id:'first'});s=S.transition(s,'Accepted mail',x=>S.acceptContract(x,x.events.find(e=>e.id==='first').offers[0]));
 assert.equal(latestMailCheck(s).id,'first');s=S.transition(s,'Cancelled mail',x=>S.cancelMail(x,x.contracts[0].id));assert.equal(latestMailCheck(s).id,'first');
 s=S.transition(s,'Date correction',x=>{x.hours=24;});assert.equal(latestMailCheck(s).id,'first');s=S.undo(s);assert.equal(latestMailCheck(s).id,'first');assert.equal(s.contracts[0].status,'cancelled');
});

test('legacy reconstruction is read-only and recognizes active Mail and combined checks',()=>{
 for(const combined of [false,true]){
  let s=old(check(check(campaign(),{id:'first'}),{id:'last',combined}));s=S.transition(s,'Unrelated setting',x=>{x.ship.armed=true;});const saved=JSON.stringify(s);
  assert.equal(latestMailCheck(s).id,'last');assert.deepEqual(mailCheckHistoryStatus(s,'last'),{status:'latest'});assert.equal(JSON.stringify(s),saved);assert.equal(Object.hasOwn(s,'latestMailCheckId'),false);assert.deepEqual(roundtrip(s),s);
 }
});

test('legacy replay never treats an undone audit as the latest and supports an Undo branch',()=>{
 let s=old(check(check(campaign(),{id:'first'}),{id:'undone'}));s=S.undo(s);assert.equal(latestMailCheck(s).id,'first');assert.deepEqual(mailCheckHistoryStatus(s,'undone'),{status:'historical'});
 const current=check(s,{id:'new'});assert.equal(latestMailCheck(current).supersedesMailCheckId,'first');assert.equal(current.latestMailCheckId,'new');
 const restored=S.undo(current);assert.equal(Object.hasOwn(restored,'latestMailCheckId'),false);assert.equal(latestMailCheck(restored).id,'first');
 s=S.undo(s);assert.equal(latestMailCheck(s),null);
});

test('legacy revision gaps across imports are allowed for read-only history',()=>{
 let s=old(check(campaign(),{id:'first'}));s.revision=99;s=S.transition(s,'Imported setting',x=>{x.name='After import';});s.revision=1;
 assert.equal(latestMailCheck(s).id,'first');s=check(s,{id:'new'});assert.equal(latestMailCheck(s).supersedesMailCheckId,'first');assert.equal(latestMailCheck(roundtrip(s)).id,'new');
});

test('incomplete or contradictory legacy audit/action/Undo trails fail closed without rewriting data',()=>{
 const base=old(check(check(campaign(),{id:'first'}),{id:'last',combined:true}));
 const mutations=[s=>{s.undo=[];},s=>{s.undo.pop();},s=>{s.undo.at(-1).label='Different action';},s=>{s.events.pop();},s=>{s.events=s.events.filter(e=>e.id!=='last');},s=>{s.events.at(-1).label='Mail check';},s=>{s.events.at(-1).hours=24;},s=>{s.events.at(-1).world=destination.id;},s=>{delete s.events.at(-1).revision;},s=>{s.events.at(-1).revision=-1;},s=>{s.events.push(prepared(s,{id:'orphan'}));},s=>{delete s.events.find(e=>e.id==='last').mailAudit;},s=>{s.events.push({id:'bad-undo',label:'Undo: Different action',revision:s.revision+1,hours:0});}];
 for(const mutate of mutations){const s=structuredClone(base);mutate(s);const before=JSON.stringify(s);assert.equal(latestMailCheck(s),null);assert.deepEqual(mailCheckHistoryStatus(s,'first'),{status:'historical'});assert.equal(JSON.stringify(s),before);S.validate(s);}
});

test('a fresh recorded check is usable after unverified old history without inventing a supersession',()=>{
 let s=old(check(campaign(),{id:'unverified'}));s.undo=[];assert.equal(latestMailCheck(s),null);
 s=check(s,{id:'fresh'});assert.equal(latestMailCheck(s).id,'fresh');assert.equal(Object.hasOwn(latestMailCheck(s),'supersedesMailCheckId'),false);
 s=S.undo(s);assert.equal(latestMailCheck(s),null);assert.deepEqual(mailCheckHistoryStatus(s,'fresh'),{status:'historical'});
});

test('legacy cancellation verification remains compatible with the new persisted history reference',()=>{
 let s=check(campaign(),{id:'first'});s=S.transition(s,'Accepted mail',x=>S.acceptContract(x,x.events.find(e=>e.id==='first').offers[0]));
 delete s.contracts[0].firstDeparture;delete s.contracts[0].acceptanceEventId;s.events=s.events.filter(e=>e.label!=='Mail acceptance audit');
 assert.equal(S.mailCancellationEligibility(s,s.contracts[0].id).allowed,true);assert.equal(S.mailCancellationEligibility(s,s.contracts[0].id).source,'legacy-undo');
 s=check(s,{id:'second'});assert.equal(S.mailCancellationEligibility(s,s.contracts[0].id).allowed,true);s=S.transition(s,'Cancelled mail',x=>S.cancelMail(x,x.contracts[0].id));assert.equal(s.contracts[0].status,'cancelled');assert.equal(latestMailCheck(s).id,'second');
 s=S.undo(s);assert.equal(S.mailCancellationEligibility(s,s.contracts[0].id).allowed,true);assert.equal(latestMailCheck(s).id,'second');
});

test('malformed supersession and latest references reject current JSON validation',()=>{
 const base=check(check(campaign(),{id:'first'}),{id:'last'});
 const mutations=[
  ...[undefined,0,{},[],false,'','missing',base.events[1].id].map(value=>s=>{s.latestMailCheckId=value;}),
  ...[undefined,null,0,{},[],false,'','missing','last',base.events[1].id].map(value=>s=>{s.events.find(e=>e.id==='last').supersedesMailCheckId=value;}),
  s=>{s.events.find(e=>e.id==='first').supersedesMailCheckId='last';},
  s=>{s.events[1].supersedesMailCheckId='first';},
  s=>{s.latestMailCheckId='first';},
  s=>{s.events.pop();},
 ];
 for(const [index,mutate] of mutations.entries()){const invalid=structuredClone(base);mutate(invalid);assert.throws(()=>S.validate(invalid),/Mail check/,'Malformed case '+index);}
 const undone=S.undo(base);undone.latestMailCheckId='last';assert.throws(()=>S.validate(undone),/latest Mail check/);assert.equal(latestMailCheck(undone),null);
 assert.deepEqual(roundtrip(base),base);
});

test('recording refuses duplicate IDs and non-Mail audits and determines its own supersession link',()=>{
 const s=check(campaign(),{id:'first'}),before=JSON.stringify(s);
 for(const event of [prepared(s,{id:'first'}),{...prepared(s),mailAudit:null},{...prepared(s),offers:{}},{...prepared(s),label:'Other audit'},{...prepared(s),id:'bad id'}])assert.throws(()=>recordMailCheck(s,event),/Invalid Mail check audit/);
 assert.equal(JSON.stringify(s),before);const event=prepared(s,{id:'second'});event.supersedesMailCheckId='guessed';const saved=recordMailCheck(s,event);assert.equal(saved.supersedesMailCheckId,'first');assert.equal(event.supersedesMailCheckId,'guessed');
});

test('Store import/reload preserves one latest reference and refuses malformed imports before any write',t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map();let writes=0;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{writes++;saved.set(key,value);}}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;});
 const store=Object.create(Store.prototype);Object.assign(store,{editable:true,onChange:()=>{},onRole:()=>{}});
 const base=check(check(campaign(),{id:'first'}),{id:'last',available:false});saved.set(KEY,JSON.stringify(campaign()));store.replace(base,0);
 let read=store.read();assert.equal(read.latestMailCheckId,'last');assert.equal(latestMailCheck(read).id,'last');assert.deepEqual(read.events,base.events);assert.equal(writes,1);
 for(const mutate of [s=>{s.latestMailCheckId='missing';},s=>{s.events.find(e=>e.id==='last').supersedesMailCheckId='last';},s=>{s.events.find(e=>e.id==='first').supersedesMailCheckId='last';},s=>{s.latestMailCheckId=s.events[1].id;}]){
  const invalid=structuredClone(base),before=saved.get(KEY);mutate(invalid);assert.throws(()=>store.replace(invalid,read.revision),/Mail check/);assert.equal(saved.get(KEY),before);assert.equal(writes,1);
 }
 store.save(S.undo(read),read.revision);read=store.read();assert.equal(latestMailCheck(read).id,'first');assert.deepEqual(mailCheckHistoryStatus(read,'last'),{status:'historical'});
 const legacy=old(base);store.replace(legacy,read.revision);read=store.read();assert.equal(Object.hasOwn(read,'latestMailCheckId'),false);assert.equal(latestMailCheck(read).id,'last');assert.deepEqual(read.events,legacy.events);
});

const malformedDisplayEdits=[
 e=>{e.offers=Array(1);},e=>{e.offers=[null];},e=>{e.offers=[3];},e=>{e.offers=[[]];},e=>{e.offers.push({...e.offers[0],offerId:'duplicate-mail'});},
 ...[undefined,null,'',{},[],true,'not-a-number','0','-1','1e30'].map(value=>e=>{e.offers[0].quantity=value;}),
 ...[undefined,null,'',{},[],true,'not-a-number','-1','1.5'].map(value=>e=>{e.offers[0].payment=value;}),
 ...['offerId','origin','destination'].flatMap(key=>[undefined,{},'unsafe id'].map(value=>e=>{e.offers[0][key]=value;})),
 e=>{e.world={};},e=>{e.destination=[];},
 e=>{e.mailAudit.dice={dice:'66',total:12};},e=>{e.mailAudit.count={dice:{length:1},total:3};},e=>{e.mailAudit.searchDice={dice:[{}],total:8};},
 e=>{e.searchDice={dice:'44',total:8};},e=>{e.generatedSearchDice={dice:[{}],total:6};},
 e=>{e.mailAudit.dm={total:{toString:0}};},e=>{e.mailAudit.modifiers={rank:{toString:0}};},e=>{e.mailAudit.worldInputs={origin:{name:{toString:0}}};},
];

test('malformed legacy display records remain importable but cannot reconstruct a Mail card',()=>{
 const base=old(check(campaign(),{id:'legacy'}));
 for(const [index,mutate]of malformedDisplayEdits.entries()){
  const s=structuredClone(base);mutate(s.events.find(e=>e.id==='legacy'));const before=JSON.stringify(s);
  assert.doesNotThrow(()=>S.validate(s),'Legacy shape '+index);assert.equal(latestMailCheck(s),null,'Unsafe display shape '+index);assert.deepEqual(mailCheckHistoryStatus(s,'legacy'),{status:'historical'});assert.equal(JSON.stringify(s),before);
 }
 const incomplete=structuredClone(base);incomplete.events[0].offers=[null];const fresh=check(incomplete,{id:'fresh'});
 assert.equal(latestMailCheck(fresh).id,'fresh');assert.equal(Object.hasOwn(latestMailCheck(fresh),'supersedesMailCheckId'),false);
});

test('explicit references and fresh recording reject malformed Mail display inputs before mutation',()=>{
 const base=check(campaign(),{id:'current'});
 for(const [index,mutate]of malformedDisplayEdits.entries()){
  const s=structuredClone(base),event=s.events.find(e=>e.id==='current');mutate(event);
  assert.equal(latestMailCheck(s),null);assert.throws(()=>S.validate(s),/latest Mail check/,'Explicit shape '+index);
  const target=campaign(),before=JSON.stringify(target);assert.throws(()=>recordMailCheck(target,event),/Invalid Mail check audit/);assert.equal(JSON.stringify(target),before);
 }
});

test('legacy checks with missing roll components, fractional tons and exact large or zero Credits remain readable',()=>{
 for(const payment of ['0','99999999999999999999999999999999999999999999999999']){
  const s=old(check(campaign(),{id:'legacy'})),event=s.events[0];event.mailAudit={};delete event.searchDice;delete event.generatedSearchDice;event.offers[0].quantity='0.125';event.offers[0].payment=payment;
  assert.equal(latestMailCheck(s).id,'legacy');assert.deepEqual(roundtrip(s),s);s.latestMailCheckId='legacy';assert.equal(latestMailCheck(roundtrip(s)).id,'legacy');
 }
});

test('malformed display imports with explicit latest references cannot replace saved bytes',t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map();let writes=0;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{writes++;saved.set(key,value);}}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;});
 const store=Object.create(Store.prototype);Object.assign(store,{editable:true,onChange:()=>{},onRole:()=>{}});
 const base=check(campaign(),{id:'current'}),before=JSON.stringify(base);saved.set(KEY,before);
 for(const mutate of malformedDisplayEdits){
  const invalid=structuredClone(base);mutate(invalid.events[0]);assert.throws(()=>store.replace(invalid,base.revision),/latest Mail check/);assert.equal(saved.get(KEY),before);assert.equal(writes,0);
 }
});
