import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 PSIONIC_GAMES_VERSION,PSIONIC_GAMES_SOURCE,PSIONIC_GAMES_RULES,
 psionicGamesEligibility as eligibility,psionicGamesApplication as application,
 psionicGamesPreliminaries as preliminaries,psionicGamesFinal as final,
 psionicGamesAwards as awards,psionicGamesCompetition as competition
} from '../engine/psionic-games.mjs';
const context={socialClass:'intendant',previousApplications:0,currentCareerId:'zhodani.scholar'};
const apply=(extra={})=>application({...context,psi:9,dice:[4,5],...extra});
const p=(extra={})=>preliminaries({psi:9,skills:{Telepathy:0},rolls:[{talent:'Telepathy',dice:[3,4]}],...extra});
const f=(preliminary=p(),dice=[5,5])=>final({preliminaries:preliminary,dice});
const ruling=(mode,reason='Recorded referee interpretation for this character.')=>({mode,reason});
const basicCompetition=(extra={})=>competition({
 application:apply(),skills:{Telepathy:0},preliminaryRolls:[{talent:'Telepathy',dice:[3,4]}],
 finalDice:[5,5],...extra
});

test('source/version identify a replacement term rather than a new career',()=>{
 assert.equal(PSIONIC_GAMES_VERSION,1);assert.deepEqual(PSIONIC_GAMES_SOURCE.pages,[242]);
 assert.equal(PSIONIC_GAMES_RULES.newCareer,false);
 assert.equal(PSIONIC_GAMES_RULES.lifetimeApplications,1);
 assert.equal(PSIONIC_GAMES_RULES.skillGains,false);
});
test('eligibility requires explicit class, lifetime history and active-career context',()=>{
 const r=eligibility();
 assert.equal(r.resolved,false);
 assert.deepEqual(r.missingInputs,['socialClass','previousApplications','currentCareerId']);
 assert.equal(eligibility(context).eligible,true);
 assert.equal(eligibility({...context,currentCareerId:null}).eligible,false);
});
test('only Intendants can apply; Noble and Prole status are not substituted',()=>{
 for(const socialClass of ['noble','prole']){
  const r=eligibility({...context,socialClass});
  assert.equal(r.eligible,false);assert.ok(r.reasons.includes('intendant-status-required'));
 }
 assert.throws(()=>eligibility({...context,socialClass:'human with SOC10'}),/socialClass/);
});
test('any previous application blocks another, including recorded failure',()=>{
 for(const previousApplications of [1,2,1000]){
  const r=eligibility({...context,previousApplications});
  assert.equal(r.eligible,false);assert.equal(r.applicationsRemaining,0);
  assert.ok(r.reasons.includes('lifetime-application-used'));
 }
 const failed=apply({dice:[1,1]});
 assert.equal(failed.success,false);assert.equal(failed.applicationsAfter,1);
 const repeat=application({...context,previousApplications:failed.applicationsAfter,psi:9,dice:[6,6]});
 assert.equal(repeat.attempted,false);assert.equal(repeat.applicationsAdded,0);
});
test('invalid history/career and non-D6 application input are rejected',()=>{
 for(const previousApplications of [-1,0.5,NaN])assert.throws(()=>eligibility({...context,previousApplications}),/integer/);
 assert.throws(()=>eligibility({...context,currentCareerId:'zhodani.fake'}),/Unknown/);
 for(const dice of [[0,6],[1,7],[2],[2,2,2],10,[2.5,4]])assert.throws(()=>apply({dice}),/D6|integer/);
});
test('application10+ uses Core characteristic DMs exactly at the boundary',()=>{
 assert.equal(apply({psi:8,dice:[4,5]}).success,false);
 assert.equal(apply({psi:8,dice:[4,6]}).success,true);
 assert.equal(apply({psi:9,dice:[4,5]}).success,true);
 assert.equal(apply({psi:9,dice:[4,4]}).success,false);
 assert.deepEqual(apply({psi:9,dice:[4,5]}).audit[0].dice,[4,5]);
});
test('missing application dice or PSI do not fabricate a check or consume application',()=>{
 const r=application({...context,psi:9});
 assert.equal(r.resolved,false);assert.deepEqual(r.missingInputs,['dice']);
 assert.equal(r.attempted,false);assert.equal(r.termDelta,0);assert.deepEqual(r.audit,[]);
 assert.ok(application({...context,dice:[5,5]}).missingInputs.includes('psi'));
});
test('application phase advances no time; success reserves exactly one existing-career term',()=>{
 const won=apply(),lost=apply({dice:[1,1]});
 assert.equal(won.termDelta,0);assert.equal(won.applicationsAdded,1);
 assert.equal(won.replacementTerm.currentCareerId,context.currentCareerId);
 assert.equal(won.replacementTerm.careerTerms,1);assert.equal(won.replacementTerm.years,4);
 assert.equal(lost.termDelta,0);assert.equal(lost.replacementTerm,null);
});
test('natural12 is not an automatic application success and high PSI keeps standard DM cap',()=>{
 assert.equal(apply({psi:0,dice:[6,6]}).success,false);
 assert.equal(apply({psi:40,dice:[3,4]}).audit[0].psiDM,3);
});
test('preliminary checks include acquired level0 talents and normal skill/PSI modifiers',()=>{
 const r=p({psi:8,skills:{Telepathy:0,Awareness:2},rolls:[
  {talent:'Telepathy',dice:[4,4]},{talent:'Awareness',dice:[3,3]}
 ]});
 assert.equal(r.successes,2);assert.equal(r.failures,0);
 assert.deepEqual(r.audit.map(x=>x.total),[8,8]);
 const s=p({skills:{Telepathy:2},rolls:[{talent:'Telepathy',dice:[2,3]}]});
 assert.equal(s.audit[0].total,8);assert.equal(s.audit[0].psiDM,1);assert.equal(s.audit[0].skill,2);
});
test('caller-selected preliminary order is retained and every talent occurs once',()=>{
 const r=p({skills:{Telepathy:0,Awareness:0},rolls:[
  {talent:'Awareness',dice:[1,2]},{talent:'Telepathy',dice:[3,4]}
 ]});
 assert.deepEqual(r.audit.map(x=>x.talent),['Awareness','Telepathy']);
 assert.deepEqual(r.audit.map(x=>x.sequence),[1,2]);
 assert.equal(r.successes,1);assert.equal(r.failures,1);assert.equal(r.competitionModifier,0);
});
test('ordinary skills and explicitly untrained talent entries cannot become preliminary attempts',()=>{
 const r=preliminaries({psi:9,skills:{Admin:4,Telepathy:-1},rolls:[]});
 assert.deepEqual(r.possessedTalents,[]);assert.equal(r.successes,0);
 assert.throws(()=>preliminaries({psi:9,skills:{Admin:4,Telepathy:-1},rolls:[{talent:'Telepathy',dice:[6,6]}]}),/possessed/);
 assert.throws(()=>preliminaries({psi:9,skills:{Admin:4},rolls:[{talent:'Admin',dice:[6,6]}]}),/possessed/);
});
test('missing preliminary rolls identify the exact talents without generating replacement dice',()=>{
 const r=preliminaries({psi:9,skills:{Telepathy:0,Awareness:1},rolls:[]});
 assert.equal(r.resolved,false);assert.deepEqual(r.missingInputs,['rolls.Telepathy','rolls.Awareness']);
 assert.deepEqual(r.audit,[]);
 const incomplete=p({rolls:[{talent:'Telepathy'}]});
 assert.deepEqual(incomplete.missingInputs,['rolls[0].dice']);
});
test('duplicate, unknown and nonpossessed preliminary talents reject',()=>{
 assert.throws(()=>p({rolls:[{talent:'Telepathy',dice:[3,4]},{talent:'Telepathy',dice:[5,6]}]}),/exactly once/);
 assert.throws(()=>p({rolls:[{talent:'Teleportation',dice:[6,6]}]}),/possessed/);
 assert.throws(()=>p({rolls:[{talent:'Magic',dice:[6,6]}]}),/possessed/);
});
test('Technopathy is a valid possessed talent and no acquisition DMs enter Games checks',()=>{
 const r=p({skills:{Technopathy:0},rolls:[{talent:'Technopathy',dice:[3,4]}]});
 assert.equal(r.successes,1);assert.equal(r.audit[0].modifier,1);
 const t=p();assert.equal(t.audit[0].modifier,1,'Do not add Telepathy learningDM4.');
});
test('empty possessed-talent set is valid with explicit empty rolls',()=>{
 const r=preliminaries({psi:12,skills:{Admin:1},rolls:[]});
 assert.equal(r.resolved,true);assert.deepEqual(r.audit,[]);
 assert.deepEqual([r.successes,r.failures,r.competitionModifier,r.majoritySuccessful],[0,0,0,false]);
 const won=final({preliminaries:r,dice:[5,5]});
 assert.equal(won.won,true);assert.equal(won.total,12);
});
test('missing empty-set inputs are still reported explicitly',()=>{
 assert.deepEqual(preliminaries({psi:12,skills:{}}).missingInputs,['rolls']);
 assert.deepEqual(preliminaries({psi:12,rolls:[]}).missingInputs,['skills']);
 assert.throws(()=>p({skills:{Telepathy:5}}),/integer/);
});
test('final is PSI12+ with successes minus failures, without a talent skill modifier',()=>{
 const r=p({skills:{Telepathy:4,Awareness:0,Clairvoyance:0},rolls:[
  {talent:'Telepathy',dice:[1,2]},{talent:'Awareness',dice:[3,4]},{talent:'Clairvoyance',dice:[1,2]}
 ]});
 assert.equal(r.competitionModifier,1);
 const win=final({preliminaries:r,dice:[5,5]});
 assert.equal(win.won,true);assert.equal(win.total,12);
 assert.equal(win.audit[0].skill,0);assert.equal(win.audit[0].competitionModifier,1);
 assert.equal(final({preliminaries:r,dice:[4,5]}).won,false);
});
test('natural2 can pass a skilled preliminary and natural12 can fail a penalised final',()=>{
 const naturalTwo=p({psi:15,skills:{Telepathy:4},rolls:[{talent:'Telepathy',dice:[1,1]}]});
 assert.equal(naturalTwo.audit[0].total,9);assert.equal(naturalTwo.successes,1);
 const allFailed=p({psi:0,skills:{Telepathy:0,Awareness:0},rolls:[
  {talent:'Telepathy',dice:[1,1]},{talent:'Awareness',dice:[1,1]}
 ]});
 assert.equal(final({preliminaries:allFailed,dice:[6,6]}).won,false);
});
test('final reports missing prerequisite or dice rather than guessing totals',()=>{
 assert.deepEqual(final().missingInputs,['preliminaries']);
 assert.deepEqual(final({preliminaries:p()}).missingInputs,['dice']);
 const unresolved=p({rolls:[]});
 assert.deepEqual(final({preliminaries:unresolved}).missingInputs,['resolved preliminaries']);
});
test('strict majority givesPSI1 to a losing finalist; tied preliminaries do not',()=>{
 const good=p(),lost=f(good,[1,1]);
 const a=awards({preliminaries:good,final:lost});
 assert.equal(a.psiDelta,1);assert.deepEqual(a.effects,[{kind:'stat',name:'PSI',value:1}]);
 const tie=p({skills:{Telepathy:0,Awareness:0},rolls:[
  {talent:'Telepathy',dice:[3,4]},{talent:'Awareness',dice:[1,1]}
 ]});
 assert.equal(awards({preliminaries:tie,final:f(tie,[1,1])}).psiDelta,0);
});
test('a winner without preliminary majority getsPSI2 and NobleSOC11 without a stacking decision',()=>{
 const zero=preliminaries({psi:12,skills:{},rolls:[]});
 const a=awards({preliminaries:zero,final:f(zero,[5,5])});
 assert.equal(a.resolved,true);assert.equal(a.psiDelta,2);
 assert.deepEqual(a.effects,[{kind:'stat',name:'PSI',value:2},{kind:'stat',name:'SOC',mode:'minimum',value:11}]);
});
test('simultaneous awards require explicit stacking interpretation with candidate values2and3',()=>{
 const preliminary=p(),a=awards({preliminaries:preliminary,final:f(preliminary)});
 assert.equal(a.resolved,false);assert.equal(a.needsAdjudication,true);
 assert.deepEqual(a.effects,[]);assert.equal(a.psiDelta,null);
 assert.deepEqual(a.unresolved[0].candidates,{additive:3,'winner-replaces-preliminary':2});
 assert.deepEqual(a.knownAwards,{preliminaryPSI:1,victoryPSI:2,becomesNoble:true,SOCMinimum:11});
});
test('both recorded stacking choices calculate exact deltas and retain the reason',()=>{
 const preliminary=p(),winner=f(preliminary);
 for(const [mode,expected] of [['additive',3],['winner-replaces-preliminary',2]]){
  const a=awards({preliminaries:preliminary,final:winner,stacking:ruling(mode)});
  assert.equal(a.resolved,true);assert.equal(a.psiDelta,expected);
  assert.equal(a.decisions[0].mode,mode);assert.ok(a.decisions[0].reason.length);
 }
});
test('invalid or unexplained source decisions cannot silently select an interpretation',()=>{
 const preliminary=p(),winner=f(preliminary);
 assert.throws(()=>awards({preliminaries:preliminary,final:winner,stacking:{mode:'additive'}}),/reason/);
 assert.throws(()=>awards({preliminaries:preliminary,final:winner,stacking:ruling('maximum-of-all')}),/Invalid/);
 assert.throws(()=>basicCompetition({decisions:{ordinaryEvents:{mode:'omit',reason:''}}}),/reason/);
});
test('losing all competitions yields no invented award',()=>{
 const preliminary=p({rolls:[{talent:'Telepathy',dice:[1,1]}]});
 const a=awards({preliminaries:preliminary,final:f(preliminary,[1,1])});
 assert.equal(a.resolved,true);assert.equal(a.psiDelta,0);assert.deepEqual(a.effects,[]);
});
test('failed and ineligible applications cannot consume a Games term or require competition dice',()=>{
 const failed=competition({application:apply({dice:[1,1]})});
 assert.equal(failed.entered,false);assert.equal(failed.termDelta,0);
 assert.equal(failed.applicationsAfter,1);assert.equal(failed.ordinaryCareerTermAvailable,true);
 assert.deepEqual(failed.effects,[]);assert.equal(failed.audit.length,1);
 const rejected=competition({application:apply({previousApplications:1})});
 assert.equal(rejected.entered,false);assert.equal(rejected.termDelta,0);assert.deepEqual(rejected.audit,[]);
});
test('pending competition input retains the successful application and never grants extra application',()=>{
 const r=competition({application:apply(),skills:{Telepathy:0}});
 assert.equal(r.resolved,false);assert.equal(r.applicationsAfter,1);
 assert.equal(r.termDelta,0);assert.equal(r.pendingReplacementTerm.careerTerms,1);
 assert.equal(r.pendingStage,'preliminaries');assert.ok(r.missingInputs.includes('preliminaryRolls'));
 assert.equal(r.audit.length,1);
});
test('missing final dice returns prior ordered checks and preserves the reserved term',()=>{
 const r=basicCompetition({finalDice:undefined});
 assert.equal(r.resolved,false);assert.equal(r.pendingStage,'final');
 assert.deepEqual(r.missingInputs,['finalDice']);
 assert.deepEqual(r.audit.map(x=>x.phase),['application','preliminary']);
 assert.deepEqual(r.audit.map(x=>x.sequence),[1,2]);
});
test('ordinary career events are an explicit unresolved field even when awards need no ruling',()=>{
 const r=basicCompetition({finalDice:[1,1]});
 assert.equal(r.resolved,false);assert.equal(r.needsAdjudication,true);
 assert.deepEqual(r.unresolved.map(x=>x.key),['ordinaryEventHandling']);
 assert.equal(r.psiDelta,1);assert.deepEqual(r.effects,[]);
 assert.equal(r.termDelta,0);
});
test('a victorious majority has two separate unresolved decisions',()=>{
 const r=basicCompetition();
 assert.deepEqual(r.unresolved.map(x=>x.key),['awardStacking','ordinaryEventHandling']);
 assert.deepEqual(r.effects,[]);assert.equal(r.completed,false);
});
test('resolved competition is one replacement term with forbidden ordinary actions still forbidden',()=>{
 const r=basicCompetition({decisions:{ordinaryEvents:ruling('omit'),awardStacking:ruling('additive')}});
 assert.equal(r.resolved,true);assert.equal(r.entered,true);assert.equal(r.completed,true);
 assert.equal(r.termDelta,1);assert.equal(r.years,4);
 assert.equal(r.replacementTerm.currentCareerId,context.currentCareerId);
 for(const key of ['newCareer','ordinarySurvival','ordinaryAdvancement','ordinaryTraining','skillGains'])assert.equal(r.replacementTerm[key],false);
 assert.equal(r.psiDelta,3);assert.equal(r.decisions.length,2);
});
test('external event adjudication is recorded, never executed by the helper',()=>{
 const r=basicCompetition({finalDice:[1,1],decisions:{ordinaryEvents:ruling('resolved-externally','Referee event recorded in the character history.')}});
 assert.equal(r.resolved,true);assert.equal(r.replacementTerm.ordinaryEvents,'resolved-externally');
 assert.equal(r.effects.some(e=>e.kind==='table-roll'),false);
 assert.equal(r.effects.some(e=>e.kind==='skill'),false);
});
test('all check dice are audited in application, supplied preliminary order, final order',()=>{
 const r=competition({application:apply(),skills:{Telepathy:0,Awareness:0},
  preliminaryRolls:[{talent:'Awareness',dice:[1,2]},{talent:'Telepathy',dice:[5,6]}],finalDice:[6,6],
  decisions:{ordinaryEvents:ruling('omit')}});
 assert.equal(r.resolved,true);
 assert.deepEqual(r.audit.map(x=>x.sequence),[1,2,3,4]);
 assert.deepEqual(r.audit.map(x=>x.dice),[[4,5],[1,2],[5,6],[6,6]]);
 assert.deepEqual(r.audit.map(x=>x.phase),['application','preliminary','preliminary','final']);
 assert.deepEqual(r.audit.slice(1,3).map(x=>x.talent),['Awareness','Telepathy']);
});
test('zero-talents competition completes with no preliminary dice or majority award',()=>{
 const r=competition({application:apply({psi:12,dice:[4,4]}),skills:{},preliminaryRolls:[],finalDice:[5,5],
  decisions:{ordinaryEvents:ruling('omit')}});
 assert.equal(r.resolved,true);assert.equal(r.psiDelta,2);
 assert.deepEqual(r.audit.map(x=>x.phase),['application','final']);
 assert.equal(r.preliminary.competitionModifier,0);
});
test('resolving outstanding source decisions reuses recorded dice and application, not a new attempt',()=>{
 const pending=basicCompetition();
 const complete=basicCompetition({decisions:{ordinaryEvents:ruling('omit'),awardStacking:ruling('additive')}});
 assert.deepEqual(pending.audit,complete.audit);
 assert.equal(pending.applicationsAfter,1);assert.equal(complete.applicationsAfter,1);
});
test('altered application/preliminary/final results cannot fabricate eligibility or victory',()=>{
 const badApp=structuredClone(apply({dice:[1,1]}));badApp.success=true;
 assert.throws(()=>competition({application:badApp}),/contradicts/);
 const badPrelim=structuredClone(p());badPrelim.successes=99;
 assert.throws(()=>final({preliminaries:badPrelim,dice:[6,6]}),/contradicts/);
 const preliminary=p(),badFinal=structuredClone(f(preliminary,[1,1]));badFinal.won=true;
 assert.throws(()=>awards({preliminaries:preliminary,final:badFinal}),/contradicts/);
});
test('awards do not clamp PSI or infer a changed species maximum',()=>{
 const preliminary=p({psi:14}),a=awards({preliminaries:preliminary,final:f(preliminary),stacking:ruling('additive')});
 assert.equal(a.psiDelta,3);assert.equal(a.effects[0].value,3);
 assert.equal(Object.hasOwn(a,'psiAfter'),false);
});
test('application DM boundaries match ordinary Core rules for every D6pair',()=>{
 const dm=n=>n===0?-3:n<=2?-2:n<=5?-1:n<=8?0:n<=11?1:n<=14?2:3;
 for(const psi of [0,1,2,3,5,6,8,9,11,12,14,15,18,40])
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
   const r=apply({psi,dice:[a,b]});
   assert.equal(r.audit[0].total,a+b+dm(psi));
   assert.equal(r.success,a+b+dm(psi)>=10);
  }
});
test('inputs stay unchanged and outputs own their audit arrays',()=>{
 const input={...context,psi:9,dice:[4,5]},before=structuredClone(input);
 const r=application(input);r.audit[0].dice[0]=1;
 assert.deepEqual(input,before);
 const skills={Telepathy:0},rolls=[{talent:'Telepathy',dice:[3,4]}];
 const pp=preliminaries({psi:9,skills,rolls});pp.audit[0].dice[0]=6;pp.input.skills.Telepathy=4;
 assert.deepEqual(skills,{Telepathy:0});assert.deepEqual(rolls,[{talent:'Telepathy',dice:[3,4]}]);
});
test('new module is source-safe, pure and independent of session/UI',async()=>{
 const source=await readFile(new URL('../engine/psionic-games.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|Date\.now|https?:\/\/|drive\.google|sediment:|document\.|session\.mjs|gui\//);
 assert.equal(Object.isFrozen(PSIONIC_GAMES_SOURCE),true);assert.equal(Object.isFrozen(PSIONIC_GAMES_SOURCE.pages),true);
});

test('award phase reports unresolved prerequisite results as missing completion',()=>{
 const unresolved=p({rolls:[]});
 const finalMissing=final({preliminaries:unresolved});
 const r=awards({preliminaries:unresolved,final:finalMissing});
 assert.equal(r.resolved,false);
 assert.deepEqual(r.missingInputs,['resolved preliminaries','resolved final']);
 assert.deepEqual(r.effects,[]);
});
test('a final computed for a different preliminary history cannot supply these awards',()=>{
 const a=p(),b=p({rolls:[{talent:'Telepathy',dice:[1,1]}]});
 assert.throws(()=>awards({preliminaries:a,final:f(b),stacking:ruling('additive')}),/contradicts/);
});
