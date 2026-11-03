const assert=require('node:assert/strict');
require('./dist/data.js');
const F=require('./dist/engine.js'),U=require('./dist/ui-model.js'),H=require('./dist/option-help.js');
const state=structuredClone(F.defaults),before=JSON.stringify({state,data:F.D,options:F.options});
const expected={Agile:[/Agility \+1/,/100% of baseline/,/Cr9,000/,/Top speed unchanged/,/Range unchanged/,/Internal Spaces: no added allocation/,/Rail Rider/],Fast:[/Speed \+1 band/,/Range is halved/,/Slow, Supersonic/],Monowheel:[/Agility \+2/,/Port and starboard armour must remain zero/,/requires vehicle power/],'Off-Roader':[/Rough terrain/,/15% of baseline/,/Current choice: Fitted/],'Open-Topped':[/Dorsal armour must remain zero/,/half cover/,/Saves 15%/],Responsive:[/Halves the time/,/Range 25% shorter/,/100% of baseline/],Slow:[/Speed -1 band/,/Range 50% greater/,/Saves 25%/],'Smart Wheels':[/Agility \+1/,/Range 10% greater/,/terrain penalty by 1/],Streamlined:[/Agility \+1/,/Speed \+1 band/,/200% of baseline/],Unresponsive:[/Doubles the time/,/Saves 25%/,/200\+ Spaces/]};
assert.deepEqual(U.availableFeatures(F,state).map(f=>f['Feature Effect']),Object.keys(expected));
for(const [name,patterns] of Object.entries(expected))for(const pattern of patterns)assert.match(H.feature(name,F,state).join(' '),pattern,name);
for(const f of F.features){const name=f['Feature Effect'],lines=H.feature(name,F,state);assert.ok(H.featurePurposes[name]);assert.ok(lines.some(x=>x.startsWith('When fitted:')));assert.ok(lines.some(x=>x.startsWith('Limits:')));assert.notEqual(lines[0],f.Effect,'Catalogue one-liner retained: '+name);}
const base=F.calculate(structuredClone(state));
for(const [name,agility,speed,range] of [['Agile',1,0,1],['Fast',0,1,.5],['Slow',0,-1,1.5],['Responsive',0,0,.75],['Smart Wheels',1,0,1.1],['Streamlined',1,1,1]]){
 const r=F.calculate({...structuredClone(state),features:[...state.features,name]});assert.equal(r.agility-base.agility,agility,name);assert.equal(r.speed-base.speed,speed,name);assert.ok(Math.abs(r.range-base.range*range)<1e-8,name);
}
const mono=F.calculate({...structuredClone(state),features:[...state.features,'Monowheel']});assert.equal(mono.protection[2],0);assert.equal(mono.protection[3],0);
const open=F.calculate({...structuredClone(state),features:[...state.features,'Open-Topped']});assert.equal(open.protection[4],0);
for(const key of ['tl','spaces','extraPower','speedMod','efficiency','fuel','armour','depth','crew','passengers','crewSpace','passengerSpace','controlQuantity','cargo','description','comfort','group.name','group.count','group.space','weapon.quantity','weapon.ammo','weapon.gunShield','weapon.loaders','weapon.ratedSpaces','weapon.reservedCrew','armSize','strIncrease','dexIncrease'])assert.ok(H.input(key).lines.length,key);
for(const face of F.faces)assert.match(H.input('armourShift',{face}).lines.join(' '),/sum to zero/);
for(const name of ['Docking Bay','Hangar Bay']){const o=F.options.find(x=>x.Name===name);assert.equal(U.quantityLabel(o),'Carried vehicle shipping tons');assert.match(H.input('equipment.quantity',{name,unit:U.quantityLabel(o),pages:o._pages}).lines.join(' '),/shipping tons/);}
assert.equal(JSON.stringify({state,data:F.D,options:F.options}),before,'Help mutated rules or design state');
console.log('Exact ten reported feature popups have specific verified benefits, trade-offs, restrictions and fitting state; all 29 features and editable input families have help. Engine expectations and non-mutation checks passed.');

const powered=H.selection('power','Powered',F,state).lines.join(' ');assert.match(powered,/chosen design TL/);assert.match(powered,/not a fixed TL3 engine/);assert.match(powered,/Fission and fusion are separate choices/);assert.match(powered,/no separate primary plant Spaces or cost/);
const structurePower=H.selection('power','Powered',F,{...state,type:'Structure'}).lines.join(' ');assert.match(structurePower,/does not make the structure mobile/);assert.match(structurePower,/25% or 30%/);assert.doesNotMatch(structurePower,/no separate primary plant Spaces/);
assert.match(H.selection('gas','Helium',F,state).lines.join(' '),/Minimum TL5/);assert.match(H.selection('gas','Hot Air',F,state).lines.join(' '),/Minimum TL3/);
