import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRESETS,preset} from '../catalogue.mjs';
import {normalizeTemplate,effectiveDesign} from '../setup.mjs';
import {normalizePublished,editedRequirement} from '../catalogue-provenance.mjs';
import {renderPublishedInventory} from '../published-inventory.mjs';
import {createState,normalizeState,applyCommand} from '../engine.mjs';
import {powerReport} from '../systems.mjs';
import {legacySampleShips} from './legacy-sample-fixture.mjs';

test('coverage accounts for every catalogue variant and retains exact printed/PDF citations',()=>{
 const coverage=JSON.parse(readFileSync(new URL('../catalogue-equipment-coverage.json',import.meta.url)));
 assert.equal(coverage.total,195);assert.equal(PRESETS.length,195);
 assert.deepEqual(coverage.entries.map(x=>x.id).sort(),PRESETS.map(x=>x.id).sort());
 for(const p of PRESETS){const n=normalizeTemplate(p),s=n.record.published.source;assert.equal(s.book,p.source.book);assert.equal(s.page,p.source.page);assert.equal(s.pdfPage,s.page+1);assert.ok(n.record.published.inventory.length>=7);assert.ok(n.record.ratedPower!=null);assert.deepEqual(normalizeTemplate(n),n);}
});
test('verified priority fits retain mounts and storage separately from current ammunition',()=>{
 for(const [id,output,counts] of [['acs2023-p6',80,[3]],['acs2023-p22',90,[2,2]],['acs2023-p136',150,[1,1]],['scc2023-p051',40,[1,1,1]],['tng2024-ifteaa',20,[1,1]]]){
  const p=preset(id);assert.equal(p.record.ratedPower,output);assert.deepEqual(p.record.weapons.map(w=>w.count),counts);assert.ok(p.record.weapons.every(w=>w.ammunition===null));
 }
 assert.deepEqual(preset('acs2023-p22').record.published.ammunitionStorage.map(x=>x.capacity),[12,20]);
 assert.equal(preset('tng2024-ifteaa').record.published.ammunitionStorage[0].capacity,72);
 assert.match(preset('tng2024-ifteaa').record.published.inventory.find(x=>x.category==='R-Drive').detail,/Thrust 12/);
 assert.equal(preset('drinax-harrier-restored').initialCondition.powerOutput,260);
});
test('absent weapons, explicit none, empty mounts and untranscribed counts are distinct',()=>{
 assert.equal(preset('core-194').record.published.weaponStatus,'explicit-none');assert.deepEqual(preset('core-194').record.weapons,[]);
 assert.equal(preset('highguard-139').record.published.weaponStatus,'not-listed');assert.equal(preset('highguard-139').record.weapons,null);
 const empty=preset('core-219').record.published.mounts[0];assert.equal(empty.capacity,1);assert.equal(empty.fittedCount,0);assert.deepEqual(preset('core-219').record.weapons,[]);
 assert.equal(preset('scc2023-p088').record.published.mounts.at(-1).quantity,null);
 // Until the existing editor supports optional weapon counts, never feed it null
 // (it substitutes 1). Uncertain fits remain in immutable published inventory.
 for(const p of PRESETS)for(const w of p.record.weapons??[])assert.ok(Number.isInteger(w.count)&&w.count>0);
 const p=structuredClone(preset('acs2023-p22').record.published);p.mounts[0].fittedCount=3;assert.throws(()=>normalizePublished(p),/capacity/);
});
test('published power bundles total exactly without counting software or storage twice',()=>{
 for(const [id,total] of [['acs2023-p6',59],['acs2023-p22',73],['acs2023-p136',109],['scc2023-p051',32],['tng2024-ifteaa',17],['drinax-harrier-restored',287]]){
  const state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:id,name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}}),s=state.ships[0];
  s.systems.inventoryConfirmed=true;s.systems.loads.forEach(l=>l.enabled=true);
  assert.equal(powerReport(s).total,total,id);assert.equal(s.condition.fuel,null);assert.equal(s.condition.cargo,null);assert.equal(s.condition.weapons,null);
 }
 const processor=preset('drinax-harrier-restored').record.requirements.find(x=>x.name==='Fuel Processor');assert.equal(processor.source.pdfPage,50);assert.match(processor.basis,/calculated/);
 assert.equal(preset('scc2023-p042').record.ratedPower,30);assert.equal(preset('acs2023-p116').record.fuelCapacity,null);
});
test('saved snapshots never acquire catalog enrichment and all manual overrides preserve source facts',()=>{
 const legacy=createState({ships:legacySampleShips()}),saved=JSON.parse(JSON.stringify(legacy));assert.deepEqual(normalizeState(saved),legacy);assert.ok(legacy.ships.every(s=>s.template?.record?.published==null));
 for(const p of PRESETS){let state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:p.id,name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}});const s=state.ships[0],source=structuredClone(s.template.record.published);const template=structuredClone(s.template);template.record.ratedPower=123.5;
  state=applyCommand(state,{type:'set-design',shipId:s.id,template});assert.equal(effectiveDesign(state.ships[0]).record.ratedPower,123.5);assert.deepEqual(state.ships[0].template.record.published,source);assert.equal(state.ships[0].designOverrides.record.ratedPower,123.5);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
 }
});
test('installed consumers with unpublished draw remain overridable unknown loads, not omitted zero',()=>{
 const state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-190',name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}}),s=state.ships[0];
 s.systems.inventoryConfirmed=true;const load=s.systems.loads.find(x=>x.id.startsWith('source-fuel-processor'));assert.ok(load);load.enabled=true;
 assert.equal(powerReport(s).total,null);assert.equal(powerReport(s).rows.find(x=>x.id===load.id).power,null);
 load.override=2;assert.equal(powerReport(s).rows.find(x=>x.id===load.id).power,2);assert.equal(s.template.record.requirements.find(x=>x.name==='Fuel Processor').power,null);
});
test('enhancement multipliers are not fitted weapon counts and Moray wrapped rows survive',()=>{
 for(const id of ['highguard-193','tng2024-keldyx']){
  const mounts=preset(id).record.published.mounts.filter(m=>/size reduction x3/i.test(m.fit));
  assert.ok(mounts.length);assert.ok(mounts.every(m=>m.fittedCount===null));
  assert.equal(preset(id).record.weapons,null);
 }
 const r=preset('scc2023-p048').record;
 assert.match(r.published.mounts[0].name,/Fixed Mount/);assert.match(r.published.mounts[0].fit,/missile rack/i);
 assert.equal(r.weapons[0].count,1);assert.match(r.software,/Manoeuvre/);
 assert.ok(r.published.inventory.some(x=>/Fuel Scoops/.test(x.detail)));
 const mixed=renderPublishedInventory(preset('scc2023-p088').record.published);
 assert.match(mixed,/beam laser/i);assert.match(mixed,/autocannon/i);assert.match(mixed,/Unknown/);
});
test('power extraction excludes deckplan legends and total-price lines across the catalogue',()=>{
 for(const p of PRESETS){
  assert.doesNotMatch(p.record.software??'',/Total:|MCr|\\n|LEGEND|Order #/i,p.id);
  for(const row of p.record.published.inventory)assert.doesNotMatch(row.detail,/Total:|MCr|\\n|LEGEND|Order #/i,p.id);
 }
 for(const id of ['highguard-137','highguard-138','highguard-140','highguard-144','scc2023-p036','scc2023-p038','scc2023-p053','scc2023-p058','scc2023-p061','scc2023-p099']){
  const names=preset(id).record.requirements.map(r=>r.name);assert.equal(new Set(names).size,names.length,id);
 }
 assert.equal(preset('highguard-173').record.requirements.find(r=>r.name==='Multi-Environment Equipment').power,1);
 assert.equal(preset('scc2023-p048').record.software,'Manoeuvre');
});
test('manual power amounts retain visible original provenance and separate jump activation rule',()=>{
 const state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'drinax-harrier-restored',name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}}),ship=state.ships[0];
 const design=effectiveDesign(ship);design.record.requirements=design.record.requirements.map(r=>/^(Manoeuvre drive|Jump drive)$/i.test(r.name)?editedRequirement(r,r.name,r.power+1):r);
 ship.systems.jumpEnabled=true;
 const report=powerReport(ship,ship.systems,ship.condition,design);
 for(const id of ['drive','jump']){const row=report.rows.find(r=>r.id===id);assert.equal(row.source,null);assert.match(row.note,/Manual design/);assert.match(row.note,/Retained original/);assert.match(row.note,/Drinax/);}
 assert.doesNotMatch(report.rows.find(r=>r.id==='drive').note,/Published rated load/);
 assert.match(report.rows.find(r=>r.id==='jump').note,/Activation rule: Core/);
});
test('audited omissions and calculated fits retain their distinct evidence',()=>{
 for(const [id,category,tons] of [['core-200','Cargo','22.85'],['core-206','Common Areas','15'],['core-225','Cargo','3'],['scc2023-p069','Common Areas','12.5'],['scc2023-p077','Cargo','2'],['scc2023-p105','Common Areas','2'],['scc2023-p106','Cargo','7.5']])assert.equal(preset(id).record.published.inventory.find(r=>r.category===category).tonnage,tons);
 assert.match(preset('scc2023-p018').record.published.inventory.find(r=>r.category==='Cargo').detail,/Concealed Compartment/);
 assert.equal(preset('tng2024-seaho').record.published.mounts[0].fittedCount,3);
 assert.equal(preset('tng2024-brimansh').record.published.mounts[1].fittedCount,2);
 for(const id of ['highguard-167','highguard-175','highguard-181','highguard-183','highguard-187'])assert.ok(preset(id).record.published.mounts.some(m=>m.fittedCountBasis?.startsWith('Calculated')));
 for(const [id,name] of [['tng2024-akhtael','Biosphere'],['tng2024-backwater-trader','Low Berths'],['highguard-193','Training Facilities'],['core-198','Multi-Environment Space']])assert.equal(preset(id).record.requirements.find(r=>r.name===name).power,null);
});
