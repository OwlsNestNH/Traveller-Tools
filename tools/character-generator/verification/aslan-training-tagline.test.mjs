import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ASLAN_TAGLINE_SOURCE,femaleAssociatedSkill,maleAslanIdentity,aslanTrainingTagline,restoredAslanTrainingTagline} from '../gui/aslan-training-tagline.mjs';
import {outcomeTagline,outcomeTaglines} from '../gui/outcome-taglines.mjs';
import {ASLAN_CULTURAL_SKILL_SOURCE,aslanSkillLabel} from '../engine/aslan-skill-culture.mjs';
import {SKILLS} from '../engine/catalog.mjs';
import {SPECIALITIES} from '../engine/skills.mjs';
import {characterChanges} from '../engine/audit.mjs';
import {api,execute,exportSession,importSession,project} from '../engine/session.mjs';
import {aslanSetup,aslanEvent,force,run,settle} from './aslan-officer-fixtures.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';

// Reuse the real effect queue and audit producer without exporting test-only APIs
// from the engine or changing a saved session's authoritative command history.
const engineURL=new URL('../engine/session.mjs',import.meta.url);
let engineSource=await readFile(engineURL,'utf8');
engineSource=engineSource.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,engineURL).href));
engineSource+='\nexport const trainingTaglineAudit={initial,queueEffects,apply,markPsionicOrigin};';
const {trainingTaglineAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(engineSource).toString('base64'));
const outcome='aslan.training.female-associated';
const origin={careerId:'aslan.military',assignment:'warrior',table:'advanced',result:3};
const male=()=>({character:{species:'aslan',gender:'male'}});
const gain=(name='Mechanic',before=null,after=1)=>({path:'skills.'+name,before,after});
const event=(type='training',changes=[gain()],id='aslan-training-action')=>({id,type,changes});
const expected=e=>outcomeTagline(outcome,e.id);
const skill=(name,value=1,mode='increase')=>({kind:'skill',name,value,mode});
const marked=effects=>a.markPsionicOrigin(effects,origin);
function current({deferred=false}={}){
 const s=a.initial('aslan-training-tagline');
 s.deferredSpecializations=true;s.correctedCareerEvents=true;
 if(!deferred)s.immediateSpecializations=true;
 Object.assign(s.character,{species:'aslan',gender:'male',stats:{STR:12,DEX:12,END:12,INT:12,EDU:12,SOC:12}});
 s.stage='career';return s;
}
function applied(state,command,id='actual-choice'){
 const previousState=structuredClone(state),rolls=[];
 const summary=a.apply(state,command,rolls);
 const e={id,type:command.type,summary,rolls,changes:characterChanges(previousState.character,state.character)};
 return {event:e,state,context:{previousState,command},tagline:aslanTrainingTagline(e,state,{previousState,command})};
}
function skillContext(name='Mechanic'){
 return {previousState:{...male(),stage:'skill-choice',pendingChoice:{kind:'skill-choice',psionicOrigin:{...origin},allowed:[name]}},command:{type:'choose-skill',payload:{name}}};
}
function effectContext(){
 return {previousState:{...male(),stage:'effect-choice',pendingChoice:{kind:'choice',psionicOrigin:{...origin},options:marked([
  {label:'Mechanic',effects:[skill('Mechanic')]},
  {label:'Medic',effects:[skill('Medic')]}
 ])}},command:{type:'choose-effect',payload:{index:0}}};
}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}

test('presentation source and every supported skill match the p.19 cultural mapping',()=>{
 assert.deepEqual(ASLAN_TAGLINE_SOURCE,ASLAN_CULTURAL_SKILL_SOURCE);
 assert.deepEqual(ASLAN_TAGLINE_SOURCE,{id:'aliens',page:19});assert.ok(Object.isFrozen(ASLAN_TAGLINE_SOURCE));
 const names=[...SKILLS,...Object.entries(SPECIALITIES).flatMap(([base,subjects])=>(subjects??['physics','construction','test subject']).map(s=>base+' ('+s+')'))];
 for(const name of names)assert.equal(femaleAssociatedSkill(name),aslanSkillLabel(name).endsWith(' [female-associated]'),name);
 for(const name of ['Astrogation','Broker','Engineer','Mechanic','Profession','Science','Steward','Animals (veterinary)','Electronics (comms)','Electronics (computers)','Electronics (remote ops)'])assert.equal(femaleAssociatedSkill(name),true,name);
 for(const name of [undefined,null,0,{},'','Animals','Electronics','Electronics (sensors)','Animals (riding)','Animals (handling)','Animals (training)','Electronics (unknown)','Independence','Leadership','Melee (unarmed)','Science ((physics))'])assert.equal(femaleAssociatedSkill(name),false,String(name));
});

test('identity follows an explicit male identity, not a referee-selected mechanical branch',()=>{
 for(const state of [male(),{character:{species:'aslan',identityGender:'male',gender:'female'}},{character:{species:'aslan',aslanOrigin:{identityGender:'male'},gender:'female'}},{character:{species:'aslan',identityGender:'',aslanOrigin:{identityGender:'',gender:{mode:'rolled',value:'male'}},gender:'male'}}])assert.equal(maleAslanIdentity(state),true);
 for(const state of [undefined,{}, {character:{}}, {character:{species:'human',gender:'male'}},{character:{species:'vargr',gender:'male'}},{character:{species:'aslan',gender:'female'}},{character:{species:'aslan',gender:''}},{character:{species:'aslan',gender:'other'}},{character:{species:'aslan',identityGender:'other',gender:'male'}},{character:{species:'aslan',aslanOrigin:{identityGender:'other'},gender:'male'}},{character:{species:'aslan',identityGender:'female',aslanOrigin:{identityGender:'male'},gender:'male'}}]){
  assert.equal(maleAslanIdentity(state),false,JSON.stringify(state));assert.equal(aslanTrainingTagline(event(),state),null);
 }
});

test('real rolled male and explicit other identity keep their distinct presentation eligibility',()=>{
 let unspecified=buildAslanOriginFixture({gender:'',seed:'tagline-rolled-male'});
 unspecified=force(unspecified,'roll-aslan-gender',{},[1,1]);
 assert.equal(unspecified.state.character.gender,'male');assert.equal(unspecified.state.character.aslanOrigin.identityGender,'');
 assert.equal(maleAslanIdentity(unspecified.state),true);
 let other=buildAslanOriginFixture({gender:'other',stage:'book-step',seed:'tagline-explicit-other'});
 other=run(other,'resolve-aslan-origin-source',{gender:'male',reason:'Use the male mechanical branch while retaining the explicitly selected identity.'});
 assert.equal(other.state.character.gender,'male');assert.equal(other.state.character.identityGender,'other');
 assert.equal(maleAslanIdentity(other.state),false);assert.equal(aslanTrainingTagline(event(),other.state),null);
});

test('actual positive audit gains include new level zero and increases from an existing level',()=>{
 for(const [before,after] of [[null,0],[null,1],[null,4],[0,1],[1,2],[3,4]]){
  const e=event('training',[gain('Mechanic',before,after)]);assert.equal(aslanTrainingTagline(e,male()),expected(e),JSON.stringify({before,after}));
 }
 const e=event('training',[gain('Medic'),gain('Broker',0,1),{path:'stats.EDU',before:7,after:8}]);
 assert.equal(aslanTrainingTagline(e,male()),expected(e));
});

test('no-op, capped, lost, malformed and merely promised skills cannot earn a tagline',()=>{
 for(const change of [gain('Mechanic',0,0),gain('Mechanic',4,4),gain('Mechanic',3,2),gain('Mechanic',1,null),gain('Mechanic',null,-1),gain('Mechanic',null,1.5),gain('Mechanic',null,'1'),gain('Mechanic','0',1),{path:'skills.Mechanic',before:undefined,after:1},gain('Mechanic',NaN,1),gain('Mechanic',null,Infinity),{path:'stats.Mechanic',before:0,after:1},{path:'benefits.0',before:null,after:{name:'Mechanic'}},{path:'deferredSkillAwards.0.name',before:null,after:'Engineer'},{}])assert.equal(aslanTrainingTagline(event('training',[change]),male()),null,JSON.stringify(change));
 for(const e of [undefined,{},event('training',[]),{id:'missing-changes',type:'training'},event('training',[gain()],''),{type:'training',changes:[gain()]}])assert.equal(aslanTrainingTagline(e,male()),null);
});

test('unqualified Animals and Electronics are not enough; their actual named specialties decide',()=>{
 for(const name of ['Animals','Electronics','Animals (handling)','Electronics (sensors)'])assert.equal(aslanTrainingTagline(event('training',[gain(name,null,0)]),male()),null,name);
 for(const name of ['Animals (veterinary)','Electronics (comms)','Electronics (computers)','Electronics (remote ops)']){
  const e=event('choose-skill',[gain(name)]);assert.equal(aslanTrainingTagline(e,male(),skillContext(name)),expected(e),name);
 }
});

test('every unrelated event type stays factual even with an identical skill delta and training-looking provenance',()=>{
 for(const type of ['background','career','survival','survival-check','career-event','career-mishap','advancement','benefit','connection','education-skill','companion-skill','allocate-specializations','finish','gm-override','gm-replay','restore','resolve-book','retry-skill-choice','source-training-roll','import','physical-dice','choose-effect-extra',undefined]){
  const context=skillContext();context.command.type=type;
  assert.equal(aslanTrainingTagline({...event(),type},male(),context),null,String(type));
 }
});

test('choose-skill requires the pre-command stage, pending choice, training marker and matching command',()=>{
 const e=event('choose-skill'),good=skillContext();assert.equal(aslanTrainingTagline(e,male(),good),expected(e));
 assert.equal(aslanTrainingTagline(e,male()),null);
 const mutations=[
  c=>delete c.previousState,c=>delete c.command,c=>c.command.type='choose-effect',c=>delete c.command.payload,c=>c.command.payload.name='Medic',
  c=>c.previousState.stage='training',c=>c.previousState.stage='effect-choice',c=>delete c.previousState.pendingChoice,
  c=>c.previousState.pendingChoice.kind='skill-reduction-choice',c=>delete c.previousState.pendingChoice.psionicOrigin,
  c=>c.previousState.pendingChoice.psionicOrigin={source:{id:'aliens',page:19}},
 ];
 for(const mutate of mutations){const context=structuredClone(good);mutate(context);assert.equal(aslanTrainingTagline(e,male(),context),null,String(mutate));}
 const after={...male(),stage:'skill-choice',pendingChoice:good.previousState.pendingChoice};
 assert.equal(aslanTrainingTagline(e,after,{command:good.command}),null,'post-state provenance must not substitute for the pre-state');
});

test('training provenance rejects partial or non-native origin shapes',()=>{
 for(const [key,values] of Object.entries({careerId:[undefined,'',4],assignment:[undefined,4],table:[undefined,'',4],result:[undefined,0,10,-1,1.5,'3']}))for(const value of values){
  const context=skillContext();context.previousState.pendingChoice.psionicOrigin[key]=value;
  assert.equal(aslanTrainingTagline(event('choose-skill'),male(),context),null,key+': '+String(value));
 }
});

test('choose-effect only credits a selected marked skill effect, never unchosen or resumed awards',()=>{
 const e=event('choose-effect'),good=effectContext();assert.equal(aslanTrainingTagline(e,male(),good),expected(e));
 const mutations=[
  c=>c.command.type='choose-skill',c=>c.previousState.stage='skill-choice',c=>delete c.previousState.pendingChoice.psionicOrigin,
  c=>delete c.command.payload,c=>c.command.payload.index=1,c=>c.command.payload.index=2,c=>c.command.payload.index=-1,c=>c.command.payload.index=0.5,c=>c.command.payload.index='0',
  c=>delete c.previousState.pendingChoice.options,c=>delete c.previousState.pendingChoice.options[0].effects,
  c=>delete c.previousState.pendingChoice.options[0].effects[0].psionicOrigin,
  c=>c.previousState.pendingChoice.options[0].effects[0].name='Medic',
  c=>c.previousState.pendingChoice.options[0].effects[0].kind='skill-choice',
 ];
 for(const mutate of mutations){const context=structuredClone(good);mutate(context);assert.equal(aslanTrainingTagline(e,male(),context),null,String(mutate));}
 assert.equal(aslanTrainingTagline(event('choose-effect',[gain('Broker')]),male(),good),null,'unrelated gain after a no-op selected Mechanic award');
});

test('a skill choice must match the exact audited specialty rather than merely its family',()=>{
 for(const [chosen,awarded] of [['Electronics (sensors)','Electronics (computers)'],['Engineer (power)','Engineer (m-drive)'],['Science (physics)','Science (biology)'],['Medic','Mechanic'],['Animals','Animals (veterinary)']])assert.equal(aslanTrainingTagline(event('choose-skill',[gain(awarded)]),male(),skillContext(chosen)),null,chosen+' / '+awarded);
 const e=event('choose-skill',[gain('Science (physics)')]);assert.equal(aslanTrainingTagline(e,male(),skillContext('  Science (Physics)  ')),expected(e),'open subjects canonicalize case and outer whitespace');
});

test('real engine audit shows named skill awards, level zero, capped and no-op results accurately',()=>{
 for(const [before,value,mode,want] of [[undefined,0,'set',true],[undefined,1,'increase',true],[0,1,'increase',true],[1,1,'set',false],[4,1,'increase',false]]){
  const state=current();if(before!==undefined)state.character.skills.Mechanic=before;
  const prior=structuredClone(state.character);a.queueEffects(state,marked([skill('Mechanic',value,mode)]),'career',[]);
  const e=event('training',characterChanges(prior,state.character));
  assert.equal(aslanTrainingTagline(e,state),want?expected(e):null,JSON.stringify({before,value,mode}));
 }
});

test('real immediate training waits for the chosen specialization and excludes sensors',()=>{
 for(const name of ['Electronics (comms)','Electronics (computers)','Electronics (remote ops)','Electronics (sensors)']){
  const state=current(),before=structuredClone(state.character);a.queueEffects(state,marked([skill('Electronics')]),'career',[]);
  assert.equal(state.stage,'skill-choice');assert.equal(aslanTrainingTagline(event('training',characterChanges(before,state.character)),state),null);
  const result=applied(state,{type:'choose-skill',payload:{name}});
  assert.equal(result.tagline,name==='Electronics (sensors)'?null:expected(result.event));
 }
});

test('a valid canonical Engineer alias retains the selected training award',()=>{
 const state=current();a.queueEffects(state,marked([skill('Engineer')]),'career',[]);
 const result=applied(state,{type:'choose-skill',payload:{name:'Engineer (power plant)'}});
 assert.deepEqual(result.event.changes,[gain('Engineer (power)')]);
 assert.equal(result.tagline,expected(result.event));
});

test('real choice continuation cannot borrow an unrelated female-associated delta',()=>{
 for(const selected of ['Medic','Mechanic']){
  const state=current();if(selected==='Mechanic')state.character.skills.Mechanic=1;
  a.queueEffects(state,[...marked([{kind:'choice',options:[{label:selected,effects:[skill(selected,1,'set')]}]}]),skill('Broker')],'career',[]);
  const result=applied(state,{type:'choose-effect',payload:{index:0}});
  assert.ok(result.event.changes.some(c=>c.path==='skills.Broker'));
  assert.equal(result.tagline,null,'the selected '+selected+' did not gain a qualifying skill');
 }
 const state=current();a.queueEffects(state,marked([{kind:'choice',options:[{label:'Mechanic',effects:[skill('Mechanic')]},{label:'Medic',effects:[skill('Medic')]}]}]),'career',[]);
 const result=applied(state,{type:'choose-effect',payload:{index:0}});assert.equal(result.tagline,expected(result.event));
});

test('canonical choose-skill summaries still reject unrelated gains resumed after a common specialty',()=>{
 const state=current();a.queueEffects(state,[...marked([skill('Electronics')]),skill('Broker')],'career',[]);
 const result=applied(state,{type:'choose-skill',payload:{name:'Electronics (sensors)'}});
 assert.equal(result.event.summary,'Selected Electronics (sensors) for a skill award.');
 assert.ok(result.event.changes.some(c=>c.path==='skills.Electronics (sensors)'));
 assert.ok(result.event.changes.some(c=>c.path==='skills.Broker'));
 assert.equal(result.tagline,null);
});

test('historical .18 deferred awards retain their original training provenance at allocation',()=>{
 const state=current({deferred:true});a.queueEffects(state,marked([skill('Engineer')]),'career',[]);
 assert.equal(state.stage,'career');assert.deepEqual(state.character.deferredSkillAwards[0].psionicOrigin,origin);
 assert.equal(aslanTrainingTagline(event('training',[]),state),null);
 a.apply(state,{type:'allocate-specializations'},[]);
 assert.equal(state.stage,'skill-choice');assert.equal(state.pendingChoice.allocationId,'specialization-1');assert.deepEqual(state.pendingChoice.psionicOrigin,origin);
 const result=applied(state,{type:'choose-skill',payload:{name:'Engineer (power)'}});
 assert.equal(state.character.deferredSkillAwards[0].status,'allocated');assert.equal(result.tagline,expected(result.event));
});

test('an unmarked historical award cannot inherit the later training origin that resumes behind it',()=>{
 const state=current({deferred:true});a.queueEffects(state,[skill('Engineer')],'career',[]);
 a.queueEffects(state,marked([skill('Engineer (power)')]),'career',[]);
 assert.equal(state.stage,'skill-choice');assert.equal(state.pendingChoice.psionicOrigin,undefined);
 const result=applied(state,{type:'choose-skill',payload:{name:'Engineer (m-drive)'}});
 assert.ok(result.event.changes.some(c=>c.path==='skills.Engineer (power)'));
 assert.ok(result.event.changes.some(c=>c.path==='skills.Engineer (m-drive)'));
 assert.equal(result.tagline,null);
});

const fixtureCache=new Map();
function realTrainingChoice(rulesRevision){
 const key=rulesRevision??'current';if(fixtureCache.has(key))return structuredClone(fixtureCache.get(key));
 let r=settle(force(aslanSetup('aslan-tagline-5','male',false,{},rulesRevision),'career',{id:'aslan.military',assignment:'warrior'},[6,6]));
 if(r.state.stage!=='training')r=settle(force(settle(aslanEvent(r,8)),'advancement',{},[6,6]));
 assert.equal(r.state.stage,'training');r=run(r,'training',{table:'advanced'});
 assert.equal(r.log.at(-1).rolls[0].total,3,'fixed fixture should roll Electronics');
 if(rulesRevision?.endsWith('.18')){
  r=run(r,'allocate-specializations');
  for(let i=0;i<10&&r.state.pendingChoice?.allowed?.[0]!=='Electronics';i++){
   const base=r.state.pendingChoice?.allowed?.[0],name=r.state.skillChoiceSuggestions.find(n=>n.startsWith(base+' ('));
   assert.ok(name,'no eligible specialization for earlier award '+base);r=run(r,'choose-skill',{name});
  }
 }
 assert.equal(r.state.stage,'skill-choice');assert.equal(r.state.pendingChoice.allowed[0],'Electronics');
 fixtureCache.set(key,structuredClone(r));return r;
}

for(const revision of [undefined,'character-preview-2026-11-09.18'])test('real session training choice recovers after save/import without mutating bytes or RNG: '+(revision??'current'),async()=>{
 const before=realTrainingChoice(revision),command={type:'choose-skill',payload:{name:'Electronics (computers)'}};
 const result=run(before,command.type,command.payload),e=result.log.at(-1),context={previousState:before.state,command};
 const raw=exportSession(result.session),snapshot=JSON.stringify(result),rng=result.state.rng,want=expected(e);
 assert.equal(aslanTrainingTagline(e,result.state,context),want);
 for(let i=0;i<20;i++)assert.equal(aslanTrainingTagline(e,result.state,context),want);
 for(const session of [structuredClone(result.session),importSession(raw)]){
  const projection=project(session),calls=[];
  assert.equal(await restoredAslanTrainingTagline(session,projection,async request=>{calls.push(request);return api(request);}),want);
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'project');
  assert.deepEqual(calls[0].session.events,session.events.slice(0,-1));assert.equal(calls[0].session.rulesRevision,session.rulesRevision);
  assert.equal(exportSession(session),raw);assert.deepEqual(project(session),projection);
 }
 assert.equal(exportSession(result.session),raw);assert.equal(JSON.stringify(result),snapshot);assert.equal(result.state.rng,rng);
 assert.deepEqual(execute(result.session,{type:'continue-career'}),execute(importSession(raw),{type:'continue-career'}));
});

test('restoration of a direct training gain is local and performs no project request',async()=>{
 const e=event(),projection={state:male(),log:[e]},session={events:[{id:e.id,command:{type:e.type}}]};
 assert.equal(await restoredAslanTrainingTagline(session,projection,()=>assert.fail('direct training needs no API call')),expected(e));
});

test('restoration makes exactly one read-only projection of the preceding session',async()=>{
 const context=skillContext(),e=event('choose-skill'),session={version:1,seed:'read-only',rulesRevision:'historical',events:[{id:'earlier',command:{type:'training'}},{id:e.id,command:context.command}]},projection={state:male(),log:[e]};
 const original=JSON.stringify({session,projection,context});freeze(session);freeze(projection);freeze(context);
 const calls=[];
 assert.equal(await restoredAslanTrainingTagline(session,projection,async request=>{calls.push(request);return {ok:true,state:context.previousState};}),expected(e));
 assert.deepEqual(calls,[{operation:'project',session:{...session,events:session.events.slice(0,-1)}}]);
 assert.notEqual(calls[0].session,session);assert.notEqual(calls[0].session.events,session.events);
 assert.equal(JSON.stringify({session,projection,context}),original);
});

test('restoration uses the saved selected effect, not any currently offered female-associated option',async()=>{
 const e=event('choose-effect'),context=effectContext(),projection={state:male(),log:[e]};
 for(const [index,want] of [[0,expected(e)],[1,null]]){
  const session={events:[{id:e.id,command:{type:'choose-effect',payload:{index}}}]};
  assert.equal(await restoredAslanTrainingTagline(session,projection,async()=>({ok:true,state:context.previousState})),want);
 }
});

test('restoration fails closed for missing provenance, API failure and rejected requests',async()=>{
 const e=event('choose-skill'),session={events:[{id:e.id,command:skillContext().command}]},projection={state:male(),log:[e]};
 for(const response of [{ok:false,error:{message:'Cannot project'}},{ok:true,state:male()},{ok:true,state:{...male(),stage:'career'}},undefined,null]){
  let calls=0;assert.equal(await restoredAslanTrainingTagline(session,projection,async()=>{calls++;return response;}),null);assert.equal(calls,1);
 }
 assert.equal(await restoredAslanTrainingTagline(session,projection,async()=>{throw new Error('offline');}),null);
 assert.equal(await restoredAslanTrainingTagline(session,projection,()=>Promise.reject(new Error('interrupted'))),null);
});

test('restoration ignores unrelated, empty, nonmale and mismatched final records without network calls',async()=>{
 const context=skillContext(),e=event('choose-skill'),session={events:[{id:e.id,command:context.command}]},projection={state:male(),log:[e]};
 const cases=[
  [session,undefined],[session,{state:male(),log:[]}],[session,{state:{character:{species:'aslan',gender:'female'}},log:[e]}],
  [session,{state:male(),log:[event('choose-skill',[])]}],[session,{state:male(),log:[event('gm-replay')]}],
  [{events:[]},projection],[{events:[{id:'different',command:context.command}]},projection],
 ];
 for(const [s,p] of cases)assert.equal(await restoredAslanTrainingTagline(s,p,()=>assert.fail('ineligible restoration must stay local')),null);
});

test('selection is deterministic, non-mutating and independent of rules RNG or saved presentation fields',()=>{
 const context=freeze(skillContext()),e=freeze(event('choose-skill')),state=freeze({...male(),rng:1234});
 const before=JSON.stringify({context,e,state}),want=expected(e),random=Math.random;
 try{Math.random=()=>assert.fail('presentation must not consume random values');for(let i=0;i<30;i++)assert.equal(aslanTrainingTagline(e,state,context),want);}finally{Math.random=random;}
 assert.equal(JSON.stringify({context,e,state}),before);
 const lines=outcomeTaglines[outcome];assert.equal(lines.length,6);assert.equal(new Set(lines).size,6);
 assert.deepEqual(new Set(Array.from({length:150},(_,i)=>aslanTrainingTagline(event('training',[gain()],'training-'+i),male()))),new Set(lines));
});

test('the browser helper imports no engine, random generator or persistent storage',async()=>{
 const source=await readFile(new URL('../gui/aslan-training-tagline.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/from\s+['"][^'"]*engine|Math\.random|crypto\.randomUUID|state\.rng|localStorage|sessionStorage|operation:\s*['"]command['"]/);
});
