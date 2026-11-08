import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 COMPANION_EDUCATION_VERSION,COMPANION_EDUCATION_IDS,COMPANION_TERM_RULES,
 companionEntryCheck as entry,companionInitialAwards as initial,companionEvent as event,
 companionGraduationCheck as graduate,companionTermOutcome as term,
 companionCareerBenefits as rights,companionResolveSkillChoice as select
} from '../engine/companion-education.mjs';
import {PRECAREER_RULES} from '../engine/expansion-pack.mjs';
import {PRECAREER_EVENTS} from '../engine/education-pack.mjs';
import {CORE_PACK} from '../engine/core-pack.mjs';
const stats={STR:7,DEX:7,END:7,INT:7,EDU:7,SOC:7,PSI:7};
const id=name=>'companion.'+name;
const graduated=(name,honours=false)=>({id:id(name),resolved:true,attempted:true,graduated:true,honours});
const failed=name=>({...graduated(name),graduated:false});
const choice=(result,selectionId)=>result.effects.find(e=>e.selectionId===selectionId);
const effectsBy=(r,kind)=>r.effects.filter(e=>e.kind===kind);

test('five known options reuse existing source data and inherited term/event rules',()=>{
 assert.equal(COMPANION_EDUCATION_VERSION,1);
 assert.deepEqual(COMPANION_EDUCATION_IDS,Object.keys(PRECAREER_RULES));
 assert.deepEqual([COMPANION_TERM_RULES.firstTerm,COMPANION_TERM_RULES.lastTerm,COMPANION_TERM_RULES.years],[1,3,4]);
 assert.equal(COMPANION_TERM_RULES.eventCount,1);
 assert.equal(COMPANION_TERM_RULES.musteringOut,false);
 assert.equal(COMPANION_TERM_RULES.failedEntryConsumesTerm,false);
 assert.equal(COMPANION_TERM_RULES.keepInitialAwardsOnFailedGraduation,true);
});
test('automatic admissions use exact boundary and unspecified outside cases require adjudication',()=>{
 for(const tl of [0,8])assert.equal(entry({id:id('colonial'),term:1,homeworld:{techLevel:tl}}).automatic,true);
 assert.equal(entry({id:id('colonial'),term:1,homeworld:{techLevel:9}}).needsAdjudication,true);
 for(const soc of [0,6])assert.equal(entry({id:id('hard-knocks'),term:1,stats:{SOC:soc}}).automatic,true);
 assert.equal(entry({id:id('hard-knocks'),term:1,stats:{SOC:7}}).needsAdjudication,true);
 assert.equal(entry({id:id('spacer'),term:1,homeworld:{size:0}}).automatic,true);
});
test('rolled entry applies characteristic and source threshold DMs without invented later-term penalties',()=>{
 const psion=entry({id:id('psionic'),term:3,stats:{PSI:8,INT:8},roll:7});
 assert.equal(psion.total,8);assert.equal(psion.success,true);
 const merchant=entry({id:id('merchant'),term:2,stats:{INT:9,SOC:8},roll:7});
 assert.equal(merchant.total,9);assert.equal(merchant.success,true);
 const spacer=entry({id:id('spacer'),term:1,stats:{INT:6,DEX:8},homeworld:{size:1},roll:3});
 assert.equal(spacer.total,4);assert.equal(spacer.success,true);
});
test('Aezorgh pre-career entry and graduation DMs are exactly minus two',()=>{
 const base={id:id('merchant'),term:1,stats:{INT:9,SOC:8},roll:7};
 assert.equal(entry({...base,species:'aezorgh'}).total,entry(base).total-2);
 const g={id:id('spacer'),stats:{INT:9,DEX:8},roll:7};
 assert.equal(graduate({...g,species:'aezorgh'}).total,graduate(g).total-2);
 assert.equal(entry({id:id('hard-knocks'),term:1,stats:{SOC:6},species:'aezorgh'}).automatic,true);
});
test('missing stats, homeworld, dice and setup are reported instead of manufactured',()=>{
 assert.deepEqual(entry({id:id('colonial'),term:1}).missingInputs,['homeworld.techLevel']);
 assert.ok(entry({id:id('merchant'),term:1,stats:{INT:8}}).missingInputs.includes('stats.SOC'));
 assert.ok(entry({id:id('merchant'),term:1,stats}).missingInputs.includes('roll'));
 assert.ok(initial({id:id('merchant')}).missingInputs.includes('serviceRoll'));
 assert.ok(initial({id:id('psionic')}).missingInputs.includes('acquiredTalents'));
 assert.equal(initial({id:id('psionic'),acquiredTalents:['Telepathy'],psionicTrainingComplete:false}).needsAdjudication,true);
});
test('entry attempts and term window are explicit and failure does not consume a term',()=>{
 assert.equal(entry({id:id('merchant'),term:4,stats,roll:12}).eligible,false);
 assert.equal(entry({id:id('merchant'),term:1,stats,roll:12,attemptedThisTerm:true}).eligible,false);
 const f=entry({id:id('merchant'),term:1,stats,roll:2});
 assert.equal(f.success,false);assert.equal(f.consumesTerm,false);assert.equal(f.next,'career-qualification');
 assert.throws(()=>entry({id:id('merchant'),term:1,stats,roll:13}),/integer/);
});
test('colonial initial awards include ten level-zero skills and Survival1',()=>{
 const r=initial({id:id('colonial')});
 assert.equal(r.effects.length,11);
 assert.equal(r.effects.filter(e=>e.value===0).length,10);
 assert.deepEqual(r.effects.find(e=>e.name==='Survival'),{kind:'skill',name:'Survival',mode:'set',value:1});
});
test('psionic initial awards use only tested acquired talents at zero',()=>{
 const r=initial({id:id('psionic'),psionicTrainingComplete:true,acquiredTalents:['Telepathy','Awareness']});
 assert.deepEqual(r.effects.filter(e=>e.kind==='psionic-talent').map(e=>[e.name,e.mode,e.value]),[['Telepathy','set',0],['Awareness','set',0]]);
 assert.equal(r.effects.filter(e=>e.kind==='skill').length,3);
 assert.throws(()=>initial({id:id('psionic'),psionicTrainingComplete:true,acquiredTalents:['Unknown talent']}),/supported/);
});
test('both Merchant curricula use all six correct assignment skills and one random service skill at1',()=>{
 for(const [curriculum,assignment] of [['business','broker'],['shipboard','marine']]){
  for(let serviceRoll=1;serviceRoll<=6;serviceRoll++){
   const r=initial({id:id('merchant'),curriculum,serviceRoll});
   assert.deepEqual(r.effects.slice(0,6).map(e=>e.name),CORE_PACK['core.merchant'].training.assignments[assignment].flat().map(e=>e.name));
   assert.ok(r.effects.slice(0,6).every(e=>e.mode==='set'&&e.value===0));
   assert.equal(r.effects[6].name,CORE_PACK['core.merchant'].training.service[serviceRoll-1][0].name);
   assert.equal(r.effects[6].value,1);assert.equal(r.effects[6].mode,'set');
  }
 }
});
test('Hard Knocks and Spacer initial choices have exact lists and counts',()=>{
 const h=initial({id:id('hard-knocks')}),s=initial({id:id('spacer')});
 assert.equal(h.effects[0].name,'Streetwise');assert.equal(h.effects[0].value,1);
 assert.equal(choice(h,'hard-knocks-initial').count,2);
 assert.equal(choice(h,'hard-knocks-initial').options.length,7);
 assert.equal(s.effects[0].name,'Vacc Suit');assert.equal(s.effects[0].value,1);
 assert.equal(choice(s,'spacer-initial').count,2);
 assert.deepEqual(choice(s,'spacer-initial').options.map(o=>o.name),['Astrogation','Electronics','Engineer','Profession']);
});
test('all eleven shared event outcomes are clones with a Core route, never a career event',()=>{
 for(const eid of COMPANION_EDUCATION_IDS)for(let roll=2;roll<=12;roll++){
  const r=event({id:eid,entered:true,roll});
  assert.deepEqual(r.effects,PRECAREER_EVENTS[roll]);
  assert.notEqual(r.effects,PRECAREER_EVENTS[roll]);
  assert.equal(r.route.table,'core.pre-career-events');assert.equal(r.next,'graduation');
 }
 assert.equal(event({id:id('merchant'),entered:false}).eventRequired,false);
 assert.deepEqual(event({id:id('merchant'),entered:true}).missingInputs,['roll']);
});
test('failed or event-blocked graduation emits no graduation awards and needs no supplementary rolls',()=>{
 for(const eid of COMPANION_EDUCATION_IDS){
  const r=graduate({id:eid,graduationAllowed:false});
  assert.equal(r.attempted,false);assert.equal(r.graduated,false);assert.deepEqual(r.effects,[]);
 }
 const r=graduate({id:id('colonial'),stats,roll:2});
 assert.equal(r.graduated,false);assert.deepEqual(r.missingInputs,[]);assert.deepEqual(r.effects,[]);
});
test('graduation targets, threshold modifiers and honours boundaries match all five sources',()=>{
 const rows=[
  ['colonial',{INT:8,END:8},7,11,{eduLoss:1}],
  ['psionic',{PSI:8,INT:8},5,11,{acquiredTalents:['Telepathy']}],
  ['merchant',{INT:8,EDU:8,SOC:8},5,9,{curriculum:'business'}],
  ['hard-knocks',{INT:8,END:9},6,10,{}],
  ['spacer',{INT:8,DEX:6},7,11,{}]
 ];
 for(const [name,characteristics,pass,honours,extra] of rows){
  const ordinary=graduate({id:id(name),stats:characteristics,roll:pass,...extra});
  assert.equal(ordinary.graduated,true,name);assert.equal(ordinary.honours,false,name);
  assert.equal(graduate({id:id(name),stats:characteristics,roll:pass-1,...extra}).graduated,false,name);
  assert.equal(graduate({id:id(name),stats:characteristics,roll:honours,...extra}).honours,true,name);
 }
});
test('colonial graduation requires real D3 input and retains the alternate award structure',()=>{
 const missing=graduate({id:id('colonial'),stats:{INT:8,END:8},roll:11});
 assert.equal(missing.graduated,true);assert.equal(missing.resolved,false);assert.deepEqual(missing.effects,[]);
 assert.deepEqual(missing.missingInputs,['eduLoss']);
 const g=graduate({id:id('colonial'),stats:{INT:8,END:8},roll:11,eduLoss:3});
 assert.deepEqual(effectsBy(g,'stat'),[{kind:'stat',name:'END',value:1},{kind:'stat',name:'EDU',value:-3}]);
 assert.equal(g.effects.find(e=>e.kind==='choice').options.length,2);
 assert.equal(choice(g,'colonial-primary').requiredLevel,0);
 assert.equal(choice(g,'colonial-honours').requiredLevel,0);
 assert.ok(g.effects.some(e=>e.name==='Jack-of-all-Trades'&&e.value===1));
 assert.ok(g.effects.some(e=>e.name==='Leadership'&&e.value===1));
});
test('psionic honours replace Rival with Enemy and raise only acquired talents',()=>{
 for(const [roll,honours] of [[5,false],[11,true]]){
  const r=graduate({id:id('psionic'),stats:{PSI:8,INT:8},roll,acquiredTalents:['Telepathy','Awareness']});
  assert.deepEqual(effectsBy(r,'relationship'),[{kind:'relationship',type:honours?'Enemy':'Rival',count:1}]);
  assert.equal(choice(r,'psionic-primary').options.length,2);
  assert.ok(r.effects.some(e=>e.name==='Science (psionicology)'&&e.value===1));
  if(honours){
   assert.equal(effectsBy(r,'psionic-talent').length,2);
   assert.equal(choice(r,'psionic-honours').value,2);
  }
 }
 assert.equal(graduate({id:id('psionic'),stats:{PSI:8,INT:8},roll:5,acquiredTalents:[]}).needsAdjudication,true);
});
test('Hard Knocks and Spacer graduation scopes preserve other-skill exclusions',()=>{
 const h=graduate({id:id('hard-knocks'),stats:{INT:8,END:9},roll:10});
 assert.equal(choice(h,'hard-knocks-other').count,3);
 assert.deepEqual(choice(h,'hard-knocks-other').excludeSelections,['hard-knocks-initial']);
 assert.deepEqual(choice(h,'hard-knocks-honours').optionsFromSelections,['hard-knocks-initial','hard-knocks-other']);
 assert.ok(h.effects.some(e=>e.name==='Gun Combat'&&e.value===0));
 assert.ok(h.effects.some(e=>e.name==='SOC'&&e.value===-1));
 const s=graduate({id:id('spacer'),stats:{INT:8,DEX:6},roll:11});
 assert.equal(choice(s,'spacer-other').count,2);
 assert.equal(choice(s,'spacer-graduation').options.length,5);
 assert.ok(s.effects.some(e=>e.name==='Pilot'&&e.value===0));
 assert.deepEqual(effectsBy(s,'stat'),[{kind:'stat',name:'DEX',value:1},{kind:'stat',name:'SOC',value:-2}]);
});
test('choice resolver requires prior selections and rejects duplicate or excluded choices',()=>{
 const r=graduate({id:id('hard-knocks'),stats:{INT:8,END:9},roll:10}),effect=choice(r,'hard-knocks-other');
 const common={id:id('hard-knocks'),effect,skills:{Streetwise:1,Athletics:0,Drive:0},selected:['Deception','Melee','Stealth']};
 assert.equal(select(common).resolved,false);
 const selected=select({...common,selections:{'hard-knocks-initial':['Athletics','Drive']}});
 assert.equal(selected.effects.length,3);assert.equal(selected.selection.id,'hard-knocks-other');
 assert.throws(()=>select({...common,selected:['Deception','Deception','Stealth'],selections:{'hard-knocks-initial':['Athletics','Drive']}}),/distinct/);
 assert.throws(()=>select({...common,selected:['Athletics','Melee','Stealth'],selections:{'hard-knocks-initial':['Athletics','Drive']}}),/outside/);
});
test('choice resolver enforces zero-to-one floors, acquired talents and canonical specialities',()=>{
 const c=graduate({id:id('colonial'),stats:{INT:8,END:8},roll:7,eduLoss:1});
 const common={id:id('colonial'),effect:choice(c,'colonial-primary'),selected:['Gun Combat (slug)'],skills:{'Gun Combat':0}};
 assert.equal(select(common).effects[0].name,'Gun Combat (slug)');
 assert.throws(()=>select({...common,selected:['Gun Combat']}),/specialisation/);
 assert.throws(()=>select({...common,selected:['Gun Combat (laser sword)']}),/listed/);
 assert.throws(()=>select({...common,skills:{'Gun Combat':1}}),/level 0/);
 const p=graduate({id:id('psionic'),stats:{PSI:8,INT:8},roll:5,acquiredTalents:['Telepathy']});
 assert.throws(()=>select({id:id('psionic'),effect:choice(p,'psionic-primary'),selected:['Telepathy'],skills:{}}),/acquired/);
 assert.equal(select({id:id('psionic'),effect:choice(p,'psionic-primary'),selected:['Telepathy'],skills:{Telepathy:0}}).effects[0].kind,'psionic-talent');
});
test('term outcomes preserve admission skills, no mustering-out and no time on failed entry',()=>{
 for(const eid of COMPANION_EDUCATION_IDS.filter(e=>e!==id('colonial'))){
  const t=term({id:eid,entered:true,age:22,term:2});
  assert.deepEqual([t.ageAfter,t.termDelta,t.nextTerm,t.keepInitialAwards,t.musteringOut],[26,1,3,true,false]);
  const f=term({id:eid,entered:false,age:22,term:2});
  assert.deepEqual([f.ageAfter,f.termDelta,f.nextTerm],[22,0,2]);
 }
});
test('colonial first-career age uses two D3s exactly once, not two D6s or extra terms',()=>{
 for(let a=1;a<=3;a++)for(let b=1;b<=3;b++){
  const t=term({id:id('colonial'),entered:true,age:18,term:1,colonialAgeDice:[a,b]});
  assert.equal(t.ageAfter,22+a+b);assert.equal(t.termDelta,1);assert.equal(t.extraYears,a+b);
 }
 assert.deepEqual(term({id:id('colonial'),entered:true,age:18,term:1}).missingInputs,['colonialAgeDice']);
 assert.throws(()=>term({id:id('colonial'),entered:true,age:18,term:1,colonialAgeDice:[4,1]}),/integer/);
 assert.equal(term({id:id('colonial'),entered:true,age:22,term:2,colonialAgeDice:[1,1]}).needsAdjudication,true);
});
test('colonial lifelong modifiers follow upbringing even without graduation',()=>{
 for(const [careerId,modifier] of [['core.scout',1],['core.rogue',1],['core.navy',-2]]){
  const r=rights({id:id('colonial'),graduation:failed('colonial'),careerId});
  assert.equal(r.qualificationModifier,modifier);assert.equal(r.commissionModifier,-1);assert.equal(r.advancementModifier,-1);
 }
});
test('psionic graduate entry is permanent and alien equivalents require adjudication',()=>{
 assert.equal(rights({id:id('psionic'),graduation:graduated('psionic'),careerId:'core.psion',firstCareerAfterEducation:false}).automaticEntry,true);
 assert.equal(rights({id:id('psionic'),graduation:failed('psionic'),careerId:'core.psion'}).automaticEntry,false);
 assert.equal(rights({id:id('psionic'),graduation:graduated('psionic'),careerId:'vargr.psion'}).needsAdjudication,true);
});
test('Merchant automatic rank entry is first-entered-career and curriculum-specific; advancement persists',()=>{
 for(const honours of [false,true]){
  const args={id:id('merchant'),graduation:graduated('merchant',honours),curriculum:'shipboard',careerId:'core.merchant',assignment:'marine',firstCareerAfterEducation:true};
  const r=rights(args);
  assert.equal(r.automaticEntry,true);assert.equal(r.entryRank,honours?2:1);assert.equal(r.advancementModifier,honours?2:1);
  assert.equal(rights({...args,assignment:'broker'}).automaticEntry,false);
  const late=rights({...args,firstCareerAfterEducation:false});
  assert.equal(late.automaticEntry,false);assert.equal(late.advancementModifier,honours?2:1);
 }
});
test('Citizen branch mapping is never guessed and honours rank award is applied only on entry',()=>{
 const args={id:id('merchant'),graduation:graduated('merchant',true),curriculum:'business',careerId:'core.citizen',assignment:'corporate',firstCareerAfterEducation:true};
 assert.equal(rights(args).needsAdjudication,true);
 assert.equal(rights({...args,citizenBranchApproved:false}).automaticEntry,false);
 const preview=rights({...args,citizenBranchApproved:true});
 assert.equal(preview.entryRank,2);assert.deepEqual(preview.effects,[]);
 const entered=rights({...args,citizenBranchApproved:true,enteringCareer:true});
 assert.deepEqual(entered.effects,[{kind:'skill',name:'Admin',mode:'set',value:1}]);
});
test('Hard Knocks penalties end after voluntary exit and unresolved involuntary history blocks guesses',()=>{
 const args={id:id('hard-knocks'),graduation:graduated('hard-knocks'),careerId:'core.navy'};
 const first=rights({...args,firstCareerAfterEducation:true});
 assert.equal(first.commissionModifier,-2);assert.equal(first.advancementModifier,-2);
 assert.equal(rights({...args,firstCareerAfterEducation:false,firstCareerExit:'voluntary'}).advancementModifier,0);
 assert.equal(rights({...args,firstCareerAfterEducation:false,firstCareerExit:'involuntary'}).needsAdjudication,true);
 assert.ok(rights({...args,firstCareerAfterEducation:false}).missingInputs.includes('firstCareerExit'));
});
test('Spacer bonuses apply only to Merchant free traders after graduation',()=>{
 const args={id:id('spacer'),graduation:graduated('spacer'),careerId:'core.merchant'};
 const free=rights({...args,assignment:'free'});
 assert.deepEqual([free.qualificationModifier,free.commissionModifier,free.advancementModifier],[1,1,1]);
 assert.equal(rights({...args,assignment:'marine'}).qualificationModifier,0);
 assert.equal(rights({...args,assignment:'free',graduation:failed('spacer')}).advancementModifier,0);
});
test('forced-career precedence and unresolved graduation prevent premature rights',()=>{
 const args={id:id('psionic'),graduation:graduated('psionic'),careerId:'core.psion'};
 assert.equal(rights({...args,forcedNextCareer:'core.prisoner'}).needsAdjudication,true);
 assert.equal(rights({...args,graduation:{...args.graduation,resolved:false}}).resolved,false);
 assert.throws(()=>rights({...args,graduation:{...args.graduation,graduated:false,honours:true}}),/Honours/);
});
test('helpers do not mutate caller state or frozen packs and contain no private links or randomness',async()=>{
 const input={id:id('merchant'),term:1,stats:{...stats},roll:10};
 const before=JSON.stringify(input),packBefore=JSON.stringify(PRECAREER_RULES);
 entry(input);graduate({...input,curriculum:'business'});
 const awards=initial({id:id('colonial')});awards.effects[0].value=99;
 assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(PRECAREER_RULES),packBefore);
 const source=await readFile(new URL('../engine/companion-education.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|drive\.google\.com|sediment:|https?:\/\/|setStat|document\./);
});

test('term completion delegates species ageing instead of silently using a human threshold',()=>{
 const r=term({id:id('spacer'),entered:true,age:38,term:3});
 assert.equal(r.ageAfter,42);assert.equal(r.speciesAgeingRulesRequired,true);
 assert.equal(Object.hasOwn(r,'ageingCheckpointRequired'),false);
});
test('future rights reject an impossible unattempted graduation',()=>{
 assert.throws(()=>rights({id:id('psionic'),graduation:{...graduated('psionic'),attempted:false},careerId:'core.psion'}),/attempted/);
});
test('ordinary Merchant academy rank1 entry receives the attained rank bonus exactly once',()=>{
 for(const [curriculum,assignment,name] of [['shipboard','marine','Mechanic'],['business','broker','Broker']]){
  const args={id:id('merchant'),graduation:graduated('merchant'),curriculum,careerId:'core.merchant',assignment,firstCareerAfterEducation:true};
  assert.deepEqual(rights(args).effects,[]);
  assert.deepEqual(rights({...args,enteringCareer:true}).effects,[{kind:'skill',name,mode:'set',value:1}]);
  assert.deepEqual(rights({...args,graduation:graduated('merchant',true),enteringCareer:true}).effects,[],'Rank2 does not retroactively grant rank1.');
 }
});
