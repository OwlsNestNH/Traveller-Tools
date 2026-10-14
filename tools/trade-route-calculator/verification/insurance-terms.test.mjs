import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as R from '../js/rules.mjs';
import * as M from '../js/map.mjs';
import * as A from '../js/amounts.mjs';
import * as S from '../js/state.mjs';
import {up,creditStep} from '../js/rounding.mjs';
import {prepareInsuranceTerms} from '../js/insurance-terms.mjs';
import {campaign,origin,destination,harness} from './app-harness.mjs';
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const original=await readFile(new URL('fixtures/insurance-terms-before-pilot.mjs',import.meta.url),'utf8');
const sandbox={R,M,A,up,creditStep,mp,state:null};
sandbox.world=id=>sandbox.state.worlds[id];
const before=vm.runInNewContext(original+'\npurchaseInsurance',sandbox);
function input(){return {requested:true,enabled:true,insuredValue:'100000',remainingRoute:[{id:origin.id,world:origin},{id:destination.id,world:destination},{id:'2,0',world:{...destination,id:'2,0',x:2,zone:'Amber'}},{id:'8,0',world:{...destination,id:'8,0',x:8,zone:'Red'}}],creditStep:1,mp,values:{legs:'1',distance:'1',distanceReason:'',coverage:'70',manualPremium:''}};}
function legacy(i){
 sandbox.state={route:i.remainingRoute.map(s=>s.id),routeIndex:0,worlds:Object.fromEntries(i.remainingRoute.map(s=>[s.id,s.world])),settings:{insurance:i.enabled,creditStep:i.creditStep}};
 const fields={insuranceLegs:i.values.legs,insuranceDistance:i.values.distance,distanceReason:i.values.distanceReason,coverage:i.values.coverage,manualPremium:i.values.manualPremium};
 return before({has:()=>i.requested,get:key=>fields[key]},null,i.insuredValue);
}
const json=value=>JSON.parse(JSON.stringify(value));
function outcome(call){try{return {value:json(call())};}catch(e){return {error:e.message};}}
test('terms equal checkpoint outputs/errors without mutation across route, zone, coverage, override and rounding combinations',()=>{
 let count=0;
 for(const requested of [false,true])for(const enabled of [false,true])for(const legs of ['0','1','2','4'])for(const distance of ['','1','2','8','-1','bad','0'])for(const coverage of ['70','100','bad','0'])for(const manualPremium of ['','0','101.1','-1'])for(const insuredValue of ['100000','900719925474099312345000'])for(const step of [1,100])for(const zones of ['Safe','Amber','Red']){
  const i=input();Object.assign(i,{requested,enabled,insuredValue,creditStep:step});i.values={legs,distance,distanceReason:distance==='8'?'Referee corridor':'',coverage,manualPremium};i.remainingRoute=i.remainingRoute.map(s=>({...s,world:{...s.world,zone:zones}}));
  const frozen=json(i);assert.deepEqual(outcome(()=>prepareInsuranceTerms(i)),outcome(()=>legacy(i)),JSON.stringify({requested,enabled,legs,distance,coverage,manualPremium,insuredValue,step,zones}));assert.deepEqual(json(i),frozen);count++;
 }
 assert.equal(count,21504);
});
test('error precedence and missing/unused route data stay equivalent; no new missing-world validation',()=>{
 for(const requested of [false,true])for(const enabled of [false,true])for(const legs of ['1','bad'])for(const reason of ['', 'Referee value']){
  const i=input();Object.assign(i,{requested,enabled});i.values.legs=legs;i.values.distance='8';i.values.distanceReason=reason;i.remainingRoute[1].world=undefined;
  assert.deepEqual(outcome(()=>prepareInsuranceTerms(i)),outcome(()=>legacy(i)));
 }
 const i=input();i.remainingRoute[3].world=undefined;assert.deepEqual(outcome(()=>prepareInsuranceTerms(i)),outcome(()=>legacy(i)),'Unused future stop does not affect selected route');
 const noReason=input();noReason.values.distance='8';assert.equal(outcome(()=>prepareInsuranceTerms(noReason)).error,'Add a reason for overriding the planned distance');
 const route=input();route.remainingRoute=route.remainingRoute.slice(0,1);assert.deepEqual(outcome(()=>prepareInsuranceTerms(route)),outcome(()=>legacy(route)));
});
test('headless held-cargo consumer preserves prefix/zones/terms and feeds existing policy mutation without dice',()=>{
 const i=input();i.values.legs='2';i.values.distance='2';i.remainingRoute[0].world={...origin,zone:'Amber'};i.remainingRoute[1].world={...destination,zone:'Amber'};
 const saved=json(i),quote=prepareInsuranceTerms(i);assert.deepEqual(quote.zones,['Amber']);assert.deepEqual(quote.route,[origin.id,destination.id,'2,0']);assert.equal(quote.plannedDistance,2);assert.equal(quote.distanceOverrideReason,null);
 const state=campaign();state.settings.insurance=true;state.worlds=Object.fromEntries(i.remainingRoute.map(s=>[s.id,s.world]));state.lots=[{id:'synthetic-lot',commodity:'11',description:'Synthetic cargo',quantity:'2.5',goodsValue:i.insuredValue,basis:i.insuredValue}];
 S.insureLot(state,'synthetic-lot',quote);assert.equal(state.policies[0].premium,quote.premium);assert.equal(state.policies[0].remainingQuantity,'2.5');assert.equal(state.lots[0].goodsValue,i.insuredValue);assert.equal(state.lots[0].basis,String(BigInt(i.insuredValue)+BigInt(quote.premium)));assert.equal(state.bank,String(100000n-BigInt(quote.premium)));assert.deepEqual(json(i),saved);
});
test('production wrapper preserves goods calculation before OFF and ordinary world lookup precedence',async()=>{
 const saved=campaign();saved.settings.insurance=false;saved.snapshots=[{id:'supplier',worldId:origin.id,party:'synthetic|supplier',partyName:'Supplier',options:{local:false},offers:[{id:'offer',commodity:'11',description:'Synthetic cargo',remaining:'6',unitPrice:'1001',audit:{}}]}];
 const h=harness(saved);h.api.buyForm('offer');h.fill({quantity:'0',fee:0});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'Quantity must be positive.');assert.equal(h.calls.saves,0);assert.deepEqual(h.persisted(),saved);
 const enabled=structuredClone(saved);enabled.settings.insurance=true;const e=harness(enabled);e.api.known[destination.id]={...destination,x:8,zone:'Red'};
 e.api.buyForm('offer');e.fill({quantity:1,fee:0,insure:true,coverage:70,insuranceLegs:1,insuranceDistance:1});e.api.stagePurchase();assert.equal(e.dom.ids.get('modal-error').textContent,'');const quote=e.api.modalSession.purchaseOwner.args.insurance;assert.equal(quote.plannedDistance,1);assert.deepEqual([...quote.zones],['Safe']);assert.equal(e.calls.saves,0);
});
