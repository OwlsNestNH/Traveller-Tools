import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as R from '../js/rules.mjs';
import {creditStep} from '../js/rounding.mjs';
import {prepareMarketOfferOverride,applyMarketOfferOverride} from '../js/market-offer.mjs';
import {campaign,core,origin,S,A} from './app-harness.mjs';
const frozen=await readFile(new URL('fixtures/market-offer-before-pilot.mjs',import.meta.url),'utf8');
const before=vm.runInNewContext(frozen+'\nbeforeMarketOffer',{A,R,creditStep});
function fixture(step=1,history='omitted'){
 const s=campaign();s.settings.creditStep=step;
 const offer={id:'synthetic-offer',commodity:'11',remaining:'2.5',quantity:'5',unitPrice:'1200',description:'Original description',illegal:false,manualRequired:true,expired:false,audit:{dice:{dice:[2,3,4],total:9},quantityRolls:[{dice:[2],populationDM:3,multiplier:1,tons:5}],randomDraws:['11'],original:'Retained audit'}};
 if(history!=='omitted'){offer.overrides=[];offer.previousAudits=[];}
 if(history==='prior'){offer.overrides.push({hours:0,reason:'Earlier override',before:{remaining:'5',unitPrice:'1000'},after:{remaining:'2.5',unitPrice:'1200'}});offer.previousAudits.push({original:'Prior original audit'});}
 s.snapshots=[{id:'synthetic-snapshot',kind:'supplier',party:'supplier',partyName:'Synthetic supplier',hours:0,startedHours:0,worldId:origin.id,world:R.context(origin,core),options:{skill:2,counterparty:2,banThreshold:5,useRawIllegalPrices:true},offers:[offer]}];
 return s;
}
function form(values){return {get:key=>values[key]??null,has:key=>!!values[key]};}
function legacy(s,values,act){const snap=s.snapshots[0];return before(form(values),snap,snap.offers[0],s,core,act);}
function prepare(s,values){const snap=s.snapshots[0];return prepareMarketOfferOverride({values,commodity:snap.offers[0].commodity,world:snap.world,options:snap.options,creditStep:creditStep(s),core});}
function run(saved,values,old){const s=structuredClone(saved);let calls=0,error=null,result;try{const act=(label,fn)=>{calls++;assert.equal(label,'Market override');return fn(s);};result=old?legacy(s,values,act):actAfter();function actAfter(){const prepared=prepare(s,values);return act('Market override',draft=>applyMarketOfferOverride(draft.snapshots[0].offers[0],draft.hours,prepared));}}catch(e){error=e.message;}return {bytes:JSON.stringify(s),error,result,calls};}
const defaults={quantity:'1.25',price:'123456',reason:'  Referee reason retained  ',useRoll:false,roll:'10',illegal:false,expirationNote:'  until next visit  ',description:'Referee description'};
test('3,072 override cases preserve exact draft bytes, errors, act boundary and audit history',()=>{
 let count=0;
 for(const quantity of ['0','1.25','-1','bad'])for(const price of ['0','1234.5','-1','bad'])for(const reason of ['  Accepted reason  ',' '])for(const roll of ['3','10','18','bad'])for(const useRoll of [false,true])for(const illegal of [false,true])for(const step of [1,100])for(const history of ['omitted','empty','prior']){
  const s=fixture(step,history),values={...defaults,quantity,price,reason,roll,useRoll,illegal},bytes=JSON.stringify(s),input=JSON.stringify(values);
  assert.deepEqual(run(s,values,false),run(s,values,true),JSON.stringify({values,step,history}));assert.equal(JSON.stringify(s),bytes);assert.equal(JSON.stringify(values),input);count++;
 }
 assert.equal(count,3072);
});
test('Exotics, unknown worlds, huge decimals and malformed legacy history retain errors and partial drafts',()=>{
 for(const useRoll of [false,true])for(const variant of ['exotic','unknown','huge','overrides-null','overrides-object','audits-object']){
  const s=fixture(),o=s.snapshots[0].offers[0],values={...defaults,useRoll};
  if(variant==='exotic')o.commodity=core.commodities.find(g=>g.refereeDefined).id;
  if(variant==='unknown')s.snapshots[0].world.unknown=['law'];
  if(variant==='huge'){values.quantity='900719925474099312345.125';values.price='900719925474099312345.5';}
  if(variant==='overrides-null')o.overrides=null;if(variant==='overrides-object')o.overrides={};if(variant==='audits-object')o.previousAudits={};
  assert.deepEqual(run(s,values,false),run(s,values,true),variant);
 }
});
test('headless second consumer supports transition, validated JSON reload and Undo without fresh dice',()=>{
 for(const useRoll of [false,true])for(const step of [1,100]){
  const saved=fixture(step),bytes=JSON.stringify(saved),values={...defaults,useRoll,illegal:true},prepared=prepare(saved,values);
  const next=S.transition(saved,'Market override',draft=>applyMarketOfferOverride(draft.snapshots[0].offers[0],draft.hours,prepared));
  const loaded=S.validate(JSON.parse(JSON.stringify(next))),undone=S.undo(loaded);
  assert.deepEqual(undone.snapshots,saved.snapshots);assert.equal(loaded.bank,saved.bank);assert.deepEqual(loaded.ledger,saved.ledger);assert.deepEqual(loaded.lots,saved.lots);assert.equal(JSON.stringify(saved),bytes);
  assert.equal(loaded.snapshots[0].offers[0].manualRequired,false);assert.equal(loaded.snapshots[0].offers[0].overrides[0].reason,values.reason);
  if(useRoll){assert.equal(loaded.snapshots[0].offers[0].audit.dice.total,10);assert.deepEqual(loaded.snapshots[0].offers[0].previousAudits[0],saved.snapshots[0].offers[0].audit);}
 }
});
test('manual price preserves audit reference; explicit roll preserves original audit and never invokes RNG',()=>{
 const s=fixture(),o=s.snapshots[0].offers[0],audit=o.audit,values={...defaults};
 applyMarketOfferOverride(o,s.hours,prepare(s,values));assert.equal(o.audit,audit);assert.equal(Object.hasOwn(o,'previousAudits'),false);
 const rolled=prepareMarketOfferOverride({values:{...values,useRoll:true},commodity:o.commodity,world:s.snapshots[0].world,options:s.snapshots[0].options,creditStep:1,core},{quote:(...args)=>R.quote(...args,()=>{throw Error('Unexpected random die');})});
 applyMarketOfferOverride(o,s.hours,rolled);assert.equal(o.previousAudits[0],audit);assert.equal(o.audit.quantityRolls,audit.quantityRolls);assert.equal(o.audit.randomDraws,audit.randomDraws);
});
