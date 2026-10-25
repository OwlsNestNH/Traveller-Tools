import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../engine.mjs';
import {assertSampleEquivalent} from './sample-equivalence.mjs';
test('sample comparison tolerates only bounded cosmetic heading roundoff',()=>{
 const expected=createState(),actual=structuredClone(expected);
 actual.ships[1].appearance.heading+=3e-14;assertSampleEquivalent(actual,expected);
 const before=structuredClone(actual);assertSampleEquivalent(actual,expected);assert.deepEqual(actual,before);
 actual.ships[1].appearance.heading+=1e-10;assert.throws(()=>assertSampleEquivalent(actual,expected));
 actual.ships[1].appearance.heading=NaN;assert.throws(()=>assertSampleEquivalent(actual,expected));
 actual.ships[1].appearance.heading=expected.ships[1].appearance.heading;actual.ships[1].motion.position.q++;assert.throws(()=>assertSampleEquivalent(actual,expected));
});
