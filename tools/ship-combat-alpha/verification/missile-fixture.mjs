import {directFireFixture} from './direct-fire-fixture.mjs';
import {normalizeState} from '../engine.mjs';
export function missileFixture(choices={high:[['mixed:1','Missile rack','low']]}){let s=directFireFixture(choices);for(const ship of s.ships){ship.template.record.tl=12;ship.systems.sensorInstalled=true;ship.systems.sensorsEnabled=true;ship.condition.ammunition.loaded.filter(p=>p.kind==='missile').forEach(p=>{p.count=4;p.missileType='Standard';});}return normalizeState(s);}
