// Headless, versioned player-data boundary. Never pass a raw campaign here.
// A future adapter must deliberately select approved public fields first.
export const SNAPSHOT_VERSION = 1;
export const MAX_SNAPSHOT_ROWS = 200;
const fail = () => { throw new Error('Invalid player snapshot. Ask the operator for a fresh snapshot.'); };
const object = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; };
const text = value => { if (typeof value !== 'string' || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) fail(); return value; };
const amount = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(value)) fail(); return value; };
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
  const world = object(source.world), ship = object(source.ship);
  // Explicit allowlist at every depth: no spreads, GM audits, ledger or reasons.
  return freeze({version:SNAPSHOT_VERSION, capturedAt:text(source.capturedAt), campaignDate:text(source.campaignDate),
    world:{name:text(world.name), location:text(world.location), uwp:text(world.uwp), tradeCodes:text(world.tradeCodes), travelZone:text(world.travelZone), starport:text(world.starport)},
    ship:{name:text(ship.name), cargoCapacityTons:amount(ship.cargoCapacityTons), fuelTons:amount(ship.fuelTons), destination:text(ship.destination)},
    cargo:rows(source.cargo, row => ({name:text(row.name), tons:amount(row.tons)})),
    buy:market(source.buy), sell:market(source.sell)});
}
