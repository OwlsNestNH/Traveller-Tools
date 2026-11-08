import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {run,rejected,force,setupZhodani,buildReeducationFixture,buildPsionicAgeingFixture,forceReeducationTerm,rolledReeducation,chronology} from './zhodani-reeducation-fixtures.mjs';
import {settle} from './career-transfer-fixtures.mjs';
const ordinary=buildReeducationFixture(),protectedEvent=buildReeducationFixture({protectedStay:true}),explicit=buildReeducationFixture({explicitDischarge:true});
const timed=(mode='before-resume',extra={})=>({chronology:chronology(mode),...extra});
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
function finishAgeing(r){
 for(let i=0;i<20;i++){
  if(r.state.stage==='ageing')r=force(r,'ageing',{},[6,6]);
  else if(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
  else return r;
 }throw Error('Ageing fixture did not finish.');
}
for(let row=1;row<=6;row++)test('public source-earned re-education row '+row+' preserves original career accounting',()=>{
 let r=rolledReeducation(ordinary,row);
 if(row===5)r=force(r,'reeducation-fine',{},[2]);
 const payload=row<=4?timed('before-resume',row>=3?{duration:{months:6,reason:'Referee specified a half-year duration.'}}:{}):row===5?{funding:{mode:'provided',reason:'Referee confirmed this fine is paid externally.'}}:{};
 r=run(r,'resolve-reeducation',payload);assert.equal(r.state.stage,'term-end');
 const c=r.state.character.careers[0],e=r.state.character.reeducations[0];
 assert.equal(c.terms,1);assert.equal(r.state.character.terms,1);assert.equal(c.rank,0);assert.equal(c.benefitRolls,row===6?1:0);
 assert.equal(r.state.character.age,22+(row<=2?4:row<=4?.5:0));assert.equal(e.status,'completed');assert.equal(e.roll.total,row);
 assert.equal(r.state.character.nonCareerMonths??0,row<=2?48:row<=4?6:0);
 assert.deepEqual(r.state.character.skills,ordinary.state.character.skills);assert.equal(r.state.character.debt,0);
 assert.equal(c.forcedExit,row===2?false:true);roundtrip(r);
});
test('pending episode locks unrelated character commands and preserves roll before decisions',()=>{
 const r=rolledReeducation(ordinary,1);assert.equal(r.state.character.terms,0);
 for(const [type,payload] of [['career',{id:'zhodani.army',assignment:'support'}],['leave-career',{}],['training',{table:'personal'}],['gm-override',{field:'age',value:40,reason:'Invalid context change'}],['reeducation-roll',{anagathicTerms:0}]])rejected(r,type,payload);
 rejected(r,'resolve-reeducation',{},/Required/);rejected(r,'resolve-reeducation',timed('invented'),/chronology/);
 assert.deepEqual(r.state.currentReeducation.roll,{source:{id:'aliens',title:'Aliens of Charted Space Volume 1 Update 2026',page:276},die:1,anagathicTerms:0,modifier:0,total:1});roundtrip(r);
});
test('below-range outcome preserves original dice across staged row ruling, fine and funding',()=>{
 let r=rolledReeducation(ordinary,1,3);assert.equal(r.state.currentReeducation.roll.total,-2);
 rejected(r,'resolve-reeducation',{rowOverride:{row:2,reason:''}},/reason/);
 r=run(r,'resolve-reeducation',{rowOverride:{row:5,reason:'Referee selected row5 for the missing negative row.'}});
 assert.equal(r.state.stage,'reeducation-fine');roundtrip(r);r=force(r,'reeducation-fine',{},[4]);
 rejected(r,'resolve-reeducation',{},/funding/);r=run(r,'resolve-reeducation',{funding:{mode:'debt',reason:'Referee expressly permitted fine debt.'}});
 assert.equal(r.state.character.debt,4000);assert.equal(r.state.currentReeducation.roll.total,-2);assert.equal(r.state.currentReeducation.decisions.rowOverride.row,5);
 assert.equal(r.state.currentReeducation.fineDie,4);roundtrip(r);
});
test('nonzero untracked anagathic history needs a reason and cannot be silently supplied',()=>{
 rejected(ordinary,'reeducation-roll',{},/Anagathic/);rejected(ordinary,'reeducation-roll',{anagathicTerms:1},/reason/);
 rejected(ordinary,'reeducation-roll',{anagathicTerms:-1,anagathicsReason:'No'},/Anagathic/);
});
test('fine paid with available cash is charged exactly once without fabricated debt',()=>{
 let r=buildReeducationFixture({cash:10000});
 r=rolledReeducation(r,5);r=force(r,'reeducation-fine',{},[2]);r=run(r,'resolve-reeducation',{}, {id:'fine-paid'});
 assert.equal(r.state.character.cash,8000);assert.equal(r.state.character.debt,0);
 const again=run(r,'resolve-reeducation',{}, {id:'fine-paid'});assert.deepEqual(again.session,r.session);roundtrip(r);
});
test('protected disaster continuation overrides row1 career departure and still allows ordinary advancement',()=>{
 let r=rolledReeducation(protectedEvent,1);r=run(r,'resolve-reeducation',timed());
 assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.careers[0].forcedExit,false);assert.equal(r.state.character.careers[0].terms,0);
 assert.equal(r.state.character.stats.END,7);assert.equal(r.state.character.age,22);
 r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].terms,1);assert.equal(r.state.character.careers[0].benefitRolls,1);assert.equal(r.state.character.age,26);
});
test('after-current-term defers treatment stats/time without inventing additional training or benefit credit',()=>{
 let r=rolledReeducation(protectedEvent,1);r=run(r,'resolve-reeducation',timed('after-current-term'));
 assert.equal(r.state.stage,'advancement');assert.equal(r.state.currentReeducation.status,'deferred');assert.equal(r.state.character.stats.END,8);assert.equal(r.state.character.age,18);
 r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));
 assert.equal(r.state.currentReeducation.status,'completed');assert.equal(r.state.character.stats.END,7);assert.equal(r.state.character.age,26);
 assert.equal(r.state.character.terms,1);assert.equal(r.state.character.careers[0].terms,1);assert.equal(r.state.character.careers[0].rank,1);roundtrip(r);
});
test('independent explicit discharge survives deferred treatment and contradictory continuation needs a ruling',()=>{
 let r=rolledReeducation(explicit,2);rejected(r,'resolve-reeducation',timed('after-current-term'),/disposition/);
 r=run(r,'resolve-reeducation',timed('after-current-term',{disposition:{mode:'leave',reason:'Specific Agent discharge takes priority.'}}));
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].forcedExit,true);assert.equal(r.state.character.careers[0].rank,0);
 assert.equal(r.state.character.careers[0].terms,1);assert.equal(r.state.character.age,26);assert.equal(r.state.currentReeducation.origin.explicitDischarge,true);
});
test('short duration cannot default to zero or one year and remains fractional on reload',()=>{
 let r=rolledReeducation(ordinary,3);for(const months of [0,12])rejected(r,'resolve-reeducation',timed('before-resume',{duration:{months,reason:'Invalid boundary'}}),/duration/);
 r=run(r,'resolve-reeducation',timed('before-resume',{duration:{months:1.5,reason:'Referee specified six weeks as one-and-a-half months.'}}));
 assert.equal(r.state.character.age,22.125);assert.equal(r.state.character.nonCareerMonths,1.5);roundtrip(r);
});
test('END-zero consequences require an explicit bounded referee outcome',()=>{
 const start=buildReeducationFixture({end:1}),r=rolledReeducation(start,1);rejected(r,'resolve-reeducation',timed(),/endZero/);
 const survived=run(r,'resolve-reeducation',timed('before-resume',{endZero:{mode:'restore-to-one',reason:'Referee recorded recovery to END1, not an automatic table benefit.'}}));
 assert.equal(survived.state.character.stats.END,1);assert.equal(survived.state.currentReeducation.decisions.endZero.mode,'restore-to-one');
 const deceased=run(r,'resolve-reeducation',timed('before-resume',{endZero:{mode:'death',reason:'Referee confirmed the fatal zero outcome.'}}));
 assert.equal(deceased.state.stage,'deceased');assert.equal(deceased.state.character.deceased,true);roundtrip(deceased);
});
test('treatment and original term ageing each resume their own destination',()=>{
 let r=rolledReeducation(buildReeducationFixture({age:30}),2);r=run(r,'resolve-reeducation',timed());
 assert.equal(r.state.stage,'ageing');assert.equal(r.state.character.terms,0);assert.equal(r.state.character.age,34);assert.equal(r.state.currentReeducation.status,'treatment');
 r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'ageing');assert.equal(r.state.character.age,38);assert.equal(r.state.character.terms,1);
 r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.terms,1);assert.equal(r.state.currentReeducation.status,'completed');roundtrip(r);
});
test('recorded anagathic history requires explicit ageing-table credit before rolling',()=>{
 let r=rolledReeducation(buildReeducationFixture({age:30}),3,1);r=run(r,'resolve-reeducation',timed());
 assert.equal(r.state.stage,'ageing');r=run(r,'ageing');assert.equal(r.state.pending.kind,'zhodani-anagathic-ageing');assert.equal(r.log.at(-1).rolls.length,0);
 rejected(r,'resolve-book',{confirmed:true,ageingAnagathicTerms:0,note:''},/ruling/);
 r=run(r,'resolve-book',{confirmed:true,ageingAnagathicTerms:0,note:'Referee confirmed no current drug ageing protection.'});r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'ageing');roundtrip(r);
});
test('pending source decisions and completed episodes are idempotent, auditable and restore without erased history',()=>{
 const r=rolledReeducation(ordinary,2);const done=run(r,'resolve-reeducation',timed(),{id:'treat-once'});
 const again=run(done,'resolve-reeducation',timed(),{id:'treat-once'});assert.deepEqual(again.session,done.session);
 const restored=run(done,'restore',{revision:r.revision});assert.equal(restored.state.currentReeducation.status,'decisions');assert.equal(restored.state.character.nonCareerMonths,undefined);
 assert.ok(restored.log.some(e=>e.type==='resolve-reeducation'));roundtrip(restored);
 const player=run(r,'gm-mode',{enabled:false});const completed=run(player,'resolve-reeducation',timed());assert.equal(completed.state.currentReeducation.status,'completed');
 rejected(completed,'restore',{revision:r.revision},/GM mode/);
});
test('public career PSI gain elevates once without changing initial EDU or acquired backgrounds',()=>{
 let r=setupZhodani('public-elevation');r=force(r,'career',{id:'zhodani.prole',assignment:'worker'},[6,6]);r=settle(r);
 const before=structuredClone(r.state.character);r=run(r,'gm-override',{field:'stat.PSI',value:10,reason:'Source-confirmed mid-career PSI award'});
 assert.equal(r.state.stage,'psionic-training');assert.equal(r.state.character.stats.SOC,10);assert.equal(r.state.character.stats.EDU,before.stats.EDU);assert.deepEqual(r.state.character.skills,before.skills);
 r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');assert.equal(r.state.stage,'survival');assert.equal(r.state.character.psionics.training.length,1);roundtrip(r);
});
test('new rules revision rejects the prior candidate without silent migration',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-08.11');for(const revision of ['character-preview-2026-11-08.2','character-preview-2026-11-08.3','character-preview-2026-11-08.4']){
  const old=structuredClone(ordinary.session);old.rulesRevision=revision;const before=JSON.stringify(old);
  assert.equal(api({operation:'project',session:old}).ok,false);assert.equal(JSON.stringify(old),before);
 }
});

// Focused injected contexts cover otherwise very late ageing and queue combinations.
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');
source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));
source+='\nexport const audit={initial,apply,queueEffects,psionicHistory,closeTerm,finishAgeing};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function raw(s,type,payload={},values){const rolls=[];if(values)s._override={index:0,values};const summary=a.apply(s,{type,payload},rolls);delete s._override;return {rolls,summary};}
function state(){const s=structuredClone(protectedEvent.state);s.stage='ageing';s.reeducation=null;s.character.reeducations=[];s.character.age=50;s.character.terms=8;s.character.stats={STR:12,DEX:12,END:12,INT:8,EDU:8,SOC:10,PSI:1};s.character.skills.Telepathy=0;a.psionicHistory(s,true);s.effectsQueue=[];s.effectNext=null;return s;}
test('unusual-event marker finishes idempotently after native elevation and never starts a second course',()=>{
 const s=state();s.character.stats.SOC=9;s.character.stats.PSI=8;s.character.stats.EDU=5;delete s.character.skills.Telepathy;
 a.queueEffects(s,[{kind:'stat',name:'PSI',value:2},{kind:'zhodani-status-review',intendantPSIMin:9,SOC:10,trainPsionics:true},{kind:'cash',value:321}],'advancement',[]);
 raw(s,'learn-talent',{talent:'Telepathy'});raw(s,'finish-psionic-training');assert.equal(s.stage,'advancement');assert.equal(s.character.cash,321);assert.equal(s.character.stats.EDU,5);assert.equal(s.character.psionics.training.length,1);
});
test('ordinary mental ageing remains native; PSI is an explicit additional source choice',()=>{
 for(const index of [0,1,2]){const s=state();raw(s,'ageing',{},[1,1]);assert.equal(s.stage,'effect-choice');assert.equal(s.pendingChoice.options.length,4);raw(s,'choose-effect',{index});assert.equal(s.stage,'term-end');assert.equal(s.character.psionicLoss,undefined);}
 const s=state();raw(s,'ageing',{},[1,1]);raw(s,'choose-effect',{index:3});assert.equal(s.pending.kind,'zhodani-ageing-psi');assert.equal(s.character.stats.PSI,1);
 assert.throws(()=>raw(s,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:''}),/ruling/);
 raw(s,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:'Referee explicitly selected PSI under the Zhodani ageing rule.'});
 assert.equal(s.character.stats.PSI,0);assert.equal(s.character.stats.SOC,10);assert.equal(s.character.psionicLoss.permanent,true);assert.equal(s.character.skills.Telepathy,0);
 assert.equal(s.character.ageingCrises,undefined);assert.equal(s.stage,'term-end');
 for(const [type,payload] of [['gm-override',{field:'stat.PSI',value:9,reason:'Forbidden recovery'}],['begin-psionic-training',{}]])assert.throws(()=>raw(s,type,payload));
});
test('treatment never satisfies natural12 forced continuation or increments benefit blocks/pension terms',()=>{
 const s=structuredClone(protectedEvent.state);s.character.careers[0].forcedStay=true;s.character.careers[0].benefitBlock=2;
 raw(s,'reeducation-roll',{anagathicTerms:0},[2]);raw(s,'resolve-reeducation',timed());
 assert.equal(s.stage,'advancement');assert.equal(s.character.careers[0].forcedStay,true);assert.equal(s.character.careers[0].benefitBlock,2);
 assert.equal(s.character.careers[0].terms,0);assert.equal(s.character.terms,0);
});

test('actual three-term character receives distinct ageing DMs4 and5 in either recorded chronology',()=>{
 const base=buildReeducationFixture({termsBefore:3});
 for(const mode of ['before-resume','after-current-term']){
  let r=rolledReeducation(base,2);r=run(r,'resolve-reeducation',timed(mode));assert.equal(r.state.stage,'ageing');
  r=force(r,'ageing',{},[6,6]);assert.match(r.log.at(-1).summary,/term DM -4/);
  assert.equal(r.state.stage,'ageing');r=force(r,'ageing',{},[6,6]);assert.match(r.log.at(-1).summary,/term DM -5/);
  assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.age,38);assert.equal(r.state.character.terms,4);assert.equal(r.state.character.treatmentAgeingTerms,1);
  assert.equal(r.state.character.careers[0].terms,4);assert.equal(r.state.character.careers[0].benefitRolls,3);roundtrip(r);
 }
});
test('public multi-episode history reaches PSI ageing loss without injected terms or skills',()=>{
 let r=buildPsionicAgeingFixture();assert.equal(r.state.character.reeducations.length,3);assert.equal(r.state.character.treatmentAgeingTerms,3);assert.equal(r.state.character.terms,5);
 assert.equal(r.state.character.age,50);assert.equal(r.state.character.skills.Telepathy,0);
 r=run(r,'choose-effect',{index:3});roundtrip(r);
 r=run(r,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:'Referee selected PSI for this mental ageing loss.'});
 assert.equal(r.state.character.psionicLoss.permanent,true);assert.equal(r.state.character.stats.SOC,10);assert.equal(r.state.character.stats.PSI,0);
 assert.equal(r.state.character.psionics.training.length,1);assert.equal(r.state.character.skills.Telepathy,0);
 assert.equal(r.state.stage,'ageing');r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].terms,6);
 assert.equal(r.state.character.treatmentAgeingTerms,3);roundtrip(r);
});
test('public PSI correction replay/restore uses its original context without new unlogged training',()=>{
 let r=settle(force(setupZhodani('restore-elevation'),'career',{id:'zhodani.prole',assignment:'worker'},[6,6]));const before=r;
 r=run(r,'gm-override',{field:'stat.PSI',value:10,reason:'Referee event correction'});r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');
 const restored=run(r,'restore',{revision:before.revision});assert.equal(restored.state.stage,'survival');assert.equal(restored.state.character.stats.SOC,9);assert.equal(restored.state.character.stats.PSI,8);assert.equal(restored.state.character.skills.Telepathy,undefined);roundtrip(restored);
});

test('public later ageing cannot offer an impossible PSI choice after permanent loss',()=>{
 let r=buildPsionicAgeingFixture();r=run(r,'choose-effect',{index:3});r=run(r,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:'Referee selected PSI.'});
 r=force(r,'ageing',{},[1,2]);r=run(r,'gm-mode',{enabled:false});
 assert.equal(r.state.stage,'effect-choice');assert.equal(r.state.pendingChoice.options.length,3);
 rejected(r,'choose-effect',{index:3},/Choice/);r=run(r,'choose-effect',{index:0});assert.equal(r.state.stage,'term-end');roundtrip(r);
});
test('initially zero PSI and later GM zero correction leave only available mental choices',()=>{
 const s=state();s.character.stats.PSI=0;raw(s,'ageing',{},[1,1]);assert.equal(s.pendingChoice.options.length,3);
 const corrected=state();raw(corrected,'ageing',{},[1,1]);assert.equal(corrected.pendingChoice.options.length,4);
 raw(corrected,'gm-override',{field:'stat.PSI',value:0,reason:'Corrected pre-loss PSI'});assert.throws(()=>raw(corrected,'choose-effect',{index:3}),/Choice/);
 assert.equal(corrected.stage,'effect-choice');assert.equal(corrected.pendingChoice.options.length,3);raw(corrected,'choose-effect',{index:0});assert.equal(corrected.stage,'term-end');
});
test('mandatory talent gains after permanent loss stop at an explicit source continuation, not a throw',()=>{
 for(const effect of [{kind:'skill',name:'Telepathy',value:1},{kind:'psionic-talent',name:'Telepathy',value:1},{kind:'skill-choice',scope:'psionic-talents',value:1},{kind:'skill-choice',scope:'any',allowed:['Telepathy'],value:1}]){
  const s=state();s.character.stats.PSI=0;s.character.psionicLoss={permanent:true,cause:'ageing'};
  a.queueEffects(s,[effect,{kind:'cash',value:111}],'term-end',[]);assert.equal(s.stage,'book-step');assert.equal(s.pending.kind,'native-effect');assert.match(s.pending.label,/permanently/);
  raw(s,'resolve-book',{confirmed:true,note:'Referee discarded this unavailable award; no ability was restored.',effects:[]});
  assert.equal(s.stage,'term-end');assert.equal(s.character.cash,111);assert.equal(s.character.skills.Telepathy,0);assert.equal(s.character.stats.PSI,0);
 }
});

test('public post-loss Merchant talent training preserves the roll at a source stop and can continue',()=>{
 let r=buildPsionicAgeingFixture();r=run(r,'choose-effect',{index:3});r=run(r,'resolve-book',{confirmed:true,ageingPsiConfirmed:true,note:'Referee PSI loss'});
 r=force(r,'ageing',{},[6,6]);r=run(r,'leave-career');
 while(r.state.stage==='benefits')r=force(r,'benefit',{cash:false},[2]);
 r=settle(force(r,'career',{id:'zhodani.merchant',assignment:'broker'},[6,6]));
 r=force(r,'training',{table:'psionic'},[6]);assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.kind,'native-effect');
 assert.equal(r.log.at(-1).rolls[0].values[0],6);assert.match(r.state.pending.label,/permanently/);roundtrip(r);
 r=run(r,'gm-mode',{enabled:false});r=run(r,'resolve-book',{confirmed:true,note:'Referee discarded the unavailable talent award, retaining the original roll.',effects:[]});
 assert.equal(r.state.stage,'survival');assert.equal(r.state.character.skills.Telepathy,0);assert.equal(r.state.character.stats.PSI,0);assert.equal(r.state.character.psionicLoss.permanent,true);roundtrip(r);
});

test('accepted referee decisions mark coverage once and preserve it through fine replay',()=>{
 let r=rolledReeducation(ordinary,1,1);assert.equal(r.state.coverage.filter(x=>x==='zhodani-reeducation').length,1);
 rejected(r,'resolve-reeducation',{rowOverride:{row:5,reason:''}},/reason/);
 r=run(r,'resolve-reeducation',{rowOverride:{row:5,reason:'Referee supplied the missing row.'}});r=force(r,'reeducation-fine',{},[2]);
 assert.equal(r.state.coverage.filter(x=>x==='zhodani-reeducation').length,1);const fine=r.log.findLast(e=>e.type==='reeducation-fine');
 r=run(r,'gm-replay',{revision:fine.number,rollIndex:0,values:[3],reason:'Corrected fine die'});
 assert.equal(r.state.coverage.filter(x=>x==='zhodani-reeducation').length,1);assert.equal(r.state.currentReeducation.decisions.rowOverride.row,5);
 r=run(r,'resolve-reeducation',{funding:{mode:'provided',reason:'Referee funding ruling'}});assert.equal(r.state.coverage.filter(x=>x==='zhodani-reeducation').length,1);roundtrip(r);
 const native=rolledReeducation(ordinary,6);assert.equal(native.state.coverage.includes('zhodani-reeducation'),false);
 const done=run(native,'resolve-reeducation',{});assert.equal(done.state.coverage.includes('zhodani-reeducation'),false);
});
test('death during original-term ageing marks deferred treatment as never begun, not still pending',()=>{
 let r=buildPsionicAgeingFixture();r=run(r,'choose-effect',{index:0});r=force(r,'ageing',{},[6,6]);
 r=run(r,'gm-override',{field:'stat.END',value:1,reason:'Explicit frailty fixture before the next career term'});
 r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));r=forceReeducationTerm(r);
 r=rolledReeducation(r,2);r=run(r,'resolve-reeducation',timed('after-current-term'));
 assert.equal(r.state.currentReeducation.status,'deferred');assert.equal(r.state.character.nonCareerMonths,144);
 r=force(r,'ageing',{},[3,3]);r=run(r,'choose-effect',{index:0});assert.equal(r.state.stage,'effect-choice');
 r=run(r,'choose-effect',{index:1});assert.equal(r.state.stage,'deceased');assert.equal(r.state.currentReeducation.status,'deceased');
 assert.equal(r.state.currentReeducation.completion.cause,'death-before-treatment');assert.equal(r.state.currentReeducation.timeline,null);
 assert.equal(r.state.character.nonCareerMonths,144);roundtrip(r);
});
