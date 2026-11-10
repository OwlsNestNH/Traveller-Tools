import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,exportSession,project,RULES_REVISION} from '../engine/session.mjs';
import {trainingFixture,run} from './training-information-fixtures.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,url).href));
source+='\nexport const audit={initial,queueEffects,apply,skillCheckDM,rulesCheck};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const current=()=>{const s=a.initial('immediate');s.deferredSpecializations=true;s.correctedCareerEvents=true;s.immediateSpecializations=true;s.character.stats={STR:15,DEX:15,END:15,INT:15,EDU:15,SOC:15};s.stage='career';return s;};
const choose=(s,name)=>a.apply(s,{type:'choose-skill',payload:{name}},[]);

test('new characters immediately resolve specialty awards and preserve .18 corrections',()=>{
 const r=api({operation:'create',seed:'policy'});assert.equal(r.session.rulesRevision,'character-preview-2026-11-09.23');assert.equal(RULES_REVISION,r.session.rulesRevision);
 assert.equal(r.state.immediateSpecializations,true);assert.equal(r.state.deferredSpecializations,true);assert.equal(r.state.correctedCareerEvents,true);
 const start=trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate'});
 let award=run(start,'training',{table:'advanced'});assert.equal(award.state.stage,'skill-choice');assert.equal(award.state.pendingChoice.deferSpeciality,undefined);assert.equal(award.state.character.deferredSkillAwards,undefined);
 assert.throws(()=>run(award,'choose-skill',{name:'Electronics'}),/special/);
 const raw=exportSession(award.session),restored=api({operation:'import',raw});assert.equal(restored.ok,true);assert.equal(exportSession(restored.session),raw);assert.deepEqual(restored.state,award.state);
 award=run(restored,'choose-skill',{name:'Electronics (computers)'});assert.equal(award.state.character.skills['Electronics (computers)'],1);assert.notEqual(award.state.stage,'skill-choice');
});

test('existing .18 pending awards remain deferred and import byte-for-byte',()=>{
 let r=run(trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate',rulesRevision:'character-preview-2026-11-09.18'}),'training',{table:'advanced'});
 assert.equal(r.state.immediateSpecializations,undefined);assert.equal(r.state.character.deferredSkillAwards[0].name,'Electronics');
 const raw=exportSession(r.session),restored=api({operation:'import',raw});assert.equal(restored.ok,true);assert.equal(exportSession(restored.session),raw);assert.deepEqual(restored.state,r.state);
 r=run(restored,'allocate-specializations');const pending=exportSession(r.session);assert.equal(exportSession(api({operation:'import',raw:pending}).session),pending);
 r=run(r,'choose-skill',{name:'Electronics (sensors)'});assert.equal(r.state.character.skills['Electronics (sensors)'],1);assert.equal(r.session.rulesRevision,'character-preview-2026-11-09.18');
});

test('generic choices require immediate specialties while named awards and level zero remain unchanged',()=>{
 const s=current();a.queueEffects(s,[{kind:'skill-choice',scope:'any',allowed:['Electronics'],mode:'set',value:1}],'career',[]);
 assert.equal(s.pendingChoice.deferSpeciality,undefined);assert.throws(()=>choose(s,'Electronics'),/special/);choose(s,'Electronics (comms)');assert.equal(s.character.skills['Electronics (comms)'],1);
 a.queueEffects(s,[{kind:'skill',name:'Gun Combat',mode:'set',value:0},{kind:'skill',name:'Gun Combat (slug)',mode:'set',value:1}],'career',[]);
 assert.equal(s.stage,'career');assert.equal(s.character.skills['Gun Combat'],0);assert.equal(s.character.skills['Gun Combat (slug)'],1);assert.equal(s.character.deferredSkillAwards,undefined);
});

test('each successive generic receipt is resolved before the next award',()=>{
 const s=current();a.queueEffects(s,[{kind:'skill',name:'Gun Combat',mode:'set',value:1},{kind:'skill',name:'Gun Combat',mode:'set',value:1}],'career',[]);
 choose(s,'Gun Combat (energy)');assert.equal(s.stage,'skill-choice');choose(s,'Gun Combat (slug)');assert.equal(s.stage,'career');assert.equal(s.character.skills['Gun Combat (energy)'],1);assert.equal(s.character.skills['Gun Combat (slug)'],1);
});

test('new connection awards cannot defer a specialty',()=>{
 const s=current();assert.throws(()=>a.apply(s,{type:'connection',payload:{person:'Friend',skill:'Electronics'}},[]),/special/);assert.equal(s.connections.length,0);
 a.apply(s,{type:'connection',payload:{person:'Friend',skill:'Electronics (sensors)'}},[]);assert.equal(s.character.skills['Electronics (sensors)'],1);assert.equal(s.character.deferredSkillAwards,undefined);
});

test('skill checks use skill level without characteristic DM; characteristic checks retain their DM',()=>{
 const probe=current(),rolls=[];const check=a.rulesCheck(probe,{stat:'INT',target:8},rolls,'Test INT');
 assert.equal(check.dm,3);assert.equal(check.total,check.natural+3);
 const s=current();s.character.skills.Medic=1;assert.equal(a.skillCheckDM(s,'Medic'),1);
 a.queueEffects(s,[{kind:'check',skills:['Medic'],target:check.natural+2,success:[{kind:'skill',name:'Admin',mode:'set',value:1}],failure:[{kind:'skill',name:'Carouse',mode:'set',value:1}]}],'career',[]);
 assert.equal(s.character.skills.Carouse,1);assert.equal(s.character.skills.Admin,undefined);
 for(const key of Object.keys(s.character.stats))s.character.stats[key]=1;
 assert.equal(a.skillCheckDM(s,'Medic'),1);
});

test('implicit one-level awards request an immediate specialty too',()=>{const s=current();a.queueEffects(s,[{kind:'skill',name:'Science',mode:'increase'}],'career',[]);assert.equal(s.stage,'skill-choice');choose(s,'Science (physics)');assert.equal(s.character.skills['Science (physics)'],1);});
