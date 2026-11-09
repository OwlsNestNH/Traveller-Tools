import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSkillName} from '../engine/skills.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,url).href));
source+='\nexport const audit={initial,queueEffects,apply,gainSkill};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(value=1){const s=a.initial('skills');s.character.stats={STR:7,DEX:7,END:7,INT:7,EDU:7,SOC:7};s.character.careers=[{id:'core.citizen',assignment:'worker',rank:0,terms:1}];s.active=0;a.queueEffects(s,[{kind:'skill-choice',scope:'any',mode:'set',value}],'term-end',[]);return s;}
for(const name of ['Pilot','Pilot (','Pilot ()','Pilot (spacecraft','Pilot (pottery)','Admin (office)'])test('generic level1 choice rejects '+name,()=>{
 const s=fixture();assert.throws(()=>a.apply(s,{type:'choose-skill',payload:{name}},[]),/skill|specialisation/i);assert.deepEqual(s.character.skills,{});
});
test('generic skill choice cannot acquire an untested psionic talent',()=>{
 const s=fixture();assert.throws(()=>a.apply(s,{type:'choose-skill',payload:{name:'Telepathy'}},[]),/available|talent/i);assert.equal(s.character.skills.Telepathy,undefined);
});
test('a learned psionic talent may be improved, without acquiring another',()=>{
 const s=fixture();s.character.stats.PSI=8;s.character.skills.Telepathy=0;a.apply(s,{type:'choose-skill',payload:{name:'Telepathy'}},[]);assert.equal(s.character.skills.Telepathy,1);
});
test('named level0 specialities are normalized to the base skill',()=>{
 const s=fixture(0);a.apply(s,{type:'choose-skill',payload:{name:'Pilot (spacecraft)'}},[]);assert.deepEqual(s.character.skills,{Pilot:0});
});
test('canonical and explicit source aliases resolve without arbitrary finite specialities',()=>{
 assert.equal(normalizeSkillName('Drive (tracked)',{requireSpeciality:true}).name,'Drive (track)');
 assert.equal(normalizeSkillName('Engineer (power plant)').name,'Engineer (power)');
 assert.equal(normalizeSkillName('Science (geology)').name,'Science (geology)');
 assert.equal(normalizeSkillName('Language (Gvegh)').name,'Language (Gvegh)');
 assert.equal(normalizeSkillName('Art (dance)').name,'Art (dance)');
});
test('source-confirmed talent acquisition still requires tested potential',()=>{
 const s=fixture();assert.throws(()=>a.gainSkill(s,'Telepathy',0,'set',true),/testing|acquisition/);
 s.character.stats.PSI=8;a.gainSkill(s,'Telepathy',0,'set',true);assert.equal(s.character.skills.Telepathy,0);
});
