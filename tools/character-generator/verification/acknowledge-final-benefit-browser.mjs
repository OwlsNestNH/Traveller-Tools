import assert from 'node:assert/strict';
import {project} from '../engine/session.mjs';

// Follow the actual player checkpoint before testing the destination screen.
// Check that acknowledgement changes history only, never the earned award or RNG.
export async function acknowledgeFinalBenefit(page) {
  await page.waitForFunction(() => !document.querySelector('#export')?.disabled);
  const button = page.locator('[data-action="acknowledge-final-benefit"]');
  if (!await button.count()) return false;
  const read = () => page.evaluate(() => localStorage.getItem('traveller-character-generator.v1'));
  const before = project(JSON.parse(await read()));
  assert.equal(await page.locator('[data-action="select-career"]').count(), 0);
  await button.click();
  await page.waitForFunction(() => !document.querySelector('[data-action="acknowledge-final-benefit"]'));
  const after = project(JSON.parse(await read()));
  assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(after.state.character, before.state.character);
  assert.equal(after.state.rng, before.state.rng);
  assert.equal(after.log.at(-1).type, 'acknowledge-final-benefit');
  return true;
}
