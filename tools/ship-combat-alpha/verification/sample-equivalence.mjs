import assert from 'node:assert/strict';
// Math.atan2 is implementation-approximated. Node and browser engines can differ
// by a few ULPs when deriving the cosmetic velocity heading in degrees.
export function assertSampleEquivalent(actual,expected){
 const comparable=structuredClone(actual);
 assert.equal(comparable.ships.length,expected.ships.length);
 for(let i=0;i<expected.ships.length;i++){
  const a=comparable.ships[i].appearance.heading,b=expected.ships[i].appearance.heading;
  assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12,`Cosmetic heading differs for ${expected.ships[i].id}: ${a} vs ${b}`);
  comparable.ships[i].appearance.heading=b;
 }
 // IDs, position, velocity, capabilities and every other field remain exact.
 assert.deepEqual(comparable,expected);
}
