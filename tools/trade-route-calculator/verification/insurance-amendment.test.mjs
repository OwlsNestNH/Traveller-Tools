import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';
import * as R from '../js/rules.mjs';
import {campaign,origin,destination} from './app-harness.mjs';
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const source=await readFile(new URL('fixtures/insurance-amendment-before-pilot.mjs',import.meta.url),'utf8');
const before=vm.runInNewContext(source+'\nbeforeInsuranceAmendment',{A,S});
function fixture({enabled=true,step=1,history='empty'}={}){
 const s=campaign();s.bank='1000000';s.settings.insurance=true;s.settings.creditStep=step;
 const extension={...destination,id:'2,0',x:2,name:'Extension',zone:'Amber'};s.worlds[extension.id]=extension;s.route=[origin.id,destination.id,extension.id];
 s.lots=[{id:'synthetic-lot',commodity:'11',description:'Synthetic insured cargo',quantity:'2.5',goodsValue:'100000',basis:'110000'}];
 const route=[origin.id,destination.id],quote={...R.insuranceQuote('100000',70,1,['Safe'],mp,null,step),route,destination:destination.id,routeProgress:0,plannedDistance:1,distanceOverrideReason:null};
 S.insureLot(s,'synthetic-lot',quote);s.settings.insurance=enabled;
 if(history==='omitted')delete s.policies[0].amendments;
 if(history==='prior')s.policies[0].amendments=[{hours:0,reason:'Earlier accepted terms',previous:{route:[...route],destination:destination.id,status:'active'},adjustment:'0'}];
 return S.validate(s);
}
function legacy(s,t){return before(s,{id:t.id,adjustment:t.adjustment,route:t.route,form:{mode:t.mode,reason:t.reason}});}
// Fixed UUID sequence makes both the exact ledger bytes and allocation count
// comparable. Restore the runtime method even when an action throws.
function seeded(call){
 const crypto=globalThis.crypto,descriptor=Object.getOwnPropertyDescriptor(crypto,'randomUUID');let calls=0;
 Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>`00000000-0000-4000-8000-${String(++calls).padStart(12,'0')}`});
 try{return {value:call(),calls};}finally{if(descriptor)Object.defineProperty(crypto,'randomUUID',descriptor);else delete crypto.randomUUID;}
}
function attempt(action,saved,terms){const s=structuredClone(saved),result=seeded(()=>{try{return {returned:action(s,terms),error:null};}catch(e){return {returned:undefined,error:e.message};}});return {...result.value,calls:result.calls,state:s};}
function sameAttempt(actual,expected,message){
 assert.equal(actual.returned,expected.returned,message);assert.equal(actual.error,expected.error,message);assert.equal(actual.calls,expected.calls,message);
 assert.equal(JSON.stringify(actual.state),JSON.stringify(expected.state),message+' (exact persisted bytes)');
}

test('accepted amend/close actions equal checkpoint draft bytes, errors and UUID count across adjustments/OFF/rounding/legacy history',()=>{
 let count=0;
 for(const mode of ['amend','close'])for(const enabled of [false,true])for(const step of [1,100])for(const history of ['omitted','empty','prior'])for(const status of ['active','arrived','amendment-required'])for(const reason of ['Accepted amendment','  Accepted reason retained  '])for(const quantity of ['2.5','0','-1']){
  const saved=fixture({enabled,step,history});saved.policies[0].status=status;saved.policies[0].remainingQuantity=quantity;
  const basis=BigInt(saved.lots[0].basis),bank=BigInt(saved.bank);
  for(const adjustment of [-basis-1n,-basis,-1n,0n,1n,50n,bank,bank+1n]){
   const terms={id:saved.policies[0].id,mode,adjustment,reason,route:[...saved.route]},unchanged=structuredClone(terms);Object.freeze(terms);
   const actual=attempt(S.amendInsurancePolicy,saved,terms),expected=attempt(legacy,saved,terms);sameAttempt(actual,expected,JSON.stringify({mode,enabled,step,history,status,reason,quantity,adjustment:String(adjustment)}));assert.deepEqual(terms,unchanged);
   assert.equal(actual.calls,actual.error?0:1,'One ledger UUID only on a successful action');count++;
  }
 }
 assert.equal(count,3456);
});
test('missing policy/lot, malformed Credits/history and error precedence match original without new validation or partial-write differences',()=>{
 for(const fault of ['policy','lot','remaining','bank','basis','history null','history object','ledger']){
  const saved=fixture({history:'omitted'}),terms={id:saved.policies[0].id,mode:'amend',adjustment:1n,reason:'Accepted',route:saved.route};
  if(fault==='policy')terms.id='missing';if(fault==='lot')saved.lots=[];if(fault==='remaining'){saved.policies[0].remainingQuantity='0';saved.bank='bad';}
  if(fault==='bank')saved.bank='bad';if(fault==='basis')saved.lots[0].basis='1.1';if(fault==='history null')saved.policies[0].amendments=null;if(fault==='history object')saved.policies[0].amendments={};if(fault==='ledger')saved.ledger=null;
  sameAttempt(attempt(S.amendInsurancePolicy,saved,terms),attempt(legacy,saved,terms),fault);
 }
});
test('headless accepted terms use existing transition, JSON reload/import and Undo with exact debit/refund and legacy absence restoration',()=>{
 for(const enabled of [false,true])for(const mode of ['amend','close'])for(const adjustment of [-200n,0n,200n])for(const history of ['omitted','prior']){
  const saved=fixture({enabled,step:100,history}),beforeBytes=JSON.stringify(saved),terms={id:saved.policies[0].id,mode,adjustment,reason:'Accepted headless terms',route:[...saved.route]};
  const actual=seeded(()=>S.transition(saved,'Insurance amended',s=>S.amendInsurancePolicy(s,terms))),expected=seeded(()=>S.transition(saved,'Insurance amended',s=>legacy(s,terms)));
  assert.equal(JSON.stringify(actual.value),JSON.stringify(expected.value),'Exact committed bytes match checkpoint');assert.equal(actual.calls,expected.calls);assert.equal(actual.calls,3,'Same one ledger plus Undo/event UUIDs');const next=actual.value;
  assert.equal(next.bank,String(BigInt(saved.bank)-adjustment));assert.equal(next.lots[0].basis,String(BigInt(saved.lots[0].basis)+adjustment));assert.equal(next.lots[0].quantity,saved.lots[0].quantity);assert.equal(next.lots[0].goodsValue,saved.lots[0].goodsValue);assert.equal(next.settings.insurance,enabled);assert.equal(next.ledger.length,saved.ledger.length+1);
  const reloaded=S.validate(JSON.parse(JSON.stringify(next)));assert.deepEqual(reloaded,next,'Validated JSON import/reload keeps all bytes/terms');
  const undone=S.undo(reloaded);for(const key of ['bank','lots','policies','ledger','worlds','route','routeIndex','hours','settings','ship','snapshots'])assert.deepEqual(undone[key],saved[key],key);
  assert.equal(Object.hasOwn(undone.policies[0],'amendments'),history!=='omitted','Undo restores omitted legacy history rather than creating it');assert.equal(JSON.stringify(saved),beforeBytes,'Transition never mutates input campaign');
 }
});
test('state action retains route/history references and whole-Credit accepted amount without re-rounding',()=>{
 const s=fixture({enabled:false,step:100}),policy=s.policies[0],oldRoute=policy.route,oldPremium=policy.premium,oldClaims=policy.claims,route=[...s.route],oldBank=s.bank,oldBasis=s.lots[0].basis;
 assert.equal(S.amendInsurancePolicy(s,{id:policy.id,mode:'amend',adjustment:50n,reason:'Accepted 50 Credits',route}),undefined);
 assert.equal(policy.route,route);assert.equal(policy.amendments.at(-1).previous.route,oldRoute);assert.equal(policy.premium,oldPremium);assert.equal(policy.claims,oldClaims);assert.equal(s.bank,String(BigInt(oldBank)-50n));assert.equal(s.lots[0].basis,String(BigInt(oldBasis)+50n));assert.equal(s.settings.insurance,false);
 const huge=fixture();huge.bank='900719925474099312345000';huge.lots[0].basis='900719925474099312345000';
 const terms={id:huge.policies[0].id,mode:'amend',adjustment:90071992547409931234567n,reason:'Accepted large Credits',route:huge.route};
 const actual=attempt(S.amendInsurancePolicy,huge,terms);sameAttempt(actual,attempt(legacy,huge,terms),'Beyond floating-point precision');
 assert.equal(actual.state.bank,String(BigInt(huge.bank)-terms.adjustment));assert.equal(actual.state.lots[0].basis,String(BigInt(huge.lots[0].basis)+terms.adjustment));
});
