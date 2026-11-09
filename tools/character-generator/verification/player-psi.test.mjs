import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
for(const species of ['human','aslan','vargr','aezorgh'])test(species+' can select ordinary PSI without enabling GM corrections',()=>{
 let r=run(createSession('player-psi-'+species),'configure',{extras:['PSI']});
 r=run(r,'setup',{species,gender:'female'});r=run(r,'roll-statistics');const total=r.state.rollTotal;r=run(r,'accept-statistics');
 assert.equal(r.state.config.gm,false);assert.equal(r.state.rollTotal,total);assert.ok(Number.isInteger(r.state.character.stats.PSI));
 assert.ok(r.log.at(-1).rolls.some(roll=>roll.label==='PSI'));assert.equal(r.state.character.skills.Telepathy,undefined);
 assert.throws(()=>run(r,'gm-override',{field:'stat.PSI',value:15,reason:'Not allowed'}),species==='aslan'?/Aslan origin|GM/:/GM/);
 assert.throws(()=>run(r,'gm-replay',{revision:3,rollIndex:0,values:[6,6],reason:'Not allowed'}),species==='aslan'?/Aslan origin|GM/:/GM/);
 assert.throws(()=>run(r,'restore',{revision:1}),species==='aslan'?/Aslan origin|GM/:/GM/);
 const raw=exportSession(r.session);assert.deepEqual(project(importSession(raw)).state,r.state);assert.equal(exportSession(importSession(raw)),raw);
});
test('later PSI testing keeps GM off, records actual test and cannot be repeated',()=>{
 let r=run(createSession('later-player-psi'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 r=run(r,'add-extra',{id:'PSI'});assert.equal(r.state.config.gm,false);assert.equal(r.state.character.psionics.tests.length,1);assert.deepEqual(r.state.character.skills,{});
 assert.throws(()=>run(r,'add-extra',{id:'PSI'}),/already exists/);assert.throws(()=>run(r,'learn-talent',{talent:'Telepathy'}));
});
test('actual checkbox sync does not clear player PSI when GM mode changes',()=>{
 const source=fs.readFileSync(new URL('../gui/app.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function syncPsiOptions('),end=source.indexOf('\nfunction syncRerollOptions(',start);
 const sync=vm.runInNewContext(source.slice(start,end)+';syncPsiOptions');
 const psi={disabled:false,checked:true},form={querySelector:()=>psi,elements:{gm:{checked:false},species:{value:'human'}}};
 sync(form);assert.equal(psi.disabled,false);assert.equal(psi.checked,true);assert.equal(form.elements.gm.checked,false);
 form.elements.gm.checked=true;sync(form);form.elements.gm.checked=false;sync(form);assert.equal(psi.checked,true);
 form.elements.species.value='zhodani';sync(form);assert.equal(psi.disabled,true);assert.equal(psi.checked,false);
 form.elements.species.value='human';sync(form);assert.equal(psi.disabled,false);assert.equal(form.elements.gm.checked,false);
 assert.doesNotMatch(source,/extras'\)\.includes\('PSI'\)&&!values.get\('gm'\)/);
 assert.doesNotMatch(source,/disabled:e.id==='PSI'&&!state.config.gm/);
});
