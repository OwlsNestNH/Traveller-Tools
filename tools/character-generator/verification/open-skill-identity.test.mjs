import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSkillName} from '../engine/skills.mjs';
import {createSession,execute,exportSession,importSession,project} from '../engine/session.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const identityAudit={initial,gainSkill,skillLevel,skillAwardExceedsLimit,allocationImproves,normalizedSkill};';const {identityAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const fixture=modern=>{const s=a.initial('identity');s.deferredSpecializations=modern;s.character.stats={INT:10,EDU:10};return s;};
for(const base of ['Science','Language','Profession'])test(base+' subjects use one case-insensitive identity in new sessions only',()=>{
 const s=fixture(true);a.gainSkill(s,base+' (Physics)',1,'set');a.gainSkill(s,base+' (PHYSICS)',1,'increase');assert.deepEqual(s.character.skills,{[base+' (physics)']:2});assert.equal(a.skillLevel(s,base+' (PhYsIcS)'),2);assert.equal(a.allocationImproves(s,base+' (PHYSICS)',{mode:'set',value:1}),false);
 const old=fixture(false);a.gainSkill(old,base+' (Physics)',1,'set');a.gainSkill(old,base+' (physics)',1,'set');assert.equal(Object.keys(old.character.skills).length,2);
});
test('identity prevents case variants bypassing per-skill and total caps or named-award protection',()=>{
 const s=fixture(true);a.gainSkill(s,'Science (Physics)',4,'set');a.gainSkill(s,'Science (PHYSICS)',1,'increase');assert.equal(s.character.skills['Science (physics)'],4);assert.equal(Object.keys(s.character.skills).length,1);
 s.character.stats={INT:1,EDU:1};s.character.skills={'Science (physics)':3,Medic:3};assert.equal(a.skillAwardExceedsLimit(s,'Science (PHYSICS)',3,'set'),false);assert.equal(a.skillAwardExceedsLimit(s,'Science (PHYSICS)',1,'increase'),true);
 s.character.skills={};assert.equal(a.allocationImproves(s,'Science (PHYSICS)',{mode:'set',value:1,followingFixedAward:{name:'Science (Physics)',mode:'set',value:1}}),false);
});
test('normalization remains opt-in and finite specialties stay validated',()=>{
 assert.equal(normalizeSkillName('Language (Vilani)').name,'Language (Vilani)');assert.equal(normalizeSkillName('Language (Vilani)',{canonicalOpen:true}).name,'Language (vilani)');assert.throws(()=>normalizeSkillName('Gun Combat (ENERGY)',{canonicalOpen:true}),/listed/);
});
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function university(revision){let session=createSession('identity-save');if(revision)session.rulesRevision=revision;let r=run(session,'setup',{name:'Identity fixture',species:'human',gender:'female'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.EDU',value:12,reason:'Test admission'});r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'precareer',{id:'core.university'});if(r.state.stage!=='education-skill')r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[6,6],reason:'Test admission'});return run(r,'education-skill',{name:'Science (Physics)'});}
for(const revision of ['character-preview-2026-11-09.16','character-preview-2026-11-09.17',undefined])test('University save replay keeps identity semantics '+(revision??'current'),()=>{const r=university(revision),raw=exportSession(r.session),loaded=project(importSession(raw));assert.deepEqual(loaded.state,r.state);assert.equal(exportSession(importSession(raw)),raw);assert.equal(r.state.character.educations[0].selections['university-0'],revision?'Science (Physics)':'Science (physics)');assert.equal(r.session.events.at(-1).command.payload.name,'Science (Physics)');});
