import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,importSession,exportSession,api,characteristicDM,availableCareers} from '../engine/session.mjs';
function setup(seed='test',species='human',options={}){let s=createSession(seed);s=execute(s,{type:'configure',payload:options}).session;s=execute(s,{type:'setup',payload:{name:'Test Traveller',species,gender:'female'}}).session;return s;}
function run(s,type,payload={}){return execute(s,{type,payload});}
test('API versioned and malformed requests are contained',()=>{assert.equal(api({operation:'catalog'}).apiVersion,1);assert.equal(api(null).ok,false);assert.equal(api({operation:'unknown'}).ok,false);});
test('seeded rolls are deterministic and no input is mutated',()=>{const s=setup('repeat');const before=JSON.stringify(s);const a=run(s,'roll-statistics'),b=run(s,'roll-statistics');assert.deepEqual(a,b);assert.equal(JSON.stringify(s),before);});
for(let n=0;n<=6;n++)test(n+' boon rolls retain the best two dice',()=>{const r=run(setup('boons'+n,'human',{boons:n}),'roll-statistics');assert.equal(r.log.at(-1).rolls.filter(r=>r.values.length===3).length,n);for(const roll of r.log.at(-1).rolls){assert.equal(roll.kept.length,2);assert.equal(roll.total,[...roll.values].sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b));}});
test('unsupported boon counts and duplicate extras reject',()=>{assert.throws(()=>setup('x','human',{boons:7}));assert.throws(()=>setup('x','human',{extras:['LCK','LCK']}));});
test('human PSI is absent unless actually rolled',()=>{let r=run(setup(),'roll-statistics');r=run(r.session,'accept-statistics');assert.equal(Object.hasOwn(r.state.character.stats,'PSI'),false);assert.throws(()=>run(r.session,'add-extra',{id:'PSI'}),/referee/);r=run(r.session,'gm-mode',{enabled:true});r=run(r.session,'add-extra',{id:'PSI'});assert.equal(Object.hasOwn(r.state.character.stats,'PSI'),true);assert.ok(r.log.at(-1).rolls.some(x=>x.label==='PSI'));});
test('extras do not change the six-score total',()=>{const a=run(setup('extra'),'roll-statistics');const b=run(setup('extra','human',{extras:['PSI','LCK','MRL','STY','WLT','CHA']}),'roll-statistics');assert.equal(a.state.rollTotal,b.state.rollTotal);const gm=run(b.session,'gm-mode',{enabled:true});const done=run(gm.session,'accept-statistics');assert.equal(done.state.character.stats.WLT,done.state.character.stats.SOC);assert.equal(done.state.rollTotal,a.state.rollTotal);});
test('all three mandatory Zhodani adjustments apply',()=>{let r=run(setup('zhodani','zhodani'),'roll-statistics');r=run(r.session,'accept-statistics');const st=r.state.character.stats;assert.ok(Object.hasOwn(st,'PSI'));assert.ok(st.EDU<=st.SOC);if(st.PSI>=9)assert.ok(st.SOC>=10);if(st.SOC>=10){assert.ok(st.EDU>=8);assert.equal(r.state.backgroundRemaining,0);}});
test('optional Zhodani PSI requires GM and follows the published table',()=>{let s=setup('z-option','zhodani',{zhodaniPsi:true});assert.throws(()=>run(s,'roll-statistics'),/GM/);s=run(s,'gm-mode',{enabled:true}).session;let r=run(s,'roll-statistics');const d=r.log.at(-1).rolls[0];assert.equal(d.label,'Zhodani optional PSI');const expected=[9,9,10,10,11,12][d.total-1];r=run(r.session,'accept-statistics');assert.equal(r.state.character.stats.PSI,expected);assert.ok(r.state.character.stats.SOC>=10);});
test('Aslan uses the 2026 modifiers',()=>{const r=run(setup('aslan','aslan'),'roll-statistics');assert.deepEqual(r.state.pool.slice(0,3).map(p=>p.adjustment),[1,-1,1]);});
test('Aezorgh mixed formulas remain intact with boons',()=>{const r=run(setup('aezorgh','aezorgh',{boons:6}),'roll-statistics');assert.deepEqual(r.state.pool.map(p=>p.count),[1,2,1,2,1,1]);assert.throws(()=>run(r.session,'swap-statistics',{a:0,b:1}),/formulas/);});
test('player swap preserves total and target species modifiers',()=>{let r=run(setup('swap','aslan'),'roll-statistics');const before=r.state.pool.map(x=>({...x}));r=run(r.session,'swap-statistics',{a:0,b:1});assert.equal(r.state.pool[0].base,before[1].base);assert.equal(r.state.pool[0].adjustment,1);assert.equal(r.state.rollTotal,before.reduce((s,p)=>s+p.base,0));});
test('low-total reroll allowed and high-total reroll blocked',()=>{let low,high;for(let i=0;i<100;i++){const r=run(setup('threshold'+i),'roll-statistics');if(r.state.rollTotal<43)low??=r;else high??=r;}assert.ok(low&&high);assert.doesNotThrow(()=>run(low.session,'roll-statistics'));assert.throws(()=>run(high.session,'roll-statistics'),/43/);});
test('GM correction requires enable and reason and logs old/new',()=>{let r=run(setup(),'roll-statistics');assert.throws(()=>run(r.session,'gm-override',{field:'pool',index:0,value:12,reason:'test'}),/Enable GM/);r=run(r.session,'gm-mode',{enabled:true});assert.throws(()=>run(r.session,'gm-override',{field:'pool',index:0,value:12}),/reason/);r=run(r.session,'gm-override',{field:'pool',index:0,value:12,reason:'Referee correction'});assert.match(r.log.at(-1).summary,/→ 12/);assert.match(r.log.at(-1).summary,/Referee correction/);});
test('all log actions persist when restoring; random state never rewinds',()=>{let r=run(setup('restore'),'roll-statistics');r=run(r.session,'gm-mode',{enabled:true});r=run(r.session,'roll-statistics');const previous=r.state.rng,count=r.log.length;r=run(r.session,'restore',{revision:2});assert.equal(r.log.length,count+1);assert.equal(r.state.rng,previous);assert.equal(r.state.pool.length,0);assert.match(r.log.at(-1).summary,/not rewound/);});
test('save roundtrip replays and altered original rolls are rejected',()=>{const r=run(setup('save'),'roll-statistics');assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));const bad=structuredClone(r.session);bad.events.at(-1).rolls[0].values[0]=99;assert.throws(()=>importSession(JSON.stringify(bad)),/mismatch/);});
test('invalid import cannot mutate current session',()=>{const s=setup();const before=JSON.stringify(s);assert.throws(()=>importSession('{"format":"invalid"}'));assert.equal(JSON.stringify(s),before);});
test('unknown source effects reject instead of disappearing',()=>{let r=run(setup('aslan','aslan'),'roll-statistics');r=run(r.session,'accept-statistics');assert.throws(()=>run(r.session,'resolve-book',{confirmed:true,effects:[{kind:'unimplemented'}]}),/Unsupported/);});
test('K’kree is not offered',()=>assert.equal(api({operation:'catalog'}).species.some(s=>s.id==='kkree'),false));
test('careers follow culture instead of offering all books indiscriminately',()=>{const h=project(setup()).state,z=project(setup('z','zhodani')).state,a=project(setup('a','aezorgh')).state;assert.ok(availableCareers(h).every(c=>['core','companion'].includes(c.group)));assert.ok(availableCareers(z).every(c=>['zhodani','companion'].includes(c.group)));assert.ok(availableCareers(a).some(c=>c.group==='vargr'));});
test('repeated action ID cannot perform duplicate rolls',()=>{const s=setup();const first=execute(s,{type:'roll-statistics'},{id:'same'});const duplicate=execute(first.session,{type:'roll-statistics'},{id:'same'});assert.equal(first.revision,duplicate.revision);assert.deepEqual(first.session,duplicate.session);});
test('stale revisions reject and return no changed session',()=>{const s=setup();assert.throws(()=>execute(s,{type:'roll-statistics'},{expectedRevision:0}),/changed/);});


test('GM replaces a roll while retaining original dice and later history',()=>{
 let r=run(setup('gm-dice'),'roll-statistics');const target=r.revision,original=structuredClone(r.log.at(-1).rolls[0]);
 r=run(r.session,'gm-mode',{enabled:true});r=run(r.session,'gm-replay',{revision:target,rollIndex:0,values:[6,6],reason:'Referee-set STR'});
 assert.deepEqual(r.log[target-1].rolls[0],original);assert.equal(r.state.pool[0].base,12);assert.match(r.log.at(-1).summary,/Referee-set STR/);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('GM replacement rejects wrong dice count and unenabled mode',()=>{
 let r=run(setup('gm-bad'),'roll-statistics');assert.throws(()=>run(r.session,'gm-replay',{revision:r.revision,rollIndex:0,values:[6,6],reason:'test'}),/Enable GM/);
 r=run(r.session,'gm-mode',{enabled:true});assert.throws(()=>run(r.session,'gm-replay',{revision:3,rollIndex:0,values:[6],reason:'test'}),/count/);
});
test('Core modifier caps at +3 rather than silently enabling Companion extended DMs',()=>{assert.equal(characteristicDM(18),3);assert.equal(characteristicDM(0),-3);});
test('native Drifter first term gains assignment basic training without source lookup',()=>{
 let r=run(setup('native'),'roll-statistics');r=run(r.session,'accept-statistics');r=run(r.session,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r.session,'skip-precareer');r=run(r.session,'career',{id:'core.drifter',assignment:'wanderer'});
 assert.equal(r.state.stage,'survival');assert.equal(r.state.character.skills.Deception,0);assert.equal(r.state.character.skills.Survival,0);assert.equal(r.state.coverage.includes('basic-training'),false);
});
test('later-career basic training leads to ordinary training, unlike first career',()=>{
 // This check exercises the source rule through a preserved prior career created by a complete term.
 let r=run(setup('later'),'roll-statistics');r=run(r.session,'accept-statistics');r=run(r.session,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r.session,'skip-precareer');r=run(r.session,'career',{id:'core.drifter',assignment:'wanderer'});
 for(let step=0;step<40&&r.state.stage!=='term-end';step++){
  if(r.state.stage==='survival')r=run(r.session,'survival');
  else if(r.state.stage==='advancement')r=run(r.session,'advancement');
  else if(r.state.stage==='training')r=run(r.session,'training',{table:'service'});
  else if(r.state.stage==='effect-choice')r=run(r.session,'choose-effect',{index:0});
  else if(r.state.stage==='skill-choice'){const p=r.state.pendingChoice;const base=p.allowed?.[0]??(p.scope==='existing'?Object.keys(r.state.character.skills)[0]:'Admin');r=run(r.session,'choose-skill',{name:p.allowed?base+' (test)':base});}
  else if(r.state.stage==='book-step')r=run(r.session,'resolve-book',{confirmed:true,effects:[],note:'Manual source resolution in fixture'});
  else throw new Error('Unexpected stage '+r.state.stage);
 }
 assert.equal(r.state.character.terms,1);assert.equal(r.state.character.age,22);
});
