import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';

// Public replay-based fixture: every mutation is an ordinary API action or reasoned GM override.
function run(r,type,payload={},options={}){
 const result=api({operation:'command',session:r.session??r,command:{type,payload},...options});
 assert.equal(result.ok,true,type+': '+result.error?.message);return result;
}
function rejected(r,type,payload={},pattern=/./){
 const before=exportSession(r.session),result=api({operation:'command',session:r.session,command:{type,payload}});
 assert.equal(result.ok,false);assert.match(result.error.message,pattern);assert.equal(exportSession(r.session),before);return result;
}
function force(r,type,payload,values,index=0){
 const rolled=run(r,type,payload);
 return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Source-grounded Games regression fixture'});
}
function buildBoundary(withTalent=true){
 let r=api({operation:'create',seed:'games-public-0'});
 r=run(r,'setup',{species:'zhodani'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:i===5?10:8,reason:'Fixed characteristic fixture'});
 r=run(r,'accept-statistics');
 if(withTalent)r=run(r,'learn-talent',{talent:'Telepathy'});
 r=run(r,'finish-psionic-training');r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'Fixed tested PSI fixture'});
 r=run(r,'skip-precareer');r=force(r,'career',{id:'zhodani.merchant',assignment:'broker'},[6,6]);
 r=run(r,'choose-effect',{index:0});r=force(r,'survival',{},[5,5],1);r=run(r,'advancement');r=force(r,'training',{table:'personal'},[6]);
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.psionicGamesAvailability.available,true);return r;
}
const boundary=buildBoundary(),emptyBoundary=buildBoundary(false);
const rule=(mode)=>({mode,reason:'Referee checked the printed source interpretation.'});
const complete={ordinaryEvents:rule('omit'),awardStacking:rule('additive')};
function enter(r=boundary){return force(r,'apply-psionic-games',{},[4,5]);}
function finalStage(r=enter(),preliminaryDice=[3,4],finalDice=[5,5]){
 while(r.state.stage==='psionic-games-preliminaries')r=force(r,'psionic-games-preliminary',{talent:r.state.psionicGamesOptions[0].talent},preliminaryDice);
 return force(r,'psionic-games-final',{},finalDice);
}

// Narrow fault-injection fixtures supplement public API coverage for constraints not exposed as GM fields.
const url=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));
source+='\nexport const audit={initial,apply,queueEffects,psionicGamesAvailability,psionicHistory};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const raw=(s,type,payload={},values)=>{const rolls=[];if(values)s._override={index:0,values};const summary=a.apply(s,{type,payload},rolls);delete s._override;return {rolls,summary};};
const fixture=()=>structuredClone(boundary.state);
function rawEnter(s){raw(s,'apply-psionic-games',{},[4,5]);return s;}
function rawComplete(s){for(const talent of Object.keys(s.character.skills).filter(t=>['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].includes(t)))raw(s,'psionic-games-preliminary',{talent},[1,1]);raw(s,'psionic-games-final',{},[1,1]);raw(s,'complete-psionic-games',{ordinaryEvents:rule('omit')});}

test('public projection offers only the bounded current-career replacement and sources benefit inheritance',()=>{
 const r=boundary;assert.equal(r.state.psionicGamesAvailability.timing,'next-term-boundary');
 assert.equal(r.state.psionicGamesAvailability.careerId,'zhodani.merchant');assert.deepEqual(r.state.psionicGamesAvailability.source.pages,[242]);
 assert.equal(r.state.currentPsionicGames,null);assert.deepEqual(r.state.psionicGamesOptions,[]);
 const entered=enter();assert.deepEqual(entered.state.psionicGamesOptions,[{talent:'Telepathy',level:0,target:8}]);
 assert.equal(entered.state.currentPsionicGames.context.careerIndex,0);assert.equal(entered.state.currentPsionicGames.benefitAccounting.expectedDelta,1);
 assert.deepEqual(entered.state.currentPsionicGames.benefitAccounting.source[1].pages,[46]);
});

test('failed application uses lifetime attempt without consuming or changing the ordinary term',()=>{
 const before=structuredClone(boundary.state.character),r=force(boundary,'apply-psionic-games',{},[1,1]);
 const after=structuredClone(r.state.character);delete after.psionicGames;assert.deepEqual(after,before);
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.currentPsionicGames.application.applicationsAfter,1);
 assert.equal(r.state.currentPsionicGames.status,'failed');assert.equal(r.state.psionicGamesAvailability.available,false);
 rejected(r,'apply-psionic-games',{},/lifetime/);const next=run(r,'continue-career');assert.equal(next.state.stage,'training');
 assert.equal(next.state.character.age,before.age);assert.equal(next.state.character.terms,before.terms);
});

test('successful application reserves career without prematurely advancing term or granting awards',()=>{
 const before=boundary.state.character,r=enter();
 assert.equal(r.state.stage,'psionic-games-preliminaries');assert.equal(r.state.character.age,before.age);
 assert.equal(r.state.character.terms,before.terms);assert.deepEqual(r.state.character.careers,before.careers);
 assert.equal(r.state.psionicGamesPending,0);assert.equal(r.state.psionicGamesAvailability.available,false);
 for(const [type,payload] of [['continue-career',{}],['leave-career',{}],['career',{id:'zhodani.scholar',assignment:'lab'}],['apply-psionic-games',{}],['ageing',{}],['training',{table:'personal'}],['finish',{}],['connection',{person:'X',skill:'Admin'}],['gm-override',{field:'stat.PSI',value:15,reason:'Invalid pending-context change'}]])
  rejected(r,type,payload,/reserved Games/);
 const noted=run(r,'notes',{text:'Still considering the recorded competition'});assert.deepEqual(noted.state.currentPsionicGames,r.state.currentPsionicGames);
});

test('preliminary checks use frozen possessed levels, exact ordered dice and reject repeats or unpossessed talents',()=>{
 let r=enter();rejected(r,'psionic-games-preliminary',{talent:'Teleportation'},/possessed/);
 rejected(r,'psionic-games-final',{},/final/);
 r=force(r,'psionic-games-preliminary',{talent:'Telepathy'},[3,4]);
 const audit=r.state.currentPsionicGames.audit;assert.deepEqual(audit.map(c=>c.phase),['application','preliminary']);
 assert.equal(audit[1].skill,0);assert.equal(audit[1].total,8);assert.equal(audit[1].success,true);assert.deepEqual(audit[1].dice,[3,4]);
 assert.deepEqual(r.state.psionicGamesOptions,[]);rejected(r,'psionic-games-preliminary',{talent:'Telepathy'},/preliminary/);
 assert.deepEqual(r.state.character.skills,boundary.state.character.skills);
});

test('final checks and all source decisions preserve original rolls while waiting',()=>{
 const r=finalStage();assert.equal(r.state.stage,'psionic-games-decisions');assert.equal(r.state.psionicGamesNeedsStacking,true);
 assert.equal(r.state.currentPsionicGames.final.total,12);assert.equal(r.state.currentPsionicGames.final.won,true);
 assert.deepEqual(r.state.currentPsionicGames.audit.map(c=>c.sequence),[1,2,3]);
 rejected(r,'complete-psionic-games',{},/ordinaryEventHandling/);
 rejected(r,'complete-psionic-games',{ordinaryEvents:rule('omit')},/awardStacking/);
 rejected(r,'complete-psionic-games',{...complete,awardStacking:{mode:'additive',reason:''}},/reason/);
 rejected(r,'complete-psionic-games',{...complete,ordinaryEvents:{mode:'assume',reason:'No'}},/decision/);
 rejected(r,'psionic-games-final',{},/final/);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 assert.deepEqual(r.state.character.careers,boundary.state.character.careers);
});

test('completion applies awards and exactly one four-year current-career term and benefit roll',()=>{
 const waiting=finalStage(),r=run(waiting,'complete-psionic-games',complete),before=boundary.state.character;
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.age,before.age+4);assert.equal(r.state.character.terms,before.terms+1);
 assert.equal(r.state.character.careers.length,before.careers.length);assert.equal(r.state.character.careers[0].terms,before.careers[0].terms+1);
 assert.equal(r.state.character.careers[0].benefitRolls,before.careers[0].benefitRolls+1);
 assert.equal(r.state.character.careers[0].rank,before.careers[0].rank);assert.deepEqual(r.state.character.skills,before.skills);
 assert.equal(r.state.character.stats.PSI,12);assert.equal(r.state.character.stats.SOC,11);
 assert.equal(r.state.currentPsionicGames.status,'completed');assert.equal(r.state.currentPsionicGames.benefitAccounting.actualDelta,1);
 assert.equal(r.state.currentPsionicGames.completion.termDelta,1);assert.equal(r.state.psionicGamesPending,null);
 assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.psionicGamesAvailability.available,false);
 rejected(r,'complete-psionic-games',complete,/checks/);
});

test('alternative source decision awards winner PSI without double-counting the preliminary award',()=>{
 const r=run(finalStage(),'complete-psionic-games',{ordinaryEvents:rule('omit'),awardStacking:rule('winner-replaces-preliminary')});
 assert.equal(r.state.character.stats.PSI,11);assert.equal(r.state.character.stats.SOC,11);
 assert.equal(r.state.currentPsionicGames.competition.psiDelta,2);
});

test('no possessed talents proceeds directly to final and does not invent training',()=>{
 const entered=enter(emptyBoundary);assert.equal(entered.state.stage,'psionic-games-final');assert.deepEqual(entered.state.psionicGamesOptions,[]);
 assert.equal(entered.state.currentPsionicGames.preliminaries.competitionModifier,0);
 const r=run(finalStage(entered,undefined,[1,1]),'complete-psionic-games',{ordinaryEvents:rule('omit')});
 assert.equal(r.state.character.stats.PSI,9);assert.equal(r.state.character.stats.SOC,10);
 assert.deepEqual(r.state.currentPsionicGames.audit.map(c=>c.phase),['application','final']);
 assert.deepEqual(r.state.character.skills,emptyBoundary.state.character.skills);
});

test('source-only external event records explicit no-effects and applies supported effects once',()=>{
 let waiting=finalStage();rejected(waiting,'complete-psionic-games',{...complete,ordinaryEvents:rule('resolved-externally')},/explicit ordinaryEventEffects/);
 const empty=run(waiting,'complete-psionic-games',{...complete,ordinaryEvents:rule('resolved-externally'),ordinaryEventEffects:[]});
 assert.deepEqual(empty.state.currentPsionicGames.ordinaryEventEffects,[]);
 const effects=[{kind:'cash',value:1000},{kind:'debt',value:50},{kind:'stat',name:'STR',value:1},{kind:'relationship',role:'Contact',name:'Competition organiser'}];
 const r=run(waiting,'complete-psionic-games',{...complete,ordinaryEvents:rule('resolved-externally'),ordinaryEventEffects:effects},{id:'games-completion-once'});
 assert.equal(r.state.character.cash,boundary.state.character.cash+1000);assert.equal(r.state.character.debt,boundary.state.character.debt+50);
 assert.equal(r.state.character.stats.STR,boundary.state.character.stats.STR+1);assert.equal(r.state.character.relationships.at(-1).name,'Competition organiser');
 assert.deepEqual(r.state.currentPsionicGames.ordinaryEventEffects,effects);
 assert.equal(r.state.currentPsionicGames.completion.externalEventEffectsTiming,'after-games-awards-before-term-close');
 const retry=run(r,'complete-psionic-games',{...complete,ordinaryEvents:rule('resolved-externally'),ordinaryEventEffects:effects},{id:'games-completion-once'});
 assert.equal(retry.revision,r.revision);assert.deepEqual(retry.state,r.state);
});

test('external events reject prohibited, complex and irrelevant effect fields atomically',()=>{
 const waiting=finalStage(),base={...complete,ordinaryEvents:rule('resolved-externally')};
 for(const effect of [{kind:'skill',name:'Telepathy',value:1},{kind:'rank',value:1},{kind:'benefit',name:'Scout Ship',value:1},{kind:'career-status',action:'next',career:'core.prisoner'},{kind:'injury'},{kind:'cash',value:100,name:'irrelevant'},{kind:'debt',value:-1},{kind:'stat',name:'END',value:-8}]){
  rejected(waiting,'complete-psionic-games',{...base,ordinaryEventEffects:[effect]});
 }
 rejected(waiting,'complete-psionic-games',{...complete,ordinaryEventEffects:[{kind:'cash',value:1}]},/Omitted/);
 rejected(waiting,'complete-psionic-games',{...base,ordinaryEventEffects:[{kind:'cash',value:-1}]},/funding/);
 rejected(waiting,'complete-psionic-games',{...complete,effects:[],years:4},/typed/);
});

test('all Games commands reject injected dice and accidental retry IDs',()=>{
 const entered=enter();rejected(boundary,'apply-psionic-games',{dice:[6,6]},/no overrides/);
 rejected(entered,'psionic-games-preliminary',{talent:'Telepathy',dice:[6,6]},/dice/);
 const final=force(entered,'psionic-games-preliminary',{talent:'Telepathy'},[3,4]);
 rejected(final,'psionic-games-final',{dice:[6,6]},/no overrides/);
 const applied=run(boundary,'apply-psionic-games',{}, {id:'application-once',expectedRevision:boundary.revision});
 assert.deepEqual(run(applied,'apply-psionic-games',{}, {id:'application-once'}).state,applied.state);
 const stale=api({operation:'command',session:applied.session,command:{type:'notes',payload:{text:'stale'}},expectedRevision:boundary.revision});
 assert.equal(stale.ok,false);assert.match(stale.error.message,/changed/);
});

test('API import and replay preserve pending context and can replace a deliberate application result',()=>{
 const waiting=finalStage();assert.deepEqual(api({operation:'import',raw:exportSession(waiting.session)}).state,waiting.state);
 const rolled=run(boundary,'apply-psionic-games');
 const failed=run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values:[1,1],reason:'Referee corrected application dice'});
 assert.equal(failed.state.currentPsionicGames.status,'failed');assert.equal(failed.state.character.psionicGames.applications.length,1);
 const replaced=run(failed,'gm-replay',{revision:rolled.revision,rollIndex:0,values:[4,5],reason:'Referee corrected the previous replacement'});
 assert.equal(replaced.state.currentPsionicGames.status,'pending');assert.equal(replaced.state.character.psionicGames.applications.length,1);
 assert.ok(replaced.log.some(e=>e.number===rolled.revision));assert.ok(replaced.log.at(-1).summary.includes('superseded'));
 assert.deepEqual(project(importSession(exportSession(replaced.session))).state,replaced.state);
});

test('GM restore recovers exact pending checks, retains logs and randomness, and player restore is blocked',()=>{
 const waiting=finalStage(),completed=run(waiting,'complete-psionic-games',complete);
 const restored=run(completed,'restore',{revision:waiting.revision});
 assert.equal(restored.state.stage,'psionic-games-decisions');assert.deepEqual(restored.state.currentPsionicGames.audit,waiting.state.currentPsionicGames.audit);
 assert.equal(restored.state.character.age,waiting.state.character.age);assert.equal(restored.state.rng,completed.state.rng);
 assert.equal(restored.log.length,completed.log.length+1);assert.ok(restored.log.some(x=>x.type==='complete-psionic-games'));
 const recompleted=run(restored,'complete-psionic-games',complete);assert.equal(recompleted.state.character.terms,completed.state.character.terms);
 const player=run(waiting,'gm-mode',{enabled:false});rejected(player,'restore',{revision:boundary.revision},/Enable GM/);
});

test('Games cannot bypass forced exit, required next career, retirement, wrong species/class or missing current career',()=>{
 const cases=[
  s=>{s.character.careers[0].forcedExit=true;},
  s=>{s.forcedCareer='core.prisoner';},
  s=>{s.character.retirementFromCreation=true;},
  s=>{s.character.deceased=true;},
  s=>{s.character.stats.SOC=9;},
  s=>{s.character.stats.SOC=11;},
  s=>{s.character.species='human';},
  s=>{s.character.culture='imperial';},
  s=>{s.active=null;},
  s=>{s.character.careers[0].terms=0;},
  s=>{s.stage='training';}
 ];
 for(const change of cases){const s=fixture();change(s);assert.equal(a.psionicGamesAvailability(s).available,false);assert.throws(()=>raw(s,'apply-psionic-games'));assert.equal(s.character.psionicGames,undefined);}
});

test('failed application and unresolved competition cannot satisfy forced continuation',()=>{
 const failed=fixture();failed.character.careers[0].forcedStay=true;raw(failed,'apply-psionic-games',{},[1,1]);
 assert.equal(failed.character.careers[0].forcedStay,true);assert.throws(()=>raw(failed,'leave-career'),/natural 12/);
 const s=fixture();s.character.careers[0].forcedStay=true;rawEnter(s);assert.equal(s.character.careers[0].forcedStay,true);
 assert.throws(()=>raw(s,'leave-career'),/reserved Games/);assert.throws(()=>raw(s,'complete-psionic-games',complete),/checks/);
 rawComplete(s);assert.equal(s.character.careers[0].forcedStay,false);assert.equal(s.character.psionicGames.applications[0].completion.satisfiedForcedStay,true);
 assert.equal(s.character.careers[0].terms,boundary.state.character.careers[0].terms+1);
});

test('pending context invalidation is detected before any extra rolls or awards',()=>{
 for(const change of [
  s=>{s.character.stats.PSI++;},s=>{s.character.careers[0].assignment='free';},
  s=>{s.character.age++;},s=>{s.forcedCareer='core.prisoner';},s=>{s.character.careers[0].forcedExit=true;}
 ]){
  const s=rawEnter(fixture()),rng=s.rng;change(s);
  assert.throws(()=>raw(s,'psionic-games-preliminary',{talent:'Telepathy'}),/context changed/);
  assert.equal(s.rng,rng);assert.equal(s.character.psionicGames.applications[0].preliminaryRolls.length,0);
 }
});

test('an existing term benefit block is consumed normally without inventing a benefit roll',()=>{
 const s=fixture();s.character.careers[0].benefitBlock=1;s.character.careers[0].advancementBlock=2;
 const before=s.character.careers[0].benefitRolls;rawEnter(s);rawComplete(s);
 assert.equal(s.character.careers[0].benefitRolls,before);assert.equal(s.character.careers[0].benefitBlock,0);assert.equal(s.character.careers[0].advancementBlock,1);
 assert.equal(s.character.psionicGames.applications[0].benefitAccounting.actualDelta,0);
});

test('a completed Games term routes due ageing normally and preserves lifetime application history',()=>{
 let r=run(boundary,'gm-override',{field:'age',value:30,reason:'Due ageing fixture'});
 r=run(finalStage(enter(r),[1,1],[1,1]),'complete-psionic-games',{ordinaryEvents:rule('omit')});
 assert.equal(r.state.stage,'ageing');assert.equal(r.state.character.age,34);
 assert.equal(r.state.currentPsionicGames.completion.ageingDue,true);
 rejected(r,'continue-career',{},/end of a term/);rejected(r,'apply-psionic-games',{},/boundary/);
 r=force(r,'ageing',{},[6,6]);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.psionicGames.applications.length,1);
 assert.equal(r.state.currentPsionicGames.status,'completed');assert.equal(r.state.psionicGamesAvailability.available,false);
 rejected(r,'apply-psionic-games',{},/lifetime/);
});

test('completed course with unknown history is verified and reused before late Companion training fees',()=>{
 const s=a.initial('reuse-no-charge');s.stage='companion-admission';s.pendingEducation={id:'companion.psionic'};
 Object.assign(s.character,{age:22,terms:1,cash:100000,stats:{STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:8,PSI:9},skills:{Telepathy:0}});
 const h=a.psionicHistory(s);h.training.push({completed:true});h.historyKnown=false;
 raw(s,'companion-entry');assert.equal(s.pending.kind,'psionic-history');assert.equal(s.character.cash,100000);
 raw(s,'resolve-book',{confirmed:true,note:'Verified the earlier completed course and automatic Telepathy',psionicPreviousChecks:0,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy']});
 assert.equal(s.stage,'companion-admission');assert.equal(s.pendingEducation.psionicTrainingComplete,true);assert.equal(s.character.cash,100000);
 assert.equal(h.training.length,1);assert.ok(!h.rulings.some(r=>r.kind==='psionic-training-terms'));
});

test('unknown history without a completed course still requires explicit new training terms after verification',()=>{
 const s=a.initial('history-then-fee');s.stage='companion-admission';s.pendingEducation={id:'companion.psionic'};
 Object.assign(s.character,{age:22,terms:1,cash:100000,stats:{STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:8,PSI:9},skills:{Telepathy:0}});
 a.psionicHistory(s);raw(s,'companion-entry');assert.equal(s.pending.kind,'psionic-history');
 raw(s,'resolve-book',{confirmed:true,note:'Verified talent history without a completed course',psionicPreviousChecks:0,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy']});
 assert.equal(s.pending.kind,'psionic-training-terms');assert.equal(s.character.cash,100000);
 raw(s,'resolve-book',{confirmed:true,note:'New course access, payment and timing confirmed',psionicApproved:true,psionicCost:100000,psionicFunding:'cash',psionicTimingConfirmed:true});
 assert.equal(s.stage,'psionic-training');assert.equal(s.character.cash,0);
});

function promotionFixture(){
 const s=a.initial('commission-leak-0');s.stage='advancement';s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:10};
 s.character.careers=[{id:'core.army',assignment:'infantry',terms:0,rank:0,officer:false,benefitRolls:0,totalBenefits:0,successfulTerms:0}];s.active=0;
 a.queueEffects(s,[{kind:'promotion',mode:'automatic',allowCommission:true}],'advancement',[]);return s;
}
test('choosing automatic commission consumes both event alternatives, not a next-term free promotion',()=>{
 const s=promotionFixture();raw(s,'commission');assert.equal(s.character.careers[0].automaticCommission,false);assert.equal(s.character.careers[0].automaticPromotion,false);
 assert.equal(s.character.careers[0].rank,1);s.stage='advancement';const result=raw(s,'advancement',{},[3,3]);
 assert.ok(result.rolls.some(r=>r.label==='Advancement'));assert.doesNotMatch(result.summary,/"automatic":true/);
});

test('choosing automatic promotion consumes its event commission alternative without relaxing eligibility',()=>{
 const s=promotionFixture();raw(s,'advancement');assert.equal(s.character.careers[0].automaticPromotion,false);assert.equal(s.character.careers[0].automaticCommission,false);
 s.stage='advancement';s.character.careers[0].terms=1;s.character.stats.SOC=8;
 assert.throws(()=>raw(s,'commission'),/SOC 9/);
});

test('pension exit status is recorded and later social-class change flags review without inventing payout',()=>{
 // Projection is exercised publicly; five-term eligibility is independently covered by pension tests.
 let r=run(boundary,'leave-career');const record=r.state.character.careers[0];
 assert.equal(record.pensionExitStatusBasis.soc,10);assert.equal(record.pensionExitStatusBasis.socialClass,'intendant');
 assert.equal(record.pensionStatusReviewRequired,false);
 r=run(r,'gm-override',{field:'stat.SOC',value:11,reason:'Later social-class change needs pension review'});
 assert.equal(r.state.character.careers[0].pensionStatusReviewRequired,true);
 assert.equal(r.state.character.careers[0].pension,record.pension);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('multiple possessed talents roll in chosen order and keep their actual levels',()=>{
 const s=fixture();s.character.skills.Clairvoyance=2;rawEnter(s);
 raw(s,'psionic-games-preliminary',{talent:'Clairvoyance'},[2,3]);
 assert.equal(s.stage,'psionic-games-preliminaries');assert.equal(s.character.psionicGames.applications[0].audit[1].total,8);
 raw(s,'psionic-games-preliminary',{talent:'Telepathy'},[1,1]);raw(s,'psionic-games-final',{},[5,6]);
 const g=s.character.psionicGames.applications[0];assert.equal(g.preliminaries.competitionModifier,0);
 assert.deepEqual(g.audit.map(r=>r.talent??r.phase),['application','Clairvoyance','Telepathy','final']);
 assert.equal(g.final.total,12);assert.deepEqual(g.audit.map(r=>r.sequence),[1,2,3,4]);
});

test('public natural12 forced continuation is satisfied only on Games completion',()=>{
 let r=run(boundary,'continue-career');r=force(r,'training',{table:'personal'},[6]);
 r=force(r,'survival',{},[5,5],1);r=force(r,'advancement',{},[6,6]);r=force(r,'training',{table:'personal'},[6]);
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].forcedStay,true);
 const beforeTerms=r.state.character.terms;r=enter(r);assert.equal(r.state.character.careers[0].forcedStay,true);
 r=finalStage(r,[1,1],[1,1]);assert.equal(r.state.character.careers[0].forcedStay,true);
 rejected(r,'leave-career',{},/reserved Games/);
 r=run(r,'complete-psionic-games',{ordinaryEvents:rule('omit')});assert.equal(r.state.character.careers[0].forcedStay,false);
 assert.equal(r.state.character.terms,beforeTerms+1);assert.equal(r.state.currentPsionicGames.completion.satisfiedForcedStay,true);
});

test('Games award PSI respects native characteristic ceiling without granting any talent',()=>{
 let r=run(boundary,'gm-override',{field:'stat.PSI',value:15,reason:'Ceiling fixture'});
 r=run(finalStage(enter(r)),'complete-psionic-games',complete);
 assert.equal(r.state.character.stats.PSI,15);assert.deepEqual(r.state.character.skills,boundary.state.character.skills);
 assert.equal(r.state.currentPsionicGames.competition.psiDelta,3);
});

test('targeted public event replay preserves the survival prefix and cannot become a mishap roll',()=>{
 const entry=boundary.session.events.findIndex(e=>e.command.type==='survival'),original=boundary.log[entry];
 assert.deepEqual(original.rolls.map(r=>r.label),['Survival','Event table']);
 let r=boundary;
 for(let i=0;i<12;i++){
  r=run(r,'gm-replay',{revision:entry+1,rollIndex:1,values:[5,5],reason:'Replace only the event, retaining survival'});
  assert.deepEqual(r.log.at(-1).rolls[0],original.rolls[0]);
  assert.equal(r.log.at(-1).rolls[1].label,'Event table');assert.deepEqual(r.log.at(-1).rolls[1].values,[5,5]);
  assert.equal(r.state.stage,'advancement');assert.match(r.log.at(-1).summary,/Earlier rolls.*retained; later branch rolls.*regenerated/);
 }
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('public multi-roll replay retains original prefix, replaces only target, draws fresh suffix and advances RNG throughout',()=>{
 let r=api({operation:'create',seed:'replay-prefix-stats'});r=run(r,'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 const revision=r.revision,original=r.log.at(-1).rolls,rng=r.state.rng;
 r=run(r,'gm-replay',{revision,rollIndex:3,values:[6,6],reason:'Replace the fourth characteristic only'});
 const rolled=r.log.at(-1).rolls;assert.deepEqual(rolled.slice(0,3),original.slice(0,3));
 assert.equal(rolled[3].label,original[3].label);assert.deepEqual(rolled[3].values,[6,6]);
 assert.notDeepEqual(rolled.slice(4),original.slice(4));
 let expected=rng;for(let i=0;i<12;i++)expected=(expected+0x6D2B79F5)>>>0;assert.equal(r.state.rng,expected);
 rejected(r,'gm-replay',{revision,rollIndex:3,values:[6],reason:'Wrong count'},/dice count/);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('replay validates selected and preserved roll identity rather than accepting an index alone',()=>{
 const s=fixture();s.stage='survival';
 s._override={index:1,values:[1,1],preserved:[{label:'Survival',values:[6,6]}],target:{label:'Mishap table',values:[1]}};
 assert.throws(()=>a.apply(s,{type:'survival',payload:{}},[]),/selected replay roll identity/);
 const other=fixture();other.stage='survival';other._override={index:1,values:[5,5],preserved:[{label:'Different check',values:[6,6]}],target:{label:'Event table',values:[5,5]}};
 assert.throws(()=>a.apply(other,{type:'survival',payload:{}},[]),/preserved roll identity/);
});

test('import rejects rewritten original roll identity before applying a replay',()=>{
 const bad=structuredClone(boundary.session),entry=bad.events.find(e=>e.command.type==='survival');
 entry.rolls[1].label='Mishap table';
 const result=api({operation:'import',raw:JSON.stringify(bad)});assert.equal(result.ok,false);assert.match(result.error.message,/Roll audit mismatch/);
});
