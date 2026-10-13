import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as R from '../js/rules.mjs';
import {contactSearchPeriod,contactSearchStatus,prepareContactSearchOutcome,commitContactSearch} from '../js/contact-search.mjs';
import {prepareContactSearchResult,marketAvailabilityRecord,tradeCodeLabel} from '../js/contact-search-result.mjs';
import {campaign,core,origin,S} from './app-harness.mjs';
const source=await readFile(new URL('fixtures/contact-search-result-before-pilot.mjs',import.meta.url),'utf8');
const before=vm.runInNewContext(source+'\nbeforeContactSearchResult',{contactSearchPeriod});
function fixture({kind='supplier',success=true,method='normal',local=false,step=1,history='empty',seed=1,raw=false}={}){
 const state=campaign();state.settings.creditStep=step;state.hours=history==='reset'?672:history==='backward'?5:20;
 if(history!=='empty')state.snapshots=[{id:'prior-search',worldId:origin.id,startedHours:10}];
 const c=R.context({...origin,uwp:seed===1?'A788399-C':seed===2?'A788899-C':'A788999-C',zone:raw?'Amber':'Safe'},core),previous=contactSearchStatus(state).previous;
 const options={creditStep:step,illegal:method==='blackMarket',skill:2,local,counterparty:2,...R.priceLimits(state.settings),maxBaseRetailEnabled:raw,maxBaseRetail:'100000',useRawIllegalPrices:raw,illegalGood:false};
 const input={kind,party:origin.id+'|synthetic contact',partyName:'Synthetic contact',worldId:origin.id,world:c,startedHours:state.hours,dateLabel:state.dateLabel,snapshots:state.snapshots,options,core,success,search:{method,generatedDice:{dice:[6,6],total:12},localSkillDice:{dice:seed===1?[1,1]:[3,4],total:seed===1?2:7},useLocal:local,effectiveTotal:12,skill:2,characteristic:1,port:6,previous,total:21-previous,successOverride:false,durationDie:2,hours:method==='online'?2:48}};
 return {state,input,seed};
}
function oldInput({state,input}){const q=input.search;return {state,c:input.world,options:input.options,core:input.core,kind:input.kind,key:input.party,partyName:input.partyName,method:q.method,dice:q.generatedDice,brokerDice:q.localSkillDice,useLocal:q.useLocal,rolled:q.effectiveTotal,skill:q.skill,characteristic:q.characteristic,port:q.port,previous:q.previous,total:q.total,duration:q.durationDie,hours:q.hours,success:input.success,successOverride:q.successOverride};}
function bindings(seed,variant){let next=seed,ids=0;const trace=[],generated=[];const rng=()=>{next=(next*48271)%2147483647;const die=next%6+1;trace.push('die:'+die);return die;};const rules={VERSION:R.VERSION,market:(...args)=>{trace.push('market');if(variant==='market-error')throw Error('Synthetic market failure');const offers=variant==='invalid-availability'?[]:variant==='commodity-error'?[{commodity:'missing',quantity:'1',unitPrice:'1',audit:{}}]:R.market(...args,rng);generated.push(...offers);return offers;}};const uid=()=>{trace.push('uid:'+ ++ids);if(variant==='id-error')throw Error('Synthetic ID failure');return 'synthetic-id-'+ids;};return {trace,generated,rules,uid};}
function attempt(f,old,variant){const b=bindings(f.seed,variant);try{const result=old?before(oldInput(f),b.rules,{uid:b.uid}):prepareContactSearchResult(f.input,b);return {bytes:JSON.stringify(result),error:null,trace:b.trace};}catch(e){return {bytes:null,error:e.message,trace:b.trace};}}
test('1,152 exact snapshots and draw/UUID traces match the deployed assembly without input mutation',()=>{
 let count=0;
 for(const kind of ['supplier','buyer'])for(const success of [false,true])for(const method of ['normal','online','blackMarket'])for(const local of [false,true])for(const step of [1,100])for(const history of ['empty','active','reset','backward'])for(const seed of [1,2,3])for(const raw of [false,true]){
  const f=fixture({kind,success,method,local,step,history,seed,raw}),bytes=JSON.stringify(f);
  const actual=attempt(f,false);assert.deepEqual(actual,attempt(f,true),JSON.stringify({kind,success,method,local,step,history,seed,raw}));assert.equal(actual.error,null);assert.equal(JSON.stringify(f),bytes);
  if(!success||kind==='buyer')assert.deepEqual(actual.trace,['uid:1'],'No market dice or offer IDs for buyer/failed search');count++;
 }
 assert.equal(count,1152);
});
test('generation, ID, period and late availability errors retain exact draw order and messages',()=>{
 for(const variant of ['market-error','commodity-error','id-error','invalid-clock','overflow','missing-history','invalid-availability']){
  const f=fixture();if(variant==='invalid-clock'){f.state.hours=-1;f.input.startedHours=-1;}if(variant==='overflow'){f.state.hours=Number.MAX_SAFE_INTEGER;f.input.startedHours=f.state.hours;}if(variant==='missing-history'){delete f.state.snapshots;f.input.snapshots=undefined;}
  if(variant==='invalid-availability'){f.input.world.uwp.population=0;f.input.core={...core,commodities:[{id:'11',common:false,availabilityAny:null}]};}
  assert.deepEqual(attempt(f,false,variant),attempt(f,true,variant),variant);
 }
});
test('headless consumer assembles, commits, reloads and undoes successful/failed supplier and buyer results',()=>{
 for(const kind of ['supplier','buyer'])for(const success of [false,true]){
  const saved=campaign(),world=R.context({...origin,uwp:success?origin.uwp:'X788899-C'},core),previous=contactSearchStatus(saved).previous;
  const outcome=prepareContactSearchOutcome({skill:0,rolled:success?12:2,duration:2,characteristic:0,counterparty:2,starport:world.uwp.starport,starportDM:core.search.starportDM,previous,durationUnit:'days',successOverride:false});
  const input={kind,party:origin.id+'|synthetic contact',partyName:'Synthetic contact',worldId:origin.id,world,startedHours:saved.hours,dateLabel:saved.dateLabel,snapshots:saved.snapshots,options:{creditStep:1,illegal:false,skill:0,local:false,counterparty:2},core,success:outcome.success,search:{method:'normal',generatedDice:{dice:success?[6,6]:[1,1],total:success?12:2},effectiveTotal:success?12:2,skill:0,characteristic:0,...outcome,previous,successOverride:false,durationDie:2,useLocal:false,localSkillDice:{dice:[2,3],total:5}}};
  const beforeBytes=JSON.stringify(saved),b=bindings(7),snapshot=prepareContactSearchResult(input,b),next=S.transition(saved,'Contact search',draft=>commitContactSearch(draft,snapshot));
  const loaded=S.validate(JSON.parse(JSON.stringify(next))),undone=S.undo(loaded);assert.equal(loaded.hours,48);assert.equal(loaded.snapshots.length,1);assert.equal(loaded.events[0].label,'Contact search audit');
  for(const key of ['hours','snapshots','bank','ledger','lots','route'])assert.deepEqual(undone[key],saved[key],key);assert.equal(JSON.stringify(saved),beforeBytes);
  assert.throws(()=>commitContactSearch(structuredClone(loaded),snapshot),/stale/);assert.equal(snapshot.offers.length>0,success&&kind==='supplier');
 }
});
test('original dice/context/options and generated offer audit references remain shared without cloning',()=>{
 const f=fixture({method:'blackMarket',local:true}),b=bindings(1),result=prepareContactSearchResult(f.input,b);
 assert.equal(result.world,f.input.world);assert.equal(result.options,f.input.options);assert.equal(result.search.generatedDice,f.input.search.generatedDice);assert.equal(result.search.localSkillDice,f.input.search.localSkillDice);assert.equal(result.search.fixerWarning,true);
 result.offers.forEach((o,i)=>{assert.equal(o.audit,b.generated[i].audit);assert.deepEqual(o.original,{quantity:b.generated[i].quantity,unitPrice:b.generated[i].unitPrice});});
 assert.equal(result.availability.draws,result.offers.find(o=>Array.isArray(o.audit?.randomDraws))?.audit.randomDraws);
 const empty=marketAvailabilityRecord(f.input.world,f.input.options,[],core);assert.equal(empty.draws,null);assert.notEqual(empty.codes,f.input.world.codes);assert.equal(tradeCodeLabel('Unknown'),'Unknown (Unknown)');
});
