import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance, fuel, plan} from '../js/map.mjs';

const core = JSON.parse(await readFile(new URL('../rules/core-2022.json', import.meta.url)));
const world = (x, y, extra={}) => ({id:`${x},${y}`, x, y, name:`${x},${y}`, uwp:'A788899-C', gasGiants:0, ...extra});
const catalog = rows => Object.fromEntries(rows.map(w => [w.id, w]));

// The October 5 campaign override permits unavailable fuel and empty-space
// stops. Keep route connectivity/ranking independent from supply warnings.
test('fuel availability and tracked stock do not change route ranking or inputs', () => {
  const worlds = catalog(Array.from({length:6}, (_, y) => world(0, y)));
  const ship = {jump:4, scoops:false, fuel:{displacementTons:200, capacityTons:80, aboardTons:0}};
  const expected = ['0,0', '0,4', '0,5'];
  for (const id of expected) worlds[id].fuelOverride = false;
  const before = structuredClone({worlds, ship});
  assert.deepEqual(plan(worlds, ['0,0', '0,5'], ship, core), expected);
  for (const id of expected) assert.equal(fuel(worlds[id], ship, core), false);
  assert.deepEqual({worlds, ship}, before);
  for (const id of expected) worlds[id].fuelOverride = true;
  ship.fuel.aboardTons = 80;
  assert.deepEqual(plan(worlds, ['0,0', '0,5'], ship, core), expected);
});

test('equal routes use stable IDs regardless of catalog insertion order', () => {
  const rows = [world(0,0), world(0,1), world(1,0), world(1,1)];
  const expected = ['0,0', '0,1', '1,1'];
  for (const order of [rows, [...rows].reverse(), [rows[2], rows[3], rows[0], rows[1]]]) {
    const worlds = catalog(order);
    assert.deepEqual(plan(worlds, ['0,0', '1,1'], {jump:1}, core), expected);
    expected.slice(1).forEach((id, i) => assert.equal(distance(worlds[expected[i]], worlds[id]), 1));
  }
});

test('mandatory empty and fuel-less stops stay ordered without duplicate boundaries', () => {
  const worlds = catalog([world(0,0), world(0,1,{emptySpace:true}), world(0,2,{fuelOverride:false}), world(0,4)]);
  const stops = ['0,0', '0,1', '0,1', '0,2', '0,4'];
  const before = structuredClone({worlds, stops});
  assert.deepEqual(plan(worlds, stops, {jump:2}, core), ['0,0', '0,1', '0,2', '0,4']);
  assert.deepEqual({worlds, stops}, before);
});

test('fuel permission never bypasses range, missing stops, or bounded search errors', () => {
  const worlds = catalog([world(0,0,{fuelOverride:true}), world(0,3,{fuelOverride:true})]);
  assert.throws(() => plan(worlds, ['0,0', '0,3'], {jump:2}, core), /No valid connection.*12 parsecs/);
  assert.throws(() => plan(worlds, ['0,0', 'missing', '0,3'], {jump:3}, core), /Load every mandatory stop/);
  assert.throws(() => plan(worlds, ['0,0'], {jump:3}, core), /origin and destination/);
  const oversized = catalog(Array.from({length:1601}, (_, y) => world(0,y)));
  assert.throws(() => plan(oversized, ['0,0', '0,3'], {jump:3}, core), /1,600 loaded worlds/);
});
