import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const audit={initial,apply,queueEffects,psionicHistory,startPsionicTraining,psionicOptions,applyEffects};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const run=(r,type,payload={},options)=>execute(r.session??r,{type,payload},options);
function fixture(species='human',career='core.psion'){
 const s=a.initial('native-psi');s.stage='career';s.character.species=species;s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:species==='zhodani'?10:8,PSI:9};s.character.skills={};a.psionicHistory(s,true);
 if(career){s.character.careers=[{id:career,assignment:career==='core.psion'?'adept':'crew',terms:1,rank:0,benefitRolls:1}];s.active=0;}return s;
}
const cmd=(s,type,payload={},values)=>{const rolls=[];if(values)s._override={index:0,values};const summary=a.apply(s,{type,payload},rolls);delete s._override;return {rolls,summary};};
function human(seed='native-public',revision){
 const session=createSession(seed);if(revision)session.rulesRevision=revision;let r=run(session,'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});return r;
}
function force(r,type,payload,values,index=0){const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Source regression fixture'});}
const terms={confirmed:true,note:'Referee verified teacher access, funding and elapsed training chronology',psionicApproved:true,psionicCost:0,psionicFunding:'provided',psionicTimingConfirmed:true};
test('human community childhood tests and trains natively, then honours operates on acquired talents',()=>{
 let r=run(human(),'precareer',{id:'companion.psionic'});r=force(r,'companion-entry',{},[4,5]);assert.equal(r.state.stage,'psionic-training');assert.equal(r.state.character.stats.PSI,9);assert.equal(r.state.character.cash,0);assert.equal(r.state.character.debt,0);
 r=run(r,'learn-talent',{talent:'Telepathy'});assert.equal(r.state.character.skills.Telepathy,0);assert.equal(r.state.character.psionics.checksAttempted,0);assert.equal(r.log.at(-1).rolls.length,0);
 r=force(r,'learn-talent',{talent:'Clairvoyance'},[6,6]);assert.equal(r.state.character.psionics.checksAttempted,1);
 assert.throws(()=>run(r,'learn-talent',{talent:'Clairvoyance'}),/available/);
 r=run(r,'finish-psionic-training');assert.equal(r.state.stage,'companion-admission');assert.deepEqual(r.state.pendingEducation.acquiredTalents,['Telepathy','Clairvoyance']);
 r=force(r,'companion-entry',{},[6,6]);assert.equal(r.state.stage,'education-event');assert.equal(r.state.character.educations[0].psionicTrainingComplete,true);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('initial Zhodani societal training replaces background and offers Technopathy',()=>{
 let r=run(createSession('z-native'),'setup',{species:'zhodani'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');r=run(r,'gm-override',{field:'pool',index:5,value:11,reason:'Noble fixture'});r=run(r,'accept-statistics');
 assert.equal(r.state.stage,'psionic-training');assert.equal(r.state.backgroundRemaining,0);assert.equal(r.state.psionicOptions.length,6);assert.equal(r.state.character.psionics.historyKnown,true);
 r=run(r,'learn-talent',{talent:'Telepathy'});r=run(r,'finish-psionic-training');assert.equal(r.state.stage,'precareer');assert.deepEqual(Object.keys(r.state.character.skills),['Telepathy']);assert.equal(r.state.character.cash,0);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Zhodani Prole retains ordinary backgrounds without a fictional source setup',()=>{
 const s=fixture('zhodani',null);s.stage='statistics';s.pool=['STR','DEX','END','INT','EDU','SOC'].map(key=>({key,base:4,adjustment:0}));cmd(s,'accept-statistics',{},[1,1]);
 assert.equal(s.stage,'background');assert.ok(s.backgroundRemaining>0);
});
test('elevation suspends and resumes the original effect queue without reapplying EDU rules',()=>{
 const s=fixture('zhodani','zhodani.prole');s.character.stats.PSI=8;s.character.stats.SOC=9;s.character.stats.EDU=5;
 a.queueEffects(s,[{kind:'stat',name:'PSI',value:1},{kind:'cash',value:321}],'term-end',[]);
 assert.equal(s.stage,'psionic-training');assert.equal(s.character.stats.SOC,10);assert.equal(s.character.stats.EDU,5);assert.equal(s.character.cash,0);
 cmd(s,'learn-talent',{talent:'Telepathy'});cmd(s,'finish-psionic-training');assert.equal(s.stage,'term-end');assert.equal(s.character.cash,321);
});
test('PSI growth outside a career does not invent later Zhodani elevation',()=>{
 const s=fixture('zhodani',null);s.character.stats.PSI=8;s.character.stats.SOC=9;a.queueEffects(s,[{kind:'stat',name:'PSI',value:1}],'career',[]);assert.equal(s.character.stats.SOC,9);assert.equal(s.stage,'career');
});
test('initial failed talents cannot retry freely and the previous-check penalty persists',()=>{
 const s=fixture();a.startPsionicTraining(s,{context:'test',source:{id:'core',page:228},next:'career'},[]);
 cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(s.character.skills.Awareness,undefined);assert.equal(s.character.psionics.checksAttempted,1);
 assert.throws(()=>cmd(s,'learn-talent',{talent:'Awareness'},[6,6]),/available/);
 cmd(s,'learn-talent',{talent:'Telepathy'},[1,1]);const last=s.character.psionics.attempts.at(-1);assert.equal(last.automatic,false);assert.equal(last.previousChecks,1);assert.equal(last.total,6);assert.equal(last.success,false);
});
test('Core Psion service award retries at level0; failure consumes row without reroll',()=>{
 const s=fixture();const h=s.character.psionics;h.firstTalentChosen=true;h.checksAttempted=2;h.importedAttempted=['Telepathy','Awareness'];
 a.queueEffects(s,[{kind:'skill',name:'Awareness',value:1,psionicOrigin:{careerId:'core.psion',assignment:'adept',table:'service'}},{kind:'cash',value:9}],'survival',[]);
 assert.equal(s.stage,'psionic-training');assert.equal(s.psionicTraining.mode,'retry');assert.throws(()=>cmd(s,'finish-psionic-training'),/initial/);
 cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(s.stage,'survival');assert.equal(s.character.cash,9);assert.equal(s.character.skills.Awareness,undefined);assert.equal(h.checksAttempted,3);
 a.queueEffects(s,[{kind:'skill',name:'Awareness',value:1,psionicOrigin:{careerId:'core.psion',assignment:'adept',table:'service'}}],'survival',[]);cmd(s,'learn-talent',{talent:'Awareness'},[6,6]);assert.equal(s.character.skills.Awareness,0);
});
test('Core unknown talent without service origin remains source-assisted',()=>{
 const s=fixture();a.queueEffects(s,[{kind:'skill',name:'Teleportation',value:1}],'survival',[]);assert.equal(s.pending.kind,'native-effect');assert.equal(s.character.skills.Teleportation,undefined);
});
test('Zhodani failed talent rerolls original skill table and preserves outer queue',()=>{
 const s=fixture('zhodani','zhodani.navy');s.character.psionics.firstTalentChosen=true;s.character.psionics.checksAttempted=30;s.character.psionics.importedAttempted=['Awareness'];s.character.skills.Telepathy=0;
 a.queueEffects(s,[{kind:'skill',name:'Awareness',value:1,psionicOrigin:{careerId:'zhodani.navy',assignment:'crew',table:'psionic'}},{kind:'cash',value:43}],'survival',[]);
 const r=cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(r.rolls.length,2);assert.match(r.rolls[1].label,/replacement/);assert.equal(s.character.psionics.checksAttempted,31);
 // Reroll may itself require acquisition. Its queued cash must remain, not be reset.
 assert.ok(s.character.cash===43||s.effectsQueue.some(e=>e.kind==='cash'&&e.value===43));
});
test('Zhodani failed talent without a table has an explicit source continuation',()=>{
 const s=fixture('zhodani','zhodani.navy');s.character.psionics.firstTalentChosen=true;s.character.psionics.checksAttempted=20;s.character.psionics.importedAttempted=['Awareness'];
 a.queueEffects(s,[{kind:'skill',name:'Awareness',value:1},{kind:'cash',value:77}],'survival',[]);cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(s.pending.kind,'psionic-retry');assert.equal(s.character.cash,0);
 cmd(s,'resolve-book',{confirmed:true,note:'Referee selected Admin as replacement',effects:[{kind:'skill',name:'Admin',value:1}]});assert.equal(s.character.skills.Admin,1);assert.equal(s.character.cash,77);assert.equal(s.stage,'survival');
});
test('ordinary institute training requires access, minimum fee, available cash and timing',()=>{
 let r=run(human('legacy-institute','character-preview-2026-11-09.23'),'begin-psionic-training');assert.equal(r.state.pending.minimumCost,105000);assert.equal(r.state.pending.testingNeeded,true);assert.equal(r.log.at(-1).rolls.length,0);
 assert.throws(()=>run(r,'resolve-book',{...terms,psionicCost:105000,psionicFunding:'cash'}),/Available cash/);
 assert.throws(()=>run(r,'resolve-book',{...terms,psionicCost:1,psionicFunding:'cash'}),/minimum/);
 assert.throws(()=>run(r,'resolve-book',{...terms,psionicTimingConfirmed:false}),/timing|time/);
 assert.throws(()=>run(r,'resolve-book',{...terms,psionicCost:1}),/zero personal/);
 r=run(r,'resolve-book',terms);assert.equal(r.state.stage,'psionic-training');assert.equal(r.state.character.debt,0);assert.equal(r.state.character.age,18);
});
test('cash quote is charged once and repeated command IDs are idempotent',()=>{
 let r=run(human('cash','character-preview-2026-11-09.23'),'gm-override',{field:'cash',value:200000,reason:'Funding fixture'});r=run(r,'begin-psionic-training');const payload={...terms,psionicCost:105000,psionicFunding:'cash'};
 r=run(r,'resolve-book',payload,{id:'pay-once'});assert.equal(r.state.character.cash,95000);const again=run(r,'resolve-book',payload,{id:'pay-once'});assert.deepEqual(again.state,r.state);assert.equal(again.revision,r.revision);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('zero potential charges testing only and cannot buy another training course',()=>{
 const s=fixture('human',null);delete s.character.stats.PSI;s.character.careers=[{id:'core.army',terms:3}];s.character.cash=200000;
 cmd(s,'begin-psionic-training');cmd(s,'resolve-book',{...terms,psionicCost:106000,psionicFunding:'cash'},[1,1]);assert.equal(s.character.stats.PSI,0);assert.equal(s.character.cash,194000);assert.equal(s.stage,'career');assert.equal(s.character.psionics.rulings.at(-1).cost,6000);assert.throws(()=>cmd(s,'begin-psionic-training'),/zero/);
});
test('declining institute training changes neither PSI nor cash or random rolls',()=>{
 let r=run(human('legacy-institute','character-preview-2026-11-09.23'),'begin-psionic-training');const rng=r.state.rng;r=run(r,'resolve-book',{confirmed:true,note:'No teacher accessible',psionicApproved:false});assert.equal(r.state.stage,'precareer');assert.equal(r.state.rng,rng);assert.equal(r.state.character.stats.PSI,undefined);assert.equal(r.state.character.cash,0);
});
test('initial training cannot be purchased repeatedly for free retry opportunities',()=>{
 const s=fixture('human',null);cmd(s,'begin-psionic-training');cmd(s,'resolve-book',terms);cmd(s,'finish-psionic-training');assert.throws(()=>cmd(s,'begin-psionic-training'),/already/);
});
test('unknown imported attempt history blocks native rolls and cannot erase known history',()=>{
 const s=fixture();delete s.character.psionics;s.character.skills.Telepathy=0;a.startPsionicTraining(s,{context:'core-psion-award',mode:'retry',talent:'Awareness',source:{id:'core',page:229},next:'native-resume'},[]);
 assert.equal(s.pending.kind,'psionic-history');assert.throws(()=>cmd(s,'learn-talent',{talent:'Awareness'}),/No psionic/);
 assert.throws(()=>cmd(s,'resolve-book',{confirmed:true,note:'Old sheet',psionicPreviousChecks:0,psionicFirstTalentChosen:false,psionicAttemptedTalents:[]}),/Include/);
 cmd(s,'resolve-book',{confirmed:true,note:'Old sheet with recorded failures',psionicPreviousChecks:4,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy','Awareness']});assert.equal(s.stage,'psionic-training');cmd(s,'learn-talent',{talent:'Awareness'},[6,6]);assert.equal(s.character.psionics.attempts.at(-1).previousChecks,4);
});
test('manual new talent invalidates incomplete history rather than silently granting fresh retries',()=>{
 const s=fixture();a.applyEffects(s,[{kind:'skill',name:'Telepathy',value:0,mode:'set'}]);assert.equal(s.character.psionics.historyKnown,false);
});
test('repeated societal training after a prior course remains explicit and resumes queue',()=>{
 const s=fixture('zhodani','zhodani.prole');s.character.stats.SOC=9;s.character.stats.PSI=8;s.character.psionics.training.push({completed:true});
 a.queueEffects(s,[{kind:'stat',name:'PSI',value:1},{kind:'cash',value:5}],'term-end',[]);assert.equal(s.pending.kind,'psionic-repeat-training');
 cmd(s,'resolve-book',{confirmed:true,note:'No additional acquisition checks under this ruling'});assert.equal(s.stage,'term-end');assert.equal(s.character.cash,5);
});
test('late-term community requires timing decision rather than retroactive free childhood',()=>{
 const s=fixture('human',null);s.stage='companion-admission';s.pendingEducation={id:'companion.psionic'};s.character.terms=1;s.character.age=22;
 cmd(s,'companion-entry');assert.equal(s.pending.kind,'psionic-training-terms');assert.equal(s.character.age,22);assert.equal(s.character.psionics.attempts.length,0);
});
test('player-selected human PSI keeps GM mode off without awarding a talent',()=>{
 let r=run(createSession('raw'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'add-extra',{id:'PSI'});assert.equal(r.state.config.gm,false);assert.equal(r.state.character.stats.PSI,undefined);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(r.state.character.skills,{});
});
test('Core Psion entry cannot silently bypass initial training',()=>{
 const s=fixture('human',null);s.config.gm=true;cmd(s,'career',{id:'core.psion',assignment:'adept'});assert.equal(s.pending.kind,'psionic-training-terms');assert.equal(s.character.careers.length,0);
});
test('mandatory Independence acquisition at the skill cap uses source resolution and resumes',()=>{
 const s=fixture('aslan','aslan.outcast');s.character.gender='male';s.character.stats.INT=2;s.character.stats.EDU=2;s.character.stats.SOC=2;s.character.skills={Admin:4,Advocate:4,Carouse:4};
 s._override={index:0,values:[6,6]};a.queueEffects(s,[{kind:'independence',value:1},{kind:'cash',value:6}],'survival',[]);delete s._override;assert.equal(s.pending.kind,'native-effect');assert.equal(s.character.skills.Independence,undefined);
 cmd(s,'resolve-book',{confirmed:true,note:'Referee resolved capped award without increasing skill total'});assert.equal(s.stage,'survival');assert.equal(s.character.cash,6);
});

test('Zhodani talent award outside an active career pauses rather than crashing on failed retry',()=>{
 const s=fixture('zhodani',null);s.character.psionics.checksAttempted=30;s.character.psionics.firstTalentChosen=true;s.character.psionics.importedAttempted=['Awareness'];
 a.queueEffects(s,[{kind:'skill',name:'Awareness',value:1},{kind:'cash',value:99}],'precareer',[]);cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(s.pending.kind,'psionic-retry');
 cmd(s,'resolve-book',{confirmed:true,note:'No original career table; referee resolved replacement'});assert.equal(s.character.cash,99);assert.equal(s.stage,'precareer');
});
test('a generic Talent award without any learned talent is explicitly source-assisted',()=>{
 const s=fixture();a.queueEffects(s,[{kind:'skill-choice',scope:'psionic-talents',value:1},{kind:'cash',value:8}],'survival',[]);assert.equal(s.pending.kind,'native-effect');assert.match(s.pending.label,/none is possessed/);
 cmd(s,'resolve-book',{confirmed:true,note:'No possessed talent; referee adjudicated the empty award'});assert.equal(s.character.cash,8);assert.equal(s.stage,'survival');
});
test('zero-potential community admission stops clearly without a fresh potential roll',()=>{
 const s=fixture('human',null);s.character.stats.PSI=0;s.stage='companion-admission';s.pendingEducation={id:'companion.psionic'};assert.throws(()=>cmd(s,'companion-entry'),/zero has no/);assert.equal(s.character.psionics.tests.length,0);assert.equal(s.stage,'companion-admission');
});
test('known PSI uses a fixed Cr100000 course and preserves prior check penalties',()=>{
 const s=fixture('human',null);s.character.cash=120000;s.character.psionics.firstTalentChosen=true;s.character.psionics.checksAttempted=2;s.character.psionics.importedAttempted=['Telepathy','Awareness'];
 cmd(s,'begin-psionic-training');assert.equal(s.pending.minimumCost,100000);assert.equal(s.pending.testingNeeded,false);assert.throws(()=>cmd(s,'resolve-book',{...terms,psionicCost:105000,psionicFunding:'cash'}),/exactly/);
 const r=cmd(s,'resolve-book',{...terms,psionicCost:100000,psionicFunding:'cash'});assert.equal(s.character.cash,20000);assert.equal(r.rolls.length,0);assert.equal(s.character.psionics.checksAttempted,2);
});
test('source history cannot lower native check penalties after a manual talent award',()=>{
 const s=fixture();a.startPsionicTraining(s,{context:'test',source:{id:'core',page:228},next:'career'},[]);cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);cmd(s,'finish-psionic-training');a.applyEffects(s,[{kind:'skill',name:'Telepathy',value:0,mode:'set'}]);
 a.queueEffects(s,[{kind:'skill',name:'Clairvoyance',value:1,psionicOrigin:{careerId:'core.psion',assignment:'adept',table:'service'}}],'survival',[]);
 assert.equal(s.pending.kind,'psionic-history');assert.throws(()=>cmd(s,'resolve-book',{confirmed:true,note:'Invalid reset',psionicPreviousChecks:0,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy']}),/cannot be erased/);
 cmd(s,'resolve-book',{confirmed:true,note:'Source confirms original check and later manual acquisition',psionicPreviousChecks:1,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy','Awareness']});assert.equal(s.character.psionics.attempts.length,1);assert.equal(s.character.psionics.checksAttempted,1);
});

// Approved Human/Vargr ruling extends the acquisition procedure, not Zhodani social rules.
for(const species of ['human','vargr']){
 const make=()=>{const s=fixture(species,species==='human'?'core.psion':'vargr.psion');s.character.careers[0].assignment=species==='human'?'adept':'institute';s.character.stats.SOC=4;s.psionAcquisitionRuling=true;s.character.psionics.firstTalentChosen=true;s.character.psionics.checksAttempted=2;return s;};
 const award=(s,origin)=>a.queueEffects(s,[{kind:'psionic-talent',name:'Awareness',value:1,...(origin?{psionicOrigin:{careerId:s.character.careers[0].id,assignment:s.character.careers[0].assignment,table:'service'}}:{})},{kind:'cash',value:19}],'survival',[]);
 test(species+' ruled named acquisition preserves penalties and succeeds at level zero below SOC10',()=>{
  const s=make();award(s);assert.equal(s.stage,'psionic-training');assert.equal(s.psionicTraining.context,'human-vargr-psion-ruling');cmd(s,'learn-talent',{talent:'Awareness'},[6,6]);assert.equal(s.character.skills.Awareness,0);assert.equal(s.character.psionics.checksAttempted,3);assert.equal(s.character.psionics.attempts.at(-1).previousChecks,2);assert.equal(s.character.cash,19);
 });
 test(species+' ruled failed table acquisition rerolls its original table with outer queue intact',()=>{
  const s=make();award(s,true);const r=cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(r.rolls.length,2);assert.match(r.rolls[1].label,/Psionic replacement/);assert.equal(s.character.psionics.checksAttempted,3);assert.ok(s.character.cash===19||s.effectsQueue.some(e=>e.kind==='cash'&&e.value===19));
 });
 test(species+' failed fixed award requires explicit replacement rather than inventing a table',()=>{
  const s=make();award(s);cmd(s,'learn-talent',{talent:'Awareness'},[1,1]);assert.equal(s.pending.kind,'psionic-retry');assert.equal(s.character.cash,0);cmd(s,'resolve-book',{confirmed:true,note:'Referee selected Admin replacement',effects:[{kind:'skill',name:'Admin',value:1}]});assert.equal(s.character.skills.Admin,1);assert.equal(s.character.cash,19);
 });
 test(species+' generic Talent with none owned permits chosen retry with every previous penalty',()=>{
  const s=make();a.queueEffects(s,[{kind:'skill-choice',scope:'psionic-talents',mode:'increase',value:1},{kind:'cash',value:7}],'survival',[]);assert.equal(s.stage,'skill-choice');assert.throws(()=>cmd(s,'choose-skill',{name:'Technopathy'}),/not available/);cmd(s,'choose-skill',{name:'Awareness'});assert.equal(s.stage,'psionic-training');cmd(s,'learn-talent',{talent:'Awareness'},[6,6]);assert.equal(s.character.skills.Awareness,0);assert.equal(s.character.psionics.attempts.at(-1).previousChecks,2);assert.equal(s.character.cash,7);
 });
 test(species+' generic Talent with owned talent still improves only an owned talent',()=>{
  const s=make();s.character.skills.Telepathy=0;a.queueEffects(s,[{kind:'skill-choice',scope:'psionic-talents',mode:'increase',value:1}],'survival',[]);assert.throws(()=>cmd(s,'choose-skill',{name:'Awareness'}),/not available/);cmd(s,'choose-skill',{name:'Telepathy'});assert.equal(s.character.skills.Telepathy,1);assert.equal(s.character.psionics.checksAttempted,2);
 });
 test(species+' ruled acquisition preserves unknown-history and zero-potential boundaries',()=>{
  const s=make();s.character.psionics.historyKnown=false;award(s);assert.equal(s.pending.kind,'psionic-history');const zero=make();zero.character.stats.PSI=0;award(zero);assert.equal(zero.pending.kind,'native-effect');assert.equal(zero.character.cash,0);
 });
}
