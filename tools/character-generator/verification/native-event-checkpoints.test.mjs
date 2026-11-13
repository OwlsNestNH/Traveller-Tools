import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativeEventRollPending} from '../engine/native-event-roll-checkpoints.mjs';
import {createSession,project} from '../engine/session.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
let source=(await readFile(url,'utf8')).replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));
source+='\nexport const audit={initial,queueEffects,apply,enterCareer,findCareer};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function state(id='core.army'){
 const s=a.initial('shared-native-roll');Object.assign(s,{correctedCareerEvents:true,deferredSpecializations:true,immediateSpecializations:true,nativeEventRollCheckpoints:true,protectedSourceAwards:true,careerEntryBasicOnly:true,active:0,stage:'career-event'});
 s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:10};s.character.skills={Recon:0};s.character.careers=[{id,assignment:id==='core.army'?'infantry':id==='core.noble'?'dilettante':'crew',rank:0,terms:0,benefitRolls:0}];
 s.nativeEventContext={careerIndex:0,careerId:id,careerTerms:0,row:8,kind:'event',source:{id:'core',page:25}};return s;
}
test('nested checks in different careers wait for a deliberate roll without consuming RNG',()=>{
 for(const id of ['core.army','core.navy','core.noble']){
  const s=state(id),before=s.rng,rolls=[];a.queueEffects(s,[{kind:'check',stat:'EDU',target:8,success:[],failure:[]}],'after-event',rolls);
  assert.equal(s.stage,'borrowed-event-roll');assert.equal(s.rng,before);assert.deepEqual(rolls,[]);
  const pending=structuredClone(s.pendingBorrowedRoll);assert.throws(()=>a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:'stale'}},[]),/current pending/);
  a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:pending.id}},rolls);assert.equal(rolls.length,1);assert.equal(rolls[0].label,'EDU check');assert.equal(s.stage,'advancement');assert.equal(s.nativeEventContext,undefined);
  assert.throws(()=>a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:pending.id}},[]),/No borrowed/);
 }
});
test('sequential nested dice each require their own action and retain preceding result',()=>{
 const s=state(),rolls=[];a.queueEffects(s,[{kind:'cash',dice:'1D',multiplier:10},{kind:'check',stat:'EDU',target:8,success:[],failure:[]}],'after-event',rolls);
 const first=s.pendingBorrowedRoll.id;a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:first}},rolls);const cash=s.character.cash;assert.equal(rolls.length,1);assert.equal(s.stage,'borrowed-event-roll');assert.notEqual(s.pendingBorrowedRoll.id,first);
 a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:s.pendingBorrowedRoll.id}},rolls);assert.equal(rolls.length,2);assert.equal(s.character.cash,cash);assert.equal(s.stage,'advancement');
});
test('missing characteristics and changed event context never authorize a guessed roll',()=>{
 const s=state(),e={kind:'check',stat:'PSI',target:8};assert.equal(nativeEventRollPending(s,e),null);s.nativeEventContext.careerTerms=1;assert.equal(nativeEventRollPending(s,{...e,stat:'EDU'}),null);
});
test('manual replacement of a required award needs an explicit referee ruling',()=>{
 const s=state();a.queueEffects(s,[{kind:'skill',name:'Gun Combat',mode:'set',value:1}],'survival',[]);a.apply(s,{type:'skill-award-source'},[]);assert.equal(s.pending.requiredAwardReview,true);
 assert.throws(()=>a.apply(s,{type:'resolve-book',payload:{confirmed:true,effects:[]}},[]),/referee reason/);
 assert.throws(()=>a.apply(s,{type:'resolve-book',payload:{confirmed:true,effects:[],note:'A deliberate referee exception.'}},[]),/Explicitly confirm/);
 a.apply(s,{type:'retry-skill-choice'},[]);assert.equal(s.stage,'skill-choice');a.apply(s,{type:'choose-skill',payload:{name:'Gun Combat (slug)'}},[]);assert.equal(s.character.skills['Gun Combat (slug)'],1);assert.equal(s.stage,'survival');
});
test('new revision gates do not reinterpret .31 saved histories',()=>{
 const current=createSession('gates'),legacy={...current,rulesRevision:'character-preview-2026-11-09.31'};
 assert.equal(project(current).state.nativeEventRollCheckpoints,true);assert.equal(project(legacy).state.nativeEventRollCheckpoints,undefined);assert.equal(project(legacy).state.educationEventCheckpoints,true);assert.equal(project(legacy).state.careerEntryBasicOnly,undefined);
});
test('requested later-Core entry uses basic training, while earned advancement remains separate',()=>{
 for(const [id,assignment] of [['core.army','infantry'],['core.navy','crew'],['core.noble','dilettante'],['core.scout','courier']]){
  const s=state(id);s.active=null;s.stage='career';delete s.nativeEventContext;s.character.careers=[{id:'core.drifter',assignment:'wanderer',terms:1,rank:0,exit:'voluntary',exitGenerationTerms:1}];s.character.terms=1;s.character.age=22;
  const rolls=[];a.enterCareer(s,a.findCareer(id),assignment,rolls);
  assert.equal(s.stage,'effect-choice');assert.doesNotMatch(s.pendingChoice.options[0].label,/Basic-training option/);
  a.apply(s,{type:'choose-effect',payload:{index:4}},rolls);
  if(s.stage==='skill-choice')a.apply(s,{type:'choose-skill',payload:{name:'Gun Combat (slug)'}},rolls);
  assert.equal(s.stage,'survival',id);assert.equal(rolls.length,0,id+' entry adds no ordinary training die');
  s.stage='advancement';s._override={index:0,values:[6,6]};a.apply(s,{type:'advancement',payload:{}},rolls);delete s._override;
  assert.equal(rolls.length,1);assert.equal(s.stage,'training',id+' successful advancement retains its extra skill roll');
 }
});
test('native injury table, severity and multi-roll selection wait for separate actions',()=>{
 for(const options of [{},{rolls:2,take:'lower'},{rolls:2,take:'higher'},{result:2}]){
  const s=state(),rolls=[],rng=s.rng;a.queueEffects(s,[{kind:'injury',table:'core.injury',...options}],'end-term',rolls);
  assert.deepEqual(rolls,[]);assert.equal(s.rng,rng);assert.equal(s.stage,'borrowed-event-roll');assert.equal(s.pendingBorrowedRoll.source.page,49);
  const count=options.result?1:(options.rolls??1)+1;
  for(let i=0;i<count;i++){
   assert.equal(s.stage,'borrowed-event-roll');const pending=s.pendingBorrowedRoll;
   assert.equal(pending.kind,i===count-1?'borrowed-injury-severity':'borrowed-injury-table');
   s._override={index:rolls.length,values:[1]};a.apply(s,{type:'roll-borrowed-event',payload:{pendingId:pending.id}},rolls);delete s._override;assert.equal(rolls.length,i+1);
  }
  assert.equal(s.stage,'injury-loss');assert.equal(s.character.injuries.length,1);
 }
});
