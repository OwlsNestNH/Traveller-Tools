import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,PRESETS} from '../catalogue.mjs';
import {normalizeTemplate} from '../setup.mjs';
import {fitLoadout} from '../add-loadout.mjs';
test('unknown and empty fits stay distinct; presets are immutable',()=>{for(const row of PRESETS){const p={...normalizeTemplate(preset(row.id)),id:row.id};const before=JSON.stringify(p);assert.deepEqual(fitLoadout(p,p.id),p.record.weapons);assert.deepEqual(fitLoadout(p,p.id,'unarmed'),[]);if(p.id!=='drinax-harrier-restored')for(const choice of ['beam','pulse','mixed'])assert.throws(()=>fitLoadout(p,p.id,choice),/unverified/);assert.equal(JSON.stringify(p),before);}});
test('verified single turret replacements retain barbette and consume defense capacity',()=>{const p=preset('drinax-harrier-restored');for(const choice of ['beam','pulse']){const fit=fitLoadout(p,p.id,choice);assert.deepEqual(fit[0],p.record.weapons[0]);assert.equal(fit[1].count,1);assert.equal(fit[1].ammunition,null);const defended=fitLoadout(p,p.id,choice,true);assert.equal(defended.length,2);assert.equal(defended[1].type,'Sandcaster');}assert.throws(()=>fitLoadout(p,p.id,'mixed'),/two verified separate/);assert.throws(()=>fitLoadout(p,p.id,'unarmed',true));const custom=structuredClone(p);custom.record.weapons[1].count=2;assert.throws(()=>fitLoadout(custom,p.id,'beam'),/manual review/);});


