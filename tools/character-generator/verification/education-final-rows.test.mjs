import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {educationReady,educationSetup} from './education-result-fixtures.mjs';
import {buildAslanOriginFixture,settleOrigin} from './aslan-origin-fixtures.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\.?\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const finalRowAudit={apply,queueEffects};';
const {createSession,execute,project,exportSession,importSession,finalRowAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const force=(r,type,payload,values)=>{const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values,reason:'Synthetic final education rows'});};
const ack=r=>{const next=run(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});assert.deepEqual(next.state.character,r.state.character);assert.equal(next.state.rng,r.state.rng);assert.deepEqual(next.state.pending,r.state.pending);return next;};
function aslan(gender='male',culture='native'){
 let r;if(culture==='native')r=buildAslanOriginFixture({gender,stage:'precareer'});
 else {r=run(createSession('hobby-'+gender+'-'+culture),'setup',{species:'aslan',gender,culture});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');r=run(r,'accept-statistics');if(r.state.pending?.kind==='species-setup')r=force(r,'resolve-book',{confirmed:true,note:'Synthetic Imperial Aslan upbringing resolved from source',birthOrder:gender==='male'?'first-son':'daughter',effects:[]},[2,3]);r=settleOrigin(r,{until:'precareer'});}
 assert.equal(r.state.stage,'precareer',gender+' '+culture+' '+JSON.stringify(r.state.pendingChoice));r=force(r,'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});return r;
}
const hobby=r=>force(r,'education-event',{},[4,5]);
test('row3 completes without graduation roll and acknowledges exact ordinary/ageing destinations',()=>{
 for(const age of [18,34]){let r=educationReady();if(age===34)r=run(r,'gm-override',{field:'age',value:age,reason:'Synthetic ageing boundary'});r=force(r,'education-event',{},[1,2]);assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.character.educations[0].graduation.attempted,false);assert.equal(r.state.character.age,age+4);assert.equal(r.state.character.terms,1);assert.deepEqual(r.educationEventView.childRolls,[]);assert.equal(r.educationResultView,undefined);assert.equal(ack(r).state.stage,age===18?'career':'book-step');assert.equal(exportSession(importSession(exportSession(r.session))),exportSession(r.session));}
});
test('ordinary human hobby remains explicit selection with no acquisition roll',()=>{
 let r=hobby(educationReady());assert.equal(r.state.stage,'education-skill');assert.ok(r.educationEventView.pendingChoice);assert.equal(r.state.character.skills.Engineer,undefined);const rng=r.state.rng;r=run(r,'education-skill',{name:'Engineer'});assert.equal(r.state.character.skills.Engineer,0);assert.equal(r.state.rng,rng);assert.deepEqual(r.educationEventView.childRolls,[]);assert.equal(ack(r).state.stage,'education-graduation');
});
test('male native and Imperial Aslan hobby acquisition has its own exact 2D checkpoint',()=>{
 for(const culture of ['native','imperial'])for(const values of [[1,1],[6,6]]){
  let r=aslan('male',culture);r=run(r,'gm-override',{field:'stat.SOC',value:7,reason:'Synthetic acquisition boundary'});r=hobby(r);const rng=r.state.rng,before=r.state.character.skills.Independence;r=run(r,'education-skill',{name:'Independence'});assert.equal(r.state.stage,'education-event-roll');assert.equal(r.state.rng,rng);assert.equal(r.state.character.skills.Independence,before);assert.equal(r.state.character.educations[0].selections.hobby,'Independence');const p=r.educationEventView.roll;assert.equal(p.dice,'2D');assert.equal(p.target,8);assert.equal(p.modifier,0);assert.equal(p.comparisonScore,7);assert.deepEqual(p.source,{id:'aliens',page:20});
  r=force(r,'roll-education-event-step',{pendingId:p.id},values);assert.equal(r.state.stage,'education-event-result');assert.deepEqual(r.educationEventView.childRolls[0].kept,values);assert.deepEqual(r.educationEventView.childRolls[0].source,{id:'aliens',page:20});assert.equal(r.state.character.skills.Independence,values[0]===6?Math.max(before??-1,0):before);assert.equal(ack(r).state.stage,'education-graduation');
 }
});
test('female Aslan and non-Aslan cannot select Independence; other hobby choices remain available',()=>{
 for(const ready of [aslan('female'),aslan('female','imperial'),educationReady()]){let r=hobby(ready);assert.equal(r.state.educationOptions.some(x=>x.name==='Independence'),false);const raw=exportSession(r.session);assert.throws(()=>run(r,'education-skill',{name:'Independence'}),/listed education|allowed/);assert.equal(exportSession(r.session),raw);r=run(r,'education-skill',{name:'Engineer'});assert.equal(ack(r).state.stage,'education-graduation');}
});
test('species-source University entry remains source-assisted, not assigned a synthetic event checkpoint',()=>{
 for(const species of ['vargr','aezorgh']){let r=educationSetup('source-final-'+species,species);r=run(r,'precareer',{id:'core.university'});assert.equal(r.state.stage,'book-step');assert.equal(r.educationEventView,undefined);assert.equal(r.state.educationEventContext,undefined);}
});
test('hobby level0 remains legal above a lowered cap; forbidden talents and JaT stay excluded',()=>{
 let r=educationReady();for(const stat of ['INT','EDU'])r=run(r,'gm-override',{field:'stat.'+stat,value:0,reason:'Synthetic lowered cap'});r=hobby(r);assert.equal(r.state.educationOptions.some(x=>['Jack-of-all-Trades','Telepathy'].includes(x.name)),false);const rng=r.state.rng;r=run(r,'education-skill',{name:'Engineer'});assert.equal(r.state.character.skills.Engineer,0);assert.equal(r.state.rng,rng);assert.equal(ack(r).state.stage,'education-graduation');
});
test('Independence uses raw2D strictly greater than SOC, not a characteristic DM',()=>{
 for(const values of [[3,4],[4,4]]){let r=aslan('male','imperial');r=run(r,'gm-override',{field:'stat.SOC',value:7,reason:'Synthetic exact threshold'});r=hobby(r);r=run(r,'education-skill',{name:'Independence'});const id=r.state.pendingEducationEventRoll.id;r=force(r,'roll-education-event-step',{pendingId:id},values);assert.equal(r.state.character.skills.Independence,values[0]===4?0:undefined);assert.equal(r.educationEventView.childRolls[0].total,values[0]+values[1]);assert.deepEqual(r.educationEventView.childRolls[0].check,{modifier:0,target:8,comparison:'greater-than',comparisonStat:'SOC',comparisonScore:7,total:values[0]+values[1],success:values[0]===4});}
});
// Synthetic rule-state tests cover rare lost-PSI branches without inventing a
// public command that creates/removes permanent loss or editing a saved session.
function lostState(recorded=true){const s=structuredClone(educationReady().state);s.character.psionicLoss={permanent:true,cause:'ageing',psi:0};if(recorded)s.character.stats.PSI=0;return s;}
function applyState(s,type,payload={},values){if(values)s._override={index:0,values};const rolls=[];a.apply(s,{type,payload},rolls);delete s._override;return rolls;}
test('lost PSI does not suppress ordinary checkpoints or alter row2 recorded-potential semantics',()=>{
 for(const index of [0,1]){const current=lostState(),legacy=structuredClone(current);delete legacy.educationEventCheckpoints;applyState(current,'education-event',{},[1,1]);applyState(legacy,'education-event',{},[1,1]);const rng=current.rng;assert.ok(current.educationEventContext);assert.equal(applyState(current,'choose-effect',{index}).length,0);applyState(legacy,'choose-effect',{index});assert.equal(current.stage,'education-event-result');applyState(current,'acknowledge-education-event',{pendingId:current.educationEventResult.id});assert.deepEqual(current.character,legacy.character);assert.equal(current.rng,rng);assert.equal(current.rng,legacy.rng);assert.equal(current.character.stats.PSI,0);}
 const absent=lostState(false);applyState(absent,'education-event',{},[1,1]);const original=structuredClone(absent);assert.throws(()=>applyState(structuredClone(absent),'choose-effect',{index:0}),/cannot be retested/);assert.deepEqual(absent,original);assert.equal(applyState(absent,'choose-effect',{index:1}).length,0);
 const s=lostState();assert.equal(applyState(s,'education-event',{},[3,4]).length,1);assert.equal(s.stage,'education-event-roll');assert.equal(applyState(s,'roll-education-event-step',{pendingId:s.pendingEducationEventRoll.id},[2,3]).length,1);assert.equal(s.stage,'education-event-result');assert.equal(s.character.stats.PSI,0);
});
test('lost PSI institute test remains blocked, with decline retaining potential and no extra dice',()=>{
 const s=lostState();applyState(s,'education-event',{},[3,4]);applyState(s,'roll-education-event-step',{pendingId:s.pendingEducationEventRoll.id},[6,6]);applyState(s,'roll-education-event-step',{pendingId:s.pendingEducationEventRoll.id},[1]);assert.equal(s.pending.decision,'psionics');const original=structuredClone(s);
 assert.throws(()=>applyState(structuredClone(s),'resolve-life-event',{confirmed:true,reason:'Synthetic blocked test',outcome:'test',funding:'provided',cost:0,timingConfirmed:true}),/Permanent psionic loss/);assert.deepEqual(s,original);const rng=s.rng;assert.equal(applyState(s,'resolve-life-event',{confirmed:true,reason:'Synthetic decline',outcome:'decline'}).length,0);assert.equal(s.rng,rng);assert.equal(s.character.stats.PSI,0);assert.equal(s.stage,'education-event-result');
});
test('new hobby split preserves legacy mechanical state and RNG including existing Independence',()=>{
 for(const existing of [false,true]){const ready=aslan('male','imperial'),current=structuredClone(ready.state);if(existing)current.character.skills.Independence=1;const legacy=structuredClone(current);delete legacy.educationEventCheckpoints;applyState(current,'education-event',{},[4,5]);applyState(legacy,'education-event',{},[4,5]);applyState(current,'education-skill',{name:'Independence'});applyState(legacy,'education-skill',{name:'Independence'});applyState(current,'roll-education-event-step',{pendingId:current.pendingEducationEventRoll.id});applyState(current,'acknowledge-education-event',{pendingId:current.educationEventResult.id});assert.deepEqual(current.character,legacy.character);assert.equal(current.rng,legacy.rng);assert.equal(current.stage,legacy.stage);}
});
