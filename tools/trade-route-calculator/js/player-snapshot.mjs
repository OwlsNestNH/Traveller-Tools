// Headless, versioned player-data boundary. Never pass a raw campaign here.
// A future adapter must deliberately select approved public fields first.
export const SNAPSHOT_VERSION = 2;
export const MAX_SNAPSHOT_ROWS = 200;
const fail = () => { throw new Error('Invalid player snapshot. Ask the operator for a fresh snapshot.'); };
const object = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; };
const text = value => { if (typeof value !== 'string' || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) fail(); return value; };
const amount = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(value)) fail(); return value; };
const optionalAmount = value => value === null ? null : amount(value);
const scaled = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')); };
const decimal = value => { const whole = value / 1000000n, fraction = String(value % 1000000n).padStart(6, '0').replace(/0+$/, ''); return String(whole) + (fraction ? '.' + fraction : ''); };
const reservoir = (current, capacity) => {
  const result = {current:optionalAmount(current), capacity:optionalAmount(capacity)};
  if (result.current !== null && result.capacity !== null && scaled(result.current) > scaled(result.capacity)) fail();
  return result;
};
export const EXPENSE_KINDS = Object.freeze(['berth', 'fuel', 'salary', 'mortgage', 'lss', 'incidentals']);
const expenses = value => {
  object(value);
  const result = {visitLabel:text(value.visitLabel)};
  for (const kind of EXPENSE_KINDS) {
    const row = object(value[kind]);
    result[kind] = {expected:optionalAmount(row.expected), paid:optionalAmount(row.paid), basis:text(row.basis)};
  }
  return result;
};
// Sum only known values; unknown is never zero or an inferred balance due.
export function summarizePlayerExpenses(input) {
  const data = expenses(input), result = {};
  for (const column of ['expected', 'paid']) {
    const values = EXPENSE_KINDS.map(kind => data[kind][column]);
    result[column] = {knownTotal:decimal(values.reduce((sum, value) => sum + (value === null ? 0n : scaled(value)), 0n)), unknownCount:values.filter(value => value === null).length};
  }
  return freeze(result);
}
const rows = (value, project) => { if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_ROWS) fail(); return Array.from(value, row => project(object(row))); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const status = value => { if (!['available', 'not-checked', 'expired'].includes(value)) fail(); return value; };
const market = value => {
  const source = object(value), state = status(source.status);
  const offers = rows(source.offers, row => ({name:text(row.name), tons:amount(row.tons), creditsPerTon:amount(row.creditsPerTon)}));
  if (state !== 'available' && offers.length) fail();
  return {status:state, offers};
};
export function projectPlayerSnapshot(source) {
  object(source);
  if (source.version !== SNAPSHOT_VERSION) throw new Error('Unsupported player snapshot version. Ask the operator for a compatible snapshot.');
  const world = object(source.world), ship = object(source.ship), fuel = object(ship.fuel), support = object(ship.lifeSupport);
  // Explicit allowlist at every depth; the reservoir spread contains only validated public amounts.
  return freeze({version:SNAPSHOT_VERSION, capturedAt:text(source.capturedAt), campaignDate:text(source.campaignDate),
    world:{name:text(world.name), location:text(world.location), uwp:text(world.uwp), tradeCodes:text(world.tradeCodes), travelZone:text(world.travelZone), starport:text(world.starport)},
    ship:{name:text(ship.name), cargoCapacityTons:amount(ship.cargoCapacityTons), cashCredits:optionalAmount(ship.cashCredits), fuel:reservoir(fuel.current, fuel.capacity), lifeSupport:{...reservoir(support.current, support.capacity), cargoLss:optionalAmount(support.cargoLss)}, destination:text(ship.destination)},
    expenses:expenses(source.expenses),
    cargo:rows(source.cargo, row => ({name:text(row.name), tons:amount(row.tons)})),
    buy:market(source.buy), sell:market(source.sell)});
}
