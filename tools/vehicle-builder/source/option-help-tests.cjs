const assert=require('node:assert/strict');
require('./dist/data.js');
const F=require('./dist/engine.js'),U=require('./dist/ui-model.js'),H=require('./dist/option-help.js');
const before=JSON.stringify({defaults:F.defaults,options:F.options,data:F.D});
const equipment=F.options.filter(o=>!o.Name.startsWith('Control System'));
for(const o of equipment){
 const lines=H.system(o,F,U);
 assert.ok(lines[0].length>25,'Missing purpose: '+o.Name);
 assert.ok(!lines.join(' ').includes('Select a specification'),'Generic fallback: '+o.Name);
 assert.ok(lines.some(x=>x.includes('Minimum TL'+o.TL)),o.Name);
}
const choices={type:F.types.map(x=>x.Type),power:F.powers.map(x=>x.Power),secondary:['none',...F.powers.map(x=>x.Power)],hull:['Standard','Reinforced','Light'],gas:F.D.BuoyancyGas.map(x=>x['Buoyancy Gas']),aux:F.D.Secondary.filter(x=>x.TL!==null).map(x=>x.Secondary),rail:F.D.RailNetwork.map(x=>x['Rail Network']),sophont:[.5,1,2,3,4,5,12],ruling:['table','prose'],control:F.options.filter(x=>x.Name.startsWith('Control System')).map(x=>x.Name),mount:['Fixed Mount','Hardpoint','Pintle Mount','Ring Mount','Gunport','Bay','Multi-Bay','Turret'],facing:F.faces,fireControl:['none','Scope','Basic','Improved','Enhanced','Advanced'],ammoType:F.ammunition.map(x=>x.name),weapon:F.weapons.map(x=>x.Weapon),rangeBoost:[0,1,2,3]};
for(const key of ['drone','vacTube','remote','autoloader','popup','modular','highFidelity','hardened','mast'])choices[key]=[false,true];
let count=0;
for(const [key,values] of Object.entries(choices))for(const value of values){const h=H.selection(key,value,F);assert.ok(h.lines.length,key+': '+value);assert.ok(h.row||h.pages,'Missing reference: '+key+': '+value);assert.ok(!h.lines.join(' ').includes('undefined'));count++;}
assert.doesNotMatch(H.selection('secondary','Unpowered',F).lines.join(' '),/Removes powered propulsion/);
assert.match(H.selection('hull','Reinforced',F).lines.join(' '),/10% Hull.*50%.*cost/);
assert.match(H.selection('hull','Light',F).lines.join(' '),/25% Hull/);
assert.match(H.selection('gas','Vacuum',F).lines.join(' '),/Rigid/);
assert.match(H.selection('power','Fission (basic)',F).lines.join(' '),/Hostile Environment/);
assert.match(H.selection('fireControl','Enhanced',F).lines.join(' '),/\+3/);
assert.match(H.selection('ammoType','Smoke',F).lines.join(' '),/No damage.*visual concealment/);
assert.notDeepEqual(H.system(F.options.find(x=>x.Name==='Transceiver, 5 km'),F,U),H.system(F.options.find(x=>x.Name==='Transceiver, 500 km'),F,U));
for(const key of ['type','power','aux','mount','weapon','ammoType'])assert.doesNotThrow(()=>H.selection(key,'Unknown imported choice',F));
assert.equal(JSON.stringify({defaults:F.defaults,options:F.options,data:F.D}),before,'Help mutated construction data');
console.log(`${equipment.length} equipment choices across ${U.groups(equipment).length} families and ${count} construction choices have purpose/effect/reference coverage; selected variants differ and construction data stays unchanged.`);

assert.match(H.system(F.options.find(x=>x.Name==='Sensor System (basic)'),F,U).join(' '),/base detection range: 1 km/);
assert.doesNotMatch(H.system(F.options.find(x=>x.Name==='Stealth (basic)'),F,U).join(' '),/Stealth basic\)/);
