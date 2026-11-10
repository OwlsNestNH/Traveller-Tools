import assert from 'node:assert/strict';
import {api} from '../engine/session.mjs';
import {aslanSetup} from './aslan-officer-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
export function careerInfoFixture(species='human',gender='female',culture='native'){
 if(species==='aslan'&&culture==='native')return aslanSetup('career-info-'+gender,gender);
 let r=api({operation:'create',seed:'career-info-'+species+'-'+culture});
 r=run(r,'setup',{species,gender,culture,name:'Career information regression'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');assert.equal(r.state.stage,'career');return r;
}
