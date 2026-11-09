import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const draftAudit={initial,apply,skillNameAllowed,fallbackOptions};';
const {draftAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){const s=a.initial('draft');s.stage='failed-entry';s.failedQualification=true;s.character.species='zhodani';s.character.culture='native';s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:10,PSI:9};return s;}
function cmd(s,type,payload={},values){const rolls=[];if(values)s._override={index:0,values};const summary=a.apply(s,{type,payload},rolls);delete s._override;return {rolls,summary};}
for(const die of [1,2,3,4,5,6])test('Consular draft die '+die+' preserves exact destination and assignment rights',()=>{
 const s=fixture(),r=cmd(s,'fallback',{},[die]),id=die<=3?'zhodani.army':die<=5?'zhodani.merchant':'zhodani.navy';
 assert.equal(r.rolls.length,1);assert.equal(s.draftUsed,true);assert.equal(s.failedQualification,false);assert.equal(s.character.consularDrafts[0].careerId,id);
 if(id==='zhodani.merchant'){assert.equal(s.character.careers[0].assignment,'corporate');assert.equal(s.character.careers[0].drafted,true);}
 else {assert.equal(s.stage,'career');assert.equal(s.forcedCareer,id);assert.equal(s.forcedCareerDraft,true);assert.throws(()=>cmd(s,'finish'),/required|between/);assert.throws(()=>cmd(s,'career',{id:'zhodani.scholar',assignment:'lab'}),/requires|available/);
  const entry=cmd(s,'career',{id,assignment:id==='zhodani.army'?'support':'technical'});assert.equal(entry.rolls.some(x=>/Qualification/.test(x.label)),false);assert.equal(s.character.careers[0].drafted,true);assert.equal(s.forcedCareer,null);
 }
});
test('second Consular draft stops at explicit source conflict without another random roll',()=>{const s=fixture();s.draftUsed=true;const r=cmd(s,'fallback');assert.equal(r.rolls.length,0);assert.equal(s.stage,'book-step');assert.equal(s.pending.kind,'draft');assert.match(s.pending.label??s.pending.description??JSON.stringify(s.pending),/once-only/);assert.equal(s.character.careers.length,0);});
test('open Zhodani skill awards enforce rare skills without erasing printed exceptions',()=>{
 const s=fixture();for(const scope of ['any','existing'])for(const name of ['Gambler','Deception','Streetwise'])assert.equal(a.skillNameAllowed(s,name,{scope}),false);
 s.character.careers=[{id:'zhodani.agent',assignment:'tozjabr'}];s.active=0;assert.equal(a.skillNameAllowed(s,'Deception',{scope:'any'}),true);assert.equal(a.skillNameAllowed(s,'Streetwise',{scope:'any'}),true);assert.equal(a.skillNameAllowed(s,'Gambler',{scope:'any'}),false);
 s.character.careers[0].assignment='informant';assert.equal(a.skillNameAllowed(s,'Streetwise',{scope:'any'}),false);assert.equal(a.skillNameAllowed(s,'Streetwise',{scope:'any',allowed:['Streetwise']}),true);assert.equal(a.skillNameAllowed(s,'Streetwise',{kind:'skill-reduction-choice'}),true);
 s.character.species='human';assert.equal(a.skillNameAllowed(s,'Gambler',{scope:'any'}),true);
});

test('public draft assignment interruption survives save, replay and idempotent retry',()=>{
 const run=(r,type,payload={},options={})=>{const n=api({operation:'command',session:r.session,command:{type,payload},...options});assert.equal(n.ok,true,n.error?.message);return n;};
 let r=api({operation:'create',seed:'public-consular-1'});r=run(r,'setup',{species:'zhodani'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 if(r.state.stage==='psionic-training')r=run(r,'finish-psionic-training');
 if(r.state.stage==='background')r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 r=run(r,'skip-precareer');r=run(r,'career',{id:'zhodani.government',assignment:'administration'});assert.equal(r.state.stage,'failed-entry');
 r=run(r,'fallback',{}, {id:'native-draft-once'});assert.equal(r.state.stage,'career');assert.equal(r.state.character.consularDrafts[0].careerId,'zhodani.army');
 const raw=exportSession(r.session),loaded=api({operation:'import',raw});assert.equal(loaded.ok,true);assert.deepEqual(loaded.state,r.state);assert.equal(exportSession(loaded.session),raw);
 const retry=run(loaded,'fallback',{}, {id:'native-draft-once'});assert.equal(retry.state.character.consularDrafts.length,1);assert.deepEqual(retry.state,loaded.state);
 r=run(loaded,'career',{id:'zhodani.army',assignment:'infantry'});assert.equal(r.state.character.careers[0].drafted,true);assert.equal(r.log.at(-1).rolls.some(x=>/Qualification/.test(x.label)),false);assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).state,r.state);
});

test('Zhodani connections cannot bypass rare skills and retain source-trained Tozjabr access',()=>{
 const s=fixture();s.stage='career';for(const skill of ['Gambler','Deception','Streetwise'])assert.throws(()=>cmd(s,'connection',{person:'Traveller',skill}),/rare skill/);assert.equal(s.connections.length,0);
 s.character.careers=[{id:'zhodani.agent',assignment:'tozjabr'}];s.active=null;cmd(s,'connection',{person:'First Traveller',skill:'Deception'});cmd(s,'connection',{person:'Second Traveller',skill:'Streetwise'});assert.equal(s.character.skills.Deception,1);assert.equal(s.character.skills.Streetwise,1);
});
