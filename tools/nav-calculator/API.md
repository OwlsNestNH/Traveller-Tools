# Traveller Nav calculation API

Version **1.0.0**. This is an in-process calculation library, not a web service.
The existing calculator is its first consumer. No network, DOM, browser storage,
clock or random-number source is used by the engine. There is no framework or
runtime package dependency. Inputs are not mutated; each call returns new result
objects. The API object and its shared constants/tables are frozen.

## Load it in another tool

For a browser script, load the engine before your controller:

```html
<script src="../nav-calculator/engine.js"></script>
<script>
  const result = TravellerNav.solveRoute({
    thrustG: 1,
    profile: 'flip',
    distance: {mode: 'au', au: 1}
  });
  console.log(result.adjustedRoutedMin); // Minutes, before display rounding
</script>
```

For a browser or Node ES module:

```js
import Nav, {solveRoute, computeClearance} from '../nav-calculator/engine.mjs';
const route = solveRoute({thrustG: 1, distance: {mode: 'km', km: 100000}});
const clearance = computeClearance({
  thrustG: 1,
  profile: 'const',
  clearance: {bodyType: 'rocky', sizeCode: '8'}
});
console.log(route.nominalRoutedMin, clearance.timeSelectedMin);
```

For Node CommonJS:

```js
const Nav = require('./tools/nav-calculator/engine.js');
const route = Nav.solveRoute({thrustG: 1, distance: {mode: 'km', km: 100000}});
```

Copy both `engine.js` and `engine.mjs` together if using the ES-module entry point.
Serve browser modules over HTTP(S), with a JavaScript MIME type for `.js`/`.mjs`.
The existing page uses classic scripts, including when opened as a local file.
`engine.mjs` uses the same engine, not a second implementation. Browser loading
also exposes the single `globalThis.TravellerNav` namespace; Node CommonJS/ESM
loading does not set it. No CSS, HTML IDs, calculator initialization or user data
are needed by a consumer.

## Public functions

- `solveRoute(input, rolls = [])`: compute a complete route.
- `computeClearance(input)`: compute 100D only. This always enables clearance,
  regardless of `input.clearance.enabled`; it ignores route/Astrogation inputs.
- `computeDistance(distance)`: compute endpoint and flown distances only.
- `clearanceDistance(clearance)`: compute the 100D distance without thrust/time.
- `requiredDice(astrogation)`: return the ordered die sizes needed for a solve.
- `orbitToAU(whole, fraction)`: convert an orbit entry for a preview. Returns `NaN`
  for invalid whole/range inputs. Calculation functions additionally enforce
  hundredth-step fractions, matching the current UI.
- `API_VERSION` and `constants`: version and immutable original numerical tables.

`API_VERSION` uses semantic versioning. Existing input keys, units and meanings
will not change within version 1. New optional fields may be added. Consumers
should use numeric fields and error codes, not parse display labels or messages.

## Route input

All inputs are plain objects. Use numbers for quantities; nonempty numeric strings
are also accepted for form adapters. Booleans, null, nonnumeric strings, `NaN` and
infinities are not numeric quantities. `profile` defaults to `flip` and accepts
`flip` (arrive stopped) or `const` (constant thrust, no braking).

```js
const input = {
  thrustG: 1,                 // Positive G, 1 G = 9.80665 m/s²
  profile: 'flip',
  distance: {mode: 'km', km: 100000},
  clearance: {               // Optional, disabled by default
    enabled: true,
    bodyType: 'rocky',        // Default rocky
    sizeCode: '8'             // Default 8
  },
  astrogation: {              // Optional, disabled by default
    enabled: true,
    autoDice: false,          // Default true when Astrogation is enabled
    effect: 2,               // Whole integer -1000..1000
    manualPercent: ''        // Nonblank overrides effect; must be below 100
  }
};
```

Use booleans for `enabled` and `autoDice`. Fields belonging to inactive modes are
ignored. There are four distance shapes:

```js
{mode: 'km', km: 100000}
{mode: 'au', au: 1}
{mode: 'orbit', start: {whole: 3, fraction: 0}, end: {whole: 6, fraction: .25}}
{mode: 'map',
 a: {mode: 'au', au: 1},
 b: {mode: 'orbit', orbit: {whole: 6, fraction: 0}},
 separation: '2', routeType: 'trans', safety: 2}
```

- Orbit whole: 0..20. Calculation fraction: 0..0.99 in steps of 0.01.
- Map body `mode` defaults to `au`. Both radii must be positive.
- Separation: `same`, `1`, `2`, `3`, `opp`, corresponding to 0°, 45°, 90°, 135°, 180°.
- `routeType` defaults to `direct`; `trans` requires a positive finite `safety`
  multiplier. The current UI offers 1.5, 2.0 and 2.5.
- Direct map routes use chord geometry. Trans-solar distance is the sum of the
  radii times the selected multiplier. Zero endpoint separation is an error.
- One AU remains 150,000,000 km. One-way communication lag remains 8.3 min/AU.

Clearance body types: `rocky`, `gg_small`, `gg_std`, `gg_large`, `gg_super`.
Rocky size codes: `0`, `R`, `S`, `1`..`9`, `A`..`F`. `0` and `R` are N/A.
The original size/giant presets and orbit table are unchanged; this refactor
makes no new claim that the inherited handbook rules were independently verified.

## Deterministic dice

The engine never rolls dice. Supply explicit integer die results in order.
Missing rolls throw `DICE_REQUIRED`, including the full `error.sides` array.
Extra, sparse, noninteger or out-of-range rolls throw `INVALID_DICE`.

```js
const astrogation = {enabled: true, effect: 3, autoDice: true};
Nav.requiredDice(astrogation); // [3, 3, 3]
const result = Nav.solveRoute({
  thrustG: 1, distance: {mode: 'km', km: 100000}, astrogation
}, [1, 3, 2]); // A fixed 6% reduction
```

Positive Effects use D3 per point. Negative Effects use D6 per absolute point;
Effects -6 and lower prepend four D6. With `autoDice:false`, expected values are
2 per D3 and 3.5 per D6. Effect 0, disabled Astrogation and manual percentages
require no dice. Negative manual percentages increase time. A result at zero or
negative travel time is rejected.

The frontend first calls `solveRoute` without rolls, then supplies rolls only if
it receives `DICE_REQUIRED`. This retains validation-before-rolling and the
existing random-call order. Other hosts may supply recorded rolls directly.
`requiredDice` validates only Astrogation; it does not validate the route.

## Result fields and units

`solveRoute` returns:

- `thrustG`, `profile`: normalized thrust/profile.
- `distance`: `{rawKm, routedKm, arcMult, modeLabel}`. `rawKm` is endpoint
  separation. `routedKm` is flown distance. `arcMult` is routed/raw.
- `jump`: `{clearanceKm, label}`. This is advisory and never added to the route.
- `jumpTimeConstMin`, `jumpTimeFlipMin`, `jumpTimeSelMin`: 100D advisory minutes
  under each profile and the selected profile. Zero if clearance is absent/N/A.
- `totalKm`: routed distance only.
- `commLagMin`: one-way signal lag using raw endpoint separation, not detour.
- `nominalRoutedMin`, `adjustedRoutedMin`: routed travel minutes before/after
  Astrogation. Display rounding is the caller's responsibility.
- `vKmS`: midpoint peak speed for `flip`, arrival speed for `const`.
- `astrogation`: `{kind, effect?, autoDice?, percent?, sides, totalPct,
  adjustedMinutes, rolls}`. Kind is `none`, `manual`, `zero`, `optimization`,
  `inefficiency` or `failure`. `sides`/`rolls` are fresh arrays.
- `warnings`: codes for nonrepresentable advisory values, otherwise `[]`.

`computeClearance` returns `{thrustG, profile, jump, timeConstMin, timeFlipMin,
timeSelectedMin}`. `computeDistance` returns the `distance` shape above.
`clearanceDistance` returns the `jump` shape above.

Main distance, route time and speed must be positive/finite as appropriate.
At extreme numerical limits an unrepresentable `arcMult` or route advisory 100D
time is `null`, not `Infinity`; route warnings contain
`ARC_MULTIPLIER_OUT_OF_RANGE` or `CLEARANCE_TIME_OUT_OF_RANGE`. This preserves the
current frontend's em-dash advisory display while keeping public results JSON-safe.
The standalone 100D action rejects an unrepresentable selected clearance time.
Labels are informational and may use the host locale for thousands separators.

## Errors and ownership

Errors are ordinary `Error` instances with stable `.code`:

- `INVALID_INPUT`: invalid quantities/enums or unsupported calculation range.
- `DICE_REQUIRED`: missing required dice; `.sides` lists every required die size.
- `INVALID_DICE`: wrong number, type or value of supplied dice.

Display `.message` as plain text, or map `.code` to your own presentation.
The UI controller owns route/100D mode, invalidation after edits, reset defaults,
recalculation, clipboard, focus and all formatting. The engine keeps no session
state. Hosts decide how to persist, synchronize or present their own inputs;
this change adds no persistence, server, transport, or integration with other tools.

## Verification

`node --test verification/engine.test.mjs` checks Node/ESM/isolated-host reuse,
fixed arithmetic, all orbit entries, map combinations, clearance presets,
Astrogation/explicit dice, invalid inputs, immutability, numeric limits and exact
unchanged HTML/CSS. Browser suites verify the real UI and a separate module
consumer. `verification/parity.test.mjs` compares every UI transition against the
SHA-256-locked PR264 baseline with fixed random sequences, desktop and mobile.
