// Pure JSON boundary. Imported files never bypass the engine catalogue checks.
export const SCHEMA_VERSION = 1;
export const STAGE_IDS = ['chassis', 'locomotion', 'physical', 'brain', 'skills', 'finalisation'];
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function assertJson(value, path = '$', depth = 0) {
  if (depth > 16) throw new TypeError(`${path}: maximum nesting exceeded.`);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 10000) throw new TypeError(`${path}: text is too long.`);
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new TypeError(`${path}: too many entries.`);
    value.forEach((item, index) => assertJson(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new TypeError(`${path}: unsafe field.`);
      assertJson(value[key], `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new TypeError(`${path}: expected finite JSON data.`);
}
export function clone(value) { assertJson(value); return JSON.parse(JSON.stringify(value)); }
export function assertKeys(value, keys, path) {
  if (!isRecord(value)) throw new TypeError(`${path}: expected an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new TypeError(`${path}.${key}: unknown field.`);
}
export function integer(value, min, max, path) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`${path}: expected a whole number from ${min} to ${max}.`);
  return value;
}
export function mergeKnown(base, patch, path = '$') {
  // Catalogue-keyed option parameters are replaced, then validated by checked().
  if (path === '$.selections.physical.optionParameters') return clone(patch);
  assertKeys(patch, Object.keys(base), path);
  const result = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isRecord(base[key]) && isRecord(value) ? mergeKnown(base[key], value, path+'.'+key) : clone(value);
  }
  return result;
}
