import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {api} from '../engine/session.mjs';
const head=process.argv.find(a=>a.startsWith('--expected-head='))?.split('=')[1]??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),head);
const paths=[];let attempted=0;
for(let n=-1;n<20000&&paths.length<15;n++){
 const seed=n===-1?'full-random-v1|aslan|aslan.scientist|explorer|14':'focused-female-family-reroll|'+n;attempted++;
 let r=api({operation:'create',seed});
 for(const [type,payload]of [['setup',{species:'aslan',gender:'female'}],['roll-statistics',{}],['accept-statistics',{}],['roll-aslan-family',{}]]){r=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(r.ok,true,r.error?.message);}
 const family=r.state.character.aslanOrigin.family;if(!family?.rerolls)continue;
 assert.equal(family.band,'outcast');assert.equal(family.rerolls[0].die,4);assert.ok(family.rerolls.length>=2&&family.rerolls.length<=64);
 assert.ok(family.rerolls.slice(0,-1).every(x=>x.die===4));assert.notEqual(family.rerolls.at(-1).die,4);assert.equal(family.die,family.rerolls.at(-1).die);
 assert.ok(family.rerolls.every(x=>x.band==='outcast'&&x.source.id==='aliens'&&x.source.page===17));assert.ok(!Object.hasOwn(r.state.character.skills,'Independence'));assert.notEqual(r.state.pending?.decision,'female-independence');
 assert.deepEqual(api({operation:'import',raw:JSON.stringify(r.session)}).state,r.state);
 assert.equal(r.session.events.length,4);assert.equal(r.session.events.filter(x=>x.command.type==='roll-aslan-family').length,1);
 const repeat=api({operation:'command',session:r.session,command:{type:'roll-aslan-family',payload:{}}});assert.equal(repeat.ok,false);
 paths.push({seed,original:4,rerolls:family.rerolls.map(x=>x.die),finalFamilyRow:family.die,stage:r.state.stage,noIndependence:true,sourceBandPreserved:true,historyPreserved:true,replay:true,duplicateActionRejected:true});
 console.log('REROLL',paths.length,seed,family.rerolls.map(x=>x.die).join(' -> '));
}
assert.equal(paths.length,15,'Insufficient natural reroll paths');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),head);
const report={head,attempted,validatedPaths:15,paths,method:'Public API; natural family rolls only; no forced dice, GM edits, omission rulings, or saved characters. Fifteen focused family paths, not fifteen finalized characters.'};
writeFileSync(new URL('./random-focused-female-family-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({head,attempted,validatedPaths:15}));
