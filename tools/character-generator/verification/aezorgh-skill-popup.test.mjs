import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {backgroundSkillsView,backgroundSelection} from '../gui/background-skills.mjs';
import {catalog} from '../engine/session.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function fixture(species='aezorgh',revision){let s=createSession('species-skill-popup');if(revision)s.rulesRevision=revision;for(const type of ['setup','roll-statistics','accept-statistics'])s=execute(s,{type,payload:type==='setup'?{species}: {}}).session;return s;}
test('new Aezorgh choose exactly one eligible base skill and replay it unchanged',()=>{
 const session=fixture(),state=project(session).state;
 assert.equal(state.backgroundRemaining,1);assert.ok(state.backgroundOptions.includes('Pilot'));assert.equal(state.backgroundOptions.length,34);
 for(const name of ['Athletics','Mechanic','Recon','Stealth','Independence','Tolerance','Rites','Jack-of-all-Trades','Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy']){assert.ok(!state.backgroundOptions.includes(name),name);assert.throws(()=>execute(session,{type:'background',payload:{skills:[name]}}));}
 for(const skills of [[],['Pilot','Admin'],['Pilot','Pilot'],['Pilot (small craft)']])assert.throws(()=>execute(session,{type:'background',payload:{skills}}));
 const result=execute(session,{type:'background',payload:{skills:['Pilot']}});assert.equal(result.state.character.skills.Pilot,0);assert.equal(result.state.stage,'precareer');assert.equal(Object.keys(result.state.character.skills).length,5);assert.deepEqual(project(importSession(exportSession(result.session))),project(result.session));
});
test('all compatible historical Aezorgh keep their original option list and revision',()=>{
 for(let n=16;n<=24;n++){const revision='character-preview-2026-11-09.'+n,session=fixture('aezorgh',revision);assert.ok(!project(session).state.backgroundOptions.includes('Pilot'));const result=execute(session,{type:'background',payload:{skills:['Admin']}});assert.equal(result.session.rulesRevision,revision);assert.deepEqual(project(importSession(exportSession(result.session))),project(result.session));}
});
test('only Aezorgh renders searchable single-choice dialog; existing species retain standard grid',()=>{
 for(const species of ['human','vargr','aslan','aezorgh']){const state=project(fixture(species)).state;const html=backgroundSkillsView(state,[],catalog(),{esc});assert.equal(html.includes('<dialog'),species==='aezorgh');if(species==='aezorgh'){assert.match(html,/type="search"/);assert.match(html,/type="radio"/);assert.doesNotMatch(html,/type="checkbox"/);assert.match(html,/>Confirm</);assert.equal(backgroundSelection(state,['Pilot']).valid,true);}}
});
