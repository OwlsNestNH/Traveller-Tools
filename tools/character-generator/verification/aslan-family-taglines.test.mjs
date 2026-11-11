import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASLAN_FAMILY_TAGLINES, familyTagline } from '../gui/aslan-family-taglines.mjs';
import { familyNarrative } from '../gui/aslan-family-presentation.mjs';

const bands = ['outcast', 'lower', 'middle', 'noble', 'high'];
test('all 30 verified results have six distinct frozen presentation lines', () => {
  assert.equal(Object.keys(ASLAN_FAMILY_TAGLINES).length, 30);
  assert.ok(Object.isFrozen(ASLAN_FAMILY_TAGLINES));
  for (const band of bands) for (let die = 1; die <= 6; die += 1) {
    assert.ok(familyNarrative(band, die));
    const lines = ASLAN_FAMILY_TAGLINES[`${band}:${die}`];
    assert.ok(Object.isFrozen(lines));
    assert.equal(lines.length, 6);
    assert.equal(new Set(lines).size, 6);
    for (const line of lines) {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0 && line.length <= 90);
      assert.doesNotMatch(line, /\b(?:DM|SOC|STR|DEX|END|skill|bonus|penalty)\b|[+-]\d/);
    }
  }
});
test('stable action selection covers all variations without using random state', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Presentation must not use random state'); };
  try {
    for (const band of bands) for (let die = 1; die <= 6; die += 1) {
      const seen = new Set();
      for (let action = 0; action < 300; action += 1) {
        const value = familyTagline(band, die, `family-action-${action}`);
        assert.equal(value, familyTagline(band, die, `family-action-${action}`));
        assert.ok(ASLAN_FAMILY_TAGLINES[`${band}:${die}`].includes(value));
        seen.add(value);
      }
      assert.equal(seen.size, 6);
    }
  } finally { Math.random = original; }
});
test('invalid identities return no line and omitted action IDs are stable', () => {
  for (const band of ['unknown', '__proto__', '', null, undefined]) assert.equal(familyTagline(band, 1, 'x'), '');
  for (const die of [0, 7, -1, 1.5, NaN, '1', null, undefined]) assert.equal(familyTagline('outcast', die, 'x'), '');
  assert.equal(familyTagline('lower', 1), familyTagline('lower', 1, ''));
  assert.equal(familyTagline('middle', 2, 42), familyTagline('middle', 2, '42'));
});
test('catalogue module is independent of game modules and random APIs', () => {
  const source = readFileSync(new URL('../gui/aslan-family-taglines.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\b|Math\.random|crypto\.|Date\./);
});
