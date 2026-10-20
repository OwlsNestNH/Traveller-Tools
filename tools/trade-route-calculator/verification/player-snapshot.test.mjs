import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerSnapshot, summarizePlayerExpenses, MAX_SNAPSHOT_ROWS} from '../js/player-snapshot.mjs';
import {playerSnapshotFixture as fixture} from '../js/player-snapshot-fixture.mjs';
const fresh = () => structuredClone(fixture);
test('allowlist strips GM and unrelated fields recursively; detached immutable output', () => {
  const input = fresh(); input.gm = 'secret'; input.world.audit = 'secret'; input.ship.bank = 'secret';
  input.cargo[0].reason = 'secret'; input.buy.reason = 'secret'; input.buy.offers[0].audit = 'secret';
  const result = projectPlayerSnapshot(input);
  assert.deepEqual(result, {...fixture,cargo:fixture.cargo.map(row=>({...row,purchase:null}))}); assert.ok(!JSON.stringify(result).includes('secret'));
  input.cargo[0].name = 'changed'; assert.equal(result.cargo[0].name, fixture.cargo[0].name);
  assert.throws(() => {result.buy.offers[0].tons = '0';}, TypeError);
});
test('unknown, absent and legacy versions fail closed', () => {
  for (const version of [undefined, 0, 1, 2, 3, 6, '4', null]) assert.throws(() => projectPlayerSnapshot({...fresh(), version}), /Unsupported/);
});
test('malformed shape, nonfinite or excessive amounts and bounded text rejected', () => {
  for (const value of [null, [], 'snapshot']) assert.throws(() => projectPlayerSnapshot(value));
  for (const value of [-1, NaN, Infinity, '-1', '1e9', '01', '1/2', '1.0000001', '9'.repeat(16), null]) {
    const input = fresh(); input.cargo[0].tons = value; assert.throws(() => projectPlayerSnapshot(input), /Invalid/);
  }
  for (const name of ['a'.repeat(241), 'line\nbreak', null]) {
    const input = fresh(); input.world.name = name; assert.throws(() => projectPlayerSnapshot(input), /Invalid/);
  }
});
test('Unicode and hostile markup remain inert data; prototype fields not copied', () => {
  const input = fresh(); input.world.name = '<img src=x onerror=alert(1)> 雪 🚀';
  input.world = JSON.parse(JSON.stringify(input.world).replace('{', '{"__proto__":{"polluted":true},'));
  assert.equal(projectPlayerSnapshot(input).world.name, input.world.name);
  assert.equal(Object.hasOwn(projectPlayerSnapshot(input).world, '__proto__'), false);
  assert.equal({}.polluted, undefined);
});
test('row bounds and market availability are explicit', () => {
  const input = fresh(); input.cargo = Array.from({length:MAX_SNAPSHOT_ROWS}, () => ({name:'Lot', tons:'1'}));
  assert.equal(projectPlayerSnapshot(input).cargo.length, MAX_SNAPSHOT_ROWS);
  input.cargo.push({name:'one too many', tons:'1'}); assert.throws(() => projectPlayerSnapshot(input));
  for (const status of ['not-checked', 'expired']) {
    const data = fresh(); data.buy.status = status; assert.throws(() => projectPlayerSnapshot(data));
    data.buy.offers = []; assert.equal(projectPlayerSnapshot(data).buy.status, status);
  }
  const data = fresh(); data.sell.status = 'invented'; assert.throws(() => projectPlayerSnapshot(data));
});

test('sparse lists fail closed instead of surviving validation', () => {
  const input = fresh(); input.cargo = new Array(2);
  assert.throws(() => projectPlayerSnapshot(input), /Invalid/);
});

test('cash, reservoir and expense allowlists exclude notes and preserve unknowns', () => {
  const input = fresh(); input.ship.fuel.audit = 'secret'; input.ship.lifeSupport.reason = 'secret';
  input.expenses.berth.gmReason = 'secret'; input.expenses.hiddenFee = 'secret'; input.ship.cashCredits = null;
  const output = projectPlayerSnapshot(input); assert.equal(output.ship.cashCredits, null);
  assert.equal(output.expenses.incidentals.expected, null); assert.ok(!JSON.stringify(output).includes('secret'));
  assert.throws(() => {output.expenses.fuel.paid = '1';}, TypeError);
});
test('resource bounds reject overcapacity and malformed or missing fields; unknown capacity stays unknown', () => {
  for (const key of ['fuel', 'lifeSupport']) {
    const data = fresh(); data.ship[key].current = '801'; data.ship[key].capacity = '800'; assert.throws(() => projectPlayerSnapshot(data));
    data.ship[key].capacity = null; assert.equal(projectPlayerSnapshot(data).ship[key].capacity, null);
    data.ship[key].current = null; assert.equal(projectPlayerSnapshot(data).ship[key].current, null);
    data.ship[key].current = '0'; data.ship[key].capacity = '0'; assert.equal(projectPlayerSnapshot(data).ship[key].capacity, '0');
  }
  for (const value of [undefined, '-1', 'NaN', Infinity, 42]) {
    const data = fresh(); data.ship.cashCredits = value; assert.throws(() => projectPlayerSnapshot(data));
    data.ship.cashCredits = '1'; data.expenses.fuel.expected = value; assert.throws(() => projectPlayerSnapshot(data));
  }
});
test('expense totals use exact arithmetic and disclose unknowns separately from zero', () => {
  assert.deepEqual(summarizePlayerExpenses(fresh().expenses), {expected:{knownTotal:'40250',unknownCount:2},paid:{knownTotal:'26750',unknownCount:1}});
  const data = fresh(); for (const key of ['berth', 'fuel', 'salary', 'mortgage', 'lss', 'incidentals', 'maintenance']) {data.expenses[key].expected = null; data.expenses[key].paid = '0';}
  assert.deepEqual(summarizePlayerExpenses(data.expenses), {expected:{knownTotal:'0',unknownCount:7},paid:{knownTotal:'0',unknownCount:0}});
  data.expenses.berth.expected = '999999999999999.999999'; data.expenses.fuel.expected = '0.000001';
  assert.deepEqual(summarizePlayerExpenses(data.expenses).expected, {knownTotal:'1000000000000000',unknownCount:5});
});

test('LSS overflow reserves whole space without changing exact stock or internal duration',()=>{
 for(const [stock,reserved] of [['0','0'],['0.1','1'],['100','1'],['150','2'],['200.000001','3']]){
  const d=fresh();d.ship.lifeSupport.cargoLss=stock;d.ship.lifeSupport.cargoReservedTons=reserved;
  const result=projectPlayerSnapshot(d);assert.equal(result.ship.lifeSupport.cargoLss,stock);assert.equal(result.ship.lifeSupport.cargoReservedTons,reserved);assert.equal(result.ship.lifeSupport.daysRemaining,'21');
 }
 for(const reserved of ['0','1','3']){const d=fresh();d.ship.lifeSupport.cargoReservedTons=reserved;assert.throws(()=>projectPlayerSnapshot(d),/Invalid/);}
 const d=fresh();d.ship.lifeSupport.cargoReservedTons=null;assert.equal(projectPlayerSnapshot(d).ship.lifeSupport.cargoReservedTons,null);
});

test('purchase history is a nested detached allowlist, independently unknown and bounded',()=>{
 const input=fresh();input.cargo[0].purchase={retailPerTon:'1000',percent:'62.500000',paidPerTon:'625',gm:'secret'};
 const result=projectPlayerSnapshot(input);assert.deepEqual(result.cargo[0].purchase,{retailPerTon:'1000',percent:'62.500000',paidPerTon:'625',paidTotal:null});assert.ok(Object.isFrozen(result.cargo[0].purchase));
 input.cargo[0].purchase.percent='90';assert.equal(result.cargo[0].purchase.percent,'62.500000');
 input.cargo[0].purchase={};assert.deepEqual(projectPlayerSnapshot(input).cargo[0].purchase,{retailPerTon:null,percent:null,paidPerTon:null,paidTotal:null});
 for(const value of ['<img>','-1','Infinity','1e3','1.1234567',7,[],{}]){input.cargo[0].purchase={paidPerTon:value};assert.throws(()=>projectPlayerSnapshot(input));}
});
