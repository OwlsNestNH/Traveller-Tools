import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnergyWeapon,recordedWeaponPower} from '../weapon-supply.mjs';
import {preset} from '../catalogue.mjs';
test('energy-only mounts use recorded power without inventing replacement power or ammunition',()=>{
 const t=preset('drinax-harrier-restored'),w=t.record.weapons[0],before=structuredClone(t);
 assert.equal(isEnergyWeapon(w),true);for(const type of ['beam lasers','pulse lasers'])assert.equal(isEnergyWeapon({type}),true);assert.equal(recordedWeaponPower(t,w),15);
 const rack=t.record.weapons[1];assert.equal(isEnergyWeapon(rack),false);
 assert.equal(recordedWeaponPower(t,{...rack,type:'Beam laser'},t),null);
 assert.equal(isEnergyWeapon({type:'Beam laser / missile rack'}),false);
 assert.equal(isEnergyWeapon({type:'Unknown experimental weapon'}),false);
 assert.deepEqual(t,before);
});
