import {projectCampaignPolitics} from './campaign-politics.mjs';
// Headless, versioned player-data boundary. Never pass a raw campaign here.
// A future adapter must deliberately select approved public fields first.
export const SNAPSHOT_VERSION = 8;
export const MAX_SNAPSHOT_ROWS = 200;
const fail = () => { throw new Error('Invalid player snapshot. Ask the operator for a fresh snapshot.'); };
const object = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; };
const text = value => { if (typeof value !== 'string' || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) fail(); return value; };
const amount = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(value)) fail(); return value; };
export class CargoTonnageError extends Error {
  constructor() { super('This snapshot contains cargo-hold quantities that are not whole tons. No inventory was rounded or changed. Ask the operator for a fresh whole-ton snapshot.'); this.name='CargoTonnageError'; }
}
const wholeTons = value => { amount(value); if (!/^(0|[1-9]\d{0,14})$/.test(value)) throw new CargoTonnageError(); return value; };
const mapReference = value => { if(value == null)return null; object(value); const sector=text(value.sector),hex=text(value.hex); if(!sector.trim()||sector.length>80||!/^\d{4}$/.test(hex)||Number(hex.slice(0,2))<1||Number(hex.slice(0,2))>32||Number(hex.slice(2))<1||Number(hex.slice(2))>40)fail();return {sector,hex}; };
const optionalAmount = value => value === null ? null : amount(value);
const scaled = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')); };
const decimal = value => { const whole = value / 1000000n, fraction = String(value % 1000000n).padStart(6, '0').replace(/0+$/, ''); return String(whole) + (fraction ? '.' + fraction : ''); };
const reservoir = (current, capacity) => {
  const result = {current:optionalAmount(current), capacity:optionalAmount(capacity)};
  if (result.current !== null && result.capacity !== null && scaled(result.current) > scaled(result.capacity)) fail();
  return result;
};
export const EXPENSE_KINDS = Object.freeze(['berth', 'fuel', 'salary', 'mortgage', 'lss', 'incidentals', 'maintenance']);
export const LEGACY_MAINTENANCE = Object.freeze({expected:null, paid:null, basis:'Older snapshot: maintenance was not separated from Incidentals. Ask for a fresh link.'});
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
const purchase = (value, version) => { if(value == null)return null; const p=object(value); return {retailPerTon:optionalAmount(p.retailPerTon ?? null),percent:optionalAmount(p.percent ?? null),paidPerTon:optionalAmount(p.paidPerTon ?? null),paidTotal:optionalAmount(p.paidTotal ?? null),originalBrokerCommission:version>=6?optionalAmount(p.originalBrokerCommission ?? null):null}; };
const rows = (value, project) => { if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_ROWS) fail(); return Array.from(value, row => project(object(row))); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const status = value => { if (!['available', 'not-checked', 'expired'].includes(value)) fail(); return value; };
const market = (value, version) => {
  const source = object(value), state = status(source.status);
  const offers = rows(source.offers, row => ({name:text(row.name), tons:amount(row.tons), creditsPerTon:amount(row.creditsPerTon),retailPerTon:version>=8?optionalAmount(row.retailPerTon ?? null):null}));
  if (state !== 'available' && offers.length) fail();
  return {status:state, offers};
};
export function projectPlayerSnapshot(source) {
  object(source);
  if (![4, 5, 6, 7, SNAPSHOT_VERSION].includes(source.version)) throw new Error('Unsupported player snapshot version. Ask the operator for a compatible snapshot.');
  const world = object(source.world), ship = object(source.ship), fuel = object(ship.fuel), support = object(ship.lifeSupport);
  const days=reservoir(support.daysRemaining ?? null,support.daysCapacity ?? null);
  const cargoLss=optionalAmount(support.cargoLss), reserved=support.cargoReservedTons == null ? null : wholeTons(support.cargoReservedTons);
  // Existing reserve semantics: 100 exact LSS per physical ton, whole reserved space.
  if(cargoLss!==null && reserved!==null && BigInt(reserved)!==(scaled(cargoLss)+99999999n)/100000000n) fail();
  // Explicit allowlist at every depth; the reservoir spread contains only validated public amounts.
  return freeze({version:SNAPSHOT_VERSION, campaignPolitics:source.version>=7?projectCampaignPolitics(source.campaignPolitics):null, capturedAt:text(source.capturedAt), campaignDate:text(source.campaignDate),
    world:{name:text(world.name), location:text(world.location), uwp:text(world.uwp), tradeCodes:text(world.tradeCodes), travelZone:text(world.travelZone), starport:text(world.starport), mapReference:mapReference(world.mapReference)},
    ship:{name:text(ship.name), cargoCapacityTons:wholeTons(ship.cargoCapacityTons), cashCredits:optionalAmount(ship.cashCredits), fuel:reservoir(fuel.current, fuel.capacity), lifeSupport:{...reservoir(support.current, support.capacity), cargoLss, daysRemaining:days.current, daysCapacity:days.capacity, cargoReservedTons:reserved}, destination:text(ship.destination)},
    expenses:expenses(source.version===4?{...object(source.expenses),maintenance:LEGACY_MAINTENANCE}:source.expenses),
    cargo:rows(source.cargo, row => ({name:text(row.name), tons:wholeTons(row.tons), purchase:purchase(row.purchase,source.version)})),
    buy:market(source.buy,source.version), sell:market(source.sell,source.version)});
}

// Market handouts do not require ship/cargo data or inherit cargo-link restrictions.
export function projectPlayerMarketSnapshot(source){
 object(source);if(![4,5,6,7,SNAPSHOT_VERSION].includes(source.version))throw Error('Unsupported player snapshot version.');
 const w=object(source.world);
 return freeze({version:SNAPSHOT_VERSION,capturedAt:text(source.capturedAt),campaignDate:text(source.campaignDate),world:{name:text(w.name),location:text(w.location),uwp:text(w.uwp),tradeCodes:text(w.tradeCodes),travelZone:text(w.travelZone),starport:text(w.starport)},buy:market(source.buy,source.version),sell:market(source.sell,source.version)});
}
