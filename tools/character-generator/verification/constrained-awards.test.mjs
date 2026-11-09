import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {createServer} from '../server.mjs';
import {awardFixture,coreGenericFixture,run,force} from './constrained-award-fixtures.mjs';
import {rejected} from './core-life-event-fixtures.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const audit={apply,queueEffects};';const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const choose=(s,name)=>a.apply(s,{type:'choose-skill',payload:{name}},[]);
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);

test('Truther new specialty enforces exact possession including level zero and valid specialty grammar',()=>{
 const r=awardFixture();for(const name of ['Admin','Medic','Science','Electronics','Electronics (imaginary)','Telepathy'])rejected(r,'choose-skill',{name});
 const s=structuredClone(r.state);s.character.skills={'Science (physics)':0,'Electronics (comms)':2,Science:0};
 for(const name of ['Science (physics)','Electronics (comms)'])assert.throws(()=>choose(structuredClone(s),name),/not available/);
 choose(s,'Science (chemistry)');assert.equal(s.character.skills['Science (chemistry)'],1);assert.equal(s.character.skills['Science (physics)'],0);
 const next=run(r,'choose-skill',{name:'Electronics (computers)'});assert.equal(next.state.character.skills['Electronics (computers)'],1);assert.deepEqual(next.log.at(-1).rolls,[]);roundtrip(next);
});
test('Truther two levels apply to one selected specialty or Medic, respect level 4 and total caps',()=>{
 const r=awardFixture('companion.truther',9);for(const name of ['Science (physics)','Electronics (sensors)','Medic'])for(const level of [undefined,0,1,3,4]){
  const s=structuredClone(r.state);s.character.skills={};if(level!==undefined)s.character.skills[name]=level;choose(s,name);assert.equal(s.character.skills[name],Math.min(4,(level??0)+2));assert.ok(s.character.relationships.some(x=>x.role==='Enemy'));
 }
 const s=structuredClone(r.state);s.character.stats.INT=0;s.character.stats.EDU=1;s.character.skills={Admin:2};choose(s,'Medic');assert.equal(s.stage,'book-step');assert.equal(s.character.skills.Medic,undefined);assert.equal(s.pending.effect.mode,'increase');assert.equal(s.character.relationships.length,0);
 s.character.skills={'Medic':2,Admin:1};a.apply(s,{type:'retry-skill-choice',payload:{}},[]);choose(s,'Medic');assert.equal(s.stage,'book-step','Retry cannot turn +2 into a set-level award');
 rejected(r,'choose-skill',{name:'Admin'});roundtrip(run(r,'choose-skill',{name:'Science (physics)'}));
});
test('all public choices survive source retry and pending replay, are atomic and idempotent, and reject forged commands',()=>{
 for(const [career,event,name]of[['companion.truther',5,'Science (chemistry)'],['companion.truther',9,'Medic'],['vargr.psion',6,'Medic'],['vargr.psion',8,'Teleportation']]){
  let r=awardFixture(career,event);roundtrip(r);const before=r.state.pendingChoice;r=run(r,'skill-award-source');r=run(r,'retry-skill-choice');assert.deepEqual(r.state.pendingChoice,before);
  const pending=r;r=run(r,'choose-skill',{name},{id:'award-once'});assert.deepEqual(run(r,'choose-skill',{name},{id:'award-once'}).session,r.session);rejected(r,'choose-skill',{name});roundtrip(r);
  const forged=JSON.parse(exportSession(r.session));forged.events.findLast(e=>e.command.type==='choose-skill').command.payload.name='Technopathy';assert.equal(api({operation:'import',raw:JSON.stringify(forged)}).ok,false);
  const restored=run(r,'restore',{revision:pending.revision});assert.deepEqual(restored.state.pendingChoice,before);roundtrip(restored);
 }
});
test('Vargr non-psionic training excludes talents and psionicology, with normal caps',()=>{
 const r=awardFixture('vargr.psion',6);for(const name of ['Telepathy','Teleportation','Technopathy','Science (psionicology)','Science (Psionicology)'])rejected(r,'choose-skill',{name});
 for(const name of ['Science (physics)','Electronics (sensors)','Medic']){const next=run(r,'choose-skill',{name});assert.equal(next.state.character.skills[name],1);assert.deepEqual(next.log.at(-1).rolls,[]);}
 const s=structuredClone(r.state);s.character.stats.INT=0;s.character.stats.EDU=0;choose(s,'Medic');assert.equal(s.stage,'book-step');assert.equal(s.character.skills.Medic,undefined);
});
test('Vargr additional training awards a new talent at zero after PSI check, without another check or lost history',()=>{
 const r=awardFixture('vargr.psion',8),history=r.state.character.psionics;for(const name of ['Telepathy','Technopathy','Medic'])rejected(r,'choose-skill',{name});
 const next=run(r,'choose-skill',{name:'Teleportation'});assert.equal(next.state.character.skills.Teleportation,0);assert.deepEqual(next.log.at(-1).rolls,[]);assert.equal(next.state.character.psionics.checksAttempted,history.checksAttempted);assert.deepEqual(next.state.character.psionics.attempts,history.attempts);assert.equal(next.state.character.psionics.historyKnown,history.historyKnown);assert.equal(next.state.character.psionics.firstTalentChosen,true);assert.equal(next.state.character.psionics.rulings.at(-1).acquisitionCheck,false);
 for(const kind of ['all-known','permanent-loss','no-potential']){const s=structuredClone(r.state);const effect=s.pendingChoice;s.pendingChoice=null;if(kind==='all-known')for(const n of ['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation'])s.character.skills[n]=0;else if(kind==='permanent-loss')s.character.psionicLoss={permanent:true};else s.character.stats.PSI=0;a.queueEffects(s,[effect,{kind:'cash',value:17}],'advancement',[]);assert.equal(s.stage,'book-step');assert.equal(s.character.cash,0);}
 const unknown=structuredClone(r.state);delete unknown.character.psionics;choose(unknown,'Teleportation');assert.equal(unknown.character.psionics.historyKnown,false);assert.equal(unknown.character.psionics.checksAttempted,0);assert.equal(unknown.character.psionics.firstTalentChosen,true);
});
test('Core service Any Talent improves known talent or uses history-aware single retry for unknown talent',()=>{
 const r=coreGenericFixture();rejected(r,'choose-skill',{name:'Technopathy'});rejected(r,'choose-skill',{name:'Medic'});roundtrip(r);
 const known=run(r,'choose-skill',{name:'Telepathy'});assert.equal(known.state.character.skills.Telepathy,1);assert.deepEqual(known.log.at(-1).rolls,[]);
 let unknown=run(r,'choose-skill',{name:'Teleportation'});assert.equal(unknown.state.stage,'psionic-training');assert.equal(unknown.state.psionicTraining.mode,'retry');roundtrip(unknown);
 const before=unknown.state.character.psionics.checksAttempted;unknown=force(unknown,'learn-talent',{talent:'Teleportation'},[6,6]);assert.equal(unknown.state.character.skills.Teleportation,0);assert.equal(unknown.state.character.psionics.checksAttempted,before+1);assert.equal(unknown.state.stage,'survival');roundtrip(unknown);
 const failed=force(run(r,'choose-skill',{name:'Teleportation'}),'learn-talent',{talent:'Teleportation'},[1,1]);assert.equal(failed.state.character.skills.Teleportation,undefined);assert.equal(failed.state.stage,'survival');assert.equal(failed.log.at(-1).rolls.length,1);
 const s=structuredClone(r.state);s.character.psionics.historyKnown=false;choose(s,'Teleportation');assert.equal(s.pending.kind,'psionic-history');
 const lost=structuredClone(r.state);lost.character.psionicLoss={permanent:true};assert.throws(()=>choose(lost,'Telepathy'),/not available/);
});
test('HTTP release API enforces each constrained award, including Core new talent routing',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const [r,name]of[[awardFixture(),'Science (physics)'],[awardFixture('companion.truther',9),'Medic'],[awardFixture('vargr.psion',6),'Medic'],[awardFixture('vargr.psion',8),'Teleportation'],[coreGenericFixture(),'Teleportation']]){
  const call=async name=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'command',session:r.session,command:{type:'choose-skill',payload:{name}}})})).json();assert.equal((await call('Technopathy')).ok,false);assert.equal((await call(name)).ok,true);
 }}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('Vargr failed additional training retains its Science award and successful grant preserves later Core retry penalty',async()=>{
 const {EXPANSION_PACK}=await import('../engine/expansion-pack.mjs');const r=awardFixture('vargr.psion',8),s=structuredClone(r.state);s.pendingChoice=null;s._override={index:0,values:[1,1]};const rolls=[];a.queueEffects(s,EXPANSION_PACK['vargr.psion'].events[8],'advancement',rolls);delete s._override;assert.equal(s.character.skills['Science (psionicology)'],1);assert.equal(s.character.skills.Teleportation,undefined);assert.equal(rolls.length,1);
 const granted=run(r,'choose-skill',{name:'Teleportation'}),core=structuredClone(coreGenericFixture().state);core.character.psionics=structuredClone(granted.state.character.psionics);core.character.skills=structuredClone(granted.state.character.skills);choose(core,'Telekinesis');assert.equal(core.psionicTraining.mode,'retry');const previous=core.character.psionics.checksAttempted;core._override={index:0,values:[6,6]};a.apply(core,{type:'learn-talent',payload:{talent:'Telekinesis'}},[]);delete core._override;assert.equal(core.character.psionics.attempts.at(-1).previousChecks,previous);assert.equal(core.character.psionics.checksAttempted,previous+1);
});
test('Core generic row supports first acquisition and cap fallback without relaxing rank awards',()=>{
 const r=coreGenericFixture(),s=structuredClone(r.state);s.character.skills={};s.character.psionics={historyKnown:true,checksAttempted:0,firstTalentChosen:false,attempts:[],tests:[],training:[],rulings:[],importedAttempted:[]};const effect=s.pendingChoice;s.pendingChoice=null;a.queueEffects(s,[effect],'survival',[]);assert.equal(s.stage,'skill-choice');choose(s,'Telepathy');assert.equal(s.stage,'psionic-training');const rolls=[];a.apply(s,{type:'learn-talent',payload:{talent:'Telepathy'}},rolls);assert.equal(s.character.skills.Telepathy,0);assert.deepEqual(rolls,[]);
 const cap=structuredClone(r.state);cap.character.stats.INT=0;cap.character.stats.EDU=0;choose(cap,'Telepathy');assert.equal(cap.stage,'book-step');assert.equal(cap.pending.effect.untrained,'acquisition-check');
 const rank=structuredClone(s);rank.character.skills={};a.queueEffects(rank,[{kind:'skill-choice',scope:'psionic-talents',mode:'set',value:1}],'survival',[]);assert.equal(rank.stage,'book-step');assert.match(rank.pending.label,/already acquired/);
});
test('Vargr non-psionic award rejects psionic aliases case-insensitively instead of accepting arbitrary Science subjects',()=>{
 const r=awardFixture('vargr.psion',6);
 for(const subject of ['psionicology','PSIONICS','Telepathy','telekinetic research','clairvoyance','Teleportation','Technopathy','extrasensory perception','precognition','psychokinesis','mind reading','remote viewing']){
  const name='Science ('+subject+')';rejected(r,'choose-skill',{name});const s=structuredClone(r.state),before=structuredClone(s);assert.throws(()=>choose(s,name),/not available/);assert.deepEqual(s,before);
 }
 for(const subject of ['physics','PHYSICS','chemistry','Biology','xenology','psychology']){const next=run(r,'choose-skill',{name:'Science ('+subject+')'});assert.equal(next.state.character.skills['Science ('+subject.toLowerCase()+')'],1);assert.equal(next.session.events.at(-1).command.payload.name,'Science ('+subject+')');assert.equal(Object.keys(next.state.character.skills).filter(n=>n.toLowerCase()==='science ('+subject.toLowerCase()+')').length,1);}
});
test('unclassified Vargr Science subjects pause without awards and retain source eligibility constraint through retry and replay',()=>{
 const r=awardFixture('vargr.psion',6),name='Science (unclassified field)',before=r.state.character.skills;
 const paused=run(r,'choose-skill',{name});assert.equal(paused.state.stage,'book-step');assert.equal(paused.state.pending.source,'aliens');assert.equal(paused.state.pending.page,201);assert.equal(paused.state.pending.effect.requestedName,name);assert.deepEqual(paused.state.character.skills,before);assert.deepEqual(paused.log.at(-1).rolls,[]);roundtrip(paused);
 const s=structuredClone(r.state);choose(s,name);assert.deepEqual(s.character.skills,before);assert.equal(s.pending.effect.scope,'non-psionic');
 let retry=run(paused,'retry-skill-choice');rejected(retry,'choose-skill',{name:'Science (Psionics)'});retry=run(retry,'choose-skill',{name:'Science (different unclassified field)'});assert.equal(retry.state.stage,'book-step');assert.deepEqual(retry.state.character.skills,before);
 const good=run(run(retry,'retry-skill-choice'),'choose-skill',{name:'Science (physics)'});assert.equal(good.state.character.skills['Science (physics)'],1);roundtrip(good);
 rejected(paused,'resolve-book',{confirmed:false,note:'Unconfirmed eligibility',effects:[{kind:'skill',name,value:1}]});
 const resolved=run(paused,'resolve-book',{confirmed:true,note:'Referee checked this field is non-psionic for this source event',effects:[{kind:'skill',name,value:1}]});assert.equal(resolved.state.character.skills[name],1);roundtrip(resolved);
});
