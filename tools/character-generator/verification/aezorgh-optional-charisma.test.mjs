import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession,catalog,COMPATIBLE_RULES_REVISIONS,RULES_REVISION} from '../engine/session.mjs';
import {selectedOptionalStatistics} from '../gui/characteristics-presentation.mjs';
import {statisticPreview} from '../gui/statistic-editor.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function build(extras=[],revision=RULES_REVISION){let r=run({...createSession('optional-aezorgh-cha'),rulesRevision:revision},'setup',{species:'aezorgh'});r=run(r,'configure',{extras});r=run(r,'roll-statistics');return run(r,'accept-statistics');}
test('Aezorgh CHA stays absent by default, including projection and SOC corrections',()=>{
 let r=build();assert.equal(Object.hasOwn(r.state.character.stats,'CHA'),false);r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.SOC',value:9,reason:'Synthetic correction'});assert.equal(Object.hasOwn(r.state.character.stats,'CHA'),false);assert.equal(Object.hasOwn(project(importSession(exportSession(r.session))).state.character.stats,'CHA'),false);assert.doesNotMatch(statisticPreview({code:'SOC',min:0,max:40},r.state,7),/CHA/);
});
test('manually added Aezorgh CHA derives floor(SOC / 2), uses no RNG, follows SOC, survives replay',()=>{
 let r=build(),before=r.state.rng;r=run(r,'add-extra',{id:'CHA'});assert.equal(r.state.character.stats.CHA,Math.floor(r.state.character.stats.SOC/2));assert.equal(r.state.rng,before);assert.deepEqual(r.log.at(-1).rolls,[]);assert.match(r.log.at(-1).summary,/JTAS Vol. 11 p. 67/);assert.throws(()=>run(r,'add-extra',{id:'CHA'}),/already exists/);
 r=run(r,'gm-mode',{enabled:true});for(const value of [0,1,7,8,9]){r=run(r,'gm-override',{field:'stat.SOC',value,reason:'Synthetic correction'});assert.equal(r.state.character.stats.CHA,Math.floor(value/2));}assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
});
test('explicit setup selection derives CHA without consuming dice and exposes pending extra',()=>{
 const off=build(),on=build(['CHA']);assert.equal(on.state.rng,off.state.rng);assert.equal(on.state.character.stats.CHA,Math.floor(on.state.character.stats.SOC/2));assert.equal(on.log.at(-1).rolls.length,0);assert.deepEqual(selectedOptionalStatistics(on.state,catalog()).map(x=>x.id),['CHA']);
});
test('every earlier compatible revision preserves automatic Aezorgh CHA',()=>{
 for(const revision of COMPATIBLE_RULES_REVISIONS.filter(r=>![RULES_REVISION,'character-preview-2026-11-13.32','character-preview-2026-11-09.31','character-preview-2026-11-09.30','character-preview-2026-11-09.29','character-preview-2026-11-09.27'].includes(r))){const r=build([],revision);assert.equal(r.state.optionalAezorghCharisma,undefined);assert.equal(r.state.character.stats.CHA,Math.floor(r.state.character.stats.SOC/2));assert.equal(exportSession(importSession(exportSession(r.session))),exportSession(r.session));}
});
test('below-threshold reroll remains optional, not mandatory',()=>{
 let r=run(createSession('physical-below-threshold'),'setup',{species:'aezorgh'});r=run(r,'configure',{aezorghTwoDice:true,minimumReroll:true,physicalDice:true});for(const code of ['STR','DEX','END','INT','EDU','SOC'])r=run(r,'enter-physical-statistic',{code,value:6});assert.equal(r.state.rollTotal,36);assert.equal(r.state.statisticsCanReroll,true);assert.equal(run(r,'accept-statistics').state.stage,'background');
});

test('pre-fix .16–.25 fixtures keep exact projection, logs, RNG and export bytes',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const fixtures=JSON.parse(await readFile(new URL('./aezorgh-optional-charisma-replay-fixtures.json',import.meta.url),'utf8'));
 for(const f of fixtures){assert.equal(digest(JSON.stringify(project(f.session))),f.projectionSha256,f.session.rulesRevision);assert.equal(digest(exportSession(f.session)),f.exportSha256,f.session.rulesRevision);}
});
