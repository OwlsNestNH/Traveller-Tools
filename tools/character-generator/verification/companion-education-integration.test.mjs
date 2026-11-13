import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession,execute,project,importSession,exportSession,catalog} from '../engine/session.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,url).href));
source+='\nexport const companionAudit={apply,queueEffects,educationRights,skillLevel,skillCheckDM,gainSkill,rulesCheck,asBasic};';
const {companionAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const run=(r,type,payload={},opts)=>execute(r.session??r,{type,payload},opts);
function setup(seed='companion',changes={}){
 let r=run(createSession(seed),'setup',{name:'Companion fixture',species:'human',gender:'female'});
 r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});
 for(const stat of ['STR','DEX','END','INT','EDU','SOC'])r=run(r,'gm-override',{field:'stat.'+stat,value:changes[stat]??7,reason:'Source regression fixture'});
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});return r;
}
function force(r,type,payload,values,index=0){const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:index,values,reason:'Deterministic source regression'});}
function select(r,id){return run(r,'precareer',{id:'companion.'+id});}
function pick(r,...selected){return run(r,'companion-skill',{selected});}
function specialities(r){let limit=0;while(r.state.stage==='skill-choice'&&limit++<20){const e=r.state.pendingChoice,base=e.allowed?.[0]??'Admin';const spec=catalog().skillSpecialities[base];r=run(r,'choose-skill',{name:spec?base+' ('+spec[0]+')':base});}return r;}
function event(r,values=[2,3]){return force(r,'education-event',{},values);}
function graduate(r,values=[6,6]){return force(r,'education-graduation',{},values);}
function merchant(curriculum='business',honours=true){let r=select(setup('merchant-'+curriculum),'merchant');r=force(r,'companion-entry',{curriculum},[6,6]);r=specialities(r);r=event(r);r=graduate(r,honours?[6,6]:[4,4]);return pick(r,curriculum==='business'?'Broker':'Mechanic');}
function hardKnocks(){let r=select(setup('hard-knocks',{SOC:6}),'hard-knocks');r=run(r,'companion-entry');r=pick(r,'Athletics','Deception');r=event(r);r=graduate(r);r=pick(r,'Drive','Gambler','Melee');return pick(r,'Gun Combat (slug)');}
function spacer(){let r=select(setup('spacer'),'spacer');r=run(r,'companion-entry',{size:0});r=pick(r,'Astrogation','Electronics');r=event(r);r=graduate(r);r=pick(r,'Engineer','Profession');return pick(r,'Vacc Suit');}
function colonial(){let r=select(setup('colonial'),'colonial');r=run(r,'companion-entry',{techLevel:8});r=event(r);r=graduate(r);r=pick(r,'Mechanic');r=run(r,'choose-effect',{index:0});r=pick(r,'Drive (wheel)','Medic');return pick(r,'Navigation');}
function psionic(){let r=select(setup('psionic'),'psionic');r=force(r,'companion-entry',{},[4,5]);r=run(r,'learn-talent',{talent:'Telepathy'});r=force(r,'learn-talent',{talent:'Clairvoyance'},[6,6]);r=run(r,'finish-psionic-training');r=force(r,'companion-entry',{},[6,6]);r=event(r);r=graduate(r);r=pick(r,'Telepathy');return pick(r,'Telepathy');}

test('Companion admission controls require explicit world facts and curriculum without consuming an attempt',()=>{
 let r=select(setup(),'colonial');assert.equal(r.state.stage,'companion-admission');assert.throws(()=>run(r,'companion-entry'),/technology level/);assert.equal(r.state.character.terms,0);assert.equal(r.state.educationAttemptTerms,undefined);
 r=run(r,'cancel-education');r=select(r,'merchant');assert.throws(()=>run(r,'companion-entry',{}),/curriculum/);assert.equal(r.state.educationAttemptTerms,undefined);
});
test('Colonial honours awards enforce distinct sequential choices, age22+2D3 and one term',()=>{
 const r=colonial(),c=r.state.character;assert.equal(r.state.stage,'career');assert.equal(c.terms,1);assert.ok(c.age>=24&&c.age<=28);assert.equal(c.skills.Mechanic,1);assert.equal(c.skills.Navigation,1);assert.equal(c.skills['Drive (wheel)'],1);assert.equal(c.skills['Jack-of-all-Trades'],1);assert.equal(c.stats.END,8);assert.ok(c.stats.EDU>=4&&c.stats.EDU<=6);assert.equal(c.educations[0].completed,true);assert.equal(c.educations[0].termOutcome.termDelta,1);assert.equal(c.educations[0].graduation.honours,true);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Colonial pending graduation choices cannot be bypassed, repeated or satisfy exclusions twice',()=>{
 let r=select(setup('colonial-constraints'),'colonial');r=run(r,'companion-entry',{techLevel:8});r=event(r);r=graduate(r);assert.equal(r.state.character.educations[0].completed,undefined);assert.equal(r.state.character.age,18);assert.throws(()=>run(r,'career',{id:'core.army',assignment:'infantry'}),/start of a term/);
 r=pick(r,'Mechanic');r=run(r,'choose-effect',{index:0});assert.throws(()=>pick(r,'Mechanic','Medic'),/outside|already/);assert.throws(()=>pick(r,'Drive (wheel)','Drive (track)'),/distinct/);assert.throws(()=>pick(r,'Drive','Medic'),/specialisation/);
});
test('Colonial failed graduation keeps initial awards and persistent upbringing penalties',()=>{
 let r=select(setup('colonial-fail'),'colonial');r=run(r,'companion-entry',{techLevel:8});r=event(r);r=graduate(r,[1,1]);assert.equal(r.state.stage,'career');assert.equal(r.state.character.educations[0].graduation.graduated,false);assert.equal(r.state.character.skills.Survival,1);assert.equal(r.state.character.skills['Jack-of-all-Trades'],undefined);
 assert.equal(a.educationRights(r.state,'core.rogue','thief').qualificationModifier,1);assert.equal(a.educationRights(r.state,'core.army','infantry').qualificationModifier,-2);assert.equal(a.educationRights(r.state,'core.army','infantry').commissionModifier,-1);
});
test('Psionic community native acquisition and honours only improve acquired talents',()=>{
 const r=psionic(),c=r.state.character;assert.equal(r.state.stage,'career');assert.equal(c.stats.PSI,10);assert.equal(c.skills.Telepathy,2);assert.equal(c.skills.Clairvoyance,1);assert.equal(c.skills.Teleportation,undefined);assert.equal(c.skills['Science (psionicology)'],1);assert.equal(c.relationships.filter(x=>x.role==='Enemy').length,1);assert.equal(c.relationships.filter(x=>x.role==='Rival').length,0);assert.equal(c.psionEntryPermission,true);assert.equal(a.educationRights(r.state,'core.psion','adept').automaticEntry,true);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Psionic training rejects arbitrary manual talent lists and zero potential acquisition',()=>{
 let r=select(setup('psionic-block'),'psionic');r=run(r,'companion-entry');assert.equal(r.state.stage,'psionic-training');assert.equal(r.state.character.skills.Telepathy,undefined);assert.throws(()=>run(r,'resolve-book',{confirmed:true,note:'Invented talents',psionicPotential:9,acquiredTalents:['Telepathy']}),/No source/);
 r=run(r,'gm-override',{field:'stat.PSI',value:0,reason:'Zero potential regression'});assert.throws(()=>run(r,'learn-talent',{talent:'Telepathy'}),/Positive PSI/);
});
for(const curriculum of ['business','shipboard'])test('Merchant '+curriculum+' curriculum, honours entry rank and persistent advancement work',()=>{
 let r=merchant(curriculum);assert.equal(r.state.stage,'career');assert.equal(r.state.character.stats.EDU,8);assert.equal(r.state.character.educations[0].curriculum,curriculum);const assignment=curriculum==='business'?'broker':'marine';r=run(r,'career',{id:'core.merchant',assignment});r=specialities(r);const c=r.state.character.careers[0];assert.equal(c.rank,2);assert.equal(c.educationModifiers.advancement,2);assert.ok(r.log.some(e=>e.summary.includes('automatically')));assert.equal(r.state.character.educations[0].completed,true);
});
test('Merchant ordinary graduate receives the entered rank1 bonus once',()=>{
 let r=merchant('shipboard',false);r=run(r,'career',{id:'core.merchant',assignment:'marine'});r=specialities(r);assert.equal(r.state.character.careers[0].rank,1);assert.equal(r.state.character.careers[0].educationModifiers.advancement,1);assert.equal(r.state.character.skills.Mechanic,1);
});
test('Merchant first entered career, not failed qualification attempts, controls automatic matching entry',()=>{
 const r=merchant(),s=structuredClone(r.state);s.character.educations[0].careerAttempts=2;assert.equal(a.educationRights(s,'core.merchant','broker').automaticEntry,true);s.character.careers.push({id:'core.army',terms:1,exit:'voluntary'});assert.equal(a.educationRights(s,'core.merchant','broker').automaticEntry,false);assert.equal(a.educationRights(s,'core.merchant','marine').advancementModifier,2);
});
for(const curriculum of ['business','shipboard'])for(const assignment of ['corporate','worker','colonist'])test('Merchant '+curriculum+' accepts Citizen '+assignment+' under the recorded ruling',()=>{
 let r=merchant(curriculum);const legacy=structuredClone(r.state);legacy.deferredSpecializations=false;
 assert.equal(a.educationRights(legacy,'core.citizen',assignment).unresolved.length,1);
 r=run(r,'career',{id:'core.citizen',assignment});
 assert.equal(r.state.character.careers[0].rank,2);assert.equal(r.state.character.careers[0].educationModifiers.advancement,2);
 assert.equal(r.log.at(-1).rolls.length,0);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('Hard Knocks enforces two initial, three other and current-level0 honours choices',()=>{
 let r=select(setup('knocks-constraints',{SOC:6}),'hard-knocks');r=run(r,'companion-entry');assert.throws(()=>pick(r,'Athletics','Athletics'),/distinct/);r=pick(r,'Athletics','Deception');r=event(r);r=graduate(r);assert.throws(()=>pick(r,'Athletics','Drive','Gambler'),/outside|already/);r=pick(r,'Drive','Gambler','Melee');assert.throws(()=>pick(r,'Streetwise'),/outside/);r=pick(r,'Gun Combat (slug)');assert.equal(r.state.stage,'career');assert.equal(r.state.character.stats.SOC,5);assert.equal(r.state.character.skills.Carouse,1);assert.equal(r.state.character.skills['Gun Combat (slug)'],1);
});
test('Hard Knocks modifiers apply to first career and stop after voluntary exit',()=>{
 const r=hardKnocks(),s=structuredClone(r.state);assert.equal(a.educationRights(s,'core.army','infantry').advancementModifier,-2);s.character.careers.push({id:'core.army',terms:1,exit:'voluntary'});assert.equal(a.educationRights(s,'core.navy','crew').advancementModifier,0);s.character.careers[0].exit='involuntary';assert.equal(a.educationRights(s,'core.navy','crew').advancementModifier,-2);s.character.careers.push({id:'core.navy',exit:'voluntary'});assert.equal(a.educationRights(s,'core.merchant','marine').advancementModifier,0);
});
test('Legacy Hard Knocks involuntary exit source decision is saved and used on retry',()=>{
 const r=hardKnocks(),s=structuredClone(r.state);s.deferredSpecializations=false;s.character.careers.push({id:'core.army',terms:1,exit:'involuntary'});s.stage='career';s.active=null;a.apply(s,{type:'career',payload:{id:'core.navy',assignment:'crew'}},[]);assert.equal(s.pending.kind,'companion-career-rights');a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Referee keeps the education penalty for this next career',qualificationModifier:0,commissionModifier:-2,advancementModifier:-2,educationAutomaticEntry:false}},[]);assert.equal(a.educationRights(s,'core.navy','crew').advancementModifier,-2);assert.equal(a.educationRights(s,'core.navy','crew').unresolved.length,0);
});
test('Spacer automatic admission, all four distinct subjects and free-trader bonuses integrate',()=>{
 const r=spacer(),c=r.state.character;assert.equal(r.state.stage,'career');assert.equal(c.skills.Astrogation,0);assert.equal(c.skills.Electronics,0);assert.equal(c.skills.Engineer,0);assert.equal(c.skills.Profession,0);assert.equal(c.skills.Pilot,0);assert.equal(c.skills['Jack-of-all-Trades'],1);assert.equal(c.stats.DEX,8);assert.equal(c.stats.SOC,5);assert.equal(a.educationRights(r.state,'core.merchant','free').qualificationModifier,1);assert.equal(a.educationRights(r.state,'core.merchant','free').advancementModifier,1);assert.equal(a.educationRights(r.state,'core.merchant','broker').qualificationModifier,0);
});
test('Spacer nonzero world entry roll failure consumes no term',()=>{
 let r=select(setup('spacer-entry',{INT:1,DEX:1}),'spacer');r=force(r,'companion-entry',{size:5},[1,1]);assert.equal(r.state.stage,'career');assert.equal(r.state.character.terms,0);assert.equal(r.state.character.age,18);assert.equal(r.state.canChooseEducation,false);
});
test('Merchant failed graduation retains curriculum skills but no future rights',()=>{
 let r=select(setup('merchant-fail'),'merchant');r=force(r,'companion-entry',{curriculum:'business'},[6,6]);r=specialities(r);r=event(r);r=graduate(r,[1,1]);assert.equal(r.state.stage,'career');assert.equal(r.state.character.stats.EDU,7);assert.equal(r.state.character.skills.Broker,0);assert.equal(a.educationRights(r.state,'core.merchant','broker').automaticEntry,false);
});
test('Shared event tragedy prevents Companion graduation while keeping initial skills',()=>{
 let r=select(setup('spacer-tragedy'),'spacer');r=run(r,'companion-entry',{size:0});r=pick(r,'Astrogation','Electronics');r=event(r,[1,2]);assert.equal(r.state.stage,'career');assert.equal(r.state.character.terms,1);assert.equal(r.state.character.skills['Jack-of-all-Trades'],undefined);assert.equal(r.state.character.skills['Vacc Suit'],1);assert.equal(r.state.character.educations[0].graduation.attempted,false);
});
test('Legacy higher-TL colonial entry and nonstandard timing preserve source decisions',()=>{
 let r=select(setup('colonial-manual'),'colonial');r.session.rulesRevision='character-preview-2026-11-09.17';r=run(r,'companion-entry',{techLevel:10});assert.equal(r.state.pending.kind,'companion-entry');assert.equal(r.state.character.terms,0);r=run(r,'resolve-book',{confirmed:true,note:'Referee permits this colony background despite unusual technology',educationEntrySuccess:true});r=run(r,'gm-override',{field:'age',value:25,reason:'Fixture nonstandard current age'});const s=structuredClone(r.state);s.character.educations[0].ageBefore=25;s.character.educations[0].graduationAllowed=false;a.queueEffects(s,[],'education-finish',[]);assert.equal(s.pending.kind,'companion-timing');a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Referee assigns four years to the later colonial education',educationAgeAfter:29}},[]);assert.equal(s.character.age,29);assert.equal(s.character.terms,1);assert.equal(s.stage,'career');
});
test('Missing social characteristic pauses Companion entry rather than inventing SOC',()=>{
 const r=select(setup('alien-social'),'hard-knocks'),s=structuredClone(r.state);delete s.character.stats.SOC;s.character.stats.CHA=7;s.character.species='vargr';a.apply(s,{type:'companion-entry',payload:{}},[]);assert.equal(s.pending.kind,'companion-entry');assert.equal(s.character.stats.SOC,undefined);assert.equal(s.character.terms,0);
});
test('Companion choices are retry-safe and every applied award appears in the audit',()=>{
 let r=select(setup('retry',{SOC:6}),'hard-knocks');r=run(r,'companion-entry');const before=r;const payload={selected:['Athletics','Deception']};r=run(r,'companion-skill',payload,{id:'choice-once'});const repeated=run(r,'companion-skill',payload,{id:'choice-once'});assert.equal(repeated.revision,r.revision);assert.deepEqual(repeated.state,r.state);assert.ok(r.log.at(-1).changes.some(c=>c.path.startsWith('skills.')));assert.equal(before.state.stage,'companion-skill');assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Prisoner mishap retains the end-of-term advancement and parole opportunity',()=>{
 const s=structuredClone(setup('prisoner').state);s.stage='career';s.character.sentenced=true;a.apply(s,{type:'career',payload:{id:'core.prisoner',assignment:'inmate'}},[]);s.stage='survival';s.character.stats.END=1;s._override={index:0,values:[1,1]};a.apply(s,{type:'survival',payload:{}},[]);delete s._override;
 let count=0;while(s.stage!=='advancement'&&count++<20){if(s.stage==='book-step')a.apply(s,{type:'resolve-book',payload:{confirmed:true,awardReviewConfirmed:true,note:'Test source outcome resolved',effects:[]}},[]);else if(s.stage==='effect-choice')a.apply(s,{type:'choose-effect',payload:{index:0}},[]);else if(s.stage==='skill-choice')a.apply(s,{type:'choose-skill',payload:{name:'Admin'}},[]);else break;}
 assert.equal(s.stage,'advancement');assert.equal(s.character.careers[0].terms,0);assert.equal(s.character.careers[0].forcedExit,false);
 s.character.careers[0].parole=3;s._override={index:0,values:[6,6]};a.apply(s,{type:'advancement',payload:{}},[]);assert.equal(s.character.careers[0].released,true);
});
test('PSI added after an education-only term is reduced by career terms only',()=>{
 let r=spacer();r=run(r,'gm-psi-testing',{enabled:true});r=force(r,'test-psionic-potential',{accessConfirmed:true,timingConfirmed:true,funding:'provided',cost:0,providedConfirmed:true,reason:'Confirmed teacher and two weeks'},[4,4]);assert.equal(r.state.character.stats.PSI,8);assert.match(r.log.at(-1).summary,/0 career terms/);
});
test('Companion UI exposes all phases and keeps UTF8 and focus safeguards intact',async()=>{
 const ui=await readFile(new URL('../gui/app.mjs',import.meta.url),'utf8');for(const name of ['companion-admission','companion-skill','education-tl','education-size','education-curriculum','education-citizen-decision','education-psi'])assert.ok(ui.includes(name),name);assert.ok(ui.includes('operationGeneration'));assert.ok(ui.includes('focusAfterAction'));assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(ui));
});

test('generic skill checks use the best speciality and other specialities inherit level0',()=>{
 const s=structuredClone(setup('skill-check').state);s.character.skills={Melee:0,'Melee (unarmed)':2};assert.equal(a.skillLevel(s,'Melee'),2);assert.equal(a.skillLevel(s,'Melee (blade)'),0);assert.equal(a.skillLevel(s,'Pilot (spacecraft)'),-3);
});
test('Profession named level0 remains distinct and does not train other professions',()=>{
 const s=structuredClone(setup('profession').state);s.character.skills={};a.gainSkill(s,'Profession (religion)',0,'set');assert.equal(s.character.skills['Profession (religion)'],0);assert.equal(s.character.skills.Profession,undefined);assert.equal(a.skillLevel(s,'Profession (belter)'),-3);a.gainSkill(s,'Profession',0,'set');assert.equal(a.skillLevel(s,'Profession (belter)'),-3);
});
test('University retains the selected named Profession0 before graduation',()=>{
 let r=force(setup('university-profession'),'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Profession (belter)'});assert.equal(r.state.character.skills['Profession (belter)'],0);assert.equal(r.state.character.skills.Profession,undefined);
});
test('check modifiers apply JaT and Aezorgh traits without granting eligibility',()=>{
 const s=structuredClone(setup('skill-dms').state);s.character.skills={'Jack-of-all-Trades':2};s.character.species='aezorgh';assert.equal(a.skillLevel(s,'Recon'),-3);assert.equal(a.skillCheckDM(s,'Recon'),0);assert.equal(a.skillCheckDM(s,'Pilot'),-1);s.character.skills['Jack-of-all-Trades']=4;assert.equal(a.skillCheckDM(s,'Pilot'),0);s.character.skills.Recon=1;assert.equal(a.skillCheckDM(s,'Recon'),2);
});
for(const effect of [{kind:'skill-reduction-choice',scope:'science-specialties',value:1},{kind:'skill-reduction-choice',names:['Profession (religion)','Science (belief)'],value:1}])test('no-target reduction pauses for source resolution with queue intact: '+JSON.stringify(effect),()=>{
 const s=structuredClone(setup('empty-reduction').state);s.character.skills={Admin:1};a.queueEffects(s,[effect,{kind:'note',text:'Remaining consequence'}],'career',[]);assert.equal(s.stage,'book-step');assert.equal(s.pending.kind,'native-effect');assert.equal(s.effectsQueue.length,1);a.apply(s,{type:'resolve-book',payload:{confirmed:true,awardReviewConfirmed:true,note:'Referee resolved the reduction with no trained eligible skill',effects:[]}},[]);assert.equal(s.stage,'career');assert.ok(s.character.historyNotes.some(n=>n.includes?.('Remaining consequence')||n.text==='Remaining consequence'));
});

test('explicit Prisoner escape marks release and permits leaving after event resolution',()=>{
 const s=structuredClone(setup('escape').state);s.stage='career';s.character.sentenced=true;a.apply(s,{type:'career',payload:{id:'core.prisoner',assignment:'thug'}},[]);a.queueEffects(s,[{kind:'career-status',action:'exit'}],'after-event',[]);assert.equal(s.stage,'term-end');assert.equal(s.character.careers[0].released,true);assert.equal(s.character.careers[0].escaped,true);a.apply(s,{type:'leave-career',payload:{}},[]);assert.ok(['benefits','career'].includes(s.stage));
});
test('native Vargr Believer exposes only compatible assignments before entry',()=>{
 const r=setup('believer'),s=structuredClone(r.state);delete s.character.stats.SOC;s.character.stats.CHA=7;s.character.species='vargr';s.stage='career';
 assert.throws(()=>a.apply(s,{type:'career',payload:{id:'companion.believer',assignment:'mainstream'}},[]),/absent SOC/);assert.throws(()=>a.apply(s,{type:'career',payload:{id:'companion.believer',assignment:'missionary'}},[]),/absent SOC/);s._override={index:0,values:[6,6]};a.apply(s,{type:'career',payload:{id:'companion.believer',assignment:'warrior'}},[]);assert.equal(s.character.careers[0].assignment,'warrior');
});
test('existing missing-stat survival state pauses, accepts explicit check result and resumes normally',()=>{
 const s=structuredClone(setup('missing-survival').state);s.stage='career';s._override={index:0,values:[6,6]};a.apply(s,{type:'career',payload:{id:'companion.believer',assignment:'mainstream'}},[]);delete s._override;s.stage='survival';delete s.character.stats.SOC;s.character.stats.CHA=7;s.character.species='vargr';a.apply(s,{type:'survival',payload:{}},[]);assert.equal(s.pending.kind,'missing-characteristic-check');assert.equal(s.character.stats.SOC,undefined);assert.equal(s.character.careers[0].terms,0);a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Referee supplied a source-approved cross-species survival check',checkNatural:8,checkTotal:8}},[]);assert.notEqual(s.stage,'survival');assert.equal(s.character.stats.SOC,undefined);assert.equal(s._sourceCheck,undefined);
});
test('alternative characteristic check selects present values without inventing missing statistics',()=>{
 const s=structuredClone(setup('alternatives').state);delete s.character.stats.SOC;s.character.stats.INT=12;s._override={index:0,values:[3,3]};const check=a.rulesCheck(s,{stat:'SOC/INT',target:8},[],'Alternative');assert.equal(check.stat,'INT');assert.equal(check.total,8);assert.equal(s.character.stats.SOC,undefined);
});

test('mandatory over-cap award pauses source resolution and retains remaining effects',()=>{
 const s=structuredClone(setup('skill-cap').state);s.character.stats.INT=1;s.character.stats.EDU=1;s.character.skills={Admin:4,Medic:2};a.queueEffects(s,[{kind:'skill',name:'Mechanic',value:1,mode:'increase'},{kind:'cash',value:25}],'career',[]);assert.equal(s.stage,'book-step');assert.equal(s.character.skills.Mechanic,undefined);assert.equal(s.effectsQueue.length,1);a.apply(s,{type:'resolve-book',payload:{confirmed:true,awardReviewConfirmed:true,note:'Referee resolved the mandatory award without exceeding the cap',effects:[]}},[]);assert.equal(s.stage,'career');assert.equal(s.character.cash,25);
});
test('over-cap skill choice can return to a valid no-increase alternative',()=>{
 const s=structuredClone(setup('skill-cap-choice').state);s.character.stats.INT=1;s.character.stats.EDU=1;s.character.skills={Admin:4,Medic:2};a.queueEffects(s,[{kind:'skill-choice',scope:'any',mode:'increase',value:1}],'career',[]);a.apply(s,{type:'choose-skill',payload:{name:'Mechanic'}},[]);assert.equal(s.stage,'book-step');a.apply(s,{type:'retry-skill-choice',payload:{}},[]);a.apply(s,{type:'choose-skill',payload:{name:'Admin'}},[]);assert.equal(s.stage,'career');assert.equal(s.character.skills.Admin,4);
});
test('basic0 and no-op awards remain possible when prior characteristic loss lowered cap',()=>{
 const s=structuredClone(setup('lowered-cap').state);s.character.stats.INT=1;s.character.stats.EDU=1;s.character.skills={Admin:4,Medic:4};a.gainSkill(s,'Pilot',0,'set');a.gainSkill(s,'Admin',1,'set');assert.equal(s.character.skills.Pilot,0);assert.equal(s.character.skills.Admin,4);assert.throws(()=>a.gainSkill(s,'Mechanic',1,'set'),/limit/);
});

test('basic training preserves an explicitly named Profession specialty at0',()=>{
 const result=a.asBasic([{kind:'skill',name:'Profession (religion)',value:1,mode:'increase'}]);assert.equal(result[0].name,'Profession (religion)');assert.equal(result[0].value,0);assert.equal(a.asBasic([{kind:'skill',name:'Pilot (spacecraft)',value:1}])[0].name,'Pilot');
});

test('new-session Colonial and Hard Knocks admission bounds reject without consuming an attempt',()=>{
 for(const [id,payload,changes,pattern] of [['colonial',{techLevel:9},{},/TL8 or lower/],['hard-knocks',{}, {SOC:7},/SOC 6 or lower/]]){
  let r=select(setup('entry-bound-'+id,changes),id);
  assert.throws(()=>run(r,'companion-entry',payload),pattern);
  assert.equal(r.state.character.terms,0);assert.equal(r.state.educationAttemptTerms,undefined);
  r=run(r,'cancel-education');assert.equal(r.state.stage,'precareer');
 }
});
